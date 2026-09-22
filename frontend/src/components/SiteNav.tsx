import { NavLink } from "react-router-dom";
import { Logo } from "./Logo";
import { ConnectWalletButton } from "./wallet/ConnectWalletButton";
import { robinhoodChainTestnet } from "../config/deployment";

const LINKS = [
  { to: "/", label: "Overview", end: true },
  { to: "/dashboard", label: "Dashboard" },
  { to: "/walkthrough", label: "Walkthrough" },
  { to: "/docs", label: "Docs" },
];

export function SiteNav() {
  return (
    <nav className="nav">
      <div className="container nav__inner">
        <NavLink to="/" className="nav__brand">
          <span className="nav__brand-mark">
            <Logo />
          </span>
          Stock Oracle Guard
        </NavLink>

        <div className="nav__links">
          {LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) => `nav__link${isActive ? " active" : ""}`}
            >
              {link.label}
            </NavLink>
          ))}
        </div>

        <div className="nav__right">
          <span className="nav__chain-pill">
            <span className="nav__chain-dot" />
            {robinhoodChainTestnet.name}
          </span>
          <ConnectWalletButton />
        </div>
      </div>
    </nav>
  );
}
