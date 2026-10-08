// SPDX-License-Identifier: PROTOCOL-RESTRICTED
pragma solidity 0.8.19;
import "../interfaces/IChainVerifier.sol";
/// @title XrplLockReader
/// @notice VF-XCH-011. Facts come from the EscrowCreate lock on a validated ledger.
contract XrplLockReader is IChainVerifier {
    string public constant ENVIRONMENT_ID = "XRP Ledger";
    function verifyFinality(bytes calldata, bytes calldata sourceFinalityProof) external pure returns (bool, bytes32, uint256) {
        (bytes32 ledgerHash, uint256 index, bool validated) = abi.decode(sourceFinalityProof, (bytes32, uint256, bool));
        require(validated && ledgerHash != bytes32(0) && index != 0, "VF-XCH-006: XRPL ledger not validated");
        return (true, ledgerHash, index);
    }
    function extractFacts(bytes calldata lockEventProof) external pure returns (bytes32, uint256, uint256, uint256, uint256, uint256, uint256, address, uint8) {
        (bytes32 lockId, uint256 gross, uint256 fee, uint256 principal, uint256 duration, uint256 createdAt, uint256 maturity, address recipient, uint8 outputToken) = abi.decode(lockEventProof, (bytes32, uint256, uint256, uint256, uint256, uint256, uint256, address, uint8));
        require(recipient != address(0), "VF-XCH-011: XRPL recipient missing");
        require(outputToken <= 1, "VF-XCH-011: XRPL output token");
        return (lockId, gross, fee, principal, duration, createdAt, maturity, recipient, outputToken);
    }
}
