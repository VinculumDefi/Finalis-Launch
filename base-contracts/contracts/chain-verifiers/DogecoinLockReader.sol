// SPDX-License-Identifier: PROTOCOL-RESTRICTED
pragma solidity 0.8.19;

import "./UtxoLockReader.sol";

/// @title DogecoinLockReader
/// @notice VF-XCH-011 for Dogecoin: utxo-locks CLTV P2SH lock, proven from the
/// block header, the coinbase height and a merkle inclusion of the lock
/// transaction. Block spacing 60 s; binding carried as SHA-256 of the 117-byte payload.
/// The Dev Fund scriptPubKey is fixed at construction. See UtxoLockReader.
contract DogecoinLockReader is UtxoLockReader {
    constructor(bytes memory devFundScript_) UtxoLockReader("Dogecoin", devFundScript_, 60, false, false) {}
}
