const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deploySystem } = require("./00_smoke.test.cjs");

// CL-11 — allowance is a property of the environment, never of the package.
//
// SCOPE NOTE: end-to-end consumption (first/second/third/fourth handshake)
// requires a full valid ProofPackage, which needs a mock chain verifier that
// does not yet exist. These tests cover the registry and its gates. The
// consumption path is asserted once MockChainVerifier lands — tracked as a
// known gap, not as coverage.

describe("CL-11 · VF-COM-006 handshake allowance registry", function () {
  async function freshVerifier() {
    const [deployer] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("VinculumFinalisToken");
    const V = await ethers.getContractFactory("VinculumFinalisVerifier");
    const a = await Token.deploy("A", "A", 10n ** 30n);
    const b = await Token.deploy("B", "B", 10n ** 30n);
    const pp = (await ethers.getSigners())[9];
    const ts = (await ethers.provider.getBlock("latest")).timestamp;
    return await V.deploy(await a.getAddress(), await b.getAddress(), pp.address, ts);
  }

  it("registers a one-use mechanism", async function () {
    const v = await freshVerifier();
    await v.registerHandshakeAllowance("Bitcoin", 1);
    expect(await v.handshakeAllowanceByEnvironment("Bitcoin")).to.equal(1);
  });

  it("registers a three-use mechanism", async function () {
    const v = await freshVerifier();
    await v.registerHandshakeAllowance("Solana", 3);
    expect(await v.handshakeAllowanceByEnvironment("Solana")).to.equal(3);
  });

  it("VF-COM-006: rejects any allowance other than 1 or 3", async function () {
    const v = await freshVerifier();
    for (const bad of [0, 2, 4, 255]) {
      await expect(
        v.registerHandshakeAllowance("Nowhere", bad)
      ).to.be.revertedWith("VF-COM-006: allowance must be 1 or 3");
    }
  });

  it("an unregistered environment reports zero", async function () {
    const v = await freshVerifier();
    expect(await v.handshakeAllowanceByEnvironment("Unregistered")).to.equal(0);
  });

  it("allowance cannot be registered after finalization", async function () {
    const { verifier } = await deploySystem();
    await expect(
      verifier.registerHandshakeAllowance("Solana", 3)
    ).to.be.revertedWith("VF-DEP-003: configuration finalized");
  });

  it("allowance cannot be changed by a stranger during the ceremony", async function () {
    const v = await freshVerifier();
    const attacker = (await ethers.getSigners())[1];
    await expect(
      v.connect(attacker).registerHandshakeAllowance("Solana", 3)
    ).to.be.revertedWith("VF: not deployer");
  });

  it("the package field is no longer consulted anywhere in enforcement", async function () {
    // Structural assertion: the only read of an allowance in the enforcement
    // path is from the registry. This guards against reintroduction.
    const fs = require("fs");
    const src = fs.readFileSync(__dirname + "/../contracts/VinculumFinalisVerifier.sol", "utf8");
    const enforcement = src.slice(src.indexOf("Step 8:"), src.indexOf("Step 9:"));
    // Strip comments — the field is named in explanatory comments on purpose.
    const code = enforcement
      .split("\n")
      .filter((l) => !l.trim().startsWith("//"))
      .join("\n");
    expect(code).to.include("handshakeAllowanceByEnvironment");
    expect(code).to.not.include("pkg.handshakeAllowanceCount");
  });
});
