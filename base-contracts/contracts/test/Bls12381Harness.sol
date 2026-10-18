// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "../checkers/Bls12381.sol";

/// @notice Test-only exposure of Bls12381 for known-vector checks.
contract Bls12381Harness {
    function hashToG2(bytes32 m) external view returns (bytes memory) {
        return Bls12381.hashToG2(m);
    }

    function verify(bytes calldata pk, bytes32 m, bytes calldata sig) external view returns (bool) {
        return Bls12381.verify(pk, m, sig);
    }

    function onCurveG1(bytes calldata x, bytes calldata y) external view returns (bool) {
        return Bls12381.onCurveG1(x, y);
    }
}
