// SPDX-License-Identifier: PROTOCOL-RESTRICTED
pragma solidity 0.8.19;

import "../interfaces/IChainVerifier.sol";

/// @title SolanaLockReader
/// @notice Solana: BLOCKED. This reader fails closed. It replaces a stand-in
/// that decoded caller-supplied facts. Do not register it.
/// Reason (exact blocker, measured 2026-10-18):
///  1. Inclusion: a Solana block hash is the last proof-of-history entry hash
///     of the slot. A transaction is tied to it only through the sequential
///     SHA-256 chain from its entry to the end of the slot: mainnet runs
///     62,500 hashes per tick x 64 ticks = 4,000,000 hashes per slot. Each
///     step costs about 235 gas through the SHA-256 precompile, so a proof is
///     up to about 940 million gas (about 470 million on average), far above
///     one transaction's gas.
///  2. Success and state: nothing in the block hash or bank hash commits to a
///     transaction's result, and account state is committed only as a whole-
///     state accounts hash with no per-account inclusion proof. A failed lock
///     transaction is still recorded in its entry, so even a full chain walk
///     could not tell a successful lock from a failed one.
/// No change to the lock program or to the package removes either gap; the
/// smallest change that would meet the bar is a Solana protocol commitment to
/// per-block transaction results (or account changes) in the block hash.
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
