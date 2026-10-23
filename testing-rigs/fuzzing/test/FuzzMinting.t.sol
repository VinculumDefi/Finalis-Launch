// SPDX-License-Identifier: MIT
// Rig 3: minting fuzz. VCLM and CHONX issuance amounts against an independent
// reference of VF-COM-018/019, emission decay over time, and the 10,000,000
// VCLM CHONX activation threshold. Honest packages only (valuationTimestamp
// equals the lock creation time); the dishonest case is FZ-02 in
// FuzzFindings.t.sol.
pragma solidity 0.8.19;

import {Fixture} from "./Fixture.sol";
import {ProofPackage} from "vf/VinculumFinalisVerifier.sol";
import {VinculumFinalisToken} from "vf/VinculumFinalisToken.sol";

contract FuzzMinting is Fixture {
    function setUp() public {
        vm.warp(1_800_000_000);
        _deployStack(true);
    }

    function _usd(uint256 gross) internal pure returns (uint256) {
        return (((gross * 1e18) / 1e18) * ETH_PRICE) / 1e18;
    }

    function _boundGross(uint256 gross, uint256 dur) internal pure returns (uint256) {
        // Handshake: $0.01 to $0.02 at $2,000 is 5e12 to 1e13 wei.
        if (dur == 3600) return bound(gross, 5e12, 1e13);
        return bound(gross, 5e12, 50 ether);
    }

    function testFuzz_vclmMintMatchesReference(uint256 gross, uint8 durIdx, uint256 ageDays) public {
        uint256 dur = DUR[durIdx % 16];
        gross = _boundGross(gross, dur);
        ageDays = bound(ageDays, 0, 6000);
        vm.warp(verifier.protocolLaunchTimestamp() + ageDays * 1 days);
        _postPrices(ETH_PRICE, 1e18);
        bytes32 id = keccak256(abi.encode(gross, durIdx, ageDays));
        _openNative(id, gross, dur, 0);
        ProofPackage memory p = _pkg(id, gross, dur, 0, id, block.timestamp);
        uint256 usd = _usd(gross);
        bool inBand = dur == 3600 ? (usd >= 0.01e18 && usd <= 0.02e18) : usd >= 0.01e18;
        if (!inBand) {
            vm.expectRevert();
            verifier.recordFeeAndRac(p);
            return;
        }
        verifier.recordFeeAndRac(p);
        verifier.verifyAndMint(p, 0);
        assertEq(vclm.balanceOf(recipient), _refIssuance(usd, 0, 2, MULT[durIdx % 16], ageDays));
        assertTrue(verifier.isLockConsumed("Base", id));
        vm.expectRevert(bytes("VF-XCH-013: replay"));
        verifier.verifyAndMint(p, 0);
    }

    function testFuzz_usdcMintMatchesReference(uint256 amount, uint8 durIdx) public {
        uint256 dur = DUR[durIdx % 16];
        amount = dur == 3600 ? bound(amount, 10_000, 20_000) : bound(amount, 10_000, 1e12); // up to $1M; larger hits the VCLM cap (covered by vclmCapRejectsInFull)
        usdc.mint(user, amount);
        bytes32 id = keccak256(abi.encode("usdc", amount, durIdx));
        vm.startPrank(user);
        usdc.approve(address(lock), amount);
        lock.createErc20Lock(id, recipient, 0, usdcId, bytes32(0), user, dur, address(usdc), amount, _lockUsd(dur));
        vm.stopPrank();
        ProofPackage memory p = _pkg(id, amount, dur, 0, id, block.timestamp);
        p.canonicalAssetId = usdcId;
        p.feeAssetId = usdcId;
        p.assetPrecision = 6;
        p.assetCustodyClass = 1;
        uint256 usd = (amount * 1e18) / 1e6;
        if (dur == 3600 && (usd < 0.01e18 || usd > 0.02e18)) {
            vm.expectRevert();
            verifier.recordFeeAndRac(p);
            return;
        }
        verifier.recordFeeAndRac(p);
        verifier.verifyAndMint(p, 0);
        assertEq(vclm.balanceOf(recipient), _refIssuance(usd, 0, 1, MULT[durIdx % 16], 0));
    }

    function testFuzz_usdcBelowFloorRefused(uint256 price) public {
        price = bound(price, 1, 0.95e18 - 1);
        _postPrices(ETH_PRICE, price);
        uint256 amount = 1e6;
        usdc.mint(user, amount);
        bytes32 id = keccak256(abi.encode("usdc-floor", price));
        vm.startPrank(user);
        usdc.approve(address(lock), amount);
        lock.createErc20Lock(id, recipient, 0, usdcId, bytes32(0), user, 604800, address(usdc), amount, 1e18);
        vm.stopPrank();
        ProofPackage memory p = _pkg(id, amount, 604800, 0, id, block.timestamp);
        p.canonicalAssetId = usdcId;
        p.feeAssetId = usdcId;
        p.assetPrecision = 6;
        vm.expectRevert(bytes("VF-ORC-005: USDC/USDT scheduled price below $0.95"));
        verifier.recordFeeAndRac(p);
    }

    function testFuzz_decayMonotoneFlooredAndMatchesReference(uint256 d1, uint256 d2) public {
        d1 = bound(d1, 0, 100_000);
        d2 = bound(d2, d1, 100_000);
        for (uint8 t = 0; t < 2; t++) {
            uint256 r1 = verifier.previewEmissionRate(t, d1);
            uint256 r2 = verifier.previewEmissionRate(t, d2);
            uint256 init = t == 0 ? 10e18 : 100e18;
            uint256 flo = t == 0 ? 1e18 : 10e18;
            assertLe(r2, r1, "rate rose with time");
            assertGe(r2, flo, "rate under floor");
            assertLe(r1, init, "rate over initial");
            if (d1 < 30) assertEq(r1, init, "decay before the first 30 days");
            uint256 ref = _refIssuance(1e18, t, 3, 10000, d2);
            assertEq(r2, ref, "rate differs from reference");
        }
    }

    function testFuzz_chonxActivationAtTenMillion(uint256 gross) public {
        // 1-year lock, S2: 10 * 1.3 * 2.5 = 32.5 VCLM per $1. 10M VCLM at
        // $2,000 per ETH is about 153.85 ETH of gross.
        gross = bound(gross, 100 ether, 200 ether);
        bytes32 id = keccak256(abi.encode("big", gross));
        _openNative(id, gross, 31536000, 0);
        ProofPackage memory p = _pkg(id, gross, 31536000, 0, id, block.timestamp);
        verifier.recordFeeAndRac(p);
        verifier.verifyAndMint(p, 0);
        bool shouldBeActive = verifier.lifetimeVclmIssued() >= 10_000_000e18;
        assertEq(verifier.chonxActivated(), shouldBeActive, "activation flag disagrees with the 10M threshold");

        // A CHONX lock created in the activation second is refused forever.
        bytes32 c1 = keccak256(abi.encode("chonx-same-second", gross));
        _openNative(c1, 1 ether, 31536000, 1);
        ProofPackage memory q = _pkg(c1, 1 ether, 31536000, 1, c1, block.timestamp);
        verifier.recordFeeAndRac(q);
        vm.expectRevert();
        verifier.verifyAndMint(q, 0);

        if (shouldBeActive) {
            vm.warp(block.timestamp + 1);
            bytes32 c2 = keccak256(abi.encode("chonx-after", gross));
            _openNative(c2, 1 ether, 31536000, 1);
            ProofPackage memory r = _pkg(c2, 1 ether, 31536000, 1, c2, block.timestamp);
            verifier.recordFeeAndRac(r);
            verifier.verifyAndMint(r, 0);
            uint256 d = (block.timestamp - verifier.protocolLaunchTimestamp()) / 1 days;
            assertEq(chonx.balanceOf(recipient), _refIssuance(_usd(1 ether), 1, 2, 25000, d));
        }
    }

    function testFuzz_vclmCapRejectsInFull(uint256 gross) public {
        gross = bound(gross, 1 ether, 1e12 ether);
        bytes32 id = keccak256(abi.encode("cap", gross));
        _openNative(id, gross, 315360000, 0);
        ProofPackage memory p = _pkg(id, gross, 315360000, 0, id, block.timestamp);
        verifier.recordFeeAndRac(p);
        uint256 ref = _refIssuance(_usd(gross), 0, 2, 80000, 0);
        if (ref > 10_000_000_000e18) {
            vm.expectRevert(bytes("VF-SUP-015: exceeds VCLM cap"));
            verifier.verifyAndMint(p, 0);
            assertEq(vclm.totalSupply(), 0);
        } else {
            verifier.verifyAndMint(p, 0);
            assertEq(vclm.totalSupply(), ref);
        }
    }

    function testFuzz_tokenMintRespectsHardCap(uint256 cap, uint256 a, uint256 b) public {
        cap = bound(cap, 1, type(uint128).max);
        VinculumFinalisToken t = new VinculumFinalisToken("Vinculum Finalis VCLM", "VCLM", cap);
        t.initialize(address(this), address(0xBEEF));
        a = bound(a, 0, cap);
        t.mint(user, a);
        b = bound(b, 0, type(uint128).max);
        if (a + b > cap) {
            vm.expectRevert();
            t.mint(user, b);
        } else {
            t.mint(user, b);
            assertEq(t.totalSupply(), a + b);
        }
        assertLe(t.totalSupply(), cap);
    }
}
