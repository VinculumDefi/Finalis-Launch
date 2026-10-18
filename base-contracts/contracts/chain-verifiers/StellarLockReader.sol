// SPDX-License-Identifier: PROTOCOL-RESTRICTED
pragma solidity 0.8.19;

import "../interfaces/IChainVerifier.sol";

/// @title StellarLockReader
/// @notice Stellar: BLOCKED. This reader fails closed. It replaces a stand-in
/// that decoded caller-supplied facts. Do not register it.
/// Reason: A ledger header commits to the transaction set and results only as whole-set hashes (txSetHash, txSetResultHash). Proving one lock needs the full XDR transaction set and result set of that ledger (often hundreds of kilobytes) plus an on-chain XDR parser for the Payment and CreateClaimableBalance operations and the result codes. Not built in this piece.
contract StellarLockReader is IChainVerifier {
    string public constant ENVIRONMENT_ID = "Stellar";
    string public constant STATUS = "BLOCKED: no chain-data proof for Stellar locks";

    function verifyFinality(bytes calldata, bytes calldata) external pure returns (bool, bytes32, uint256) {
        revert("VF-XCH-006: Stellar reader blocked");
    }

    function extractFacts(bytes calldata)
        external
        pure
        returns (bytes32, uint256, uint256, uint256, uint256, uint256, uint256, address, uint8)
    {
        revert("VF-XCH-011: Stellar reader blocked");
    }
}
