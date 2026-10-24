"""Build one Commitment Vault lock transaction per UTXO chain.

Fee is 5% (500 bps) of the gross. The standard fixture gross is 1,000,000
smallest units, so the calculated fee is 50,000 and the principal is 950,000.
If that fee output is under the chain's P2PKH dust minimum, the client keeps
the unrelayable fee (principal becomes the gross) and the relayed fee output
is exactly the dust minimum, funded on top of the gross. That dust-raised
path is kept ONLY for Dogecoin, DigiByte and Zcash. On Bitcoin, Bitcoin Cash
and Litecoin a fee output under dust is refused (LockRefused), so lock.py can
never produce a non-5% fee there.

Minimum lock size (operator, t230u): a standard lock on Bitcoin must be at
least $20 gross, on Bitcoin Cash and Litecoin at least $1 gross, valued at lock
time from a fresh price (under 24 hours old). No price, a bad price or a stale
price refuses the lock. Real locks on those chains go through lock_outputs().

Native floor (operator, t235u): the minimum is the HIGHER of the USD minimum
and a fixed floor in smallest units (MIN_LOCK_FLOOR_UNITS), so a lock at the
minimum keeps an exact 5% fee at or above dust, and a release that still
clears a stress fee rate, however high the coin price goes.
Handshake (operator t239u, matching the Revision B verifier, t238u): on
Bitcoin, Bitcoin Cash and Litecoin a 1-hour Handshake (3600 s) is sized in
smallest units, not USD: gross must be within HANDSHAKE_UNIT_BAND (inclusive),
Bitcoin and Bitcoin Cash 11,000 to 22,000 sats, Litecoin 110,000 to 220,000
litoshis. No price is needed for it. The fee is still exactly floor(5%) and a
fee under dust is still refused, never raised. The verifier counts such a
Handshake as at most $0.02 for VCLM and RAC. Other durations keep the USD
minimum, native floor and fresh-price rule above. Pass duration_secs to
lock_outputs() / LockFixture(); without it a lock is treated as a standard lock.

Binding: the 117-byte payload, or its 32-byte SHA-256 where the cited node
policy rejects a raw 117-byte nulldata script. The fingerprint is the hash
and nothing else.

Principal: P2SH of OP_CHECKLOCKTIMEVERIFY OP_DROP <pubkey> OP_CHECKSIG.
Dogecoin is not a witness script. P2SH is the form these networks relay.
"""

from __future__ import annotations

import os
from decimal import Decimal, InvalidOperation

from crypto import FixtureKey, sha256
from script import (
    assert_cltv_redeem,
    cltv_redeem_script,
    op_return_script,
    p2pkh_script,
    p2sh_script,
)
from sighash import ZEC_CONSENSUS_BRANCH_ID
from tx import (
    Tx,
    TxIn,
    TxOut,
    p2pkh_script_sig,
    p2sh_script_sig,
    sign_input,
)

FEE_BPS = 500

# Revision 12: a 1-hour Handshake has no allowance limit and no per-account
# counter. A wallet may create any number of 1-hour Handshakes.
HANDSHAKE_ALLOWANCE_LIMIT = None

# Exact COMMITMENT_DURATIONS rows. Seconds, multiplier bps. No range.
PERMITTED_DURATIONS = (
    (3600, 10000),
    (604800, 10000),
    (2592000, 11500),
    (5184000, 13000),
    (7776000, 15000),
    (15552000, 20000),
    (31536000, 25000),
    (63072000, 38000),
    (94608000, 50000),
    (126144000, 57500),
    (157680000, 65000),
    (189216000, 68000),
    (220752000, 71000),
    (252288000, 74000),
    (283824000, 77000),
    (315360000, 80000),
)


def multiplier_bps(duration_secs: int) -> int:
    for secs, bps in PERMITTED_DURATIONS:
        if secs == duration_secs:
            return bps
    raise ValueError(f"duration {duration_secs} is not one of the sixteen rows")

GROSS_SATS = 1_000_000
FEE_SATS = GROSS_SATS * FEE_BPS // 10_000  # 50_000
PRINCIPAL_SATS = GROSS_SATS - FEE_SATS  # 950_000

# scriptPubKey size of OP_RETURN <117 bytes via PUSHDATA1> is 120.
# Default nMaxDatacarrierBytes / MAX_OP_RETURN_RELAY on the chains below is 83,
# so 120 is non-standard. A 32-byte push is 34 bytes and fits.
#
# bitcoin: Bitcoin Core 30 raises the default -datacarriersize to 100,000
#   (https://bitcoincore.org/en/releases/30.0/ : "effectively uncaps the limit").
#   policy.h sets MAX_OP_RETURN_RELAY = MAX_STANDARD_TX_WEIGHT / WITNESS_SCALE_FACTOR.
#   Raw 117 is inside that default. Use the raw payload.
# bitcoin-cash: Bitcoin Cash Node standard.h, MAX_OP_RETURN_RELAY = 223
#   ("220 bytes of data, +1 for OP_RETURN, +2 for the pushdata opcodes").
#   120 <= 223. Use the raw payload.
# litecoin: litecoin src/script/standard.h MAX_OP_RETURN_RELAY = 83, and
#   policy.cpp rejects scriptPubKey.size() > nMaxDatacarrierBytes.
# dogecoin: dogecoin src/script/standard.h MAX_OP_RETURN_RELAY = 83, and
#   policy.cpp rejects scriptPubKey.size() > nMaxDatacarrierBytes.
# digibyte: DigiByte-Core policy.h MAX_OP_RETURN_RELAY{83}
#   ("80 bytes of data, +1 for OP_RETURN, +2 for the pushdata opcodes").
# zcash: zcash src/script/standard.h MAX_OP_RETURN_RELAY = 83
#   (same 80 + 1 + 2 comment), tag and master.
RAW_BINDING_CHAINS = ("bitcoin", "bitcoin-cash")
FINGERPRINT_BINDING_CHAINS = ("litecoin", "dogecoin", "digibyte", "zcash")

# Minimum relayable P2PKH value. An output strictly below this is dust.
# Equality is the smallest value the cited rule accepts.
#
# bitcoin: Bitcoin Core GetDustThreshold at DUST_RELAY_TX_FEE 3_000 sat/kvB
#   is (34 + 148) * 3000 / 1000 = 546 satoshis.
#   https://github.com/bitcoin/bitcoin/blob/master/src/policy/policy.h
# bitcoin-cash: the common P2PKH threshold is 546 satoshis.
#   https://documentation.cash/protocol/blockchain/transaction-validation/network-level-validation-rules
# litecoin: DUST_RELAY_TX_FEE 30_000, P2PKH boundary 5_460 litoshis.
#   https://github.com/litecoin-project/litecoin/blob/master/src/policy/policy.h
# dogecoin: DEFAULT_HARD_DUST_LIMIT = DEFAULT_DUST_LIMIT / 10.
#   RECOMMENDED_MIN_TX_FEE = COIN / 100 = 1_000_000, so the hard limit is
#   100_000 koinu (0.001 DOGE). policy.cpp rejects txout.IsDust(nHardDustLimit).
#   https://github.com/dogecoin/dogecoin/blob/master/src/policy/policy.h
# digibyte: DUST_RELAY_TX_FEE is 30_000 sat/kvB (DigiByte-Core ARCHITECTURE.md,
#   v9.26.0-rc29, section 7.4). The Core P2PKH formula gives
#   (34 + 148) * 30000 / 1000 = 5_460.
# zcash: dust rate is 300 zatoshis / 1000 bytes (3 * ONE_THIRD_DUST_THRESHOLD_RATE).
#   (34 + 148) * 300 / 1000 = 54, so 55 is the first value that clears it.
#   https://github.com/zcash/zcash/blob/v6.11.0/src/policy/policy.h
P2PKH_DUST_MINIMUM = {
    "bitcoin": 546,
    "bitcoin-cash": 546,
    "litecoin": 5_460,
    "dogecoin": 100_000,
    "digibyte": 5_460,
    "zcash": 55,
}


def split_fee(gross: int) -> tuple[int, int]:
    if gross <= 0:
        raise ValueError("gross must be positive")
    fee = gross * FEE_BPS // 10_000
    principal = gross - fee
    if fee == 0 or principal == 0:
        raise ValueError("fee and principal must both be nonzero")
    return fee, principal


class LockRefused(ValueError):
    """The lock is refused before anything is built. Nothing is substituted."""


# Chains where the fee output must be exactly floor(5%) and is never raised
# to the dust minimum. The Base readers (UtxoLockReader.sol) require
# fee == floor(gross * 500 / 10000), so a dust-raised fee could never verify.
EXACT_FEE_CHAINS = ("bitcoin", "bitcoin-cash", "litecoin")

# Standard-lock minimums, gross USD at lock time (operator, t230u).
MIN_LOCK_USD = {
    "bitcoin": Decimal("20"),
    "bitcoin-cash": Decimal("1"),
    "litecoin": Decimal("1"),
}
# Native floor per chain, smallest units (operator, t235u). Each is the larger of
#   20 x the P2PKH dust minimum (so floor(5%) >= dust), and
#   the smallest gross whose 95% principal pays a RELEASE_SPEND_BYTES release
#   at STRESS_RELEASE_FEE_RATE and still leaves at least dust,
# rounded up to a clean number. Derivation (dust, release 200 bytes):
#   bitcoin:      max(10,920, ceil((546 + 100 x 200) / 0.95) = 21,628)  -> 22,000 sats
#   bitcoin-cash: max(10,920, ceil((546 + 5 x 200) / 0.95) = 1,628)     -> 11,000 sats
#   litecoin:     max(109,200, ceil((5,460 + 20 x 200) / 0.95) = 9,958) -> 110,000 litoshis
# The release spend (one P2SH CLTV input, one P2PKH output) measured 198 to
# 200 bytes on local Bitcoin Core 31.1, Bitcoin Cash Node 29.2.0 and Litecoin
# Core 0.21.4 regtest nodes; 200 is used.
MIN_LOCK_FLOOR_UNITS = {
    "bitcoin": 22_000,
    "bitcoin-cash": 11_000,
    "litecoin": 110_000,
}
RELEASE_SPEND_BYTES = 200
STRESS_RELEASE_FEE_RATE = {"bitcoin": 100, "bitcoin-cash": 5, "litecoin": 20}  # units per byte
# BTC, BCH and LTC all have 8 decimals (satoshi / litoshi).
SMALLEST_UNITS_PER_COIN = 100_000_000
# Fresh price: under 24 hours old at lock time (same rule as the price fetcher's natives).
PRICE_MAX_AGE_SECS = 24 * 60 * 60
# A price stamped more than 5 minutes in the future is not trusted.
PRICE_MAX_FUTURE_SECS = 5 * 60

# Handshake band in smallest units, inclusive (operator t239u). Equal to the
# Revision B verifier constants BTC/BCH/LTC_HANDSHAKE_MIN_UNITS and _MAX_UNITS
# (contracts/VinculumFinalisVerifier.sol). The minimum is 20 x dust rounded up,
# so floor(5%) of it is at least dust; the maximum is twice the minimum.
HANDSHAKE_DURATION_SECS = 3600
HANDSHAKE_UNIT_BAND = {
    "bitcoin": (11_000, 22_000),
    "bitcoin-cash": (11_000, 22_000),
    "litecoin": (110_000, 220_000),
}


def split_outputs(chain: str, gross: int) -> tuple[int, int, int]:
    """Return (fee_output, principal, funding_value).

    Standard split: fee = floor(gross * 500 / 10000), principal = gross - fee,
    and the funding coin is the gross.

    Bitcoin, Bitcoin Cash, Litecoin: a fee under the chain dust minimum is
    refused (LockRefused). The fee is always exactly 5%.

    Dogecoin, DigiByte, Zcash (unchanged): when that fee is under the chain
    dust minimum, the client keeps it (principal = gross) and the output that
    must relay is exactly the dust minimum, not more. That relay output is
    funded on top of the gross, so the funding coin is principal + fee_output.
    """
    if chain not in P2PKH_DUST_MINIMUM:
        raise ValueError(f"no dust limit recorded for {chain}")
    fee, principal = split_fee(gross)
    dust = P2PKH_DUST_MINIMUM[chain]
    if fee < dust:
        if chain in EXACT_FEE_CHAINS:
            raise LockRefused(
                f"{chain}: 5% fee output {fee} is under the {dust} dust minimum; "
                "refused (no dust-raised fee on this chain)"
            )
        return dust, gross, gross + dust
    return fee, principal, gross


def _price(price_usd) -> Decimal:
    if price_usd is None or isinstance(price_usd, bool):
        raise LockRefused("no fresh price; lock refused")
    try:
        p = Decimal(str(price_usd).strip())
    except (InvalidOperation, ValueError):
        raise LockRefused(f"price {price_usd!r} is not a number; lock refused") from None
    if not p.is_finite() or p <= 0:
        raise LockRefused(f"price {price_usd!r} is not a positive number; lock refused")
    return p


def gross_usd(gross: int, price_usd) -> Decimal:
    """Exact USD value of `gross` smallest units at `price_usd` per coin."""
    return Decimal(int(gross)) * _price(price_usd) / SMALLEST_UNITS_PER_COIN


def check_minimum_lock(chain: str, gross: int, *, price_usd, price_as_of, now) -> Decimal:
    """Refuse unless `gross` is at least the chain's minimum, valued with a fresh price.

    price_as_of and now are Unix seconds. Returns the gross USD value.
    """
    if chain not in MIN_LOCK_USD:
        raise LockRefused(f"no minimum lock size recorded for {chain}")
    if not isinstance(gross, int) or isinstance(gross, bool) or gross <= 0:
        raise LockRefused("gross must be a positive whole number of smallest units")
    if price_as_of is None or now is None:
        raise LockRefused("no fresh price; lock refused")
    if not all(isinstance(t, int) and not isinstance(t, bool) for t in (price_as_of, now)):
        raise LockRefused("price time and lock time must be whole Unix seconds")
    if price_as_of > now + PRICE_MAX_FUTURE_SECS:
        raise LockRefused("price is stamped in the future; lock refused")
    if now - price_as_of >= PRICE_MAX_AGE_SECS:
        raise LockRefused("price is 24 hours old or older; lock refused")
    usd = gross_usd(gross, price_usd)
    minimum = MIN_LOCK_USD[chain]
    if usd < minimum:
        raise LockRefused(f"{chain}: lock is ${usd:.4f}, under the ${minimum} minimum; refused")
    floor = MIN_LOCK_FLOOR_UNITS[chain]
    if gross < floor:
        raise LockRefused(f"{chain}: lock is {gross} units, under the {floor}-unit floor; refused")
    return usd


def check_handshake_band(chain: str, gross: int) -> None:
    """Refuse a Bitcoin, Bitcoin Cash or Litecoin Handshake outside the unit band. No price."""
    if chain not in HANDSHAKE_UNIT_BAND:
        raise LockRefused(f"no Handshake unit band recorded for {chain}")
    if not isinstance(gross, int) or isinstance(gross, bool) or gross <= 0:
        raise LockRefused("gross must be a positive whole number of smallest units")
    low, high = HANDSHAKE_UNIT_BAND[chain]
    if gross < low:
        raise LockRefused(f"{chain}: Handshake is {gross} units, under the {low}-unit band minimum; refused")
    if gross > high:
        raise LockRefused(f"{chain}: Handshake is {gross} units, over the {high}-unit band maximum; refused")


def usd_min_gross_for(chain: str, price_usd) -> int:
    """Smallest gross (smallest units) worth at least the chain's USD minimum at this price."""
    if chain not in MIN_LOCK_USD:
        raise LockRefused(f"no minimum lock size recorded for {chain}")
    p = _price(price_usd)
    units = MIN_LOCK_USD[chain] * SMALLEST_UNITS_PER_COIN / p
    whole = int(units)
    return whole if Decimal(whole) == units else whole + 1


def min_gross_for(chain: str, price_usd) -> int:
    """Effective minimum: the higher of the USD minimum at this price and the native floor."""
    return max(usd_min_gross_for(chain, price_usd), MIN_LOCK_FLOOR_UNITS[chain])


def lock_outputs(chain: str, gross: int, *, price_usd=None, price_as_of=None, now=None,
                 duration_secs: int | None = None) -> tuple[int, int, int]:
    """Outputs for a real lock.

    Bitcoin, Bitcoin Cash, Litecoin: a Handshake (duration_secs == 3600) must be
    inside HANDSHAKE_UNIT_BAND and needs no price; any other duration (or None)
    must pass the USD minimum, native floor and fresh-price check. Then the exact
    5% split (a fee under dust is refused). Other chains: split_outputs, unchanged.
    """
    if duration_secs is not None:
        multiplier_bps(duration_secs)  # one of the sixteen rows, or ValueError
    if chain in MIN_LOCK_USD:
        if duration_secs == HANDSHAKE_DURATION_SECS:
            check_handshake_band(chain, gross)
        else:
            check_minimum_lock(chain, gross, price_usd=price_usd, price_as_of=price_as_of, now=now)
    return split_outputs(chain, gross)


def binding_payload(lock_id: bytes, base_recipient: bytes, output_token: int, asset_id: bytes, valuation: bytes) -> bytes:
    if len(lock_id) != 32 or len(base_recipient) != 20 or len(asset_id) != 32 or len(valuation) != 32:
        raise ValueError("binding field width does not match the 117-byte payload")
    if not isinstance(output_token, int) or isinstance(output_token, bool) or not 0 <= output_token <= 255:
        raise ValueError("output token must be one byte")
    payload = lock_id + base_recipient + bytes([output_token]) + asset_id + valuation
    if len(payload) != 117:
        raise ValueError(f"binding payload is {len(payload)} bytes, not 117")
    return payload


def binding_script(chain: str, payload: bytes) -> tuple[bytes, bytes]:
    """Return (scriptPubKey, carried bytes). Carried bytes are payload or its SHA-256."""
    if len(payload) != 117:
        raise ValueError("binding payload must be 117 bytes")
    if chain in RAW_BINDING_CHAINS:
        carried = payload
    elif chain in FINGERPRINT_BINDING_CHAINS:
        carried = sha256(payload)
        if len(carried) != 32:
            raise RuntimeError("SHA-256 fingerprint must be 32 bytes")
    else:
        raise ValueError(f"no verified nulldata rule for {chain}; refusing to guess")
    return op_return_script(carried), carried


class LockFixture:
    """Script-level lock fixture.

    Without `gross` it is the standard 1,000,000-unit script fixture used by the
    hold/release tests and the Base reader fixtures; it carries no price and is
    not a priced lock. With `gross`, it is built through lock_outputs(), so on
    Bitcoin, Bitcoin Cash and Litecoin the minimum and fresh-price check apply,
    or, with duration_secs=3600, the Handshake unit band (no price).
    """

    def __init__(self, chain: str, maturity: int, *, gross: int | None = None,
                 price_usd=None, price_as_of: int | None = None, now: int | None = None,
                 duration_secs: int | None = None):
        if FEE_SATS != 50_000 or PRINCIPAL_SATS != 950_000:
            raise RuntimeError("standard split is not 50_000 / 950_000")
        self.chain = chain
        self.maturity = maturity
        if gross is None:
            self.fee_output, self.principal, self.funding_value = split_outputs(chain, GROSS_SATS)
        else:
            self.fee_output, self.principal, self.funding_value = lock_outputs(
                chain, gross, price_usd=price_usd, price_as_of=price_as_of, now=now,
                duration_secs=duration_secs,
            )
        self.funding_key = FixtureKey(f"{chain} funding fixture")
        self.dev_fund_key = FixtureKey(f"{chain} dev fund fixture")
        self.release_key = FixtureKey(f"{chain} release fixture")
        self.other_key = FixtureKey(f"{chain} unrelated fixture")
        self.lock_id = os.urandom(32)
        self.base_recipient = os.urandom(20)  # fixture bytes, not a published address
        self.output_token = 0x01  # fixture selector byte
        self.asset_id = os.urandom(32)
        self.valuation = os.urandom(32)
        self.payload = binding_payload(
            self.lock_id, self.base_recipient, self.output_token, self.asset_id, self.valuation
        )
        self.redeem_script = cltv_redeem_script(maturity, self.release_key.pubkey)
        assert_cltv_redeem(self.redeem_script, self.release_key.pubkey, maturity)
        self.principal_script = p2sh_script(self.redeem_script)
        if self.principal_script[0] == 0x00:
            raise RuntimeError("principal output must not be a witness script")
        self.binding_script, self.binding_carried = binding_script(chain, self.payload)
        self.funding_txid = os.urandom(32)
        self.funding_vout = 0
        self.funding_output = TxOut(self.funding_value, p2pkh_script(self.funding_key.pubkey))

    def lock_transaction(self) -> Tx:
        tx = Tx(
            chain=self.chain,
            version=2 if self.chain != "zcash" else 5,
            inputs=[TxIn(self.funding_txid, self.funding_vout, b"", 0xFFFFFFFF)],
            outputs=[
                TxOut(self.fee_output, p2pkh_script(self.dev_fund_key.pubkey)),
                TxOut(self.principal, self.principal_script),
                TxOut(0, self.binding_script),
            ],
            locktime=0,
            expiry_height=0,
            consensus_branch_id=ZEC_CONSENSUS_BRANCH_ID,
        )
        sig = sign_input(tx, 0, self.funding_key, self.funding_output, self.funding_output.script_pubkey)
        tx.inputs[0].script_sig = p2pkh_script_sig(sig, self.funding_key.pubkey)
        return tx

    def spend_principal(self, lock_txid: bytes, locktime: int, key: FixtureKey, sequence: int = 0xFFFFFFFE) -> Tx:
        tx = Tx(
            chain=self.chain,
            version=2 if self.chain != "zcash" else 5,
            inputs=[TxIn(lock_txid, 1, b"", sequence)],
            outputs=[TxOut(self.principal, p2pkh_script(key.pubkey))],
            locktime=locktime,
            expiry_height=0,
            consensus_branch_id=ZEC_CONSENSUS_BRANCH_ID,
        )
        prevout = TxOut(self.principal, self.principal_script)
        sig = sign_input(tx, 0, key, prevout, self.redeem_script)
        tx.inputs[0].script_sig = p2sh_script_sig(sig, self.redeem_script)
        return tx
