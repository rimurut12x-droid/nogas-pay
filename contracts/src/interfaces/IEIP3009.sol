// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice The subset of ERC-20 + EIP-3009 that Bensin uses (USDT0, USDC and USDG on X Layer all implement it).
interface IEIP3009 {
    function receiveWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;

    function transfer(address to, uint256 value) external returns (bool);
    function approve(address spender, uint256 value) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function DOMAIN_SEPARATOR() external view returns (bytes32);
}
