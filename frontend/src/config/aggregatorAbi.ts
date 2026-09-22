/**
 * Standard Chainlink AggregatorV3Interface read slice, plus MockAggregatorV3's
 * setAnswer -- the demo mock feeds used on testnet (see "Testnet reality" in
 * contracts/README.md) expose this with no access control, which is what lets
 * the "crash the price" step run from any connected wallet.
 */
export const aggregatorV3Abi = [
  {
    type: "function",
    name: "latestRoundData",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "roundId", type: "uint80" },
      { name: "answer", type: "int256" },
      { name: "startedAt", type: "uint256" },
      { name: "updatedAt", type: "uint256" },
      { name: "answeredInRound", type: "uint80" },
    ],
  },
  {
    type: "function",
    name: "setAnswer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "answer_", type: "int256" },
      { name: "updatedAt_", type: "uint256" },
    ],
    outputs: [],
  },
] as const;
