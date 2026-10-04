"""Build one Commitment Vault lock transaction per UTXO chain.

Fee is 5% (500 bps) of the gross. The standard fixture gross is 1,000,000
smallest units, so the calculated fee is 50,000 and the principal is 950,000.
If that fee output is under the chain's P2PKH dust minimum, the client keeps
the unrelayable fee (principal becomes the gross) and the relayed fee output
is exactly the dust minimum, funded on top of the gross.

Binding: the 117-byte payload, or its 32-byte SHA-256 where the cited node
policy rejects a raw 117-byte nulldata script. The fingerprint is the hash
and nothing else.

Principal: P2SH of OP_CHECKLOCKTIMEVERIFY OP_DROP <pubkey> OP_CHECKSIG.
Dogecoin is not a witness script. P2SH is the form these networks relay.
"""

from __future__ import annotations

import os

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

# The CLTV redeem script cannot keep a per-identity counter (VF-COM-006).
COUNTS_PER_IDENTITY = False

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


def handshake_allowance(counts_per_identity: bool) -> int:
    """Capable mechanisms get 3. Mechanisms that cannot count get 1."""
    return 3 if counts_per_identity else 1


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


def split_outputs(chain: str, gross: int) -> tuple[int, int, int]:
    """Return (fee_output, principal, funding_value).

    Standard split: fee = floor(gross * 500 / 10000), principal = gross - fee,
    and the funding coin is the gross. When that fee is under the chain dust
    minimum, the client keeps it (principal = gross) and the output that must
    relay is exactly the dust minimum, not more. That relay output is funded
    on top of the gross, so the funding coin is principal + fee_output.
    """
    if chain not in P2PKH_DUST_MINIMUM:
        raise ValueError(f"no dust limit recorded for {chain}")
    fee, principal = split_fee(gross)
    dust = P2PKH_DUST_MINIMUM[chain]
    if fee < dust:
        return dust, gross, gross + dust
    return fee, principal, gross


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
    def __init__(self, chain: str, maturity: int):
        if FEE_SATS != 50_000 or PRINCIPAL_SATS != 950_000:
            raise RuntimeError("standard split is not 50_000 / 950_000")
        self.chain = chain
        self.maturity = maturity
        self.fee_output, self.principal, self.funding_value = split_outputs(chain, GROSS_SATS)
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
