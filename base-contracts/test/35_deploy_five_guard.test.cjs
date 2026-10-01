// =============================================================================
// deploy-five env guard + vault wiring + Ethereum e2e via deployFive
//
// - assertDeployEnv refuses zero / missing params before any deploy
// - deployFive on Hardhat wires each chain verifier to the vault it deployed,
//   registers all five via registerChainVerifier, configures Dev Fund /
//   handshake / asset precision, and finalizes each vault's configuration
// - Ethereum path: lock 100 tokens → prove → mint exactly 1725 VCLM, 95% release
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
  ASSET_SYMBOL,
} = require("../scripts/deploy-five.cjs");

const NONZERO_ADDRESS = "0x1111111111111111111111111111111111111111";
const NONZERO_BYTES32 =
  "0x2222222222222222222222222222222222222222222222222222222222222222";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const ZERO = ZERO_ADDRESS;
const DAY = 86400n;
const BLOCK_NUMBER = 9000;
const ENV_ETH = "ethereum";

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

  it("refuses when ASSET_TOKEN is the zero address", function () {
    const env = validEnv();
    env.ASSET_TOKEN = ZERO_ADDRESS;
    expect(() => assertDeployEnv(env)).to.throw(
      /refusing to deploy.*ASSET_TOKEN/
    );
  });

  it("refuses when ASSET_TOKEN is missing", function () {
    const env = validEnv();
    delete env.ASSET_TOKEN;
    expect(() => assertDeployEnv(env)).to.throw(
      /refusing to deploy.*ASSET_TOKEN/
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

    // Ceremony configured by deployFive (no protocol finalize).
    expect(await finalis.handshakeAllowanceByEnvironment("ethereum")).to.equal(3);
    expect(await finalis.devFundDestinations("ethereum")).to.equal(
      env.ETHEREUM_DEV_FUND.toLowerCase()
    );
    const ethVault = await ethers.getContractAt(
      "VinculumFinalisEvmVault",
      out.vaults.ethereum
    );
    expect(await ethVault.configurationFinalized()).to.equal(true);
    expect(await ethVault.approvedAsset(env.ASSET_TOKEN)).to.equal(
      out.assetIds.ethereum
    );
  });
});

// ---- RLP helpers (mirrors 31_ethereum_lock_prove_mint) ----------------------

function rlpLen(len, offset) {
  if (len < 56) return Uint8Array.from([len + offset]);
  let h = len.toString(16);
  if (h.length % 2) h = "0" + h;
  const b = ethers.getBytes("0x" + h);
  return Uint8Array.from([b.length + offset + 55, ...b]);
}

function rlpBytes(input) {
  const b = typeof input === "string" ? ethers.getBytes(input) : input;
  if (b.length === 1 && b[0] < 0x80) return b;
  return Uint8Array.from([...rlpLen(b.length, 0x80), ...b]);
}

function rlpList(items) {
  const body = items.reduce((a, x) => Uint8Array.from([...a, ...x]), new Uint8Array());
  return Uint8Array.from([...rlpLen(body.length, 0xc0), ...body]);
}

const hex = (u8) => ethers.hexlify(u8);

function buildLog(emitter, topics, data) {
  return rlpList([
    rlpBytes(emitter),
    rlpList(topics.map((t) => rlpBytes(t))),
    rlpBytes(data),
  ]);
}

function buildReceipt({ status = 1, logs = [] }) {
  return rlpList([
    rlpBytes(status === 1 ? "0x01" : "0x"),
    rlpBytes("0x5208"),
    rlpBytes("0x" + "00".repeat(256)),
    rlpList(logs),
  ]);
}

function buildHeader(receiptsRoot) {
  const f32 = (b) => "a0" + b.slice(2);
  const body =
    f32(ethers.keccak256(ethers.toUtf8Bytes("parent"))) +
    f32(ethers.keccak256(ethers.toUtf8Bytes("ommers"))) +
    "94" + "11".repeat(20) +
    f32(ethers.keccak256(ethers.toUtf8Bytes("state"))) +
    f32(ethers.keccak256(ethers.toUtf8Bytes("txs"))) +
    f32(receiptsRoot);

  const len = body.length / 2;
  return "0x" + "f9" + len.toString(16).padStart(4, "0") + body;
}

function buildTrie(receiptHex) {
  const key = "0x80";
  const nibbles = [8, 0];
  const path = Uint8Array.from([0x20, (nibbles[0] << 4) | nibbles[1]]);
  const leaf = rlpList([rlpBytes(path), rlpBytes(receiptHex)]);
  return { root: ethers.keccak256(leaf), key, proof: [hex(leaf)] };
}

function encodeProof(blockNumber, header, key, proof, receiptHex) {
  return ethers.AbiCoder.defaultAbiCoder().encode(
    ["uint256", "bytes", "bytes", "bytes[]", "bytes"],
    [blockNumber, header, key, proof, receiptHex]
  );
}

function receiptFromHardhat(txReceipt) {
  const logs = txReceipt.logs.map((l) =>
    buildLog(l.address, [...l.topics], l.data)
  );
  return hex(buildReceipt({ status: 1, logs }));
}

async function signBatch(verifier, signer, runId, ids, prices, fetchTs) {
  const net = await ethers.provider.getNetwork();
  const digest = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint256", "address", "uint64", "bytes32", "bytes32", "uint64"],
      [net.chainId, await verifier.getAddress(), runId,
       ethers.solidityPackedKeccak256(["bytes32[]"], [ids]),
       ethers.solidityPackedKeccak256(["uint256[]"], [prices]), fetchTs]
    )
  );
  return await signer.signMessage(ethers.getBytes(digest));
}

describe("35_deploy_five_guard — Ethereum e2e via deployFive", function () {
  it("locks 100 tokens, proves via Ethereum verifier, mints 1725 VCLM, releases 95%", async function () {
    this.timeout(180000);

    const signers = await ethers.getSigners();
    const [deployer] = signers;
    const publisher = signers[9];
    const user = signers[3];
    const relayer = signers[5];
    const ethDevFund = signers[8];
    const polyDevFund = signers[7];
    const arbDevFund = signers[6];
    const opDevFund = signers[2];
    const baseDevFund = signers[1];
    const boundDestination = signers[4];

    const Token = await ethers.getContractFactory("VinculumFinalisToken");
    const vclm  = await Token.deploy("Vinculum", "VCLM", 10_000_000_000n * 10n**18n);
    const chonx = await Token.deploy("Chonx", "CHONX", 100_000_000_000n * 10n**18n);
    const synth = await Token.deploy("Synth", "SYNTH", 10_000_000n * 10n**18n);

    const launchTs = (await ethers.provider.getBlock("latest")).timestamp;
    const __cap = await (await ethers.getContractFactory("VinculumFinalisCap"))
      .deploy(10_000_000_000n * 10n ** 18n, 100_000_000_000n * 10n ** 18n);

    const Mock = await ethers.getContractFactory("MockERC20");
    const token = await Mock.deploy("MockUSD", ASSET_SYMBOL, 18, 10n**30n);

    const M = await ethers.getContractFactory("MockL1Block");
    const mockL1 = await M.deploy();
    const R = await ethers.getContractFactory("L1BlockRegistry");
    const registry = await R.deploy(await mockL1.getAddress());

    const EvmVault = await ethers.getContractFactory("VinculumFinalisEvmVault");
    const TOPIC = EvmVault.interface.getEvent("CommitVaultLock").topicHash;

    const env = validEnv();
    env.VCLM_TOKEN = await vclm.getAddress();
    env.CHONX_TOKEN = await chonx.getAddress();
    env.PRICE_PUBLISHER = publisher.address;
    env.LAUNCH_TIMESTAMP = String(launchTs);
    env.CAP = await __cap.getAddress();
    env.ASSET_TOKEN = await token.getAddress();
    env.ETHEREUM_DEV_FUND = ethDevFund.address;
    env.POLYGON_DEV_FUND = polyDevFund.address;
    env.ARBITRUM_DEV_FUND = arbDevFund.address;
    env.OPTIMISM_DEV_FUND = opDevFund.address;
    env.BASE_DEV_FUND = baseDevFund.address;
    env.ETHEREUM_REGISTRY = await registry.getAddress();
    env.ETHEREUM_LOCK_EVENT_TOPIC = TOPIC;
    // Other chains keep placeholder registry/topics from validEnv — unused here.

    const out = await deployFive(ethers, env);

    const verifier = await ethers.getContractAt(
      "VinculumFinalisVerifier",
      out.verifier
    );
    const vault = await ethers.getContractAt(
      "VinculumFinalisEvmVault",
      out.vaults.ethereum
    );
    const ethVerifier = await ethers.getContractAt(
      "EthereumChainVerifier",
      out.chainVerifiers.ethereum
    );
    const AID = out.assetIds.ethereum;

    const Stake = await ethers.getContractFactory("VinculumFinalisStake");
    const stake = await Stake.deploy(
      await vclm.getAddress(), await chonx.getAddress(),
      await synth.getAddress(), out.verifier, launchTs,
      await __cap.getAddress()
    );
    await __cap.initialize(out.verifier, await stake.getAddress());
    await vclm.initialize(out.verifier, await stake.getAddress());
    await chonx.initialize(out.verifier, ZERO);
    await synth.initialize(out.verifier, ZERO);

    // Protocol finalize is the test's responsibility — deployFive does not call it.
    await verifier.finalize();

    const ts = (await ethers.provider.getBlock("latest")).timestamp;
    const sig = await signBatch(verifier, publisher, 1n, [AID], [1_000_000n], ts);
    await verifier.submitPriceBatch(1n, [AID], [1_000_000n], ts, sig);

    await token.transfer(user.address, 10n**24n);
    await token.connect(user).approve(out.vaults.ethereum, 10n**24n);

    const expectedMint = 1725n * 10n**18n;
    const expectedPrincipal = 95n * 10n**18n;
    const expectedFee = 5n * 10n**18n;

    const vaultLockId = ethers.keccak256(ethers.toUtf8Bytes("deploy-five-eth-e2e"));
    const releaseDestination = boundDestination.address;
    const gross = 100n * 10n**18n;
    const duration = 30n * DAY;

    const devBefore = await token.balanceOf(ethDevFund.address);
    const tx = await vault.connect(user).createLock({
      lockId: vaultLockId,
      asset: await token.getAddress(),
      grossAmount: gross,
      durationSecs: duration,
      baseRecipient: user.address,
      releaseDestination,
      outputToken: 0,
      chonxActivationReceipt: ethers.ZeroHash,
    });
    const txReceipt = await tx.wait();
    const record = await vault.getLock(vaultLockId);

    expect(record.principalAmount).to.equal(expectedPrincipal);
    expect(record.feeAmount).to.equal(expectedFee);
    expect(await token.balanceOf(record.lockContract)).to.equal(expectedPrincipal);
    expect(await token.balanceOf(ethDevFund.address) - devBefore).to.equal(expectedFee);

    const receiptHex = receiptFromHardhat(txReceipt);
    const trie = buildTrie(receiptHex);
    const header = buildHeader(trie.root);

    await mockL1.set(BLOCK_NUMBER, ethers.keccak256(header), Number(record.creationTime));
    await registry.record();

    const lockEventProof = encodeProof(
      BLOCK_NUMBER, header, trie.key, trie.proof, receiptHex
    );

    const commitmentVaultLockId = ethers.solidityPackedKeccak256(
      ["string", "address", "bytes32"],
      [ENV_ETH, out.vaults.ethereum, vaultLockId]
    );

    const pkg = {
      sourceEnvironmentId: ENV_ETH,
      commitmentVaultLockId,
      handshakeIdentity: `${ENV_ETH}:${user.address.toLowerCase()}`,
      handshakeAllowanceCount: record.handshakeAllowanceCount,
      canonicalAssetId: AID,
      assetPrecision: 18,
      assetCustodyClass: 1,
      grossAmountSmallestUnits: record.grossAmount,
      actualFeeAmountSmallestUnits: record.feeAmount,
      principalAmountSmallestUnits: record.principalAmount,
      feeAssetId: AID,
      devFundDestination: ethDevFund.address.toLowerCase(),
      feeTransferEvidence: ethers.keccak256(ethers.toUtf8Bytes("fee-deploy-five-eth")),
      valuationTimestamp: Number(record.creationTime),
      maturityTimestamp: Number(record.maturityTime),
      durationSecs: record.durationSecs,
      selectedOutputToken: 0,
      baseRecipient: record.baseRecipient,
      releaseDestination: releaseDestination.toLowerCase(),
      chonxActivationReceipt: "0x",
      racIdentity: ethers.keccak256(ethers.toUtf8Bytes("rac-deploy-five-eth")),
      sourceFinalityProof: "0x",
      lockEventProof,
    };

    const [finalized] = await ethVerifier.verifyFinality(lockEventProof, "0x");
    expect(finalized).to.equal(true);

    const before = await vclm.balanceOf(user.address);
    await verifier.connect(relayer).recordFeeAndRac(pkg);
    await verifier.connect(relayer).verifyAndMint(pkg);
    const minted = await vclm.balanceOf(user.address) - before;
    console.log(`\n    deployFive Ethereum e2e: minted ${ethers.formatUnits(minted, 18)} VCLM\n`);
    expect(minted).to.equal(expectedMint);

    const lock = await ethers.getContractAt("CommitmentLock", record.lockContract);
    await expect(lock.release()).to.be.revertedWithCustomError(lock, "NotMature");

    await ethers.provider.send("evm_increaseTime", [Number(30n * DAY)]);
    await ethers.provider.send("evm_mine", []);

    const destBefore = await token.balanceOf(boundDestination.address);
    await lock.connect(relayer).release();
    expect(await token.balanceOf(record.lockContract)).to.equal(0n);
    expect(await token.balanceOf(boundDestination.address) - destBefore)
      .to.equal(expectedPrincipal);
  });
});
