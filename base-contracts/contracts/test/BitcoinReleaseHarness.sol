// =============================================================================
// BitcoinReleaseHarness — TEST FIXTURE ONLY. Never deployed.
//
// Bitcoin principal is not an ERC-20 held by CommitmentLock. Release is a CLTV
// spend of the P2WSH principal output (Architecture C.8). This harness enforces
// that rule on a non-witness spend: nLockTime before the script maturity
// reverts, and a mature spend pays the full principal to the bound script.
// =============================================================================

// SPDX-License-Identifier: PROTOCOL-RESTRICTED
pragma solidity 0.8.19;

import "../libraries/BitcoinTx.sol";

contract BitcoinReleaseHarness {
    error NotMature(uint256 maturity, uint256 lockTime);
    error AlreadyReleased();
    error BadRelease();

    bool public released;
    bytes public boundScript;
    uint64 public releasedAmount;

    /// @notice Release the lock's principal output to `destinationScript`.
    /// @dev Reverts before maturity. Pays exactly the principal (no second fee).
    function release(
        bytes calldata spendTx,
        bytes calldata lockTx,
        bytes calldata witnessScript,
        bytes calldata destinationScript
    ) external {
        if (released) revert AlreadyReleased();

        (uint256 maturity, ) = BitcoinTx.parseCltvScript(witnessScript);
        BitcoinTx.LockFacts memory facts =
            BitcoinTx.extractLockFacts(lockTx, witnessScript, 1, 0);

        uint256 n = spendTx.length;
        // version + 1 input + empty scriptSig + sequence + 1 output header + locktime
        if (n < 60) revert BadRelease();

        uint256 lockTime = _readUint32LE(spendTx, n - 4);
        if (lockTime < maturity) revert NotMature(maturity, lockTime);

        if (uint8(spendTx[4]) != 1) revert BadRelease();
        if (_readBytes32(spendTx, 5) != facts.txHash) revert BadRelease();
        if (_readUint32LE(spendTx, 37) != 1) revert BadRelease();
        if (uint8(spendTx[41]) != 0) revert BadRelease();
        // BIP65: a final sequence disables nLockTime, so CLTV cannot pass.
        if (_readUint32LE(spendTx, 42) == 0xffffffff) revert BadRelease();
        if (uint8(spendTx[46]) != 1) revert BadRelease();

        uint64 value = _readUint64LE(spendTx, 47);
        if (value != facts.principalAmount) revert BadRelease();

        uint256 scriptLen = uint8(spendTx[55]);
        if (56 + scriptLen + 4 != n) revert BadRelease();

        bytes memory spk = new bytes(scriptLen);
        for (uint256 i = 0; i < scriptLen; i++) {
            spk[i] = spendTx[56 + i];
        }
        if (keccak256(spk) != keccak256(destinationScript)) revert BadRelease();

        released = true;
        boundScript = destinationScript;
        releasedAmount = value;
    }

    function _readUint32LE(bytes calldata b, uint256 offset) private pure returns (uint256 out) {
        out = uint256(uint8(b[offset]))
            | (uint256(uint8(b[offset + 1])) << 8)
            | (uint256(uint8(b[offset + 2])) << 16)
            | (uint256(uint8(b[offset + 3])) << 24);
    }

    function _readUint64LE(bytes calldata b, uint256 offset) private pure returns (uint64 out) {
        for (uint256 i = 0; i < 8; i++) {
            out |= uint64(uint256(uint8(b[offset + i])) << (8 * i));
        }
    }

    function _readBytes32(bytes calldata b, uint256 offset) private pure returns (bytes32 out) {
        assembly ("memory-safe") {
            out := calldataload(add(b.offset, offset))
        }
    }
}
