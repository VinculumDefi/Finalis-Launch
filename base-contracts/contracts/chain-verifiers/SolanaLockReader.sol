// SPDX-License-Identifier: PROTOCOL-RESTRICTED
pragma solidity 0.8.19;

import "../interfaces/IChainVerifier.sol";

/// @title SolanaLockReader
/// @notice Solana: BLOCKED. This reader fails closed. It replaces a stand-in
/// that decoded caller-supplied facts. Do not register it.
/// Reason: Solana blocks commit to transactions only through the proof-of-history entry chain (hundreds of thousands of sequential SHA-256 steps per block) and to account state through the bank hash, which has no per-account inclusion proof. A block hash alone therefore cannot prove the vf-solana-vault record; doing so needs the cluster's consensus data, which is outside the operator's simple bar.
contract SolanaLockReader is IChainVerifier {
    string public constant ENVIRONMENT_ID = "Solana";
    string public constant STATUS = "BLOCKED: no chain-data proof for Solana locks";

    function verifyFinality(bytes calldata, bytes calldata) external pure returns (bool, bytes32, uint256) {
        revert("VF-XCH-006: Solana reader blocked");
    }

    function extractFacts(bytes calldata)
        external
        pure
        returns (bytes32, uint256, uint256, uint256, uint256, uint256, uint256, address, uint8)
    {
        revert("VF-XCH-011: Solana reader blocked");
    }

    function extractAssetId(bytes calldata) external pure returns (bytes32) {
        revert("VF-XCH-011: Solana reader blocked");
    }
}
