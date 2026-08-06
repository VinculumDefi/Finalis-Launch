// =============================================================================
// SolanaChainVerifier — Solana Finality Verifier (Section O)
//
// Finality: finalized slot (max-rooted commitment level).
//
// Lock Event Proof encoding (ABI-encoded tuple):
//   (bytes32 lockId, uint256 grossAmount, uint256 feeAmount, uint256 principalAmount,
//    uint256 durationSecs, uint256 creationTimestamp, uint256 maturityTimestamp)
//
// Finality Proof encoding (ABI-encoded tuple):
//   (bytes32 blockhash, uint256 slot, uint8 commitment)
//   commitment: 1 = finalized (max-rooted)
//
// VF-COM-007/008: Pending attempt dispositions are objective and chain-native:
//   FINALIZED_SUCCESS, FINALIZED_FAILURE, RECENT_BLOCKHASH_EXPIRY,
//   DURABLE_NONCE_ADVANCEMENT. Elapsed time/mempool absence never clears.
//
// SPDX-License-Identifier: PROTOCOL-RESTRICTED
// Solidity 0.8.19+
// =============================================================================

pragma solidity 0.8.19;

import "../interfaces/IChainVerifier.sol";

contract SolanaChainVerifier is IChainVerifier {
    uint8 constant COMMITMENT_FINALIZED = 1;

    function verifyFinality(
        bytes calldata lockEventProof,
        bytes calldata sourceFinalityProof
    ) external view override returns (bool finalized, bytes32 sourceBlockHash, uint256 sourceBlockHeight) {
        (bytes32 blockhash, uint256 slot, uint8 commitment)
            = abi.decode(sourceFinalityProof, (bytes32, uint256, uint8));

        require(commitment == COMMITMENT_FINALIZED, "VF-XCH-006: Solana slot not finalized");
        return (true, blockhash, slot);
    }

    function extractFacts(
        bytes calldata lockEventProof
    ) external pure override returns (
        bytes32 lockId, uint256 grossAmount, uint256 feeAmount,
        uint256 principalAmount, uint256 durationSecs,
        uint256 creationTimestamp, uint256 maturityTimestamp
    ) {
        return abi.decode(lockEventProof, (bytes32, uint256, uint256, uint256, uint256, uint256, uint256));
    }
}