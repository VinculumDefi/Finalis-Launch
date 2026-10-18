// SPDX-License-Identifier: PROTOCOL-RESTRICTED
pragma solidity 0.8.19;

import "../interfaces/IChainVerifier.sol";
import "../checkers/ExecutionHeader.sol";
import "../checkers/MptGet.sol";
import "../checkers/RlpReader.sol";

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
///   4. verifyFinality opens the same header and requires a Casper FFG chain of
///      beacon headers (EthereumFinalityChecker rules: parent-root links,
///      checkpoint slot, attested >= finalized + 2).
///      The execution block hash must be SSZ-proven into beacons[0].bodyRoot
///      (ExecutionPayload.block_hash), so the header is bound to the chain.
/// LIMIT: the beacon headers are not signature-checked (no sync committee or
/// trusted checkpoint), so finality is not trust-anchored. See
/// the test file header; not production-final.
contract EthereumLockReader is IChainVerifier {
    string public constant ENVIRONMENT_ID = "Ethereum";
    uint256 public constant SLOTS_PER_EPOCH = 32;
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

    struct BeaconHeader {
        uint64 slot;
        uint64 proposerIndex;
        bytes32 parentRoot;
        bytes32 stateRoot;
        bytes32 bodyRoot;
    }

    struct FinalityProof {
        uint64 slot;
        BeaconHeader[] beacons;
        uint64 finalizedEpoch;
        uint64 attestedEpoch;
        /// SSZ branch from ExecutionPayload.block_hash up to beacons[0].bodyRoot.
        bytes32[] payloadBranch;
    }

    /// @dev Deneb/Electra: BeaconBlockBody field 9 (execution_payload, 16 leaves),
    /// ExecutionPayload field 12 (block_hash, 32 leaves): (16 + 9) * 32 + 12.
    uint256 public constant BLOCK_HASH_GINDEX = 812;

    constructor(address lock_) {
        require(lock_ != address(0), "VF-XCH-011: Ethereum lock");
        lock = lock_;
    }

    function verifyFinality(bytes calldata lockEventProof, bytes calldata sourceFinalityProof)
        external
        view
        returns (bool, bytes32, uint256)
    {
        LockEventProof memory e = abi.decode(lockEventProof, (LockEventProof));
        ExecutionHeader.View memory header = ExecutionHeader.open(e.headerRlp);
        FinalityProof memory f = abi.decode(sourceFinalityProof, (FinalityProof));
        _requireFinalized(f);
        require(
            _sszRoot(header.hash, f.payloadBranch, BLOCK_HASH_GINDEX) == f.beacons[0].bodyRoot,
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

    // ---- Casper FFG rules copied from EthereumFinalityChecker.verify ----
    function _requireFinalized(FinalityProof memory p) private pure {
        require(p.beacons.length >= 2, "VF-XCH-006: Ethereum beacon");
        require(p.beacons[0].slot == p.slot, "VF-XCH-006: Ethereum slot");
        require(p.beacons[0].bodyRoot != bytes32(0), "VF-XCH-006: Ethereum body root");
        bytes32 prev = _beaconRoot(p.beacons[0]);
        for (uint256 i = 1; i < p.beacons.length; i++) {
            require(p.beacons[i].slot > p.beacons[i - 1].slot, "VF-XCH-006: Ethereum slot order");
            require(p.beacons[i].parentRoot == prev, "VF-XCH-006: Ethereum parent root");
            require(p.beacons[i].bodyRoot != bytes32(0), "VF-XCH-006: Ethereum body root");
            prev = _beaconRoot(p.beacons[i]);
        }
        uint256 checkpointSlot = uint256(p.finalizedEpoch) * SLOTS_PER_EPOCH;
        require(uint256(p.slot) <= checkpointSlot, "VF-XCH-006: Ethereum after checkpoint");
        bool saw;
        for (uint256 i = 0; i < p.beacons.length; i++) if (uint256(p.beacons[i].slot) == checkpointSlot) saw = true;
        require(saw, "VF-XCH-006: Ethereum checkpoint header");
        require(
            uint256(p.beacons[p.beacons.length - 1].slot) / SLOTS_PER_EPOCH == uint256(p.attestedEpoch),
            "VF-XCH-006: Ethereum attested epoch"
        );
        require(uint256(p.attestedEpoch) >= uint256(p.finalizedEpoch) + 2, "VF-XCH-006: Ethereum not finalized");
    }

    function _sszRoot(bytes32 leaf, bytes32[] memory branch, uint256 gindex) private pure returns (bytes32 h) {
        h = leaf;
        for (uint256 i = 0; i < branch.length; i++) {
            h = gindex & 1 == 1 ? sha256(abi.encodePacked(branch[i], h)) : sha256(abi.encodePacked(h, branch[i]));
            gindex >>= 1;
        }
        require(gindex == 1, "VF-XCH-006: Ethereum payload branch");
    }

    function _beaconRoot(BeaconHeader memory h) private pure returns (bytes32) {
        bytes32 h01 = sha256(abi.encodePacked(_u64(h.slot), _u64(h.proposerIndex)));
        bytes32 h23 = sha256(abi.encodePacked(h.parentRoot, h.stateRoot));
        bytes32 h45 = sha256(abi.encodePacked(h.bodyRoot, bytes32(0)));
        bytes32 h67 = sha256(abi.encodePacked(bytes32(0), bytes32(0)));
        return sha256(abi.encodePacked(sha256(abi.encodePacked(h01, h23)), sha256(abi.encodePacked(h45, h67))));
    }

    function _u64(uint64 x) private pure returns (bytes32) {
        uint256 v = uint256(x);
        uint256 le;
        for (uint256 i = 0; i < 8; i++) {
            le = (le << 8) | (v & 0xff);
            v >>= 8;
        }
        return bytes32(le << 192);
    }
}
