// Expanded sampling (testing-rigs/sampling/, 2026-10-23). In-process Hardhat
// chain only: no live network, no broadcast, no real keys.
//
// Stack: scripts/testChainCeremony.cjs runCeremony(), i.e. the current main
// contracts wired as the ceremony wires them (BaseCommitmentVaultLock plus
// BaseLockRecordVerifier on Base, CommitmentVaultLock plus
// SimpleEthereumLockReader on Ethereum, all 487 Revision B rows, the token
// address index and the aliases). The test then initializes VCLM and CHONX,
// posts the prices fetched on 2026-10-23 (testing-rigs/prices-2026-10-23,
// 09:41 to 09:51 ET) and finalizes, on this test chain only.
//
// Expected amounts come from the spec numbers written out below, not from the
// contract and not from src/lib/vfRevision6Authority.js:
//   10 VCLM per $1, floor 1 VCLM per $1, decay 1.667% per whole 30 days
//   (survival 0.98333), class S1 1.5x / S2 1.3x / S3 1.0x, the 16 lock
//   durations, fee 5% on every duration (Revision 12), the four Stake
//   durations (TRS correction 2026-10-17). Every division floors (VF-COM-019).
//
// Asset classes: native (Base ETH, Ethereum ETH), standard ERC-20 (AERO, cbBTC,
// LINK), stablecoin (USDC_BASE, USDC, USDT with no return value), fee-capable
// (PAXG, USDT; fee 0 today, fee on in the deviation cases), rebasing (AMPL,
// stETH). Token code is placed at the real registry addresses (test doubles in
// contracts/test/SamplingTokens.sol).
//
// Each lock, mint and deviation is appended to
// testing-rigs/sampling/results/*.jsonl as it happens.
const { expect } = require("chai");
const fs = require("fs");
const path = require("path");
const hre = require("hardhat");
const { ethers, network } = hre;
const { runCeremony } = require("../scripts/testChainCeremony.cjs");
const { ethLockEvidence, encodeEvidence } = require("./lib/ethProof.cjs");
const REGALL = require("../scripts/registryFile.cjs").loadRegistry().all;
const { entries: TOKIDX } = require("../scripts/buildTokenAddressIndex.cjs").buildTokenAddressIndex();

const coder = ethers.AbiCoder.defaultAbiCoder();
const S = 10n ** 18n;
const DAY = 86400n;

// ---- Spec numbers, written out (not read from code) ----
const SPEC = {
  initialPerDollar: 10n * S,
  floorPerDollar: 1n * S,
  survival: S - (1667n * S) / 100000n, // 1.667% decay -> 0.98333
  periodDays: 30n,
  feeBps: 500n,
  classBps: { 1: 15000n, 2: 13000n, 3: 10000n },
};
const DURS = [
  [3600n, 10000n], [604800n, 10000n], [2592000n, 11500n], [5184000n, 13000n], [7776000n, 15000n],
  [15552000n, 20000n], [31536000n, 25000n], [63072000n, 38000n], [94608000n, 50000n], [126144000n, 57500n],
  [157680000n, 65000n], [189216000n, 68000n], [220752000n, 71000n], [252288000n, 74000n], [283824000n, 77000n],
  [315360000n, 80000n],
];
const TRS = [[2592000n, 10000n], [5184000n, 14000n], [7776000n, 17500n], [10368000n, 21000n]];
const HS_USD = 15n * S / 1000n, STD_USD = 150n * S;

// Prices fetched 2026-10-23 (results/revB/prices.json), posted here on the test chain only.
const ASSETS = [
  { key: "Base ETH", env: "Base", row: 2, kind: "native", price: "2410.67" },
  { key: "Ethereum ETH", env: "Ethereum", row: 2, kind: "native", price: "2401.24" },
  { key: "Base AERO", env: "Base", row: 34, kind: "erc20", price: "0.753095" },
  { key: "Base cbBTC", env: "Base", row: 45, kind: "erc20", price: "81640" },
  { key: "Ethereum LINK", env: "Ethereum", row: 8, kind: "erc20", price: "11.99" },
  { key: "Base USDC_BASE", env: "Base", row: 454, kind: "stable", price: "0.999596" },
  { key: "Ethereum USDC", env: "Ethereum", row: 1, kind: "stable", price: "0.999568" },
  { key: "Ethereum USDT", env: "Ethereum", row: 6, kind: "stable", noReturn: true, feeCapable: true, price: "0.99903" },
  { key: "Ethereum PAXG", env: "Ethereum", row: 37, kind: "fee-capable", feeCapable: true, price: "4033.61" },
  { key: "Ethereum AMPL", env: "Ethereum", row: 610, kind: "rebasing", price: "1.27" },
  { key: "Ethereum stETH", env: "Ethereum", row: 9, kind: "rebasing", price: "2400.22" },
];

const OUT = path.join(__dirname, "..", "..", "testing-rigs", "sampling", "results");
const log = (file, obj) => fs.appendFileSync(path.join(OUT, file), JSON.stringify(obj, (k, v) => (typeof v === "bigint" ? v.toString() : v)) + "\n");

function rev6Class(r) { // Revision 6: S1 canonical Ethereum USDC/USDT; S2 native ETH, BTC, Ethereum AAVE/LINK/UNI; S3 the rest
  if (r.environmentId === "Ethereum" && ["USDC", "USDT"].includes(r.symbol)) return 1;
  if (r.assetId === "native-ETH" || r.symbol === "BTC") return 2;
  if (r.environmentId === "Ethereum" && ["AAVE", "LINK", "UNI"].includes(r.symbol)) return 2;
  return 3;
}
function specRate(days) {
  let rate = SPEC.initialPerDollar;
  for (let i = 0n; i < days / SPEC.periodDays; i++) {
    rate = (rate * SPEC.survival) / S;
    if (rate <= SPEC.floorPerDollar) { rate = SPEC.floorPerDollar; break; }
  }
  return rate;
}
const usdOf = (units, dec, price) => (((units * S) / 10n ** BigInt(dec)) * price) / S;
function specMint(usd, days, cls, durBps) {
  let step = (usd * specRate(days)) / S;
  step = (step * ((S * SPEC.classBps[cls]) / 10000n)) / S;
  step = (step * ((S * durBps) / 10000n)) / S;
  return step;
}
// Units worth about `target` USD, a multiple of 20 so 5% is a whole unit and 95% is exact.
function unitsFor(target, dec, price) {
  let u = (target * 10n ** BigInt(dec)) / price;
  u -= u % 20n;
  if (u < 20n) u = 20n;
  return u;
}

let C, launch, codes, runId = 10n;
const A = {}; // per asset: row, token, price18
async function now() { return BigInt((await ethers.provider.getBlock("latest")).timestamp); }
async function funded() {
  const w = ethers.Wallet.createRandom().connect(ethers.provider);
  await network.provider.send("hardhat_setBalance", [w.address, "0x56bc75e2d63100000"]);
  return w;
}
async function post(updates) {
  runId += 1n;
  await (await C.verifier.connect(C.poster).applyScheduledPriceRun(runId, updates)).wait();
}
function tokenContract(a) {
  return ethers.getContractAt(a.kind === "rebasing" ? "SamplingRebasingToken" : "SamplingFeeToken", a.token);
}

// One lock, proven and minted. Returns the lock record, the minted amount and the spec amount.
async function lockAndMint(a, user, holder, dest, dur, durBps, opt = {}) {
  const lock = C.locks[a.env];
  const hs = dur === 3600n;
  const units = opt.units || unitsFor(hs ? HS_USD : STD_USD, a.row.decimals, a.price18);
  const usd = usdOf(units, a.row.decimals, a.price18);
  const lockId = ethers.hexlify(ethers.randomBytes(32));
  const devFund = await lock.devFund();
  const lockAddr = await lock.getAddress();
  let tok, devBefore, vaultBefore;
  if (a.token) { tok = await tokenContract(a); devBefore = await tok.balanceOf(devFund); vaultBefore = await tok.balanceOf(lockAddr); }
  else { devBefore = await ethers.provider.getBalance(devFund); vaultBefore = await ethers.provider.getBalance(lockAddr); }
  const tx = a.token
    ? await lock.connect(user).createErc20Lock(lockId, holder, 0, ethers.ZeroHash, ethers.ZeroHash, dest, dur, a.token, units, usd)
    : await lock.connect(user).createNativeLock(lockId, holder, 0, ethers.ZeroHash, ethers.ZeroHash, dest, dur, usd, { value: units });
  const rc = await tx.wait();
  const rec = await lock.lockRecord(lockId);
  const devAfter = a.token ? await tok.balanceOf(devFund) : await ethers.provider.getBalance(devFund);
  const vaultAfter = a.token ? await tok.balanceOf(lockAddr) : await ethers.provider.getBalance(lockAddr);
  let proof, finality = "0x";
  if (a.env === "Base") {
    proof = coder.encode(["bytes32", "uint256", "uint256", "uint256", "uint256", "uint256", "uint256"],
      [lockId, rec.gross, rec.fee, rec.principal, rec.duration, rec.createdAt, rec.maturity]);
  } else {
    const ev = await ethLockEvidence(lockAddr, rc.hash, lockId);
    proof = encodeEvidence(ev);
    finality = coder.encode(["uint256", "bytes32", "uint256"], [1, ev.block.hash, ev.block.number]);
  }
  const p = {
    sourceEnvironmentId: a.env, commitmentVaultLockId: lockId, handshakeAllowanceCount: 3,
    canonicalAssetId: a.row.canonicalAssetId, assetPrecision: a.row.decimals, assetCustodyClass: a.row.custodyClass,
    grossAmountSmallestUnits: rec.gross, actualFeeAmountSmallestUnits: rec.fee, principalAmountSmallestUnits: rec.principal,
    feeAssetId: a.row.canonicalAssetId, devFundDestination: "dev", feeTransferEvidence: ethers.id("fee"),
    valuationTimestamp: opt.valuationTimestamp !== undefined ? opt.valuationTimestamp : rec.createdAt,
    maturityTimestamp: rec.maturity, durationSecs: rec.duration,
    selectedOutputToken: 0, baseRecipient: holder, releaseDestination: "release",
    chonxActivationReceipt: "0x", racIdentity: ethers.hexlify(ethers.randomBytes(32)), priceRecord: "0x",
    sourceFinalityProof: finality, lockEventProof: proof,
  };
  if (opt.beforeProof) await opt.beforeProof();
  if (opt.expectRevert) {
    await expect((async () => { await C.verifier.recordFeeAndRac(p); await C.verifier.verifyAndMint(p, 0); })())
      .to.be.revertedWith(opt.expectRevert);
    return { lockId, rec, units, usd, refused: opt.expectRevert };
  }
  const before = await C.vclm.balanceOf(holder);
  await (await C.verifier.recordFeeAndRac(p)).wait();
  await (await C.verifier.verifyAndMint(p, 0)).wait();
  const minted = (await C.vclm.balanceOf(holder)) - before;
  const days = rec.createdAt > launch ? (rec.createdAt - launch) / DAY : 0n;
  const priceUsed = opt.priceUsed || a.price18;
  const usdV = usdOf(rec.gross, a.row.decimals, priceUsed);
  const spec = specMint(usdV, days, a.row.custodyClass, durBps);
  return { lockId, rec, units, usd, usdV, minted, spec, days, rate: specRate(days), devDelta: devAfter - devBefore, vaultDelta: vaultAfter - vaultBefore };
}

describe("Expanded sampling: current main contracts on the test chain (11 assets x 16 durations, 4 Stake durations, deviations)", function () {
  this.timeout(0);

  before(async () => {
    fs.mkdirSync(OUT, { recursive: true });
    for (const f of ["locks.jsonl", "deviations.jsonl", "decay.jsonl", "stake.jsonl"]) fs.writeFileSync(path.join(OUT, f), "");
    C = await runCeremony(hre);
    await (await C.vclm.initialize(await C.verifier.getAddress(), await C.stake.getAddress())).wait();
    await (await C.chonx.initialize(await C.verifier.getAddress(), ethers.ZeroAddress)).wait();
    codes = {
      fee: await ethers.provider.getCode(await (await (await ethers.getContractFactory("SamplingFeeToken")).deploy()).getAddress()),
      rebase: await ethers.provider.getCode(await (await (await ethers.getContractFactory("SamplingRebasingToken")).deploy()).getAddress()),
    };
    const updates = [];
    for (const a of ASSETS) {
      const row = REGALL.find((e) => e.row === a.row && e.environmentId === a.env);
      expect(row, a.key + " registry row").to.not.equal(undefined);
      const price18 = ethers.parseUnits(a.price, 18);
      let token = null;
      if (a.kind !== "native") {
        const t = TOKIDX.find((x) => x.environmentId === a.env && x.canonicalAssetId === row.canonicalAssetId);
        expect(t, a.key + " token index").to.not.equal(undefined);
        token = t.token;
        await network.provider.send("hardhat_setCode", [token, a.kind === "rebasing" ? codes.rebase : codes.fee]);
        if (a.noReturn) await (await (await ethers.getContractAt("SamplingFeeToken", token)).setNoReturn(true)).wait();
      }
      A[a.key] = { ...a, row, token, price18 };
      updates.push({ environmentId: a.env, canonicalAssetId: row.canonicalAssetId, priceUsd18: price18, success: true });
    }
    await post(updates);
    await (await C.verifier.finalize()).wait();
    launch = await C.verifier.protocolLaunchTimestamp();
    expect(launch).to.be.gt(0n);
  });

  it("spec numbers match the contract constants and the registry classes", async () => {
    expect(await C.verifier.VCLM_INITIAL_RATE()).to.equal(SPEC.initialPerDollar);
    expect(await C.verifier.VCLM_FLOOR_RATE()).to.equal(SPEC.floorPerDollar);
    expect(await C.verifier.DECAY_SURVIVAL_FP()).to.equal(SPEC.survival);
    expect(await C.verifier.DECAY_PERIOD_DAYS()).to.equal(SPEC.periodDays);
    expect(await C.verifier.S1_MULTIPLIER_BPS()).to.equal(SPEC.classBps[1]);
    expect(await C.verifier.S2_MULTIPLIER_BPS()).to.equal(SPEC.classBps[2]);
    expect(await C.verifier.S3_MULTIPLIER_BPS()).to.equal(SPEC.classBps[3]);
    expect(await C.verifier.STANDARD_FEE_BPS()).to.equal(SPEC.feeBps);
    for (const [secs, bps] of TRS) expect(await C.stake.stakeMultiplierBps(secs)).to.equal(bps);
    await expect(C.stake.stakeMultiplierBps(45n * DAY)).to.be.reverted;
    for (const a of Object.values(A)) expect(a.row.custodyClass, a.key).to.equal(rev6Class(a.row));
    expect(C.all.length).to.equal(487);
    log("deviations.jsonl", { id: "check-constants", result: "PASS" });
  });

  it("emission curve on Base ETH 7-day locks (in a snapshot): rate is 10 per $1 decayed 1.667% per whole 30 days, floors at 1 from day 4110; minted equals spec", async () => {
      const snap = await network.provider.send("evm_snapshot", []);
      const a = A["Base ETH"];
      const user = await funded(), holder = await funded(), dest = await funded();
      const DAYS = [0n, 29n, 30n, 59n, 60n, 89n, 90n, 180n, 364n, 365n, 400n, 1000n, 2000n, 4079n, 4080n, 4109n, 4110n, 4500n];
      for (const d of DAYS) {
        const t = launch + d * DAY + 100n;
        if (t > (await now())) await network.provider.send("evm_setNextBlockTimestamp", [Number(t)]);
        const r = await lockAndMint(a, user, holder.address, dest.address, 604800n, 10000n);
        log("decay.jsonl", { day: d, periods: r.days / 30n, specRate: r.rate, usd: r.usdV, spec: r.spec, minted: r.minted, ok: r.minted === r.spec });
        expect(r.days).to.equal(d);
        expect(r.minted, `day ${d}`).to.equal(r.spec);
      }
      expect(specRate(4109n)).to.be.gt(SPEC.floorPerDollar);
      expect(specRate(4110n)).to.equal(SPEC.floorPerDollar);
      expect(specRate(30n)).to.equal(9833300000000000000n);
      await network.provider.send("evm_revert", [snap]);
    });

  for (const def of ASSETS) {
    it(`${def.key} (${def.kind}): 16 durations, exact VCLM, exact 95% at maturity, no early or double release; 4 Stake durations`, async () => {
      const a = A[def.key];
      await network.provider.send("evm_increaseTime", [Number(31n * DAY)]);
      await network.provider.send("evm_mine");
      const user = await funded(), holder = await funded(), dest = await funded(), other = await funded();
      const lockAddr = await C.locks[a.env].getAddress();
      let tok = null;
      if (a.token) {
        tok = await tokenContract(a);
        const need = unitsFor(STD_USD, a.row.decimals, a.price18) * 20n;
        await (await tok.mint(user.address, need)).wait();
        await (await tok.connect(user).approve(lockAddr, need)).wait();
      }
      // A 17th duration is refused at the lock.
      if (a.token) await expect(C.locks[a.env].connect(user).createErc20Lock(ethers.hexlify(ethers.randomBytes(32)), holder.address, 0, ethers.ZeroHash, ethers.ZeroHash, dest.address, 2n * DAY, a.token, 1000n, STD_USD)).to.be.revertedWith("CVL: duration");
      else await expect(C.locks[a.env].connect(user).createNativeLock(ethers.hexlify(ethers.randomBytes(32)), holder.address, 0, ethers.ZeroHash, ethers.ZeroHash, dest.address, 2n * DAY, STD_USD, { value: 1000n })).to.be.revertedWith("CVL: duration");
      const locks = [];
      let total = 0n;
      for (const [dur, bps] of DURS) {
        const r = await lockAndMint(a, user, holder.address, dest.address, dur, bps);
        expect(r.rec.gross).to.equal(r.units);
        expect(r.rec.fee).to.equal((r.units * SPEC.feeBps) / 10000n);
        expect(r.rec.principal * 100n).to.equal(r.units * 95n);
        expect(r.devDelta, "Dev Fund received the 5% fee").to.equal(r.rec.fee);
        expect(r.vaultDelta, "vault holds the 95% principal").to.equal(r.rec.principal);
        expect(r.rec.maturity - r.rec.createdAt).to.equal(dur);
        expect(r.minted, `${a.key} ${dur}s`).to.equal(r.spec);
        expect(r.minted).to.be.gt(0n);
        log("locks.jsonl", { asset: a.key, kind: a.kind, env: a.env, row: a.row.row, cls: a.row.custodyClass, durationSecs: dur, durBps: bps,
          gross: r.rec.gross, fee: r.rec.fee, principal: r.rec.principal, usd: r.usdV, days: r.days, specRate: r.rate, spec: r.spec, minted: r.minted, ok: r.minted === r.spec });
        locks.push(r); total += r.minted;
      }
      expect(await C.vclm.balanceOf(holder.address)).to.equal(total);

      // Stake: all four durations, then a fifth is refused.
      const bal = await C.vclm.balanceOf(holder.address);
      const each = bal / 5n;
      await (await C.vclm.connect(holder).approve(await C.stake.getAddress(), bal)).wait();
      await expect(C.stake.connect(holder).createPosition(0, each, 45n * DAY)).to.be.revertedWith("VF-STK-003: duration not permitted");
      const ids = [];
      for (const [secs, bps] of TRS) {
        const id = await C.stake.nextPositionId();
        await (await C.stake.connect(holder).createPosition(0, each, secs)).wait();
        const pos = await C.stake.positions(id);
        expect(pos.amount).to.equal(each);
        expect(pos.durationSecs).to.equal(secs);
        expect(pos.multiplierBps).to.equal(bps);
        expect(pos.endTimestamp - pos.startTimestamp).to.equal(secs);
        ids.push(id);
      }
      const snap = await network.provider.send("evm_snapshot", []);
      for (const id of ids) {
        const pos = await C.stake.positions(id);
        if (pos.endTimestamp - 1n > (await now())) {
          await network.provider.send("evm_setNextBlockTimestamp", [Number(pos.endTimestamp - 1n)]);
          await expect(C.stake.connect(holder).withdrawPosition(id)).to.be.revertedWith("VFS: not matured");
        }
        if (pos.endTimestamp > (await now())) await network.provider.send("evm_setNextBlockTimestamp", [Number(pos.endTimestamp)]);
        await expect(C.stake.connect(other).withdrawPosition(id)).to.be.revertedWith("VFS: not owner");
        await expect(C.stake.connect(holder).withdrawPosition(id)).to.changeTokenBalances(C.vclm, [holder, C.stake], [each, -each]);
        await expect(C.stake.connect(holder).withdrawPosition(id)).to.be.revertedWith("VFS: withdrawn");
        log("stake.jsonl", { asset: a.key, positionId: id, durationSecs: pos.durationSecs, multiplierBps: pos.multiplierBps, amount: each, withdrawn: true });
      }

      // Keep the 16 open locks (they stay open after the rollback) for the rebase probe.
      a.openLocks = locks.map((l) => ({ lockId: l.lockId, maturity: l.rec.maturity, principal: l.rec.principal, dest }));
      // Release every lock at its maturity (same snapshot), then roll back.
      const lock = C.locks[a.env];
      for (const l of locks.sort((x, y) => (x.rec.maturity < y.rec.maturity ? -1 : 1))) {
        if (l.rec.maturity - 1n > (await now())) {
          await network.provider.send("evm_setNextBlockTimestamp", [Number(l.rec.maturity - 1n)]);
          await expect(lock.connect(dest).release(l.lockId)).to.be.revertedWith("CVL: immature");
        }
        if (l.rec.maturity > (await now())) await network.provider.send("evm_setNextBlockTimestamp", [Number(l.rec.maturity)]);
        await expect(lock.connect(other).release(l.lockId)).to.be.revertedWith("CVL: destination");
        if (tok) await expect(lock.connect(dest).release(l.lockId)).to.changeTokenBalances(tok, [dest, lockAddr], [l.rec.principal, -l.rec.principal]);
        else await expect(lock.connect(dest).release(l.lockId)).to.changeEtherBalances([dest, lockAddr], [l.rec.principal, -l.rec.principal]);
        await expect(lock.connect(dest).release(l.lockId)).to.be.revertedWith("CVL: already released");
      }
      await network.provider.send("evm_revert", [snap]);
    });
  }

  describe("deviation probes (each in a snapshot)", function () {
    let snap;
    beforeEach(async () => { snap = await network.provider.send("evm_snapshot", []); });
    afterEach(async () => { await network.provider.send("evm_revert", [snap]); });

    async function tokenUser(a, units) {
      const user = await funded(), holder = await funded(), dest = await funded();
      const tok = await tokenContract(a);
      await (await tok.mint(user.address, units * 10n)).wait();
      await (await tok.connect(user).approve(await C.locks[a.env].getAddress(), units * 10n)).wait();
      return { user, holder, dest, tok };
    }

    for (const key of ["Ethereum USDT", "Base USDC_BASE", "Ethereum USDC"]) {
      it(`$0.95 rule on ${key}: below $0.95 refused, exactly $0.95 mints at $0.95 (no $1 substitute), failed run refused`, async () => {
        const a = A[key];
        const units = unitsFor(STD_USD, a.row.decimals, a.price18) * 2n;
        const { user, holder, dest } = await tokenUser(a, units);
        const setPrice = (p, ok = true) => post([{ environmentId: a.env, canonicalAssetId: a.row.canonicalAssetId, priceUsd18: ok ? p : 0n, success: ok }]);
        await setPrice(ethers.parseUnits("0.949999", 18));
        await lockAndMint(a, user, holder.address, dest.address, 2592000n, 11500n,
          { units, expectRevert: "VF-ORC-005: USDC/USDT scheduled price below $0.95" });
        await setPrice(ethers.parseUnits("0.95", 18));
        const r = await lockAndMint(a, user, holder.address, dest.address, 2592000n, 11500n, { units, priceUsed: ethers.parseUnits("0.95", 18) });
        expect(r.minted).to.equal(r.spec);
        const at1 = specMint(usdOf(r.rec.gross, a.row.decimals, S), r.days, a.row.custodyClass, 11500n);
        expect(r.minted).to.be.lt(at1);
        await setPrice(0n, false);
        await lockAndMint(a, user, holder.address, dest.address, 2592000n, 11500n, { units, expectRevert: "VF-ORC-005: no usable scheduled price" });
        log("deviations.jsonl", { id: "usd-stable-0.95-" + a.row.symbol, result: "PASS", mintedAt095: r.minted, specAt095: r.spec, wouldBeAt1: at1 });
      });
    }

    for (const key of ["Ethereum PAXG", "Ethereum USDT"]) {
      it(`fee-on-transfer (latent): ${key} with a 1% transfer fee switched on`, async () => {
        const a = A[key];
        const tok = await ethers.getContractAt("SamplingFeeToken", a.token);
        await (await tok.setFeeBps(100n)).wait();
        const units = unitsFor(STD_USD, a.row.decimals, a.price18);
        const { user, holder, dest } = await tokenUser(a, units);
        const r = await lockAndMint(a, user, holder.address, dest.address, 2592000n, 11500n, { units });
        const received = units - (units * 100n) / 10000n;
        expect(r.rec.gross).to.equal(received);              // gross is the balance delta
        expect(r.minted).to.equal(r.spec);                     // VCLM on what arrived, no over-mint
        const feeShort = r.rec.fee - r.devDelta;
        expect(feeShort).to.be.gt(0n);                         // Dev Fund gets less than the 5% fee
        if (r.rec.maturity > (await now())) await network.provider.send("evm_setNextBlockTimestamp", [Number(r.rec.maturity)]);
        const before = await tok.balanceOf(dest.address);
        await (await C.locks[a.env].connect(dest).release(r.lockId)).wait();
        const got = (await tok.balanceOf(dest.address)) - before;
        expect(got).to.be.lt(r.rec.principal);
        log("deviations.jsonl", { id: "fee-on-transfer-" + a.row.symbol, class: "CONFIRMED VULNERABILITY", status: "LATENT (no registered token charges a fee today)",
          sent: units, gross: r.rec.gross, fee: r.rec.fee, devFundGot: r.devDelta, principal: r.rec.principal, destinationGot: got,
          returnedOfSentBps: (got * 10000n) / units, knownAs: "HH-007 (part of AG-08)" });
      });
    }

    it("rebasing: AMPL negative rebase (-10%) leaves the last releasers short; positive rebase (+10%) strands the surplus", async () => {
      const a = A["Ethereum AMPL"];
      const tok = await ethers.getContractAt("SamplingRebasingToken", a.token);
      const units = unitsFor(STD_USD, a.row.decimals, a.price18);
      const lock = C.locks[a.env];
      const lockAddr = await lock.getAddress();
      expect(a.openLocks && a.openLocks.length, "AMPL open locks from the asset test").to.equal(16);
      const out = {};
      for (const [label, idx] of [["negative", 9n * S / 10n], ["positive", 11n * S / 10n]]) {
        const s2 = await network.provider.send("evm_snapshot", []);
        const u1 = await tokenUser(a, units), u2 = await tokenUser(a, units);
        const l1 = await lockAndMint(a, u1.user, u1.holder.address, u1.dest.address, 2592000n, 11500n, { units });
        const l2 = await lockAndMint(a, u2.user, u2.holder.address, u2.dest.address, 2592000n, 11500n, { units });
        const all = [...a.openLocks, { lockId: l1.lockId, maturity: l1.rec.maturity, principal: l1.rec.principal, dest: u1.dest },
          { lockId: l2.lockId, maturity: l2.rec.maturity, principal: l2.rec.principal, dest: u2.dest }];
        const owed = all.reduce((x, l) => x + l.principal, 0n);
        const poolBefore = await tok.balanceOf(lockAddr);
        await (await tok.setIndex(idx)).wait();
        const poolAfter = await tok.balanceOf(lockAddr);
        const m = all.reduce((x, l) => (l.maturity > x ? l.maturity : x), 0n);
        if (m > (await now())) await network.provider.send("evm_setNextBlockTimestamp", [Number(m)]);
        let released = 0, paid = 0n, firstFail = null, unpaid = 0n, roundedShort = 0;
        for (const l of all) {
          const b = await tok.balanceOf(l.dest.address);
          try {
            await (await lock.connect(l.dest).release(l.lockId)).wait();
            const got = (await tok.balanceOf(l.dest.address)) - b;
            expect(got).to.be.lte(l.principal);
            expect(l.principal - got).to.be.lte(1n);          // share rounding, as in the stETH probe
            if (got < l.principal) roundedShort++;
            released++; paid += got;
          } catch (e) {
            if (e.name === "AssertionError") throw e;
            if (firstFail === null) firstFail = (e.message.match(/reverted with reason string '([^']+)'/) || [])[1] || e.message.slice(0, 80);
            unpaid += l.principal;
          }
        }
        const left = await tok.balanceOf(lockAddr);
        out[label] = { locks: all.length, owedPrincipal: owed, poolBeforeRebase: poolBefore, poolAfterRebase: poolAfter,
          released, failed: all.length - released, releasedOneWeiShort: roundedShort, paid, unpaidPrincipal: unpaid, firstReleaseError: firstFail, leftInVault: left };
        expect(poolBefore).to.equal(owed);
        if (label === "negative") { expect(poolAfter).to.be.lt(owed); expect(released).to.be.lt(all.length); expect(unpaid).to.be.gt(0n); }
        else { expect(released).to.equal(all.length); expect(left).to.be.gt(0n); }
        await network.provider.send("evm_revert", [s2]);
      }
      log("deviations.jsonl", { id: "rebasing-AMPL", class: "CONFIRMED VULNERABILITY", status: "LIVE (ERC-20 path; AMPL row 610 is indexed, opens once an AMPL price is posted)", knownAs: "HH-005 / AG-08", ...out });
    });

    it("rebasing: stETH share rounding can deliver 1 wei less than the recorded principal", async () => {
      const a = A["Ethereum stETH"];
      const tok = await ethers.getContractAt("SamplingRebasingToken", a.token);
      await (await tok.setIndex(1100000000000000007n)).wait();
      const units = unitsFor(STD_USD, a.row.decimals, a.price18);
      const { user, holder, dest } = await tokenUser(a, units);
      const r = await lockAndMint(a, user, holder.address, dest.address, 2592000n, 11500n, { units });
      if (r.rec.maturity > (await now())) await network.provider.send("evm_setNextBlockTimestamp", [Number(r.rec.maturity)]);
      let got = null, second = null;
      try {
        const b = await tok.balanceOf(dest.address);
        await (await C.locks[a.env].connect(dest).release(r.lockId)).wait();
        got = (await tok.balanceOf(dest.address)) - b;
      } catch (e) { second = e.message.slice(0, 120); }
      log("deviations.jsonl", { id: "rebasing-stETH-rounding", class: "CONFIRMED VULNERABILITY", status: "LIVE (ERC-20 path; stETH row 9 is indexed, opens once a stETH price is posted)", knownAs: "HH-006 / AG-08",
        sent: units, gross: r.rec.gross, principal: r.rec.principal, destinationGot: got, releaseError: second, shortBy: got === null ? null : r.rec.principal - got });
      expect(got === null || r.rec.principal - got <= 1n).to.equal(true);
    });

    it("valuation timestamp is not bound to the lock time: a day-400 lock submitted with valuationTimestamp = launch mints at the day-0 rate", async () => {
      const a = A["Base ETH"];
      const t = launch + 400n * DAY;
      if (t > (await now())) await network.provider.send("evm_setNextBlockTimestamp", [Number(t)]);
      const user = await funded(), holder = await funded(), dest = await funded();
      const honest = await lockAndMint(a, user, holder.address, dest.address, 604800n, 10000n);
      const forged = await lockAndMint(a, user, holder.address, dest.address, 604800n, 10000n, { valuationTimestamp: launch });
      const atDay0 = specMint(forged.usdV, 0n, a.row.custodyClass, 10000n);
      expect(honest.minted).to.equal(honest.spec);
      expect(forged.minted).to.equal(atDay0);
      expect(forged.minted).to.be.gt(forged.spec);
      log("deviations.jsonl", { id: "valuation-timestamp-unbound", class: "CONFIRMED VULNERABILITY", status: "LIVE (Base set)", knownAs: "AG-05 / STATIC-H02 / HH-002",
        day: honest.days, honestMinted: honest.minted, forgedMinted: forged.minted, ratio: Number((forged.minted * 10000n) / honest.minted) / 10000 });
    });

    it("price is bound at first proof, not at lock time: a lock made at the fetched price and proven after a 2x run mints at 2x", async () => {
      const a = A["Base ETH"];
      const user = await funded(), holder = await funded(), dest = await funded();
      const two = a.price18 * 2n;
      const r = await lockAndMint(a, user, holder.address, dest.address, 2592000n, 11500n, {
        beforeProof: () => post([{ environmentId: a.env, canonicalAssetId: a.row.canonicalAssetId, priceUsd18: two, success: true }]),
        priceUsed: two,
      });
      const atLockPrice = specMint(usdOf(r.rec.gross, a.row.decimals, a.price18), r.days, a.row.custodyClass, 11500n);
      expect(r.minted).to.equal(r.spec);
      expect(r.minted).to.be.gt(atLockPrice);
      log("deviations.jsonl", { id: "price-bound-at-first-proof", class: "CONFIRMED VULNERABILITY", status: "LIVE (Base set)", knownAs: "AG-06 / STATIC-M01 / HH-004",
        mintedAtProofPrice: r.minted, specAtLockPrice: atLockPrice });
    });
  });
});
