"""Revision 8 finalized-slot proof checker.

A slot counts as finalized only when it is rooted: a supermajority of the
stake in the proof (>= 2/3) has a vote whose root or maximum lockout covers
that slot, and the slot is that rooted bank or an ancestor of it. Optimistic
confirmation (commitment "confirmed") is not finality.

Bank hash is Solana hashv (one SHA-256 over the raw concatenation) of
parent hash, accounts-delta hash, signature count as u64 little-endian, and
the last blockhash. That is the hashv cited by the simple-payment proposal
(https://docs.anza.xyz/proposals/simple-payment-and-state-verification) at
https://github.com/solana-labs/solana/blob/b6bfed64cb159ee67bb6bdbaefc7f833bbed3563/runtime/src/bank.rs#L3468-L3473
Neither that hashv nor current Agave master hash_internal_state concatenates a
block-merkle root, so the root is not an input.

Entry inclusion uses the published signature Merkle leaf: MerkleTree::new over
the transaction signature bytes (entry.rs hash_signatures), leaf
SHA-256(0x00 || signature), inner SHA-256(0x01 || left || right)
(https://github.com/anza-xyz/agave/blob/master/merkle-tree/src/merkle_tree.rs).
Shred inclusion uses the published shred leaf
SHA-256(b"\x00SOLANA_MERKLE_SHREDS_LEAF" || shred_node) and inner
SHA-256(b"\x01SOLANA_MERKLE_SHREDS_NODE" || left[:20] || right[:20])
(https://github.com/anza-xyz/agave/blob/master/ledger/src/shred/merkle_tree.rs).

Stake weights and vote pubkeys are caller-supplied fixtures. This module does
not embed mainnet validator identities.
"""

from __future__ import annotations

import hashlib
from typing import Any

# Tower BFT roots a slot once its confirmation count reaches max lockout.
# Agave commitments: finalized requires 31+ confirmed blocks built atop the
# block; confirmed is only a supermajority vote and is not enough.
# https://docs.anza.xyz/consensus/commitments
MAX_LOCKOUT_CONFIRMATIONS = 31

KIND_ENTRY = "entry_block_merkle"
KIND_SHRED = "shred_merkle"
KINDS = (KIND_ENTRY, KIND_SHRED)

# Single-item canonical-tree vector from core/merkle-tree.md ("test").
SPEC_TEST_LEAF = b"test"
SPEC_TEST_ROOT = bytes.fromhex(
    "dbebd10e61bc8c28591273feafbbef95d544f874693301d8f7f8e54c6e30058e"
)


class ProofError(Exception):
    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


def sha256(data: bytes) -> bytes:
    return hashlib.sha256(data).digest()


def leaf_hash(data: bytes) -> bytes:
    return sha256(b"\x00" + data)


def node_hash(left: bytes, right: bytes) -> bytes:
    if len(left) != 32 or len(right) != 32:
        raise ProofError("merkle node is not 32 bytes")
    return sha256(b"\x01" + left + right)


def canonical_root(datas: list[bytes]) -> bytes:
    if not datas:
        raise ProofError("empty merkle")
    level = [leaf_hash(d) for d in datas]
    while len(level) > 1:
        if len(level) % 2 == 1:
            level = level + [level[-1]]
        level = [node_hash(level[i], level[i + 1]) for i in range(0, len(level), 2)]
    return level[0]


def merkle_proof(datas: list[bytes], index: int) -> list[dict[str, Any]]:
    if not datas or index < 0 or index >= len(datas):
        raise ProofError("merkle index out of range")
    level = [leaf_hash(d) for d in datas]
    idx = index
    proof: list[dict[str, Any]] = []
    while len(level) > 1:
        if len(level) % 2 == 1:
            level = level + [level[-1]]
        if idx % 2 == 0:
            proof.append({"hash": level[idx + 1], "left": False})
        else:
            proof.append({"hash": level[idx - 1], "left": True})
        level = [node_hash(level[i], level[i + 1]) for i in range(0, len(level), 2)]
        idx //= 2
    return proof


def merkle_root_from_proof(data: bytes, proof: list[dict[str, Any]]) -> bytes:
    h = leaf_hash(data)
    for step in proof:
        sib = step["hash"]
        if not isinstance(sib, (bytes, bytearray)) or len(sib) != 32:
            raise ProofError("merkle sibling is not 32 bytes")
        if step["left"]:
            h = node_hash(bytes(sib), h)
        else:
            h = node_hash(h, bytes(sib))
    return h


# Published shred Merkle prefixes (ledger/src/shred/merkle_tree.rs).
SHRED_LEAF_PREFIX = b"\x00SOLANA_MERKLE_SHREDS_LEAF"
SHRED_NODE_PREFIX = b"\x01SOLANA_MERKLE_SHREDS_NODE"
SHRED_PROOF_ENTRY_LEN = 20


def entry_signature_leaf(signature: bytes, tx_id: bytes) -> bytes:
    """Published entry leaf data: the signature bytes themselves.

    entry.rs hash_signatures feeds each signature to MerkleTree::new. The tx id
    is that first signature. Account keys are not part of this leaf.
    """
    if len(signature) != 64 or len(tx_id) != 64 or signature != tx_id:
        raise ProofError("tx id is not the transaction signature")
    return signature


def shred_leaf_hash(shred_node: bytes) -> bytes:
    """get_merkle_node: hashv(&[MERKLE_HASH_PREFIX_LEAF, node])."""
    if not shred_node:
        raise ProofError("empty shred node")
    return sha256(SHRED_LEAF_PREFIX + shred_node)


def shred_join(left: bytes, right: bytes) -> bytes:
    """join_nodes truncates each hash to a 20-byte MerkleProofEntry."""
    if len(left) < SHRED_PROOF_ENTRY_LEN or len(right) < SHRED_PROOF_ENTRY_LEN:
        raise ProofError("shred merkle node is shorter than 20 bytes")
    return sha256(
        SHRED_NODE_PREFIX + left[:SHRED_PROOF_ENTRY_LEN] + right[:SHRED_PROOF_ENTRY_LEN]
    )


def shred_root_from_proof(shred_node: bytes, proof: list[dict[str, Any]]) -> bytes:
    h = shred_leaf_hash(shred_node)
    for step in proof:
        sib = step["hash"]
        if step["left"]:
            h = shred_join(sib, h)
        else:
            h = shred_join(h, sib)
    return h


def compute_bank_hash(
    parent_hash: bytes,
    accounts_delta_hash: bytes,
    signature_count: int,
    latest_blockhash: bytes,
) -> bytes:
    """hashv(&[parent_hash, accounts_delta_hash, signature_count_le, last_blockhash]).

    No domain string, slot, or block-merkle root. signature_count is u64 LE,
    matching LittleEndian::write_u64 in the cited bank.rs.
    """
    if type(signature_count) is not int or signature_count < 0 or signature_count >= 2**64:
        raise ProofError("signature count is not a u64")
    for name, val in (
        ("parent_hash", parent_hash),
        ("accounts_delta_hash", accounts_delta_hash),
        ("latest_blockhash", latest_blockhash),
    ):
        if len(val) != 32:
            raise ProofError(f"{name} is not 32 bytes")
    return sha256(
        parent_hash
        + accounts_delta_hash
        + signature_count.to_bytes(8, "little")
        + latest_blockhash
    )


def _u64(name: str, value: Any) -> int:
    if type(value) is not int or value < 0 or value >= 2**64:
        raise ProofError(f"{name} is not a u64")
    return value


def _bytes32(name: str, value: Any) -> bytes:
    if not isinstance(value, (bytes, bytearray)) or len(value) != 32:
        raise ProofError(f"{name} is not 32 bytes")
    return bytes(value)


def _proof_steps(name: str, steps: Any) -> list[dict[str, Any]]:
    if not isinstance(steps, list):
        raise ProofError(f"{name} is not a list")
    out = []
    for step in steps:
        if not isinstance(step, dict) or "hash" not in step or "left" not in step:
            raise ProofError(f"{name} step is malformed")
        if type(step["left"]) is not bool:
            raise ProofError(f"{name} step side is not a bool")
        out.append({"hash": _bytes32(name, step["hash"]), "left": step["left"]})
    return out


def _shred_proof_steps(steps: Any) -> list[dict[str, Any]]:
    if not isinstance(steps, list):
        raise ProofError("shred proof is not a list")
    out = []
    for step in steps:
        if not isinstance(step, dict) or "hash" not in step or "left" not in step:
            raise ProofError("shred proof step is malformed")
        if type(step["left"]) is not bool:
            raise ProofError("shred proof step side is not a bool")
        sib = step["hash"]
        if not isinstance(sib, (bytes, bytearray)) or len(sib) != SHRED_PROOF_ENTRY_LEN:
            raise ProofError("shred proof entry is not 20 bytes")
        out.append({"hash": bytes(sib), "left": step["left"]})
    return out


def _header_chain_links(proof_slot: int, proof_bank: bytes, vote: dict[str, Any]) -> bool:
    """True when vote roots a descendant bank and each header recomputes."""
    chain = vote.get("header_chain") or []
    if not isinstance(chain, list) or not chain:
        return False
    parent_slot = proof_slot
    parent_bank = proof_bank
    for header in chain:
        if not isinstance(header, dict):
            return False
        try:
            slot = _u64("header.slot", header["slot"])
            claimed_parent_slot = _u64("header.parent_slot", header["parent_slot"])
            claimed_parent_bank = _bytes32("header.parent_bank_hash", header["parent_bank_hash"])
            bank = compute_bank_hash(
                claimed_parent_bank,
                _bytes32("header.accounts_delta_hash", header["accounts_delta_hash"]),
                _u64("header.signature_count", header["signature_count"]),
                _bytes32("header.latest_blockhash", header["latest_blockhash"]),
            )
        except (KeyError, ProofError):
            return False
        if claimed_parent_slot != parent_slot or claimed_parent_bank != parent_bank:
            return False
        if slot <= parent_slot:
            return False
        if header.get("bank_hash") is not None:
            try:
                if _bytes32("header.bank_hash", header["bank_hash"]) != bank:
                    return False
            except ProofError:
                return False
        parent_slot = slot
        parent_bank = bank
    root_slot = vote.get("root_slot")
    if type(root_slot) is not int or root_slot != parent_slot:
        return False
    try:
        vote_bank = _bytes32("vote.bank_hash", vote["bank_hash"])
    except (KeyError, ProofError):
        return False
    return vote_bank == parent_bank and root_slot > proof_slot


def _vote_covers(slot: int, bank: bytes, vote: dict[str, Any]) -> bool:
    """Root or max lockout must cover the slot. Confirmed-only votes do not."""
    try:
        vote_bank = _bytes32("vote.bank_hash", vote["bank_hash"])
    except (KeyError, ProofError):
        raise ProofError("vote missing bank hash")
    same_bank = vote_bank == bank
    root_slot = vote.get("root_slot")
    rooted_here = same_bank and type(root_slot) is int and root_slot == slot
    rooted_descendant = _header_chain_links(slot, bank, vote)
    if rooted_here or rooted_descendant:
        return True
    lockouts = vote.get("lockouts") or []
    if not isinstance(lockouts, list):
        raise ProofError("vote lockouts malformed")
    for lockout in lockouts:
        if not isinstance(lockout, dict):
            raise ProofError("vote lockout malformed")
        lo_slot = _u64("lockout.slot", lockout.get("slot"))
        count = _u64("lockout.confirmation_count", lockout.get("confirmation_count"))
        # Maximum lockout on this slot roots it. Lesser counts are only
        # optimistic confirmation ("confirmed"), which is not finality.
        if same_bank and lo_slot == slot and count >= MAX_LOCKOUT_CONFIRMATIONS:
            return True
    return False


def check_proof(proof: Any) -> None:
    """Raise ProofError if `proof` is not a finalized-slot proof. Return None."""
    if not isinstance(proof, dict) or not proof:
        raise ProofError("empty proof")

    required = (
        "slot",
        "bank_hash",
        "inclusion",
        "total_stake",
        "stake_set",
        "votes",
    )
    if any(k not in proof or proof[k] in (None, "", [], {}) for k in required):
        raise ProofError("empty proof")

    slot = _u64("slot", proof["slot"])
    inclusion = proof["inclusion"]
    if not isinstance(inclusion, dict):
        raise ProofError("empty proof")
    kind = inclusion.get("kind")
    if kind not in KINDS:
        raise ProofError("unknown inclusion kind")

    try:
        signature = bytes(inclusion["signature"])
        tx_id = bytes(inclusion["tx_id"])
        account_keys = [bytes(k) for k in inclusion["account_keys"]]
    except (KeyError, TypeError):
        raise ProofError("inclusion is missing the lock transaction")
    if not account_keys or any(len(k) != 32 for k in account_keys):
        raise ProofError("account keys must be non-empty 32-byte pubkeys")
    # Account keys identify the lock tx in the proof. They are not hashed:
    # the published entry leaf is only the signature.
    entry_signature_leaf(signature, tx_id)

    if kind == KIND_ENTRY:
        if "level1_proof" not in inclusion:
            raise ProofError("missing merkle inclusion")
        level1 = _proof_steps("level1_proof", inclusion.get("level1_proof"))
        entry_root = merkle_root_from_proof(signature, level1)
        claimed_entry = _bytes32("entry_merkle_root", inclusion.get("entry_merkle_root"))
        if claimed_entry != entry_root:
            raise ProofError("transaction is not in the block")
    else:
        shred_node = inclusion.get("shred_node")
        if not isinstance(shred_node, (bytes, bytearray)) or not shred_node:
            raise ProofError("missing merkle inclusion")
        if "shred_proof" not in inclusion:
            raise ProofError("missing merkle inclusion")
        shred_node = bytes(shred_node)
        if signature not in shred_node:
            raise ProofError("transaction is not in the block")
        shred_proof = _shred_proof_steps(inclusion.get("shred_proof"))
        shred_root = shred_root_from_proof(shred_node, shred_proof)
        claimed_shred = _bytes32("shred_merkle_root", inclusion.get("shred_merkle_root"))
        if claimed_shred != shred_root:
            raise ProofError("transaction is not in the block")

    parent = _bytes32("parent_hash", inclusion.get("parent_hash"))
    accounts = _bytes32("accounts_delta_hash", inclusion.get("accounts_delta_hash"))
    sig_count = _u64("signature_count", inclusion.get("signature_count"))
    blockhash = _bytes32("latest_blockhash", inclusion.get("latest_blockhash"))
    expected_bank = compute_bank_hash(parent, accounts, sig_count, blockhash)
    if _bytes32("bank_hash", proof["bank_hash"]) != expected_bank:
        raise ProofError("bank hash does not match inclusion")

    stake_set = proof["stake_set"]
    votes = proof["votes"]
    if not isinstance(stake_set, list) or not isinstance(votes, list):
        raise ProofError("empty proof")
    if not stake_set or not votes:
        raise ProofError("empty proof")

    weights: dict[bytes, int] = {}
    total = 0
    for entry in stake_set:
        if not isinstance(entry, dict):
            raise ProofError("stake set entry malformed")
        pubkey = _bytes32("stake pubkey", entry.get("pubkey"))
        stake = _u64("stake", entry.get("stake"))
        if stake == 0:
            raise ProofError("stake set contains zero stake")
        if pubkey in weights:
            raise ProofError("duplicate stake pubkey")
        weights[pubkey] = stake
        total += stake
    if _u64("total_stake", proof["total_stake"]) != total:
        raise ProofError("total stake does not match stake set")

    seen: set[bytes] = set()
    counted = 0
    for vote in votes:
        if not isinstance(vote, dict):
            raise ProofError("vote malformed")
        pubkey = _bytes32("vote pubkey", vote.get("pubkey"))
        if pubkey not in weights:
            raise ProofError("vote pubkey is not in the stake set")
        if pubkey in seen:
            # Gossip and replay must not both be counted. A second copy of the
            # same vote account is duplicate confirmation, not more stake.
            raise ProofError("duplicate confirmation")
        seen.add(pubkey)
        if "stake" in vote and vote["stake"] is not None:
            if _u64("vote.stake", vote["stake"]) != weights[pubkey]:
                raise ProofError("vote stake does not match stake set")
        if _vote_covers(slot, expected_bank, vote):
            counted += weights[pubkey]

    # Supermajority: counted stake >= 2/3 of total stake (integer).
    if counted * 3 < total * 2:
        raise ProofError("stake below 2/3 or votes do not root the slot")


def accepted(proof: Any) -> bool:
    try:
        check_proof(proof)
    except ProofError:
        return False
    return True


def flip_bit(buf: bytes, bit_index: int = 0) -> bytes:
    if not buf:
        raise ProofError("nothing to flip")
    out = bytearray(buf)
    byte_i = bit_index // 8
    if byte_i >= len(out):
        raise ProofError("bit index out of range")
    out[byte_i] ^= 1 << (bit_index % 8)
    return bytes(out)
