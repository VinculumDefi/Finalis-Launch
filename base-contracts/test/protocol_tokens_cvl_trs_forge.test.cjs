// PROOF ONLY (operator t259u), in-process Hardhat chain, nothing broadcast.
// Rev 6 VF-TOK-007 and VF-REG-008: VCLM, CHONX and SYNTH are prohibited Commitment
// Vault Lock (CVL) inputs. TRS (stake) and the SYNTH Forge are separate mechanisms.
// The real Base ceremony flow (baseCeremonyFlow.js) runs UNCHANGED.
//   Path A: 487 rows (tonight's build).
//   Path B: rows 488-490 (VCLM $0.10, CHONX $0.01, SYNTH $200 via run 2) AND their
//           token addresses indexed (478).
//   Path C: rows 488-490 written and priced, token addresses NOT indexed (475).
// t260u settled rules: CVL takes only external assets; TRS takes VCLM, CHONX and
// SYNTH; SYNTH forging needs 100,000,000 lifetime CHONX (VF-TOK-003), so the
// Forge's 100M check is EXPECTED. Findings are pinned as CURRENT CONTRACT
// BEHAVIOUR. No contract is changed.
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

// CVL attempt that must be refused; returns the lock for the release check.
async function cvlRefused(h, sym, token, id, price, amount, label) {
  const { r } = h;
  const dev0 = await token.balanceOf(DATA.devFund);
  const lockBal0 = await token.balanceOf(await r.lock.getAddress());
  const v0 = await r.vclm.totalSupply(), c0 = await r.chonx.totalSupply();
  const { lockId, rec } = await h.tokenLock(token, id, price, h.recipient, amount, DAY7, 0);
  // The Base lock accepts it: the 5% fee goes to the Dev Fund now, the principal is held.
  expect(rec.exists).to.equal(true);
  expect(rec.fee).to.equal(amount / 20n);
  expect((await token.balanceOf(DATA.devFund)) - dev0).to.equal(amount / 20n);
  expect((await token.balanceOf(await r.lock.getAddress())) - lockBal0).to.equal(amount - amount / 20n);
  // Verifier, package naming the protocol row id: refused at the asset check
  await expect(r.verifier.recordFeeAndRac(h.pkg(lockId, rec, id, 3))).to.be.revertedWith("VF-XCH-011: asset mismatch");
  // Verifier, package naming the reader's own token key: refused at the registry check
  const proven = await r.readers.Base.extractAssetId(h.pkg(lockId, rec, id, 3).lockEventProof);
  expect(proven).to.equal(await r.verifier.tokenAddressKey("Base", await token.getAddress()));
  expect(await r.verifier.tokenAssetIndex(proven)).to.equal(ethers.ZeroHash);
  await expect(r.verifier.recordFeeAndRac(h.pkg(lockId, rec, proven, 3))).to.be.revertedWith("VF-REG-001: asset not in registry");
  // Mint without a recorded fee: refused
  await expect(r.verifier.verifyAndMint(h.pkg(lockId, rec, id, 3), 0)).to.be.revertedWith("VF-FEE-011: call recordFeeAndRac() first");
  expect(await r.vclm.totalSupply()).to.equal(v0);
  expect(await r.chonx.totalSupply()).to.equal(c0);
  console.log(`      [${label}] ${sym} CVL lock: Base lock accepted, fee ${fmt(amount / 20n)} ${sym} to Dev Fund, verifier refused (VF-XCH-011 asset mismatch / VF-REG-001), nothing minted`);
  return { lockId, rec, token, amount, sym };
}

async function releaseAfterMaturity(h, locks, label) {
  for (const l of locks) await expect(h.r.lock.connect(h.dest).release(l.lockId)).to.be.revertedWith("CVL: immature");
  await advance(DAY7 + 1n);
  for (const l of locks) {
    const b0 = await l.token.balanceOf(h.dest.address);
    await (await h.r.lock.connect(h.dest).release(l.lockId)).wait();
    expect((await l.token.balanceOf(h.dest.address)) - b0).to.equal(l.amount - l.amount / 20n);
    console.log(`      [${label}] ${l.sym} principal ${fmt(l.amount - l.amount / 20n)} released to the release destination after maturity; the 5% fee is not returned`);
  }
}

describe("t259u Path A (487 rows): protocol tokens refused as CVL inputs; TRS stake; Forge threshold (proof, test chain)", function () {
  this.timeout(900000);
  const h = harness("none");
  const held = [];
  before(async () => { await h.setup(); });

  it("A0: 487 rows / 475 token addresses; no protocol-token row or index entry; finalized", async () => {
    expect(h.logs).to.include("registry 487/487");
    expect(h.logs).to.include("token addresses 475/475");
    for (const id of [VCLM_ID, CHONX_ID, SYNTH_ID]) expect((await h.r.verifier.assetPrecisionTable(key("Base", id))).canonicalAssetId).to.equal(ethers.ZeroHash);
    expect(await h.r.verifier.configurationFinalized()).to.equal(true);
  });

  it("A4 (VF-TOK-003, expected): ETH locks give VCLM and CHONX; Forge refused under 100M lifetime CHONX even with CHONX active; succeeds after with exact burns", async () => {
    await fundProtocolTokens(h, "A");
  });

  for (const sym of ["VCLM", "CHONX", "SYNTH"]) {
    it(`A1: ${sym} as a CVL input is accepted by the Base lock and refused by the Verifier; nothing minted`, async () => {
      const [, token, id, price, amount] = protoTokens(h).find((t) => t[0] === sym);
      held.push(await cvlRefused(h, sym, token, id, price, amount, "A"));
    });
  }

  it("A1 user safety: the principal of each refused lock is released after maturity; the fee stays with the Dev Fund", async () => {
    await releaseAfterMaturity(h, held, "A");
  });

  it("A3 TRS (VF-STK-002): stake VCLM, CHONX and SYNTH for 30 days; epochs close and allocate with reward basis 0; nothing to claim; unstake returns each", async () => {
    const { r, recipient } = h;
    const S = await r.stake.getAddress();
    // fee RAC exists on the Verifier side
    const e = await h.ethLock(1n * SCALE, DAY7);
    await h.settle(e.lockId, e.rec, ETH_ID, 2);
    const rac = await r.verifier.racCredits(ethers.id("rac:" + e.lockId));
    expect(rac).to.be.gt(0n);
    await expect(r.stake.connect(recipient).createPosition(0, SCALE, 12345)).to.be.revertedWith("VF-STK-003: duration not permitted");
    await expect(r.stake.connect(recipient).createPosition(3, SCALE, DAY30)).to.be.revertedWith("VF-STK-002: invalid token");
    await expect(r.stake.connect(recipient).createPosition(0, 0, DAY30)).to.be.revertedWith("VF-STK-031: zero amount");
    const stakes = [[0, "VCLM", r.vclm, 1000n * SCALE, 1n], [1, "CHONX", r.chonx, 10_000n * SCALE, 2n], [2, "SYNTH", r.forge, SCALE, 4n]];
    const ids = [], bal0 = [];
    for (const [t, , token, amount, mult] of stakes) {
      bal0.push(await token.balanceOf(recipient.address));
      await (await token.connect(recipient).approve(S, amount)).wait();
      const id = await r.stake.nextPositionId();
      await (await r.stake.connect(recipient).createPosition(t, amount, DAY30)).wait();
      expect(await r.stake.getPositionWeight(id)).to.equal(amount * mult); // token multiplier x 1.0x for 30 days
      expect(await token.balanceOf(S)).to.equal(amount);
      ids.push(id);
    }
    await expect(r.stake.connect(recipient).withdrawPosition(ids[0])).to.be.revertedWith("VFS: not matured");
    const startEpoch = await r.stake.getCurrentEpoch();
    await advance(DAY30 + EPOCH);
    const last = await r.stake.getCurrentEpoch() - 1n;
    let qualifying = 0n, weight = 0n;
    for (let n = 1n; n <= last; n++) {
      if (!(await r.stake.epochs(n)).closed) await (await r.stake.closeEpoch(n)).wait();
    }
    for (let n = 1n; n + 1n < last; n++) {
      const ep = await r.stake.epochs(n);
      if (!ep.allocated) await (await r.stake.allocateEpoch(n)).wait();
      const after = await r.stake.epochs(n);
      if (after.totalWeight > 0n) { qualifying++; weight = after.totalWeight; }
      expect(after.rewardBasis).to.equal(0n); // never written (Stake line 306)
      expect(after.mintedVclm).to.equal(0n);
    }
    expect(qualifying).to.be.gt(0n);
    expect(await r.stake.getClaimableVclm(recipient.address)).to.equal(0n);
    await expect(r.stake.connect(recipient).claimVclm()).to.be.revertedWith("VFS: no claimable");
    for (let i = 0; i < stakes.length; i++) {
      await (await r.stake.connect(recipient).withdrawPosition(ids[i])).wait();
      expect(await stakes[i][2].balanceOf(recipient.address)).to.equal(bal0[i]);
    }
    console.log(`      [A] TRS: staked 1,000 VCLM, 10,000 CHONX, 1 SYNTH in epoch ${startEpoch}; ${qualifying} epoch(s) with total weight ${fmt(weight)}; reward basis 0; VCLM rewarded 0 (RAC on Verifier for one lock: $${fmt(rac)}); unstake returned all three`);
  });
});

describe("t259u Path B (490 rows, 478 index entries): protocol tokens ACCEPTED as CVL inputs (proof, test chain)", function () {
  this.timeout(900000);
  const h = harness("indexed");
  before(async () => {
    await h.setup();
    await (await h.r.verifier.connect(h.poster).applyScheduledPriceRun(2n, [
      { environmentId: "Base", canonicalAssetId: VCLM_ID, priceUsd18: FIXED.VCLM, success: true },
      { environmentId: "Base", canonicalAssetId: CHONX_ID, priceUsd18: FIXED.CHONX, success: true },
      { environmentId: "Base", canonicalAssetId: SYNTH_ID, priceUsd18: FIXED.SYNTH, success: true },
    ])).wait();
    await fundProtocolTokens(h, "B");
  });

  it("B0: registry 490/490, token addresses 478/478, finalized", async () => {
    expect(h.logs).to.include("registry 490/490");
    expect(h.logs).to.include("token addresses 478/478");
    expect(await h.r.verifier.configurationFinalized()).to.equal(true);
  });

  for (const sym of ["VCLM", "CHONX", "SYNTH"]) {
    it(`B CURRENT BEHAVIOUR (conflicts with VF-TOK-007 / VF-REG-008): ${sym} as a CVL input is accepted and mints VCLM`, async () => {
      const [, token, id, price, amount] = protoTokens(h).find((t) => t[0] === sym);
      const { lockId, rec } = await h.tokenLock(token, id, price, h.recipient, amount, DAY7, 0);
      const minted = await h.settle(lockId, rec, id, 3);
      expect(minted).to.equal((usdOf(amount, price) * 10n * rec.multiplierBps) / 10000n);
      console.log(`      [B] ${sym} CVL lock of ${fmt(amount)} accepted; VCLM minted ${fmt(minted)}`);
    });
  }
});

describe("t259u Path C (490 rows priced, token addresses NOT indexed, 475): rows exist but are not CVL inputs (proof, test chain)", function () {
  this.timeout(900000);
  const h = harness("rowsOnly");
  const held = [];
  before(async () => {
    await h.setup();
    await (await h.r.verifier.connect(h.poster).applyScheduledPriceRun(2n, [
      { environmentId: "Base", canonicalAssetId: VCLM_ID, priceUsd18: FIXED.VCLM, success: true },
      { environmentId: "Base", canonicalAssetId: CHONX_ID, priceUsd18: FIXED.CHONX, success: true },
      { environmentId: "Base", canonicalAssetId: SYNTH_ID, priceUsd18: FIXED.SYNTH, success: true },
    ])).wait();
    await fundProtocolTokens(h, "C");
  });

  it("C0: registry 490/490, token addresses 475/475, rows priced at the fixed values, finalized", async () => {
    expect(h.logs).to.include("registry 490/490");
    expect(h.logs).to.include("token addresses 475/475");
    for (const [id, p] of [[VCLM_ID, FIXED.VCLM], [CHONX_ID, FIXED.CHONX], [SYNTH_ID, FIXED.SYNTH]]) {
      expect((await h.r.verifier.assetPrecisionTable(key("Base", id))).canonicalAssetId).to.equal(id);
      expect((await h.r.verifier.scheduledPrices(key("Base", id))).priceUsd18).to.equal(p);
    }
    expect(await h.r.verifier.configurationFinalized()).to.equal(true);
  });

  for (const sym of ["VCLM", "CHONX", "SYNTH"]) {
    it(`C1: ${sym} as a CVL input is refused by the Verifier even with its row and price present; nothing minted`, async () => {
      const [, token, id, price, amount] = protoTokens(h).find((t) => t[0] === sym);
      held.push(await cvlRefused(h, sym, token, id, price, amount, "C"));
    });
  }

  it("C2: a native ETH lock cannot claim a protocol row (the Base reader reports native ETH for every native lock)", async () => {
    const lockId = ethers.hexlify(ethers.randomBytes(32));
    await (await h.r.lock.connect(h.user).createNativeLock(lockId, h.recipient.address, 0, VCLM_ID, ethers.ZeroHash, h.dest.address, DAY7,
      usdOf(SCALE, ETH_PRICE), { value: SCALE })).wait();
    const rec = await h.r.lock.lockRecord(lockId);
    await expect(h.r.verifier.recordFeeAndRac(h.pkg(lockId, rec, VCLM_ID, 3))).to.be.revertedWith("VF-XCH-011: asset mismatch");
  });

  it("C3: principal of each refused lock is released after maturity", async () => {
    await releaseAfterMaturity(h, held, "C");
  });
});
