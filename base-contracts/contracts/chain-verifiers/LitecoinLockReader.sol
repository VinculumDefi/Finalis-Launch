// SPDX-License-Identifier: PROTOCOL-RESTRICTED
pragma solidity 0.8.19;

import "./UtxoLockReader.sol";

/// @title LitecoinLockReader
/// @notice VF-XCH-011 for Litecoin: utxo-locks CLTV P2SH lock, proven from the
/// block header, the coinbase height and a merkle inclusion of the lock
/// transaction. Block spacing 150 s; binding carried as SHA-256 of the 117-byte payload.
/// The Dev Fund scriptPubKey is fixed at construction. See UtxoLockReader.
contract LitecoinLockReader is UtxoLockReader {
    constructor(bytes memory devFundScript_) UtxoLockReader("Litecoin", devFundScript_, 150, false, false, "native-LTC") {}
}
