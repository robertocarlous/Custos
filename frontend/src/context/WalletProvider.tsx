import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { createWalletClient, custom, type WalletClient } from "viem";
import { robinhoodChainTestnet } from "../config/deployment";

export type WalletStatus = "unavailable" | "disconnected" | "connecting" | "connected";

interface WalletContextValue {
  walletClient: WalletClient | null;
  address: `0x${string}` | null;
  chainId: number | null;
  status: WalletStatus;
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
  const [address, setAddress] = useState<`0x${string}` | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [status, setStatus] = useState<WalletStatus>(window.ethereum ? "disconnected" : "unavailable");
  const [error, setError] = useState<string | null>(null);

  const walletClient: WalletClient | null = useMemo(() => {
    if (!window.ethereum) return null;
    return createWalletClient({ chain: robinhoodChainTestnet, transport: custom(window.ethereum) });
  }, []);

  const refreshAccounts = useCallback(async () => {
    if (!walletClient) return;
    const addresses = await walletClient.getAddresses();
    setAddress(addresses[0] ?? null);
    setStatus(addresses[0] ? "connected" : "disconnected");
  }, [walletClient]);

  const refreshChain = useCallback(async () => {
    if (!walletClient) return;
    setChainId(await walletClient.getChainId());
  }, [walletClient]);

  useEffect(() => {
    if (!window.ethereum) return;
    refreshAccounts();
    refreshChain();

    const onAccountsChanged = (accounts: string[]) => {
      setAddress((accounts[0] as `0x${string}`) ?? null);
      setStatus(accounts[0] ? "connected" : "disconnected");
    };
    const onChainChanged = (id: string) => setChainId(parseInt(id, 16));

    window.ethereum.on?.("accountsChanged", onAccountsChanged);
    window.ethereum.on?.("chainChanged", onChainChanged);
    return () => {
      window.ethereum?.removeListener?.("accountsChanged", onAccountsChanged);
      window.ethereum?.removeListener?.("chainChanged", onChainChanged);
    };
  }, [refreshAccounts, refreshChain]);

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
      setError(err instanceof Error ? err.message : "Failed to connect wallet");
    }
  }, [walletClient, refreshChain]);

  const switchToGuardChain = useCallback(async () => {
    if (!walletClient) return;
    setError(null);
    try {
      await walletClient.switchChain({ id: robinhoodChainTestnet.id });
    } catch (err) {
      const code = (err as { code?: number })?.code;
      if (code === 4902) {
        await walletClient.addChain({ chain: robinhoodChainTestnet });
        await walletClient.switchChain({ id: robinhoodChainTestnet.id });
      } else {
        setError(err instanceof Error ? err.message : "Failed to switch network");
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
