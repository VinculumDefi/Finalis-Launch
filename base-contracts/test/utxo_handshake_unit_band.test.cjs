// t238u: Bitcoin, Bitcoin Cash and Litecoin native Handshakes (3600s) use a
// band in smallest units instead of the $0.01-$0.02 USD band:
//   Bitcoin 11,000-22,000 sats, Bitcoin Cash 11,000-22,000 sats,
//   Litecoin 110,000-220,000 litoshis (inclusive),
// and the USD used for their Handshake RAC and issuance is capped at $0.02.
// Every other chain (Ethereum and Dogecoin checked here) keeps the USD band,
// with results equal to the unchanged formulas. The fee must stay exactly 5%.
// In-process Hardhat network only, chain readers mocked. Nothing is broadcast.
const { expect } = require("chai");
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
const { finalizeCeremony } = require("./lib/finalizeCeremony.cjs");

const SCALE = 10n ** 18n;
const HOUR = 3600n;
const DAY7 = 604800n;
const DAY30 = 2592000n;
const CAP = 2n * 10n ** 16n; // $0.02
const coder = ethers.AbiCoder.defaultAbiCoder();
const nativeId = (env, asset) => ethers.solidityPackedKeccak256(["string", "string"], [env, asset]);

const REGISTRY = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "deployment", "assetRegistry.revB.json"), "utf8")).entries;
const row = (env) => REGISTRY.find((r) => r.environmentId === env && r.kind === "native");

// price is USD per whole coin (8 decimals for the UTXO coins, 18 for ETH).
const CHAINS = {
  Bitcoin: { asset: "native-BTC", symbol: "BTC", decimals: 8, allowance: 1, min: 11_000n, max: 22_000n, price: 82_465n * SCALE },
  "Bitcoin Cash": { asset: "native-BCH", symbol: "BCH", decimals: 8, allowance: 1, min: 11_000n, max: 22_000n, price: 27_823n * SCALE / 100n },
  Litecoin: { asset: "native-LTC", symbol: "LTC", decimals: 8, allowance: 1, min: 110_000n, max: 220_000n, price: 6_035n * SCALE / 100n },
  Dogecoin: { asset: "native-DOGE", symbol: "DOGE", decimals: 8, allowance: 1, price: SCALE / 10n },
  Ethereum: { asset: "native-ETH", symbol: "ETH", decimals: 18, allowance: 3, price: 2_500n * SCALE },
};
for (const [env, c] of Object.entries(CHAINS)) {
  c.id = row(env).canonicalAssetId;
  c.custodyClass = row(env).custodyClass;
}

const usdOf = (c, gross) => ((gross * SCALE) / 10n ** BigInt(c.decimals) * c.price) / SCALE;
const racOf = (usd, fee, gross) => (((usd * fee) / gross) * 6000n) / 10000n;

// Fix 2026-10-23 (AG-05/AG-06): packages carry a proven creation time one
// second after the latest price run, and the Valuation Timestamp equals it.
let CREATED = 1n;
async function markCreated() {
  CREATED = BigInt((await ethers.provider.getBlock("latest")).timestamp) + 1n;
}

let n = 0;
function pkg(env, gross, duration, recipient, { fee, tag, lockId } = {}) {
  const c = CHAINS[env];
  const f = fee === undefined ? (gross * 500n) / 10000n : fee;
  const principal = gross - f;
  const id = lockId || ethers.id(`${env}-${duration}-${gross}-${tag || n++}`);
  return {
    sourceEnvironmentId: env, commitmentVaultLockId: id, handshakeAllowanceCount: c.allowance,
    canonicalAssetId: c.id, assetPrecision: c.decimals, assetCustodyClass: c.custodyClass,
    grossAmountSmallestUnits: gross, actualFeeAmountSmallestUnits: f, principalAmountSmallestUnits: principal,
    feeAssetId: c.id, devFundDestination: "dev", feeTransferEvidence: ethers.id("fee"),
    valuationTimestamp: CREATED, maturityTimestamp: 2n, durationSecs: duration, selectedOutputToken: 0,
    baseRecipient: recipient, releaseDestination: "release", chonxActivationReceipt: "0x",
    racIdentity: ethers.keccak256(ethers.concat([id, "0x01"])), priceRecord: "0x", sourceFinalityProof: "0x",
    lockEventProof: coder.encode(
      ["bytes32", "uint256", "uint256", "uint256", "uint256", "uint256", "uint256", "address", "uint8", "bytes32"],
      [id, gross, f, principal, duration, CREATED, 2n, recipient, 0, c.id]
    ),
  };
}

async function fixture() {
  const [deployer, recipient] = await ethers.getSigners();
  const Token = await ethers.getContractFactory("VinculumFinalisToken");
  const vclm = await Token.deploy("Vinculum", "VCLM", 10n ** 30n);
  const chonx = await Token.deploy("Chonx", "CHONX", 10n ** 30n);
  const verifier = await (await ethers.getContractFactory("VinculumFinalisVerifier")).deploy(await vclm.getAddress(), await chonx.getAddress());
  const mock = await (await ethers.getContractFactory("MockAlwaysFinalizedVerifier")).deploy();
  const t0 = (await ethers.provider.getBlock("latest")).timestamp;
  const stake = await (await ethers.getContractFactory("VinculumFinalisStake")).deploy(
    await vclm.getAddress(), await chonx.getAddress(), await vclm.getAddress(), await verifier.getAddress());
  await vclm.initialize(await verifier.getAddress(), await stake.getAddress());
  await chonx.initialize(await verifier.getAddress(), ethers.ZeroAddress);
  for (const [env, c] of Object.entries(CHAINS)) {
    await verifier.registerAssetPrecision(env, c.id, c.symbol, c.decimals, c.custodyClass, 0);
    await verifier.registerChainVerifier(env, await mock.getAddress());
    await verifier.configureDevFund(env, deployer.address);
  }
  await verifier.setScheduledPricePoster(deployer.address);
  await finalizeCeremony(verifier);
  await verifier.applyScheduledPriceRun(2n, Object.entries(CHAINS).map(([env, c]) => (
    { environmentId: env, canonicalAssetId: c.id, priceUsd18: c.price, success: true })));
  await markCreated();
  return { verifier, vclm, recipient };
}

// Records RAC, mints, and checks RAC and VCLM equal the expected USD basis.
async function acceptAndCheck(ctx, p, expectedUsd) {
  const { verifier, vclm, recipient } = ctx;
  const c = CHAINS[p.sourceEnvironmentId];
  await verifier.recordFeeAndRac(p);
  expect(await verifier.racCredits(await verifier.racKey(p.sourceEnvironmentId, p.commitmentVaultLockId))).to.equal(racOf(expectedUsd, p.actualFeeAmountSmallestUnits, p.grossAmountSmallestUnits));
  const before = await vclm.balanceOf(recipient.address);
  await verifier.verifyAndMint(p, 0);
  const minted = (await vclm.balanceOf(recipient.address)) - before;
  expect(minted).to.equal(await verifier.previewIssuance(expectedUsd, 0, c.custodyClass, p.durationSecs, 0));
  expect(minted).to.be.greaterThan(0n);
  return minted;
}

describe("t238u: BTC/BCH/LTC Handshake unit band and $0.02 issuance cap", function () {
  let ctx;
  before(async function () { ctx = await fixture(); });

  it("constants: bands and native ids match the readers and the Revision B registry rows", async function () {
    const v = ctx.verifier;
    expect(await v.BTC_HANDSHAKE_MIN_UNITS()).to.equal(11_000n);
    expect(await v.BTC_HANDSHAKE_MAX_UNITS()).to.equal(22_000n);
    expect(await v.BCH_HANDSHAKE_MIN_UNITS()).to.equal(11_000n);
    expect(await v.BCH_HANDSHAKE_MAX_UNITS()).to.equal(22_000n);
    expect(await v.LTC_HANDSHAKE_MIN_UNITS()).to.equal(110_000n);
    expect(await v.LTC_HANDSHAKE_MAX_UNITS()).to.equal(220_000n);
    for (const [getter, env, asset, reader] of [["BTC_NATIVE_ASSET_ID", "Bitcoin", "native-BTC", "BitcoinLockReader"],
      ["BCH_NATIVE_ASSET_ID", "Bitcoin Cash", "native-BCH", "BitcoinCashLockReader"], ["LTC_NATIVE_ASSET_ID", "Litecoin", "native-LTC", "LitecoinLockReader"]]) {
      const id = await v[getter]();
      expect(id).to.equal(nativeId(env, asset));
      expect(id).to.equal(row(env).canonicalAssetId);
      const r = await (await ethers.getContractFactory(reader)).deploy("0x76a914" + "11".repeat(20) + "88ac");
      expect(await r.nativeAssetId()).to.equal(id);
    }
    // 5% of the minimum is exactly the P2PKH dust limit or above (546 / 546 / 5,460).
    expect((11_000n * 500n) / 10000n).to.be.at.least(546n);
    expect((110_000n * 500n) / 10000n).to.be.at.least(5_460n);
  });

  for (const env of ["Bitcoin", "Bitcoin Cash", "Litecoin"]) {
    describe(env, function () {
      const c = CHAINS[env];

      it(`Handshake at min (${c.min}) and max (${c.max}) accepted, exact 5% fee, RAC and issuance on the $0.02-capped USD`, async function () {
        for (const g of [c.min, c.max]) {
          const p = pkg(env, g, HOUR, ctx.recipient.address);
          expect(p.actualFeeAmountSmallestUnits).to.equal((g * 500n) / 10000n);
          expect(usdOf(c, g)).to.be.greaterThan(CAP); // above $0.02 at these prices, so the cap applies
          await acceptAndCheck(ctx, p, CAP);
        }
      });

      it("min-1 and max+1 refused with a unit-band error, in recordFeeAndRac and in verifyAndMint", async function () {
        await expect(ctx.verifier.recordFeeAndRac(pkg(env, c.min - 1n, HOUR, ctx.recipient.address)))
          .to.be.revertedWith("VF-COM-003: handshake gross below unit band");
        await expect(ctx.verifier.recordFeeAndRac(pkg(env, c.max + 1n, HOUR, ctx.recipient.address)))
          .to.be.revertedWith("VF-COM-003: handshake gross above unit band");
        // verifyAndMint checks the band itself: reuse the lock id of a recorded RAC
        // (RAC is keyed by the proven lock since fix 2026-10-23, AG-04).
        const ok = pkg(env, c.min, HOUR, ctx.recipient.address);
        await ctx.verifier.recordFeeAndRac(ok);
        for (const [g, msg] of [[c.min - 1n, "below"], [c.max + 1n, "above"]]) {
          const bad = pkg(env, g, HOUR, ctx.recipient.address, { lockId: ok.commitmentVaultLockId });
          await expect(ctx.verifier.verifyAndMint(bad, 0)).to.be.revertedWith(`VF-COM-003: handshake gross ${msg} unit band`);
        }
      });

      it("a non-5% fee is still refused inside the band", async function () {
        const g = c.min + 1000n;
        const exact = (g * 500n) / 10000n;
        for (const fee of [exact + 1n, exact - 1n, (g * 250n) / 10000n]) {
          await expect(ctx.verifier.recordFeeAndRac(pkg(env, g, HOUR, ctx.recipient.address, { fee })))
            .to.be.revertedWith("VF-COM-011: fee != floor(gross * bps / 10000)");
        }
      });

      it("below $0.02 the actual USD is used (the cap only lowers, never raises)", async function () {
        // Fresh verifier with a low price so the band minimum is under $0.02.
        const low = await fixture();
        const price = c.decimals === 8 ? (env === "Litecoin" ? SCALE / 100n : SCALE) : SCALE; // LTC $0.01, BTC/BCH $1
        await low.verifier.applyScheduledPriceRun(3n, [{ environmentId: env, canonicalAssetId: c.id, priceUsd18: price, success: true }]);
        await markCreated();
        const saved = c.price; c.price = price;
        try {
          const p = pkg(env, c.min, HOUR, low.recipient.address);
          const usd = usdOf(c, c.min);
          expect(usd).to.be.lessThan(CAP);
          await acceptAndCheck(low, p, usd);
        } finally { c.price = saved; }
      });

      it("non-Handshake durations unchanged: USD path, $0.01 minimum, uncapped issuance", async function () {
        for (const d of [DAY7, DAY30]) {
          const g = 100_000n * (env === "Litecoin" ? 10n : 1n);
          const usd = usdOf(c, g);
          expect(usd).to.be.greaterThan(CAP);
          await acceptAndCheck(ctx, pkg(env, g, d, ctx.recipient.address), usd);
        }
        // A standard lock outside the Handshake unit band is not refused by it.
        await acceptAndCheck(ctx, pkg(env, c.max * 10n, DAY7, ctx.recipient.address), usdOf(c, c.max * 10n));
        // The standard USD floor still applies: the smallest gross with a nonzero
        // fee (20 units) is under $0.01 for BCH and LTC at these prices (BTC 20 sats
        // is about $0.016, so for BTC use a fresh $1 price on a separate verifier).
        let v = ctx.verifier;
        if (usdOf(c, 20n) >= 10n ** 16n) {
          v = (await fixture()).verifier;
          await v.applyScheduledPriceRun(3n, [{ environmentId: env, canonicalAssetId: c.id, priceUsd18: SCALE, success: true }]);
          await markCreated();
        }
        await expect(v.recordFeeAndRac(pkg(env, 20n, DAY7, ctx.recipient.address)))
          .to.be.revertedWith("VF-COM-009: standard USD below $0.01");
      });
    });
  }

  for (const env of ["Ethereum", "Dogecoin"]) {
    describe(`${env} (unchanged USD band)`, function () {
      const c = CHAINS[env];
      // gross for a target USD: usd18 * 10^decimals / price
      const grossFor = (usd18) => (usd18 * 10n ** BigInt(c.decimals)) / c.price;

      it("Handshake inside $0.01-$0.02 accepted with the actual USD (no cap effect)", async function () {
        for (const usd18 of [10n ** 16n, 15n * 10n ** 15n, CAP]) {
          const g = grossFor(usd18);
          const usd = usdOf(c, g);
          expect(usd).to.be.within(10n ** 16n, CAP);
          await acceptAndCheck(ctx, pkg(env, g, HOUR, ctx.recipient.address), usd);
        }
      });

      it("Handshake outside $0.01-$0.02 refused with the original error, even at BTC-style unit amounts", async function () {
        for (const g of [grossFor(10n ** 16n) - 10n ** BigInt(c.decimals - 6), grossFor(CAP) + 10n ** BigInt(c.decimals - 6), 11_000n, 22_000n, 110_000n]) {
          const usd = usdOf(c, g);
          if (usd >= 10n ** 16n && usd <= CAP) continue;
          await expect(ctx.verifier.recordFeeAndRac(pkg(env, g, HOUR, ctx.recipient.address)))
            .to.be.revertedWith("VF-COM-003: handshake USD outside $0.01-$0.02");
        }
      });

      it("standard lock unchanged: uncapped issuance", async function () {
        const g = grossFor(25n * SCALE);
        await acceptAndCheck(ctx, pkg(env, g, DAY30, ctx.recipient.address), usdOf(c, g));
      });
    });
  }

  it("the unit band is keyed on the native asset id AND the environment: a mismatched pair keeps the USD band", async function () {
    // Bitcoin Cash environment carrying a non-native asset id: no unit band, the USD band applies.
    const [deployer, recipient] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("VinculumFinalisToken");
    const vclm = await Token.deploy("V", "V", 10n ** 30n);
    const chonx = await Token.deploy("C", "C", 10n ** 30n);
    const v = await (await ethers.getContractFactory("VinculumFinalisVerifier")).deploy(await vclm.getAddress(), await chonx.getAddress());
    const mock = await (await ethers.getContractFactory("MockAlwaysFinalizedVerifier")).deploy();
    const t0 = (await ethers.provider.getBlock("latest")).timestamp;
    const stake = await (await ethers.getContractFactory("VinculumFinalisStake")).deploy(await vclm.getAddress(), await chonx.getAddress(), await vclm.getAddress(), await v.getAddress());
    await vclm.initialize(await v.getAddress(), await stake.getAddress());
    await chonx.initialize(await v.getAddress(), ethers.ZeroAddress);
    const otherId = ethers.id("BCH"); // not keccak("Bitcoin Cash","native-BCH")
    await v.registerAssetPrecision("Bitcoin Cash", otherId, "BCH", 8, 3, 0);
    await v.registerChainVerifier("Bitcoin Cash", await mock.getAddress());
    await v.configureDevFund("Bitcoin Cash", deployer.address);
    await v.setScheduledPricePoster(deployer.address);
    await finalizeCeremony(v);
    await v.applyScheduledPriceRun(2n, [{ environmentId: "Bitcoin Cash", canonicalAssetId: otherId, priceUsd18: CHAINS["Bitcoin Cash"].price, success: true }]);
    await markCreated();
    const p = { ...pkg("Bitcoin Cash", 11_000n, HOUR, recipient.address) };
    const id = p.commitmentVaultLockId;
    p.canonicalAssetId = otherId; p.feeAssetId = otherId;
    p.lockEventProof = coder.encode(["bytes32", "uint256", "uint256", "uint256", "uint256", "uint256", "uint256", "address", "uint8", "bytes32"],
      [id, 11_000n, 550n, 10_450n, HOUR, CREATED, 2n, recipient.address, 0, otherId]);
    await expect(v.recordFeeAndRac(p)).to.be.revertedWith("VF-COM-003: handshake USD outside $0.01-$0.02");
  });
});
