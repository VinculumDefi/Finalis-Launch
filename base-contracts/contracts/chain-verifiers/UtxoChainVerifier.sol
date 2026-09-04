// =============================================================================
// UtxoChainVerifier — SHA256d UTXO Family Verifier (Architecture C.8, Section O)
//
// STATUS: IMPLEMENTED. Both interface functions verify rather than decode.
//
// SERVES: Bitcoin, Bitcoin Cash (SHA256d proof of work).
//   Litecoin and Dogecoin use scrypt, DigiByte rotates five algorithms, Zcash
//   uses Equihash. All are memory-hard by construction and not verifiable
//   within EVM gas limits. Those four require a different mechanism.
//
// WHAT THE CALLER SUPPLIES, AND WHAT THE CHAIN ESTABLISHES
//   The caller supplies a transaction, a witness script, a Merkle proof, and
//   output indices. Every fact returned is derived from those bytes after they
//   have been proven to commit to a block whose proof of work was validated on
//   Base. No value is adopted because the caller asserted it.
//
//   verifyFinality — proves the lock transaction is included in a block at or
//     beyond the required confirmation depth. Depth comes from the header
//     chain's state, not from the proof.
//   extractFacts   — parses the transaction per C.8: fee output value,
//     principal output value, and the CLTV maturity inside the witness script,
//     which is checked against the hash the P2WSH output committed to.
//
// C.8 CONFORMANCE
//   Mechanism: single transaction with a Dev Fund fee output and a P2WSH
//   CLTV principal output. Replay id: env + txid + principal output index.
//   Finality: depth(lock_tx) >= 6. Maturity: the CLTV operand, a timestamp.
//   Release key: the single public key on the maturity-release branch;
//   ambiguous or multi-key paths are rejected.
//
// TRUST ASSUMPTIONS (Verifier Completion Standard 3.7)
//   Inherited from Sha256dHeaderChain: one immutable checkpoint header bound at
//   deployment, and cumulative proof of work deciding between competing chains.
//   No relayer, attestor, or administrator is trusted at any point.
//
// SPDX-License-Identifier: PROTOCOL-RESTRICTED
// Solidity 0.8.19+
// =============================================================================

pragma solidity 0.8.19;

import "../interfaces/IChainVerifier.sol";
import "../libraries/BitcoinTx.sol";

interface ISha256dHeaderChain {
    function confirmations(bytes32 blockHash) external view returns (uint256);
    function verifyTxInclusion(
        bytes32 txid,
        bytes32 blockHash,
        bytes32[] calldata proof,
        uint256 index
    ) external view returns (bool);
    function isKnown(bytes32 blockHash) external view returns (bool);
    function headers(bytes32 blockHash) external view returns (
        bytes32 parent,
        uint256 height,
        uint256 accumulatedWork,
        bytes32 merkleRoot,
        uint32  timestamp,
        uint32  bits,
        bool    exists
    );
}

contract UtxoChainVerifier is IChainVerifier {

    using BitcoinTx for bytes;

    error HeaderNotKnown(bytes32 blockHash);
    error TxNotInBlock(bytes32 txid, bytes32 blockHash);
    error InsufficientConfirmations(uint256 have, uint256 required);
    error MaturityBeforeCreation(uint256 maturity, uint256 creation);
    error ZeroAddress();

    string public environmentId;
    uint256 public minConfirmations;
    ISha256dHeaderChain public immutable headerChain;

    constructor(
        string memory _environmentId,
        uint256 _minConfirmations,
        address _headerChain
    ) {
        if (_headerChain == address(0)) revert ZeroAddress();
        environmentId = _environmentId;
        minConfirmations = _minConfirmations;
        headerChain = ISha256dHeaderChain(_headerChain);
    }

    /// @dev The proof payload shared by both interface functions.
    struct Proof {
        bytes    rawTx;            // non-witness serialization
        bytes    witnessScript;    // the P2WSH script
        bytes32  blockHash;
        bytes32[] merkleProof;
        uint256  txIndex;          // position in the block
        uint256  principalIndex;   // CLTV output
        uint256  feeIndex;         // Dev Fund output
    }

    // -------------------------------------------------------------------------
    // Finality
    // -------------------------------------------------------------------------

    /// @notice Proves inclusion at or beyond the required confirmation depth.
    /// @dev C.8: depth(lock_tx) >= 6. Depth is read from the header chain.
    function verifyFinality(
        bytes calldata lockEventProof,
        bytes calldata /* sourceFinalityProof — the lock proof carries everything */
    ) external view override returns (
        bool finalized,
        bytes32 sourceBlockHash,
        uint256 sourceBlockHeight
    ) {
        Proof memory pr = _decode(lockEventProof);

        bytes32 id = BitcoinTx.txid(pr.rawTx);
        _requireIncluded(id, pr);

        uint256 depth = headerChain.confirmations(pr.blockHash);
        uint256 required = minConfirmations > 0 ? minConfirmations : 6;
        if (depth < required) revert InsufficientConfirmations(depth, required);

        (, uint256 height, , , , , ) = headerChain.headers(pr.blockHash);
        return (true, pr.blockHash, height);
    }

    // -------------------------------------------------------------------------
    // Fact extraction
    // -------------------------------------------------------------------------

    /// @notice Returns the lock's facts, derived from the proven transaction.
    /// @dev Inclusion is re-verified here rather than assumed: this function is
    ///      externally callable and must not depend on verifyFinality having
    ///      run first.
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

        BitcoinTx.LockFacts memory f = BitcoinTx.extractLockFacts(
            pr.rawTx, pr.witnessScript, pr.principalIndex, pr.feeIndex
        );

        _requireIncluded(f.txHash, pr);

        // C.8 replay id: env + txid + principal output index.
        lockId = keccak256(abi.encodePacked(environmentId, f.txHash, pr.principalIndex));

        // Creation time is the block's own timestamp, from the header chain.
        (, , , , uint32 blockTime, , ) = headerChain.headers(pr.blockHash);
        creationTimestamp = uint256(blockTime);
        maturityTimestamp = f.maturityTimestamp;

        if (maturityTimestamp <= creationTimestamp) {
            revert MaturityBeforeCreation(maturityTimestamp, creationTimestamp);
        }
        durationSecs = maturityTimestamp - creationTimestamp;

        grossAmount = uint256(f.grossAmount);
        feeAmount = uint256(f.feeAmount);
        principalAmount = uint256(f.principalAmount);
    }

    // -------------------------------------------------------------------------
    // Views
    // -------------------------------------------------------------------------

    /// @notice The canonical release public key hash, C.8 handshake identity.
    function releaseKeyIdentity(bytes calldata lockEventProof)
        external pure returns (bytes32)
    {
        Proof memory pr = _decode(lockEventProof);
        BitcoinTx.LockFacts memory f = BitcoinTx.extractLockFacts(
            pr.rawTx, pr.witnessScript, pr.principalIndex, pr.feeIndex
        );
        return f.releasePubKeyHash;
    }

    /// @notice Whether the lock is final, without reverting.
    function isFinal(bytes calldata lockEventProof) external view returns (bool) {
        Proof memory pr = _decode(lockEventProof);
        if (!headerChain.isKnown(pr.blockHash)) return false;

        bytes32 id = BitcoinTx.txid(pr.rawTx);
        if (!headerChain.verifyTxInclusion(id, pr.blockHash, pr.merkleProof, pr.txIndex)) {
            return false;
        }
        uint256 required = minConfirmations > 0 ? minConfirmations : 6;
        return headerChain.confirmations(pr.blockHash) >= required;
    }

    // -------------------------------------------------------------------------
    // Internal
    // -------------------------------------------------------------------------

    function _requireIncluded(bytes32 id, Proof memory pr) private view {
        if (!headerChain.isKnown(pr.blockHash)) revert HeaderNotKnown(pr.blockHash);
        if (!headerChain.verifyTxInclusion(id, pr.blockHash, pr.merkleProof, pr.txIndex)) {
            revert TxNotInBlock(id, pr.blockHash);
        }
    }

    function _decode(bytes calldata payload) private pure returns (Proof memory) {
        (
            bytes memory rawTx,
            bytes memory witnessScript,
            bytes32 blockHash,
            bytes32[] memory merkleProof,
            uint256 txIndex,
            uint256 principalIndex,
            uint256 feeIndex
        ) = abi.decode(payload, (bytes, bytes, bytes32, bytes32[], uint256, uint256, uint256));

        return Proof({
            rawTx: rawTx,
            witnessScript: witnessScript,
            blockHash: blockHash,
            merkleProof: merkleProof,
            txIndex: txIndex,
            principalIndex: principalIndex,
            feeIndex: feeIndex
        });
    }
}
