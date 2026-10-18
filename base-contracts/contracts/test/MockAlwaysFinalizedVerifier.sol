// SPDX-License-Identifier: PROTOCOL-RESTRICTED
pragma solidity 0.8.19;

import "../interfaces/IChainVerifier.sol";

/// @dev Test double: always reports finalized and echoes facts from lockEventProof, including recipient and output token.
contract MockAlwaysFinalizedVerifier is IChainVerifier {
    function verifyFinality(
        bytes calldata,
        bytes calldata
    ) external pure override returns (bool finalized, bytes32 sourceBlockHash, uint256 sourceBlockHeight) {
        return (true, bytes32(uint256(1)), 1);
    }

    function extractFacts(
        bytes calldata lockEventProof
    ) external pure override returns (
        bytes32 lockId,
        uint256 grossAmount,
        uint256 feeAmount,
        uint256 principalAmount,
        uint256 durationSecs,
        uint256 creationTimestamp,
        uint256 maturityTimestamp,
        address baseRecipient,
        uint8 outputToken
    ) {
        return abi.decode(
            lockEventProof,
            (bytes32, uint256, uint256, uint256, uint256, uint256, uint256, address, uint8)
        );
    }

    /// @dev Test proofs carry the lock's asset id as a 10th word. A proof
    /// without it has no provable asset and reverts.
    function extractAssetId(bytes calldata lockEventProof) external pure override returns (bytes32) {
        require(lockEventProof.length >= 320, "mock: no asset word");
        (, , , , , , , , , bytes32 assetId) = abi.decode(
            lockEventProof,
            (bytes32, uint256, uint256, uint256, uint256, uint256, uint256, address, uint8, bytes32)
        );
        return assetId;
    }
}
