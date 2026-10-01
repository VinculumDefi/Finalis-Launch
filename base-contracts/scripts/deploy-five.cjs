// =============================================================================
// deploy-five.cjs — deploy ONLY Base, Ethereum, Polygon, Arbitrum, Optimism
//
// Deploys VinculumFinalisVerifier, five vaults, and the five chain verifiers.
// Each chain verifier is constructed with the vault that THIS script just
// deployed for that chain (not a separate vault address from the environment).
// After the five verifiers deploy, registerChainVerifier is called for all five
// on VinculumFinalisVerifier before the script returns.
//
// Every remaining constructor address / param comes from environment variables.
// The script validates the full env set BEFORE any deployment transaction.
//
// Required environment variables
// ------------------------------
// Shared (VinculumFinalisVerifier constructor):
//   VCLM_TOKEN              address  _vclmToken
//   CHONX_TOKEN             address  _chonxToken
//   PRICE_PUBLISHER         address  _pricePublisher
//   LAUNCH_TIMESTAMP        uint256  _launchTimestamp  (must be > 0)
//   CAP                     address  _cap
//
// Ethereum vault (VinculumFinalisEvmVault):
//   ETHEREUM_ENVIRONMENT_ID string
//   ETHEREUM_DEV_FUND       address
// Ethereum verifier (EthereumChainVerifier) — vault is the one deployFive
// just deployed for Ethereum:
//   ETHEREUM_REGISTRY           address
//   ETHEREUM_LOCK_EVENT_TOPIC   bytes32
//
// Polygon vault:
//   POLYGON_ENVIRONMENT_ID  string
//   POLYGON_DEV_FUND        address
// Polygon verifier (PolygonChainVerifier) — vault is deployFive's Polygon vault:
//   POLYGON_REGISTRY              address
//   POLYGON_CHECKPOINT_CONTRACT   address
//   POLYGON_HEADER_BLOCK_TOPIC    bytes32
//   POLYGON_LOCK_EVENT_TOPIC      bytes32
//
// Arbitrum vault:
//   ARBITRUM_ENVIRONMENT_ID string
//   ARBITRUM_DEV_FUND       address
// Arbitrum verifier (ArbitrumChainVerifier) — vault is deployFive's Arbitrum vault:
//   ARBITRUM_REGISTRY                   address
//   ARBITRUM_ROLLUP_CONTRACT            address
//   ARBITRUM_ASSERTION_CONFIRMED_TOPIC  bytes32
//   ARBITRUM_LOCK_EVENT_TOPIC           bytes32
//
// Optimism vault:
//   OPTIMISM_ENVIRONMENT_ID string
//   OPTIMISM_DEV_FUND       address
// Optimism verifier (OpStackFaultProofVerifier.Config — same fields as
// 34_optimism_lock_prove_mint.test.cjs; sourceVault is deployFive's Optimism
// vault, not an env address):
//   OPTIMISM_ENVIRONMENT_ID              string   environmentId
//   OPTIMISM_REGISTRY                    address  registry
//   OPTIMISM_DISPUTE_GAME_FACTORY        address  disputeGameFactory
//   OPTIMISM_GAME_CREATED_TOPIC          bytes32  gameCreatedTopic
//   OPTIMISM_GAME_RESOLVED_TOPIC         bytes32  gameResolvedTopic
//   OPTIMISM_RESPECTED_GAME_TYPE         uint32   respectedGameType
//       (0 = CANNON is valid; zero-check is skipped for this field)
//   OPTIMISM_GAME_FINALITY_DELAY_SECONDS uint64   gameFinalityDelaySeconds
//       (must be > 0)
//   OPTIMISM_LOCK_EVENT_TOPIC            bytes32  lockEventTopic
//
// Base vault (VinculumFinalisBaseVault — constructor is verifier + devFund;
// environment id is still required for the five-env inventory):
//   BASE_ENVIRONMENT_ID string
//   BASE_DEV_FUND       address
// Base verifier (BaseSameChainVerifier) — vault is deployFive's Base vault
// (no separate BASE_VAULT env key).
//
// Shared custody asset (one 18-decimal custody-class-1 asset, matching test 31):
//   ASSET_TOKEN             address  ERC-20 registered on every vault
//       (required, non-zero; refuse before any deploy if missing/zero)
//
// After vaults + chain verifiers deploy and registerChainVerifier runs, the
// script also (for Base, Ethereum, Polygon, Arbitrum, Optimism):
//   - configureDevFund(envId, <ENV>_DEV_FUND lowercase)
//   - registerHandshakeAllowance(envId, 3)
//   - registerAssetPrecision + vault.registerAsset for the fixture MUSD asset
//   - registerAssetPrecision + vault.registerAsset ONLY for Approved Asset
//     Registry rows (five envs) whose decimals already appear in
//     ASSET_PRECISION_TABLE (src/lib/vfBaseRegistry.js) AND whose
//     contract_or_native_identifier is an exact 20-byte hex address.
//     Other approved rows stay unregistered. Non-20-byte ids are skipped
//     and recorded (no left-pad, no decimal clamp).
//   - vault.finalizeConfiguration()
// It does NOT call VinculumFinalisVerifier.finalize() (protocol finalize).
//
// Usage:
//   npx hardhat run scripts/deploy-five.cjs
//
// Testable without network:
//   const { assertDeployEnv } = require("../scripts/deploy-five.cjs");
//   assertDeployEnv(env);  // throws before any deploy
// =============================================================================

"use strict";

const fs = require("fs");
const path = require("path");

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const ZERO_BYTES32 =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

/** Address fields that must be present and non-zero. */
const ADDRESS_KEYS = [
  "VCLM_TOKEN",
  "CHONX_TOKEN",
  "PRICE_PUBLISHER",
  "CAP",
  "ASSET_TOKEN",
  "ETHEREUM_DEV_FUND",
  "ETHEREUM_REGISTRY",
  "POLYGON_DEV_FUND",
  "POLYGON_REGISTRY",
  "POLYGON_CHECKPOINT_CONTRACT",
  "ARBITRUM_DEV_FUND",
  "ARBITRUM_REGISTRY",
  "ARBITRUM_ROLLUP_CONTRACT",
  "OPTIMISM_DEV_FUND",
  "OPTIMISM_REGISTRY",
  "OPTIMISM_DISPUTE_GAME_FACTORY",
  "BASE_DEV_FUND",
];

/** Match test 31: one 18-decimal custody-class-1 asset, handshake allowance 3. */
const ASSET_SYMBOL = "MUSD";
const ASSET_DECIMALS = 18;
const ASSET_CUSTODY_CLASS = 1;
const ASSET_CUSTODY_PATH = 1;
const HANDSHAKE_ALLOWANCE = 3;

/** Registry environment display names for the five deployFive environments. */
const FIVE_ENV_REGISTRY_NAMES = {
  ethereum: "Ethereum",
  polygon: "Polygon",
  arbitrum: "Arbitrum",
  optimism: "Optimism",
  base: "Base",
};

const CLASS_TO_CUSTODY = { S1: 1, S2: 2, S3: 3 };


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

const REGISTRY_JSON_PATH = path.join(
  __dirname,
  "..",
  "..",
  "spec",
  "Vinculum_Finalis_Approved_Asset_Registry.json"
);
const VF_BASE_REGISTRY_PATH = path.join(
  __dirname,
  "..",
  "..",
  "src",
  "lib",
  "vfBaseRegistry.js"
);

/**
 * Parse ASSET_PRECISION_TABLE from vfBaseRegistry.js without executing ESM imports.
 * Returns Map key `${environment}|${symbol}` → { decimals, custodyClass, custodyPath }.
 */
function loadAssetPrecisionTableIndex() {
  const src = fs.readFileSync(VF_BASE_REGISTRY_PATH, "utf8");
  const marker = "export const ASSET_PRECISION_TABLE = {";
  const start = src.indexOf(marker);
  if (start < 0) {
    throw new Error("deploy-five: ASSET_PRECISION_TABLE not found in vfBaseRegistry.js");
  }
  const bodyStart = start + marker.length;
  let depth = 1;
  let i = bodyStart;
  while (i < src.length && depth > 0) {
    const ch = src[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") depth -= 1;
    i += 1;
  }
  const body = src.slice(bodyStart, i - 1);
  const entryRe =
    /'([^']+)':\s*\{\s*symbol:\s*'([^']+)',\s*decimals:\s*(\d+),\s*custodyClass:\s*'([^']+)',\s*custodyPath:\s*'([^']+)'/g;
  const index = new Map();
  let m;
  while ((m = entryRe.exec(body)) !== null) {
    const tableKey = m[1];
    const slash = tableKey.indexOf("/");
    if (slash < 0) continue;
    const environment = tableKey.slice(0, slash);
    const symbol = m[2];
    const decimals = Number(m[3]);
    const custodyClass = CLASS_TO_CUSTODY[m[4]];
    const custodyPath = m[5] === "native" ? 0 : 1;
    if (!custodyClass) {
      throw new Error(
        `deploy-five: unknown custodyClass ${m[4]} in ASSET_PRECISION_TABLE ${tableKey}`
      );
    }
    index.set(`${environment}|${symbol}`, {
      decimals,
      custodyClass,
      custodyPath,
      tableKey,
    });
  }
  if (index.size === 0) {
    throw new Error("deploy-five: ASSET_PRECISION_TABLE parse yielded no entries");
  }
  return index;
}

/**
 * Load five-env assets eligible for deployFive registration.
 * Only rows whose (environment, symbol) already appear in ASSET_PRECISION_TABLE
 * AND whose contract_or_native_identifier is an exact 20-byte hex address.
 * Non-20-byte identifiers among five-env rows are skipped and listed in
 * skippedNon20ByteRows. No decimal clamp; no address left-pad.
 * Does not rewrite the governing registry JSON.
 */
function loadFiveEnvRegistryAssets() {
  const raw = fs.readFileSync(REGISTRY_JSON_PATH);
  const data = JSON.parse(raw.toString("utf8"));
  const records = data.records || [];
  if (records.length !== 1001) {
    throw new Error(
      `deploy-five: registry record count ${records.length} !== 1001`
    );
  }
  const precisionIndex = loadAssetPrecisionTableIndex();
  const allowed = new Set(Object.values(FIVE_ENV_REGISTRY_NAMES));
  const byEnv = {
    Ethereum: [],
    Polygon: [],
    Arbitrum: [],
    Optimism: [],
    Base: [],
  };
  const skippedNon20ByteRows = [];
  for (const r of records) {
    if (!allowed.has(r.environment)) continue;
    const ident = String(r.contract_or_native_identifier || "");
    if (!isExact20ByteHexAddress(ident)) {
      skippedNon20ByteRows.push(r.registry_row);
      continue;
    }
    const precision = precisionIndex.get(`${r.environment}|${r.symbol}`);
    if (!precision) {
      // Approved but decimals not in ASSET_PRECISION_TABLE — stay unregistered.
      continue;
    }
    byEnv[r.environment].push({
      registryRow: r.registry_row,
      symbol: r.symbol,
      decimals: precision.decimals,
      custodyClass: precision.custodyClass,
      custodyPath: precision.custodyPath,
      contractOrNative: ident,
    });
  }
  skippedNon20ByteRows.sort((a, b) => a - b);
  return { byEnv, skippedNon20ByteRows };
}

/** Non-empty string fields (environment ids). */
const STRING_KEYS = [
  "ETHEREUM_ENVIRONMENT_ID",
  "POLYGON_ENVIRONMENT_ID",
  "ARBITRUM_ENVIRONMENT_ID",
  "OPTIMISM_ENVIRONMENT_ID",
  "BASE_ENVIRONMENT_ID",
];

/** bytes32 topics that must be present and non-zero. */
const BYTES32_KEYS = [
  "ETHEREUM_LOCK_EVENT_TOPIC",
  "POLYGON_HEADER_BLOCK_TOPIC",
  "POLYGON_LOCK_EVENT_TOPIC",
  "ARBITRUM_ASSERTION_CONFIRMED_TOPIC",
  "ARBITRUM_LOCK_EVENT_TOPIC",
  "OPTIMISM_GAME_CREATED_TOPIC",
  "OPTIMISM_GAME_RESOLVED_TOPIC",
  "OPTIMISM_LOCK_EVENT_TOPIC",
];

function raw(env, key) {
  const v = env[key];
  if (v === undefined || v === null) return "";
  return String(v).trim();
}

/**
 * Refuse on missing or zero-valued deploy parameters.
 * Safe to call from tests — performs no network I/O and does not deploy.
 *
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} env
 * @returns {void}
 * @throws {Error} when any required variable is missing or zero where applicable
 */
function assertDeployEnv(env) {
  if (!env || typeof env !== "object") {
    throw new Error("deploy-five: env object is required");
  }

  const missing = [];
  const zeroed = [];

  for (const key of ADDRESS_KEYS) {
    const v = raw(env, key);
    if (!v) {
      missing.push(key);
      continue;
    }
    if (v.toLowerCase() === ZERO_ADDRESS) zeroed.push(key);
  }

  for (const key of STRING_KEYS) {
    if (!raw(env, key)) missing.push(key);
  }

  for (const key of BYTES32_KEYS) {
    const v = raw(env, key);
    if (!v) {
      missing.push(key);
      continue;
    }
    if (v.toLowerCase() === ZERO_BYTES32) zeroed.push(key);
  }

  // LAUNCH_TIMESTAMP must be present and > 0
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

  // OPTIMISM_GAME_FINALITY_DELAY_SECONDS must be present and > 0
  {
    const key = "OPTIMISM_GAME_FINALITY_DELAY_SECONDS";
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

  // OPTIMISM_RESPECTED_GAME_TYPE must be present; 0 (CANNON) is allowed
  {
    const key = "OPTIMISM_RESPECTED_GAME_TYPE";
    if (env[key] === undefined || env[key] === null || String(env[key]).trim() === "") {
      missing.push(key);
    }
  }

  if (missing.length || zeroed.length) {
    const parts = [];
    if (missing.length) parts.push(`missing: ${missing.join(", ")}`);
    if (zeroed.length) parts.push(`zero/invalid: ${zeroed.join(", ")}`);
    throw new Error(`deploy-five: refusing to deploy — ${parts.join("; ")}`);
  }
}

/**
 * Deploy the five-environment stack. Calls assertDeployEnv first.
 * Vaults deploy before chain verifiers; each verifier is constructed with the
 * vault this function just deployed for that chain. Then registerChainVerifier
 * is called for all five on VinculumFinalisVerifier. Then configureDevFund,
 * registerHandshakeAllowance, registerAssetPrecision, vault registerAsset, and
 * vault finalizeConfiguration for each of the five. Does not call protocol finalize().
 *
 * @param {*} ethers  hardhat ethers
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} [env]
 */
async function deployFive(ethers, env = process.env) {
  assertDeployEnv(env);

  const get = (k) => String(env[k]).trim();

  const Verifier = await ethers.getContractFactory("VinculumFinalisVerifier");
  const verifier = await Verifier.deploy(
    get("VCLM_TOKEN"),
    get("CHONX_TOKEN"),
    get("PRICE_PUBLISHER"),
    BigInt(get("LAUNCH_TIMESTAMP")),
    get("CAP")
  );
  await verifier.waitForDeployment();

  const EvmVault = await ethers.getContractFactory("VinculumFinalisEvmVault");

  const ethereumVault = await EvmVault.deploy(
    get("ETHEREUM_ENVIRONMENT_ID"),
    get("ETHEREUM_DEV_FUND")
  );
  await ethereumVault.waitForDeployment();

  const polygonVault = await EvmVault.deploy(
    get("POLYGON_ENVIRONMENT_ID"),
    get("POLYGON_DEV_FUND")
  );
  await polygonVault.waitForDeployment();

  const arbitrumVault = await EvmVault.deploy(
    get("ARBITRUM_ENVIRONMENT_ID"),
    get("ARBITRUM_DEV_FUND")
  );
  await arbitrumVault.waitForDeployment();

  const optimismVault = await EvmVault.deploy(
    get("OPTIMISM_ENVIRONMENT_ID"),
    get("OPTIMISM_DEV_FUND")
  );
  await optimismVault.waitForDeployment();

  // BASE_ENVIRONMENT_ID is validated above; BaseVault constructor takes
  // (verifier, devFund) only — environment is implicit ("base").
  const BaseVault = await ethers.getContractFactory("VinculumFinalisBaseVault");
  const baseVault = await BaseVault.deploy(
    await verifier.getAddress(),
    get("BASE_DEV_FUND")
  );
  await baseVault.waitForDeployment();

  const ethereumVaultAddr = await ethereumVault.getAddress();
  const polygonVaultAddr = await polygonVault.getAddress();
  const arbitrumVaultAddr = await arbitrumVault.getAddress();
  const optimismVaultAddr = await optimismVault.getAddress();
  const baseVaultAddr = await baseVault.getAddress();

  const EthereumCV = await ethers.getContractFactory("EthereumChainVerifier");
  const ethereumVerifier = await EthereumCV.deploy(
    get("ETHEREUM_ENVIRONMENT_ID"),
    get("ETHEREUM_REGISTRY"),
    ethereumVaultAddr,
    get("ETHEREUM_LOCK_EVENT_TOPIC")
  );
  await ethereumVerifier.waitForDeployment();

  const PolygonCV = await ethers.getContractFactory("PolygonChainVerifier");
  const polygonVerifier = await PolygonCV.deploy(
    get("POLYGON_ENVIRONMENT_ID"),
    get("POLYGON_REGISTRY"),
    get("POLYGON_CHECKPOINT_CONTRACT"),
    get("POLYGON_HEADER_BLOCK_TOPIC"),
    polygonVaultAddr,
    get("POLYGON_LOCK_EVENT_TOPIC")
  );
  await polygonVerifier.waitForDeployment();

  const ArbitrumCV = await ethers.getContractFactory("ArbitrumChainVerifier");
  const arbitrumVerifier = await ArbitrumCV.deploy(
    get("ARBITRUM_ENVIRONMENT_ID"),
    get("ARBITRUM_REGISTRY"),
    get("ARBITRUM_ROLLUP_CONTRACT"),
    get("ARBITRUM_ASSERTION_CONFIRMED_TOPIC"),
    arbitrumVaultAddr,
    get("ARBITRUM_LOCK_EVENT_TOPIC")
  );
  await arbitrumVerifier.waitForDeployment();

  const OpStack = await ethers.getContractFactory("OpStackFaultProofVerifier");
  const optimismVerifier = await OpStack.deploy({
    environmentId: get("OPTIMISM_ENVIRONMENT_ID"),
    registry: get("OPTIMISM_REGISTRY"),
    disputeGameFactory: get("OPTIMISM_DISPUTE_GAME_FACTORY"),
    gameCreatedTopic: get("OPTIMISM_GAME_CREATED_TOPIC"),
    gameResolvedTopic: get("OPTIMISM_GAME_RESOLVED_TOPIC"),
    respectedGameType: Number(get("OPTIMISM_RESPECTED_GAME_TYPE")),
    gameFinalityDelaySeconds: BigInt(get("OPTIMISM_GAME_FINALITY_DELAY_SECONDS")),
    sourceVault: optimismVaultAddr,
    lockEventTopic: get("OPTIMISM_LOCK_EVENT_TOPIC"),
  });
  await optimismVerifier.waitForDeployment();

  const BaseCV = await ethers.getContractFactory("BaseSameChainVerifier");
  const baseVerifier = await BaseCV.deploy(baseVaultAddr);
  await baseVerifier.waitForDeployment();

  const ethereumVerifierAddr = await ethereumVerifier.getAddress();
  const polygonVerifierAddr = await polygonVerifier.getAddress();
  const arbitrumVerifierAddr = await arbitrumVerifier.getAddress();
  const optimismVerifierAddr = await optimismVerifier.getAddress();
  const baseVerifierAddr = await baseVerifier.getAddress();

  await (
    await verifier.registerChainVerifier(
      get("ETHEREUM_ENVIRONMENT_ID"),
      ethereumVerifierAddr
    )
  ).wait();
  await (
    await verifier.registerChainVerifier(
      get("POLYGON_ENVIRONMENT_ID"),
      polygonVerifierAddr
    )
  ).wait();
  await (
    await verifier.registerChainVerifier(
      get("ARBITRUM_ENVIRONMENT_ID"),
      arbitrumVerifierAddr
    )
  ).wait();
  await (
    await verifier.registerChainVerifier(
      get("OPTIMISM_ENVIRONMENT_ID"),
      optimismVerifierAddr
    )
  ).wait();
  await (
    await verifier.registerChainVerifier(
      get("BASE_ENVIRONMENT_ID"),
      baseVerifierAddr
    )
  ).wait();

  // -------------------------------------------------------------------------
  // Per-environment ceremony (match test 31 patterns). No protocol finalize().
  // -------------------------------------------------------------------------
  const assetToken = get("ASSET_TOKEN");
  const envSpecs = [
    {
      key: "ethereum",
      id: get("ETHEREUM_ENVIRONMENT_ID"),
      vault: ethereumVault,
      fund: get("ETHEREUM_DEV_FUND"),
    },
    {
      key: "polygon",
      id: get("POLYGON_ENVIRONMENT_ID"),
      vault: polygonVault,
      fund: get("POLYGON_DEV_FUND"),
    },
    {
      key: "arbitrum",
      id: get("ARBITRUM_ENVIRONMENT_ID"),
      vault: arbitrumVault,
      fund: get("ARBITRUM_DEV_FUND"),
    },
    {
      key: "optimism",
      id: get("OPTIMISM_ENVIRONMENT_ID"),
      vault: optimismVault,
      fund: get("OPTIMISM_DEV_FUND"),
    },
    {
      key: "base",
      id: get("BASE_ENVIRONMENT_ID"),
      vault: baseVault,
      fund: get("BASE_DEV_FUND"),
    },
  ];

  const { byEnv: registryByEnv, skippedNon20ByteRows } =
    loadFiveEnvRegistryAssets();
  const assetIds = {};
  let fiveEnvRegistryRegistered = 0;

  for (const spec of envSpecs) {
    const aid = ethers.keccak256(
      ethers.toUtf8Bytes(`${spec.id}:${ASSET_SYMBOL}`)
    );
    assetIds[spec.key] = aid;

    await (
      await verifier.configureDevFund(spec.id, spec.fund.toLowerCase())
    ).wait();
    await (
      await verifier.registerHandshakeAllowance(spec.id, HANDSHAKE_ALLOWANCE)
    ).wait();

    // Fixture custody-class-1 asset (keeps existing one-asset lock e2e working).
    await (
      await verifier.registerAssetPrecision(
        spec.id,
        aid,
        ASSET_SYMBOL,
        ASSET_DECIMALS,
        ASSET_CUSTODY_CLASS,
        ASSET_CUSTODY_PATH
      )
    ).wait();
    await (await spec.vault.registerAsset(assetToken, aid)).wait();

    // Approved Asset Registry rows for this environment only (five EVM envs).
    const regName = FIVE_ENV_REGISTRY_NAMES[spec.key];
    const assets = registryByEnv[regName] || [];
    for (const asset of assets) {
      const registryAid = ethers.keccak256(
        ethers.toUtf8Bytes(`${spec.id}:${asset.symbol}`)
      );
      await (
        await verifier.registerAssetPrecision(
          spec.id,
          registryAid,
          asset.symbol,
          asset.decimals,
          asset.custodyClass,
          asset.custodyPath
        )
      ).wait();
      const tokenAddr = ethers.getAddress(asset.contractOrNative.toLowerCase());
      await (await spec.vault.registerAsset(tokenAddr, registryAid)).wait();
      fiveEnvRegistryRegistered += 1;
    }

    await (await spec.vault.finalizeConfiguration()).wait();
  }

  const out = {
    verifier: await verifier.getAddress(),
    vaults: {
      ethereum: ethereumVaultAddr,
      polygon: polygonVaultAddr,
      arbitrum: arbitrumVaultAddr,
      optimism: optimismVaultAddr,
      base: baseVaultAddr,
    },
    chainVerifiers: {
      ethereum: ethereumVerifierAddr,
      polygon: polygonVerifierAddr,
      arbitrum: arbitrumVerifierAddr,
      optimism: optimismVerifierAddr,
      base: baseVerifierAddr,
    },
    assetToken,
    assetSymbol: ASSET_SYMBOL,
    assetIds,
    fiveEnvRegistryRegistered,
    skippedNon20ByteRows,
  };

  console.log(JSON.stringify(out, null, 2));
  return out;
}

async function main() {
  const { ethers } = require("hardhat");
  assertDeployEnv(process.env);
  await deployFive(ethers, process.env);
}

module.exports = {
  assertDeployEnv,
  deployFive,
  loadFiveEnvRegistryAssets,
  ADDRESS_KEYS,
  STRING_KEYS,
  BYTES32_KEYS,
  ASSET_SYMBOL,
  ASSET_DECIMALS,
  ASSET_CUSTODY_CLASS,
  ASSET_CUSTODY_PATH,
  HANDSHAKE_ALLOWANCE,
  FIVE_ENV_REGISTRY_NAMES,
  REGISTRY_JSON_PATH,
};

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
