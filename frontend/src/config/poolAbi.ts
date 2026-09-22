/**
 * ABI slice for ReferenceLendingPool -- read/write functions used by the live
 * "run it yourself" flow, the Deposit/Borrow/Liquidate events the activity
 * feed streams, and the custom errors so reverts can be decoded into the
 * exact OracleGuard.Reason / pool-level reason instead of a raw hex selector.
 * See contracts/src/ReferenceLendingPool.sol for the full contract; the SDK
 * doesn't wrap this contract (only OracleGuard / MarketCalendarRegistry), so
 * this reaches around it directly.
 */
export const referenceLendingPoolAbi = [
  {
    type: "function",
    name: "collateralBalanceOf",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "borrowBalanceOf",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "isHealthy",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "depositCollateral",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "borrow",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "liquidate",
    stateMutability: "nonpayable",
    inputs: [
      { name: "borrower", type: "address" },
      { name: "repayAmount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "event",
    name: "Deposit",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Withdraw",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Borrow",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Repay",
    inputs: [
      { name: "borrower", type: "address", indexed: true },
      { name: "payer", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Liquidate",
    inputs: [
      { name: "borrower", type: "address", indexed: true },
      { name: "liquidator", type: "address", indexed: true },
      { name: "repayAmount", type: "uint256", indexed: false },
      { name: "collateralSeized", type: "uint256", indexed: false },
    ],
  },
  { type: "error", name: "ZeroAmount", inputs: [] },
  { type: "error", name: "InsufficientCollateralBalance", inputs: [] },
  { type: "error", name: "InsufficientBorrowBalance", inputs: [] },
  { type: "error", name: "PositionWouldBeUnhealthy", inputs: [] },
  { type: "error", name: "OraclePriceUnsafe", inputs: [{ name: "reason", type: "uint8" }] },
  { type: "error", name: "LiquidationNotAllowed", inputs: [{ name: "reason", type: "uint8" }] },
  { type: "error", name: "PositionIsHealthy", inputs: [] },
  { type: "error", name: "RepayExceedsRequired", inputs: [] },
] as const;
