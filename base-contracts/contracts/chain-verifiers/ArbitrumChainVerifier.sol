// =============================================================================
// ArbitrumChainVerifier — Arbitrum Verifier (Architecture C.5, Section O)
//
// STATUS: IMPLEMENTED, with external dependencies flagged below.
//
// THE PROOF CHAIN (C.5: "L2 receipt/state proof → Arbitrum output root on
// Ethereum L1 → Ethereum-L1-finalized output-root proof authenticated by Base")
//
//   1. L1BlockRegistry authenticates an Ethereum L1 header against a block hash
//      Base's own derivation pipeline recorded.
//   2. A receipt proof against that header proves the Arbitrum rollup contract
//      confirmed an assertion. The confirmation event carries the L2 block hash
//      directly, so no output-root preimage step is required.
//   3. The L2 header is verified against that block hash, yielding the L2
//      receiptsRoot.
//   4. A receipt proof against the L2 receiptsRoot proves the vault's lock
//      event.
//
// ON THE CHALLENGE WINDOW
//   C.5 marks the exact assertion-challenge duration DESIGN DEFINED —
//   DEPLOYABILITY EVIDENCE REQUIRED. This implementation does not need it.
//   Arbitrum's rollup contract emits the confirmation event only after the
//   window has elapsed, so requiring that event means the window is enforced by
//   Arbitrum itself rather than measured by Base. The duration would only be
//   needed if Base computed elapsed time independently.
//
//   Recorded as an implementation observation. Whether the parameter is
//   therefore unnecessary is an architecture decision, not one made here.
//
// EXTERNAL DEPENDENCIES REQUIRING VERIFICATION (Standard 5)
//   The confirmation event's identity and data layout — block hash at data word
//   0, send root at word 1 — are Arbitrum protocol details, not stated in the
//   governing artifacts. The event topic is a constructor argument so the
//   deployed configuration names it explicitly, and it MUST be verified against
//   Arbitrum's specification and a real confirmation before deployment.
//
// TRUST ASSUMPTIONS (Verifier Completion Standard 3.7)
//   Inherited from L1BlockRegistry: the OP Stack L1Block predeploy on Base and
//   Base's derivation pipeline. Additionally: that the configured L1 rollup
//   contract is the authentic Arbitrum one, bound immutably at deployment. No
//   relayer, attestor, or administrator is trusted (VF-XCH-012, VF-XCH-017).
//
// SPDX-License-Identifier: PROTOCOL-RESTRICTED
// Solidity 0.8.19+
// =============================================================================

pragma solidity 0.8.19;

import "../interfaces/IChainVerifier.sol";
import "../libraries/MerklePatriciaProof.sol";
import "../libraries/EvmReceipt.sol";

interface IL1RegistryView {
    function receiptsRootOf(uint256 blockNumber, bytes calldata rlpHeader)
        external view returns (bytes32);
    function isRecorded(uint256 blockNumber) external view returns (bool);
}

contract ArbitrumChainVerifier is IChainVerifier {

    error ZeroAddress();
    error L1BlockNotRecorded(uint256 blockNumber);
    error ProvenBytesMismatch();
    error ReceiptFailed(uint256 status);
    error L2HeaderMismatch(bytes32 expected, bytes32 computed);
    error MaturityBeforeCreation(uint256 maturity, uint256 creation);
    error L2HeaderTooShort();

    string public environmentId;
    IL1RegistryView public immutable registry;

    /// @notice The Arbitrum rollup contract on Ethereum L1. Immutable.
    address public immutable rollupContract;
    /// @notice topic0 of the assertion-confirmation event. Immutable, and named
    ///         explicitly at deployment because Arbitrum has revised it.
    bytes32 public immutable assertionConfirmedTopic;
    /// @notice The L2 vault whose lock event is recognized. Immutable.
    address public immutable sourceVault;
    /// @notice topic0 of the lock event. Immutable.
    bytes32 public immutable lockEventTopic;

    constructor(
        string memory _environmentId,
        address _registry,
        address _rollupContract,
        bytes32 _assertionConfirmedTopic,
        address _sourceVault,
        bytes32 _lockEventTopic
    ) {
        if (_registry == address(0) || _rollupContract == address(0) ||
            _sourceVault == address(0)) revert ZeroAddress();

        environmentId = _environmentId;
        registry = IL1RegistryView(_registry);
        rollupContract = _rollupContract;
        assertionConfirmedTopic = _assertionConfirmedTopic;
        sourceVault = _sourceVault;
        lockEventTopic = _lockEventTopic;
    }

    struct Proof {
        uint256 l1BlockNumber;
        bytes   l1RlpHeader;
        bytes   l1ReceiptKey;
        bytes[] l1ReceiptProof;
        bytes   l1ReceiptRlp;

        bytes   l2RlpHeader;
        bytes   l2ReceiptKey;
        bytes[] l2ReceiptProof;
        bytes   l2ReceiptRlp;
    }

    // -------------------------------------------------------------------------
    // Finality
    // -------------------------------------------------------------------------

    /// @notice Proves the L2 lock sits in a block whose assertion Arbitrum has
    ///         confirmed on Ethereum L1.
    function verifyFinality(
        bytes calldata lockEventProof,
        bytes calldata /* sourceFinalityProof */
    ) external view override returns (
        bool finalized,
        bytes32 sourceBlockHash,
        uint256 sourceBlockHeight
    ) {
        Proof memory pr = _decode(lockEventProof);
        (bytes memory receipt, bytes32 l2BlockHash) = _provenL2Receipt(pr);

        uint256 st = EvmReceipt.status(receipt);
        if (st != 1) revert ReceiptFailed(st);

        return (true, l2BlockHash, pr.l1BlockNumber);
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
        (bytes memory receipt, ) = _provenL2Receipt(pr);

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
        lockId = keccak256(abi.encodePacked(environmentId, sourceVault, vaultLockId));
    }

    // -------------------------------------------------------------------------
    // Internal
    // -------------------------------------------------------------------------

    function _provenL2Receipt(Proof memory pr)
        private view returns (bytes memory, bytes32)
    {
        // 1. L1 header authenticated by the registry.
        if (!registry.isRecorded(pr.l1BlockNumber)) {
            revert L1BlockNotRecorded(pr.l1BlockNumber);
        }
        bytes32 l1ReceiptsRoot = registry.receiptsRootOf(pr.l1BlockNumber, pr.l1RlpHeader);

        // 2. The confirmed assertion, proven against that header.
        bytes memory l1Value =
            MerklePatriciaProof.verify(l1ReceiptsRoot, pr.l1ReceiptKey, pr.l1ReceiptProof);
        if (keccak256(l1Value) != keccak256(pr.l1ReceiptRlp)) revert ProvenBytesMismatch();

        uint256 l1Status = EvmReceipt.status(l1Value);
        if (l1Status != 1) revert ReceiptFailed(l1Status);

        EvmReceipt.Log memory confirmed =
            EvmReceipt.findLog(l1Value, rollupContract, assertionConfirmedTopic);

        // The confirmation carries the L2 block hash at data word 0.
        bytes32 l2BlockHash = EvmReceipt.word(confirmed, 0);

        // 3. The L2 header must hash to it.
        bytes32 actual = keccak256(pr.l2RlpHeader);
        if (actual != l2BlockHash) revert L2HeaderMismatch(l2BlockHash, actual);

        bytes32 l2ReceiptsRoot = _receiptsRootOf(pr.l2RlpHeader);

        // 4. The lock receipt, proven against the L2 header.
        bytes memory l2Value = MerklePatriciaProof.verify(
            l2ReceiptsRoot, pr.l2ReceiptKey, pr.l2ReceiptProof
        );
        if (keccak256(l2Value) != keccak256(pr.l2ReceiptRlp)) revert ProvenBytesMismatch();

        return (l2Value, l2BlockHash);
    }

    /// @dev receiptsRoot is the sixth header field: two 33-byte roots, a
    ///      21-byte address, then two more 33-byte roots.
    function _receiptsRootOf(bytes memory rlpHeader) private pure returns (bytes32 root) {
        if (rlpHeader.length < 4) revert L2HeaderTooShort();

        uint256 p;
        uint8 prefix = uint8(rlpHeader[0]);
        p = prefix < 0xf8 ? 1 : 1 + (prefix - 0xf7);

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
            bytes memory l2RlpHeader,
            bytes memory l2ReceiptKey,
            bytes[] memory l2ReceiptProof,
            bytes memory l2ReceiptRlp
        ) = abi.decode(payload, (
            uint256, bytes, bytes, bytes[], bytes,
            bytes, bytes, bytes[], bytes
        ));

        pr.l1BlockNumber = l1BlockNumber;
        pr.l1RlpHeader = l1RlpHeader;
        pr.l1ReceiptKey = l1ReceiptKey;
        pr.l1ReceiptProof = l1ReceiptProof;
        pr.l1ReceiptRlp = l1ReceiptRlp;
        pr.l2RlpHeader = l2RlpHeader;
        pr.l2ReceiptKey = l2ReceiptKey;
        pr.l2ReceiptProof = l2ReceiptProof;
        pr.l2ReceiptRlp = l2ReceiptRlp;
    }
}
