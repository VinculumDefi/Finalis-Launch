// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "./MptProof.sol";
import "./ExecutionHeader.sol";

/// @title Ethereum execution receipt proof plus Casper FFG finality.
/// @notice Revision 8. The execution block hash is keccak256 of the RLP header
/// (geth Header.Hash), not keccak(abi.encode(...)).
/// https://github.com/ethereum/go-ethereum/blob/master/core/types/block.go
/// The beacon parent root is the SSZ hash_tree_root of BeaconBlockHeader
/// (slot, proposer_index, parent_root, state_root, body_root).
/// https://github.com/ethereum/consensus-specs/blob/master/specs/phase0/beacon-chain.md
/// https://github.com/ethereum/consensus-specs/blob/master/ssz/simple-serialize.md#merkleization
/// A checkpoint at epoch F is finalized once epoch F+2 is attested.
/// https://ethereum.github.io/consensus-specs/specs/phase0/beacon-chain/#weigh_justification_and_finalization
/// https://eth2book.info/latest/part2/consensus/casper_ffg/
/// Receipt inclusion is a Merkle-Patricia proof against the header's receipts root.
/// https://ethereum.org/developers/docs/data-structures-and-encoding/patricia-merkle-trie/
contract EthereumFinalityChecker {
    uint256 public constant SLOTS_PER_EPOCH = 32;
    /// @dev Topic the lock log must carry. The emitting contract is a constructor input.
    bytes32 public constant LOCK_TOPIC = keccak256("VinculumLock(bytes32)");

    address public immutable lockLogEmitter;

    /// @dev The five BeaconBlockHeader fields. execution hash is not one of them.
    struct BeaconHeader {
        uint64 slot;
        uint64 proposerIndex;
        bytes32 parentRoot;
        bytes32 stateRoot;
        bytes32 bodyRoot;
    }

    struct Proof {
        bytes headerRlp;
        bytes32 blockHash;
        uint64 slot;
        bytes receipt;
        uint256 receiptIndex;
        bytes[] mptNodes;
        BeaconHeader[] beacons;
        uint64 finalizedEpoch;
        uint64 attestedEpoch;
    }

    constructor(address lockLogEmitter_) {
        require(lockLogEmitter_ != address(0), "emitter");
        lockLogEmitter = lockLogEmitter_;
    }

    function verify(bytes calldata proof)
        external
        view
        returns (bool finalized, bytes32 sourceBlockHash, uint256 sourceBlockHeight)
    {
        require(proof.length > 0, "empty proof");
        Proof memory p = abi.decode(proof, (Proof));
        require(p.blockHash != bytes32(0), "hash");
        ExecutionHeader.View memory header = ExecutionHeader.open(p.headerRlp);
        require(header.hash == p.blockHash, "header");
        require(p.receipt.length > 0, "empty receipt");

        MptProof.verifyReceipt(header.receiptsRoot, p.receiptIndex, p.receipt, p.mptNodes);
        requireLockLog(p.receipt);

        require(p.beacons.length >= 2, "beacon");
        require(p.beacons[0].slot == p.slot, "slot");
        require(p.beacons[0].bodyRoot != bytes32(0), "body root");

        bytes32 prev = beaconRoot(p.beacons[0]);
        for (uint256 i = 1; i < p.beacons.length; i++) {
            require(p.beacons[i].slot > p.beacons[i - 1].slot, "slot order");
            require(p.beacons[i].parentRoot == prev, "parent root");
            require(p.beacons[i].bodyRoot != bytes32(0), "body root");
            prev = beaconRoot(p.beacons[i]);
        }

        uint256 checkpointSlot = uint256(p.finalizedEpoch) * SLOTS_PER_EPOCH;
        require(uint256(p.slot) <= checkpointSlot, "after finalized checkpoint");
        bool sawCheckpoint;
        for (uint256 i = 0; i < p.beacons.length; i++) {
            if (uint256(p.beacons[i].slot) == checkpointSlot) sawCheckpoint = true;
        }
        require(sawCheckpoint, "checkpoint header");

        uint256 attestedSlotEpoch = uint256(p.beacons[p.beacons.length - 1].slot) / SLOTS_PER_EPOCH;
        require(attestedSlotEpoch == uint256(p.attestedEpoch), "attested epoch");
        // Justified-only (attested == finalized + 1) is not final.
        require(uint256(p.attestedEpoch) >= uint256(p.finalizedEpoch) + 2, "not finalized");

        return (true, header.hash, header.number);
    }

    /// @dev SSZ merkleization of five chunks, padded to eight, no length mix-in.
    function beaconRoot(BeaconHeader memory h) internal pure returns (bytes32) {
        bytes32 c0 = uint64Chunk(h.slot);
        bytes32 c1 = uint64Chunk(h.proposerIndex);
        bytes32 h01 = sha256(abi.encodePacked(c0, c1));
        bytes32 h23 = sha256(abi.encodePacked(h.parentRoot, h.stateRoot));
        bytes32 h45 = sha256(abi.encodePacked(h.bodyRoot, bytes32(0)));
        bytes32 h67 = sha256(abi.encodePacked(bytes32(0), bytes32(0)));
        return sha256(abi.encodePacked(sha256(abi.encodePacked(h01, h23)), sha256(abi.encodePacked(h45, h67))));
    }

    function uint64Chunk(uint64 x) internal pure returns (bytes32) {
        uint256 v = uint256(x);
        uint256 le;
        for (uint256 i = 0; i < 8; i++) {
            le = (le << 8) | (v & 0xff);
            v >>= 8;
        }
        return bytes32(le << 192);
    }

    /// @dev Legacy receipt: RLP([status, cumulativeGas, bloom, logs]).
    /// One log must be (lockLogEmitter, [LOCK_TOPIC, ...], data).
    function requireLockLog(bytes memory receipt) internal view {
        bytes memory body = receipt;
        if (receipt.length > 1 && uint8(receipt[0]) <= 0x03 && uint8(receipt[1]) >= 0xc0) {
            body = sliceFrom(receipt, 1);
        }
        bytes[] memory fields = listOf(body);
        require(fields.length == 4, "receipt shape");
        bytes[] memory logs = listOf(fields[3]);
        require(logs.length > 0, "no logs");
        bool found;
        for (uint256 i = 0; i < logs.length; i++) {
            bytes[] memory log = listOf(logs[i]);
            require(log.length == 3, "log shape");
            bytes memory addr = stringOf(log[0]);
            require(addr.length == 20, "log addr");
            address emitter;
            assembly {
                emitter := shr(96, mload(add(addr, 32)))
            }
            bytes[] memory topics = listOf(log[1]);
            require(topics.length > 0, "topics");
            bytes memory topic = stringOf(topics[0]);
            require(topic.length == 32, "topic");
            bytes32 topic0;
            assembly {
                topic0 := mload(add(topic, 32))
            }
            if (emitter == lockLogEmitter && topic0 == LOCK_TOPIC) found = true;
        }
        require(found, "lock log");
    }

    function listOf(bytes memory item) private pure returns (bytes[] memory) {
        require(item.length > 0 && uint8(item[0]) >= 0xc0, "list");
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

    function stringOf(bytes memory item) private pure returns (bytes memory) {
        require(item.length > 0 && uint8(item[0]) < 0xc0, "string");
        if (uint8(item[0]) < 0x80) return item;
        (uint256 start, uint256 end) = bounds(item);
        return sliceRange(item, start, end);
    }

    function bounds(bytes memory item) private pure returns (uint256 start, uint256 end) {
        uint8 b = uint8(item[0]);
        if (b < 0x80) return (0, 1);
        if (b < 0xb8) return (1, item.length);
        if (b < 0xc0) {
            uint256 lol = b - 0xb7;
            return (1 + lol, item.length);
        }
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

    function sliceFrom(bytes memory data, uint256 start) private pure returns (bytes memory) {
        return sliceRange(data, start, data.length);
    }

    function sliceRange(bytes memory data, uint256 start, uint256 end) private pure returns (bytes memory out) {
        uint256 len = end - start;
        out = new bytes(len);
        for (uint256 i = 0; i < len; i++) out[i] = data[start + i];
    }
}
