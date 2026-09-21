// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @notice Minimal interface for Robinhood Chain Stock Tokens (ERC-8056 style).
/// @dev oraclePaused() is true during corporate actions (splits, dividends, halts)
///      while uiMultiplier() adjusts display price for splits/dividends without
///      rebasing the underlying token balance.
interface IStockToken {
    event UIMultiplierUpdated(uint256 oldMultiplier, uint256 newMultiplier);

    function oraclePaused() external view returns (bool);

    function uiMultiplier() external view returns (uint256);
}
