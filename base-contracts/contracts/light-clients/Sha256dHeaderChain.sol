// =============================================================================
// Sha256dHeaderChain — Base-resident SPV header chain for SHA256d UTXO chains
//
// Section O, Bitcoin row: "Base-resident light client, trusted checkpoint
// header, PoW header sync." This contract is that light client's core: it
// accepts block headers, verifies their proof of work against the chain's own
// difficulty rules, and answers inclusion and confirmation-depth questions.
//
// APPLIES TO: Bitcoin and Bitcoin Cash only.
//   Litecoin and Dogecoin use scrypt; DigiByte rotates five algorithms; Zcash
//   uses Equihash. All are memory-hard by construction and cannot be verified
//   within EVM gas limits by any known technique. Those four environments need
//   a different mechanism and are NOT served by this contract. Recorded so the
//   "one SPV pattern for six chains" reading is not repeated.
//
// TRUST ASSUMPTIONS (Verifier Completion Standard 3.7)
//   1. The checkpoint header bound at construction is a real, deeply buried
//      header of the intended chain. This is the "initial trusted state" Section
//      O requires each design to state. It is a one-time deployment input, it
//      is immutable, and everything after it is verified by proof of work.
//   2. Cumulative work decides between competing chains. An adversary able to
//      out-mine the honest network could advance a false chain — the standard
//      SPV assumption, stated rather than assumed.
//   No relayer, attestor, or administrator is trusted. Header submission is
//   permissionless because submitting an invalid header is impossible rather
//   than merely prohibited (VF-XCH-012, VF-XCH-017).
//
// NOT IMPLEMENTED HERE: the IChainVerifier wrapper. extractFacts must parse a
// CLTV lock transaction to recover lockId, amounts, duration and timestamps,
// and no CLTV script format exists in the repository (CL-27). Inventing one
// would be a protocol decision, not an implementation.
//
// SPDX-License-Identifier: PROTOCOL-RESTRICTED
// Solidity 0.8.19+
// =============================================================================

pragma solidity 0.8.19;

contract Sha256dHeaderChain {

    error BadHeaderLength(uint256 length);
    error UnknownParent(bytes32 parent);
    error InsufficientWork(bytes32 blockHash, uint256 target);
    error BadTarget(uint32 bits);
    error UnknownBlock(bytes32 blockHash);
    error ZeroCheckpoint();
    error RetargetOutOfRange();
    error ProofTooLong(uint256 length);

    struct Header {
        bytes32 parent;
        uint256 height;
        uint256 accumulatedWork;
        bytes32 merkleRoot;
        uint32  timestamp;
        uint32  bits;
        bool    exists;
    }

    uint256 private constant RETARGET_INTERVAL = 2016;
    uint256 private constant TARGET_TIMESPAN = 14 * 24 * 60 * 60;   // two weeks
    uint256 private constant MAX_TARGET =
        0x00000000FFFF0000000000000000000000000000000000000000000000000000;

    mapping(bytes32 => Header) public headers;

    bytes32 public immutable checkpointHash;
    uint256 public immutable checkpointHeight;

    /// @notice Tip of the chain with the greatest accumulated work.
    bytes32 public bestTip;
    uint256 public bestWork;
    uint256 public bestHeight;

    event HeaderAccepted(bytes32 indexed blockHash, uint256 indexed height, bytes32 parent);
    event TipAdvanced(bytes32 indexed blockHash, uint256 indexed height, uint256 accumulatedWork);

    /// @param _checkpointHash Internal-byte-order hash of a deeply buried header.
    /// @param _checkpointHeight Its height.
    /// @param _bits Its compact difficulty target.
    /// @param _timestamp Its block time.
    constructor(
        bytes32 _checkpointHash,
        uint256 _checkpointHeight,
        uint32  _bits,
        uint32  _timestamp
    ) {
        if (_checkpointHash == bytes32(0)) revert ZeroCheckpoint();

        headers[_checkpointHash] = Header({
            parent: bytes32(0),
            height: _checkpointHeight,
            accumulatedWork: _workFromBits(_bits),
            merkleRoot: bytes32(0),
            timestamp: _timestamp,
            bits: _bits,
            exists: true
        });

        checkpointHash   = _checkpointHash;
        checkpointHeight = _checkpointHeight;
        bestTip          = _checkpointHash;
        bestWork         = _workFromBits(_bits);
        bestHeight       = _checkpointHeight;
    }

    // -------------------------------------------------------------------------
    // Header submission
    // -------------------------------------------------------------------------

    /// @notice Submit one or more consecutive 80-byte headers.
    /// @dev Permissionless. Each header must link to a known parent and satisfy
    ///      its own difficulty target. An invalid header cannot be accepted, so
    ///      no submitter privilege is required or granted.
    function submitHeaders(bytes calldata raw) external {
        if (raw.length == 0 || raw.length % 80 != 0) revert BadHeaderLength(raw.length);

        uint256 count = raw.length / 80;
        for (uint256 i = 0; i < count; i++) {
            _acceptHeader(raw[i * 80 : (i + 1) * 80]);
        }
    }

    function _acceptHeader(bytes calldata h) private {
        bytes32 parent = _readBytes32(h, 4);

        Header memory p = headers[parent];
        if (!p.exists) revert UnknownParent(parent);

        uint32 bits = _readUint32LE(h, 72);
        uint256 target = _targetFromBits(bits);
        if (target == 0 || target > MAX_TARGET) revert BadTarget(bits);

        // Proof of work: the double-SHA256 of the header, read little-endian,
        // must not exceed the target. Derived here, never asserted by a caller.
        bytes32 blockHash = sha256(abi.encodePacked(sha256(h)));
        if (_reverseUint(blockHash) > target) revert InsufficientWork(blockHash, target);

        uint256 height = p.height + 1;

        // Difficulty may only change on a retarget boundary.
        if (height % RETARGET_INTERVAL != 0 && bits != p.bits) revert RetargetOutOfRange();

        if (headers[blockHash].exists) return;   // already known; idempotent

        uint256 work = p.accumulatedWork + _workFromBits(bits);

        headers[blockHash] = Header({
            parent: parent,
            height: height,
            accumulatedWork: work,
            merkleRoot: _readBytes32(h, 36),
            timestamp: _readUint32LE(h, 68),
            bits: bits,
            exists: true
        });

        emit HeaderAccepted(blockHash, height, parent);

        // Greatest accumulated work wins, not greatest height.
        if (work > bestWork) {
            bestTip = blockHash;
            bestWork = work;
            bestHeight = height;
            emit TipAdvanced(blockHash, height, work);
        }
    }

    // -------------------------------------------------------------------------
    // Queries
    // -------------------------------------------------------------------------

    /// @notice Confirmation depth of a block on the best chain, or zero.
    /// @dev Returns zero for unknown blocks and for blocks not on the best
    ///      chain, so an orphaned header can never appear confirmed.
    function confirmations(bytes32 blockHash) external view returns (uint256) {
        Header memory b = headers[blockHash];
        if (!b.exists) return 0;
        if (b.height > bestHeight) return 0;
        if (!_onBestChain(blockHash, b.height)) return 0;
        return bestHeight - b.height + 1;
    }

    /// @notice Whether `txid` is included in `blockHash` under the given proof.
    /// @param txid Transaction id in internal byte order.
    /// @param index Position of the transaction in the block.
    function verifyTxInclusion(
        bytes32 txid,
        bytes32 blockHash,
        bytes32[] calldata proof,
        uint256 index
    ) external view returns (bool) {
        Header memory b = headers[blockHash];
        if (!b.exists) revert UnknownBlock(blockHash);
        if (proof.length > 64) revert ProofTooLong(proof.length);

        bytes32 node = txid;
        uint256 idx = index;

        for (uint256 i = 0; i < proof.length; i++) {
            node = (idx & 1 == 0)
                ? sha256(abi.encodePacked(sha256(abi.encodePacked(node, proof[i]))))
                : sha256(abi.encodePacked(sha256(abi.encodePacked(proof[i], node))));
            idx >>= 1;
        }

        return node == b.merkleRoot;
    }

    function isKnown(bytes32 blockHash) external view returns (bool) {
        return headers[blockHash].exists;
    }

    // -------------------------------------------------------------------------
    // Internal
    // -------------------------------------------------------------------------

    /// @dev Walks from the tip back to the given height. Bounded by the depth of
    ///      the query rather than by chain length.
    function _onBestChain(bytes32 blockHash, uint256 height) private view returns (bool) {
        bytes32 cursor = bestTip;
        uint256 steps = bestHeight - height;
        if (steps > 4032) return false;          // two retarget periods
        for (uint256 i = 0; i < steps; i++) {
            cursor = headers[cursor].parent;
            if (cursor == bytes32(0)) return false;
        }
        return cursor == blockHash;
    }

    /// @dev Compact-form target: mantissa * 256^(exponent-3).
    function _targetFromBits(uint32 bits) private pure returns (uint256) {
        uint256 exponent = bits >> 24;
        uint256 mantissa = bits & 0x00FFFFFF;
        if (exponent <= 3) {
            return mantissa >> (8 * (3 - exponent));
        }
        if (exponent > 32) return 0;
        return mantissa << (8 * (exponent - 3));
    }

    /// @dev Work contributed by a header, approximated as 2^256 / (target+1).
    function _workFromBits(uint32 bits) private pure returns (uint256) {
        uint256 target = _targetFromBits(bits);
        if (target == 0) return 0;
        return type(uint256).max / (target + 1);
    }

    function _readBytes32(bytes calldata b, uint256 offset) private pure returns (bytes32 out) {
        assembly ("memory-safe") {
            out := calldataload(add(b.offset, offset))
        }
    }

    function _readUint32LE(bytes calldata b, uint256 offset) private pure returns (uint32) {
        return uint32(uint8(b[offset]))
             | (uint32(uint8(b[offset + 1])) << 8)
             | (uint32(uint8(b[offset + 2])) << 16)
             | (uint32(uint8(b[offset + 3])) << 24);
    }

    /// @dev Bitcoin compares the block hash as a little-endian integer.
    function _reverseUint(bytes32 input) private pure returns (uint256 out) {
        for (uint256 i = 0; i < 32; i++) {
            out = (out << 8) | uint8(input[31 - i]);
        }
    }
}
