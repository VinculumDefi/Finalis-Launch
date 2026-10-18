// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

/// @notice BLS12-381 helpers over the EIP-2537 precompiles (Prague):
/// 0x0b G1ADD, 0x0d G2ADD, 0x0f PAIRING_CHECK, 0x11 MAP_FP2_TO_G2, plus 0x05
/// MODEXP for field reductions. Points use the EIP-2537 encoding (each Fp
/// element is 64 bytes, 16 zero bytes then 48 big-endian bytes).
/// hashToG2 is RFC 9380 hash_to_curve (BLS12381G2_XMD:SHA-256_SSWU_RO_) with
/// the Ethereum proof-of-possession DST.
library Bls12381 {
    bytes internal constant P = hex"1a0111ea397fe69a4b1ba7b6434bacd764774b84f38512bf6730d2a0f6b0f6241eabfffeb153ffffb9feffffffffaaab";
    uint256 internal constant P_HI = 0x1a0111ea397fe69a4b1ba7b6434bacd7;
    uint256 internal constant P_LO = 0x64774b84f38512bf6730d2a0f6b0f6241eabfffeb153ffffb9feffffffffaaab;
    uint256 internal constant HALF_HI = 0x0d0088f51cbff34d258dd3db21a5d66b;
    uint256 internal constant HALF_LO = 0xb23ba5c279c2895fb39869507b587b120f55ffff58a9ffffdcff7fffffffd555;
    bytes internal constant DST = "BLS_SIG_BLS12381G2_XMD:SHA-256_SSWU_RO_POP_";
    /// @dev -G1 generator (x, p - y) in EIP-2537 encoding.
    bytes internal constant NEG_G1 =
        hex"0000000000000000000000000000000017f1d3a73197d7942695638c4fa9ac0fc3688c4f9774b905a14e3a3f171bac586c55e83ff97a1aeffb3af00adb22c6bb"
        hex"00000000000000000000000000000000114d1d6855d545a8aa7d76c8cf2e21f267816aef1db507c96655b9d5caac42364e6f38ba0ecb751bad54dcd6b939c2ca";

    function _call(address to, bytes memory input, uint256 outLen) private view returns (bytes memory out) {
        bool ok;
        (ok, out) = to.staticcall(input);
        require(ok && out.length == outLen, "BLS: precompile");
    }

    /// @dev (base ** e) mod p as 48 big-endian bytes.
    function modexp(bytes memory base, uint8 e) internal view returns (bytes memory) {
        return _call(address(0x05), abi.encodePacked(uint256(base.length), uint256(1), uint256(48), base, e, P), 48);
    }

    function split(bytes memory b48) internal pure returns (uint256 hi, uint256 lo) {
        require(b48.length == 48, "BLS: fp len");
        assembly {
            hi := shr(128, mload(add(b48, 32)))
            lo := mload(add(b48, 48))
        }
    }

    function _lt(uint256 ah, uint256 al, uint256 bh, uint256 bl) private pure returns (bool) {
        return ah < bh || (ah == bh && al < bl);
    }

    /// @dev y^2 == x^3 + 4 (mod p) and x, y < p.
    function onCurveG1(bytes memory x, bytes memory y) internal view returns (bool) {
        (uint256 xh, uint256 xl) = split(x);
        (uint256 yh, uint256 yl) = split(y);
        if (!_lt(xh, xl, P_HI, P_LO) || !_lt(yh, yl, P_HI, P_LO)) return false;
        (uint256 ah, uint256 al) = split(modexp(x, 3));
        (uint256 bh, uint256 bl) = split(modexp(y, 2));
        unchecked {
            uint256 nl = al + 4;
            uint256 nh = ah + (nl < al ? 1 : 0);
            if (!_lt(nh, nl, P_HI, P_LO)) {
                uint256 borrow = nl < P_LO ? 1 : 0;
                nl = nl - P_LO;
                nh = nh - P_HI - borrow;
            }
            return nh == bh && nl == bl;
        }
    }

    /// @dev ZCash compression sign flag: y is the larger root, y > (p-1)/2.
    function yLarger(bytes memory y) internal pure returns (bool) {
        (uint256 yh, uint256 yl) = split(y);
        return _lt(HALF_HI, HALF_LO, yh, yl);
    }

    function g1Add(bytes memory a, bytes memory b) internal view returns (bytes memory) {
        return _call(address(0x0b), abi.encodePacked(a, b), 128);
    }

    function hashToG2(bytes32 message) internal view returns (bytes memory) {
        bytes memory u = _expand(message);
        bytes memory q0 = _call(address(0x11), abi.encodePacked(_fp(u, 0), _fp(u, 64)), 256);
        bytes memory q1 = _call(address(0x11), abi.encodePacked(_fp(u, 128), _fp(u, 192)), 256);
        return _call(address(0x0d), abi.encodePacked(q0, q1), 256);
    }

    /// @dev e(pk, H(m)) == e(G1, sig), checked as e(pk, H) * e(-G1, sig) == 1.
    /// The precompile rejects points off the curve or outside the subgroup.
    function verify(bytes memory pk, bytes32 message, bytes memory sig) internal view returns (bool) {
        require(pk.length == 128 && sig.length == 256, "BLS: point len");
        (bool ok, bytes memory out) =
            address(0x0f).staticcall(abi.encodePacked(pk, hashToG2(message), NEG_G1, sig));
        return ok && out.length == 32 && uint256(bytes32(out)) == 1;
    }

    function _fp(bytes memory u, uint256 off) private view returns (bytes memory) {
        bytes memory chunk = new bytes(64);
        for (uint256 i = 0; i < 64; i++) chunk[i] = u[off + i];
        return abi.encodePacked(bytes16(0), modexp(chunk, 1));
    }

    /// @dev expand_message_xmd(msg, DST, 256) with SHA-256.
    function _expand(bytes32 message) private pure returns (bytes memory out) {
        bytes memory dstPrime = abi.encodePacked(DST, uint8(DST.length));
        bytes32 b0 = sha256(abi.encodePacked(bytes32(0), bytes32(0), message, uint16(256), uint8(0), dstPrime));
        out = new bytes(256);
        bytes32 bi = sha256(abi.encodePacked(b0, uint8(1), dstPrime));
        for (uint8 i = 1; i <= 8; i++) {
            if (i > 1) bi = sha256(abi.encodePacked(b0 ^ bi, i, dstPrime));
            for (uint256 k = 0; k < 32; k++) out[(uint256(i) - 1) * 32 + k] = bi[k];
        }
    }
}
