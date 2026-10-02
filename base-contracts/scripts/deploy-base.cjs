// =============================================================================
// deploy-base.cjs — deploy ONLY the Base stack
//
// Deploy order (same components as test 39, Base-only; stake after verifier
// because VinculumFinalisStake constructor takes the verifier address):
//   VCLM → CHONX → SYNTH → Cap → Verifier → Stake → (initialize) →
//   VinculumFinalisBaseVault → BaseSameChainVerifier
//
// Operator env (refuse missing/zero BEFORE any deploy):
//   PRICE_PUBLISHER   address
//   BASE_DEV_FUND     address
//   LAUNCH_TIMESTAMP  uint256  (must be > 0)
//
// Registers Base Approved Asset Registry rows that already appear in
// five-env-onchain-decimals.json only. Does NOT register a pretend MUSD.
// Does NOT deploy Ethereum / Polygon / Arbitrum / Optimism.
// Does NOT call VinculumFinalisVerifier.finalize().
//
// Usage:
//   npx hardhat run scripts/deploy-base.cjs
//
// Testable:
//   const { assertDeployEnv, deployBase } = require("../scripts/deploy-base.cjs");
// =============================================================================

"use strict";

const fs = require("fs");
const path = require("path");

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const ENV_ID = "base";
const HANDSHAKE_ALLOWANCE = 3;
const CLASS_TO_CUSTODY = { S1: 1, S2: 2, S3: 3 };

const OPERATOR_ADDRESS_KEYS = ["PRICE_PUBLISHER", "BASE_DEV_FUND"];

const REGISTRY_JSON_PATH = path.join(
  __dirname,
  "..",
  "..",
  "spec",
  "Vinculum_Finalis_Approved_Asset_Registry.json"
);
const ONCHAIN_DECIMALS_PATH = path.join(
  __dirname,
  "five-env-onchain-decimals.json"
);

/** Exact 20-byte hex address (0x + 40 hex digits). No left-pad / truncate. */
function isExact20ByteHexAddress(ident) {
  const s = String(ident || "");
  if (s.length !== 42 || s[0] !== "0" || s[1] !== "x") return false;
  for (let i = 2; i < 42; i++) {
    const c = s[i];
    if (
      !(
        (c >= "0" && c <= "9") ||
        (c >= "a" && c <= "f") ||
        (c >= "A" && c <= "F")
      )
    ) {
      return false;
    }
  }
  return true;
}

function loadOnchainDecimalsByRow() {
  const raw = fs.readFileSync(ONCHAIN_DECIMALS_PATH, "utf8");
  const data = JSON.parse(raw);
  const map = data.decimals_by_registry_row || {};
  const index = new Map();
  for (const [k, v] of Object.entries(map)) {
    const row = Number(k);
    const decimals = Number(v);
    if (!Number.isInteger(row) || row < 1) {
      throw new Error(`deploy-base: bad on-chain decimals key ${k}`);
    }
    if (!Number.isInteger(decimals) || decimals < 1 || decimals > 77) {
      throw new Error(
        `deploy-base: on-chain decimals for row ${row} out of range: ${v}`
      );
    }
    index.set(row, decimals);
  }
  if (index.size === 0) {
    throw new Error("deploy-base: five-env-onchain-decimals.json has no entries");
  }
  return index;
}

/**
 * Base registry rows whose registry_row is already in
 * five-env-onchain-decimals.json and whose identifier is an exact 20-byte
 * hex address. Custody class from registry S1/S2/S3; custody path token (1).
 */
function loadBaseRegistryAssets() {
  const raw = fs.readFileSync(REGISTRY_JSON_PATH);
  const data = JSON.parse(raw.toString("utf8"));
  const records = data.records || [];
  if (records.length !== 1001) {
    throw new Error(
      `deploy-base: registry record count ${records.length} !== 1001`
    );
  }
  const onchainDecimals = loadOnchainDecimalsByRow();
  const assets = [];
  for (const r of records) {
    if (r.environment !== "Base") continue;
    const ident = String(r.contract_or_native_identifier || "");
    if (!isExact20ByteHexAddress(ident)) continue;
    const decimals = onchainDecimals.get(r.registry_row);
    if (decimals === undefined) continue;
    const custodyClass = CLASS_TO_CUSTODY[r.class];
    if (!custodyClass) {
      throw new Error(
        `deploy-base: unknown registry class ${r.class} at row ${r.registry_row}`
      );
    }
    assets.push({
      registryRow: r.registry_row,
      symbol: r.symbol,
      decimals,
      custodyClass,
      custodyPath: 1,
      contractOrNative: ident,
    });
  }
  assets.sort((a, b) => a.registryRow - b.registryRow);
  return assets;
}

function raw(env, key) {
  const v = env[key];
  if (v === undefined || v === null) return "";
  return String(v).trim();
}

/**
 * Refuse on missing or zero-valued operator parameters.
 * Safe to call from tests — no network I/O and does not deploy.
 */
function assertDeployEnv(env) {
  if (!env || typeof env !== "object") {
    throw new Error("deploy-base: env object is required");
  }

  const missing = [];
  const zeroed = [];

  for (const key of OPERATOR_ADDRESS_KEYS) {
    const v = raw(env, key);
    if (!v) {
      missing.push(key);
      continue;
    }
    if (v.toLowerCase() === ZERO_ADDRESS) zeroed.push(key);
  }

  {
    const key = "LAUNCH_TIMESTAMP";
    const v = raw(env, key);
    if (!v) {
      missing.push(key);
    } else {
      try {
        if (BigInt(v) === 0n) zeroed.push(key);
      } catch {
        zeroed.push(key);
      }
    }
  }

  if (missing.length || zeroed.length) {
    const parts = [];
    if (missing.length) parts.push(`missing: ${missing.join(", ")}`);
    if (zeroed.length) parts.push(`zero/invalid: ${zeroed.join(", ")}`);
    throw new Error(`deploy-base: refusing to deploy — ${parts.join("; ")}`);
  }
}

/**
 * Deploy the Base-only stack. Calls assertDeployEnv first.
 * Does not call protocol finalize().
 *
 * @param {*} ethers  hardhat ethers
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} [env]
 */
async function deployBase(ethers, env = process.env) {
  assertDeployEnv(env);

  const publisher = String(env.PRICE_PUBLISHER).trim();
  const baseDevFund = String(env.BASE_DEV_FUND).trim();
  const launchTs = BigInt(String(env.LAUNCH_TIMESTAMP).trim());

  const Token = await ethers.getContractFactory("VinculumFinalisToken");
  const vclm = await Token.deploy(
    "Vinculum",
    "VCLM",
    10_000_000_000n * 10n ** 18n
  );
  await vclm.waitForDeployment();

  const chonx = await Token.deploy(
    "Chonx",
    "CHONX",
    100_000_000_000n * 10n ** 18n
  );
  await chonx.waitForDeployment();

  const synth = await Token.deploy(
    "Synth",
    "SYNTH",
    10_000_000n * 10n ** 18n
  );
  await synth.waitForDeployment();

  const Cap = await ethers.getContractFactory("VinculumFinalisCap");
  const cap = await Cap.deploy(
    10_000_000_000n * 10n ** 18n,
    100_000_000_000n * 10n ** 18n
  );
  await cap.waitForDeployment();

  const Verifier = await ethers.getContractFactory("VinculumFinalisVerifier");
  const verifier = await Verifier.deploy(
    await vclm.getAddress(),
    await chonx.getAddress(),
    publisher,
    launchTs,
    await cap.getAddress()
  );
  await verifier.waitForDeployment();

  const Stake = await ethers.getContractFactory("VinculumFinalisStake");
  const stake = await Stake.deploy(
    await vclm.getAddress(),
    await chonx.getAddress(),
    await synth.getAddress(),
    await verifier.getAddress(),
    launchTs,
    await cap.getAddress()
  );
  await stake.waitForDeployment();

  await (await cap.initialize(await verifier.getAddress(), await stake.getAddress())).wait();
  await (await vclm.initialize(await verifier.getAddress(), await stake.getAddress())).wait();
  await (await chonx.initialize(await verifier.getAddress(), ZERO_ADDRESS)).wait();
  await (await synth.initialize(await verifier.getAddress(), ZERO_ADDRESS)).wait();

  const BaseVault = await ethers.getContractFactory("VinculumFinalisBaseVault");
  const baseVault = await BaseVault.deploy(
    await verifier.getAddress(),
    baseDevFund
  );
  await baseVault.waitForDeployment();

  const BaseCV = await ethers.getContractFactory("BaseSameChainVerifier");
  const baseVerifier = await BaseCV.deploy(await baseVault.getAddress());
  await baseVerifier.waitForDeployment();

  await (
    await verifier.registerChainVerifier(ENV_ID, await baseVerifier.getAddress())
  ).wait();
  await (
    await verifier.configureDevFund(ENV_ID, baseDevFund.toLowerCase())
  ).wait();
  await (
    await verifier.registerHandshakeAllowance(ENV_ID, HANDSHAKE_ALLOWANCE)
  ).wait();

  const assets = loadBaseRegistryAssets();
  const registeredAssets = [];
  const seenTokenAddrs = new Set();

  for (const asset of assets) {
    const aid = ethers.keccak256(
      ethers.toUtf8Bytes(`${ENV_ID}:${asset.symbol}`)
    );
    await (
      await verifier.registerAssetPrecision(
        ENV_ID,
        aid,
        asset.symbol,
        asset.decimals,
        asset.custodyClass,
        asset.custodyPath
      )
    ).wait();

    const tokenAddr = ethers.getAddress(asset.contractOrNative.toLowerCase());
    const tokenKey = tokenAddr.toLowerCase();
    let vaultRegistered = false;
    if (!seenTokenAddrs.has(tokenKey)) {
      seenTokenAddrs.add(tokenKey);
      await (await baseVault.registerAsset(tokenAddr, aid)).wait();
      vaultRegistered = true;
    }

    registeredAssets.push({
      registryRow: asset.registryRow,
      symbol: asset.symbol,
      decimals: asset.decimals,
      custodyClass: asset.custodyClass,
      custodyPath: asset.custodyPath,
      address: tokenAddr,
      aid,
      vaultRegistered,
    });
  }

  await (await baseVault.finalizeConfiguration()).wait();

  const out = {
    environmentId: ENV_ID,
    vclm: await vclm.getAddress(),
    chonx: await chonx.getAddress(),
    synth: await synth.getAddress(),
    cap: await cap.getAddress(),
    stake: await stake.getAddress(),
    verifier: await verifier.getAddress(),
    vault: await baseVault.getAddress(),
    chainVerifier: await baseVerifier.getAddress(),
    baseDevFund,
    pricePublisher: publisher,
    launchTimestamp: launchTs.toString(),
    registeredAssets,
    baseRegistryRegistered: registeredAssets.length,
  };

  console.log(JSON.stringify(out, null, 2));
  return out;
}

async function main() {
  const { ethers } = require("hardhat");
  assertDeployEnv(process.env);
  await deployBase(ethers, process.env);
}

module.exports = {
  assertDeployEnv,
  deployBase,
  loadBaseRegistryAssets,
  OPERATOR_ADDRESS_KEYS,
  ENV_ID,
  HANDSHAKE_ALLOWANCE,
  REGISTRY_JSON_PATH,
  ONCHAIN_DECIMALS_PATH,
};

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
