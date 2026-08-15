// =============================================================================
// StellarChainVerifier — Stellar Finality Verifier (Section O)
//
// STATUS: NOT IMPLEMENTED — FAILS CLOSED
//
// This contract previously accepted a caller-supplied `closed` flag and
// returned finalized=true without verifying the ledger or the lock event.
// See CL-76 and base-contracts/test/10_cl76_forged_package.test.cjs.
//
// REQUIRED FOR IMPLEMENTATION (Section O):
//   Verification that the referenced ledger was closed by SCP consensus and
//   contains the lock transaction — established without trusting the caller.
//
// Retained domain facts for the future implementation:
//   Finality: SCP closed (transaction in a ledger closed by SCP consensus).
//   Finality Proof encoding: (bytes32 ledgerHash, uint256 ledgerSequence, bool closed)
//
// SPDX-License-Identifier: PROTOCOL-RESTRICTED
// Solidity 0.8.19+
// =============================================================================

pragma solidity 0.8.19;

import "../interfaces/IChainVerifier.sol";

contract StellarChainVerifier is IChainVerifier {
    error VerifierNotImplemented(string environmentFamily);

    function verifyFinality(
        bytes calldata,
        bytes calldata
    ) external view override returns (bool, bytes32, uint256) {
        revert VerifierNotImplemented("stellar");
    }

    function extractFacts(
        bytes calldata
    ) external pure override returns (
        bytes32, uint256, uint256, uint256, uint256, uint256, uint256
    ) {
        revert VerifierNotImplemented("stellar");
    }
}
