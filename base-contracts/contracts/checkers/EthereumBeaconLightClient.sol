// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "./BeaconSsz.sol";
import "./Bls12381.sol";

/// @title EthereumBeaconLightClient
/// @notice Altair sync-committee light client (consensus-specs
/// sync-protocol.md), Electra/Fulu generalized indices. Trust starts at a
/// checkpoint fixed at construction: a beacon block root and its current sync
/// committee, proven into that block's state. After that a beacon header is
/// recorded as finalized only through a LightClientUpdate whose attested
/// header is signed (BLS aggregate, >= 2/3 of 512) by the known sync
/// committee, and whose finalized header is SSZ-proven into the attested
/// state's finalized_checkpoint. Sync committees rotate via next-committee
/// branches. Nothing here is owned or upgradable.
contract EthereumBeaconLightClient {
    using BeaconSsz for BeaconSsz.BeaconHeader;

    uint256 public constant SYNC_COMMITTEE_SIZE = 512;
    uint256 public constant SLOTS_PER_PERIOD = 8192; // 256 epochs * 32 slots
    uint256 public constant FINALIZED_ROOT_GINDEX = 169;
    uint256 public constant CURRENT_SYNC_COMMITTEE_GINDEX = 86;
    uint256 public constant NEXT_SYNC_COMMITTEE_GINDEX = 87;
    bytes4 public constant DOMAIN_SYNC_COMMITTEE = 0x07000000;

    bytes32 public immutable genesisValidatorsRoot;
    bytes4 public immutable forkVersion;
    bytes32 public immutable domain;
    bytes32 public immutable checkpointRoot;

    uint64 public finalizedSlot;
    bytes32 public finalizedRoot;
    bytes32 public currentCommitteeRoot;
    bytes32 public nextCommitteeRoot;
    mapping(bytes32 => bool) public isFinalized;

    struct Update {
        BeaconSsz.BeaconHeader attested;
        BeaconSsz.BeaconHeader finalized;
        bytes32[] finalityBranch;
        bytes32 nextCommittee;
        bytes32[] nextCommitteeBranch;
        bytes syncBits; // Bitvector[512], 64 bytes
        bytes signature; // G2, EIP-2537 encoding (256 bytes)
        uint64 signatureSlot;
    }

    event Finalized(bytes32 indexed root, uint64 slot);

    constructor(
        BeaconSsz.BeaconHeader memory checkpoint,
        bytes32 trustedRoot,
        bytes32 committeeRoot,
        bytes32[] memory committeeBranch,
        bytes32 genesisValidatorsRoot_,
        bytes4 forkVersion_
    ) {
        require(checkpoint.root() == trustedRoot, "LC: checkpoint root");
        require(
            BeaconSsz.branchRoot(committeeRoot, committeeBranch, CURRENT_SYNC_COMMITTEE_GINDEX) == checkpoint.stateRoot,
            "LC: checkpoint committee"
        );
        genesisValidatorsRoot = genesisValidatorsRoot_;
        forkVersion = forkVersion_;
        bytes32 forkDataRoot = sha256(abi.encodePacked(bytes32(forkVersion_), genesisValidatorsRoot_));
        domain = bytes32(DOMAIN_SYNC_COMMITTEE) | (forkDataRoot >> 32);
        checkpointRoot = trustedRoot;
        finalizedSlot = checkpoint.slot;
        finalizedRoot = trustedRoot;
        currentCommitteeRoot = committeeRoot;
        isFinalized[trustedRoot] = true;
        emit Finalized(trustedRoot, checkpoint.slot);
    }

    function period(uint256 slot) public pure returns (uint256) {
        return slot / SLOTS_PER_PERIOD;
    }

    /// @param committeeXY the signing committee's 512 public keys, each as
    /// 48-byte x then 48-byte y (big-endian affine coordinates).
    /// @param committeeAggregate the committee's 48-byte compressed aggregate key.
    function submitUpdate(Update calldata u, bytes calldata committeeXY, bytes calldata committeeAggregate) external {
        require(u.syncBits.length == 64, "LC: bits length");
        require(u.signatureSlot > u.attested.slot && u.attested.slot >= u.finalized.slot, "LC: slot order");
        uint256 storePeriod = period(finalizedSlot);
        uint256 sigPeriod = period(u.signatureSlot);
        bool hasNext = u.nextCommitteeBranch.length != 0;
        if (nextCommitteeRoot == bytes32(0)) require(sigPeriod == storePeriod, "LC: signature period");
        else require(sigPeriod == storePeriod || sigPeriod == storePeriod + 1, "LC: signature period");

        bool learnsNext = nextCommitteeRoot == bytes32(0) && hasNext && period(u.attested.slot) == storePeriod;
        require(u.finalized.slot > finalizedSlot || learnsNext, "LC: not newer than checkpoint");

        bytes32 finRoot = u.finalized.root();
        require(
            BeaconSsz.branchRoot(finRoot, _copy(u.finalityBranch), FINALIZED_ROOT_GINDEX) == u.attested.stateRoot,
            "LC: finality branch"
        );
        if (hasNext) {
            require(
                BeaconSsz.branchRoot(u.nextCommittee, _copy(u.nextCommitteeBranch), NEXT_SYNC_COMMITTEE_GINDEX)
                    == u.attested.stateRoot,
                "LC: next committee branch"
            );
        }

        bytes32 expected = sigPeriod == storePeriod ? currentCommitteeRoot : nextCommitteeRoot;
        bytes memory aggregatePk = _committee(committeeXY, committeeAggregate, u.syncBits, expected);
        bytes32 signingRoot = sha256(abi.encodePacked(u.attested.root(), domain));
        require(Bls12381.verify(aggregatePk, signingRoot, u.signature), "LC: signature");

        // apply_light_client_update
        uint256 finPeriod = period(u.finalized.slot);
        if (nextCommitteeRoot == bytes32(0)) {
            require(finPeriod == storePeriod, "LC: period gap");
            if (learnsNext) nextCommitteeRoot = u.nextCommittee;
        } else if (finPeriod == storePeriod + 1) {
            currentCommitteeRoot = nextCommitteeRoot;
            nextCommitteeRoot = hasNext && period(u.attested.slot) == finPeriod ? u.nextCommittee : bytes32(0);
        } else {
            require(finPeriod == storePeriod, "LC: period gap");
        }
        if (u.finalized.slot > finalizedSlot) {
            finalizedSlot = u.finalized.slot;
            finalizedRoot = finRoot;
            isFinalized[finRoot] = true;
            emit Finalized(finRoot, u.finalized.slot);
        }
    }

    /// @dev Checks the 512 keys hash to `expected` (SSZ SyncCommittee root),
    /// that participants' points are on the curve with the right compression
    /// sign, that participation is >= 2/3, and returns the participants'
    /// aggregate key in EIP-2537 encoding.
    function _committee(bytes calldata xy, bytes calldata aggregate, bytes calldata bits, bytes32 expected)
        private
        view
        returns (bytes memory agg)
    {
        require(xy.length == SYNC_COMMITTEE_SIZE * 96 && aggregate.length == 48, "LC: committee length");
        bytes32[] memory layer = new bytes32[](SYNC_COMMITTEE_SIZE);
        uint256 count;
        for (uint256 i = 0; i < SYNC_COMMITTEE_SIZE; i++) {
            bytes memory x = xy[i * 96:i * 96 + 48];
            bytes memory y = xy[i * 96 + 48:i * 96 + 96];
            bytes1 flags = Bls12381.yLarger(y) ? bytes1(0xa0) : bytes1(0x80);
            require(uint8(x[0]) & 0xe0 == 0, "LC: key x");
            x[0] = x[0] | flags;
            layer[i] = _keyLeaf(x);
            x[0] = x[0] & 0x1f;
            if (uint8(bits[i >> 3]) >> (i & 7) & 1 == 1) {
                require(Bls12381.onCurveG1(x, y), "LC: key not on curve");
                bytes memory pt = abi.encodePacked(bytes16(0), x, bytes16(0), y);
                agg = count == 0 ? pt : Bls12381.g1Add(agg, pt);
                count++;
            }
        }
        require(count * 3 >= SYNC_COMMITTEE_SIZE * 2, "LC: participation below 2/3");
        for (uint256 n = SYNC_COMMITTEE_SIZE; n > 1; n >>= 1) {
            for (uint256 j = 0; j < n / 2; j++) layer[j] = sha256(abi.encodePacked(layer[2 * j], layer[2 * j + 1]));
        }
        bytes32 root = sha256(abi.encodePacked(layer[0], _keyLeaf(aggregate)));
        require(root == expected, "LC: wrong sync committee");
    }

    function _keyLeaf(bytes memory pk48) private pure returns (bytes32) {
        return sha256(abi.encodePacked(pk48, bytes16(0)));
    }

    function _copy(bytes32[] calldata a) private pure returns (bytes32[] memory b) {
        b = a;
    }
}
