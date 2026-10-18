// SPDX-License-Identifier: PROTOCOL-RESTRICTED
pragma solidity 0.8.19;

import "./EvmReceiptLockReader.sol";

/// @title ArbitrumLockReader
/// @notice VF-XCH-011 for Arbitrum One (chain 42161). The lock is proven from
/// its real receipt and LockCreated log against the block header's
/// receiptsRoot; recipient and output token are read from the lock's proven
/// storage. Facts are never taken from caller-supplied bytes. See
/// EvmReceiptLockReader for the full rule set.
/// Arbitrum Nitro header layout (go-ethereum hash, Arbitrum field use):
///   16 fields: the 15 classic fields plus baseFee; no withdrawals/blob tail.
///   difficulty = 1; uncles = empty-list hash;
///   extraData = sendRoot (32 bytes);
///   mixHash = sendCount (8) | L1 block number (8) | ArbOS version (8) | flags (8);
///   nonce = delayed messages read (8 bytes).
/// https://github.com/OffchainLabs/go-ethereum/blob/master/core/types/arb_types.go
/// Arbitrum receipts may be typed 0x64-0x6a (Arbitrum transaction types)
/// in addition to the Ethereum types.
contract ArbitrumLockReader is EvmReceiptLockReader {
    uint256 public constant ARBITRUM_ONE_CHAIN_ID = 42161;
    bytes32 public constant EMPTY_UNCLE_HASH = keccak256(hex"c0");

    constructor(address lock_) EvmReceiptLockReader(lock_, "Arbitrum", ARBITRUM_ONE_CHAIN_ID, keccak256(abi.encodePacked("Ethereum", "native-ETH"))) {}

    function _checkHeaderShape(bytes[] memory f) internal view virtual override {
        require(f.length == 16, "VF-XCH-011: Arbitrum header fields");
        require(RlpReader.toBytes32(f[1]) == EMPTY_UNCLE_HASH, "VF-XCH-011: Arbitrum uncles");
        require(RlpReader.toUint(f[7]) == 1, "VF-XCH-011: Arbitrum difficulty");
        require(RlpReader.stringPayload(f[12]).length == 32, "VF-XCH-011: Arbitrum sendRoot");
    }

    function _receiptTypeAllowed(uint8 t) internal pure override returns (bool) {
        return (t >= 0x01 && t <= 0x04) || (t >= 0x64 && t <= 0x6a);
    }

    /// @notice Arbitrum header extras: sendRoot and the L1 block number.
    function arbitrumHeaderExtras(bytes calldata headerRlp)
        external
        view
        returns (bytes32 blockHash, uint256 number, bytes32 sendRoot, uint64 sendCount, uint64 l1BlockNumber)
    {
        ExecutionHeader.View memory h = _openHeader(headerRlp);
        bytes[] memory f = RlpReader.listItems(headerRlp);
        bytes32 mix = RlpReader.toBytes32(f[13]);
        return (h.hash, h.number, bytes32(RlpReader.stringPayload(f[12])), uint64(bytes8(mix)), uint64(bytes8(mix << 64)));
    }
}
