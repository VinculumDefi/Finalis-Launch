// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

/// @notice Zcash header linkage, Equihash 200,9, difficulty, transparent merkle inclusion, and 10 confirmations.
///
/// Implements the Zcash Protocol Specification (NU6.2 / v2026.7.0):
/// - section 5.4.1.2 BLAKE2b-l(personalization, input), unkeyed sequential mode;
/// - section 5.4.1.11 Equihash Generator (powtag "ZcashPoW" || uint32le(n) || uint32le(k));
/// - section 7.7.1 Equihash for n = 200, k = 9;
/// - section 7.7.2 difficulty filter;
/// - section 7.7.4 ToTarget.
///
/// The Equihash input is powheader: the first 140 bytes of the serialized header
/// (nVersion, hashPrevBlock, hashMerkleRoot, hashReserved, nTime, nBits, nNonce).
/// It is not SHA-256d, and it does not include solutionSize or solution.
/// Section 7.7.2 is a separate check: SHA-256d of the entire header, including the
/// solution, interpreted as a little-endian 256-bit integer, must be <= ToTarget(nBits).
/// The block hash used to link hashPrevBlock is that same SHA-256d digest.
///
/// BLAKE2b compression is the EIP-152 BLAKE2f precompile (address 0x09, 12 rounds),
/// which is the F function from RFC 7693. The parameter block is digest length 50,
/// fanout 1, depth 1, and the 16-byte Zcash powtag.
contract ZcashHeaderChecker {
    uint256 public constant CONFIRMATIONS = 10;
    uint32 public constant V5_HEADER = 0x80000005;
    uint32 public constant V5_VERSION_GROUP_ID = 0x26A7270A;
    uint256 public constant PREFIX_SIZE = 140;
    uint256 public constant SOLUTION_LEN = 1344;
    uint256 public constant HEADER_LEN = 1487;
    uint256 public constant INDEX_COUNT = 512;

    // BLAKE2b state after the parameter-block XOR, before any message block.
    // Little-endian uint64 words packed in byte order. digest length 50, personalization
    // 5a63617368506f57 || c8000000 || 09000000.
    bytes32 internal constant H0 = 0x3ac9bdf267e6096a3ba7ca8485ae67bb2bf894fe72f36e3cf1361d5f3af54fa5;
    bytes32 internal constant H1 = 0xd182e6ad7f520e511f6c3e2b8c68059b31de2088c389ec48b1217e1310cde05b;

    error BadHeader();
    error HashMismatch();
    error BrokenLink();
    error NotEnoughConfirmations();
    error BadMerkleProof();
    error Shielded();
    error BadEquihash();
    error AboveTarget();

    struct HeaderView {
        uint32 version;
        bytes32 prevHash;
        bytes32 merkleRoot;
        bytes32 finalSaplingRoot;
        uint32 time;
        uint32 bits;
        bytes32 nonce;
        uint256 solutionLength;
    }

    function verify(
        bytes[] calldata headers,
        bytes32[] calldata claimedHashes,
        uint256 lockIndex,
        bytes calldata rawTx,
        bytes32 txid,
        bytes32[] calldata siblings,
        uint256 txIndex
    ) external view {
        assertTransparent(rawTx);
        if (headers.length != claimedHashes.length || headers.length == 0) revert HashMismatch();
        if (lockIndex >= headers.length) revert NotEnoughConfirmations();
        if (headers.length - lockIndex - 1 < CONFIRMATIONS) revert NotEnoughConfirmations();

        for (uint256 i = 0; i < headers.length; i++) {
            HeaderView memory view_ = parseHeader(headers[i]);
            bytes32 got = sha256(abi.encodePacked(sha256(headers[i])));
            if (got != claimedHashes[i]) revert HashMismatch();
            if (i > 0 && view_.prevHash != claimedHashes[i - 1]) revert BrokenLink();
            checkWork(headers[i]);
        }

        bytes32 root = parseHeader(headers[lockIndex]).merkleRoot;
        if (_merkle(txid, siblings, txIndex) != root) revert BadMerkleProof();
    }

    /// @notice Section 7.7: a valid Equihash solution and a header hash at or under nBits.
    function checkWork(bytes calldata header) public view {
        verifyEquihash(header);
        verifyTarget(header);
    }

    /// @notice Section 7.7.1. powheader is header[0:140]. The 1344-byte solution is not hashed into it.
    function verifyEquihash(bytes calldata header) public view {
        if (header.length != HEADER_LEN || uint8(header[140]) != 0xfd || uint8(header[141]) != 0x40 || uint8(header[142]) != 0x05) {
            revert BadEquihash();
        }
        uint32[512] memory idx;
        _decodeIndices(header, idx);
        _assertDistinct(idx);
        _assertOrdered(idx);
        uint256[512] memory xs = _generate(header, idx);
        _assertBindingXor(xs);
    }

    /// @notice Section 7.7.2. Little-endian SHA-256d of the whole header, including the solution.
    function verifyTarget(bytes calldata header) public pure {
        HeaderView memory view_ = parseHeader(header);
        bytes32 digest = sha256(abi.encodePacked(sha256(header)));
        if (_bswap(uint256(digest)) > _toTarget(view_.bits)) revert AboveTarget();
    }

    function parseHeader(bytes calldata header) public pure returns (HeaderView memory view_) {
        if (header.length < PREFIX_SIZE + 1) revert BadHeader();
        view_.version = _u32le(header, 0);
        view_.prevHash = _word(header, 4);
        view_.merkleRoot = _word(header, 36);
        view_.finalSaplingRoot = _word(header, 68);
        view_.time = _u32le(header, 100);
        view_.bits = _u32le(header, 104);
        view_.nonce = _word(header, 108);
        uint256 cursor;
        (view_.solutionLength, cursor) = _compact(header, PREFIX_SIZE);
        if (cursor + view_.solutionLength != header.length) revert BadHeader();
    }

    /// @notice ZIP 225 v5. Rejects a nonzero Sapling or Orchard bundle count.
    function assertTransparent(bytes calldata raw) public pure {
        if (raw.length < 23) revert Shielded();
        if (_u32le(raw, 0) != V5_HEADER || _u32le(raw, 4) != V5_VERSION_GROUP_ID) revert Shielded();
        uint256 i = 20;
        uint256 n;
        (n, i) = _compact(raw, i);
        for (uint256 k = 0; k < n; k++) {
            if (i + 36 > raw.length) revert Shielded();
            i += 36;
            uint256 scriptLen;
            (scriptLen, i) = _compact(raw, i);
            if (i + scriptLen + 4 > raw.length) revert Shielded();
            i += scriptLen + 4;
        }
        (n, i) = _compact(raw, i);
        for (uint256 k = 0; k < n; k++) {
            if (i + 8 > raw.length) revert Shielded();
            i += 8;
            uint256 scriptLen;
            (scriptLen, i) = _compact(raw, i);
            if (i + scriptLen > raw.length) revert Shielded();
            i += scriptLen;
        }
        uint256 spends;
        uint256 outputs;
        uint256 actions;
        (spends, i) = _compact(raw, i);
        (outputs, i) = _compact(raw, i);
        (actions, i) = _compact(raw, i);
        if (spends != 0 || outputs != 0 || actions != 0 || i != raw.length) revert Shielded();
    }

    function _generate(bytes calldata header, uint32[512] memory idx) private view returns (uint256[512] memory xs) {
        bytes memory args = new bytes(213);
        args[3] = 0x0c;
        _setH(args, H0, H1);
        _copyIntoM(args, header, 0);
        _setTF(args, 128, 0);
        (bytes32 s0, bytes32 s1) = _blake2f(args);
        _zeroM(args);
        _copyTail(args, header);
        _setTF(args, 144, 1);
        for (uint256 j = 0; j < INDEX_COUNT; j++) {
            uint32 raw = idx[j];
            _setH(args, s0, s1);
            _setG(args, raw >> 1);
            (bytes32 d0, bytes32 d1) = _blake2f(args);
            xs[j] = (raw & 1) == 0 ? _even(d0) : _odd(d0, d1);
        }
    }

    function _assertBindingXor(uint256[512] memory xs) private pure {
        for (uint256 r = 1; r <= 8; r++) {
            uint256 span = 1 << r;
            uint256 groups = 1 << (9 - r);
            uint256 shift = 200 - (20 * r);
            for (uint256 w = 0; w < groups; w++) {
                uint256 x;
                uint256 base = w * span;
                for (uint256 j = 0; j < span; j++) {
                    x ^= xs[base + j];
                }
                if ((x >> shift) != 0) revert BadEquihash();
            }
        }
        uint256 all;
        for (uint256 i = 0; i < INDEX_COUNT; i++) {
            all ^= xs[i];
        }
        if (all != 0) revert BadEquihash();
    }

    function _assertOrdered(uint32[512] memory idx) private pure {
        for (uint256 r = 1; r <= 9; r++) {
            uint256 half = 1 << (r - 1);
            uint256 groups = 1 << (9 - r);
            for (uint256 w = 0; w < groups; w++) {
                uint256 a = w * (half << 1);
                uint256 b = a + half;
                bool less;
                for (uint256 k = 0; k < half; k++) {
                    uint32 left = idx[a + k];
                    uint32 right = idx[b + k];
                    if (left < right) {
                        less = true;
                        break;
                    }
                    if (left > right) revert BadEquihash();
                }
                if (!less) revert BadEquihash();
            }
        }
    }

    function _assertDistinct(uint32[512] memory idx) private pure {
        // 2^21 bits. Memory expansion is far cheaper than sorting.
        uint256[8192] memory seen;
        for (uint256 i = 0; i < INDEX_COUNT; i++) {
            uint256 raw = idx[i];
            uint256 word = raw >> 8;
            uint256 mask = uint256(1) << (raw & 255);
            if ((seen[word] & mask) != 0) revert BadEquihash();
            seen[word] |= mask;
        }
    }

    function _decodeIndices(bytes calldata header, uint32[512] memory idx) private pure {
        uint256 acc;
        uint256 bits;
        uint256 p = 143;
        for (uint256 j = 0; j < INDEX_COUNT; j++) {
            while (bits < 21) {
                acc = (acc << 8) | uint8(header[p]);
                p += 1;
                bits += 8;
            }
            bits -= 21;
            idx[j] = uint32((acc >> bits) & ((1 << 21) - 1));
            acc &= (1 << bits) - 1;
        }
        if (bits != 0 || p != HEADER_LEN) revert BadEquihash();
    }

    function _setH(bytes memory args, bytes32 lo, bytes32 hi) private pure {
        assembly {
            mstore(add(args, 36), lo)
            mstore(add(args, 68), hi)
        }
    }

    function _copyIntoM(bytes memory args, bytes calldata src, uint256 off) private pure {
        assembly {
            calldatacopy(add(args, 100), add(src.offset, off), 128)
        }
    }

    function _zeroM(bytes memory args) private pure {
        assembly {
            let p := add(args, 100)
            mstore(p, 0)
            mstore(add(p, 32), 0)
            mstore(add(p, 64), 0)
            mstore(add(p, 96), 0)
        }
    }

    function _copyTail(bytes memory args, bytes calldata header) private pure {
        assembly {
            calldatacopy(add(args, 100), add(header.offset, 128), 12)
        }
    }

    function _setG(bytes memory args, uint32 g) private pure {
        args[80] = bytes1(uint8(g));
        args[81] = bytes1(uint8(g >> 8));
        args[82] = bytes1(uint8(g >> 16));
        args[83] = bytes1(uint8(g >> 24));
    }

    function _setTF(bytes memory args, uint16 t, uint8 f) private pure {
        args[196] = bytes1(uint8(t));
        args[197] = bytes1(uint8(t >> 8));
        args[198] = 0;
        args[199] = 0;
        args[200] = 0;
        args[201] = 0;
        args[202] = 0;
        args[203] = 0;
        args[212] = bytes1(f);
    }

    function _blake2f(bytes memory args) private view returns (bytes32 lo, bytes32 hi) {
        assembly {
            let out := mload(0x40)
            if iszero(staticcall(gas(), 0x09, add(args, 32), 213, out, 64)) {
                revert(0, 0)
            }
            lo := mload(out)
            hi := mload(add(out, 32))
        }
    }

    function _even(bytes32 d0) private pure returns (uint256) {
        return uint256(d0) >> 56;
    }

    function _odd(bytes32 d0, bytes32 d1) private pure returns (uint256) {
        return ((uint256(d0) & ((1 << 56) - 1)) << 144) | (uint256(d1) >> 112);
    }

    /// @notice Section 7.7.4. A set sign bit yields target 0. Otherwise mantissa * 256^(exponent-3).
    function _toTarget(uint32 bits) private pure returns (uint256) {
        if ((bits & 0x800000) != 0) return 0;
        uint256 mant = uint256(bits) & 0x7fffff;
        uint256 exp = uint256(bits) >> 24;
        if (exp <= 3) return mant >> (8 * (3 - exp));
        uint256 shift = 8 * (exp - 3);
        if (shift >= 256) revert BadHeader();
        return mant << shift;
    }

    function _bswap(uint256 input) private pure returns (uint256 v) {
        assembly {
            for { let i := 0 } lt(i, 32) { i := add(i, 1) } {
                v := or(v, shl(mul(i, 8), byte(i, input)))
            }
        }
    }

    function _merkle(bytes32 leaf, bytes32[] calldata siblings, uint256 index) internal pure returns (bytes32 h) {
        h = leaf;
        for (uint256 i = 0; i < siblings.length; i++) {
            if ((index & 1) == 1) h = _pair(siblings[i], h);
            else h = _pair(h, siblings[i]);
            index >>= 1;
        }
        if (index != 0) revert BadMerkleProof();
    }

    function _pair(bytes32 a, bytes32 b) internal pure returns (bytes32) {
        return sha256(abi.encodePacked(sha256(abi.encodePacked(a, b))));
    }

    function _compact(bytes calldata data, uint256 offset) internal pure returns (uint256 n, uint256 next) {
        if (offset >= data.length) revert BadHeader();
        uint8 prefix = uint8(data[offset]);
        if (prefix < 0xFD) return (prefix, offset + 1);
        if (prefix == 0xFD) {
            if (offset + 3 > data.length) revert BadHeader();
            n = uint256(uint8(data[offset + 1])) | (uint256(uint8(data[offset + 2])) << 8);
            return (n, offset + 3);
        }
        revert BadHeader();
    }

    function _word(bytes calldata data, uint256 offset) internal pure returns (bytes32 word) {
        if (offset + 32 > data.length) revert BadHeader();
        assembly {
            word := calldataload(add(data.offset, offset))
        }
    }

    function _u32le(bytes calldata data, uint256 offset) internal pure returns (uint32) {
        if (offset + 4 > data.length) revert BadHeader();
        return uint32(uint8(data[offset]))
            | (uint32(uint8(data[offset + 1])) << 8)
            | (uint32(uint8(data[offset + 2])) << 16)
            | (uint32(uint8(data[offset + 3])) << 24);
    }
}
