// =============================================================================
// StellarChainVerifier — Stellar Finality Verifier (Section O)
//
// Finality: SCP closed (transaction in a ledger closed by SCP consensus).
//
// Lock Event Proof encoding (ABI-encoded tuple):
//   (bytes32 lockId, uint256 grossAmount, uint256 feeAmount, uint256 principalAmount,
//    uint256 durationSecs, uint256 creationTimestamp, uint256 maturityTimestamp)
//
// Finality Proof encoding (ABI-encoded tuple):
//   (bytes32 ledgerHash, uint256 ledgerSequence, bool closed)
//
// SPDX-License-Identifier: PROTOCOL-RESTRICTED
// Solidity 0.8.19+
// =============================================================================

pragma solidity 0.8.19;

import "../interfaces/IChainVerifier.sol";

contract StellarChainVerifier is IChainVerifier {
    function verifyFinality(
        bytes calldata lockEventProof,
        bytes calldata sourceFinalityProof
    ) external view override returns (bool finalized, bytes32 sourceBlockHash, uint256 sourceBlockHeight) {
        (bytes32 ledgerHash, uint256 ledgerSequence, bool closed)
            = abi.decode(sourceFinalityProof, (bytes32, uint256, bool));

        require(closed, "VF-XCH-006: Stellar ledger not SCP-closed");
        return (true, ledgerHash, ledgerSequence);
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