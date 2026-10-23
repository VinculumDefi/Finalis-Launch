// t262u/t263u: Treasury Reward Stake rewards end to end on the real, unchanged
// Base ceremony flow (baseCeremonyFlow.js + ceremony.json), in-process Hardhat
// chain only. Nothing broadcast.
//   - Base lock refuses VCLM, CHONX, SYNTH before any token moves (VF-TOK-007).
//   - External locks record RAC in an epoch (VF-RAC-002/003/004); the epoch
//     closes (VF-STK-008/010) and allocates after N+1 (VF-STK-013); stakers of
//     VCLM, CHONX and SYNTH claim exactly floor(reward x weight / total)
//     (VF-RAC-005, VF-STK-014/026); a zero-RAC epoch and a zero-weight epoch
//     pay zero (VF-STK-015); double claim refused (VF-STK-018).
//   - Reward VCLM counts in lifetime VCLM for the cap (VF-SUP-002) and toward
//     the 10,000,000 CHONX activation (VF-TOK-002, operator t264u).
const { expect } = require("chai");
const { ethers, network } = require("hardhat");
const art = require("../scripts/deploy-pages/ceremony.json");
const DATA = require("../scripts/deploy-pages/ceremony-data.json");
const { runBaseCeremony, EVM_ENVS } = require("../scripts/deploy-pages/baseCeremonyFlow.js");

const SCALE = 10n ** 18n;
const DAY7 = 604800n;
const YEAR10 = 315360000n;
const ETH_ID = DATA.row2.canonicalAssetId;
const ETH_PRICE = BigInt(DATA.priceUsd18);
const idOf = (sym) => ethers.solidityPackedKeccak256(["string", "string"], ["Base", sym]);
const VCLM_ID = idOf("VCLM");
const CHONX_ID = idOf("CHONX");
const SYNTH_ID = idOf("SYNTH");
const FIXED = { VCLM: SCALE / 10n, CHONX: SCALE / 100n, SYNTH: 200n * SCALE }; // operator-fixed (t258u)
const ROW = (sym, id) => ({ environmentId: "Base", canonicalAssetId: id, symbol: sym, decimals: 18, custodyClass: 3, custodyPath: 1 });
const coder = ethers.AbiCoder.defaultAbiCoder();
const key = (env, id) => ethers.solidityPackedKeccak256(["string", "bytes32"], [env, id]);
const usdOf = (units, price) => (units * price) / SCALE;
const fmt = (x) => ethers.formatEther(x);

function harness(mode) {
  const withProtocolRows = mode !== "none";
  const h = { logs: [], addr: {} };
  h.data = {
    ...DATA,
    get entries() {
      if (!withProtocolRows || !h.addr.VCLM) return DATA.entries;
      return [...DATA.entries, ROW("VCLM", VCLM_ID), ROW("CHONX", CHONX_ID), ROW("SYNTH", SYNTH_ID)];
    },
    get tokenAddresses() {
      if (mode !== "indexed" || !h.addr.VCLM) return DATA.tokenAddresses;
      return [...DATA.tokenAddresses,
        { environmentId: "Base", token: h.addr.VCLM, canonicalAssetId: VCLM_ID },
        { environmentId: "Base", token: h.addr.CHONX, canonicalAssetId: CHONX_ID },
        { environmentId: "Base", token: h.addr.Forge, canonicalAssetId: SYNTH_ID }];
    },
  };
  h.setup = async () => {
    [h.signer, h.user, h.recipient, h.dest, h.other] = await ethers.getSigners();
    const L = new ethers.ContractFactory(art.CommitmentVaultLock.abi, art.CommitmentVaultLock.bytecode, h.signer);
    const newLocks = {};
    for (const env of EVM_ENVS) newLocks[env] = await (await L.deploy(env, DATA.evmDevFunds[env])).getAddress();
    const log = (s) => {
      h.logs.push(...String(s).split("\n"));
      for (const n of ["VCLM", "CHONX", "Forge"]) {
        const m = new RegExp("^" + n + " (0x[0-9a-fA-F]{40})$", "m").exec(s);
        if (m) h.addr[n] = ethers.getAddress(m[1]);
      }
    };
    h.r = await runBaseCeremony({ ethers, signer: h.signer, art, data: h.data, newLocks, log });
    await network.provider.send("hardhat_impersonateAccount", [DATA.scheduledPricePoster]);
    await network.provider.send("hardhat_setBalance", [DATA.scheduledPricePoster, "0x56BC75E2D63100000"]);
    h.poster = await ethers.getSigner(DATA.scheduledPricePoster);
    const sh = async (c) => { const a = await c.getAddress(); return a.slice(0, 6) + "..." + a.slice(-4); };
    console.log(`      [${mode}] addresses: VCLM ${await sh(h.r.vclm)} CHONX ${await sh(h.r.chonx)} Verifier ${await sh(h.r.verifier)} Forge/SYNTH ${await sh(h.r.forge)} Base lock ${await sh(h.r.lock)}`);
  };
  h.pkg = (lockId, rec, assetId, custodyClass, receipt = "0x") => ({
    sourceEnvironmentId: "Base", commitmentVaultLockId: lockId, handshakeAllowanceCount: 3,
    canonicalAssetId: assetId, assetPrecision: 18, assetCustodyClass: custodyClass,
    grossAmountSmallestUnits: rec.gross, actualFeeAmountSmallestUnits: rec.fee, principalAmountSmallestUnits: rec.principal,
    feeAssetId: assetId, devFundDestination: DATA.devFund, feeTransferEvidence: ethers.id("fee:" + lockId),
    valuationTimestamp: rec.createdAt, maturityTimestamp: rec.maturity, durationSecs: rec.duration,
    selectedOutputToken: rec.outputToken, baseRecipient: rec.baseRecipient, releaseDestination: h.dest.address,
    chonxActivationReceipt: receipt, racIdentity: ethers.id("rac:" + lockId), priceRecord: "0x", sourceFinalityProof: "0x",
    lockEventProof: coder.encode(["bytes32", "uint256", "uint256", "uint256", "uint256", "uint256", "uint256"],
      [lockId, rec.gross, rec.fee, rec.principal, rec.duration, rec.createdAt, rec.maturity]),
  });
  h.ethLock = async (wei, duration, output = 0) => {
    const lockId = ethers.hexlify(ethers.randomBytes(32));
    await (await h.r.lock.connect(h.user).createNativeLock(lockId, h.recipient.address, output, ETH_ID, ethers.ZeroHash, h.dest.address, duration,
      usdOf(wei, ETH_PRICE), { value: wei })).wait();
    return { lockId, rec: await h.r.lock.lockRecord(lockId) };
  };
  h.tokenLock = async (token, assetId, price, holder, amount, duration, output) => {
    const lockId = ethers.hexlify(ethers.randomBytes(32));
    await (await token.connect(holder).approve(await h.r.lock.getAddress(), amount)).wait();
    await (await h.r.lock.connect(holder).createErc20Lock(lockId, h.recipient.address, output, assetId, ethers.ZeroHash, h.dest.address, duration,
      await token.getAddress(), amount, usdOf(amount, price))).wait();
    return { lockId, rec: await h.r.lock.lockRecord(lockId) };
  };
  // record fee + mint; returns minted amount of the output token
  h.settle = async (lockId, rec, assetId, custodyClass, receipt) => {
    const out = rec.outputToken === 0n ? h.r.vclm : h.r.chonx;
    const before = await out.balanceOf(h.recipient.address);
    const p = h.pkg(lockId, rec, assetId, custodyClass, receipt);
    await (await h.r.verifier.recordFeeAndRac(p)).wait();
    await (await h.r.verifier.verifyAndMint(p, 0)).wait();
    return (await out.balanceOf(h.recipient.address)) - before;
  };
  h.crossChonxActivation = async () => {
    const { lockId, rec } = await h.ethLock(45n * SCALE, YEAR10);
    const p = h.pkg(lockId, rec, ETH_ID, 2);
    await (await h.r.verifier.recordFeeAndRac(p)).wait();
    await expect(h.r.verifier.verifyAndMint(p, 0)).to.emit(h.r.verifier, "ChonxActivated");
  };
  // ordinary ETH locks requesting CHONX until lifetime CHONX >= 100,000,000 (Forge VF-TOK-003)
  h.crossSynthThreshold = async () => {
    const T = await h.r.forge.SYNTH_ACTIVATION_THRESHOLD();
    for (let i = 0; i < 5 && (await h.r.verifier.cumulativeChonxIssued()) < T; i++) {
      const { lockId, rec } = await h.ethLock(45n * SCALE, YEAR10, 1);
      await h.settle(lockId, rec, ETH_ID, 2, "0x01");
    }
    expect(await h.r.verifier.cumulativeChonxIssued()).to.be.gte(T);
  };
  return h;
}



const DAY30 = 30n * 86400n, DAY60 = 60n * 86400n, DAY90 = 90n * 86400n, DAY120 = 120n * 86400n;
const EPOCH = 10n * 86400n;
const now = async () => BigInt((await ethers.provider.getBlock("latest")).timestamp);
const setTime = async (t) => { await network.provider.send("evm_setNextBlockTimestamp", [Number(t)]); await network.provider.send("evm_mine"); };
const W = (amount, tokBps, durBps) => (amount * tokBps * durBps) / 10n ** 8n;

async function stakeAs(h, who, tokenIdx, token, amount, dur) {
  const S = await h.r.stake.getAddress();
  await (await token.connect(who).approve(S, amount)).wait();
  const id = await h.r.stake.nextPositionId();
  await (await h.r.stake.connect(who).createPosition(tokenIdx, amount, dur)).wait();
  return id;
}
async function closeAndAllocate(h, upTo) {
  for (let n = 1n; n <= upTo; n++) if (!(await h.r.stake.epochs(n)).closed) await (await h.r.stake.closeEpoch(n)).wait();
}

describe("t262u TRS rewards on the real ceremony flow (487 rows, test chain)", function () {
  this.timeout(900000);
  const h = harness("none");
  let T0, s;
  const pos = {};
  before(async () => {
    await h.setup();
    s = await ethers.getSigners(); // 5..8 are stakers
    T0 = await h.r.verifier.protocolLaunchTimestamp();
  });

  it("ceremony order: tokens, Verifier, Forge, Stake before the Base lock; Base lock holds the three protocol token addresses; Stake T0 = Verifier launch", async () => {
    const order = h.logs.map((x) => x.split(" ")[0]);
    expect(order.indexOf("Forge")).to.be.lessThan(order.indexOf("Base"));
    expect(h.logs).to.include("registry 487/487");
    expect(h.logs).to.include("token addresses 475/475");
    expect(await h.r.lock.vclmToken()).to.equal(await h.r.vclm.getAddress());
    expect(await h.r.lock.chonxToken()).to.equal(await h.r.chonx.getAddress());
    expect(await h.r.lock.synthToken()).to.equal(await h.r.forge.getAddress());
    expect(T0).to.be.gt(0n);
    expect(await h.r.stake.launchTimestamp()).to.equal(T0);
    expect(await h.r.verifier.currentEpoch()).to.equal(1n);
    expect(await h.r.stake.getCurrentEpoch()).to.equal(1n);
  });

  it("epoch 1: ETH locks give VCLM, CHONX (after 10M) and SYNTH (after 100M lifetime CHONX); RAC goes to epoch 1", async () => {
    const e = await h.ethLock(1n * SCALE, DAY7);
    await h.settle(e.lockId, e.rec, ETH_ID, 2);
    await h.crossChonxActivation();
    await h.crossSynthThreshold();
    const F = await h.r.forge.getAddress();
    await (await h.r.vclm.connect(h.recipient).approve(F, 2000n * SCALE)).wait();
    await (await h.r.chonx.connect(h.recipient).approve(F, 20_000n * SCALE)).wait();
    await (await h.r.forge.connect(h.recipient).forge(2)).wait();
    expect(await h.r.verifier.epochRewardBasis(1n)).to.be.gt(0n);
    // AG-04: RAC is keyed by racKey(environment, proven lock id), not by racIdentity.
    expect(await h.r.verifier.racEpoch(await h.r.verifier.racKey("Base", e.lockId))).to.equal(1n);
  });

  it("Base lock refuses VCLM, CHONX and SYNTH as inputs before any token moves or fee (VF-TOK-007, BaseCommitmentVaultLock)", async () => {
    const L = await h.r.lock.getAddress();
    for (const [sym, token, id, amount] of [["VCLM", h.r.vclm, VCLM_ID, 1000n * SCALE], ["CHONX", h.r.chonx, CHONX_ID, 10_000n * SCALE], ["SYNTH", h.r.forge, SYNTH_ID, SCALE]]) {
      await (await token.connect(h.recipient).approve(L, amount)).wait();
      const u0 = await token.balanceOf(h.recipient.address), l0 = await token.balanceOf(L), d0 = await token.balanceOf(DATA.devFund);
      const lockId = ethers.hexlify(ethers.randomBytes(32));
      await expect(h.r.lock.connect(h.recipient).createErc20Lock(lockId, h.recipient.address, 0, id, ethers.ZeroHash, h.dest.address, DAY7,
        await token.getAddress(), amount, 10n ** 20n)).to.be.revertedWith("VF-TOK-007: protocol token is not a lock input");
      expect(await token.balanceOf(h.recipient.address)).to.equal(u0);
      expect(await token.balanceOf(L)).to.equal(l0);
      expect(await token.balanceOf(DATA.devFund)).to.equal(d0);
      expect((await h.r.lock.lockRecord(lockId)).exists).to.equal(false);
      expect(await token.allowance(h.recipient.address, L)).to.equal(amount); // untouched
      await (await token.connect(h.recipient).approve(L, 0)).wait();
      console.log(`      ${sym}: refused, no token moved, no fee, no lock record`);
    }
  });

  it("epoch 1: stakers stake VCLM 30d, VCLM 90d, CHONX 60d, SYNTH 120d (all start after T0, so none earns epoch 1)", async () => {
    const give = async (token, to, amt) => (await token.connect(h.recipient).transfer(to.address, amt)).wait();
    await give(h.r.vclm, s[5], 1000n * SCALE); await give(h.r.vclm, s[6], 3000n * SCALE);
    await give(h.r.chonx, s[7], 5000n * SCALE); await give(h.r.forge, s[8], 2n * SCALE);
    pos.a = { id: await stakeAs(h, s[5], 0, h.r.vclm, 1000n * SCALE, DAY30), who: s[5], w: W(1000n * SCALE, 10000n, 10000n) };
    pos.d = { id: await stakeAs(h, s[6], 0, h.r.vclm, 3000n * SCALE, DAY90), who: s[6], w: W(3000n * SCALE, 10000n, 17500n) };
    pos.b = { id: await stakeAs(h, s[7], 1, h.r.chonx, 5000n * SCALE, DAY60), who: s[7], w: W(5000n * SCALE, 20000n, 14000n) };
    pos.c = { id: await stakeAs(h, s[8], 2, h.r.forge, 2n * SCALE, DAY120), who: s[8], w: W(2n * SCALE, 40000n, 21000n) };
    for (const p of Object.values(pos)) {
      expect(await h.r.stake.epochWeight(p.id, 1n)).to.equal(0n);  // VF-STK-011
      expect(await h.r.stake.epochWeight(p.id, 2n)).to.equal(p.w);  // active at start of 2, through end of 3
    }
    await expect(h.r.stake.closeEpoch(1n)).to.be.revertedWith("VF-STK-008: epoch not ended");
  });

  let basis2;
  it("epoch 2: external ETH locks record RAC in epoch 2 only; epoch 3 records none", async () => {
    await setTime(T0 + EPOCH + 60n);
    expect(await h.r.verifier.currentEpoch()).to.equal(2n);
    const b1 = await h.r.verifier.epochRewardBasis(1n);
    let sum = 0n;
    for (const wei of [1n * SCALE, 3n * SCALE]) {
      const e = await h.ethLock(wei, DAY7);
      await h.settle(e.lockId, e.rec, ETH_ID, 2);
      const rid = await h.r.verifier.racKey("Base", e.lockId);
      expect(await h.r.verifier.racEpoch(rid)).to.equal(2n);
      sum += await h.r.verifier.racCredits(rid);
    }
    basis2 = await h.r.verifier.epochRewardBasis(2n);
    expect(basis2).to.equal(sum);
    expect(await h.r.verifier.epochRewardBasis(1n)).to.equal(b1);
    await setTime(T0 + 2n * EPOCH + 60n);
    expect(await h.r.verifier.currentEpoch()).to.equal(3n);
  });

  it("allocation waits for N+1 end (VF-STK-013); epochs close in order (VF-STK-010)", async () => {
    await closeAndAllocate(h, 2n);
    await expect(h.r.stake.allocateEpoch(2n)).to.be.revertedWith("VF-STK-013: wait for N+1 end");
    await expect(h.r.stake.closeEpoch(4n)).to.be.revertedWith("VF-STK-008: epoch not ended");
  });

  it("epoch 1 (credits but zero eligible weight) mints nothing (VF-STK-015)", async () => {
    const sup0 = await h.r.vclm.totalSupply();
    await (await h.r.stake.allocateEpoch(1n)).wait();
    const ep = await h.r.stake.epochs(1n);
    expect(ep.rewardBasis).to.be.gt(0n);
    expect(ep.totalWeight).to.equal(0n);
    expect(ep.mintedVclm).to.equal(0n);
    expect(await h.r.vclm.totalSupply()).to.equal(sup0);
  });

  it("epoch 2 pays floor(basis/$0.10 x weight / total weight) to each of the four positions; reward counted in lifetime VCLM", async () => {
    await setTime(T0 + 3n * EPOCH + 60n);
    const cum0 = await h.r.verifier.cumulativeVclmIssued();
    const life0 = await h.r.verifier.lifetimeVclmIssued();
    const sup0 = await h.r.vclm.totalSupply();
    await (await h.r.stake.allocateEpoch(2n)).wait();
    const total = (basis2 * 100n) / 10n;
    const ep = await h.r.stake.epochs(2n);
    const Wt = pos.a.w + pos.b.w + pos.c.w + pos.d.w;
    expect(ep.rewardBasis).to.equal(basis2);
    expect(ep.totalWeight).to.equal(Wt);
    expect(ep.mintedVclm).to.equal(total);
    expect((await h.r.vclm.totalSupply()) - sup0).to.equal(total);       // VF-STK-014: complete reward minted once
    expect(await h.r.stake.cumulativeRewardVclmMinted()).to.equal(total);
    expect(await h.r.verifier.cumulativeVclmIssued()).to.equal(cum0);     // lock-issuance counter only
    expect(await h.r.verifier.lifetimeVclmIssued()).to.equal(life0 + total); // counted in lifetime VCLM: cap and CHONX activation (VF-SUP-002, VF-TOK-002, t264u)
    let paid = 0n;
    for (const [k, p] of Object.entries(pos)) {
      const exp = (total * p.w) / Wt;
      expect(await h.r.stake.claimableVclm(p.id, 2n)).to.equal(exp);
      const b0 = await h.r.vclm.balanceOf(p.who.address);
      await (await h.r.stake.connect(p.who).claimPosition(p.id, 2n)).wait();
      expect((await h.r.vclm.balanceOf(p.who.address)) - b0).to.equal(exp);
      expect(await h.r.stake.claimableVclm(p.id, 2n)).to.equal(0n);
      await expect(h.r.stake.connect(p.who).claimPosition(p.id, 2n)).to.be.revertedWith("VFS: nothing to claim");
      await expect(h.r.stake.connect(h.other).claimPosition(p.id, 2n)).to.be.revertedWith("VFS: not owner");
      paid += exp;
      console.log(`      position ${k}: weight ${fmt(p.w)} claimed ${fmt(exp)} VCLM`);
    }
    console.log(`      epoch 2 basis $${fmt(basis2)} -> ${fmt(total)} VCLM; paid ${fmt(paid)}; remainder ${ethers.formatUnits(total - paid, 0)} wei stays in Stake (VF-STK-027)`);
    expect(total - paid).to.be.lt(4n);
  });

  it("epoch 3 (zero RAC) pays zero; supply unchanged", async () => {
    await setTime(T0 + 4n * EPOCH + 60n);
    await closeAndAllocate(h, 3n);
    const sup0 = await h.r.vclm.totalSupply();
    await (await h.r.stake.allocateEpoch(3n)).wait();
    const ep = await h.r.stake.epochs(3n);
    expect(ep.rewardBasis).to.equal(0n);
    expect(ep.mintedVclm).to.equal(0n);
    expect(await h.r.vclm.totalSupply()).to.equal(sup0);
    for (const p of Object.values(pos)) expect(await h.r.stake.claimableVclm(p.id, 3n)).to.equal(0n);
  });

  it("unstake returns each token after its term; early withdraw refused", async () => {
    await expect(h.r.stake.connect(pos.c.who).withdrawPosition(pos.c.id)).to.be.revertedWith("VFS: not matured");
    await setTime(T0 + 130n * 86400n);
    for (const [p, token, amt] of [[pos.a, h.r.vclm, 1000n * SCALE], [pos.d, h.r.vclm, 3000n * SCALE], [pos.b, h.r.chonx, 5000n * SCALE], [pos.c, h.r.forge, 2n * SCALE]]) {
      const b0 = await token.balanceOf(p.who.address);
      await (await h.r.stake.connect(p.who).withdrawPosition(p.id)).wait();
      expect((await token.balanceOf(p.who.address)) - b0).to.equal(amt);
    }
  });
});

// Leaves lock VCLM about 1,000 short of 10M, stakes 1,000 VCLM in epoch 1,
// records RAC in epoch 2 and allocates it. Returns lock VCLM, the reward and a
// CHONX lock package that was refused before the reward.
async function crossWithReward(h, staker, T0) {
  const TH = await h.r.verifier.CHONX_ACTIVATION_THRESHOLD();
  const e = await h.ethLock(1n * SCALE, DAY7);
  await h.settle(e.lockId, e.rec, ETH_ID, 2);
  await (await h.r.vclm.connect(h.recipient).transfer(staker.address, 1000n * SCALE)).wait();
  await stakeAs(h, staker, 0, h.r.vclm, 1000n * SCALE, DAY30);
  await setTime(T0 + EPOCH + 60n); // epoch 2
  const big = await h.ethLock(35n * SCALE, YEAR10);
  await h.settle(big.lockId, big.rec, ETH_ID, 2);
  const probe = await h.ethLock(SCALE / 10n, DAY7);
  const perProbe = await h.settle(probe.lockId, probe.rec, ETH_ID, 2);
  const short = TH - (await h.r.verifier.lifetimeVclmIssued());
  const wei = ((short - 1000n * SCALE) * (SCALE / 10n)) / perProbe;
  const fill = await h.ethLock(wei, DAY7);
  await h.settle(fill.lockId, fill.rec, ETH_ID, 2);
  const cum = await h.r.verifier.cumulativeVclmIssued();
  expect(await h.r.verifier.lifetimeVclmIssued()).to.equal(cum); // no reward yet
  expect(cum).to.be.lt(TH);
  expect(TH - cum).to.be.lt(1001n * SCALE);
  expect(await h.r.verifier.chonxActivated()).to.equal(false);
  const c0 = await h.ethLock(1n * SCALE, DAY7, 1);
  const p0 = h.pkg(c0.lockId, c0.rec, ETH_ID, 2, "0x01");
  await (await h.r.verifier.recordFeeAndRac(p0)).wait();
  await expect(h.r.verifier.verifyAndMint(p0, 0)).to.be.revertedWith("VF-COM-025: CHONX not activated");
  await setTime(T0 + 3n * EPOCH + 60n);
  await closeAndAllocate(h, 2n);
  await (await h.r.stake.allocateEpoch(1n)).wait();
  await (await h.r.stake.allocateEpoch(2n)).wait();
  const reward = (await h.r.stake.epochs(2n)).mintedVclm;
  expect(reward).to.be.gt(TH - cum);
  expect(await h.r.verifier.cumulativeVclmIssued()).to.equal(cum);          // no lock VCLM added
  expect(await h.r.verifier.lifetimeVclmIssued()).to.equal(cum + reward);   // VF-TOK-002 / VF-SUP-002: reward counts
  expect(await h.r.verifier.lifetimeVclmIssued()).to.be.gte(TH);
  return { cum, reward, p0 };
}

describe("t264u reward VCLM counts toward the 10,000,000 CHONX threshold (real ceremony flow, test chain)", function () {
  this.timeout(900000);
  const h = harness("none");
  let T0, staker;
  before(async () => {
    await h.setup();
    staker = (await ethers.getSigners())[9];
    T0 = await h.r.verifier.protocolLaunchTimestamp();
  });

  it("lock VCLM about 1,000 short of 10M; the epoch reward crosses it; anyone records activation once; the earlier CHONX lock stays refused (VF-COM-025); a lock created after activation mints", async () => {
    const { cum, reward, p0 } = await crossWithReward(h, staker, T0);
    const b0 = await h.r.vclm.balanceOf(staker.address);
    await (await h.r.stake.connect(staker).claimPosition(0n, 2n)).wait();
    expect((await h.r.vclm.balanceOf(staker.address)) - b0).to.equal(reward); // single staker gets it all (floor of 100%)
    await expect(h.r.verifier.connect(staker).syncChonxActivation()).to.emit(h.r.verifier, "ChonxActivated");
    expect(await h.r.verifier.chonxActivated()).to.equal(true);
    const actTime = await h.r.verifier.chonxActivationTimestamp();
    expect(actTime).to.equal(BigInt((await ethers.provider.getBlock("latest")).timestamp));
    await expect(h.r.verifier.syncChonxActivation()).to.not.emit(h.r.verifier, "ChonxActivated");
    // t271u VF-COM-025: the lock created before activation is refused, now and later.
    await expect(h.r.verifier.verifyAndMint(p0, 0)).to.be.revertedWith("VF-COM-025: lock created before CHONX activation");
    await setTime(actTime + 30n * 86400n);
    await expect(h.r.verifier.verifyAndMint(p0, 0)).to.be.revertedWith("VF-COM-025: lock created before CHONX activation");
    // A CHONX lock created after the recorded activation mints (empty receipt: the receipt is not read).
    const c1 = await h.ethLock(1n * SCALE, DAY7, 1);
    expect(c1.rec.createdAt).to.be.gt(actTime);
    const ch0 = await h.r.chonx.balanceOf(h.recipient.address);
    expect(await h.settle(c1.lockId, c1.rec, ETH_ID, 2, "0x")).to.be.gt(0n);
    expect((await h.r.chonx.balanceOf(h.recipient.address)) - ch0).to.be.gt(0n);
    expect(await h.r.verifier.cumulativeVclmIssued()).to.equal(cum);
    console.log(`      lock VCLM ${fmt(cum)} (below 10M); reward ${fmt(reward)}; lifetime ${fmt(cum + reward)}; CHONX opened on the reward; the earlier lock stays refused`);
  });
});

describe("t271u CHONX activation not yet recorded after rewards crossed 10M (VF-COM-025)", function () {
  this.timeout(900000);
  const h = harness("none");
  let T0, staker;
  before(async () => {
    await h.setup();
    staker = (await ethers.getSigners())[9];
    T0 = await h.r.verifier.protocolLaunchTimestamp();
  });

  it("a CHONX lock created before activation is recorded is refused (its own mint call cannot activate and cure it); after syncChonxActivation a later lock mints", async () => {
    const { cum } = await crossWithReward(h, staker, T0);
    expect(await h.r.verifier.chonxActivated()).to.equal(false);
    // Created while lifetime VCLM is past 10M but activation is not recorded.
    const c = await h.ethLock(1n * SCALE, DAY7, 1);
    const pc = h.pkg(c.lockId, c.rec, ETH_ID, 2, "0x01");
    await (await h.r.verifier.recordFeeAndRac(pc)).wait();
    await expect(h.r.verifier.verifyAndMint(pc, 0)).to.be.revertedWith("VF-COM-025: lock created before CHONX activation");
    expect(await h.r.verifier.chonxActivated()).to.equal(false); // the reverted call recorded nothing
    await expect(h.r.verifier.syncChonxActivation()).to.emit(h.r.verifier, "ChonxActivated");
    await expect(h.r.verifier.verifyAndMint(pc, 0)).to.be.revertedWith("VF-COM-025: lock created before CHONX activation");
    const d = await h.ethLock(1n * SCALE, DAY7, 1);
    expect(await h.settle(d.lockId, d.rec, ETH_ID, 2, "0x")).to.be.gt(0n);
    expect(await h.r.verifier.cumulativeVclmIssued()).to.equal(cum);
  });
});

describe("t262u Verifier defence: protocol token addresses cannot enter the token index (VF-REG-008)", function () {
  it("registerTokenAddressBatch refuses VCLM, CHONX and SYNTH (SYNTH via the stake minter's synthToken)", async () => {
    const [d] = await ethers.getSigners();
    const art = require("../scripts/deploy-pages/ceremony.json");
    const dep = async (n, a) => { const c = await new ethers.ContractFactory(art[n].abi, art[n].bytecode, d).deploy(...a); await c.waitForDeployment(); return c; };
    const vclm = await dep("TokenVCLM", ["V", "VCLM", 10n ** 28n]);
    const chonx = await dep("TokenCHONX", ["C", "CHONX", 10n ** 29n]);
    const v = await dep("VinculumFinalisVerifier", [await vclm.getAddress(), await chonx.getAddress()]);
    const forge = await dep("VinculumFinalisSynth", [await v.getAddress(), await vclm.getAddress(), await chonx.getAddress()]);
    const stake = await dep("VinculumFinalisStake", [await vclm.getAddress(), await chonx.getAddress(), await forge.getAddress(), await v.getAddress()]);
    await (await vclm.initialize(await v.getAddress(), await stake.getAddress())).wait();
    const id = ethers.id("row");
    await (await v.registerAssetPrecisionBatch([{ environmentId: "Base", canonicalAssetId: id, symbol: "X", decimals: 18, custodyClass: 3, custodyPath: 1 }])).wait();
    for (const t of [vclm, chonx, forge]) {
      await expect(v.registerTokenAddressBatch([{ environmentId: "Base", token: await t.getAddress(), canonicalAssetId: id }])).to.be.revertedWith("VF-REG-008: protocol token is not a lock input");
    }
    await (await v.registerTokenAddressBatch([{ environmentId: "Base", token: ethers.Wallet.createRandom().address, canonicalAssetId: id }])).wait();
  });
});
