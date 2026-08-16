// =============================================================================
// UtxoChainVerifier — SHA256d UTXO Family Finality Verifier (Section O)
//
// STATUS: PARTIALLY IMPLEMENTED.
//   verifyFinality — IMPLEMENTED against a Base-resident SPV header chain.
//   extractFacts   — FAILS CLOSED. Blocked by CL-27, stated below.
//
// SERVES: Bitcoin, Bitcoin Cash (SHA256d proof of work).
//   Litecoin and Dogecoin use scrypt, DigiByte rotates five algorithms, Zcash
//   uses Equihash. Those are memory-hard by construction and cannot be verified
//   within EVM gas limits. Each environment is deployed with its own header
//   chain instance where the algorithm permits; where it does not, that
//   environment requires a different mechanism and is not served here.
//
// WHAT CHANGED FROM THE CL-76 IMPLEMENTATION
//   The previous version decoded a caller-supplied confirmation count and
//   compared it to a threshold — an assertion checked against itself. This
//   version verifies a Merkle inclusion proof against a header whose proof of
//   work was validated on Base, then reads confirmation depth from the header
//   chain's own state. The caller supplies a proof; the chain supplies the
//   verdict.
//
// TRUST ASSUMPTIONS (Verifier Completion Standard 3.7)
//   Inherited entirely from Sha256dHeaderChain: one immutable checkpoint header
//   bound at deployment, and cumulative proof of work deciding between
//   competing chains. No relayer, attestor, or administrator is trusted.
//
// BLOCKER — extractFacts (CL-27)
//   extractFacts must recover lockId, gross, fee, principal, duration, creation
//   and maturity by parsing a CLTV lock transaction. No CLTV locking script
//   exists anywhere in this repository: three independent searches under CL-27
//   returned no nLockTime, redeemScript, scriptPubKey, P2SH, bitcoinjs, or
//   BIP65 reference in any source file. There is no script layout to parse
//   against, and defining one is a protocol decision, not an implementation.
//   This function fails closed until the source-side lock format is specified.
//
// SPDX-License-Identifier: PROTOCOL-RESTRICTED
// Solidity 0.8.19+
// =============================================================================

pragma solidity 0.8.19;

import "../interfaces/IChainVerifier.sol";

interface ISha256dHeaderChain {
    function confirmations(bytes32 blockHash) external view returns (uint256);
    function verifyTxInclusion(
        bytes32 txid,
        bytes32 blockHash,
        bytes32[] calldata proof,
        uint256 index
    ) external view returns (bool);
    function isKnown(bytes32 blockHash) external view returns (bool);
}

contract UtxoChainVerifier is IChainVerifier {

    error VerifierNotImplemented(string reason);
    error HeaderNotKnown(bytes32 blockHash);
    error TxNotInBlock(bytes32 txid, bytes32 blockHash);
    error InsufficientConfirmations(uint256 have, uint256 required);
    error ZeroAddress();

    string public environmentId;
    uint256 public minConfirmations;
    ISha256dHeaderChain public immutable headerChain;

    /// @param _environmentId Chain identifier, e.g. "bitcoin".
    /// @param _minConfirmations Required depth. Fixed at deployment; no setter
    ///        exists (CL-78).
    /// @param _headerChain The SPV header chain for this environment.
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

    /// @notice Verifies the lock transaction is included in a block with
    ///         sufficient proof-of-work depth.
    /// @param sourceFinalityProof ABI-encoded
    ///        (bytes32 txid, bytes32 blockHash, bytes32[] merkleProof, uint256 index).
    function verifyFinality(
        bytes calldata /* lockEventProof */,
        bytes calldata sourceFinalityProof
    ) external view override returns (
        bool finalized,
        bytes32 sourceBlockHash,
        uint256 sourceBlockHeight
    ) {
        (bytes32 txid, bytes32 blockHash, bytes32[] memory merkleProof, uint256 index) =
            abi.decode(sourceFinalityProof, (bytes32, bytes32, bytes32[], uint256));

        if (!headerChain.isKnown(blockHash)) revert HeaderNotKnown(blockHash);

        if (!headerChain.verifyTxInclusion(txid, blockHash, merkleProof, index)) {
            revert TxNotInBlock(txid, blockHash);
        }

        uint256 depth = headerChain.confirmations(blockHash);
        uint256 required = minConfirmations > 0 ? minConfirmations : 6;
        if (depth < required) revert InsufficientConfirmations(depth, required);

        return (true, blockHash, depth);
    }

    /// @dev FAILS CLOSED. See the CL-27 blocker in the file header. Returning
    ///      caller-decoded values here would reintroduce CL-76 through the other
    ///      half of the interface.
    function extractFacts(
        bytes calldata
    ) external view override returns (
        bytes32, uint256, uint256, uint256, uint256, uint256, uint256
    ) {
        revert VerifierNotImplemented("CL-27: no CLTV lock script format specified");
    }

    /// @notice Whether a lock transaction is verifiable at the required depth,
    ///         without reverting. For operators and the UI.
    function isFinal(
        bytes32 txid,
        bytes32 blockHash,
        bytes32[] calldata merkleProof,
        uint256 index
    ) external view returns (bool) {
        if (!headerChain.isKnown(blockHash)) return false;
        if (!headerChain.verifyTxInclusion(txid, blockHash, merkleProof, index)) return false;
        uint256 required = minConfirmations > 0 ? minConfirmations : 6;
        return headerChain.confirmations(blockHash) >= required;
    }
}
