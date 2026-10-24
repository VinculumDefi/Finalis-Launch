// PROOF ONLY (operator t259u/t260u/t262u), in-process Hardhat chain, nothing broadcast.
// Rev 6 VF-TOK-007 and VF-REG-008: VCLM, CHONX and SYNTH are prohibited Commitment
// Vault Lock (CVL) inputs. TRS (stake) and the SYNTH Forge are separate mechanisms.
// The real Base ceremony flow (baseCeremonyFlow.js) runs as committed.
//   Path A: the 27 Base rows (the Base-only ceremony as built, t357u). The Base lock refuses the three
//           protocol tokens before any token moves (t262u).
//   Path B: rows 488-490 with their token addresses: the Verifier refuses the
//           index write (VF-REG-008), so that ceremony never finalizes.
// Settled t260u: SYNTH forging needs 100,000,000 lifetime CHONX (VF-TOK-003).
// TRS reward amounts are proven in test/trs_rewards_e2e.test.cjs.
const { expect } = require("chai");
const { ethers, network } = require("hardhat");
const art = require("../scripts/deploy-pages/ceremony.json");
const DATA = require("../scripts/deploy-pages/ceremony-data.json");
const { runBaseCeremony } = require("../scripts/deploy-pages/baseCeremonyFlow.js");

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
    const log = (s) => {
      h.logs.push(...String(s).split("\n"));
      for (const n of ["VCLM", "CHONX", "Forge"]) {
        const m = new RegExp("^" + n + " (0x[0-9a-fA-F]{40})$", "m").exec(s);
        if (m) h.addr[n] = ethers.getAddress(m[1]);
      }
    };
    h.r = await runBaseCeremony({ ethers, signer: h.signer, art, data: h.data, log });
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


const DAY30 = 30n * 86400n;
const EPOCH = 10n * 86400n;
const advance = async (secs) => { await network.provider.send("evm_increaseTime", [Number(secs)]); await network.provider.send("evm_mine"); };
const now = async () => BigInt((await ethers.provider.getBlock("latest")).timestamp);

// Brings a fresh ceremony to: CHONX active, lifetime CHONX >= 100M, recipient holds VCLM, CHONX and 1 SYNTH.
async function fundProtocolTokens(h, label) {
  const { r } = h;
  const e = await h.ethLock(1n * SCALE, DAY7);
  expect(await h.settle(e.lockId, e.rec, ETH_ID, 2)).to.be.gt(0n);
  await h.crossChonxActivation();
  const c = await h.ethLock(1n * SCALE, DAY7, 1);
  expect(await h.settle(c.lockId, c.rec, ETH_ID, 2, "0x01")).to.be.gt(0n);
  // Forge refused while CHONX is active but lifetime CHONX < 100,000,000
  const F = await r.forge.getAddress();
  await (await r.vclm.connect(h.recipient).approve(F, 10n ** 30n)).wait();
  await (await r.chonx.connect(h.recipient).approve(F, 10n ** 30n)).wait();
  expect(await r.verifier.chonxActivated()).to.equal(true);
  expect(await r.verifier.cumulativeChonxIssued()).to.be.lt(100_000_000n * SCALE);
  await expect(r.forge.connect(h.recipient).forge(1)).to.be.revertedWith("VF-TOK-003: SYNTH not activated");
  const under = await r.verifier.cumulativeChonxIssued();
  await h.crossSynthThreshold();
  const v0 = await r.vclm.totalSupply(), c0 = await r.chonx.totalSupply();
  await expect(r.forge.connect(h.recipient).forge(3)).to.emit(r.forge, "SynthForged").withArgs(h.recipient.address, 3n, 3000n * SCALE, 30_000n * SCALE);
  expect(v0 - (await r.vclm.totalSupply())).to.equal(3000n * SCALE);
  expect(c0 - (await r.chonx.totalSupply())).to.equal(30_000n * SCALE);
  expect(await r.forge.balanceOf(h.recipient.address)).to.equal(3n * SCALE);
  await (await r.vclm.connect(h.recipient).approve(F, 0)).wait();
  await (await r.chonx.connect(h.recipient).approve(F, 0)).wait();
  console.log(`      [${label}] forge refused at lifetime CHONX ${fmt(under)} (< 100M); after ${fmt(await r.verifier.cumulativeChonxIssued())}, forge(3) burned exactly 3,000 VCLM + 30,000 CHONX for 3 SYNTH`);
}

function protoTokens(h) {
  return [
    ["VCLM", h.r.vclm, VCLM_ID, FIXED.VCLM, 1000n * SCALE],
    ["CHONX", h.r.chonx, CHONX_ID, FIXED.CHONX, 10_000n * SCALE],
    ["SYNTH", h.r.forge, SYNTH_ID, FIXED.SYNTH, SCALE],
  ];
}

// t262u: the Base lock (BaseCommitmentVaultLock) refuses the protocol tokens
// as its first check, so no token moves, no fee is taken, no lock exists.
async function cvlRefused(h, sym, token, id, price, amount, label) {
  const { r } = h;
  const L = await r.lock.getAddress();
  await (await token.connect(h.recipient).approve(L, amount)).wait();
  const u0 = await token.balanceOf(h.recipient.address), l0 = await token.balanceOf(L), d0 = await token.balanceOf(DATA.devFund);
  const v0 = await r.vclm.totalSupply(), c0 = await r.chonx.totalSupply();
  const lockId = ethers.hexlify(ethers.randomBytes(32));
  await expect(r.lock.connect(h.recipient).createErc20Lock(lockId, h.recipient.address, 0, id, ethers.ZeroHash, h.dest.address, DAY7,
    await token.getAddress(), amount, usdOf(amount, price))).to.be.revertedWith("VF-TOK-007: protocol token is not a lock input");
  expect(await token.balanceOf(h.recipient.address)).to.equal(u0);
  expect(await token.balanceOf(L)).to.equal(l0);
  expect(await token.balanceOf(DATA.devFund)).to.equal(d0);
  expect((await r.lock.lockRecord(lockId)).exists).to.equal(false);
  expect(await r.vclm.totalSupply()).to.equal(v0);
  expect(await r.chonx.totalSupply()).to.equal(c0);
  await (await token.connect(h.recipient).approve(L, 0)).wait();
  console.log(`      [${label}] ${sym} lock refused by the Base lock (VF-TOK-007): no token moved, no fee, nothing minted`);
}

describe("t259u/t262u Path A (27 Base rows): protocol tokens refused by the Base lock; TRS stake of all three; Forge threshold (proof, test chain)", function () {
  this.timeout(900000);
  const h = harness("none");
  before(async () => { await h.setup(); });

  it("A0: 27 Base rows / 26 Base token addresses; no protocol-token row or index entry; finalized", async () => {
    expect(h.logs).to.include("registry 27/27");
    expect(h.logs).to.include("token addresses 26/26");
    for (const id of [VCLM_ID, CHONX_ID, SYNTH_ID]) expect((await h.r.verifier.assetPrecisionTable(key("Base", id))).canonicalAssetId).to.equal(ethers.ZeroHash);
    expect(await h.r.verifier.configurationFinalized()).to.equal(true);
  });

  it("A4 (VF-TOK-003, expected): ETH locks give VCLM and CHONX; Forge refused under 100M lifetime CHONX even with CHONX active; succeeds after with exact burns", async () => {
    await fundProtocolTokens(h, "A");
  });

  for (const sym of ["VCLM", "CHONX", "SYNTH"]) {
    it(`A1: ${sym} as a lock input is refused by the Base lock before any token moves or fee`, async () => {
      const [, token, id, price, amount] = protoTokens(h).find((t) => t[0] === sym);
      await cvlRefused(h, sym, token, id, price, amount, "A");
    });
  }

  it("A3 TRS (VF-STK-002/003): VCLM, CHONX and SYNTH are accepted at 1x/2x/4x; other tokens and durations refused; epoch 1 credits with no eligible weight mint nothing; unstake returns each", async () => {
    const { r, recipient } = h;
    const S = await r.stake.getAddress();
    await expect(r.stake.connect(recipient).createPosition(0, SCALE, 12345)).to.be.revertedWith("VF-STK-003: duration not permitted");
    await expect(r.stake.connect(recipient).createPosition(3, SCALE, DAY30)).to.be.revertedWith("VF-STK-002: invalid token");
    await expect(r.stake.connect(recipient).createPosition(0, 0, DAY30)).to.be.revertedWith("VF-STK-031: zero amount");
    const stakes = [[0, r.vclm, 1000n * SCALE, 1n], [1, r.chonx, 10_000n * SCALE, 2n], [2, r.forge, SCALE, 4n]];
    const ids = [], bal0 = [];
    for (const [t, token, amount, mult] of stakes) {
      bal0.push(await token.balanceOf(recipient.address));
      await (await token.connect(recipient).approve(S, amount)).wait();
      const id = await r.stake.nextPositionId();
      await (await r.stake.connect(recipient).createPosition(t, amount, DAY30)).wait();
      expect(await r.stake.getPositionWeight(id)).to.equal(amount * mult);
      ids.push(id);
    }
    await expect(r.stake.connect(recipient).withdrawPosition(ids[0])).to.be.revertedWith("VFS: not matured");
    expect(await r.verifier.epochRewardBasis(1n)).to.be.gt(0n);
    await advance(DAY30 + EPOCH);
    const last = (await r.stake.getCurrentEpoch()) - 1n;
    for (let n = 1n; n <= last; n++) await (await r.stake.closeEpoch(n)).wait();
    await (await r.stake.allocateEpoch(1n)).wait();
    const ep1 = await r.stake.epochs(1n);
    expect(ep1.totalWeight).to.equal(0n); // positions began after T0 (VF-STK-011)
    expect(ep1.mintedVclm).to.equal(0n);  // VF-STK-015
    for (let i = 0; i < stakes.length; i++) {
      await (await r.stake.connect(recipient).withdrawPosition(ids[i])).wait();
      expect(await stakes[i][1].balanceOf(recipient.address)).to.equal(bal0[i]);
    }
  });
});

describe("t262u Path B (rows 488-490 with token addresses): the ceremony is refused at the token index (VF-REG-008)", function () {
  this.timeout(900000);
  it("registerTokenAddressBatch refuses the protocol token addresses; no finalize", async () => {
    const h = harness("indexed");
    await expect(h.setup()).to.be.revertedWith("VF-REG-008: protocol token is not a lock input");
    expect(h.logs).to.not.include("Finalized.");
  });
});
