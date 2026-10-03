// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "./Secp256k1.sol";
import "./ExecutionHeader.sol";

/// @title Polygon PoS Heimdall v2 milestone finality.
/// @notice Revision 8. Deterministic finality is a Heimdall milestone, not an
/// Ethereum confirmation count. Validators propose up to MaxMilestonePropositionLength
/// (10) consecutive Bor block hashes. A sequence agreed by >= 2/3 of voting power
/// is finalized. The persisted milestone carries proposer, start_block, end_block,
/// hash (end-block hash), bor_chain_id, milestone_id, and timestamp.
/// https://docs.polygon.technology/pos/architecture/heimdall_v2/milestones
/// https://docs.polygon.technology/pos/concepts/finality/finality
/// Bor's block hash is geth Header.Hash, keccak256 of the RLP execution header.
/// https://github.com/0xPolygon/bor/blob/master/core/types/block.go
/// https://github.com/ethereum/go-ethereum/blob/master/core/types/block.go
/// The validator set and its voting power are constructor inputs. This build
/// checks the milestone structure, the Bor range, and a secp256k1 quorum
/// (ecrecover) over that encoding. A Bor header outside the milestone reverts.
contract PolygonFinalityChecker {
    uint256 public constant MAX_MILESTONE_PROPOSITION_LENGTH = 10;

    address[] public validators;
    mapping(address => uint256) public power;
    uint256 public totalPower;

    struct Proof {
        bytes headerRlp;
        bytes32 blockHash;
        string proposer;
        uint64 startBlock;
        uint64 endBlock;
        bytes32 endHash;
        string borChainId;
        string milestoneId;
        uint64 milestoneTimestamp;
        bytes32[] blockHashes;
        address[] signers;
        bytes[] signatures;
    }

    constructor(address[] memory validators_, uint256[] memory power_) {
        require(validators_.length > 0 && validators_.length == power_.length, "set");
        for (uint256 i = 0; i < validators_.length; i++) {
            require(validators_[i] != address(0), "validator");
            require(power_[i] > 0, "power");
            require(power[validators_[i]] == 0, "dup validator");
            validators.push(validators_[i]);
            power[validators_[i]] = power_[i];
            totalPower += power_[i];
        }
    }

    function verify(bytes calldata proof)
        external
        view
        returns (bool finalized, bytes32 sourceBlockHash, uint256 sourceBlockHeight)
    {
        require(proof.length > 0, "empty proof");
        Proof memory p = abi.decode(proof, (Proof));
        require(bytes(p.proposer).length > 0, "proposer");
        require(bytes(p.borChainId).length > 0, "chain id");
        require(bytes(p.milestoneId).length > 0, "milestone id");
        require(p.milestoneTimestamp > 0, "milestone time");
        require(p.endBlock >= p.startBlock, "range");
        uint256 span = uint256(p.endBlock) - uint256(p.startBlock) + 1;
        require(span >= 1 && span <= MAX_MILESTONE_PROPOSITION_LENGTH, "proposition length");
        require(p.blockHashes.length == span, "hashes");
        require(p.endHash != bytes32(0) && p.endHash == p.blockHashes[p.blockHashes.length - 1], "end hash");

        require(p.blockHash != bytes32(0), "hash");
        ExecutionHeader.View memory header = ExecutionHeader.open(p.headerRlp);
        require(header.hash == p.blockHash, "header");
        require(header.number >= p.startBlock && header.number <= p.endBlock, "uncovered");
        require(p.blockHashes[header.number - uint256(p.startBlock)] == header.hash, "header hash");

        bytes32 digest = keccak256(
            abi.encode(
                p.proposer,
                p.startBlock,
                p.endBlock,
                p.endHash,
                p.borChainId,
                p.milestoneId,
                p.milestoneTimestamp,
                p.blockHashes
            )
        );
        require(p.signers.length == p.signatures.length && p.signers.length > 0, "sigs");
        uint256 signedPower;
        for (uint256 i = 0; i < p.signers.length; i++) {
            address recovered = Secp256k1.recover(digest, p.signatures[i]);
            require(recovered == p.signers[i], "signer");
            uint256 w = power[recovered];
            require(w > 0, "not validator");
            for (uint256 j = 0; j < i; j++) {
                require(p.signers[j] != recovered, "duplicate");
            }
            signedPower += w;
        }
        require(signedPower * 3 >= totalPower * 2, "quorum");
        return (true, header.hash, header.number);
    }
}
