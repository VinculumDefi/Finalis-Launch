// t270u: the in-repo app's staking simulator (src/lib/vfStakingEngine.js)
// against the compiled VinculumFinalisStake on the in-process Hardhat chain.
// The same random operations run on both at the same timestamps: creates of
// all three tokens and four durations, queued and applied terms, normal and
// terminal-state withdrawals, epoch close and allocation (in order, late and
// refused early), zero and non-zero reward bases, the VCLM cap, and
// per-position claims over chosen ranges. Every operation must succeed on
// both or fail on both with the same revert text, and every epoch's mint,
// total weight and every claim amount must be identical. Also checks the
// simulator's multipliers (1x/2x/4x, 1.00x/1.40x/1.75x/2.10x).
// Nothing is broadcast.
const { expect } = require("chai");
const { ethers, network } = require("hardhat");
const path = require("path");
const { pathToFileURL } = require("url");

const E = 864000;
const DUR = [2592000, 5184000, 7776000, 10368000];
const SCALE = 10n ** 18n;
const CAP = 10_000_000_000n * SCALE;
const ENGINE = pathToFileURL(path.join(__dirname, "..", "..", "src", "lib", "vfStakingEngine.js")).href;

function rng(seed) {
  let x = BigInt(seed) || 1n;
  return (n) => { x = (x * 6364136223846793005n + 1442695040888963407n) & ((1n << 64n) - 1n); return Number((x >> 33n) % BigInt(n)); };
}
const reasonOf = (e) => {
  const m = /reverted with reason string '([^']*)'/.exec(String(e && e.message));
  return m ? m[1] : "OTHER: " + String(e && e.message).slice(0, 120);
};

describe("App staking simulator matches the Stake contract (t270u)", function () {
  this.timeout(600000);
  let M;
  before(async () => { M = await import(ENGINE); });

  it("multipliers: token 1x/2x/4x, durations 1.00x/1.40x/1.75x/2.10x, same as the contract", async () => {
    expect(M.TOKEN_MULTIPLIER_BPS).to.deep.equal({ VCLM: 10000, CHONX: 20000, SYNTH: 40000 });
    expect(DUR.map((d) => M.stakeMultiplierBps(d))).to.deep.equal([10000, 14000, 17500, 21000]);
    expect(M.stakeMultiplierBps(31536000)).to.equal(0);
    const [d] = await ethers.getSigners();
    const F = await ethers.getContractFactory("TestFixtureERC20");
    const v = await (await ethers.getContractFactory("StakeTestVerifier")).deploy();
    const a = await (await F.deploy(0)).getAddress();
    const st = await (await ethers.getContractFactory("VinculumFinalisStake")).deploy(a, a, a, await v.getAddress());
    for (const s of DUR) expect(await st.stakeMultiplierBps(s)).to.equal(BigInt(M.stakeMultiplierBps(s)));
    void d;
  });

  async function scenario(seed, nOps, opts = {}) {
    await network.provider.send("hardhat_reset");
    const S = await ethers.getSigners();
    const users = S.slice(1, 6);
    const r = rng(seed);
    const F = await ethers.getContractFactory("TestFixtureERC20");
    const v = await (await ethers.getContractFactory("StakeTestVerifier")).deploy();
    const toks = [await F.deploy(0), await F.deploy(0), await F.deploy(0)];
    const st = await (await ethers.getContractFactory("VinculumFinalisStake")).deploy(...(await Promise.all(toks.map((t) => t.getAddress()))), await v.getAddress());
    await (await v.setStake(await st.getAddress())).wait();
    for (const u of users) for (const tk of toks) {
      await (await tk.mint(u.address, 10n ** 30n)).wait();
      await (await tk.connect(u).approve(await st.getAddress(), ethers.MaxUint256)).wait();
    }
    let t = (await ethers.provider.getBlock("latest")).timestamp + 100;
    const t0 = t + 50;
    await (await v.setLaunch(t0)).wait();
    t = (await ethers.provider.getBlock("latest")).timestamp;
    let now = t;
    const sim = new M.StakingEngine({ launchTimestamp: t0, clock: () => now });

    // Runs one operation on both at the same block time; compares outcome.
    const stats = { ok: 0, fail: 0, claims: 0, paid: 0n, minted: 0n };
    async function op(dt, label, onChain, onSim) {
      now = now + Math.max(1, dt);
      await network.provider.send("evm_setNextBlockTimestamp", [now]);
      let cOk = true, cReason = "", rc = null;
      try { rc = await (await onChain()).wait(); } catch (e) { cOk = false; cReason = reasonOf(e); }
      const blk = await ethers.provider.getBlock("latest");
      if (blk.timestamp !== now) now = blk.timestamp; // not mined: keep clocks equal
      const s = onSim();
      expect(s.ok, `${label} seed ${seed}: contract ${cOk ? "ok" : cReason}, sim ${s.ok ? "ok" : s.reason}`).to.equal(cOk);
      if (!cOk) { expect(s.reason, label).to.equal(cReason); stats.fail++; } else stats.ok++;
      return { rc, s };
    }
    const claimedIn = (rc) => rc.logs.filter((l) => l.address === st.target).map((l) => { try { return st.interface.parseLog(l); } catch { return null; } })
      .filter((x) => x && x.name === "VclmClaimed").reduce((a, x) => a + x.args.amount, 0n);

    let nextClose = 1;
    for (let i = 0; i < nOps; i++) {
      const k = r(100);
      const u = users[r(users.length)];
      const ids = [...sim.positions.keys()];
      const pid = ids.length && r(10) ? ids[r(ids.length)] : r(ids.length + 3);
      if (k < 22) {
        const tk = r(12) === 0 ? 3 : r(3);
        const dur = r(15) === 0 ? 86400 : DUR[r(4)];
        const amt = r(20) === 0 ? 0n : BigInt(1 + r(1_000_000)) * 10n ** BigInt(12 + r(8));
        await op(r(3) * 3600, "create", () => st.connect(u).createPosition(tk, amt, dur, { gasLimit: 3_000_000 }), () => sim.createStakePosition(u.address, tk, amt, dur));
      } else if (k < 32) {
        const owner = sim.positions.get(pid)?.owner;
        const who = owner && r(6) ? users.find((x) => x.address === owner) : u;
        const dur = r(15) === 0 ? 1 : DUR[r(4)];
        await op(r(2) * 86400, "queueExtension", () => st.connect(who).queueExtension(pid, dur, { gasLimit: 3_000_000 }), () => sim.queueExtension(who.address, pid, dur));
      } else if (k < 37) {
        const owner = sim.positions.get(pid)?.owner;
        const who = owner ? users.find((x) => x.address === owner) : u;
        await op(1, "applyExtension", () => st.connect(who).applyExtensionIfMatured(pid, { gasLimit: 3_000_000 }), () => sim.applyExtensionIfMatured(who.address, pid));
      } else if (k < 44) {
        const owner = sim.positions.get(pid)?.owner;
        const who = owner && r(8) ? users.find((x) => x.address === owner) : u;
        await op(1, "withdraw", () => st.connect(who).withdrawPosition(pid, { gasLimit: 3_000_000 }), () => sim.withdrawPosition(who.address, pid));
      } else if (k < 56) {
        // time passes; record a reward basis for the current epoch on both
        now += r(5) * 86400 + r(86400);
        await network.provider.send("evm_setNextBlockTimestamp", [now]);
        const cur = Math.floor((now - t0) / E) + 1;
        const b = r(4) === 0 ? 0n : BigInt(1 + r(1000)) * SCALE;
        await (await v.setBasis(cur, b)).wait();
        sim.racCredits = sim.racCredits.filter((x) => x.epoch !== cur);
        sim.recordRacCredit("rac", "x", b, cur);
      } else if (k < 68) {
        const n = r(6) === 0 ? nextClose + 1 - r(3) : nextClose;
        const { s } = await op(r(2) * 86400, `close ${n}`, () => st.closeEpoch(n, { gasLimit: 3_000_000 }), () => sim.closeEpoch(n));
        if (s.ok) {
          nextClose = n + 1;
          expect(await st.epochTotalWeight(n), `weight ${n}`).to.equal(sim.epochTotalWeight(n));
        }
      } else if (k < 80) {
        const open = [...sim.epochs.values()].filter((e) => e.closed && !e.allocated).map((e) => e.epoch);
        const n = open.length && r(5) ? open[r(open.length)] : 1 + r(nextClose + 1);
        const { s } = await op(r(2) * 86400, `allocate ${n}`, () => st.allocateEpoch(n, { gasLimit: 3_000_000 }), () => sim.allocateEpoch(n));
        if (s.ok) {
          const ep = await st.epochs(n);
          expect(ep.mintedVclm, `minted ${n}`).to.equal(s.epoch.mintedVclm);
          expect(ep.totalWeight, `total ${n}`).to.equal(s.epoch.totalWeight);
          stats.minted += ep.mintedVclm;
        }
      } else if (k < 95) {
        const owner = sim.positions.get(pid)?.owner;
        const who = owner && r(8) ? users.find((x) => x.address === owner) : u;
        const cur = Math.floor((now - t0) / E) + 1;
        const to = Math.max(0, cur - 1 - r(4));
        if (sim.positions.has(pid)) expect(await st.claimableVclm(pid, to), "claimable").to.equal(sim.claimableVclm(pid, to));
        if (r(4) === 0) {
          const mine = ids.filter((id) => sim.positions.get(id).owner === who.address).slice(0, 4);
          const { rc, s } = await op(1, "claimPositions", () => st.connect(who).claimPositions(mine, to, { gasLimit: 6_000_000 }), () => sim.claimPositions(who.address, mine, to));
          if (rc) { expect(claimedIn(rc)).to.equal(s.amount); stats.claims++; stats.paid += s.amount; }
        } else {
          const { rc, s } = await op(1, "claimPosition", () => st.connect(who).claimPosition(pid, to, { gasLimit: 3_000_000 }), () => sim.claimPosition(who.address, pid, to));
          if (rc) { expect(claimedIn(rc)).to.equal(s.amount); stats.claims++; stats.paid += s.amount; }
        }
      } else if (opts.cap && i > nOps / 2 && k < 98) {
        // drive lifetime VCLM near or to the cap
        const lockIssued = r(4) ? CAP - BigInt(r(30000)) * SCALE : CAP;
        await (await v.setLockIssued(lockIssued)).wait();
        sim.cumulativeVclmIssued = lockIssued;
        now = (await ethers.provider.getBlock("latest")).timestamp;
      }
      expect(await st.terminalState(), "terminal").to.equal(sim.terminalState);
      expect(await st.getCurrentEpoch(), "epoch").to.equal(BigInt(sim.getCurrentEpoch()));
    }
    // Final sweep: every position's claimable up to the last final epoch matches.
    const cur = Math.floor((now - t0) / E) + 1;
    for (const id of sim.positions.keys()) for (const to of [cur - 2, cur - 1, cur]) {
      if (to < 0) continue;
      expect(await st.claimableVclm(id, to), `final claimable ${id}`).to.equal(sim.claimableVclm(id, to));
    }
    expect(await st.cumulativeRewardVclmMinted()).to.equal(sim.cumulativeRewardVclmMinted);
    console.log(`      seed ${seed}: ${stats.ok} ok, ${stats.fail} refused (same reason), ${sim.positions.size} positions, ${nextClose - 1} closed, ${stats.claims} claims, paid ${ethers.formatEther(stats.paid)} of minted ${ethers.formatEther(stats.minted)} VCLM, terminal ${sim.terminalState}`);
  }

  for (const seed of [1, 2, 3, 4, 5, 6]) {
    it(`random scenario seed ${seed}: identical outcomes`, async () => { await scenario(seed, 260); });
  }
  it("random scenario with the VCLM cap and terminal state: identical outcomes", async () => { await scenario(77, 360, { cap: true }); });
  it("second VCLM cap scenario: identical outcomes", async () => { await scenario(78, 360, { cap: true }); });
});
