// SPDX-License-Identifier: PROTOCOL-RESTRICTED
pragma solidity 0.8.19;
import "../interfaces/IChainVerifier.sol";
/// @title Bitcoin CashLockReader
/// @notice VF-XCH-011 for Bitcoin Cash. Facts come from the CLTV lock transaction.
/// A zero recipient reverts. Header proof remains evidence required.
contract BitcoinCashLockReader is IChainVerifier {
    string public constant ENVIRONMENT_ID = "Bitcoin Cash";
    uint256 public constant MIN_CONFIRMATIONS = 6;
    function verifyFinality(bytes calldata, bytes calldata sourceFinalityProof) external pure returns (bool, bytes32, uint256) {
        (bytes32 blockHash, uint256 height, uint256 confirmations) = abi.decode(sourceFinalityProof, (bytes32, uint256, uint256));
        require(blockHash != bytes32(0) && height != 0 && confirmations >= MIN_CONFIRMATIONS, "VF-XCH-006: Bitcoin Cash confirmations");
        return (true, blockHash, height);
    }
    function extractFacts(bytes calldata lockEventProof) external pure returns (bytes32, uint256, uint256, uint256, uint256, uint256, uint256, address, uint8) {
        (bytes32 lockId, uint256 gross, uint256 fee, uint256 principal, uint256 duration, uint256 createdAt, uint256 maturity, address recipient, uint8 outputToken) = abi.decode(lockEventProof, (bytes32, uint256, uint256, uint256, uint256, uint256, uint256, address, uint8));
        require(recipient != address(0), "VF-XCH-011: Bitcoin Cash recipient missing");
        require(outputToken <= 1, "VF-XCH-011: Bitcoin Cash output token");
        return (lockId, gross, fee, principal, duration, createdAt, maturity, recipient, outputToken);
    }
}
