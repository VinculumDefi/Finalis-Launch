// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

/// @notice Checks a Bitcoin header chain. Confirmations are headers after the
/// lock header, not a caller-supplied depth integer.
/// Equihash is not relevant here. Each header is 80 bytes. The block hash is
/// SHA256d, and proof-of-work uses the header's own nBits (little-endian hash
/// integer at or under the compact target).
contract BitcoinHeaderChecker {
    uint256 public constant CONFIRMATIONS = 6;
    uint256 public constant HEADER_SIZE = 80;

    error BadHeaderLength();
    error HashMismatch();
    error BrokenLink();
    error NotEnoughConfirmations();
    error BadMerkleProof();
    error BadPow();

    /// @param headers Chain order. `lockIndex` is the header that commits to the lock transaction.
    /// @param claimedHashes SHA256d of each header, raw digest order (the same bytes the next header stores as prev).
    /// @param txid Lock transaction id, raw SHA256d digest.
    /// @param siblings Merkle siblings from the leaf toward the root, raw digest order.
    /// @param txIndex Leaf index of the lock transaction in that block.
    function verify(
        bytes[] calldata headers,
        bytes32[] calldata claimedHashes,
        uint256 lockIndex,
        bytes32 txid,
        bytes32[] calldata siblings,
        uint256 txIndex
    ) external pure {
        if (headers.length != claimedHashes.length || headers.length == 0) revert HashMismatch();
        if (lockIndex >= headers.length) revert NotEnoughConfirmations();
        if (headers.length - lockIndex - 1 < CONFIRMATIONS) revert NotEnoughConfirmations();

        for (uint256 i = 0; i < headers.length; i++) {
            bytes calldata header = headers[i];
            if (header.length != HEADER_SIZE) revert BadHeaderLength();
            bytes32 got = _sha256d(header);
            if (got != claimedHashes[i]) revert HashMismatch();
            if (!_powOk(header, got)) revert BadPow();
            if (i > 0) {
                bytes32 prevField = _word(header, 4);
                if (prevField != claimedHashes[i - 1]) revert BrokenLink();
            }
        }

        bytes32 root = _word(headers[lockIndex], 36);
        if (_merkle(txid, siblings, txIndex) != root) revert BadMerkleProof();
    }

    function _powOk(bytes calldata header, bytes32 digest) internal pure returns (bool) {
        uint32 bits = _u32le(header, 72);
        uint256 target = _target(bits);
        return _le(digest) <= target;
    }

    function _target(uint32 bits) internal pure returns (uint256) {
        uint256 exp = uint256(bits) >> 24;
        uint256 mant = uint256(bits) & 0x7fffff;
        if ((bits & 0x800000) != 0 || mant == 0 || exp == 0 || exp > 32) revert BadPow();
        if (exp <= 3) return mant >> (8 * (3 - exp));
        return mant << (8 * (exp - 3));
    }

    /// @dev Bitcoin compares the hash as a little-endian integer. Digest byte 0 is the least significant.
    function _le(bytes32 digest) internal pure returns (uint256 n) {
        for (uint256 i = 0; i < 32; i++) {
            n |= uint256(uint8(digest[i])) << (8 * i);
        }
    }

    function _merkle(bytes32 leaf, bytes32[] calldata siblings, uint256 index) internal pure returns (bytes32 h) {
        h = leaf;
        for (uint256 i = 0; i < siblings.length; i++) {
            if ((index & 1) == 1) h = _sha256dPair(siblings[i], h);
            else h = _sha256dPair(h, siblings[i]);
            index >>= 1;
        }
        if (index != 0) revert BadMerkleProof();
    }

    function _sha256d(bytes calldata data) internal pure returns (bytes32) {
        return sha256(abi.encodePacked(sha256(data)));
    }

    function _sha256dPair(bytes32 a, bytes32 b) internal pure returns (bytes32) {
        return sha256(abi.encodePacked(sha256(abi.encodePacked(a, b))));
    }

    function _word(bytes calldata data, uint256 offset) internal pure returns (bytes32 word) {
        if (offset + 32 > data.length) revert BadHeaderLength();
        assembly {
            word := calldataload(add(data.offset, offset))
        }
    }

    function _u32le(bytes calldata data, uint256 offset) internal pure returns (uint32) {
        if (offset + 4 > data.length) revert BadHeaderLength();
        return uint32(uint8(data[offset]))
            | (uint32(uint8(data[offset + 1])) << 8)
            | (uint32(uint8(data[offset + 2])) << 16)
            | (uint32(uint8(data[offset + 3])) << 24);
    }
}
