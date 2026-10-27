// Live configuration (deployment/liveConfig.json): the live price poster.
// Reads repository files only and uses the in-process Hardhat chain for the
// hand-over check. Sends nothing live.
const { expect } = require("chai");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const hre = require("hardhat");
const { ethers } = hre;

const BC = path.resolve(__dirname, "..");
const ROOT = path.resolve(BC, "..");
const LIVE = require("../deployment/liveConfig.json");
// VF-ORC-016: posted prices are USD per whole token with 30 decimals.
const P30 = (usd18) => BigInt(usd18) * 10n ** 12n;
const EXPECTED_POSTER = "0x60013cD1aF9e81B083aa13eCDe5F491771db0DB4";
const lc = (a) => a.toLowerCase();

describe("Live configuration: price poster", function () {
  this.timeout(300000);
  const ceremonyData = JSON.parse(fs.readFileSync(path.join(BC, "scripts/deploy-pages/ceremony-data.json"), "utf8"));

  it("records the operator's live price poster, checksummed, on Base", function () {
    expect(LIVE.chainId).to.equal(8453);
    expect(LIVE.scheduledPricePoster).to.equal(EXPECTED_POSTER);
    expect(ethers.getAddress(LIVE.scheduledPricePoster)).to.equal(LIVE.scheduledPricePoster);
    expect(ceremonyData.scheduledPricePoster).to.equal(EXPECTED_POSTER);
  });

  it("differs from every Dev Fund, lock, release and deployed-contract address recorded in the repo", function () {
    const { EVM_DEV_FUND, rows } = require("../deployment/representativeBase.cjs");
    const named = new Set([lc(EVM_DEV_FUND), lc(ceremonyData.devFund), ...ceremonyData.oldLocks.map(lc),

      ...rows.map((r) => r.devFund).filter((a) => /^0x[0-9a-fA-F]{40}$/.test(a)).map(lc)]);
    for (const f of ["app/base44-lock-2026-10-12/src/lib/protocolConfig.js", "app/base44-lock-2026-10-13/src/lib/protocolConfig.js", "src/lib/vfBaseRegistry.js"]) {
      for (const a of fs.readFileSync(path.join(ROOT, f), "utf8").match(/0x[0-9a-fA-F]{40}\b/g) || []) named.add(lc(a));
    }
    expect(named.size).to.be.greaterThan(5);
    expect(named.has(lc(EXPECTED_POSTER))).to.equal(false);
    // Repo-wide: the address appears only where it is configured or asserted.
    const hits = execFileSync("git", ["grep", "--untracked", "-il", EXPECTED_POSTER.slice(2)], { cwd: ROOT, encoding: "utf8" }).trim().split("\n").sort();
    const allowed = ["base-contracts/deployment/liveConfig.json", "base-contracts/deployment/ceremony-manifest.json", "base-contracts/scripts/deploy-pages/ceremony-data.json", "base-contracts/test/live_config.test.cjs"];
    // archive/ holds read-only historical copies (for example Master Specification
    // Revision 11, archived in 49936f9) that quote the poster; they are not config.
    for (const h of hits) if (!h.startsWith("archive/")) expect(allowed).to.include(h);
    expect(hits).to.include("base-contracts/deployment/liveConfig.json");
  });

  it("the test-chain ceremony does not read the live config (it keeps its generated poster)", function () {
    const src = fs.readFileSync(path.join(BC, "scripts/testChainCeremony.cjs"), "utf8");
    expect(src).to.not.include("liveConfig");
    expect(src).to.include("Wallet.createRandom()");
  });

  it("the Base deploy page hands the poster to the live address before finalize and refuses a clash", function () {
    const html = fs.readFileSync(path.join(BC, "scripts/deploy-pages/baseCeremonyFlow.js"), "utf8");
    expect(html).to.include("setScheduledPricePoster(livePoster)");
    expect(html).to.include("live price poster equals the connected wallet");
    expect(html).to.include("live price poster equals the Dev Fund");
    expect(html.indexOf("setScheduledPricePoster(livePoster)")).to.be.lessThan(html.indexOf("verifier.finalize()"));
  });

  it("on the test chain: price written by the deployer, poster handed over, finalize gates still pass", async function () {
    const [deployer] = await ethers.getSigners();
    const T = await ethers.getContractFactory("VinculumFinalisToken");
    const vclm = await T.deploy("Vinculum", "VCLM", 10n ** 28n);
    const chonx = await T.deploy("Chonx", "CHONX", 10n ** 29n);
    const v = await (await ethers.getContractFactory("VinculumFinalisVerifier")).deploy(await vclm.getAddress(), await chonx.getAddress());
    const lock = await (await ethers.getContractFactory("CommitmentVaultLock")).deploy("Base", ceremonyData.devFund);
    const reader = await (await ethers.getContractFactory("BaseLockRecordVerifier")).deploy(await lock.getAddress());
    await v.registerChainVerifier("Base", await reader.getAddress());
    const r2 = ceremonyData.row2;
    await v.registerAssetPrecisionBatch([["Base", r2.canonicalAssetId, r2.symbol, r2.decimals, r2.custodyClass, r2.custodyPath]]);
    await v.configureDevFund("Base", ceremonyData.devFund);
    await v.setScheduledPricePoster(deployer.address);
    await v.applyScheduledPriceRun(1n, [{ environmentId: "Base", canonicalAssetId: r2.canonicalAssetId, priceUsd30: P30(2500n * 10n ** 18n), success: true }]);
    await v.setScheduledPricePoster(LIVE.scheduledPricePoster);
    expect(await v.scheduledPricePoster()).to.equal(EXPECTED_POSTER);
    await expect(v.applyScheduledPriceRun(2n, [])).to.be.revertedWith("VF-ORC-007: not price poster");
    await v.finalize.staticCall();
  });
});
