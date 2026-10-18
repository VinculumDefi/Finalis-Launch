// SPDX-License-Identifier: PROTOCOL-RESTRICTED
pragma solidity 0.8.19;

import "./EvmReceiptLockReader.sol";

/// @title BnbSmartChainLockReader
/// @notice VF-XCH-011 for BNB Smart Chain (chain 56), receipt-proof form. Same
/// rules as EvmReceiptLockReader; facts never come from caller-supplied bytes.
/// Header: Parlia keeps the geth hash and layout (at least 20 fields on the
/// current chain); difficulty is 2 (in turn) or 1 (out of turn); extraData
/// holds 32 bytes of vanity and a 65-byte seal, so it is at least 97 bytes.
/// https://github.com/bnb-chain/bsc/blob/master/consensus/parlia/parlia.go
contract BnbSmartChainLockReader is EvmReceiptLockReader {
    bytes32 public constant EMPTY_UNCLE_HASH = keccak256(hex"c0");

    constructor(address lock_) EvmReceiptLockReader(lock_, "BNB Smart Chain", 56, keccak256(abi.encodePacked("BNB Smart Chain", "native-BNB"))) {}

    function _checkHeaderShape(bytes[] memory f) internal view virtual override {
        require(f.length >= 20, "VF-XCH-011: BNB header fields");
        require(RlpReader.toBytes32(f[1]) == EMPTY_UNCLE_HASH, "VF-XCH-011: BNB uncles");
        uint256 d = RlpReader.toUint(f[7]);
        require(d == 1 || d == 2, "VF-XCH-011: BNB difficulty");
        require(RlpReader.stringPayload(f[12]).length >= 97, "VF-XCH-011: BNB extraData");
    }
}
