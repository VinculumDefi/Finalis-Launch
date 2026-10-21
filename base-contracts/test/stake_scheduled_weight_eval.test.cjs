// t270u: evaluation of "Scheduled Epoch Weight Accounting" for VinculumFinalisStake.
// Test branch only. Nothing is broadcast. No keys.
//
// Randomized differential (60 seeds by default, EVAL_SEEDS="a-b" to choose):
// the current Stake against StakeV1Reference (frozen f816be3 Stake,
// O(positions) allocation), same operations in the same blocks. Covers
// extensions queued mid-epoch and inside the epoch where the current term
// ends, applied extensions, normal and early (terminal) withdrawals, zero-RAC
// and zero-weight epochs, the VCLM cap, lagging closes, late and out-of-order
// allocation, partial and delayed claims. Checks every epoch total weight and
// mint, every POSITION's total VCLM against the exact rule
// sum over epochs of floor(epochReward x weight / totalWeight), every owner's
// total against the reference, and solvency. From the same data it computes
// what a cumulative reward-per-weight accumulator would have paid.
const { expect } = require("chai");
const { ethers, network } = require("hardhat");

const E = 864000n;
const DUR = [2592000n, 5184000n, 7776000n, 10368000n];
const SCALE = 10n ** 18n;
const CAP = 10_000_000_000n * SCALE;

function rng(seed) {
  let x = BigInt(seed) * 2654435761n + 12345n;
  return (n) => { x = (x * 6364136223846793005n + 1442695040888963407n) & ((1n << 64n) - 1n); return Number((x >> 33n) % BigInt(n)); };
}

async function mineAt(t) {
  const last = BigInt((await ethers.provider.getBlock("latest")).timestamp);
  const ts = t > last ? t : last + 1n;
  await network.provider.send("evm_setNextBlockTimestamp", [Number(ts)]);
  await network.provider.send("evm_mine");
  return ts;
}

async function deployOne(name) {
  const F = await ethers.getContractFactory("TestFixtureERC20");
  const v = await (await ethers.getContractFactory("StakeTestVerifier")).deploy();
  const vc = await F.deploy(0), ch = await F.deploy(0), sy = await F.deploy(0);
  const st = await (await ethers.getContractFactory(name)).deploy(await vc.getAddress(), await ch.getAddress(), await sy.getAddress(), await v.getAddress());
  await (await v.setStake(await st.getAddress())).wait();
  return { v, vc, toks: [vc, ch, sy], st };
}
async function deployPair() { return { ref: await deployOne("StakeV1Reference"), neu: await deployOne("VinculumFinalisStake") }; }

// Same call to both contracts in one block at time t.
async function both(pair, t, fn) {
  await network.provider.send("evm_setAutomine", [false]);
  const txs = [];
  for (const side of [pair.ref, pair.neu]) { try { txs.push(await fn(side)); } catch (e) { txs.push(null); } }
  const time = await mineAt(t);
  await network.provider.send("evm_setAutomine", [true]);
  const ok = []; let gasNew = 0n;
  for (let i = 0; i < 2; i++) {
    const tx = txs[i];
    if (!tx) { ok.push(false); continue; }
    const rc = await ethers.provider.getTransactionReceipt(tx.hash);
    ok.push(!!rc && rc.status === 1);
    if (i === 1 && rc) gasNew = rc.gasUsed;
  }
  return { ok, time, gasNew };
}
// One call to the new contract only, own block at time t.
async function solo(t, fn) {
  await network.provider.send("evm_setAutomine", [false]);
  let tx = null; try { tx = await fn(); } catch (e) { tx = null; }
  const time = await mineAt(t);
  await network.provider.send("evm_setAutomine", [true]);
  if (!tx) return { ok: false, time, gas: 0n };
  const rc = await ethers.provider.getTransactionReceipt(tx.hash);
  return { ok: !!rc && rc.status === 1, time, gas: rc ? rc.gasUsed : 0n };
}

const GLOBAL = { counts: {}, gasMax: {}, acc: { positions: 0, same: 0, differ: 0, over: 0, under: 0, maxAbs: 0n, sumAbs: 0n, settledDiffers: 0, settledOverEpochs: 0 } };
function bump(k, n = 1) { GLOBAL.counts[k] = (GLOBAL.counts[k] || 0) + n; }
function gmax(k, g) { if (g > (GLOBAL.gasMax[k] || 0n)) GLOBAL.gasMax[k] = g; }

async function scenario(seed, opts = {}) {
  await network.provider.send("hardhat_reset");
  const S = await ethers.getSigners();
  const users = S.slice(1, 13);
  const r = rng(seed);
  const pair = await deployPair();
  const now = BigInt((await ethers.provider.getBlock("latest")).timestamp);
  const t0 = now + 1000n;
  for (const side of [pair.ref, pair.neu]) {
    await (await side.v.setLaunch(t0)).wait();
    for (const u of users) for (const tk of side.toks) {
      await (await tk.mint(u.address, 10n ** 27n)).wait();
      await (await tk.connect(u).approve(await side.st.getAddress(), 2n ** 255n)).wait();
    }
  }
  const G = { gasLimit: 3_000_000 };
  const owners = {}; let nextId = 0n;
  const paidNew = {};
  let t = t0 + 1n;
  const EPOCHS = opts.epochs || 20;
  let closed = 0n, mism = 0;
  const allocated = new Set();
  const capEpoch = opts.capEpoch || 0;
  const terminalEpoch = opts.terminalEpoch || 0;
  let terminalSet = false, capSet = false;
  let closeHoldUntil = 0n;
  let lastBasisEpoch = 0n;
  for (let step = 0; step < EPOCHS * 8; step++) {
    t += r(5) === 0 ? (E - ((t - t0) % E)) : BigInt(3600 + r(259200));
    if (opts.longGaps && r(25) === 0) { t += BigInt(2 + r(5)) * E; bump("longGap"); }
    const cur = (t - t0) / E + 1n;
    if (cur > BigInt(EPOCHS) + 3n) break;
    if (capEpoch && !capSet && cur >= BigInt(capEpoch)) {
      for (const side of [pair.ref, pair.neu]) await (await side.v.setLockIssued(CAP - 3000n * SCALE - (await side.st.cumulativeRewardVclmMinted()))).wait();
      capSet = true; bump("run.capLimited");
    }
    if (terminalEpoch && !terminalSet && cur >= BigInt(terminalEpoch)) {
      for (const side of [pair.ref, pair.neu]) await (await side.v.setLockIssued(CAP)).wait();
      terminalSet = true; bump("run.terminal");
    }
    if (cur !== lastBasisEpoch) {
      lastBasisEpoch = cur;
      if (r(5) !== 0) {
        const basis = BigInt(1 + r(100000)) * SCALE / 100n;
        for (const side of [pair.ref, pair.neu]) await (await side.v.setBasis(cur, basis)).wait();
        bump("basis.set");
      }
    }
    const op = terminalSet && r(2) === 0 ? 12 : r(20);
    const ids = Object.keys(owners);
    let res = null, kind = null;
    if (op <= 5 || ids.length === 0) {
      const u = users[r(users.length)], tok = r(3), d = DUR[r(4)];
      const amt = r(10) === 0 ? BigInt(1 + r(1000)) : BigInt(1 + r(5000)) * SCALE / BigInt(1 + r(7));
      res = await both(pair, t, (s) => s.st.connect(u).createPosition(tok, amt, d, G));
      kind = "create";
      if (res.ok[0]) owners[nextId++] = u;
    } else if (op <= 9) {
      let id = BigInt(ids[r(ids.length)]);
      if (r(2) === 0) {
        const curStart = t0 + (cur - 1n) * E;
        for (const k of ids) {
          const q = await pair.ref.st.positions(BigInt(k));
          if (!q.withdrawn && q.queuedExtensionBps === 0n && q.endTimestamp > t && q.endTimestamp < curStart + E) { id = BigInt(k); break; }
        }
      }
      const p = await pair.ref.st.positions(id);
      const d = DUR[r(4)];
      res = await both(pair, t, (s) => s.st.connect(owners[id]).queueExtension(id, d, G));
      kind = "queueExtension";
      if (res.ok[0]) {
        const tt = res.time;
        if ((tt - t0) % E !== 0n) bump("queueExtension.midEpoch");
        if ((p.endTimestamp - t0) / E === (tt - t0) / E) bump("queueExtension.inEpochWhereTermEnds");
        if ((p.endTimestamp - t0) % E !== 0n) bump("queueExtension.termEndsMidEpoch");
      }
    } else if (op <= 11) {
      const id = BigInt(ids[r(ids.length)]);
      res = await both(pair, t, (s) => s.st.connect(owners[id]).applyExtensionIfMatured(id, G));
      kind = "applyExtension";
    } else if (op <= 13) {
      const id = BigInt(ids[r(ids.length)]);
      const p = await pair.ref.st.positions(id);
      const sched = p.endTimestamp + (p.queuedExtensionBps > 0n ? p.queuedExtensionSecs : 0n);
      res = await both(pair, t, (s) => s.st.connect(owners[id]).withdrawPosition(id, G));
      kind = res.ok[0] && res.time < sched ? "withdraw.earlyTerminal" : "withdraw.normal";
    } else if (op <= 16) {
      const basis = r(4) === 0 ? 0n : BigInt(1 + r(100000)) * SCALE / 100n;
      for (const side of [pair.ref, pair.neu]) await (await side.v.setBasis(cur, basis)).wait();
      bump(basis === 0n ? "basis.zero" : "basis.set");
    } else {
      const id = BigInt(ids[r(ids.length)]);
      const from = await pair.neu.st.nextClaimEpoch(id);
      const maxFinal = cur >= 3n ? cur - 2n : 0n;
      if (maxFinal >= from) {
        const to = from + BigInt(r(Number(maxFinal - from + 1n)));
        const u = owners[id];
        const b0 = await pair.neu.vc.balanceOf(u.address);
        const view = await pair.neu.st.claimableVclm(id, to);
        const c = await solo(t, () => pair.neu.st.connect(u).claimPosition(id, to, { gasLimit: 15_000_000 }));
        t = c.time + 1n;
        if (c.ok) {
          const got = (await pair.neu.vc.balanceOf(u.address)) - b0;
          expect(got, "partial claim equals view").to.equal(view);
          paidNew[id] = (paidNew[id] || 0n) + got;
          bump(to < maxFinal ? "claim.partialRange" : "claim.upToLatestFinal");
          if (to - from >= 5n) bump("claim.span5plusEpochs");
          gmax("claimPosition(random)", c.gas);
        } else bump("claim.refusedEpochNotAllocated");
      }
    }
    if (process.env.EVAL_DBG) {
      for (let i = 0n; i < nextId; i++) {
        const a = await pair.ref.st.positions(i), b = await pair.neu.st.positions(i);
        if (a.toString() !== b.toString()) { console.log("POSDIFF seed", seed, "after", kind || ("op" + op), res && res.ok, "id", String(i), "ref", a.toString(), "new", b.toString()); throw new Error("posdiff"); }
      }
      const c2 = (t - t0) / E + 1n;
      for (let n = (c2 > 2n ? c2 - 2n : 1n); n < c2 + 14n; n++) {
        let sum = 0n; for (let i = 0n; i < nextId; i++) sum += await pair.neu.st.epochWeight(i, n);
        const inc = await pair.neu.st.epochTotalWeight(n);
        if (sum !== inc) { console.log("BREAK seed", seed, "after", kind || ("op" + op), "res", res && res.ok, "step", step, "epoch", String(n), "cur", String(c2), "lastClosed", String(await pair.neu.st.lastClosedEpoch()), "sum", String(sum), "inc", String(inc), "t-t0", String(t - t0), "tmodE", String((t - t0) % E)); throw new Error("break"); }
      }
    }
    if (res) {
      t = res.time;
      if (res.ok[0] !== res.ok[1]) mism++;
      bump(kind + (res.ok[0] ? ".ok" : ".reverted"));
      if (res.ok[1]) gmax(kind, res.gasNew);
    }
    if (opts.closeLag && closeHoldUntil === 0n && r(6) === 0) closeHoldUntil = cur + BigInt(1 + r(4));
    if (closeHoldUntil && cur >= closeHoldUntil) closeHoldUntil = 0n;
    if (!closeHoldUntil) {
      let caught = 0;
      while (t0 + (closed + 1n) * E <= t) {
        const n = closed + 1n;
        const c = await both(pair, t, (s) => s.st.closeEpoch(n, G));
        expect(c.ok, "close " + n).to.deep.equal([true, true]);
        gmax("closeEpoch", c.gasNew);
        closed = n; t = c.time + 1n; caught++;
      }
      if (caught > 1) bump("close.catchUpExtraEpochs", caught - 1);
    }
    if (opts.lateAlloc && r(3) !== 0) continue;
    // t270u(g): allocation is in strict epoch order. Allocate the next epochs
    // in order, sometimes stopping early so later epochs are allocated late.
    for (let n = BigInt(allocated.size) + 1n; n + 1n < cur && n <= closed; n++) {
      if (r(3) === 0 && n + 5n > cur) break;
      if (r(4) === 0) {
        // an out-of-order attempt on the current contract must revert
        const skip = n + 1n;
        if (skip + 1n < cur && skip <= closed) {
          const x = await solo(t, () => pair.neu.st.allocateEpoch(skip, { gasLimit: 15_000_000 }));
          expect(x.ok, "out-of-order allocate " + skip + " must revert").to.equal(false);
          bump("allocate.outOfOrderRefused"); t = x.time + 1n;
        }
      }
      const a = await both(pair, t, (s) => s.st.allocateEpoch(n, { gasLimit: 15_000_000 }));
      expect(a.ok, "allocate " + n).to.deep.equal([true, true]);
      gmax("allocateEpoch", a.gasNew);
      bump("allocate.inOrder");
      if (cur - n >= 4n) bump("allocate.late2plusEpochsAfterFinal");
      allocated.add(n); t = a.time + 1n;
    }
  }
  expect(mism, "operation outcomes differ").to.equal(0);
  t += 3n * E;
  await mineAt(t);
  const cur = (t - t0) / E + 1n;
  for (let n = closed + 1n; n + 1n <= cur - 1n; n++) { await (await pair.ref.st.closeEpoch(n)).wait(); await (await pair.neu.st.closeEpoch(n)).wait(); closed = n; }
  const lastFinal = cur - 2n;
  for (let n = 1n; n <= lastFinal; n++) {
    if (allocated.has(n)) continue;
    await (await pair.ref.st.allocateEpoch(n, { gasLimit: 30_000_000 })).wait();
    const g = (await (await pair.neu.st.allocateEpoch(n, { gasLimit: 15_000_000 })).wait()).gasUsed;
    gmax("allocateEpoch", g);
    bump("allocate.atEnd");
  }
  const ep = [];
  let totalMinted = 0n;
  for (let n = 1n; n <= lastFinal; n++) {
    const a = await pair.ref.st.epochs(n), b = await pair.neu.st.epochs(n);
    expect(b.totalWeight, "total weight epoch " + n).to.equal(a.totalWeight);
    expect(b.mintedVclm, "minted epoch " + n).to.equal(a.mintedVclm);
    expect(b.rewardBasis).to.equal(a.rewardBasis);
    if (a.rewardBasis === 0n) bump("epoch.zeroBasis");
    else if (a.totalWeight === 0n) bump("epoch.zeroWeight");
    else if (a.mintedVclm === 0n) bump("epoch.capSkipped");
    else bump("epoch.paid");
    ep[Number(n)] = { m: b.mintedVclm, W: b.totalWeight };
    totalMinted += a.mintedVclm;
  }
  expect(await pair.neu.st.cumulativeRewardVclmMinted()).to.equal(await pair.ref.st.cumulativeRewardVclmMinted());
  const exact = {};
  const sumW = {};
  for (let i = 0n; i < nextId; i++) {
    let e = 0n, acc = 0n, runW = -1n, runIdx = 0n, settled = 0n;
    for (let n = 1n; n <= lastFinal; n++) {
      const w = await pair.ref.st.epochWeight(i, n);
      sumW[n] = (sumW[n] || 0n) + w;
      const { m, W } = ep[Number(n)];
      const share = (W > 0n && m > 0n) ? (m * w) / W : 0n;
      e += share;
      // accumulator: index += floor(m * 1e18 / W); a position pays floor(w * dIndex / 1e18) per run of equal weight
      const dIdx = (W > 0n && m > 0n) ? (m * SCALE) / W : 0n;
      if (w !== runW) { if (runW > 0n) acc += (runW * runIdx) / SCALE; runW = w; runIdx = 0n; }
      runIdx += dIdx;
      const s1 = (w * dIdx) / SCALE; settled += s1;
      if (s1 > share) GLOBAL.acc.settledOverEpochs++;
    }
    if (runW > 0n) acc += (runW * runIdx) / SCALE;
    exact[i] = e;
    const d = acc - e; const ad = d < 0n ? -d : d;
    GLOBAL.acc.positions++;
    if (d === 0n) GLOBAL.acc.same++; else { GLOBAL.acc.differ++; if (d > 0n) GLOBAL.acc.over++; else GLOBAL.acc.under++; }
    if (ad > GLOBAL.acc.maxAbs) GLOBAL.acc.maxAbs = ad;
    GLOBAL.acc.sumAbs += ad;
    if (settled !== e) GLOBAL.acc.settledDiffers++;
  }
  for (let n = 1n; n <= lastFinal; n++) expect(ep[Number(n)].W, "sum of position weights epoch " + n).to.equal(sumW[n] || 0n);
  let paid = 0n;
  const perOwnerNew = new Map();
  for (let i = 0n; i < nextId; i++) {
    const u = owners[i];
    const b0 = await pair.neu.vc.balanceOf(u.address);
    if ((await pair.neu.st.nextClaimEpoch(i)) <= lastFinal) {
      const rc = await (await pair.neu.st.connect(u).claimPosition(i, lastFinal, { gasLimit: 15_000_000 })).wait();
      gmax("claimPosition(final)", rc.gasUsed);
    }
    const got = (await pair.neu.vc.balanceOf(u.address)) - b0 + (paidNew[i] || 0n);
    expect(got, "position " + i + " exact rule").to.equal(exact[i]);
    perOwnerNew.set(u.address, (perOwnerNew.get(u.address) || 0n) + got);
    expect(await pair.neu.st.claimableVclm(i, lastFinal)).to.equal(0n);
    paid += got;
    bump("positions.exactRuleChecked");
  }
  for (const u of users) {
    const ra = await pair.ref.vc.balanceOf(u.address);
    if ((await pair.ref.st.claimableVclm(u.address)) > 0n) await (await pair.ref.st.connect(u).claimVclm()).wait();
    const refPaid = (await pair.ref.vc.balanceOf(u.address)) - ra;
    expect(perOwnerNew.get(u.address) || 0n, "owner total vs reference").to.equal(refPaid);
  }
  expect(paid).to.be.lte(totalMinted);
  let vclmPrincipal = 0n;
  for (let i = 0n; i < nextId; i++) { const p = await pair.neu.st.positions(i); if (p.token === 0n && !p.withdrawn) vclmPrincipal += p.amount; }
  expect(await pair.neu.vc.balanceOf(await pair.neu.st.getAddress())).to.equal(vclmPrincipal + totalMinted - paid);
  GLOBAL.counts["dust.totalWei"] = (GLOBAL.counts["dust.totalWei"] || 0) + Number(totalMinted - paid);
  bump("seeds");
  return { positions: Number(nextId), epochs: Number(lastFinal), totalMinted, paid };
}

function seedPlan() {
  const spec = process.env.EVAL_SEEDS || "1-60";
  const [a, b] = spec.split("-").map(Number);
  const out = [];
  for (let s = a; s <= (b || a); s++) {
    const o = [
      {}, { epochs: 32 }, { terminalEpoch: 8 + (s % 7), epochs: 24 }, { capEpoch: 6 + (s % 5), epochs: 24 },
      { closeLag: true, epochs: 28 }, { lateAlloc: true, epochs: 36 }, { longGaps: true, closeLag: true, lateAlloc: true, epochs: 40 },
      { capEpoch: 7, terminalEpoch: 15, closeLag: true, epochs: 26 },
    ][s % 8];
    out.push([s, o]);
  }
  return out;
}

describe("t270u Stake scheduled-weight evaluation: randomized differential vs f816be3", function () {
  this.timeout(7200000);
  for (const [seed, opts] of seedPlan()) {
    it(`seed ${seed} ${JSON.stringify(opts)}`, async () => {
      const s = await scenario(seed, opts);
      console.log(`      seed ${seed}: ${s.positions} positions, ${s.epochs} final epochs, minted ${ethers.formatEther(s.totalMinted)}, dust ${s.totalMinted - s.paid} wei`);
      expect(s.positions).to.be.gt(2);
    });
  }
  after(() => {
    console.log("EVAL_COUNTS " + JSON.stringify(GLOBAL.counts));
    console.log("EVAL_GASMAX " + JSON.stringify(Object.fromEntries(Object.entries(GLOBAL.gasMax).map(([k, v]) => [k, Number(v)]))));
    const a = GLOBAL.acc;
    console.log("EVAL_ACCUMULATOR " + JSON.stringify({ positions: a.positions, sameAsExact: a.same, differ: a.differ, accPaysMore: a.over, accPaysLess: a.under, maxAbsDiffWei: String(a.maxAbs), sumAbsDiffWei: String(a.sumAbs), perEpochSettledDiffers: a.settledDiffers, perEpochOverpayEpochs: a.settledOverEpochs }));
  });
});
