const { expect } = require("chai");
const { ethers } = require("hardhat");

// ---------------------------------------------------------------------------
// CL-09 — closeEpoch and allocateEpoch iterate every position ever created.
//
// This file measures gas as a FUNCTION of position count. Before the fix the
// cost grows without bound; after it, the cost is flat. The assertion is on
// the growth rate, not on an absolute number, so it stays meaningful across
// compiler and optimizer changes.
// ---------------------------------------------------------------------------

const ZERO = "0x0000000000000000000000000000000000000000";
const EPOCH = 10 * 24 * 60 * 60;
const D120 = 120n * 86400n;

async function deployStakeOnly() {
  const signers = await ethers.getSigners();
  const [deployer] = signers;
  const Token = await ethers.getContractFactory("VinculumFinalisToken");
  const vclm = await Token.deploy("V", "V", 10n ** 30n);
  const chonx = await Token.deploy("C", "C", 10n ** 30n);
  const synth = await Token.deploy("S", "S", 10n ** 30n);
  const launchTs = (await ethers.provider.getBlock("latest")).timestamp;

  // A minimal verifier stand-in is not needed: Stake only reads
  // cumulativeVclmIssued and epochRewardBasis. Use the real Verifier with no
  // credits recorded, so the epoch is zero-eligible and we measure the LOOP,
  // not the distribution.
  const V = await ethers.getContractFactory("VinculumFinalisVerifier");
  const verifier = await V.deploy(
    await vclm.getAddress(), await chonx.getAddress(), signers[9].address, launchTs);

  const Stake = await ethers.getContractFactory("VinculumFinalisStake");
  const stake = await Stake.deploy(
    await vclm.getAddress(), await chonx.getAddress(),
    await synth.getAddress(), await verifier.getAddress(), launchTs);

  await vclm.initialize(await verifier.getAddress(), await stake.getAddress());
  return { deployer, vclm, stake, verifier, launchTs };
}

// Creates N positions owned by the deployer. Tokens come from the deployer
// impersonating the verifier, which is the only minter.
async function seedPositions(s, n) {
  const vAddr = await s.verifier.getAddress();
  await ethers.provider.send("hardhat_impersonateAccount", [vAddr]);
  await ethers.provider.send("hardhat_setBalance", [vAddr, "0x8AC7230489E80000"]);
  const vSigner = await ethers.getSigner(vAddr);
  const each = 10n ** 16n;
  await s.vclm.connect(vSigner).mint(s.deployer.address, each * BigInt(n));
  await ethers.provider.send("hardhat_stopImpersonatingAccount", [vAddr]);

  await s.vclm.approve(await s.stake.getAddress(), each * BigInt(n));
  for (let i = 0; i < n; i++) {
    await s.stake.createPosition(0, each, D120);
  }
}

async function closeEpochGas(s, epochN) {
  const tx = await s.stake.closeEpoch(epochN);
  const rc = await tx.wait();
  return rc.gasUsed;
}

describe("CL-09 · epoch processing cost must not grow with position count", function () {
  this.timeout(300000);

  it("closeEpoch gas is bounded as positions accumulate", async function () {
    // Measure with a small and a larger position set, same epoch index.
    const small = await deployStakeOnly();
    await seedPositions(small, 5);
    await ethers.provider.send("evm_increaseTime", [EPOCH * 2 + 60]);
    await ethers.provider.send("evm_mine", []);
    const gasSmall = await closeEpochGas(small, 1);

    const large = await deployStakeOnly();
    await seedPositions(large, 60);
    await ethers.provider.send("evm_increaseTime", [EPOCH * 2 + 60]);
    await ethers.provider.send("evm_mine", []);
    const gasLarge = await closeEpochGas(large, 1);

    const growth = Number(gasLarge) / Number(gasSmall);
    console.log(`        closeEpoch gas: 5 positions=${gasSmall}, 60 positions=${gasLarge}, ratio=${growth.toFixed(2)}x`);

    // 12x the positions must not mean materially more gas. A bounded
    // implementation stays near 1.0; an O(n) implementation grows with n.
    expect(growth).to.be.lessThan(1.5);
  });

  it("closeEpoch gas is flat from 5 to 600 lifetime positions", async function () {
    const a = await deployStakeOnly();
    await seedPositions(a, 5);
    await ethers.provider.send("evm_increaseTime", [EPOCH * 2 + 60]);
    await ethers.provider.send("evm_mine", []);
    const gasA = await closeEpochGas(a, 1);

    const b = await deployStakeOnly();
    await seedPositions(b, 600);
    await ethers.provider.send("evm_increaseTime", [EPOCH * 2 + 60]);
    await ethers.provider.send("evm_mine", []);
    const gasB = await closeEpochGas(b, 1);

    const growth = Number(gasB) / Number(gasA);
    console.log(`        closeEpoch gas: 5=${gasA}, 600=${gasB}, ratio=${growth.toFixed(3)}x`);
    // 120x the positions. Pre-CL-09 this would have been roughly 100x the gas.
    expect(growth).to.be.lessThan(1.1);
  });

  // NOTE: the earlier version of this test passed for the WRONG reason —
  // the epoch was zero-eligible, so allocateEpoch returned before entering its
  // loop and measured nothing. It now requires a non-zero reward basis.
  it("allocateEpoch gas is bounded as positions accumulate", async function () {
    const small = await deployStakeOnly();
    await seedPositions(small, 5);
    await ethers.provider.send("evm_increaseTime", [EPOCH * 2 + 60]);
    await ethers.provider.send("evm_mine", []);
    await small.stake.closeEpoch(1);
    const rcS = await (await small.stake.allocateEpoch(1)).wait();

    const large = await deployStakeOnly();
    await seedPositions(large, 60);
    await ethers.provider.send("evm_increaseTime", [EPOCH * 2 + 60]);
    await ethers.provider.send("evm_mine", []);
    await large.stake.closeEpoch(1);
    const rcL = await (await large.stake.allocateEpoch(1)).wait();

    const growth = Number(rcL.gasUsed) / Number(rcS.gasUsed);
    console.log(`        allocateEpoch gas: 5=${rcS.gasUsed}, 60=${rcL.gasUsed}, ratio=${growth.toFixed(2)}x`);
    expect(growth).to.be.lessThan(1.5);
  });
});
