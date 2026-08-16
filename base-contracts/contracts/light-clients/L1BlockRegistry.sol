// =============================================================================
// L1BlockRegistry — authentic Ethereum L1 block hashes on Base
//
// Implements the Ethereum header-authentication approach named first in
// Architecture Section O: "Ethereum header auth on Base (L1Block predeploy vs
// light client vs L1-header oracle)".
//
// WHY THIS APPROACH
//   Base is an OP Stack chain. The L1Block predeploy at
//   0x4200000000000000000000000000000000000015 is written by the derivation
//   pipeline that defines Base's own state — not by any transaction, relayer,
//   or operator. Reading it introduces NO NEW TRUST PARTY: it is the same L1
//   dependency Base's security already rests on.
//
//   The alternatives were excluded by the governing artifacts rather than by
//   preference. An L1-header oracle is a publisher with discretionary authority
//   over what Base believes, which Section O forbids ("a relayer signature is
//   never treated as proof") and VF-XCH-017 prohibits. A consensus light client
//   requires BLS12-381 verification over the sync committee, for which Base
//   provides no precompile.
//
// HOW IT WORKS
//   L1Block exposes only the CURRENT L1 origin, not history. This contract
//   snapshots it: anyone may call record(), which reads the predeploy and
//   stores (number, hash). Over time an authentic store of L1 block hashes
//   accumulates. The caller chooses when to record; the caller cannot choose
//   what is recorded.
//
// TRUST ASSUMPTIONS (Verifier Completion Standard 3.7)
//   1. The L1Block predeploy address and its semantics are those of the OP
//      Stack. Fixed at deployment, immutable.
//   2. Base's derivation pipeline reports the L1 origin honestly. If it did
//      not, Base's own state would be invalid; this adds nothing.
//   No relayer, attestor, quorum, or administrator is trusted, and none can
//   influence what is stored.
//
// COMPLETION GAP (Standard 5)
//   The L1Block predeploy does not exist on a local development chain. Tests
//   here prove the recording and lookup logic against a mock. Integration with
//   the real predeploy REQUIRES deployment evidence from Base. This is stated
//   rather than discovered later.
//
// SPDX-License-Identifier: PROTOCOL-RESTRICTED
// Solidity 0.8.19+
// =============================================================================

pragma solidity 0.8.19;

interface IL1Block {
    /// @notice The latest L1 block number known to this L2 block.
    function number() external view returns (uint64);
    /// @notice The block hash of that L1 block.
    function hash() external view returns (bytes32);
    /// @notice The timestamp of that L1 block.
    function timestamp() external view returns (uint64);
}

contract L1BlockRegistry {

    error ZeroAddress();
    error NothingToRecord();
    error UnknownL1Block(uint256 blockNumber);
    error HeaderHashMismatch(bytes32 expected, bytes32 actual);
    error HeaderTooShort();

    /// @notice The canonical OP Stack L1Block predeploy.
    address public constant OP_STACK_L1_BLOCK =
        0x4200000000000000000000000000000000000015;

    IL1Block public immutable l1Block;

    /// @notice L1 block number to block hash, as reported by the predeploy.
    mapping(uint256 => bytes32) public blockHashOf;
    /// @notice L1 block number to the timestamp reported alongside it.
    mapping(uint256 => uint64) public blockTimestampOf;

    uint256 public highestRecorded;

    event L1BlockRecorded(uint256 indexed blockNumber, bytes32 blockHash, uint64 timestamp);

    /// @param _l1Block The predeploy address. Pass OP_STACK_L1_BLOCK in
    ///        production; a mock is used in local tests, where the predeploy
    ///        does not exist.
    constructor(address _l1Block) {
        if (_l1Block == address(0)) revert ZeroAddress();
        l1Block = IL1Block(_l1Block);
    }

    // -------------------------------------------------------------------------
    // Recording
    // -------------------------------------------------------------------------

    /// @notice Snapshot the current L1 origin.
    /// @dev Permissionless. The caller chooses when this runs; the caller
    ///      cannot choose what it records, because every value is read from the
    ///      predeploy rather than supplied.
    function record() external returns (uint256 blockNumber, bytes32 blockHash) {
        blockNumber = uint256(l1Block.number());
        blockHash = l1Block.hash();

        if (blockNumber == 0 || blockHash == bytes32(0)) revert NothingToRecord();

        // Already stored: no-op rather than revert, so a batch of callers
        // racing on the same L1 origin does not produce spurious failures.
        if (blockHashOf[blockNumber] == blockHash) {
            return (blockNumber, blockHash);
        }

        blockHashOf[blockNumber] = blockHash;
        blockTimestampOf[blockNumber] = l1Block.timestamp();

        if (blockNumber > highestRecorded) highestRecorded = blockNumber;

        emit L1BlockRecorded(blockNumber, blockHash, l1Block.timestamp());
    }

    // -------------------------------------------------------------------------
    // Header verification
    // -------------------------------------------------------------------------

    /// @notice Verify an RLP-encoded Ethereum header against a recorded hash and
    ///         return its receiptsRoot.
    /// @dev The caller supplies the header; the chain supplies the commitment it
    ///      must match. A header that does not hash to the recorded value is
    ///      rejected, so no field of it can be fabricated.
    /// @param blockNumber The L1 block number the header claims to be.
    /// @param rlpHeader The full RLP-encoded block header.
    function receiptsRootOf(uint256 blockNumber, bytes calldata rlpHeader)
        external view returns (bytes32 receiptsRoot)
    {
        bytes32 known = blockHashOf[blockNumber];
        if (known == bytes32(0)) revert UnknownL1Block(blockNumber);

        bytes32 actual = keccak256(rlpHeader);
        if (actual != known) revert HeaderHashMismatch(known, actual);

        return _receiptsRoot(rlpHeader);
    }

    /// @notice Whether an L1 block hash has been recorded.
    function isRecorded(uint256 blockNumber) external view returns (bool) {
        return blockHashOf[blockNumber] != bytes32(0);
    }

    // -------------------------------------------------------------------------
    // Header field extraction
    // -------------------------------------------------------------------------

    /// @dev The Ethereum block header is an RLP list whose fourth element is
    ///      receiptsRoot: parentHash, ommersHash, beneficiary, stateRoot,
    ///      transactionsRoot, receiptsRoot, ... Each of the first six is a
    ///      32-byte string, RLP-encoded with the 0xa0 prefix.
    function _receiptsRoot(bytes calldata rlpHeader) private pure returns (bytes32 root) {
        if (rlpHeader.length < 4) revert HeaderTooShort();

        uint256 p = 0;
        uint8 prefix = uint8(rlpHeader[0]);

        // Skip the outer list header.
        if (prefix < 0xf8) {
            p = 1;
        } else {
            uint256 lenOfLen = prefix - 0xf7;
            p = 1 + lenOfLen;
        }

        // Five 32-byte fields precede receiptsRoot; each occupies 33 bytes.
        p += 33 * 2 + 21 + 33 * 2;
        if (p + 33 > rlpHeader.length) revert HeaderTooShort();

        if (uint8(rlpHeader[p]) != 0xa0) revert HeaderTooShort();
        p += 1;

        assembly ("memory-safe") {
            root := calldataload(add(rlpHeader.offset, p))
        }
    }
}
