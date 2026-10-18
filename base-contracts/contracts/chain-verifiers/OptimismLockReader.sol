// SPDX-License-Identifier: PROTOCOL-RESTRICTED
pragma solidity 0.8.19;

import "./EvmReceiptLockReader.sol";

/// @title OptimismLockReader
/// @notice VF-XCH-011 for OP Mainnet (chain 10), receipt-proof form. Same rules
/// as EvmReceiptLockReader; facts never come from caller-supplied bytes.
/// Header: OP Stack (op-geth) uses the geth layout: at least 20 fields,
/// difficulty 0, uncles = empty-list hash.
/// Receipts: deposit receipts (type 0x7e) carry depositNonce and
/// depositReceiptVersion after the four standard fields.
/// https://github.com/ethereum-optimism/op-geth/blob/optimism/core/types/receipt.go
contract OptimismLockReader is EvmReceiptLockReader {
    bytes32 public constant EMPTY_UNCLE_HASH = keccak256(hex"c0");
    uint8 public constant DEPOSIT_TX_TYPE = 0x7e;

    constructor(address lock_) EvmReceiptLockReader(lock_, "Optimism", 10, keccak256(abi.encodePacked("Ethereum", "native-ETH"))) {}

    function _checkHeaderShape(bytes[] memory f) internal view virtual override {
        require(f.length >= 20, "VF-XCH-011: Optimism header fields");
        require(RlpReader.toBytes32(f[1]) == EMPTY_UNCLE_HASH, "VF-XCH-011: Optimism uncles");
        require(RlpReader.toUint(f[7]) == 0, "VF-XCH-011: Optimism difficulty");
    }

    function _receiptTypeAllowed(uint8 t) internal pure override returns (bool) {
        return (t >= 0x01 && t <= 0x04) || t == DEPOSIT_TX_TYPE;
    }

    function _receiptFieldCountOk(uint8 t, uint256 n) internal pure override returns (bool) {
        if (t == DEPOSIT_TX_TYPE) return n == 4 || n == 5 || n == 6;
        return n == 4;
    }
}
