// Local Hardhat only. Refuses old 2.5% HANDSHAKE_FEE_BPS bytecode, retired
// addresses, wrong environmentId labels; accepts main CommitmentVaultLock.
const { expect } = require("chai");
const { ethers } = require("hardhat");
const data = require("../scripts/deploy-pages/ceremony-data.json");
const {
  verifyNonBaseLock,
  verifyAllNonBaseLocks,
  checkInputs,
  EVM_ENVS,
  CVL_RUNTIME_HASH,
  maskedCodeHash,
} = require("../scripts/deploy-pages/baseCeremonyFlow.js");

describe("non-Base lock guard (local Hardhat)", function () {
  this.timeout(120000);
  let signer, provider, mainLocks, oldFeeLock;

  before(async () => {
    [signer] = await ethers.getSigners();
    provider = ethers.provider;
    const Main = await ethers.getContractFactory("CommitmentVaultLock");
    mainLocks = {};
    for (const env of EVM_ENVS) {
      mainLocks[env] = await (await Main.deploy(env, data.evmDevFunds[env])).getAddress();
    }
    const Old = await ethers.getContractFactory("OldHandshakeFeeLock");
    oldFeeLock = await (await Old.deploy("Ethereum", data.evmDevFunds.Ethereum)).getAddress();
  });

  it("accepts a correct main CommitmentVaultLock on every env", async () => {
    const providers = Object.fromEntries(EVM_ENVS.map((e) => [e, provider]));
    const results = await verifyAllNonBaseLocks(ethers, providers, mainLocks, data);
    expect(results).to.have.length(6);
    for (const r of results) {
      expect(r.runtimeHash.toLowerCase()).to.equal(CVL_RUNTIME_HASH.toLowerCase());
      expect(r.environmentId).to.equal(r.env);
      expect(r.devFund).to.equal(ethers.getAddress(data.evmDevFunds[r.env]));
    }
  });

  it("refuses the old 2.5% HANDSHAKE_FEE_BPS bytecode", async () => {
    // Confirm fixture really exposes 250
    const old = await ethers.getContractAt("OldHandshakeFeeLock", oldFeeLock);
    expect(await old.HANDSHAKE_FEE_BPS()).to.equal(250n);
    const code = await provider.getCode(oldFeeLock);
    expect(maskedCodeHash(ethers, code).toLowerCase()).to.not.equal(CVL_RUNTIME_HASH.toLowerCase());

    await expect(
      verifyNonBaseLock(ethers, provider, "Ethereum", oldFeeLock, {
        expectedDevFund: data.evmDevFunds.Ethereum,
        expectedRuntimeHash: CVL_RUNTIME_HASH,
        oldLocks: data.oldLocks,
      })
    ).to.be.rejectedWith(/HANDSHAKE_FEE_BPS\(\)=250|masked runtime hash/);
  });

  it("refuses a retired address (0x5AB4 / 0x4eDE) even before eth_getCode", async () => {
    expect(data.oldLocks.map((a) => a.toLowerCase())).to.include(
      "0x5ab40cdd51036ea88889c26e182b2936ddf76a8a"
    );
    const me = signer.address;
    expect(() =>
      checkInputs(ethers, data, { ...mainLocks, Ethereum: "0x5AB40cdD51036EA88889c26E182b2936Ddf76a8A" }, me)
    ).to.throw(/old 2.5% lock/);

    await expect(
      verifyNonBaseLock(ethers, provider, "Ethereum", "0x5AB40cdD51036EA88889c26E182b2936Ddf76a8A", {
        expectedDevFund: data.evmDevFunds.Ethereum,
        expectedRuntimeHash: CVL_RUNTIME_HASH,
        oldLocks: data.oldLocks,
      })
    ).to.be.rejectedWith(/retired 2\.5% Handshake lock/);
  });

  it("refuses a wrong chain label in slot 0", async () => {
    // Deploy a correct main lock but with environmentId "Arbitrum", then claim it is Ethereum.
    const Main = await ethers.getContractFactory("CommitmentVaultLock");
    const wrongLabel = await (await Main.deploy("Arbitrum", data.evmDevFunds.Ethereum)).getAddress();
    await expect(
      verifyNonBaseLock(ethers, provider, "Ethereum", wrongLabel, {
        expectedDevFund: data.evmDevFunds.Ethereum,
        expectedRuntimeHash: CVL_RUNTIME_HASH,
        oldLocks: data.oldLocks,
      })
    ).to.be.rejectedWith(/slot 0 environmentId is "Arbitrum"/);
  });
});
