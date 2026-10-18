// The Base deploy page's flow (scripts/deploy-pages/baseCeremonyFlow.js, the
// same code base.html runs), driven on the in-process Hardhat chain with the
// real ceremony.json and ceremony-data.json. Nothing is broadcast.
const { expect } = require("chai");
const { ethers } = require("hardhat");
const art = require("../scripts/deploy-pages/ceremony.json");
const data = require("../scripts/deploy-pages/ceremony-data.json");
const { runBaseCeremony, checkInputs, EVM_ENVS } = require("../scripts/deploy-pages/baseCeremonyFlow.js");

describe("Base deploy page flow: 15 readers, Forge and Stake, before finalize", function () {
  this.timeout(600000);
  let r, signer, newLocks;

  before(async () => {
    [signer] = await ethers.getSigners();
    // Stand-ins for the six new 5% locks (made by the six non-Base pages live).
    const L = new ethers.ContractFactory(art.CommitmentVaultLock.abi, art.CommitmentVaultLock.bytecode, signer);
    newLocks = {};
    for (const env of EVM_ENVS) newLocks[env] = await (await L.deploy(env, data.evmDevFunds[env])).getAddress();
    r = await runBaseCeremony({ ethers, signer, art, data, newLocks });
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

  it("registers all 15 readers (Base + 14 others) and not Solana", async () => {
    expect(Object.keys(r.readers).length).to.equal(15);
    for (const [env, c] of Object.entries(r.readers)) expect(await r.verifier.chainVerifiers(env)).to.equal(await c.getAddress());
    expect(await r.verifier.chainVerifiers("Solana")).to.equal(ethers.ZeroAddress);
  });

  it("wires each reader to its live lock or Dev Fund", async () => {
    expect(await r.readers.Base.vault()).to.equal(await r.lock.getAddress());
    for (const env of EVM_ENVS) expect(await r.readers[env].lock()).to.equal(newLocks[env]);
    for (const u of data.readers.utxo) expect(await r.readers[u.env].devFundScript()).to.equal(u.devFundScript);
    expect(await r.readers.Stellar.devFundKey()).to.equal(data.readers.stellar.devFundKey);
    expect(await r.readers.Stellar.networkId()).to.equal(ethers.sha256(ethers.toUtf8Bytes("Public Global Stellar Network ; September 2015")));
    expect(await r.readers["XRP Ledger"].devFundAccount()).to.equal(data.readers.xrpl.devFundAccount);
    for (const [env, a] of Object.entries(data.evmDevFunds)) expect(await r.verifier.devFundDestinations(env)).to.equal(ethers.getAddress(a));
  });

  it("finalizes with the live poster, run 1 used, and nothing can be registered afterwards", async () => {
    expect(await r.verifier.configurationFinalized()).to.equal(true);
    expect(await r.verifier.scheduledPricePoster()).to.equal(ethers.getAddress(data.scheduledPricePoster));
    expect(await r.verifier.lastScheduledRunId()).to.equal(1n);
    await expect(r.verifier.registerChainVerifier("Solana", signer.address)).to.be.reverted;
  });

  it("refuses before sending: old 2.5% lock, missing lock, lock equal to the poster", async () => {
    const me = signer.address;
    expect(() => checkInputs(ethers, data, { ...newLocks, Ethereum: data.oldLocks[1] }, me)).to.throw(/old 2.5% lock/);
    const { Avalanche, ...five } = newLocks;
    expect(() => checkInputs(ethers, data, five, me)).to.throw(/Avalanche lock address missing/);
    expect(() => checkInputs(ethers, data, { ...newLocks, Polygon: data.scheduledPricePoster }, me)).to.throw(/clashes/);
    expect(() => checkInputs(ethers, { ...data, readers: { ...data.readers, utxo: data.readers.utxo.slice(1) } }, newLocks, me)).to.throw(/reader wiring/);
  });
});
