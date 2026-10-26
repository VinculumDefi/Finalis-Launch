// The Base deploy page's flow (scripts/deploy-pages/baseCeremonyFlow.js, the
// same code base.html runs), driven on the in-process Hardhat chain with the
// real ceremony.json and ceremony-data.json. Nothing is broadcast.
// Base-only launch (t357u): one reader (Base), the Base subset of registry
// Revision D (t430u: 129 Base rows, 128 Base token addresses; row 454
// USDC_BASE is S1).
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

  it("registers the Base subset of Revision D only: 129 rows, 128 token addresses, no non-Base row", async () => {
    expect(data.registryRows).to.equal(589);
    expect(data.entries.length).to.equal(129);
    expect(data.tokenAddresses.length).to.equal(128);
    expect(data.assetRowAliases.length).to.equal(0);
    for (const e of data.entries) {
      const k = ethers.solidityPackedKeccak256(["string", "bytes32"], [e.environmentId, e.canonicalAssetId]);
      expect((await r.verifier.assetPrecisionTable(k)).canonicalAssetId, e.symbol).to.equal(e.canonicalAssetId);
    }
    const { resolveCeremonyRegistry } = require("../scripts/deploy-pages/resolveAssetRegistry.cjs");
    const nonBase = resolveCeremonyRegistry().entries.filter((e) => e.environmentId !== "Base");
    expect(nonBase.length).to.equal(589 - 129);
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

  it("Base USDC (row 454) is registered as S1 and a USDC lock mints at 1.5x the S3 amount (t367u)", async () => {
    // Runs last: posts price run 2. Test chain only; the poster is impersonated.
    const { network } = require("hardhat");
    const row = data.entries.find((e) => e.row === 454);
    expect(row.symbol).to.equal("USDC_BASE");
    const k = ethers.solidityPackedKeccak256(["string", "bytes32"], ["Base", row.canonicalAssetId]);
    expect((await r.verifier.assetPrecisionTable(k)).custodyClass).to.equal(1n);
    const USDC = ethers.getAddress(data.tokenAddresses.find((t) => t.canonicalAssetId === row.canonicalAssetId).token);
    const F = await (await ethers.getContractFactory("TestFixtureERC20")).deploy(0);
    await network.provider.send("hardhat_setCode", [USDC, await ethers.provider.getCode(await F.getAddress())]);
    const usdc = await ethers.getContractAt("TestFixtureERC20", USDC);
    const [, user] = await ethers.getSigners();
    const amt = 1000n * 10n ** 6n;
    await (await usdc.mint(user.address, amt)).wait();
    const posterAddr = await r.verifier.scheduledPricePoster();
    await network.provider.send("hardhat_impersonateAccount", [posterAddr]);
    await network.provider.send("hardhat_setBalance", [posterAddr, "0x56BC75E2D63100000"]);
    const poster = await ethers.getSigner(posterAddr);
    await (await r.verifier.connect(poster).applyScheduledPriceRun(2n, [{ success: true, environmentId: "Base", canonicalAssetId: row.canonicalAssetId, priceUsd18: 10n ** 18n }])).wait();
    await network.provider.send("hardhat_stopImpersonatingAccount", [posterAddr]);
    await (await usdc.connect(user).approve(await r.lock.getAddress(), amt)).wait();
    const lockId = ethers.id("flow:usdc-s1");
    const dur = 604800n;
    await (await r.lock.connect(user).createErc20Lock(lockId, user.address, 0, row.canonicalAssetId, ethers.ZeroHash, user.address, dur, USDC, amt, amt * 10n ** 12n)).wait();
    const rec = await r.lock.lockRecord(lockId);
    const coder = ethers.AbiCoder.defaultAbiCoder();
    const pkg = {
      sourceEnvironmentId: "Base", commitmentVaultLockId: lockId, handshakeAllowanceCount: 0,
      canonicalAssetId: row.canonicalAssetId, assetPrecision: 6, assetCustodyClass: 1,
      grossAmountSmallestUnits: rec.gross, actualFeeAmountSmallestUnits: rec.fee, principalAmountSmallestUnits: rec.principal,
      feeAssetId: row.canonicalAssetId, devFundDestination: "dev", feeTransferEvidence: ethers.id("fee:" + lockId),
      valuationTimestamp: rec.createdAt, maturityTimestamp: rec.maturity, durationSecs: rec.duration,
      selectedOutputToken: 0, baseRecipient: user.address, releaseDestination: "release",
      chonxActivationReceipt: "0x", racIdentity: ethers.id("rac:" + lockId), priceRecord: "0x", sourceFinalityProof: "0x",
      lockEventProof: coder.encode(["bytes32", "uint256", "uint256", "uint256", "uint256", "uint256", "uint256"],
        [lockId, rec.gross, rec.fee, rec.principal, rec.duration, rec.createdAt, rec.maturity]),
    };
    const v0 = await r.vclm.balanceOf(user.address);
    await (await r.verifier.connect(user).recordFeeAndRac(pkg)).wait();
    await (await r.verifier.connect(user).verifyAndMint(pkg, 0)).wait();
    const minted = (await r.vclm.balanceOf(user.address)) - v0;
    // The Verifier's own mint math at the same USD (gross at $1.00, 18 decimals), output, duration and day.
    const launch = await r.verifier.protocolLaunchTimestamp();
    const days = rec.createdAt > launch ? (rec.createdAt - launch) / 86400n : 0n;
    const usd = rec.gross * 10n ** 12n;
    const asS1 = await r.verifier.previewIssuance(usd, 0, 1, dur, days);
    const asS3 = await r.verifier.previewIssuance(usd, 0, 3, dur, days);
    expect(minted).to.equal(asS1);
    expect((minted * 10000n) / asS3).to.equal(15000n);
    console.log(`      Base USDC row 454: custodyClass 1; 1000 USDC 7-day lock minted ${ethers.formatEther(minted)} VCLM vs ${ethers.formatEther(asS3)} at S3 = ${(minted * 10000n) / asS3} bps`);
  });
});
