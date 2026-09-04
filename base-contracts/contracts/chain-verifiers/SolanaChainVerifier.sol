// =============================================================================
// SolanaChainVerifier — Solana Finality Verifier (Section O)
//
// STATUS: NOT IMPLEMENTED — FAILS CLOSED
//
// This contract previously accepted a caller-supplied commitment byte and
// returned finalized=true without verifying the slot or the lock event.
// See CL-76 and base-contracts/test/10_cl76_forged_package.test.cjs.
//
// REQUIRED FOR IMPLEMENTATION (Section O):
//   Verification that the referenced slot is finalized (max-rooted) under
//   Solana consensus, and that the lock instruction executed within it —
//   established without trusting the caller.
//
// Retained domain facts for the future implementation:
//   Finality: finalized slot (max-rooted commitment level).
//   Finality Proof encoding: (bytes32 blockhash, uint256 slot, uint8 commitment)
//     commitment: 1 = finalized (max-rooted)
//   VF-COM-007/008: pending attempt dispositions are objective and chain-native:
//     FINALIZED_SUCCESS, FINALIZED_FAILURE, RECENT_BLOCKHASH_EXPIRY,
//     DURABLE_NONCE_ADVANCEMENT. Elapsed time / mempool absence never clears.
//
// SPDX-License-Identifier: PROTOCOL-RESTRICTED
// Solidity 0.8.19+
// =============================================================================

pragma solidity 0.8.19;

import "../interfaces/IChainVerifier.sol";

contract SolanaChainVerifier is IChainVerifier {
    error VerifierNotImplemented(string environmentFamily);

    uint8 constant COMMITMENT_FINALIZED = 1;

    function verifyFinality(
        bytes calldata,
        bytes calldata
    ) external view override returns (bool, bytes32, uint256) {
        revert VerifierNotImplemented("solana");
    }

    function extractFacts(
        bytes calldata
    ) external pure override returns (
        bytes32, uint256, uint256, uint256, uint256, uint256, uint256,
        bytes32, address, address, uint8
    ) {
        revert VerifierNotImplemented("solana");
    }
}
