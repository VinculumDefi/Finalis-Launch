"""Bitcoin-family script codec and a real stack interpreter.

The interpreter executes the opcodes. OP_CHECKLOCKTIMEVERIFY applies BIP 65
against the spending transaction's nLockTime and nSequence. OP_CHECKSIG
verifies a low-S DER secp256k1 signature over the chain's sighash.
"""

from __future__ import annotations

from crypto import hash160, verify_digest

OP_0 = 0x00
OP_PUSHDATA1 = 0x4C
OP_PUSHDATA2 = 0x4D
OP_DUP = 0x76
OP_DROP = 0x75
OP_EQUAL = 0x87
OP_EQUALVERIFY = 0x88
OP_SHA256 = 0xA8
OP_HASH160 = 0xA9
OP_CHECKSIG = 0xAC
OP_CHECKLOCKTIMEVERIFY = 0xB1
OP_RETURN = 0x6A

LOCKTIME_THRESHOLD = 500_000_000
SEQUENCE_FINAL = 0xFFFFFFFF


class ScriptError(Exception):
    """A consensus-style script or transaction-check failure. Never a skip."""


def push_data(data: bytes) -> bytes:
    n = len(data)
    if n < 0x4C:
        return bytes([n]) + data
    if n <= 0xFF:
        return bytes([OP_PUSHDATA1, n]) + data
    if n <= 0xFFFF:
        return bytes([OP_PUSHDATA2]) + n.to_bytes(2, "little") + data
    raise ScriptError("push too large")


def encode_script_num(value: int) -> bytes:
    if value == 0:
        return b""
    negative = value < 0
    absolute = abs(value)
    out = bytearray()
    while absolute:
        out.append(absolute & 0xFF)
        absolute >>= 8
    if out[-1] & 0x80:
        out.append(0x80 if negative else 0x00)
    elif negative:
        out[-1] |= 0x80
    return bytes(out)


def decode_script_num(raw: bytes, *, max_len: int = 5) -> int:
    if len(raw) > max_len:
        raise ScriptError("script number longer than allowed")
    if raw:
        # Minimal encoding, matching Bitcoin's REQUIRE_MINIMAL.
        if raw[-1] & 0x7F == 0 and (len(raw) <= 1 or raw[-2] & 0x80 == 0):
            raise ScriptError("non-minimal script number")
    result = 0
    for i, byte in enumerate(raw):
        result |= byte << (8 * i)
    if raw and raw[-1] & 0x80:
        result &= ~(0x80 << (8 * (len(raw) - 1)))
        return -result
    return result


def p2pkh_script(pubkey: bytes) -> bytes:
    return bytes([OP_DUP, OP_HASH160]) + push_data(hash160(pubkey)) + bytes([OP_EQUALVERIFY, OP_CHECKSIG])


def p2sh_script(redeem_script: bytes) -> bytes:
    return bytes([OP_HASH160]) + push_data(hash160(redeem_script)) + bytes([OP_EQUAL])


def cltv_redeem_script(locktime: int, pubkey: bytes) -> bytes:
    """Single-key maturity script. No alternate spend path."""
    if locktime < 0 or locktime >= LOCKTIME_THRESHOLD:
        raise ScriptError("fixture locktime must be a block height below the timestamp threshold")
    if len(pubkey) != 33:
        raise ScriptError("release pubkey must be one compressed key")
    return (
        push_data(encode_script_num(locktime))
        + bytes([OP_CHECKLOCKTIMEVERIFY, OP_DROP])
        + push_data(pubkey)
        + bytes([OP_CHECKSIG])
    )


def op_return_script(payload: bytes) -> bytes:
    return bytes([OP_RETURN]) + push_data(payload)


def parse_pushes(script: bytes):
    """Yield (opcode, data, raw_bytes) for each instruction."""
    i = 0
    n = len(script)
    while i < n:
        op = script[i]
        if op == 0:
            yield op, b"", script[i : i + 1]
            i += 1
        elif op < 0x4C:
            data = script[i + 1 : i + 1 + op]
            if len(data) != op:
                raise ScriptError("truncated push")
            raw = script[i : i + 1 + op]
            yield op, data, raw
            i += 1 + op
        elif op == OP_PUSHDATA1:
            if i + 2 > n:
                raise ScriptError("truncated PUSHDATA1")
            length = script[i + 1]
            data = script[i + 2 : i + 2 + length]
            if len(data) != length:
                raise ScriptError("truncated PUSHDATA1 data")
            raw = script[i : i + 2 + length]
            yield op, data, raw
            i += 2 + length
        elif op == OP_PUSHDATA2:
            if i + 3 > n:
                raise ScriptError("truncated PUSHDATA2")
            length = int.from_bytes(script[i + 1 : i + 3], "little")
            data = script[i + 3 : i + 3 + length]
            if len(data) != length:
                raise ScriptError("truncated PUSHDATA2 data")
            raw = script[i : i + 3 + length]
            yield op, data, raw
            i += 3 + length
        else:
            yield op, None, script[i : i + 1]
            i += 1


def is_push_only(script: bytes) -> bool:
    for op, _data, _raw in parse_pushes(script):
        if op > OP_PUSHDATA2:
            return False
    return True


def find_and_delete(script: bytes, item: bytes) -> bytes:
    """Remove every occurrence of the Bitcoin push-encoding of item."""
    needle = push_data(item)
    out = bytearray()
    i = 0
    while i < len(script):
        if script.startswith(needle, i):
            i += len(needle)
            continue
        out.append(script[i])
        i += 1
    return bytes(out)


def _cast_bool(item: bytes) -> bool:
    for i, byte in enumerate(item):
        if byte != 0:
            if i == len(item) - 1 and byte == 0x80:
                return False
            return True
    return False


def _eval(script: bytes, stack: list[bytes], ctx, script_code: bytes) -> None:
    for op, data, raw in parse_pushes(script):
        if data is not None:
            stack.append(data)
            continue
        if op == OP_DUP:
            if not stack:
                raise ScriptError("OP_DUP on empty stack")
            stack.append(stack[-1])
        elif op == OP_DROP:
            if not stack:
                raise ScriptError("OP_DROP on empty stack")
            stack.pop()
        elif op == OP_HASH160:
            if not stack:
                raise ScriptError("OP_HASH160 on empty stack")
            stack.append(hash160(stack.pop()))
        elif op == OP_SHA256:
            if not stack:
                raise ScriptError("OP_SHA256 on empty stack")
            from crypto import sha256
            stack.append(sha256(stack.pop()))
        elif op == OP_EQUAL or op == OP_EQUALVERIFY:
            if len(stack) < 2:
                raise ScriptError("OP_EQUAL on a short stack")
            a = stack.pop()
            b = stack.pop()
            equal = a == b
            if op == OP_EQUALVERIFY:
                if not equal:
                    raise ScriptError("OP_EQUALVERIFY failed")
            else:
                stack.append(b"\x01" if equal else b"")
        elif op == OP_CHECKLOCKTIMEVERIFY:
            _checklocktimeverify(stack, ctx)
        elif op == OP_CHECKSIG:
            _checksig(stack, ctx, script_code)
        elif op == OP_RETURN:
            raise ScriptError("OP_RETURN executed")
        else:
            raise ScriptError(f"opcode {op:#x} is not executed by this checker")


def _checklocktimeverify(stack: list[bytes], ctx) -> None:
    if not stack:
        raise ScriptError("CLTV on empty stack")
    locktime = decode_script_num(stack[-1], max_len=5)
    if locktime < 0:
        raise ScriptError("CLTV negative locktime")
    tx_lock = ctx.tx.locktime
    if (locktime < LOCKTIME_THRESHOLD) != (tx_lock < LOCKTIME_THRESHOLD):
        raise ScriptError("CLTV locktime type mismatch")
    if tx_lock < locktime:
        raise ScriptError("CLTV not met: spending nLockTime is before maturity")
    sequence = ctx.tx.inputs[ctx.input_index].sequence
    if sequence == SEQUENCE_FINAL:
        raise ScriptError("CLTV disabled by final nSequence")
    # BIP 65 leaves the operand on the stack.


def _checksig(stack: list[bytes], ctx, script_code: bytes) -> None:
    if len(stack) < 2:
        raise ScriptError("OP_CHECKSIG on a short stack")
    pubkey = stack.pop()
    signature = stack.pop()
    if signature == b"":
        stack.append(b"")
        return
    if len(signature) < 2:
        raise ScriptError("CHECKSIG signature too short")
    hash_type = signature[-1]
    der = signature[:-1]
    subscript = find_and_delete(script_code, signature)
    digest = ctx.sighash(ctx.input_index, subscript, hash_type)
    if not verify_digest(pubkey, der, digest):
        raise ScriptError("CHECKSIG failed")
    stack.append(b"\x01")


def verify_script(script_sig: bytes, script_pubkey: bytes, ctx) -> None:
    """Run scriptSig, scriptPubKey, and the P2SH redeem script if present.

    Success is a single true stack element. Any failed check raises ScriptError.
    """
    if not is_push_only(script_sig):
        raise ScriptError("scriptSig is not push-only")
    stack: list[bytes] = []
    _eval(script_sig, stack, ctx, script_sig)
    stack_copy = list(stack)
    _eval(script_pubkey, stack, ctx, script_pubkey)
    if not stack or not _cast_bool(stack[-1]):
        raise ScriptError("scriptPubKey evaluated false")
    if _is_p2sh(script_pubkey):
        if not stack_copy:
            raise ScriptError("P2SH missing redeem script")
        redeem = stack_copy.pop()
        _eval(redeem, stack_copy, ctx, redeem)
        if not stack_copy or not _cast_bool(stack_copy[-1]):
            raise ScriptError("redeem script evaluated false")
        if len(stack_copy) != 1:
            raise ScriptError("clean-stack rule failed")
        return
    if len(stack) != 1 or not _cast_bool(stack[-1]):
        raise ScriptError("clean-stack rule failed")


def _is_p2sh(script_pubkey: bytes) -> bool:
    return (
        len(script_pubkey) == 23
        and script_pubkey[0] == OP_HASH160
        and script_pubkey[1] == 0x14
        and script_pubkey[-1] == OP_EQUAL
    )


def assert_cltv_redeem(redeem: bytes, pubkey: bytes, locktime: int) -> None:
    """The redeem script is exactly CLTV, DROP, one pubkey, CHECKSIG."""
    expected = cltv_redeem_script(locktime, pubkey)
    if redeem != expected:
        raise ScriptError("principal redeem script is not the single-key CLTV form")
    ops = [op for op, _data, _raw in parse_pushes(redeem)]
    if OP_CHECKLOCKTIMEVERIFY not in ops or OP_DROP not in ops or OP_CHECKSIG not in ops:
        raise ScriptError("missing CLTV path opcode")
    if any(op in (0x63, 0x64, 0x67, 0x68, 0x69, 0x6A) for op in ops):
        raise ScriptError("principal script has a second path or OP_RETURN")
