// PROOF ONLY (operator t253u/t254u), in-process Hardhat chain, nothing broadcast.
// Question: can VCLM be registry row 488 (a Base ERC-20 whose address exists only
// after the ceremony deploys VCLM), so that after CHONX activation a user can
// lock VCLM and mint CHONX?
//
// The real Base ceremony flow (scripts/deploy-pages/baseCeremonyFlow.js, the code
// base.html runs) is driven UNCHANGED with the real ceremony.json and
// ceremony-data.json. Row 488 and its token address are appended through the
// flow's own inputs: the flow logs the new VCLM address before it writes the
// registry (step 5), so the test feeds the extra row in at that point. The live
// page would need an explicit change to do the same.
//
// Pricing: no spec rule prices VCLM. Rev 6 VF-TOK-007 prohibits VCLM, CHONX and
// SYNTH as lock inputs, and the Revision B rule (one pool >= $10,000 that traded
// in 24h) cannot be met by VCLM at launch. The VCLM price below is a TEST VALUE
// posted by the poster in run 2, only to exercise the contracts.
//
// Two cases are pinned as CURRENT CONTRACT BEHAVIOUR (spec gaps, reported):
//   - the Verifier does not refuse a protocol token as input (VF-TOK-007), so
//     VCLM in -> VCLM out is accepted;
//   - a VCLM->CHONX lock created BEFORE activation mints CHONX once activation
//     happens later (VF-COM-025 says later activation cannot cure it); the
//     Verifier only checks chonxActivated and a non-empty receipt.
const { expect } = require("chai");
const { ethers, network } = require("hardhat");
const art = require("../scripts/deploy-pages/ceremony.json");
const DATA = require("../scripts/deploy-pages/ceremony-data.json");
const { runBaseCeremony, EVM_ENVS } = require("../scripts/deploy-pages/baseCeremonyFlow.js");

const SCALE = 10n ** 18n;
const DAY7 = 604800n;
const YEAR10 = 315360000n;
const ETH_ID = DATA.row2.canonicalAssetId;
const VCLM_ID = ethers.solidityPackedKeccak256(["string", "string"], ["Base", "VCLM"]);
const VCLM_ROW_488 = { environmentId: "Base", canonicalAssetId: VCLM_ID, symbol: "VCLM", decimals: 18, custodyClass: 3, custodyPath: 1 };
const TEST_VCLM_PRICE_USD18 = SCALE / 10n; // TEST VALUE ($0.10). No spec rule prices VCLM.
const ETH_PRICE = BigInt(DATA.priceUsd18); // run 1, from ceremony-data.json
const coder = ethers.AbiCoder.defaultAbiCoder();
const key = (env, id) => ethers.solidityPackedKeccak256(["string", "bytes32"], [env, id]);

describe("VCLM as registry row 488: lock VCLM, mint CHONX after activation (proof, test chain)", function () {
  this.timeout(600000);
  let r, signer, user, recipient, dest, poster, vclmFromLog;
  const logs = [];
  let preActivation; // a VCLM->CHONX lock made before activation

  // ceremony-data.json with row 488 and its token address added once VCLM exists.
  const data = {
    ...DATA,
    get entries() { return vclmFromLog ? [...DATA.entries, VCLM_ROW_488] : DATA.entries; },
    get tokenAddresses() {
      return vclmFromLog ? [...DATA.tokenAddresses, { environmentId: "Base", token: vclmFromLog, canonicalAssetId: VCLM_ID }] : DATA.tokenAddresses;
    },
  };

  const usdOf = (units, price) => (units * price) / SCALE;
  function pkg(lockId, rec, assetId, custodyClass, receipt = "0x") {
    return {
      sourceEnvironmentId: "Base", commitmentVaultLockId: lockId, handshakeAllowanceCount: 3,
      canonicalAssetId: assetId, assetPrecision: 18, assetCustodyClass: custodyClass,
      grossAmountSmallestUnits: rec.gross, actualFeeAmountSmallestUnits: rec.fee, principalAmountSmallestUnits: rec.principal,
      feeAssetId: assetId, devFundDestination: DATA.devFund, feeTransferEvidence: ethers.id("fee:" + lockId),
      valuationTimestamp: rec.createdAt, maturityTimestamp: rec.maturity, durationSecs: rec.duration,
      selectedOutputToken: rec.outputToken, baseRecipient: rec.baseRecipient, releaseDestination: dest.address,
      chonxActivationReceipt: receipt, racIdentity: ethers.id("rac:" + lockId), priceRecord: "0x", sourceFinalityProof: "0x",
      lockEventProof: coder.encode(["bytes32", "uint256", "uint256", "uint256", "uint256", "uint256", "uint256"],
        [lockId, rec.gross, rec.fee, rec.principal, rec.duration, rec.createdAt, rec.maturity]),
    };
  }
  async function ethLock(wei, duration, output = 0) {
    const lockId = ethers.hexlify(ethers.randomBytes(32));
    await (await r.lock.connect(user).createNativeLock(lockId, recipient.address, output, ETH_ID, ethers.ZeroHash, dest.address, duration,
      usdOf(wei, ETH_PRICE), { value: wei })).wait();
    return { lockId, rec: await r.lock.lockRecord(lockId) };
  }
  async function vclmLock(holder, amount, duration, output) {
    const lockId = ethers.hexlify(ethers.randomBytes(32));
    await (await r.vclm.connect(holder).approve(await r.lock.getAddress(), amount)).wait();
    await (await r.lock.connect(holder).createErc20Lock(lockId, recipient.address, output, VCLM_ID, ethers.ZeroHash, dest.address, duration,
      await r.vclm.getAddress(), amount, usdOf(amount, TEST_VCLM_PRICE_USD18))).wait();
    return { lockId, rec: await r.lock.lockRecord(lockId) };
  }

  before(async () => {
    [signer, user, recipient, dest] = await ethers.getSigners();
    const L = new ethers.ContractFactory(art.CommitmentVaultLock.abi, art.CommitmentVaultLock.bytecode, signer);
    const newLocks = {};
    for (const env of EVM_ENVS) newLocks[env] = await (await L.deploy(env, DATA.evmDevFunds[env])).getAddress();
    const log = (s) => {
      logs.push(s);
      const m = /^VCLM (0x[0-9a-fA-F]{40})$/m.exec(s);
      if (m) vclmFromLog = ethers.getAddress(m[1]);
    };
    r = await runBaseCeremony({ ethers, signer, art, data, newLocks, log });
    // The live poster (0x6001...0DB4) signs run 2 here by impersonation (test chain only).
    await network.provider.send("hardhat_impersonateAccount", [DATA.scheduledPricePoster]);
    await network.provider.send("hardhat_setBalance", [DATA.scheduledPricePoster, "0x56BC75E2D63100000"]);
    poster = await ethers.getSigner(DATA.scheduledPricePoster);
  });

  it("Step 1: the ceremony deploys VCLM and logs its address before it writes the registry", async () => {
    const order = logs.map((s) => s.split(" ")[0]);
    expect(vclmFromLog).to.equal(await r.vclm.getAddress());
    expect(order.indexOf("VCLM")).to.be.lessThan(order.indexOf("registry"));
    expect(await r.vclm.symbol()).to.equal("VCLM");
  });

  it("Step 2: the Verifier mints against that VCLM and the CHONX deployed with it; initialize as the ceremony does", async () => {
    const v = await r.verifier.getAddress();
    expect(await r.verifier.vclmToken()).to.equal(vclmFromLog);
    expect(await r.verifier.chonxToken()).to.equal(await r.chonx.getAddress());
    expect(await r.vclm.minterVerifier()).to.equal(v);
    expect(await r.vclm.minterStake()).to.equal(await r.stake.getAddress());
    expect(await r.chonx.minterVerifier()).to.equal(v);
    expect(await r.chonx.minterStake()).to.equal(ethers.ZeroAddress); // CHONX.initialize(Verifier, 0): no stake minter
    expect(await r.verifier.chonxActivated()).to.equal(false);
  });

  it("Step 3: the 487 Revision B lines plus VCLM as row 488 are written before finalize, and the ceremony finalizes", async () => {
    expect(logs).to.include("registry 488/488");
    for (const e of [...DATA.entries.slice(0, 3), DATA.entries[485]]) expect((await r.verifier.assetPrecisionTable(key(e.environmentId, e.canonicalAssetId))).canonicalAssetId).to.equal(e.canonicalAssetId);
    expect((await r.verifier.assetPrecisionTable(key("Base", ETH_ID))).canonicalAssetId).to.equal(ETH_ID);
    const row = await r.verifier.assetPrecisionTable(key("Base", VCLM_ID));
    expect(row.canonicalAssetId).to.equal(VCLM_ID);
    expect(row.symbol).to.equal("VCLM");
    expect(row.decimals).to.equal(18n);
    expect(row.custodyClass).to.equal(3n);
    expect(row.custodyPath).to.equal(1n);
    expect(await r.verifier.configurationFinalized()).to.equal(true);
  });

  it("Step 4: the token address index (475 + 1 = 476) resolves the VCLM address to row 488", async () => {
    expect(logs).to.include("token addresses 476/476");
    expect(await r.verifier.tokenAssetIndex(await r.verifier.tokenAddressKey("Base", vclmFromLog))).to.equal(VCLM_ID);
  });

  it("Step 6a: an ETH lock mints VCLM to the recipient (run 1 Base ETH price from ceremony-data.json)", async () => {
    const { lockId, rec } = await ethLock(1n * SCALE, DAY7);
    const p = pkg(lockId, rec, ETH_ID, 2);
    await (await r.verifier.recordFeeAndRac(p)).wait();
    await (await r.verifier.verifyAndMint(p, 0)).wait();
    expect(await r.vclm.balanceOf(recipient.address)).to.be.gt(0n);
  });

  it("Step 5: the Base lock takes VCLM as an ERC-20 input and the Base reader reports it; with no VCLM price the Verifier refuses (fail closed)", async () => {
    const amount = 1000n * SCALE;
    const { lockId, rec } = await vclmLock(recipient, amount, DAY7, 1);
    expect(rec.asset).to.equal(vclmFromLog);
    expect(rec.gross).to.equal(amount);
    expect(rec.fee).to.equal(amount / 20n);
    expect(await r.vclm.balanceOf(DATA.devFund)).to.equal(amount / 20n); // the 5% fee goes to the Dev Fund in VCLM
    expect(await r.readers.Base.extractAssetId(pkg(lockId, rec, VCLM_ID, 3).lockEventProof)).to.equal(await r.verifier.tokenAddressKey("Base", vclmFromLog));
    await expect(r.verifier.recordFeeAndRac(pkg(lockId, rec, VCLM_ID, 3, "0x01"))).to.be.revertedWith("VF-ORC-005: no usable scheduled price");
    preActivation = { lockId, rec };
  });

  it("Step 6b: with a TEST VCLM price (run 2), VCLM->CHONX before activation records the fee and RAC but is refused at mint", async () => {
    await (await r.verifier.connect(poster).applyScheduledPriceRun(2n, [
      { environmentId: "Base", canonicalAssetId: VCLM_ID, priceUsd18: TEST_VCLM_PRICE_USD18, success: true },
    ])).wait();
    const p = pkg(preActivation.lockId, preActivation.rec, VCLM_ID, 3, "0x01");
    await (await r.verifier.recordFeeAndRac(p)).wait();
    await expect(r.verifier.verifyAndMint(p, 0)).to.be.revertedWith("VF-COM-025: CHONX not activated");
    expect(await r.verifier.chonxActivated()).to.equal(false);
    expect(await r.chonx.totalSupply()).to.equal(0n);
  });

  it("Step 6c: a legitimate ETH lock (10 years, 8.0x, VCLM out) crosses 10,000,000 lifetime VCLM and activates CHONX", async () => {
    const T = await r.verifier.CHONX_ACTIVATION_THRESHOLD();
    expect(T).to.equal(10_000_000n * SCALE);
    expect(await r.verifier.cumulativeVclmIssued()).to.be.lt(T);
    const { lockId, rec } = await ethLock(45n * SCALE, YEAR10);
    const p = pkg(lockId, rec, ETH_ID, 2);
    await (await r.verifier.recordFeeAndRac(p)).wait();
    await expect(r.verifier.verifyAndMint(p, 0)).to.emit(r.verifier, "ChonxActivated");
    expect(await r.verifier.cumulativeVclmIssued()).to.be.gte(T);
    expect(await r.verifier.chonxActivated()).to.equal(true);
    console.log("      lifetime VCLM after crossing:", ethers.formatEther(await r.verifier.cumulativeVclmIssued()));
  });

  it("Step 6d: after activation, a VCLM lock requesting CHONX mints CHONX to the recipient", async () => {
    const amount = 10_000n * SCALE;
    const before = await r.chonx.balanceOf(recipient.address);
    const { lockId, rec } = await vclmLock(recipient, amount, DAY7, 1);
    const p = pkg(lockId, rec, VCLM_ID, 3, "0x01");
    await (await r.verifier.recordFeeAndRac(p)).wait();
    await (await r.verifier.verifyAndMint(p, 0)).wait();
    const minted = (await r.chonx.balanceOf(recipient.address)) - before;
    // $1,000 (10,000 VCLM x TEST $0.10) x 100 CHONX per $1 (day 0) x S3 1.0x x the 7-day multiplier
    expect(minted).to.equal((1000n * SCALE * 100n * rec.multiplierBps) / 10000n);
    expect(rec.principal).to.equal(amount - amount / 20n);
    console.log("      CHONX minted for 10,000 VCLM locked 7 days:", ethers.formatEther(minted));
  });

  it("CURRENT BEHAVIOUR (gap, VF-COM-025): the VCLM->CHONX lock created before activation now mints CHONX", async () => {
    const p = pkg(preActivation.lockId, preActivation.rec, VCLM_ID, 3, "0x01");
    const before = await r.chonx.balanceOf(recipient.address);
    await (await r.verifier.verifyAndMint(p, 0)).wait();
    expect(await r.chonx.balanceOf(recipient.address)).to.be.gt(before);
  });

  it("CURRENT BEHAVIOUR (gap, VF-TOK-007): VCLM in -> VCLM out is accepted by the lock and the Verifier", async () => {
    const amount = 1000n * SCALE;
    const { lockId, rec } = await vclmLock(recipient, amount, DAY7, 0);
    const before = await r.vclm.balanceOf(recipient.address);
    const p = pkg(lockId, rec, VCLM_ID, 3);
    await (await r.verifier.recordFeeAndRac(p)).wait();
    await (await r.verifier.verifyAndMint(p, 0)).wait();
    expect(await r.vclm.balanceOf(recipient.address)).to.be.gt(before);
  });
});
