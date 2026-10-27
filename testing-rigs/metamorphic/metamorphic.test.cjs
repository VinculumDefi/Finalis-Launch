// METAMORPHIC rig. Local hardhat chain only.
// Converted 2026-10-23: always active, and the test FAILS if any relation is
// violated. Run:
//   testing-rigs/run.sh none metamorphic/metamorphic.test.cjs
// Relations checked on the Base path (BaseCommitmentVaultLock + BaseLockRecordVerifier):
//   MR1 scale:  doubling a lock's gross doubles its mint (exact or within 2 wei rounding).
//   MR2 split:  one lock of X mints the same total as two locks of X/2 (within rounding).
//   MR3 submission-time invariance (spec VF-ORC-009/010/011): two identical locks created
//       together mint the same amount however they are submitted:
//       a) one now, one 45 days later at the same price;
//       b) one honest, one whose package carries valuationTimestamp = launch;
//       c) one now, one after the next price run doubles the price.
//   MR4 fee:    fee == floor(5% of gross), principal == gross - fee, Dev Fund gets fee (random grosses).
//   MR5 decay:  same USD lock every 30 days from day 300 to day 4500: VCLM and CHONX
//       mints never increase, each step equals the spec formula, and the floor holds.
//   MR6 output token follows the lock record (control, expected PASS).
// Every relation result is appended to rerun-2026-10-23/metamorphic/relations.jsonl as
// soon as it finishes. Each run starts a fresh file. Lock ids are written truncated.
// MR3b: a backdated package is now refused (VF-ORC-011); the relation then also
// requires the honest resubmission of the same lock to mint exactly the honest amount.
const path = require("path");
const fs = require("fs");
const { createRequire } = require("module");
// VF-ORC-016: posted prices are USD per whole token with 30 decimals.
const P30 = (usd18) => BigInt(usd18) * 10n ** 12n;
const BC = path.resolve(__dirname, "../../base-contracts");
const req = createRequire(path.join(BC, "package.json"));
const { ethers, network } = req("hardhat");

const run = it;
const OUT = process.env.META_DIR || path.join(__dirname, "../rerun-2026-10-23/metamorphic");
const REL = process.env.META_OUT || path.join(OUT, "relations.jsonl");
const SCALE = 10n ** 18n;
const coder = ethers.AbiCoder.defaultAbiCoder();
const usd = (s) => ethers.parseUnits(String(s), 18);
const ETH_PRICE = usd("2000");
const MULT = { 3600: 10000, 604800: 10000, 2592000: 11500, 31536000: 25000, 315360000: 80000 };

function why(e) {
  const m = String(e && (e.shortMessage || e.message) || e);
  const r = m.match(/reverted with reason string '([^']+)'/) || m.match(/reason="([^"]+)"/);
  return r ? r[1] : m.slice(0, 160);
}
function rate(token, days) {
  let r = (token === 0 ? 10n : 100n) * SCALE; const fl = (token === 0 ? 1n : 10n) * SCALE;
  for (let i = 0n; i < days / 30n; i++) { r = (r * 983330000000000000n) / SCALE; if (r <= fl) { r = fl; break; } }
  return r;
}
function issuance(u, token, durBps, days) {
  let s = (u * rate(token, days)) / SCALE;
  s = (s * ((SCALE * 13000n) / 10000n)) / SCALE;
  return (s * ((SCALE * BigInt(durBps)) / 10000n)) / SCALE;
}
const near = (a, b, tol) => (a > b ? a - b : b - a) <= tol;

describe("METAMORPHIC rig (active, fails on any violation)", function () {
  this.timeout(0);
  let S, runId = 1n, done = new Set();
  const write = (o) => { fs.appendFileSync(REL, JSON.stringify(o) + "\n"); done.add(o.key); return o; };

  async function deploy() {
    const [deployer, user, recipient, dest, devFund] = await ethers.getSigners();
    const T = await ethers.getContractFactory("VinculumFinalisToken");
    const vclm = await T.deploy("Vinculum", "VCLM", 10_000_000_000n * SCALE);
    const chonx = await T.deploy("Chonx", "CHONX", 100_000_000_000n * SCALE);
    const verifier = await (await ethers.getContractFactory("VinculumFinalisVerifier")).deploy(await vclm.getAddress(), await chonx.getAddress());
    const stake = await (await ethers.getContractFactory("VinculumFinalisStake")).deploy(
      await vclm.getAddress(), await chonx.getAddress(), await vclm.getAddress(), await verifier.getAddress());
    await vclm.initialize(await verifier.getAddress(), await stake.getAddress());
    await chonx.initialize(await verifier.getAddress(), ethers.ZeroAddress);
    const lock = await (await ethers.getContractFactory("BaseCommitmentVaultLock")).deploy(
      "Base", devFund.address, await vclm.getAddress(), await chonx.getAddress(), await vclm.getAddress());
    await verifier.registerChainVerifier("Base", await (await (await ethers.getContractFactory("BaseLockRecordVerifier")).deploy(await lock.getAddress())).getAddress());
    await verifier.configureDevFund("Base", devFund.address);
    const ethId = await verifier.BASE_NATIVE_ETH_ASSET_ID();
    await verifier.registerAssetPrecision("Base", ethId, "ETH", 18, 2, 0);
    const tkn = await (await ethers.getContractFactory("TestFixtureERC20")).deploy(0);
    const tknId = ethers.id("Base:TKN");
    await verifier.registerAssetPrecision("Base", tknId, "TKN", 18, 2, 0);
    await verifier.registerTokenAddressBatch([{ environmentId: "Base", token: await tkn.getAddress(), canonicalAssetId: tknId }]);
    await verifier.setScheduledPricePoster(deployer.address);
    S = { deployer, user, recipient, dest, devFund, vclm, chonx, verifier, lock, ethId, tkn, tknId };
    await prices(ETH_PRICE);
    await verifier.finalize();
    S.launch = await verifier.protocolLaunchTimestamp();
  }
  async function prices(ethPrice) {
    await S.verifier.applyScheduledPriceRun(runId++, [
      { environmentId: "Base", canonicalAssetId: S.ethId, priceUsd30: P30(ethPrice), success: true },
      { environmentId: "Base", canonicalAssetId: S.tknId, priceUsd30: P30(usd("1")), success: true }]);
  }
  async function toDay(day) {
    const t = Number(S.launch) + day * 86400;
    const now = (await ethers.provider.getBlock("latest")).timestamp;
    if (t > now) { await network.provider.send("evm_setNextBlockTimestamp", [t]); await network.provider.send("evm_mine"); }
  }
  // create a native ETH lock worth `usdAmt` at ETH_PRICE (or given gross)
  async function mkLock({ usdAmt, gross, duration = 31536000, out = 0 }) {
    const g = gross ?? (usd(usdAmt) * SCALE + ETH_PRICE / 2n) / ETH_PRICE;
    const u = (g * ETH_PRICE) / SCALE;
    const lockId = ethers.hexlify(ethers.randomBytes(32));
    const d0 = await ethers.provider.getBalance(S.devFund.address);
    await (await S.lock.connect(S.user).createNativeLock(lockId, S.recipient.address, out, S.ethId, ethers.ZeroHash, S.dest.address, duration, u, { value: g })).wait();
    const rec = await S.lock.lockRecord(lockId);
    const d1 = await ethers.provider.getBalance(S.devFund.address);
    return { lockId, rec, gross: g, usdAt: u, out, devDelta: d1 - d0 };
  }
  function pkg(L, over = {}) {
    const r = L.rec;
    return Object.assign({
      sourceEnvironmentId: "Base", commitmentVaultLockId: L.lockId, handshakeAllowanceCount: 3,
      canonicalAssetId: S.ethId, assetPrecision: 18, assetCustodyClass: 2,
      grossAmountSmallestUnits: r.gross, actualFeeAmountSmallestUnits: r.fee, principalAmountSmallestUnits: r.principal,
      feeAssetId: S.ethId, devFundDestination: "dev", feeTransferEvidence: ethers.id("fee"),
      valuationTimestamp: r.createdAt, maturityTimestamp: r.maturity, durationSecs: r.duration,
      selectedOutputToken: L.out, baseRecipient: S.recipient.address, releaseDestination: "release",
      chonxActivationReceipt: "0x", racIdentity: ethers.hexlify(ethers.randomBytes(32)), priceRecord: "0x",
      sourceFinalityProof: "0x",
      lockEventProof: coder.encode(["bytes32", "uint256", "uint256", "uint256", "uint256", "uint256", "uint256"],
        [L.lockId, r.gross, r.fee, r.principal, r.duration, r.createdAt, r.maturity]),
    }, over);
  }
  async function submit(L, over = {}, { record = true } = {}) {
    const p = pkg(L, over);
    const tok = L.out === 0 ? S.vclm : S.chonx;
    const b0 = await tok.balanceOf(S.recipient.address);
    try {
      if (record) await S.verifier.recordFeeAndRac(p);
      await S.verifier.verifyAndMint(p, 0);
      return { ok: true, minted: (await tok.balanceOf(S.recipient.address)) - b0 };
    } catch (e) { return { ok: false, err: why(e) }; }
  }
  const s = (x) => (typeof x === "bigint" ? x.toString() : x);
  const day = async () => Number((BigInt((await ethers.provider.getBlock("latest")).timestamp) - S.launch) / 86400n);

  run("relations", async () => {
    fs.mkdirSync(path.dirname(REL), { recursive: true });
    if (fs.existsSync(REL)) fs.unlinkSync(REL); // always a fresh, complete run
    await deploy();

    // MR4 fee (random grosses, native and ERC-20)
    for (let i = 0; i < 40; i++) {
      const key = "MR4|" + i; if (done.has(key)) continue;
      const native = i % 2 === 0;
      // at least $0.01: ETH at $2000 needs >= 5e12 wei; TKN at $1 needs >= 1e16
      const g = 10n ** BigInt((native ? 13 : 16) + (i % 6)) + BigInt(Math.floor(Math.random() * 1e9)) * 7919n + BigInt(i);
      let fee, principal, devDelta, err;
      try {
        if (native) { const L = await mkLock({ gross: g }); ({ fee, principal } = L.rec); devDelta = L.devDelta; }
        else {
          await S.tkn.mint(S.user.address, g); await S.tkn.connect(S.user).approve(await S.lock.getAddress(), g);
          const id = ethers.hexlify(ethers.randomBytes(32));
          const d0 = await S.tkn.balanceOf(S.devFund.address);
          await (await S.lock.connect(S.user).createErc20Lock(id, S.recipient.address, 0, S.tknId, ethers.ZeroHash, S.dest.address, 31536000, await S.tkn.getAddress(), g, g)).wait();
          ({ fee, principal } = await S.lock.lockRecord(id)); devDelta = (await S.tkn.balanceOf(S.devFund.address)) - d0;
        }
      } catch (e) { err = why(e); }
      const pass = !err && fee === (g * 500n) / 10000n && principal === g - fee && devDelta === fee;
      write({ key, mr: "MR4 fee", asset: native ? "ETH" : "TKN", gross: s(g), fee: s(fee), principal: s(principal), devfund_delta: s(devDelta), err, verdict: err ? "ERROR:" + err : pass ? "PASS" : "VIOLATION" });
    }

    // MR1 scale and MR2 split at several durations, VCLM, day 0
    for (const dur of [604800, 31536000, 315360000]) for (const u of ["5", "50"]) {
      let key = `MR1|${dur}|${u}`;
      if (!done.has(key)) {
        const A = await mkLock({ usdAmt: u, duration: dur }), B = await mkLock({ gross: (await mkLockGrossFor(u)) * 2n, duration: dur });
        const a = await submit(A), b = await submit(B);
        const ok = a.ok && b.ok && near(b.minted, 2n * a.minted, 2n);
        write({ key, mr: "MR1 scale x2", duration: dur, usd: u, mint_1x: s(a.minted), mint_2x: s(b.minted), errs: [a.err, b.err].filter(Boolean), verdict: ok ? "PASS" : "VIOLATION" });
      }
      key = `MR2|${dur}|${u}`;
      if (!done.has(key)) {
        const g = await mkLockGrossFor(u);
        const W = await mkLock({ gross: g * 2n, duration: dur }), H1 = await mkLock({ gross: g, duration: dur }), H2 = await mkLock({ gross: g, duration: dur });
        const w = await submit(W), h1 = await submit(H1), h2 = await submit(H2);
        const ok = w.ok && h1.ok && h2.ok && near(w.minted, h1.minted + h2.minted, 2n);
        const feeOk = W.rec.fee - (H1.rec.fee + H2.rec.fee);
        write({ key, mr: "MR2 split in two", duration: dur, usd_each_half: u, mint_whole: s(w.minted), mint_halves_sum: s(ok || (h1.ok && h2.ok) ? h1.minted + h2.minted : null),
          fee_whole_minus_halves_wei: s(feeOk), errs: [w.err, h1.err, h2.err].filter(Boolean), verdict: ok ? "PASS" : "VIOLATION" });
      }
    }
    async function mkLockGrossFor(u) { return (usd(u) * SCALE + ETH_PRICE / 2n) / ETH_PRICE; }

    // CHONX activation: one large VCLM lock (~$100k, 10-year) pushes lifetime VCLM past 10M
    if (!(await S.verifier.chonxActivated())) {
      const big = await mkLock({ usdAmt: "100000", duration: 315360000 });
      const r = await submit(big);
      await S.verifier.connect(S.deployer).lifetimeVclmIssued().catch(() => 0n);
      write({ key: "SETUP|chonx_activation|" + Date.now(), mr: "setup", lock: big.lockId.slice(0, 10), ok: r.ok, minted: s(r.minted), err: r.err, chonx_activated: await S.verifier.chonxActivated() });
    }

    // MR6 output token follows the lock record (control)
    if (!done.has("MR6")) {
      const L = await mkLock({ usdAmt: "5", out: 0 });
      const r = await submit(L, { selectedOutputToken: 1 });
      write({ key: "MR6", mr: "MR6 output token follows lock record", lock_output: 0, package_output: 1, accepted: r.ok, err: r.err, verdict: r.ok ? "VIOLATION" : "PASS" });
    }

    // MR3 submission-time invariance, from day 10
    await toDay(10);
    for (const out of [0, 1]) {
      let key = "MR3a|" + out;
      if (!done.has(key)) {
        const A = await mkLock({ usdAmt: "5", out }), B = await mkLock({ usdAmt: "5", out });
        const a = await submit(A);
        const d0 = await day(); await toDay(d0 + 45); await prices(ETH_PRICE);
        const b = await submit(B);
        write({ key, mr: "MR3a same price, submitted 45 days later", output: out, mint_now: s(a.minted), mint_later: s(b.minted), errs: [a.err, b.err].filter(Boolean), verdict: a.ok && b.ok && a.minted === b.minted ? "PASS" : "VIOLATION" });
      }
      key = "MR3b|" + out;
      if (!done.has(key)) {
        await toDay((await day()) + 200);
        const A = await mkLock({ usdAmt: "5", out }), B = await mkLock({ usdAmt: "5", out });
        const a = await submit(A);
        const b = await submit(B, { valuationTimestamp: S.launch });
        const h = b.ok ? null : await submit(B);
        write({ key, mr: "MR3b package valuationTimestamp set to launch", output: out, lock_day: await day(), mint_honest: s(a.minted), mint_backdated: s(b.minted), backdated_accepted: b.ok,
          backdated_err: b.err, honest_resubmit: h ? s(h.minted) : null,
          ratio: a.ok && b.ok && a.minted > 0n ? Number((b.minted * 10000n) / a.minted) / 10000 : null, errs: [a.err, h && h.err].filter(Boolean),
          verdict: !b.ok ? (/VF-ORC-011/.test(b.err || "") && a.ok && h.ok && h.minted === a.minted ? "PASS" : "VIOLATION") : a.ok && a.minted === b.minted ? "PASS" : "VIOLATION" });
      }
      key = "MR3c|" + out;
      if (!done.has(key)) {
        const A = await mkLock({ usdAmt: "5", out }), B = await mkLock({ usdAmt: "5", out });
        const a = await submit(A);
        await prices(ETH_PRICE * 2n);
        const b = await submit(B);
        await prices(ETH_PRICE);
        write({ key, mr: "MR3c next price run doubles the price before the second submission", output: out, mint_first: s(a.minted), mint_after_price_run: s(b.minted),
          ratio: a.ok && b.ok && a.minted > 0n ? Number((b.minted * 10000n) / a.minted) / 10000 : null, errs: [a.err, b.err].filter(Boolean), verdict: a.ok && b.ok && a.minted === b.minted ? "PASS" : "VIOLATION" });
      }
    }

    // MR5 decay sweep: day 300 .. 4500 step 30
    const prev = { 0: null, 1: null };
    for (let d = 300; d <= 4500; d += 30) {
      for (const out of [0, 1]) {
        const key = `MR5|${out}|${d}`;
        if (done.has(key)) { prev[out] = null; continue; }
        await toDay(d); await prices(ETH_PRICE);
        const L = await mkLock({ usdAmt: "5", out });
        const r = await submit(L);
        const lockDay = Number((L.rec.createdAt - S.launch) / 86400n);
        const exp = issuance(L.usdAt, out, 25000, BigInt(lockDay));
        const floorAmt = issuance(L.usdAt, out, 25000, 100000n);
        const mono = prev[out] === null || (r.ok && r.minted <= prev[out]);
        const v = !r.ok ? "ERROR:" + r.err : r.minted !== exp ? "VIOLATION:formula" : !mono ? "VIOLATION:increase" : r.minted < floorAmt ? "VIOLATION:below_floor" : "PASS";
        write({ key, mr: "MR5 decay", output: out ? "CHONX" : "VCLM", day: lockDay, minted: s(r.minted), expected: s(exp), at_floor: r.ok && r.minted === floorAmt, verdict: v });
        prev[out] = r.ok ? r.minted : null;
      }
    }
    // MR3b at the end of the sweep (largest gap from launch)
    for (const out of [0, 1]) {
      const key = "MR3b_late|" + out; if (done.has(key)) continue;
      const A = await mkLock({ usdAmt: "5", out }), B = await mkLock({ usdAmt: "5", out });
      const a = await submit(A), b = await submit(B, { valuationTimestamp: S.launch });
      const h = b.ok ? null : await submit(B);
      write({ key, mr: "MR3b package valuationTimestamp set to launch (late)", output: out, lock_day: await day(), mint_honest: s(a.minted), mint_backdated: s(b.minted), backdated_accepted: b.ok,
        backdated_err: b.err, honest_resubmit: h ? s(h.minted) : null,
        ratio: a.ok && b.ok && a.minted > 0n ? Number((b.minted * 10000n) / a.minted) / 10000 : null, errs: [a.err, h && h.err].filter(Boolean),
        verdict: !b.ok ? (/VF-ORC-011/.test(b.err || "") && a.ok && h.ok && h.minted === a.minted ? "PASS" : "VIOLATION") : a.ok && a.minted === b.minted ? "PASS" : "VIOLATION" });
    }

    const rows = fs.readFileSync(REL, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
    const setup = rows.filter((o) => o.mr === "setup");
    const rel = rows.filter((o) => o.mr !== "setup");
    const counts = {};
    for (const o of rel) counts[o.verdict] = (counts[o.verdict] || 0) + 1;
    fs.writeFileSync(path.join(path.dirname(REL), "summary.json"), JSON.stringify({ relations: rel.length, verdicts: counts, chonx_activated: setup.every((o) => o.chonx_activated) }, null, 2) + "\n");
    console.log(`      ${rel.length} relations ${JSON.stringify(counts)}`);
    const bad = rel.filter((o) => o.verdict !== "PASS");
    if (bad.length) console.log(bad.slice(0, 10).map((o) => JSON.stringify(o)).join("\n"));
    require("assert").ok(setup.length === 1 && setup[0].chonx_activated === true, "CHONX activation setup failed");
    require("assert").strictEqual(bad.length, 0, `${bad.length} relations violated`);
  });
});
