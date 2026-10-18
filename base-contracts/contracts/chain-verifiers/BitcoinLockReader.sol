// SPDX-License-Identifier: PROTOCOL-RESTRICTED
pragma solidity 0.8.19;

import "./UtxoLockReader.sol";

/// @title BitcoinLockReader
/// @notice VF-XCH-011 for Bitcoin: utxo-locks CLTV P2SH lock, proven from the
/// block header, the coinbase height and a merkle inclusion of the lock
/// transaction. Block spacing 600 s; binding carried raw (117 bytes).
/// The Dev Fund scriptPubKey is fixed at construction. See UtxoLockReader.
contract BitcoinLockReader is UtxoLockReader {
    constructor(bytes memory devFundScript_) UtxoLockReader("Bitcoin", devFundScript_, 600, true, false, "native-BTC") {}
}
