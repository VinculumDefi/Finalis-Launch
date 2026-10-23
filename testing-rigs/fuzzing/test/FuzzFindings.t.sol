// SPDX-License-Identifier: MIT
// Rig 3 property tests that are EXPECTED TO FAIL on b0e38a9. Each one states
// a property the Rev 6 text implies and lets the fuzzer find a breaking
// input. A failure here is a finding, recorded with its counterexample in
// testing-rigs/fuzzing/results. Nothing here fixes production code.
pragma solidity 0.8.19;

import {Fixture} from "./Fixture.sol";
import {ProofPackage} from "vf/VinculumFinalisVerifier.sol";
import {SimpleEthereumLockReader} from "vf/chain-verifiers/SimpleEthereumLockReader.sol";

contract FuzzFindings is Fixture {
    function setUp() public {
        vm.warp(1_800_000_000);
        _deployStack(true);
    }

    /// FZ-01. One real lock must yield at most one RAC credit (VF-RAC-001
    /// "exact-once" per lock). Property: after one recordFeeAndRac for a lock,
    /// a second call for the SAME lock with any other racIdentity reverts.
    function testFuzz_PROP_oneRacPerLock(uint256 gross, bytes32 rac2) public {
        gross = bound(gross, 0.001 ether, 100 ether);
        bytes32 rac1 = keccak256("rac-1");
        vm.assume(rac2 != rac1);
        bytes32 id = keccak256("lock-FZ01");
        _openNative(id, gross, 31536000, 0);
        verifier.recordFeeAndRac(_pkg(id, gross, 31536000, 0, rac1, block.timestamp));
        uint256 basisAfterOne = verifier.epochRewardBasis(verifier.currentEpoch());
        try verifier.recordFeeAndRac(_pkg(id, gross, 31536000, 0, rac2, block.timestamp)) {
            uint256 basisAfterTwo = verifier.epochRewardBasis(verifier.currentEpoch());
            emit log_named_uint("basis after first credit", basisAfterOne);
            emit log_named_uint("basis after second credit, same lock", basisAfterTwo);
            fail();
        } catch {}
    }

    /// FZ-01b. Same class after the lock has already minted: the RAC path
    /// never checks consumedLocks, so credit keeps growing after the mint.
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
            try verifier.recordFeeAndRac(_pkg(id, gross, 31536000, 0, bytes32(uint256(100 + i)), block.timestamp)) {} catch {}
        }
        assertEq(verifier.epochRewardBasis(e), basis1, "reward basis grew after the lock was consumed");
    }

    /// FZ-02. Emission decay must follow the lock's own creation time (Rev 6:
    /// the Valuation Timestamp is the source block time). Property: the
    /// minted amount does not depend on the caller-chosen valuationTimestamp.
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
        ProofPackage memory p = _pkg(id, gross, 31536000, 0, id, claimedTs);
        verifier.recordFeeAndRac(p);
        uint256 before = vclm.balanceOf(recipient);
        verifier.verifyAndMint(p, 0);
        uint256 minted = vclm.balanceOf(recipient) - before;
        uint256 usd = (gross * ETH_PRICE) / 1e18;
        uint256 honest = _refIssuance(usd, 0, 2, 25000, ageDays);
        assertEq(minted, honest, "issuance follows caller-supplied valuationTimestamp, not lock creation");
    }

    /// FZ-05 (shape only, not a fuzz-found bug). Demonstrates the class fuzzing
    /// cannot reach: a self-made, well-formed 20-field post-merge header with its own
    /// hash claimed passes SimpleEthereumLockReader.verifyFinality. Random
    /// bytes never get here; a crafted input does at once. Recorded so the
    /// limit of this rig is explicit. Belongs to the adversarial tier.
    function testFuzz_SHAPE_selfMadeHeaderPassesFinality(bytes32 stateRoot, bytes32 receiptsRoot, uint64 number)
        public
    {
        vm.assume(stateRoot != 0 && receiptsRoot != 0 && number != 0);
        SimpleEthereumLockReader r = new SimpleEthereumLockReader(address(lock));
        bytes memory h = _header(stateRoot, receiptsRoot, number);
        (bool ok,, uint256 height) = r.verifyFinality(_evmProof(h), abi.encode(uint256(1), keccak256(h), uint256(number)));
        assertTrue(ok);
        assertEq(height, number);
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
