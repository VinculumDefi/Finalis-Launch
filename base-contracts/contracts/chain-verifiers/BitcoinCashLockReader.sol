// SPDX-License-Identifier: PROTOCOL-RESTRICTED
pragma solidity 0.8.19;

import "./UtxoLockReader.sol";

/// @title BitcoinCashLockReader
/// @notice VF-XCH-011 for Bitcoin Cash: utxo-locks CLTV P2SH lock, proven from the
/// block header, the coinbase height and a merkle inclusion of the lock
/// transaction. Block spacing 600 s; binding carried raw (117 bytes).
/// The Dev Fund scriptPubKey is fixed at construction. See UtxoLockReader.
contract BitcoinCashLockReader is UtxoLockReader {
    constructor(bytes memory devFundScript_) UtxoLockReader("Bitcoin Cash", devFundScript_, 600, true, false) {}
}
