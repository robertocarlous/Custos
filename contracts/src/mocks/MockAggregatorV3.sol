// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {AggregatorV3Interface} from "../interfaces/AggregatorV3Interface.sol";

/// @notice Settable mock used for both Chainlink price feeds and the L2 sequencer
///         uptime feed in tests (same interface shape for both on Chainlink).
contract MockAggregatorV3 is AggregatorV3Interface {
    uint8 private _decimals;
    int256 private _answer;
    uint256 private _startedAt;
    uint256 private _updatedAt;
    uint80 private _roundId;

    constructor(uint8 decimals_, int256 initialAnswer) {
        _decimals = decimals_;
        _answer = initialAnswer;
        _startedAt = block.timestamp;
        _updatedAt = block.timestamp;
        _roundId = 1;
    }

    function setAnswer(int256 answer_, uint256 updatedAt_) external {
        _roundId += 1;
        _answer = answer_;
        _updatedAt = updatedAt_;
    }

    function setStartedAt(uint256 startedAt_) external {
        _startedAt = startedAt_;
    }

    function decimals() external view returns (uint8) {
        return _decimals;
    }

    function description() external pure returns (string memory) {
        return "MockAggregatorV3";
    }

    function version() external pure returns (uint256) {
        return 1;
    }

    function getRoundData(uint80 roundId_)
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
    {
        return (roundId_, _answer, _startedAt, _updatedAt, roundId_);
    }

    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
    {
        return (_roundId, _answer, _startedAt, _updatedAt, _roundId);
    }
}
