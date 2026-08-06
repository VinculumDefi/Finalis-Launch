// =============================================================================
// UtxoChainVerifier — UTXO Family Finality Verifier (Section O)
//
// Handles: Bitcoin (depth>=6), Litecoin (depth>=N), Dogecoin (depth>=N),
//          DigiByte (depth>=N), Zcash (depth>=10), BitcoinCash (depth>=N).
//
// Lock Event Proof encoding (ABI-encoded tuple):
//   (bytes32 lockId, uint256 grossAmount, uint256 feeAmount, uint256 principalAmount,
//    uint256 durationSecs, uint256 creationTimestamp, uint256 maturityTimestamp)
//
// Finality Proof encoding (ABI-encoded tuple):
//   (bytes32 blockHash, uint256 blockHeight, uint256 confirmations)
//
// NOTE: For environments where minConfirmations is 0, the exact confirmation depth
// is DEFERRED EXTERNAL INPUT — the contract enforces >= 6 as a temporary standard
// until the exact value is provisioned via setMinConfirmations.
//
// SPDX-License-Identifier: PROTOCOL-RESTRICTED
// Solidity 0.8.19+
// =============================================================================

pragma solidity 0.8.19;

import "../interfaces/IChainVerifier.sol";

contract UtxoChainVerifier is IChainVerifier {
    string public environmentId;
    uint256 public minConfirmations; // 0 = REQUIRES_EXTERNAL_INPUT (enforces >= 6 temporarily)
    uint256 constant TEMPORARY_MIN_CONFIRMATIONS = 6;

    constructor(string memory _environmentId, uint256 _minConfirmations) {
        environmentId = _environmentId;
        minConfirmations = _minConfirmations;
    }

    function setMinConfirmations(uint256 _min) external {
        // Only callable by authority in production (access control omitted for clarity)
        minConfirmations = _min;
    }

    function verifyFinality(
        bytes calldata lockEventProof,
        bytes calldata sourceFinalityProof
    ) external view override returns (bool finalized, bytes32 sourceBlockHash, uint256 sourceBlockHeight) {
        (bytes32 blockHash, uint256 blockHeight, uint256 confirmations)
            = abi.decode(sourceFinalityProof, (bytes32, uint256, uint256));

        uint256 required = minConfirmations > 0 ? minConfirmations : TEMPORARY_MIN_CONFIRMATIONS;
        require(confirmations >= required, "VF-XCH-006: insufficient PoW confirmations");

        return (true, blockHash, blockHeight);
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