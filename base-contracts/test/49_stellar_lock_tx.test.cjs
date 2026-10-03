// =============================================================================
// Stellar lock transaction — C.11 operation shape
//
// The parse cases build one transaction with the official Stellar SDK and
// read it back from XDR. They do not submit it and do not mint.
// StellarChainVerifier remains fail-closed.
//
// The network case submits that same operation shape to a local standalone
// stellar-core and claims the balance on a closed ledger. A predicate that
// only appears in the XDR is not treated as payment.
//
// The memo hash is SHA-256 of the existing C.8 Bitcoin nulldata payload
// (test/lib/c8NulldataPayload.cjs). Amounts are the same 5%/95% split as that
// C.8 lock (50_000 / 950_000 of 1_000_000), denominated in stroops.
// =============================================================================

const { expect } = require("chai");
const { ethers } = require("ethers");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn, spawnSync } = require("child_process");
const {
  Account,
  Asset,
  Claimant,
  Keypair,
  Memo,
  Networks,
  Operation,
  TransactionBuilder,
  xdr,
} = require("@stellar/stellar-sdk");

const {
  buildNulldataPayload,
  PAYLOAD_LOCK_ID,
  PAYLOAD_RECIPIENT,
  PAYLOAD_ASSET,
  PAYLOAD_VALUATION,
  PAYLOAD_OUTPUT_TOKEN,
} = require("./lib/c8NulldataPayload.cjs");

// Same integers as 15_utxo_verifier.test.cjs (fee 50_000, principal 950_000,
// maturity 1700086400). 50_000 / 1_000_000 is exactly 5%.
const GROSS_STROOPS = 1_000_000n;
const MATURITY = 1700086400;
const FEE_BPS = 500n; // 5.00%
const STROOPS_PER_UNIT = 10_000_000n;

function keypairFromLabel(label) {
  const seed = crypto.createHash("sha256").update(label).digest();
  return Keypair.fromRawEd25519Seed(seed);
}

const SOURCE = keypairFromLabel("vf-stellar-test-source");
const DEV_FUND = keypairFromLabel("vf-stellar-test-dev-fund");
const RELEASE = keypairFromLabel("vf-stellar-test-release");
const OTHER = keypairFromLabel("vf-stellar-test-other-claimant");

function stroopsToAmount(stroops) {
  if (stroops < 0n) throw new Error("negative stroops");
  const whole = stroops / STROOPS_PER_UNIT;
  const frac = (stroops % STROOPS_PER_UNIT).toString().padStart(7, "0");
  return `${whole.toString()}.${frac}`;
}

function amountToStroops(amount) {
  const m = /^(\d+)(?:\.(\d{1,7}))?$/.exec(amount);
  if (!m) throw new Error(`unexpected Stellar amount ${amount}`);
  const frac = (m[2] || "").padEnd(7, "0");
  return BigInt(m[1]) * STROOPS_PER_UNIT + BigInt(frac);
}

function c8PayloadBytes() {
  const hex = buildNulldataPayload();
  const payload = Buffer.from(hex, "hex");
  if (payload.length !== 117) {
    throw new Error(`C.8 payload is ${payload.length} bytes, expected 117`);
  }
  return payload;
}

function assertC8PayloadFacts(payload) {
  expect(payload.length).to.equal(117);
  expect(ethers.hexlify(payload.subarray(0, 32))).to.equal(PAYLOAD_LOCK_ID);
  expect(ethers.getAddress(ethers.hexlify(payload.subarray(32, 52)))).to.equal(
    ethers.getAddress(PAYLOAD_RECIPIENT)
  );
  expect(payload[52]).to.equal(PAYLOAD_OUTPUT_TOKEN);
  expect(ethers.hexlify(payload.subarray(53, 85))).to.equal(PAYLOAD_ASSET);
  expect(ethers.hexlify(payload.subarray(85, 117))).to.equal(PAYLOAD_VALUATION);
}

// memoHash: undefined → SHA-256 of the C.8 payload; null → omit memo.
function buildStellarLockTransaction({
  grossStroops = GROSS_STROOPS,
  maturity = MATURITY,
  feeBps = FEE_BPS,
  release = RELEASE,
  devFund = DEV_FUND,
  extraClaimant = null,
  memoHash = undefined,
  payload = c8PayloadBytes(),
  networkPassphrase = Networks.TESTNET,
  sourcePublicKey = SOURCE.publicKey(),
  sourceSequence = "1",
} = {}) {
  const feeStroops = grossStroops * feeBps / 10000n;
  const principalStroops = grossStroops - feeStroops;

  const claimants = [
    new Claimant(
      release.publicKey(),
      Claimant.predicateNot(
        Claimant.predicateBeforeAbsoluteTime(String(maturity))
      )
    ),
  ];
  if (extraClaimant) {
    claimants.push(new Claimant(
      extraClaimant.publicKey(),
      Claimant.predicateNot(
        Claimant.predicateBeforeAbsoluteTime(String(maturity))
      )
    ));
  }

  const account = new Account(sourcePublicKey, sourceSequence);
  let builder = new TransactionBuilder(account, {
    fee: "100", // Stellar network fee, not the Dev Fund payment
    networkPassphrase,
  })
    .addOperation(Operation.payment({
      destination: devFund.publicKey(),
      asset: Asset.native(),
      amount: stroopsToAmount(feeStroops),
    }))
    .addOperation(Operation.createClaimableBalance({
      asset: Asset.native(),
      amount: stroopsToAmount(principalStroops),
      claimants,
    }));

  if (memoHash !== null) {
    const hash = memoHash === undefined
      ? crypto.createHash("sha256").update(payload).digest()
      : memoHash;
    builder = builder.addMemo(Memo.hash(hash));
  }

  return builder.setTimeout(0).build();
}

function parseStellarLockTransaction(tx) {
  return TransactionBuilder.fromXDR(tx.toXDR(), Networks.TESTNET);
}

function assertParsedStellarLock(parsed, {
  devFund = DEV_FUND.publicKey(),
  release = RELEASE.publicKey(),
  grossStroops = GROSS_STROOPS,
  maturity = MATURITY,
  payload = c8PayloadBytes(),
} = {}) {
  expect(parsed.operations).to.have.length(2);

  const payment = parsed.operations[0];
  expect(payment.type).to.equal("payment");
  expect(payment.destination).to.equal(devFund);
  expect(payment.asset.isNative()).to.equal(true);
  const feeStroops = amountToStroops(payment.amount);
  expect(feeStroops * 100n).to.equal(grossStroops * 5n);

  const claim = parsed.operations[1];
  expect(claim.type).to.equal("createClaimableBalance");
  expect(claim.asset.isNative()).to.equal(true);
  const principalStroops = amountToStroops(claim.amount);
  expect(principalStroops * 100n).to.equal(grossStroops * 95n);
  expect(feeStroops + principalStroops).to.equal(grossStroops);

  expect(claim.claimants).to.have.length(1);
  const claimant = claim.claimants[0];
  expect(claimant.destination).to.equal(release);
  expect(claimant.predicate.type).to.equal("claimPredicateNot");
  expect(claimant.predicate.notPredicate.type).to.equal(
    "claimPredicateBeforeAbsoluteTime"
  );
  expect(claimant.predicate.notPredicate.absBefore).to.equal(BigInt(maturity));

  const expectedClaimant = new Claimant(
    release,
    Claimant.predicateNot(
      Claimant.predicateBeforeAbsoluteTime(String(maturity))
    )
  );
  expect(claimant.toXdrObject().toXDR("hex")).to.equal(
    expectedClaimant.toXdrObject().toXDR("hex")
  );

  expect(parsed.memo.type).to.equal("hash");
  const expectedHash = crypto.createHash("sha256").update(payload).digest();
  expect(expectedHash.length).to.equal(32);
  expect(Buffer.from(parsed.memo.value).equals(expectedHash)).to.equal(true);
}

describe("Stellar lock transaction — payment, claimable balance, memo hash", function () {
  const payload = c8PayloadBytes();

  it("parses the built transaction and checks the 5% payment, 95% sole claimant, and memo hash", function () {
    assertC8PayloadFacts(payload);

    const tx = buildStellarLockTransaction({ payload });
    const parsed = parseStellarLockTransaction(tx);
    assertParsedStellarLock(parsed, { payload });
  });

  it("fails the assertion on a wrong memo hash", function () {
    const tx = buildStellarLockTransaction({
      payload,
      memoHash: Buffer.alloc(32, 0xab),
    });
    const parsed = parseStellarLockTransaction(tx);
    expect(() => assertParsedStellarLock(parsed, { payload })).to.throw();
  });

  it("fails the assertion when a second claimant is present", function () {
    const tx = buildStellarLockTransaction({ payload, extraClaimant: OTHER });
    const parsed = parseStellarLockTransaction(tx);
    expect(() => assertParsedStellarLock(parsed, { payload })).to.throw();
  });

  it("fails the assertion when the dev-fund payment is not 5%", function () {
    const tx = buildStellarLockTransaction({ payload, feeBps: 250n });
    const parsed = parseStellarLockTransaction(tx);
    expect(() => assertParsedStellarLock(parsed, { payload })).to.throw();
  });

  it("fails the assertion when the memo is missing", function () {
    const tx = buildStellarLockTransaction({ payload, memoHash: null });
    const parsed = parseStellarLockTransaction(tx);
    expect(() => assertParsedStellarLock(parsed, { payload })).to.throw();
  });
});

// Local standalone network. The passphrase is not the public testnet: core
// runs with RUN_STANDALONE and no peers. Protocol 14 is the claimable-balance
// protocol. The fixed MATURITY (1700086400) is already before wall-clock time,
// and stellar-core rejects a manual closeTime earlier than its clock, so this
// case uses the same builder with a maturity still ahead of that clock.
const LOCAL_PASSPHRASE = "Vinculum Finalis Stellar Local ; October 2026";
const CLAIMABLE_BALANCE_PROTOCOL = 14;
const NETWORK_FEE_PER_OP = 100n;
// stellar-core's virtual clock on this host runs far faster than wall time.
// A close time has to sit far enough ahead of the probed "now" to survive one
// HTTP round trip, or manualclose reports the time as too early.
const CLOSE_TIME_BUFFER_SEC = 20000;
const MATURITY_MARGIN_SEC = 30 * 86400;
const STARTING_BALANCE_XLM = "100";

function resolveStellarCore() {
  if (process.env.STELLAR_CORE_BIN) {
    return {
      bin: process.env.STELLAR_CORE_BIN,
      lib: process.env.STELLAR_CORE_LIB || "",
    };
  }
  const localBin = "/home/box/stellar-local/usr/bin/stellar-core";
  const localLib = "/home/box/stellar-local/usr/lib/x86_64-linux-gnu";
  if (fs.existsSync(localBin)) return { bin: localBin, lib: localLib };
  return { bin: "stellar-core", lib: "" };
}

function coreEnv(lib) {
  const env = { ...process.env };
  if (lib) {
    env.LD_LIBRARY_PATH = process.env.LD_LIBRARY_PATH
      ? `${lib}:${process.env.LD_LIBRARY_PATH}`
      : lib;
  }
  return env;
}

function walkLedgerChanges(node, visit) {
  if (!node || typeof node !== "object") return;
  const keys = Object.keys(node);
  if (
    keys.length === 1 &&
    (keys[0] === "state" || keys[0] === "updated" || keys[0] === "created" || keys[0] === "removed")
  ) {
    visit(keys[0], node[keys[0]]);
    return;
  }
  for (const value of Object.values(node)) walkLedgerChanges(value, visit);
}

function accountBalances(meta, accountId) {
  const balances = [];
  walkLedgerChanges(meta, (type, body) => {
    const account = body && body.data && body.data.account;
    if (account && account.account_id === accountId && account.balance != null) {
      balances.push(BigInt(account.balance));
    }
  });
  return balances;
}

function createdSequence(metas, accountId) {
  let seq = null;
  for (const meta of metas) {
    walkLedgerChanges(meta, (type, body) => {
      const account = body && body.data && body.data.account;
      if (type === "created" && account && account.account_id === accountId) {
        seq = String(account.seq_num);
      }
    });
  }
  if (seq == null) throw new Error(`created account ${accountId} not in ledger meta`);
  return seq;
}

function txOutcome(meta) {
  const arm = meta.v0 || meta.v1 || meta.v2;
  if (!arm) throw new Error("ledger close meta has no v0/v1/v2 arm");
  if (!arm.tx_processing || arm.tx_processing.length !== 1) {
    throw new Error(`expected one transaction in the ledger, got ${arm.tx_processing && arm.tx_processing.length}`);
  }
  const result = arm.tx_processing[0].result.result;
  return {
    feeCharged: BigInt(result.fee_charged),
    result: result.result,
    meta: arm,
  };
}

function claimCode(result) {
  const failed = result.tx_failed && result.tx_failed[0];
  const success = result.tx_success && result.tx_success[0];
  const inner = (failed || success || {}).op_inner;
  if (!inner || inner.claim_claimable_balance == null) {
    throw new Error(`not a claim result: ${JSON.stringify(result)}`);
  }
  return {
    ok: Boolean(success),
    code: inner.claim_claimable_balance === "success"
      ? "success"
      : inner.claim_claimable_balance,
  };
}

function removedClaimableAmounts(meta) {
  const amounts = [];
  let pending = null;
  walkLedgerChanges(meta, (type, body) => {
    const entry = body && body.data && body.data.claimable_balance;
    if (type === "state" && entry && entry.amount != null) pending = BigInt(entry.amount);
    if (type === "removed" && body && body.claimable_balance) {
      amounts.push(pending);
      pending = null;
    }
  });
  return amounts;
}

describe("Stellar lock transaction — local network claim", function () {
  this.timeout(180000);

  let net;

  after(function () {
    if (net) net.stop();
  });

  async function startNetwork() {
    const { bin, lib } = resolveStellarCore();
    const env = coreEnv(lib);
    const probe = spawnSync(bin, ["version"], { env, encoding: "utf8" });
    if (probe.error || probe.status !== 0) {
      const detail = probe.error ? probe.error.message : (probe.stderr || probe.stdout);
      throw new Error(`stellar-core cannot start\n${detail}`);
    }

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vf-stellar-"));
    const buckets = path.join(dir, "buckets");
    fs.mkdirSync(buckets);
    const node = Keypair.random();
    const cfg = path.join(dir, "stellar-core.cfg");
    const db = path.join(dir, "stellar.db");
    const metaPath = path.join(dir, "meta.xdr");
    const logPath = path.join(dir, "core.log");
    const port = 11926;
    fs.writeFileSync(cfg, `
HTTP_PORT=${port}
PUBLIC_HTTP_PORT=false
NODE_SEED="${node.secret()}"
NODE_IS_VALIDATOR=true

NETWORK_PASSPHRASE="${LOCAL_PASSPHRASE}"

DATABASE="sqlite3://${db}"
BUCKET_DIR_PATH="${buckets}"

UNSAFE_QUORUM=true
FAILURE_SAFETY=0
CATCHUP_COMPLETE=false
RUN_STANDALONE=true
MANUAL_CLOSE=true
METADATA_OUTPUT_STREAM="${metaPath}"

[QUORUM_SET]
THRESHOLD_PERCENT=100
VALIDATORS=["${node.publicKey()}"]
`);

    const created = spawnSync(bin, ["--conf", cfg, "new-db"], { env, encoding: "utf8" });
    if (created.status !== 0) {
      throw new Error(`stellar-core new-db failed\n${created.stderr || ""}${created.stdout || ""}`);
    }

    const logFd = fs.openSync(logPath, "a");
    const child = spawn(bin, ["--conf", cfg, "run"], {
      env,
      stdio: ["ignore", logFd, logFd],
    });
    let stopped = false;
    const stop = () => {
      if (stopped) return;
      stopped = true;
      try { child.kill("SIGTERM"); } catch (_) { /* already gone */ }
      try { fs.closeSync(logFd); } catch (_) { /* closed */ }
    };
    child.on("exit", () => { stopped = true; });

    const base = `http://127.0.0.1:${port}`;
    const logTail = () => {
      try { return fs.readFileSync(logPath, "utf8").slice(-4000); }
      catch (e) { return String(e); }
    };

    const deadline = Date.now() + 20000;
    let lastErr = "";
    while (Date.now() < deadline) {
      if (child.exitCode != null) {
        stop();
        throw new Error(`stellar-core exited ${child.exitCode}\n${logTail()}`);
      }
      try {
        const res = await fetch(`${base}/info`);
        if (res.ok) break;
        lastErr = await res.text();
      } catch (e) {
        lastErr = e.message;
      }
      await new Promise((r) => setTimeout(r, 200));
      if (Date.now() >= deadline) {
        stop();
        throw new Error(`stellar-core did not serve /info\n${lastErr}\n${logTail()}`);
      }
    }

    let metaOff = 0;
    function readNewMeta() {
      if (!fs.existsSync(metaPath)) return [];
      const buf = fs.readFileSync(metaPath);
      const out = [];
      let offset = metaOff;
      while (offset + 4 <= buf.length) {
        const n = buf.readUInt32BE(offset) & 0x7fffffff;
        if (offset + 4 + n > buf.length) break;
        const meta = xdr.LedgerCloseMeta.fromXDR(buf.subarray(offset + 4, offset + 4 + n));
        out.push(JSON.parse(JSON.stringify(meta)));
        offset += 4 + n;
      }
      metaOff = offset;
      return out;
    }

    async function coreCmd(urlPath) {
      const res = await fetch(base + urlPath);
      const text = await res.text();
      if (!res.ok) throw new Error(`${urlPath}\n${text}`);
      return text;
    }

    async function coreNow() {
      const text = await coreCmd("/manualclose?closeTime=1");
      const matched = /now=(\d+)/.exec(text);
      if (!matched) throw new Error(`could not read core clock\n${text}`);
      return Number(matched[1]);
    }

    let lastClose = 0;
    async function closeLedger(explicit) {
      let now = await coreNow();
      let guess = explicit != null
        ? explicit
        : Math.max(lastClose + 1, now + CLOSE_TIME_BUFFER_SEC);
      if (explicit != null && guess < now) {
        throw new Error(`closeTime ${guess} is behind core now ${now}`);
      }
      for (let attempt = 0; attempt < 4; attempt++) {
        if (guess <= lastClose) guess = lastClose + 1;
        const text = await coreCmd("/manualclose?closeTime=" + guess);
        if (text.startsWith("Manually closed")) {
          lastClose = guess;
          return guess;
        }
        const matched = /now=(\d+)/.exec(text);
        if (!matched || explicit != null) throw new Error(text);
        now = Number(matched[1]);
        guess = Math.max(now + CLOSE_TIME_BUFFER_SEC, lastClose + 1);
      }
      throw new Error("manualclose did not advance the ledger");
    }

    async function submit(tx, label) {
      const blob = encodeURIComponent(tx.toEnvelope().toXDR("base64"));
      const text = await coreCmd("/tx?blob=" + blob);
      let body;
      try { body = JSON.parse(text); }
      catch (e) { throw new Error(`${label} submit\n${text}`); }
      if (body.status !== "PENDING") {
        let decoded = text;
        if (body.error) {
          try {
            decoded = JSON.stringify(xdr.TransactionResult.fromXDR(body.error, "base64"));
          } catch (_) { /* keep raw */ }
        }
        throw new Error(`${label} was not accepted\n${text}\n${decoded}`);
      }
    }

    return { stop, readNewMeta, coreNow, closeLedger, submit, coreCmd, logTail };
  }

  function signed(tx, keypair) {
    tx.sign(keypair);
    return tx;
  }

  it("pays exactly the 95% principal when the sole claimant claims at maturity", async function () {
    net = await startNetwork();
    const root = Keypair.fromRawEd25519Seed(
      crypto.createHash("sha256").update(LOCAL_PASSPHRASE).digest()
    );

    let info = JSON.parse(await net.coreCmd("/info"));
    let version = info.info.ledger.version;
    while (version < CLAIMABLE_BALANCE_PROTOCOL) {
      const next = version + 1;
      const setReply = await net.coreCmd(
        `/upgrades?mode=set&upgradetime=1970-01-01T00:00:00Z&protocolversion=${next}`
      );
      if (setReply.trim()) throw new Error(`upgrade set failed\n${setReply}`);
      await net.closeLedger();
      info = JSON.parse(await net.coreCmd("/info"));
      version = info.info.ledger.version;
      if (version !== next) {
        throw new Error(`protocol stayed at ${version}, wanted ${next}\n${await net.coreCmd("/upgrades?mode=get")}`);
      }
      await net.coreCmd("/upgrades?mode=clear");
    }
    net.readNewMeta();

    const fund = new TransactionBuilder(new Account(root.publicKey(), "0"), {
      fee: "100",
      networkPassphrase: LOCAL_PASSPHRASE,
    })
      .addOperation(Operation.createAccount({
        destination: SOURCE.publicKey(),
        startingBalance: STARTING_BALANCE_XLM,
      }))
      .addOperation(Operation.createAccount({
        destination: DEV_FUND.publicKey(),
        startingBalance: STARTING_BALANCE_XLM,
      }))
      .addOperation(Operation.createAccount({
        destination: RELEASE.publicKey(),
        startingBalance: STARTING_BALANCE_XLM,
      }))
      .setTimeout(0)
      .build();
    fund.sign(root);
    await net.submit(fund, "fund");
    await net.closeLedger();
    const fundMeta = net.readNewMeta();
    expect(fundMeta).to.have.length(1);
    const fundResult = txOutcome(fundMeta[0]).result;
    expect(fundResult.tx_success.map((op) => op.op_inner.create_account)).to.deep.equal([
      "success", "success", "success",
    ]);

    const sourceSequence = createdSequence(fundMeta, SOURCE.publicKey());
    const releaseSequence = createdSequence(fundMeta, RELEASE.publicKey());
    const payload = c8PayloadBytes();
    const maturity = await net.coreNow() + MATURITY_MARGIN_SEC;

    const lock = signed(buildStellarLockTransaction({
      payload,
      maturity,
      networkPassphrase: LOCAL_PASSPHRASE,
      sourcePublicKey: SOURCE.publicKey(),
      sourceSequence,
    }), SOURCE);
    assertParsedStellarLock(parseStellarLockTransaction(lock), { payload, maturity });

    const balanceId = lock.getClaimableBalanceId(1);
    await net.submit(lock, "lock");
    const lockClose = await net.closeLedger();
    expect(lockClose).to.be.below(maturity);
    const lockMeta = net.readNewMeta();
    const lockOutcome = txOutcome(lockMeta[0]);
    expect(lockOutcome.result.tx_success.map((op) => Object.keys(op.op_inner)[0])).to.deep.equal([
      "payment", "create_claimable_balance",
    ]);
    const devBalances = accountBalances(lockMeta[0], DEV_FUND.publicKey());
    expect(devBalances[devBalances.length - 1] - devBalances[0]).to.equal(50_000n);
    const createdAmounts = [];
    walkLedgerChanges(lockMeta[0], (type, body) => {
      const entry = body && body.data && body.data.claimable_balance;
      if (type === "created" && entry) createdAmounts.push(BigInt(entry.amount));
    });
    expect(createdAmounts).to.deep.equal([950_000n]);

    async function claim(sequence, explicitClose) {
      const tx = new TransactionBuilder(new Account(RELEASE.publicKey(), sequence), {
        fee: "100",
        networkPassphrase: LOCAL_PASSPHRASE,
      })
        .addOperation(Operation.claimClaimableBalance({ balanceId }))
        .setTimeout(0)
        .build();
      tx.sign(RELEASE);
      await net.submit(tx, "claim");
      const closeTime = await net.closeLedger(explicitClose);
      const metas = net.readNewMeta();
      expect(metas).to.have.length(1);
      return { tx, closeTime, meta: metas[0], outcome: txOutcome(metas[0]) };
    }

    const early = await claim(releaseSequence, null);
    expect(early.closeTime).to.be.below(maturity);
    const earlyCode = claimCode(early.outcome.result);
    expect(earlyCode).to.deep.equal({ ok: false, code: "cannot_claim" });
    expect(removedClaimableAmounts(early.meta)).to.deep.equal([]);
    const earlyBalances = accountBalances(early.meta, RELEASE.publicKey());
    expect(earlyBalances[earlyBalances.length - 1] - earlyBalances[0]).to.equal(-NETWORK_FEE_PER_OP);
    expect(early.outcome.feeCharged).to.equal(NETWORK_FEE_PER_OP);

    const mature = await claim(early.tx.sequence, maturity);
    expect(mature.closeTime).to.equal(maturity);
    expect(claimCode(mature.outcome.result)).to.deep.equal({ ok: true, code: "success" });
    const paid = removedClaimableAmounts(mature.meta);
    expect(paid).to.deep.equal([950_000n]);
    const matureBalances = accountBalances(mature.meta, RELEASE.publicKey());
    const credited = matureBalances[matureBalances.length - 1] - matureBalances[0] + mature.outcome.feeCharged;
    expect(credited).to.equal(950_000n);
    expect(mature.outcome.feeCharged).to.equal(NETWORK_FEE_PER_OP);
    console.log(`stellar claim paid ${credited.toString()} stroops`);

    const again = await claim(mature.tx.sequence, null);
    expect(claimCode(again.outcome.result)).to.deep.equal({ ok: false, code: "does_not_exist" });
    const againBalances = accountBalances(again.meta, RELEASE.publicKey());
    expect(againBalances[againBalances.length - 1] - againBalances[0]).to.equal(-NETWORK_FEE_PER_OP);
    expect(removedClaimableAmounts(again.meta)).to.deep.equal([]);
  });
});
