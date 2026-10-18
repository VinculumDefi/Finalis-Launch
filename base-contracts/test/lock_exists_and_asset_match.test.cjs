// Two checks brought from redteam/prep into main:
//   1. The package asset must match the lock's own asset (VF-XCH-011: asset mismatch).
//   2. recordFeeAndRac proves the lock (it must exist) before any fee or RAC is recorded.
// In-process Hardhat chain only.
const { expect } = require("chai");
const { ethers } = require("hardhat");

const SCALE = 10n ** 18n;
const PRICE = 1000n * SCALE;
const HOUR = 3600n;
const ETH_ID = "0xde7085290190e1f2f7f2f83d26fa72e411f9d765ddd608a77e8a7c388113943b";
const USDC_ID = ethers.solidityPackedKeccak256(["string", "string"], ["Ethereum", "USDC"]);
const coder = ethers.AbiCoder.defaultAbiCoder();
const HS_GROSS = ethers.parseEther("0.000015"); // $0.015 at $1000

async function deploy({ withMock = false } = {}) {
  const [deployer, recipient, other, dest, devFund] = await ethers.getSigners();
  const T = await ethers.getContractFactory("VinculumFinalisToken");
  const vclm = await T.deploy("Vinculum", "VCLM", 10_000_000_000n * SCALE);
  const chonx = await T.deploy("Chonx", "CHONX", 100_000_000_000n * SCALE);
  const verifier = await (await ethers.getContractFactory("VinculumFinalisVerifier")).deploy(await vclm.getAddress(), await chonx.getAddress());
  const launch = (await ethers.provider.getBlock("latest")).timestamp;
  const stake = await (await ethers.getContractFactory("VinculumFinalisStake")).deploy(
    await vclm.getAddress(), await chonx.getAddress(), await vclm.getAddress(), await verifier.getAddress(), launch);
  await vclm.initialize(await verifier.getAddress(), await stake.getAddress());
  await chonx.initialize(await verifier.getAddress(), ethers.ZeroAddress);
  const lock = await (await ethers.getContractFactory("CommitmentVaultLock")).deploy("Base", devFund.address);
  const reader = await (await ethers.getContractFactory("BaseLockRecordVerifier")).deploy(await lock.getAddress());
  await verifier.registerChainVerifier("Base", await reader.getAddress());
  const rows = [
    ["Base", ETH_ID, "ETH", 18, 2, 0],
    ["Ethereum", ETH_ID, "ETH", 18, 2, 0],
    ["Ethereum", USDC_ID, "USDC", 18, 2, 0],
  ];
  let mock;
  if (withMock) {
    mock = await (await ethers.getContractFactory("MockAlwaysFinalizedVerifier")).deploy();
    await verifier.registerChainVerifier("Ethereum", await mock.getAddress());
    await verifier.configureDevFund("Ethereum", devFund.address);
  }
  await verifier.registerAssetPrecisionBatch(rows);
  await verifier.configureDevFund("Base", devFund.address);
  await verifier.setScheduledPricePoster(deployer.address);
  await verifier.applyScheduledPriceRun(1n, [
    { environmentId: "Base", canonicalAssetId: ETH_ID, priceUsd18: PRICE, success: true },
    { environmentId: "Ethereum", canonicalAssetId: ETH_ID, priceUsd18: PRICE, success: true },
    { environmentId: "Ethereum", canonicalAssetId: USDC_ID, priceUsd18: PRICE, success: true },
  ]);
  await verifier.finalize();
  return { deployer, recipient, other, dest, devFund, verifier, lock, reader, mock, vclm };
}

async function openNative(c) {
  const lockId = ethers.hexlify(ethers.randomBytes(32));
  await c.lock.connect(c.other).createNativeLock(lockId, c.recipient.address, 0, ETH_ID, ethers.ZeroHash, c.dest.address, HOUR, (HS_GROSS * PRICE) / SCALE, { value: HS_GROSS });
  return { lockId, rec: await c.lock.lockRecord(lockId) };
}

function basePkg(lockId, rec, over = {}) {
  return {
    sourceEnvironmentId: "Base", commitmentVaultLockId: lockId, handshakeAllowanceCount: 3,
    canonicalAssetId: ETH_ID, assetPrecision: 18, assetCustodyClass: 2,
    grossAmountSmallestUnits: rec.gross, actualFeeAmountSmallestUnits: rec.fee, principalAmountSmallestUnits: rec.principal,
    feeAssetId: ETH_ID, devFundDestination: "dev", feeTransferEvidence: ethers.id("fee"),
    valuationTimestamp: rec.createdAt, maturityTimestamp: rec.maturity, durationSecs: rec.duration,
    selectedOutputToken: rec.outputToken, baseRecipient: rec.baseRecipient, releaseDestination: "release",
    chonxActivationReceipt: "0x", racIdentity: ethers.hexlify(ethers.randomBytes(32)), priceRecord: "0x",
    sourceFinalityProof: "0x",
    lockEventProof: coder.encode(["bytes32", "uint256", "uint256", "uint256", "uint256", "uint256", "uint256"],
      [lockId, rec.gross, rec.fee, rec.principal, rec.duration, rec.createdAt, rec.maturity]),
    ...over,
  };
}

// Mock-reader package: the proof's 10th word is the lock's asset.
function mockPkg(recipient, { lockAsset, pkgAsset, gross = 10n ** 15n, duration = 604800n }) {
  const fee = (gross * 500n) / 10000n;
  const lockId = ethers.hexlify(ethers.randomBytes(32));
  return {
    sourceEnvironmentId: "Ethereum", commitmentVaultLockId: lockId, handshakeAllowanceCount: 3,
    canonicalAssetId: pkgAsset, assetPrecision: 18, assetCustodyClass: 2,
    grossAmountSmallestUnits: gross, actualFeeAmountSmallestUnits: fee, principalAmountSmallestUnits: gross - fee,
    feeAssetId: pkgAsset, devFundDestination: "dev", feeTransferEvidence: ethers.id("fee"),
    valuationTimestamp: 1n, maturityTimestamp: 2n, durationSecs: duration,
    selectedOutputToken: 0, baseRecipient: recipient, releaseDestination: "release",
    chonxActivationReceipt: "0x", racIdentity: ethers.hexlify(ethers.randomBytes(32)), priceRecord: "0x",
    sourceFinalityProof: "0x",
    lockEventProof: coder.encode(
      ["bytes32", "uint256", "uint256", "uint256", "uint256", "uint256", "uint256", "address", "uint8", "bytes32"],
      [lockId, gross, fee, gross - fee, duration, 1n, 2n, recipient, 0, lockAsset]),
  };
}

describe("recordFeeAndRac: the lock must exist before fees are recorded", function () {
  it("a package for a lock that was never created records nothing", async function () {
    const c = await deploy();
    const { rec } = await openNative(c);
    const ghost = ethers.hexlify(ethers.randomBytes(32));
    const pkg = basePkg(ghost, rec, {
      lockEventProof: coder.encode(["bytes32", "uint256", "uint256", "uint256", "uint256", "uint256", "uint256"],
        [ghost, rec.gross, rec.fee, rec.principal, rec.duration, rec.createdAt, rec.maturity]),
      commitmentVaultLockId: ghost,
    });
    await expect(c.verifier.recordFeeAndRac(pkg)).to.be.revertedWithCustomError(c.reader, "LockNotFound");
    expect(await c.verifier.recordedRacs(pkg.racIdentity)).to.equal(false);
    expect(await c.verifier.racCredits(pkg.racIdentity)).to.equal(0n);
  });

  it("an environment with no registered reader records nothing (VF-XCH-006)", async function () {
    const c = await deploy();
    const { lockId, rec } = await openNative(c);
    const pkg = basePkg(lockId, rec, { sourceEnvironmentId: "Solana" });
    await expect(c.verifier.recordFeeAndRac(pkg)).to.be.revertedWith("VF-XCH-006: no verifier registered for environment");
    expect(await c.verifier.recordedRacs(pkg.racIdentity)).to.equal(false);
  });

  it("amounts that differ from the real lock record nothing (VF-XCH-011)", async function () {
    const c = await deploy();
    const { lockId, rec } = await openNative(c);
    const g = rec.gross * 2n, f = (g * 500n) / 10000n;
    const pkg = basePkg(lockId, rec, { grossAmountSmallestUnits: g, actualFeeAmountSmallestUnits: f, principalAmountSmallestUnits: g - f });
    await expect(c.verifier.recordFeeAndRac(pkg)).to.be.revertedWith("VF-XCH-011: gross mismatch");
    expect(await c.verifier.recordedRacs(pkg.racIdentity)).to.equal(false);
  });

  it("a real lock records the fee and RAC, then mints", async function () {
    const c = await deploy();
    const { lockId, rec } = await openNative(c);
    const pkg = basePkg(lockId, rec);
    await c.verifier.recordFeeAndRac(pkg);
    expect(await c.verifier.recordedRacs(pkg.racIdentity)).to.equal(true);
    await c.verifier.verifyAndMint(pkg, 0);
    expect(await c.vclm.balanceOf(c.recipient.address)).to.be.gt(0n);
  });
});

describe("The package asset must match the lock's asset", function () {
  it("Base: a native-ETH lock relabelled as another asset is refused in both phases", async function () {
    const c = await deploy();
    const { lockId, rec } = await openNative(c);
    expect(await c.reader.extractAssetId(basePkg(lockId, rec).lockEventProof)).to.equal(ETH_ID);
    const relabel = basePkg(lockId, rec, { canonicalAssetId: USDC_ID, feeAssetId: USDC_ID });
    await expect(c.verifier.recordFeeAndRac(relabel)).to.be.revertedWith("VF-XCH-011: asset mismatch");
    expect(await c.verifier.recordedRacs(relabel.racIdentity)).to.equal(false);
  });

  it("Base: a token lock has no provable asset and is refused (fail closed)", async function () {
    const c = await deploy();
    const token = await (await ethers.getContractFactory("TestFixtureERC20")).deploy(0);
    await token.mint(c.other.address, 10n ** 24n);
    await token.connect(c.other).approve(await c.lock.getAddress(), 10n ** 24n);
    const lockId = ethers.hexlify(ethers.randomBytes(32));
    await c.lock.connect(c.other).createErc20Lock(lockId, c.recipient.address, 0, ETH_ID, ethers.ZeroHash, c.dest.address, 604800n,
      await token.getAddress(), 10n ** 18n, SCALE);
    const rec = await c.lock.lockRecord(lockId);
    const pkg = basePkg(lockId, rec);
    await expect(c.reader.extractAssetId(pkg.lockEventProof)).to.be.revertedWith("VF-XCH-011: token asset not provable");
    await expect(c.verifier.recordFeeAndRac(pkg)).to.be.revertedWith("VF-XCH-011: token asset not provable");
  });

  it("verifyAndMint also refuses a package whose asset differs from the lock's", async function () {
    const c = await deploy({ withMock: true });
    const good = mockPkg(c.recipient.address, { lockAsset: USDC_ID, pkgAsset: USDC_ID });
    await c.verifier.recordFeeAndRac(good);
    // Same lock and RAC, relabelled to another registered, priced asset.
    const bad = { ...good, canonicalAssetId: ETH_ID, feeAssetId: ETH_ID };
    await expect(c.verifier.verifyAndMint(bad, 0)).to.be.revertedWith("VF-XCH-011: asset mismatch");
    await expect(c.verifier.verifyAndMint(good, 0)).to.not.be.reverted;
  });

  it("recordFeeAndRac refuses a mismatched asset; an unregistered matching asset still fails VF-REG-001", async function () {
    const c = await deploy({ withMock: true });
    await expect(c.verifier.recordFeeAndRac(mockPkg(c.recipient.address, { lockAsset: USDC_ID, pkgAsset: ETH_ID })))
      .to.be.revertedWith("VF-XCH-011: asset mismatch");
    const unreg = ethers.id("unregistered");
    await expect(c.verifier.recordFeeAndRac(mockPkg(c.recipient.address, { lockAsset: unreg, pkgAsset: unreg })))
      .to.be.revertedWith("VF-REG-001: asset not in registry");
  });

  it("the blocked Solana reader has no asset", async function () {
    const r = await (await ethers.getContractFactory("SolanaLockReader")).deploy();
    await expect(r.extractAssetId("0x")).to.be.reverted;
  });
});
