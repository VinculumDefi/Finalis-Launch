// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

/// @notice ecrecover helper. Recovered address must be non-zero.
library Secp256k1 {
    function recover(bytes32 digest, bytes memory sig) internal pure returns (address) {
        require(sig.length == 65, "sig len");
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := mload(add(sig, 0x20))
            s := mload(add(sig, 0x40))
            v := byte(0, mload(add(sig, 0x60)))
        }
        require(v == 27 || v == 28, "sig v");
        address signer = ecrecover(digest, v, r, s);
        require(signer != address(0), "sig zero");
        return signer;
    }
}
