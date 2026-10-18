// SPDX-License-Identifier: PROTOCOL-RESTRICTED
pragma solidity 0.8.19;

import "./EvmReceiptLockReader.sol";

/// @title AvalancheLockReader
/// @notice VF-XCH-011 for the Avalanche C-Chain (chain 43114), receipt-proof form.
/// Header: coreth layout. 16+ fields; field 15 is extDataHash (32 bytes);
/// difficulty 1. The live chain appends further fields
/// (timestampMilliseconds, minDelayExcess, targetExponent, minPriceExponent,
/// settledHeight, settledGasUnix, settledGasNumerator, settledExcess).
/// https://github.com/ava-labs/coreth/blob/master/plugin/evm/customtypes/header_ext.go
/// Asynchronous settlement (checked on live blocks, 2026-10-18): a header's
/// receiptsRoot commits to the receipts of the block it settles
/// (settledHeight), not to its own transactions. So the lock receipt is
/// proven against the SETTLING header, and that header's timestamp is not the
/// lock's creation time. createdAt is therefore read from the lock's own
/// proven storage (LockRecord word 9), and duration = maturity - createdAt.
/// The returned block hash/height are those of the settling header.
contract AvalancheLockReader is EvmReceiptLockReader {
    uint256 public constant CREATED_AT_WORD = 9;

    struct AvalancheLockEventProof {
        LockEventProof base;
        bytes[] createdAtSlotNodes; // storageProof for _locks[lockId] word 9
    }

    constructor(address lock_) EvmReceiptLockReader(lock_, "Avalanche", 43114, keccak256(abi.encodePacked("Avalanche", "native-AVAX"))) {}

    function _checkHeaderShape(bytes[] memory f) internal view virtual override {
        require(f.length >= 16, "VF-XCH-011: Avalanche header fields");
        require(RlpReader.toUint(f[7]) == 1, "VF-XCH-011: Avalanche difficulty");
        require(f[15].length == 33 && uint8(f[15][0]) == 0xa0, "VF-XCH-011: Avalanche extDataHash");
    }

    /// @dev The C-Chain account leaf carries a fifth field, isMultiCoin
    /// (coreth StateAccount extra), found end to end against a real local
    /// avalanchego lock. Storage root stays at index 2.
    function _checkAccountShape(bytes[] memory a) internal pure virtual override {
        require(a.length == 4 || a.length == 5, "VF-XCH-011: account");
    }

    function verifyFinality(bytes calldata lockEventProof, bytes calldata sourceFinalityProof)
        external
        view
        override
        returns (bool, bytes32, uint256)
    {
        AvalancheLockEventProof memory a = abi.decode(lockEventProof, (AvalancheLockEventProof));
        ExecutionHeader.View memory h = _openHeader(a.base.headerRlp);
        (uint256 claimedChain, bytes32 claimedHash, uint256 claimedHeight) =
            abi.decode(sourceFinalityProof, (uint256, bytes32, uint256));
        require(claimedChain == chainId, "VF-XCH-006: wrong chain");
        require(claimedHash == h.hash, "VF-XCH-006: block hash mismatch");
        require(claimedHeight == h.number, "VF-XCH-006: block height mismatch");
        return (true, h.hash, h.number);
    }

    function _baseProof(bytes calldata lockEventProof) internal pure override returns (LockEventProof memory) {
        return abi.decode(lockEventProof, (AvalancheLockEventProof)).base;
    }

    function extractFacts(bytes calldata lockEventProof)
        external
        view
        override
        returns (bytes32, uint256, uint256, uint256, uint256, uint256, uint256, address, uint8)
    {
        AvalancheLockEventProof memory a = abi.decode(lockEventProof, (AvalancheLockEventProof));
        LockEventProof memory e = a.base;
        ExecutionHeader.View memory h = _openHeader(e.headerRlp);
        _requireReceipt(h.receiptsRoot, e.receipt, e.receiptIndex, e.receiptNodes);
        (bytes32 lockId, uint256 gross, uint256 fee, uint256 principal, uint256 maturity) = _lockLog(e.receipt, e.logIndex);

        bytes32 storageRoot = _storageRoot(h.stateRoot, e.accountNodes);
        require(
            _slot(storageRoot, bytes32(ENVIRONMENT_SLOT), e.envSlotNodes) == uint256(environmentWord),
            "VF-XCH-011: environment"
        );
        uint256 base = uint256(keccak256(abi.encode(lockId, LOCKS_SLOT)));
        uint256 word = _slot(storageRoot, bytes32(base + RECIPIENT_WORD), e.recipientSlotNodes);
        uint256 createdAt = _slot(storageRoot, bytes32(base + CREATED_AT_WORD), a.createdAtSlotNodes);
        address recipient = address(uint160(word));
        uint8 outputToken = uint8(word >> 160);
        require(recipient != address(0), "VF-XCH-011: recipient missing");
        require(outputToken <= 1, "VF-XCH-011: output token");
        require(gross != 0 && fee + principal == gross, "VF-XCH-011: amounts");
        require(createdAt != 0 && maturity > createdAt, "VF-XCH-011: maturity");
        return (lockId, gross, fee, principal, maturity - createdAt, createdAt, maturity, recipient, outputToken);
    }
}
