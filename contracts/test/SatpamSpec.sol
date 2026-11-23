// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Solidity mirror of circuit/satpam.py `satpam_spec`, for tests.
library SatpamSpec {
    function spec(uint8 x) internal pure returns (uint8) {
        uint8 amt = x & 3;
        uint8 day = (x >> 2) & 3;
        bool refuel = (x >> 4) & 1 == 1;
        bool first = (x >> 5) & 1 == 1;
        uint8 allow = (amt != 3 && day != 3 && !(refuel && amt != 0)) ? 1 : 0;
        uint8 tier = (first && amt == 0 && !refuel) ? 0 : (amt == 2 && !refuel ? 2 : 1);
        return allow | (tier << 1);
    }
}
