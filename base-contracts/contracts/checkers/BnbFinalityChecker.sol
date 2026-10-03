// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "./Secp256k1.sol";
import "./ExecutionHeader.sol";

/// @title BNB Smart Chain Parlia fast finality.
/// @notice Revision 8. A block is finalized when at least 2/3 of the validator
/// set vote for it. BEP-126 encodes a vote as <v, s, t, h(s), h(t)>: vote
/// address, source hash, target hash, source number, target number. A
/// supermajority link is 2/3 or more of the validators voting the same target.
/// https://github.com/bnb-chain/BEPs/blob/master/BEPs/BEP126.md
/// https://forum.bnbchain.org/t/faq-everything-about-fastfinality/1345
/// The header hash is Parlia/geth Header.Hash: keccak256 of the RLP header.
/// https://github.com/bnb-chain/bsc/blob/master/core/types/block.go
/// https://github.com/ethereum/go-ethereum/blob/master/core/types/block.go
/// Production headers store a BLS aggregate (VoteAttestation). This checker
/// verifies the published vote fields and a secp256k1 signature from each vote
/// address (ecrecover). The validator set is a constructor input, not a
/// mainnet set. Quorum is count >= ceil(2/3 * n), i.e. count * 3 >= n * 2.
contract BnbFinalityChecker {
    address[] public validators;
    mapping(address => bool) public isValidator;

    struct Vote {
        address voteAddress;
        bytes32 sourceHash;
        bytes32 targetHash;
        uint64 sourceNumber;
        uint64 targetNumber;
        bytes signature;
    }

    struct Proof {
        bytes headerRlp;
        bytes32 headerHash;
        Vote[] votes;
    }

    constructor(address[] memory validators_) {
        require(validators_.length > 0, "set");
        for (uint256 i = 0; i < validators_.length; i++) {
            require(validators_[i] != address(0), "validator");
            require(!isValidator[validators_[i]], "dup validator");
            isValidator[validators_[i]] = true;
            validators.push(validators_[i]);
        }
    }

    function validatorCount() external view returns (uint256) {
        return validators.length;
    }

    function verify(bytes calldata proof)
        external
        view
        returns (bool finalized, bytes32 sourceBlockHash, uint256 sourceBlockHeight)
    {
        require(proof.length > 0, "empty proof");
        Proof memory p = abi.decode(proof, (Proof));
        require(p.headerHash != bytes32(0), "hash");
        ExecutionHeader.View memory header = ExecutionHeader.open(p.headerRlp);
        require(header.hash == p.headerHash, "header");
        require(p.votes.length > 0, "no votes");

        uint256 count;
        for (uint256 i = 0; i < p.votes.length; i++) {
            Vote memory vote = p.votes[i];
            require(vote.targetHash == header.hash, "target");
            require(vote.targetNumber == header.number, "target number");
            require(vote.sourceHash == header.parentHash, "source");
            require(vote.sourceNumber < vote.targetNumber, "source number");
            for (uint256 j = 0; j < i; j++) {
                require(p.votes[j].voteAddress != vote.voteAddress, "duplicate");
            }
            require(isValidator[vote.voteAddress], "not validator");
            bytes32 digest = keccak256(
                abi.encode(vote.voteAddress, vote.sourceHash, vote.targetHash, vote.sourceNumber, vote.targetNumber)
            );
            require(Secp256k1.recover(digest, vote.signature) == vote.voteAddress, "vote sig");
            count++;
        }
        uint256 n = validators.length;
        require(count * 3 >= n * 2, "quorum");
        return (true, header.hash, header.number);
    }
}
