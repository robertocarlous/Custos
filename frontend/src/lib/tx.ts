import { BaseError, ContractFunctionRevertedError, type Address, type Abi, type WalletClient } from "viem";
import { GUARD_REASON_LABELS, GuardReason } from "@stock-oracle-guard/sdk";
import { publicClient } from "../config/client";

interface CallParams {
  address: Address;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
}

/** Simulates first so reverts come back decoded, then submits via the wallet. */
export async function simulateAndWrite(
  walletClient: WalletClient,
  account: Address,
  params: CallParams,
): Promise<`0x${string}`> {
  const { request } = await publicClient.simulateContract({ ...params, account });
  return walletClient.writeContract(request as Parameters<WalletClient["writeContract"]>[0]);
}

const REASON_ERRORS = new Set(["OraclePriceUnsafe", "LiquidationNotAllowed"]);

/** Best-effort human-readable revert reason, decoding OracleGuard.Reason where present. */
export function describeError(err: unknown): string {
  if (err instanceof BaseError) {
    const revertError = err.walk((e) => e instanceof ContractFunctionRevertedError);
    if (revertError instanceof ContractFunctionRevertedError) {
      const errorName = revertError.data?.errorName ?? revertError.reason ?? "";
      const args = revertError.data?.args as readonly unknown[] | undefined;
      if (errorName && REASON_ERRORS.has(errorName)) {
        const reasonIndex = Number(args?.[0] ?? -1);
        const label = GUARD_REASON_LABELS[reasonIndex as GuardReason] ?? `unknown reason (${reasonIndex})`;
        return `${errorName}: ${label}`;
      }
      if (errorName) return errorName;
    }
    return err.shortMessage;
  }
  return err instanceof Error ? err.message : String(err);
}
