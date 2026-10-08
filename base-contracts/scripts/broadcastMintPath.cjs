#!/usr/bin/env node
"use strict";

// Vinculum Finalis — Base mainnet production ceremony.
// Deploys new VCLM, CHONX, SYNTH, Stake, and Verifier.
// Binds BaseLockRecordVerifier to the EXISTING lock. Does not deploy a lock.
// Registers Base and every asset in the registry JSON, sets the poster and Dev Fund,
// finalizes, writes the first scheduled ETH price, then checks the reads.
//
// Refuses before any send if:
//   - chain id is not Base mainnet (8453)
//   - ETH_PRICE_USD is missing or below 0.95 (no invented $1)
//   - DEV_FUND_ADDRESS is missing
//   - REGISTRY_PATH is missing or the file has no assets
//   - EXISTING_LOCK_ADDRESS is missing
//
// Usage, from base-contracts, at the wallet:
//   ETH_PRICE_USD=2560 DEV_FUND_ADDRESS=0x... REGISTRY_PATH=./registry.json \
//   EXISTING_LOCK_ADDRESS=0x... npx hardhat run scripts/broadcastMintPath.cjs --network base

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");
const { ethers } = hre;

const BASE_CHAIN_ID = 8453n;
const MIN_PRICE_USD18 = ethers.parseUnits("0.95", 18);

function die(msg) {
  console.error("REFUSAL:", msg);
  process.exit(1);
}

async function main() {
  const net = await ethers.provider.getNetwork();
  if (net.chainId !== BASE_CHAIN_ID) die("not Base mainnet. This script only runs on Base.");

  const priceRaw = process.env.ETH_PRICE_USD;
  if (!priceRaw) die("ETH_PRICE_USD is not set. No price is invented.");
  const priceUsd18 = ethers.parseUnits(priceRaw, 18);
  if (priceUsd18 < MIN_PRICE_USD18) die("ETH_PRICE_USD is below 0.95. Refusing.");

  const devFund = process.env.DEV_FUND_ADDRESS;
  if (!devFund || !ethers.isAddress(devFund)) die("DEV_FUND_ADDRESS is missing or not an address.");

  const registryPath = process.env.REGISTRY_PATH;
  if (!registryPath) die("REGISTRY_PATH is not set. The ceremony does not invent the asset list.");
  const abs = path.resolve(registryPath);
  if (!fs.existsSync(abs)) die("registry file not found. Refusing.");
  const registry = JSON.parse(fs.readFileSync(abs, "utf8"));
  const assets = registry.assets || registry;
  if (!Array.isArray(assets) || assets.length === 0) die("registry has no assets. Refusing.");

  const existingLock = process.env.EXISTING_LOCK_ADDRESS;
  if (!existingLock || !ethers.isAddress(existingLock)) die("EXISTING_LOCK_ADDRESS is not set.");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
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
  const reader = await Reader.deploy(existingLock);
  await reader.waitForDeployment();
  await (await verifier.registerChainVerifier("Base", await reader.getAddress())).wait();

  for (const a of assets) {
    const env = a.environmentId || a.environment || "Base";
    const canon = a.canonicalAssetId || a.canonical_asset_id || a.assetId;
    await (await verifier.registerAssetPrecision(
      env, canon, a.symbol, Number(a.decimals),
      Number(a.custodyClass || a.custody_class || 2),
      Number(a.custodyPath || a.custody_path || 0)
    )).wait();
  }

  const poster = process.env.PRICE_POSTER_ADDRESS || deployer.address;
  await (await verifier.setScheduledPricePoster(poster)).wait();
  await (await verifier.configureDevFund("Base", devFund)).wait();
  await (await verifier.finalize()).wait();

  const eth = assets.find((a) => String(a.symbol || "").toUpperCase() === "ETH");
  if (!eth) die("registry has no ETH asset. Refusing.");
  const ethId = eth.canonicalAssetId || eth.canonical_asset_id || eth.assetId;
  await (await verifier.applyScheduledPriceRun(1n, [{ environmentId: "Base", canonicalAssetId: ethId, priceUsd18, success: true }])).wait();

  const cv = await verifier.chainVerifiers("Base");
  if (cv === ethers.ZeroAddress) die("Base reader read failed.");
  const key = ethers.solidityPackedKeccak256(["string", "bytes32"], ["Base", ethId]);
  const sp = await verifier.scheduledPrices(key);
  if (!sp.usable) die("ETH price is not usable. Do not point the app at these addresses.");

  console.log("ALL READS PASSED");
  console.log("VCLM", await vclm.getAddress());
  console.log("CHONX", await chonx.getAddress());
  console.log("SYNTH", await synth.getAddress());
  console.log("Stake", await stake.getAddress());
  console.log("Verifier", verifierAddress);
  console.log("Base reader", await reader.getAddress());
}

main().catch((e) => { console.error(e); process.exit(1); });
