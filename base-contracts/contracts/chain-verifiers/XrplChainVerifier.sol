// =============================================================================
// XrplChainVerifier — XRPL Finality Verifier (Section O)
//
// STATUS: NOT IMPLEMENTED — FAILS CLOSED
//
// This contract previously accepted a caller-supplied `validated` flag and
// returned finalized=true without verifying the ledger or the lock event.
// See CL-76 and base-contracts/test/10_cl76_forged_package.test.cjs.
//
// REQUIRED FOR IMPLEMENTATION (Section O):
//   Verification that the referenced ledger is validated under XRPL consensus
//   and contains the lock transaction — established without trusting the caller.
//
// Retained domain facts for the future implementation:
//   Finality: validated ledger (transaction in a closed+validated ledger).
//   Finality Proof encoding: (bytes32 ledgerHash, uint256 ledgerIndex, bool validated)
//
// SPDX-License-Identifier: PROTOCOL-RESTRICTED
// Solidity 0.8.19+
// =============================================================================

pragma solidity 0.8.19;

import "../interfaces/IChainVerifier.sol";

contract XrplChainVerifier is IChainVerifier {
    error VerifierNotImplemented(string environmentFamily);

    function verifyFinality(
        bytes calldata,
        bytes calldata
    ) external view override returns (bool, bytes32, uint256) {
        revert VerifierNotImplemented("xrpl");
    }

    function extractFacts(
        bytes calldata
    ) external pure override returns (
        bytes32, uint256, uint256, uint256, uint256, uint256, uint256,
        bytes32, address, address, uint8
    ) {
        revert VerifierNotImplemented("xrpl");
    }
}
