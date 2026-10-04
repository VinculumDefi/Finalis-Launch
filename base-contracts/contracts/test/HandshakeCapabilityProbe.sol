// SPDX-License-Identifier: PROTOCOL-RESTRICTED
pragma solidity 0.8.19;

import "../HandshakeCapability.sol";

contract HandshakeCapabilityProbe {
    function allowance(bool countsPerIdentity) external pure returns (uint256) {
        return HandshakeCapability.allowance(countsPerIdentity);
    }
}
