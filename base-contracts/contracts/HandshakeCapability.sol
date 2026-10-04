// =============================================================================
// HandshakeCapability — VF-COM-006
//
// A mechanism that can keep a per-identity count gets 3 Handshakes.
// A mechanism that cannot gets 1.
// The 3 is not a stored allowance. It is the capable branch of this function.
// =============================================================================

// SPDX-License-Identifier: PROTOCOL-RESTRICTED
pragma solidity 0.8.19;

library HandshakeCapability {
    function allowance(bool countsPerIdentity) internal pure returns (uint256) {
        return countsPerIdentity ? 3 : 1;
    }
}
