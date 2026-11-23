// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test, console2} from "forge-std/Test.sol";
import {Bensin} from "../src/Bensin.sol";
import {MockEIP3009Token} from "./mocks/MockEIP3009Token.sol";
import {MockProcessor} from "./mocks/MockProcessor.sol";

contract BensinTest is Test {
    address constant USDT0 = 0x779Ded0c9e1022225f8E0630b35a9b54bE713736;
    address constant USDC = 0xB6CEceAB302E2E4948951eE7843FC24E92933061;
    address constant USDG = 0x4ae46a509F6b1D9056937BA4500cb143933D2dc8;
    bytes constant NETLIST = hex"0000000200000200000003000003";

    Bensin bensin;
    MockProcessor proc;
    address treasury = makeAddr("treasury");
    address bob = makeAddr("bob");
    address user;
    uint256 userKey;
    uint256 saltCounter;

    function setUp() public {
        (user, userKey) = makeAddrAndKey("user");
        _etchToken(USDT0, "USD0");
        _etchToken(USDC, "USD Coin");
        _etchToken(USDG, "Global Dollar");
        proc = new MockProcessor(NETLIST);
        bensin = new Bensin(address(proc), 1, keccak256(NETLIST), treasury);
        MockEIP3009Token(USDT0).mint(user, 1_000_000e6);
        vm.warp(1_800_000_000);
    }

    function _etchToken(address at, string memory name) internal {
        MockEIP3009Token t = new MockEIP3009Token(name);
        vm.etch(at, address(t).code);
    }

    function _intent(address to, uint256 amount, uint256 fee) internal returns (Bensin.Intent memory it) {
        it = Bensin.Intent({
            token: USDT0,
            from: user,
            to: to,
            amount: amount,
            fee: fee,
            action: 0,
            minOkbOut: 0,
            validBefore: block.timestamp + 600,
            salt: bytes32(++saltCounter)
        });
    }

    function _sign(Bensin b, Bensin.Intent memory it) internal view returns (uint8 v, bytes32 r, bytes32 s) {
        MockEIP3009Token t = MockEIP3009Token(it.token);
        bytes32 structHash = keccak256(
            abi.encode(
                t.RECEIVE_TYPEHASH(), it.from, address(b), it.amount + it.fee, 0, it.validBefore, b.intentNonce(it)
            )
        );
        (v, r, s) = vm.sign(userKey, keccak256(abi.encodePacked("\x19\x01", t.DOMAIN_SEPARATOR(), structHash)));
    }

    function _relay(Bensin.Intent memory it) internal {
        (uint8 v, bytes32 r, bytes32 s) = _sign(bensin, it);
        bensin.relay(it, v, r, s);
    }

    function _bal(address a) internal view returns (uint256) {
        return MockEIP3009Token(USDT0).balanceOf(a);
    }

    // ---- send path ----

    function test_sendHappyPath() public {
        _relay(_intent(bob, 5e6, 0)); // first use, free
        Bensin.Intent memory it = _intent(bob, 50e6, 20_000);
        (uint8 v, bytes32 r, bytes32 s) = _sign(bensin, it);
        uint256 userBefore = _bal(user);
        vm.expectEmit(true, true, true, true);
        emit Bensin.Relayed(bensin.intentNonce(it), user, bob, USDT0, 50e6, 20_000, 0, 1, 0);
        bensin.relay(it, v, r, s);
        assertEq(_bal(bob), 55e6);
        assertEq(_bal(treasury), 20_000);
        assertEq(_bal(user), userBefore - 50e6 - 20_000);
        assertEq(_bal(address(bensin)), 0);
    }

    function test_firstTimeSmallIsFree() public {
        _relay(_intent(bob, 5e6, 0));
        assertEq(_bal(bob), 5e6);
        Bensin.Intent memory it = _intent(bob, 5e6, 0);
        (uint8 v, bytes32 r, bytes32 s) = _sign(bensin, it);
        vm.expectRevert(Bensin.FeeTooLow.selector);
        bensin.relay(it, v, r, s);
    }

    function test_largeSendNeedsTier2Fee() public {
        _relay(_intent(bob, 5e6, 0));
        Bensin.Intent memory it = _intent(bob, 2_000e6, 20_000);
        (uint8 v, bytes32 r, bytes32 s) = _sign(bensin, it);
        vm.expectRevert(Bensin.FeeTooLow.selector);
        bensin.relay(it, v, r, s);
        _relay(_intent(bob, 2_000e6, 100_000));
        assertEq(_bal(bob), 2_005e6);
    }

    function test_dailyLimit() public {
        _relay(_intent(bob, 5e6, 0));
        for (uint256 i = 0; i < 10; i++) {
            _relay(_intent(bob, 1e6, 20_000));
        }
        Bensin.Intent memory it = _intent(bob, 1e6, 20_000);
        (uint8 v, bytes32 r, bytes32 s) = _sign(bensin, it);
        vm.expectRevert(Bensin.Denied.selector);
        bensin.relay(it, v, r, s);
        vm.warp(block.timestamp + 1 days);
        _relay(_intent(bob, 1e6, 20_000));
    }

    function test_overLimitDenied() public {
        Bensin.Intent memory it = _intent(bob, 10_001e6, 100_000);
        (uint8 v, bytes32 r, bytes32 s) = _sign(bensin, it);
        vm.expectRevert(Bensin.Denied.selector);
        bensin.relay(it, v, r, s);
    }

    // ---- review focus: replay, tampering, bad input, wrong circuit ----

    function test_replayReverts() public {
        Bensin.Intent memory it = _intent(bob, 5e6, 0);
        (uint8 v, bytes32 r, bytes32 s) = _sign(bensin, it);
        bensin.relay(it, v, r, s);
        vm.expectRevert();
        bensin.relay(it, v, r, s);
        assertEq(_bal(bob), 5e6);
    }

    function test_otherContractCannotUseSig() public {
        Bensin other = new Bensin(address(proc), 1, keccak256(NETLIST), treasury);
        Bensin.Intent memory it = _intent(bob, 5e6, 0);
        (uint8 v, bytes32 r, bytes32 s) = _sign(bensin, it);
        vm.expectRevert();
        other.relay(it, v, r, s);
    }

    function test_tamperedIntentReverts() public {
        Bensin.Intent memory it = _intent(bob, 50e6, 20_000);
        (uint8 v, bytes32 r, bytes32 s) = _sign(bensin, it);

        Bensin.Intent memory t1 = _copy(it);
        t1.to = makeAddr("mallory");
        vm.expectRevert();
        bensin.relay(t1, v, r, s);

        Bensin.Intent memory t2 = _copy(it);
        t2.amount = 49e6;
        vm.expectRevert();
        bensin.relay(t2, v, r, s);

        Bensin.Intent memory t3 = _copy(it);
        t3.fee = 100_000;
        vm.expectRevert();
        bensin.relay(t3, v, r, s);
        assertEq(_bal(user), 1_000_000e6);
    }

    function _copy(Bensin.Intent memory a) internal pure returns (Bensin.Intent memory b) {
        b = Bensin.Intent(a.token, a.from, a.to, a.amount, a.fee, a.action, a.minOkbOut, a.validBefore, a.salt);
    }

    function test_rejectsBadIntent() public {
        Bensin.Intent memory it = _intent(bob, 5e6, 0);
        it.validBefore = block.timestamp;
        vm.expectRevert(Bensin.Expired.selector);
        bensin.relay(it, 27, bytes32(0), bytes32(0));

        it = _intent(address(0), 5e6, 0);
        vm.expectRevert(Bensin.BadIntent.selector);
        bensin.relay(it, 27, bytes32(0), bytes32(0));

        it = _intent(address(bensin), 5e6, 0);
        vm.expectRevert(Bensin.BadIntent.selector);
        bensin.relay(it, 27, bytes32(0), bytes32(0));

        it = _intent(bob, 0, 0);
        vm.expectRevert(Bensin.BadIntent.selector);
        bensin.relay(it, 27, bytes32(0), bytes32(0));

        it = _intent(bob, 5e6, 0);
        it.token = makeAddr("randomToken");
        vm.expectRevert(Bensin.NotSupportedToken.selector);
        bensin.relay(it, 27, bytes32(0), bytes32(0));

        it = _intent(bob, 5e6, 0);
        it.action = 2;
        vm.expectRevert(Bensin.BadIntent.selector);
        bensin.relay(it, 27, bytes32(0), bytes32(0));
    }

    function test_constructorRejectsWrongCircuit() public {
        vm.expectRevert(Bensin.CircuitMismatch.selector);
        new Bensin(address(proc), 1, keccak256("other"), treasury);
        proc.setShape(6, 2);
        vm.expectRevert(Bensin.CircuitMismatch.selector);
        new Bensin(address(proc), 1, keccak256(NETLIST), treasury);
    }

    function test_quoteTierMatchesRelay() public {
        (bool allow, uint8 tier, uint256 minFee) = bensin.quoteTier(user, USDT0, 5e6, 0);
        assertTrue(allow);
        assertEq(tier, 0);
        assertEq(minFee, 0);
        _relay(_intent(bob, 5e6, minFee));
        (allow, tier, minFee) = bensin.quoteTier(user, USDT0, 2_000e6, 0);
        assertEq(tier, 2);
        assertEq(minFee, 100_000);
        _relay(_intent(bob, 2_000e6, minFee));
        (allow,,) = bensin.quoteTier(user, USDT0, 20_000e6, 0);
        assertFalse(allow);
    }

    /// Golden vector shared with relayer/test/intent.test.ts.
    function test_logGoldenNonce() public {
        vm.chainId(196);
        Bensin b = new Bensin(address(proc), 1, keccak256(NETLIST), treasury);
        Bensin.Intent memory it = Bensin.Intent({
            token: USDT0,
            from: address(0x1111111111111111111111111111111111111111),
            to: address(0x2222222222222222222222222222222222222222),
            amount: 50e6,
            fee: 20_000,
            action: 0,
            minOkbOut: 0,
            validBefore: 1_800_000_600,
            salt: bytes32(uint256(7))
        });
        console2.log("bensin", address(b));
        console2.logBytes32(b.intentNonce(it));
        assertEq(
            b.intentNonce(it), keccak256(abi.encode(uint256(196), address(b), it))
        );
    }
}
