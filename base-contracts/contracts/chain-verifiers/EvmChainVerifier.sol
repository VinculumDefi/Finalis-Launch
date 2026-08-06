// =============================================================================
// EvmChainVerifier — EVM Family Per-Environment Finality Verifier (Section O)
//
// Handles: Ethereum (PoS finalized), BNB (FFF), Avalanche (Snowman),
//          Polygon (Heimdall v2), Arbitrum (Optimistic), Base (same-chain),
//          Optimism (OP Stack).
//
// Lock Event Proof encoding (ABI-encoded tuple):
//   (bytes32 lockId, uint256 grossAmount, uint256 feeAmount, uint256 principalAmount,
//    uint256 durationSecs, uint256 creationTimestamp, uint256 maturityTimestamp)
//
// Finality Proof encoding (ABI-encoded tuple):
//   (bytes32 blockHash, uint256 blockHeight, uint8 finalityStatus,
//    uint256 confirmations, bool l1Finalized, bool challengePeriodPassed)
//
// Finality status codes:
//   0=PENDING, 1=FINALIZED, 2=ACCEPTED, 3=CHECKPOINT_VERIFIED,
//   4=L1_FINALIZED, 5=CHALLENGE_PERIOD_PASSED, 6=SAME_CHAIN
//
// SPDX-License-Identifier: PROTOCOL-RESTRICTED
// Solidity 0.8.19+
// =============================================================================

pragma solidity 0.8.19;

import "../interfaces/IChainVerifier.sol";

contract EvmChainVerifier is IChainVerifier {
    uint8 constant PENDING = 0;
    uint8 constant FINALIZED = 1;
    uint8 constant ACCEPTED = 2;
    uint8 constant CHECKPOINT_VERIFIED = 3;
    uint8 constant L1_FINALIZED = 4;
    uint8 constant CHALLENGE_PERIOD_PASSED = 5;
    uint8 constant SAME_CHAIN = 6;

    string public environmentId;
    string public finalityModel;
    uint256 public minConfirmations;
    uint256 public challengePeriodBlocks;
    bool public sameChain;

    constructor(
        string memory _environmentId,
        string memory _finalityModel,
        uint256 _minConfirmations,
        uint256 _challengePeriodBlocks,
        bool _sameChain
    ) {
        environmentId = _environmentId;
        finalityModel = _finalityModel;
        minConfirmations = _minConfirmations;
        challengePeriodBlocks = _challengePeriodBlocks;
        sameChain = _sameChain;
    }

    function verifyFinality(
        bytes calldata lockEventProof,
        bytes calldata sourceFinalityProof
    ) external view override returns (bool finalized, bytes32 sourceBlockHash, uint256 sourceBlockHeight) {
        (bytes32 blockHash, uint256 blockHeight, uint8 status, uint256 confirmations, bool l1Finalized, bool challengePassed)
            = abi.decode(sourceFinalityProof, (bytes32, uint256, uint8, uint256, bool, bool));

        // Base (same-chain): RESOLVED_SAME_CHAIN — no cross-chain verification needed
        if (sameChain) {
            return (true, blockHash, blockHeight);
        }

        // Ethereum: PoS finalized
        if (keccak256(bytes(finalityModel)) == keccak256("PoS finalized")) {
            require(status == FINALIZED, "VF-XCH-006: Ethereum PoS not finalized");
        }

        // BNB: Fast Finality (FFF)
        else if (keccak256(bytes(finalityModel)) == keccak256("FFF")) {
            require(confirmations >= minConfirmations, "VF-XCH-006: BNB FFF insufficient confirmations");
        }

        // Avalanche: Snowman — accepted block
        else if (keccak256(bytes(finalityModel)) == keccak256("Snowman")) {
            require(status == ACCEPTED || status == FINALIZED, "VF-XCH-006: Avalanche not accepted");
        }

        // Polygon: Heimdall v2 checkpoint
        else if (keccak256(bytes(finalityModel)) == keccak256("Heimdall v2")) {
            require(status == CHECKPOINT_VERIFIED, "VF-XCH-006: Polygon checkpoint not verified");
        }

        // Arbitrum / Optimism: Optimistic rollup
        else if (keccak256(bytes(finalityModel)) == keccak256("Optimistic") || keccak256(bytes(finalityModel)) == keccak256("OP Stack")) {
            require(
                status == L1_FINALIZED || status == CHALLENGE_PERIOD_PASSED || l1Finalized || challengePassed,
                "VF-XCH-006: L2 not finalized"
            );
        }

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