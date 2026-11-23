// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {SatpamSpec} from "../SatpamSpec.sol";

/// @notice Stands in for a TapeOut processor holding the Satpam circuit at id 1.
contract MockProcessor {
    bytes public storedNetlist;
    uint32 public nIn = 6;
    uint32 public nOut = 3;

    constructor(bytes memory nl) {
        storedNetlist = nl;
    }

    function setShape(uint32 i, uint32 o) external {
        (nIn, nOut) = (i, o);
    }

    function circuitInfo(uint256) external view returns (uint32, uint32, uint32, uint32) {
        return (nIn, nOut, 0, 26);
    }

    function netlist(uint256) external view returns (bytes memory) {
        return storedNetlist;
    }

    function eval(uint256, bytes calldata inputs) external pure returns (bytes memory) {
        return abi.encodePacked(uint8(SatpamSpec.spec(uint8(inputs[0]))));
    }
}
