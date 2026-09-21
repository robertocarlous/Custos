import { createPublicClient, createWalletClient, defineChain, http, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { getUpcomingHolidays, isoDateToDayId } from "./holidays.js";

const marketCalendarRegistryAbi = [
  {
    type: "function",
    name: "setDayStatusBatch",
    stateMutability: "nonpayable",
    inputs: [
      { name: "dayIds", type: "uint256[]" },
      { name: "statuses", type: "uint8[]" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "dayStatusOverride",
    stateMutability: "view",
    inputs: [{ name: "dayId_", type: "uint256" }],
    outputs: [{ name: "", type: "uint8" }],
  },
] as const;

const DayStatus = { Unset: 0, Open: 1, Closed: 2 } as const;

const robinhoodChainTestnet = defineChain({
  id: 46630,
  name: "Robinhood Chain Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [process.env.RPC_URL ?? "https://rpc.testnet.chain.robinhood.com"] } },
});

async function main() {
  const registryAddress = process.env.MARKET_CALENDAR_REGISTRY as Address | undefined;
  const privateKey = process.env.PRIVATE_KEY as `0x${string}` | undefined;
  if (!registryAddress) throw new Error("Set MARKET_CALENDAR_REGISTRY env var");
  if (!privateKey) throw new Error("Set PRIVATE_KEY env var");

  const account = privateKeyToAccount(privateKey);
  const publicClient = createPublicClient({ chain: robinhoodChainTestnet, transport: http() });
  const walletClient = createWalletClient({ account, chain: robinhoodChainTestnet, transport: http() });

  const upcoming = getUpcomingHolidays();
  const pending: { dayId: bigint; iso: string }[] = [];

  for (const iso of upcoming) {
    const dayId = isoDateToDayId(iso);
    const current = await publicClient.readContract({
      address: registryAddress,
      abi: marketCalendarRegistryAbi,
      functionName: "dayStatusOverride",
      args: [dayId],
    });
    if (current !== DayStatus.Closed) pending.push({ dayId, iso });
  }

  if (pending.length === 0) {
    console.log("Calendar already up to date, nothing to push.");
    return;
  }

  console.log(`Pushing ${pending.length} holiday override(s): ${pending.map((p) => p.iso).join(", ")}`);

  const hash = await walletClient.writeContract({
    address: registryAddress,
    abi: marketCalendarRegistryAbi,
    functionName: "setDayStatusBatch",
    args: [pending.map((p) => p.dayId), pending.map(() => DayStatus.Closed)],
  });

  console.log(`Submitted tx: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`Confirmed in block ${receipt.blockNumber}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
