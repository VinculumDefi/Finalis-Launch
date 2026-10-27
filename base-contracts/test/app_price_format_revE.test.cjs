// App price handling against the Revision E Verifier (t452u), on the in-process test chain.
// The app modules (src/lib) are loaded as they ship. The Verifier is the one the ceremony
// builds. Checks: the app reads the 30-decimal format from the chain, values ETH, USDC and
// TigerOG exactly as the Verifier does, builds the real createNativeLock call, and its
// S1/S2/S3 issuance, $0.01 minimum and 5% fee match what the contracts do.
const { expect } = require("chai");
const { ethers, network } = require("hardhat");
const art = require("../scripts/deploy-pages/ceremony.json");
const DATA = require("../scripts/deploy-pages/ceremony-data.json");
const { runBaseCeremony } = require("../scripts/deploy-pages/baseCeremonyFlow.js");
const { toUsd30 } = require("../scripts/priceRun.cjs");

const DAY7 = 604800n;
const CLS = { 1: "S1", 2: "S2", 3: "S3" }; // the app keys multipliers by class name

const coder = ethers.AbiCoder.defaultAbiCoder();
const ETH = DATA.row2;
const TIGER = DATA.entries.find((e) => e.symbol === "TigerOG");
const USDC = DATA.entries.find((e) => e.symbol === "USDC_BASE");
const tokenOf = (e) => DATA.tokenAddresses.find((t) => t.canonicalAssetId === e.canonicalAssetId).token;
const P = { ETH: BigInt(DATA.priceUsd30), USDC: toUsd30("0.9998"), TIGER: toUsd30("7.35e-19") };

function pkg(lockId, rec, e, dest, recvDec) {
  return {
    sourceEnvironmentId: "Base", commitmentVaultLockId: lockId, handshakeAllowanceCount: 3,
    canonicalAssetId: e.canonicalAssetId, assetPrecision: recvDec, assetCustodyClass: e.custodyClass,
    grossAmountSmallestUnits: rec.gross, actualFeeAmountSmallestUnits: rec.fee, principalAmountSmallestUnits: rec.principal,
    feeAssetId: e.canonicalAssetId, devFundDestination: DATA.devFund, feeTransferEvidence: ethers.id("fee:" + lockId),
    valuationTimestamp: rec.createdAt, maturityTimestamp: rec.maturity, durationSecs: rec.duration,
    selectedOutputToken: rec.outputToken, baseRecipient: rec.baseRecipient, releaseDestination: dest,
    chonxActivationReceipt: "0x", racIdentity: ethers.id("rac:" + lockId), priceRecord: "0x", sourceFinalityProof: "0x",
    lockEventProof: coder.encode(["bytes32", "uint256", "uint256", "uint256", "uint256", "uint256", "uint256"],
      [lockId, rec.gross, rec.fee, rec.principal, rec.duration, rec.createdAt, rec.maturity]),
  };
}

describe("App price format against the Revision E Verifier (t452u)", function () {
  this.timeout(900000);
  let app, lockApp, eng, r, user, recipient, dest, poster, usdc, tiger, launch;

  before(async () => {
    app = await import("../../src/lib/vfPriceFormat.js");
    lockApp = await import("../../src/lib/vfBaseEthLock.js");
    eng = await import("../../src/lib/vfVerifierEngine.js");
    const [signer, u, rc, d] = await ethers.getSigners();
    user = u; recipient = rc; dest = d;
    r = await runBaseCeremony({ ethers, signer, art, data: DATA, log: () => {} });
    launch = await r.verifier.protocolLaunchTimestamp();
    await network.provider.send("hardhat_impersonateAccount", [DATA.scheduledPricePoster]);
    await network.provider.send("hardhat_setBalance", [DATA.scheduledPricePoster, "0x56BC75E2D63100000"]);
    poster = await ethers.getSigner(DATA.scheduledPricePoster);
    const f = await (await ethers.getContractFactory("TestFixtureERC20")).deploy(0);
    const code = await ethers.provider.getCode(await f.getAddress());
    for (const e of [USDC, TIGER]) await network.provider.send("hardhat_setCode", [tokenOf(e), code]);
    usdc = await ethers.getContractAt("TestFixtureERC20", tokenOf(USDC));
    tiger = await ethers.getContractAt("TestFixtureERC20", tokenOf(TIGER));
    await (await r.verifier.connect(poster).applyScheduledPriceRun((await r.verifier.lastScheduledRunId()) + 1n, [
      { environmentId: "Base", canonicalAssetId: ETH.canonicalAssetId, priceUsd30: P.ETH, success: true },
      { environmentId: "Base", canonicalAssetId: USDC.canonicalAssetId, priceUsd30: P.USDC, success: true },
      { environmentId: "Base", canonicalAssetId: TIGER.canonicalAssetId, priceUsd30: P.TIGER, success: true },
    ])).wait();
  });

  const keyOf = (e) => ethers.solidityPackedKeccak256(["string", "bytes32"], ["Base", e.canonicalAssetId]);

  it("the app reads the price format from the chain: 30 decimals for this Verifier", async () => {
    const addr = await r.verifier.getAddress();
    const read = async () => r.verifier.PRICE_SCALE();
    const res = await app.resolvePriceDecimals(addr, read);
    expect(res.ok).to.equal(true);
    expect(res.decimals).to.equal(30);
    expect(await r.verifier.PRICE_SCALE()).to.equal(10n ** 30n);
    // A contract without PRICE_SCALE() (the lock) is refused, as is any reader that throws.
    const noScale = new ethers.Contract(await r.lock.getAddress(), ["function PRICE_SCALE() view returns (uint256)"], ethers.provider);
    expect((await app.resolvePriceDecimals(await r.lock.getAddress(), () => noScale.PRICE_SCALE())).ok).to.equal(false);
    // The same contract with the floor reader too: it has no USD_STABLE_MIN_PRICE() either, so it stays refused.
    const noFloor = new ethers.Contract(await r.lock.getAddress(), ["function USD_STABLE_MIN_PRICE() view returns (uint256)"], ethers.provider);
    expect((await app.resolvePriceDecimals(await r.lock.getAddress(), () => noScale.PRICE_SCALE(), () => noFloor.USD_STABLE_MIN_PRICE())).ok).to.equal(false);
    // The Revision E Verifier answers PRICE_SCALE() = 1e30 and is accepted even when the floor reader is also given.
    const both = await app.resolvePriceDecimals(addr, read, () => r.verifier.USD_STABLE_MIN_PRICE());
    expect([both.ok, both.decimals]).to.deep.equal([true, 30]);
    // Stablecoin floor in the app equals the contract constant.
    expect(app.stableMinPrice(30)).to.equal(await r.verifier.USD_STABLE_MIN_PRICE());
  });

  it("display: the app shows the posted prices exactly (TigerOG 7.35e-19, USDC near $1, ETH)", async () => {
    const show = async (e) => app.formatPrice((await r.verifier.scheduledPrices(keyOf(e))).priceUsd30, 30);
    expect(await show(TIGER)).to.equal("0.000000000000000000735");
    expect(app.formatPriceCompact((await r.verifier.scheduledPrices(keyOf(TIGER))).priceUsd30, 30)).to.equal("7.35e-19");
    expect(await show(USDC)).to.equal("0.9998");
    expect(await show(ETH)).to.equal("2319.19");
  });

  it("ETH: the app builds the real createNativeLock call; the lock accepts it; S2 issuance and 5% fee match", async () => {
    const priceText = app.formatPrice(P.ETH, 30);
    const built = lockApp.buildCreateNativeLock({
      lockId: ethers.hexlify(ethers.randomBytes(32)), baseRecipient: recipient.address, releaseDestination: user.address,
      outputToken: "VCLM", durationSecs: Number(DAY7), grossEth: "0.01", priceUsd: priceText, priceDecimals: 30,
    });
    expect(built.ok, (built.errors || []).join()).to.equal(true);
    const tx = await user.sendTransaction({ to: await r.lock.getAddress(), data: built.call.data, value: built.call.value });
    await tx.wait();
    const rec = await r.lock.lockRecord(built.call.args.lockId);
    expect(rec.fee.toString()).to.equal(built.quote.fee); // 5%
    expect(rec.fee).to.equal((rec.gross * 500n) / 10000n);
    const usd = BigInt(built.call.args.verifiedGrossUsd);
    expect(usd).to.equal((rec.gross * P.ETH) / 10n ** 30n);
    const p = pkg(built.call.args.lockId, rec, ETH, user.address, 18);
    const before_ = await r.vclm.balanceOf(recipient.address);
    await (await r.verifier.recordFeeAndRac(p)).wait();
    await (await r.verifier.verifyAndMint(p, 0)).wait();
    const minted = (await r.vclm.balanceOf(recipient.address)) - before_;
    const appIssue = eng.computeIssuanceFromUsd(usd, 0, CLS[ETH.custodyClass], DAY7, 0).output;
    expect(minted).to.equal(appIssue);
    expect(minted).to.equal(await r.verifier.previewIssuance(usd, 0, ETH.custodyClass, DAY7, 0));
  });

  it("$0.01 minimum: the app accepts exactly $0.01 (the chain records it) and refuses one wei less", async () => {
    // Smallest wei worth at least $0.01 at the ETH price.
    const min = (10n ** 16n * 10n ** 30n + P.ETH - 1n) / P.ETH;
    const eth = (w) => ethers.formatEther(w);
    const at = lockApp.buildCreateNativeLock({ lockId: ethers.hexlify(ethers.randomBytes(32)), baseRecipient: recipient.address, releaseDestination: user.address,
      outputToken: "VCLM", durationSecs: Number(DAY7), grossEth: eth(min), priceUsd: app.formatPrice(P.ETH, 30), priceDecimals: 30 });
    expect(at.ok, (at.errors || []).join()).to.equal(true);
    await (await user.sendTransaction({ to: await r.lock.getAddress(), data: at.call.data, value: at.call.value })).wait();
    const rec = await r.lock.lockRecord(at.call.args.lockId);
    await (await r.verifier.recordFeeAndRac(pkg(at.call.args.lockId, rec, ETH, user.address, 18))).wait();
    const below = lockApp.buildCreateNativeLock({ lockId: ethers.hexlify(ethers.randomBytes(32)), baseRecipient: recipient.address, releaseDestination: user.address,
      outputToken: "VCLM", durationSecs: Number(DAY7), grossEth: eth(min - 1n), priceUsd: app.formatPrice(P.ETH, 30), priceDecimals: 30 });
    expect(below.ok).to.equal(false);
    expect(below.errors.join()).to.match(/below \$0\.01/);
  });

  for (const [name, e, price, dec, tok, amount] of [
    ["USDC (S1, 6 decimals, about $1)", USDC, P.USDC, 6, () => usdc, 25_000_000n],
    ["TigerOG (S3, 9 decimals, 7.35e-19)", TIGER, P.TIGER, 9, () => tiger, 2n * 10n ** 27n],
  ]) {
    it(`${name}: the app's value, fee and issuance equal the Verifier's`, async () => {
      const token = tok();
      const usd = app.valueUsd18(amount, dec, price, 30);
      expect(usd).to.equal((amount * price) / 10n ** BigInt(dec + 12));
      await (await token.mint(user.address, amount)).wait();
      await (await token.connect(user).approve(await r.lock.getAddress(), amount)).wait();
      const lockId = ethers.hexlify(ethers.randomBytes(32));
      await (await r.lock.connect(user).createErc20Lock(lockId, recipient.address, 0, e.canonicalAssetId, ethers.ZeroHash, dest.address,
        DAY7, tokenOf(e), amount, usd)).wait();
      const rec = await r.lock.lockRecord(lockId);
      expect(rec.fee).to.equal((amount * 500n) / 10000n);
      const p = pkg(lockId, rec, e, dest.address, dec);
      const before = await r.vclm.balanceOf(recipient.address);
      await (await r.verifier.recordFeeAndRac(p)).wait();
      await (await r.verifier.verifyAndMint(p, 0)).wait();
      const minted = (await r.vclm.balanceOf(recipient.address)) - before;
      const appIssue = eng.computeIssuanceFromUsd(usd, 0, CLS[e.custodyClass], DAY7, 0).output;
      expect(minted).to.equal(appIssue);
      expect(minted).to.equal(await r.verifier.previewIssuance(usd, 0, e.custodyClass, DAY7, 0));
      expect(minted > 0n).to.equal(true);
    });
  }

  it("S1, S2 and S3 multipliers are 1.5x, 1.3x and 1.0x in the app and in the Verifier", async () => {
    const usd = 10n ** 18n;
    const out = {};
    for (const c of [1, 2, 3]) {
      out[c] = eng.computeIssuanceFromUsd(usd, 0, CLS[c], DAY7, 0).output;
      expect(out[c]).to.equal(await r.verifier.previewIssuance(usd, 0, c, DAY7, 0));
    }
    expect((out[1] * 10000n) / out[3]).to.equal(15000n);
    expect((out[2] * 10000n) / out[3]).to.equal(13000n);
  });
});
