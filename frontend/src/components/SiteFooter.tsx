import { Logo } from "./Logo";
import {
  DEMO_BORROW_ASSET_ADDRESS,
  GUARDED_TOKENS,
  MARKET_CALENDAR_REGISTRY_ADDRESS,
  ORACLE_GUARD_ADDRESS,
  REFERENCE_LENDING_POOL_ADDRESS,
  robinhoodChainTestnet,
} from "../config/deployment";

const EXPLORER_BASE = robinhoodChainTestnet.blockExplorers!.default.url;

const CORE_CONTRACTS = [
  { label: "OracleGuard", address: ORACLE_GUARD_ADDRESS },
  { label: "MarketCalendarRegistry", address: MARKET_CALENDAR_REGISTRY_ADDRESS },
  { label: "ReferenceLendingPool", address: REFERENCE_LENDING_POOL_ADDRESS },
  { label: "Demo borrow asset (dUSD)", address: DEMO_BORROW_ASSET_ADDRESS },
  ...GUARDED_TOKENS.map((t) => ({ label: `${t.symbol} (Stock Token)`, address: t.address })),
];

export function SiteFooter() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer__grid">
          <div>
            <div className="footer__brand">
              <Logo size={20} />
              Stock Oracle Guard
            </div>
            <p className="footer__about">
              A reusable on-chain safety layer for Chainlink price feeds on Robinhood Chain Stock
              Tokens. Built for the Arbitrum Open House Singapore Buildathon.
            </p>
          </div>

          <div>
            <div className="footer__address-label">Live on {robinhoodChainTestnet.name} (chain {robinhoodChainTestnet.id})</div>
            <div className="footer__addresses" style={{ marginTop: 12 }}>
              {CORE_CONTRACTS.map((c) => (
                <div key={c.address}>
                  <div className="footer__address-label">{c.label}</div>
                  <a
                    className="footer__address-value"
                    href={`${EXPLORER_BASE}/address/${c.address}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {c.address}
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="footer__bottom">
          <span>Testnet demo -- Chainlink feeds are mocked; none exist on Robinhood Chain testnet yet.</span>
          <a href={EXPLORER_BASE} target="_blank" rel="noreferrer">
            View on explorer
          </a>
        </div>
      </div>
    </footer>
  );
}
