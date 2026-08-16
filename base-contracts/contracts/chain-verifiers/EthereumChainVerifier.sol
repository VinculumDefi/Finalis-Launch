// =============================================================================
// EthereumChainVerifier — Ethereum L1 Verifier (Architecture C.1, Section O)
//
// STATUS: IMPLEMENTED. Both interface functions verify rather than decode.
//
// THE PROOF CHAIN
//   1. L1BlockRegistry holds Ethereum block hashes written by Base's own
//      derivation pipeline. The caller supplies an RLP header; the registry
//      accepts it only if it hashes to the recorded commitment, then returns
//      its receiptsRoot.
//   2. MerklePatriciaProof proves the receipt is committed to by that root.
//   3. EvmReceipt reads the vault's lock event out of the proven receipt.
//
//   Each stage narrows what the caller can influence. By the time a fact is
//   returned, it descends from a block hash Base itself recorded.
//
// C.1 CONFORMANCE
//   Mechanism: vault contract createLock(), atomic. Replay id: env + vault +
//   lock id. Finality: lock_block <= latest finalized block — enforced by the
//   registry only holding blocks Base's derivation pipeline has reported.
//
// TRUST ASSUMPTIONS (Verifier Completion Standard 3.7)
//   Inherited from L1BlockRegistry: the OP Stack L1Block predeploy, and Base's
//   derivation pipeline reporting the L1 origin honestly. If the latter were
//   false, Base's own state would be invalid. No relayer, attestor, oracle,
//   quorum, or administrator is trusted (VF-XCH-012, VF-XCH-017).
//
// SOURCE VAULT DEPENDENCY
//   The source vault address and lock-event signature are bound at deployment
//   and immutable. A caller cannot redirect extraction to another contract's
//   event. The Ethereum source vault contract itself is not in this repository;
//   C.1 marks the source mechanism RESOLVED as a design, and the same
//   createLock() pattern applies to all six remote EVM environments.
//
// SPDX-License-Identifier: PROTOCOL-RESTRICTED
// Solidity 0.8.19+
// =============================================================================

pragma solidity 0.8.19;

import "../interfaces/IChainVerifier.sol";
import "../libraries/MerklePatriciaProof.sol";
import "../libraries/EvmReceipt.sol";

interface IL1BlockRegistry {
    function receiptsRootOf(uint256 blockNumber, bytes calldata rlpHeader)
        external view returns (bytes32);
    function isRecorded(uint256 blockNumber) external view returns (bool);
    function blockTimestampOf(uint256 blockNumber) external view returns (uint64);
}

contract EthereumChainVerifier is IChainVerifier {

    using EvmReceipt for bytes;

    error ZeroAddress();
    error BlockNotRecorded(uint256 blockNumber);
    error ReceiptFailed(uint256 status);
    error MaturityBeforeCreation(uint256 maturity, uint256 creation);

    string public environmentId;
    IL1BlockRegistry public immutable registry;

    /// @notice The source vault whose event is recognized. Immutable.
    address public immutable sourceVault;
    /// @notice The lock event's topic0. Immutable.
    bytes32 public immutable lockEventTopic;

    constructor(
        string memory _environmentId,
        address _registry,
        address _sourceVault,
        bytes32 _lockEventTopic
    ) {
        if (_registry == address(0) || _sourceVault == address(0)) revert ZeroAddress();
        environmentId = _environmentId;
        registry = IL1BlockRegistry(_registry);
        sourceVault = _sourceVault;
        lockEventTopic = _lockEventTopic;
    }

    /// @dev The proof payload. `receiptKey` is the RLP-encoded transaction
    ///      index, which is the key into the receipts trie.
    struct Proof {
        uint256   blockNumber;
        bytes     rlpHeader;
        bytes     receiptKey;
        bytes[]   receiptProof;
        bytes     receiptRlp;
    }

    // -------------------------------------------------------------------------
    // Finality
    // -------------------------------------------------------------------------

    /// @notice Proves the lock transaction's receipt is committed to by a block
    ///         Base's derivation pipeline recorded.
    /// @dev C.1 finality: lock_block <= latest finalized block. The registry
    ///      only holds blocks the pipeline reported, so a block it does not know
    ///      cannot be presented as final.
    function verifyFinality(
        bytes calldata lockEventProof,
        bytes calldata /* sourceFinalityProof — the lock proof carries everything */
    ) external view override returns (
        bool finalized,
        bytes32 sourceBlockHash,
        uint256 sourceBlockHeight
    ) {
        Proof memory pr = _decode(lockEventProof);
        bytes memory receipt = _provenReceipt(pr);

        uint256 st = EvmReceipt.status(receipt);
        if (st != 1) revert ReceiptFailed(st);

        return (true, keccak256(pr.rlpHeader), pr.blockNumber);
    }

    // -------------------------------------------------------------------------
    // Fact extraction
    // -------------------------------------------------------------------------

    /// @notice Returns the lock's facts, read from the proven receipt's event.
    /// @dev Re-proves the receipt rather than assuming verifyFinality ran: this
    ///      function is externally callable and must stand alone.
    function extractFacts(
        bytes calldata lockEventProof
    ) external view override returns (
        bytes32 lockId,
        uint256 grossAmount,
        uint256 feeAmount,
        uint256 principalAmount,
        uint256 durationSecs,
        uint256 creationTimestamp,
        uint256 maturityTimestamp
    ) {
        Proof memory pr = _decode(lockEventProof);
        bytes memory receipt = _provenReceipt(pr);

        uint256 st = EvmReceipt.status(receipt);
        if (st != 1) revert ReceiptFailed(st);

        EvmReceipt.Log memory lg = EvmReceipt.findLog(receipt, sourceVault, lockEventTopic);

        // Event data layout, matching the vault's CommitVaultLock:
        //   0 grossAmount, 1 feeAmount, 2 principalAmount,
        //   3 durationSecs, 4 creationTime, 5 maturityTime
        grossAmount     = uint256(EvmReceipt.word(lg, 0));
        feeAmount       = uint256(EvmReceipt.word(lg, 1));
        principalAmount = uint256(EvmReceipt.word(lg, 2));
        durationSecs    = uint256(EvmReceipt.word(lg, 3));
        creationTimestamp = uint256(EvmReceipt.word(lg, 4));
        maturityTimestamp = uint256(EvmReceipt.word(lg, 5));

        if (maturityTimestamp <= creationTimestamp) {
            revert MaturityBeforeCreation(maturityTimestamp, creationTimestamp);
        }

        // C.1 replay id: env + vault + lock id. The vault's own lock id is the
        // event's first indexed topic.
        bytes32 vaultLockId = EvmReceipt.topic(lg, 1);
        lockId = keccak256(abi.encodePacked(environmentId, sourceVault, vaultLockId));
    }

    // -------------------------------------------------------------------------
    // Views
    // -------------------------------------------------------------------------

    /// @notice Whether the proof verifies, without reverting.
    function isFinal(bytes calldata lockEventProof) external view returns (bool) {
        Proof memory pr = _decode(lockEventProof);
        if (!registry.isRecorded(pr.blockNumber)) return false;

        bytes32 root;
        try registry.receiptsRootOf(pr.blockNumber, pr.rlpHeader) returns (bytes32 r) {
            root = r;
        } catch {
            return false;
        }

        try this.proveReceipt(root, pr.receiptKey, pr.receiptProof) returns (bytes memory v) {
            return keccak256(v) == keccak256(pr.receiptRlp);
        } catch {
            return false;
        }
    }

    /// @dev External so `isFinal` can wrap it in try/catch. Pure verification;
    ///      holds no state and grants no authority.
    function proveReceipt(
        bytes32 root,
        bytes memory key,
        bytes[] memory proof
    ) external pure returns (bytes memory) {
        return MerklePatriciaProof.verify(root, key, proof);
    }

    // -------------------------------------------------------------------------
    // Internal
    // -------------------------------------------------------------------------

    /// @dev Verifies the header against the registry, then the receipt against
    ///      the header's receiptsRoot, and returns the proven receipt bytes.
    function _provenReceipt(Proof memory pr) private view returns (bytes memory) {
        if (!registry.isRecorded(pr.blockNumber)) revert BlockNotRecorded(pr.blockNumber);

        bytes32 root = registry.receiptsRootOf(pr.blockNumber, pr.rlpHeader);
        bytes memory value = MerklePatriciaProof.verify(root, pr.receiptKey, pr.receiptProof);

        // The trie's committed value is the receipt. The caller's copy must
        // match it exactly, or the caller could hand us different bytes than
        // the ones proven.
        if (keccak256(value) != keccak256(pr.receiptRlp)) revert BlockNotRecorded(pr.blockNumber);

        return value;
    }

    function _decode(bytes calldata payload) private pure returns (Proof memory) {
        (
            uint256 blockNumber,
            bytes memory rlpHeader,
            bytes memory receiptKey,
            bytes[] memory receiptProof,
            bytes memory receiptRlp
        ) = abi.decode(payload, (uint256, bytes, bytes, bytes[], bytes));

        return Proof({
            blockNumber: blockNumber,
            rlpHeader: rlpHeader,
            receiptKey: receiptKey,
            receiptProof: receiptProof,
            receiptRlp: receiptRlp
        });
    }
}
