// SPDX-License-Identifier: PROTOCOL-RESTRICTED
pragma solidity 0.8.19;

import "../interfaces/IChainVerifier.sol";
import "../checkers/ExecutionHeader.sol";
import "../checkers/MptGet.sol";
import "../checkers/RlpReader.sol";
import "../checkers/BeaconSsz.sol";
import "../checkers/EthereumBeaconLightClient.sol";

/// @title EthereumLockReader
/// @notice VF-XCH-006/011 for Ethereum. Facts come only from proven chain data,
/// never from caller-supplied fact bytes:
///   1. The execution header is opened from its RLP; its hash is keccak(RLP).
///   2. The lock receipt is proven against the header's receiptsRoot (MPT).
///      The receipt must have status 1 and carry LockCreated from `lock`.
///      lockId, asset, gross, fee, principal and maturity come from that log;
///      createdAt is the header timestamp (the lock sets createdAt =
///      block.timestamp) and duration = maturity - createdAt.
///   3. The lock account is proven against the header's stateRoot and two
///      storage slots against its storageRoot (eth_getProof form):
///      slot 0 = environmentId, which must be "Ethereum" (the same lock
///      address exists on other chains), and LockRecord word 3 of
///      _locks[lockId] = baseRecipient | outputToken << 160. LockCreated does
///      not carry baseRecipient or outputToken, so they are read from storage.
///   4. verifyFinality opens the same header and requires: a beacon header
///      recorded as finalized by EthereumBeaconLightClient (sync-committee
///      BLS signatures from a trusted checkpoint); the lock's beacon block
///      equal to it or SSZ-proven in its state's block_roots (<= 8192 slots
///      back); and the execution block hash SSZ-proven into that beacon
///      block's body (ExecutionPayload.block_hash).
/// LIMITS: trust rests on the construction checkpoint and a single fork
/// version; a new fork version or gindex layout needs a new deployment.
contract EthereumLockReader is IChainVerifier {
    string public constant ENVIRONMENT_ID = "Ethereum";
    /// @dev CommitmentVaultLock.LockCreated signature.
    bytes32 public constant LOCK_CREATED_TOPIC =
        keccak256("LockCreated(bytes32,address,address,address,uint256,uint256,uint256,uint256)");
    /// @dev CommitmentVaultLock storage: slot 0 environmentId, slot 1 _locks.
    uint256 public constant ENVIRONMENT_SLOT = 0;
    uint256 public constant LOCKS_SLOT = 1;
    uint256 public constant RECIPIENT_WORD = 3;
    /// @dev Short-string storage form of "Ethereum": bytes left-aligned, length*2 in the low byte.
    bytes32 public constant ENVIRONMENT_WORD = bytes32(bytes8("Ethereum")) | bytes32(uint256(16));

    address public immutable lock;

    struct LockEventProof {
        bytes headerRlp;
        bytes receipt;          // typed (0x01/0x02/0x03 prefix) or legacy receipt bytes
        uint256 receiptIndex;
        bytes[] receiptNodes;
        uint256 logIndex;
        bytes[] accountNodes;   // eth_getProof accountProof for `lock`
        bytes[] envSlotNodes;   // storageProof for slot 0
        bytes[] recipientSlotNodes; // storageProof for _locks[lockId] word 3
    }

    struct FinalityProof {
        BeaconSsz.BeaconHeader finalized; // recorded by the light client
        BeaconSsz.BeaconHeader lockBeacon; // beacon block carrying the lock's execution block
        bytes32[] blockRootsBranch; // lockBeacon in finalized state's block_roots (empty if same block)
        bytes32[] payloadBranch; // ExecutionPayload.block_hash -> lockBeacon.bodyRoot
    }

    /// @dev Electra/Fulu: BeaconBlockBody field 9 (execution_payload, 16 leaves),
    /// ExecutionPayload field 12 (block_hash, 32 leaves): (16 + 9) * 32 + 12.
    uint256 public constant BLOCK_HASH_GINDEX = 812;
    /// @dev BeaconState field 5 (block_roots, 64 leaves), Vector[Root, 8192].
    uint256 public constant BLOCK_ROOTS_GINDEX = 69;
    uint256 public constant SLOTS_PER_HISTORICAL_ROOT = 8192;

    EthereumBeaconLightClient public immutable lightClient;

    constructor(address lock_, address lightClient_) {
        require(lock_ != address(0), "VF-XCH-011: Ethereum lock");
        require(lightClient_ != address(0), "VF-XCH-006: Ethereum light client");
        lock = lock_;
        lightClient = EthereumBeaconLightClient(lightClient_);
    }

    function verifyFinality(bytes calldata lockEventProof, bytes calldata sourceFinalityProof)
        external
        view
        returns (bool, bytes32, uint256)
    {
        LockEventProof memory e = abi.decode(lockEventProof, (LockEventProof));
        ExecutionHeader.View memory header = ExecutionHeader.open(e.headerRlp);
        FinalityProof memory f = abi.decode(sourceFinalityProof, (FinalityProof));
        bytes32 finRoot = BeaconSsz.root(f.finalized);
        require(lightClient.isFinalized(finRoot), "VF-XCH-006: Ethereum beacon header not finalized");
        bytes32 lockRoot = BeaconSsz.root(f.lockBeacon);
        if (lockRoot != finRoot) {
            require(
                f.lockBeacon.slot < f.finalized.slot
                    && f.finalized.slot - f.lockBeacon.slot <= SLOTS_PER_HISTORICAL_ROOT,
                "VF-XCH-006: Ethereum block not under finalized header"
            );
            uint256 g = BLOCK_ROOTS_GINDEX * SLOTS_PER_HISTORICAL_ROOT + (f.lockBeacon.slot % SLOTS_PER_HISTORICAL_ROOT);
            require(
                BeaconSsz.branchRoot(lockRoot, f.blockRootsBranch, g) == f.finalized.stateRoot,
                "VF-XCH-006: Ethereum block not under finalized header"
            );
        } else {
            require(f.blockRootsBranch.length == 0, "VF-XCH-006: Ethereum block roots branch");
        }
        require(
            BeaconSsz.branchRoot(header.hash, f.payloadBranch, BLOCK_HASH_GINDEX) == f.lockBeacon.bodyRoot,
            "VF-XCH-006: Ethereum payload not in beacon body"
        );
        return (true, header.hash, header.number);
    }

    function extractFacts(bytes calldata lockEventProof)
        external
        view
        returns (bytes32, uint256, uint256, uint256, uint256, uint256, uint256, address, uint8)
    {
        LockEventProof memory e = abi.decode(lockEventProof, (LockEventProof));
        ExecutionHeader.View memory header = ExecutionHeader.open(e.headerRlp);

        bytes memory proven = MptGet.get(header.receiptsRoot, MptGet.rlpIndex(e.receiptIndex), e.receiptNodes);
        require(keccak256(proven) == keccak256(e.receipt), "VF-XCH-011: Ethereum receipt");
        (bytes32 lockId, uint256 gross, uint256 fee, uint256 principal, uint256 maturity) = _lockLog(e.receipt, e.logIndex);

        bytes32 storageRoot = _storageRoot(header.stateRoot, e.accountNodes);
        require(
            _slot(storageRoot, bytes32(ENVIRONMENT_SLOT), e.envSlotNodes) == uint256(ENVIRONMENT_WORD),
            "VF-XCH-011: Ethereum environment"
        );
        bytes32 base = keccak256(abi.encode(lockId, LOCKS_SLOT));
        uint256 word = _slot(storageRoot, bytes32(uint256(base) + RECIPIENT_WORD), e.recipientSlotNodes);
        address recipient = address(uint160(word));
        uint8 outputToken = uint8(word >> 160);
        require(recipient != address(0), "VF-XCH-011: Ethereum recipient missing");
        require(outputToken <= 1, "VF-XCH-011: Ethereum output token");
        require(maturity > header.timestamp, "VF-XCH-011: Ethereum maturity");

        return (lockId, gross, fee, principal, maturity - header.timestamp, header.timestamp, maturity, recipient, outputToken);
    }

    function _lockLog(bytes memory receipt, uint256 logIndex)
        private
        view
        returns (bytes32 lockId, uint256 gross, uint256 fee, uint256 principal, uint256 maturity)
    {
        bytes memory body = receipt;
        if (receipt.length > 1 && uint8(receipt[0]) <= 0x03 && uint8(receipt[1]) >= 0xc0) {
            body = RlpReader.slice(receipt, 1, receipt.length);
        }
        bytes[] memory fields = RlpReader.listItems(body);
        require(fields.length == 4, "VF-XCH-011: Ethereum receipt shape");
        require(RlpReader.toUint(fields[0]) == 1, "VF-XCH-011: Ethereum receipt failed");
        bytes[] memory logs = RlpReader.listItems(fields[3]);
        require(logIndex < logs.length, "VF-XCH-011: Ethereum log index");
        bytes[] memory log = RlpReader.listItems(logs[logIndex]);
        require(log.length == 3, "VF-XCH-011: Ethereum log shape");
        require(RlpReader.toAddress(log[0]) == lock, "VF-XCH-011: Ethereum log emitter");
        bytes[] memory topics = RlpReader.listItems(log[1]);
        require(topics.length == 4, "VF-XCH-011: Ethereum log topics");
        require(RlpReader.toBytes32(topics[0]) == LOCK_CREATED_TOPIC, "VF-XCH-011: Ethereum log topic");
        lockId = RlpReader.toBytes32(topics[1]);
        bytes memory data = RlpReader.stringPayload(log[2]);
        require(data.length == 160, "VF-XCH-011: Ethereum log data");
        (, gross, fee, principal, maturity) = abi.decode(data, (address, uint256, uint256, uint256, uint256));
    }

    function _storageRoot(bytes32 stateRoot, bytes[] memory nodes) private view returns (bytes32) {
        bytes memory account = MptGet.get(stateRoot, abi.encodePacked(keccak256(abi.encodePacked(lock))), nodes);
        bytes[] memory a = RlpReader.listItems(account);
        require(a.length == 4, "VF-XCH-011: Ethereum account");
        return RlpReader.toBytes32(a[2]);
    }

    function _slot(bytes32 storageRoot, bytes32 slot, bytes[] memory nodes) private pure returns (uint256) {
        bytes memory v = MptGet.get(storageRoot, abi.encodePacked(keccak256(abi.encodePacked(slot))), nodes);
        return RlpReader.toUint(v);
    }
}
