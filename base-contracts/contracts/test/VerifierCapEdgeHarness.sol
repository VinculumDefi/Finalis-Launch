// SPDX-License-Identifier: PROTOCOL-RESTRICTED
pragma solidity 0.8.19;

import "../VinculumFinalisVerifier.sol";

/// @dev TEST ONLY. Never deploy. The production Verifier plus one setter for
/// cumulativeChonxIssued, so the exact CHONX hard-cap edge (VF-SUP-015) can be
/// reached in a test without minting 100 billion CHONX one lock at a time.
/// Every other line of behavior is the production Verifier's.
contract VerifierCapEdgeHarness is VinculumFinalisVerifier {
    constructor(address vclm_, address chonx_) VinculumFinalisVerifier(vclm_, chonx_) {}

    function testSetCumulativeChonxIssued(uint256 v) external {
        cumulativeChonxIssued = v;
    }
}
