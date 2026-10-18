"""Builds LOCAL test blocks for the Solidity UtxoLockReader tests.

Each lock transaction is built and signed by this package's own LockFixture
(lock.py), exactly as a user would build it. It is then placed in a locally
assembled block: a BIP 34 coinbase at leaf 0, an unrelated lock transaction
at leaf 1 and the lock at leaf 2 (odd count, so the last leaf is paired with
itself as Bitcoin does). The header is real-format (80 bytes, or the 1487-byte
Zcash header with a random Equihash-sized solution) but is not mined: these
are local fixtures, not mainnet blocks. Nothing is broadcast.

Usage: python3 reader_fixtures.py  (writes
../base-contracts/test/fixtures/utxo_local_locks.json)
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from crypto import hash256  # noqa: E402
from lock import LockFixture  # noqa: E402
from script import encode_script_num, p2pkh_script, push_data  # noqa: E402
from sighash import ZEC_CONSENSUS_BRANCH_ID  # noqa: E402
from tx import Tx, TxIn, TxOut, serialize  # noqa: E402

SPACING = {"bitcoin": 600, "bitcoin-cash": 600, "litecoin": 150, "dogecoin": 60, "digibyte": 15, "zcash": 75}
ENV = {"bitcoin": "Bitcoin", "bitcoin-cash": "Bitcoin Cash", "litecoin": "Litecoin", "dogecoin": "Dogecoin",
       "digibyte": "DigiByte", "zcash": "Zcash"}
LOCK_HEIGHT = 850_123
BLOCK_TIME = 1_792_000_000


def coinbase(chain: str, height: int, payee: bytes) -> Tx:
    return Tx(
        chain=chain,
        version=1 if chain != "zcash" else 5,
        inputs=[TxIn(b"\x00" * 32, 0xFFFFFFFF, push_data(encode_script_num(height)) + b"\x08local-cb", 0xFFFFFFFF)],
        outputs=[TxOut(312_500_000, p2pkh_script(payee))],
        locktime=0,
        expiry_height=height if chain == "zcash" else 0,
        consensus_branch_id=ZEC_CONSENSUS_BRANCH_ID,
    )


def merkle_branch(txids: list[bytes], index: int) -> tuple[bytes, list[bytes]]:
    level = list(txids)
    branch = []
    i = index
    while len(level) > 1:
        if len(level) % 2:
            level.append(level[-1])
        branch.append(level[i ^ 1])
        level = [hash256(level[k] + level[k + 1]) for k in range(0, len(level), 2)]
        i //= 2
    return level[0], branch


def header(chain: str, root: bytes) -> bytes:
    prev = os.urandom(32)
    if chain == "zcash":
        return (
            (4).to_bytes(4, "little") + prev + root + os.urandom(32)
            + BLOCK_TIME.to_bytes(4, "little") + (0x1F07FFFF).to_bytes(4, "little") + os.urandom(32)
            + bytes([0xFD, 0x40, 0x05]) + os.urandom(1344)
        )
    return (0x20000000).to_bytes(4, "little") + prev + root + BLOCK_TIME.to_bytes(4, "little") \
        + (0x1D00FFFF).to_bytes(4, "little") + os.urandom(4)


# Dogecoin's P2PKH dust minimum (100,000 koinu) is above 5% of lock.py's
# standard 1,000,000-unit gross, so lock.py pays a dust-sized fee there and the
# fee is not 5%. The Dogecoin accept cases use a 10,000,000-koinu gross
# (fee 500,000 >= dust); the dust split is kept as its own reject case.
GROSS_OVERRIDE = {"dogecoin": 10_000_000}


def _regross(fx: LockFixture, gross: int) -> None:
    fee = gross * 500 // 10_000
    fx.fee_output, fx.principal, fx.funding_value = fee, gross - fee, gross
    fx.funding_output = TxOut(gross, p2pkh_script(fx.funding_key.pubkey))


def case(chain: str, duration: int, delay_blocks: int, regross: bool = True) -> dict:
    maturity = LOCK_HEIGHT + duration // SPACING[chain] - delay_blocks
    fx = LockFixture(chain, maturity)
    other = LockFixture(chain, maturity + 7)
    if regross and chain in GROSS_OVERRIDE:
        _regross(fx, GROSS_OVERRIDE[chain])
        _regross(other, GROSS_OVERRIDE[chain])
    lock_tx = fx.lock_transaction()
    cb = coinbase(chain, LOCK_HEIGHT, fx.other_key.pubkey)
    txs = [cb, other.lock_transaction(), lock_tx]
    txids = [t.txid() for t in txs]
    root, lock_branch = merkle_branch(txids, 2)
    _, cb_branch = merkle_branch(txids, 0)
    h = header(chain, root)
    return {
        "durationSecs": duration,
        "delayBlocks": delay_blocks,
        "maturityHeight": maturity,
        "header": "0x" + h.hex(),
        "blockHash": "0x" + hash256(h).hex(),
        "height": LOCK_HEIGHT,
        "time": BLOCK_TIME,
        "coinbaseTx": "0x" + serialize(cb).hex(),
        "coinbaseBranch": ["0x" + b.hex() for b in cb_branch],
        "lockTx": "0x" + serialize(lock_tx).hex(),
        "lockTxid": "0x" + txids[2].hex(),
        "lockBranch": ["0x" + b.hex() for b in lock_branch],
        "lockIndex": 2,
        "otherLockTx": "0x" + serialize(txs[1]).hex(),
        "otherRedeemScript": "0x" + other.redeem_script.hex(),
        "otherPayload": "0x" + other.payload.hex(),
        "otherBranch": ["0x" + b.hex() for b in merkle_branch(txids, 1)[1]],
        "redeemScript": "0x" + fx.redeem_script.hex(),
        "payload": "0x" + fx.payload.hex(),
        "lockId": "0x" + fx.lock_id.hex(),
        "baseRecipient": "0x" + fx.base_recipient.hex(),
        "outputToken": fx.output_token,
        "fee": fx.fee_output,
        "principal": fx.principal,
        "devFundScript": "0x" + p2pkh_script(fx.dev_fund_key.pubkey).hex(),
    }


def main() -> None:
    out = {
        "note": "LOCAL fixtures: locks built and signed by utxo-locks/lock.py, placed in locally assembled, unmined blocks. Not mainnet data.",
        "chains": {},
    }
    for chain in SPACING:
        out["chains"][ENV[chain]] = {
            "spacing": SPACING[chain],
            "standard": case(chain, 604800, 2),
            "handshake": case(chain, 3600, 0),
        }
    out["chains"]["Dogecoin"]["dustSplit"] = case("dogecoin", 604800, 2, regross=False)
    dest = Path(__file__).resolve().parent.parent / "base-contracts" / "test" / "fixtures" / "utxo_local_locks.json"
    dest.write_text(json.dumps(out, indent=1))
    print("wrote", dest)


if __name__ == "__main__":
    main()
