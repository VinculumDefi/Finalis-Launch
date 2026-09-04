// =============================================================================
// PolygonChainVerifier — Polygon PoS Verifier (Architecture C.4, Section O)
//
// STATUS: IMPLEMENTED, with external dependencies flagged below.
//
// THE PROOF CHAIN (C.4: "Bor block proof + Heimdall checkpoint proof anchored
// to Ethereum L1, authenticated by Base via Ethereum L1")
//
//   1. L1BlockRegistry authenticates an Ethereum L1 header against a block hash
//      Base's own derivation pipeline recorded.
//   2. A receipt proof against that header proves the Polygon checkpoint
//      contract emitted NewHeaderBlock. Its data carries the checkpoint's
//      block range and the Merkle root over that range.
//   3. The caller supplies a Bor block's leaf components. The contract
//      recomputes the leaf, checks the block number falls inside the
//      checkpointed range, and verifies the leaf's Merkle path to the posted
//      root. The leaf commits to the Bor block's receiptRoot, so no separate
//      L2 header step is needed.
//   4. A receipt proof against that receiptRoot proves the vault's lock event.
//
//   C.4 finality: lock_block < latest finalized Bor block. A block outside a
//   posted checkpoint cannot be proven at all, which is what enforces it.
//
// EXTERNAL DEPENDENCIES REQUIRING VERIFICATION (Standard 5)
//   The checkpoint leaf preimage —
//   keccak256(abi.encodePacked(blockNumber, time, txRoot, receiptRoot)) — and
//   the NewHeaderBlock event's data layout are Polygon protocol details, not
//   stated in the governing artifacts. Both MUST be verified against Polygon's
//   specification and a real checkpoint before deployment. computeLeaf is
//   public so that check is a single call.
//
// TRUST ASSUMPTIONS (Verifier Completion Standard 3.7)
//   Inherited from L1BlockRegistry: the OP Stack L1Block predeploy on Base and
//   Base's derivation pipeline. Additionally: that the configured L1 checkpoint
//   contract is the authentic Polygon one, bound immutably at deployment. No
//   relayer, attestor, or administrator is trusted (VF-XCH-012, VF-XCH-017).
//
// SPDX-License-Identifier: PROTOCOL-RESTRICTED
// Solidity 0.8.19+
// =============================================================================

pragma solidity 0.8.19;

import "../interfaces/IChainVerifier.sol";
import "../libraries/MerklePatriciaProof.sol";
import "../libraries/EvmReceipt.sol";

interface IL1RegistryReader {
    function receiptsRootOf(uint256 blockNumber, bytes calldata rlpHeader)
        external view returns (bytes32);
    function isRecorded(uint256 blockNumber) external view returns (bool);
}

contract PolygonChainVerifier is IChainVerifier {

    /// @dev CL-85. Topic0 of the vault's second log. `CommitVaultLockDetail`
    ///      carries the VF-XCH-011 identity fields; its comment in
    ///      VinculumFinalisEvmVault names that requirement as its purpose. The
    ///      vault emitted it from the start and no verifier opened it, because
    ///      findLog matches a single topic and every verifier passed the
    ///      CommitVaultLock topic. The identity was bound at the source and
    ///      discarded at the boundary.
    bytes32 internal constant DETAIL_TOPIC =
        keccak256("CommitVaultLockDetail(bytes32,string,address,bytes32,address,address,address,address,uint8,bytes32,uint32,address)");

    /// @dev Raised when the Detail log found does not belong to this lock.
    error IdentityLogMissing(bytes32 vaultLockId);

    error ZeroAddress();
    error L1BlockNotRecorded(uint256 blockNumber);
    error ProvenBytesMismatch();
    error ReceiptFailed(uint256 status);
    error BlockOutsideCheckpoint(uint256 blockNumber, uint256 start, uint256 end);
    error CheckpointProofFailed(bytes32 expectedRoot, bytes32 computedRoot);
    error MaturityBeforeCreation(uint256 maturity, uint256 creation);
    error ProofTooLong(uint256 length);

    string public environmentId;
    IL1RegistryReader public immutable registry;

    /// @notice The Polygon checkpoint contract on Ethereum L1. Immutable.
    address public immutable checkpointContract;
    /// @notice topic0 of NewHeaderBlock. Immutable.
    bytes32 public immutable newHeaderBlockTopic;
    /// @notice The Bor vault whose lock event is recognized. Immutable.
    address public immutable sourceVault;
    /// @notice topic0 of the lock event. Immutable.
    bytes32 public immutable lockEventTopic;

    constructor(
        string memory _environmentId,
        address _registry,
        address _checkpointContract,
        bytes32 _newHeaderBlockTopic,
        address _sourceVault,
        bytes32 _lockEventTopic
    ) {
        if (_registry == address(0) || _checkpointContract == address(0) ||
            _sourceVault == address(0)) revert ZeroAddress();

        environmentId = _environmentId;
        registry = IL1RegistryReader(_registry);
        checkpointContract = _checkpointContract;
        newHeaderBlockTopic = _newHeaderBlockTopic;
        sourceVault = _sourceVault;
        lockEventTopic = _lockEventTopic;
    }

    struct Proof {
        // L1: proves the checkpoint was posted.
        uint256   l1BlockNumber;
        bytes     l1RlpHeader;
        bytes     l1ReceiptKey;
        bytes[]   l1ReceiptProof;
        bytes     l1ReceiptRlp;

        // The Bor block's checkpoint leaf.
        uint256   borBlockNumber;
        uint256   borBlockTime;
        bytes32   borTxRoot;
        bytes32   borReceiptRoot;
        bytes32[] checkpointProof;

        // Bor: proves the lock event.
        bytes     borReceiptKey;
        bytes[]   borReceiptProof;
        bytes     borReceiptRlp;
    }

    // -------------------------------------------------------------------------
    // Finality
    // -------------------------------------------------------------------------

    function verifyFinality(
        bytes calldata lockEventProof,
        bytes calldata /* sourceFinalityProof */
    ) external view override returns (
        bool finalized,
        bytes32 sourceBlockHash,
        uint256 sourceBlockHeight
    ) {
        Proof memory pr = _decode(lockEventProof);
        bytes memory receipt = _provenBorReceipt(pr);

        uint256 st = EvmReceipt.status(receipt);
        if (st != 1) revert ReceiptFailed(st);

        // The leaf is the strongest identifier of the Bor block available here;
        // the checkpoint commits to it rather than to a block hash.
        return (true, computeLeaf(pr.borBlockNumber, pr.borBlockTime, pr.borTxRoot, pr.borReceiptRoot),
                pr.borBlockNumber);
    }

    // -------------------------------------------------------------------------
    // Fact extraction
    // -------------------------------------------------------------------------

    function extractFacts(
        bytes calldata lockEventProof
    ) external view override returns (
        bytes32 lockId,
        uint256 grossAmount,
        uint256 feeAmount,
        uint256 principalAmount,
        uint256 durationSecs,
        uint256 creationTimestamp,
        uint256 maturityTimestamp,
        bytes32 canonicalAssetId,
        address baseRecipient,
        address releaseDestination,
        uint8   outputToken
    ) {
        Proof memory pr = _decode(lockEventProof);
        bytes memory receipt = _provenBorReceipt(pr);

        uint256 st = EvmReceipt.status(receipt);
        if (st != 1) revert ReceiptFailed(st);

        EvmReceipt.Log memory lg =
            EvmReceipt.findLog(receipt, sourceVault, lockEventTopic);

        grossAmount       = uint256(EvmReceipt.word(lg, 0));
        feeAmount         = uint256(EvmReceipt.word(lg, 1));
        principalAmount   = uint256(EvmReceipt.word(lg, 2));
        durationSecs      = uint256(EvmReceipt.word(lg, 3));
        creationTimestamp = uint256(EvmReceipt.word(lg, 4));
        maturityTimestamp = uint256(EvmReceipt.word(lg, 5));

        if (maturityTimestamp <= creationTimestamp) {
            revert MaturityBeforeCreation(maturityTimestamp, creationTimestamp);
        }

        bytes32 vaultLockId = EvmReceipt.topic(lg, 1);

        // CL-85. Second findLog against the Detail topic, in the receipt this
        // function has already proven and decoded. Field positions come from
        // the vault's event: canonicalAssetId is indexed topic 3; the leading
        // dynamic `string sourceEnvironment` occupies data word 0 as an ABI
        // head offset, so the fixed-width entries after it are not displaced —
        // asset 1, lockContract 2, baseRecipient 3, releaseDestination 4,
        // outputToken 5.
        //
        // findLog reverts with NoMatchingLog when the Detail log is absent, so
        // a receipt binding no identity fails closed in the library. What
        // still needs checking is that the log found belongs to this lock.
        {
            EvmReceipt.Log memory dl = EvmReceipt.findLog(receipt, sourceVault, DETAIL_TOPIC);
            if (EvmReceipt.topic(dl, 1) != vaultLockId) {
                revert IdentityLogMissing(vaultLockId);
            }
            canonicalAssetId   = EvmReceipt.topic(dl, 3);
            baseRecipient      = address(uint160(uint256(EvmReceipt.word(dl, 3))));
            releaseDestination = address(uint160(uint256(EvmReceipt.word(dl, 4))));
            outputToken        = uint8(uint256(EvmReceipt.word(dl, 5)));
        }

        lockId = keccak256(abi.encodePacked(environmentId, sourceVault, vaultLockId));
    }

    // -------------------------------------------------------------------------
    // Checkpoint primitives — public so they can be checked against real data
    // -------------------------------------------------------------------------

    /// @notice The checkpoint tree's leaf for a Bor block.
    function computeLeaf(
        uint256 blockNumber,
        uint256 blockTime,
        bytes32 txRoot,
        bytes32 receiptRoot
    ) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(blockNumber, blockTime, txRoot, receiptRoot));
    }

    /// @notice Verify a leaf's Merkle path to a checkpoint root.
    /// @dev Sibling ordering follows the index bits, as Polygon's checkpoint
    ///      tree does.
    function verifyCheckpointPath(
        bytes32 leaf,
        uint256 index,
        bytes32[] memory proof
    ) public pure returns (bytes32 root) {
        if (proof.length > 64) revert ProofTooLong(proof.length);

        root = leaf;
        uint256 idx = index;
        for (uint256 i = 0; i < proof.length; i++) {
            root = (idx & 1 == 0)
                ? keccak256(abi.encodePacked(root, proof[i]))
                : keccak256(abi.encodePacked(proof[i], root));
            idx >>= 1;
        }
    }

    // -------------------------------------------------------------------------
    // Internal
    // -------------------------------------------------------------------------

    function _provenBorReceipt(Proof memory pr) private view returns (bytes memory) {
        // 1. L1 header authenticated by the registry.
        if (!registry.isRecorded(pr.l1BlockNumber)) {
            revert L1BlockNotRecorded(pr.l1BlockNumber);
        }
        bytes32 l1ReceiptsRoot = registry.receiptsRootOf(pr.l1BlockNumber, pr.l1RlpHeader);

        // 2. The checkpoint event, proven against that header.
        bytes memory l1Value =
            MerklePatriciaProof.verify(l1ReceiptsRoot, pr.l1ReceiptKey, pr.l1ReceiptProof);
        if (keccak256(l1Value) != keccak256(pr.l1ReceiptRlp)) revert ProvenBytesMismatch();

        uint256 l1Status = EvmReceipt.status(l1Value);
        if (l1Status != 1) revert ReceiptFailed(l1Status);

        EvmReceipt.Log memory ck =
            EvmReceipt.findLog(l1Value, checkpointContract, newHeaderBlockTopic);

        // NewHeaderBlock data: start, end, root.
        uint256 start = uint256(EvmReceipt.word(ck, 0));
        uint256 end   = uint256(EvmReceipt.word(ck, 1));
        bytes32 root  = EvmReceipt.word(ck, 2);

        // 3. The Bor block must fall inside the checkpointed range, and its leaf
        //    must prove to the posted root.
        if (pr.borBlockNumber < start || pr.borBlockNumber > end) {
            revert BlockOutsideCheckpoint(pr.borBlockNumber, start, end);
        }

        bytes32 leaf = computeLeaf(
            pr.borBlockNumber, pr.borBlockTime, pr.borTxRoot, pr.borReceiptRoot
        );
        bytes32 computed = verifyCheckpointPath(
            leaf, pr.borBlockNumber - start, pr.checkpointProof
        );
        if (computed != root) revert CheckpointProofFailed(root, computed);

        // 4. The lock receipt, proven against the leaf's receiptRoot.
        bytes memory borValue = MerklePatriciaProof.verify(
            pr.borReceiptRoot, pr.borReceiptKey, pr.borReceiptProof
        );
        if (keccak256(borValue) != keccak256(pr.borReceiptRlp)) revert ProvenBytesMismatch();

        return borValue;
    }

    function _decode(bytes calldata payload) private pure returns (Proof memory pr) {
        (
            uint256 l1BlockNumber,
            bytes memory l1RlpHeader,
            bytes memory l1ReceiptKey,
            bytes[] memory l1ReceiptProof,
            bytes memory l1ReceiptRlp,
            uint256[2] memory borNums,
            bytes32[2] memory borRoots,
            bytes32[] memory checkpointProof,
            bytes memory borReceiptKey,
            bytes[] memory borReceiptProof,
            bytes memory borReceiptRlp
        ) = abi.decode(payload, (
            uint256, bytes, bytes, bytes[], bytes,
            uint256[2], bytes32[2], bytes32[], bytes, bytes[], bytes
        ));

        pr.l1BlockNumber = l1BlockNumber;
        pr.l1RlpHeader = l1RlpHeader;
        pr.l1ReceiptKey = l1ReceiptKey;
        pr.l1ReceiptProof = l1ReceiptProof;
        pr.l1ReceiptRlp = l1ReceiptRlp;
        pr.borBlockNumber = borNums[0];
        pr.borBlockTime = borNums[1];
        pr.borTxRoot = borRoots[0];
        pr.borReceiptRoot = borRoots[1];
        pr.checkpointProof = checkpointProof;
        pr.borReceiptKey = borReceiptKey;
        pr.borReceiptProof = borReceiptProof;
        pr.borReceiptRlp = borReceiptRlp;
    }
}
