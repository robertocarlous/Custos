import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { createWalletClient, custom, type EIP1193Provider, type WalletClient } from "viem";
import { robinhoodChainTestnet } from "../config/deployment";

export type WalletStatus = "unavailable" | "disconnected" | "connecting" | "connected";

interface EIP6963ProviderDetail {
  provider: EIP1193Provider;
}

/**
 * Wallet extensions don't always set window.ethereum synchronously before this
 * component's first render -- especially with several extensions installed,
 * where legacy injection can race or lose to another extension entirely.
 * Modern wallets announce themselves via the EIP-6963 event instead, which
 * this also listens for. Resolves with whichever arrives first; null if
 * neither shows up within the timeout (genuinely no wallet installed).
 */
function detectProvider(timeoutMs = 3000): Promise<EIP1193Provider | null> {
  return new Promise((resolve) => {
    if (window.ethereum) {
      resolve(window.ethereum);
      return;
    }

    let settled = false;
    const finish = (provider: EIP1193Provider | null) => {
      if (settled) return;
      settled = true;
      window.removeEventListener("eip6963:announceProvider", onAnnounce as EventListener);
      clearInterval(pollId);
      clearTimeout(timeoutId);
      resolve(provider);
    };

    const onAnnounce = (event: CustomEvent<EIP6963ProviderDetail>) => finish(event.detail.provider);
    window.addEventListener("eip6963:announceProvider", onAnnounce as EventListener);
    window.dispatchEvent(new Event("eip6963:requestProvider"));

    // Fallback for wallets that only ever set window.ethereum (no EIP-6963
    // announcement), just later than this component's first render.
    const pollId = setInterval(() => {
      if (window.ethereum) finish(window.ethereum);
    }, 150);

    const timeoutId = setTimeout(() => finish(window.ethereum ?? null), timeoutMs);
  });
}

/**
 * viem wraps the raw EIP-1193 provider error (e.g. { code: 4902, ... } for an
 * unrecognized chain) inside its own error types, sometimes nesting the
 * original under `.cause` rather than exposing `.code` at the top level.
 * Walk a few levels rather than assuming either shape.
 */
function findErrorCode(err: unknown, depth = 0): number | undefined {
  if (!err || typeof err !== "object" || depth > 4) return undefined;
  const code = (err as { code?: unknown }).code;
  if (typeof code === "number") return code;
  return findErrorCode((err as { cause?: unknown }).cause, depth + 1);
}

function describeWalletError(err: unknown, fallback: string): string {
  if (err instanceof Error) {
    // viem's error messages are verbose (multi-paragraph with a "Version:" footer);
    // the short one-line summary is the first line and is what's worth showing.
    const firstLine = err.message.split("\n")[0]?.trim();
    return firstLine || fallback;
  }
  return fallback;
}

interface WalletContextValue {
  walletClient: WalletClient | null;
  address: `0x${string}` | null;
  chainId: number | null;
  status: WalletStatus;
  /** True while still checking for a late-injecting or EIP-6963 wallet -- distinguish this from a confirmed "unavailable" in the UI. */
  detecting: boolean;
  error: string | null;
  isCorrectChain: boolean;
  connect: () => Promise<void>;
  switchToGuardChain: () => Promise<void>;
}

const WalletContext = createContext<WalletContextValue | null>(null);

/**
 * Single source of truth for the connected wallet, shared via context so the
 * nav's connect button and any page's write-flow panel see the same state --
 * two independent useState-backed instances would only resync on an
 * "accountsChanged" event, which is fragile to depend on for initial connect.
 */
export function WalletProvider({ children }: { children: ReactNode }) {
  const [provider, setProvider] = useState<EIP1193Provider | null>(window.ethereum ?? null);
  const [detecting, setDetecting] = useState(!window.ethereum);
  const [address, setAddress] = useState<`0x${string}` | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [status, setStatus] = useState<WalletStatus>(window.ethereum ? "disconnected" : "unavailable");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (provider) return;
    let cancelled = false;
    detectProvider().then((found) => {
      if (cancelled || !found) return;
      setProvider(found);
      setStatus("disconnected");
    }).finally(() => {
      if (!cancelled) setDetecting(false);
    });
    return () => {
      cancelled = true;
    };
  }, [provider]);

  const walletClient: WalletClient | null = useMemo(() => {
    if (!provider) return null;
    return createWalletClient({ chain: robinhoodChainTestnet, transport: custom(provider) });
  }, [provider]);

  const refreshAccounts = useCallback(async () => {
    if (!walletClient) return;
    const addresses = await walletClient.getAddresses();
    setAddress(addresses[0] ?? null);
    setStatus(addresses[0] ? "connected" : "disconnected");
  }, [walletClient]);

  const refreshChain = useCallback(async () => {
    if (!walletClient) return null;
    const id = await walletClient.getChainId();
    setChainId(id);
    return id;
  }, [walletClient]);

  useEffect(() => {
    if (!provider) return;
    refreshAccounts();
    refreshChain();

    const onAccountsChanged = (accounts: string[]) => {
      setAddress((accounts[0] as `0x${string}`) ?? null);
      setStatus(accounts[0] ? "connected" : "disconnected");
    };
    const onChainChanged = (id: string) => setChainId(parseInt(id, 16));

    provider.on?.("accountsChanged", onAccountsChanged);
    provider.on?.("chainChanged", onChainChanged);
    return () => {
      provider.removeListener?.("accountsChanged", onAccountsChanged);
      provider.removeListener?.("chainChanged", onChainChanged);
    };
  }, [provider, refreshAccounts, refreshChain]);

  const connect = useCallback(async () => {
    if (!walletClient) return;
    setStatus("connecting");
    setError(null);
    try {
      const addresses = await walletClient.requestAddresses();
      setAddress(addresses[0] ?? null);
      setStatus(addresses[0] ? "connected" : "disconnected");
      await refreshChain();
    } catch (err) {
      setStatus("disconnected");
      setError(describeWalletError(err, "Failed to connect wallet"));
    }
  }, [walletClient, refreshChain]);

  const switchToGuardChain = useCallback(async () => {
    if (!walletClient) return;
    setError(null);
    try {
      await walletClient.switchChain({ id: robinhoodChainTestnet.id });
    } catch (err) {
      // viem wraps the raw provider error; the EIP-3085 "unrecognized chain"
      // code can show up at the top level or nested under `.cause`.
      const code = findErrorCode(err);
      if (code !== 4902) {
        setError(describeWalletError(err, "Failed to switch network"));
        return;
      }
      try {
        await walletClient.addChain({ chain: robinhoodChainTestnet });
        await walletClient.switchChain({ id: robinhoodChainTestnet.id });
      } catch (retryErr) {
        // Most wallets auto-switch once the chain is added; some report an
        // error on this second call anyway even though the add succeeded.
        // Trust refreshChain()'s actual read over the wallet's claim.
        const idAfterAdd = await refreshChain();
        if (idAfterAdd !== robinhoodChainTestnet.id) {
          setError(
            describeWalletError(
              retryErr,
              "Added Robinhood Chain Testnet, but couldn't switch to it automatically -- switch manually in your wallet.",
            ),
          );
        }
        return;
      }
    }
    await refreshChain();
  }, [walletClient, refreshChain]);

  const value: WalletContextValue = {
    walletClient,
    address,
    chainId,
    status,
    detecting,
    error,
    isCorrectChain: chainId === robinhoodChainTestnet.id,
    connect,
    switchToGuardChain,
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within a WalletProvider");
  return ctx;
}
