// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

/// @title OP Stack output-root finality.
/// @notice Revision 8. An L2 block is finalized here when its output root was
/// proposed, the dispute game resolved for the defender, and the dispute-game
/// finality delay has elapsed. Output root v0 is
/// keccak256(version || state_root || withdrawal_storage_root || latest_block_hash)
/// with version bytes32(0).
/// https://specs.optimism.io/protocol/proposals.html
/// OP Mainnet standard disputeGameFinalityDelaySeconds is 302400 (3.5 days),
/// the airgap after a game resolves before its result is finalized. This is not
/// the Arbitrum challenge window.
/// https://docs.optimism.io/op-stack/fault-proofs/reference
/// https://specs.optimism.io/fault-proof/stage-one/anchor-state-registry.html
/// GameStatus.DEFENDER_WINS is 2.
contract OptimismFinalityChecker {
    uint256 public constant DISPUTE_GAME_FINALITY_DELAY_SECONDS = 302400;
    uint8 public constant DEFENDER_WINS = 2;

    struct Proof {
        bytes32 stateRoot;
        bytes32 withdrawalStorageRoot;
        bytes32 latestBlockHash;
        uint256 l2BlockNumber;
        bytes32 outputRoot;
        uint8 gameStatus;
        uint256 resolvedAt;
        uint256 observedAt;
    }

    function verify(bytes calldata proof)
        external
        pure
        returns (bool finalized, bytes32 sourceBlockHash, uint256 sourceBlockHeight)
    {
        require(proof.length > 0, "empty proof");
        Proof memory p = abi.decode(proof, (Proof));
        require(p.l2BlockNumber > 0, "height");
        require(p.latestBlockHash != bytes32(0), "hash");
        require(p.stateRoot != bytes32(0), "state root");
        require(p.withdrawalStorageRoot != bytes32(0), "withdrawal root");
        require(p.resolvedAt > 0 && p.observedAt > 0, "time");
        bytes32 computed = keccak256(
            abi.encodePacked(bytes32(0), p.stateRoot, p.withdrawalStorageRoot, p.latestBlockHash)
        );
        require(computed == p.outputRoot, "output root");
        require(p.gameStatus == DEFENDER_WINS, "game");
        require(p.observedAt >= p.resolvedAt + DISPUTE_GAME_FINALITY_DELAY_SECONDS, "inside window");
        return (true, p.latestBlockHash, p.l2BlockNumber);
    }
}
