// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Uniswap SwapRouter02 exact-input multi-hop (no deadline field).
interface ISwapRouter02 {
    struct ExactInputParams {
        bytes path;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
    }

    function exactInput(ExactInputParams calldata params) external payable returns (uint256 amountOut);
}
