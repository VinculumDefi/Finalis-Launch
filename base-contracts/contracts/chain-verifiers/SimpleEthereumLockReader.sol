// SPDX-License-Identifier: PROTOCOL-RESTRICTED
pragma solidity 0.8.19;

import "./EvmReceiptLockReader.sol";

/// @title SimpleEthereumLockReader
/// @notice VF-XCH-011 for Ethereum mainnet (chain 1), receipt-proof form.
/// Same rules as EvmReceiptLockReader. EthereumLockReader is kept in the
/// repository unchanged; this reader is the one the new ceremony uses.
/// Header: post-merge geth layout, at least 20 fields (Cancun tail and later),
/// difficulty 0, uncles = empty-list hash.
contract SimpleEthereumLockReader is EvmReceiptLockReader {
    bytes32 public constant EMPTY_UNCLE_HASH = keccak256(hex"c0");

    constructor(address lock_) EvmReceiptLockReader(lock_, "Ethereum", 1, keccak256(abi.encodePacked("Ethereum", "native-ETH"))) {}

    function _checkHeaderShape(bytes[] memory f) internal view virtual override {
        require(f.length >= 20, "VF-XCH-011: Ethereum header fields");
        require(RlpReader.toBytes32(f[1]) == EMPTY_UNCLE_HASH, "VF-XCH-011: Ethereum uncles");
        require(RlpReader.toUint(f[7]) == 0, "VF-XCH-011: Ethereum difficulty");
    }
}
