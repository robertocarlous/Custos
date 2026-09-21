// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IMarketCalendarRegistry {
    enum DayStatus {
        Unset,
        Open,
        Closed
    }

    function dayId(uint256 timestamp) external pure returns (uint256);

    function dayStatusOverride(uint256 dayId_) external view returns (DayStatus);

    /// @notice True if the reference market is open (regular trading session) at `timestamp`.
    function isMarketOpen(uint256 timestamp) external view returns (bool);
}
