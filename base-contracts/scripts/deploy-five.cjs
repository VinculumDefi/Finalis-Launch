// =============================================================================
// deploy-five.cjs — deploy ONLY Base, Ethereum, Polygon, Arbitrum, Optimism
//
// Deploys VinculumFinalisVerifier, five vaults, and the five chain verifiers.
// Every constructor address / param comes from environment variables. The
// script validates the full env set BEFORE any deployment transaction.
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
// Ethereum verifier (EthereumChainVerifier):
//   ETHEREUM_REGISTRY           address
//   ETHEREUM_SOURCE_VAULT       address
//   ETHEREUM_LOCK_EVENT_TOPIC   bytes32
//
// Polygon vault:
//   POLYGON_ENVIRONMENT_ID  string
//   POLYGON_DEV_FUND        address
// Polygon verifier (PolygonChainVerifier):
//   POLYGON_REGISTRY              address
//   POLYGON_CHECKPOINT_CONTRACT   address
//   POLYGON_HEADER_BLOCK_TOPIC    bytes32
//   POLYGON_SOURCE_VAULT          address
//   POLYGON_LOCK_EVENT_TOPIC      bytes32
//
// Arbitrum vault:
//   ARBITRUM_ENVIRONMENT_ID string
//   ARBITRUM_DEV_FUND       address
// Arbitrum verifier (ArbitrumChainVerifier):
//   ARBITRUM_REGISTRY                   address
//   ARBITRUM_ROLLUP_CONTRACT            address
//   ARBITRUM_ASSERTION_CONFIRMED_TOPIC  bytes32
//   ARBITRUM_SOURCE_VAULT               address
//   ARBITRUM_LOCK_EVENT_TOPIC           bytes32
//
// Optimism vault:
//   OPTIMISM_ENVIRONMENT_ID string
//   OPTIMISM_DEV_FUND       address
// Optimism verifier (OpStackFaultProofVerifier.Config — same fields as
// 34_optimism_lock_prove_mint.test.cjs):
//   OPTIMISM_ENVIRONMENT_ID              string   environmentId
//   OPTIMISM_REGISTRY                    address  registry
//   OPTIMISM_DISPUTE_GAME_FACTORY        address  disputeGameFactory
//   OPTIMISM_GAME_CREATED_TOPIC          bytes32  gameCreatedTopic
//   OPTIMISM_GAME_RESOLVED_TOPIC         bytes32  gameResolvedTopic
//   OPTIMISM_RESPECTED_GAME_TYPE         uint32   respectedGameType
//       (0 = CANNON is valid; zero-check is skipped for this field)
//   OPTIMISM_GAME_FINALITY_DELAY_SECONDS uint64   gameFinalityDelaySeconds
//       (must be > 0)
//   OPTIMISM_SOURCE_VAULT                address  sourceVault
//   OPTIMISM_LOCK_EVENT_TOPIC            bytes32  lockEventTopic
//
// Base vault (VinculumFinalisBaseVault — constructor is verifier + devFund;
// environment id is still required for the five-env inventory):
//   BASE_ENVIRONMENT_ID string
//   BASE_DEV_FUND       address
// Base verifier (BaseSameChainVerifier):
//   BASE_VAULT          address
//
// Usage:
//   npx hardhat run scripts/deploy-five.cjs
//
// Testable without network:
//   const { assertDeployEnv } = require("../scripts/deploy-five.cjs");
//   assertDeployEnv(env);  // throws before any deploy
// =============================================================================

"use strict";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const ZERO_BYTES32 =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

/** Address fields that must be present and non-zero. */
const ADDRESS_KEYS = [
  "VCLM_TOKEN",
  "CHONX_TOKEN",
  "PRICE_PUBLISHER",
  "CAP",
  "ETHEREUM_DEV_FUND",
  "ETHEREUM_REGISTRY",
  "ETHEREUM_SOURCE_VAULT",
  "POLYGON_DEV_FUND",
  "POLYGON_REGISTRY",
  "POLYGON_CHECKPOINT_CONTRACT",
  "POLYGON_SOURCE_VAULT",
  "ARBITRUM_DEV_FUND",
  "ARBITRUM_REGISTRY",
  "ARBITRUM_ROLLUP_CONTRACT",
  "ARBITRUM_SOURCE_VAULT",
  "OPTIMISM_DEV_FUND",
  "OPTIMISM_REGISTRY",
  "OPTIMISM_DISPUTE_GAME_FACTORY",
  "OPTIMISM_SOURCE_VAULT",
  "BASE_DEV_FUND",
  "BASE_VAULT",
];

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

  const EthereumCV = await ethers.getContractFactory("EthereumChainVerifier");
  const ethereumVerifier = await EthereumCV.deploy(
    get("ETHEREUM_ENVIRONMENT_ID"),
    get("ETHEREUM_REGISTRY"),
    get("ETHEREUM_SOURCE_VAULT"),
    get("ETHEREUM_LOCK_EVENT_TOPIC")
  );
  await ethereumVerifier.waitForDeployment();

  const PolygonCV = await ethers.getContractFactory("PolygonChainVerifier");
  const polygonVerifier = await PolygonCV.deploy(
    get("POLYGON_ENVIRONMENT_ID"),
    get("POLYGON_REGISTRY"),
    get("POLYGON_CHECKPOINT_CONTRACT"),
    get("POLYGON_HEADER_BLOCK_TOPIC"),
    get("POLYGON_SOURCE_VAULT"),
    get("POLYGON_LOCK_EVENT_TOPIC")
  );
  await polygonVerifier.waitForDeployment();

  const ArbitrumCV = await ethers.getContractFactory("ArbitrumChainVerifier");
  const arbitrumVerifier = await ArbitrumCV.deploy(
    get("ARBITRUM_ENVIRONMENT_ID"),
    get("ARBITRUM_REGISTRY"),
    get("ARBITRUM_ROLLUP_CONTRACT"),
    get("ARBITRUM_ASSERTION_CONFIRMED_TOPIC"),
    get("ARBITRUM_SOURCE_VAULT"),
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
    sourceVault: get("OPTIMISM_SOURCE_VAULT"),
    lockEventTopic: get("OPTIMISM_LOCK_EVENT_TOPIC"),
  });
  await optimismVerifier.waitForDeployment();

  const BaseCV = await ethers.getContractFactory("BaseSameChainVerifier");
  const baseVerifier = await BaseCV.deploy(get("BASE_VAULT"));
  await baseVerifier.waitForDeployment();

  const out = {
    verifier: await verifier.getAddress(),
    vaults: {
      ethereum: await ethereumVault.getAddress(),
      polygon: await polygonVault.getAddress(),
      arbitrum: await arbitrumVault.getAddress(),
      optimism: await optimismVault.getAddress(),
      base: await baseVault.getAddress(),
    },
    chainVerifiers: {
      ethereum: await ethereumVerifier.getAddress(),
      polygon: await polygonVerifier.getAddress(),
      arbitrum: await arbitrumVerifier.getAddress(),
      optimism: await optimismVerifier.getAddress(),
      base: await baseVerifier.getAddress(),
    },
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
  ADDRESS_KEYS,
  STRING_KEYS,
  BYTES32_KEYS,
};

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
