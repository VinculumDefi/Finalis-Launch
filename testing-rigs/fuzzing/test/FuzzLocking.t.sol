// SPDX-License-Identifier: MIT
// Rig 3: locking fuzz. BaseCommitmentVaultLock amounts, all 16 durations,
// the Handshake band ($0.01 to $0.02, Rev 12), release rules, and the
// Verifier's own band check on the derived USD. Stake durations too.
pragma solidity 0.8.19;

import {Fixture, PlainToken} from "./Fixture.sol";
import {ProofPackage} from "vf/VinculumFinalisVerifier.sol";

interface ILockRecordView {
    struct LockRecord {
        bool exists;
        bool released;
        address creator;
        address releaseDestination;
        address asset;
        address baseRecipient;
        uint8 outputToken;
        uint256 gross;
        uint256 fee;
        uint256 principal;
        uint256 duration;
        uint256 multiplierBps;
        uint256 createdAt;
        uint256 maturity;
        bytes32 assetIdentity;
        bytes32 valuationReference;
        bytes bindingPayload;
    }

    function lockRecord(bytes32) external view returns (LockRecord memory);
}

contract FuzzLocking is Fixture {
    function setUp() public {
        vm.warp(1_800_000_000);
        _deployStack(true);
    }

    function _isDur(uint256 d) internal view returns (bool) {
        for (uint256 i = 0; i < 16; i++) if (DUR[i] == d) return true;
        return false;
    }

    function testFuzz_nativeLockAllDurations(uint256 gross, uint8 durIdx, uint8 outTok) public {
        uint256 i = durIdx % 16;
        gross = bound(gross, 20, type(uint128).max);
        uint8 o = outTok % 2;
        bytes32 id = keccak256(abi.encode(gross, i, o));
        uint256 dfBefore = devFund.balance;
        _openNative(id, gross, DUR[i], o);
        ILockRecordView.LockRecord memory r = ILockRecordView(address(lock)).lockRecord(id);
        uint256 fee = (gross * 500) / 10000;
        assertTrue(r.exists && !r.released);
        assertEq(r.gross, gross);
        assertEq(r.fee, fee);
        assertEq(r.principal, gross - fee);
        assertEq(r.fee + r.principal, r.gross);
        assertEq(r.duration, DUR[i]);
        assertEq(r.multiplierBps, MULT[i]);
        assertEq(r.createdAt, block.timestamp);
        assertEq(r.maturity, block.timestamp + DUR[i]);
        assertEq(r.bindingPayload.length, 117);
        assertEq(devFund.balance - dfBefore, fee);
        assertEq(address(lock).balance, gross - fee);
    }

    function testFuzz_nonListedDurationRefused(uint256 dur, uint256 gross) public {
        vm.assume(!_isDur(dur));
        gross = bound(gross, 20, 1e30);
        vm.deal(user, gross);
        vm.prank(user);
        vm.expectRevert(bytes("CVL: duration"));
        lock.createNativeLock{value: gross}(keccak256("x"), recipient, 0, ETH_ID, 0, user, dur, 1e18);
    }

    function testFuzz_lockHandshakeBandOnStatedUsd(uint256 usd) public {
        usd = bound(usd, 0, 0.1e18);
        vm.deal(user, 1 ether);
        vm.prank(user);
        bool inBand = usd >= 0.01e18 && usd <= 0.02e18;
        if (!inBand) vm.expectRevert(bytes("CVL: handshake usd"));
        lock.createNativeLock{value: 1 ether}(keccak256(abi.encode(usd)), recipient, 0, ETH_ID, 0, user, 3600, usd);
    }

    function testFuzz_lockStandardMinOnStatedUsd(uint256 usd, uint8 durIdx) public {
        uint256 d = DUR[1 + (durIdx % 15)];
        usd = bound(usd, 0, 1e18);
        vm.deal(user, 1 ether);
        vm.prank(user);
        if (usd < 0.01e18) vm.expectRevert(bytes("CVL: standard usd"));
        lock.createNativeLock{value: 1 ether}(keccak256(abi.encode(usd, d)), recipient, 0, ETH_ID, 0, user, d, usd);
    }

    /// The Verifier re-derives USD from the scheduled price; the Handshake
    /// band is enforced there on the derived value, not the stated one.
    function testFuzz_verifierHandshakeBandOnDerivedUsd(uint256 gross) public {
        gross = bound(gross, 20, 3e13);
        bytes32 id = keccak256(abi.encode("hs", gross));
        _openNative(id, gross, 3600, 0); // states $0.015 to the lock
        ProofPackage memory p = _pkg(id, gross, 3600, 0, id, block.timestamp);
        uint256 usd = (gross * ETH_PRICE) / 1e18;
        if (usd < 0.01e18 || usd > 0.02e18) {
            vm.expectRevert(bytes("VF-COM-003: handshake USD outside $0.01-$0.02"));
            verifier.recordFeeAndRac(p);
        } else {
            verifier.recordFeeAndRac(p);
            assertTrue(verifier.isRacRecorded(id));
        }
    }

    function testFuzz_releaseRules(address caller, uint256 dt, uint8 durIdx) public {
        uint256 d = DUR[durIdx % 16];
        bytes32 id = keccak256(abi.encode("rel", d));
        _openNative(id, 1 ether, d, 0);
        dt = bound(dt, 0, d * 2);
        vm.warp(block.timestamp + dt);
        uint256 principal = 1 ether - (1 ether * 500) / 10000;
        bool ok = caller == user && dt >= d;
        uint256 before = caller.balance;
        vm.prank(caller);
        if (!ok) {
            vm.expectRevert();
            lock.release(id);
            return;
        }
        lock.release(id);
        assertEq(caller.balance - before, principal);
        vm.prank(caller);
        vm.expectRevert();
        lock.release(id);
    }

    function testFuzz_duplicateLockIdRefused(bytes32 id, uint256 g1, uint256 g2) public {
        g1 = bound(g1, 20, 1e24);
        g2 = bound(g2, 20, 1e24);
        _openNative(id, g1, 604800, 0);
        vm.deal(user, g2);
        vm.prank(user);
        vm.expectRevert(bytes("CVL: lock exists"));
        lock.createNativeLock{value: g2}(id, recipient, 0, ETH_ID, 0, user, 604800, 1e18);
    }

    function testFuzz_protocolTokenRefusedAsLockInput(uint8 which, uint256 amount) public {
        address t = which % 3 == 0 ? address(vclm) : which % 3 == 1 ? address(chonx) : address(synth);
        amount = bound(amount, 20, 1e30);
        vm.prank(user);
        vm.expectRevert(bytes("VF-TOK-007: protocol token is not a lock input"));
        lock.createErc20Lock(keccak256("p"), recipient, 0, 0, 0, user, 604800, t, amount, 1e18);
    }

    function testFuzz_stakeDurations(uint256 dur) public {
        bool ok = dur == 30 days || dur == 60 days || dur == 90 days || dur == 120 days;
        // Give the user some VCLM through an honest lock to stake.
        bytes32 id = keccak256(abi.encode("stk", dur));
        _openNative(id, 1 ether, 604800, 0);
        ProofPackage memory p = _pkg(id, 1 ether, 604800, 0, id, block.timestamp);
        verifier.recordFeeAndRac(p);
        verifier.verifyAndMint(p, 0);
        uint256 bal = vclm.balanceOf(recipient);
        vm.startPrank(recipient);
        vclm.approve(address(stake), bal);
        if (!ok) vm.expectRevert(bytes("VF-STK-003: duration not permitted"));
        stake.createPosition(0, bal, dur);
        vm.stopPrank();
    }
}
