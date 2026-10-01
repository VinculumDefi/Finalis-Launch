// =============================================================================
// Ethereum environment — lock → prove → mint (production verifier path)
//
// Combines the three seams that the separate suites exercise in isolation:
//   22_evm_vault            — real VinculumFinalisEvmVault.createLock
//   18_ethereum_verifier    — real EthereumChainVerifier over an RLP receipt
//   13_base_e2e             — real VinculumFinalisVerifier mint of VCLM
//
// No MockChainVerifier. The lock is created on-chain; its Hardhat receipt is
// re-encoded as the receipts-trie proof EthereumChainVerifier expects; the
// issuance contract mints against that proof.
// =============================================================================

const { expect } = require("chai");
const { ethers } = require("hardhat");

const ENV = "ethereum";
const ZERO = "0x0000000000000000000000000000000000000000";
const DAY = 86400n;
const BLOCK_NUMBER = 9000;

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

// ---- RLP helpers (mirrors 18_ethereum_verifier) ----------------------------

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

// Single-entry receipts trie at key 0x80 (RLP of index 0). Same construction
// as 18_ethereum_verifier.test.cjs.
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

// Re-encode a Hardhat transaction receipt as the RLP receipt the verifier
// parses. Every log is included so findLog can locate CommitVaultLock and
// CommitVaultLockDetail among the Transfer noise.
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

  // Source vault (22_ pattern) — exists before the chain verifier that binds it.
  const Vault = await ethers.getContractFactory("VinculumFinalisEvmVault");
  const vault = await Vault.deploy(ENV, devFund.address);
  await vault.registerAsset(await token.getAddress(), AID);
  await vault.finalizeConfiguration();

  const TOPIC = vault.interface.getEvent("CommitVaultLock").topicHash;

  // L1BlockRegistry + MockL1Block (18_ pattern).
  const M = await ethers.getContractFactory("MockL1Block");
  const mockL1 = await M.deploy();
  const R = await ethers.getContractFactory("L1BlockRegistry");
  const registry = await R.deploy(await mockL1.getAddress());

  const EV = await ethers.getContractFactory("EthereumChainVerifier");
  const ethVerifier = await EV.deploy(
    ENV, await registry.getAddress(), await vault.getAddress(), TOPIC
  );

  await verifier.registerAssetPrecision(ENV, AID, "MUSD", 18, 1, 1);
  await verifier.registerChainVerifier(ENV, await ethVerifier.getAddress());
  await verifier.registerHandshakeAllowance(ENV, 3);
  await verifier.configureDevFund(ENV, devFund.address.toLowerCase());
  await verifier.finalize();

  const ts = (await ethers.provider.getBlock("latest")).timestamp;
  const sig = await signBatch(verifier, publisher, 1n, [AID], [1_000_000n], ts);
  await verifier.submitPriceBatch(1n, [AID], [1_000_000n], ts, sig);

  await token.transfer(user.address, 10n**24n);
  await token.connect(user).approve(await vault.getAddress(), 10n**24n);

  const boundDestination = signers[4];

  return {
    deployer, user, relayer, devFund, publisher, boundDestination,
    verifier, vault, ethVerifier, mockL1, registry,
    token, vclm, AID, TOPIC,
  };
}

// Create a genuine EvmVault lock, build the EthereumChainVerifier proof from
// the real receipt, and assemble the ProofPackage from vault state.
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

  // Proof over the receipt the vault actually produced (18_ encoding).
  const receiptHex = receiptFromHardhat(txReceipt);
  const trie = buildTrie(receiptHex);
  const header = buildHeader(trie.root);

  await s.mockL1.set(BLOCK_NUMBER, ethers.keccak256(header), Number(r.creationTime));
  await s.registry.record();

  const lockEventProof = encodeProof(
    BLOCK_NUMBER, header, trie.key, trie.proof, receiptHex
  );

  // C.1 replay id: env + vault + vault lock id (what extractFacts returns).
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

  return { vaultLockId, commitmentVaultLockId, record: r, pkg, lockEventProof, header };
}

describe("Ethereum end-to-end — real lock through EthereumChainVerifier to VCLM", function () {

  it("locks on EvmVault, proves via EthereumChainVerifier, mints VCLM, releases 95% principal", async function () {
    const s = await deployStack();
    // Fixture: 100 whole tokens, price 1_000_000 micro-USD, 18 decimals,
    // custody class 1, 30-day duration, zero days since launch.
    // VF-COM-018: $100 × 10 × 1.5 × 1.15 = 1725 VCLM.
    const expectedMint = 1725n * 10n**18n;
    const expectedPrincipal = 95n * 10n**18n; // 5% fee (STANDARD_FEE_BPS)

    const { pkg, commitmentVaultLockId, lockEventProof, record } =
      await realLockProveAndPackage(s, "eth-e2e-1");

    expect(record.principalAmount).to.equal(expectedPrincipal);
    expect(await s.token.balanceOf(record.lockContract)).to.equal(expectedPrincipal);

    // Sanity: the production verifier accepts the proof before we mint.
    const [finalized] = await s.ethVerifier.verifyFinality(lockEventProof, "0x");
    expect(finalized).to.equal(true);

    const facts = await s.ethVerifier.extractFacts(lockEventProof);
    expect(facts.lockId).to.equal(commitmentVaultLockId);
    expect(facts.grossAmount).to.equal(pkg.grossAmountSmallestUnits);
    expect(facts.canonicalAssetId).to.equal(s.AID);
    expect(ethers.getAddress(facts.baseRecipient)).to.equal(ethers.getAddress(s.user.address));

    const before = await s.vclm.balanceOf(s.user.address);

    await s.verifier.connect(s.relayer).recordFeeAndRac(pkg);
    await s.verifier.connect(s.relayer).verifyAndMint(pkg);

    const minted = await s.vclm.balanceOf(s.user.address) - before;
    console.log(`\n    Ethereum e2e: minted ${ethers.formatUnits(minted, 18)} VCLM against a real lock\n`);
    expect(minted).to.equal(expectedMint);

    // Advance to maturity and release principal to the bound destination.
    await ethers.provider.send("evm_increaseTime", [Number(30n * DAY)]);
    await ethers.provider.send("evm_mine", []);

    expect(await s.token.balanceOf(record.lockContract)).to.equal(expectedPrincipal);

    const lock = await ethers.getContractAt("CommitmentLock", record.lockContract);
    const destBefore = await s.token.balanceOf(s.boundDestination.address);
    await lock.connect(s.relayer).release();

    expect(await s.token.balanceOf(record.lockContract)).to.equal(0n);
    expect(await s.token.balanceOf(s.boundDestination.address) - destBefore)
      .to.equal(expectedPrincipal);
  });
});
