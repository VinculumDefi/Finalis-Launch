"""Sighash algorithms actually used by each chain's CHECKSIG.

Bitcoin, Litecoin, Dogecoin, and DigiByte legacy P2SH: the original
signature hash (SIGHASH_ALL).

Bitcoin Cash: the replay-protected digest (SIGHASH_ALL | SIGHASH_FORKID),
which commits to the spent output value. Non-token outputs serialize the
same way they did before CashTokens.

Zcash transparent v5: ZIP 244 signature digest. The digest commits to the
coin scriptPubKey, not the redeem script. Empty Sapling and Orchard bundles
use the empty personalized hashes from that ZIP.
"""

from __future__ import annotations

from crypto import blake2b_personal, hash256
from script import ScriptError

SIGHASH_ALL = 0x01
SIGHASH_FORKID = 0x40
BCH_SIGHASH_ALL = SIGHASH_ALL | SIGHASH_FORKID

# ZIP 225 version-5 header. zcashd ZIP225_VERSION_GROUP_ID.
ZEC_V5_HEADER = 0x80000005
ZEC_V5_VERSION_GROUP_ID = 0x26A7270A
# ZIP 258 CONSENSUS_BRANCH_ID for NU6.3. Mainnet activation height 3,428,143.
# A public height of 3,505,033 was observed on 2026-10-03, which is after that
# activation, so a transparent transaction included now uses this branch id.
ZEC_CONSENSUS_BRANCH_ID = 0x37A5165B


def compact_size(n: int) -> bytes:
    if n < 0xFD:
        return bytes([n])
    if n <= 0xFFFF:
        return b"\xfd" + n.to_bytes(2, "little")
    if n <= 0xFFFFFFFF:
        return b"\xfe" + n.to_bytes(4, "little")
    return b"\xff" + n.to_bytes(8, "little")


def _u32(n: int) -> bytes:
    return (n & 0xFFFFFFFF).to_bytes(4, "little")


def _i64(n: int) -> bytes:
    return int(n).to_bytes(8, "little", signed=True)


def legacy_sighash(tx, input_index: int, script_code: bytes, hash_type: int) -> bytes:
    if hash_type != SIGHASH_ALL:
        raise ScriptError(f"legacy sighash only implements SIGHASH_ALL, got {hash_type:#x}")
    parts = [_u32(tx.version), compact_size(len(tx.inputs))]
    for i, txin in enumerate(tx.inputs):
        parts.append(txin.prev_txid)
        parts.append(_u32(txin.vout))
        if i == input_index:
            parts.append(compact_size(len(script_code)))
            parts.append(script_code)
        else:
            parts.append(b"\x00")
        parts.append(_u32(txin.sequence))
    parts.append(compact_size(len(tx.outputs)))
    for txout in tx.outputs:
        parts.append(_i64(txout.value))
        parts.append(compact_size(len(txout.script_pubkey)))
        parts.append(txout.script_pubkey)
    parts.append(_u32(tx.locktime))
    parts.append(_u32(hash_type))
    return hash256(b"".join(parts))


def bch_sighash(tx, input_index: int, script_code: bytes, amount: int, hash_type: int) -> bytes:
    if hash_type != BCH_SIGHASH_ALL:
        raise ScriptError(
            f"Bitcoin Cash CHECKSIG requires SIGHASH_ALL|SIGHASH_FORKID, got {hash_type:#x}"
        )
    prevouts = b"".join(txin.prev_txid + _u32(txin.vout) for txin in tx.inputs)
    sequences = b"".join(_u32(txin.sequence) for txin in tx.inputs)
    outputs = b"".join(
        _i64(txout.value) + compact_size(len(txout.script_pubkey)) + txout.script_pubkey
        for txout in tx.outputs
    )
    txin = tx.inputs[input_index]
    preimage = b"".join(
        [
            _u32(tx.version),
            hash256(prevouts),
            hash256(sequences),
            txin.prev_txid,
            _u32(txin.vout),
            compact_size(len(script_code)),
            script_code,
            _i64(amount),
            _u32(txin.sequence),
            hash256(outputs),
            _u32(tx.locktime),
            _u32(hash_type),
        ]
    )
    return hash256(preimage)


def _zcash_header_digest(tx) -> bytes:
    raw = b"".join(
        [
            _u32(ZEC_V5_HEADER),
            _u32(ZEC_V5_VERSION_GROUP_ID),
            _u32(tx.consensus_branch_id),
            _u32(tx.locktime),
            _u32(tx.expiry_height),
        ]
    )
    return blake2b_personal(b"ZTxIdHeadersHash", raw)


def _zcash_prevouts(tx) -> bytes:
    raw = b"".join(txin.prev_txid + _u32(txin.vout) for txin in tx.inputs)
    return blake2b_personal(b"ZTxIdPrevoutHash", raw)


def _zcash_sequences(tx) -> bytes:
    raw = b"".join(_u32(txin.sequence) for txin in tx.inputs)
    return blake2b_personal(b"ZTxIdSequencHash", raw)


def _zcash_outputs(tx) -> bytes:
    raw = b"".join(
        _i64(txout.value) + compact_size(len(txout.script_pubkey)) + txout.script_pubkey
        for txout in tx.outputs
    )
    return blake2b_personal(b"ZTxIdOutputsHash", raw)


def zcash_transparent_digest(tx) -> bytes:
    if not tx.inputs and not tx.outputs:
        return blake2b_personal(b"ZTxIdTranspaHash", b"")
    raw = _zcash_prevouts(tx) + _zcash_sequences(tx) + _zcash_outputs(tx)
    return blake2b_personal(b"ZTxIdTranspaHash", raw)


def zcash_empty_sapling_digest() -> bytes:
    return blake2b_personal(b"ZTxIdSaplingHash", b"")


def zcash_empty_orchard_digest() -> bytes:
    return blake2b_personal(b"ZTxIdOrchardHash", b"")


def zcash_txid(tx) -> bytes:
    if tx.sapling_spends or tx.sapling_outputs or tx.orchard_actions:
        raise ScriptError("a shielded Zcash component is not a lock")
    personal = b"ZcashTxHash_" + _u32(tx.consensus_branch_id)
    raw = (
        _zcash_header_digest(tx)
        + zcash_transparent_digest(tx)
        + zcash_empty_sapling_digest()
        + zcash_empty_orchard_digest()
    )
    return blake2b_personal(personal, raw)


def zcash_signature_digest(tx, input_index: int, spent: list, hash_type: int) -> bytes:
    """ZIP 244 SIGHASH_ALL over a transparent input. `spent` is the prevout list."""
    if hash_type != SIGHASH_ALL:
        raise ScriptError(f"Zcash sighash type {hash_type:#x} is not SIGHASH_ALL")
    if tx.sapling_spends or tx.sapling_outputs or tx.orchard_actions:
        raise ScriptError("a shielded Zcash component is not a lock")
    if len(spent) != len(tx.inputs):
        raise ScriptError("ZIP 244 needs the value and scriptPubKey of every transparent input")
    prevouts = _zcash_prevouts(tx)
    sequences = _zcash_sequences(tx)
    outputs = _zcash_outputs(tx)
    amounts = blake2b_personal(
        b"ZTxTrAmountsHash",
        b"".join(_i64(coin.value) for coin in spent),
    )
    scripts = blake2b_personal(
        b"ZTxTrScriptsHash",
        b"".join(compact_size(len(coin.script_pubkey)) + coin.script_pubkey for coin in spent),
    )
    coin = spent[input_index]
    txin = tx.inputs[input_index]
    txin_raw = b"".join(
        [
            txin.prev_txid,
            _u32(txin.vout),
            _i64(coin.value),
            compact_size(len(coin.script_pubkey)),
            coin.script_pubkey,
            _u32(txin.sequence),
        ]
    )
    txin_digest = blake2b_personal(b"Zcash___TxInHash", txin_raw)
    transparent = blake2b_personal(
        b"ZTxIdTranspaHash",
        bytes([hash_type]) + prevouts + amounts + scripts + sequences + outputs + txin_digest,
    )
    personal = b"ZcashTxHash_" + _u32(tx.consensus_branch_id)
    raw = (
        _zcash_header_digest(tx)
        + transparent
        + zcash_empty_sapling_digest()
        + zcash_empty_orchard_digest()
    )
    return blake2b_personal(personal, raw)
