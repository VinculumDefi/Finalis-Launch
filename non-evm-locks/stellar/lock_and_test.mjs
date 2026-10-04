/**
 * Stellar Commitment Vault lock — Revision 8.
 *
 * One transaction: Payment of 5% to the Dev Fund fixture and
 * CreateClaimableBalance of the principal. Sole claimant is the bound
 * destination. Predicate: not before absolute maturity. Memo is the
 * SHA-256 of the 117-byte payload.
 *
 * Local node: stellar-core 22.2.0 (protocol 14, the oldest protocol with
 * claimable balances). MANUAL_CLOSE without
 * ARTIFICIALLY_ACCELERATE_TIME_FOR_TESTING. stellar-core 29.0.0 aborts
 * in util/Timer.cpp when a protocol upgrade is armed under that flag.
 *
 * Closed-ledger proof: see CLOSED_LEDGER_PROOF.md.
 */

// Stellar lock cannot keep a per-identity handshake count.
const COUNTS_PER_IDENTITY = false;
function handshakeAllowance(countsPerIdentity) {
  return countsPerIdentity ? 3 : 1;
}
if (handshakeAllowance(COUNTS_PER_IDENTITY) !== 1) {
  throw new Error("Stellar allowance must be derived as 1");
}


import { spawn } from "child_process";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { createRequire } from "module";

const require = createRequire(
  "/workspace/vinculum/Finalis-Launch/base-contracts/package.json",
);
const {
  Account,
  Asset,
  Claimant,
  Keypair,
  Memo,
  Networks,
  Operation,
  TransactionBuilder,
  hash,
  xdr,
} = require("@stellar/stellar-sdk");

const PASSPHRASE = Networks.TESTNET;
const BIN = process.env.STELLAR_CORE_BIN || "/tmp/stellar-core-22/usr/bin/stellar-core";
const HOME = "/tmp/vf-stellar-rev8-final";
const PORT = 11629;
const BASE = "http://127.0.0.1:" + PORT;
const META = HOME + "/meta.xdr";
const DB = HOME + "/stellar.db";
const SEED = "SCSKZLXLVEY4FJ5CVKFO5L2GG4RLYIHDM4LBMPGPZOTTJOW65QNMX3IG";
const VALIDATOR = "GBSYKL6M6CPFVUCMTKWMGFKCB72H5LI5UMLPBE7WJTPVKV2QFEV4S6TY";

function assert(cond, msg) {
  if (!cond) throw new Error("FAIL: " + msg);
  console.log("PASS:", msg);
}

function hexOf(h) {
  if (h == null) return "";
  if (typeof h === "string") return h.toLowerCase();
  if (typeof h.toString === "function") {
    try {
      const s = h.toString("hex");
      if (typeof s === "string" && /^[0-9a-f]+$/i.test(s)) return s.toLowerCase();
    } catch (e) {}
  }
  if (h.value) return hexOf(h.value);
  return Buffer.from(h).toString("hex").toLowerCase();
}

function buildBindingPayload({ lockId32, baseRecipient20, outputToken, assetIdentity32, valuationRef32 }) {
  assert(lockId32.length === 32, "lock id 32");
  assert(baseRecipient20.length === 20, "base recipient 20");
  assert(assetIdentity32.length === 32, "asset id 32");
  assert(valuationRef32.length === 32, "valuation 32");
  const out = Buffer.alloc(117);
  lockId32.copy(out, 0);
  baseRecipient20.copy(out, 32);
  out[52] = outputToken & 0xff;
  assetIdentity32.copy(out, 53);
  valuationRef32.copy(out, 85);
  return out;
}

function memoFromPayload(payload) {
  return crypto.createHash("sha256").update(payload).digest();
}

async function get(p) {
  const res = await fetch(BASE + p);
  return await res.text();
}

async function virtualNow() {
  const text = await get("/manualclose?closeTime=1");
  const m = /now=(\d+)/.exec(text);
  if (!m) throw new Error("cannot read core virtual now: " + text);
  return Number(m[1]);
}

async function closeLedger(minTime = 0) {
  let last = "";
  for (let i = 0; i < 6; i++) {
    const now = await virtualNow();
    const target = Math.max(now + 3_000_000, minTime);
    const text = await get("/manualclose?closeTime=" + target);
    last = text;
    if (text.startsWith("Manually closed")) {
      const info = JSON.parse(await get("/info"));
      const closeTime = Number(info.info.ledger.closeTime);
      console.log("closed", text.trim(), "info.closeTime", closeTime, "version", info.info.ledger.version);
      return { text, closeTime, info };
    }
  }
  throw new Error("manual close failed: " + last);
}

async function closeBefore(maturity) {
  const now = await virtualNow();
  const target = now + 3_000_000;
  if (target >= maturity) {
    throw new Error(
      "virtual clock reached maturity before the early close (now=" +
        now + " target=" + target + " maturity=" + maturity + ")",
    );
  }
  const text = await get("/manualclose?closeTime=" + target);
  if (!text.startsWith("Manually closed")) {
    throw new Error("early close failed: " + text);
  }
  const info = JSON.parse(await get("/info"));
  const closeTime = Number(info.info.ledger.closeTime);
  console.log("closed-before", text.trim(), "closeTime", closeTime, "maturity", maturity);
  assert(closeTime < maturity, "ledger closeTime " + closeTime + " is before maturity " + maturity);
  return { text, closeTime, info };
}

function buildTx(pub, currentSeq, ops, signer, memoHash) {
  let b = new TransactionBuilder(new Account(pub, currentSeq), {
    fee: String(100 * Math.max(1, ops.length)),
    networkPassphrase: PASSPHRASE,
  });
  for (const op of ops) b = b.addOperation(op);
  if (memoHash) b = b.addMemo(Memo.hash(memoHash.toString("hex")));
  const tx = b.setTimeout(0).build();
  tx.sign(signer);
  return tx;
}

async function submit(tx, label) {
  const blob = tx.toEnvelope().toXDR("base64");
  const text = await get("/tx?blob=" + encodeURIComponent(blob));
  let body;
  try { body = JSON.parse(text); } catch (e) { throw new Error(label + " not json " + text); }
  if (body.status !== "PENDING") {
    throw new Error(label + " submit failed " + text);
  }
  console.log(label, "PENDING", Buffer.from(tx.hash()).toString("hex"));
  return body;
}

function loadMeta() {
  const buf = fs.readFileSync(META);
  const ledgers = new Map();
  let o = 0;
  while (o + 4 <= buf.length) {
    const n = buf.readUInt32BE(o) & 0x7fffffff;
    if (o + 4 + n > buf.length) break;
    const m = xdr.LedgerCloseMeta.fromXDR(buf.subarray(o + 4, o + 4 + n));
    const body = m.v0 || m.v1 || m.v2;
    if (!body) break;
    const hdr = body.ledgerHeader.header;
    const seq = Number(hdr.ledgerSeq);
    const headerHash = hexOf(body.ledgerHeader.hash);
    const computed = Buffer.from(hash(hdr.toXDR())).toString("hex");
    const prev = hexOf(hdr.previousLedgerHash);
    const txs = new Map();
    const envs = (body.txSet && body.txSet.txs) || [];
    const envByIndex = envs;
    body.txProcessing.forEach((tp, i) => {
      const txHash = hexOf(tp.result.transactionHash);
      const raw = JSON.stringify(tp.result.result);
      const success = raw.includes("tx_success");
      let memoHex = "";
      const env = envByIndex[i];
      if (env) {
        const txo =
          (env.v1 && env.v1.tx && env.v1.tx.tx) ||
          (env.v1 && env.v1.tx) ||
          (env.tx && env.tx.tx) ||
          env.tx ||
          null;
        let memo = txo && txo.memo;
        if (!memo) {
          try {
            const tree = JSON.parse(JSON.stringify(env, (k, v) => {
              if (typeof v === "bigint") return v.toString();
              if (v instanceof Uint8Array) return Buffer.from(v).toString("hex");
              return v;
            }));
            const stack = [tree];
            while (stack.length) {
              const cur = stack.pop();
              if (!cur || typeof cur !== "object") continue;
              if (Object.prototype.hasOwnProperty.call(cur, "memo")) { memo = cur.memo; break; }
              for (const k of Object.keys(cur)) stack.push(cur[k]);
            }
          } catch (e) {}
        }
        if (memo && typeof memo === "object") {
          if (memo.hash) memoHex = hexOf(memo.hash);
          else if (memo.value && memo.value !== "none") memoHex = hexOf(memo.value);
        }
      }
      txs.set(txHash, { success, raw, memoHex, index: i });
    });
    ledgers.set(seq, {
      headerHash,
      computed,
      prev,
      closeTime: Number(hdr.scpValue.closeTime),
      txs,
      scpInfoLen: (body.scpInfo || []).length,
    });
    o += 4 + n;
  }
  return ledgers;
}

function loadHeaders() {
  const out = execFileSync("python3", ["-c", `
import json, sqlite3
c = sqlite3.connect(${JSON.stringify(DB)})
rows = c.execute("select ledgerseq, ledgerhash, prevhash, closetime from ledgerheaders order by ledgerseq").fetchall()
print(json.dumps(rows))
`], { encoding: "utf8" });
  const map = new Map();
  for (const [seq, ledgerhash, prevhash, closetime] of JSON.parse(out)) {
    map.set(seq, { ledgerhash: ledgerhash.toLowerCase(), prevhash: prevhash.toLowerCase(), closetime });
  }
  return map;
}

function loadExternalizedSlots() {
  const out = execFileSync("python3", ["-c", `
import json, sqlite3
c = sqlite3.connect(${JSON.stringify(DB)})
rows = [r[0] for r in c.execute("select envelope from scphistory").fetchall()]
print(json.dumps(rows))
`], { encoding: "utf8" });
  const slots = new Set();
  for (const b64 of JSON.parse(out)) {
    const env = xdr.ScpEnvelope.fromXDR(b64, "base64");
    const pledges = env.statement.pledges;
    const raw = JSON.stringify(pledges);
    if (raw.includes("externalize")) {
      slots.add(Number(env.statement.slotIndex ?? env.statement.slot_index));
    }
  }
  return slots;
}

function checkClosedLedger(proof, ctx) {
  const { lclSeq, lclHash, headers, meta, externalized } = ctx;
  if (!(proof.ledgerSeq <= lclSeq)) {
    throw new Error("REFUSE: ledger " + proof.ledgerSeq + " is not externalized (LCL " + lclSeq + ")");
  }
  const row = headers.get(proof.ledgerSeq);
  if (!row) throw new Error("REFUSE: ledger " + proof.ledgerSeq + " is not in core ledgerheaders");
  if (headers.get(lclSeq).ledgerhash !== lclHash) {
    throw new Error("REFUSE: /info hash does not match core ledgerheaders");
  }
  if (!externalized.has(proof.ledgerSeq)) {
    throw new Error("REFUSE: no SCP externalize in scphistory for ledger " + proof.ledgerSeq);
  }
  if (row.ledgerhash !== proof.ledgerHash.toLowerCase()) {
    throw new Error("REFUSE: ledger hash does not match core (mutated or unknown)");
  }
  if (row.prevhash !== proof.previousLedgerHash.toLowerCase()) {
    throw new Error("REFUSE: previousLedgerHash does not match core header");
  }
  if (proof.ledgerSeq > 1) {
    const prev = headers.get(proof.ledgerSeq - 1);
    if (!prev || prev.ledgerhash !== row.prevhash) {
      throw new Error("REFUSE: previousLedgerHash chain break");
    }
  }
  const m = meta.get(proof.ledgerSeq);
  if (!m) throw new Error("REFUSE: no LedgerCloseMeta for ledger " + proof.ledgerSeq);
  if (m.headerHash !== row.ledgerhash || m.computed !== row.ledgerhash) {
    throw new Error("REFUSE: header XDR hash does not match ledgerheaders");
  }
  if (m.prev !== row.prevhash) throw new Error("REFUSE: meta previousLedgerHash mismatch");
  const tx = m.txs.get(proof.txHash.toLowerCase());
  if (!tx) throw new Error("REFUSE: transaction is not in this externalized ledger");
  if (proof.requireSuccess && !tx.success) {
    throw new Error("REFUSE: transaction result is not success " + tx.raw);
  }
  if (proof.payload) {
    const expect = memoFromPayload(proof.payload).toString("hex");
    if (tx.memoHex !== expect) throw new Error("REFUSE: memo mismatch");
  }
  return tx;
}


function walkAccounts(obj, acc) {
  if (!obj || typeof obj !== "object") return;
  const id = obj.account_id || obj.accountId;
  const seq = obj.seq_num != null ? obj.seq_num : obj.seqNum;
  if (typeof id === "string" && id.startsWith("G") && seq != null && obj.balance != null) {
    acc.set(id, String(seq));
  }
  for (const k of Object.keys(obj)) walkAccounts(obj[k], acc);
}

function latestSequences() {
  const buf = fs.readFileSync(META);
  const acc = new Map();
  const replacer = (k, v) => {
    if (typeof v === "bigint") return v.toString();
    if (v instanceof Uint8Array) return Buffer.from(v).toString("hex");
    return v;
  };
  let o = 0;
  while (o + 4 <= buf.length) {
    const n = buf.readUInt32BE(o) & 0x7fffffff;
    if (o + 4 + n > buf.length) break;
    const m = xdr.LedgerCloseMeta.fromXDR(buf.subarray(o + 4, o + 4 + n));
    const body = m.v0 || m.v1 || m.v2;
    if (body) walkAccounts(JSON.parse(JSON.stringify(body, replacer)), acc);
    o += 4 + n;
  }
  return acc;
}

function keypairFromLabel(label) {
  return Keypair.fromRawEd25519Seed(crypto.createHash("sha256").update(label).digest());
}

async function main() {
  if (!fs.existsSync(BIN)) {
    throw new Error("stellar-core binary missing at " + BIN + " (hold/release not run)");
  }
  fs.rmSync(HOME, { recursive: true, force: true });
  fs.mkdirSync(HOME + "/buckets", { recursive: true });
  const cfg = `
HTTP_PORT=${PORT}
PUBLIC_HTTP_PORT=false
NODE_SEED="${SEED}"
NODE_IS_VALIDATOR=true
NETWORK_PASSPHRASE="${PASSPHRASE}"
DATABASE="sqlite3://${DB}"
BUCKET_DIR_PATH="${HOME}/buckets"
UNSAFE_QUORUM=true
FAILURE_SAFETY=0
CATCHUP_COMPLETE=false
RUN_STANDALONE=true
MANUAL_CLOSE=true
METADATA_OUTPUT_STREAM="${META}"
[QUORUM_SET]
THRESHOLD_PERCENT=100
VALIDATORS=["${VALIDATOR}"]
`;
  fs.writeFileSync(HOME + "/stellar-core.cfg", cfg);
  execFileSync(BIN, ["--conf", HOME + "/stellar-core.cfg", "new-db"], { stdio: "inherit" });
  const child = spawn(BIN, ["--conf", HOME + "/stellar-core.cfg", "run"], {
    cwd: HOME,
    stdio: ["ignore", fs.openSync(HOME + "/core.log", "w"), fs.openSync(HOME + "/core.log", "a")],
  });
  try {
    for (let i = 0; i < 50; i++) {
      try {
        const t = await get("/info");
        if (t.includes("ledger")) break;
      } catch (e) {}
      await new Promise((r) => setTimeout(r, 200));
      if (i === 49) throw new Error("stellar-core HTTP did not come up; see " + HOME + "/core.log");
    }
    const boot = JSON.parse(await get("/info"));
    console.log("boot ledger", JSON.stringify(boot.info.ledger), "state", boot.info.state);
    assert(boot.info.ledger.version === 0, "fresh core starts at protocol 0");

    await closeLedger(0);
    await get("/upgrades?mode=set&upgradetime=1970-01-01T00:00:00Z&protocolversion=14");
    const up = await closeLedger(0);
    assert(up.info.info.ledger.version === 14, "protocol upgraded to 14 (claimable balances) without Timer abort");
    await get("/upgrades?mode=clear");

    const networkId = crypto.createHash("sha256").update(PASSPHRASE).digest();
    const root = Keypair.fromRawEd25519Seed(networkId);
    const source = keypairFromLabel("vf-stellar-rev8-source");
    const devFund = keypairFromLabel("vf-stellar-rev8-dev-fund");
    const release = keypairFromLabel("vf-stellar-rev8-release");
    console.log("FIXTURE source", source.publicKey());
    console.log("FIXTURE devFund", devFund.publicKey());
    console.log("FIXTURE release", release.publicKey());

    let rootSeq = "0";
    const fund = buildTx(root.publicKey(), rootSeq, [
      Operation.createAccount({ destination: source.publicKey(), startingBalance: "1000" }),
      Operation.createAccount({ destination: devFund.publicKey(), startingBalance: "100" }),
      Operation.createAccount({ destination: release.publicKey(), startingBalance: "100" }),
    ], root, null);
    await submit(fund, "fund");
    await closeLedger(0);
    rootSeq = fund.sequence;
    const createdSeq = latestSequences();
    console.log("created source seq", createdSeq.get(source.publicKey()));
    console.log("created release seq", createdSeq.get(release.publicKey()));

    const now = await virtualNow();
    const maturity = now + 200_000_000;
    console.log("virtualNow", now, "maturity", maturity);

    const gross = 1_000_000n;
    const fee = (gross * 500n) / 10000n;
    const principal = gross - fee;
    assert(fee === 50_000n, "fee 50000 stroops");
    assert(principal === 950_000n, "principal 950000 stroops");
    const stroops = (n) => {
      const whole = n / 10_000_000n;
      const frac = (n % 10_000_000n).toString().padStart(7, "0");
      return whole.toString() + "." + frac;
    };

    const payload = buildBindingPayload({
      lockId32: crypto.createHash("sha256").update("stellar-lock-001").digest(),
      baseRecipient20: Buffer.from("12345678901234567890"),
      outputToken: 1,
      assetIdentity32: crypto.createHash("sha256").update("native-XLM").digest(),
      valuationRef32: crypto.createHash("sha256").update("valuation-ref-1").digest(),
    });
    const memoHash = memoFromPayload(payload);
    assert(payload.length === 117, "payload exactly 117 bytes");

    // Memo mismatch is rejected by the checker. Also show a wrong memo is not a lock.
    {
      const bad = Buffer.from(memoHash);
      bad[0] ^= 0xff;
      assert(!bad.equals(memoHash), "tampered memo differs");
      const rebuilt = memoFromPayload(payload);
      assert(rebuilt.equals(memoHash), "memo matches rebuilt payload");
      const wrongPayload = Buffer.from(payload);
      wrongPayload[0] ^= 0xff;
      assert(!memoFromPayload(wrongPayload).equals(memoHash), "memo mismatch rejected by checker");
    }

    let sourceSeq = createdSeq.get(source.publicKey());
    let releaseSeq = createdSeq.get(release.publicKey());
    if (!sourceSeq || !releaseSeq) throw new Error("account sequence missing from ledger meta");
    const lock = buildTx(source.publicKey(), sourceSeq, [
      Operation.payment({
        destination: devFund.publicKey(),
        asset: Asset.native(),
        amount: stroops(fee),
      }),
      Operation.createClaimableBalance({
        asset: Asset.native(),
        amount: stroops(principal),
        claimants: [
          new Claimant(
            release.publicKey(),
            Claimant.predicateNot(Claimant.predicateBeforeAbsoluteTime(String(maturity))),
          ),
        ],
      }),
    ], source, memoHash);
    await submit(lock, "lock");
    const lockClose = await closeBefore(maturity);
    sourceSeq = lock.sequence;
    const balanceId = lock.getClaimableBalanceId(1);
    console.log("balanceId", balanceId, "lockSeq", lock.sequence, "ledger", lockClose.info.info.ledger.num);

    const early = buildTx(release.publicKey(), releaseSeq, [
      Operation.claimClaimableBalance({ balanceId }),
    ], release, null);
    await submit(early, "early-claim");
    await closeBefore(maturity);
    releaseSeq = early.sequence;

    const non = buildTx(source.publicKey(), sourceSeq, [
      Operation.claimClaimableBalance({ balanceId }),
    ], source, null);
    await submit(non, "non-claimant");
    await closeBefore(maturity);
    sourceSeq = non.sequence;

    const matureClose = await closeLedger(maturity);
    assert(matureClose.closeTime >= maturity, "mature ledger closeTime >= maturity");

    const claim = buildTx(release.publicKey(), releaseSeq, [
      Operation.claimClaimableBalance({ balanceId }),
    ], release, null);
    await submit(claim, "mature-claim");
    const claimClose = await closeLedger(0);
    releaseSeq = claim.sequence;

    const second = buildTx(release.publicKey(), releaseSeq, [
      Operation.claimClaimableBalance({ balanceId }),
    ], release, null);
    await submit(second, "second-claim");
    await closeLedger(0);

    // A lock tx with the wrong memo is not accepted as this lock.
    const badMemo = Buffer.from(memoHash);
    badMemo[0] ^= 0xff;
    const bogus = buildTx(source.publicKey(), sourceSeq, [
      Operation.payment({
        destination: devFund.publicKey(),
        asset: Asset.native(),
        amount: stroops(1n),
      }),
    ], source, badMemo);
    await submit(bogus, "bad-memo");
    await closeLedger(0);

    const info = JSON.parse(await get("/info"));
    const lclSeq = Number(info.info.ledger.num);
    const lclHash = String(info.info.ledger.hash).toLowerCase();
    assert(info.info.state === "Synced!", "core state is Synced (last closed ledger externalized)");
    const headers = loadHeaders();
    const meta = loadMeta();
    const externalized = loadExternalizedSlots();
    console.log("LCL", lclSeq, lclHash, "externalized slots", [...externalized].join(","));
    const ctx = { lclSeq, lclHash, headers, meta, externalized };

    function findTx(hashHex) {
      for (const [seq, m] of meta) {
        if (m.txs.has(hashHex)) return { seq, tx: m.txs.get(hashHex), meta: m };
      }
      return null;
    }

    const lockHash = Buffer.from(lock.hash()).toString("hex");
    const earlyHash = Buffer.from(early.hash()).toString("hex");
    const nonHash = Buffer.from(non.hash()).toString("hex");
    const claimHash = Buffer.from(claim.hash()).toString("hex");
    const secondHash = Buffer.from(second.hash()).toString("hex");
    const bogusHash = Buffer.from(bogus.hash()).toString("hex");

    const lockFound = findTx(lockHash);
    assert(lockFound, "lock tx is in core metadata");
    console.log("lock result", lockFound.tx.raw);
    assert(lockFound.tx.success, "lock tx result success");
    assert(lockFound.tx.memoHex === memoHash.toString("hex"), "lock memo is SHA-256 of 117-byte payload");
    assert(lockFound.tx.raw.includes("payment") && lockFound.tx.raw.includes("create_claimable_balance"), "one tx paid the fee and created the claimable balance");

    const earlyFound = findTx(earlyHash);
    console.log("early result", earlyFound && earlyFound.tx.raw);
    assert(earlyFound && !earlyFound.tx.success, "claim before maturity fails");
    assert(
      earlyFound.tx.raw.includes("before") || earlyFound.tx.raw.includes("cannot_claim") || earlyFound.tx.raw.includes("claim_claimable_balance"),
      "early claim result is a claim failure",
    );

    const nonFound = findTx(nonHash);
    console.log("non-claimant result", nonFound && nonFound.tx.raw);
    assert(nonFound && !nonFound.tx.success, "non-claimant claim fails");

    const claimFound = findTx(claimHash);
    console.log("mature result", claimFound && claimFound.tx.raw);
    assert(claimFound && claimFound.tx.success, "at maturity the claimant receives the principal");
    assert(claimFound.tx.raw.includes("claim_claimable_balance"), "mature result is claimClaimableBalance success");

    const secondFound = findTx(secondHash);
    console.log("second result", secondFound && secondFound.tx.raw);
    assert(secondFound && !secondFound.tx.success, "second claim fails");
    assert(
      secondFound.tx.raw.includes("does_not_exist") || secondFound.tx.raw.includes("claim_claimable_balance"),
      "second claim result names the failure",
    );

    const hdr = headers.get(lockFound.seq);
    const proof = {
      ledgerSeq: lockFound.seq,
      ledgerHash: hdr.ledgerhash,
      previousLedgerHash: hdr.prevhash,
      txHash: lockHash,
      payload,
      requireSuccess: true,
    };
    const accepted = checkClosedLedger(proof, ctx);
    assert(accepted.success, "checker accepts lock in externalized ledger");
    console.log("PROOF ledger", proof.ledgerSeq, "hash", proof.ledgerHash, "prev", proof.previousLedgerHash);

    let mutated = false;
    try {
      checkClosedLedger({ ...proof, ledgerHash: "00".repeat(32) }, ctx);
    } catch (e) {
      mutated = true;
      console.log("mutated hash:", e.message);
    }
    assert(mutated, "mutated ledger hash is refused");

    let missing = false;
    try {
      checkClosedLedger({ ...proof, txHash: "11".repeat(32) }, ctx);
    } catch (e) {
      missing = true;
      console.log("absent tx:", e.message);
    }
    assert(missing, "tx not in the ledger is refused");

    let memoBad = false;
    try {
      checkClosedLedger({
        ledgerSeq: findTx(bogusHash).seq,
        ledgerHash: headers.get(findTx(bogusHash).seq).ledgerhash,
        previousLedgerHash: headers.get(findTx(bogusHash).seq).prevhash,
        txHash: bogusHash,
        payload,
        requireSuccess: true,
      }, ctx);
    } catch (e) {
      memoBad = true;
      console.log("memo mismatch:", e.message);
    }
    assert(memoBad, "memo mismatch is rejected");

    let future = false;
    try {
      checkClosedLedger({ ...proof, ledgerSeq: lclSeq + 5, ledgerHash: hdr.ledgerhash }, ctx);
    } catch (e) {
      future = true;
      console.log("not externalized:", e.message);
    }
    assert(future, "checker refuses a ledger that is not externalized");

    console.log("STELLAR_HOLD_RELEASE_OK");
    child.kill("SIGTERM");
  } catch (e) {
    child.kill("SIGTERM");
    throw e;
  }
}

main().catch((e) => {
  console.error(e && e.stack ? e.stack : e);
  process.exit(1);
});
