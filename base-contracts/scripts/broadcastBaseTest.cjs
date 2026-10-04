/**
 * Deploy five lock contracts to Base mainnet (chain id 8453).
 *
 * The signer comes from a wallet prompt (eth_requestAccounts). This script
 * does not read a private key, a seed phrase, or a key file.
 * Each deploy is sent only after the wallet signs it.
 *
 * Included:
 *   CommitmentVaultLock("Base", 0xFD21BF773A193CDcb9F793100CB13a8baAdc3e9a)
 *   ArbitrumFinalityChecker()
 *   BitcoinHeaderChecker()
 *   OptimismFinalityChecker()
 *   ZcashHeaderChecker()
 *
 * Not deployed: EthereumFinalityChecker, BnbFinalityChecker,
 * AvalancheFinalityChecker, PolygonFinalityChecker.
 *
 * Point Hardhat at a wallet RPC that prompts, then run:
 *   npx hardhat run scripts/broadcastBaseTest.cjs --network base
 */
const { ethers } = require("hardhat");

const DEV_FUND = "0xFD21BF773A193CDcb9F793100CB13a8baAdc3e9a";
const ENVIRONMENT_ID = "Base";
const BASE_CHAIN_ID = 8453n;

const PLANNED = [
  { name: "CommitmentVaultLock", args: [ENVIRONMENT_ID, DEV_FUND] },
  { name: "ArbitrumFinalityChecker", args: [] },
  { name: "BitcoinHeaderChecker", args: [] },
  { name: "OptimismFinalityChecker", args: [] },
  { name: "ZcashHeaderChecker", args: [] },
];

const FORBIDDEN = [
  "EthereumFinalityChecker",
  "BnbFinalityChecker",
  "AvalancheFinalityChecker",
  "PolygonFinalityChecker",
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

async function main() {
  refuseKeyMaterial();

  if (DEV_FUND !== "0xFD21BF773A193CDcb9F793100CB13a8baAdc3e9a") {
    throw new Error("Dev Fund address was modified");
  }

  for (const name of FORBIDDEN) {
    if (PLANNED.some((item) => item.name === name)) {
      throw new Error(`Refusing to deploy ${name}`);
    }
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

  for (const item of PLANNED) {
    const factory = await ethers.getContractFactory(item.name);
    const unsigned = await factory.getDeployTransaction(...item.args);
    if (!unsigned || !unsigned.data || unsigned.data === "0x") {
      throw new Error(`Missing init code for ${item.name}`);
    }
    const tx = {
      from,
      data: unsigned.data,
      value: "0x0",
    };
    console.log(`Wallet prompt: sign ${item.name}`);
    const hash = await ethers.provider.send("eth_sendTransaction", [tx]);
    console.log(`${item.name} tx ${hash}`);
    const receipt = await ethers.provider.waitForTransaction(hash);
    if (!receipt || receipt.status !== 1 || !receipt.contractAddress) {
      throw new Error(`${item.name} was not deployed. Stopping.`);
    }
    console.log(`${item.name} ${ethers.getAddress(receipt.contractAddress)}`);
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exitCode = 1;
});
