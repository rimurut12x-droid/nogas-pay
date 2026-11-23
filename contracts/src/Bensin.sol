// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IEIP3009} from "./interfaces/IEIP3009.sol";
import {ITapeoutProcessor} from "./interfaces/ITapeoutProcessor.sol";
import {ISwapRouter02} from "./interfaces/ISwapRouter02.sol";
import {IWOKB} from "./interfaces/IWOKB.sol";

/// @title Bensin
/// @notice Gasless stablecoin sends and OKB refuel on X Layer. The user signs one EIP-3009
///         `receiveWithAuthorization` whose nonce is the hash of their intent; anyone may submit it.
///         A TapeOut circuit ("Satpam") decides whether the request is sponsored and its fee tier.
contract Bensin {
    struct Intent {
        address token;
        address from;
        address to;
        uint256 amount;
        uint256 fee;
        uint8 action; // 0 send, 1 refuel
        uint256 minOkbOut;
        uint256 validBefore;
        bytes32 salt;
    }

    struct Usage {
        uint64 day;
        uint32 count;
    }

    address public constant USDT0 = 0x779Ded0c9e1022225f8E0630b35a9b54bE713736;
    address public constant USDC = 0xB6CEceAB302E2E4948951eE7843FC24E92933061;
    address public constant USDG = 0x4ae46a509F6b1D9056937BA4500cb143933D2dc8;

    address public constant WOKB = 0xe538905cf8410324e03A5A23C1c177a474D59b2b;
    ISwapRouter02 public constant ROUTER = ISwapRouter02(0x4f0C28f5926AFDA16bf2506D5D9e57Ea190f9bcA);
    uint24 internal constant STABLE_FEE = 100;
    uint24 internal constant OKB_FEE = 500;

    uint256 public constant SMALL_MAX = 10e6;
    uint256 public constant MEDIUM_MAX = 1_000e6;
    uint256 public constant LARGE_MAX = 10_000e6;
    uint256 public constant TIER1_MIN_FEE = 20_000;
    uint256 public constant TIER2_MIN_FEE = 100_000;

    uint32 internal constant N_IN = 6;
    uint32 internal constant N_OUT = 3;
    uint256 internal constant CIRCUIT_GAS = 300_000;

    ITapeoutProcessor public immutable processor;
    uint256 public immutable circuitId;
    bytes32 public immutable netlistHash;
    address public immutable treasury;

    mapping(address => Usage) public usage;
    mapping(address => bool) public hasUsed;

    event Relayed(
        bytes32 indexed nonce,
        address indexed from,
        address indexed to,
        address token,
        uint256 amount,
        uint256 fee,
        uint8 action,
        uint8 tier,
        uint256 okbOut
    );

    error NotSupportedToken();
    error BadIntent();
    error Expired();
    error Denied();
    error FeeTooLow();
    error CircuitMismatch();
    error CircuitCallFailed();
    error Slippage();
    error TransferFailed();

    constructor(address processor_, uint256 circuitId_, bytes32 netlistHash_, address treasury_) {
        if (treasury_ == address(0)) revert BadIntent();
        (uint32 nIn, uint32 nOut, uint32 nState,) = ITapeoutProcessor(processor_).circuitInfo(circuitId_);
        if (
            nIn != N_IN || nOut != N_OUT || nState != 0
                || keccak256(ITapeoutProcessor(processor_).netlist(circuitId_)) != netlistHash_
        ) revert CircuitMismatch();
        processor = ITapeoutProcessor(processor_);
        circuitId = circuitId_;
        netlistHash = netlistHash_;
        treasury = treasury_;
    }

    /// @notice The EIP-3009 nonce the user signs: binds the signature to this exact intent, contract and chain.
    function intentNonce(Intent calldata it) public view returns (bytes32) {
        return keccak256(abi.encode(block.chainid, address(this), it));
    }

    function quoteTier(address user, address token, uint256 amount, uint8 action)
        external
        view
        returns (bool allow, uint8 tier, uint256 minFee)
    {
        if (!isSupported(token)) revert NotSupportedToken();
        return _decide(user, amount, action);
    }

    function relay(Intent calldata it, uint8 v, bytes32 r, bytes32 s) external returns (uint256 okbOut) {
        _validate(it);
        (bool allow, uint8 tier, uint256 minFee) = _decide(it.from, it.amount, it.action);
        if (!allow) revert Denied();
        if (it.fee < minFee) revert FeeTooLow();

        bytes32 nonce = intentNonce(it);
        IEIP3009(it.token).receiveWithAuthorization(
            it.from, address(this), it.amount + it.fee, 0, it.validBefore, nonce, v, r, s
        );
        _record(it.from);

        if (it.fee > 0) _transfer(it.token, treasury, it.fee);
        if (it.action == 0) {
            _transfer(it.token, it.to, it.amount);
        } else {
            okbOut = _refuel(it.token, it.amount, it.to, it.minOkbOut);
        }
        emit Relayed(nonce, it.from, it.to, it.token, it.amount, it.fee, it.action, tier, okbOut);
    }

    /// @notice Only WOKB unwraps send native OKB here.
    receive() external payable {
        if (msg.sender != WOKB) revert BadIntent();
    }

    function isSupported(address token) public pure returns (bool) {
        return token == USDT0 || token == USDC || token == USDG;
    }

    // ---- internals ----

    function _validate(Intent calldata it) internal view {
        if (!isSupported(it.token)) revert NotSupportedToken();
        if (block.timestamp >= it.validBefore) revert Expired();
        if (it.amount == 0 || it.to == address(0) || it.to == address(this) || it.action > 1) revert BadIntent();
    }

    function _decide(address user, uint256 amount, uint8 action)
        internal
        view
        returns (bool allow, uint8 tier, uint256 minFee)
    {
        uint8 inputs = _amountBucket(amount) | (_dailyBucket(user) << 2) | (action == 1 ? 16 : 0)
            | (hasUsed[user] ? 0 : 32);
        uint8 out = _eval(inputs);
        allow = out & 1 == 1;
        tier = (out >> 1) & 3;
        minFee = tier == 0 ? 0 : (tier == 2 ? TIER2_MIN_FEE : TIER1_MIN_FEE);
    }

    function _eval(uint8 inputs) internal view returns (uint8) {
        (bool ok, bytes memory ret) = address(processor).staticcall{gas: CIRCUIT_GAS}(
            abi.encodeCall(ITapeoutProcessor.eval, (circuitId, abi.encodePacked(inputs)))
        );
        if (!ok || ret.length < 64) revert CircuitCallFailed();
        bytes memory outBytes = abi.decode(ret, (bytes));
        if (outBytes.length != 1) revert CircuitCallFailed();
        return uint8(outBytes[0]);
    }

    function _amountBucket(uint256 amount) internal pure returns (uint8) {
        if (amount <= SMALL_MAX) return 0;
        if (amount <= MEDIUM_MAX) return 1;
        if (amount <= LARGE_MAX) return 2;
        return 3;
    }

    function _dailyBucket(address user) internal view returns (uint8) {
        Usage memory u = usage[user];
        uint32 c = u.day == uint64(block.timestamp / 1 days) ? u.count : 0;
        if (c == 0) return 0;
        if (c <= 3) return 1;
        if (c <= 10) return 2;
        return 3;
    }

    function _record(address user) internal {
        uint64 today = uint64(block.timestamp / 1 days);
        Usage storage u = usage[user];
        if (u.day != today) (u.day, u.count) = (today, 0);
        u.count += 1;
        hasUsed[user] = true;
    }

    /// @dev stable -> (USDG) -> WOKB on Uniswap v3, unwrap, send native OKB to `to`.
    function _refuel(address token, uint256 amount, address to, uint256 minOut) internal returns (uint256 out) {
        bytes memory path = token == USDG
            ? abi.encodePacked(USDG, OKB_FEE, WOKB)
            : abi.encodePacked(token, STABLE_FEE, USDG, OKB_FEE, WOKB);
        _approve(token, address(ROUTER), amount);
        out = ROUTER.exactInput(
            ISwapRouter02.ExactInputParams({path: path, recipient: address(this), amountIn: amount, amountOutMinimum: 0})
        );
        if (out < minOut) revert Slippage();
        IWOKB(WOKB).withdraw(out);
        (bool ok,) = to.call{value: out}("");
        if (!ok) revert TransferFailed();
    }

    function _approve(address token, address spender, uint256 value) internal {
        (bool ok, bytes memory ret) = token.call(abi.encodeCall(IEIP3009.approve, (spender, value)));
        if (!ok || (ret.length != 0 && !abi.decode(ret, (bool)))) revert TransferFailed();
    }

    function _transfer(address token, address to, uint256 value) internal {
        (bool ok, bytes memory ret) = token.call(abi.encodeCall(IEIP3009.transfer, (to, value)));
        if (!ok || (ret.length != 0 && !abi.decode(ret, (bool)))) revert TransferFailed();
    }
}
