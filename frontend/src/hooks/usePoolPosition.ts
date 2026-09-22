import { useCallback, useEffect, useState } from "react";
import type { Address } from "viem";
import { publicClient } from "../config/client";
import { erc20Abi } from "../config/erc20Abi";
import { referenceLendingPoolAbi } from "../config/poolAbi";
import { DEMO_BORROW_ASSET_ADDRESS, GUARDED_TOKENS, REFERENCE_LENDING_POOL_ADDRESS } from "../config/deployment";

export const POOL_COLLATERAL = GUARDED_TOKENS.find((t) => t.isPoolCollateral)!;

export interface PoolPosition {
  collateralTokenBalance: bigint;
  collateralAllowance: bigint;
  borrowTokenBalance: bigint;
  borrowAllowance: bigint;
  collateral: bigint;
  debt: bigint;
  healthy: boolean;
}

export function usePoolPosition(address: Address | null) {
  const [position, setPosition] = useState<PoolPosition | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!address) {
      setPosition(null);
      return;
    }
    setLoading(true);
    try {
      const [collateralTokenBalance, collateralAllowance, borrowTokenBalance, borrowAllowance, collateral, debt, healthy] =
        await Promise.all([
          publicClient.readContract({
            address: POOL_COLLATERAL.address,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [address],
          }),
          publicClient.readContract({
            address: POOL_COLLATERAL.address,
            abi: erc20Abi,
            functionName: "allowance",
            args: [address, REFERENCE_LENDING_POOL_ADDRESS],
          }),
          publicClient.readContract({
            address: DEMO_BORROW_ASSET_ADDRESS,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [address],
          }),
          publicClient.readContract({
            address: DEMO_BORROW_ASSET_ADDRESS,
            abi: erc20Abi,
            functionName: "allowance",
            args: [address, REFERENCE_LENDING_POOL_ADDRESS],
          }),
          publicClient.readContract({
            address: REFERENCE_LENDING_POOL_ADDRESS,
            abi: referenceLendingPoolAbi,
            functionName: "collateralBalanceOf",
            args: [address],
          }),
          publicClient.readContract({
            address: REFERENCE_LENDING_POOL_ADDRESS,
            abi: referenceLendingPoolAbi,
            functionName: "borrowBalanceOf",
            args: [address],
          }),
          publicClient.readContract({
            address: REFERENCE_LENDING_POOL_ADDRESS,
            abi: referenceLendingPoolAbi,
            functionName: "isHealthy",
            args: [address],
          }),
        ]);

      setPosition({ collateralTokenBalance, collateralAllowance, borrowTokenBalance, borrowAllowance, collateral, debt, healthy });
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { position, loading, refresh };
}
