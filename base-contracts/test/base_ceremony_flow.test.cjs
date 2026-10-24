// The Base deploy page's flow (scripts/deploy-pages/baseCeremonyFlow.js, the
// same code base.html runs), driven on the in-process Hardhat chain with the
// real ceremony.json and ceremony-data.json. Nothing is broadcast.
// Base-only launch (t357u): one reader (Base), the Base subset of Revision B.
const { expect } = require("chai");
const { ethers } = require("hardhat");
const art = require("../scripts/deploy-pages/ceremony.json");
const data = require("../scripts/deploy-pages/ceremony-data.json");
const { runBaseCeremony, checkInputs } = require("../scripts/deploy-pages/baseCeremonyFlow.js");
const { NON_BASE_ENVS } = require("../scripts/applyCeremonyAddresses.cjs");

describe("Base deploy page flow (Base-only): one reader, Forge and Stake, before finalize", function () {
  this.timeout(600000);
  let r, signer;

  before(async () => {
    [signer] = await ethers.getSigners();
    r = await runBaseCeremony({ ethers, signer, art, data });
  });

  it("deploys Forge and Stake, Stake on from the start", async () => {
    const v = await r.verifier.getAddress();
    expect(await r.forge.verifier()).to.equal(v);
    expect(await r.stake.verifier()).to.equal(v);
    expect(await r.vclm.minterVerifier()).to.equal(v);
    expect(await r.vclm.minterStake()).to.equal(await r.stake.getAddress());
    expect(await r.chonx.minterVerifier()).to.equal(v);
    expect(await r.chonx.minterStake()).to.equal(ethers.ZeroAddress);
    expect(await r.stake.launchTimestamp()).to.equal(r.launch);
  });

  it("registers exactly one reader (Base) and no other environment", async () => {
    expect(Object.keys(r.readers)).to.deep.equal(["Base"]);
    expect(await r.verifier.chainVerifiers("Base")).to.equal(await r.readers.Base.getAddress());
    expect(NON_BASE_ENVS.length).to.equal(15);
    for (const env of [...NON_BASE_ENVS, "Tron", "Cardano"]) expect(await r.verifier.chainVerifiers(env), env).to.equal(ethers.ZeroAddress);
  });

  it("binds the Base reader to the Base lock; only the Base Dev Fund is set", async () => {
    expect(await r.readers.Base.vault()).to.equal(await r.lock.getAddress());
    expect(await r.verifier.devFundDestinations("Base")).to.equal(ethers.getAddress(data.devFund));
    for (const env of NON_BASE_ENVS) expect(await r.verifier.devFundDestinations(env), env).to.equal(ethers.ZeroAddress);
  });

  it("registers the Base subset of Revision B only: 27 rows, 26 token addresses, no non-Base row", async () => {
    expect(data.registryRows).to.equal(487);
    expect(data.entries.length).to.equal(27);
    expect(data.tokenAddresses.length).to.equal(26);
    expect(data.assetRowAliases.length).to.equal(0);
    for (const e of data.entries) {
      const k = ethers.solidityPackedKeccak256(["string", "bytes32"], [e.environmentId, e.canonicalAssetId]);
      expect((await r.verifier.assetPrecisionTable(k)).canonicalAssetId, e.symbol).to.equal(e.canonicalAssetId);
    }
    const { resolveCeremonyRegistry } = require("../scripts/deploy-pages/resolveAssetRegistry.cjs");
    const nonBase = resolveCeremonyRegistry().entries.filter((e) => e.environmentId !== "Base");
    expect(nonBase.length).to.equal(487 - 27);
    for (const e of nonBase.slice(0, 40)) {
      const k = ethers.solidityPackedKeccak256(["string", "bytes32"], [e.environmentId, e.canonicalAssetId]);
      expect((await r.verifier.assetPrecisionTable(k)).canonicalAssetId, e.environmentId + " " + e.symbol).to.equal(ethers.ZeroHash);
    }
  });

  it("finalizes with the live poster, run 1 used, and nothing can be registered afterwards", async () => {
    expect(await r.verifier.configurationFinalized()).to.equal(true);
    expect(await r.verifier.scheduledPricePoster()).to.equal(ethers.getAddress(data.scheduledPricePoster));
    expect(await r.verifier.lastScheduledRunId()).to.equal(1n);
    await expect(r.verifier.registerChainVerifier("Ethereum", signer.address)).to.be.reverted;
  });

  it("refuses before sending: non-Base rows, aliases, extra readers, non-Base Dev Funds, poster clashes", async () => {
    const me = signer.address;
    expect(checkInputs(ethers, data, me).livePoster).to.equal(ethers.getAddress(data.scheduledPricePoster));
    const nb = { ...data.entries[0], environmentId: "Ethereum" };
    expect(() => checkInputs(ethers, { ...data, entries: [...data.entries, nb] }, me)).to.throw(/non-Base registry row/);
    expect(() => checkInputs(ethers, { ...data, tokenAddresses: [...data.tokenAddresses, { ...data.tokenAddresses[0], environmentId: "Polygon" }] }, me)).to.throw(/non-Base token address/);
    expect(() => checkInputs(ethers, { ...data, assetRowAliases: [{ environmentId: "Polygon" }] }, me)).to.throw(/aliases/);
    expect(() => checkInputs(ethers, { ...data, readers: { ...data.readers, evm: [] } }, me)).to.throw(/reader wiring/);
    expect(() => checkInputs(ethers, { ...data, evmDevFunds: { ...data.evmDevFunds, Ethereum: data.devFund } }, me)).to.throw(/Dev Fund wiring/);
    expect(() => checkInputs(ethers, data, data.scheduledPricePoster)).to.throw(/equals the connected wallet/);
  });
});
