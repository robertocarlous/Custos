export const oracleGuardAbi = [
  {
    type: "function",
    name: "getSafePrice",
    stateMutability: "view",
    inputs: [{ name: "token", type: "address" }],
    outputs: [
      { name: "price", type: "int256" },
      { name: "isSafe", type: "bool" },
      { name: "reason", type: "uint8" },
    ],
  },
  {
    type: "function",
    name: "isLiquidationAllowed",
    stateMutability: "view",
    inputs: [{ name: "token", type: "address" }],
    outputs: [{ name: "allowed", type: "bool" }],
  },
  {
    type: "function",
    name: "isLiquidationAllowedDetailed",
    stateMutability: "view",
    inputs: [{ name: "token", type: "address" }],
    outputs: [
      { name: "allowed", type: "bool" },
      { name: "reason", type: "uint8" },
    ],
  },
  {
    type: "function",
    name: "tokenConfigs",
    stateMutability: "view",
    inputs: [{ name: "token", type: "address" }],
    outputs: [
      { name: "priceFeed", type: "address" },
      { name: "weekdayStaleness", type: "uint256" },
      { name: "weekendStaleness", type: "uint256" },
      { name: "configured", type: "bool" },
    ],
  },
  {
    type: "function",
    name: "calendarRegistry",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

export const marketCalendarRegistryAbi = [
  {
    type: "function",
    name: "isMarketOpen",
    stateMutability: "view",
    inputs: [{ name: "timestamp", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "dayId",
    stateMutability: "pure",
    inputs: [{ name: "timestamp", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;
