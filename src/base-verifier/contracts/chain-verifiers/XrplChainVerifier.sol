// =============================================================================
// XrplChainVerifier — XRPL Finality Verifier (Section O)
//
// Finality: validated ledger (transaction in a closed+validated ledger).
//
// Lock Event Proof encoding (ABI-encoded tuple):
//   (bytes32 lockId, uint256 grossAmount, uint256 feeAmount, uint256 principalAmount,
//    uint256 durationSecs, uint256 creationTimestamp, uint256 maturityTimestamp)
//
// Finality Proof encoding (ABI-encoded tuple):
//   (bytes32 ledgerHash, uint256 ledgerIndex, bool validated)
//
// SPDX-License-Identifier: PROTOCOL-RESTRICTED
// Solidity 0.8.19+
// =============================================================================

pragma solidity 0.8.19;

import "../interfaces/IChainVerifier.sol";

contract XrplChainVerifier is IChainVerifier {
    function verifyFinality(
        bytes calldata lockEventProof,
        bytes calldata sourceFinalityProof
    ) external view override returns (bool finalized, bytes32 sourceBlockHash, uint256 sourceBlockHeight) {
        (bytes32 ledgerHash, uint256 ledgerIndex, bool validated)
            = abi.decode(sourceFinalityProof, (bytes32, uint256, bool));

        require(validated, "VF-XCH-006: XRPL ledger not validated");
        return (true, ledgerHash, ledgerIndex);
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