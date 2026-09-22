import { createPublicClient, http } from "viem";
import { OracleGuardClient } from "@stock-oracle-guard/sdk";
import { ORACLE_GUARD_ADDRESS, robinhoodChainTestnet } from "./deployment";

export const publicClient = createPublicClient({
  chain: robinhoodChainTestnet,
  transport: http(),
});

export const oracleGuard = new OracleGuardClient(publicClient, ORACLE_GUARD_ADDRESS);
