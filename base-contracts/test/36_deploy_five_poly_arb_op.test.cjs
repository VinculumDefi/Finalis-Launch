// =============================================================================
// deployFive e2e — Polygon, Arbitrum, Optimism through the stack deployFive
// returns (sibling to 35's Ethereum deployFive e2e).
//
// Proof building matches 32/33/34 (Polygon Heimdall checkpoint, Arbitrum
// AssertionConfirmed, OpStack DisputeGameCreated+Resolved). Do NOT reuse the
// Ethereum single-receipt-trie path.
//
// Fixture: lock 100 tokens → mint exactly 1725 VCLM, dev fund 5%, release
// before maturity reverts, bound destination receives exactly 95%.
// =============================================================================

const { expect } = require("chai");
const { ethers } = require("hardhat");
const {
  deployFive,
  ADDRESS_KEYS,
  BYTES32_KEYS,
  ASSET_SYMBOL,
} = require("../scripts/deploy-five.cjs");

const NONZERO_ADDRESS = "0x1111111111111111111111111111111111111111";
const NONZERO_BYTES32 =
  "0x2222222222222222222222222222222222222222222222222222222222222222";
const ZERO = "0x0000000000000000000000000000000000000000";
const DAY = 86400n;

const POLY_CHECKPOINT = "0x5555555555555555555555555555555555555555";
const POLY_HEADER_TOPIC = ethers.keccak256(
  ethers.toUtf8Bytes("NewHeaderBlock(address,uint256,uint256,uint256,uint256,bytes32)")
);
const POLY_L1_BLOCK = 7000;
const POLY_BOR_BLOCK = 1000;

const ARB_ROLLUP = "0xaaaa000000000000000000000000000000000001";
const ARB_CONFIRM_TOPIC = ethers.keccak256(
  ethers.toUtf8Bytes("AssertionConfirmed(bytes32,bytes32,bytes32)")
);
const ARB_SEND_ROOT = ethers.keccak256(ethers.toUtf8Bytes("send-root"));
const ARB_L1_BLOCK = 6000;

const OP_FACTORY = "0x5555555555555555555555555555555555555555";
const OP_GAME_PROXY = "0x6666666666666666666666666666666666666666";
const OP_CREATED_TOPIC = ethers.keccak256(
  ethers.toUtf8Bytes("DisputeGameCreated(address,uint32,bytes32)")
);
const OP_RESOLVED_TOPIC = ethers.keccak256(ethers.toUtf8Bytes("Resolved(uint8)"));
const OP_RESPECTED_GAME_TYPE = 0;
const OP_AIRGAP = 302400;
const OP_DEFENDER_WINS = 2;
const OP_CREATED_BLOCK = 8000;
const OP_RESOLVED_BLOCK = 8100;
const OP_LATEST_BLOCK = 9000;
const OP_VERSION = ethers.ZeroHash;
const OP_L2_STATE = ethers.keccak256(ethers.toUtf8Bytes("l2-state"));
const OP_MSG_PASSER = ethers.keccak256(ethers.toUtf8Bytes("msg-passer"));

function validEnv() {
  const env = {
    LAUNCH_TIMESTAMP: "1700000000",
    OPTIMISM_RESPECTED_GAME_TYPE: "0",
    OPTIMISM_GAME_FINALITY_DELAY_SECONDS: String(OP_AIRGAP),
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

// ---- RLP helpers (shared shape; path encoding matches 20/21/23) --------------

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
const word = (v) => ethers.zeroPadValue(ethers.toBeHex(BigInt(v)), 32).slice(2);
const topic32 = (v) => ethers.zeroPadValue(ethers.toBeHex(BigInt(v)), 32);

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

function buildHeader(receiptsRoot, salt) {
  const f = (b) => "a0" + b.slice(2);
  const body =
    f(ethers.keccak256(ethers.toUtf8Bytes("parent" + salt))) +
    f(ethers.keccak256(ethers.toUtf8Bytes("ommers"))) +
    "94" + "11".repeat(20) +
    f(ethers.keccak256(ethers.toUtf8Bytes("state"))) +
    f(ethers.keccak256(ethers.toUtf8Bytes("txs"))) +
    f(receiptsRoot);
  const len = body.length / 2;
  return "0x" + "f9" + len.toString(16).padStart(4, "0") + body;
}

function buildTrie(receiptHex) {
  const path = Uint8Array.from([0x20, 0x80]);
  const leaf = rlpList([rlpBytes(path), rlpBytes(receiptHex)]);
  return { root: ethers.keccak256(leaf), key: "0x80", proof: [hex(leaf)] };
}

function receiptFromHardhat(txReceipt) {
  const logs = txReceipt.logs.map((l) =>
    buildLog(l.address, [...l.topics], l.data)
  );
  return hex(buildReceipt({ status: 1, logs }));
}

function checkpointLeaf(blockNumber, blockTime, txRoot, receiptRoot) {
  return ethers.solidityPackedKeccak256(
    ["uint256", "uint256", "bytes32", "bytes32"],
    [blockNumber, blockTime, txRoot, receiptRoot]
  );
}

function buildCheckpointTree(leaf, sibling) {
  const root = ethers.solidityPackedKeccak256(["bytes32", "bytes32"], [leaf, sibling]);
  return { root, proof: [sibling] };
}

function encodePolygonProof(p) {
  return ethers.AbiCoder.defaultAbiCoder().encode(
    ["uint256", "bytes", "bytes", "bytes[]", "bytes",
     "uint256[2]", "bytes32[2]", "bytes32[]", "bytes", "bytes[]", "bytes"],
    [p.l1BlockNumber, p.l1Header, p.l1Key, p.l1Proof, p.l1Receipt,
     [p.borBlockNumber, p.borTime], [p.borTxRoot, p.borReceiptRoot],
     p.checkpointProof, p.borKey, p.borProof, p.borReceipt]
  );
}

function encodeArbitrumProof(p) {
  return ethers.AbiCoder.defaultAbiCoder().encode(
    ["uint256", "bytes", "bytes", "bytes[]", "bytes",
     "bytes", "bytes", "bytes[]", "bytes"],
    [p.l1BlockNumber, p.l1Header, p.l1Key, p.l1Proof, p.l1Receipt,
     p.l2Header, p.l2Key, p.l2Proof, p.l2Receipt]
  );
}

function outputRoot(version, stateRoot, msgPasser, blockHash) {
  return ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["bytes32", "bytes32", "bytes32", "bytes32"],
      [version, stateRoot, msgPasser, blockHash]
    )
  );
}

function encodeOpStackProof(p) {
  return ethers.AbiCoder.defaultAbiCoder().encode(
    ["uint256[2]", "bytes[3]", "bytes[3]", "bytes[][3]", "bytes[3]", "bytes32[4]"],
    [
      [p.createdBlockNumber, p.resolvedBlockNumber],
      [p.createdHeader, p.resolvedHeader, p.l2Header],
      [p.createdKey, p.resolvedKey, p.l2Key],
      [p.createdProof, p.resolvedProof, p.l2Proof],
      [p.createdReceipt, p.resolvedReceipt, p.l2Receipt],
      [p.version, p.stateRoot, p.msgPasser, p.l2BlockHash],
    ]
  );
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

/**
 * Deploy tokens + MockL1/registry, then deployFive with chain-specific env
 * overrides. Caller supplies `configureEnv(env, { registry, topic, ... })`.
 */
async function deployFiveStack(configureEnv) {
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
  env.ETHEREUM_LOCK_EVENT_TOPIC = TOPIC;
  env.POLYGON_LOCK_EVENT_TOPIC = TOPIC;
  env.ARBITRUM_LOCK_EVENT_TOPIC = TOPIC;
  env.OPTIMISM_LOCK_EVENT_TOPIC = TOPIC;

  configureEnv(env, {
    registry: await registry.getAddress(),
    topic: TOPIC,
  });

  const out = await deployFive(ethers, env);

  const verifier = await ethers.getContractAt(
    "VinculumFinalisVerifier",
    out.verifier
  );

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

  return {
    deployer, publisher, user, relayer, boundDestination,
    ethDevFund, polyDevFund, arbDevFund, opDevFund, baseDevFund,
    vclm, chonx, synth, token, mockL1, registry, TOPIC,
    verifier, out, env,
  };
}

async function submitPrice(s, aid) {
  const ts = (await ethers.provider.getBlock("latest")).timestamp;
  const sig = await signBatch(s.verifier, s.publisher, 1n, [aid], [1_000_000n], ts);
  await s.verifier.submitPriceBatch(1n, [aid], [1_000_000n], ts, sig);
  await s.token.transfer(s.user.address, 10n**24n);
}

async function createLock(s, vaultAddr, tag) {
  const vault = await ethers.getContractAt("VinculumFinalisEvmVault", vaultAddr);
  await s.token.connect(s.user).approve(vaultAddr, 10n**24n);

  const vaultLockId = ethers.keccak256(ethers.toUtf8Bytes(tag));
  const releaseDestination = s.boundDestination.address;
  const gross = 100n * 10n**18n;
  const duration = 30n * DAY;

  const tx = await vault.connect(s.user).createLock({
    lockId: vaultLockId,
    asset: await s.token.getAddress(),
    grossAmount: gross,
    durationSecs: duration,
    baseRecipient: s.user.address,
    releaseDestination,
    outputToken: 0,
    chonxActivationReceipt: ethers.ZeroHash,
  });
  const txReceipt = await tx.wait();
  const record = await vault.getLock(vaultLockId);
  return { vault, vaultLockId, releaseDestination, record, txReceipt };
}

async function assertMintAndRelease(s, {
  envId, vaultAddr, chainVerifier, aid, devFund, tag, lockEventProof, record, label,
}) {
  const expectedMint = 1725n * 10n**18n;
  const expectedPrincipal = 95n * 10n**18n;
  const expectedFee = 5n * 10n**18n;

  expect(record.principalAmount).to.equal(expectedPrincipal);
  expect(record.feeAmount).to.equal(expectedFee);
  expect(await s.token.balanceOf(record.lockContract)).to.equal(expectedPrincipal);

  const [finalized] = await chainVerifier.verifyFinality(lockEventProof, "0x");
  expect(finalized).to.equal(true);

  const commitmentVaultLockId = ethers.solidityPackedKeccak256(
    ["string", "address", "bytes32"],
    [envId, vaultAddr, ethers.keccak256(ethers.toUtf8Bytes(tag))]
  );

  const pkg = {
    sourceEnvironmentId: envId,
    commitmentVaultLockId,
    handshakeIdentity: `${envId}:${s.user.address.toLowerCase()}`,
    handshakeAllowanceCount: record.handshakeAllowanceCount,
    canonicalAssetId: aid,
    assetPrecision: 18,
    assetCustodyClass: 1,
    grossAmountSmallestUnits: record.grossAmount,
    actualFeeAmountSmallestUnits: record.feeAmount,
    principalAmountSmallestUnits: record.principalAmount,
    feeAssetId: aid,
    devFundDestination: devFund.address.toLowerCase(),
    feeTransferEvidence: ethers.keccak256(ethers.toUtf8Bytes(`fee-${tag}`)),
    valuationTimestamp: Number(record.creationTime),
    maturityTimestamp: Number(record.maturityTime),
    durationSecs: record.durationSecs,
    selectedOutputToken: 0,
    baseRecipient: record.baseRecipient,
    releaseDestination: s.boundDestination.address.toLowerCase(),
    chonxActivationReceipt: "0x",
    racIdentity: ethers.keccak256(ethers.toUtf8Bytes(`rac-${tag}`)),
    sourceFinalityProof: "0x",
    lockEventProof,
  };

  const before = await s.vclm.balanceOf(s.user.address);
  await s.verifier.connect(s.relayer).recordFeeAndRac(pkg);
  await s.verifier.connect(s.relayer).verifyAndMint(pkg);
  const minted = await s.vclm.balanceOf(s.user.address) - before;
  console.log(`\n    deployFive ${label} e2e: minted ${ethers.formatUnits(minted, 18)} VCLM\n`);
  expect(minted).to.equal(expectedMint);

  const lock = await ethers.getContractAt("CommitmentLock", record.lockContract);
  await expect(lock.release()).to.be.revertedWithCustomError(lock, "NotMature");

  await ethers.provider.send("evm_increaseTime", [Number(30n * DAY)]);
  await ethers.provider.send("evm_mine", []);

  const destBefore = await s.token.balanceOf(s.boundDestination.address);
  await lock.connect(s.relayer).release();
  expect(await s.token.balanceOf(record.lockContract)).to.equal(0n);
  expect(await s.token.balanceOf(s.boundDestination.address) - destBefore)
    .to.equal(expectedPrincipal);
}

// =============================================================================
// Polygon
// =============================================================================

describe("36_deploy_five — Polygon e2e via deployFive", function () {
  it("locks, proves via PolygonChainVerifier, mints 1725 VCLM, releases 95%", async function () {
    this.timeout(180000);

    const s = await deployFiveStack((env, { registry }) => {
      env.POLYGON_REGISTRY = registry;
      env.POLYGON_CHECKPOINT_CONTRACT = POLY_CHECKPOINT;
      env.POLYGON_HEADER_BLOCK_TOPIC = POLY_HEADER_TOPIC;
    });

    const AID = s.out.assetIds.polygon;
    const vaultAddr = s.out.vaults.polygon;
    const polyVerifier = await ethers.getContractAt(
      "PolygonChainVerifier",
      s.out.chainVerifiers.polygon
    );

    await submitPrice(s, AID);

    const expectedFee = 5n * 10n**18n;
    const devBefore = await s.token.balanceOf(s.polyDevFund.address);
    const tag = "deploy-five-poly-e2e";
    const { vaultLockId, record, txReceipt } = await createLock(s, vaultAddr, tag);
    expect(await s.token.balanceOf(s.polyDevFund.address) - devBefore).to.equal(expectedFee);

    const borReceipt = receiptFromHardhat(txReceipt);
    const borTrie = buildTrie(borReceipt);
    const borTime = Number(record.creationTime);
    const borTxRoot = ethers.keccak256(ethers.toUtf8Bytes("bor-tx-root"));

    const leaf = checkpointLeaf(POLY_BOR_BLOCK, borTime, borTxRoot, borTrie.root);
    const sibling = ethers.keccak256(ethers.toUtf8Bytes("sibling-leaf"));
    const tree = buildCheckpointTree(leaf, sibling);

    const start = POLY_BOR_BLOCK;
    const end = POLY_BOR_BLOCK + 10;
    const ckLog = buildLog(
      POLY_CHECKPOINT,
      [POLY_HEADER_TOPIC,
       ethers.zeroPadValue("0x01", 32),
       ethers.zeroPadValue("0x02", 32),
       ethers.zeroPadValue("0x03", 32)],
      "0x" + word(start) + word(end) + tree.root.slice(2)
    );
    const l1Receipt = hex(buildReceipt({ status: 1, logs: [ckLog] }));
    const l1Trie = buildTrie(l1Receipt);
    const l1Header = buildHeader(l1Trie.root, "l1");

    await s.mockL1.set(POLY_L1_BLOCK, ethers.keccak256(l1Header), borTime);
    await s.registry.record();

    const lockEventProof = encodePolygonProof({
      l1BlockNumber: POLY_L1_BLOCK,
      l1Header,
      l1Key: l1Trie.key,
      l1Proof: l1Trie.proof,
      l1Receipt,
      borBlockNumber: POLY_BOR_BLOCK,
      borTime,
      borTxRoot,
      borReceiptRoot: borTrie.root,
      checkpointProof: tree.proof,
      borKey: borTrie.key,
      borProof: borTrie.proof,
      borReceipt,
    });

    await assertMintAndRelease(s, {
      envId: "polygon",
      vaultAddr,
      chainVerifier: polyVerifier,
      aid: AID,
      devFund: s.polyDevFund,
      tag,
      lockEventProof,
      record,
      label: "Polygon",
    });
  });
});

// =============================================================================
// Arbitrum
// =============================================================================

describe("36_deploy_five — Arbitrum e2e via deployFive", function () {
  it("locks, proves via ArbitrumChainVerifier, mints 1725 VCLM, releases 95%", async function () {
    this.timeout(180000);

    const s = await deployFiveStack((env, { registry }) => {
      env.ARBITRUM_REGISTRY = registry;
      env.ARBITRUM_ROLLUP_CONTRACT = ARB_ROLLUP;
      env.ARBITRUM_ASSERTION_CONFIRMED_TOPIC = ARB_CONFIRM_TOPIC;
    });

    const AID = s.out.assetIds.arbitrum;
    const vaultAddr = s.out.vaults.arbitrum;
    const arbVerifier = await ethers.getContractAt(
      "ArbitrumChainVerifier",
      s.out.chainVerifiers.arbitrum
    );

    await submitPrice(s, AID);

    const expectedFee = 5n * 10n**18n;
    const devBefore = await s.token.balanceOf(s.arbDevFund.address);
    const tag = "deploy-five-arb-e2e";
    const { record, txReceipt } = await createLock(s, vaultAddr, tag);
    expect(await s.token.balanceOf(s.arbDevFund.address) - devBefore).to.equal(expectedFee);

    const l2Receipt = receiptFromHardhat(txReceipt);
    const l2Trie = buildTrie(l2Receipt);
    const l2Header = buildHeader(l2Trie.root, "arb-l2");
    const l2BlockHash = ethers.keccak256(l2Header);

    const confirmLog = buildLog(
      ARB_ROLLUP,
      [ARB_CONFIRM_TOPIC, ethers.keccak256(ethers.toUtf8Bytes("assertion"))],
      l2BlockHash + ARB_SEND_ROOT.slice(2)
    );
    const l1Receipt = hex(buildReceipt({ status: 1, logs: [confirmLog] }));
    const l1Trie = buildTrie(l1Receipt);
    const l1Header = buildHeader(l1Trie.root, "arb-l1");

    await s.mockL1.set(ARB_L1_BLOCK, ethers.keccak256(l1Header), Number(record.creationTime));
    await s.registry.record();

    const lockEventProof = encodeArbitrumProof({
      l1BlockNumber: ARB_L1_BLOCK,
      l1Header,
      l1Key: l1Trie.key,
      l1Proof: l1Trie.proof,
      l1Receipt,
      l2Header,
      l2Key: l2Trie.key,
      l2Proof: l2Trie.proof,
      l2Receipt,
    });

    await assertMintAndRelease(s, {
      envId: "arbitrum",
      vaultAddr,
      chainVerifier: arbVerifier,
      aid: AID,
      devFund: s.arbDevFund,
      tag,
      lockEventProof,
      record,
      label: "Arbitrum",
    });
  });
});

// =============================================================================
// Optimism
// =============================================================================

describe("36_deploy_five — Optimism e2e via deployFive", function () {
  it("locks, proves via OpStackFaultProofVerifier, mints 1725 VCLM, releases 95%", async function () {
    this.timeout(180000);

    const s = await deployFiveStack((env, { registry }) => {
      env.OPTIMISM_REGISTRY = registry;
      env.OPTIMISM_DISPUTE_GAME_FACTORY = OP_FACTORY;
      env.OPTIMISM_GAME_CREATED_TOPIC = OP_CREATED_TOPIC;
      env.OPTIMISM_GAME_RESOLVED_TOPIC = OP_RESOLVED_TOPIC;
      env.OPTIMISM_RESPECTED_GAME_TYPE = String(OP_RESPECTED_GAME_TYPE);
      env.OPTIMISM_GAME_FINALITY_DELAY_SECONDS = String(OP_AIRGAP);
    });

    const AID = s.out.assetIds.optimism;
    const vaultAddr = s.out.vaults.optimism;
    const opVerifier = await ethers.getContractAt(
      "OpStackFaultProofVerifier",
      s.out.chainVerifiers.optimism
    );

    await submitPrice(s, AID);

    const expectedFee = 5n * 10n**18n;
    const devBefore = await s.token.balanceOf(s.opDevFund.address);
    const tag = "deploy-five-op-e2e";
    const { record, txReceipt } = await createLock(s, vaultAddr, tag);
    expect(await s.token.balanceOf(s.opDevFund.address) - devBefore).to.equal(expectedFee);

    const createdTs = Number(record.creationTime);
    const resolvedTs = createdTs + 3600;

    const l2Receipt = receiptFromHardhat(txReceipt);
    const l2Trie = buildTrie(l2Receipt);
    const l2Header = buildHeader(l2Trie.root, "fp-l2");
    const l2BlockHash = ethers.keccak256(l2Header);
    const claim = outputRoot(OP_VERSION, OP_L2_STATE, OP_MSG_PASSER, l2BlockHash);

    const createdLog = buildLog(
      OP_FACTORY,
      [
        OP_CREATED_TOPIC,
        ethers.zeroPadValue(OP_GAME_PROXY, 32),
        topic32(OP_RESPECTED_GAME_TYPE),
        claim,
      ],
      "0x"
    );
    const createdReceipt = hex(buildReceipt({ status: 1, logs: [createdLog] }));
    const createdTrie = buildTrie(createdReceipt);
    const createdHeader = buildHeader(createdTrie.root, "fp-created");

    const resolvedLog = buildLog(
      OP_GAME_PROXY,
      [OP_RESOLVED_TOPIC, topic32(OP_DEFENDER_WINS)],
      "0x"
    );
    const resolvedReceipt = hex(buildReceipt({ status: 1, logs: [resolvedLog] }));
    const resolvedTrie = buildTrie(resolvedReceipt);
    const resolvedHeader = buildHeader(resolvedTrie.root, "fp-resolved");

    await s.mockL1.set(OP_CREATED_BLOCK, ethers.keccak256(createdHeader), createdTs);
    await s.registry.record();
    await s.mockL1.set(OP_RESOLVED_BLOCK, ethers.keccak256(resolvedHeader), resolvedTs);
    await s.registry.record();
    await s.mockL1.set(
      OP_LATEST_BLOCK,
      ethers.keccak256(ethers.toUtf8Bytes("later")),
      resolvedTs + OP_AIRGAP
    );
    await s.registry.record();

    const lockEventProof = encodeOpStackProof({
      createdBlockNumber: OP_CREATED_BLOCK,
      createdHeader,
      createdKey: createdTrie.key,
      createdProof: createdTrie.proof,
      createdReceipt,
      resolvedBlockNumber: OP_RESOLVED_BLOCK,
      resolvedHeader,
      resolvedKey: resolvedTrie.key,
      resolvedProof: resolvedTrie.proof,
      resolvedReceipt,
      version: OP_VERSION,
      stateRoot: OP_L2_STATE,
      msgPasser: OP_MSG_PASSER,
      l2BlockHash,
      l2Header,
      l2Key: l2Trie.key,
      l2Proof: l2Trie.proof,
      l2Receipt,
    });

    await assertMintAndRelease(s, {
      envId: "optimism",
      vaultAddr,
      chainVerifier: opVerifier,
      aid: AID,
      devFund: s.opDevFund,
      tag,
      lockEventProof,
      record,
      label: "Optimism",
    });
  });
});

// =============================================================================
 // Refused-on-purpose verifiers (BNB/Avalanche via EvmChainVerifier; Solana,
 // Stellar, XRPL stubs). Must NOT make a lock succeed through these.
 // =============================================================================

describe("36_deploy_five — refused-on-purpose verifiers reject", function () {
  it("SolanaChainVerifier / StellarChainVerifier / XrplChainVerifier / EvmChainVerifier revert VerifierNotImplemented", async function () {
    this.timeout(60000);

    const Sol = await ethers.getContractFactory("SolanaChainVerifier");
    const sol = await Sol.deploy();
    await expect(sol.verifyFinality("0x", "0x"))
      .to.be.revertedWithCustomError(sol, "VerifierNotImplemented")
      .withArgs("solana");
    await expect(sol.extractFacts("0x"))
      .to.be.revertedWithCustomError(sol, "VerifierNotImplemented")
      .withArgs("solana");

    const St = await ethers.getContractFactory("StellarChainVerifier");
    const st = await St.deploy();
    await expect(st.verifyFinality("0x", "0x"))
      .to.be.revertedWithCustomError(st, "VerifierNotImplemented")
      .withArgs("stellar");

    const Xr = await ethers.getContractFactory("XrplChainVerifier");
    const xr = await Xr.deploy();
    await expect(xr.verifyFinality("0x", "0x"))
      .to.be.revertedWithCustomError(xr, "VerifierNotImplemented")
      .withArgs("xrpl");

    // BNB / Avalanche share the fail-closed EvmChainVerifier stub.
    const Evm = await ethers.getContractFactory("EvmChainVerifier");
    const bnb = await Evm.deploy("bnb", "FFF", 15, 0);
    await expect(bnb.verifyFinality("0x", "0x"))
      .to.be.revertedWithCustomError(bnb, "VerifierNotImplemented");
    const avax = await Evm.deploy("avalanche", "Snowman", 1, 0);
    await expect(avax.verifyFinality("0x", "0x"))
      .to.be.revertedWithCustomError(avax, "VerifierNotImplemented");
  });
});
