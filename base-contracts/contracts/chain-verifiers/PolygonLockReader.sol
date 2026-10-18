// SPDX-License-Identifier: PROTOCOL-RESTRICTED
pragma solidity 0.8.19;

import "./EvmReceiptLockReader.sol";

/// @title PolygonLockReader
/// @notice VF-XCH-011 for Polygon PoS (chain 137), receipt-proof form. Same
/// rules as EvmReceiptLockReader; facts never come from caller-supplied bytes.
/// Header: Bor keeps the geth hash; the current chain uses 16 fields (classic
/// 15 plus baseFee) or more; difficulty is at least 1; extraData holds 32
/// bytes of vanity and a 65-byte seal (at least 97 bytes).
/// Receipts: Bor's state-sync receipt is not part of receiptsRoot, so a
/// lock is always an ordinary transaction receipt.
/// https://github.com/0xPolygon/bor/blob/master/core/types/block.go
contract PolygonLockReader is EvmReceiptLockReader {
    bytes32 public constant EMPTY_UNCLE_HASH = keccak256(hex"c0");

    constructor(address lock_) EvmReceiptLockReader(lock_, "Polygon", 137, keccak256(abi.encodePacked("Polygon", "native-POL"))) {}

    function _checkHeaderShape(bytes[] memory f) internal view virtual override {
        require(f.length >= 16, "VF-XCH-011: Polygon header fields");
        require(RlpReader.toBytes32(f[1]) == EMPTY_UNCLE_HASH, "VF-XCH-011: Polygon uncles");
        require(RlpReader.toUint(f[7]) >= 1, "VF-XCH-011: Polygon difficulty");
        require(RlpReader.stringPayload(f[12]).length >= 97, "VF-XCH-011: Polygon extraData");
    }
}
