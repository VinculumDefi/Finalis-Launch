// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

/// @notice geth Header.Hash: keccak256 of the RLP-encoded execution header.
/// Field order is ParentHash, UncleHash, Coinbase, Root, TxHash, ReceiptHash,
/// Bloom, Difficulty, Number, GasLimit, GasUsed, Time, Extra, MixDigest, Nonce,
/// then the optional tail (BaseFee, WithdrawalsHash, BlobGasUsed, ExcessBlobGas,
/// ParentBeaconRoot, RequestsHash, ...) when those values are present.
/// https://github.com/ethereum/go-ethereum/blob/master/core/types/block.go
/// Bor and Parlia inherit this hash.
/// https://github.com/0xPolygon/bor/blob/master/core/types/block.go
/// https://github.com/bnb-chain/bsc/blob/master/core/types/block.go
library ExecutionHeader {
    struct View {
        bytes32 parentHash;
        bytes32 stateRoot;
        bytes32 receiptsRoot;
        uint256 number;
        uint256 timestamp;
        bytes32 hash;
    }

    function open(bytes memory rlp) internal pure returns (View memory v) {
        require(rlp.length > 1 && uint8(rlp[0]) >= 0xc0, "header rlp");
        v.hash = keccak256(rlp);
        require(v.hash != bytes32(0), "hash");
        bytes[] memory items = listItems(rlp);
        // At least the 15 yellow-paper fields. A 3-field ABI stand-in is not a header.
        require(items.length >= 15, "header fields");
        v.parentHash = asBytes32(items[0]);
        require(asBytes32(items[1]) != bytes32(0) || items[1].length == 33, "uncles");
        require(payloadLen(items[2]) == 20, "coinbase");
        v.stateRoot = asBytes32(items[3]);
        require(payloadLen(items[4]) == 32, "txs");
        v.receiptsRoot = asBytes32(items[5]);
        require(payloadLen(items[6]) == 256, "bloom");
        v.number = asUint(items[8]);
        v.timestamp = asUint(items[11]);
        require(payloadLen(items[13]) == 32, "mix");
        require(payloadLen(items[14]) == 8, "nonce");
        require(v.parentHash != bytes32(0), "parent");
        require(v.stateRoot != bytes32(0), "state root");
        require(v.receiptsRoot != bytes32(0), "receipts root");
        require(v.number > 0, "height");
    }

    function asBytes32(bytes memory item) private pure returns (bytes32 v) {
        require(item.length == 33 && uint8(item[0]) == 0xa0, "b32");
        assembly {
            v := mload(add(item, 33))
        }
    }

    function asUint(bytes memory item) private pure returns (uint256 v) {
        require(item.length > 0, "uint");
        uint8 b = uint8(item[0]);
        if (b < 0x80) return b;
        if (b == 0x80) return 0;
        require(b > 0x80 && b < 0xb8, "uint form");
        uint256 len = b - 0x80;
        require(item.length == 1 + len && len <= 32, "uint size");
        require(uint8(item[1]) != 0, "uint canon");
        for (uint256 i = 0; i < len; i++) {
            v = (v << 8) | uint8(item[1 + i]);
        }
    }

    function payloadLen(bytes memory item) private pure returns (uint256) {
        uint8 b = uint8(item[0]);
        if (b < 0x80) return 1;
        if (b < 0xb8) return b - 0x80;
        require(b < 0xc0, "not string");
        uint256 lol = b - 0xb7;
        uint256 len;
        for (uint256 i = 0; i < lol; i++) {
            len = (len << 8) | uint8(item[1 + i]);
        }
        return len;
    }

    function listItems(bytes memory item) private pure returns (bytes[] memory) {
        require(uint8(item[0]) >= 0xc0, "not list");
        (uint256 start, uint256 end) = bounds(item);
        uint256 count;
        uint256 p = start;
        while (p < end) {
            uint256 n = spanEnd(item, p);
            require(n > p && n <= end, "span");
            p = n;
            count++;
        }
        bytes[] memory out = new bytes[](count);
        p = start;
        for (uint256 i = 0; i < count; i++) {
            uint256 n = spanEnd(item, p);
            out[i] = sliceRange(item, p, n);
            p = n;
        }
        return out;
    }

    function bounds(bytes memory item) private pure returns (uint256 start, uint256 end) {
        uint8 b = uint8(item[0]);
        if (b < 0xb8) return (1, item.length);
        if (b < 0xc0) return (1 + (b - 0xb7), item.length);
        if (b < 0xf8) return (1, item.length);
        return (1 + (b - 0xf7), item.length);
    }

    function spanEnd(bytes memory data, uint256 offset) private pure returns (uint256) {
        uint8 b = uint8(data[offset]);
        if (b < 0x80) return offset + 1;
        if (b < 0xb8) return offset + 1 + (b - 0x80);
        if (b < 0xc0) return offset + 1 + (b - 0xb7) + readLen(data, offset + 1, b - 0xb7);
        if (b < 0xf8) return offset + 1 + (b - 0xc0);
        return offset + 1 + (b - 0xf7) + readLen(data, offset + 1, b - 0xf7);
    }

    function readLen(bytes memory data, uint256 offset, uint256 lol) private pure returns (uint256 len) {
        for (uint256 i = 0; i < lol; i++) len = (len << 8) | uint8(data[offset + i]);
    }

    function sliceRange(bytes memory data, uint256 start, uint256 end) private pure returns (bytes memory out) {
        uint256 len = end - start;
        out = new bytes(len);
        for (uint256 i = 0; i < len; i++) out[i] = data[start + i];
    }
}
