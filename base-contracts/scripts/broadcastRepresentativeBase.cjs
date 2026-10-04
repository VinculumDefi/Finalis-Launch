/**
 * Deploy the updated Base contracts to Base mainnet (chain id 8453).
 *
 * Deploys only:
 *   CommitmentVaultLock("Base", 0xFD21BF773A193CDcb9F793100CB13a8baAdc3e9a)
 *   VinculumFinalisVerifier(VCLM, CHONX)
 *   VinculumFinalisSynth(verifier, VCLM, CHONX)
 *   VinculumFinalisStake(VCLM, CHONX, synth, verifier, launchTimestamp)
 *
 * Cosmos Hub is not deployed.
 * The signer comes from a wallet prompt (eth_requestAccounts).
 * This script does not read a private key, a seed phrase, or a key file.
 * Each deploy is sent only after the wallet signs it.
 *
 * VCLM and CHONX are constructor inputs, not contracts this script deploys.
 * Set the public addresses and a nonzero launch timestamp. Do not pass a key.
 *   VCLM_ADDRESS=0x... CHONX_ADDRESS=0x... LAUNCH_TIMESTAMP=... \
 *     npx hardhat run scripts/broadcastRepresentativeBase.cjs --network base
 */
const { ethers } = require("hardhat");

const DEV_FUND = "0xFD21BF773A193CDcb9F793100CB13a8baAdc3e9a";
const ENVIRONMENT_ID = "Base";
const BASE_CHAIN_ID = 8453n;

const OMITTED = [
  "EthereumFinalityChecker",
  "BnbFinalityChecker",
  "AvalancheFinalityChecker",
  "PolygonFinalityChecker",
  "CosmosHub",
];

function refuseKeyMaterial() {
  const suspects = [
    "PRIVATE_KEY",
    "DEPLOYER_PRIVATE_KEY",
    "BASE_PRIVATE_KEY",
    "MNEMONIC",
    "SEED_PHRASE",
    "KEYSTORE",
    "KEYSTORE_PATH",
    "KEY_FILE",
  ];
  for (const key of suspects) {
    if (process.env[key]) {
      throw new Error(`Refusing to run: ${key} is set. Use the wallet prompt.`);
    }
  }
}

function requireAddress(name) {
  const value = process.env[name];
  if (!value || !ethers.isAddress(value) || ethers.getAddress(value) === ethers.ZeroAddress) {
    throw new Error(
      `Set ${name} to the public token address. Do not pass a private key. Nothing was broadcast.`
    );
  }
  return ethers.getAddress(value);
}

async function walletAccount() {
  const accounts = await ethers.provider.send("eth_requestAccounts", []);
  if (!Array.isArray(accounts) || accounts.length === 0 || !ethers.isAddress(accounts[0])) {
    throw new Error("Wallet prompt returned no signer. Nothing was broadcast.");
  }
  return ethers.getAddress(accounts[0]);
}

async function deploy(from, name, args) {
  if (OMITTED.includes(name)) {
    throw new Error(`Refusing to deploy ${name}`);
  }
  const factory = await ethers.getContractFactory(name);
  const unsigned = await factory.getDeployTransaction(...args);
  if (!unsigned || !unsigned.data || unsigned.data === "0x") {
    throw new Error(`Missing init code for ${name}`);
  }
  console.log(`Wallet prompt: sign ${name}`);
  const hash = await ethers.provider.send("eth_sendTransaction", [
    { from, data: unsigned.data, value: "0x0" },
  ]);
  console.log(`${name} tx ${hash}`);
  const receipt = await ethers.provider.waitForTransaction(hash);
  if (!receipt || receipt.status !== 1 || !receipt.contractAddress) {
    throw new Error(`${name} was not deployed. Stopping.`);
  }
  const address = ethers.getAddress(receipt.contractAddress);
  console.log(`${name} ${address}`);
  return address;
}

async function main() {
  refuseKeyMaterial();

  if (DEV_FUND !== "0xFD21BF773A193CDcb9F793100CB13a8baAdc3e9a") {
    throw new Error("Dev Fund address was modified");
  }

  const launchTimestamp = process.env.LAUNCH_TIMESTAMP;
  if (!/^[1-9][0-9]*$/.test(launchTimestamp || "")) {
    throw new Error(
      "Set LAUNCH_TIMESTAMP to a nonzero unix time. Do not pass a private key. Nothing was broadcast."
    );
  }

  const vclm = requireAddress("VCLM_ADDRESS");
  const chonx = requireAddress("CHONX_ADDRESS");

  const network = await ethers.provider.getNetwork();
  if (network.chainId !== BASE_CHAIN_ID) {
    throw new Error(
      `Refusing to run: chain id ${network.chainId} is not Base mainnet (${BASE_CHAIN_ID}). Nothing was broadcast.`
    );
  }

  const from = await walletAccount();
  console.log(`chainId: ${network.chainId}`);
  console.log(`signer: ${from}`);
  console.log(`Dev Fund: ${ethers.getAddress(DEV_FUND)}`);
  console.log(`VCLM: ${vclm}`);
  console.log(`CHONX: ${chonx}`);
  console.log(`launchTimestamp: ${launchTimestamp}`);
  console.log("Waiting for the wallet to sign each deploy. Nothing is sent before that.");

  await deploy(from, "CommitmentVaultLock", [ENVIRONMENT_ID, DEV_FUND]);
  const verifier = await deploy(from, "VinculumFinalisVerifier", [vclm, chonx]);
  const synth = await deploy(from, "VinculumFinalisSynth", [verifier, vclm, chonx]);
  await deploy(from, "VinculumFinalisStake", [vclm, chonx, synth, verifier, launchTimestamp]);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exitCode = 1;
});
