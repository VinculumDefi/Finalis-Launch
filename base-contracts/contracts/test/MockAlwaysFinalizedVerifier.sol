// SPDX-License-Identifier: PROTOCOL-RESTRICTED
pragma solidity 0.8.19;

import "../interfaces/IChainVerifier.sol";

/// @dev Test double: always reports finalized and echoes facts from lockEventProof, including recipient and output token.
interface IVerifierDevFundView {
    function devFundDestinations(string calldata environmentId) external view returns (address);
}

contract MockAlwaysFinalizedVerifier is IChainVerifier {
    /// @dev When set, lockDevFund reports this address (a lock that paid a
    /// different Dev Fund). When unset it reports the calling Verifier's own
    /// configured Dev Fund for the environment.
    address public devFundOverride;

    function setDevFundOverride(address d) external {
        devFundOverride = d;
    }

    function lockDevFund(string calldata environmentId, bytes calldata) external view returns (address) {
        if (devFundOverride != address(0)) return devFundOverride;
        return IVerifierDevFundView(msg.sender).devFundDestinations(environmentId);
    }

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
