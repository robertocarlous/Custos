import { createPublicClient, http, defineChain, type Address } from "viem";
import { OracleGuardClient } from "../src/index.js";

const robinhoodChainTestnet = defineChain({
  id: 46630,
  name: "Robinhood Chain Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.chain.robinhood.com"] } },
});

const ORACLE_GUARD_ADDRESS: Address = "0x36D03E7a80Ee403c779095c825340c9bf92f2740";
const TESTNET_TSLA: Address = "0xC9f9c86933092BbbfFF3CCb4b105A4A94bf3Bd4E";

async function main() {
  const publicClient = createPublicClient({ chain: robinhoodChainTestnet, transport: http() });
  const guard = new OracleGuardClient(publicClient, ORACLE_GUARD_ADDRESS);

  const safePrice = await guard.getSafePrice(TESTNET_TSLA);
  console.log("getSafePrice(TSLA):", safePrice);

  const liquidation = await guard.preflightLiquidation(TESTNET_TSLA);
  console.log("preflightLiquidation(TSLA):", liquidation);

  const marketOpen = await guard.isMarketOpen();
  console.log("isMarketOpen():", marketOpen);

  const config = await guard.getTokenConfig(TESTNET_TSLA);
  console.log("getTokenConfig(TSLA):", config);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
