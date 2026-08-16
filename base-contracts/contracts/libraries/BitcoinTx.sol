// =============================================================================
// BitcoinTx — transaction and script parsing for Commitment Vault Lock facts
//
// Implements the source-event format specified in Architecture C.8:
//   "single Commitment Vault transaction, inputs = User UTXOs, outputs in the
//    same tx: (1) fee output -> Dev Fund (P2WPKH/P2TR), (2) principal output ->
//    P2WSH/Taproot OP_CHECKLOCKTIMEVERIFY <maturity_T> + owner signature,
//    (3) change. Native asset only (BTC)."
//
// WHAT IS DERIVED, AND FROM WHERE
//   feeAmount        value of the Dev Fund output
//   principalAmount  value of the CLTV output
//   grossAmount      fee + principal
//   maturity_T       the CLTV operand inside the witness script
//   txid             double-SHA256 of the non-witness serialization
//   release pubkey   the single key on the maturity-release branch (C.8
//                    handshake_identity)
//
// THE P2WSH SUBTLETY
//   A P2WSH output commits only to sha256(witnessScript); the script itself is
//   revealed when spent. The maturity value is therefore not present in the
//   transaction at lock time. The witness script must be supplied alongside,
//   and this library verifies sha256(script) equals the committed hash. The
//   caller supplies the script; the chain checks it. A script that does not
//   hash to the output's commitment is rejected.
//
// SERIALIZATION
//   Callers must supply the NON-WITNESS serialization. That is what txid is
//   computed over for segwit transactions, and therefore what the Merkle proof
//   in the block commits to.
//
// SPDX-License-Identifier: PROTOCOL-RESTRICTED
// Solidity 0.8.19+
// =============================================================================

pragma solidity 0.8.19;

library BitcoinTx {

    error TxTooShort();
    error BadVarInt();
    error OutputIndexOutOfRange(uint256 index, uint256 count);
    error NotP2wsh(uint256 outputIndex);
    error WitnessScriptMismatch(bytes32 committed, bytes32 provided);
    error NotACltvScript();
    error BadCltvOperand();
    error MaturityNotTimestamp(uint256 value);
    error DuplicateOutputIndex();

    /// Bitcoin's threshold between block-height and Unix-timestamp locktimes.
    uint256 internal constant LOCKTIME_THRESHOLD = 500_000_000;

    struct Output {
        uint64 value;          // satoshis
        uint256 scriptPtr;     // memory pointer to scriptPubKey
        uint256 scriptLen;
    }

    // -------------------------------------------------------------------------
    // Transaction parsing
    // -------------------------------------------------------------------------

    /// @notice Double-SHA256 of the supplied serialization, in internal byte
    ///         order — the transaction id when given non-witness bytes.
    function txid(bytes memory rawTx) internal pure returns (bytes32) {
        return sha256(abi.encodePacked(sha256(rawTx)));
    }

    /// @notice Parse the outputs of a non-witness transaction serialization.
    function parseOutputs(bytes memory rawTx) internal pure returns (Output[] memory) {
        uint256 p = _ptr(rawTx);
        uint256 end = p + rawTx.length;

        p += 4;                                        // version
        if (p > end) revert TxTooShort();

        // Inputs.
        (uint256 nIn, uint256 adv) = _varInt(p, end);
        p += adv;
        for (uint256 i = 0; i < nIn; i++) {
            p += 36;                                   // prevout
            (uint256 sigLen, uint256 a2) = _varInt(p, end);
            p += a2 + sigLen + 4;                      // scriptSig + sequence
            if (p > end) revert TxTooShort();
        }

        // Outputs.
        (uint256 nOut, uint256 adv2) = _varInt(p, end);
        p += adv2;

        Output[] memory outs = new Output[](nOut);
        for (uint256 i = 0; i < nOut; i++) {
            if (p + 8 > end) revert TxTooShort();
            outs[i].value = _readUint64LE(p);
            p += 8;

            (uint256 sLen, uint256 a3) = _varInt(p, end);
            p += a3;
            if (p + sLen > end) revert TxTooShort();

            outs[i].scriptPtr = p;
            outs[i].scriptLen = sLen;
            p += sLen;
        }

        return outs;
    }

    // -------------------------------------------------------------------------
    // Lock fact extraction
    // -------------------------------------------------------------------------

    struct LockFacts {
        bytes32 txHash;
        uint64  feeAmount;
        uint64  principalAmount;
        uint64  grossAmount;
        uint256 maturityTimestamp;
        bytes32 releasePubKeyHash;     // keccak of the canonical release pubkey
    }

    /// @notice Extract Commitment Vault Lock facts from a Bitcoin transaction.
    /// @param rawTx Non-witness serialization.
    /// @param witnessScript The P2WSH script committed to by the principal output.
    /// @param principalIndex Index of the CLTV output.
    /// @param feeIndex Index of the Dev Fund output.
    function extractLockFacts(
        bytes memory rawTx,
        bytes memory witnessScript,
        uint256 principalIndex,
        uint256 feeIndex
    ) internal pure returns (LockFacts memory f) {
        if (principalIndex == feeIndex) revert DuplicateOutputIndex();

        Output[] memory outs = parseOutputs(rawTx);
        if (principalIndex >= outs.length) revert OutputIndexOutOfRange(principalIndex, outs.length);
        if (feeIndex >= outs.length) revert OutputIndexOutOfRange(feeIndex, outs.length);

        // The principal output must be P2WSH: OP_0 <32-byte sha256(script)>.
        Output memory prin = outs[principalIndex];
        if (prin.scriptLen != 34) revert NotP2wsh(principalIndex);
        if (_byteAt(prin.scriptPtr) != 0x00 || _byteAt(prin.scriptPtr + 1) != 0x20) {
            revert NotP2wsh(principalIndex);
        }

        bytes32 committed = _readBytes32(prin.scriptPtr + 2);
        bytes32 provided = sha256(witnessScript);
        if (committed != provided) revert WitnessScriptMismatch(committed, provided);

        (uint256 maturity, bytes32 pubKeyHash) = parseCltvScript(witnessScript);

        f.txHash = txid(rawTx);
        f.principalAmount = prin.value;
        f.feeAmount = outs[feeIndex].value;
        f.grossAmount = f.feeAmount + f.principalAmount;
        f.maturityTimestamp = maturity;
        f.releasePubKeyHash = pubKeyHash;
    }

    // -------------------------------------------------------------------------
    // Script parsing
    // -------------------------------------------------------------------------

    /// @notice Parse `<maturity> OP_CHECKLOCKTIMEVERIFY OP_DROP <pubkey> OP_CHECKSIG`.
    /// @dev C.8 requires a single unambiguous release key: "ambiguous or
    ///      multi-key maturity-release paths are rejected for Handshake use."
    ///      Any script not matching this exact shape is rejected.
    function parseCltvScript(bytes memory script)
        internal pure returns (uint256 maturity, bytes32 releasePubKeyHash)
    {
        if (script.length < 4) revert NotACltvScript();

        uint256 i = 0;

        // <maturity>: a minimal push of 1-5 bytes, little-endian.
        uint8 pushLen = uint8(script[i]);
        if (pushLen == 0 || pushLen > 5) revert BadCltvOperand();
        i += 1;
        if (i + pushLen > script.length) revert BadCltvOperand();

        for (uint256 k = 0; k < pushLen; k++) {
            maturity |= uint256(uint8(script[i + k])) << (8 * k);
        }
        i += pushLen;

        // C.8 binds a maturity timestamp, not a block height.
        if (maturity < LOCKTIME_THRESHOLD) revert MaturityNotTimestamp(maturity);

        // OP_CHECKLOCKTIMEVERIFY (0xb1) OP_DROP (0x75)
        if (i + 1 >= script.length) revert NotACltvScript();
        if (uint8(script[i]) != 0xb1) revert NotACltvScript();
        if (uint8(script[i + 1]) != 0x75) revert NotACltvScript();
        i += 2;

        // <pubkey>: 33 bytes compressed, or 32 for x-only.
        if (i >= script.length) revert NotACltvScript();
        uint8 keyLen = uint8(script[i]);
        if (keyLen != 33 && keyLen != 32) revert NotACltvScript();
        i += 1;
        if (i + keyLen > script.length) revert NotACltvScript();

        bytes memory key = new bytes(keyLen);
        for (uint256 k = 0; k < keyLen; k++) {
            key[k] = script[i + k];
        }
        releasePubKeyHash = keccak256(key);
        i += keyLen;

        // OP_CHECKSIG (0xac), and nothing after it.
        if (i >= script.length) revert NotACltvScript();
        if (uint8(script[i]) != 0xac) revert NotACltvScript();
        if (i + 1 != script.length) revert NotACltvScript();
    }

    // -------------------------------------------------------------------------
    // Primitives
    // -------------------------------------------------------------------------

    function _ptr(bytes memory b) private pure returns (uint256 p) {
        assembly ("memory-safe") { p := add(b, 0x20) }
    }

    function _byteAt(uint256 p) private pure returns (uint8 v) {
        assembly ("memory-safe") { v := byte(0, mload(p)) }
    }

    function _readBytes32(uint256 p) private pure returns (bytes32 v) {
        assembly ("memory-safe") { v := mload(p) }
    }

    function _readUint64LE(uint256 p) private pure returns (uint64 out) {
        for (uint256 i = 0; i < 8; i++) {
            out |= uint64(_byteAt(p + i)) << uint64(8 * i);
        }
    }

    /// @dev Bitcoin CompactSize. Returns the value and bytes consumed.
    function _varInt(uint256 p, uint256 end) private pure returns (uint256 value, uint256 advance) {
        if (p >= end) revert TxTooShort();
        uint8 first = _byteAt(p);

        if (first < 0xfd) return (first, 1);
        if (first == 0xfd) {
            if (p + 3 > end) revert BadVarInt();
            return (uint256(_byteAt(p + 1)) | (uint256(_byteAt(p + 2)) << 8), 3);
        }
        if (first == 0xfe) {
            if (p + 5 > end) revert BadVarInt();
            uint256 v;
            for (uint256 i = 0; i < 4; i++) v |= uint256(_byteAt(p + 1 + i)) << (8 * i);
            return (v, 5);
        }
        if (p + 9 > end) revert BadVarInt();
        uint256 v8;
        for (uint256 i = 0; i < 8; i++) v8 |= uint256(_byteAt(p + 1 + i)) << (8 * i);
        return (v8, 9);
    }
}
