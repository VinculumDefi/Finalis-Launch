#!/usr/bin/env node
"use strict";

// Vinculum Finalis — Base mainnet production ceremony.
// Deploys a new CommitmentVaultLock("Base") (5.00% fee on every duration,
// Handshake $0.01-$0.02, standard minimum $0.01) and new VCLM, CHONX, SYNTH,
// Stake, and Verifier. Binds BaseLockRecordVerifier to the new lock.
// Ceremony order (finalize() reverts otherwise): register the Base reader,
// write the registry in batches of 50 including the Base native-ETH key,
// set the Dev Fund, set the poster, write the Base ETH price, read it back as
// usable, then finalize.
//
// Inputs read from the repo (the operator is not asked for these):
//   - Dev Fund: deployment/representativeBase.cjs, row environment "Base"
//   - Assets:   deployment/assetRegistry.resolved.json, entries[]
//     Rows with unresolvedReason or sameKeyAsRow are not written, matching
//     counts.writes in that file.
//
// Refuses before any transaction if:
//   - the Base Dev Fund row is missing or not an address
//   - the registry file is missing, has no entries, or the written-row count
//     does not equal counts.writes
//   - a written row has a malformed canonicalAssetId, decimals, custodyClass,
//     or custodyPath
//   - registry row 2 is not native ETH (symbol "ETH", assetId "native-ETH",
//     pricingIdentifier "ethereum")
//   - chain id is not Base mainnet (8453)
//   - ETH_PRICE_USD is missing or below 0.95 (no invented $1)
//   - PRICE_POSTER_ADDRESS is set and is not the deployer (the price must be
//     written before finalize, by the poster)
//
// Each registry line is registered under its own environmentId with its own
// canonicalAssetId, decimals, custodyClass, and custodyPath. No line is added.
//
// Base native ETH: row 2 is native ETH. The architecture design gives Base the
// native payable path for that asset, and VF-REG-009 prices it through the
// "ethereum" identifier (WETH is pricing metadata only). Row 2's
// canonicalAssetId is therefore also registered under "Base", with row 2's
// symbol, decimals, custodyClass, and custodyPath, so the Base price table has
// that key. This is the same asset, not a second token and not a new row.
//
// Usage, from base-contracts, at the wallet:
//   ETH_PRICE_USD=<price> \
//   npx hardhat run scripts/broadcastMintPath.cjs --network base

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");
const { ethers } = hre;
const { rows: DEPLOYMENT_ROWS } = require("../deployment/representativeBase.cjs");

const BASE_CHAIN_ID = 8453n;
const MIN_PRICE_USD18 = ethers.parseUnits("0.95", 18);
const REGISTRY_FILE = path.join(__dirname, "..", "deployment", "assetRegistry.resolved.json");

function die(msg) {
  console.error("REFUSAL:", msg);
  process.exit(1);
}

function isUint8(v) {
  return Number.isInteger(v) && v >= 0 && v <= 255;
}

function loadDevFund() {
  const row = DEPLOYMENT_ROWS.find((r) => r.environment === "Base");
  if (!row) die("deployment/representativeBase.cjs has no Base row.");
  if (!ethers.isAddress(row.devFund)) die("Base Dev Fund in deployment/representativeBase.cjs is not an address.");
  return ethers.getAddress(row.devFund);
}

function loadAssets() {
  if (!fs.existsSync(REGISTRY_FILE)) die("deployment/assetRegistry.resolved.json not found.");
  const registry = JSON.parse(fs.readFileSync(REGISTRY_FILE, "utf8"));
  const entries = registry.entries;
  if (!Array.isArray(entries) || entries.length === 0) die("registry has no entries.");
  const written = entries.filter((a) => a.unresolvedReason == null && a.sameKeyAsRow == null);
  const expected = registry.counts && registry.counts.writes;
  if (written.length !== expected) {
    die(`registry written rows ${written.length} do not equal counts.writes ${expected}.`);
  }
  for (const a of written) {
    const where = `registry row ${a.row}`;
    if (typeof a.environmentId !== "string" || a.environmentId.length === 0) die(`${where}: no environmentId.`);
    if (!/^0x[0-9a-fA-F]{64}$/.test(String(a.canonicalAssetId))) die(`${where}: canonicalAssetId is not bytes32.`);
    if (!isUint8(a.decimals)) die(`${where}: decimals is not uint8.`);
    if (!isUint8(a.custodyClass)) die(`${where}: custodyClass is not uint8.`);
    if (!isUint8(a.custodyPath)) die(`${where}: custodyPath is not uint8.`);
  }
  const nativeEth = written.find((a) => a.row === 2);
  if (
    !nativeEth ||
    nativeEth.symbol !== "ETH" ||
    nativeEth.assetId !== "native-ETH" ||
    nativeEth.pricingIdentifier !== "ethereum"
  ) {
    die("registry row 2 is not native ETH (symbol ETH, assetId native-ETH, pricingIdentifier ethereum).");
  }
  return { written, nativeEth };
}

async function main() {
  // File inputs first, so a bad registry or Dev Fund refuses with no network use.
  const devFund = loadDevFund();
  const { written: assets, nativeEth } = loadAssets();
  const ethId = nativeEth.canonicalAssetId;

  const net = await ethers.provider.getNetwork();
  if (net.chainId !== BASE_CHAIN_ID) die("not Base mainnet. This script only runs on Base.");

  const priceRaw = process.env.ETH_PRICE_USD;
  if (!priceRaw) die("ETH_PRICE_USD is not set. No price is invented.");
  const priceUsd18 = ethers.parseUnits(priceRaw, 18);
  if (priceUsd18 < MIN_PRICE_USD18) die("ETH_PRICE_USD is below 0.95. Refusing.");


  console.log("Base Dev Fund (deployment/representativeBase.cjs):", devFund);
  console.log("Base native ETH (registry row 2) canonicalAssetId:", ethId);

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  const poster = process.env.PRICE_POSTER_ADDRESS || deployer.address;
  if (poster.toLowerCase() !== deployer.address.toLowerCase()) {
    die("PRICE_POSTER_ADDRESS must be the deployer: the Base ETH price is written before finalize.");
  }

  const Lock = await ethers.getContractFactory("CommitmentVaultLock");
  const lock = await Lock.deploy("Base", devFund);
  await lock.waitForDeployment();
  if ((await lock.STANDARD_FEE_BPS()) !== 500n) die("lock fee is not 5%.");
  console.log("Registry assets:", assets.length);

  const nonce = await deployer.getNonce();
  const predictedVerifier = ethers.getCreateAddress({ from: deployer.address, nonce: nonce + 4 });
  console.log("Predicted verifier:", predictedVerifier);

  const VCLM = await ethers.getContractFactory("VinculumFinalisToken");
  const vclm = await VCLM.deploy("Vinculum Finalis VCLM", "VCLM", 10_000_000_000n * 10n ** 18n);
  await vclm.waitForDeployment();
  const CHONX = await ethers.getContractFactory("VinculumFinalisToken");
  const chonx = await CHONX.deploy("Vinculum Finalis CHONX", "CHONX", 100_000_000_000n * 10n ** 18n);
  await chonx.waitForDeployment();
  const Synth = await ethers.getContractFactory("VinculumFinalisSynth");
  const synth = await Synth.deploy(predictedVerifier, await vclm.getAddress(), await chonx.getAddress());
  await synth.waitForDeployment();
  const Stake = await ethers.getContractFactory("VinculumFinalisStake");
  const launchTs = BigInt((await ethers.provider.getBlock("latest")).timestamp);
  const stake = await Stake.deploy(await vclm.getAddress(), await chonx.getAddress(), await synth.getAddress(), predictedVerifier, launchTs);
  await stake.waitForDeployment();

  const Verifier = await ethers.getContractFactory("VinculumFinalisVerifier");
  const verifier = await Verifier.deploy(await vclm.getAddress(), await chonx.getAddress());
  await verifier.waitForDeployment();
  const verifierAddress = await verifier.getAddress();
  if (verifierAddress.toLowerCase() !== predictedVerifier.toLowerCase()) {
    die("verifier address did not match the prediction. Stopping. Do not point the app at these addresses.");
  }

  await (await vclm.initialize(verifierAddress, await stake.getAddress())).wait();
  await (await chonx.initialize(verifierAddress, await synth.getAddress())).wait();

  const Reader = await ethers.getContractFactory("BaseLockRecordVerifier");
  const reader = await Reader.deploy(await lock.getAddress());
  await reader.waitForDeployment();
  await (await verifier.registerChainVerifier("Base", await reader.getAddress())).wait();

  if ((await verifier.BASE_NATIVE_ETH_ASSET_ID()).toLowerCase() !== ethId.toLowerCase()) {
    die("Verifier BASE_NATIVE_ETH_ASSET_ID differs from registry row 2.");
  }

  // Registry in batches of 50. Base native ETH: row 2's canonical asset id
  // under Base for the price table, appended to the same batches.
  const items = assets.map((a) => ({
    environmentId: a.environmentId, canonicalAssetId: a.canonicalAssetId, symbol: a.symbol,
    decimals: a.decimals, custodyClass: a.custodyClass, custodyPath: a.custodyPath,
  }));
  items.push({
    environmentId: "Base", canonicalAssetId: ethId, symbol: nativeEth.symbol,
    decimals: nativeEth.decimals, custodyClass: nativeEth.custodyClass, custodyPath: nativeEth.custodyPath,
  });
  for (let i = 0; i < items.length; i += 50) {
    await (await verifier.registerAssetPrecisionBatch(items.slice(i, i + 50))).wait();
  }

  await (await verifier.configureDevFund("Base", devFund)).wait();
  await (await verifier.setScheduledPricePoster(poster)).wait();

  // Price before finalize; finalize() requires it usable.
  await (await verifier.applyScheduledPriceRun(1n, [{ environmentId: "Base", canonicalAssetId: ethId, priceUsd18, success: true }])).wait();

  const cv = await verifier.chainVerifiers("Base");
  if (cv === ethers.ZeroAddress) die("Base reader read failed. Not finalizing.");
  const key = ethers.solidityPackedKeccak256(["string", "bytes32"], ["Base", ethId]);
  const sp = await verifier.scheduledPrices(key);
  if (!sp.usable) die("Base native-ETH price is not usable. Not finalizing.");

  await (await verifier.finalize()).wait();
  if (!(await verifier.configurationFinalized())) die("finalize read failed.");

  console.log("ALL READS PASSED");
  console.log("Lock", await lock.getAddress());
  console.log("VCLM", await vclm.getAddress());
  console.log("CHONX", await chonx.getAddress());
  console.log("SYNTH", await synth.getAddress());
  console.log("Stake", await stake.getAddress());
  console.log("Verifier", verifierAddress);
  console.log("Base reader", await reader.getAddress());
}

main().catch((e) => { console.error(e); process.exit(1); });
