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
from decimal import Decimal

from lock import (
    COUNTS_PER_IDENTITY,
    EXACT_FEE_CHAINS,
    MIN_LOCK_FLOOR_UNITS,
    MIN_LOCK_USD,
    RELEASE_SPEND_BYTES,
    STRESS_RELEASE_FEE_RATE,
    PRICE_MAX_AGE_SECS,
    HANDSHAKE_DURATION_SECS,
    HANDSHAKE_UNIT_BAND,
    LockRefused,
    check_handshake_band,
    check_minimum_lock,
    lock_outputs,
    min_gross_for,
    usd_min_gross_for,
    FEE_SATS,
    FINGERPRINT_BINDING_CHAINS,
    GROSS_SATS,
    P2PKH_DUST_MINIMUM,
    PERMITTED_DURATIONS,
    PRINCIPAL_SATS,
    RAW_BINDING_CHAINS,
    LockFixture,
    handshake_allowance,
    multiplier_bps,
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

    def test_sixteen_durations_and_derived_handshake_allowance(self):
        self.assertEqual(len(PERMITTED_DURATIONS), 16)
        self.assertEqual(multiplier_bps(3600), 10000)
        self.assertEqual(multiplier_bps(315360000), 80000)
        with self.assertRaises(ValueError):
            multiplier_bps(8 * 86400)
        self.assertFalse(COUNTS_PER_IDENTITY)
        self.assertEqual(handshake_allowance(COUNTS_PER_IDENTITY), 1)
        self.assertEqual(handshake_allowance(True), 3)
        self.assertEqual(handshake_allowance(False), 1)


# Fixture prices for the minimum-lock tests: the CoinGecko USD prices read on
# 2026-10-20 at 11:35 AM ET. They are test inputs only, never posted anywhere.
FIXTURE_PRICE = {"bitcoin": "82410", "bitcoin-cash": "276.28", "litecoin": "59.59"}
NOW = 1_792_510_532


class MinimumLockTests(unittest.TestCase):
    """Operator t230u: $20 BTC, $1 BCH, $1 LTC; fresh price; fee exactly 5%."""

    def test_minimums_are_the_operator_values_and_only_three_chains(self):
        self.assertEqual(MIN_LOCK_USD, {"bitcoin": Decimal("20"), "bitcoin-cash": Decimal("1"), "litecoin": Decimal("1")})
        self.assertEqual(EXACT_FEE_CHAINS, ("bitcoin", "bitcoin-cash", "litecoin"))
        self.assertEqual(PRICE_MAX_AGE_SECS, 86_400)

    def test_accept_at_minimum_refuse_one_unit_below(self):
        expected = {"bitcoin": 24_269, "bitcoin-cash": 361_952, "litecoin": 1_678_134}
        for chain, price in FIXTURE_PRICE.items():
            with self.subTest(chain=chain):
                g = min_gross_for(chain, price)
                self.assertEqual(g, expected[chain])
                usd = check_minimum_lock(chain, g, price_usd=price, price_as_of=NOW, now=NOW)
                self.assertGreaterEqual(usd, MIN_LOCK_USD[chain])
                fee, principal, funding = lock_outputs(chain, g, price_usd=price, price_as_of=NOW, now=NOW)
                self.assertEqual(fee, g * 500 // 10_000)
                self.assertEqual(principal, g - fee)
                self.assertEqual(funding, g)
                with self.assertRaisesRegex(LockRefused, "under the"):
                    lock_outputs(chain, g - 1, price_usd=price, price_as_of=NOW, now=NOW)
                print(f"{chain}: {g} accepted at ${MIN_LOCK_USD[chain]} minimum, {g - 1} refused")

    def test_fail_closed_without_a_fresh_price(self):
        for chain, price in FIXTURE_PRICE.items():
            g = min_gross_for(chain, price) * 10
            ok = dict(price_usd=price, price_as_of=NOW, now=NOW)
            bad = [
                dict(ok, price_usd=None), dict(ok, price_usd="0"), dict(ok, price_usd="-1"),
                dict(ok, price_usd="abc"), dict(ok, price_usd="NaN"), dict(ok, price_usd="Infinity"),
                dict(ok, price_usd=True), dict(ok, price_as_of=None), dict(ok, now=None),
                dict(ok, price_as_of=NOW - PRICE_MAX_AGE_SECS),        # exactly 24 hours old
                dict(ok, price_as_of=NOW - 10 * PRICE_MAX_AGE_SECS),
                dict(ok, price_as_of=NOW + 301),                        # stamped in the future
                dict(ok, price_as_of=float(NOW)),
            ]
            for kw in bad:
                with self.subTest(chain=chain, kw=kw):
                    with self.assertRaises(LockRefused):
                        lock_outputs(chain, g, **kw)
            lock_outputs(chain, g, price_usd=price, price_as_of=NOW - PRICE_MAX_AGE_SECS + 1, now=NOW)
            with self.assertRaises(LockRefused):
                lock_outputs(chain, g)  # no price at all

    def test_dust_raised_split_is_gone_on_btc_bch_ltc(self):
        for chain in EXACT_FEE_CHAINS:
            dust = P2PKH_DUST_MINIMUM[chain]
            with self.subTest(chain=chain):
                self.assertEqual(split_outputs(chain, 20 * dust), (dust, 19 * dust, 20 * dust))
                with self.assertRaisesRegex(LockRefused, "dust"):
                    split_outputs(chain, 20 * dust - 20)
                with self.assertRaises(LockRefused):
                    split_outputs(chain, 1_213)  # $1 of BTC at the fixture price
                for g in [x for x in (20 * dust, 20 * dust + 7, 24_269, 361_952, 1_000_000, 1_678_134) if x >= 20 * dust]:
                    fee, principal, funding = split_outputs(chain, g)
                    self.assertEqual(fee, g * 500 // 10_000)
                    self.assertEqual(fee + principal, funding)
                    self.assertEqual(funding, g)

    def test_native_floors_and_their_derivation(self):
        self.assertEqual(MIN_LOCK_FLOOR_UNITS, {"bitcoin": 22_000, "bitcoin-cash": 11_000, "litecoin": 110_000})
        self.assertEqual(RELEASE_SPEND_BYTES, 200)
        self.assertEqual(STRESS_RELEASE_FEE_RATE, {"bitcoin": 100, "bitcoin-cash": 5, "litecoin": 20})
        for chain, floor in MIN_LOCK_FLOOR_UNITS.items():
            dust = P2PKH_DUST_MINIMUM[chain]
            need = dust + STRESS_RELEASE_FEE_RATE[chain] * RELEASE_SPEND_BYTES
            raw = max(20 * dust, -(-need * 100 // 95))
            with self.subTest(chain=chain):
                self.assertGreaterEqual(floor, raw)
                self.assertLess(floor - raw, 1_000)  # clean round-up, not padded
                fee, principal, _ = split_outputs(chain, floor)
                self.assertGreaterEqual(fee, dust)
                self.assertGreaterEqual(principal - STRESS_RELEASE_FEE_RATE[chain] * RELEASE_SPEND_BYTES, dust)

    def test_effective_minimum_at_today_and_high_prices(self):
        # (chain, price, expected effective minimum, which one wins)
        cases = [
            ("bitcoin", "82000", 24_391, "usd"),
            ("bitcoin", "250000", 22_000, "floor"),
            ("bitcoin", "1000000", 22_000, "floor"),
            ("bitcoin-cash", "276.69", 361_416, "usd"),
            ("bitcoin-cash", "2766.9", 36_142, "usd"),
            ("bitcoin-cash", "27669", 11_000, "floor"),
            ("litecoin", "59.7", 1_675_042, "usd"),
            ("litecoin", "597", 167_505, "usd"),
            ("litecoin", "5970", 110_000, "floor"),
        ]
        for chain, price, expected, wins in cases:
            with self.subTest(chain=chain, price=price):
                g = min_gross_for(chain, price)
                self.assertEqual(g, expected)
                usd_g, floor = usd_min_gross_for(chain, price), MIN_LOCK_FLOOR_UNITS[chain]
                self.assertEqual(wins, "floor" if floor > usd_g else "usd")
                fee, principal, funding = lock_outputs(chain, g, price_usd=price, price_as_of=NOW, now=NOW)
                self.assertEqual((fee, principal, funding), (g * 500 // 10_000, g - g * 500 // 10_000, g))
                with self.assertRaisesRegex(LockRefused, "floor" if wins == "floor" else "minimum"):
                    lock_outputs(chain, g - 1, price_usd=price, price_as_of=NOW, now=NOW)

    def test_price_rise_refuses_instead_of_raising_the_fee(self):
        # At $200,000 per BTC, $20 is 10,000 sats (5% = 500 < 546). The floor refuses it;
        # split_outputs alone also refuses it rather than raising the fee.
        self.assertEqual(usd_min_gross_for("bitcoin", "200000"), 10_000)
        with self.assertRaisesRegex(LockRefused, "floor"):
            lock_outputs("bitcoin", 10_000, price_usd="200000", price_as_of=NOW, now=NOW)
        with self.assertRaisesRegex(LockRefused, "dust"):
            split_outputs("bitcoin", 10_000)
        self.assertEqual(min_gross_for("bitcoin", "200000"), 22_000)

    def test_other_chains_unchanged(self):
        self.assertEqual(split_outputs("dogecoin", GROSS_SATS), (100_000, GROSS_SATS, GROSS_SATS + 100_000))
        self.assertEqual(split_outputs("digibyte", 100_000), (5_460, 100_000, 105_460))
        self.assertEqual(split_outputs("zcash", 1_000), (55, 1_000, 1_055))
        for chain in ("dogecoin", "digibyte", "zcash"):
            self.assertEqual(lock_outputs(chain, GROSS_SATS), split_outputs(chain, GROSS_SATS))
            with self.assertRaises(LockRefused):
                check_minimum_lock(chain, GROSS_SATS, price_usd="1", price_as_of=NOW, now=NOW)

    def test_priced_fixture_holds_and_releases_with_exact_5pct(self):
        for chain, price in FIXTURE_PRICE.items():
            with self.subTest(chain=chain):
                g = min_gross_for(chain, price)
                fix = LockFixture(chain, MATURITY, gross=g, price_usd=price, price_as_of=NOW, now=NOW)
                self.assertEqual((fix.fee_output, fix.principal, fix.funding_value), (g * 500 // 10_000, g - g * 500 // 10_000, g))
                ledger = Ledger()
                ledger.credit(fix.funding_txid, fix.funding_vout, fix.funding_output.__class__(fix.funding_value, fix.funding_output.script_pubkey))
                fix.funding_output = fix.funding_output.__class__(fix.funding_value, fix.funding_output.script_pubkey)
                lock_txid = ledger.apply(fix.lock_transaction())
                release_txid = ledger.apply(fix.spend_principal(lock_txid, MATURITY, fix.release_key))
                self.assertEqual(ledger.utxos[(release_txid, 0)].value, fix.principal)
                with self.assertRaises(LockRefused):
                    LockFixture(chain, MATURITY, gross=g - 1, price_usd=price, price_as_of=NOW, now=NOW)
                with self.assertRaises(LockRefused):
                    LockFixture(chain, MATURITY, gross=g)  # no price


VERIFIER_SOL = Path(__file__).resolve().parent.parent / "base-contracts" / "contracts" / "VinculumFinalisVerifier.sol"


class HandshakeBandTests(unittest.TestCase):
    """Operator t239u: BTC/BCH/LTC Handshake (3600 s) sized in units, no price."""

    def test_band_equals_the_verifier_constants(self):
        import re
        src = VERIFIER_SOL.read_text()
        def const(name):
            m = re.search(rf"uint256 public constant {name} = ([0-9_]+);", src)
            self.assertIsNotNone(m, name)
            return int(m.group(1).replace("_", ""))
        self.assertEqual(HANDSHAKE_DURATION_SECS, const("HANDSHAKE_DURATION_SECS"))
        for chain, tag in (("bitcoin", "BTC"), ("bitcoin-cash", "BCH"), ("litecoin", "LTC")):
            self.assertEqual(HANDSHAKE_UNIT_BAND[chain], (const(f"{tag}_HANDSHAKE_MIN_UNITS"), const(f"{tag}_HANDSHAKE_MAX_UNITS")))
        self.assertEqual(HANDSHAKE_UNIT_BAND, {"bitcoin": (11_000, 22_000), "bitcoin-cash": (11_000, 22_000), "litecoin": (110_000, 220_000)})

    def test_min_and_max_accepted_with_exact_5pct_and_no_price(self):
        for chain, (low, high) in HANDSHAKE_UNIT_BAND.items():
            for g in (low, (low + high) // 2, high):
                with self.subTest(chain=chain, gross=g):
                    fee, principal, funding = lock_outputs(chain, g, duration_secs=3600)  # no price at all
                    self.assertEqual(fee, g * 500 // 10_000)
                    self.assertEqual(principal, g - fee)
                    self.assertEqual(funding, g)
                    self.assertGreaterEqual(fee, P2PKH_DUST_MINIMUM[chain])
                    check_handshake_band(chain, g)
            print(f"{chain}: Handshake {low} and {high} accepted, fee {low * 500 // 10_000} and {high * 500 // 10_000}")

    def test_min_minus_one_and_max_plus_one_refused(self):
        for chain, (low, high) in HANDSHAKE_UNIT_BAND.items():
            with self.subTest(chain=chain):
                with self.assertRaisesRegex(LockRefused, "under the .*band minimum"):
                    lock_outputs(chain, low - 1, duration_secs=3600)
                with self.assertRaisesRegex(LockRefused, "over the .*band maximum"):
                    lock_outputs(chain, high + 1, duration_secs=3600)
                # A fresh price does not let a Handshake outside the band through.
                with self.assertRaises(LockRefused):
                    lock_outputs(chain, high * 100, price_usd=FIXTURE_PRICE[chain], price_as_of=NOW, now=NOW, duration_secs=3600)
                for bad in (0, -1, True, 11_000.0):
                    with self.assertRaises(LockRefused):
                        check_handshake_band(chain, bad)

    def test_fee_under_dust_is_still_refused_never_raised(self):
        # Inside-band gross always clears dust; split_outputs still refuses under-dust fees.
        for chain in HANDSHAKE_UNIT_BAND:
            dust = P2PKH_DUST_MINIMUM[chain]
            with self.assertRaisesRegex(LockRefused, "dust"):
                split_outputs(chain, 20 * dust - 20)

    def test_non_handshake_durations_unchanged(self):
        for chain, price in FIXTURE_PRICE.items():
            g = min_gross_for(chain, price)
            for d in (None, 604800, 2592000, 315360000):
                with self.subTest(chain=chain, duration=d):
                    kw = {} if d is None else {"duration_secs": d}
                    self.assertEqual(lock_outputs(chain, g, price_usd=price, price_as_of=NOW, now=NOW, **kw),
                                     (g * 500 // 10_000, g - g * 500 // 10_000, g))
                    with self.assertRaisesRegex(LockRefused, "under the"):
                        lock_outputs(chain, g - 1, price_usd=price, price_as_of=NOW, now=NOW, **kw)
                    with self.assertRaises(LockRefused):
                        lock_outputs(chain, g, **kw)  # no price: refused
                    # An in-band Handshake amount is not a valid standard lock.
                    with self.assertRaises(LockRefused):
                        lock_outputs(chain, HANDSHAKE_UNIT_BAND[chain][0], price_usd=price, price_as_of=NOW, now=NOW, **kw)
        with self.assertRaises(ValueError):
            lock_outputs("bitcoin", 11_000, duration_secs=3601)

    def test_other_chains_handshake_unchanged(self):
        for chain in ("dogecoin", "digibyte", "zcash"):
            self.assertEqual(lock_outputs(chain, GROSS_SATS, duration_secs=3600), split_outputs(chain, GROSS_SATS))
            with self.assertRaises(LockRefused):
                check_handshake_band(chain, GROSS_SATS)

    def test_handshake_fixture_holds_and_releases(self):
        for chain, (low, high) in HANDSHAKE_UNIT_BAND.items():
            for g in (low, high):
                with self.subTest(chain=chain, gross=g):
                    fix = LockFixture(chain, MATURITY, gross=g, duration_secs=3600)
                    self.assertEqual((fix.fee_output, fix.principal, fix.funding_value), (g * 500 // 10_000, g - g * 500 // 10_000, g))
                    ledger = Ledger()
                    fix.funding_output = fix.funding_output.__class__(fix.funding_value, fix.funding_output.script_pubkey)
                    ledger.credit(fix.funding_txid, fix.funding_vout, fix.funding_output)
                    lock_txid = ledger.apply(fix.lock_transaction())
                    release_txid = ledger.apply(fix.spend_principal(lock_txid, MATURITY, fix.release_key))
                    self.assertEqual(ledger.utxos[(release_txid, 0)].value, fix.principal)
            with self.assertRaises(LockRefused):
                LockFixture(chain, MATURITY, gross=low - 1, duration_secs=3600)


if __name__ == "__main__":
    unittest.main(verbosity=2)
