// t272u item 2: eligibility and epoch totals, current Stake against
// StakeV1Reference (frozen f816be3 Stake), same operations in the same block.
// 1. Boundary: to count in epoch N a position must stay staked through the
//    scheduled end of epoch N+1. Ending exactly at that moment counts; ending
//    one second earlier does not.
// 2. Multiplier rule (t269u): each epoch uses the duration multiplier in force
//    at that epoch's start, even when an extension is queued later inside it.
// 3. Epoch totals stay exact through create, expiry, withdrawal at maturity,
//    queued and applied extensions, and early (terminal) withdrawal: every
//    epoch total equals the reference and equals the sum of position weights.
// Nothing is broadcast. No keys.
const { expect } = require("chai");
const { ethers, network } = require("hardhat");

const E = 864000n;
const D30 = 2592000n, D60 = 5184000n, D90 = 7776000n, D120 = 10368000n;
const SCALE = 10n ** 18n;
const CAP = 10_000_000_000n * SCALE;

async function deployOne(name) {
  const F = await ethers.getContractFactory("TestFixtureERC20");
  const v = await (await ethers.getContractFactory("StakeTestVerifier")).deploy();
  const vc = await F.deploy(0), ch = await F.deploy(0), sy = await F.deploy(0);
  const st = await (await ethers.getContractFactory(name)).deploy(await vc.getAddress(), await ch.getAddress(), await sy.getAddress(), await v.getAddress());
  await (await v.setStake(await st.getAddress())).wait();
  return { v, vc, toks: [vc, ch, sy], st };
}
async function setup(nUsers) {
  await network.provider.send("hardhat_reset");
  const S = await ethers.getSigners();
  const users = S.slice(1, 1 + nUsers);
  const ref = await deployOne("StakeV1Reference"), neu = await deployOne("VinculumFinalisStake");
  const t0 = BigInt((await ethers.provider.getBlock("latest")).timestamp) + 1000n;
  for (const s of [ref, neu]) {
    await (await s.v.setLaunch(t0)).wait();
    for (const u of users) for (const tk of s.toks) { await (await tk.mint(u.address, 10n ** 30n)).wait(); await (await tk.connect(u).approve(await s.st.getAddress(), 2n ** 255n)).wait(); }
    for (let n = 1n; n <= 40n; n++) await (await s.v.setBasis(n, (100n + n * 7n) * SCALE)).wait();
  }
  return { ref, neu, users, t0 };
}
// the same call on both contracts in ONE block at timestamp t
async function both(ctx, t, fn) {
  await network.provider.send("evm_setAutomine", [false]);
  const a = await fn(ctx.ref.st), b = await fn(ctx.neu.st);
  await network.provider.send("evm_setNextBlockTimestamp", [Number(t)]);
  await network.provider.send("evm_mine");
  await network.provider.send("evm_setAutomine", [true]);
  for (const tx of [a, b]) expect((await ethers.provider.getTransactionReceipt(tx.hash)).status).to.equal(1);
}
async function closeAllocate(ctx, upTo, t) {
  await network.provider.send("evm_setNextBlockTimestamp", [Number(t)]);
  await network.provider.send("evm_mine");
  for (const s of [ctx.ref, ctx.neu]) {
    for (let n = 1n; n <= upTo + 1n; n++) if (!(await s.st.epochs(n)).closed) await (await s.st.closeEpoch(n, { gasLimit: 30_000_000 })).wait();
  }
  for (let n = 1n; n <= upTo; n++) {
    if (!(await ctx.ref.st.epochs(n)).allocated) await (await ctx.ref.st.allocateEpoch(n, { gasLimit: 30_000_000 })).wait();
    if (!(await ctx.neu.st.epochs(n)).allocated) await (await ctx.neu.st.allocateEpoch(n, { gasLimit: 30_000_000 })).wait();
  }
}
// every epoch: same total, same mint, total == sum of position weights; every position: same weight as the reference
async function checkTotals(ctx, upTo, nPos) {
  for (let n = 1n; n <= upTo; n++) {
    const a = await ctx.ref.st.epochs(n), b = await ctx.neu.st.epochs(n);
    expect(b.totalWeight, "total weight epoch " + n).to.equal(a.totalWeight);
    expect(b.mintedVclm, "minted epoch " + n).to.equal(a.mintedVclm);
    let sum = 0n;
    for (let i = 0n; i < nPos; i++) {
      const wn = await ctx.neu.st.epochWeight(i, n), wr = await ctx.ref.st.epochWeight(i, n);
      expect(wn, `position ${i} epoch ${n}`).to.equal(wr);
      sum += wn;
    }
    expect(b.totalWeight, "sum of position weights epoch " + n).to.equal(sum);
  }
}
const w = (amt, tokBps, multBps) => (amt * BigInt(tokBps) * BigInt(multBps)) / 100000000n;

describe("t272u Stake eligibility and epoch totals vs f816be3", function () {
  this.timeout(1800000);

  it("boundary: ending exactly at the end of epoch N+1 counts in N; ending one second earlier does not", async () => {
    const ctx = await setup(3);
    const [a, c] = ctx.users;
    const t0 = ctx.t0;
    // position 0 (wallet c): created 1 second before epoch 2 starts, 30 days -> ends at t0+4E-1
    await both(ctx, t0 + E - 1n, (s) => s.connect(c).createPosition(0, 100n * SCALE, D30));
    // position 1 (wallet a): created exactly at the start of epoch 2, 30 days -> ends at t0+4E (end of epoch 4)
    await both(ctx, t0 + E, (s) => s.connect(a).createPosition(0, 100n * SCALE, D30));
    const p0 = await ctx.neu.st.positions(0n), p1 = await ctx.neu.st.positions(1n);
    expect(p0.endTimestamp).to.equal(t0 + 4n * E - 1n);
    expect(p1.endTimestamp).to.equal(t0 + 4n * E);
    const m30 = await ctx.neu.st.stakeMultiplierBps(D30);
    for (const s of [ctx.ref.st, ctx.neu.st]) {
      // epoch 2: both count (epoch 3 ends at t0+3E, before both ends)
      expect(await s.epochWeight(0n, 2n)).to.equal(w(100n * SCALE, 10000, m30));
      expect(await s.epochWeight(1n, 2n)).to.equal(w(100n * SCALE, 10000, m30));
      // epoch 3: N+1 = epoch 4 ends at t0+4E. Position 1 ends exactly then: counts. Position 0 ends 1 second short: excluded.
      expect(await s.epochWeight(1n, 3n)).to.equal(w(100n * SCALE, 10000, m30));
      expect(await s.epochWeight(0n, 3n)).to.equal(0n);
      // epoch 1: neither (position 0 started after epoch 1 began; position 1 after it ended)
      expect(await s.epochWeight(0n, 1n)).to.equal(0n);
      expect(await s.epochWeight(1n, 1n)).to.equal(0n);
      expect(await s.epochWeight(1n, 4n)).to.equal(0n);
    }
    await closeAllocate(ctx, 5n, t0 + 6n * E + 1n);
    await checkTotals(ctx, 5n, 2n);
    expect((await ctx.neu.st.epochs(3n)).totalWeight).to.equal(w(100n * SCALE, 10000, m30)); // position 1 only
    // payouts: position 1 gets all of epoch 3; both split epoch 2
    const e2 = await ctx.neu.st.epochs(2n), e3 = await ctx.neu.st.epochs(3n);
    expect(await ctx.neu.st.claimableVclm(1n, 5n)).to.equal(e2.mintedVclm / 2n + e3.mintedVclm);
    expect(await ctx.neu.st.claimableVclm(0n, 5n)).to.equal(e2.mintedVclm / 2n);
    console.log(`      ends at t0+4E (end of epoch 4): counts in epochs 2 and 3; ends at t0+4E-1: counts in epoch 2 only. Same in f816be3.`);
  });

  it("t269u: the multiplier at the start of the earning epoch applies, even when an extension is queued later in that epoch", async () => {
    const ctx = await setup(2);
    const [a] = ctx.users;
    const t0 = ctx.t0;
    const m30 = await ctx.neu.st.stakeMultiplierBps(D30), m120 = await ctx.neu.st.stakeMultiplierBps(D120);
    expect(m120).to.be.gt(m30);
    // 30-day position from t0+5: first term ends t0+3E+5 (5 seconds into epoch 4)
    await both(ctx, t0 + 5n, (s) => s.connect(a).createPosition(0, 100n * SCALE, D30));
    const before = [];
    for (let n = 1n; n <= 6n; n++) before.push(await ctx.neu.st.epochWeight(0n, n));
    expect(before).to.deep.equal([0n, w(100n * SCALE, 10000, m30), 0n, 0n, 0n, 0n]);
    // queue a 120-day term late in epoch 3 (100 seconds before epoch 3 ends)
    await both(ctx, t0 + 3n * E - 100n, (s) => s.connect(a).queueExtension(0n, D120));
    for (const s of [ctx.ref.st, ctx.neu.st]) {
      expect(await s.epochWeight(0n, 2n)).to.equal(w(100n * SCALE, 10000, m30));
      // epoch 3 started under the 30-day term; the extension queued inside it does not raise it
      expect(await s.epochWeight(0n, 3n)).to.equal(w(100n * SCALE, 10000, m30));
      // epoch 4 starts at t0+3E, 5 seconds BEFORE the 120-day term begins: still the 30-day multiplier
      expect(await s.epochWeight(0n, 4n)).to.equal(w(100n * SCALE, 10000, m30));
      // epoch 5 starts after the 120-day term began: 120-day multiplier
      expect(await s.epochWeight(0n, 5n)).to.equal(w(100n * SCALE, 10000, m120));
    }
    await closeAllocate(ctx, 6n, t0 + 7n * E + 1n);
    await checkTotals(ctx, 6n, 1n);
    console.log(`      epochs 2-4 at the 30-day multiplier ${m30} bps, epoch 5 on at the 120-day multiplier ${m120} bps; same in f816be3`);
  });

  it("epoch totals stay exact through create, expiry, withdrawal at maturity, extensions and early terminal withdrawal", async () => {
    const ctx = await setup(4);
    const [a, b, c, d] = ctx.users;
    const t0 = ctx.t0;
    const ops = [
      [t0 + 100n, (s) => s.connect(a).createPosition(0, 100n * SCALE, D30)],     // 0: expires, withdrawn at maturity
      [t0 + 200n, (s) => s.connect(b).createPosition(1, 37n * SCALE, D60)],      // 1: extended and applied
      [t0 + 300n, (s) => s.connect(c).createPosition(2, 5n * SCALE, D120)],      // 2: withdrawn early in terminal state
      [t0 + E + 7n, (s) => s.connect(a).createPosition(2, 11n * SCALE, D90)],    // 3: a second position for wallet a
      [t0 + 2n * E, (s) => s.connect(d).createPosition(0, 13n * SCALE, D30)],    // 4: expires, never withdrawn
      [t0 + 3n * E + 50n, (s) => s.connect(b).queueExtension(1n, D90)],          // extension queued mid-term
      [t0 + 3n * E + 101n, (s) => s.connect(a).withdrawPosition(0n)],            // at maturity (position 0 ends t0+3E+100)
    ];
    for (const [t, fn] of ops) await both(ctx, t, fn);
    await closeAllocate(ctx, 4n, t0 + 5n * E + 10n);
    // position 1 term 1 ends t0+200+60d = t0+6E+200: apply the queued 90-day term, then queue another
    await both(ctx, t0 + 6n * E + 201n, (s) => s.connect(b).applyExtensionIfMatured(1n));
    await both(ctx, t0 + 6n * E + 300n, (s) => s.connect(b).queueExtension(1n, D30));
    await both(ctx, t0 + 7n * E, (s) => s.connect(c).createPosition(1, 3n * SCALE, D30)); // 5: created exactly on an epoch start
    await closeAllocate(ctx, 8n, t0 + 9n * E + 10n);
    await checkTotals(ctx, 8n, 6n);
    // terminal state, then early withdrawal of position 2 (ends t0+300+120d = t0+12E+300)
    for (const s of [ctx.ref, ctx.neu]) await (await s.v.setLockIssued(CAP)).wait();
    const w2before = await ctx.neu.st.epochWeight(2n, 9n);
    expect(w2before).to.be.gt(0n);
    await both(ctx, t0 + 9n * E + 500n, (s) => s.connect(c).withdrawPosition(2n));
    await both(ctx, t0 + 9n * E + 600n, (s) => s.connect(b).withdrawPosition(1n)); // early too (queued term running)
    for (const s of [ctx.ref.st, ctx.neu.st]) {
      expect(await s.terminalState()).to.equal(true);
      // epoch 8: its N+1 (epoch 9) ended at t0+9E, before the withdrawal, so epoch 8 is kept
      expect(await s.epochWeight(2n, 8n)).to.be.gt(0n);
      // epoch 9 needs epoch 10 to end (t0+10E): the early withdrawal removes it
      expect(await s.epochWeight(2n, 9n)).to.equal(0n);
    }
    await closeAllocate(ctx, 14n, t0 + 15n * E + 10n);
    await checkTotals(ctx, 14n, 6n);
    expect(await ctx.neu.st.terminalState()).to.equal(await ctx.ref.st.terminalState());
    // exact payouts per position equal the reference per owner
    let exactTotal = 0n;
    for (const u of [a, b, c, d]) {
      const ids = [];
      for (let i = 0n; i < 6n; i++) if ((await ctx.neu.st.positions(i)).owner === u.address) ids.push(i);
      const n0 = await ctx.neu.vc.balanceOf(u.address);
      await (await ctx.neu.st.connect(u).claimPositions(ids, 14n)).wait();
      const got = (await ctx.neu.vc.balanceOf(u.address)) - n0;
      const r0 = await ctx.ref.vc.balanceOf(u.address);
      if ((await ctx.ref.st.claimableVclm(u.address)) > 0n) await (await ctx.ref.st.connect(u).claimVclm()).wait();
      expect(got, "owner payout vs reference").to.equal((await ctx.ref.vc.balanceOf(u.address)) - r0);
      exactTotal += got;
    }
    expect(exactTotal).to.be.gt(0n);
    console.log(`      14 epochs, 6 positions, 4 wallets: every epoch total and every position weight equal f816be3 and the sum of position weights`);
  });
});
