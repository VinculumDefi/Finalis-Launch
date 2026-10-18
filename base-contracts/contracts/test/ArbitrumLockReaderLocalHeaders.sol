// SPDX-License-Identifier: PROTOCOL-RESTRICTED
pragma solidity 0.8.19;

import "../chain-verifiers/ArbitrumLockReader.sol";

/// @dev TEST ONLY. Hardhat cannot produce Arbitrum-format block headers, so
/// this harness runs ArbitrumLockReader's exact proof and fact path with the
/// Arbitrum header-shape check switched off. The shape check itself is tested
/// on a real Arbitrum One header fixture against ArbitrumLockReader. Never deploy.
contract ArbitrumLockReaderLocalHeaders is ArbitrumLockReader {
    constructor(address lock_) ArbitrumLockReader(lock_) {}

    function _checkHeaderShape(bytes[] memory) internal view override {}
}
