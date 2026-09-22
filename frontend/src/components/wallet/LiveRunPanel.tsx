import { useEffect, useState } from "react";
import { formatUnits, parseUnits, type Address } from "viem";
import { useWallet } from "../../context/WalletProvider";
import { usePoolPosition, POOL_COLLATERAL } from "../../hooks/usePoolPosition";
import { useTxRunner } from "../../hooks/useTxRunner";
import { TxStatusLine } from "./TxStatusLine";
import { simulateAndWrite } from "../../lib/tx";
import { erc20Abi } from "../../config/erc20Abi";
import { aggregatorV3Abi } from "../../config/aggregatorAbi";
import { referenceLendingPoolAbi } from "../../config/poolAbi";
import { oracleGuard, publicClient } from "../../config/client";
import { DEMO_BORROW_ASSET_ADDRESS, REFERENCE_LENDING_POOL_ADDRESS } from "../../config/deployment";

function fmt(v: bigint, decimals = 18, dp = 4): string {
  return Number(formatUnits(v, decimals)).toLocaleString("en-US", { maximumFractionDigits: dp });
}

export function LiveRunPanel({ onActivity }: { onActivity?: () => void }) {
  const { walletClient, address, status, isCorrectChain, connect, switchToGuardChain } = useWallet();
  const { position, refresh } = usePoolPosition(address);
  const [feedAddress, setFeedAddress] = useState<Address | null>(null);

  useEffect(() => {
    oracleGuard.getTokenConfig(POOL_COLLATERAL.address).then((cfg) => setFeedAddress(cfg.priceFeed));
  }, []);

  const afterTx = () => {
    refresh();
    onActivity?.();
  };

  const [depositAmount, setDepositAmount] = useState("5");
  const depositTx = useTxRunner(afterTx);

  const [borrowAmount, setBorrowAmount] = useState("1000");
  const borrowTx = useTxRunner(afterTx);

  const [crashPrice, setCrashPrice] = useState("150");
  const crashTx = useTxRunner(afterTx);

  const [liquidateBorrower, setLiquidateBorrower] = useState("");
  const [repayAmount, setRepayAmount] = useState("200");
  const liquidateTx = useTxRunner(afterTx);

  if (status === "unavailable") {
    return (
      <div className="panel">
        <p className="muted">
          No wallet extension detected. Install MetaMask (or any injected wallet) to run this live.
        </p>
      </div>
    );
  }

  if (status !== "connected" || !address) {
    return (
      <div className="panel" style={{ textAlign: "center", padding: "40px 24px" }}>
        <p className="muted" style={{ marginBottom: 16 }}>
          Connect a wallet to deposit, borrow, crash the price, and liquidate against the live pool.
        </p>
        <button className="button button--primary" onClick={connect} disabled={status === "connecting"}>
          {status === "connecting" ? "Connecting…" : "Connect wallet"}
        </button>
      </div>
    );
  }

  if (!isCorrectChain) {
    return (
      <div className="panel" style={{ textAlign: "center", padding: "40px 24px" }}>
        <p className="muted" style={{ marginBottom: 16 }}>
          Wrong network -- switch to Robinhood Chain Testnet to continue.
        </p>
        <button className="button button--primary" onClick={switchToGuardChain}>
          Switch network
        </button>
      </div>
    );
  }

  const needsFaucet = position && position.collateralTokenBalance === 0n && position.collateral === 0n;

  return (
    <div>
      <div className="panel" style={{ marginBottom: 18 }}>
        <div className="panel__header">
          <h2>Your position</h2>
          <span className="mono muted">{address.slice(0, 6)}…{address.slice(-4)}</span>
        </div>
        {!position ? (
          <p className="muted">Loading…</p>
        ) : (
          <div className="position-grid">
            <div>
              <div className="footer__address-label">{POOL_COLLATERAL.symbol} wallet balance</div>
              <div>{fmt(position.collateralTokenBalance)}</div>
            </div>
            <div>
              <div className="footer__address-label">dUSD wallet balance</div>
              <div>{fmt(position.borrowTokenBalance)}</div>
            </div>
            <div>
              <div className="footer__address-label">Collateral deposited</div>
              <div>{fmt(position.collateral)}</div>
            </div>
            <div>
              <div className="footer__address-label">Debt outstanding</div>
              <div>{fmt(position.debt)}</div>
            </div>
            <div>
              <div className="footer__address-label">Position health</div>
              <div className={position.healthy ? "text-good" : "text-bad"}>
                {position.debt === 0n ? "no debt" : position.healthy ? "healthy" : "liquidatable"}
              </div>
            </div>
          </div>
        )}
        {needsFaucet && (
          <p className="callout" style={{ marginTop: 14 }}>
            You need real testnet {POOL_COLLATERAL.symbol} to deposit. Get some from{" "}
            <a href="https://faucet.testnet.chain.robinhood.com" target="_blank" rel="noreferrer">
              faucet.testnet.chain.robinhood.com
            </a>
            .
          </p>
        )}
      </div>

      <div className="action-grid">
        <div className="panel action-card">
          <h4>1. Deposit collateral</h4>
          <p className="muted">Approves if needed, then deposits {POOL_COLLATERAL.symbol} into the pool.</p>
          <div className="action-card__row">
            <input value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} disabled={depositTx.busy} />
            <button
              className="button button--secondary button--sm"
              disabled={depositTx.busy || !walletClient}
              onClick={() =>
                depositTx.run(async () => {
                  const amountWei = parseUnits(depositAmount, 18);
                  if (!position || position.collateralAllowance < amountWei) {
                    const approveHash = await simulateAndWrite(walletClient!, address, {
                      address: POOL_COLLATERAL.address,
                      abi: erc20Abi,
                      functionName: "approve",
                      args: [REFERENCE_LENDING_POOL_ADDRESS, amountWei],
                    });
                    await publicClient.waitForTransactionReceipt({ hash: approveHash });
                  }
                  return simulateAndWrite(walletClient!, address, {
                    address: REFERENCE_LENDING_POOL_ADDRESS,
                    abi: referenceLendingPoolAbi,
                    functionName: "depositCollateral",
                    args: [amountWei],
                  });
                })
              }
            >
              Deposit
            </button>
          </div>
          <TxStatusLine state={depositTx.state} />
        </div>

        <div className="panel action-card">
          <h4>2. Borrow dUSD</h4>
          <p className="muted">Max 70% LTV against your deposited collateral.</p>
          <div className="action-card__row">
            <input value={borrowAmount} onChange={(e) => setBorrowAmount(e.target.value)} disabled={borrowTx.busy} />
            <button
              className="button button--secondary button--sm"
              disabled={borrowTx.busy || !walletClient}
              onClick={() =>
                borrowTx.run(() =>
                  simulateAndWrite(walletClient!, address, {
                    address: REFERENCE_LENDING_POOL_ADDRESS,
                    abi: referenceLendingPoolAbi,
                    functionName: "borrow",
                    args: [parseUnits(borrowAmount, 18)],
                  }),
                )
              }
            >
              Borrow
            </button>
          </div>
          <TxStatusLine state={borrowTx.state} />
        </div>

        <div className="panel action-card">
          <h4>3. Crash the price</h4>
          <p className="muted">
            Pushes a new answer to the demo mock feed ({feedAddress ? `${feedAddress.slice(0, 6)}…${feedAddress.slice(-4)}` : "loading…"}), dated now.
          </p>
          <div className="action-card__row">
            <span className="action-card__prefix">$</span>
            <input value={crashPrice} onChange={(e) => setCrashPrice(e.target.value)} disabled={crashTx.busy} />
            <button
              className="button button--secondary button--sm"
              disabled={crashTx.busy || !walletClient || !feedAddress}
              onClick={() =>
                crashTx.run(() =>
                  simulateAndWrite(walletClient!, address, {
                    address: feedAddress!,
                    abi: aggregatorV3Abi,
                    functionName: "setAnswer",
                    args: [parseUnits(crashPrice, 8), BigInt(Math.floor(Date.now() / 1000))],
                  }),
                )
              }
            >
              Push price
            </button>
          </div>
          <TxStatusLine state={crashTx.state} />
        </div>

        <div className="panel action-card">
          <h4>4. Liquidate</h4>
          <p className="muted">Defaults to your own position (self-liquidation is allowed).</p>
          <div className="action-card__row action-card__row--stacked">
            <input
              placeholder={address}
              value={liquidateBorrower}
              onChange={(e) => setLiquidateBorrower(e.target.value)}
              disabled={liquidateTx.busy}
            />
            <div className="action-card__row">
              <input value={repayAmount} onChange={(e) => setRepayAmount(e.target.value)} disabled={liquidateTx.busy} />
              <button
                className="button button--secondary button--sm"
                disabled={liquidateTx.busy || !walletClient}
                onClick={() =>
                  liquidateTx.run(async () => {
                    const repayWei = parseUnits(repayAmount, 18);
                    const borrower = (liquidateBorrower || address) as Address;
                    if (!position || position.borrowAllowance < repayWei) {
                      const approveHash = await simulateAndWrite(walletClient!, address, {
                        address: DEMO_BORROW_ASSET_ADDRESS,
                        abi: erc20Abi,
                        functionName: "approve",
                        args: [REFERENCE_LENDING_POOL_ADDRESS, repayWei],
                      });
                      await publicClient.waitForTransactionReceipt({ hash: approveHash });
                    }
                    return simulateAndWrite(walletClient!, address, {
                      address: REFERENCE_LENDING_POOL_ADDRESS,
                      abi: referenceLendingPoolAbi,
                      functionName: "liquidate",
                      args: [borrower, repayWei],
                    });
                  })
                }
              >
                Liquidate
              </button>
            </div>
          </div>
          <TxStatusLine state={liquidateTx.state} />
        </div>
      </div>
    </div>
  );
}
