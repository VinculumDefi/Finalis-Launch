// =============================================================================
// UtxoChainVerifier — UTXO Family Finality Verifier (Section O)
//
// STATUS: NOT IMPLEMENTED — FAILS CLOSED
//
// Handles (when implemented): Bitcoin (depth>=6), Litecoin, Dogecoin,
//                             DigiByte, Zcash (depth>=10), BitcoinCash.
//
// This contract previously accepted a caller-supplied confirmation count and
// returned finalized=true without verifying that the referenced block existed
// or that the lock event occurred. See CL-76 and
// base-contracts/test/10_cl76_forged_package.test.cjs.
//
// Per Rev 7 fail-closed policy, a security-critical component may exist only
// as (1) fully implemented and evidenced, or (2) explicitly non-operational.
// Placeholder implementations that appear operational are prohibited.
//
// REQUIRED FOR IMPLEMENTATION (Section O):
//   Bitcoin-family SPV — PoW header chain resident on Base, initial trusted
//   checkpoint header, header sync, merkle inclusion proof of the lock
//   transaction against the header chain, and reorg depth policy per chain.
//   The six chains share one pattern; depth differs per chain.
//
// Finality Proof encoding (retained for the future implementation):
//   (bytes32 blockHash, uint256 blockHeight, uint256 confirmations)
// Lock Event Proof encoding:
//   (bytes32 lockId, uint256 grossAmount, uint256 feeAmount, uint256 principalAmount,
//    uint256 durationSecs, uint256 creationTimestamp, uint256 maturityTimestamp)
//
// SPDX-License-Identifier: PROTOCOL-RESTRICTED
// Solidity 0.8.19+
// =============================================================================

pragma solidity 0.8.19;

import "../interfaces/IChainVerifier.sol";

contract UtxoChainVerifier is IChainVerifier {
    /// @notice Thrown on every call. This verifier has no production
    ///         verification mechanism and must not be relied upon.
    error VerifierNotImplemented(string environmentFamily);

    string public environmentId;
    uint256 public minConfirmations;

    constructor(string memory _environmentId, uint256 _minConfirmations) {
        environmentId = _environmentId;
        minConfirmations = _minConfirmations;
    }

    // setMinConfirmations removed: it was external with no access control.
    // Reintroduce with an explicit authority when the verifier is implemented.

    function verifyFinality(
        bytes calldata,
        bytes calldata
    ) external view override returns (bool, bytes32, uint256) {
        revert VerifierNotImplemented("utxo");
    }

    function extractFacts(
        bytes calldata
    ) external pure override returns (
        bytes32, uint256, uint256, uint256, uint256, uint256, uint256
    ) {
        revert VerifierNotImplemented("utxo");
    }
}
