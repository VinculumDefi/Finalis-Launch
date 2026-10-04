/**
 * Deploy the updated Base contracts to Base mainnet (chain id 8453).
 *
 * Order:
 *   1. VCLM  (VinculumFinalisToken)
 *   2. CHONX (VinculumFinalisToken)
 *   3. CommitmentVaultLock("Base", Dev Fund)
 *   4. VinculumFinalisVerifier(vclm, chonx)
 *   5. VinculumFinalisSynth(verifier, vclm, chonx)
 *   6. VinculumFinalisStake(vclm, chonx, synth, verifier, vclmBlockTimestamp)
 *
 * Stake is after synth because its constructor takes the synth address.
 * The launch time is the timestamp of the block that included the VCLM deploy.
 * Addresses come from those receipts. Nothing is read from the environment.
 *
 * Cosmos Hub is not deployed.
 * The signer comes from a wallet prompt (eth_requestAccounts).
 * This script does not read a private key, a seed phrase, or a key file.
 * Each deploy is sent only after the wallet signs it.
 *
 *   npx hardhat run scripts/broadcastRepresentativeBase.cjs --network base
 */
const { ethers } = require("hardhat");

const DEV_FUND = "0xFD21BF773A193CDcb9F793100CB13a8baAdc3e9a";
const ENVIRONMENT_ID = "Base";
const BASE_CHAIN_ID = 8453n;
const VCLM_HARD_CAP = 10_000_000_000n * 10n ** 18n;
const CHONX_HARD_CAP = 100_000_000_000n * 10n ** 18n;

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
  return { address, receipt };
}

async function main() {
  refuseKeyMaterial();

  if (DEV_FUND !== "0xFD21BF773A193CDcb9F793100CB13a8baAdc3e9a") {
    throw new Error("Dev Fund address was modified");
  }

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
  console.log("Waiting for the wallet to sign each deploy. Nothing is sent before that.");

  const vclm = await deploy(from, "VinculumFinalisToken", [
    "Vinculum",
    "VCLM",
    VCLM_HARD_CAP,
  ]);
  const vclmBlock = await ethers.provider.getBlock(vclm.receipt.blockNumber);
  if (!vclmBlock || !vclmBlock.timestamp) {
    throw new Error("VCLM deploy block has no timestamp. Stopping.");
  }
  const launchTimestamp = vclmBlock.timestamp;
  console.log(`launchTimestamp: ${launchTimestamp}`);

  const chonx = await deploy(from, "VinculumFinalisToken", [
    "Chonx",
    "CHONX",
    CHONX_HARD_CAP,
  ]);

  await deploy(from, "CommitmentVaultLock", [ENVIRONMENT_ID, DEV_FUND]);
  const verifier = await deploy(from, "VinculumFinalisVerifier", [
    vclm.address,
    chonx.address,
  ]);
  const synth = await deploy(from, "VinculumFinalisSynth", [
    verifier.address,
    vclm.address,
    chonx.address,
  ]);
  await deploy(from, "VinculumFinalisStake", [
    vclm.address,
    chonx.address,
    synth.address,
    verifier.address,
    launchTimestamp,
  ]);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exitCode = 1;
});
