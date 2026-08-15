// =============================================================================
// BaseSameChainVerifier — Base Environment Finality Verifier (Section O)
//
// STATUS: IMPLEMENTED. This is the reference implementation for IChainVerifier.
//
// Base is both the issuance chain and one of the 17 approved source
// environments (Rev 6 Section 11.1: EVM | Base | 33). A Base lock is recorded
// in VinculumFinalisBaseVault's storage on this same chain, so no cross-chain
// proof exists, is needed, or would mean anything.
//
// WHAT MAKES THIS DIFFERENT FROM A CALLER-TRUSTING VERIFIER
//   Both functions decode exactly one value from lockEventProof: the lock
//   identifier. Every returned fact is then read from vault storage. The
//   caller supplies a pointer; the chain supplies the facts.
//
//   sourceFinalityProof is IGNORED ENTIRELY. There is no assertion a caller
//   could make about Base that this contract cannot check for itself, so there
//   is no reason to read one. A verifier that accepts an assertion it could
//   have verified has chosen to be wrong.
//
//   Consequence for BASE-VERIFY step 11 (VF-XCH-011): the consumer cross-checks
//   these returned facts against the caller's package. Because the two now come
//   from independent sources — vault storage and the caller — that comparison
//   is meaningful. Where both sides originate with the caller it is not.
//
// TRUST ASSUMPTIONS (Verifier Completion Standard 3.7)
//   1. The vault address bound at construction is the deployed
//      VinculumFinalisBaseVault. Fixed at deployment, never mutable.
//   2. Vault storage is authoritative for Base lock facts. On the same chain
//      this is not an assumption about a third party; it is a read of the same
//      state machine executing this call.
//   No relayer, attestor, oracle, quorum, or administrator is trusted, and none
//   can influence the result (VF-XCH-012, VF-XCH-017).
//
// SCOPE. This contract adds no rule the specification does not state. Release
// state is deliberately NOT consulted: Rev 6 Section 3.2 orders issuance before
// maturity and release after it, and VF-XCH-013 replay protection belongs to
// the consumer (consumedLocks). Unstated rules in immutable contracts are a
// liability.
//
// SPDX-License-Identifier: PROTOCOL-RESTRICTED
// Solidity 0.8.19+
// =============================================================================

pragma solidity 0.8.19;

import "../interfaces/IChainVerifier.sol";

interface IBaseVaultReader {
    struct LockRecord {
        bytes32 lockId;
        address sourceAccount;
        address asset;
        bytes32 canonicalAssetId;
        address lockContract;
        uint256 grossAmount;
        uint256 feeAmount;
        uint256 principalAmount;
        uint256 verifiedGrossUsd;
        uint64  durationSecs;
        uint64  creationTime;
        uint64  maturityTime;
        address baseRecipient;
        address releaseDestination;
        uint8   outputToken;
        bytes32 chonxActivationReceipt;
        uint32  handshakeAllowanceCount;
        bool    exists;
    }

    function getLock(bytes32 lockId) external view returns (LockRecord memory);
}

contract BaseSameChainVerifier is IChainVerifier {

    error LockNotFound(bytes32 lockId);
    error ZeroAddress();

    string public constant ENVIRONMENT_ID = "base";

    IBaseVaultReader public immutable vault;

    constructor(address _vault) {
        if (_vault == address(0)) revert ZeroAddress();
        vault = IBaseVaultReader(_vault);
    }

    /// @notice Establishes that a Base lock exists and is final.
    /// @dev A lock recorded in vault storage was written by a transaction in a
    ///      block this call is executing on top of. There is no weaker or
    ///      stronger notion of finality available on the same chain, and no
    ///      caller assertion could improve on it — so `sourceFinalityProof` is
    ///      not read.
    /// @param lockEventProof ABI-encoded lock tuple. Only the lock identifier
    ///        is used; the remaining fields are the caller's claim and are
    ///        checked against storage by the consumer, not adopted here.
    function verifyFinality(
        bytes calldata lockEventProof,
        bytes calldata /* sourceFinalityProof — deliberately ignored */
    ) external view override returns (
        bool finalized,
        bytes32 sourceBlockHash,
        uint256 sourceBlockHeight
    ) {
        bytes32 lockId = _lockIdOf(lockEventProof);

        IBaseVaultReader.LockRecord memory r = vault.getLock(lockId);
        if (!r.exists) revert LockNotFound(lockId);

        // The most recent hash the EVM makes available. Derived, never supplied.
        return (true, blockhash(block.number - 1), block.number - 1);
    }

    /// @notice Returns the lock's immutable facts as recorded on this chain.
    /// @dev Every value is read from vault storage. The caller's encoded values
    ///      are not returned, so the consumer's cross-check compares two
    ///      independent sources.
    function extractFacts(
        bytes calldata lockEventProof
    ) external view override returns (
        bytes32 lockId,
        uint256 grossAmount,
        uint256 feeAmount,
        uint256 principalAmount,
        uint256 durationSecs,
        uint256 creationTimestamp,
        uint256 maturityTimestamp
    ) {
        bytes32 id = _lockIdOf(lockEventProof);

        IBaseVaultReader.LockRecord memory r = vault.getLock(id);
        if (!r.exists) revert LockNotFound(id);

        return (
            r.lockId,
            r.grossAmount,
            r.feeAmount,
            r.principalAmount,
            uint256(r.durationSecs),
            uint256(r.creationTime),
            uint256(r.maturityTime)
        );
    }

    /// @notice Whether a Base lock exists. Exposed so operators and the UI can
    ///         observe verifiability directly rather than inferring it from a
    ///         reverted transaction.
    function lockIsVerifiable(bytes32 lockId) external view returns (bool) {
        return vault.getLock(lockId).exists;
    }

    /// @dev Decodes the full lock tuple to preserve the shared encoding, then
    ///      discards everything except the identifier. The remaining fields are
    ///      the caller's assertion and carry no authority here.
    function _lockIdOf(bytes calldata lockEventProof) private pure returns (bytes32) {
        (bytes32 lockId, , , , , , ) = abi.decode(
            lockEventProof,
            (bytes32, uint256, uint256, uint256, uint256, uint256, uint256)
        );
        return lockId;
    }
}
