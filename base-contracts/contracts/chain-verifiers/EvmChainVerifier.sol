// =============================================================================
// EvmChainVerifier — Remote EVM Family Finality Verifier (Section O)
//
// STATUS: NOT IMPLEMENTED — FAILS CLOSED
//
// Handles (when implemented): Ethereum, BNB, Avalanche, Polygon, Arbitrum,
//                             Optimism. SIX environments, all remote.
//
// BASE IS NO LONGER HANDLED HERE. Base is the same-chain environment and has a
// working implementation in BaseSameChainVerifier, which reads lock facts from
// VinculumFinalisBaseVault storage. The former `sameChain` branch of this
// contract returned the caller's own block hash and height without reading
// anything, and is deleted rather than carried forward.
//
// This contract previously decoded a caller-supplied finality assertion and
// tested its fields. The per-chain vocabulary below was correct; the values it
// tested were supplied by the party requesting issuance. See CL-76, CL-80, and
// base-contracts/test/10_cl76_forged_package.test.cjs.
//
// Per the fail-closed policy, a security-critical component may exist only as
// (1) fully implemented and evidenced, or (2) explicitly non-operational.
//
// REQUIRED FOR IMPLEMENTATION (Section O, Verifier Completion Standard §3)
//   For each environment, a mechanism establishing that the referenced block is
//   final under that chain's own consensus AND that the lock event occurred
//   within it — without trusting the caller. Either an on-Base light client, or
//   a verified message from a proof protocol whose trust assumptions are
//   documented under §3.7. BaseSameChainVerifier is the reference for what a
//   completed verifier looks like at this seam.
//
// RETAINED DOMAIN FACTS — the finality rule per environment. This vocabulary is
// correct and is the specification for the future implementation; only the
// means of establishing these conditions was absent.
//
//   Ethereum   — "PoS finalized":  block finalized under Casper FFG.
//   BNB        — "FFF":            confirmations >= the configured minimum
//                                  under BNB Fast Finality.
//   Avalanche  — "Snowman":        block accepted (or finalized) under Snowman
//                                  consensus.
//   Polygon    — "Heimdall v2":    the containing block covered by a verified
//                                  Heimdall checkpoint.
//   Arbitrum   — "Optimistic":     L1-finalized, or the challenge period
//                                  elapsed without a successful challenge.
//   Optimism   — "OP Stack":       as Arbitrum; challengePeriodBlocks applies.
//
//   Finality status codes used by the former encoding:
//     0=PENDING, 1=FINALIZED, 2=ACCEPTED, 3=CHECKPOINT_VERIFIED,
//     4=L1_FINALIZED, 5=CHALLENGE_PERIOD_PASSED, 6=SAME_CHAIN
//
//   Lock Event Proof encoding (shared across environments):
//     (bytes32 lockId, uint256 grossAmount, uint256 feeAmount,
//      uint256 principalAmount, uint256 durationSecs,
//      uint256 creationTimestamp, uint256 maturityTimestamp)
//
//   Finality Proof encoding (former):
//     (bytes32 blockHash, uint256 blockHeight, uint8 finalityStatus,
//      uint256 confirmations, bool l1Finalized, bool challengePeriodPassed)
//
// SPDX-License-Identifier: PROTOCOL-RESTRICTED
// Solidity 0.8.19+
// =============================================================================

pragma solidity 0.8.19;

import "../interfaces/IChainVerifier.sol";

contract EvmChainVerifier is IChainVerifier {

    /// @notice Thrown on every call. This verifier has no production
    ///         verification mechanism and must not be relied upon.
    error VerifierNotImplemented(string environmentFamily);

    string public environmentId;
    string public finalityModel;
    uint256 public minConfirmations;
    uint256 public challengePeriodBlocks;

    /// @dev `sameChain` is deliberately absent. Base is served by
    ///      BaseSameChainVerifier; no environment reaching this contract is
    ///      same-chain, and no configuration should suggest otherwise.
    constructor(
        string memory _environmentId,
        string memory _finalityModel,
        uint256 _minConfirmations,
        uint256 _challengePeriodBlocks
    ) {
        environmentId = _environmentId;
        finalityModel = _finalityModel;
        minConfirmations = _minConfirmations;
        challengePeriodBlocks = _challengePeriodBlocks;
    }

    function verifyFinality(
        bytes calldata,
        bytes calldata
    ) external view override returns (bool, bytes32, uint256) {
        revert VerifierNotImplemented("evm-remote");
    }

    function extractFacts(
        bytes calldata
    ) external view override returns (
        bytes32, uint256, uint256, uint256, uint256, uint256, uint256,
        bytes32, address, address, uint8
    ) {
        revert VerifierNotImplemented("evm-remote");
    }
}
