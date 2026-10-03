"""secp256k1 keys and Bitcoin-style hashes. Fresh keys only; no addresses."""

from __future__ import annotations

import hashlib

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.utils import (
    Prehashed,
    decode_dss_signature,
    encode_dss_signature,
)

SECP256K1_N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141


def sha256(data: bytes) -> bytes:
    return hashlib.sha256(data).digest()


def hash256(data: bytes) -> bytes:
    return sha256(sha256(data))


def hash160(data: bytes) -> bytes:
    return hashlib.new("ripemd160", sha256(data)).digest()


def blake2b_personal(person: bytes, data: bytes) -> bytes:
    if len(person) != 16:
        raise ValueError(f"BLAKE2b personalization must be 16 bytes, got {len(person)}")
    return hashlib.blake2b(data, digest_size=32, person=person).digest()


class FixtureKey:
    """A freshly generated test key. Not a published address."""

    def __init__(self, label: str):
        self.label = label
        self._priv = ec.generate_private_key(ec.SECP256K1())
        self.pubkey = self._priv.public_key().public_bytes(
            serialization.Encoding.X962,
            serialization.PublicFormat.CompressedPoint,
        )
        if len(self.pubkey) != 33 or self.pubkey[0] not in (2, 3):
            raise RuntimeError("expected a compressed fixture pubkey")

    def sign_digest(self, digest32: bytes) -> bytes:
        if len(digest32) != 32:
            raise ValueError("ECDSA digest must be 32 bytes")
        der = self._priv.sign(digest32, ec.ECDSA(Prehashed(hashes.SHA256())))
        r, s = decode_dss_signature(der)
        if s > SECP256K1_N // 2:
            s = SECP256K1_N - s
        return encode_dss_signature(r, s)


def verify_digest(pubkey: bytes, der_sig: bytes, digest32: bytes) -> bool:
    if len(digest32) != 32 or len(pubkey) != 33:
        return False
    try:
        pub = ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256K1(), pubkey)
        pub.verify(der_sig, digest32, ec.ECDSA(Prehashed(hashes.SHA256())))
        r, s = decode_dss_signature(der_sig)
    except Exception:
        return False
    return 1 <= r < SECP256K1_N and 1 <= s <= SECP256K1_N // 2
