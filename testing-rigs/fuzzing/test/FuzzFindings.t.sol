// SPDX-License-Identifier: MIT
// Rig 3 property tests for findings FZ-01, FZ-01b, FZ-02 and FZ-05. These
// failed on b0e38a9 (each pinned a finding). Converted 2026-10-23 after the
// batch fix: each now asserts the fixed, safe behavior and must pass.
pragma solidity 0.8.19;

import {Fixture} from "./Fixture.sol";
import {ProofPackage} from "vf/VinculumFinalisVerifier.sol";
import {SimpleEthereumLockReader} from "vf/chain-verifiers/SimpleEthereumLockReader.sol";

contract FuzzFindings is Fixture {
    function setUp() public {
        vm.warp(1_800_000_000);
        _deployStack(true);
    }

    /// FZ-01 SAFE (AG-04). One real lock yields at most one RAC credit. A
    /// second call for the SAME lock with any other racIdentity is refused
    /// and the epoch reward basis does not change.
    function testFuzz_PROP_oneRacPerLock(uint256 gross, bytes32 rac2) public {
        gross = bound(gross, 0.001 ether, 100 ether);
        bytes32 rac1 = keccak256("rac-1");
        vm.assume(rac2 != rac1);
        bytes32 id = keccak256("lock-FZ01");
        _openNative(id, gross, 31536000, 0);
        verifier.recordFeeAndRac(_pkg(id, gross, 31536000, 0, rac1, block.timestamp));
        uint256 basisAfterOne = verifier.epochRewardBasis(verifier.currentEpoch());
        ProofPackage memory p2 = _pkg(id, gross, 31536000, 0, rac2, block.timestamp);
        vm.expectRevert(bytes("VF-RAC-001: RAC already recorded"));
        verifier.recordFeeAndRac(p2);
        assertEq(verifier.epochRewardBasis(verifier.currentEpoch()), basisAfterOne);
    }

    /// FZ-01b SAFE (AG-04). After the lock has minted, every further RAC
    /// attempt is refused and the reward basis stays the same.
    function testFuzz_PROP_noRacAfterMint(uint256 gross, uint8 extra) public {
        gross = bound(gross, 0.001 ether, 100 ether);
        uint256 n = bound(extra, 1, 20);
        bytes32 id = keccak256("lock-FZ01b");
        _openNative(id, gross, 31536000, 0);
        verifier.recordFeeAndRac(_pkg(id, gross, 31536000, 0, bytes32(uint256(1)), block.timestamp));
        verifier.verifyAndMint(_pkg(id, gross, 31536000, 0, bytes32(uint256(1)), block.timestamp), 0);
        uint256 e = verifier.currentEpoch();
        uint256 basis1 = verifier.epochRewardBasis(e);
        for (uint256 i = 0; i < n; i++) {
            ProofPackage memory q = _pkg(id, gross, 31536000, 0, bytes32(uint256(100 + i)), block.timestamp);
            vm.expectRevert(bytes("VF-RAC-001: RAC already recorded"));
            verifier.recordFeeAndRac(q);
        }
        assertEq(verifier.epochRewardBasis(e), basis1, "reward basis grew after the lock was consumed");
    }

    /// FZ-02 SAFE (AG-05). Emission decay follows the lock's own creation
    /// time. A package whose valuationTimestamp differs from the proven
    /// creation time is refused (VF-ORC-011); the honest package mints
    /// exactly the reference amount for the lock's own age.
    function testFuzz_PROP_issuanceIndependentOfCallerValuationTs(uint256 gross, uint256 ageDays, uint256 claimedTs)
        public
    {
        gross = bound(gross, 0.01 ether, 10 ether);
        ageDays = bound(ageDays, 30, 3000);
        uint256 launch = verifier.protocolLaunchTimestamp();
        vm.warp(launch + ageDays * 1 days);
        _postPrices(ETH_PRICE, 1e18); // keep the run fresh and Base ETH usable
        bytes32 id = keccak256(abi.encode("lock-FZ02", gross, ageDays));
        _openNative(id, gross, 31536000, 0);
        claimedTs = bound(claimedTs, 0, block.timestamp);
        if (claimedTs != block.timestamp) {
            ProofPackage memory bad = _pkg(id, gross, 31536000, 0, id, claimedTs);
            vm.expectRevert(bytes("VF-ORC-011: valuation timestamp != proven lock creation time"));
            verifier.recordFeeAndRac(bad);
        }
        ProofPackage memory p = _pkg(id, gross, 31536000, 0, id, block.timestamp);
        verifier.recordFeeAndRac(p);
        uint256 before = vclm.balanceOf(recipient);
        verifier.verifyAndMint(p, 0);
        uint256 minted = vclm.balanceOf(recipient) - before;
        uint256 usd = (gross * ETH_PRICE) / 1e18;
        uint256 ageNow = (block.timestamp - launch) / 1 days;
        uint256 honest = _refIssuance(usd, 0, 2, 25000, ageNow);
        assertEq(minted, honest, "issuance must follow the lock creation time");
    }

    /// FZ-05 SAFE (AG-01). A self-made, well-formed 20-field post-merge
    /// header is refused: the production Ethereum reader has no on-chain
    /// settled-history anchor, so it fails closed for every input.
    function testFuzz_SAFE_selfMadeHeaderRefused(bytes32 stateRoot, bytes32 receiptsRoot, uint64 number)
        public
    {
        vm.assume(stateRoot != 0 && receiptsRoot != 0 && number != 0);
        SimpleEthereumLockReader r = new SimpleEthereumLockReader(address(lock));
        bytes memory h = _header(stateRoot, receiptsRoot, number);
        bytes memory lep = _evmProof(h);
        bytes memory fin = abi.encode(uint256(1), keccak256(h), uint256(number));
        vm.expectRevert(bytes("VF-XCH-006: Ethereum settled-history anchor not enforced on-chain; environment disabled"));
        r.verifyFinality(lep, fin);
    }

    // ---- minimal RLP builder for the shape test ----
    function _str(bytes memory b) internal pure returns (bytes memory) {
        if (b.length == 1 && uint8(b[0]) < 0x80) return b;
        if (b.length < 56) return abi.encodePacked(uint8(0x80 + b.length), b);
        bytes memory l = _be(b.length);
        return abi.encodePacked(uint8(0xb7 + l.length), l, b);
    }

    function _be(uint256 x) internal pure returns (bytes memory o) {
        uint256 n;
        for (uint256 t = x; t != 0; t >>= 8) n++;
        o = new bytes(n);
        for (uint256 i = 0; i < n; i++) o[n - 1 - i] = bytes1(uint8(x >> (8 * i)));
    }

    function _header(bytes32 sr, bytes32 rr, uint64 number) internal pure returns (bytes memory) {
        bytes memory body = abi.encodePacked(
            _str(abi.encodePacked(bytes32(uint256(1)))),
            _str(abi.encodePacked(keccak256(hex"c0"))),
            _str(abi.encodePacked(bytes20(uint160(3)))),
            _str(abi.encodePacked(sr)),
            _str(abi.encodePacked(bytes32(uint256(4)))),
            _str(abi.encodePacked(rr)),
            _str(new bytes(256))
        );
        body = abi.encodePacked(
            body,
            _str(_be(0)),
            _str(_be(number)),
            _str(_be(30_000_000)),
            _str(_be(1)),
            _str(_be(1_800_000_000)),
            _str(""),
            _str(abi.encodePacked(bytes32(0))),
            _str(abi.encodePacked(bytes8(0))),
            _str(_be(7)),
            _str(abi.encodePacked(bytes32(uint256(5)))),
            _str(_be(0)),
            _str(_be(0)),
            _str(abi.encodePacked(bytes32(uint256(6))))
        );
        bytes memory l = _be(body.length);
        return abi.encodePacked(uint8(0xf7 + l.length), l, body);
    }

    struct LockEventProof {
        bytes headerRlp;
        bytes receipt;
        uint256 receiptIndex;
        bytes[] receiptNodes;
        uint256 logIndex;
        bytes[] accountNodes;
        bytes[] envSlotNodes;
        bytes[] recipientSlotNodes;
    }

    function _evmProof(bytes memory h) internal pure returns (bytes memory) {
        bytes[] memory e = new bytes[](0);
        return abi.encode(LockEventProof(h, "", 0, e, 0, e, e, e));
    }
}
