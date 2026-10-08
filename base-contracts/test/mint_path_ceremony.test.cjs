const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Vinculum Finalis mint path ceremony (local)", function () {
  it("registers Base, prices ETH after finalize, and mints VCLM from the lock record", async function () {
    const [deployer, recipient] = await ethers.getSigners();
    const TestLock = await ethers.getContractFactory("TestLock");
    const lock = await TestLock.deploy(deployer.address);
    await lock.waitForDeployment();

    const nonce = await deployer.getNonce();
    const predicted = ethers.getCreateAddress({ from: deployer.address, nonce: nonce + 4 });
    const Token = await ethers.getContractFactory("VinculumFinalisToken");
    const vclm = await Token.deploy("Vinculum Finalis VCLM", "VCLM", 10_000_000_000n * 10n ** 18n);
    const chonx = await Token.deploy("Vinculum Finalis CHONX", "CHONX", 100_000_000_000n * 10n ** 18n);
    const Synth = await ethers.getContractFactory("VinculumFinalisSynth");
    const synth = await Synth.deploy(predicted, await vclm.getAddress(), await chonx.getAddress());
    const Stake = await ethers.getContractFactory("VinculumFinalisStake");
    const launchTs = BigInt((await ethers.provider.getBlock("latest")).timestamp);
    const stake = await Stake.deploy(await vclm.getAddress(), await chonx.getAddress(), await synth.getAddress(), predicted, launchTs);
    const Verifier = await ethers.getContractFactory("VinculumFinalisVerifier");
    const verifier = await Verifier.deploy(await vclm.getAddress(), await chonx.getAddress());
    await verifier.waitForDeployment();
    expect(await verifier.getAddress()).to.equal(predicted);

    await (await vclm.initialize(predicted, await stake.getAddress())).wait();
    await (await chonx.initialize(predicted, await synth.getAddress())).wait();
    const Reader = await ethers.getContractFactory("BaseLockRecordVerifier");
    const reader = await Reader.deploy(await lock.getAddress());
    await (await verifier.registerChainVerifier("Base", await reader.getAddress())).wait();
    const ethId = ethers.hexlify(ethers.randomBytes(32));
    await (await verifier.registerAssetPrecision("Base", ethId, "ETH", 18, 2, 0)).wait();
    await (await verifier.setScheduledPricePoster(deployer.address)).wait();
    await (await verifier.configureDevFund("Base", deployer.address)).wait();
    await (await verifier.finalize()).wait();
    await (await verifier.applyScheduledPriceRun(1n, [{ environmentId: "Base", canonicalAssetId: ethId, priceUsd18: ethers.parseUnits("1000", 18), success: true }])).wait();

    const lockId = ethers.hexlify(ethers.randomBytes(32));
    const gross = ethers.parseEther("0.001");
    await (await lock.createNativeLock(lockId, recipient.address, 0, ethId, ethers.ZeroHash, recipient.address, 3600, ethers.parseUnits("1", 18), { value: gross })).wait();
    const rec = await lock.lockRecord(lockId);
    expect(rec.exists).to.equal(true);
    expect(rec.baseRecipient).to.equal(recipient.address);
    expect(await vclm.minterVerifier()).to.equal(predicted);
  });
});
