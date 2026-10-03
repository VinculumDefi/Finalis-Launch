"""No skips. Fixture pubkeys only — not mainnet identities."""

import unittest

from checker import (
    KIND_ENTRY,
    KIND_SHRED,
    MAX_LOCKOUT_CONFIRMATIONS,
    SPEC_TEST_LEAF,
    SPEC_TEST_ROOT,
    ProofError,
    canonical_root,
    check_proof,
    compute_bank_hash,
    flip_bit,
    merkle_proof,
    shred_join,
    shred_leaf_hash,
)


def fixture_pubkey(tag: bytes) -> bytes:
    import hashlib

    return hashlib.sha256(b"finalized-slot-fixture-v8|" + tag).digest()


def sig(tag: bytes) -> bytes:
    return (tag * 64)[:64]


def b32(tag: int) -> bytes:
    return bytes([tag]) + bytes(31)


def shred_merkle(nodes: list[bytes], index: int):
    level = [shred_leaf_hash(n) for n in nodes]
    idx = index
    proof = []
    while len(level) > 1:
        if len(level) % 2 == 1:
            level = level + [level[-1]]
        if idx % 2 == 0:
            proof.append({"hash": level[idx + 1][:20], "left": False})
        else:
            proof.append({"hash": level[idx - 1][:20], "left": True})
        level = [shred_join(level[i], level[i + 1]) for i in range(0, len(level), 2)]
        idx //= 2
    return level[0], proof


def build_inclusion(kind: str, signature: bytes, keys: list[bytes], neighbors: list[bytes]):
    """Entry leaf is the raw signature. Shred leaf is the shred node that contains it."""
    common = {
        "kind": kind,
        "signature": signature,
        "tx_id": signature,
        "account_keys": keys,
        "parent_hash": b32(0x11),
        "accounts_delta_hash": b32(0x22),
        "signature_count": 1,
        "latest_blockhash": b32(0x33),
    }
    if kind == KIND_ENTRY:
        datas = [signature] + [sig(n) for n in neighbors]
        common["level1_proof"] = merkle_proof(datas, 0)
        common["entry_merkle_root"] = canonical_root(datas)
    else:
        node = b"fec-data|" + signature + b"|end"
        others = [b"fec-other|" + sig(n) for n in neighbors]
        root, proof = shred_merkle([node] + others, 0)
        common["shred_node"] = node
        common["shred_proof"] = proof
        common["shred_merkle_root"] = root
    return common


def vote(pubkey: bytes, bank: bytes, *, root: bool, confirm_only: bool = False, stake: int):
    body = {
        "pubkey": pubkey,
        "stake": stake,
        "bank_hash": bank,
        "root_slot": None,
        "lockouts": [],
    }
    if root:
        body["root_slot"] = SLOT
        body["lockouts"] = [
            {"slot": SLOT, "confirmation_count": MAX_LOCKOUT_CONFIRMATIONS}
        ]
    elif confirm_only:
        # Optimistic confirmation only: a direct vote, not a root.
        body["root_slot"] = None
        body["lockouts"] = [{"slot": SLOT, "confirmation_count": 1}]
    return body


SLOT = 128


def valid_proof(kind: str = KIND_ENTRY):
    keys = [fixture_pubkey(b"fee-payer"), fixture_pubkey(b"vault")]
    signature = sig(b"\x42")
    neighbors = [b"n1", b"n2", b"n3"]
    inclusion = build_inclusion(kind, signature, keys, neighbors)
    bank = compute_bank_hash(
        inclusion["parent_hash"],
        inclusion["accounts_delta_hash"],
        inclusion["signature_count"],
        inclusion["latest_blockhash"],
    )
    a = fixture_pubkey(b"vote-A")
    b = fixture_pubkey(b"vote-B")
    c = fixture_pubkey(b"vote-C")
    # Exactly 2/3 of total stake roots the slot. C only confirms.
    stake_set = [
        {"pubkey": a, "stake": 200},
        {"pubkey": b, "stake": 200},
        {"pubkey": c, "stake": 200},
    ]
    votes = [
        vote(a, bank, root=True, stake=200),
        vote(b, bank, root=True, stake=200),
        vote(c, bank, root=False, confirm_only=True, stake=200),
    ]
    return {
        "slot": SLOT,
        "bank_hash": bank,
        "inclusion": inclusion,
        "total_stake": 600,
        "stake_set": stake_set,
        "votes": votes,
    }


class FinalizedSlotTests(unittest.TestCase):
    def test_spec_canonical_merkle_vector(self):
        self.assertEqual(canonical_root([SPEC_TEST_LEAF]), SPEC_TEST_ROOT)

    def test_supermajority_root_and_tx_inclusion_is_finalized(self):
        proof = valid_proof(KIND_ENTRY)
        check_proof(proof)
        shred = valid_proof(KIND_SHRED)
        check_proof(shred)

    def test_confirmed_only_is_rejected(self):
        # Duplicate confirmation: the same vote account repeated so a naive
        # sum would clear 2/3 while unique rooted stake does not.
        proof = valid_proof()
        only = proof["votes"][0]
        only["stake"] = 200
        proof["votes"] = [only, dict(only)]
        with self.assertRaises(ProofError) as dup:
            check_proof(proof)
        self.assertEqual(dup.exception.reason, "duplicate confirmation")

        # Rooted stake strictly below 2/3.
        proof = valid_proof()
        proof["votes"][1]["root_slot"] = None
        proof["votes"][1]["lockouts"] = [{"slot": SLOT, "confirmation_count": 1}]
        with self.assertRaises(ProofError) as low:
            check_proof(proof)
        self.assertIn("2/3", low.exception.reason)

        # Supermajority voted, but no vote roots the slot (confirmed, not finalized).
        proof = valid_proof()
        for v in proof["votes"]:
            v["root_slot"] = None
            v["lockouts"] = [{"slot": SLOT, "confirmation_count": 1}]
        with self.assertRaises(ProofError) as unrooted:
            check_proof(proof)
        self.assertIn("do not root", unrooted.exception.reason)

        # A root on an older slot does not root this slot.
        proof = valid_proof()
        for v in proof["votes"]:
            v["root_slot"] = SLOT - 1
            v["lockouts"] = [
                {"slot": SLOT - 1, "confirmation_count": MAX_LOCKOUT_CONFIRMATIONS}
            ]
        with self.assertRaises(ProofError):
            check_proof(proof)

    def test_slot_ancestor_of_rooted_bank_is_finalized(self):
        proof = valid_proof()
        child_slot = SLOT + 4
        child_bank = compute_bank_hash(
            proof["bank_hash"],
            b32(0x44),
            2,
            b32(0x55),
        )
        header = {
            "slot": child_slot,
            "parent_slot": SLOT,
            "parent_bank_hash": proof["bank_hash"],
            "accounts_delta_hash": b32(0x44),
            "signature_count": 2,
            "latest_blockhash": b32(0x55),
            "bank_hash": child_bank,
        }
        for v in proof["votes"][:2]:
            v["bank_hash"] = child_bank
            v["root_slot"] = child_slot
            v["lockouts"] = []
            v["header_chain"] = [header]
        check_proof(proof)
        for v in proof["votes"][:2]:
            v["header_chain"] = []
        with self.assertRaises(ProofError):
            check_proof(proof)

    def test_tx_not_in_block_is_rejected(self):
        proof = valid_proof()
        other = sig(b"\x99")
        self.assertNotEqual(other, proof["inclusion"]["signature"])
        proof["inclusion"]["signature"] = other
        proof["inclusion"]["tx_id"] = other
        with self.assertRaises(ProofError) as ctx:
            check_proof(proof)
        self.assertIn("not in the block", ctx.exception.reason)

    def test_one_bit_flip_of_bank_hash_or_tx_id_is_rejected(self):
        proof = valid_proof()
        proof["bank_hash"] = flip_bit(proof["bank_hash"], 0)
        with self.assertRaises(ProofError) as bank:
            check_proof(proof)
        self.assertIn("bank hash", bank.exception.reason)

        proof = valid_proof()
        proof["inclusion"]["tx_id"] = flip_bit(proof["inclusion"]["tx_id"], 0)
        with self.assertRaises(ProofError) as tx:
            check_proof(proof)
        self.assertTrue(tx.exception.reason)

        proof = valid_proof()
        proof["inclusion"]["tx_id"] = flip_bit(proof["inclusion"]["tx_id"], 17)
        with self.assertRaises(ProofError):
            check_proof(proof)

    def test_empty_proof_is_rejected(self):
        for empty in (None, {}, [], "", {"votes": []}, {"slot": SLOT}):
            with self.assertRaises(ProofError) as ctx:
                check_proof(empty)
            self.assertEqual(ctx.exception.reason, "empty proof")


if __name__ == "__main__":
    unittest.main(verbosity=2)
