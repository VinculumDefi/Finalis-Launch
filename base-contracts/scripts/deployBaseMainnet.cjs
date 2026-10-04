/**
 * Dry-run deploy plan for Base mainnet (chain id 8453).
 *
 * Prints the CREATE addresses these contracts would receive and returns.
 * It does not call deploy(), sendTransaction(), or provider.send() with a
 * signed transaction. No private key is read or required.
 *
 * Included (constructor args come only from the Dev Fund address, the
 * environment name "Base", or no arguments):
 *   - CommitmentVaultLock(environmentId, devFund)
 *   - ArbitrumFinalityChecker()
 *   - BitcoinHeaderChecker()
 *   - OptimismFinalityChecker()
 *   - ZcashHeaderChecker()
 *
 * Omitted on purpose. Their constructors need a validator set, a stake or
 * voting-power set, or a lock-log emitter, and none of those is a published
 * constant in this repo:
 *   - AvalancheFinalityChecker(address[] validators, uint256[] stake)
 *   - BnbFinalityChecker(address[] validators)
 *   - EthereumFinalityChecker(address lockLogEmitter)
 *   - PolygonFinalityChecker(address[] validators, uint256[] power)
 *
 * Run (read-only RPC; set the public deployer address, never a key):
 *   DEPLOYER_ADDRESS=0x... npx hardhat run scripts/deployBaseMainnet.cjs --network base
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

function assertNoPrivateKeyInEnv() {
  const suspects = ["PRIVATE_KEY", "DEPLOYER_PRIVATE_KEY", "BASE_PRIVATE_KEY", "MNEMONIC"];
  for (const key of suspects) {
    if (process.env[key]) {
      throw new Error(`Refusing to run: ${key} is set. This script does not sign or broadcast.`);
    }
  }
}

async function main() {
  assertNoPrivateKeyInEnv();

  if (DEV_FUND !== "0xFD21BF773A193CDcb9F793100CB13a8baAdc3e9a") {
    throw new Error("Dev Fund address was modified");
  }
  if (!ethers.isAddress(DEV_FUND)) {
    throw new Error("Dev Fund is not an address");
  }

  const network = await ethers.provider.getNetwork();
  if (network.chainId !== BASE_CHAIN_ID) {
    throw new Error(
      `Refusing to run: chain id ${network.chainId} is not Base mainnet (${BASE_CHAIN_ID}). ` +
        "Pass --network base. Nothing was broadcast."
    );
  }

  const deployer = process.env.DEPLOYER_ADDRESS;
  if (!deployer || !ethers.isAddress(deployer)) {
    throw new Error(
      "Set DEPLOYER_ADDRESS to the public deployer address. Do not pass a private key. Nothing was broadcast."
    );
  }

  const startNonce = await ethers.provider.getTransactionCount(deployer, "latest");
  let nonce = startNonce;

  console.log("DRY RUN: Base mainnet lock deploy plan. No transaction will be sent.");
  console.log(`chainId: ${network.chainId}`);
  console.log(`Dev Fund: ${ethers.getAddress(DEV_FUND)}`);
  console.log(`environment: ${ENVIRONMENT_ID}`);
  console.log(`deployer: ${ethers.getAddress(deployer)}`);
  console.log(`startingNonce: ${startNonce} (latest)`);

  for (const item of PLANNED) {
    const factory = await ethers.getContractFactory(item.name);
    // Unsigned init transaction only. Not broadcast.
    const unsigned = await factory.getDeployTransaction(...item.args);
    if (!unsigned || !unsigned.data || unsigned.data === "0x") {
      throw new Error(`Missing init code for ${item.name}`);
    }
    const address = ethers.getCreateAddress({
      from: deployer,
      nonce,
    });
    console.log(`${item.name} ${address}`);
    nonce += 1;
  }

  console.log("Stopped before broadcast.");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exitCode = 1;
});
