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
// VF-XCH-011:     extractFacts  — independent fact extraction from raw proof.
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
    function extractFacts(
        bytes calldata lockEventProof
    ) external pure returns (
        bytes32 lockId,
        uint256 grossAmount,
        uint256 feeAmount,
        uint256 principalAmount,
        uint256 durationSecs,
        uint256 creationTimestamp,
        uint256 maturityTimestamp
    );
}