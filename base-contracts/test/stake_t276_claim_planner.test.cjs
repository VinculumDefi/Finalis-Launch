// t276u: the app's claim planner (src/lib/vfClaimPlanner.js) against the real
// compiled VinculumFinalisStake on a local hardhat chain. Nothing is broadcast.
// No keys.
// Wallet W: one position kept staked for about 1,050 epochs on 30-day terms
// plus five others (expired, withdrawn, extended, recent, already claimed).
// - every planned transaction is confirmed by eth_estimateGas and uses at
//   most 8,000,000 gas;
// - stopping after transaction 1 (the user rejects the second prompt) pays
//   exactly batch 1; resuming later pays exactly the rest; the total equals the
//   single-shot entitlement read by claimableVclm to the wei (and the exact
//   floor rule for the long position);
// - claiming the same range again pays nothing (claimPosition reverts
//   "VFS: nothing to claim"; claimPositions skips); the planner finds nothing;
// - when estimates come back higher than the formula expects, the planner
//   halves the position set or the epoch range until the estimate fits.
const path = require("path");
const { pathToFileURL } = require("url");
const { expect } = require("chai");
const { ethers, network } = require("hardhat");

const E = 864000n;
const D30 = 2592000n, D60 = 5184000n, D90 = 7776000n, D120 = 10368000n;
const SCALE = 10n ** 18n;
const LIMIT = 8_000_000n;
const N = 1060n;

async function at(t) { const last = BigInt((await ethers.provider.getBlock("latest")).timestamp); if (t > last) await network.provider.send("evm_setNextBlockTimestamp", [Number(t)]); }

describe("t276u claim planner against the compiled Stake", function () {
  this.timeout(3600000);
  let P, st, vc, W, Q, t0, ids, L, entitled, entitledTotal, chain, longExact;
  const sent = [];

  before(async () => {
    P = await import(pathToFileURL(path.join(__dirname, "../../src/lib/vfClaimPlanner.js")).href);
    await network.provider.send("hardhat_reset");
    const S = await ethers.getSigners();
    W = S[1]; Q = S[2];
    const F = await ethers.getContractFactory("TestFixtureERC20");
    const v = await (await ethers.getContractFactory("StakeTestVerifier")).deploy();
    vc = await F.deploy(0); const ch = await F.deploy(0), sy = await F.deploy(0);
    st = await (await ethers.getContractFactory("VinculumFinalisStake")).deploy(await vc.getAddress(), await ch.getAddress(), await sy.getAddress(), await v.getAddress());
    await (await v.setStake(await st.getAddress())).wait();
    t0 = BigInt((await ethers.provider.getBlock("latest")).timestamp) + 1000n;
    await (await v.setLaunch(t0)).wait();
    for (const u of [W, Q]) for (const tk of [vc, ch, sy]) { await (await tk.mint(u.address, 10n ** 30n)).wait(); await (await tk.connect(u).approve(await st.getAddress(), 2n ** 255n)).wait(); }
    for (let n = 1n; n <= N + 2n; n++) await (await v.setBasis(n, (100n + (n % 17n)) * SCALE)).wait();
    await at(t0 + 5n);
    await (await st.connect(W).createPosition(0, 500n * SCALE, D30)).wait();   // 0: long history, 30-day terms
    await (await st.connect(W).createPosition(1, 40n * SCALE, D120)).wait();   // 1: expires around epoch 13
    await (await st.connect(W).createPosition(2, 3n * SCALE, D60)).wait();     // 2: withdrawn at maturity
    await (await st.connect(W).createPosition(0, 77n * SCALE, D90)).wait();    // 3: extended a few times
    await (await st.connect(W).createPosition(0, 9n * SCALE, D30)).wait();     // 4: claimed in full before the planner runs
    await (await st.connect(Q).createPosition(0, 300n * SCALE, D120)).wait();  // 5: another wallet
    await (await st.connect(W).queueExtension(0n, D30)).wait();
    await (await st.connect(W).queueExtension(3n, D90)).wait();
    await (await st.connect(Q).queueExtension(5n, D120)).wait();
    const keep = { 0: N + 2n, 3: 40n, 5: N + 2n }; // keep extending until this epoch
    const ends = {};
    for (const id of [0, 3, 5]) ends[id] = (await st.positions(id)).endTimestamp;
    const owner = { 0: W, 3: W, 5: Q };
    let closed = 0n, recentDone = false, p2done = false;
    while (closed < N + 1n) {
      const nextClose = t0 + (closed + 1n) * E;
      const [id, end] = Object.entries(ends).reduce((a, b) => (a[1] <= b[1] ? a : b));
      if (end <= nextClose) {
        await at(end + 1n);
        await (await st.connect(owner[id]).applyExtensionIfMatured(BigInt(id))).wait();
        if (end < t0 + keep[id] * E) await (await st.connect(owner[id]).queueExtension(BigInt(id), (await st.positions(id)).durationSecs)).wait();
        const p = await st.positions(id);
        ends[id] = p.queuedExtensionBps > 0n ? p.endTimestamp : 2n ** 200n;
        continue;
      }
      await at(nextClose);
      closed++;
      await (await st.closeEpoch(closed)).wait();
      if (closed >= 2n) await (await st.allocateEpoch(closed - 1n)).wait();
      if (!p2done && closed === 8n) { await (await st.connect(W).withdrawPosition(2n)).wait(); p2done = true; }
      if (closed === 20n) await (await st.connect(W).claimPosition(4n, 18n)).wait(); // position 4 fully claimed
      if (!recentDone && closed === N - 20n) { await (await st.connect(W).createPosition(2, 2n * SCALE, D30)).wait(); recentDone = true; } // 6: recent
    }
    ids = [0n, 1n, 2n, 3n, 4n, 6n];
    L = P.latestClaimableEpoch(await st.getCurrentEpoch(), await st.lastAllocatedEpoch());
    expect(L).to.equal(N);
    entitled = {}; entitledTotal = 0n;
    for (const id of ids) { entitled[id] = await st.claimableVclm(id, L); entitledTotal += entitled[id]; }
    expect(entitled[4n]).to.equal(0n);
    longExact = 0n;
    for (let n = 1n; n <= L; n++) { const e = await st.epochs(n); const w = await st.epochWeight(0n, n); if (e.mintedVclm > 0n && w > 0n) longExact += (e.mintedVclm * w) / e.totalWeight; }
    expect(entitled[0n]).to.equal(longExact);
    chain = P.makeEthersStakeChain(st.connect(W), W.address);
  });

  async function sendReal(info) {
    const c = st.connect(W);
    const gasLimit = (info.gas * 12n + 9n) / 10n;
    const b0 = await vc.balanceOf(W.address);
    const tx = info.tx.kind === "one" ? await c.claimPosition(info.tx.ids[0], info.tx.toEpoch, { gasLimit }) : await c.claimPositions(info.tx.ids, info.tx.toEpoch, { gasLimit });
    const rc = await tx.wait();
    const paid = (await vc.balanceOf(W.address)) - b0;
    expect(paid, "paid what the plan showed").to.equal(info.amount);
    expect(rc.gasUsed).to.be.lte(LIMIT);
    sent.push({ kind: info.tx.kind, ids: info.tx.ids.map(String), toEpoch: Number(info.tx.toEpoch), estimate: Number(info.gas), gasUsed: Number(rc.gasUsed), amount: paid });
    return rc;
  }

  it("estimates above the limit shrink the batch (position set halved, then epoch range halved) and are re-estimated", async () => {
    // planning only, nothing is sent. A wrapper inflates every estimate for more
    // than one position or more than one epoch, as if the formula were far off.
    const calls = [];
    const inflated = { ...chain, estimateClaim: async (tx) => {
      const g = await chain.estimateClaim(tx);
      const span = tx.toEpoch - (await st.nextClaimEpoch(tx.ids[0]));
      calls.push({ kind: tx.kind, n: tx.ids.length, to: Number(tx.toEpoch) });
      return tx.ids.length > 1 || span > 0n ? g + LIMIT : g;
    } };
    const next = await P.planNextClaim(inflated, ids);
    expect(next.tx.kind).to.equal("one");
    expect(next.tx.toEpoch).to.equal(await st.nextClaimEpoch(next.tx.ids[0]));
    expect(next.gas).to.be.lte(LIMIT);
    expect(calls.some((c) => c.n > 1)).to.equal(true);
    expect(calls.length).to.be.gte(3);
    expect(next.amount).to.equal(await st.claimableVclm(next.tx.ids[0], next.tx.toEpoch));
    console.log(`      inflated estimates: ${calls.length} estimates (${calls.map((c) => c.n + "x" + c.to).join(", ")}) before a fitting batch: position ${next.tx.ids[0]}, epoch ${next.tx.toEpoch}, ${next.gas} gas`);
  });

  it("preview, stop after transaction 1, resume later: exact total, every transaction at most 8,000,000 gas", async () => {
    const preview = await P.previewClaimAll(chain, ids);
    expect(preview.total).to.equal(entitledTotal);
    expect(preview.positions).to.equal(5); // position 4 has nothing to claim and is left out
    const progress = [];
    const b0 = await vc.balanceOf(W.address);
    let calls = 0;
    const r1 = await P.runClaimAll(chain, ids, {
      send: async (info) => { calls++; if (calls === 2) { const e = new Error("user rejected action"); e.code = "ACTION_REJECTED"; throw e; } return sendReal(info); },
      onProgress: (p) => progress.push({ stage: p.stage, index: p.index, total: p.total, remaining: p.remaining }),
    });
    expect(r1.status).to.equal("stopped");
    expect(r1.done.length).to.equal(1);
    const paid1 = (await vc.balanceOf(W.address)) - b0;
    expect(paid1).to.equal(r1.done[0].amount);
    expect(r1.remaining).to.equal(entitledTotal - paid1);
    expect(P.stoppedMessage(ethers.formatEther(r1.remaining))).to.match(/^The remaining [0-9.]+ VCLM stays available\. You can claim it any time\.$/);
    // later: one day passes, nothing new is allocated
    await at(BigInt((await ethers.provider.getBlock("latest")).timestamp) + 86400n);
    await network.provider.send("evm_mine");
    const r2 = await P.runClaimAll(chain, ids, { send: sendReal, onProgress: (p) => progress.push({ stage: p.stage, index: p.index, total: p.total, remaining: p.remaining }) });
    expect(r2.status).to.equal("complete");
    const paidAll = (await vc.balanceOf(W.address)) - b0;
    expect(paidAll, "total equals the single-shot entitlement to the wei").to.equal(entitledTotal);
    expect(paidAll - paid1).to.equal(r1.remaining);
    for (const id of ids) if (entitled[id] > 0n) expect(await st.nextClaimEpoch(id)).to.equal(L + 1n);
    const maxGas = sent.reduce((m, s) => Math.max(m, s.gasUsed), 0);
    console.log(`      preview: ${preview.txCount} transactions for ${ethers.formatEther(preview.total)} VCLM over ${preview.positions} positions`);
    for (const s of sent) console.log(`      ${s.kind === "one" ? "claimPosition" : "claimPositions"}([${s.ids}], ${s.toEpoch}): estimate ${s.estimate}, used ${s.gasUsed}, paid ${ethers.formatEther(s.amount)}`);
    console.log(`      stopped after 1, resumed: ${sent.length} transactions in all, max gas used ${maxGas}`);
    console.log("PLANNER_RUN " + JSON.stringify({ preview: preview.txCount, sent: sent.map((s) => ({ ...s, amount: String(s.amount) })), maxGas, progress: progress.map((p) => ({ ...p, remaining: p.remaining === undefined ? null : String(p.remaining) })) }));
    expect(maxGas).to.be.lte(Number(LIMIT));
    expect(sent.length).to.be.gte(3);
  });

  it("claiming the same range again pays nothing and never pays twice", async () => {
    const b0 = await vc.balanceOf(W.address);
    await expect(st.connect(W).claimPosition(0n, L)).to.be.revertedWith("VFS: nothing to claim");
    await (await st.connect(W).claimPositions(ids, L)).wait(); // skips every id: nextClaimEpoch > L
    expect(await vc.balanceOf(W.address)).to.equal(b0);
    expect(await P.planNextClaim(chain, ids)).to.equal(null);
    const r = await P.runClaimAll(chain, ids, { send: async () => { throw new Error("must not send"); } });
    expect(r.status).to.equal("complete");
    expect(r.done.length).to.equal(0);
  });

});
