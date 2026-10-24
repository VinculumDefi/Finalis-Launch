// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "./RlpReader.sol";

/// @notice Ethereum account and storage proofs (eth_getProof format) with
/// inclusion AND exclusion. A key that the proof shows is absent returns
/// found = false. Absence is accepted only when the proof itself shows it:
/// an empty branch child on the key path, or a leaf or extension whose path
/// leaves the key path. Every node must be used and every hash must match.
/// Keys are 32-byte secure-trie keys (keccak of an address or a slot), so
/// every value sits at depth 64 nibbles.
library EvmStorageProof {
    bytes32 internal constant EMPTY_TRIE_ROOT = 0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421;

    struct Account {
        uint256 nonce;
        uint256 balance;
        bytes32 storageRoot;
        bytes32 codeHash;
    }

    /// @notice The account at `addr` under `stateRoot`. Reverts if absent.
    function account(bytes32 stateRoot, address addr, bytes[] memory nodes) internal pure returns (Account memory a) {
        (bool found, bytes memory v) = get(stateRoot, keccak256(abi.encodePacked(addr)), nodes);
        require(found, "VF-XCH-011: account absent");
        bytes[] memory f = RlpReader.listItems(v);
        require(f.length == 4, "VF-XCH-011: account");
        a.nonce = RlpReader.toUint(f[0]);
        a.balance = RlpReader.toUint(f[1]);
        a.storageRoot = RlpReader.toBytes32(f[2]);
        a.codeHash = RlpReader.toBytes32(f[3]);
    }

    /// @notice Storage word at `slot`. A proven-absent slot is zero.
    function word(bytes32 storageRoot, bytes32 slot, bytes[] memory nodes) internal pure returns (uint256 v) {
        (bool found, bytes memory raw) = get(storageRoot, keccak256(abi.encodePacked(slot)), nodes);
        if (!found) return 0;
        v = RlpReader.toUint(raw);
        // Zero is never stored; a stored zero leaf is not a valid trie.
        require(v != 0, "mpt zero leaf");
    }

    function get(bytes32 root, bytes32 key, bytes[] memory nodes) internal pure returns (bool found, bytes memory value) {
        if (nodes.length == 0) {
            require(root == EMPTY_TRIE_ROOT, "mpt empty");
            return (false, value);
        }
        require(keccak256(nodes[0]) == root, "mpt root");
        bytes memory node = nodes[0];
        uint256 next = 1;
        uint256 pos;
        for (uint256 steps = 0; steps <= 64; steps++) {
            (uint256[18] memory s, uint256 n) = _items(node);
            if (n == 17) {
                require(pos < 64, "mpt key len");
                uint256 nib = _nib(key, pos);
                uint256 a = s[nib];
                uint256 b = s[nib + 1];
                if (b == a + 1 && uint8(node[a]) == 0x80) {
                    require(next == nodes.length, "mpt trailing");
                    return (false, value);
                }
                (node, next) = _follow(node, a, b, nodes, next);
                pos++;
            } else if (n == 2) {
                (uint256 ps, uint256 pe) = _strBounds(node, s[0], s[1]);
                require(pe > ps, "mpt hp");
                uint8 prefix = uint8(node[ps]) >> 4;
                require(prefix <= 3, "mpt hp prefix");
                bool leaf = prefix >= 2;
                bool odd = prefix & 1 == 1;
                if (!odd) require(uint8(node[ps]) & 0x0f == 0, "mpt hp pad");
                uint256 count = (pe - ps) * 2 - (odd ? 1 : 2);
                require(pos + count <= 64, "mpt path long");
                bool same = true;
                for (uint256 i = 0; i < count; i++) {
                    uint256 j = i + (odd ? 1 : 2); // nibble index inside the hp bytes
                    uint8 pn = j & 1 == 0 ? uint8(node[ps + j / 2]) >> 4 : uint8(node[ps + j / 2]) & 0x0f;
                    if (pn != _nib(key, pos + i)) {
                        same = false;
                        break;
                    }
                }
                if (!same) {
                    require(next == nodes.length, "mpt trailing");
                    return (false, value);
                }
                pos += count;
                if (leaf) {
                    require(pos == 64, "mpt leaf key");
                    require(next == nodes.length, "mpt trailing");
                    (uint256 vs, uint256 ve) = _strBounds(node, s[1], s[2]);
                    require(ve > vs, "mpt no value");
                    return (true, RlpReader.slice(node, vs, ve));
                }
                require(count > 0, "mpt ext");
                require(!(s[2] == s[1] + 1 && uint8(node[s[1]]) == 0x80), "mpt empty ext");
                (node, next) = _follow(node, s[1], s[2], nodes, next);
            } else {
                revert("mpt node");
            }
        }
        revert("mpt depth");
    }

    /// @dev Start offsets of the list items, plus the end offset at [n].
    function _items(bytes memory node) private pure returns (uint256[18] memory s, uint256 n) {
        require(RlpReader.isList(node), "mpt list");
        (uint256 p, uint256 end) = RlpReader.payloadBounds(node);
        while (p < end) {
            require(n < 17, "mpt node");
            s[n++] = p;
            p = RlpReader.itemEnd(node, p);
        }
        require(p == end, "mpt list end");
        s[n] = p;
    }

    function _strBounds(bytes memory node, uint256 a, uint256 b) private pure returns (uint256, uint256) {
        uint8 h = uint8(node[a]);
        require(h < 0xc0, "mpt str");
        if (h < 0x80) return (a, b);
        if (h < 0xb8) return (a + 1, b);
        return (a + 1 + (h - 0xb7), b);
    }

    function _follow(bytes memory node, uint256 a, uint256 b, bytes[] memory nodes, uint256 next)
        private
        pure
        returns (bytes memory, uint256)
    {
        uint8 h = uint8(node[a]);
        if (h == 0xa0 && b == a + 33) {
            bytes32 ref;
            assembly {
                ref := mload(add(add(node, 33), a))
            }
            require(next < nodes.length, "mpt short");
            require(keccak256(nodes[next]) == ref, "mpt child hash");
            return (nodes[next], next + 1);
        }
        require(h >= 0xc0 && b - a < 32, "mpt child");
        return (RlpReader.slice(node, a, b), next);
    }

    function _nib(bytes32 key, uint256 i) private pure returns (uint256) {
        uint8 byt = uint8(key[i / 2]);
        return i & 1 == 0 ? byt >> 4 : byt & 0x0f;
    }
}
