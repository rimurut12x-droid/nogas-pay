// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {Bensin} from "../src/Bensin.sol";

interface IFactory {
    function createCPU(string calldata name, string calldata symbol, string calldata story, uint256 supply, uint256 mintPrice)
        external
        returns (address transistors, address cpu);
}

interface IProc {
    function transistors() external view returns (address);
    function TAPEOUT_FEE() external view returns (uint256);
    function tapeout(bytes calldata nl, uint32 nIn, uint32 nOut) external payable returns (uint256);
}

interface ITransistors {
    function mint(uint256 id, uint256 amount) external payable;
}

interface IERC20Min {
    function approve(address s, uint256 v) external returns (bool);
    function balanceOf(address a) external view returns (uint256);
}

interface IRouterOut {
    struct ExactOutputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 amountOut;
        uint256 amountInMaximum;
        uint160 sqrtPriceLimitX96;
    }

    function exactOutputSingle(ExactOutputSingleParams calldata p) external payable returns (uint256 amountIn);
    function refundETH() external payable;
}

/// @notice Creates the "Bensin" TapeOut processor (unless PROCESSOR is set), tapes out Satpam, deploys Bensin.
/// Env: TREASURY (required), PROCESSOR (optional, reuse), CIRCUIT_ID (optional, reuse with PROCESSOR).
contract Deploy is Script {
    address constant FACTORY = 0x1f09DAeFA827f02CBb40967cc91b259763760761;
    address constant BEM = 0x60e62Efa9405d6873C5deaBD4E6CC91c25363952;
    address constant WOKB = 0xe538905cf8410324e03A5A23C1c177a474D59b2b;
    address constant ROUTER = 0x4f0C28f5926AFDA16bf2506D5D9e57Ea190f9bcA;
    /// processor deploy fee 0.1 BEM + 26 transistors' protocol fees, plus headroom
    uint256 constant BEM_NEEDED = 0.115e8;
    uint256 constant MAX_OKB_FOR_BEM = 0.016 ether;

    function run() external returns (address processor, uint256 circuitId, address bensin) {
        address treasury = vm.envAddress("TREASURY");
        bytes memory nl = vm.parseBytes(_netlist());
        processor = vm.envOr("PROCESSOR", address(0));
        circuitId = vm.envOr("CIRCUIT_ID", uint256(0));

        vm.startBroadcast();
        if (processor == address(0)) {
            uint256 have = IERC20Min(BEM).balanceOf(msg.sender);
            if (have < BEM_NEEDED) _buyBem(BEM_NEEDED - have);
            IERC20Min(BEM).approve(FACTORY, type(uint256).max);
            (address t, address c) = IFactory(FACTORY).createCPU(
                "Bensin", "BNSN", "Bensin: gasless sends and refuel on X Layer, sponsored by the Satpam circuit", 1_000, 0
            );
            IERC20Min(BEM).approve(t, type(uint256).max);
            IERC20Min(BEM).approve(c, type(uint256).max);
            ITransistors(t).mint(0, 26);
            processor = c;
        }
        if (circuitId == 0) circuitId = IProc(processor).tapeout{value: IProc(processor).TAPEOUT_FEE()}(nl, 6, 3);
        bensin = address(new Bensin(processor, circuitId, keccak256(nl), treasury));
        vm.stopBroadcast();

        console2.log("processor", processor);
        console2.log("circuitId", circuitId);
        console2.log("bensin", bensin);
    }

    /// @dev OKB -> BEM on the WOKB/BEM 1% pool, paying with native OKB; unspent OKB is refunded.
    function _buyBem(uint256 amountOut) internal {
        IRouterOut(ROUTER).exactOutputSingle{value: MAX_OKB_FOR_BEM}(
            IRouterOut.ExactOutputSingleParams(WOKB, BEM, 10_000, msg.sender, amountOut, MAX_OKB_FOR_BEM, 0)
        );
        IRouterOut(ROUTER).refundETH();
    }

    function _netlist() internal view returns (string memory) {
        bytes memory b = bytes(vm.readFile("../circuit/satpam.out.txt"));
        uint256 end = 8;
        while (end < b.length && b[end] != "\n") end++;
        bytes memory h = new bytes(end - 8);
        for (uint256 i = 0; i < h.length; i++) h[i] = b[8 + i];
        return string(h);
    }
}
