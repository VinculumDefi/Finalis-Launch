// SPDX-License-Identifier: PROTOCOL-RESTRICTED
pragma solidity 0.8.19;
import "../interfaces/IChainVerifier.sol";
/// @title SolanaLockReader
/// @notice VF-XCH-011. Facts come from the LockCreated event on a finalized slot.
/// A zero recipient reverts. Slot authentication remains evidence required.
contract SolanaLockReader is IChainVerifier {
    string public constant ENVIRONMENT_ID = "Solana";
    function verifyFinality(bytes calldata, bytes calldata sourceFinalityProof) external pure returns (bool, bytes32, uint256) {
        (bytes32 blockhash, uint256 slot, uint8 commitment) = abi.decode(sourceFinalityProof, (bytes32, uint256, uint8));
        require(commitment == 1 && blockhash != bytes32(0) && slot != 0, "VF-XCH-006: Solana slot not finalized");
        return (true, blockhash, slot);
    }
    function extractFacts(bytes calldata lockEventProof) external pure returns (bytes32, uint256, uint256, uint256, uint256, uint256, uint256, address, uint8) {
        (bytes32 lockId, uint256 gross, uint256 fee, uint256 principal, uint256 duration, uint256 createdAt, uint256 maturity, address recipient, uint8 outputToken) = abi.decode(lockEventProof, (bytes32, uint256, uint256, uint256, uint256, uint256, uint256, address, uint8));
        require(recipient != address(0), "VF-XCH-011: Solana recipient missing");
        require(outputToken <= 1, "VF-XCH-011: Solana output token");
        return (lockId, gross, fee, principal, duration, createdAt, maturity, recipient, outputToken);
    }
}
