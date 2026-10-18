// Test-chain ceremony for the new main verifier (scripts/testChainCeremony.cjs).
// In-process Hardhat network only. Checks deploy wiring, the 15 registered
// readers (13 + Stellar and XRP Ledger), exactly 961 + 1 registry rows, a generated poster, a test Base ETH
// price, and finalize gates VF-DEP-010..014 by static call (not finalized).
const { expect } = require("chai");
const hre = require("hardhat");
const { ethers } = hre;
const { runCeremony, registryRows, stellarKey, xrplAccount, READY_EVM, READY_UTXO, READY_LEDGER, BLOCKED, STELLAR_PUBLIC_NETWORK, TEST_ETH_PRICE_USD18 } = require("../scripts/testChainCeremony.cjs");

const key = (env, id) => ethers.solidityPackedKeccak256(["string", "bytes32"], [env, id]);

describe("Test-chain ceremony: new main verifier", function () {
  this.timeout(600000);
  let c;

  before(async function () {
    c = await runCeremony(hre);
  });

  it("deploys VCLM, CHONX, Forge, Stake and the verifier wired to each other", async function () {
    expect(await c.verifier.vclmToken()).to.equal(await c.vclm.getAddress());
    expect(await c.verifier.chonxToken()).to.equal(await c.chonx.getAddress());
    expect(await c.forge.verifier()).to.equal(await c.verifier.getAddress());
    expect(await c.stake.verifier()).to.equal(await c.verifier.getAddress());
    expect(await c.verifier.deployer()).to.equal(c.deployer.address);
    expect(await c.verifier.configurationFinalized()).to.equal(false);
  });

  it("the test locks charge 5% on every duration including Handshake", async function () {
    for (const l of Object.values(c.locks)) {
      expect(await l.STANDARD_FEE_BPS()).to.equal(500n);
      expect((await l.interface.fragments.some((f) => f.name === "HANDSHAKE_FEE_BPS"))).to.equal(false);
    }
  });

  it("registers exactly the 15 ready readers (incl. Stellar and XRP Ledger) and not Solana", async function () {
    const envs = ["Base", ...READY_EVM.map((x) => x[0]), ...READY_UTXO.map((x) => x[0]), ...READY_LEDGER];
    expect(envs.length).to.equal(15);
    expect(Object.keys(c.readers).length).to.equal(15);
    expect(BLOCKED).to.deep.equal(["Solana"]);
    for (const env of envs) expect(await c.verifier.chainVerifiers(env)).to.equal(await c.readers[env].getAddress());
    for (const env of BLOCKED) expect(await c.verifier.chainVerifiers(env)).to.equal(ethers.ZeroAddress);
    expect(await c.readers.Base.vault()).to.equal(await c.locks.Base.getAddress());
    for (const [env] of READY_EVM) {
      expect(await c.readers[env].lock()).to.equal(await c.locks[env].getAddress());
      expect(await c.readers[env].environmentId()).to.equal(env);
    }
  });

  it("UTXO readers carry the Dev Fund scriptPubKey decoded from the representative deployment", async function () {
    expect(c.devFundScripts.Bitcoin).to.match(/^0x0014[0-9a-f]{40}$/);
    expect(c.devFundScripts.Litecoin).to.match(/^0x0014[0-9a-f]{40}$/);
    expect(c.devFundScripts.DigiByte).to.match(/^0x0014[0-9a-f]{40}$/);
    for (const env of ["Bitcoin Cash", "Dogecoin", "Zcash"]) expect(c.devFundScripts[env]).to.match(/^0x76a914[0-9a-f]{40}88ac$/);
    for (const [env] of READY_UTXO) expect(await c.readers[env].devFundScript()).to.equal(c.devFundScripts[env]);
  });

  it("Stellar and XRP Ledger readers carry the recorded Dev Funds, decoded and checksum-checked", async function () {
    const { rows } = require("../deployment/representativeBase.cjs");
    const df = Object.fromEntries(rows.map((r) => [r.environment, r.devFund]));
    expect(await c.readers.Stellar.devFundKey()).to.equal(stellarKey(df.Stellar));
    expect(await c.readers.Stellar.networkId()).to.equal(ethers.sha256(ethers.toUtf8Bytes(STELLAR_PUBLIC_NETWORK)));
    expect(await c.readers["XRP Ledger"].devFundAccount()).to.equal(xrplAccount(df["XRP Ledger"]));
    expect(c.ledgerDevFunds.Stellar).to.match(/^0x[0-9a-f]{64}$/);
    expect(c.ledgerDevFunds["XRP Ledger"]).to.match(/^0x[0-9a-f]{40}$/);
    // Decoder checks: the XRPL genesis account decodes to its published AccountID,
    // and a one-character change fails the checksum on both chains.
    expect(xrplAccount("rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh")).to.equal("0xb5f762798a53d543a014caf8b297cff8f2f937e8");
    const bump = (a, i) => a.slice(0, i) + (a[i] === "A" ? "B" : "A") + a.slice(i + 1);
    expect(() => stellarKey(bump(df.Stellar, 10))).to.throw();
    expect(() => xrplAccount(bump(df["XRP Ledger"], 10))).to.throw();
  });

  it("writes exactly the 961 existing rows plus the Base ETH row, nothing extra", async function () {
    const { written, baseEth } = registryRows();
    expect(written.length).to.equal(961);
    expect(c.all.length).to.equal(962);
    const keys = new Set(c.all.map((e) => key(e.environmentId, e.canonicalAssetId)));
    expect(keys.size).to.equal(962);
    for (const e of c.all) {
      const r = await c.verifier.assetPrecisionTable(key(e.environmentId, e.canonicalAssetId));
      expect(r.canonicalAssetId).to.equal(e.canonicalAssetId);
      expect(r.decimals).to.equal(BigInt(e.decimals));
    }
    expect(baseEth.environmentId).to.equal("Base");
    expect(baseEth.canonicalAssetId).to.equal(await c.verifier.BASE_NATIVE_ETH_ASSET_ID());
    // A row that is not in the file is not in the verifier.
    expect((await c.verifier.assetPrecisionTable(key("Base", ethers.id("not-a-row")))).canonicalAssetId).to.equal(ethers.ZeroHash);
    console.log("      registry gas:", c.registryGas.toString(), "in", Math.ceil(962 / 50), "batches");
  });

  it("uses a generated poster: only it can post; the test Base ETH price is usable; others are not", async function () {
    expect(await c.verifier.scheduledPricePoster()).to.equal(c.poster.address);
    expect(c.poster.address).to.not.equal(c.deployer.address);
    const sp = await c.verifier.scheduledPrices(key("Base", c.baseEth.canonicalAssetId));
    expect(sp.usable).to.equal(true);
    expect(sp.priceUsd18).to.equal(TEST_ETH_PRICE_USD18);
    const usdc = c.written.find((e) => e.symbol === "USDC");
    expect((await c.verifier.scheduledPrices(key(usdc.environmentId, usdc.canonicalAssetId))).usable).to.equal(false);
    await expect(c.verifier.applyScheduledPriceRun(2n, [])).to.be.revertedWith("VF-ORC-007: not price poster");
  });

  it("finalize gates VF-DEP-010..014 all pass (static call only; not finalized)", async function () {
    expect(await c.verifier.chainVerifiers("Base")).to.not.equal(ethers.ZeroAddress); // 010
    expect((await c.verifier.assetPrecisionTable(key("Base", c.baseEth.canonicalAssetId))).canonicalAssetId).to.not.equal(ethers.ZeroHash); // 011
    expect(await c.verifier.devFundDestinations("Base")).to.not.equal(ethers.ZeroAddress); // 012
    expect(await c.verifier.scheduledPricePoster()).to.not.equal(ethers.ZeroAddress); // 013
    expect((await c.verifier.scheduledPrices(key("Base", c.baseEth.canonicalAssetId))).usable).to.equal(true); // 014
    await c.verifier.finalize.staticCall();
    expect(await c.verifier.configurationFinalized()).to.equal(false);
  });

  it("refuses to run on any network other than the in-process Hardhat chain", async function () {
    await expect(runCeremony({ ...hre, network: { name: "base" } })).to.be.rejectedWith("REFUSED");
  });
});
