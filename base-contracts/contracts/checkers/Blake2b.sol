// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

/// @notice BLAKE2b-256 with a 16-byte personalization (RFC 7693; unkeyed,
/// no salt, fanout 1, depth 1), using the EIP-152 BLAKE2f precompile
/// (address 0x09, 12 rounds). Used for Zcash ZIP 244 transaction ids.
library Blake2b {
    // IV words as little-endian bytes (RFC 7693 section 2.6).
    bytes32 private constant IV_LO = 0x08c9bcf367e6096a3ba7ca8485ae67bb2bf894fe72f36e3cf1361d5f3af54fa5;
    bytes32 private constant IV_HI = 0xd182e6ad7f520e511f6c3e2b8c68059b6bbd41fbabd9831f79217e1319cde05b;
    // Parameter block bytes 0..3: digest length 32, key length 0, fanout 1, depth 1.
    bytes32 private constant PARAM_LO = bytes32(uint256(0x20000101) << 224);

    function personal256(bytes16 person, bytes memory data) internal view returns (bytes32 out) {
        bytes32 hLo = IV_LO ^ PARAM_LO;
        // Personalization occupies parameter bytes 48..63 = high half bytes 16..31.
        bytes32 hHi = IV_HI ^ (bytes32(person) >> 128);
        uint256 len = data.length;
        uint256 blocks = len == 0 ? 1 : (len + 127) / 128;
        bytes memory args = new bytes(213);
        assembly {
            mstore8(add(args, 35), 12) // rounds = 12 (big-endian u32 at bytes 0..3)
        }
        for (uint256 b = 0; b < blocks; b++) {
            bool last = b + 1 == blocks;
            uint256 off = b * 128;
            uint256 counter = last ? len : off + 128;
            assembly {
                let p := add(args, 32)
                mstore(add(p, 4), hLo)
                mstore(add(p, 36), hHi)
                // message block, zero padded
                for { let i := 0 } lt(i, 128) { i := add(i, 32) } { mstore(add(add(p, 68), i), 0) }
            }
            uint256 take = last ? len - off : 128;
            for (uint256 i = 0; i < take; i++) args[68 + i] = data[off + i];
            // t0 little-endian u64 at bytes 196..203; t1 = 0.
            for (uint256 i = 0; i < 8; i++) args[196 + i] = bytes1(uint8(counter >> (8 * i)));
            for (uint256 i = 204; i < 212; i++) args[i] = 0;
            args[212] = last ? bytes1(0x01) : bytes1(0x00);
            bytes32 lo;
            bytes32 hi;
            assembly {
                let ptr := mload(0x40)
                if iszero(staticcall(gas(), 0x09, add(args, 32), 213, ptr, 64)) { revert(0, 0) }
                lo := mload(ptr)
                hi := mload(add(ptr, 32))
            }
            hLo = lo;
            hHi = hi;
        }
        out = hLo;
    }
}
