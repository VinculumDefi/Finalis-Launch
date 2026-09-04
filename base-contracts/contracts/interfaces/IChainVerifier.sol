// =============================================================================
// IChainVerifier — Per-Environment Finality Verification Interface (Section O)
//
// PROVENANCE: Revision 6 — Architecture_Design.md Section O
//
// Each source environment provides a contract implementing this interface.
// BASE-VERIFY (VinculumFinalisVerifier) dispatches to the correct verifier
// based on sourceEnvironmentId.
//
// VF-XCH-006/010: verifyFinality — objective chain-native finality check.
// VF-XCH-011:     extractFacts  — independent fact extraction.
//
// MUTABILITY NOTE (CL-81). extractFacts was previously declared `pure`. A pure
// function cannot read storage and cannot call another contract, so no
// implementation could establish anything beyond decoding its own argument —
// the interface made caller-trust mandatory rather than merely convenient.
// It is `view` so that a verifier may consult chain state where chain state is
// the authoritative source, as it is for the same-chain (Base) environment.
// Overriding with a more restrictive mutability remains permitted, so
// implementations that genuinely decode only may still declare themselves pure.
//
// SPDX-License-Identifier: PROTOCOL-RESTRICTED
// Solidity 0.8.19+
// =============================================================================

pragma solidity 0.8.19;

interface IChainVerifier {
    /// @notice Verifies source finality using chain-native objective evidence.
    /// @param lockEventProof Chain-specific lock event proof (ABI-encoded).
    /// @param sourceFinalityProof Chain-specific finality proof (ABI-encoded).
    /// @return finalized Whether the source event is finalized.
    /// @return sourceBlockHash The finalized source block hash.
    /// @return sourceBlockHeight The finalized source block height.
    function verifyFinality(
        bytes calldata lockEventProof,
        bytes calldata sourceFinalityProof
    ) external view returns (bool finalized, bytes32 sourceBlockHash, uint256 sourceBlockHeight);

    /// @notice Extracts immutable facts from the raw lock event proof.
    /// @return lockId Unique commitment vault lock identifier.
    /// @return grossAmount Gross asset amount in smallest units.
    /// @return feeAmount Actual fee amount in smallest units.
    /// @return principalAmount Principal amount in smallest units.
    /// @return durationSecs Lock duration in seconds.
    /// @return creationTimestamp Source block timestamp at creation.
    /// @return maturityTimestamp Maturity timestamp.
    /// @return canonicalAssetId Canonical identity of the locked asset.
    /// @return baseRecipient Base address bound to receive issuance.
    /// @return releaseDestination Destination bound for principal release.
    /// @return outputToken Selected output token (0 = VCLM, 1 = CHONX).
    ///
    /// CL-85. The four identity fields were added to the original seven. The
    /// seven alone were insufficient: VF-XCH-011 requires the consumer to
    /// validate evidence binding the recipient, the asset, the release
    /// destination and the output token, and none could be established from
    /// this return set, so the consumer took them from the caller. That is the
    /// defect CL-81 corrected one level down, applied to the return set rather
    /// than to mutability. An implementation that cannot independently
    /// establish an identity field must revert rather than return zero.
    function extractFacts(
        bytes calldata lockEventProof
    ) external view returns (
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
    );
}