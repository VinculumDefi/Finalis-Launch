// SPDX-License-Identifier: PROTOCOL-RESTRICTED
pragma solidity 0.8.19;

import "../interfaces/IChainVerifier.sol";

/// @title XrplLockReader
/// @notice XRP Ledger: BLOCKED. This reader fails closed. It replaces a stand-in
/// that decoded caller-supplied facts. Do not register it.
/// Reason: Ledger hashes and the transaction SHAMap use SHA-512Half; the EVM has no SHA-512 precompile, so a Solidity SHA-512 is required, plus SHAMap inner-node proofs and an XRPL binary-codec parser for the Payment and EscrowCreate transactions and their metadata (tesSUCCESS). Not built in this piece.
contract XrplLockReader is IChainVerifier {
    string public constant ENVIRONMENT_ID = "XRP Ledger";
    string public constant STATUS = "BLOCKED: no chain-data proof for XRP Ledger locks";

    function verifyFinality(bytes calldata, bytes calldata) external pure returns (bool, bytes32, uint256) {
        revert("VF-XCH-006: XRP Ledger reader blocked");
    }

    function extractFacts(bytes calldata)
        external
        pure
        returns (bytes32, uint256, uint256, uint256, uint256, uint256, uint256, address, uint8)
    {
        revert("VF-XCH-011: XRP Ledger reader blocked");
    }
}
