// SPDX-License-Identifier: PROTOCOL-RESTRICTED
pragma solidity 0.8.19;

/// @title Sha512
/// @notice SHA-512 (FIPS 180-4) in Solidity, for XRP Ledger hashes
/// (SHA-512Half = the first 32 bytes of SHA-512). The EVM has no SHA-512
/// precompile. Checked against Node crypto in test/xrpl_lock_reader.test.cjs.
library Sha512 {
    uint256 private constant M = 0xffffffffffffffff;

    function sha512half(bytes memory data) internal pure returns (bytes32 out) {
        uint256[8] memory h = sha512(data);
        out = bytes32((h[0] << 192) | (h[1] << 128) | (h[2] << 64) | h[3]);
    }

    function sha512(bytes memory data) internal pure returns (uint256[8] memory h) {
        h[0] = 0x6a09e667f3bcc908; h[1] = 0xbb67ae8584caa73b; h[2] = 0x3c6ef372fe94f82b; h[3] = 0xa54ff53a5f1d36f1;
        h[4] = 0x510e527fade682d1; h[5] = 0x9b05688c2b3e6c1f; h[6] = 0x1f83d9abfb41bd6b; h[7] = 0x5be0cd19137e2179;
        uint256 n = data.length;
        uint256 total = ((n + 17 + 127) / 128) * 128;
        bytes memory buf = new bytes(total);
        assembly {
            let src := add(data, 32)
            let dst := add(buf, 32)
            for { let i := 0 } lt(i, n) { i := add(i, 32) } { mstore(add(dst, i), mload(add(src, i))) }
            // clear bytes past n that the 32-byte copy may have written
            for { let i := n } lt(i, total) { i := add(i, 1) } { mstore8(add(dst, i), 0) }
            mstore8(add(dst, n), 0x80)
            // bit length in the last 16 bytes (n < 2^61); OR keeps the data
            // and the 0x80 marker that may share this word
            let lw := add(dst, sub(total, 32))
            mstore(lw, or(mload(lw), mul(n, 8)))
        }
        uint256[20] memory k;
        k[0] = 0x428a2f98d728ae227137449123ef65cdb5c0fbcfec4d3b2fe9b5dba58189dbbc;
        k[1] = 0x3956c25bf348b53859f111f1b605d019923f82a4af194f9bab1c5ed5da6d8118;
        k[2] = 0xd807aa98a303024212835b0145706fbe243185be4ee4b28c550c7dc3d5ffb4e2;
        k[3] = 0x72be5d74f27b896f80deb1fe3b1696b19bdc06a725c71235c19bf174cf692694;
        k[4] = 0xe49b69c19ef14ad2efbe4786384f25e30fc19dc68b8cd5b5240ca1cc77ac9c65;
        k[5] = 0x2de92c6f592b02754a7484aa6ea6e4835cb0a9dcbd41fbd476f988da831153b5;
        k[6] = 0x983e5152ee66dfaba831c66d2db43210b00327c898fb213fbf597fc7beef0ee4;
        k[7] = 0xc6e00bf33da88fc2d5a79147930aa72506ca6351e003826f142929670a0e6e70;
        k[8] = 0x27b70a8546d22ffc2e1b21385c26c9264d2c6dfc5ac42aed53380d139d95b3df;
        k[9] = 0x650a73548baf63de766a0abb3c77b2a881c2c92e47edaee692722c851482353b;
        k[10] = 0xa2bfe8a14cf10364a81a664bbc423001c24b8b70d0f89791c76c51a30654be30;
        k[11] = 0xd192e819d6ef5218d69906245565a910f40e35855771202a106aa07032bbd1b8;
        k[12] = 0x19a4c116b8d2d0c81e376c085141ab532748774cdf8eeb9934b0bcb5e19b48a8;
        k[13] = 0x391c0cb3c5c95a634ed8aa4ae3418acb5b9cca4f7763e373682e6ff3d6b2b8a3;
        k[14] = 0x748f82ee5defb2fc78a5636f43172f6084c87814a1f0ab728cc702081a6439ec;
        k[15] = 0x90befffa23631e28a4506cebde82bde9bef9a3f7b2c67915c67178f2e372532b;
        k[16] = 0xca273eceea26619cd186b8c721c0c207eada7dd6cde0eb1ef57d4f7fee6ed178;
        k[17] = 0x06f067aa72176fba0a637dc5a2c898a6113f9804bef90dae1b710b35131c471b;
        k[18] = 0x28db77f523047d8432caab7b40c724933c9ebe0a15c9bebc431d67c49c100d4c;
        k[19] = 0x4cc5d4becb3e42b6597f299cfc657e2a5fcb6fab3ad6faec6c44198c4a475817;
        uint256[80] memory w;
        for (uint256 off = 0; off < total; off += 128) {
            _block(h, w, k, buf, off);
        }
    }

    function _block(uint256[8] memory h, uint256[80] memory w, uint256[20] memory k, bytes memory buf, uint256 off) private pure {
        unchecked {
            assembly {
                let p := add(add(buf, 32), off)
                for { let t := 0 } lt(t, 16) { t := add(t, 1) } {
                    mstore(add(w, mul(t, 32)), shr(192, mload(add(p, mul(t, 8)))))
                }
            }
            for (uint256 t = 16; t < 80; t++) {
                uint256 x = w[t - 15];
                uint256 y = w[t - 2];
                uint256 s0 = _rotr(x, 1) ^ _rotr(x, 8) ^ (x >> 7);
                uint256 s1 = _rotr(y, 19) ^ _rotr(y, 61) ^ (y >> 6);
                w[t] = (w[t - 16] + s0 + w[t - 7] + s1) & M;
            }
            uint256 a = h[0]; uint256 b = h[1]; uint256 c = h[2]; uint256 d = h[3];
            uint256 e = h[4]; uint256 f = h[5]; uint256 g = h[6]; uint256 hh = h[7];
            for (uint256 t = 0; t < 80; t++) {
                uint256 kt = (k[t >> 2] >> (64 * (3 - (t & 3)))) & M;
                uint256 t1 = hh + (_rotr(e, 14) ^ _rotr(e, 18) ^ _rotr(e, 41)) + ((e & f) ^ ((e ^ M) & g)) + kt + w[t];
                uint256 t2 = (_rotr(a, 28) ^ _rotr(a, 34) ^ _rotr(a, 39)) + ((a & b) ^ (a & c) ^ (b & c));
                hh = g; g = f; f = e; e = (d + t1) & M; d = c; c = b; b = a; a = (t1 + t2) & M;
            }
            h[0] = (h[0] + a) & M; h[1] = (h[1] + b) & M; h[2] = (h[2] + c) & M; h[3] = (h[3] + d) & M;
            h[4] = (h[4] + e) & M; h[5] = (h[5] + f) & M; h[6] = (h[6] + g) & M; h[7] = (h[7] + hh) & M;
        }
    }

    function _rotr(uint256 x, uint256 n) private pure returns (uint256) {
        return ((x >> n) | (x << (64 - n))) & M;
    }
}
