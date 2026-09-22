export interface DocsNavItem {
  id: string;
  label: string;
}

export interface DocsNavGroup {
  title: string;
  items: DocsNavItem[];
}

/** Single source of truth for the docs sidebar -- ids must match heading ids in DocsPage.tsx. */
export const DOCS_NAV: DocsNavGroup[] = [
  {
    title: "Getting started",
    items: [
      { id: "overview", label: "Overview" },
      { id: "prerequisites", label: "Prerequisites" },
      { id: "installation", label: "Installation" },
      { id: "quickstart", label: "Quickstart" },
      { id: "project-setup", label: "Project setup" },
    ],
  },
  {
    title: "Core concepts",
    items: [
      { id: "understanding-the-result", label: "Understanding the result" },
      { id: "guard-reason", label: "The GuardReason enum" },
    ],
  },
  {
    title: "API reference",
    items: [
      { id: "constructor", label: "new OracleGuardClient()" },
      { id: "get-safe-price", label: "getSafePrice()" },
      { id: "is-liquidation-allowed", label: "isLiquidationAllowed()" },
      { id: "is-liquidation-allowed-detailed", label: "isLiquidationAllowedDetailed()" },
      { id: "preflight-liquidation", label: "preflightLiquidation()" },
      { id: "get-token-config", label: "getTokenConfig()" },
      { id: "is-market-open", label: "isMarketOpen()" },
    ],
  },
  {
    title: "Next steps",
    items: [{ id: "next-steps", label: "Where to go from here" }],
  },
];

export const DOCS_SECTION_IDS: string[] = DOCS_NAV.flatMap((g) => g.items.map((i) => i.id));
