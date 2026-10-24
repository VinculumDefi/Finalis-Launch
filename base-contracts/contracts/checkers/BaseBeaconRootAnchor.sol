// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "./BeaconSsz.sol";

/// @notice Ethereum finalized execution block, anchored on Base.
///
/// Base writes the parent beacon block root of each L1 origin into the
/// EIP-4788 beacon roots contract (same address on Ethereum and on Base).
/// Chain of checks, each one a hash link, nothing taken on trust:
///   1. beaconRoots(baseTimestamp) = R, read on Base.
///   2. hash_tree_root(attested header) = R.
///   3. From attested.stateRoot (SSZ branches): genesis_validators_root is
///      Ethereum mainnet, fork.current_version is Electra or Fulu, and
///      finalized_checkpoint.root = F.
///   4. hash_tree_root(finalized header) = F, slot at or after Electra.
///   5. From finalized.bodyRoot: execution_payload state_root, block_number
///      and block_hash.
/// Finality is the finalized checkpoint carried in the beacon state (Casper
/// FFG, two-thirds of stake), never the head or a justified checkpoint.
/// Forging F needs control of Ethereum consensus or of Base's L1 derivation.
/// A Gloas or later state (new fork version) is refused until a reader for
/// that layout exists (fail closed).
library BaseBeaconRootAnchor {
    address internal constant BEACON_ROOTS = 0x000F3df6D732807Ef1319fB7B8bB8522d0Beac02;
    bytes32 internal constant MAINNET_GENESIS_VALIDATORS_ROOT =
        0x4b363db94e286120d76eb905340fdd4e54bfe9f06bf33ff6cf5ad27f511bfe95;
    bytes32 internal constant ELECTRA_FORK_VERSION = bytes32(bytes4(0x05000000));
    bytes32 internal constant FULU_FORK_VERSION = bytes32(bytes4(0x06000000));
    /// Mainnet Electra epoch 364032 * 32 slots.
    uint64 internal constant ELECTRA_FIRST_SLOT = 11649024;

    // Electra and Fulu BeaconState (37 fields, depth 6).
    uint256 internal constant GVR_GINDEX = 65;
    uint256 internal constant FORK_CURRENT_VERSION_GINDEX = 269;
    uint256 internal constant FINALIZED_ROOT_GINDEX = 169;
    // Electra and Fulu BeaconBlockBody (depth 4), execution_payload at 25 (depth 5).
    uint256 internal constant PAYLOAD_STATE_ROOT_GINDEX = 802;
    uint256 internal constant PAYLOAD_BLOCK_NUMBER_GINDEX = 806;
    uint256 internal constant PAYLOAD_BLOCK_HASH_GINDEX = 812;

    struct Proof {
        uint256 baseTimestamp;
        BeaconSsz.BeaconHeader attested;
        bytes32[] gvrBranch;
        bytes32 forkVersion;
        bytes32[] forkVersionBranch;
        bytes32 finalizedRoot;
        bytes32[] finalizedRootBranch;
        BeaconSsz.BeaconHeader finalized;
        bytes32 executionStateRoot;
        bytes32[] executionStateRootBranch;
        uint64 executionBlockNumber;
        bytes32[] executionBlockNumberBranch;
        bytes32 executionBlockHash;
        bytes32[] executionBlockHashBranch;
    }

    struct Finalized {
        bytes32 stateRoot;
        uint256 blockNumber;
        bytes32 blockHash;
        uint64 beaconSlot;
    }

    function beaconRootAt(uint256 baseTimestamp) internal view returns (bytes32 r) {
        (bool ok, bytes memory out) = BEACON_ROOTS.staticcall(abi.encode(baseTimestamp));
        require(ok && out.length == 32, "VF-XCH-006: no Base EIP-4788 beacon root for timestamp");
        r = abi.decode(out, (bytes32));
        require(r != bytes32(0), "VF-XCH-006: empty beacon root");
    }

    function verify(Proof memory p) internal view returns (Finalized memory f) {
        bytes32 anchored = beaconRootAt(p.baseTimestamp);
        require(BeaconSsz.root(p.attested) == anchored, "VF-XCH-006: attested header not anchored on Base");

        bytes32 st = p.attested.stateRoot;
        require(
            BeaconSsz.branchRoot(MAINNET_GENESIS_VALIDATORS_ROOT, p.gvrBranch, GVR_GINDEX) == st,
            "VF-XCH-006: not Ethereum mainnet (genesis validators root)"
        );
        require(
            p.forkVersion == ELECTRA_FORK_VERSION || p.forkVersion == FULU_FORK_VERSION,
            "VF-XCH-006: unsupported beacon fork"
        );
        require(
            BeaconSsz.branchRoot(p.forkVersion, p.forkVersionBranch, FORK_CURRENT_VERSION_GINDEX) == st,
            "VF-XCH-006: fork version proof"
        );
        require(p.finalizedRoot != bytes32(0), "VF-XCH-006: no finalized checkpoint");
        require(
            BeaconSsz.branchRoot(p.finalizedRoot, p.finalizedRootBranch, FINALIZED_ROOT_GINDEX) == st,
            "VF-XCH-006: finalized checkpoint proof"
        );

        require(BeaconSsz.root(p.finalized) == p.finalizedRoot, "VF-XCH-006: header is not the finalized checkpoint");
        require(p.finalized.slot >= ELECTRA_FIRST_SLOT, "VF-XCH-006: finalized block before Electra");
        require(p.finalized.slot <= p.attested.slot, "VF-XCH-006: finalized after attested");

        bytes32 body = p.finalized.bodyRoot;
        require(
            BeaconSsz.branchRoot(p.executionStateRoot, p.executionStateRootBranch, PAYLOAD_STATE_ROOT_GINDEX) == body,
            "VF-XCH-006: execution state root proof"
        );
        require(
            BeaconSsz.branchRoot(
                BeaconSsz.u64(p.executionBlockNumber), p.executionBlockNumberBranch, PAYLOAD_BLOCK_NUMBER_GINDEX
            ) == body,
            "VF-XCH-006: execution block number proof"
        );
        require(
            BeaconSsz.branchRoot(p.executionBlockHash, p.executionBlockHashBranch, PAYLOAD_BLOCK_HASH_GINDEX) == body,
            "VF-XCH-006: execution block hash proof"
        );
        require(
            p.executionStateRoot != bytes32(0) && p.executionBlockHash != bytes32(0) && p.executionBlockNumber != 0,
            "VF-XCH-006: empty execution payload"
        );
        f = Finalized(p.executionStateRoot, p.executionBlockNumber, p.executionBlockHash, p.finalized.slot);
    }
}
