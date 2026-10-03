"""Transaction construction, serialization, and a one-shot UTXO ledger."""

from __future__ import annotations

from dataclasses import dataclass, field

from crypto import FixtureKey
from script import ScriptError, push_data, verify_script
from sighash import (
    BCH_SIGHASH_ALL,
    SIGHASH_ALL,
    ZEC_CONSENSUS_BRANCH_ID,
    ZEC_V5_HEADER,
    ZEC_V5_VERSION_GROUP_ID,
    bch_sighash,
    compact_size,
    legacy_sighash,
    zcash_signature_digest,
    zcash_txid,
)
from crypto import hash256


LEGACY_CHAINS = ("bitcoin", "litecoin", "dogecoin", "digibyte")


@dataclass
class TxIn:
    prev_txid: bytes
    vout: int
    script_sig: bytes = b""
    sequence: int = 0xFFFFFFFF

    def __post_init__(self):
        if len(self.prev_txid) != 32:
            raise ScriptError("prevout txid must be 32 bytes")


@dataclass
class TxOut:
    value: int
    script_pubkey: bytes


@dataclass
class Tx:
    chain: str
    version: int
    inputs: list[TxIn]
    outputs: list[TxOut]
    locktime: int
    expiry_height: int = 0
    consensus_branch_id: int = ZEC_CONSENSUS_BRANCH_ID
    sapling_spends: int = 0
    sapling_outputs: int = 0
    orchard_actions: int = 0
    witness: bytes | None = None

    def sighash(self, input_index: int, script_code: bytes, hash_type: int, spent=None) -> bytes:
        if self.chain == "bitcoin-cash":
            if spent is None:
                raise ScriptError("Bitcoin Cash sighash requires the spent output value")
            return bch_sighash(self, input_index, script_code, spent[input_index].value, hash_type)
        if self.chain == "zcash":
            if spent is None:
                raise ScriptError("Zcash sighash requires previous outputs")
            return zcash_signature_digest(self, input_index, spent, hash_type)
        if self.chain not in LEGACY_CHAINS:
            raise ScriptError(f"no sighash for {self.chain}")
        return legacy_sighash(self, input_index, script_code, hash_type)

    def txid(self) -> bytes:
        if self.witness is not None:
            raise ScriptError("witness data is not part of these locks")
        if self.chain == "zcash":
            return zcash_txid(self)
        return hash256(serialize(self))


def serialize(tx: Tx) -> bytes:
    if tx.witness is not None:
        raise ScriptError("refusing to serialize a witness transaction")
    if tx.chain == "zcash":
        return _serialize_zcash_v5(tx)
    parts = [(tx.version & 0xFFFFFFFF).to_bytes(4, "little"), compact_size(len(tx.inputs))]
    for txin in tx.inputs:
        parts.append(txin.prev_txid)
        parts.append(txin.vout.to_bytes(4, "little"))
        parts.append(compact_size(len(txin.script_sig)))
        parts.append(txin.script_sig)
        parts.append(txin.sequence.to_bytes(4, "little"))
    parts.append(compact_size(len(tx.outputs)))
    for txout in tx.outputs:
        parts.append(int(txout.value).to_bytes(8, "little", signed=False))
        parts.append(compact_size(len(txout.script_pubkey)))
        parts.append(txout.script_pubkey)
    parts.append((tx.locktime & 0xFFFFFFFF).to_bytes(4, "little"))
    return b"".join(parts)


def _serialize_zcash_v5(tx: Tx) -> bytes:
    if tx.sapling_spends or tx.sapling_outputs or tx.orchard_actions:
        raise ScriptError("a shielded Zcash output is not a lock")
    parts = [
        ZEC_V5_HEADER.to_bytes(4, "little"),
        ZEC_V5_VERSION_GROUP_ID.to_bytes(4, "little"),
        tx.consensus_branch_id.to_bytes(4, "little"),
        tx.locktime.to_bytes(4, "little"),
        tx.expiry_height.to_bytes(4, "little"),
        compact_size(len(tx.inputs)),
    ]
    for txin in tx.inputs:
        parts.append(txin.prev_txid)
        parts.append(txin.vout.to_bytes(4, "little"))
        parts.append(compact_size(len(txin.script_sig)))
        parts.append(txin.script_sig)
        parts.append(txin.sequence.to_bytes(4, "little"))
    parts.append(compact_size(len(tx.outputs)))
    for txout in tx.outputs:
        parts.append(int(txout.value).to_bytes(8, "little"))
        parts.append(compact_size(len(txout.script_pubkey)))
        parts.append(txout.script_pubkey)
    # ZIP 225: valueBalance and anchors are absent when the bundles are empty.
    parts.append(compact_size(0))  # nSpendsSapling
    parts.append(compact_size(0))  # nOutputsSapling
    parts.append(compact_size(0))  # nActionsOrchard
    return b"".join(parts)


def assert_zcash_transparent(raw: bytes) -> None:
    """Parse a v5 serialization and reject anything but an empty shielded suffix."""
    if len(raw) < 20 or raw[-3:] != b"\x00\x00\x00":
        raise ScriptError("Zcash transaction is not a transparent v5 encoding")
    header = int.from_bytes(raw[0:4], "little")
    group = int.from_bytes(raw[4:8], "little")
    if header != ZEC_V5_HEADER or group != ZEC_V5_VERSION_GROUP_ID:
        raise ScriptError("Zcash transaction is not v5")
    # Walk to the shielded counts and require they are the final three zeros.
    i = 20
    def read_compact(buf, j):
        prefix = buf[j]
        if prefix < 0xFD:
            return prefix, j + 1
        raise ScriptError("unexpected compact size in the transparent fixture")
    n_in, i = read_compact(raw, i)
    for _ in range(n_in):
        i += 36
        script_len, i = read_compact(raw, i)
        i += script_len + 4
    n_out, i = read_compact(raw, i)
    for _ in range(n_out):
        i += 8
        script_len, i = read_compact(raw, i)
        i += script_len
    if raw[i:] != b"\x00\x00\x00":
        raise ScriptError("Zcash transaction carries a shielded bundle")


class SigContext:
    def __init__(self, tx: Tx, input_index: int, spent: list[TxOut]):
        self.tx = tx
        self.input_index = input_index
        self.spent = spent

    def sighash(self, input_index: int, script_code: bytes, hash_type: int) -> bytes:
        return self.tx.sighash(input_index, script_code, hash_type, self.spent)


class OutpointSpent(ScriptError):
    pass


@dataclass
class Ledger:
    utxos: dict[tuple[bytes, int], TxOut] = field(default_factory=dict)

    def credit(self, txid: bytes, vout: int, txout: TxOut) -> None:
        key = (txid, vout)
        if key in self.utxos:
            raise ScriptError("fixture outpoint already exists")
        self.utxos[key] = txout

    def apply(self, tx: Tx) -> bytes:
        if tx.witness is not None:
            raise ScriptError("witness spend is rejected")
        spent: list[TxOut] = []
        keys = []
        for txin in tx.inputs:
            key = (txin.prev_txid, txin.vout)
            if key not in self.utxos:
                raise OutpointSpent("outpoint is missing or already spent")
            spent.append(self.utxos[key])
            keys.append(key)
        total_in = sum(coin.value for coin in spent)
        total_out = sum(txout.value for txout in tx.outputs)
        if total_out > total_in:
            raise ScriptError("outputs exceed inputs")
        for index, txin in enumerate(tx.inputs):
            ctx = SigContext(tx, index, spent)
            verify_script(txin.script_sig, spent[index].script_pubkey, ctx)
        for key in keys:
            del self.utxos[key]
        txid = tx.txid()
        for vout, txout in enumerate(tx.outputs):
            # A zero-value OP_RETURN is not a spendable coin.
            if txout.script_pubkey[:1] == b"\x6a":
                if txout.value != 0:
                    raise ScriptError("binding output must carry zero value")
                continue
            self.utxos[(txid, vout)] = txout
        return txid


def sign_input(tx: Tx, index: int, key: FixtureKey, prevout: TxOut, script_code: bytes) -> bytes:
    hash_type = BCH_SIGHASH_ALL if tx.chain == "bitcoin-cash" else SIGHASH_ALL
    # Sighash blanking ignores scriptSig. Provide the coin being signed plus
    # placeholders only when every input's prevout is passed by the caller.
    digest = tx.sighash(index, script_code, hash_type, _single_if_needed(tx, index, prevout))
    return key.sign_digest(digest) + bytes([hash_type])


def _single_if_needed(tx: Tx, index: int, prevout: TxOut):
    """Used only while signing a one-input transaction."""
    if len(tx.inputs) != 1 or index != 0:
        raise ScriptError("this signer builds one-input transactions")
    return [prevout]


def p2pkh_script_sig(sig: bytes, pubkey: bytes) -> bytes:
    return push_data(sig) + push_data(pubkey)


def p2sh_script_sig(sig: bytes, redeem_script: bytes) -> bytes:
    return push_data(sig) + push_data(redeem_script)
