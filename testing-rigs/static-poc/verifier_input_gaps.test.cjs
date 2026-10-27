// Rig 7 follow-up: three Verifier findings (C01, H02, M01) found by manual
// triage next to Slither. Converted 2026-10-23 from proofs of concept to
// safe-behavior tests: each test now asserts the fixed behavior (AG-04, AG-05,
// AG-06). Local Hardhat chain
// chain with the production contracts (BaseCommitmentVaultLock, the Base
// reader, Verifier, VCLM, CHONX, Forge, Stake). Nothing here is deployed.
// Run from base-contracts:
//   NODE_PATH=$PWD/node_modules npx hardhat test ../testing-rigs/static-poc/verifier_input_gaps.test.cjs
const { expect } = require("chai");
const { ethers, network } = require("hardhat");
// VF-ORC-016: posted prices are USD per whole token with 30 decimals.
const P30 = (usd18) => BigInt(usd18) * 10n ** 12n;

const SCALE = 10n ** 18n;
const DAY = 86400n;
const SEVEN_DAYS = 604800n;
const ETH_ID = "0xde7085290190e1f2f7f2f83d26fa72e411f9d765ddd608a77e8a7c388113943b";

async function deploy() {
  const [deployer, user] = await ethers.getSigners();
  const nonce = await deployer.getNonce();
  const predicted = ethers.getCreateAddress({ from: deployer.address, nonce: nonce + 4 });
  const Token = await ethers.getContractFactory("VinculumFinalisToken");
  const vclm = await Token.deploy("Vinculum Finalis VCLM", "VCLM", 10_000_000_000n * SCALE);
  const chonx = await Token.deploy("Vinculum Finalis CHONX", "CHONX", 100_000_000_000n * SCALE);
  const synth = await (await ethers.getContractFactory("VinculumFinalisSynth")).deploy(predicted, await vclm.getAddress(), await chonx.getAddress());
  const stake = await (await ethers.getContractFactory("VinculumFinalisStake")).deploy(
    await vclm.getAddress(), await chonx.getAddress(), await synth.getAddress(), predicted);
  const verifier = await (await ethers.getContractFactory("VinculumFinalisVerifier")).deploy(await vclm.getAddress(), await chonx.getAddress());
  expect(await verifier.getAddress()).to.equal(predicted);
  await (await vclm.initialize(predicted, await stake.getAddress())).wait();
  await (await chonx.initialize(predicted, ethers.ZeroAddress)).wait();
  const lock = await (await ethers.getContractFactory("BaseCommitmentVaultLock")).deploy(
    "Base", deployer.address, await vclm.getAddress(), await chonx.getAddress(), await synth.getAddress());
  const reader = await (await ethers.getContractFactory("BaseLockRecordVerifier")).deploy(await lock.getAddress());
  await (await verifier.registerChainVerifier("Base", await reader.getAddress())).wait();
  await (await verifier.registerAssetPrecision("Base", ETH_ID, "ETH", 18, 2, 0)).wait();
  await (await verifier.setScheduledPricePoster(deployer.address)).wait();
  await (await verifier.configureDevFund("Base", deployer.address)).wait();
  await (await verifier.applyScheduledPriceRun(1n, [{ environmentId: "Base", canonicalAssetId: ETH_ID, priceUsd30: P30(1000n * SCALE), success: true }])).wait();
  await (await verifier.finalize()).wait();
  return { deployer, user, lock, vclm, verifier, stake };
}

async function lock7d(lock, user, eth) {
  const lockId = ethers.hexlify(ethers.randomBytes(32));
  await (await lock.connect(user).createNativeLock(
    lockId, user.address, 0, ETH_ID, ethers.ZeroHash, user.address, SEVEN_DAYS, 1n * SCALE, { value: eth })).wait();
  return { lockId, rec: await lock.lockRecord(lockId) };
}

function pkg(lockId, rec, recipient, racIdentity, valuationTimestamp) {
  return {
    sourceEnvironmentId: "Base", commitmentVaultLockId: lockId, handshakeAllowanceCount: 3,
    canonicalAssetId: ETH_ID, assetPrecision: 18, assetCustodyClass: 2,
    grossAmountSmallestUnits: rec.gross, actualFeeAmountSmallestUnits: rec.fee, principalAmountSmallestUnits: rec.principal,
    feeAssetId: ETH_ID, devFundDestination: "dev", feeTransferEvidence: ethers.id("fee"),
    valuationTimestamp, maturityTimestamp: rec.maturity, durationSecs: rec.duration,
    selectedOutputToken: rec.outputToken, baseRecipient: recipient, releaseDestination: "release",
    chonxActivationReceipt: "0x", racIdentity, priceRecord: "0x", sourceFinalityProof: "0x",
    lockEventProof: ethers.AbiCoder.defaultAbiCoder().encode(
      ["bytes32", "uint256", "uint256", "uint256", "uint256", "uint256", "uint256"],
      [lockId, rec.gross, rec.fee, rec.principal, rec.duration, rec.createdAt, rec.maturity]),
  };
}

describe("static rig: Verifier input gaps are closed (safe behavior, fix 2026-10-23)", function () {
  it("STATIC-H02 (AG-05): a caller-chosen valuationTimestamp is refused; the honest lock earns the decayed rate", async function () {
    const { user, lock, vclm, verifier } = await deploy();
    // One year after launch.
    await network.provider.send("evm_increaseTime", [Number(365n * DAY)]);
    await network.provider.send("evm_mine");
    const eth = ethers.parseEther("0.01"); // $10
    const b = await lock7d(lock, user, eth);
    const forged = pkg(b.lockId, b.rec, user.address, ethers.id("rac-b"), 0n); // valuationTimestamp = 0
    await expect(verifier.recordFeeAndRac(forged)).to.be.revertedWith("VF-ORC-011: valuation timestamp != proven lock creation time");
    const a = await lock7d(lock, user, eth);
    const honest = pkg(a.lockId, a.rec, user.address, ethers.id("rac-a"), a.rec.createdAt);
    await (await verifier.recordFeeAndRac(honest)).wait();
    const b0 = await vclm.balanceOf(user.address);
    await (await verifier.verifyAndMint(honest, 0)).wait();
    const honestMint = (await vclm.balanceOf(user.address)) - b0;
    const launch = await verifier.protocolLaunchTimestamp();
    const days = (a.rec.createdAt - launch) / DAY;
    expect(days).to.be.gte(365n);
    expect(honestMint).to.be.lt(await verifier.previewIssuance(10n * SCALE, 0, 2, SEVEN_DAYS, 0n));
  });

  it("STATIC-C01 (AG-04): one lock records exactly one RAC credit, whatever racIdentity is supplied", async function () {
    const { user, lock, verifier } = await deploy();
    const a = await lock7d(lock, user, ethers.parseEther("1")); // $1000
    const epoch = await verifier.currentEpoch();
    await (await verifier.connect(user).recordFeeAndRac(pkg(a.lockId, a.rec, user.address, ethers.id("rac-0"), a.rec.createdAt))).wait();
    for (let i = 1; i < 5; i++) {
      await expect(verifier.connect(user).recordFeeAndRac(pkg(a.lockId, a.rec, user.address, ethers.id("rac-" + i), a.rec.createdAt)))
        .to.be.revertedWith("VF-RAC-001: RAC already recorded");
    }
    const one = await verifier.racCredits(await verifier.racKey("Base", a.lockId));
    expect(one).to.be.gt(0n);
    expect(await verifier.epochRewardBasis(epoch)).to.equal(one);
  });

  it("STATIC-M01 (AG-06): the price is the one in effect at lock creation, not at first submission", async function () {
    const { deployer, user, lock, verifier } = await deploy();
    const a = await lock7d(lock, user, ethers.parseEther("0.01"));
    // A later scheduled run doubles the price before the user submits.
    await (await verifier.connect(deployer).applyScheduledPriceRun(2n, [{ environmentId: "Base", canonicalAssetId: ETH_ID, priceUsd30: P30(2000n * SCALE), success: true }])).wait();
    await (await verifier.recordFeeAndRac(pkg(a.lockId, a.rec, user.address, ethers.id("rac-p"), a.rec.createdAt))).wait();
    const lockIdHash = ethers.solidityPackedKeccak256(["string", "bytes32"], ["Base", a.lockId]);
    const bound = await verifier.lockReferencePrices(lockIdHash);
    expect(bound.priceUsd30).to.equal(P30(1000n * SCALE));
  });

  it("STATIC-C01b (AG-04): Stake.allocateEpoch mints on one credit per lock", async function () {
    const { user, lock, vclm, verifier, stake } = await deploy();
    // Get some VCLM honestly and stake it so epoch 2 has weight.
    const a = await lock7d(lock, user, ethers.parseEther("0.01"));
    const p0 = pkg(a.lockId, a.rec, user.address, ethers.id("rac-seed"), a.rec.createdAt);
    await (await verifier.recordFeeAndRac(p0)).wait();
    await (await verifier.verifyAndMint(p0, 0)).wait();
    const bal = await vclm.balanceOf(user.address);
    await (await vclm.connect(user).approve(await stake.getAddress(), bal)).wait();
    await (await stake.connect(user).createPosition(0, bal, 120n * DAY)).wait();
    // Move into epoch 2; the same lock fee under 20 identities records once.
    await network.provider.send("evm_increaseTime", [Number(11n * DAY)]);
    await network.provider.send("evm_mine");
    const b = await lock7d(lock, user, ethers.parseEther("1")); // $1000
    const epoch = await verifier.currentEpoch();
    expect(epoch).to.equal(2n);
    await (await verifier.connect(user).recordFeeAndRac(pkg(b.lockId, b.rec, user.address, ethers.id("dup-0"), b.rec.createdAt))).wait();
    for (let i = 1; i < 20; i++) {
      await expect(verifier.connect(user).recordFeeAndRac(pkg(b.lockId, b.rec, user.address, ethers.id("dup-" + i), b.rec.createdAt)))
        .to.be.revertedWith("VF-RAC-001: RAC already recorded");
    }
    const one = await verifier.racCredits(await verifier.racKey("Base", b.lockId));
    expect(await verifier.epochRewardBasis(2n)).to.equal(one);
    // Close and allocate epochs 1 and 2 after epoch 3 ends.
    await network.provider.send("evm_increaseTime", [Number(20n * DAY)]);
    await network.provider.send("evm_mine");
    await (await stake.closeEpoch(1)).wait();
    await (await stake.closeEpoch(2)).wait();
    await (await stake.allocateEpoch(1)).wait();
    const s0 = await vclm.balanceOf(await stake.getAddress());
    await (await stake.allocateEpoch(2)).wait();
    const minted = (await vclm.balanceOf(await stake.getAddress())) - s0;
    const honestReward = (one * 100n) / 10n;
    expect(minted).to.equal(honestReward);
  });
});
