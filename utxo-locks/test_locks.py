"""Script-level hold and release tests for six UTXO chains.

No test is skipped. A check that cannot perform the real signature or
locktime action raises.
"""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from crypto import sha256
from finality import (
    PROTOCOL_CONFIRMATIONS,
    ConfirmationTooShallow,
    enforce_confirmation_depth,
)
from lock import (
    FEE_SATS,
    FINGERPRINT_BINDING_CHAINS,
    GROSS_SATS,
    P2PKH_DUST_MINIMUM,
    PRINCIPAL_SATS,
    RAW_BINDING_CHAINS,
    LockFixture,
    split_outputs,
)
from script import ScriptError, p2pkh_script
from sighash import bch_sighash, legacy_sighash
from tx import Ledger, OutpointSpent, assert_zcash_transparent, serialize

CHAINS = ("bitcoin", "bitcoin-cash", "litecoin", "dogecoin", "digibyte", "zcash")
MATURITY = 500_000  # fixture CLTV height, not a confirmation count


def _run_chain(chain: str) -> None:
    fix = LockFixture(chain, MATURITY)
    if fix.dev_fund_key.pubkey == fix.release_key.pubkey:
        raise AssertionError("dev fund fixture collided with the release fixture")
    if len(fix.payload) != 117:
        raise AssertionError("binding payload is not 117 bytes")
    if fix.payload[:32] != fix.lock_id or fix.payload[32:52] != fix.base_recipient:
        raise AssertionError("binding field order is wrong")
    if fix.payload[52] != fix.output_token or fix.payload[53:85] != fix.asset_id:
        raise AssertionError("binding field order is wrong")
    if fix.payload[85:] != fix.valuation:
        raise AssertionError("binding field order is wrong")

    if chain in RAW_BINDING_CHAINS:
        if fix.binding_carried != fix.payload:
            raise AssertionError(f"{chain} binding must be the raw 117 bytes")
    elif chain in FINGERPRINT_BINDING_CHAINS:
        if fix.binding_carried != sha256(fix.payload) or len(fix.binding_carried) != 32:
            raise AssertionError(f"{chain} binding must be the 32-byte SHA-256 and nothing else")
    else:
        raise AssertionError(f"no binding rule for {chain}")
    if fix.binding_script[0] != 0x6A:
        raise AssertionError("binding output is not nulldata")
    if fix.principal_script[0:2] != b"\xa9\x14" or fix.principal_script[-1] != 0x87:
        raise AssertionError("principal output is not P2SH")
    if chain == "dogecoin" and fix.principal_script[0] == 0x00:
        raise AssertionError("Dogecoin principal is a witness script")

    ledger = Ledger()
    ledger.credit(fix.funding_txid, fix.funding_vout, fix.funding_output)
    lock_tx = fix.lock_transaction()
    if lock_tx.witness is not None:
        raise AssertionError("lock transaction carries a witness")
    if [out.value for out in lock_tx.outputs] != [fix.fee_output, fix.principal, 0]:
        raise AssertionError(f"output values { [out.value for out in lock_tx.outputs] }")
    if fix.fee_output < P2PKH_DUST_MINIMUM[chain]:
        raise AssertionError(f"{chain} fee output {fix.fee_output} is under the dust minimum")
    if chain == "dogecoin":
        # 5% of 1_000_000 is 50_000, under the 100_000-koinu hard dust limit.
        # The client keeps that 50_000 (principal is the whole gross) and the
        # relayed fee output is exactly 100_000, not a raised gross.
        if fix.fee_output != 100_000 or fix.principal != GROSS_SATS:
            raise AssertionError(
                f"dogecoin dust split is fee {fix.fee_output} principal {fix.principal}"
            )
        if fix.funding_value != GROSS_SATS + 100_000:
            raise AssertionError("dogecoin relay fee must be funded on top of the gross")
    else:
        if fix.fee_output != FEE_SATS or fix.principal != PRINCIPAL_SATS:
            raise AssertionError(f"{chain} changed the 5% split without being under dust")
        if fix.funding_value != GROSS_SATS:
            raise AssertionError(f"{chain} funding left the gross")
    if sum(out.value for out in lock_tx.outputs) != fix.funding_value:
        raise AssertionError("outputs do not sum to the funding coin")
    if fix.funding_output.value != fix.funding_value:
        raise AssertionError("funding coin does not cover the outputs")
    if lock_tx.outputs[0].script_pubkey != p2pkh_script(fix.dev_fund_key.pubkey):
        raise AssertionError("fee output does not pay the dev fund fixture key")
    if lock_tx.outputs[1].script_pubkey != fix.principal_script:
        raise AssertionError("principal output script mismatch")
    if lock_tx.outputs[2].script_pubkey != fix.binding_script:
        raise AssertionError("binding output script mismatch")

    raw = serialize(lock_tx)
    if chain == "zcash":
        assert_zcash_transparent(raw)
        if lock_tx.sapling_outputs or lock_tx.orchard_actions or lock_tx.sapling_spends:
            raise AssertionError("shielded component present")
    elif raw[4] == 0:
        raise AssertionError("lock serialization has a segwit marker")

    lock_txid = ledger.apply(lock_tx)
    if (lock_txid, 1) not in ledger.utxos:
        raise AssertionError("principal output was not created")
    if ledger.utxos[(lock_txid, 1)].value != fix.principal:
        raise AssertionError(f"principal value is not {fix.principal}")
    if (lock_txid, 0) not in ledger.utxos or ledger.utxos[(lock_txid, 0)].value != fix.fee_output:
        raise AssertionError("fee output was not retained")
    if any(vout == 2 for (_txid, vout) in ledger.utxos if _txid == lock_txid):
        raise AssertionError("binding output was treated as spendable")

    early = fix.spend_principal(lock_txid, MATURITY - 1, fix.release_key)
    try:
        ledger.apply(early)
    except ScriptError as exc:
        if "CLTV not met" not in str(exc):
            raise AssertionError(f"early spend failed for the wrong reason: {exc}") from exc
    else:
        raise AssertionError("early spend was accepted")
    if (lock_txid, 1) not in ledger.utxos:
        raise AssertionError("failed early spend removed the principal")

    final_seq = fix.spend_principal(lock_txid, MATURITY, fix.release_key, sequence=0xFFFFFFFF)
    try:
        ledger.apply(final_seq)
    except ScriptError as exc:
        if "final nSequence" not in str(exc):
            raise AssertionError(f"final-sequence spend failed for the wrong reason: {exc}") from exc
    else:
        raise AssertionError("CLTV was bypassed by a final nSequence")

    wrong_key = fix.spend_principal(lock_txid, MATURITY, fix.other_key)
    try:
        ledger.apply(wrong_key)
    except ScriptError as exc:
        if "CHECKSIG failed" not in str(exc):
            raise AssertionError(f"wrong-key spend failed for the wrong reason: {exc}") from exc
    else:
        raise AssertionError("an unrelated key spent the principal")

    later = fix.spend_principal(lock_txid, MATURITY + 10, fix.release_key)
    probe = Ledger()
    probe.utxos = dict(ledger.utxos)
    probe.apply(later)
    if probe.utxos[(later.txid(), 0)].value != fix.principal:
        raise AssertionError(f"after-maturity probe did not pay {fix.principal}")
    if (lock_txid, 1) not in ledger.utxos:
        raise AssertionError("probe mutated the live ledger")

    release = fix.spend_principal(lock_txid, MATURITY, fix.release_key)
    if chain == "zcash":
        assert_zcash_transparent(serialize(release))
    elif serialize(release)[4] == 0:
        raise AssertionError("release serialization has a segwit marker")
    if release.outputs[0].value != fix.principal:
        raise AssertionError(f"release value is not {fix.principal}")
    if release.outputs[0].script_pubkey != p2pkh_script(fix.release_key.pubkey):
        raise AssertionError("release does not pay the bound release key")
    if chain == "bitcoin-cash":
        digest_bch = bch_sighash(release, 0, fix.redeem_script, fix.principal, 0x41)
        digest_legacy = legacy_sighash(release, 0, fix.redeem_script, 0x01)
        if digest_bch == digest_legacy:
            raise AssertionError("Bitcoin Cash sighash collapsed to the legacy digest")
    release_txid = ledger.apply(release)
    paid = ledger.utxos[(release_txid, 0)]
    if paid.value != fix.principal or paid.script_pubkey != p2pkh_script(fix.release_key.pubkey):
        raise AssertionError(
            f"mature spend did not create the {fix.principal}-unit bound-key output"
        )
    if (lock_txid, 1) in ledger.utxos:
        raise AssertionError("principal outpoint still spendable after release")

    try:
        ledger.apply(release)
    except OutpointSpent as exc:
        if "already spent" not in str(exc) and "missing" not in str(exc):
            raise AssertionError(f"second spend failed for the wrong reason: {exc}") from exc
    else:
        raise AssertionError("second spend was accepted")

    print(
        f"{chain}: hold and release passed; "
        f"fee {fix.fee_output} principal {fix.principal} binding {len(fix.binding_carried)} bytes; "
        f"dev-fund fixture {fix.dev_fund_key.pubkey.hex()} "
        f"release fixture {fix.release_key.pubkey.hex()}"
    )


class LockTests(unittest.TestCase):
    def test_hold_and_release(self):
        for chain in CHAINS:
            with self.subTest(chain=chain):
                _run_chain(chain)

    def test_bitcoin_and_zcash_confirmation_constants(self):
        for depth in (0, 1, 5):
            with self.assertRaises(ConfirmationTooShallow):
                enforce_confirmation_depth("bitcoin", depth)
        enforce_confirmation_depth("bitcoin", 6)
        enforce_confirmation_depth("bitcoin", 7)
        for depth in (0, 9):
            with self.assertRaises(ConfirmationTooShallow):
                enforce_confirmation_depth("zcash", depth)
        enforce_confirmation_depth("zcash", 10)
        enforce_confirmation_depth("zcash", 11)
        self.assertEqual(PROTOCOL_CONFIRMATIONS["bitcoin"], 6)
        self.assertEqual(PROTOCOL_CONFIRMATIONS["zcash"], 10)
        print("bitcoin: confirmation depth refuses < 6 and accepts >= 6")
        print("zcash: confirmation depth refuses < 10 and accepts >= 10")

    def test_sourced_confirmation_counts(self):
        expected = {"litecoin": 24, "bitcoin-cash": 15, "digibyte": 10, "dogecoin": 60}
        for chain, required in expected.items():
            self.assertEqual(PROTOCOL_CONFIRMATIONS[chain], required)
            # Dogecoin's 60 is Gemini's Dogecoin figure, not Bitcoin's 6.
            self.assertNotEqual(required, PROTOCOL_CONFIRMATIONS["bitcoin"])
            for depth in (0, required - 1):
                with self.subTest(chain=chain, depth=depth):
                    with self.assertRaises(ConfirmationTooShallow):
                        enforce_confirmation_depth(chain, depth)
            enforce_confirmation_depth(chain, required)
            enforce_confirmation_depth(chain, required + 5)
            print(f"{chain}: confirmation depth refuses < {required} and accepts >= {required}")

    def test_dogecoin_dust_fee_is_exactly_the_minimum(self):
        fee, principal, funding = split_outputs("dogecoin", GROSS_SATS)
        self.assertEqual(fee, 100_000)
        self.assertEqual(principal, GROSS_SATS)
        self.assertEqual(funding, GROSS_SATS + 100_000)
        self.assertGreaterEqual(fee, P2PKH_DUST_MINIMUM["dogecoin"])
        for chain in ("bitcoin", "bitcoin-cash", "litecoin", "digibyte", "zcash"):
            got = split_outputs(chain, GROSS_SATS)
            self.assertEqual(got, (FEE_SATS, PRINCIPAL_SATS, GROSS_SATS), chain)
            self.assertGreaterEqual(FEE_SATS, P2PKH_DUST_MINIMUM[chain])
        print("dogecoin: fee output is exactly 100000 koinu and principal stays 1000000")

    def test_standard_split(self):
        self.assertEqual(GROSS_SATS, 1_000_000)
        self.assertEqual(FEE_SATS, 50_000)
        self.assertEqual(PRINCIPAL_SATS, 950_000)


if __name__ == "__main__":
    unittest.main(verbosity=2)
