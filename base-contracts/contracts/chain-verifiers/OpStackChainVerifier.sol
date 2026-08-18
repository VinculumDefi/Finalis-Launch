// =============================================================================
// OpStackChainVerifier — OP Stack L2 Verifier (Architecture C.7, Section O)
//
// STATUS: **NOT COMPLETE — CL-83.** Do not deploy.
//
// CL-83: THIS VERIFIER TARGETS A CONTRACT OPTIMISM HAS REMOVED.
//   It reads an OutputProposed event from an L2OutputOracle. Optimism's
//   documentation states that contract "has been removed from the OP Stack
//   contracts" and that "output proposals are made through the
//   DisputeGameFactory instead".
//
//   The defect is deeper than the address. Under fault proofs an output root
//   is proposed by creating a dispute game; the claim is only trustworthy once
//   that game has RESOLVED, is of the portal's respected game type, and is not
//   blacklisted. This contract treats a single event as proof of finality,
//   which is true of the superseded design and false of the current one.
//
//   CONFIRMED CORRECT: the output-root preimage formula. The OP Stack
//   specification computes the root from the state root, block hash and
//   withdrawals storage root — the construction computeOutputRoot implements.
//   The formula is right; the source of the root is wrong.
//
//   The 13 tests in 19_opstack_verifier.test.cjs pass against the superseded
//   construction. They are not evidence about current OP Mainnet.
//
//   Remediation is a design change, not a patch: query DisputeGameFactory,
//   read the game's status and type, and confirm resolution before accepting
//   a root claim. Requires reading the fault-proof specification.
//
// STATUS (superseded description below, retained for context):
// IMPLEMENTED, with one external dependency flagged below.
//
// SERVES: Optimism, and any OP Stack L2 whose output roots are posted to
//   Ethereum L1 by an L2OutputOracle-style contract.
//
// THE PROOF CHAIN (C.7: "L2 proof → Optimism batch/output root on Ethereum L1
// → Ethereum-L1-finalized proof authenticated by Base")
//
//   1. L1BlockRegistry authenticates an Ethereum L1 header against a block hash
//      Base's own derivation pipeline recorded.
//   2. A receipt proof against that header's receiptsRoot proves the output
//      oracle emitted an OutputProposed event. The output root is its first
//      indexed topic.
//   3. The caller supplies the output root's four preimage components. The
//      contract recomputes the root and rejects any mismatch, yielding an
//      authenticated L2 block hash.
//   4. The L2 header is verified against that block hash, yielding the L2
//      receiptsRoot.
//   5. A receipt proof against the L2 receiptsRoot proves the vault's lock
//      event.
//
//   Each link narrows what the caller controls. By the last step every fact
//   descends from a block hash Base itself recorded.
//
// EXTERNAL DEPENDENCY REQUIRING VERIFICATION (Standard 5)
//   The output-root preimage formula — keccak256(abi.encode(version, stateRoot,
//   messagePasserStorageRoot, latestBlockhash)) — is an OP Stack protocol
//   detail, not stated in the governing artifacts. It MUST be verified against
//   Optimism's specification and against a real output root before deployment.
//   The same applies to the OutputProposed event signature. Tests here prove
//   the chain's logic; they cannot prove the formula matches mainnet.
//
// TRUST ASSUMPTIONS (Verifier Completion Standard 3.7)
//   Inherited from L1BlockRegistry: the OP Stack L1Block predeploy on Base and
//   Base's derivation pipeline. Additionally: that the configured L1 output
//   oracle is the authentic one for the source L2, bound immutably at
//   deployment. No relayer, attestor, or administrator is trusted
//   (VF-XCH-012, VF-XCH-017).
//
// SPDX-License-Identifier: PROTOCOL-RESTRICTED
// Solidity 0.8.19+
// =============================================================================

pragma solidity 0.8.19;

import "../interfaces/IChainVerifier.sol";
import "../libraries/MerklePatriciaProof.sol";
import "../libraries/EvmReceipt.sol";

interface IL1BlockRegistryReader {
    function receiptsRootOf(uint256 blockNumber, bytes calldata rlpHeader)
        external view returns (bytes32);
    function isRecorded(uint256 blockNumber) external view returns (bool);
}

contract OpStackChainVerifier is IChainVerifier {

    error ZeroAddress();
    error L1BlockNotRecorded(uint256 blockNumber);
    error ProvenBytesMismatch();
    error ReceiptFailed(uint256 status);
    error OutputRootMismatch(bytes32 expected, bytes32 computed);
    error L2HeaderMismatch(bytes32 expected, bytes32 computed);
    error MaturityBeforeCreation(uint256 maturity, uint256 creation);
    error L2HeaderTooShort();

    string public environmentId;
    IL1BlockRegistryReader public immutable registry;

    /// @notice The L1 contract that posts this L2's output roots. Immutable.
    address public immutable outputOracle;
    /// @notice topic0 of the OutputProposed event. Immutable.
    bytes32 public immutable outputProposedTopic;
    /// @notice The L2 vault whose lock event is recognized. Immutable.
    address public immutable sourceVault;
    /// @notice topic0 of the lock event. Immutable.
    bytes32 public immutable lockEventTopic;

    constructor(
        string memory _environmentId,
        address _registry,
        address _outputOracle,
        bytes32 _outputProposedTopic,
        address _sourceVault,
        bytes32 _lockEventTopic
    ) {
        if (_registry == address(0) || _outputOracle == address(0) || _sourceVault == address(0)) {
            revert ZeroAddress();
        }
        environmentId = _environmentId;
        registry = IL1BlockRegistryReader(_registry);
        outputOracle = _outputOracle;
        outputProposedTopic = _outputProposedTopic;
        sourceVault = _sourceVault;
        lockEventTopic = _lockEventTopic;
    }

    struct Proof {
        // L1: proves the output root was posted.
        uint256 l1BlockNumber;
        bytes   l1RlpHeader;
        bytes   l1ReceiptKey;
        bytes[] l1ReceiptProof;
        bytes   l1ReceiptRlp;

        // Output root preimage.
        bytes32 outputVersion;
        bytes32 l2StateRoot;
        bytes32 messagePasserStorageRoot;
        bytes32 l2BlockHash;

        // L2: proves the lock event.
        bytes   l2RlpHeader;
        bytes   l2ReceiptKey;
        bytes[] l2ReceiptProof;
        bytes   l2ReceiptRlp;
    }

    // -------------------------------------------------------------------------
    // Finality
    // -------------------------------------------------------------------------

    /// @notice Proves the L2 lock is anchored to an Ethereum-L1-finalized
    ///         output root, per C.7.
    function verifyFinality(
        bytes calldata lockEventProof,
        bytes calldata /* sourceFinalityProof */
    ) external view override returns (
        bool finalized,
        bytes32 sourceBlockHash,
        uint256 sourceBlockHeight
    ) {
        Proof memory pr = _decode(lockEventProof);
        bytes memory l2Receipt = _provenL2Receipt(pr);

        uint256 st = EvmReceipt.status(l2Receipt);
        if (st != 1) revert ReceiptFailed(st);

        return (true, pr.l2BlockHash, pr.l1BlockNumber);
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
        uint256 maturityTimestamp
    ) {
        Proof memory pr = _decode(lockEventProof);
        bytes memory l2Receipt = _provenL2Receipt(pr);

        uint256 st = EvmReceipt.status(l2Receipt);
        if (st != 1) revert ReceiptFailed(st);

        EvmReceipt.Log memory lg =
            EvmReceipt.findLog(l2Receipt, sourceVault, lockEventTopic);

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
        lockId = keccak256(abi.encodePacked(environmentId, sourceVault, vaultLockId));
    }

    /// @notice Recompute an output root from its components. Exposed so the
    ///         formula can be checked against a real one before deployment.
    function computeOutputRoot(
        bytes32 version,
        bytes32 stateRoot,
        bytes32 messagePasserStorageRoot,
        bytes32 blockHash
    ) public pure returns (bytes32) {
        return keccak256(abi.encode(version, stateRoot, messagePasserStorageRoot, blockHash));
    }

    // -------------------------------------------------------------------------
    // Internal
    // -------------------------------------------------------------------------

    /// @dev Walks the full chain and returns the proven L2 receipt.
    function _provenL2Receipt(Proof memory pr) private view returns (bytes memory) {
        // 1. L1 header authenticated by the registry.
        if (!registry.isRecorded(pr.l1BlockNumber)) {
            revert L1BlockNotRecorded(pr.l1BlockNumber);
        }
        bytes32 l1ReceiptsRoot = registry.receiptsRootOf(pr.l1BlockNumber, pr.l1RlpHeader);

        // 2. The oracle's OutputProposed event, proven against that header.
        bytes memory l1Value =
            MerklePatriciaProof.verify(l1ReceiptsRoot, pr.l1ReceiptKey, pr.l1ReceiptProof);
        if (keccak256(l1Value) != keccak256(pr.l1ReceiptRlp)) revert ProvenBytesMismatch();

        uint256 l1Status = EvmReceipt.status(l1Value);
        if (l1Status != 1) revert ReceiptFailed(l1Status);

        EvmReceipt.Log memory proposed =
            EvmReceipt.findLog(l1Value, outputOracle, outputProposedTopic);

        // OutputProposed's first indexed parameter is the output root.
        bytes32 postedRoot = EvmReceipt.topic(proposed, 1);

        // 3. The preimage must reproduce the posted root exactly.
        bytes32 computed = computeOutputRoot(
            pr.outputVersion, pr.l2StateRoot, pr.messagePasserStorageRoot, pr.l2BlockHash
        );
        if (computed != postedRoot) revert OutputRootMismatch(postedRoot, computed);

        // 4. The L2 header must hash to the authenticated L2 block hash.
        bytes32 actual = keccak256(pr.l2RlpHeader);
        if (actual != pr.l2BlockHash) revert L2HeaderMismatch(pr.l2BlockHash, actual);

        bytes32 l2ReceiptsRoot = _receiptsRootOf(pr.l2RlpHeader);

        // 5. The lock receipt, proven against the L2 header.
        bytes memory l2Value =
            MerklePatriciaProof.verify(l2ReceiptsRoot, pr.l2ReceiptKey, pr.l2ReceiptProof);
        if (keccak256(l2Value) != keccak256(pr.l2ReceiptRlp)) revert ProvenBytesMismatch();

        return l2Value;
    }

    /// @dev receiptsRoot is the sixth header field. parentHash and ommersHash
    ///      are 33 bytes encoded, beneficiary is a 20-byte address at 21 bytes,
    ///      then stateRoot and transactionsRoot at 33 each.
    function _receiptsRootOf(bytes memory rlpHeader) private pure returns (bytes32 root) {
        if (rlpHeader.length < 4) revert L2HeaderTooShort();

        uint256 p;
        uint8 prefix = uint8(rlpHeader[0]);
        if (prefix < 0xf8) {
            p = 1;
        } else {
            p = 1 + (prefix - 0xf7);
        }

        p += 33 * 2 + 21 + 33 * 2;
        if (p + 33 > rlpHeader.length) revert L2HeaderTooShort();
        if (uint8(rlpHeader[p]) != 0xa0) revert L2HeaderTooShort();
        p += 1;

        assembly ("memory-safe") {
            root := mload(add(add(rlpHeader, 0x20), p))
        }
    }

    function _decode(bytes calldata payload) private pure returns (Proof memory pr) {
        (
            uint256 l1BlockNumber,
            bytes memory l1RlpHeader,
            bytes memory l1ReceiptKey,
            bytes[] memory l1ReceiptProof,
            bytes memory l1ReceiptRlp,
            bytes32[4] memory rootParts,
            bytes memory l2RlpHeader,
            bytes memory l2ReceiptKey,
            bytes[] memory l2ReceiptProof,
            bytes memory l2ReceiptRlp
        ) = abi.decode(payload, (
            uint256, bytes, bytes, bytes[], bytes,
            bytes32[4], bytes, bytes, bytes[], bytes
        ));

        pr.l1BlockNumber = l1BlockNumber;
        pr.l1RlpHeader = l1RlpHeader;
        pr.l1ReceiptKey = l1ReceiptKey;
        pr.l1ReceiptProof = l1ReceiptProof;
        pr.l1ReceiptRlp = l1ReceiptRlp;
        pr.outputVersion = rootParts[0];
        pr.l2StateRoot = rootParts[1];
        pr.messagePasserStorageRoot = rootParts[2];
        pr.l2BlockHash = rootParts[3];
        pr.l2RlpHeader = l2RlpHeader;
        pr.l2ReceiptKey = l2ReceiptKey;
        pr.l2ReceiptProof = l2ReceiptProof;
        pr.l2ReceiptRlp = l2ReceiptRlp;
    }
}
