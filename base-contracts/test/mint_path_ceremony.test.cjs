const { expect } = require("chai");
const { ethers } = require("hardhat");

const HOUR = 3600n;
const SCALE = 10n ** 18n;

async function deployCeremony() {
  const [deployer, recipient, other] = await ethers.getSigners();
  const lock = await (await ethers.getContractFactory("TestLock")).deploy(deployer.address);
  const nonce = await deployer.getNonce();
  const predicted = ethers.getCreateAddress({ from: deployer.address, nonce: nonce + 4 });
  const Token = await ethers.getContractFactory("VinculumFinalisToken");
  const vclm = await Token.deploy("Vinculum Finalis VCLM", "VCLM", 10_000_000_000n * SCALE);
  const chonx = await Token.deploy("Vinculum Finalis CHONX", "CHONX", 100_000_000_000n * SCALE);
  const synth = await (await ethers.getContractFactory("VinculumFinalisSynth")).deploy(predicted, await vclm.getAddress(), await chonx.getAddress());
  const launchTs = BigInt((await ethers.provider.getBlock("latest")).timestamp);
  const stake = await (await ethers.getContractFactory("VinculumFinalisStake")).deploy(
    await vclm.getAddress(), await chonx.getAddress(), await synth.getAddress(), predicted, launchTs
  );
  const verifier = await (await ethers.getContractFactory("VinculumFinalisVerifier")).deploy(await vclm.getAddress(), await chonx.getAddress());
  expect(await verifier.getAddress()).to.equal(predicted);
  await (await vclm.initialize(predicted, await stake.getAddress())).wait();
  await (await chonx.initialize(predicted, await synth.getAddress())).wait();
  const reader = await (await ethers.getContractFactory("BaseLockRecordVerifier")).deploy(await lock.getAddress());
  await (await verifier.registerChainVerifier("Base", await reader.getAddress())).wait();
  const ethId = ethers.hexlify(ethers.randomBytes(32));
  await (await verifier.registerAssetPrecision("Base", ethId, "ETH", 18, 2, 0)).wait();
  await (await verifier.setScheduledPricePoster(deployer.address)).wait();
  await (await verifier.configureDevFund("Base", deployer.address)).wait();
  await (await verifier.finalize()).wait();
  await (await verifier.applyScheduledPriceRun(1n, [{
    environmentId: "Base",
    canonicalAssetId: ethId,
    priceUsd18: 1000n * SCALE,
    success: true,
  }])).wait();
  return { deployer, recipient, other, lock, vclm, verifier, ethId };
}

async function lockHandshake(lock, ethId, recipient) {
  const lockId = ethers.hexlify(ethers.randomBytes(32));
  const gross = ethers.parseEther("0.001");
  await (await lock.createNativeLock(
    lockId, recipient, 0, ethId, ethers.ZeroHash, recipient, HOUR, SCALE, { value: gross }
  )).wait();
  const rec = await lock.lockRecord(lockId);
  return { lockId, rec };
}

function pkgFrom(lockId, rec, ethId, recipient, racIdentity) {
  return {
    sourceEnvironmentId: "Base",
    commitmentVaultLockId: lockId,
    handshakeIdentity: "base-handshake",
    handshakeAllowanceCount: 3,
    canonicalAssetId: ethId,
    assetPrecision: 18,
    assetCustodyClass: 2,
    grossAmountSmallestUnits: rec.gross,
    actualFeeAmountSmallestUnits: rec.fee,
    principalAmountSmallestUnits: rec.principal,
    feeAssetId: ethId,
    devFundDestination: "dev",
    feeTransferEvidence: ethers.id("fee"),
    valuationTimestamp: rec.createdAt,
    maturityTimestamp: rec.maturity,
    durationSecs: rec.duration,
    selectedOutputToken: rec.outputToken,
    baseRecipient: recipient,
    releaseDestination: "release",
    chonxActivationReceipt: "0x",
    racIdentity,
    priceRecord: "0x",
    sourceFinalityProof: "0x",
    lockEventProof: ethers.AbiCoder.defaultAbiCoder().encode(
      ["bytes32", "uint256", "uint256", "uint256", "uint256", "uint256", "uint256"],
      [lockId, rec.gross, rec.fee, rec.principal, rec.duration, rec.createdAt, rec.maturity]
    ),
  };
}

describe("mint path ceremony", function () {
  it("mints VCLM to the lock recipient after verifyAndMint", async function () {
    const { recipient, lock, vclm, verifier, ethId } = await deployCeremony();
    const { lockId, rec } = await lockHandshake(lock, ethId, recipient.address);
    const pkg = pkgFrom(lockId, rec, ethId, recipient.address, ethers.id("rac-ok"));
    await (await verifier.recordFeeAndRac(pkg)).wait();
    await (await verifier.verifyAndMint(pkg, 0)).wait();
    expect(await vclm.balanceOf(recipient.address)).to.be.gt(0);
  });

  it("reverts when the package recipient is not the lock recipient", async function () {
    const { recipient, other, lock, verifier, ethId } = await deployCeremony();
    const { lockId, rec } = await lockHandshake(lock, ethId, recipient.address);
    const pkg = pkgFrom(lockId, rec, ethId, other.address, ethers.id("rac-bad"));
    await (await verifier.recordFeeAndRac(pkg)).wait();
    await expect(verifier.verifyAndMint(pkg, 0)).to.be.revertedWith("VF-XCH-011: recipient mismatch");
  });
});
