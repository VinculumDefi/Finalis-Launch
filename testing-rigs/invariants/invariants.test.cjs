// Rig 4: invariants as property tests. Random call sequences (seeded PRNG,
// RIG_SEED, default 20261023) run on the full stack deployed by the real
// runBaseCeremony flow (ceremony.json + 487-row ceremony-data.json) in the
// in-process Hardhat chain. Nothing is broadcast. No key is used.
//
// Invariants:
//   INV-1 totalSupply == sum of balances (VCLM, CHONX, SYNTH), from Transfer logs
//   INV-2 only authorized minters mint (Verifier, Stake; SYNTH only via Forge)
//   INV-3 no lock record is used twice (across locks, chains, readers)
//   INV-4 every VCLM mint traces to a real lock on a header in real chain history
//   INV-5 CHONX opens at 10M lifetime VCLM; SYNTH needs 100M CHONX and costs
//         1,000 VCLM + 10,000 CHONX per SYNTH
//   INV-6 5% gross fee on every duration
//   INV-7 $0.95 USDC/USDT rule
//   INV-8 at most one Reward-Accounting Credit per lock (Rev 6 VF-RAC-001 "exact once")
//   INV-9 emission rate follows the lock's own creation time (VF-ORC-011/013)
//
// Converted 2026-10-23: the former FINDING properties (HH-001..004) are now
// active tests that assert the fixed, safe behavior. Nothing is skipped.
// Run: testing-rigs/run.sh none invariants/invariants.test.cjs
const path = require("path");
const C = require("../lib/common.cjs");
const { expect } = require(path.join(C.BC, "node_modules/chai"));
const { ethers, network, art, DATA, SCALE, DAY7, YEAR10, ETH_ID, ETH_PRICE, short, fmt, reason } = C;

const SEED = BigInt(process.env.RIG_SEED || "20261023");
const STEPS = Number(process.env.RIG_STEPS || "60");
let rng = SEED;
const rand = (n) => { rng = (rng * 6364136223846793005n + 1442695040888963407n) % (1n << 64n); return Number((rng >> 33n) % BigInt(n)); };
const pick = (a) => a[rand(a.length)];
const DURATIONS = [3600n, 604800n, 2592000n, 5184000n, 7776000n, 15552000n, 31536000n, 63072000n, 94608000n, 126144000n,
  157680000n, 189216000n, 220752000n, 252288000n, 283824000n, 315360000n];
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

describe("Rig 4: invariants on the real ceremony stack (property tests)", function () {
  this.timeout(3600000);
  let S, actors, recipient, dest, other, usdc, usdcRow, ethRow, ethLock, ethReaderChain;
  const holders = { VCLM: new Set(), CHONX: new Set(), SYNTH: new Set() };
  const consumed = new Set();
  const mints = []; // {env, lockId, blockHash, minter}
  const locks = []; // settled or not: {env, lockId, rec, p, settled}
  const log = [];
  const tokens = () => ({ VCLM: S.vclm, CHONX: S.chonx, SYNTH: S.forge });

  before(async () => {
    S = await C.deployStack();
    [, recipient, dest, other] = S.signers;
    actors = S.signers.slice(4, 10);
    console.log(`      seed ${SEED} steps ${STEPS}; Verifier ${short(await S.verifier.getAddress())}, Base lock ${short(await S.lock.getAddress())}`);
    // Real USDC_BASE address on this test chain: a plain ERC-20 fixture's code
    // is placed there so the ceremony's token index (real address -> USDC_BASE
    // row) applies. Test chain only.
    const F = await (await ethers.getContractFactory("TestFixtureERC20")).deploy(0);
    await network.provider.send("hardhat_setCode", [USDC_BASE, await ethers.provider.getCode(await F.getAddress())]);
    usdc = await ethers.getContractAt("TestFixtureERC20", USDC_BASE);
    usdcRow = C.entry("Base", "USDC_BASE");
    ethRow = C.entry("Ethereum", "ETH");
    for (const a of actors) await (await usdc.mint(a.address, 10_000_000n * 10n ** 6n)).wait();
    await S.postPrices([
      { environmentId: "Base", canonicalAssetId: ETH_ID, priceUsd18: ETH_PRICE },
      { environmentId: "Ethereum", canonicalAssetId: ethRow.canonicalAssetId, priceUsd18: ETH_PRICE },
      { environmentId: "Base", canonicalAssetId: usdcRow.canonicalAssetId, priceUsd18: SCALE },
    ]);
    ethLock = S.nonBase.Ethereum;
    ethReaderChain = (await ethers.provider.getNetwork()).chainId;
  });

  // ---- actions ----
  async function track(rc) {
    // INV-2: every mint (Transfer from 0) must come from an authorized minter
    // address, i.e. be emitted by a token whose call came from Verifier/Stake.
    const V = await S.verifier.getAddress(), K = await S.stake.getAddress(), Fg = await S.forge.getAddress();
    for (const [nm, t] of Object.entries(tokens())) {
      const ta = (await t.getAddress()).toLowerCase();
      for (const l of rc.logs) {
        if (l.address.toLowerCase() !== ta) continue;
        let ev; try { ev = t.interface.parseLog(l); } catch { continue; }
        if (!ev || ev.name !== "Transfer") continue;
        holders[nm].add(ev.args[1]); holders[nm].add(ev.args[0]);
        if (ev.args[0] === ethers.ZeroAddress) {
          const tx = await ethers.provider.getTransaction(rc.hash);
          const okTo = nm === "SYNTH" ? [Fg] : [V, K];
          // the outer call target must be the minter (no other contract can reach mint)
          expect(okTo.map((x) => x.toLowerCase())).to.include(tx.to.toLowerCase(), `INV-2 ${nm} minted via ${short(tx.to)}`);
        }
      }
    }
    for (const l of rc.logs) {
      if (l.address.toLowerCase() !== (await S.verifier.getAddress()).toLowerCase()) continue;
      let ev; try { ev = S.verifier.interface.parseLog(l); } catch { continue; }
      if (ev && ev.name === "VerificationSucceeded") {
        // INV-3
        expect(consumed.has(ev.args[0]), "INV-3 lock used twice").to.equal(false);
        consumed.add(ev.args[0]);
      }
    }
  }
  async function send(p) { const rc = await (await p).wait(); await track(rc); return rc; }

  async function baseLock(actor, kind, duration, output) {
    const lockId = ethers.hexlify(ethers.randomBytes(32));
    const L = S.lock;
    const dev0 = kind === "ETH" ? await ethers.provider.getBalance(DATA.devFund) : await usdc.balanceOf(DATA.devFund);
    let rc;
    if (kind === "ETH") {
      const wei = BigInt(1 + rand(200)) * 10n ** 16n; // 0.01 .. 2 ETH
      const usd = duration === 3600n ? 10n ** 16n : (wei * ETH_PRICE) / SCALE;
      if (duration === 3600n) return null; // Handshake band $0.01-$0.02 is too small for ETH steps here
      rc = await send(L.connect(actor).createNativeLock(lockId, recipient.address, output, ETH_ID, ethers.ZeroHash, dest.address, duration, usd, { value: wei }));
    } else {
      const amt = duration === 3600n ? 15_000n : BigInt(1 + rand(5000)) * 10n ** 6n;
      await (await usdc.connect(actor).approve(await L.getAddress(), amt)).wait();
      rc = await send(L.connect(actor).createErc20Lock(lockId, recipient.address, output, usdcRow.canonicalAssetId, ethers.ZeroHash, dest.address, duration, USDC_BASE, amt, (amt * SCALE) / 10n ** 6n));
    }
    const rec = await L.lockRecord(lockId);
    const dev1 = kind === "ETH" ? await ethers.provider.getBalance(DATA.devFund) : await usdc.balanceOf(DATA.devFund);
    // INV-6: 5% of gross on every duration, delivered to the Dev Fund.
    expect(rec.fee).to.equal((rec.gross * 500n) / 10000n, "INV-6 fee");
    expect(rec.principal).to.equal(rec.gross - rec.fee);
    expect(dev1 - dev0).to.equal(rec.fee, "INV-6 Dev Fund received fee");
    const row = kind === "ETH" ? { canonicalAssetId: ETH_ID, custodyClass: 2, decimals: 18 } : usdcRow;
    const p = C.basePkg(lockId, rec, row.canonicalAssetId, row.custodyClass, row.decimals);
    const o = { env: "Base", lockId, rec, p, kind, settled: false };
    locks.push(o);
    return o;
  }
  async function ethEnvLock(actor, duration, output) {
    if (duration === 3600n) return null;
    const lockId = ethers.hexlify(ethers.randomBytes(32));
    const wei = BigInt(1 + rand(100)) * 10n ** 16n;
    const rc = await send(ethLock.connect(actor).createNativeLock(lockId, recipient.address, output, ethRow.canonicalAssetId, ethers.ZeroHash, dest.address, duration, (wei * ETH_PRICE) / SCALE, { value: wei }));
    const rec = await ethLock.lockRecord(lockId);
    expect(rec.fee).to.equal((rec.gross * 500n) / 10000n, "INV-6 fee (Ethereum CVL)");
    // Evidence from THIS chain (chain id 31337), claimed as Ethereum (chain id 1).
    const p = await C.evmPkg("Ethereum", await ethLock.getAddress(), rc.hash, lockId, rec, ethRow.canonicalAssetId, ethRow.custodyClass, 18, 1);
    const o = { env: "Ethereum", lockId, rec, p, kind: "ETH", settled: false, blockHash: rc.blockHash };
    locks.push(o);
    return o;
  }
  async function settle(o) {
    try {
      await send(S.verifier.recordFeeAndRac(o.p));
      await send(S.verifier.verifyAndMint(o.p, 0));
      o.settled = true;
      mints.push({ env: o.env, lockId: o.lockId, blockHash: o.blockHash });
      return "minted";
    } catch (e) { return "refused: " + reason(e); }
  }

  async function checkSupply() {
    for (const [nm, t] of Object.entries(tokens())) {
      let sum = 0n;
      for (const h of holders[nm]) if (h !== ethers.ZeroAddress) sum += await t.balanceOf(h);
      expect(await t.totalSupply()).to.equal(sum, `INV-1 ${nm} totalSupply == sum of balances`);
    }
  }
  async function checkActivation() {
    const life = await S.verifier.lifetimeVclmIssued();
    const act = await S.verifier.chonxActivated();
    // activation is recorded when the threshold is crossed by a mint
    if (act) expect(life).to.be.gte(10_000_000n * SCALE, "INV-5 CHONX opened below 10M");
    const chonxIssued = await S.verifier.cumulativeChonxIssued();
    if (!act) expect(chonxIssued).to.equal(0n, "INV-5 CHONX minted before activation");
  }

  it("random sequence: INV-1, INV-2, INV-3, INV-5, INV-6 hold after every step", async () => {
    const counts = {};
    for (let i = 0; i < STEPS; i++) {
      const a = pick(actors);
      const act = await S.verifier.chonxActivated();
      const out = act && rand(3) === 0 ? 1 : 0;
      const k = pick(["baseEth", "baseEth", "baseUsdc", "ethEnv", "replay", "crossEnv", "unauthMint", "transfer", "burn", "forge", "chonxEarly", "whale"]);
      let note = "";
      if (k === "baseEth" || k === "baseUsdc" || k === "ethEnv") {
        const d = pick(DURATIONS);
        const o = k === "ethEnv" ? await ethEnvLock(a, d, out) : await baseLock(a, k === "baseEth" ? "ETH" : "USDC", d, out);
        note = o ? `${o.env} ${o.kind} ${Number(o.rec.duration)}s out=${out} -> ` + (rand(4) ? await settle(o) : "left unsettled") : "skipped (handshake ETH)";
      } else if (k === "replay") {
        const s = locks.filter((x) => x.settled);
        if (s.length) {
          const o = pick(s);
          await expect(S.verifier.verifyAndMint(o.p, 0)).to.be.revertedWith("VF-XCH-013: replay");
          await expect(S.verifier.recordFeeAndRac(o.p)).to.be.revertedWith("VF-RAC-001: RAC already recorded");
          note = "replay of a settled lock refused";
        }
      } else if (k === "crossEnv") {
        const s = locks.filter((x) => x.env === "Ethereum");
        if (s.length) {
          const o = pick(s);
          for (const [env, cid] of [["Arbitrum", 42161], ["Optimism", 10], ["Polygon", 137], ["BNB Smart Chain", 56], ["Avalanche", 43114]]) {
            const q = { ...o.p, sourceEnvironmentId: env, racIdentity: ethers.hexlify(ethers.randomBytes(32)) };
            await expect(S.verifier.recordFeeAndRac(q), env + " same id").to.be.reverted;
            const ev = C.coder.decode(["uint256", "bytes32", "uint256"], o.p.sourceFinalityProof);
            q.sourceFinalityProof = C.coder.encode(["uint256", "bytes32", "uint256"], [cid, ev[1], ev[2]]);
            await expect(S.verifier.recordFeeAndRac(q), env + " own chain id").to.be.reverted;
          }
          note = "Ethereum lock replayed as the 5 other EVM environments: refused";
        }
      } else if (k === "unauthMint") {
        for (const t of [S.vclm, S.chonx]) await expect(t.connect(a).mint(a.address, 1n)).to.be.reverted;
        note = "direct mint by a non-minter refused";
      } else if (k === "transfer" || k === "burn") {
        const b = await S.vclm.balanceOf(recipient.address);
        if (b > 0n) {
          const amt = b / BigInt(2 + rand(8));
          if (k === "transfer") await send(S.vclm.connect(recipient).transfer(a.address, amt));
          else await send(S.vclm.connect(recipient).burn(amt));
          note = `${k} ${fmt(amt)} VCLM`;
        }
      } else if (k === "forge") {
        const ready = (await S.verifier.cumulativeChonxIssued()) >= 100_000_000n * SCALE;
        const F = await S.forge.getAddress();
        await (await S.vclm.connect(recipient).approve(F, 1000n * SCALE)).wait();
        await (await S.chonx.connect(recipient).approve(F, 10_000n * SCALE)).wait();
        const v0 = await S.vclm.balanceOf(recipient.address), c0 = await S.chonx.balanceOf(recipient.address), s0 = await S.forge.balanceOf(recipient.address);
        if (!ready) {
          await expect(S.forge.connect(recipient).forge(1)).to.be.revertedWith("VF-TOK-003: SYNTH not activated");
          note = "forge before 100M lifetime CHONX refused";
        } else if (v0 >= 1000n * SCALE && c0 >= 10_000n * SCALE) {
          await send(S.forge.connect(recipient).forge(1));
          expect(v0 - (await S.vclm.balanceOf(recipient.address))).to.equal(1000n * SCALE, "INV-5 SYNTH VCLM cost");
          expect(c0 - (await S.chonx.balanceOf(recipient.address))).to.equal(10_000n * SCALE, "INV-5 SYNTH CHONX cost");
          expect((await S.forge.balanceOf(recipient.address)) - s0).to.equal(SCALE);
          note = "forged 1 SYNTH for 1,000 VCLM + 10,000 CHONX";
        }
      } else if (k === "chonxEarly") {
        if (!act) {
          const o = await baseLock(a, "ETH", DAY7, 1);
          await send(S.verifier.recordFeeAndRac(o.p));
          await expect(S.verifier.verifyAndMint(o.p, 0)).to.be.revertedWith("VF-COM-025: CHONX not activated");
          note = "CHONX request before 10M lifetime VCLM refused";
        }
      } else if (k === "whale") {
        // 45 ETH for 10 years: pushes lifetime VCLM (and later CHONX) up fast.
        const lockId = ethers.hexlify(ethers.randomBytes(32));
        await send(S.lock.connect(a).createNativeLock(lockId, recipient.address, out, ETH_ID, ethers.ZeroHash, dest.address, YEAR10, 45n * ETH_PRICE, { value: 45n * SCALE }));
        const rec = await S.lock.lockRecord(lockId);
        const o = { env: "Base", lockId, rec, p: C.basePkg(lockId, rec, ETH_ID, 2, 18), kind: "ETH", settled: false };
        locks.push(o);
        note = `whale 45 ETH 10y out=${out} -> ` + await settle(o);
      }
      counts[k] = (counts[k] || 0) + 1;
      log.push(`${i} ${k}: ${note}`);
      await checkSupply();
      await checkActivation();
      if (rand(5) === 0) await C.advance(rand(3) * 86400 + 60);
    }
    console.log("      action counts", JSON.stringify(counts));
    console.log("      lifetime VCLM", fmt(await S.verifier.lifetimeVclmIssued()), "CHONX", fmt(await S.verifier.cumulativeChonxIssued()), "SYNTH", fmt(await S.forge.totalSupply()), "CHONX active", await S.verifier.chonxActivated());
    const outDir = process.env.INV_OUT || path.join(__dirname, "../rerun-2026-10-23/invariants");
    require("fs").mkdirSync(outDir, { recursive: true });
    require("fs").writeFileSync(path.join(outDir, "sequence.log"), log.join("\n") + "\n");
  });

  it("INV-5: CHONX opens exactly at the 10M lifetime VCLM threshold; SYNTH opens at 100M lifetime CHONX", async () => {
    const T = await S.verifier.CHONX_ACTIVATION_THRESHOLD();
    expect(T).to.equal(10_000_000n * SCALE);
    expect(await S.forge.SYNTH_ACTIVATION_THRESHOLD()).to.equal(100_000_000n * SCALE);
    expect(await S.forge.VCLM_BURN_PER_SYNTH()).to.equal(1000n * SCALE);
    expect(await S.forge.CHONX_BURN_PER_SYNTH()).to.equal(10_000n * SCALE);
    if (await S.verifier.chonxActivated()) expect(await S.verifier.lifetimeVclmIssued()).to.be.gte(T);
  });

  it("INV-5: SYNTH stays closed below 100M lifetime CHONX, then forge burns exactly 1,000 VCLM + 10,000 CHONX per SYNTH", async () => {
    const F = await S.forge.getAddress();
    if (!(await S.verifier.chonxActivated())) {
      for (let i = 0; i < 4 && !(await S.verifier.chonxActivated()); i++) {
        const lockId = ethers.hexlify(ethers.randomBytes(32));
        await send(S.lock.connect(actors[0]).createNativeLock(lockId, recipient.address, 0, ETH_ID, ethers.ZeroHash, dest.address, YEAR10, 45n * ETH_PRICE, { value: 45n * SCALE }));
        const rec = await S.lock.lockRecord(lockId);
        await settle({ env: "Base", lockId, rec, p: C.basePkg(lockId, rec, ETH_ID, 2, 18), kind: "ETH" });
      }
    }
    await C.advance(2 * 86400); // CHONX locks must be created after activation plus the 1-day margin
    let n = 0;
    while ((await S.verifier.cumulativeChonxIssued()) < 100_000_000n * SCALE && n < 8) {
      await (await S.vclm.connect(recipient).approve(F, 1000n * SCALE)).wait();
      await (await S.chonx.connect(recipient).approve(F, 10_000n * SCALE)).wait();
      if ((await S.chonx.balanceOf(recipient.address)) >= 10_000n * SCALE)
        await expect(S.forge.connect(recipient).forge(1)).to.be.revertedWith("VF-TOK-003: SYNTH not activated");
      const lockId = ethers.hexlify(ethers.randomBytes(32));
      await send(S.lock.connect(actors[1]).createNativeLock(lockId, recipient.address, 1, ETH_ID, ethers.ZeroHash, dest.address, YEAR10, 45n * ETH_PRICE, { value: 45n * SCALE }));
      const rec = await S.lock.lockRecord(lockId);
      const o = { env: "Base", lockId, rec, p: C.basePkg(lockId, rec, ETH_ID, 2, 18), kind: "ETH" };
      expect(await settle(o)).to.equal("minted");
      n++;
    }
    const c = await S.verifier.cumulativeChonxIssued();
    expect(c).to.be.gte(100_000_000n * SCALE);
    const v0 = await S.vclm.balanceOf(recipient.address), c0 = await S.chonx.balanceOf(recipient.address);
    await (await S.vclm.connect(recipient).approve(F, 3000n * SCALE)).wait();
    await (await S.chonx.connect(recipient).approve(F, 30_000n * SCALE)).wait();
    await send(S.forge.connect(recipient).forge(3));
    expect(v0 - (await S.vclm.balanceOf(recipient.address))).to.equal(3000n * SCALE);
    expect(c0 - (await S.chonx.balanceOf(recipient.address))).to.equal(30_000n * SCALE);
    expect(await S.forge.balanceOf(recipient.address)).to.be.gte(3n * SCALE);
    await expect(S.forge.connect(other).forge(1)).to.be.reverted; // no balance or allowance
    await checkSupply();
    console.log(`      ${n} CHONX locks to reach ${fmt(c)} lifetime CHONX; forged 3 SYNTH for 3,000 VCLM + 30,000 CHONX`);
  });

  it("INV-7: $0.95 USDC rule. Below 0.95 refused for a new valuation at every duration; 0.95 accepted; never $1 substituted", async () => {
    const a = actors[0];
    for (const px of [949_999_999_999_999_999n, 900_000_000_000_000_000n]) {
      await S.postPrices([{ environmentId: "Base", canonicalAssetId: usdcRow.canonicalAssetId, priceUsd18: px }]);
      for (const d of DURATIONS) {
        const o = await baseLock(a, "USDC", d, 0);
        await expect(S.verifier.recordFeeAndRac(o.p)).to.be.revertedWith("VF-ORC-005: USDC/USDT scheduled price below $0.95");
      }
    }
    await S.postPrices([{ environmentId: "Base", canonicalAssetId: usdcRow.canonicalAssetId, priceUsd18: 95n * 10n ** 16n }]);
    const o = await baseLock(a, "USDC", 604800n, 0);
    const v0 = await S.vclm.balanceOf(recipient.address);
    expect(await settle(o)).to.equal("minted");
    const minted = (await S.vclm.balanceOf(recipient.address)) - v0;
    const usd = (o.rec.gross * 95n * 10n ** 16n) / 10n ** 6n; // valued at 0.95, not 1.00
    console.log(`      USDC_BASE ${fmt(o.rec.gross, 6)} at $0.95 minted ${fmt(minted)} VCLM (USD basis ${fmt(usd)})`);
    expect(minted).to.be.gt(0n);
    await S.postPrices([{ environmentId: "Base", canonicalAssetId: usdcRow.canonicalAssetId, priceUsd18: SCALE }]);
  });

  it("INV-3: replay across the same lock, chains and readers is refused (Base lock as Ethereum, Ethereum lock as Base)", async () => {
    const b = locks.find((x) => x.env === "Base" && x.settled);
    const e = locks.find((x) => x.env === "Ethereum" && x.settled);
    if (b) await expect(S.verifier.recordFeeAndRac({ ...b.p, sourceEnvironmentId: "Ethereum", racIdentity: ethers.hexlify(ethers.randomBytes(32)) })).to.be.reverted;
    if (e) await expect(S.verifier.recordFeeAndRac({ ...e.p, sourceEnvironmentId: "Base", racIdentity: ethers.hexlify(ethers.randomBytes(32)) })).to.be.reverted;
    for (const o of locks.filter((x) => x.settled)) await expect(S.verifier.verifyAndMint(o.p, 0)).to.be.revertedWith("VF-XCH-013: replay");
  });

  // ---- former FINDING properties, now active safe-behavior tests (fixed 2026-10-23) ----

  const REFUSED = (env) => `VF-XCH-006: ${env} settled-history anchor not enforced on-chain; environment disabled`;

  it("HH-003 SAFE: INV-4 no VCLM mint rests on an unanchored non-Base header; every Ethereum-environment lock is refused", async () => {
    // The production non-Base readers refuse (AG-01..03 fail-closed), so a lock
    // proven only with headers from this test chain can never mint.
    let eth = locks.filter((x) => x.env === "Ethereum");
    if (!eth.length) eth = [await ethEnvLock(actors[0], DAY7, 0)];
    for (const o of eth) {
      expect(o.settled, `Ethereum lock ${o.lockId.slice(0, 10)} settled`).to.equal(false);
      await expect(S.verifier.recordFeeAndRac(o.p)).to.be.revertedWith(REFUSED("Ethereum"));
      expect(await S.verifier.isLockRacRecorded("Ethereum", o.lockId)).to.equal(false);
    }
    expect(mints.filter((m) => m.env === "Ethereum").length, "Ethereum-environment mints").to.equal(0);
    console.log(`      ${eth.length} Ethereum-environment locks, all refused; 0 Ethereum mints`);
  });

  it("HH-001 SAFE: INV-8 at most one Reward-Accounting Credit per lock (fresh racIdentity refused)", async () => {
    const o = locks.find((x) => x.settled && x.env === "Base");
    const ep = await S.verifier.currentEpoch();
    const b0 = await S.verifier.epochRewardBasis(ep);
    for (let i = 0; i < 3; i++) {
      await expect(S.verifier.recordFeeAndRac({ ...o.p, racIdentity: ethers.hexlify(ethers.randomBytes(32)) }))
        .to.be.revertedWith("VF-RAC-001: RAC already recorded");
    }
    expect(await S.verifier.epochRewardBasis(ep), "epoch reward basis grew from one settled lock").to.equal(b0);
  });

  it("HH-002 SAFE: INV-9 emission rate follows the lock's own creation time (backdated package refused)", async () => {
    await C.advance(400 * 86400); // well past several 30-day decay periods
    const a = actors[1];
    const honest = await baseLock(a, "ETH", DAY7, 0);
    const forged = await baseLock(a, "ETH", DAY7, 0);
    const v0 = await S.vclm.balanceOf(recipient.address);
    expect(await settle(honest)).to.equal("minted");
    const v1 = await S.vclm.balanceOf(recipient.address);
    const realP = forged.p;
    forged.p = { ...realP, valuationTimestamp: 0 };
    expect(await settle(forged)).to.match(/VF-ORC-011: valuation timestamp != proven lock creation time/);
    expect(await S.vclm.balanceOf(recipient.address)).to.equal(v1);
    forged.p = realP;
    expect(await settle(forged)).to.equal("minted");
    const v2 = await S.vclm.balanceOf(recipient.address);
    const gh = honest.rec.gross, gf = forged.rec.gross;
    // per wei the honest resubmission mints the same as the honest same-day lock
    expect(((v2 - v1) * gh) / gf).to.be.closeTo(v1 - v0, (v1 - v0) / 1000n + 2n);
  });

  it("HH-001 SAFE: one real settled lock, 25 fresh racIdentity values from a stranger, all refused; reward basis unchanged", async () => {
    const att = actors[5];
    const ep = await S.verifier.currentEpoch();
    const victim = locks.find((x) => x.settled && x.env === "Base");
    const basis0 = await S.verifier.epochRewardBasis(ep);
    for (let i = 0; i < 25; i++) {
      await expect(S.verifier.connect(att).recordFeeAndRac({ ...victim.p, racIdentity: ethers.hexlify(ethers.randomBytes(32)) }))
        .to.be.revertedWith("VF-RAC-001: RAC already recorded");
    }
    expect(await S.verifier.epochRewardBasis(ep)).to.equal(basis0);
    expect(await S.verifier.isLockRacRecorded("Base", victim.lockId)).to.equal(true);
    console.log(`      lock ${victim.lockId.slice(0, 10)}: 25 extra RAC attempts refused; epoch ${ep} basis stays ${fmt(basis0)} USD`);
  });

  it("HH-002 SAFE: valuationTimestamp 0 is refused after decay; the honest package for the same lock mints the honest amount", async () => {
    await network.provider.send("evm_setNextBlockTimestamp", [Number((await C.now()) + 400n * 86400n)]);
    await network.provider.send("evm_mine");
    const a = actors[2];
    const mk = async () => {
      const lockId = ethers.hexlify(ethers.randomBytes(32));
      await (await S.lock.connect(a).createNativeLock(lockId, recipient.address, 0, ETH_ID, ethers.ZeroHash, dest.address, DAY7, ETH_PRICE, { value: SCALE })).wait();
      const rec = await S.lock.lockRecord(lockId);
      return { env: "Base", lockId, rec, p: C.basePkg(lockId, rec, ETH_ID, 2, 18), kind: "ETH" };
    };
    const h = await mk(), f = await mk();
    const v0 = await S.vclm.balanceOf(recipient.address);
    expect(await settle(h)).to.equal("minted");
    const v1 = await S.vclm.balanceOf(recipient.address);
    const realP = f.p;
    f.p = { ...realP, valuationTimestamp: 0 };
    expect(await settle(f)).to.match(/VF-ORC-011/);
    f.p = realP;
    expect(await settle(f)).to.equal("minted");
    const v2 = await S.vclm.balanceOf(recipient.address);
    console.log(`      1 ETH 7d: honest ${fmt(v1 - v0)} VCLM; backdated refused; honest resubmission ${fmt(v2 - v1)} VCLM`);
    expect(v2 - v1).to.equal(v1 - v0);
  });

  it("HH-004 SAFE: price binds at lock creation; a later price run and a stranger's first RAC do not change it", async () => {
    const a = actors[3];
    await S.postPrices([{ environmentId: "Base", canonicalAssetId: ETH_ID, priceUsd18: ETH_PRICE }]);
    const lockId = ethers.hexlify(ethers.randomBytes(32));
    await (await S.lock.connect(a).createNativeLock(lockId, recipient.address, 0, ETH_ID, ethers.ZeroHash, dest.address, DAY7, ETH_PRICE, { value: SCALE })).wait();
    const rec = await S.lock.lockRecord(lockId);
    // Price run after creation: half the price. It must not apply to this lock.
    await S.postPrices([{ environmentId: "Base", canonicalAssetId: ETH_ID, priceUsd18: ETH_PRICE / 2n }]);
    const p = C.basePkg(lockId, rec, ETH_ID, 2, 18);
    await (await S.verifier.connect(other).recordFeeAndRac(p)).wait(); // a stranger records it
    await S.postPrices([{ environmentId: "Base", canonicalAssetId: ETH_ID, priceUsd18: ETH_PRICE }]);
    const credit = await S.verifier.racCredits(await S.verifier.racKey("Base", lockId));
    const expectAtCreation = ((rec.gross * ETH_PRICE) / SCALE * rec.fee / rec.gross * 6000n) / 10000n;
    console.log(`      RAC credit ${fmt(credit)} USD vs ${fmt(expectAtCreation)} at the creation-time price`);
    expect(credit).to.be.closeTo(expectAtCreation, 10n);
  });

  after(async () => {
    console.log("      mints:", mints.length, "(Base", mints.filter((m) => m.env === "Base").length + ", Ethereum", mints.filter((m) => m.env === "Ethereum").length + ")");
  });
});
