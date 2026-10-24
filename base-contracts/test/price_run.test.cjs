// Price-run script (scripts/priceRun.cjs) on the in-process test chain, posted
// as the live poster address by impersonation (no key). Nothing goes live.
const { expect } = require("chai");
const hre = require("hardhat");
const { ethers } = hre;
const { buildPriceRun, toUsd18, calldata, nextRunId, postOnTestChain } = require("../scripts/priceRun.cjs");
const art = require("../scripts/deploy-pages/ceremony.json");
const data = require("../scripts/deploy-pages/ceremony-data.json");
const { runBaseCeremony } = require("../scripts/deploy-pages/baseCeremonyFlow.js");
const LIVE = require("../deployment/liveConfig.json");

const key = (env, id) => ethers.solidityPackedKeccak256(["string", "bytes32"], [env, id]);

describe("Price run for the live poster (test chain)", function () {
  this.timeout(600000);
  let v;
  const eth = data.row2.canonicalAssetId;
  // Base-only launch (t357u): every registered row is a Base row.
  const other = data.entries.find((e) => e.canonicalAssetId.toLowerCase() !== eth.toLowerCase());
  const third = data.entries.find((e) => e.canonicalAssetId.toLowerCase() !== eth.toLowerCase() && e !== other);
  const nonBase = require("../scripts/deploy-pages/resolveAssetRegistry.cjs").resolveCeremonyRegistry().entries.find((e) => e.environmentId !== "Base");

  before(async () => {
    const [signer] = await ethers.getSigners();
    v = (await runBaseCeremony({ ethers, signer, art, data })).verifier; // ends with poster = live poster
  });

  it("converts decimal prices exactly, with no floating point", () => {
    expect(toUsd18("2500.123456789012345678")).to.equal(2500123456789012345678n);
    expect(toUsd18("0.000001")).to.equal(10n ** 12n);
    expect(toUsd18(3)).to.equal(3n * 10n ** 18n);
    for (const bad of [null, "", "abc", "-1", "0"]) expect(toUsd18(bad)).to.equal(0n);
  });

  it("builds success lines for fetched prices, failure lines for misses, and skips unknown assets", () => {
    const r = buildPriceRun([
      { environmentId: "Base", canonicalAssetId: eth, usd: "2500.5" },
      { environmentId: other.environmentId, canonicalAssetId: other.canonicalAssetId, usd: "1.25" },
      { environmentId: third.environmentId, canonicalAssetId: third.canonicalAssetId, usd: null },
      { environmentId: "Nowhere", canonicalAssetId: ethers.ZeroHash, usd: "9" },
      { environmentId: nonBase.environmentId, canonicalAssetId: nonBase.canonicalAssetId, usd: "9" },
    ], 2);
    expect(r.poster).to.equal(LIVE.scheduledPricePoster);
    expect(r.updates.map((u) => u.success)).to.deep.equal([true, true, false]);
    expect(r.updates[0].priceUsd18).to.equal(25005n * 10n ** 17n);
    expect(r.skipped.map((x) => x.environmentId)).to.deep.equal(["Nowhere", nonBase.environmentId]); // not registered on the Base-only launch
    expect(calldata(r).slice(0, 10)).to.equal(v.interface.getFunction("applyScheduledPriceRun").selector);
  });

  it("refuses run numbers below 2 and duplicate assets", () => {
    const line = { environmentId: "Base", canonicalAssetId: eth, usd: "1" };
    expect(() => buildPriceRun([line], 1)).to.throw(/2 or higher/);
    expect(() => buildPriceRun([line], 0)).to.throw(/2 or higher/);
    expect(() => buildPriceRun([line, line], 2)).to.throw(/duplicate/);
  });

  it("posts run 2 as the live poster on the test chain; prices become usable / unusable", async () => {
    expect(await nextRunId(v)).to.equal(2n);
    const r = buildPriceRun([
      { environmentId: "Base", canonicalAssetId: eth, usd: "2600" },
      { environmentId: other.environmentId, canonicalAssetId: other.canonicalAssetId, usd: "1.25" },
      { environmentId: third.environmentId, canonicalAssetId: third.canonicalAssetId, usd: null },
    ], await nextRunId(v));
    await postOnTestChain(hre, v, r);
    expect(await v.lastScheduledRunId()).to.equal(2n);
    const a = await v.scheduledPrices(key("Base", eth));
    expect(a.usable).to.equal(true); expect(a.priceUsd18).to.equal(2600n * 10n ** 18n);
    expect((await v.scheduledPrices(key(other.environmentId, other.canonicalAssetId))).priceUsd18).to.equal(125n * 10n ** 16n);
    expect((await v.scheduledPrices(key(third.environmentId, third.canonicalAssetId))).usable).to.equal(false);
    expect(await nextRunId(v)).to.equal(3n);
  });

  it("the Verifier rejects a reused run number and any sender but the poster", async () => {
    const r = buildPriceRun([{ environmentId: "Base", canonicalAssetId: eth, usd: "1" }], 2);
    await expect(postOnTestChain(hre, v, r)).to.be.revertedWith("VF-ORC-001: run id must be the next in sequence");
    const [, stranger] = await ethers.getSigners();
    await expect(v.connect(stranger).applyScheduledPriceRun(3, r.updates)).to.be.revertedWith("VF-ORC-007: not price poster");
  });
});
