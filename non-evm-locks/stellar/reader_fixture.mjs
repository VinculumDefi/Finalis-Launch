/**
 * Stellar reader fixture (test only, local standalone stellar-core).
 *
 * Runs stellar-core in standalone MANUAL_CLOSE mode on a fresh, generated
 * node key, upgrades to protocol 22 (generalized transaction sets, the
 * current network format), and makes real Commitment Vault locks: one
 * transaction with a native Payment of 5% to the Dev Fund and a
 * CreateClaimableBalance of the principal (sole claimant = release account,
 * predicate NOT(BEFORE_ABSOLUTE_TIME(maturity))), memo hash = SHA-256 of the
 * 117-byte payload. Writes, per lock ledger: the LedgerHeader XDR, the full
 * TransactionResultSet XDR of that ledger (its SHA-256 is the header's
 * txSetResultHash) and the lock's Transaction XDR. Accounts are generated.
 *
 * Usage: STELLAR_CORE_BIN=... STELLAR_CORE_LD=<lib dirs> node non-evm-locks/stellar/reader_fixture.mjs out.json
 */
import { spawn, execFileSync } from "child_process";
import crypto from "crypto";
import fs from "fs";
import { createRequire } from "module";

const require = createRequire(process.env.VF_JS_PACKAGE || "/tmp/vf-js/package.json");
const { Account, Asset, Claimant, Keypair, Memo, Networks, Operation, TransactionBuilder, StrKey, xdr } = require("@stellar/stellar-sdk");

const PASSPHRASE = Networks.TESTNET;
const BIN = process.env.STELLAR_CORE_BIN;
// Library path for the stellar-core child only (not for node itself).
const CORE_ENV = { ...process.env, LD_LIBRARY_PATH: process.env.STELLAR_CORE_LD || "" };
const HOME = "/tmp/vf-stellar-reader";
const PORT = 11639;
const BASE = "http://127.0.0.1:" + PORT;
const META = HOME + "/meta.xdr";
const OUT = process.argv[2];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const get = async (p) => (await fetch(BASE + p)).text();
const sha256 = (b) => crypto.createHash("sha256").update(b).digest();

async function closeLedger(target) {
  const now = Number(/now=(\d+)/.exec(await get("/manualclose?closeTime=1"))[1]);
  const t = await get("/manualclose?closeTime=" + Math.max(now + 3_000_000, target || 0));
  if (!t.startsWith("Manually closed")) throw new Error("close failed " + t);
  return JSON.parse(await get("/info")).info.ledger;
}

function readMeta() {
  const buf = fs.readFileSync(META);
  const out = new Map();
  let o = 0;
  while (o + 4 <= buf.length) {
    const n = buf.readUInt32BE(o) & 0x7fffffff;
    if (o + 4 + n > buf.length) break;
    const m = xdr.LedgerCloseMeta.fromXDR(buf.subarray(o + 4, o + 4 + n));
    const body = m.value();
    out.set(Number(body.ledgerHeader().header().ledgerSeq()), body);
    o += 4 + n;
  }
  return out;
}

async function main() {
  fs.rmSync(HOME, { recursive: true, force: true });
  fs.mkdirSync(HOME + "/buckets", { recursive: true });
  const node = Keypair.random();
  fs.writeFileSync(HOME + "/core.cfg", `
HTTP_PORT=${PORT}
PUBLIC_HTTP_PORT=false
NODE_SEED="${node.secret()}"
NODE_IS_VALIDATOR=true
NETWORK_PASSPHRASE="${PASSPHRASE}"
DATABASE="sqlite3://${HOME}/stellar.db"
BUCKET_DIR_PATH="${HOME}/buckets"
UNSAFE_QUORUM=true
FAILURE_SAFETY=0
RUN_STANDALONE=true
MANUAL_CLOSE=true
METADATA_OUTPUT_STREAM="${META}"
[QUORUM_SET]
THRESHOLD_PERCENT=100
VALIDATORS=["${node.publicKey()}"]
`);
  execFileSync(BIN, ["--conf", HOME + "/core.cfg", "new-db"], { stdio: "ignore", env: CORE_ENV });
  const child = spawn(BIN, ["--conf", HOME + "/core.cfg", "run"], { cwd: HOME, stdio: "ignore", env: CORE_ENV });
  try {
    for (let i = 0; i < 100; i++) { try { if ((await get("/info")).includes("ledger")) break; } catch (e) {} await sleep(200); }
    await closeLedger();
    await get("/upgrades?mode=set&upgradetime=1970-01-01T00:00:00Z&protocolversion=22");
    await closeLedger();
    await get("/upgrades?mode=clear");
    const info = JSON.parse(await get("/info")).info.ledger;
    if (Number(info.version) !== 22) throw new Error("protocol upgrade failed: " + info.version);

    const networkId = sha256(PASSPHRASE);
    const root = Keypair.fromRawEd25519Seed(networkId);
    const [source, devFund, release, other] = [0, 1, 2, 3].map(() => Keypair.random());
    const seqs = new Map();
    const build = (kp, ops, memoHash, seq) => {
      let b = new TransactionBuilder(new Account(kp.publicKey(), seq), { fee: "1000", networkPassphrase: PASSPHRASE });
      for (const op of ops) b = b.addOperation(op);
      if (memoHash) b = b.addMemo(Memo.hash(memoHash.toString("hex")));
      const tx = b.setTimeout(0).build();
      tx.sign(kp);
      return tx;
    };
    const submit = async (tx) => {
      const r = JSON.parse(await get("/tx?blob=" + encodeURIComponent(tx.toEnvelope().toXDR("base64"))));
      if (r.status !== "PENDING") throw new Error("submit " + JSON.stringify(r));
    };
    const accSeq = async (pk) => {
      // created accounts start at (ledgerSeq << 32)
      return seqs.get(pk);
    };
    const fund = build(root, [source, devFund, release, other].map((k) =>
      Operation.createAccount({ destination: k.publicKey(), startingBalance: "10000" })), null, "0");
    await submit(fund);
    const fundLedger = await closeLedger();
    for (const k of [source, devFund, release, other]) seqs.set(k.publicKey(), String(BigInt(fundLedger.num) << 32n));

    const stroops = (n) => (n / 10_000_000n).toString() + "." + (n % 10_000_000n).toString().padStart(7, "0");
    const hexB = (b) => "0x" + Buffer.from(b).toString("hex");
    let srcSeq = BigInt(seqs.get(source.publicKey()));
    let othSeq = BigInt(seqs.get(other.publicKey()));

    async function lock(tag, gross, durationSecs, opt = {}) {
      const payload = Buffer.alloc(117);
      sha256("stellar-lock-" + tag).copy(payload, 0);
      Buffer.from("1234567890123456789012345678901234567890", "hex").copy(payload, 32);
      payload[52] = 0;
      sha256("native-XLM").copy(payload, 53);
      sha256("valuation-" + tag).copy(payload, 85);
      const memo = sha256(payload);
      const fee = opt.fee ?? (gross * 500n) / 10000n;
      const principal = gross - (gross * 500n) / 10000n;
      const now = Number(/now=(\d+)/.exec(await get("/manualclose?closeTime=1"))[1]);
      const closeAt = now + 6_000_000;
      const maturity = closeAt + durationSecs;
      const tx = build(source, [
        Operation.payment({ destination: (opt.payTo || devFund).publicKey(), asset: Asset.native(), amount: stroops(fee) }),
        Operation.createClaimableBalance({ asset: Asset.native(), amount: stroops(principal),
          claimants: [new Claimant(release.publicKey(), Claimant.predicateNot(Claimant.predicateBeforeAbsoluteTime(String(maturity))))] }),
      ], memo, String(srcSeq));
      srcSeq++;
      await submit(tx);
      // an unrelated payment in the same ledger, and (optionally) a failing one
      const noise = build(other, [Operation.payment({ destination: release.publicKey(), asset: Asset.native(), amount: "1.0000000" })], null, String(othSeq));
      othSeq++;
      await submit(noise);
      const L = await closeLedger(closeAt);
      const body = readMeta().get(Number(L.num));
      const header = body.ledgerHeader().header();
      const headerXdr = header.toXDR();
      if (!sha256(headerXdr).equals(Buffer.from(body.ledgerHeader().hash()))) throw new Error("header hash");
      const resultSet = new xdr.TransactionResultSet({ results: body.txProcessing().map((tp) => tp.result()) });
      const rsXdr = resultSet.toXDR();
      if (!sha256(rsXdr).equals(Buffer.from(header.txSetResultHash()))) throw new Error("txSetResultHash mismatch");
      const txHash = Buffer.from(tx.hash());
      const found = body.txProcessing().find((tp) => Buffer.from(tp.result().transactionHash()).equals(txHash));
      if (!found) throw new Error("lock not in ledger");
      const code = found.result().result().result().switch().name;
      return {
        ledgerHash: hexB(body.ledgerHeader().hash()), ledgerSeq: Number(L.num), header: hexB(headerXdr),
        resultSet: hexB(rsXdr), tx: hexB(tx.tx.toXDR()), txHash: hexB(txHash), resultCode: code,
        noiseTx: hexB(noise.tx.toXDR()),
        payload: hexB(payload), durationSecs, gross: gross.toString(), fee: fee.toString(), principal: principal.toString(),
        closeTime: Number(header.scpValue().closeTime()), maturity,
      };
    }

    const out = {
      note: "Local standalone stellar-core 22.4.1, protocol 22, generated accounts and node key; test only.",
      networkId: "0x" + networkId.toString("hex"),
      devFund: "0x" + Buffer.from(StrKey.decodeEd25519PublicKey(devFund.publicKey())).toString("hex"),
      release: "0x" + Buffer.from(StrKey.decodeEd25519PublicKey(release.publicKey())).toString("hex"),
      week: await lock("week", 100_000_000n, 604800),
      handshake: await lock("hs", 10_000_000n, 3600),
      wrongFee: await lock("wrongfee", 100_000_000n, 604800, { fee: 4_000_000n }),
      wrongDevFund: await lock("wrongdev", 100_000_000n, 604800, { payTo: other }),
    };
    // a lock whose claimable balance fails (principal above balance): tx in ledger, result txFAILED
    out.failed = await lock("failed", 1_000_000_000_000n, 604800);
    fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
    console.log("wrote", OUT, [out.week, out.handshake, out.failed].map((l) => l.resultCode));
  } finally {
    child.kill("SIGTERM");
  }
}
main().catch((e) => { console.error(e.stack || e); process.exit(1); });
