// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

/// @notice Merkle-Patricia receipt proof.
/// Nibble path and keccak node hashes, as specified for the Ethereum execution trie.
/// https://ethereum.org/developers/docs/data-structures-and-encoding/patricia-merkle-trie/
/// The trie key is the RLP encoding of the receipt index. The trie value is the receipt.
library MptProof {
    function verifyReceipt(
        bytes32 root,
        uint256 index,
        bytes memory receipt,
        bytes[] memory nodes
    ) internal pure {
        require(nodes.length > 0, "empty mpt");
        require(keccak256(nodes[0]) == root, "receipts root");
        bytes memory key = rlpUint(index);
        uint8[] memory nibbles = toNibbles(key);
        bytes memory node = nodes[0];
        uint256 proofIndex = 1;
        uint256 nibblePos;
        for (uint256 steps = 0; steps < 64; steps++) {
            bytes[] memory items = rlpListItems(node);
            if (items.length == 17) {
                if (nibblePos == nibbles.length) {
                    require(keccak256(rlpStringPayload(items[16])) == keccak256(receipt), "branch value");
                    require(proofIndex == nodes.length, "trailing");
                    return;
                }
                (node, proofIndex) = follow(items[nibbles[nibblePos]], nodes, proofIndex);
                nibblePos += 1;
            } else if (items.length == 2) {
                (bool isLeaf, uint8[] memory path) = decodeHp(rlpStringPayload(items[0]));
                require(nibblePos + path.length <= nibbles.length, "path overrun");
                for (uint256 i = 0; i < path.length; i++) {
                    require(nibbles[nibblePos + i] == path[i], "nibble");
                }
                nibblePos += path.length;
                if (isLeaf) {
                    require(nibblePos == nibbles.length, "leaf key");
                    require(keccak256(rlpStringPayload(items[1])) == keccak256(receipt), "receipt");
                    require(proofIndex == nodes.length, "trailing");
                    return;
                }
                (node, proofIndex) = follow(items[1], nodes, proofIndex);
            } else {
                revert("node");
            }
        }
        revert("mpt depth");
    }

    function follow(
        bytes memory child,
        bytes[] memory nodes,
        uint256 proofIndex
    ) private pure returns (bytes memory node, uint256 nextIndex) {
        require(child.length > 0, "child");
        uint8 b = uint8(child[0]);
        if (b == 0x80) revert("empty child");
        if (b == 0xa0) {
            require(child.length == 33, "hash ref");
            bytes32 h;
            assembly {
                h := mload(add(child, 33))
            }
            require(proofIndex < nodes.length, "proof short");
            node = nodes[proofIndex];
            require(keccak256(node) == h, "child hash");
            return (node, proofIndex + 1);
        }
        require(b >= 0xc0, "bad child");
        return (child, proofIndex);
    }

    function toNibbles(bytes memory key) private pure returns (uint8[] memory nibbles) {
        nibbles = new uint8[](key.length * 2);
        for (uint256 i = 0; i < key.length; i++) {
            nibbles[i * 2] = uint8(key[i]) >> 4;
            nibbles[i * 2 + 1] = uint8(key[i]) & 0x0f;
        }
    }

    /// @dev Hex-prefix path. High nibble 0/1 extension, 2/3 leaf; odd flag is the low bit.
    function decodeHp(bytes memory path) private pure returns (bool isLeaf, uint8[] memory nibbles) {
        require(path.length > 0, "hp");
        uint8 first = uint8(path[0]);
        uint8 prefix = first >> 4;
        require(prefix <= 3, "hp prefix");
        isLeaf = prefix >= 2;
        bool odd = prefix % 2 == 1;
        uint256 count = path.length * 2 - (odd ? 1 : 2);
        nibbles = new uint8[](count);
        uint256 idx;
        if (odd) nibbles[idx++] = first & 0x0f;
        for (uint256 i = 1; i < path.length; i++) {
            uint8 c = uint8(path[i]);
            nibbles[idx++] = c >> 4;
            nibbles[idx++] = c & 0x0f;
        }
    }

    function rlpUint(uint256 n) private pure returns (bytes memory) {
        if (n == 0) return hex"80";
        bytes memory be = new bytes(32);
        assembly {
            mstore(add(be, 32), n)
        }
        uint256 start = 0;
        while (start < 32 && be[start] == 0) start++;
        bytes memory raw = sliceBytes(be, start, 32);
        if (raw.length == 1 && uint8(raw[0]) < 0x80) return raw;
        return encodeString(raw);
    }

    function encodeString(bytes memory raw) private pure returns (bytes memory out) {
        require(raw.length < 56, "rlp uint");
        out = new bytes(raw.length + 1);
        out[0] = bytes1(uint8(0x80 + raw.length));
        for (uint256 i = 0; i < raw.length; i++) out[i + 1] = raw[i];
    }

    function rlpListItems(bytes memory item) private pure returns (bytes[] memory) {
        require(item.length > 0 && uint8(item[0]) >= 0xc0, "not list");
        (uint256 start, uint256 end) = payloadBounds(item);
        uint256 count;
        uint256 p = start;
        while (p < end) {
            uint256 next = itemEnd(item, p);
            require(next > p && next <= end, "item");
            p = next;
            count++;
        }
        bytes[] memory out = new bytes[](count);
        p = start;
        for (uint256 i = 0; i < count; i++) {
            uint256 next = itemEnd(item, p);
            out[i] = sliceBytes(item, p, next);
            p = next;
        }
        return out;
    }

    function rlpStringPayload(bytes memory item) private pure returns (bytes memory) {
        require(item.length > 0 && uint8(item[0]) < 0xc0, "not string");
        if (uint8(item[0]) < 0x80) return item;
        (uint256 start, uint256 end) = payloadBounds(item);
        return sliceBytes(item, start, end);
    }

    function payloadBounds(bytes memory item) private pure returns (uint256 start, uint256 end) {
        uint8 b = uint8(item[0]);
        if (b < 0x80) return (0, 1);
        if (b < 0xb8) {
            require(item.length == 1 + (b - 0x80), "str");
            return (1, item.length);
        }
        if (b < 0xc0) {
            uint256 lol = b - 0xb7;
            uint256 len = readLen(item, 1, lol);
            require(len >= 56, "noncanon str");
            require(item.length == 1 + lol + len, "lstr");
            return (1 + lol, item.length);
        }
        if (b < 0xf8) {
            require(item.length == 1 + (b - 0xc0), "list");
            return (1, item.length);
        }
        uint256 lol2 = b - 0xf7;
        uint256 len2 = readLen(item, 1, lol2);
        require(len2 >= 56, "noncanon list");
        require(item.length == 1 + lol2 + len2, "llist");
        return (1 + lol2, item.length);
    }

    function itemEnd(bytes memory data, uint256 offset) private pure returns (uint256) {
        require(offset < data.length, "oob");
        uint8 b = uint8(data[offset]);
        if (b < 0x80) return offset + 1;
        if (b < 0xb8) {
            uint256 end = offset + 1 + (b - 0x80);
            require(end <= data.length, "str oob");
            return end;
        }
        if (b < 0xc0) {
            uint256 lol = b - 0xb7;
            uint256 len = readLen(data, offset + 1, lol);
            uint256 end = offset + 1 + lol + len;
            require(end <= data.length, "lstr oob");
            return end;
        }
        if (b < 0xf8) {
            uint256 end = offset + 1 + (b - 0xc0);
            require(end <= data.length, "list oob");
            return end;
        }
        uint256 lol2 = b - 0xf7;
        uint256 len2 = readLen(data, offset + 1, lol2);
        uint256 end2 = offset + 1 + lol2 + len2;
        require(end2 <= data.length, "llist oob");
        return end2;
    }

    function readLen(bytes memory data, uint256 offset, uint256 lenOfLen) private pure returns (uint256 len) {
        require(lenOfLen > 0 && lenOfLen <= 8, "lenof");
        require(offset + lenOfLen <= data.length, "len oob");
        for (uint256 i = 0; i < lenOfLen; i++) {
            len = (len << 8) | uint8(data[offset + i]);
        }
    }

    function sliceBytes(bytes memory data, uint256 start, uint256 end) private pure returns (bytes memory out) {
        require(end >= start && end <= data.length, "slice");
        uint256 len = end - start;
        out = new bytes(len);
        assembly {
            let dest := add(out, 32)
            let src := add(add(data, 32), start)
            for { let i := 0 } lt(i, len) { i := add(i, 32) } {
                mstore(add(dest, i), mload(add(src, i)))
            }
        }
    }
}
