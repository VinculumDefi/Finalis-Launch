// SPDX-License-Identifier: MIT
// Rig 3: fee math fuzz. 5% of gross, floor rounding, principal = gross - fee,
// bounds at 0, 1 wei, 19/20 wei and the uint256 maximum. Uses a harness that
// only exposes BaseCommitmentVaultLock._quote (pure; no state change).
pragma solidity 0.8.19;

import {Fixture} from "./Fixture.sol";
import {BaseCommitmentVaultLock} from "vf/BaseCommitmentVaultLock.sol";
import {ProofPackage} from "vf/VinculumFinalisVerifier.sol";

contract QuoteHarness is BaseCommitmentVaultLock {
    constructor(address df, address v, address c, address s) BaseCommitmentVaultLock("Base", df, v, c, s) {}

    function quote(uint256 gross, uint256 duration, uint256 usd) external pure returns (uint256, uint256, uint256) {
        return _quote(gross, duration, usd);
    }
}

contract FuzzFeeMath is Fixture {
    QuoteHarness internal h;

    function setUp() public {
        vm.warp(1_800_000_000);
        _deployStack(true);
        h = new QuoteHarness(devFund, address(vclm), address(chonx), address(synth));
    }

    function testFuzz_feeIsFloorFivePercent(uint256 gross, uint8 durIdx) public {
        gross = bound(gross, 0, type(uint256).max / 500);
        uint256 d = DUR[durIdx % 16];
        (uint256 fee, uint256 principal, uint256 m) = h.quote(gross, d, _lockUsd(d));
        assertEq(fee, (gross * 500) / 10000);
        assertEq(fee + principal, gross);
        assertLe(fee * 20, gross);
        assertGt((fee + 1) * 20, gross);
        assertEq(m, MULT[durIdx % 16]);
    }

    function testFuzz_feeOverflowPanicsAboveMaxOver500(uint256 gross) public {
        gross = bound(gross, type(uint256).max / 500 + 1, type(uint256).max);
        vm.expectRevert(abi.encodeWithSignature("Panic(uint256)", 0x11));
        h.quote(gross, 604800, 1e18);
    }

    function test_boundaries() public {
        (uint256 f0, uint256 p0,) = h.quote(0, 604800, 1e18);
        assertEq(f0 + p0, 0);
        (uint256 f1, uint256 p1,) = h.quote(1, 604800, 1e18);
        assertEq(f1, 0);
        assertEq(p1, 1);
        (uint256 f19,,) = h.quote(19, 604800, 1e18);
        assertEq(f19, 0);
        (uint256 f20, uint256 p20,) = h.quote(20, 604800, 1e18);
        assertEq(f20, 1);
        assertEq(p20, 19);
        // Native lock with 0, 1 and 19 wei refuses; 20 wei opens.
        vm.deal(user, 100);
        vm.startPrank(user);
        vm.expectRevert(bytes("CVL: zero gross"));
        lock.createNativeLock{value: 0}(keccak256("b0"), recipient, 0, ETH_ID, 0, user, 604800, 1e18);
        vm.expectRevert(bytes("CVL: zero fee or principal"));
        lock.createNativeLock{value: 1}(keccak256("b1"), recipient, 0, ETH_ID, 0, user, 604800, 1e18);
        vm.expectRevert(bytes("CVL: zero fee or principal"));
        lock.createNativeLock{value: 19}(keccak256("b19"), recipient, 0, ETH_ID, 0, user, 604800, 1e18);
        lock.createNativeLock{value: 20}(keccak256("b20"), recipient, 0, ETH_ID, 0, user, 604800, 1e18);
        vm.stopPrank();
    }

    /// Every lock the Base lock opens passes the Verifier's VF-COM-011/012/013
    /// fee re-check (no lock opens that the Verifier rejects on fee math).
    /// A lock whose derived USD is under $0.01 is opened by the lock (it
    /// trusts the stated USD) and refused by the Verifier (VF-COM-009).
    function testFuzz_lockAndVerifierFeeAgree(uint256 gross) public {
        gross = bound(gross, 20, 1e27);
        bytes32 id = keccak256(abi.encode("agree", gross));
        _openNative(id, gross, 604800, 0);
        ProofPackage memory p = _pkg(id, gross, 604800, 0, id, block.timestamp);
        uint256 usd = (gross * ETH_PRICE) / 1e18;
        if (usd < 0.01e18) {
            vm.expectRevert(bytes("VF-COM-009: standard USD below $0.01"));
            verifier.recordFeeAndRac(p);
            return;
        }
        verifier.recordFeeAndRac(p);
        uint256 feeUsd = (usd * p.actualFeeAmountSmallestUnits) / gross;
        assertEq(verifier.racCredits(id), (feeUsd * 6000) / 10000);
        assertLe(verifier.racCredits(id) * 10000, feeUsd * 6000);
    }

    /// Tampered fee or principal in the package is refused by the
    /// reader cross-check or the fee rule.
    function testFuzz_tamperedFeeRefused(uint256 gross, uint256 fee) public {
        gross = bound(gross, 1e15, 1e24);
        uint256 honest = (gross * 500) / 10000;
        fee = bound(fee, 1, gross - 1);
        vm.assume(fee != honest);
        bytes32 id = keccak256(abi.encode("tamper", gross));
        _openNative(id, gross, 604800, 0);
        ProofPackage memory p = _pkg(id, gross, 604800, 0, id, block.timestamp);
        p.actualFeeAmountSmallestUnits = fee;
        p.principalAmountSmallestUnits = gross - fee;
        vm.expectRevert();
        verifier.recordFeeAndRac(p);
    }
}
