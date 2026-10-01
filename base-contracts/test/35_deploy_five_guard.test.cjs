// =============================================================================
// deploy-five env guard — refuses zero / missing params before any deploy
//
// Calls assertDeployEnv only. No network, no keys, no real addresses committed.
// =============================================================================

const { expect } = require("chai");
const {
  assertDeployEnv,
  ADDRESS_KEYS,
  BYTES32_KEYS,
} = require("../scripts/deploy-five.cjs");

const NONZERO_ADDRESS = "0x1111111111111111111111111111111111111111";
const NONZERO_BYTES32 =
  "0x2222222222222222222222222222222222222222222222222222222222222222";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function validEnv() {
  const env = {
    LAUNCH_TIMESTAMP: "1700000000",
    OPTIMISM_RESPECTED_GAME_TYPE: "0",
    OPTIMISM_GAME_FINALITY_DELAY_SECONDS: "302400",
  };
  for (const k of ADDRESS_KEYS) env[k] = NONZERO_ADDRESS;
  for (const k of BYTES32_KEYS) env[k] = NONZERO_BYTES32;
  env.ETHEREUM_ENVIRONMENT_ID = "ethereum";
  env.POLYGON_ENVIRONMENT_ID = "polygon";
  env.ARBITRUM_ENVIRONMENT_ID = "arbitrum";
  env.OPTIMISM_ENVIRONMENT_ID = "optimism";
  env.BASE_ENVIRONMENT_ID = "base";
  return env;
}

describe("35_deploy_five_guard — assertDeployEnv", function () {
  it("accepts a fully populated non-zero env", function () {
    expect(() => assertDeployEnv(validEnv())).to.not.throw();
  });

  it("refuses when an address is the zero address", function () {
    const env = validEnv();
    env.ETHEREUM_SOURCE_VAULT = ZERO_ADDRESS;
    expect(() => assertDeployEnv(env)).to.throw(
      /refusing to deploy.*ETHEREUM_SOURCE_VAULT/
    );
  });

  it("refuses when BASE_VAULT is zero (no deploy attempted)", function () {
    const env = validEnv();
    env.BASE_VAULT = ZERO_ADDRESS;
    expect(() => assertDeployEnv(env)).to.throw(
      /refusing to deploy.*BASE_VAULT/
    );
  });

  it("refuses when a required address is missing", function () {
    const env = validEnv();
    delete env.VCLM_TOKEN;
    expect(() => assertDeployEnv(env)).to.throw(
      /refusing to deploy.*VCLM_TOKEN/
    );
  });

  it("refuses when LAUNCH_TIMESTAMP is zero", function () {
    const env = validEnv();
    env.LAUNCH_TIMESTAMP = "0";
    expect(() => assertDeployEnv(env)).to.throw(
      /refusing to deploy.*LAUNCH_TIMESTAMP/
    );
  });

  it("allows OPTIMISM_RESPECTED_GAME_TYPE of 0 (CANNON)", function () {
    const env = validEnv();
    env.OPTIMISM_RESPECTED_GAME_TYPE = "0";
    expect(() => assertDeployEnv(env)).to.not.throw();
  });
});
