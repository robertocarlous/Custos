// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IMarketCalendarRegistry} from "./interfaces/IMarketCalendarRegistry.sol";

/// @title MarketCalendarRegistry
/// @notice On-chain record of which calendar days the reference equities market is open.
/// @dev Defaults to a plain Mon-Fri week when a day has no explicit override, so an
///      authorized keeper only needs to push holidays and other exceptions (early closes,
///      special sessions) rather than every single day. Day boundaries are UTC and keyed
///      by `timestamp / 1 days`, matching Unix epoch day numbering (epoch day 0 = Thursday).
contract MarketCalendarRegistry is Ownable, IMarketCalendarRegistry {
    mapping(address => bool) public isKeeper;
    mapping(uint256 => DayStatus) public dayStatusOverride;

    event KeeperUpdated(address indexed keeper, bool authorized);
    event DayStatusSet(uint256 indexed dayId, DayStatus status);

    error NotKeeper();
    error ArrayLengthMismatch();

    modifier onlyKeeper() {
        if (!isKeeper[msg.sender] && msg.sender != owner()) revert NotKeeper();
        _;
    }

    constructor(address initialOwner) Ownable(initialOwner) {}

    function setKeeper(address keeper, bool authorized) external onlyOwner {
        isKeeper[keeper] = authorized;
        emit KeeperUpdated(keeper, authorized);
    }

    /// @notice Set an explicit open/closed override for a given day (e.g. a holiday,
    ///         or reopening a day that was mistakenly marked closed).
    function setDayStatus(uint256 dayId_, DayStatus status) public onlyKeeper {
        dayStatusOverride[dayId_] = status;
        emit DayStatusSet(dayId_, status);
    }

    function setDayStatusBatch(uint256[] calldata dayIds, DayStatus[] calldata statuses) external onlyKeeper {
        if (dayIds.length != statuses.length) revert ArrayLengthMismatch();
        for (uint256 i = 0; i < dayIds.length; i++) {
            setDayStatus(dayIds[i], statuses[i]);
        }
    }

    function dayId(uint256 timestamp) public pure returns (uint256) {
        return timestamp / 1 days;
    }

    /// @notice True if `timestamp` falls on a day the reference market is open.
    /// @dev Epoch day 0 (1970-01-01) was a Thursday, so `dayId % 7` cycles
    ///      0=Thu, 1=Fri, 2=Sat, 3=Sun, 4=Mon, 5=Tue, 6=Wed.
    function isMarketOpen(uint256 timestamp) public view returns (bool) {
        uint256 id = dayId(timestamp);
        DayStatus status = dayStatusOverride[id];
        if (status == DayStatus.Open) return true;
        if (status == DayStatus.Closed) return false;

        uint256 weekday = id % 7;
        bool isWeekend = weekday == 2 || weekday == 3;
        return !isWeekend;
    }
}
