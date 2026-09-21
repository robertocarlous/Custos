// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IStockToken} from "../interfaces/IStockToken.sol";

contract MockStockToken is ERC20, IStockToken {
    bool public oraclePaused;
    uint256 public uiMultiplier = 1e18;

    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function setOraclePaused(bool paused_) external {
        oraclePaused = paused_;
    }

    function setUiMultiplier(uint256 newMultiplier) external {
        emit UIMultiplierUpdated(uiMultiplier, newMultiplier);
        uiMultiplier = newMultiplier;
    }
}
