// =============================================================================
// MerklePatriciaProof — RLP decoding and Merkle-Patricia trie proof verification
//
// Every EVM environment's proof path (Section O) rests on proving that a
// receipt, and therefore a log, is committed to by a block header's
// receiptsRoot. This library performs that proof. It is independent of how the
// header itself is established as canonical — that is the verifier's problem,
// and differs per chain.
//
// WHAT THIS PROVES
//   Given a trie root, a key, and the RLP-encoded nodes along the path from
//   root to leaf, it returns the committed value — or reverts. Each node is
//   checked by hash against the parent's reference, so an attacker cannot
//   substitute a node without breaking the chain of hashes back to the root.
//
// WHAT THIS DOES NOT PROVE
//   That the root belongs to a canonical block. A valid proof against a
//   fabricated root proves only that the fabricator is internally consistent —
//   the CL-76 failure. The caller MUST establish the root independently.
//
// SPDX-License-Identifier: PROTOCOL-RESTRICTED
// Solidity 0.8.19+
// =============================================================================

pragma solidity 0.8.19;

library MerklePatriciaProof {

    error EmptyProof();
    error NodeHashMismatch(uint256 depth);
    error MalformedNode(uint256 depth);
    error PathDivergence(uint256 depth);
    error KeyExhausted();
    error UnexpectedNodeArity(uint256 items);
    error RlpOutOfBounds();
    error RlpBadPrefix();

    struct Item {
        uint256 ptr;   // memory pointer to the payload
        uint256 len;   // payload length
    }

    // -------------------------------------------------------------------------
    // Proof verification
    // -------------------------------------------------------------------------

    /// @notice Verify a Merkle-Patricia inclusion proof.
    /// @param root Trie root the proof must chain back to.
    /// @param key Unhashed key bytes (for receipts, the RLP-encoded index).
    /// @param proof RLP-encoded nodes ordered root-first.
    /// @return value The committed value at `key`.
    function verify(
        bytes32 root,
        bytes memory key,
        bytes[] memory proof
    ) internal pure returns (bytes memory value) {
        if (proof.length == 0) revert EmptyProof();

        bytes memory nibbles = _toNibbles(key);
        uint256 offset = 0;              // nibbles consumed so far
        bytes32 expected = root;

        for (uint256 d = 0; d < proof.length; d++) {
            bytes memory node = proof[d];

            // The chain of hashes is what makes substitution impossible.
            if (keccak256(node) != expected) revert NodeHashMismatch(d);

            Item[] memory items = _decodeList(node);

            if (items.length == 17) {
                // Branch node.
                if (offset == nibbles.length) {
                    // Key ends here: the value sits in slot 16.
                    return _copy(items[16]);
                }
                uint8 nib = uint8(nibbles[offset]);
                offset += 1;

                Item memory next = items[nib];
                if (next.len == 0) revert PathDivergence(d);
                expected = _toBytes32(next);

            } else if (items.length == 2) {
                // Leaf or extension. The first item is a hex-prefixed path.
                bytes memory encodedPath = _copy(items[0]);
                if (encodedPath.length == 0) revert MalformedNode(d);

                uint8 flag = uint8(encodedPath[0]) >> 4;
                bool isLeaf = (flag == 2 || flag == 3);
                bool oddLen = (flag == 1 || flag == 3);

                bytes memory path = _pathNibbles(encodedPath, oddLen);

                // Every nibble of the node's path must match the key.
                if (offset + path.length > nibbles.length) revert PathDivergence(d);
                for (uint256 i = 0; i < path.length; i++) {
                    if (nibbles[offset + i] != path[i]) revert PathDivergence(d);
                }
                offset += path.length;

                if (isLeaf) {
                    if (offset != nibbles.length) revert PathDivergence(d);
                    return _copy(items[1]);
                }

                expected = _toBytes32(items[1]);

            } else {
                revert UnexpectedNodeArity(items.length);
            }
        }

        revert KeyExhausted();
    }

    // -------------------------------------------------------------------------
    // Receipt helpers
    // -------------------------------------------------------------------------

    /// @notice Strip the transaction-type byte from a typed receipt (EIP-2718).
    /// @dev Legacy receipts start with an RLP list prefix (>= 0xc0). Typed
    ///      receipts start with a type byte below 0x80.
    function stripReceiptType(bytes memory receipt) internal pure returns (bytes memory) {
        if (receipt.length == 0) return receipt;
        uint8 first = uint8(receipt[0]);
        if (first >= 0xc0) return receipt;              // legacy

        bytes memory out = new bytes(receipt.length - 1);
        for (uint256 i = 0; i < out.length; i++) {
            out[i] = receipt[i + 1];
        }
        return out;
    }

    /// @notice Decode a receipt into its four RLP fields.
    /// @return status Post-Byzantium status byte, 1 on success.
    /// @return logsRlp The raw RLP of the logs list.
    function decodeReceipt(bytes memory receipt)
        internal pure returns (uint256 status, bytes memory logsRlp)
    {
        Item[] memory fields = _decodeList(stripReceiptType(receipt));
        if (fields.length != 4) revert MalformedNode(0);

        bytes memory statusBytes = _copy(fields[0]);
        status = 0;
        for (uint256 i = 0; i < statusBytes.length; i++) {
            status = (status << 8) | uint8(statusBytes[i]);
        }

        logsRlp = _copyWithHeader(fields[3]);
    }

    // -------------------------------------------------------------------------
    // RLP decoding
    // -------------------------------------------------------------------------

    /// @dev Decodes an RLP list into its items. Reverts if the input is not a
    ///      list or if any declared length exceeds the buffer.
    function _decodeList(bytes memory data) private pure returns (Item[] memory) {
        if (data.length == 0) revert RlpOutOfBounds();

        uint256 ptr;
        assembly ("memory-safe") { ptr := add(data, 0x20) }

        (uint256 payloadPtr, uint256 payloadLen, bool isList) = _header(ptr, data.length);
        if (!isList) revert RlpBadPrefix();

        uint256 end = payloadPtr + payloadLen;
        if (end > ptr + data.length) revert RlpOutOfBounds();

        // Count items, then fill. Two passes avoids dynamic array growth.
        uint256 count = 0;
        uint256 cursor = payloadPtr;
        while (cursor < end) {
            (uint256 p, uint256 l, ) = _header(cursor, end - cursor);
            cursor = p + l;
            if (cursor > end) revert RlpOutOfBounds();
            count++;
        }

        Item[] memory items = new Item[](count);
        cursor = payloadPtr;
        for (uint256 i = 0; i < count; i++) {
            (uint256 p, uint256 l, ) = _header(cursor, end - cursor);
            items[i] = Item({ptr: p, len: l});
            cursor = p + l;
        }
        return items;
    }

    /// @dev Reads an RLP header at `ptr`, returning the payload location,
    ///      payload length, and whether the item is a list.
    function _header(uint256 ptr, uint256 avail)
        private pure returns (uint256 payloadPtr, uint256 payloadLen, bool isList)
    {
        if (avail == 0) revert RlpOutOfBounds();

        uint8 prefix;
        assembly ("memory-safe") { prefix := byte(0, mload(ptr)) }

        if (prefix < 0x80) {
            return (ptr, 1, false);                       // single byte
        }
        if (prefix < 0xb8) {
            return (ptr + 1, prefix - 0x80, false);       // short string
        }
        if (prefix < 0xc0) {
            uint256 lenOfLen = prefix - 0xb7;
            return (ptr + 1 + lenOfLen, _readLen(ptr + 1, lenOfLen), false);
        }
        if (prefix < 0xf8) {
            return (ptr + 1, prefix - 0xc0, true);        // short list
        }
        uint256 lol = prefix - 0xf7;
        return (ptr + 1 + lol, _readLen(ptr + 1, lol), true);
    }

    function _readLen(uint256 ptr, uint256 lenOfLen) private pure returns (uint256 out) {
        if (lenOfLen == 0 || lenOfLen > 8) revert RlpBadPrefix();
        for (uint256 i = 0; i < lenOfLen; i++) {
            uint8 b;
            assembly ("memory-safe") { b := byte(0, mload(add(ptr, i))) }
            out = (out << 8) | b;
        }
    }

    // -------------------------------------------------------------------------
    // Memory and nibble helpers
    // -------------------------------------------------------------------------

    function _copy(Item memory it) private pure returns (bytes memory out) {
        out = new bytes(it.len);
        uint256 src = it.ptr;
        uint256 dst;
        assembly ("memory-safe") { dst := add(out, 0x20) }
        for (uint256 i = 0; i < it.len; i += 32) {
            assembly ("memory-safe") { mstore(add(dst, i), mload(add(src, i))) }
        }
    }

    /// @dev Re-serializes an item including its RLP header, for nested lists.
    function _copyWithHeader(Item memory it) private pure returns (bytes memory) {
        // The header sits immediately before the payload for every form we
        // handle; recovering it exactly requires the original prefix, so the
        // payload alone is returned and callers decode it as a list body.
        return _copy(it);
    }

    function _toBytes32(Item memory it) private pure returns (bytes32 out) {
        if (it.len != 32) revert MalformedNode(0);
        uint256 p = it.ptr;
        assembly ("memory-safe") { out := mload(p) }
    }

    /// @dev Expands bytes into one nibble per output byte.
    function _toNibbles(bytes memory input) private pure returns (bytes memory out) {
        out = new bytes(input.length * 2);
        for (uint256 i = 0; i < input.length; i++) {
            out[i * 2]     = bytes1(uint8(input[i]) >> 4);
            out[i * 2 + 1] = bytes1(uint8(input[i]) & 0x0f);
        }
    }

    /// @dev Nibbles of a hex-prefixed path, dropping the prefix nibble and, for
    ///      even-length paths, the padding nibble.
    function _pathNibbles(bytes memory encoded, bool oddLen)
        private pure returns (bytes memory out)
    {
        bytes memory all = _toNibbles(encoded);
        uint256 skip = oddLen ? 1 : 2;
        out = new bytes(all.length - skip);
        for (uint256 i = 0; i < out.length; i++) {
            out[i] = all[i + skip];
        }
    }
}
