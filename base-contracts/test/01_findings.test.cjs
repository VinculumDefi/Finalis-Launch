const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deploySystem } = require("./00_smoke.test.cjs");

const ZERO = "0x0000000000000000000000000000000000000000";
const DAY = 86400n;
const D30 = 30n * DAY, D60 = 60n * DAY, D90 = 90n * DAY, D120 = 120n * DAY;

// Spec Master Revision 6 §10.1 — staking duration multipliers.
const SPEC_10_1_DURATION_BPS = { [D30]: 10000n, [D60]: 14000n, [D90]: 17500n, [D120]: 20000n };

// After finalization the only minters are the Verifier and (for VCLM) Stake.
// Tests obtain tokens by impersonating the Verifier — the same path production
// uses. There is deliberately no back door; that is the point of CL-02.
async function mintAs(token, verifierAddr, to, amount) {
  await ethers.provider.send("hardhat_impersonateAccount", [verifierAddr]);
  await ethers.provider.send("hardhat_setBalance", [verifierAddr, "0x56BC75E2D63100000"]);
  const signer = await ethers.getSigner(verifierAddr);
  await token.connect(signer).mint(to, amount);
  await ethers.provider.send("hardhat_stopImpersonatingAccount", [verifierAddr]);
}

describe("CL-04 · stake duration multipliers must match §10.1", function () {
  for (const [secs, expected] of Object.entries(SPEC_10_1_DURATION_BPS)) {
    it(`duration ${Number(secs) / 86400}d multiplier is ${Number(expected) / 10000}x`, async function () {
      const { vclm, stake, verifier, deployer } = await deploySystem();
      const amt = 1000n * 10n ** 18n;
      await mintAs(vclm, await verifier.getAddress(), deployer.address, amt);
      await vclm.approve(await stake.getAddress(), amt);
      await stake.createPosition(0, 100n * 10n ** 18n, BigInt(secs));
      const pos = await stake.positions(0);
      expect(pos.multiplierBps).to.equal(expected);
    });
  }
});

describe("CL-02 · VF-IMM-001/VF-DEP-006: authority terminated at finalization", function () {
  it("initialize() cannot be called twice", async function () {
    const { vclm, verifier, stake } = await deploySystem();
    await expect(
      vclm.initialize(await verifier.getAddress(), await stake.getAddress())
    ).to.be.revertedWith("VF-DEP-006: already finalized");
  });

  it("deployer address is zeroed - authority irreversibly terminated", async function () {
    const { vclm, chonx, synthToken } = await deploySystem();
    expect(await vclm.deployer()).to.equal(ZERO);
    expect(await chonx.deployer()).to.equal(ZERO);
    expect(await synthToken.deployer()).to.equal(ZERO);
  });

  it("finalized flag is independently verifiable on-chain (VF-DEP-007)", async function () {
    const { vclm, chonx, synthToken } = await deploySystem();
    expect(await vclm.finalized()).to.equal(true);
    expect(await chonx.finalized()).to.equal(true);
    expect(await synthToken.finalized()).to.equal(true);
  });

  it("no address can seize minting after finalization", async function () {
    const { vclm } = await deploySystem();
    const attacker = (await ethers.getSigners())[1];
    await expect(
      vclm.connect(attacker).initialize(attacker.address, attacker.address)
    ).to.be.reverted;
    await expect(
      vclm.connect(attacker).mint(attacker.address, 1000n)
    ).to.be.revertedWith("VFT: not minter");
    expect(await vclm.balanceOf(attacker.address)).to.equal(0n);
  });

  it("the original deployer has no residual minting power", async function () {
    const { vclm, deployer } = await deploySystem();
    await expect(
      vclm.mint(deployer.address, 1000n)
    ).to.be.revertedWith("VFT: not minter");
  });

  it("setMinter no longer exists", async function () {
    const { vclm } = await deploySystem();
    expect(vclm.setMinter).to.equal(undefined);
  });
});

describe("CL-07 · stake contract can mint epoch rewards", function () {
  it("stake contract is an authorized VCLM minter", async function () {
    const { vclm, stake } = await deploySystem();
    expect(await vclm.minterStake()).to.equal(await stake.getAddress());
  });

  it("verifier is also an authorized VCLM minter", async function () {
    const { vclm, verifier } = await deploySystem();
    expect(await vclm.minterVerifier()).to.equal(await verifier.getAddress());
  });

  it("VF-STK-004: stake has no CHONX minting privilege", async function () {
    const { chonx } = await deploySystem();
    expect(await chonx.minterStake()).to.equal(ZERO);
  });
});

describe("CL-03 · §10.1 token multipliers (VCLM 1.0x / CHONX 2.0x / SYNTH 4.0x)", function () {
  const AMT = 100n * 10n ** 18n;

  async function weightFor(tokenId) {
    const { vclm, chonx, synthToken, stake, verifier, deployer } = await deploySystem();
    const tok = tokenId === 0 ? vclm : tokenId === 1 ? chonx : synthToken;
    await mintAs(tok, await verifier.getAddress(), deployer.address, AMT);
    await tok.approve(await stake.getAddress(), AMT);
    await stake.createPosition(tokenId, AMT, D30);
    return await stake.getPositionWeight(0);
  }

  it("VCLM weight at 30d is amount x 1.0 x 1.0", async function () {
    expect(await weightFor(0)).to.equal(AMT);
  });

  it("CHONX weight is exactly twice VCLM at equal amount and duration", async function () {
    expect(await weightFor(1)).to.equal((await weightFor(0)) * 2n);
  });

  it("SYNTH weight is exactly four times VCLM at equal amount and duration", async function () {
    expect(await weightFor(2)).to.equal((await weightFor(0)) * 4n);
  });
});

describe("CL-14 · VF-STK-025 expired position cannot backdate over a gap", function () {
  it("queueExtension reverts once the position has expired", async function () {
    const { vclm, stake, verifier, deployer } = await deploySystem();
    const AMT = 100n * 10n ** 18n;
    await mintAs(vclm, await verifier.getAddress(), deployer.address, AMT);
    await vclm.approve(await stake.getAddress(), AMT);
    await stake.createPosition(0, AMT, D30);
    await ethers.provider.send("evm_increaseTime", [Number(D30) + 86400]);
    await ethers.provider.send("evm_mine", []);
    await expect(stake.queueExtension(0, D30)).to.be.revertedWith("VF-STK-025: position not active");
  });
});

// ---------------------------------------------------------------------------
// CL-02 remainder — Verifier, Synth, Stake authority removal (W1)
// ---------------------------------------------------------------------------
describe("CL-02 · Verifier: deployment ceremony closes irreversibly", function () {
  it("registerChainVerifier is unreachable after finalization", async function () {
    const { verifier, deployer } = await deploySystem();
    await expect(
      verifier.registerChainVerifier("base", deployer.address)
    ).to.be.revertedWith("VF-DEP-003: configuration finalized");
  });

  it("registerAssetPrecision is unreachable after finalization", async function () {
    const { verifier } = await deploySystem();
    const id = ethers.zeroPadValue("0x01", 32);
    await expect(
      verifier.registerAssetPrecision("base", id, "TEST", 18, 1, 1)
    ).to.be.revertedWith("VF-DEP-003: configuration finalized");
  });

  it("configureDevFund is unreachable after finalization", async function () {
    const { verifier, deployer } = await deploySystem();
    await expect(
      verifier.configureDevFund("base", deployer.address)
    ).to.be.revertedWith("VF-DEP-003: configuration finalized");
  });

  it("finalize() cannot be called twice", async function () {
    const { verifier } = await deploySystem();
    await expect(verifier.finalize()).to.be.revertedWith("VF-DEP-003: configuration finalized");
  });

  it("verifier deployer is zeroed - authority terminated (VF-DEP-006)", async function () {
    const { verifier } = await deploySystem();
    expect(await verifier.deployer()).to.equal(ZERO);
  });

  it("finalized flag is publicly readable (VF-DEP-007)", async function () {
    const { verifier } = await deploySystem();
    expect(await verifier.configurationFinalized()).to.equal(true);
  });

  it("no attacker can install a chain verifier that validates forged locks", async function () {
    const { verifier } = await deploySystem();
    const attacker = (await ethers.getSigners())[1];
    await expect(
      verifier.connect(attacker).registerChainVerifier("base", attacker.address)
    ).to.be.reverted;
  });

  it("VF-DEP-002: a zero chain verifier cannot be registered", async function () {
    const [deployer] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("VinculumFinalisToken");
    const v = await ethers.getContractFactory("VinculumFinalisVerifier");
    const a = await Token.deploy("A", "A", 1n);
    const b = await Token.deploy("B", "B", 1n);
    const fresh = await v.deploy(await a.getAddress(), await b.getAddress());
    await expect(
      fresh.registerChainVerifier("base", ZERO)
    ).to.be.revertedWith("VF-DEP-002: zero chain verifier");
  });
});

describe("CL-02 · Synth and Stake carry no authority", function () {
  it("Synth setVerifier no longer exists", async function () {
    const { synth } = await deploySystem();
    expect(synth.setVerifier).to.equal(undefined);
  });

  it("Synth setTokenContracts no longer exists", async function () {
    const { synth } = await deploySystem();
    expect(synth.setTokenContracts).to.equal(undefined);
  });

  it("Synth burn targets are immutable", async function () {
    const { synth, vclm, chonx } = await deploySystem();
    expect(await synth.vclmToken()).to.equal(await vclm.getAddress());
    expect(await synth.chonxToken()).to.equal(await chonx.getAddress());
  });

  it("Stake exposes no authority address (CL-29)", async function () {
    const { stake } = await deploySystem();
    expect(stake.authority).to.equal(undefined);
  });
});

describe("VF-DEP-001 · issuance inactive until finalization", function () {
  it("verifyAndMint reverts before the ceremony is closed", async function () {
    const [deployer] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("VinculumFinalisToken");
    const V = await ethers.getContractFactory("VinculumFinalisVerifier");
    const a = await Token.deploy("A", "A", 10n ** 30n);
    const b = await Token.deploy("B", "B", 10n ** 30n);
    const fresh = await V.deploy(await a.getAddress(), await b.getAddress());
    expect(await fresh.configurationFinalized()).to.equal(false);
  });
});
