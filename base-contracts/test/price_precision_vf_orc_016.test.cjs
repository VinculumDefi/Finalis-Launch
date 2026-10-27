// VF-ORC-016 price precision (operator t448u): scheduled prices are USD per
// whole token with 30 decimals (priceUsd30, uint128). The Verifier values a
// lock as usd18 = floor(gross * priceUsd30 / 10**(decimals + 12)) with a
// 512-bit intermediate and one floor rounding. In-process test chain only.
//
// TigerOG (Base row 138, 9 decimals) has a market price near $7.366e-19 per
// whole token. At 18 decimals that price is 0 (unusable). At 30 decimals it
// is 736,600,000,000 and its locks value exactly.
// Economics are unchanged: $0.01 floor, 5% fee, S1 1.5x / S2 1.3x / S3 1.0x.
const { expect } = require("chai");
const { ethers, network } = require("hardhat");
const art = require("../scripts/deploy-pages/ceremony.json");
const DATA = require("../scripts/deploy-pages/ceremony-data.json");
const { runBaseCeremony } = require("../scripts/deploy-pages/baseCeremonyFlow.js");
const { toUsd30 } = require("../scripts/priceRun.cjs");

const SCALE = 10n ** 18n;
const HOUR = 3600n;
const DAY7 = 604800n;
const YEAR10 = 315360000n;
const ETH_ID = DATA.row2.canonicalAssetId;
const TIGER = DATA.entries.find((e) => e.symbol === "TigerOG");
const TIGER_TOKEN = DATA.tokenAddresses.find((t) => t.canonicalAssetId === TIGER.canonicalAssetId).token;
const TIGER_P30 = toUsd30("7.366e-19"); // 736,600,000,000
const coder = ethers.AbiCoder.defaultAbiCoder();
const usd18Of = (gross, p30, dec) => (gross * p30) / 10n ** BigInt(dec + 12);
const unitsForUsd = (usd18, p30, dec) => (usd18 * 10n ** BigInt(dec + 12) + p30 - 1n) / p30; // smallest gross worth >= usd18

function pkg(lockId, rec, assetId, decimals, custodyClass, dest, receipt = "0x", priceRecord = "0x") {
  return {
    sourceEnvironmentId: "Base", commitmentVaultLockId: lockId, handshakeAllowanceCount: 3,
    canonicalAssetId: assetId, assetPrecision: decimals, assetCustodyClass: custodyClass,
    grossAmountSmallestUnits: rec.gross, actualFeeAmountSmallestUnits: rec.fee, principalAmountSmallestUnits: rec.principal,
    feeAssetId: assetId, devFundDestination: DATA.devFund, feeTransferEvidence: ethers.id("fee:" + lockId),
    valuationTimestamp: rec.createdAt, maturityTimestamp: rec.maturity, durationSecs: rec.duration,
    selectedOutputToken: rec.outputToken, baseRecipient: rec.baseRecipient, releaseDestination: dest,
    chonxActivationReceipt: receipt, racIdentity: ethers.id("rac:" + lockId), priceRecord, sourceFinalityProof: "0x",
    lockEventProof: coder.encode(["bytes32", "uint256", "uint256", "uint256", "uint256", "uint256", "uint256"],
      [lockId, rec.gross, rec.fee, rec.principal, rec.duration, rec.createdAt, rec.maturity]),
  };
}

describe("VF-ORC-016: 30-decimal prices, TigerOG-scale issuance (ceremony as built, test chain)", function () {
  this.timeout(900000);
  let r, user, recipient, dest, poster, tiger, launch;

  before(async () => {
    const [signer, u, rc, d] = await ethers.getSigners();
    user = u; recipient = rc; dest = d;
    r = await runBaseCeremony({ ethers, signer, art, data: DATA, log: () => {} });
    launch = await r.verifier.protocolLaunchTimestamp();
    await network.provider.send("hardhat_impersonateAccount", [DATA.scheduledPricePoster]);
    await network.provider.send("hardhat_setBalance", [DATA.scheduledPricePoster, "0x56BC75E2D63100000"]);
    poster = await ethers.getSigner(DATA.scheduledPricePoster);
    // A working ERC-20 at TigerOG's registered Base address.
    const f = await (await ethers.getContractFactory("TestFixtureERC20")).deploy(0);
    await network.provider.send("hardhat_setCode", [TIGER_TOKEN, await ethers.provider.getCode(await f.getAddress())]);
    tiger = await ethers.getContractAt("TestFixtureERC20", TIGER_TOKEN);
    await (await r.verifier.connect(poster).applyScheduledPriceRun((await r.verifier.lastScheduledRunId()) + 1n, [
      { environmentId: "Base", canonicalAssetId: TIGER.canonicalAssetId, priceUsd30: TIGER_P30, success: true },
      { environmentId: "Base", canonicalAssetId: ETH_ID, priceUsd30: BigInt(DATA.priceUsd30), success: true },
    ])).wait();
  });

  const tigerLock = async (amount, duration, output = 0) => {
    await (await tiger.mint(user.address, amount)).wait();
    await (await tiger.connect(user).approve(await r.lock.getAddress(), amount)).wait();
    const lockId = ethers.hexlify(ethers.randomBytes(32));
    const usd = usd18Of(amount, TIGER_P30, 9);
    await (await r.lock.connect(user).createErc20Lock(lockId, recipient.address, output, TIGER.canonicalAssetId, ethers.ZeroHash, dest.address,
      duration, TIGER_TOKEN, amount, usd)).wait();
    return { lockId, rec: await r.lock.lockRecord(lockId), usd };
  };
  const settle = async ({ lockId, rec }, receipt = "0x", priceRecord = "0x") => {
    const out = rec.outputToken === 0n ? r.vclm : r.chonx;
    const before = await out.balanceOf(recipient.address);
    const p = pkg(lockId, rec, TIGER.canonicalAssetId, 9, 3, dest.address, receipt, priceRecord);
    await (await r.verifier.recordFeeAndRac(p)).wait();
    await (await r.verifier.verifyAndMint(p, 0)).wait();
    return (await out.balanceOf(recipient.address)) - before;
  };
  const days = (rec) => (rec.createdAt > launch ? (rec.createdAt - launch) / 86400n : 0n);

  it("TigerOG is a registered S3 row with 9 decimals; its price is unusable at 18 decimals and exact at 30", async () => {
    expect(TIGER.custodyClass).to.equal(3);
    expect(TIGER.decimals).to.equal(9);
    expect(TIGER_P30).to.equal(736_600_000_000n);
    expect(TIGER_P30 / 10n ** 12n).to.equal(0n); // the old 18-decimal value would be 0
    const sp = await r.verifier.scheduledPrices(ethers.solidityPackedKeccak256(["string", "bytes32"], ["Base", TIGER.canonicalAssetId]));
    expect(sp.usable).to.equal(true);
    expect(sp.priceUsd30).to.equal(TIGER_P30);
  });

  it("VCLM: a $1.47 TigerOG lock (2e27 units) mints exactly the issuance of its floored USD value; fee is 5% of gross", async () => {
    const amount = 2n * 10n ** 27n;
    const L = await tigerLock(amount, DAY7);
    expect(L.usd).to.equal(1_473_200_000_000_000_000n); // exact: 2e18 whole tokens x $7.366e-19
    expect(L.rec.fee).to.equal((amount * 500n) / 10000n);
    const minted = await settle(L);
    expect(minted).to.equal(await r.verifier.previewIssuance(L.usd, 0, 3, DAY7, days(L.rec)));
    expect(minted).to.be.gt(0n);
    // Old math: assetUnitsFp * floor(price18) = 0, refused as below $0.01.
    expect(((amount * SCALE) / 10n ** 9n) * (TIGER_P30 / 10n ** 12n) / SCALE).to.equal(0n);
  });

  it("$0.01 floor: the smallest gross worth $0.01 mints; one unit less is refused (VF-COM-009)", async () => {
    const min = unitsForUsd(10n ** 16n, TIGER_P30, 9);
    expect(usd18Of(min, TIGER_P30, 9)).to.be.gte(10n ** 16n);
    expect(usd18Of(min - 1n, TIGER_P30, 9)).to.be.lt(10n ** 16n);
    const ok = await tigerLock(min, DAY7);
    expect(await settle(ok)).to.equal(await r.verifier.previewIssuance(10n ** 16n, 0, 3, DAY7, days(ok.rec)));
    // One unit less: the vault is told $0.01 (as an app would round), the Verifier values it below $0.01.
    const amount = min - 1n;
    await (await tiger.mint(user.address, amount)).wait();
    await (await tiger.connect(user).approve(await r.lock.getAddress(), amount)).wait();
    const lockId = ethers.hexlify(ethers.randomBytes(32));
    await (await r.lock.connect(user).createErc20Lock(lockId, recipient.address, 0, TIGER.canonicalAssetId, ethers.ZeroHash, dest.address,
      DAY7, TIGER_TOKEN, amount, 10n ** 16n)).wait();
    const rec = await r.lock.lockRecord(lockId);
    const p = pkg(lockId, rec, TIGER.canonicalAssetId, 9, 3, dest.address);
    await expect(r.verifier.recordFeeAndRac(p)).to.be.revertedWith("VF-COM-009: standard USD below $0.01");
  });

  it("rounding fails closed: a value with a fraction of a USD18 unit floors, never rounds up", async () => {
    // gross chosen so gross * price / 1e21 has a remainder: 1e25 + 7 units
    const amount = unitsForUsd(5n * 10n ** 16n, TIGER_P30, 9) + 7n;
    const exactNum = amount * TIGER_P30;
    const den = 10n ** 21n;
    expect(exactNum % den).to.not.equal(0n);
    const L = await tigerLock(amount, DAY7);
    const floor = exactNum / den;
    const minted = await settle(L);
    expect(minted).to.equal(await r.verifier.previewIssuance(floor, 0, 3, DAY7, days(L.rec)));
    expect(minted).to.be.lte(await r.verifier.previewIssuance(floor + 1n, 0, 3, DAY7, days(L.rec)));
  });

  it("the package price record must equal the bound 30-decimal price (VF-ORC-007)", async () => {
    const L = await tigerLock(2n * 10n ** 27n, DAY7);
    const wrong = coder.encode(["uint256"], [TIGER_P30 / 10n ** 12n]); // an 18-decimal record is refused
    const p = pkg(L.lockId, L.rec, TIGER.canonicalAssetId, 9, 3, dest.address, "0x", wrong);
    await expect(r.verifier.recordFeeAndRac(p)).to.be.revertedWith("VF-ORC-007: price record mismatch");
    const ok = coder.encode(["uint256"], [TIGER_P30]);
    expect(await settle(L, "0x", ok)).to.be.gt(0n);
  });

  it("Handshake: a 1-hour TigerOG lock worth $0.015 mints; $0.021 is refused (VF-COM-003)", async () => {
    const L = await tigerLock(unitsForUsd(15n * 10n ** 15n, TIGER_P30, 9), HOUR);
    expect(await settle(L)).to.equal(await r.verifier.previewIssuance(L.usd, 0, 3, HOUR, days(L.rec)));
    const amount = unitsForUsd(21n * 10n ** 15n, TIGER_P30, 9);
    await (await tiger.mint(user.address, amount)).wait();
    await (await tiger.connect(user).approve(await r.lock.getAddress(), amount)).wait();
    const lockId = ethers.hexlify(ethers.randomBytes(32));
    await (await r.lock.connect(user).createErc20Lock(lockId, recipient.address, 0, TIGER.canonicalAssetId, ethers.ZeroHash, dest.address,
      HOUR, TIGER_TOKEN, amount, 2n * 10n ** 16n)).wait(); // the vault is told $0.02
    const rec = await r.lock.lockRecord(lockId);
    await expect(r.verifier.recordFeeAndRac(pkg(lockId, rec, TIGER.canonicalAssetId, 9, 3, dest.address)))
      .to.be.revertedWith("VF-COM-003: handshake USD outside $0.01-$0.02");
  });

  it("CHONX: TigerOG locks alone carry lifetime VCLM past 10,000,000; a TigerOG lock then mints exact CHONX", async () => {
    for (let i = 0; i < 4 && !(await r.verifier.chonxActivated()); i++) {
      const L = await tigerLock(unitsForUsd(2_000_000n * SCALE, TIGER_P30, 9), YEAR10); // about $2,000,000
      await settle(L);
    }
    expect(await r.verifier.chonxActivated()).to.equal(true);
    const L = await tigerLock(10n ** 30n, DAY7, 1); // about $736.60
    const minted = await settle(L, "0x01");
    expect(minted).to.equal(await r.verifier.previewIssuance(L.usd, 1, 3, DAY7, days(L.rec)));
    expect(minted).to.be.gt(0n);
  });

  it("SYNTH: TigerOG CHONX locks carry lifetime CHONX past 100,000,000; forge(1) burns 1,000 VCLM + 10,000 CHONX", async () => {
    const T = await r.forge.SYNTH_ACTIVATION_THRESHOLD();
    for (let i = 0; i < 6 && (await r.verifier.cumulativeChonxIssued()) < T; i++) {
      await settle(await tigerLock(unitsForUsd(2_000_000n * SCALE, TIGER_P30, 9), YEAR10, 1), "0x01");
    }
    expect(await r.verifier.cumulativeChonxIssued()).to.be.gte(T);
    const F = await r.forge.getAddress();
    await (await r.vclm.connect(recipient).approve(F, 1000n * SCALE)).wait();
    await (await r.chonx.connect(recipient).approve(F, 10_000n * SCALE)).wait();
    await expect(r.forge.connect(recipient).forge(1)).to.emit(r.forge, "SynthForged").withArgs(recipient.address, 1n, 1000n * SCALE, 10_000n * SCALE);
    expect(await r.forge.balanceOf(recipient.address)).to.equal(SCALE);
  });

  it("ETH at the ceremony price: a native lock values exactly as before the change (18-decimal parity)", async () => {
    const p30 = BigInt(DATA.priceUsd30);
    const wei = 3n * SCALE + 123456789n;
    const usd = usd18Of(wei, p30, 18);
    expect(usd).to.equal((wei * SCALE / SCALE) * (p30 / 10n ** 12n) / SCALE); // old formula, same result for 18 decimals
    const lockId = ethers.hexlify(ethers.randomBytes(32));
    await (await r.lock.connect(user).createNativeLock(lockId, recipient.address, 0, ETH_ID, ethers.ZeroHash, dest.address, DAY7, usd, { value: wei })).wait();
    const rec = await r.lock.lockRecord(lockId);
    const before = await r.vclm.balanceOf(recipient.address);
    const p = pkg(lockId, rec, ETH_ID, 18, 2, dest.address);
    await (await r.verifier.recordFeeAndRac(p)).wait();
    await (await r.verifier.verifyAndMint(p, 0)).wait();
    expect((await r.vclm.balanceOf(recipient.address)) - before).to.equal(await r.verifier.previewIssuance(usd, 0, 2, DAY7, days(rec)));
  });
});

describe("VF-ORC-016: large prices, overflow and decimals guards (fresh Verifier, test chain)", function () {
  this.timeout(600000);
  const MAX = (1n << 128n) - 1n;
  const BIG_ID = ethers.solidityPackedKeccak256(["string", "string"], ["Base", "BIG18"]);
  const D66_ID = ethers.solidityPackedKeccak256(["string", "string"], ["Base", "D66"]);
  const Z0_ID = ethers.solidityPackedKeccak256(["string", "string"], ["Base", "Z0"]);
  let c;

  before(async () => {
    const [deployer, user, recipient, dest, devFund] = await ethers.getSigners();
    const T = await ethers.getContractFactory("VinculumFinalisToken");
    const vclm = await T.deploy("Vinculum", "VCLM", 10_000_000_000n * SCALE);
    const chonx = await T.deploy("Chonx", "CHONX", 100_000_000_000n * SCALE);
    const verifier = await (await ethers.getContractFactory("VinculumFinalisVerifier")).deploy(await vclm.getAddress(), await chonx.getAddress());
    const stake = await (await ethers.getContractFactory("VinculumFinalisStake")).deploy(
      await vclm.getAddress(), await chonx.getAddress(), await vclm.getAddress(), await verifier.getAddress());
    await vclm.initialize(await verifier.getAddress(), await stake.getAddress());
    await chonx.initialize(await verifier.getAddress(), ethers.ZeroAddress);
    const lock = await (await ethers.getContractFactory("CommitmentVaultLock")).deploy("Base", devFund.address);
    const reader = await (await ethers.getContractFactory("BaseLockRecordVerifier")).deploy(await lock.getAddress());
    await verifier.registerChainVerifier("Base", await reader.getAddress());
    const F = await ethers.getContractFactory("TestFixtureERC20");
    const big = await F.deploy(0);
    const d66 = await F.deploy(0);
    const z0 = await F.deploy(0);
    await verifier.registerAssetPrecisionBatch([["Base", ETH_ID, "ETH", 18, 2, 0], ["Base", BIG_ID, "BIG18", 18, 3, 1], ["Base", D66_ID, "D66", 66, 3, 1], ["Base", Z0_ID, "Z0", 0, 3, 1]]);
    await verifier.registerTokenAddressBatch([
      { environmentId: "Base", token: await big.getAddress(), canonicalAssetId: BIG_ID },
      { environmentId: "Base", token: await d66.getAddress(), canonicalAssetId: D66_ID },
      { environmentId: "Base", token: await z0.getAddress(), canonicalAssetId: Z0_ID },
    ]);
    await verifier.configureDevFund("Base", devFund.address);
    await verifier.setScheduledPricePoster(deployer.address);
    await verifier.applyScheduledPriceRun(1n, [
      { environmentId: "Base", canonicalAssetId: ETH_ID, priceUsd30: BigInt(DATA.priceUsd30), success: true },
      { environmentId: "Base", canonicalAssetId: BIG_ID, priceUsd30: MAX, success: true },  // about $340,282,366.92 per token
      { environmentId: "Base", canonicalAssetId: D66_ID, priceUsd30: 10n ** 30n, success: true },
      { environmentId: "Base", canonicalAssetId: Z0_ID, priceUsd30: MAX, success: true },
    ]);
    await verifier.finalize();
    c = { verifier, lock, vclm, big, d66, z0, user, recipient, dest };
  });

  const lockOf = async (token, assetId, amount) => {
    await (await token.mint(c.user.address, amount)).wait();
    await (await token.connect(c.user).approve(await c.lock.getAddress(), amount)).wait();
    const lockId = ethers.hexlify(ethers.randomBytes(32));
    await (await c.lock.connect(c.user).createErc20Lock(lockId, c.recipient.address, 0, assetId, ethers.ZeroHash, c.dest.address, DAY7,
      await token.getAddress(), amount, 10n ** 18n)).wait();
    return { lockId, rec: await c.lock.lockRecord(lockId) };
  };

  it("the maximum price (2^128-1) values exactly: 1e12 units of an 18-decimal token mint the issuance of floor(gross x price / 1e30)", async () => {
    const L = await lockOf(c.big, BIG_ID, 10n ** 12n);
    const usd = usd18Of(10n ** 12n, MAX, 18);
    expect(usd).to.equal(340_282_366_920_938_463_463n); // $340.28, floored
    const p = pkg(L.lockId, L.rec, BIG_ID, 18, 3, c.dest.address);
    await c.verifier.recordFeeAndRac(p);
    await c.verifier.verifyAndMint(p, 0);
    expect(await c.vclm.balanceOf(c.recipient.address)).to.equal(await c.verifier.previewIssuance(usd, 0, 3, DAY7, 0n));
  });

  it("no overflow at large values: 2^100 units at the maximum price value exactly and stop at the VCLM cap with a coded error", async () => {
    const gross = 1n << 100n; // about 1.27e12 whole tokens at about $340M each
    const usd = usd18Of(gross, MAX, 18);
    expect(usd > 10n ** 38n).to.equal(true);
    const L = await lockOf(c.big, BIG_ID, gross);
    const p = pkg(L.lockId, L.rec, BIG_ID, 18, 3, c.dest.address);
    await expect(c.verifier.recordFeeAndRac(p)).to.not.be.reverted;
    const before = await c.vclm.totalSupply();
    await expect(c.verifier.verifyAndMint(p, 0)).to.be.revertedWith("VF-SUP-015: exceeds VCLM cap");
    expect(await c.vclm.totalSupply()).to.equal(before);
  });

  it("the largest accepted gross (uint256 max / 1e18) at the maximum price is refused with nothing recorded (fail closed)", async () => {
    const gross = ((1n << 256n) - 1n) / SCALE; // VF-COM-011 upper bound, about 2^196
    expect(gross * MAX > (1n << 256n) - 1n).to.equal(true); // the raw product needs the 512-bit path
    const L = await lockOf(c.big, BIG_ID, gross);
    const p = pkg(L.lockId, L.rec, BIG_ID, 18, 3, c.dest.address);
    // Valuation fits (about 3.9e49 USD); the existing RAC fee-share step (creditUsd * fee) then
    // exceeds uint256 and reverts. Same behaviour as before VF-ORC-016 (the old valuation itself overflowed here).
    await expect(c.verifier.recordFeeAndRac(p)).to.be.reverted;
    expect(await c.verifier.recordedRacs(await c.verifier.racKey("Base", L.lockId))).to.equal(false);
  });

  it("a value beyond uint256 is refused with a coded error (VF-ORC-004: valuation out of range)", async () => {
    // 0-decimal row: gross 2^195 x 2^128 / 1e12 is about 2^283.
    const L = await lockOf(c.z0, Z0_ID, 1n << 195n);
    await expect(c.verifier.recordFeeAndRac(pkg(L.lockId, L.rec, Z0_ID, 0, 3, c.dest.address)))
      .to.be.revertedWith("VF-ORC-004: valuation out of range");
  });

  it("a row with more than 65 decimals is refused (VF-ORC-004: decimals out of range)", async () => {
    const L = await lockOf(c.d66, D66_ID, 10n ** 50n);
    await expect(c.verifier.recordFeeAndRac(pkg(L.lockId, L.rec, D66_ID, 66, 3, c.dest.address)))
      .to.be.revertedWith("VF-ORC-004: decimals out of range");
  });

  it("USDC/USDT floor is $0.95 at 30 decimals", async () => {
    expect(await c.verifier.USD_STABLE_MIN_PRICE()).to.equal(95n * 10n ** 28n);
  });
});
