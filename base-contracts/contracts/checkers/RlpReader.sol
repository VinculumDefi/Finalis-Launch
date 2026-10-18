// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

/// @notice Minimal canonical RLP reader used by MptGet and EthereumLockReader.
library RlpReader {
    function isList(bytes memory item) internal pure returns (bool) {
        return item.length > 0 && uint8(item[0]) >= 0xc0;
    }

    function listItems(bytes memory item) internal pure returns (bytes[] memory out) {
        require(isList(item), "rlp list");
        (uint256 start, uint256 end) = payloadBounds(item);
        uint256 count;
        uint256 p = start;
        while (p < end) {
            uint256 n = itemEnd(item, p);
            require(n > p && n <= end, "rlp item");
            p = n;
            count++;
        }
        out = new bytes[](count);
        p = start;
        for (uint256 i = 0; i < count; i++) {
            uint256 n = itemEnd(item, p);
            out[i] = slice(item, p, n);
            p = n;
        }
    }

    function stringPayload(bytes memory item) internal pure returns (bytes memory) {
        require(item.length > 0 && uint8(item[0]) < 0xc0, "rlp string");
        if (uint8(item[0]) < 0x80) return item;
        (uint256 start, uint256 end) = payloadBounds(item);
        return slice(item, start, end);
    }

    function toBytes32(bytes memory item) internal pure returns (bytes32 v) {
        require(item.length == 33 && uint8(item[0]) == 0xa0, "rlp b32");
        assembly {
            v := mload(add(item, 33))
        }
    }

    function toAddress(bytes memory item) internal pure returns (address a) {
        require(item.length == 21 && uint8(item[0]) == 0x94, "rlp addr");
        assembly {
            a := shr(96, mload(add(item, 33)))
        }
    }

    function toUint(bytes memory item) internal pure returns (uint256 v) {
        bytes memory p = stringPayload(item);
        require(p.length <= 32, "rlp uint");
        if (p.length > 0) require(uint8(p[0]) != 0 || p.length == 1 && item.length == 1, "rlp uint canon");
        for (uint256 i = 0; i < p.length; i++) v = (v << 8) | uint8(p[i]);
    }

    function payloadBounds(bytes memory item) internal pure returns (uint256 start, uint256 end) {
        uint8 b = uint8(item[0]);
        if (b < 0x80) return (0, 1);
        if (b < 0xb8) {
            require(item.length == 1 + (b - 0x80), "rlp str len");
            return (1, item.length);
        }
        if (b < 0xc0) {
            uint256 lol = b - 0xb7;
            uint256 len = readLen(item, 1, lol);
            require(len >= 56 && item.length == 1 + lol + len, "rlp lstr");
            return (1 + lol, item.length);
        }
        if (b < 0xf8) {
            require(item.length == 1 + (b - 0xc0), "rlp list len");
            return (1, item.length);
        }
        uint256 lol2 = b - 0xf7;
        uint256 len2 = readLen(item, 1, lol2);
        require(len2 >= 56 && item.length == 1 + lol2 + len2, "rlp llist");
        return (1 + lol2, item.length);
    }

    function itemEnd(bytes memory data, uint256 offset) internal pure returns (uint256 end) {
        require(offset < data.length, "rlp oob");
        uint8 b = uint8(data[offset]);
        if (b < 0x80) end = offset + 1;
        else if (b < 0xb8) end = offset + 1 + (b - 0x80);
        else if (b < 0xc0) end = offset + 1 + (b - 0xb7) + readLen(data, offset + 1, b - 0xb7);
        else if (b < 0xf8) end = offset + 1 + (b - 0xc0);
        else end = offset + 1 + (b - 0xf7) + readLen(data, offset + 1, b - 0xf7);
        require(end <= data.length, "rlp end");
    }

    function readLen(bytes memory data, uint256 offset, uint256 lol) private pure returns (uint256 len) {
        require(lol > 0 && lol <= 8 && offset + lol <= data.length, "rlp lenof");
        for (uint256 i = 0; i < lol; i++) len = (len << 8) | uint8(data[offset + i]);
    }

    function slice(bytes memory data, uint256 start, uint256 end) internal pure returns (bytes memory out) {
        require(end >= start && end <= data.length, "rlp slice");
        out = new bytes(end - start);
        for (uint256 i = 0; i < out.length; i++) out[i] = data[start + i];
    }
}
