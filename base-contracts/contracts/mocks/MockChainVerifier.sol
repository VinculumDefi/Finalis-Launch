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
