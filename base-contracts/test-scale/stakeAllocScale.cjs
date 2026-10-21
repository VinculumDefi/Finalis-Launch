// t272u: shared scenario for the allocateEpoch constant-cost evidence.
// Used by test/stake_t272_allocation_scale.test.cjs (10, 1,000 and 10,000
// historical positions, default suite) and by
// test-scale/stake_allocation_25000.test.cjs (adds 25,000; run on its own:
// npx hardhat test test-scale/stake_allocation_25000.test.cjs).
// Nothing is broadcast. No keys.
const { expect } = require("chai");
const { ethers, network } = require("hardhat");

const E = 864000n;
const DUR = [2592000n, 5184000n, 7776000n, 10368000n];
const SCALE = 10n ** 18n;
const WALLETS = 20;
const CREATE_EPOCHS = 10n; // positions are created across epochs 1..10
const MEASURE = [12n, 13n, 14n]; // epochs allocated after every position exists

async function at(t) { const last = BigInt((await ethers.provider.getBlock("latest")).timestamp); if (t > last) await network.provider.send("evm_setNextBlockTimestamp", [Number(t)]); }
async function mineAt(t) { await at(t); await network.provider.send("evm_mine"); }

async function batch(fns, per = 60) {
  await network.provider.send("evm_setAutomine", [false]);
  const txs = [];
  for (let i = 0; i < fns.length; i++) { txs.push(await fns[i]()); if (i % per === per - 1) await network.provider.send("evm_mine"); }
  await network.provider.send("evm_mine");
  await network.provider.send("evm_setAutomine", [true]);
  for (const tx of txs) { const rc = await ethers.provider.getTransactionReceipt(tx.hash); expect(rc.status).to.equal(1); }
}

// Returns { positions, gas: {epoch: gasUsed} } for allocateEpoch of every
// epoch 1..14 with P historical positions from 20 wallets created across
// epochs 1..10 (mixed tokens and durations, a tenth with a queued extension,
// those that matured by epoch 11 withdrawn).
async function runScale(P) {
  await network.provider.send("hardhat_reset");
  const S = await ethers.getSigners();
  const users = S.slice(0, WALLETS);
  const F = await ethers.getContractFactory("TestFixtureERC20");
  const v = await (await ethers.getContractFactory("StakeTestVerifier")).deploy();
  const toks = [await F.deploy(0), await F.deploy(0), await F.deploy(0)];
  const st = await (await ethers.getContractFactory("VinculumFinalisStake")).deploy(await toks[0].getAddress(), await toks[1].getAddress(), await toks[2].getAddress(), await v.getAddress());
  await (await v.setStake(await st.getAddress())).wait();
  const t0 = BigInt((await ethers.provider.getBlock("latest")).timestamp) + 1000n;
  await (await v.setLaunch(t0)).wait();
  for (const u of users) for (const tk of toks) { await (await tk.mint(u.address, 10n ** 32n)).wait(); await (await tk.connect(u).approve(await st.getAddress(), 2n ** 255n)).wait(); }
  for (let n = 1n; n <= 16n; n++) await (await v.setBasis(n, (1000n + n) * SCALE)).wait();
  // creation across epochs 1..10, in groups so block times move forward
  const groups = Math.min(50, P);
  const per = Math.ceil(P / groups);
  for (let g = 0; g < groups; g++) {
    const lo = g * per, hi = Math.min(P, lo + per);
    if (lo >= hi) break;
    await at(t0 + 7n + (BigInt(g) * CREATE_EPOCHS * E) / BigInt(groups));
    await batch(Array.from({ length: hi - lo }, (_, j) => { const i = lo + j; return () => st.connect(users[i % WALLETS]).createPosition(i % 3, SCALE * BigInt(1 + (i % 9)), DUR[(i * 7) % 4], { gasLimit: 1_000_000 }); }));
  }
  expect(await st.nextPositionId()).to.equal(BigInt(P));
  // a tenth queue an extension (only those still active)
  const now = t0 + CREATE_EPOCHS * E + 100n;
  await at(now);
  const ext = [];
  for (let i = 0; i < P; i += 10) { const p = await st.positions(i); if (p.endTimestamp > now + 50n) ext.push(i); }
  await batch(ext.map((i) => () => st.connect(users[i % WALLETS]).queueExtension(i, DUR[(i + 1) % 4], { gasLimit: 1_000_000 })));
  // close 1..11, allocate 1..10, then withdraw everything matured by then
  const gas = {};
  let closed = 0n;
  async function closeTo(n) { while (closed < n) { closed++; await (await st.closeEpoch(closed)).wait(); } }
  await mineAt(t0 + 11n * E + 10n);
  await closeTo(11n);
  for (let n = 1n; n <= 10n; n++) gas[n] = (await (await st.allocateEpoch(n)).wait()).gasUsed;
  const T = t0 + 11n * E + 500n;
  await at(T);
  const wd = [];
  for (let i = 1; i < P; i += 2) { const p = await st.positions(i); const end = p.endTimestamp + (p.queuedExtensionBps > 0n ? p.queuedExtensionSecs : 0n); if (end <= T - 10n) wd.push(i); }
  await batch(wd.map((i) => () => st.connect(users[i % WALLETS]).withdrawPosition(i, { gasLimit: 1_000_000 })));
  await mineAt(t0 + 15n * E + 10n);
  await closeTo(15n);
  for (let n = 11n; n <= 14n; n++) gas[n] = (await (await st.allocateEpoch(n)).wait()).gasUsed;
  let weighted = 0;
  for (const n of MEASURE) if ((await st.epochs(n)).totalWeight > 0n) weighted++;
  return { positions: P, withdrawn: wd.length, extended: ext.length, gas, weightedMeasured: weighted };
}

function report(results, band) {
  const rows = results.map((r) => {
    const m = MEASURE.map((n) => r.gas[n]);
    const all = Object.values(r.gas);
    return { positions: r.positions, extended: r.extended, withdrawn: r.withdrawn, e12: Number(r.gas[12n]), e13: Number(r.gas[13n]), e14: Number(r.gas[14n]), maxAny: Number(all.reduce((a, b) => (a > b ? a : b))), maxMeasured: Number(m.reduce((a, b) => (a > b ? a : b))) };
  });
  console.log("      allocateEpoch gas by historical position count (epochs 12, 13, 14 allocated after every position exists; maxAny = max over epochs 1..14):");
  for (const r of rows) console.log(`      ${String(r.positions).padStart(6)} positions (${r.extended} extended, ${r.withdrawn} withdrawn): epoch 12 ${r.e12}, epoch 13 ${r.e13}, epoch 14 ${r.e14}, max over 1..14 ${r.maxAny}`);
  console.log("ALLOC_SCALE " + JSON.stringify(rows));
  for (const k of ["e12", "e13", "e14", "maxAny"]) {
    const vals = rows.map((r) => r[k]);
    const spread = Math.max(...vals) - Math.min(...vals);
    expect(spread, `allocateEpoch ${k} spread across sizes`).to.be.lte(band);
  }
  for (const r of results) expect(r.weightedMeasured).to.equal(MEASURE.length);
  return rows;
}

module.exports = { runScale, report };
