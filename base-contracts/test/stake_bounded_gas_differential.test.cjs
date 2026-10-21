// t269u: VinculumFinalisStake bounded gas.
// 1. Differential: the new Stake (O(1) close and allocate, per-position claim)
//    against StakeV1Reference (frozen copy of the f816be3 Stake, O(positions)
//    allocation), driven with identical operations in the same blocks on the
//    in-process Hardhat chain. Every epoch's total weight, every epoch's mint,
//    every owner's total VCLM paid and every operation's success or failure
//    must be identical. Scenarios cover all three tokens and four durations,
//    extensions queued and applied, normal and terminal-state withdrawals,
//    zero-RAC epochs, late and out-of-order allocation, and the VCLM cap.
// 2. Scale: with thousands of positions, closeEpoch and allocateEpoch gas does
//    not grow, and claim gas depends only on the epochs claimed.
// Nothing is broadcast.
const { expect } = require("chai");
const { ethers, network } = require("hardhat");

const E = 864000n;
const DUR = [2592000n, 5184000n, 7776000n, 10368000n];
const SCALE = 10n ** 18n;
const CAP = 10_000_000_000n * SCALE;

function rng(seed) {
  let x = BigInt(seed) || 1n;
  return (n) => { x = (x * 6364136223846793005n + 1442695040888963407n) & ((1n << 64n) - 1n); return Number((x >> 33n) % BigInt(n)); };
}

// Mines at t, or one second after the last block if t is not later. Returns the time used.
async function mineAt(t) {
  const last = BigInt((await ethers.provider.getBlock("latest")).timestamp);
  const ts = t > last ? t : last + 1n;
  await network.provider.send("evm_setNextBlockTimestamp", [Number(ts)]);
  await network.provider.send("evm_mine");
  return ts;
}

async function deployPair() {
  const F = await ethers.getContractFactory("TestFixtureERC20");
  const VF = await ethers.getContractFactory("StakeTestVerifier");
  const mk = async (name) => {
    const v = await VF.deploy();
    const vc = await F.deploy(0), ch = await F.deploy(0), sy = await F.deploy(0);
    const st = await (await ethers.getContractFactory(name)).deploy(await vc.getAddress(), await ch.getAddress(), await sy.getAddress(), await v.getAddress());
    await (await v.setStake(await st.getAddress())).wait();
    return { v, vc, toks: [vc, ch, sy], st };
  };
  return { ref: await mk("StakeV1Reference"), neu: await mk("VinculumFinalisStake") };
}

// Sends the same call to both contracts in one block at time t; returns [okRef, okNew].
async function both(pair, t, fn) {
  await network.provider.send("evm_setAutomine", [false]);
  const txs = [];
  for (const side of [pair.ref, pair.neu]) {
    try { txs.push(await fn(side)); } catch (e) { txs.push(null); }
  }
  const ts = await mineAt(t);
  await network.provider.send("evm_setAutomine", [true]);
  const ok = [];
  ok.time = ts;
  for (const tx of txs) {
    if (!tx) { ok.push(false); continue; }
    const rc = await ethers.provider.getTransactionReceipt(tx.hash);
    ok.push(rc && rc.status === 1);
  }
  return ok;
}
let tGlobal = 0n;
async function bothT(pair, t, fn) { const ok = await both(pair, t, fn); tGlobal = ok.time; return ok; }

async function scenario(seed, opts = {}) {
  await network.provider.send("hardhat_reset");
  const S = await ethers.getSigners();
  const users = S.slice(1, 9);
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
  const owners = {}; // id -> user
  let nextId = 0n;
  let t = t0 + 1n;
  const EPOCHS = opts.epochs || 16;
  let closed = 0n, mism = 0;
  const allocated = new Set();
  const terminalAt = opts.terminalEpoch ? t0 + BigInt(opts.terminalEpoch) * E + 3n * 86400n : null;
  let terminalSet = false;
  const capEpoch = opts.capEpoch || 0;
  for (let step = 0; step < EPOCHS * 6; step++) {
    // advance 0.5 to 3.5 days, sometimes exactly to an epoch boundary
    t += r(4) === 0 ? (E - ((t - t0) % E)) : BigInt(43200 + r(259200));
    const cur = (t - t0) / E + 1n;
    if (cur > BigInt(EPOCHS) + 3n) break;
    if (terminalAt && !terminalSet && t >= terminalAt) {
      for (const side of [pair.ref, pair.neu]) await (await side.v.setLockIssued(CAP)).wait();
      terminalSet = true;
    }
    if (capEpoch && cur === BigInt(capEpoch)) {
      // leave less capacity than a typical epoch reward
      for (const side of [pair.ref, pair.neu]) await (await side.v.setLockIssued(CAP - 5n * SCALE - (await side.st.cumulativeRewardVclmMinted()))).wait();
    }
    const op = r(10);
    const ids = Object.keys(owners);
    let res;
    if (op <= 3 || ids.length === 0) {
      const u = users[r(users.length)], tok = r(3), d = DUR[r(4)], amt = BigInt(1 + r(5000)) * SCALE / BigInt(1 + r(7));
      res = await bothT(pair, t, (s) => s.st.connect(u).createPosition(tok, amt, d, G)); t = tGlobal;
      if (res[0]) owners[nextId++] = u;
    } else if (op <= 5) {
      const id = BigInt(ids[r(ids.length)]);
      const d = DUR[r(4)];
      res = await bothT(pair, t, (s) => s.st.connect(owners[id]).queueExtension(id, d, G)); t = tGlobal;
    } else if (op === 6) {
      const id = BigInt(ids[r(ids.length)]);
      res = await bothT(pair, t, (s) => s.st.connect(owners[id]).applyExtensionIfMatured(id, G)); t = tGlobal;
    } else if (op === 7) {
      const id = BigInt(ids[r(ids.length)]);
      res = await bothT(pair, t, (s) => s.st.connect(owners[id]).withdrawPosition(id, G)); t = tGlobal;
    } else {
      // RAC for the current epoch (sometimes none)
      const basis = r(3) === 0 ? 0n : BigInt(1 + r(100000)) * SCALE / 100n;
      for (const side of [pair.ref, pair.neu]) await (await side.v.setBasis(cur, basis)).wait();
      res = [true, true];
    }
    if (process.env.T269DBG) {
      const c2 = (t - t0) / E + 1n;
      for (let n = (c2 > 1n ? c2 - 1n : 1n); n < c2 + 14n; n++) {
        let sum = 0n; for (let i = 0n; i < nextId; i++) sum += await pair.neu.st.epochWeight(i, n);
        const inc = await pair.neu.st.epochTotalWeight(n);
        if (sum !== inc) { console.log("BREAK after op", op, "step", step, "epoch", String(n), "cur", String(c2), "sum", String(sum), "inc", String(inc), "t-t0", String(t - t0)); throw new Error("break"); }
      }
    }
    if (res[0] !== res[1]) { mism++; if (process.env.T269DBG) console.log("MISMATCH op", op, "res", res, "t-t0", String(t - t0)); }
    // close every ended epoch in order
    while (t0 + (closed + 1n) * E <= t) {
      const n = closed + 1n;
      const c = await bothT(pair, t, (s) => s.st.closeEpoch(n, G));
      expect([...c], "close " + n).to.deep.equal([true, true]);
      closed = n; t = tGlobal + 1n;
    }
    // allocate some final epochs, sometimes late or out of order
    for (let n = 1n; n + 1n < cur && n <= closed; n++) {
      if (allocated.has(n)) continue;
      if (r(3) === 0 && n + 4n > cur) continue; // leave it for later
      const a = await bothT(pair, t, (s) => s.st.allocateEpoch(n, { gasLimit: 15_000_000 }));
      expect([...a], "allocate " + n).to.deep.equal([true, true]);
      allocated.add(n); t = tGlobal + 1n;
    }
  }
  expect(mism, "operation outcomes differ").to.equal(0);
  // finish: close and allocate everything up to the last final epoch
  t += 3n * E;
  await mineAt(t);
  const cur = (t - t0) / E + 1n;
  for (let n = closed + 1n; n + 1n <= cur - 1n; n++) { await (await pair.ref.st.closeEpoch(n)).wait(); await (await pair.neu.st.closeEpoch(n)).wait(); closed = n; }
  const lastFinal = cur - 2n;
  for (let n = 1n; n <= lastFinal; n++) {
    if (allocated.has(n)) continue;
    await (await pair.ref.st.allocateEpoch(n, { gasLimit: 15_000_000 })).wait();
    await (await pair.neu.st.allocateEpoch(n, { gasLimit: 15_000_000 })).wait();
  }
  let paidEpochs = 0, totalMinted = 0n;
  for (let n = 1n; n <= lastFinal; n++) {
    const a = await pair.ref.st.epochs(n), b = await pair.neu.st.epochs(n);
    if (process.env.T269DBG && b.totalWeight !== a.totalWeight) { let sum = 0n; for (let i = 0n; i < nextId; i++) sum += await pair.neu.st.epochWeight(i, n); let sr = 0n; for (let i = 0n; i < nextId; i++) sr += await pair.ref.st.epochWeight(i, n); console.log("EPOCH", String(n), "ref", String(a.totalWeight), "new", String(b.totalWeight), "sumNewNow", String(sum), "sumRefNow", String(sr), "refAllocAt", String(a.allocateTimestamp - t0), "newAllocAt", String(b.allocateTimestamp - t0)); }
    expect(b.totalWeight, "total weight epoch " + n).to.equal(a.totalWeight);
    expect(b.mintedVclm, "minted epoch " + n).to.equal(a.mintedVclm);
    expect(b.rewardBasis).to.equal(a.rewardBasis);
    // the incremental total equals the earlier design's sum of _epochWeight
    let sum = 0n;
    for (let i = 0n; i < nextId; i++) sum += await pair.neu.st.epochWeight(i, n);
    if (b.allocated) expect(b.totalWeight, "sum of weights epoch " + n).to.equal(sum);
    if (a.mintedVclm > 0n) paidEpochs++;
    totalMinted += a.mintedVclm;
  }
  expect(await pair.neu.st.cumulativeRewardVclmMinted()).to.equal(await pair.ref.st.cumulativeRewardVclmMinted());
  // every owner's VCLM: reference claimVclm() vs new claimPositions(owner's ids)
  let paid = 0n;
  for (const u of users) {
    const myIds = Object.entries(owners).filter(([, o]) => o === u).map(([i]) => BigInt(i));
    const ra = await pair.ref.vc.balanceOf(u.address);
    if ((await pair.ref.st.claimableVclm(u.address)) > 0n) await (await pair.ref.st.connect(u).claimVclm()).wait();
    const refPaid = (await pair.ref.vc.balanceOf(u.address)) - ra;
    const nb = await pair.neu.vc.balanceOf(u.address);
    let view = 0n;
    for (const id of myIds) view += await pair.neu.st.claimableVclm(id, lastFinal);
    if (myIds.length) await (await pair.neu.st.connect(u).claimPositions(myIds, lastFinal, { gasLimit: 15_000_000 })).wait();
    const newPaid = (await pair.neu.vc.balanceOf(u.address)) - nb;
    expect(newPaid, "owner paid").to.equal(refPaid);
    expect(view).to.equal(newPaid);
    paid += newPaid;
    // claiming again pays nothing more
    for (const id of myIds) expect(await pair.neu.st.claimableVclm(id, lastFinal)).to.equal(0n);
  }
  expect(paid).to.be.lte(totalMinted);
  return { positions: Number(nextId), epochs: Number(lastFinal), paidEpochs, totalMinted, paid };
}

describe("t269u Stake differential: O(1) close/allocate gives exactly the f816be3 results", function () {
  this.timeout(1800000);
  for (const [seed, opts] of [[1, {}], [2, {}], [3, {}], [4, { epochs: 24 }], [5, { terminalEpoch: 9 }], [6, { terminalEpoch: 11, epochs: 18 }], [7, { capEpoch: 8 }], [8, { epochs: 30 }], [9, {}], [10, { terminalEpoch: 12, epochs: 20 }]]) {
    it(`seed ${seed} ${JSON.stringify(opts)}: identical totals, mints and per-owner payouts`, async () => {
      const s = await scenario(seed, opts);
      console.log(`      seed ${seed}: ${s.positions} positions, ${s.epochs} final epochs (${s.paidEpochs} paid), minted ${ethers.formatEther(s.totalMinted)} VCLM, paid ${ethers.formatEther(s.paid)}`);
      expect(s.positions).to.be.gt(5);
      expect(s.paidEpochs).to.be.gt(0);
    });
  }
});

describe("t269u Stake scale: close and allocate do not grow with positions", function () {
  this.timeout(1800000);
  it("3,000 positions: closeEpoch and allocateEpoch gas equal to the 30-position case; claim cost per epoch only", async () => {
    const res = {};
    for (const P of [30, 3000]) {
      await network.provider.send("hardhat_reset");
      const S = await ethers.getSigners();
      const { neu } = await deployPair();
      const now = BigInt((await ethers.provider.getBlock("latest")).timestamp);
      const t0 = now + 1000n;
      await (await neu.v.setLaunch(t0)).wait();
      const users = S.slice(0, 10);
      for (const u of users) for (const tk of neu.toks) { await (await tk.mint(u.address, 10n ** 30n)).wait(); await (await tk.connect(u).approve(await neu.st.getAddress(), 2n ** 255n)).wait(); }
      await mineAt(t0 + 10n);
      await network.provider.send("evm_setAutomine", [false]);
      for (let i = 0; i < P; i++) {
        await neu.st.connect(users[i % 10]).createPosition(i % 3, SCALE * BigInt(1 + (i % 7)), DUR[i % 4], { gasLimit: 1_000_000 });
        if (i % 40 === 39) await network.provider.send("evm_mine");
      }
      await network.provider.send("evm_mine");
      await network.provider.send("evm_setAutomine", [true]);
      expect(await neu.st.nextPositionId()).to.equal(BigInt(P));
      for (let n = 2n; n <= 13n; n++) await (await neu.v.setBasis(n, 1000n * SCALE)).wait();
      await mineAt(t0 + 14n * E);
      const g = { close: [], alloc: [] };
      for (let n = 1n; n <= 13n; n++) g.close.push((await (await neu.st.closeEpoch(n)).wait()).gasUsed);
      for (let n = 1n; n <= 12n; n++) g.alloc.push((await (await neu.st.allocateEpoch(n)).wait()).gasUsed);
      // a 120-day position claims its 11 epochs; a 30-day one its 2
      const c120 = (await (await neu.st.connect(users[3]).claimPosition(3n, 12n)).wait()).gasUsed;
      const c30 = (await (await neu.st.connect(users[0]).claimPosition(0n, 12n)).wait()).gasUsed;
      res[P] = { close: g.close.reduce((a, b) => (a > b ? a : b)), alloc: g.alloc.reduce((a, b) => (a > b ? a : b)), c120, c30 };
      console.log(`      ${P} positions: max closeEpoch ${res[P].close}, max allocateEpoch ${res[P].alloc}, claim 120d (11 epochs) ${c120}, claim 30d ${c30}`);
    }
    expect(res[3000].close).to.equal(res[30].close);
    expect(res[3000].alloc).to.equal(res[30].alloc);
    expect(res[3000].c120).to.equal(res[30].c120);
    expect(res[3000].alloc).to.be.lt(200000n);
  });
});
