// SPDX-License-Identifier: PROTOCOL-RESTRICTED
pragma solidity 0.8.19;
import "../interfaces/IChainVerifier.sol";
/// @title StellarLockReader
/// @notice VF-XCH-011. Facts come from the claimable-balance lock on a closed ledger.
contract StellarLockReader is IChainVerifier {
    string public constant ENVIRONMENT_ID = "Stellar";
    function verifyFinality(bytes calldata, bytes calldata sourceFinalityProof) external pure returns (bool, bytes32, uint256) {
        (bytes32 ledgerHash, uint256 sequence, bool closed) = abi.decode(sourceFinalityProof, (bytes32, uint256, bool));
        require(closed && ledgerHash != bytes32(0) && sequence != 0, "VF-XCH-006: Stellar ledger not closed");
        return (true, ledgerHash, sequence);
    }
    function extractFacts(bytes calldata lockEventProof) external pure returns (bytes32, uint256, uint256, uint256, uint256, uint256, uint256, address, uint8) {
        (bytes32 lockId, uint256 gross, uint256 fee, uint256 principal, uint256 duration, uint256 createdAt, uint256 maturity, address recipient, uint8 outputToken) = abi.decode(lockEventProof, (bytes32, uint256, uint256, uint256, uint256, uint256, uint256, address, uint8));
        require(recipient != address(0), "VF-XCH-011: Stellar recipient missing");
        require(outputToken <= 1, "VF-XCH-011: Stellar output token");
        return (lockId, gross, fee, principal, duration, createdAt, maturity, recipient, outputToken);
    }
}
