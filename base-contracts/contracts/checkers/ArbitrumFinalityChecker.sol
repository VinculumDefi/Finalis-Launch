// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

/// @title Arbitrum One assertion finality.
/// @notice Revision 8. Arbitrum One's challenge period is 45818 L1 blocks
/// (about one week). A proof younger than that window is refused.
/// https://docs.arbitrum.io/launch-arbitrum-chain/configure-your-chain/common/validation-and-security/customizable-challenge-period
/// https://docs.arbitrum.io/arbitrum-bridge/troubleshooting
/// The assertion hash is the Nitro encoding:
/// keccak256(parentAssertionHash || afterStateHash || inboxAcc)
/// where afterStateHash = keccak256(abi.encode(globalState, machineStatus, endHistoryRoot))
/// and globalState packs block hash, send root, inbox position, position in message.
/// MachineStatus.FINISHED is 1.
/// https://github.com/OffchainLabs/nitro-contracts/blob/main/src/rollup/RollupLib.sol
/// https://github.com/OffchainLabs/nitro-contracts/blob/main/src/rollup/AssertionState.sol
/// https://github.com/OffchainLabs/nitro-contracts/blob/main/src/state/GlobalState.sol
contract ArbitrumFinalityChecker {
    uint64 public constant CONFIRM_PERIOD_BLOCKS = 45818;
    uint8 public constant MACHINE_FINISHED = 1;

    struct Proof {
        bytes32 parentAssertionHash;
        bytes32 blockHash;
        bytes32 sendRoot;
        uint64 inboxPosition;
        uint64 positionInMessage;
        bytes32 endHistoryRoot;
        bytes32 inboxAcc;
        bytes32 assertionHash;
        uint64 createdAtBlock;
        uint64 l1BlockNumber;
        uint256 l2BlockHeight;
    }

    function verify(bytes calldata proof)
        external
        pure
        returns (bool finalized, bytes32 sourceBlockHash, uint256 sourceBlockHeight)
    {
        require(proof.length > 0, "empty proof");
        Proof memory p = abi.decode(proof, (Proof));
        require(p.l2BlockHeight > 0, "height");
        require(p.blockHash != bytes32(0), "hash");
        require(p.inboxPosition > 0, "inbox");
        require(p.createdAtBlock > 0, "created");
        require(p.parentAssertionHash != bytes32(0), "parent assertion");
        bytes32 afterStateHash = keccak256(
            abi.encode(
                p.blockHash,
                p.sendRoot,
                p.inboxPosition,
                p.positionInMessage,
                MACHINE_FINISHED,
                p.endHistoryRoot
            )
        );
        bytes32 computed = keccak256(abi.encodePacked(p.parentAssertionHash, afterStateHash, p.inboxAcc));
        require(computed == p.assertionHash, "assertion hash");
        require(uint256(p.l1BlockNumber) >= uint256(p.createdAtBlock) + uint256(CONFIRM_PERIOD_BLOCKS), "inside window");
        return (true, p.blockHash, p.l2BlockHeight);
    }
}
