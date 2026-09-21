// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Test} from "forge-std/Test.sol";
import {MarketCalendarRegistry} from "../src/MarketCalendarRegistry.sol";
import {IMarketCalendarRegistry} from "../src/interfaces/IMarketCalendarRegistry.sol";

contract MarketCalendarRegistryTest is Test {
    MarketCalendarRegistry registry;
    address owner = address(this);
    address keeper = address(0xCAFE);

    // 2024-01-01 00:00:00 UTC was a Monday.
    uint256 constant MONDAY = 1_704_067_200;
    uint256 constant DAY = 1 days;

    function setUp() public {
        registry = new MarketCalendarRegistry(owner);
        registry.setKeeper(keeper, true);
    }

    function test_defaultWeekdayIsOpen() public view {
        assertTrue(registry.isMarketOpen(MONDAY));
        assertTrue(registry.isMarketOpen(MONDAY + 4 * DAY)); // Friday
    }

    function test_defaultWeekendIsClosed() public view {
        assertFalse(registry.isMarketOpen(MONDAY + 5 * DAY)); // Saturday
        assertFalse(registry.isMarketOpen(MONDAY + 6 * DAY)); // Sunday
    }

    function test_keeperCanMarkHolidayClosed() public {
        uint256 holidayDayId = registry.dayId(MONDAY);
        vm.prank(keeper);
        registry.setDayStatus(holidayDayId, IMarketCalendarRegistry.DayStatus.Closed);

        assertFalse(registry.isMarketOpen(MONDAY));
    }

    function test_keeperCanReopenAWeekendForSpecialSession() public {
        uint256 saturdayId = registry.dayId(MONDAY + 5 * DAY);
        vm.prank(keeper);
        registry.setDayStatus(saturdayId, IMarketCalendarRegistry.DayStatus.Open);

        assertTrue(registry.isMarketOpen(MONDAY + 5 * DAY));
    }

    function test_nonKeeperCannotSetDayStatus() public {
        uint256 mondayId = registry.dayId(MONDAY);
        vm.prank(address(0xBEEF));
        vm.expectRevert(MarketCalendarRegistry.NotKeeper.selector);
        registry.setDayStatus(mondayId, IMarketCalendarRegistry.DayStatus.Closed);
    }

    function test_batchSetDayStatus() public {
        uint256[] memory ids = new uint256[](2);
        ids[0] = registry.dayId(MONDAY);
        ids[1] = registry.dayId(MONDAY + DAY);
        IMarketCalendarRegistry.DayStatus[] memory statuses = new IMarketCalendarRegistry.DayStatus[](2);
        statuses[0] = IMarketCalendarRegistry.DayStatus.Closed;
        statuses[1] = IMarketCalendarRegistry.DayStatus.Closed;

        vm.prank(keeper);
        registry.setDayStatusBatch(ids, statuses);

        assertFalse(registry.isMarketOpen(MONDAY));
        assertFalse(registry.isMarketOpen(MONDAY + DAY));
    }
}
