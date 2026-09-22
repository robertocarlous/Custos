import { useState } from "react";
import { useWallet } from "../../context/WalletProvider";

function truncate(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function ConnectWalletButton() {
  const { address, status, detecting, error, isCorrectChain, connect, switchToGuardChain } = useWallet();
  const [switching, setSwitching] = useState(false);

  const handleSwitchChain = async () => {
    setSwitching(true);
    try {
      await switchToGuardChain();
    } finally {
      setSwitching(false);
    }
  };

  if (status === "unavailable" && detecting) {
    return <span className="nav__chain-pill">Checking for wallet…</span>;
  }

  if (status === "unavailable") {
    return (
      <span className="nav__chain-pill" title="No wallet extension detected (e.g. MetaMask)">
        No wallet found
      </span>
    );
  }

  if (status === "connected" && address) {
    if (!isCorrectChain) {
      return (
        <button
          className="button button--secondary button--sm"
          onClick={handleSwitchChain}
          disabled={switching}
          title={error ?? "Switch your wallet to Robinhood Chain Testnet"}
        >
          {switching ? "Switching…" : error ? "Switch failed -- retry" : "Switch network"}
        </button>
      );
    }
    return <span className="nav__chain-pill mono">{truncate(address)}</span>;
  }

  return (
    <button
      className="button button--primary button--sm"
      onClick={connect}
      disabled={status === "connecting"}
      title={error ?? undefined}
    >
      {status === "connecting" ? "Connecting…" : "Connect wallet"}
    </button>
  );
}
