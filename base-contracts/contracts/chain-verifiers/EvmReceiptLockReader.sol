// SPDX-License-Identifier: PROTOCOL-RESTRICTED
pragma solidity 0.8.19;

import "../interfaces/IChainVerifier.sol";
import "../checkers/ExecutionHeader.sol";
import "../checkers/MptGet.sol";
import "../checkers/RlpReader.sol";

/// @title EvmReceiptLockReader
/// @notice Generic receipt-proof reader for a CommitmentVaultLock on an EVM
/// chain. The lock address, environment name and chain id are fixed at
/// construction. Facts come only from proven chain data:
///   1. The block header is opened from its RLP; its hash is keccak(RLP).
///      _checkHeaderShape lets a chain enforce its own header layout.
///   2. The lock receipt is proven against the header's receiptsRoot (MPT).
///      It must have status 1 and carry LockCreated emitted by `lock`.
///      lockId, gross, fee, principal and maturity come from that log;
///      createdAt is the header timestamp and duration = maturity - createdAt.
///   3. The lock account is proven against the header's stateRoot and two
///      storage slots against its storageRoot (eth_getProof form):
///      slot 0 = environmentId (must equal this reader's environment, since
///      the same lock address can exist on several chains), and LockRecord
///      word 3 of _locks[lockId] = baseRecipient | outputToken << 160.
///   4. verifyFinality checks the package's claim (chainId, blockHash,
///      height) against the opened header: the chain id must be this
///      reader's, keccak(headerRlp) must equal the claimed hash and the
///      header number must equal the claimed height.
/// SCOPE: this reader proves a lock is in the block whose hash the package
/// names. Whether that block hash belongs to the chain's settled history is
/// the claim the package makes; this contract does not decide it.
contract EvmReceiptLockReader is IChainVerifier {
    bytes32 public constant LOCK_CREATED_TOPIC =
        keccak256("LockCreated(bytes32,address,address,address,uint256,uint256,uint256,uint256)");
    uint256 public constant ENVIRONMENT_SLOT = 0;
    uint256 public constant LOCKS_SLOT = 1;
    uint256 public constant RECIPIENT_WORD = 3;

    address public immutable lock;
    uint256 public immutable chainId;
    bytes32 public immutable environmentWord;
    string public environmentId;

    struct LockEventProof {
        bytes headerRlp;
        bytes receipt;
        uint256 receiptIndex;
        bytes[] receiptNodes;
        uint256 logIndex;
        bytes[] accountNodes;
        bytes[] envSlotNodes;
        bytes[] recipientSlotNodes;
    }

    constructor(address lock_, string memory environmentId_, uint256 chainId_) {
        require(lock_ != address(0), "VF-XCH-011: lock");
        uint256 n = bytes(environmentId_).length;
        require(n != 0 && n < 32, "VF-XCH-011: environment name");
        require(chainId_ != 0, "VF-XCH-011: chain id");
        lock = lock_;
        chainId = chainId_;
        environmentId = environmentId_;
        // Solidity short-string storage: bytes left-aligned, length*2 in the low byte.
        environmentWord = bytes32(bytes(environmentId_)) | bytes32(n * 2);
    }

    function verifyFinality(bytes calldata lockEventProof, bytes calldata sourceFinalityProof)
        external
        view
        virtual
        returns (bool, bytes32, uint256)
    {
        LockEventProof memory e = abi.decode(lockEventProof, (LockEventProof));
        ExecutionHeader.View memory h = _openHeader(e.headerRlp);
        (uint256 claimedChain, bytes32 claimedHash, uint256 claimedHeight) =
            abi.decode(sourceFinalityProof, (uint256, bytes32, uint256));
        require(claimedChain == chainId, "VF-XCH-006: wrong chain");
        require(claimedHash == h.hash, "VF-XCH-006: block hash mismatch");
        require(claimedHeight == h.number, "VF-XCH-006: block height mismatch");
        return (true, h.hash, h.number);
    }

    function extractFacts(bytes calldata lockEventProof)
        external
        view
        virtual
        returns (bytes32, uint256, uint256, uint256, uint256, uint256, uint256, address, uint8)
    {
        LockEventProof memory e = abi.decode(lockEventProof, (LockEventProof));
        ExecutionHeader.View memory h = _openHeader(e.headerRlp);
        _requireReceipt(h.receiptsRoot, e.receipt, e.receiptIndex, e.receiptNodes);
        (bytes32 lockId, uint256 gross, uint256 fee, uint256 principal, uint256 maturity) = _lockLog(e.receipt, e.logIndex);

        bytes32 storageRoot = _storageRoot(h.stateRoot, e.accountNodes);
        require(
            _slot(storageRoot, bytes32(ENVIRONMENT_SLOT), e.envSlotNodes) == uint256(environmentWord),
            "VF-XCH-011: environment"
        );
        bytes32 base = keccak256(abi.encode(lockId, LOCKS_SLOT));
        uint256 word = _slot(storageRoot, bytes32(uint256(base) + RECIPIENT_WORD), e.recipientSlotNodes);
        address recipient = address(uint160(word));
        uint8 outputToken = uint8(word >> 160);
        require(recipient != address(0), "VF-XCH-011: recipient missing");
        require(outputToken <= 1, "VF-XCH-011: output token");
        require(gross != 0 && fee + principal == gross, "VF-XCH-011: amounts");
        require(maturity > h.timestamp, "VF-XCH-011: maturity");
        return (lockId, gross, fee, principal, maturity - h.timestamp, h.timestamp, maturity, recipient, outputToken);
    }

    /// @notice Parsing helper: opens the header and proves a receipt against
    /// its receiptsRoot. Returns block hash, number and the receipt's status.
    function proveReceipt(bytes calldata headerRlp, bytes calldata receipt, uint256 index, bytes[] calldata nodes)
        external
        view
        returns (bytes32 blockHash, uint256 number, uint256 status, uint256 logCount)
    {
        ExecutionHeader.View memory h = _openHeader(headerRlp);
        _requireReceipt(h.receiptsRoot, receipt, index, nodes);
        bytes[] memory f = _receiptFields(receipt);
        return (h.hash, h.number, RlpReader.toUint(f[0]), RlpReader.listItems(f[3]).length);
    }

    /// @notice Parsing helper: decodes one log of a receipt (no lock checks).
    function receiptLog(bytes calldata receipt, uint256 logIndex)
        external
        pure
        returns (address emitter, bytes32[] memory topics, bytes memory data)
    {
        bytes[] memory logs = RlpReader.listItems(_receiptFields(receipt)[3]);
        require(logIndex < logs.length, "VF-XCH-011: log index");
        bytes[] memory log = RlpReader.listItems(logs[logIndex]);
        require(log.length == 3, "VF-XCH-011: log shape");
        emitter = RlpReader.toAddress(log[0]);
        bytes[] memory t = RlpReader.listItems(log[1]);
        topics = new bytes32[](t.length);
        for (uint256 i = 0; i < t.length; i++) topics[i] = RlpReader.toBytes32(t[i]);
        data = RlpReader.stringPayload(log[2]);
    }

    function _openHeader(bytes memory headerRlp) internal view returns (ExecutionHeader.View memory h) {
        h = ExecutionHeader.open(headerRlp);
        _checkHeaderShape(RlpReader.listItems(headerRlp));
    }

    /// @dev Chain-specific header layout checks. Default: none beyond ExecutionHeader.
    function _checkHeaderShape(bytes[] memory) internal view virtual {}

    /// @dev Receipt type prefixes accepted. Default: legacy plus EIP-2718 0x01-0x04.
    function _receiptTypeAllowed(uint8 t) internal pure virtual returns (bool) {
        return t >= 0x01 && t <= 0x04;
    }

    /// @dev Receipt RLP field count. Default: status, cumulativeGas, bloom, logs.
    function _receiptFieldCountOk(uint8, uint256 n) internal pure virtual returns (bool) {
        return n == 4;
    }

    function _requireReceipt(bytes32 receiptsRoot, bytes memory receipt, uint256 index, bytes[] memory nodes) internal pure {
        bytes memory proven = MptGet.get(receiptsRoot, MptGet.rlpIndex(index), nodes);
        require(keccak256(proven) == keccak256(receipt), "VF-XCH-011: receipt");
    }

    function _receiptFields(bytes memory receipt) internal pure returns (bytes[] memory fields) {
        require(receipt.length > 1, "VF-XCH-011: receipt shape");
        bytes memory body = receipt;
        uint8 b0 = uint8(receipt[0]);
        if (b0 < 0x80) {
            require(_receiptTypeAllowed(b0), "VF-XCH-011: receipt type");
            body = RlpReader.slice(receipt, 1, receipt.length);
        }
        fields = RlpReader.listItems(body);
        require(_receiptFieldCountOk(b0 < 0x80 ? b0 : 0, fields.length), "VF-XCH-011: receipt shape");
    }

    function _lockLog(bytes memory receipt, uint256 logIndex)
        internal
        view
        returns (bytes32 lockId, uint256 gross, uint256 fee, uint256 principal, uint256 maturity)
    {
        bytes[] memory fields = _receiptFields(receipt);
        require(RlpReader.toUint(fields[0]) == 1, "VF-XCH-011: receipt failed");
        bytes[] memory logs = RlpReader.listItems(fields[3]);
        require(logIndex < logs.length, "VF-XCH-011: log index");
        bytes[] memory log = RlpReader.listItems(logs[logIndex]);
        require(log.length == 3, "VF-XCH-011: log shape");
        require(RlpReader.toAddress(log[0]) == lock, "VF-XCH-011: log emitter");
        bytes[] memory topics = RlpReader.listItems(log[1]);
        require(topics.length == 4, "VF-XCH-011: log topics");
        require(RlpReader.toBytes32(topics[0]) == LOCK_CREATED_TOPIC, "VF-XCH-011: log topic");
        lockId = RlpReader.toBytes32(topics[1]);
        require(lockId != bytes32(0), "VF-XCH-011: lock id");
        bytes memory data = RlpReader.stringPayload(log[2]);
        require(data.length == 160, "VF-XCH-011: log data");
        (, gross, fee, principal, maturity) = abi.decode(data, (address, uint256, uint256, uint256, uint256));
    }

    function _storageRoot(bytes32 stateRoot, bytes[] memory nodes) internal view returns (bytes32) {
        bytes memory account = MptGet.get(stateRoot, abi.encodePacked(keccak256(abi.encodePacked(lock))), nodes);
        bytes[] memory a = RlpReader.listItems(account);
        require(a.length == 4, "VF-XCH-011: account");
        return RlpReader.toBytes32(a[2]);
    }

    function _slot(bytes32 storageRoot, bytes32 slot, bytes[] memory nodes) internal pure returns (uint256) {
        bytes memory v = MptGet.get(storageRoot, abi.encodePacked(keccak256(abi.encodePacked(slot))), nodes);
        return RlpReader.toUint(v);
    }
}
