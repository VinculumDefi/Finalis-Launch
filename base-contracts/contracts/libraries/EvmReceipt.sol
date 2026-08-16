// =============================================================================
// EvmReceipt — receipt and log parsing for EVM source-chain lock events
//
// An EVM environment's lock is a vault contract's createLock() emitting an
// event (Architecture C.1-C.7). Proving that lock on Base means proving the
// receipt is committed to by a finalized header's receiptsRoot, then reading
// the event out of that receipt.
//
// MerklePatriciaProof establishes the receipt is authentic. This library reads
// its contents.
//
// RECEIPT STRUCTURE
//   Legacy:      RLP([status, cumulativeGas, logsBloom, logs])
//   EIP-2718:    typeByte || RLP([status, cumulativeGas, logsBloom, logs])
//   Log:         RLP([address, [topic...], data])
//
// SPDX-License-Identifier: PROTOCOL-RESTRICTED
// Solidity 0.8.19+
// =============================================================================

pragma solidity 0.8.19;

library EvmReceipt {

    error RlpOutOfBounds();
    error RlpBadPrefix();
    error NotAReceipt();
    error LogIndexOutOfRange(uint256 index, uint256 count);
    error NoMatchingLog(address emitter, bytes32 topic0);
    error TopicIndexOutOfRange(uint256 index, uint256 count);

    struct Item {
        uint256 ptr;
        uint256 len;
    }

    struct Log {
        address emitter;
        bytes32[] topics;
        bytes data;
    }

    // -------------------------------------------------------------------------
    // Receipt
    // -------------------------------------------------------------------------

    /// @notice Strip an EIP-2718 type byte if present.
    /// @dev Legacy receipts open with an RLP list prefix (>= 0xc0); typed
    ///      receipts open with a type byte below 0x80.
    function stripType(bytes memory receipt) internal pure returns (bytes memory) {
        if (receipt.length == 0) return receipt;
        if (uint8(receipt[0]) >= 0xc0) return receipt;

        bytes memory out = new bytes(receipt.length - 1);
        for (uint256 i = 0; i < out.length; i++) out[i] = receipt[i + 1];
        return out;
    }

    /// @notice The receipt's status field. 1 on success post-Byzantium.
    function status(bytes memory receipt) internal pure returns (uint256 s) {
        Item[] memory f = _decodeList(stripType(receipt));
        if (f.length != 4) revert NotAReceipt();

        for (uint256 i = 0; i < f[0].len; i++) {
            s = (s << 8) | _byteAt(f[0].ptr + i);
        }
    }

    /// @notice Number of logs in the receipt.
    function logCount(bytes memory receipt) internal pure returns (uint256) {
        Item[] memory f = _decodeList(stripType(receipt));
        if (f.length != 4) revert NotAReceipt();
        return _countItems(f[3].ptr, f[3].ptr + f[3].len);
    }

    /// @notice Decode a single log by index.
    function logAt(bytes memory receipt, uint256 index)
        internal pure returns (Log memory out)
    {
        Item[] memory f = _decodeList(stripType(receipt));
        if (f.length != 4) revert NotAReceipt();

        Item[] memory logs = _itemsIn(f[3].ptr, f[3].ptr + f[3].len);
        if (index >= logs.length) revert LogIndexOutOfRange(index, logs.length);

        return _decodeLog(logs[index]);
    }

    /// @notice Find the first log emitted by `emitter` whose first topic is
    ///         `topic0`, and return it.
    /// @dev Both are fixed at the verifier's deployment, so a caller cannot
    ///      redirect this to an arbitrary contract's event.
    function findLog(bytes memory receipt, address emitter, bytes32 topic0)
        internal pure returns (Log memory out)
    {
        Item[] memory f = _decodeList(stripType(receipt));
        if (f.length != 4) revert NotAReceipt();

        Item[] memory logs = _itemsIn(f[3].ptr, f[3].ptr + f[3].len);

        for (uint256 i = 0; i < logs.length; i++) {
            Log memory l = _decodeLog(logs[i]);
            if (l.emitter == emitter && l.topics.length > 0 && l.topics[0] == topic0) {
                return l;
            }
        }
        revert NoMatchingLog(emitter, topic0);
    }

    /// @notice Read a 32-byte word from a log's data section.
    function word(Log memory l, uint256 wordIndex) internal pure returns (bytes32 v) {
        uint256 offset = wordIndex * 32;
        if (offset + 32 > l.data.length) revert RlpOutOfBounds();

        bytes memory d = l.data;
        assembly ("memory-safe") {
            v := mload(add(add(d, 0x20), offset))
        }
    }

    function topic(Log memory l, uint256 index) internal pure returns (bytes32) {
        if (index >= l.topics.length) revert TopicIndexOutOfRange(index, l.topics.length);
        return l.topics[index];
    }

    // -------------------------------------------------------------------------
    // Log decoding
    // -------------------------------------------------------------------------

    function _decodeLog(Item memory raw) private pure returns (Log memory out) {
        Item[] memory parts = _itemsIn(raw.ptr, raw.ptr + raw.len);
        if (parts.length != 3) revert NotAReceipt();

        // address: a 20-byte string.
        if (parts[0].len != 20) revert NotAReceipt();
        uint256 a;
        for (uint256 i = 0; i < 20; i++) {
            a = (a << 8) | _byteAt(parts[0].ptr + i);
        }
        out.emitter = address(uint160(a));

        // topics: a list of 32-byte strings.
        Item[] memory tops = _itemsIn(parts[1].ptr, parts[1].ptr + parts[1].len);
        out.topics = new bytes32[](tops.length);
        for (uint256 i = 0; i < tops.length; i++) {
            if (tops[i].len != 32) revert NotAReceipt();
            uint256 p = tops[i].ptr;
            bytes32 t;
            assembly ("memory-safe") { t := mload(p) }
            out.topics[i] = t;
        }

        // data.
        out.data = _copy(parts[2]);
    }

    // -------------------------------------------------------------------------
    // RLP
    // -------------------------------------------------------------------------

    function _decodeList(bytes memory data) private pure returns (Item[] memory) {
        if (data.length == 0) revert RlpOutOfBounds();

        uint256 ptr;
        assembly ("memory-safe") { ptr := add(data, 0x20) }

        (uint256 payloadPtr, uint256 payloadLen, bool isList) = _header(ptr, data.length);
        if (!isList) revert RlpBadPrefix();
        if (payloadPtr + payloadLen > ptr + data.length) revert RlpOutOfBounds();

        return _itemsIn(payloadPtr, payloadPtr + payloadLen);
    }

    /// @dev Items of a list whose header begins at `ptr`.
    function _itemsInList(uint256 ptr, uint256 len) private pure returns (Item[] memory) {
        (uint256 payloadPtr, uint256 payloadLen, bool isList) = _header(ptr, len);
        if (!isList) revert RlpBadPrefix();
        return _itemsIn(payloadPtr, payloadPtr + payloadLen);
    }

    /// @dev Items in a payload region, header already consumed.
    function _itemsIn(uint256 start, uint256 end) private pure returns (Item[] memory items) {
        uint256 count = _countItems(start, end);
        items = new Item[](count);

        uint256 cursor = start;
        for (uint256 i = 0; i < count; i++) {
            (uint256 p, uint256 l, ) = _header(cursor, end - cursor);
            items[i] = Item({ptr: p, len: l});
            cursor = p + l;
        }
    }

    function _countItems(uint256 start, uint256 end) private pure returns (uint256 count) {
        uint256 cursor = start;
        while (cursor < end) {
            (uint256 p, uint256 l, ) = _header(cursor, end - cursor);
            cursor = p + l;
            if (cursor > end) revert RlpOutOfBounds();
            count++;
        }
    }

    function _header(uint256 ptr, uint256 avail)
        private pure returns (uint256 payloadPtr, uint256 payloadLen, bool isList)
    {
        if (avail == 0) revert RlpOutOfBounds();
        uint8 prefix = _byteAt(ptr);

        if (prefix < 0x80) return (ptr, 1, false);
        if (prefix < 0xb8) return (ptr + 1, prefix - 0x80, false);
        if (prefix < 0xc0) {
            uint256 lol = prefix - 0xb7;
            return (ptr + 1 + lol, _readLen(ptr + 1, lol), false);
        }
        if (prefix < 0xf8) return (ptr + 1, prefix - 0xc0, true);

        uint256 lol2 = prefix - 0xf7;
        return (ptr + 1 + lol2, _readLen(ptr + 1, lol2), true);
    }

    function _readLen(uint256 ptr, uint256 lenOfLen) private pure returns (uint256 out) {
        if (lenOfLen == 0 || lenOfLen > 8) revert RlpBadPrefix();
        for (uint256 i = 0; i < lenOfLen; i++) {
            out = (out << 8) | _byteAt(ptr + i);
        }
    }

    function _byteAt(uint256 p) private pure returns (uint8 v) {
        assembly ("memory-safe") { v := byte(0, mload(p)) }
    }

    function _copy(Item memory it) private pure returns (bytes memory out) {
        out = new bytes(it.len);
        uint256 src = it.ptr;
        uint256 dst;
        assembly ("memory-safe") { dst := add(out, 0x20) }
        for (uint256 i = 0; i < it.len; i += 32) {
            assembly ("memory-safe") { mstore(add(dst, i), mload(add(src, i))) }
        }
    }
}
