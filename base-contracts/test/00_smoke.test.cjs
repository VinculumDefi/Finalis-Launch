const { expect } = require("chai");
const { ethers } = require("hardhat");

// W0 SMOKE TEST — proves the harness can deploy the system.
// Asserts nothing about protocol correctness. If this is red, nothing else matters.

const VCLM_HARD_CAP  = 10_000_000_000n * 10n ** 18n; // 10B
const CHONX_HARD_CAP = 100_000_000_000n * 10n ** 18n; // 100B
const SYNTH_HARD_CAP = 10_000_000n * 10n ** 18n;      // 10M

async function deploySystem() {
  const [deployer] = await ethers.getSigners();

  const Token = await ethers.getContractFactory("VinculumFinalisToken");
  const vclm  = await Token.deploy("Vinculum", "VCLM", VCLM_HARD_CAP);
  const chonx = await Token.deploy("Chonx", "CHONX", CHONX_HARD_CAP);
  const synthToken = await Token.deploy("Synth", "SYNTH", SYNTH_HARD_CAP);

  // CL-01: the price publisher key is immutable and set at construction.
  const pricePublisher = (await ethers.getSigners())[9];
  const launchTs = (await ethers.provider.getBlock("latest")).timestamp;

  const Verifier = await ethers.getContractFactory("VinculumFinalisVerifier");
  const verifier = await Verifier.deploy(
    await vclm.getAddress(),
    await chonx.getAddress(),
    pricePublisher.address,
    launchTs
  );

  const Synth = await ethers.getContractFactory("VinculumFinalisSynth");
  const synth = await Synth.deploy(
    await verifier.getAddress(),
    await vclm.getAddress(),
    await chonx.getAddress()
  );

  // CL-05/CL-25: constructor now requires T0.
  const launchTimestamp = (await ethers.provider.getBlock("latest")).timestamp;
  const Stake = await ethers.getContractFactory("VinculumFinalisStake");
  const stake = await Stake.deploy(
    await vclm.getAddress(),
    await chonx.getAddress(),
    await synthToken.getAddress(),
    await verifier.getAddress(),
    launchTimestamp
  );

  // VF-DEP-004/006: one-shot initialization, then authority is gone.
  // VF-STK-004: only VCLM has a stake minter; CHONX/SYNTH pass address(0).
  const ZERO = "0x0000000000000000000000000000000000000000";
  await vclm.initialize(await verifier.getAddress(), await stake.getAddress());
  await chonx.initialize(await verifier.getAddress(), ZERO);
  await synthToken.initialize(await verifier.getAddress(), ZERO);

  // VF-DEP-001: deployment ceremony — configure, then close it permanently.
  await verifier.configureDevFund("base", "devfund.source.address");
  await verifier.finalize();

  return { deployer, vclm, chonx, synthToken, verifier, synth, stake, launchTimestamp, pricePublisher };
}

module.exports = { deploySystem, VCLM_HARD_CAP, CHONX_HARD_CAP, SYNTH_HARD_CAP };

describe("W0 · harness smoke", function () {
  it("deploys every contract in the system", async function () {
    const s = await deploySystem();
    for (const [name, c] of Object.entries(s)) {
      if (name === "deployer" || name === "launchTimestamp") continue;
      expect(await c.getAddress()).to.properAddress;
    }
  });

  it("tokens report their configured hard caps", async function () {
    const { vclm, chonx, synthToken } = await deploySystem();
    expect(await vclm.hardCap()).to.equal(VCLM_HARD_CAP);
    expect(await chonx.hardCap()).to.equal(CHONX_HARD_CAP);
    expect(await synthToken.hardCap()).to.equal(SYNTH_HARD_CAP);
  });
});
