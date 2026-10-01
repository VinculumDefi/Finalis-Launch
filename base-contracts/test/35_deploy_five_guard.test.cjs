// =============================================================================
// deploy-five env guard + vault wiring
//
// - assertDeployEnv refuses zero / missing params before any deploy
// - deployFive on Hardhat wires each chain verifier to the vault it deployed
//   and registers all five via registerChainVerifier
//
// No keys, mnemonics, or real addresses committed.
// =============================================================================

const { expect } = require("chai");
const { ethers } = require("hardhat");
const {
  assertDeployEnv,
  deployFive,
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
    env.ETHEREUM_REGISTRY = ZERO_ADDRESS;
    expect(() => assertDeployEnv(env)).to.throw(
      /refusing to deploy.*ETHEREUM_REGISTRY/
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

describe("35_deploy_five_guard — deployFive vault wiring", function () {
  it("registers each chain verifier with the vault deployFive deployed", async function () {
    this.timeout(120000);

    const env = validEnv();
    const out = await deployFive(ethers, env);

    const finalis = await ethers.getContractAt(
      "VinculumFinalisVerifier",
      out.verifier
    );

    const ethCvAddr = await finalis.chainVerifiers(env.ETHEREUM_ENVIRONMENT_ID);
    const polyCvAddr = await finalis.chainVerifiers(env.POLYGON_ENVIRONMENT_ID);
    const arbCvAddr = await finalis.chainVerifiers(env.ARBITRUM_ENVIRONMENT_ID);
    const opCvAddr = await finalis.chainVerifiers(env.OPTIMISM_ENVIRONMENT_ID);
    const baseCvAddr = await finalis.chainVerifiers(env.BASE_ENVIRONMENT_ID);

    expect(ethCvAddr).to.equal(out.chainVerifiers.ethereum);
    expect(polyCvAddr).to.equal(out.chainVerifiers.polygon);
    expect(arbCvAddr).to.equal(out.chainVerifiers.arbitrum);
    expect(opCvAddr).to.equal(out.chainVerifiers.optimism);
    expect(baseCvAddr).to.equal(out.chainVerifiers.base);

    const ethCv = await ethers.getContractAt("EthereumChainVerifier", ethCvAddr);
    const polyCv = await ethers.getContractAt("PolygonChainVerifier", polyCvAddr);
    const arbCv = await ethers.getContractAt("ArbitrumChainVerifier", arbCvAddr);
    const opCv = await ethers.getContractAt("OpStackFaultProofVerifier", opCvAddr);
    const baseCv = await ethers.getContractAt("BaseSameChainVerifier", baseCvAddr);

    expect(await ethCv.sourceVault()).to.equal(out.vaults.ethereum);
    expect(await polyCv.sourceVault()).to.equal(out.vaults.polygon);
    expect(await arbCv.sourceVault()).to.equal(out.vaults.arbitrum);
    expect(await opCv.sourceVault()).to.equal(out.vaults.optimism);
    expect(await baseCv.vault()).to.equal(out.vaults.base);
  });
});
