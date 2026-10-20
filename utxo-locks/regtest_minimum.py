"""Regtest check of the minimum lock sizes (operator t230u) on real nodes.

LOCAL REGTEST ONLY. Starts throwaway regtest nodes, never a public network.
Not part of the unittest run (it needs node binaries). Usage:

  BTC_BIN=/path/bitcoin-31.1/bin BCH_BIN=/path/bitcoin-cash-node-29.2.0/bin \
  LTC_BIN=/path/litecoin-0.21.4/bin python3 utxo-locks/regtest_minimum.py

For each of Bitcoin, Bitcoin Cash and Litecoin, with the fixture price below:
  1. lock.py refuses one unit under the minimum (LockRefused, nothing built).
  2. A lock exactly at the minimum is built by LockFixture(gross=..., price),
     accepted by the node and mined; fee output is exactly floor(5%).
  3. Its release is refused before maturity, then accepted and mined after,
     paying a release fee at the stated rate.
  4. One unit under the dust floor (gross 20 x dust - 20), lock.py refuses,
     and the node itself rejects an exact-5% lock there as "dust".
Any failed check raises. Exit code 0 means every check passed.
"""
from __future__ import annotations

import hashlib, json, os, shutil, subprocess, sys, tempfile, time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from crypto import hash160
from lock import P2PKH_DUST_MINIMUM, LockFixture, LockRefused, lock_outputs, min_gross_for, split_outputs
from script import p2pkh_script
from tx import Tx, TxIn, TxOut, p2sh_script_sig, serialize, sign_input

# CoinGecko USD prices read 2026-10-20 11:35 AM ET (test inputs only).
PRICE = {"bitcoin": "82410", "bitcoin-cash": "276.28", "litecoin": "59.59"}
NOW = 1_792_510_532
RELEASE_RATE = {"bitcoin": 2, "bitcoin-cash": 1, "litecoin": 1}  # units per byte, current typical
CHAINS = {
    "bitcoin": dict(env="BTC_BIN", d="bitcoind", c="bitcoin-cli", rpc=28543),
    "bitcoin-cash": dict(env="BCH_BIN", d="bitcoind", c="bitcoin-cli", rpc=28553),
    "litecoin": dict(env="LTC_BIN", d="litecoind", c="litecoin-cli", rpc=28563),
}


def b58check(payload: bytes) -> str:
    alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
    raw = payload + hashlib.sha256(hashlib.sha256(payload).digest()).digest()[:4]
    n, s = int.from_bytes(raw, "big"), ""
    while n:
        n, r = divmod(n, 58)
        s = alphabet[r] + s
    return "1" * (len(raw) - len(raw.lstrip(b"\0"))) + s


class Node:
    def __init__(self, chain: str):
        c = CHAINS[chain]
        bindir = os.environ.get(c["env"])
        if not bindir:
            raise RuntimeError(f"set {c['env']} to the {chain} node bin directory")
        self.chain, self.bin, self.c = chain, bindir, c
        self.dir = tempfile.mkdtemp(prefix=f"vf-regtest-{chain}-")
        subprocess.run([f"{bindir}/{c['d']}", "-regtest", f"-datadir={self.dir}", "-daemon", "-server", "-listen=0",
                        f"-rpcport={c['rpc']}", "-rpcuser=u", "-rpcpassword=p", "-fallbackfee=0.0002"],
                       check=True, capture_output=True)
        for _ in range(120):
            try:
                self.cli("getblockchaininfo")
                return
            except RuntimeError:
                time.sleep(0.5)
        raise RuntimeError(f"{chain} regtest node did not start")

    def cli(self, *args, wallet=None):
        cmd = [f"{self.bin}/{self.c['c']}", "-regtest", f"-datadir={self.dir}", f"-rpcport={self.c['rpc']}",
               "-rpcuser=u", "-rpcpassword=p"] + ([f"-rpcwallet={wallet}"] if wallet else []) + [str(a) for a in args]
        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.returncode:
            raise RuntimeError(r.stderr.strip())
        try:
            return json.loads(r.stdout)
        except ValueError:
            return r.stdout.strip()

    def mine(self, n=1):
        self.cli("generatetoaddress", n, self.cli("getnewaddress", wallet="w"))

    def accept(self, tx) -> tuple[bool, str]:
        r = self.cli("testmempoolaccept", json.dumps([serialize(tx).hex()]))[0]
        return r.get("allowed", False), r.get("reject-reason", "")

    def stop(self):
        try:
            self.cli("stop")
            time.sleep(1)
        finally:
            shutil.rmtree(self.dir, ignore_errors=True)


def fund(node: Node, fx: LockFixture, value: int) -> None:
    addr = b58check(bytes([0x6F]) + hash160(fx.funding_key.pubkey))  # regtest P2PKH
    txid = node.cli("sendtoaddress", addr, f"{value / 1e8:.8f}", wallet="w")
    dec = node.cli("decoderawtransaction", node.cli("gettransaction", txid, wallet="w")["hex"])
    fx.funding_txid = bytes.fromhex(txid)[::-1]
    fx.funding_vout = next(o["n"] for o in dec["vout"] if round(o["value"] * 1e8) == value)
    fx.funding_output = TxOut(value, p2pkh_script(fx.funding_key.pubkey))
    node.mine(1)


def release_tx(fx: LockFixture, lock_txid: bytes, out_value: int) -> Tx:
    t = Tx(chain=fx.chain, version=2, inputs=[TxIn(lock_txid, 1, b"", 0xFFFFFFFE)],
           outputs=[TxOut(out_value, p2pkh_script(fx.release_key.pubkey))], locktime=fx.maturity)
    sig = sign_input(t, 0, fx.release_key, TxOut(fx.principal, fx.principal_script), fx.redeem_script)
    t.inputs[0].script_sig = p2sh_script_sig(sig, fx.redeem_script)
    return t


def check(cond: bool, msg: str) -> None:
    if not cond:
        raise AssertionError(msg)
    print("  ok:", msg)


def run(chain: str) -> None:
    price, dust = PRICE[chain], P2PKH_DUST_MINIMUM[chain]
    node = Node(chain)
    try:
        node.cli("createwallet", "w")
        node.mine(150)
        lock_fee = 20_000 if chain == "litecoin" else 2_000  # lock tx network fee, funded on top
        g = min_gross_for(chain, price)
        print(f"{chain}: minimum gross {g} at ${price}")
        # 1. one unit under the minimum: refused before anything is built
        try:
            LockFixture(chain, 10, gross=g - 1, price_usd=price, price_as_of=NOW, now=NOW)
        except LockRefused as e:
            check("under the" in str(e), f"{g - 1} refused by lock.py: {e}")
        else:
            raise AssertionError("lock under the minimum was built")
        # 2. exactly at the minimum
        maturity = node.cli("getblockcount") + 40
        fx = LockFixture(chain, maturity, gross=g, price_usd=price, price_as_of=NOW, now=NOW)
        check(fx.fee_output == g * 500 // 10_000 and fx.principal == g - fx.fee_output, f"fee {fx.fee_output} is exactly floor(5%) of {g}")
        fund(node, fx, fx.funding_value + lock_fee)
        lock = fx.lock_transaction()
        ok, why = node.accept(lock)
        check(ok, f"node accepts the lock at the minimum ({why or 'allowed'})")
        node.cli("sendrawtransaction", serialize(lock).hex())
        node.mine(1)
        lock_txid = lock.txid()
        # 3. release: refused early, accepted after maturity
        # +2: a DER signature can be one byte longer than the probe's
        size = len(serialize(release_tx(fx, lock_txid, fx.principal - 1))) + 2
        out = fx.principal - RELEASE_RATE[chain] * size
        ok, why = node.accept(release_tx(fx, lock_txid, out))
        check(not ok and "final" in why, f"release before maturity refused ({why})")
        node.mine(maturity - node.cli("getblockcount"))
        rel = release_tx(fx, lock_txid, out)
        ok, why = node.accept(rel)
        check(ok, f"release after maturity accepted ({why or 'allowed'}): {size} bytes, fee {RELEASE_RATE[chain] * size}, pays {out}")
        node.cli("sendrawtransaction", serialize(rel).hex())
        node.mine(1)
        check(node.cli("getmempoolinfo")["size"] == 0, "release mined")
        # 4. just under the dust floor
        below = 20 * dust - 20
        try:
            split_outputs(chain, below)
        except LockRefused as e:
            check(True, f"lock.py refuses gross {below} (5% = {dust - 1}): {e}")
        else:
            raise AssertionError("dust-raised split still produced on " + chain)
        raw = LockFixture(chain, maturity + 50)
        fee = below * 500 // 10_000
        raw.fee_output, raw.principal, raw.funding_value = fee, below - fee, below
        fund(node, raw, below + lock_fee)
        ok, why = node.accept(raw.lock_transaction())
        check(not ok and "dust" in why, f"node rejects an exact-5% lock with a {fee}-unit fee output ({why})")
    finally:
        node.stop()


if __name__ == "__main__":
    for c in CHAINS:
        run(c)
    print("all regtest minimum-lock checks passed")
