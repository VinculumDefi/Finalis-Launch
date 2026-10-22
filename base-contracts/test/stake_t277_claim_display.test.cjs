// t277u: the claimable amount the app DISPLAYS (exactClaimable in
// src/lib/vfClaimPlanner.js), computed per epoch from epochs(n) and
// epochWeight(id, n), against the compiled Stake's claimableVclm view, to the
// wei. Nothing is broadcast. No keys.
// Positions: a position extended for about 1,060 epochs on alternating 30-day
// and 60-day terms (the multiplier changes at every term, extensions queued
// mid-epoch), and mixed positions (expired,
// withdrawn at maturity, extended a few times, recent, claimed early, withdrawn
// early in terminal state). Epochs with zero reward basis (every 23rd), a cap
// that stops minting at the end, and an unallocated tail.
// Checks: equality at many toEpochs, before and after partial claims; read
// groups of 1, 7, 499, 500 and 501 epochs give the same value (no overlap or
// double count at any boundary, including every term change); the largest
// single read call's gas; the number of reads for the long position.
const path = require("path");
const { pathToFileURL } = require("url");
const { expect } = require("chai");
const { ethers, network } = require("hardhat");

const E = 864000n;
const D30 = 2592000n, D60 = 5184000n, D90 = 7776000n, D120 = 10368000n;
const SCALE = 10n ** 18n;
const CAP = 10_000_000_000n * SCALE;
const N = 1060n;

async function at(t) { const last = BigInt((await ethers.provider.getBlock("latest")).timestamp); if (t > last) await network.provider.send("evm_setNextBlockTimestamp", [Number(t)]); }

describe("t277u displayed claimable amount equals the contract, per epoch, no overlap", function () {
  this.timeout(3600000);
  let P, st, v, W, Q, t0, L, chainW, chainQ;
  let counted = { epochs: 0, weights: 0, views: 0 };

  before(async () => {
    P = await import(pathToFileURL(path.join(__dirname, "../../src/lib/vfClaimPlanner.js")).href);
    await network.provider.send("hardhat_reset");
    const S = await ethers.getSigners();
    W = S[1]; Q = S[2];
    const F = await ethers.getContractFactory("TestFixtureERC20");
    v = await (await ethers.getContractFactory("StakeTestVerifier")).deploy();
    const vc = await F.deploy(0), ch = await F.deploy(0), sy = await F.deploy(0);
    st = await (await ethers.getContractFactory("VinculumFinalisStake")).deploy(await vc.getAddress(), await ch.getAddress(), await sy.getAddress(), await v.getAddress());
    await (await v.setStake(await st.getAddress())).wait();
    t0 = BigInt((await ethers.provider.getBlock("latest")).timestamp) + 1000n;
    await (await v.setLaunch(t0)).wait();
    for (const u of [W, Q]) for (const tk of [vc, ch, sy]) { await (await tk.mint(u.address, 10n ** 30n)).wait(); await (await tk.connect(u).approve(await st.getAddress(), 2n ** 255n)).wait(); }
    for (let n = 1n; n <= N + 12n; n++) await (await v.setBasis(n, n % 23n === 0n ? 0n : (100n + (n % 17n)) * SCALE)).wait();
    await at(t0 + 5n);
    await (await st.connect(W).createPosition(0, 500n * SCALE, D30)).wait();   // 0: long history, 30-day terms
    await (await st.connect(W).createPosition(1, 40n * SCALE, D120)).wait();   // 1: expires
    await (await st.connect(W).createPosition(2, 3n * SCALE, D60)).wait();     // 2: withdrawn at maturity
    await (await st.connect(W).createPosition(0, 77n * SCALE, D90)).wait();    // 3: extended a few times
    await (await st.connect(W).createPosition(0, 9n * SCALE, D30)).wait();     // 4: claimed early
    await (await st.connect(Q).createPosition(0, 300n * SCALE, D120)).wait();  // 5: other wallet, long, withdrawn early in terminal state
    await (await st.connect(W).queueExtension(0n, D30)).wait();
    await (await st.connect(W).queueExtension(3n, D90)).wait();
    await (await st.connect(Q).queueExtension(5n, D120)).wait();
    const keep = { 0: N + 20n, 3: 40n, 5: N + 20n };
    const ends = {};
    for (const id of [0, 3, 5]) ends[id] = (await st.positions(id)).endTimestamp;
    const owner = { 0: W, 3: W, 5: Q };
    let closed = 0n, recentDone = false;
    while (closed < N + 1n) {
      const nextClose = t0 + (closed + 1n) * E;
      const [id, end] = Object.entries(ends).reduce((a, b) => (a[1] <= b[1] ? a : b));
      if (end <= nextClose) {
        await at(end + 1n);
        await (await st.connect(owner[id]).applyExtensionIfMatured(BigInt(id))).wait();
        // queue the next term in the middle of an epoch, a few days after the term began
        if (end < t0 + keep[id] * E) { await at(end + 1n + 3n * 86400n + 7n); const d = (await st.positions(id)).durationSecs; const alt = { [D30]: D60, [D60]: D30, [D120]: D90, [D90]: D120 }; await (await st.connect(owner[id]).queueExtension(BigInt(id), id === "3" ? d : alt[d])).wait(); }
        const p = await st.positions(id);
        ends[id] = p.queuedExtensionBps > 0n ? p.endTimestamp : 2n ** 200n;
        continue;
      }
      await at(nextClose);
      closed++;
      await (await st.closeEpoch(closed)).wait();
      if (closed >= 2n) await (await st.allocateEpoch(closed - 1n)).wait();
      if (closed === 8n) await (await st.connect(W).withdrawPosition(2n)).wait();
      if (closed === 20n) await (await st.connect(W).claimPosition(4n, 18n)).wait();
      if (!recentDone && closed === N - 20n) { await (await st.connect(W).createPosition(2, 2n * SCALE, D30)).wait(); recentDone = true; } // 6
    }
    // cap: no more minting; terminal state; early withdrawal of position 5 (term still running)
    await (await v.setLockIssued(CAP)).wait();
    await (await st.connect(Q).withdrawPosition(5n)).wait();
    expect(await st.terminalState()).to.equal(true);
    for (let k = 0n; k < 3n; k++) { const n = closed + 1n; await at(t0 + n * E + 1n); await (await st.closeEpoch(n)).wait(); await (await st.allocateEpoch(n - 1n)).wait(); closed = n; }
    // unallocated tail: two more closed epochs nobody allocates
    for (let k = 0n; k < 2n; k++) { const n = closed + 1n; await at(t0 + n * E + 1n); await (await st.closeEpoch(n)).wait(); closed = n; }
    L = P.latestClaimableEpoch(await st.getCurrentEpoch(), await st.lastAllocatedEpoch());
    expect(L).to.equal(await st.lastAllocatedEpoch());
    expect(L).to.be.lt((await st.getCurrentEpoch()) - 2n);
    const count = (c) => ({ ...c, epochInfos: async (ns) => { counted.epochs += ns.length; return c.epochInfos(ns); }, epochWeights: async (id, ns) => { counted.weights += ns.length; return c.epochWeights(id, ns); }, claimableVclm: async (id, to) => { counted.views += 1; return c.claimableVclm(id, to); } });
    chainW = count(P.makeEthersStakeChain(st.connect(W), W.address));
    chainQ = count(P.makeEthersStakeChain(st.connect(Q), Q.address));
  });

  async function check(chain, id, toEpoch, groups = [500n]) {
    const view = await st.claimableVclm(id, toEpoch);
    for (const g of groups) {
      const r = await P.exactClaimable(chain, id, toEpoch, { group: g, crossCheck: false });
      expect(r.amount, `position ${id} to ${toEpoch} group ${g}`).to.equal(view);
    }
    return view;
  }

  it("every position, many toEpochs and read groups 1, 7, 499, 500, 501: equal to claimableVclm to the wei", async () => {
    let checks = 0;
    for (const [chain, id] of [[chainW, 0n], [chainW, 1n], [chainW, 2n], [chainW, 3n], [chainW, 4n], [chainW, 6n], [chainQ, 5n]]) {
      const from = await st.nextClaimEpoch(id);
      const tos = new Set([from, from + 1n, 22n, 23n, 24n, 46n, 498n, 499n, 500n, 501n, 502n, 999n, 1000n, 1001n, L - 4n, L - 3n, L]);
      for (let k = 0; k < 12; k++) tos.add(1n + BigInt(Math.floor(Math.random() * Number(L))));
      for (const to of [...tos].filter((x) => x >= from && x <= L).sort((a, b) => (a < b ? -1 : 1))) { await check(chain, id, to, [500n]); checks++; }
      await check(chain, id, L, [1n, 7n, 499n, 500n, 501n]); checks += 5;
    }
    // the view also skips the unallocated tail: L and current - 2 give the same amount
    const cur2 = (await st.getCurrentEpoch()) - 2n;
    expect(await st.claimableVclm(0n, cur2)).to.equal(await st.claimableVclm(0n, L));
    // the cap epochs at the end minted nothing
    expect((await st.epochs(L)).mintedVclm).to.equal(0n);
    console.log(`      ${checks} comparisons, all equal (L = ${L}, current epoch ${await st.getCurrentEpoch()})`);
  });

  it("after partial claims (inside a term and right at a term change), the rest is still exact", async () => {
    for (const to of [300n, 499n, 500n]) {
      await (await st.connect(W).claimPosition(0n, to)).wait();
      for (const t of [to + 1n, to + 2n, 501n, 502n, 777n, L]) if (t > to && t <= L) await check(chainW, 0n, t, [1n, 500n]);
    }
    // a term change: find the next epoch whose multiplier changes, claim to just before it
    const from = await st.nextClaimEpoch(0n);
    let tc = from;
    const w0 = await st.epochWeight(0n, from);
    while (tc < L && (await st.epochWeight(0n, tc)) === w0) tc++;
    await (await st.connect(W).claimPosition(0n, tc - 1n)).wait();
    await check(chainW, 0n, tc, [1n, 500n]);
    await check(chainW, 0n, L, [1n, 7n, 500n]);
    // the planner's total uses the per-epoch amount and cross-checks short ranges
    const st8 = await P.readClaimState(chainW, [0n, 1n, 2n, 3n, 4n, 6n]);
    let viewSum = 0n;
    for (const it of st8.items) viewSum += await st.claimableVclm(it.id, L);
    expect(st8.total).to.equal(viewSum);
    console.log(`      term change at epoch ${tc}; planner total ${ethers.formatEther(st8.total)} VCLM equals the views`);
  });

  it("read cost: largest single eth_call and the number of reads for the 1,060-epoch position", async () => {
    await network.provider.send("evm_mine");
    const t = await st.launchTimestamp();
    counted = { epochs: 0, weights: 0, views: 0 };
    // a fresh full read of position 5 (other wallet, never claimed, about 1,060 epochs)
    const r = await P.exactClaimable(chainQ, 5n, L, { crossCheck: true });
    const reads = { ...counted };
    expect(r.amount).to.equal(await st.claimableVclm(5n, L));
    let maxW = 0n, maxE = 0n;
    for (let n = 1n; n <= L; n++) {
      const gw = await ethers.provider.estimateGas({ to: st.target, data: st.interface.encodeFunctionData("epochWeight", [5n, n]) });
      const ge = await ethers.provider.estimateGas({ to: st.target, data: st.interface.encodeFunctionData("epochs", [n]) });
      if (gw > maxW) maxW = gw; if (ge > maxE) maxE = ge;
    }
    // position 0 (30-day terms, about 350 terms): epochWeight walks the term list from the last term back
    let maxW0 = 0n;
    for (let n = 1n; n <= L; n += 1n) { const g = await ethers.provider.estimateGas({ to: st.target, data: st.interface.encodeFunctionData("epochWeight", [0n, n]) }); if (g > maxW0) maxW0 = g; }
    const full = await ethers.provider.estimateGas({ to: st.target, data: st.interface.encodeFunctionData("claimableVclm", [5n, L]) });
    console.log("DISPLAY_READS " + JSON.stringify({ epochsAllocatedToL: Number(L), position5: { epochReads: reads.epochs, weightReads: reads.weights, crossCheckViews: reads.views, total: reads.epochs + reads.weights + reads.views, groupsOf500: Math.ceil(Number(L - r.from + 1n) / 500) }, maxGasEpochs: Number(maxE), maxGasEpochWeightPos5: Number(maxW), maxGasEpochWeightPos0: Number(maxW0), oneShotClaimableVclmPos5: Number(full), terms0: Number(await st.termCount(0n)) }));
    console.log(`      position 5, epochs ${r.from}..${r.last}: ${reads.epochs} epochs() reads + ${reads.weights} epochWeight() reads (zero-mint epochs skipped), ${reads.views} cross-check view (range above 200: none)`);
    console.log(`      largest single read: epochs() ${maxE} gas, epochWeight() ${maxW} (position 5), ${maxW0} (position 0, ${await st.termCount(0n)} terms); one-shot claimableVclm(5, L) would be ${full}`);
    expect(maxW0).to.be.lt(8_000_000n);
    expect(reads.views).to.equal(0);
    expect(t).to.be.gt(0n);
  });
});
