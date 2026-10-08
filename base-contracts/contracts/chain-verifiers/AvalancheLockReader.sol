// SPDX-License-Identifier: PROTOCOL-RESTRICTED
pragma solidity 0.8.19;
import "../interfaces/IChainVerifier.sol";
/// @title AvalancheLockReader
/// @notice VF-XCH-011 for Avalanche. Facts come from the CommitmentVaultLock event proof.
/// Finality model: Snowman. This reader does not accept a separate caller recipient.
/// A zero recipient reverts. Header authentication remains evidence required.
contract AvalancheLockReader is IChainVerifier {
    string public constant ENVIRONMENT_ID = "Avalanche";
    function verifyFinality(bytes calldata, bytes calldata sourceFinalityProof) external pure returns (bool, bytes32, uint256) {
        (bytes32 blockHash, uint256 height, bool finalized) = abi.decode(sourceFinalityProof, (bytes32, uint256, bool));
        require(finalized && blockHash != bytes32(0) && height != 0, "VF-XCH-006: Avalanche not finalized");
        return (true, blockHash, height);
    }
    function extractFacts(bytes calldata lockEventProof) external pure returns (bytes32, uint256, uint256, uint256, uint256, uint256, uint256, address, uint8) {
        (bytes32 lockId, uint256 gross, uint256 fee, uint256 principal, uint256 duration, uint256 createdAt, uint256 maturity, address recipient, uint8 outputToken) = abi.decode(lockEventProof, (bytes32, uint256, uint256, uint256, uint256, uint256, uint256, address, uint8));
        require(recipient != address(0), "VF-XCH-011: Avalanche recipient missing");
        require(outputToken <= 1, "VF-XCH-011: Avalanche output token");
        return (lockId, gross, fee, principal, duration, createdAt, maturity, recipient, outputToken);
    }
}
