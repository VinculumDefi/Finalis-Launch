// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @dev Test fixture: stands in for the retired f9e4d8c CommitmentVaultLock
///      with HANDSHAKE_FEE_BPS = 250 (2.5%). Not for deployment.
contract OldHandshakeFeeLock {
    string public environmentId;
    address public immutable devFund;
    uint256 public constant STANDARD_FEE_BPS = 500;
    uint256 public constant HANDSHAKE_FEE_BPS = 250;

    constructor(string memory environmentId_, address devFund_) {
        environmentId = environmentId_;
        devFund = devFund_;
    }
}
