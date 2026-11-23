// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice TapeOut processor read surface (TAP-02 §6).
interface ITapeoutProcessor {
    function circuitInfo(uint256 id) external view returns (uint32 nIn, uint32 nOut, uint32 nState, uint32 gateCount);
    function netlist(uint256 id) external view returns (bytes memory);
    function eval(uint256 id, bytes calldata inputs) external view returns (bytes memory);
}
