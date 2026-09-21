// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Mirrors the real Robinhood Chain testnet faucet Stock Tokens: implements
///         uiMultiplier() but has no oraclePaused() at all (calling it reverts).
///         Verified against a live testnet deployment (chain 46630) on 2026-09-21 --
///         mainnet Stock Tokens do implement oraclePaused(), testnet faucet ones don't.
contract MockBasicStockToken is ERC20 {
    uint256 public uiMultiplier = 1e18;

    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
