import { useWallet } from "../../context/WalletProvider";

function truncate(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function ConnectWalletButton() {
  const { address, status, isCorrectChain, connect, switchToGuardChain } = useWallet();

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
        <button className="button button--secondary button--sm" onClick={switchToGuardChain}>
          Switch network
        </button>
      );
    }
    return <span className="nav__chain-pill mono">{truncate(address)}</span>;
  }

  return (
    <button className="button button--primary button--sm" onClick={connect} disabled={status === "connecting"}>
      {status === "connecting" ? "Connecting…" : "Connect wallet"}
    </button>
  );
}
