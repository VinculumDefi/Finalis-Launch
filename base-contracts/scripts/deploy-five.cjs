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
 * is called for all five on VinculumFinalisVerifier.
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
