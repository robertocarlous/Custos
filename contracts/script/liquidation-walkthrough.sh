#!/usr/bin/env bash
# End-to-end liquidation walkthrough against a live ReferenceLendingPool deployment:
# deposit real Stock Token collateral, borrow, crash the price via the demo mock
# feed, then liquidate. Uses one account as both borrower and liquidator for
# simplicity (ReferenceLendingPool doesn't restrict self-liquidation).
#
# usage:
#   RPC_URL=... PRIVATE_KEY=... POOL=... GUARD=... FEED=... TOKEN=... BORROW_TOKEN=... \
#     ./script/liquidation-walkthrough.sh
#
# Defaults below match the live testnet deployment documented in README.md.

set -Eeuo pipefail

RPC_URL="${RPC_URL:-https://rpc.testnet.chain.robinhood.com}"
POOL="${POOL:?set POOL to the ReferenceLendingPool address}"
GUARD="${GUARD:?set GUARD to the OracleGuard address}"
FEED="${FEED:?set FEED to the collateral token's (mock) price feed address}"
TOKEN="${TOKEN:?set TOKEN to the collateral Stock Token address}"
BORROW_TOKEN="${BORROW_TOKEN:?set BORROW_TOKEN to the borrow asset address}"
PRIVATE_KEY="${PRIVATE_KEY:?set PRIVATE_KEY for the borrower/liquidator account}"

DEPOSIT_AMOUNT="${DEPOSIT_AMOUNT:-5000000000000000000}" # 5 shares
BORROW_AMOUNT="${BORROW_AMOUNT:-1000000000000000000000}" # 1000 borrow-asset units
CRASH_PRICE="${CRASH_PRICE:-15000000000}" # $150.00 at 8 decimals
REPAY_AMOUNT="${REPAY_AMOUNT:-200000000000000000000}" # 200 borrow-asset units

ACCOUNT=$(cast wallet address --private-key "$PRIVATE_KEY")
echo "account: $ACCOUNT"

echo
echo "== 1/7: approve pool to pull collateral =="
cast send "$TOKEN" "approve(address,uint256)" "$POOL" "$DEPOSIT_AMOUNT" --private-key "$PRIVATE_KEY" --rpc-url "$RPC_URL" >/dev/null

echo "== 2/7: deposit collateral =="
cast send "$POOL" "depositCollateral(uint256)" "$DEPOSIT_AMOUNT" --private-key "$PRIVATE_KEY" --rpc-url "$RPC_URL" >/dev/null
echo "collateral on record: $(cast call "$POOL" 'collateralBalanceOf(address)(uint256)' "$ACCOUNT" --rpc-url "$RPC_URL")"

echo
echo "== 3/7: sanity check -- liquidating a healthy position must revert =="
if cast call "$POOL" "liquidate(address,uint256)" "$ACCOUNT" 1 --rpc-url "$RPC_URL" >/dev/null 2>&1; then
    echo "ERROR: expected liquidate() to revert on a healthy position" >&2
    exit 1
fi
echo "confirmed: reverted as expected (position has no debt yet)"

echo
echo "== 4/7: borrow =="
cast send "$POOL" "borrow(uint256)" "$BORROW_AMOUNT" --private-key "$PRIVATE_KEY" --rpc-url "$RPC_URL" >/dev/null
echo "debt: $(cast call "$POOL" 'borrowBalanceOf(address)(uint256)' "$ACCOUNT" --rpc-url "$RPC_URL")"
echo "healthy? $(cast call "$POOL" 'isHealthy(address)(bool)' "$ACCOUNT" --rpc-url "$RPC_URL")"

echo
echo "== 5/7: crash the (mock) price to $CRASH_PRICE =="
NOW=$(cast block latest --rpc-url "$RPC_URL" --field timestamp)
cast send "$FEED" "setAnswer(int256,uint256)" "$CRASH_PRICE" "$NOW" --private-key "$PRIVATE_KEY" --rpc-url "$RPC_URL" >/dev/null
echo "getSafePrice: $(cast call "$GUARD" 'getSafePrice(address)(int256,bool,uint8)' "$TOKEN" --rpc-url "$RPC_URL")"
echo "healthy now? $(cast call "$POOL" 'isHealthy(address)(bool)' "$ACCOUNT" --rpc-url "$RPC_URL")"
echo "liquidation allowed? $(cast call "$GUARD" 'isLiquidationAllowed(address)(bool)' "$TOKEN" --rpc-url "$RPC_URL")"

echo
echo "== 6/7: approve pool to pull the repay amount =="
cast send "$BORROW_TOKEN" "approve(address,uint256)" "$POOL" "$REPAY_AMOUNT" --private-key "$PRIVATE_KEY" --rpc-url "$RPC_URL" >/dev/null

echo "== 7/7: liquidate =="
cast send "$POOL" "liquidate(address,uint256)" "$ACCOUNT" "$REPAY_AMOUNT" --private-key "$PRIVATE_KEY" --rpc-url "$RPC_URL"

echo
echo "== final state =="
echo "remaining collateral: $(cast call "$POOL" 'collateralBalanceOf(address)(uint256)' "$ACCOUNT" --rpc-url "$RPC_URL")"
echo "remaining debt:       $(cast call "$POOL" 'borrowBalanceOf(address)(uint256)' "$ACCOUNT" --rpc-url "$RPC_URL")"
echo "seized collateral now in wallet: $(cast call "$TOKEN" 'balanceOf(address)(uint256)' "$ACCOUNT" --rpc-url "$RPC_URL")"
