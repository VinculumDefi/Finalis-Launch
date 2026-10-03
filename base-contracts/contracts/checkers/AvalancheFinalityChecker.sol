// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "./Secp256k1.sol";
import "./ExecutionHeader.sol";

/// @title Avalanche Snowman acceptance.
/// @notice Revision 8. A Snowman block is a decision: once accepted it is
/// final, and once rejected it stays rejected. The header carries the parent
/// id, height, and timestamp. Acceptance walks parent-first, and a vote for a
/// block counts for its ancestors (transitive voting).
/// https://docs.avax.network/docs/primary-network/avalanche-consensus
/// https://github.com/ava-labs/avalanchego/blob/master/snow/consensus/snowman/block.go
/// AvalancheGo's published sample is k = 20 and quorum alpha = 14. This checker
/// applies that ratio to the constructor stake set: signed stake * 20 must be
/// at least total stake * 14. The set is an input, not mainnet validators.
/// C-Chain Snowman block id is the coreth wrapped-block id, ids.ID(ethBlock.Hash()),
/// and Parent() is ids.ID(ethBlock.ParentHash()). That hash is keccak256 of the
/// RLP execution header, not sha256 of three fields.
/// https://github.com/ava-labs/coreth/blob/master/plugin/evm/wrapped_block.go
/// https://github.com/ethereum/go-ethereum/blob/master/core/types/block.go
/// Status is consensus state, not part of the id. Rejected = 2, Accepted = 3.
contract AvalancheFinalityChecker {
    uint256 public constant SAMPLE_K = 20;
    uint256 public constant QUORUM_ALPHA = 14;
    uint8 public constant REJECTED = 2;
    uint8 public constant ACCEPTED = 3;

    address[] public validators;
    mapping(address => uint256) public stakeOf;
    uint256 public totalStake;

    struct Proof {
        bytes parentRlp;
        bytes blockRlp;
        uint8 parentStatus;
        uint8 blockStatus;
        address[] signers;
        bytes[] signatures;
    }

    constructor(address[] memory validators_, uint256[] memory stake_) {
        require(validators_.length > 0 && validators_.length == stake_.length, "set");
        for (uint256 i = 0; i < validators_.length; i++) {
            require(validators_[i] != address(0), "validator");
            require(stake_[i] > 0, "stake");
            require(stakeOf[validators_[i]] == 0, "dup validator");
            validators.push(validators_[i]);
            stakeOf[validators_[i]] = stake_[i];
            totalStake += stake_[i];
        }
    }

    function verify(bytes calldata proof)
        external
        view
        returns (bool finalized, bytes32 sourceBlockHash, uint256 sourceBlockHeight)
    {
        require(proof.length > 0, "empty proof");
        Proof memory p = abi.decode(proof, (Proof));
        require(p.parentStatus == ACCEPTED, "parent not accepted");
        require(p.blockStatus == ACCEPTED, "not accepted");
        ExecutionHeader.View memory parent = ExecutionHeader.open(p.parentRlp);
        ExecutionHeader.View memory blockHeader = ExecutionHeader.open(p.blockRlp);
        require(blockHeader.number == parent.number + 1, "height link");
        require(blockHeader.timestamp >= parent.timestamp, "time");
        require(blockHeader.parentHash == parent.hash, "parent");
        bytes32 id = blockHeader.hash;

        require(p.signers.length == p.signatures.length && p.signers.length > 0, "sigs");
        uint256 signedStake;
        for (uint256 i = 0; i < p.signers.length; i++) {
            address recovered = Secp256k1.recover(id, p.signatures[i]);
            require(recovered == p.signers[i], "signer");
            uint256 w = stakeOf[recovered];
            require(w > 0, "not validator");
            for (uint256 j = 0; j < i; j++) {
                require(p.signers[j] != recovered, "duplicate");
            }
            signedStake += w;
        }
        require(signedStake * SAMPLE_K >= totalStake * QUORUM_ALPHA, "quorum");
        return (true, id, blockHeader.number);
    }
}
