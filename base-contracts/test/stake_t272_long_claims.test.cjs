// t272u item 3: long unclaimed history. Two positions kept staked for 2,100
// epochs (about 57.5 years) by extending every term: position 0 on 120-day
// terms, position 1 on 30-day terms (the costlier case, more terms per year).
// Nobody claims until the end. Shows:
//  - claim gas for 1, 36 (1 year) and 180 (about 5 years) epochs, gas per
//    epoch, and the most epochs one claim fits under Base's 16,777,216 cap;
//  - claiming all 2,100 epochs at once does not fit the cap (reverts, nothing
//    lost), while two claims (the per-position checkpoint) retrieve everything
//    to the exact wei;
//  - a wallet with 10 positions claiming them in one claimPositions call.
// Settlement is part of the claim (there is no separate settle step).
// Nothing is broadcast. No keys.
const { expect } = require("chai");
const { ethers, network } = require("hardhat");

const E = 864000n;
const D30 = 2592000n, D120 = 10368000n;
const SCALE = 10n ** 18n;
const TX_CAP = 16_777_216n;
const N = 2100n;

async function at(t) { const last = BigInt((await ethers.provider.getBlock("latest")).timestamp); if (t > last) await network.provider.send("evm_setNextBlockTimestamp", [Number(t)]); }
async function gasOf(p) { return (await (await p).wait()).gasUsed; }

describe("t272u long unclaimed history: bounded claims with per-position checkpoints", function () {
  this.timeout(7200000);
  it("2,100 epochs unclaimed: 1/36/180-epoch claim gas, max epochs per transaction, full recovery in two claims", async () => {
    await network.provider.send("hardhat_reset");
    const S = await ethers.getSigners();
    const users = S.slice(1, 4);
    const F = await ethers.getContractFactory("TestFixtureERC20");
    const v = await (await ethers.getContractFactory("StakeTestVerifier")).deploy();
    const vc = await F.deploy(0), ch = await F.deploy(0), sy = await F.deploy(0);
    const st = await (await ethers.getContractFactory("VinculumFinalisStake")).deploy(await vc.getAddress(), await ch.getAddress(), await sy.getAddress(), await v.getAddress());
    await (await v.setStake(await st.getAddress())).wait();
    const t0 = BigInt((await ethers.provider.getBlock("latest")).timestamp) + 1000n;
    await (await v.setLaunch(t0)).wait();
    for (const u of users) for (const tk of [vc, ch, sy]) { await (await tk.mint(u.address, 10n ** 30n)).wait(); await (await tk.connect(u).approve(await st.getAddress(), 2n ** 255n)).wait(); }
    const G = {};
    await at(t0 + 5n);
    G.createFirst = await gasOf(st.connect(users[0]).createPosition(0, 1000n * SCALE, D120)); // id 0
    await at(t0 + 6n);
    G.create = await gasOf(st.connect(users[1]).createPosition(2, 7n * SCALE, D30));          // id 1
    for (let i = 0; i < 10; i++) await (await st.connect(users[2]).createPosition(1, BigInt(1 + i) * SCALE, D120)).wait(); // ids 2..11, one wallet
    G.queueExtension = await gasOf(st.connect(users[0]).queueExtension(0n, D120));
    await (await st.connect(users[1]).queueExtension(1n, D30)).wait();
    for (let n = 1n; n <= N + 2n; n++) await (await v.setBasis(n, (100n + (n % 13n)) * SCALE)).wait();
    let closed = 0n;
    const ends = [(await st.positions(0n)).endTimestamp, (await st.positions(1n)).endTimestamp];
    let maxAlloc = 0n, maxClose = 0n, maxQueue = 0n, maxApply = 0n;
    while (closed < N + 1n) {
      const nextClose = t0 + (closed + 1n) * E;
      const nextEnd = ends[0] < ends[1] ? ends[0] : ends[1];
      if (nextEnd <= nextClose) {
        const k = ends[0] <= ends[1] ? 0 : 1;
        await at(nextEnd + 1n);
        const ga = await gasOf(st.connect(users[k]).applyExtensionIfMatured(BigInt(k)));
        if (ga > maxApply) maxApply = ga;
        // keep both staked through epoch N+1, then let the last term run out
        if (nextEnd < t0 + (N + 2n) * E) { const gq = await gasOf(st.connect(users[k]).queueExtension(BigInt(k), k === 0 ? D120 : D30)); if (gq > maxQueue) maxQueue = gq; }
        const p = await st.positions(BigInt(k));
        ends[k] = p.queuedExtensionBps > 0n ? p.endTimestamp : 2n ** 200n;
        continue;
      }
      await at(nextClose);
      closed++;
      const gc = await gasOf(st.closeEpoch(closed)); if (gc > maxClose) maxClose = gc;
      if (closed >= 2n) { const g = await gasOf(st.allocateEpoch(closed - 1n)); if (g > maxAlloc) maxAlloc = g; }
    }
    expect(await st.lastAllocatedEpoch()).to.equal(N);
    G.closeEpochMax = maxClose; G.allocateEpochMax = maxAlloc; G.queueExtensionMax = maxQueue; G.applyExtensionMax = maxApply;
    const terms = [await st.termCount(0n), await st.termCount(1n)];

    // exact entitlement per position (sum over epochs of floor(minted x weight / total))
    const eps = [];
    for (let n = 1n; n <= N; n++) eps[Number(n)] = await st.epochs(n);
    async function exactOf(id, from, to) { let e = 0n; for (let n = from; n <= to; n++) { const ep = eps[Number(n)]; const w = await st.epochWeight(id, n); if (ep.mintedVclm > 0n && w > 0n) e += (ep.mintedVclm * w) / ep.totalWeight; } return e; }

    const out = {};
    for (const [id, u, label] of [[0n, users[0], "120-day terms"], [1n, users[1], "30-day terms"]]) {
      const first = await st.nextClaimEpoch(id);
      const exact = await exactOf(id, first, N);
      expect(exact).to.be.gt(0n);
      // all 2,100 epochs in one transaction: over the cap, reverts, nothing changes
      await expect(st.connect(u).claimPosition(id, N, { gasLimit: TX_CAP })).to.be.reverted;
      expect(await st.nextClaimEpoch(id)).to.equal(first);
      expect(await st.claimableVclm(id, N)).to.equal(exact);
      const b0 = await vc.balanceOf(u.address);
      // 1, 36 and 180 epochs (measured from the start of the history)
      let from = first;
      const g = {};
      for (const k of [1n, 36n, 180n]) { g[k] = await gasOf(st.connect(u).claimPosition(id, from + k - 1n, { gasLimit: TX_CAP })); from += k; }
      const per = (g[180n] - g[36n]) / 144n;
      const fixed = g[1n] - per;
      const maxEpochs = (TX_CAP - fixed) / per;
      // the next claim takes as many epochs as fit (98% of the computed maximum, the margin a wallet would leave)
      let chunk = (maxEpochs * 98n) / 100n;
      if (chunk > N - from + 1n) chunk = N - from + 1n;
      const gChunk = await gasOf(st.connect(u).claimPosition(id, from + chunk - 1n, { gasLimit: TX_CAP }));
      expect(gChunk).to.be.lte(TX_CAP);
      from += chunk;
      const rest = N - from + 1n;
      const gRest = rest > 0n ? await gasOf(st.connect(u).claimPosition(id, N, { gasLimit: TX_CAP })) : 0n;
      expect(await st.nextClaimEpoch(id)).to.equal(N + 1n);
      expect((await vc.balanceOf(u.address)) - b0, label + ": everything recovered to the wei").to.equal(exact);
      // fresh-history case: how many transactions to recover 2,100 epochs with nothing claimed before
      const txFresh = (N - first + 1n + maxEpochs - 1n) / maxEpochs;
      out[label] = { terms: Number(terms[Number(id)]), claim1: Number(g[1n]), claim36: Number(g[36n]), claim180: Number(g[180n]), gasPerEpoch: Number(per), maxEpochsPerTx: Number(maxEpochs), chunkEpochs: Number(chunk), chunkGas: Number(gChunk), restEpochs: Number(rest), restGas: Number(gRest), txForAll2100FromScratch: Number(txFresh) };
      expect(maxEpochs).to.be.gt(180n);
    }
    // one wallet, 10 positions (120-day, never extended), claimed together
    const ids = Array.from({ length: 10 }, (_, i) => BigInt(2 + i));
    let ex10 = 0n;
    for (const id of ids) ex10 += await exactOf(id, await st.nextClaimEpoch(id), 15n); // 120-day terms end inside epoch 13
    const c0 = await vc.balanceOf(users[2].address);
    const g10 = await gasOf(st.connect(users[2]).claimPositions(ids, N, { gasLimit: TX_CAP }));
    expect((await vc.balanceOf(users[2].address)) - c0).to.equal(ex10);
    // withdrawal at maturity after the last term ends
    await at(t0 + (N + 40n) * E); // after the last queued term ends
    G.withdrawAtMaturity = await gasOf(st.connect(users[0]).withdrawPosition(0n));
    G.withdrawAtMaturity30 = await gasOf(st.connect(users[1]).withdrawPosition(1n));
    G.claimPositions10positions = g10;
    console.log("LONG_CLAIMS " + JSON.stringify(out));
    console.log("LONG_GAS " + JSON.stringify(Object.fromEntries(Object.entries(G).map(([k, x]) => [k, Number(x)]))));
    for (const [k, o] of Object.entries(out)) console.log(`      ${k} (${o.terms} terms): claim 1 epoch ${o.claim1}, 36 epochs ${o.claim36}, 180 epochs ${o.claim180}; about ${o.gasPerEpoch} gas per epoch; at most ${o.maxEpochsPerTx} epochs per transaction; 2,100 unclaimed epochs need ${o.txForAll2100FromScratch} claims`);
    console.log(`      one wallet, 10 positions (10 paid epochs each) in one claimPositions: ${g10} gas`);
  });
});
