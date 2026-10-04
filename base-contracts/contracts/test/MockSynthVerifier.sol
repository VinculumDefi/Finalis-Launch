// SPDX-License-Identifier: PROTOCOL-RESTRICTED
pragma solidity 0.8.19;

/// Test double for VinculumFinalisSynth.checkActivation. Not a production verifier.
contract MockSynthVerifier {
    uint256 public cumulativeChonxIssued;

    function setCumulativeChonxIssued(uint256 value) external {
        cumulativeChonxIssued = value;
    }

    function chonxActivated() external pure returns (bool) {
        return false;
    }
}
