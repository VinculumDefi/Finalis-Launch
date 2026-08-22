// =============================================================================
// OpStackFaultProofVerifier — OP Stack L2 Verifier, fault-proof era (C.7)
//
// SUPERSEDES OpStackChainVerifier, which read an OutputProposed event from an
// L2OutputOracle. Optimism removed that contract; output proposals are made
// through the DisputeGameFactory instead (CL-83).
//
// WHY THE REDESIGN IS NOT A RE-POINT
//   Under fault proofs an output root is a `rootClaim` on a dispute game. The
//   claim exists from the moment the game is created and means nothing until
//   the game RESOLVES. A verifier that accepts a creation event accepts an
//   unproven assertion — the CL-76 failure in a new costume.
//
// THE PROOF CHAIN
//   1. L1BlockRegistry authenticates an Ethereum L1 header against a block hash
//      Base's own derivation pipeline recorded.
//   2. A receipt proof against that header proves the DisputeGameFactory
//      emitted DisputeGameCreated. Its three indexed topics carry the game
//      proxy address, the game type, and the claimed output root.
//   3. The game type must equal the respected type bound at deployment. A game
//      of an unrespected type proves nothing about this chain.
//   4. A second receipt proof, against a second authenticated L1 header, proves
//      that same game proxy emitted Resolved with status DEFENDER_WINS.
//   5. The airgap must have elapsed: the L1 chain must have advanced at least
//      `gameFinalityDelaySeconds` beyond the block that resolved the game.
//   6. The caller's output-root preimage must recompute the rootClaim exactly,
//      yielding an authenticated L2 block hash.
//   7. The L2 header must hash to it, yielding the L2 receiptsRoot.
//   8. A receipt proof against that root proves the vault's lock event.
//
// TRUST ASSUMPTIONS (Verifier Completion Standard 3.7)
//   Inherited from L1BlockRegistry: the OP Stack L1Block predeploy on Base and
//   Base's derivation pipeline. Additionally:
//
//   - The configured DisputeGameFactory is the authentic one for the source L2.
//     Bound immutably at deployment.
//   - The configured respected game type matches the portal's. If the portal's
//     respected type changes, this contract must be redeployed — it cannot
//     read portal state across chains.
//   - **A blacklisted game cannot be detected.** The portal may blacklist a
//     resolved game. Blacklisting is portal state, and a receipt proof cannot
//     demonstrate the ABSENCE of an event. A game that resolved DEFENDER_WINS
//     and was subsequently blacklisted would still verify here. This is a
//     stated limitation, not an oversight; closing it requires proving L1
//     storage, which this contract does not do.
//
//   No relayer, attestor, or administrator is trusted (VF-XCH-012, VF-XCH-017).
//
// EXTERNAL DEPENDENCIES REQUIRING VERIFICATION (Standard 5)
//   Event signatures and the output-root preimage formula are OP Stack protocol
//   details, not stated in the governing artifacts. Both topics are constructor
//   arguments so the deployment records which were relied upon, and
//   computeOutputRoot is public so the formula can be checked against a real
//   root. Verification against mainnet is REQUIRED before deployment.
//
// SPDX-License-Identifier: PROTOCOL-RESTRICTED
// Solidity 0.8.19+
// =============================================================================

pragma solidity 0.8.19;

import "../interfaces/IChainVerifier.sol";
import "../libraries/MerklePatriciaProof.sol";
import "../libraries/EvmReceipt.sol";

interface IL1RegistryTimed {
    function receiptsRootOf(uint256 blockNumber, bytes calldata rlpHeader)
        external view returns (bytes32);
    function isRecorded(uint256 blockNumber) external view returns (bool);
    function blockTimestampOf(uint256 blockNumber) external view returns (uint64);
    function highestRecorded() external view returns (uint256);
}

contract OpStackFaultProofVerifier is IChainVerifier {

    error ZeroAddress();
    error L1BlockNotRecorded(uint256 blockNumber);
    error ProvenBytesMismatch();
    error ReceiptFailed(uint256 status);
    error UnrespectedGameType(uint32 got, uint32 expected);
    error GameNotResolvedInFavour(uint256 status);
    error AirgapNotElapsed(uint64 resolvedAt, uint64 latest, uint64 required);
    error OutputRootMismatch(bytes32 claimed, bytes32 computed);
    error L2HeaderMismatch(bytes32 expected, bytes32 computed);
    error MaturityBeforeCreation(uint256 maturity, uint256 creation);
    error L2HeaderTooShort();

    /// @notice GameStatus.DEFENDER_WINS. IN_PROGRESS is 0, CHALLENGER_WINS 1.
    uint256 internal constant DEFENDER_WINS = 2;

    string public environmentId;
    IL1RegistryTimed public immutable registry;

    /// @notice The DisputeGameFactory on Ethereum L1. Immutable.
    address public immutable disputeGameFactory;
    /// @notice topic0 of DisputeGameCreated. Immutable.
    bytes32 public immutable gameCreatedTopic;
    /// @notice topic0 of the game's Resolved event. Immutable.
    bytes32 public immutable gameResolvedTopic;
    /// @notice The portal's respected game type at deployment. Immutable.
    uint32 public immutable respectedGameType;
    /// @notice Seconds that must elapse on L1 after resolution. Immutable.
    uint64 public immutable gameFinalityDelaySeconds;

    /// @notice The L2 vault whose lock event is recognized. Immutable.
    address public immutable sourceVault;
    /// @notice topic0 of the lock event. Immutable.
    bytes32 public immutable lockEventTopic;

    struct Config {
        string  environmentId;
        address registry;
        address disputeGameFactory;
        bytes32 gameCreatedTopic;
        bytes32 gameResolvedTopic;
        uint32  respectedGameType;
        uint64  gameFinalityDelaySeconds;
        address sourceVault;
        bytes32 lockEventTopic;
    }

    constructor(Config memory c) {
        if (c.registry == address(0) || c.disputeGameFactory == address(0) ||
            c.sourceVault == address(0)) revert ZeroAddress();

        environmentId            = c.environmentId;
        registry                 = IL1RegistryTimed(c.registry);
        disputeGameFactory       = c.disputeGameFactory;
        gameCreatedTopic         = c.gameCreatedTopic;
        gameResolvedTopic        = c.gameResolvedTopic;
        respectedGameType        = c.respectedGameType;
        gameFinalityDelaySeconds = c.gameFinalityDelaySeconds;
        sourceVault              = c.sourceVault;
        lockEventTopic           = c.lockEventTopic;
    }

    struct Proof {
        // L1 block proving the game was created.
        uint256 createdBlockNumber;
        bytes   createdHeader;
        bytes   createdKey;
        bytes[] createdProof;
        bytes   createdReceipt;

        // L1 block proving that game resolved.
        uint256 resolvedBlockNumber;
        bytes   resolvedHeader;
        bytes   resolvedKey;
        bytes[] resolvedProof;
        bytes   resolvedReceipt;

        // Output-root preimage.
        bytes32 outputVersion;
        bytes32 l2StateRoot;
        bytes32 messagePasserStorageRoot;
        bytes32 l2BlockHash;

        // L2 lock receipt.
        bytes   l2Header;
        bytes   l2Key;
        bytes[] l2Proof;
        bytes   l2Receipt;
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
        bytes memory l2Receipt = _provenL2Receipt(pr);

        uint256 st = EvmReceipt.status(l2Receipt);
        if (st != 1) revert ReceiptFailed(st);

        return (true, pr.l2BlockHash, pr.resolvedBlockNumber);
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

    /// @notice Recompute an output root from its components. Public so the
    ///         formula can be checked against a real rootClaim.
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

    /// @dev Steps 1-4: prove the game was created and resolved in our favour.
    /// @return gameProxy the dispute game's address
    /// @return rootClaim the output root it claimed
    function _provenResolvedGame(Proof memory pr)
        private view returns (address gameProxy, bytes32 rootClaim)
    {
        // 1-2. The creation event.
        bytes memory createdValue = _provenReceipt(
            pr.createdBlockNumber, pr.createdHeader, pr.createdKey,
            pr.createdProof, pr.createdReceipt
        );

        EvmReceipt.Log memory created =
            EvmReceipt.findLog(createdValue, disputeGameFactory, gameCreatedTopic);

        gameProxy = address(uint160(uint256(EvmReceipt.topic(created, 1))));
        uint32 gameType = uint32(uint256(EvmReceipt.topic(created, 2)));
        rootClaim = EvmReceipt.topic(created, 3);

        // 3. Only the respected game type says anything about this chain.
        if (gameType != respectedGameType) {
            revert UnrespectedGameType(gameType, respectedGameType);
        }

        // 4. That same game must have resolved in the defender's favour.
        bytes memory resolvedValue = _provenReceipt(
            pr.resolvedBlockNumber, pr.resolvedHeader, pr.resolvedKey,
            pr.resolvedProof, pr.resolvedReceipt
        );

        EvmReceipt.Log memory resolved =
            EvmReceipt.findLog(resolvedValue, gameProxy, gameResolvedTopic);

        uint256 gameStatus = uint256(EvmReceipt.topic(resolved, 1));
        if (gameStatus != DEFENDER_WINS) revert GameNotResolvedInFavour(gameStatus);

        // 5. The airgap must have elapsed on L1 since resolution.
        uint64 resolvedAt = registry.blockTimestampOf(pr.resolvedBlockNumber);
        uint64 latest = registry.blockTimestampOf(registry.highestRecorded());
        if (latest < resolvedAt + gameFinalityDelaySeconds) {
            revert AirgapNotElapsed(resolvedAt, latest, gameFinalityDelaySeconds);
        }
    }

    /// @dev Steps 6-8: bind the L2 block to the root claim and prove the lock.
    function _provenL2Receipt(Proof memory pr) private view returns (bytes memory) {
        (, bytes32 rootClaim) = _provenResolvedGame(pr);

        bytes32 computed = computeOutputRoot(
            pr.outputVersion, pr.l2StateRoot, pr.messagePasserStorageRoot, pr.l2BlockHash
        );
        if (computed != rootClaim) revert OutputRootMismatch(rootClaim, computed);

        bytes32 actual = keccak256(pr.l2Header);
        if (actual != pr.l2BlockHash) revert L2HeaderMismatch(pr.l2BlockHash, actual);

        bytes32 l2ReceiptsRoot = _receiptsRootOf(pr.l2Header);

        bytes memory l2Value = MerklePatriciaProof.verify(
            l2ReceiptsRoot, pr.l2Key, pr.l2Proof
        );
        if (keccak256(l2Value) != keccak256(pr.l2Receipt)) revert ProvenBytesMismatch();

        return l2Value;
    }

    /// @dev Authenticate an L1 header, prove a receipt against it, and confirm
    ///      the caller's copy is the proven one.
    function _provenReceipt(
        uint256 blockNumber,
        bytes memory header,
        bytes memory key,
        bytes[] memory proof,
        bytes memory receiptRlp
    ) private view returns (bytes memory) {
        if (!registry.isRecorded(blockNumber)) revert L1BlockNotRecorded(blockNumber);

        bytes32 root = registry.receiptsRootOf(blockNumber, header);
        bytes memory value = MerklePatriciaProof.verify(root, key, proof);
        if (keccak256(value) != keccak256(receiptRlp)) revert ProvenBytesMismatch();

        uint256 st = EvmReceipt.status(value);
        if (st != 1) revert ReceiptFailed(st);

        return value;
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
            uint256[2] memory blockNumbers,
            bytes[3] memory headers,          // created, resolved, l2
            bytes[3] memory keys,
            bytes[][3] memory proofs,
            bytes[3] memory receipts,
            bytes32[4] memory rootParts
        ) = abi.decode(payload, (
            uint256[2], bytes[3], bytes[3], bytes[][3], bytes[3], bytes32[4]
        ));

        pr.createdBlockNumber  = blockNumbers[0];
        pr.resolvedBlockNumber = blockNumbers[1];

        pr.createdHeader  = headers[0];
        pr.resolvedHeader = headers[1];
        pr.l2Header       = headers[2];

        pr.createdKey  = keys[0];
        pr.resolvedKey = keys[1];
        pr.l2Key       = keys[2];

        pr.createdProof  = proofs[0];
        pr.resolvedProof = proofs[1];
        pr.l2Proof       = proofs[2];

        pr.createdReceipt  = receipts[0];
        pr.resolvedReceipt = receipts[1];
        pr.l2Receipt       = receipts[2];

        pr.outputVersion            = rootParts[0];
        pr.l2StateRoot              = rootParts[1];
        pr.messagePasserStorageRoot = rootParts[2];
        pr.l2BlockHash              = rootParts[3];
    }
}
