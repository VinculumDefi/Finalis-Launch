/**
 * Prints the representative sixteen-environment deployment.
 * Does not call deploy(), sendTransaction(), or provider.send().
 * Does not read a private key. Does not broadcast.
 */
const { EVM_DEV_FUND, HANDSHAKE_RULE, rows } = require("../deployment/representativeBase.cjs");

function assertNoPrivateKeyInEnv() {
  const suspects = ["PRIVATE_KEY", "DEPLOYER_PRIVATE_KEY", "BASE_PRIVATE_KEY", "MNEMONIC"];
  for (const key of suspects) {
    if (process.env[key]) {
      throw new Error(`Refusing to run: ${key} is set. This script does not sign or broadcast.`);
    }
  }
}

function main() {
  assertNoPrivateKeyInEnv();
  if (process.argv.includes("--broadcast")) {
    throw new Error("Refusing to broadcast. This script only prints destinations.");
  }
  if (rows.length !== 16) {
    throw new Error(`expected 16 environments, found ${rows.length}`);
  }
  if (rows.some((row) => /cosmos|atom/i.test(row.environment))) {
    throw new Error("Cosmos Hub is not part of this deployment");
  }
  console.log("DRY RUN: representative deployment. No transaction will be sent.");
  console.log(`EVM Dev Fund (Base and the other six EVM environments): ${EVM_DEV_FUND}`);
  console.log(
    `Handshake (${HANDSHAKE_RULE.authority}), every environment: 1 hour, $${HANDSHAKE_RULE.usdMin} to $${HANDSHAKE_RULE.usdMax}, ${HANDSHAKE_RULE.feeBps / 100}% fee, no allowance limit`
  );
  for (const row of rows) {
    console.log(
      `${row.environment}\t${row.lock}\t${row.devFund}`
    );
  }
  console.log("Stopped before broadcast.");
}

main();
