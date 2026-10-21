// t270u: VinculumFinalisStake scale and worst-case gas. Test branch only.
// Nothing is broadcast. No keys.
// 1. Scale differential: 500 positions (mixed tokens, durations, extensions,
//    withdrawals) in both the current Stake and StakeV1Reference (frozen
//    f816be3). Same totals, mints and per-owner payouts. Reference allocation
//    gas per position is measured to show where it would hit the Base cap.
// 2. 5,000 historical positions in the current Stake: close, allocate,
//    create, queue, withdraw and claim gas equal to the small case.
// 3. Long-lived positions (120-day terms extended for 600 epochs, 30-day
//    terms extended 190 times): claim gas per epoch, epochs per transaction
//    under the Base 16,777,216 cap, term-history cost, claimPositions.
// 4. Constructed worst cases for queueExtension and early withdrawal, and
//    close and allocate after a 100-epoch delay.
const { expect } = require("chai");
const { ethers, network } = require("hardhat");

const E = 864000n;
const D30 = 2592000n, D60 = 5184000n, D90 = 7776000n, D120 = 10368000n;
const DUR = [D30, D60, D90, D120];
const SCALE = 10n ** 18n;
const CAP = 10_000_000_000n * SCALE;
const TX_CAP = 16_777_216n;
const GAS = {};
function rec(k, g) { g = BigInt(g); if (!GAS[k] || g > GAS[k]) GAS[k] = g; }

async function mineAt(t) {
  const last = BigInt((await ethers.provider.getBlock("latest")).timestamp);
  const ts = t > last ? t : last + 1n;
  await network.provider.send("evm_setNextBlockTimestamp", [Number(ts)]);
  await network.provider.send("evm_mine");
  return ts;
}
async function at(t) { const last = BigInt((await ethers.provider.getBlock("latest")).timestamp); if (t > last) await network.provider.send("evm_setNextBlockTimestamp", [Number(t)]); }
async function gasOf(p) { return (await (await p).wait()).gasUsed; }
async function deployOne(name) {
  const F = await ethers.getContractFactory("TestFixtureERC20");
  const v = await (await ethers.getContractFactory("StakeTestVerifier")).deploy();
  const vc = await F.deploy(0), ch = await F.deploy(0), sy = await F.deploy(0);
  const st = await (await ethers.getContractFactory(name)).deploy(await vc.getAddress(), await ch.getAddress(), await sy.getAddress(), await v.getAddress());
  await (await v.setStake(await st.getAddress())).wait();
  return { v, vc, toks: [vc, ch, sy], st };
}
async function setup(names, nUsers) {
  await network.provider.send("hardhat_reset");
  const S = await ethers.getSigners();
  const users = S.slice(0, nUsers);
  const out = {};
  for (const nm of names) out[nm] = await deployOne(nm);
  const t0 = BigInt((await ethers.provider.getBlock("latest")).timestamp) + 1000n;
  for (const nm of names) {
    const side = out[nm];
    await (await side.v.setLaunch(t0)).wait();
    for (const u of users) for (const tk of side.toks) { await (await tk.mint(u.address, 10n ** 32n)).wait(); await (await tk.connect(u).approve(await side.st.getAddress(), 2n ** 255n)).wait(); }
  }
  return { out, users, t0 };
}
async function batch(fns, per = 50) {
  await network.provider.send("evm_setAutomine", [false]);
  const txs = [];
  for (let i = 0; i < fns.length; i++) { txs.push(await fns[i]()); if (i % per === per - 1) await network.provider.send("evm_mine"); }
  await network.provider.send("evm_mine");
  await network.provider.send("evm_setAutomine", [true]);
  const rcs = [];
  for (const tx of txs) { const rc = await ethers.provider.getTransactionReceipt(tx.hash); expect(rc.status).to.equal(1); rcs.push(rc); }
  return rcs;
}

describe("t270u Stake scale and worst-case gas", function () {
  this.timeout(7200000);
  after(() => {
    console.log("GAS_WORST " + JSON.stringify(Object.fromEntries(Object.entries(GAS).map(([k, v]) => [k, Number(v)]))));
  });

  it("scale differential: 500 positions, identical to f816be3; reference allocate grows per position", async () => {
    const { out, users, t0 } = await setup(["StakeV1Reference", "VinculumFinalisStake"], 10);
    const ref = out.StakeV1Reference, neu = out.VinculumFinalisStake;
    const P = 500;
    // positions over the first 25 days, every token and duration
    const plan = [];
    for (let i = 0; i < P; i++) plan.push({ u: users[i % 10], tok: i % 3, d: DUR[(i * 7) % 4], amt: SCALE * BigInt(1 + ((i * 13) % 97)) / BigInt(1 + (i % 5)), t: t0 + 10n + BigInt(Math.floor(i * 25 * 86400 / P)) });
    for (let g = 0; g < P; g += 25) {
      const grp = plan.slice(g, g + 25);
      await at(grp[0].t);
      await batch(grp.flatMap((p) => [() => ref.st.connect(p.u).createPosition(p.tok, p.amt, p.d, { gasLimit: 1_000_000 }), () => neu.st.connect(p.u).createPosition(p.tok, p.amt, p.d, { gasLimit: 1_000_000 })]), 100);
    }
    for (let n = 1n; n <= 20n; n++) for (const s of [ref, neu]) await (await s.v.setBasis(n, (n % 4n === 0n ? 0n : 500n + n * 37n) * SCALE)).wait();
    // day 28: a third of positions queue an extension (mid-epoch)
    await at(t0 + 28n * 86400n + 3333n);
    const ext = [];
    for (let i = 0; i < P; i += 3) ext.push(i);
    await batch(ext.flatMap((i) => [() => ref.st.connect(plan[i].u).queueExtension(i, DUR[(i + 1) % 4], { gasLimit: 1_000_000 }), () => neu.st.connect(plan[i].u).queueExtension(i, DUR[(i + 1) % 4], { gasLimit: 1_000_000 })]), 100);
    // close and allocate 1..17, withdraw matured positions at day 95
    let closed = 0n, alloc = 0n;
    const refAlloc = [];
    async function progress(T) {
      await mineAt(T);
      while (t0 + (closed + 1n) * E <= T) { closed++; await (await ref.st.closeEpoch(closed)).wait(); await (await neu.st.closeEpoch(closed)).wait(); }
      while (alloc + 1n < closed && t0 + (alloc + 2n) * E <= T) {
        alloc++;
        const g = await gasOf(ref.st.allocateEpoch(alloc, { gasLimit: 100_000_000 }));
        refAlloc.push(g);
        rec("allocateEpoch(500 positions, current)", await gasOf(neu.st.allocateEpoch(alloc, { gasLimit: 15_000_000 })));
      }
    }
    await progress(t0 + 95n * 86400n);
    const wd = [];
    for (let i = 1; i < P; i += 3) { const p = await ref.st.positions(i); if (p.endTimestamp + (p.queuedExtensionBps > 0n ? p.queuedExtensionSecs : 0n) <= t0 + 95n * 86400n + 10n) wd.push(i); }
    await batch(wd.flatMap((i) => [() => ref.st.connect(plan[i].u).withdrawPosition(i, { gasLimit: 1_000_000 }), () => neu.st.connect(plan[i].u).withdrawPosition(i, { gasLimit: 1_000_000 })]), 100);
    await progress(t0 + 19n * E + 5n);
    expect(alloc).to.equal(18n);
    let minted = 0n;
    for (let n = 1n; n <= 18n; n++) {
      const a = await ref.st.epochs(n), b = await neu.st.epochs(n);
      expect(b.totalWeight, "weight " + n).to.equal(a.totalWeight);
      expect(b.mintedVclm, "minted " + n).to.equal(a.mintedVclm);
      minted += a.mintedVclm;
    }
    for (const u of users) {
      const ids = plan.map((p, i) => [p, i]).filter(([p]) => p.u === u).map(([, i]) => BigInt(i));
      const r0 = await ref.vc.balanceOf(u.address);
      await (await ref.st.connect(u).claimVclm()).wait();
      const rp = (await ref.vc.balanceOf(u.address)) - r0;
      const n0 = await neu.vc.balanceOf(u.address);
      const g = await gasOf(neu.st.connect(u).claimPositions(ids, 18n, { gasLimit: 15_000_000 }));
      rec("claimPositions(50 positions, up to 18 epochs)", g);
      expect((await neu.vc.balanceOf(u.address)) - n0, "owner payout").to.equal(rp);
    }
    const mx = refAlloc.reduce((a, b) => (a > b ? a : b));
    console.log(`      500 positions: ${wd.length * 2 / 2} withdrawals, ${ext.length} extensions, minted ${ethers.formatEther(minted)} VCLM identical; reference allocateEpoch max ${mx} gas (${mx / 500n} per position, cap reached near ${TX_CAP * 500n / mx} positions); current max ${GAS["allocateEpoch(500 positions, current)"]}`);
  });

  it("5,000 historical positions: per-call gas identical to a 30-position contract", async () => {
    const res = {};
    for (const P of [30, 5000]) {
      const { out, users, t0 } = await setup(["VinculumFinalisStake"], 10);
      const neu = out.VinculumFinalisStake;
      await at(t0 + 10n);
      await batch(Array.from({ length: P }, (_, i) => () => neu.st.connect(users[i % 10]).createPosition(i % 3, SCALE * BigInt(1 + (i % 7)), DUR[i % 4], { gasLimit: 1_000_000 })), 100);
      for (let n = 1n; n <= 40n; n++) await (await neu.v.setBasis(n, 1000n * SCALE)).wait();
      // all expire; half are withdrawn; then fresh activity at epoch 20
      let closed = 0n, alloc = 0n;
      async function prog(T) { await mineAt(T); while (t0 + (closed + 1n) * E <= T) { closed++; await (await neu.st.closeEpoch(closed)).wait(); } while (alloc + 1n < closed) { alloc++; await (await neu.st.allocateEpoch(alloc)).wait(); } }
      await prog(t0 + 14n * E);
      await batch(Array.from({ length: P / 2 }, (_, j) => () => neu.st.connect(users[(2 * j) % 10]).withdrawPosition(2 * j, { gasLimit: 1_000_000 })), 100);
      await prog(t0 + 19n * E + 100n);
      const g = {};
      const id = await neu.st.nextPositionId();
      await at(t0 + 19n * E + 200n);
      g.create = await gasOf(neu.st.connect(users[1]).createPosition(1, SCALE, D120));
      await at(t0 + 20n * E + 100n); g.close = await gasOf(neu.st.closeEpoch(20n));
      g.queue = await gasOf(neu.st.connect(users[1]).queueExtension(id, D90));
      await at(t0 + 21n * E + 100n); g.close2 = await gasOf(neu.st.closeEpoch(21n));
      g.alloc = await gasOf(neu.st.allocateEpoch(19n));
      g.alloc2 = await gasOf(neu.st.allocateEpoch(20n));
      g.withdraw = await gasOf(neu.st.connect(users[1]).withdrawPosition(1n));
      const c120 = await gasOf(neu.st.connect(users[3]).claimPosition(3n, 18n));
      g.claim120 = c120;
      res[P] = g;
      console.log(`      ${P} positions: ${JSON.stringify(Object.fromEntries(Object.entries(g).map(([k, v]) => [k, Number(v)])))}`);
    }
    // queue carries the position id in calldata (5,000 vs 30), a few gas of calldata only
    for (const k of Object.keys(res[30])) { const d = res[5000][k] - res[30][k]; expect(d < 0n ? -d : d, k).to.be.lte(k === "queue" ? 64n : 0n); }
  });

  it("long-lived positions: claim gas per epoch, epochs per transaction under 16,777,216, term history cost", async () => {
    const { out, users, t0 } = await setup(["VinculumFinalisStake"], 4);
    const neu = out.VinculumFinalisStake;
    const N = 600n; // epochs, about 16.4 years
    await at(t0 + 5n);
    await (await neu.st.connect(users[0]).createPosition(0, 1000n * SCALE, D120)).wait(); // id 0, 120-day terms
    await at(t0 + 6n);
    await (await neu.st.connect(users[1]).createPosition(2, 7n * SCALE, D30)).wait();     // id 1, 30-day terms
    await (await neu.st.connect(users[0]).queueExtension(0n, D120)).wait();
    await (await neu.st.connect(users[1]).queueExtension(1n, D30)).wait();
    for (let n = 1n; n <= N + 2n; n++) await (await neu.v.setBasis(n, (100n + (n % 13n)) * SCALE)).wait();
    let closed = 0n, alloc = 0n;
    const ends = [];
    for (const id of [0n, 1n]) ends.push((await neu.st.positions(id)).endTimestamp);
    let applies = [0, 0];
    while (closed < N + 1n) {
      // next event: an epoch end or a term end
      const nextClose = t0 + (closed + 1n) * E;
      const nextEnd = ends[0] < ends[1] ? ends[0] : ends[1];
      if (nextEnd <= nextClose) {
        const k = ends[0] <= ends[1] ? 0 : 1;
        await at(nextEnd + 1n);
        const ga = await gasOf(neu.st.connect(users[k]).applyExtensionIfMatured(BigInt(k)));
        rec("applyExtensionIfMatured", ga);
        if (BigInt(closed) < N - 14n) { const gq = await gasOf(neu.st.connect(users[k]).queueExtension(BigInt(k), k === 0 ? D120 : D30)); rec("queueExtension(long history)", gq); }
        applies[k]++;
        const p = await neu.st.positions(BigInt(k));
        ends[k] = p.queuedExtensionBps > 0n ? p.endTimestamp : 2n ** 200n;
        continue;
      }
      await at(nextClose);
      closed++;
      rec("closeEpoch", await gasOf(neu.st.closeEpoch(closed)));
      if (closed >= 2n) { alloc = closed - 1n; rec("allocateEpoch", await gasOf(neu.st.allocateEpoch(alloc))); }
    }
    const terms0 = await neu.st.termCount(0n), terms1 = await neu.st.termCount(1n);
    const last0 = alloc;
    // claim spans on position 0 (120-day terms): 1, 10, 100, then the rest
    const spans = [];
    let from = await neu.st.nextClaimEpoch(0n);
    for (const k of [1n, 10n, 100n, 300n]) {
      const to = from + k - 1n;
      const g = await gasOf(neu.st.connect(users[0]).claimPosition(0n, to, { gasLimit: 30_000_000 }));
      spans.push([k, g]); from = to + 1n;
    }
    const per120 = (spans[3][1] - spans[2][1]) / 200n;
    const base120 = spans[0][1] - per120;
    // position 1 (30-day terms, many terms): claim 1 epoch at the very start, then 400, then 1 at the end
    let f1 = await neu.st.nextClaimEpoch(1n);
    const g1a = await gasOf(neu.st.connect(users[1]).claimPosition(1n, f1, { gasLimit: 30_000_000 }));
    f1 = f1 + 1n;
    const g1b = await gasOf(neu.st.connect(users[1]).claimPosition(1n, f1 + 399n, { gasLimit: 30_000_000 }));
    f1 = f1 + 400n;
    const g1c = await gasOf(neu.st.connect(users[1]).claimPosition(1n, f1, { gasLimit: 30_000_000 }));
    const per30 = (g1b - g1a) / 399n;
    const maxEpochs120 = (TX_CAP - base120) / per120;
    const maxEpochs30 = (TX_CAP - g1a) / per30;
    rec("claimPosition(1 epoch)", spans[0][1]);
    rec("claimPosition(300 epochs)", spans[3][1]);
    rec("claimPosition(1 epoch after " + terms1 + " terms)", g1c);
    console.log(`      position 0: ${terms0} terms (${applies[0]} applied), position 1: ${terms1} terms; ${last0} epochs allocated`);
    console.log(`      claim 120-day position: ${spans.map(([k, g]) => k + " epochs " + g).join(", ")}; about ${per120} gas per epoch, ${maxEpochs120} epochs (${maxEpochs120 / 36n} years) per transaction under 16,777,216`);
    console.log(`      claim 30-day position: 1 epoch ${g1a}, 400 epochs ${g1b} (about ${per30} per epoch, ${maxEpochs30} epochs per transaction); 1 epoch after ${terms1} terms ${g1c} (term history walked from the first term)`);
    expect(maxEpochs120).to.be.gt(1000n);
    expect(maxEpochs30).to.be.gt(1000n);
    expect(g1c).to.be.lt(TX_CAP / 10n);
    // every claimed amount equals the exact rule (spot check: total paid == sum of per-epoch floors)
    let exact = 0n;
    for (let n = 1n; n <= last0; n++) { const e = await neu.st.epochs(n); const w = await neu.st.epochWeight(0n, n); if (e.mintedVclm > 0n && w > 0n) exact += (e.mintedVclm * w) / e.totalWeight; }
    const rest = await neu.st.claimableVclm(0n, last0);
    expect((await neu.vc.balanceOf(users[0].address)) - (10n ** 32n - 1000n * SCALE) + rest).to.equal(exact);
  });

  it("constructed worst cases: queueExtension touching a closed epoch, early terminal withdrawal, 100-epoch delay", async () => {
    const { out, users, t0 } = await setup(["VinculumFinalisStake"], 4);
    const neu = out.VinculumFinalisStake;
    // fresh-slot create (first ever) and a create into already-written slots
    await at(t0 + 5000n);
    rec("createPosition(first, fresh slots)", await gasOf(neu.st.connect(users[0]).createPosition(0, SCALE, D30)));
    await at(t0 + 5001n);
    rec("createPosition(new owner, fresh epoch slots)", await gasOf(neu.st.connect(users[1]).createPosition(2, SCALE, D120)));
    for (let i = 0; i < 3; i++) rec("createPosition(typical)", await gasOf(neu.st.connect(users[2]).createPosition(1, SCALE, D60)));
    // position 0 ends at t0+30d+1, inside epoch 4. Close 1..3 during epoch 4, then queue: epoch 3 (closed) is changed directly
    await at(t0 + 30n * 86400n - 100n);
    for (let n = 1n; n <= 2n; n++) await (await neu.st.closeEpoch(n)).wait();
    await at(t0 + 30n * 86400n + 10n);
    await (await neu.st.closeEpoch(3n)).wait();
    const g = await gasOf(neu.st.connect(users[0]).queueExtension(0n, D120));
    rec("queueExtension(touches closed epoch, two multipliers)", g);
    expect(await neu.st.epochTotalWeight(3n)).to.be.gt(0n);
    // early terminal withdrawal of position 1 (120 days, queued 90) at epoch 6
    await (await neu.st.connect(users[1]).queueExtension(1n, D90)).wait();
    await at(t0 + 55n * 86400n);
    for (let n = 4n; n <= 5n; n++) await (await neu.st.closeEpoch(n)).wait();
    await (await neu.v.setLockIssued(CAP)).wait();
    rec("withdrawPosition(early terminal, queued term)", await gasOf(neu.st.connect(users[1]).withdrawPosition(1n)));
    rec("withdrawPosition(early terminal)", await gasOf(neu.st.connect(users[0]).withdrawPosition(0n)));
    await (await neu.v.setLockIssued(0n)).wait();
    // 100-epoch delay: nobody closes or allocates from epoch 6 to 106
    await at(t0 + 106n * E + 5n);
    let mxc = 0n, mxa = 0n;
    for (let n = 6n; n <= 106n; n++) { const c = await gasOf(neu.st.closeEpoch(n)); if (c > mxc) mxc = c; }
    for (let n = 1n; n <= 105n; n++) { const a = await gasOf(neu.st.allocateEpoch(n)); if (a > mxa) mxa = a; }
    rec("closeEpoch(after 100-epoch delay, each)", mxc);
    rec("allocateEpoch(after 100-epoch delay, each)", mxa);
    // positions 2..4 claim after the delay in one transaction
    rec("claimPositions(3 positions after delay)", await gasOf(neu.st.connect(users[2]).claimPositions([2n, 3n, 4n], 105n, { gasLimit: 15_000_000 })));
    rec("withdrawPosition(normal)", await gasOf(neu.st.connect(users[2]).withdrawPosition(2n)));
    console.log(`      after a 100-epoch delay: closeEpoch ${mxc} each (101 transactions), allocateEpoch ${mxa} each`);
  });
});
