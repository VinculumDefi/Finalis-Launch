// =============================================================================
// MockChainVerifier — TEST FIXTURE ONLY. Never deployed.
//
// Returns success without verifying anything. That is its purpose: it lets
// the issuance pipeline be tested independently of whether any verifier
// works.
//
// IT IS NOT EVIDENCE ABOUT VERIFICATION.
//   Verifier Completion Standard 4.4: "Evidence offered under 5 SHALL
//   exercise the production verifier. A test that substitutes a mock at the
//   verifier seam produces no evidence about the verifier, however
//   comprehensive it is about everything else."
//
//   A suite that registers this contract cannot demonstrate that a forged
//   proof is rejected — this contract accepts everything by construction.
//
// Recorded under CL-77.
// =============================================================================

// =============================================================================
// MockChainVerifier — TEST INFRASTRUCTURE ONLY
//
// *** THIS CONTRACT MUST NEVER BE DEPLOYED TO ANY PRODUCTION NETWORK. ***
//
// It exists so the protocol's own logic can be tested end to end without a
// live foreign chain. It performs NO cryptographic verification of anything.
//
// Design principle: the mock does not invent facts. extractFacts() decodes
// whatever the test encoded into lockEventProof and returns it verbatim. That
// keeps the test in control of what "the source chain says", and lets a test
// deliberately create a mismatch to prove VF-XCH-011 cross-checking works.
//
// SPDX-License-Identifier: PROTOCOL-RESTRICTED
// Solidity 0.8.19+
// =============================================================================

pragma solidity 0.8.19;

import "../interfaces/IChainVerifier.sol";

contract MockChainVerifier is IChainVerifier {
    // Configurable finality outcome, so a test can simulate an unfinalized
    // source event (VF-XCH-006) without changing the proof payload.
    bool public finalityResult = true;
    bytes32 public sourceBlockHashValue = keccak256("mock-block");
    uint256 public sourceBlockHeightValue = 1_000_000;

    function setFinality(bool ok) external {
        finalityResult = ok;
    }

    function verifyFinality(bytes calldata, bytes calldata)
        external
        view
        override
        returns (bool finalized, bytes32 sourceBlockHash, uint256 sourceBlockHeight)
    {
        return (finalityResult, sourceBlockHashValue, sourceBlockHeightValue);
    }

    /// @dev Decodes the facts the test encoded. Encoding order must match
    ///      IChainVerifier's return order exactly.
    function extractFacts(bytes calldata lockEventProof)
        external
        pure
        override
        returns (
            bytes32 lockId,
            uint256 grossAmount,
            uint256 feeAmount,
            uint256 principalAmount,
            uint256 durationSecs,
            uint256 creationTimestamp,
            uint256 maturityTimestamp
        )
    {
        return abi.decode(
            lockEventProof,
            (bytes32, uint256, uint256, uint256, uint256, uint256, uint256)
        );
    }
}
