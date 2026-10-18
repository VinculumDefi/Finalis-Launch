// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "./RlpReader.sol";

/// @notice Merkle-Patricia inclusion proof: returns the value stored at `key`
/// under `root`. Reverts if the proof does not reach a value for exactly that
/// key. Used for receipt (key = rlp(index)), account (key = keccak(address))
/// and storage (key = keccak(slot)) proofs, as returned by eth_getProof.
library MptGet {
    function get(bytes32 root, bytes memory key, bytes[] memory nodes) internal pure returns (bytes memory) {
        require(nodes.length > 0, "mpt empty");
        require(keccak256(nodes[0]) == root, "mpt root");
        uint8[] memory nib = toNibbles(key);
        bytes memory node = nodes[0];
        uint256 next = 1;
        uint256 pos;
        for (uint256 steps = 0; steps < 130; steps++) {
            bytes[] memory items = RlpReader.listItems(node);
            if (items.length == 17) {
                if (pos == nib.length) {
                    bytes memory v = RlpReader.stringPayload(items[16]);
                    require(v.length > 0, "mpt no value");
                    require(next == nodes.length, "mpt trailing");
                    return v;
                }
                (node, next) = follow(items[nib[pos]], nodes, next);
                pos++;
            } else if (items.length == 2) {
                (bool leaf, uint8[] memory path) = decodeHp(RlpReader.stringPayload(items[0]));
                require(pos + path.length <= nib.length, "mpt path long");
                for (uint256 i = 0; i < path.length; i++) require(path[i] == nib[pos + i], "mpt path");
                pos += path.length;
                if (leaf) {
                    require(pos == nib.length, "mpt leaf key");
                    require(next == nodes.length, "mpt trailing");
                    return RlpReader.stringPayload(items[1]);
                }
                (node, next) = follow(items[1], nodes, next);
            } else {
                revert("mpt node");
            }
        }
        revert("mpt depth");
    }

    function follow(bytes memory child, bytes[] memory nodes, uint256 next)
        private
        pure
        returns (bytes memory node, uint256)
    {
        require(child.length > 0 && uint8(child[0]) != 0x80, "mpt empty child");
        if (uint8(child[0]) == 0xa0) {
            bytes32 h = RlpReader.toBytes32(child);
            require(next < nodes.length, "mpt short");
            require(keccak256(nodes[next]) == h, "mpt child hash");
            return (nodes[next], next + 1);
        }
        require(uint8(child[0]) >= 0xc0, "mpt child");
        return (child, next);
    }

    function toNibbles(bytes memory key) private pure returns (uint8[] memory n) {
        n = new uint8[](key.length * 2);
        for (uint256 i = 0; i < key.length; i++) {
            n[2 * i] = uint8(key[i]) >> 4;
            n[2 * i + 1] = uint8(key[i]) & 0x0f;
        }
    }

    function decodeHp(bytes memory path) private pure returns (bool leaf, uint8[] memory n) {
        require(path.length > 0, "mpt hp");
        uint8 prefix = uint8(path[0]) >> 4;
        require(prefix <= 3, "mpt hp prefix");
        leaf = prefix >= 2;
        bool odd = prefix % 2 == 1;
        n = new uint8[](path.length * 2 - (odd ? 1 : 2));
        uint256 k;
        if (odd) n[k++] = uint8(path[0]) & 0x0f;
        for (uint256 i = 1; i < path.length; i++) {
            n[k++] = uint8(path[i]) >> 4;
            n[k++] = uint8(path[i]) & 0x0f;
        }
    }

    function rlpIndex(uint256 n) internal pure returns (bytes memory) {
        if (n == 0) return hex"80";
        if (n < 0x80) return abi.encodePacked(uint8(n));
        uint256 len;
        for (uint256 t = n; t > 0; t >>= 8) len++;
        bytes memory out = new bytes(len + 1);
        out[0] = bytes1(uint8(0x80 + len));
        for (uint256 i = 0; i < len; i++) out[len - i] = bytes1(uint8(n >> (8 * i)));
        return out;
    }
}
