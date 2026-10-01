// =============================================================================
// Optimism environment — lock → prove → mint (production verifier path)
//
// Combines the three seams that the separate suites exercise in isolation:
//   22_evm_vault               — real VinculumFinalisEvmVault.createLock
//   23_opstack_faultproof      — real OpStackFaultProofVerifier
//   13_base_e2e                — real VinculumFinalisVerifier mint of VCLM
//
// No MockChainVerifier. The lock is created on-chain; its Hardhat receipt is
// the L2 receipt; synthetic DisputeGameCreated + Resolved L1 events plus the
// output-root preimage drive OpStackFaultProofVerifier exactly as 23_ does.
// =============================================================================

const { expect } = require("chai");
const { ethers } = require("hardhat");

const ENV = "optimism";
const ZERO = "0x0000000000000000000000000000000000000000";
const DAY = 86400n;

const FACTORY = "0x5555555555555555555555555555555555555555";
const GAME_PROXY = "0x6666666666666666666666666666666666666666";

const CREATED_TOPIC = ethers.keccak256(
  ethers.toUtf8Bytes("DisputeGameCreated(address,uint32,bytes32)")
);
const RESOLVED_TOPIC = ethers.keccak256(ethers.toUtf8Bytes("Resolved(uint8)"));

const RESPECTED_GAME_TYPE = 0;
const AIRGAP = 302400;
const DEFENDER_WINS = 2;

const CREATED_BLOCK = 8000;
const RESOLVED_BLOCK = 8100;
const LATEST_BLOCK = 9000;

const VERSION = ethers.ZeroHash;
const L2_STATE = ethers.keccak256(ethers.toUtf8Bytes("l2-state"));
const MSG_PASSER = ethers.keccak256(ethers.toUtf8Bytes("msg-passer"));

function assetId(symbol) {
  return ethers.keccak256(ethers.toUtf8Bytes(`${ENV}:${symbol}`));
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

// ---- RLP helpers (mirrors 23_opstack_faultproof) ----------------------------

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

function receiptFromHardhat(txReceipt) {
  const logs = txReceipt.logs.map((l) =>
    buildLog(l.address, [...l.topics], l.data)
  );
  return hex(buildReceipt({ status: 1, logs }));
}

async function deployStack() {
  const signers = await ethers.getSigners();
  const [deployer] = signers;
  const publisher = signers[9];
  const user = signers[3];
  const relayer = signers[5];
  const boundDestination = signers[4];
  const devFund = signers[8];

  const Token = await ethers.getContractFactory("VinculumFinalisToken");
  const vclm  = await Token.deploy("Vinculum", "VCLM", 10_000_000_000n * 10n**18n);
  const chonx = await Token.deploy("Chonx", "CHONX", 100_000_000_000n * 10n**18n);
  const synth = await Token.deploy("Synth", "SYNTH", 10_000_000n * 10n**18n);

  const launchTs = (await ethers.provider.getBlock("latest")).timestamp;
  const __cap = await (await ethers.getContractFactory("VinculumFinalisCap"))
    .deploy(10_000_000_000n * 10n ** 18n, 100_000_000_000n * 10n ** 18n);
  const V = await ethers.getContractFactory("VinculumFinalisVerifier");
  const verifier = await V.deploy(
    await vclm.getAddress(), await chonx.getAddress(), publisher.address, launchTs,
    await __cap.getAddress()
  );

  const Stake = await ethers.getContractFactory("VinculumFinalisStake");
  const stake = await Stake.deploy(
    await vclm.getAddress(), await chonx.getAddress(),
    await synth.getAddress(), await verifier.getAddress(), launchTs,
    await __cap.getAddress()
  );
  await __cap.initialize(await verifier.getAddress(), await stake.getAddress());

  await vclm.initialize(await verifier.getAddress(), await stake.getAddress());
  await chonx.initialize(await verifier.getAddress(), ZERO);
  await synth.initialize(await verifier.getAddress(), ZERO);

  const Mock = await ethers.getContractFactory("MockERC20");
  const token = await Mock.deploy("MockUSD", "MUSD", 18, 10n**30n);
  const AID = assetId("MUSD");

  const Vault = await ethers.getContractFactory("VinculumFinalisEvmVault");
  const vault = await Vault.deploy(ENV, devFund.address);
  await vault.registerAsset(await token.getAddress(), AID);
  await vault.finalizeConfiguration();

  const TOPIC = vault.interface.getEvent("CommitVaultLock").topicHash;

  const M = await ethers.getContractFactory("MockL1Block");
  const mockL1 = await M.deploy();
  const R = await ethers.getContractFactory("L1BlockRegistry");
  const registry = await R.deploy(await mockL1.getAddress());

  const OV = await ethers.getContractFactory("OpStackFaultProofVerifier");
  const opVerifier = await OV.deploy({
    environmentId: ENV,
    registry: await registry.getAddress(),
    disputeGameFactory: FACTORY,
    gameCreatedTopic: CREATED_TOPIC,
    gameResolvedTopic: RESOLVED_TOPIC,
    respectedGameType: RESPECTED_GAME_TYPE,
    gameFinalityDelaySeconds: AIRGAP,
    sourceVault: await vault.getAddress(),
    lockEventTopic: TOPIC,
  });

  await verifier.registerAssetPrecision(ENV, AID, "MUSD", 18, 1, 1);
  await verifier.registerChainVerifier(ENV, await opVerifier.getAddress());
  await verifier.registerHandshakeAllowance(ENV, 3);
  await verifier.configureDevFund(ENV, devFund.address.toLowerCase());
  await verifier.finalize();

  const ts = (await ethers.provider.getBlock("latest")).timestamp;
  const sig = await signBatch(verifier, publisher, 1n, [AID], [1_000_000n], ts);
  await verifier.submitPriceBatch(1n, [AID], [1_000_000n], ts, sig);

  await token.transfer(user.address, 10n**24n);
  await token.connect(user).approve(await vault.getAddress(), 10n**24n);

  return {
    deployer, user, relayer, devFund, publisher, boundDestination,
    verifier, vault, opVerifier, mockL1, registry,
    token, vclm, AID, TOPIC,
  };
}

async function realLockProveAndPackage(s, tag, gross = 100n * 10n**18n, duration = 30n * DAY) {
  const vaultLockId = ethers.keccak256(ethers.toUtf8Bytes(tag));
  const releaseDestination = s.boundDestination.address;

  const tx = await s.vault.connect(s.user).createLock({
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

  const r = await s.vault.getLock(vaultLockId);
  const createdTs = Number(r.creationTime);
  const resolvedTs = createdTs + 3600;

  // L2: receipt the vault actually produced (23_ encoding).
  const l2Receipt = receiptFromHardhat(txReceipt);
  const l2Trie = buildTrie(l2Receipt);
  const l2Header = buildHeader(l2Trie.root, "fp-l2");
  const l2BlockHash = ethers.keccak256(l2Header);
  const claim = outputRoot(VERSION, L2_STATE, MSG_PASSER, l2BlockHash);

  // L1 block A: DisputeGameCreated.
  const createdLog = buildLog(
    FACTORY,
    [
      CREATED_TOPIC,
      ethers.zeroPadValue(GAME_PROXY, 32),
      topic32(RESPECTED_GAME_TYPE),
      claim,
    ],
    "0x"
  );
  const createdReceipt = hex(buildReceipt({ status: 1, logs: [createdLog] }));
  const createdTrie = buildTrie(createdReceipt);
  const createdHeader = buildHeader(createdTrie.root, "fp-created");

  // L1 block B: Resolved(DEFENDER_WINS).
  const resolvedLog = buildLog(
    GAME_PROXY,
    [RESOLVED_TOPIC, topic32(DEFENDER_WINS)],
    "0x"
  );
  const resolvedReceipt = hex(buildReceipt({ status: 1, logs: [resolvedLog] }));
  const resolvedTrie = buildTrie(resolvedReceipt);
  const resolvedHeader = buildHeader(resolvedTrie.root, "fp-resolved");

  await s.mockL1.set(CREATED_BLOCK, ethers.keccak256(createdHeader), createdTs);
  await s.registry.record();

  await s.mockL1.set(RESOLVED_BLOCK, ethers.keccak256(resolvedHeader), resolvedTs);
  await s.registry.record();

  // Later L1 block so the airgap has elapsed (measured via registry).
  await s.mockL1.set(
    LATEST_BLOCK,
    ethers.keccak256(ethers.toUtf8Bytes("later")),
    resolvedTs + AIRGAP
  );
  await s.registry.record();

  const lockEventProof = encodeOpStackProof({
    createdBlockNumber: CREATED_BLOCK,
    createdHeader,
    createdKey: createdTrie.key,
    createdProof: createdTrie.proof,
    createdReceipt,
    resolvedBlockNumber: RESOLVED_BLOCK,
    resolvedHeader,
    resolvedKey: resolvedTrie.key,
    resolvedProof: resolvedTrie.proof,
    resolvedReceipt,
    version: VERSION,
    stateRoot: L2_STATE,
    msgPasser: MSG_PASSER,
    l2BlockHash,
    l2Header,
    l2Key: l2Trie.key,
    l2Proof: l2Trie.proof,
    l2Receipt,
  });

  const commitmentVaultLockId = ethers.solidityPackedKeccak256(
    ["string", "address", "bytes32"],
    [ENV, await s.vault.getAddress(), vaultLockId]
  );

  const pkg = {
    sourceEnvironmentId: ENV,
    commitmentVaultLockId,
    handshakeIdentity: `${ENV}:${s.user.address.toLowerCase()}`,
    handshakeAllowanceCount: r.handshakeAllowanceCount,
    canonicalAssetId: s.AID,
    assetPrecision: 18,
    assetCustodyClass: 1,
    grossAmountSmallestUnits: r.grossAmount,
    actualFeeAmountSmallestUnits: r.feeAmount,
    principalAmountSmallestUnits: r.principalAmount,
    feeAssetId: s.AID,
    devFundDestination: s.devFund.address.toLowerCase(),
    feeTransferEvidence: ethers.keccak256(ethers.toUtf8Bytes(`fee-${tag}`)),
    valuationTimestamp: Number(r.creationTime),
    maturityTimestamp: Number(r.maturityTime),
    durationSecs: r.durationSecs,
    selectedOutputToken: 0,
    baseRecipient: r.baseRecipient,
    releaseDestination: releaseDestination.toLowerCase(),
    chonxActivationReceipt: "0x",
    racIdentity: ethers.keccak256(ethers.toUtf8Bytes(`rac-${tag}`)),
    sourceFinalityProof: "0x",
    lockEventProof,
  };

  return { vaultLockId, commitmentVaultLockId, record: r, pkg, lockEventProof };
}

describe("Optimism end-to-end — real lock through OpStackFaultProofVerifier to VCLM", function () {

  it("locks on EvmVault, proves via OpStackFaultProofVerifier, mints VCLM, releases 95% principal", async function () {
    const s = await deployStack();
    const expectedMint = 1725n * 10n**18n;
    const expectedPrincipal = 95n * 10n**18n; // 5% fee (STANDARD_FEE_BPS)
    const expectedFee = 5n * 10n**18n;

    const devBefore = await s.token.balanceOf(s.devFund.address);
    const { pkg, commitmentVaultLockId, lockEventProof, record } =
      await realLockProveAndPackage(s, "op-e2e-1");

    expect(record.principalAmount).to.equal(expectedPrincipal);
    expect(record.feeAmount).to.equal(expectedFee);
    expect(await s.token.balanceOf(record.lockContract)).to.equal(expectedPrincipal);
    // Dev fund received exactly 5% of the gross at lock time.
    expect(await s.token.balanceOf(s.devFund.address) - devBefore).to.equal(expectedFee);

    // Sanity: the production verifier accepts the proof before we mint.
    const [finalized] = await s.opVerifier.verifyFinality(lockEventProof, "0x");
    expect(finalized).to.equal(true);

    const facts = await s.opVerifier.extractFacts(lockEventProof);
    expect(facts.lockId).to.equal(commitmentVaultLockId);
    expect(facts.grossAmount).to.equal(pkg.grossAmountSmallestUnits);
    expect(facts.canonicalAssetId).to.equal(s.AID);
    expect(ethers.getAddress(facts.baseRecipient)).to.equal(ethers.getAddress(s.user.address));

    const before = await s.vclm.balanceOf(s.user.address);

    await s.verifier.connect(s.relayer).recordFeeAndRac(pkg);
    await s.verifier.connect(s.relayer).verifyAndMint(pkg);

    const minted = await s.vclm.balanceOf(s.user.address) - before;
    console.log(`\n    Optimism e2e: minted ${ethers.formatUnits(minted, 18)} VCLM against a real lock\n`);
    expect(minted).to.equal(expectedMint);

    // The same lock cannot mint twice.
    const second = { ...pkg, racIdentity: ethers.keccak256(ethers.toUtf8Bytes("rac-2")) };
    await expect(s.verifier.connect(s.relayer).verifyAndMint(second))
      .to.be.revertedWith("VF-XCH-013: replay");

    const lock = await ethers.getContractAt("CommitmentLock", record.lockContract);

    // Release before maturity reverts; principal remains in the lock.
    await expect(lock.release()).to.be.revertedWithCustomError(lock, "NotMature");
    expect(await s.token.balanceOf(record.lockContract)).to.equal(expectedPrincipal);

    // Advance to maturity and release principal to the bound destination.
    await ethers.provider.send("evm_increaseTime", [Number(30n * DAY)]);
    await ethers.provider.send("evm_mine", []);

    expect(await s.token.balanceOf(record.lockContract)).to.equal(expectedPrincipal);

    const destBefore = await s.token.balanceOf(s.boundDestination.address);
    await lock.connect(s.relayer).release();

    expect(await s.token.balanceOf(record.lockContract)).to.equal(0n);
    expect(await s.token.balanceOf(s.boundDestination.address) - destBefore)
      .to.equal(expectedPrincipal);

    // A second release reverts.
    await expect(lock.release()).to.be.revertedWithCustomError(lock, "AlreadyReleased");
  });
});
