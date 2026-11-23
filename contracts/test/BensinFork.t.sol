// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {Bensin} from "../src/Bensin.sol";
import {IEIP3009} from "../src/interfaces/IEIP3009.sol";
import {SatpamSpec} from "./SatpamSpec.sol";

interface IProc {
    function transistors() external view returns (address);
    function TAPEOUT_FEE() external view returns (uint256);
    function tapeout(bytes calldata nl, uint32 nIn, uint32 nOut) external payable returns (uint256);
    function eval(uint256 id, bytes calldata inputs) external view returns (bytes memory);
}

interface IFactory {
    function createCPU(string calldata name, string calldata symbol, string calldata story, uint256 supply, uint256 mintPrice)
        external
        returns (address transistors, address cpu);
}

interface IERC20Min {
    function approve(address s, uint256 v) external returns (bool);
}

interface ITransistors {
    function mint(uint256 id, uint256 amount) external payable;
    function mintPrice() external view returns (uint256);
    function protocolFee() external view returns (uint256);
    function balanceOf(address a, uint256 id) external view returns (uint256);
}

/// @notice Runs against an X Layer mainnet fork: real tokens, real router, real TapeOut processor.
contract BensinForkTest is Test {
    address constant USDT0 = 0x779Ded0c9e1022225f8E0630b35a9b54bE713736;
    address constant USDC = 0xB6CEceAB302E2E4948951eE7843FC24E92933061;
    address constant USDG = 0x4ae46a509F6b1D9056937BA4500cb143933D2dc8;
    address constant FACTORY = 0x1f09DAeFA827f02CBb40967cc91b259763760761;
    address constant BEM = 0x60e62Efa9405d6873C5deaBD4E6CC91c25363952;
    address processor;
    bytes32 constant RECEIVE_TYPEHASH = keccak256(
        "ReceiveWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)"
    );

    Bensin bensin;
    uint256 circuitId;
    bytes netlist;
    address treasury = makeAddr("treasury");
    address bob = makeAddr("bob");
    address user;
    uint256 userKey;
    uint256 saltCounter;

    function setUp() public {
        vm.createSelectFork("https://rpc.xlayer.tech");
        (user, userKey) = makeAddrAndKey("forkUser");
        netlist = vm.parseBytes(_netlistFromFile());

        vm.deal(address(this), 10 ether);
        deal(BEM, address(this), 1_000e8);
        IERC20Min(BEM).approve(FACTORY, type(uint256).max);
        (address t, address c) = IFactory(FACTORY).createCPU(
            "Bensin", "BNSN", "Bensin: gasless sends and refuel on X Layer, sponsored by the Satpam circuit", 1_000, 0
        );
        IERC20Min(BEM).approve(t, type(uint256).max);
        IERC20Min(BEM).approve(c, type(uint256).max);
        processor = c;
        ITransistors(t).mint(0, 26);
        circuitId = IProc(c).tapeout{value: IProc(c).TAPEOUT_FEE()}(netlist, 6, 3);
        bensin = new Bensin(c, circuitId, keccak256(netlist), treasury);

        deal(USDT0, user, 1_000e6);
        deal(USDC, user, 1_000e6);
        deal(USDG, user, 1_000e6);
        assertEq(user.balance, 0);
    }

    function onERC1155Received(address, address, uint256, uint256, bytes calldata) external pure returns (bytes4) {
        return this.onERC1155Received.selector;
    }

    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }

    function _netlistFromFile() internal view returns (string memory) {
        string memory txt = vm.readFile("../circuit/satpam.out.txt");
        // first line is "netlist=0x..."
        bytes memory b = bytes(txt);
        uint256 start = 8;
        uint256 end = start;
        while (end < b.length && b[end] != "\n") end++;
        bytes memory hexStr = new bytes(end - start);
        for (uint256 i = 0; i < hexStr.length; i++) hexStr[i] = b[start + i];
        return string(hexStr);
    }

    function _intent(address token, address to, uint256 amount, uint256 fee, uint8 action, uint256 minOut)
        internal
        returns (Bensin.Intent memory)
    {
        return Bensin.Intent(token, user, to, amount, fee, action, minOut, block.timestamp + 600, bytes32(++saltCounter));
    }

    function _relay(Bensin.Intent memory it) internal returns (uint256) {
        (uint8 v, bytes32 r, bytes32 s) = _sign(it);
        return bensin.relay(it, v, r, s);
    }

    function _sign(Bensin.Intent memory it) internal view returns (uint8 v, bytes32 r, bytes32 s) {
        bytes32 structHash = keccak256(
            abi.encode(RECEIVE_TYPEHASH, it.from, address(bensin), it.amount + it.fee, 0, it.validBefore, bensin.intentNonce(it))
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", IEIP3009(it.token).DOMAIN_SEPARATOR(), structHash));
        (v, r, s) = vm.sign(userKey, digest);
    }

    function _send(address token) internal {
        _relay(_intent(token, bob, 5e6, 0, 0, 0)); // first-time free
        _relay(_intent(token, bob, 20e6, 20_000, 0, 0));
        assertEq(IEIP3009(token).balanceOf(bob), 25e6);
        assertEq(IEIP3009(token).balanceOf(treasury), 20_000);
        assertEq(user.balance, 0);
    }

    function test_fork_sendUSDT0() public {
        _send(USDT0);
    }

    function test_fork_sendUSDC() public {
        _send(USDC);
    }

    function test_fork_sendUSDG() public {
        _send(USDG);
    }

    function test_fork_refuelUSDT0() public {
        uint256 out = _relay(_intent(USDT0, user, 2e6, 20_000, 1, 1));
        assertGt(out, 0);
        assertEq(user.balance, out);
        assertEq(IEIP3009(USDT0).balanceOf(user), 1_000e6 - 2e6 - 20_000);
        assertEq(address(bensin).balance, 0);
    }

    function test_fork_refuelUSDG() public {
        uint256 out = _relay(_intent(USDG, user, 2e6, 20_000, 1, 1));
        assertEq(user.balance, out);
    }

    function test_refuelSlippageReverts() public {
        uint256 snap = vm.snapshotState();
        uint256 quoted = _relay(_intent(USDT0, user, 2e6, 20_000, 1, 1));
        vm.revertToState(snap);
        Bensin.Intent memory it = _intent(USDT0, user, 2e6, 20_000, 1, quoted * 2);
        (uint8 v, bytes32 r, bytes32 s) = _sign(it);
        vm.expectRevert(Bensin.Slippage.selector);
        bensin.relay(it, v, r, s);
        assertEq(IEIP3009(USDT0).balanceOf(user), 1_000e6);
    }

    function test_fork_refuelOverSmallDenied() public {
        Bensin.Intent memory it = _intent(USDT0, user, 11e6, 20_000, 1, 1);
        (uint8 v, bytes32 r, bytes32 s) = _sign(it);
        vm.expectRevert(Bensin.Denied.selector);
        bensin.relay(it, v, r, s);
    }

    function test_fork_realCircuitMatchesSpec() public view {
        for (uint8 x = 0; x < 64; x++) {
            bytes memory o = IProc(processor).eval(circuitId, abi.encodePacked(x));
            assertEq(o.length, 1);
            assertEq(uint8(o[0]), SatpamSpec.spec(x));
        }
    }
}
