// SPDX-License-Identifier: PROTOCOL-RESTRICTED
pragma solidity 0.8.19;

import "../chain-verifiers/BnbSmartChainLockReader.sol";
import "../chain-verifiers/PolygonLockReader.sol";
import "../chain-verifiers/AvalancheLockReader.sol";

/// @dev TEST ONLY. Hardhat cannot produce BNB, Polygon or Avalanche header
/// layouts, so these harnesses run each production reader's exact proof and
/// fact path with only the chain header-shape check switched off. Each shape
/// check is tested against the production reader on a real-block fixture.
/// Never deploy.
contract BnbSmartChainLockReaderLocalHeaders is BnbSmartChainLockReader {
    constructor(address lock_) BnbSmartChainLockReader(lock_) {}
    function _checkHeaderShape(bytes[] memory) internal view override {}
}

contract PolygonLockReaderLocalHeaders is PolygonLockReader {
    constructor(address lock_) PolygonLockReader(lock_) {}
    function _checkHeaderShape(bytes[] memory) internal view override {}
}

contract AvalancheLockReaderLocalHeaders is AvalancheLockReader {
    constructor(address lock_) AvalancheLockReader(lock_) {}
    function _checkHeaderShape(bytes[] memory) internal view override {}
}
