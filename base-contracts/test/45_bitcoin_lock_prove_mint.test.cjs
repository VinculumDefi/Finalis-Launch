// =============================================================================
// Bitcoin environment — lock → prove → mint (production UtxoChainVerifier path)
//
// Mirrors 31_ethereum_lock_prove_mint: real source lock bytes, production chain
// verifier registered on issuance, VCLM minted to the Base recipient bound in
// the lock. Lock construction is the C.8 builder from 15_utxo_verifier.
//
// bitcoin:BTC is registered in this test only (8 decimals). Custody class is
// named in the test title; this does not claim an Approved Asset Registry class.
// =============================================================================

const { expect } = require("chai");
const { ethers } = require("hardhat");

const ENV = "bitcoin";
const ZERO = "0x0000000000000000000000000000000000000000";
const DAY = 86400n;
const DECIMALS = 8;
const DEVFUND = "bc1qvfdevfund0000000000000000000000000";
const PRICE_MICRO = 100_000_000_000n; // $100,000.00 per BTC, micro-USD

function dsha256(hexNo0x) {
  return ethers.sha256(ethers.sha256(ethers.getBytes("0x" + hexNo0x)));
}

function le(value, bytes) {
  const h = BigInt(value).toString(16).padStart(bytes * 2, "0");
  return h.match(/../g).reverse().join("");
}

function varInt(n) {
  if (n < 0xfd) return n.toString(16).padStart(2, "0");
  if (n <= 0xffff) return "fd" + le(n, 2);
  return "fe" + le(n, 4);
}

// <maturity> OP_CHECKLOCKTIMEVERIFY OP_DROP <33-byte pubkey> OP_CHECKSIG
function cltvScript(maturity, pubkeyHex) {
  let h = BigInt(maturity).toString(16);
  if (h.length % 2) h = "0" + h;
  const leBytes = h.match(/../g).reverse();
  if (parseInt(leBytes[leBytes.length - 1], 16) >= 0x80) leBytes.push("00");
  const push = leBytes.length.toString(16).padStart(2, "0") + leBytes.join("");
  return push + "b1" + "75" + "21" + pubkeyHex + "ac";
}

const PUBKEY = "02" + "11".repeat(32);
const AID = ethers.keccak256(ethers.toUtf8Bytes("bitcoin:BTC"));
const BLOCK = ethers.keccak256(ethers.toUtf8Bytes("btc-e2e-lockblock"));

function buildNulldataPayload({
  lockId,
  baseRecipient,
  outputToken = 0,
  assetIdentity = AID,
  valuationReference = ethers.id("valuation-ref-btc-e2e"),
} = {}) {
  const recipient = ethers.getBytes(baseRecipient);
  const token = Uint8Array.from([outputToken & 0xff]);
  return ethers.hexlify(ethers.concat([
    lockId, recipient, token, assetIdentity, valuationReference,
  ])).slice(2);
}

function opReturnScript(payloadHex) {
  const len = payloadHex.length / 2;
  if (len <= 75) return "6a" + len.toString(16).padStart(2, "0") + payloadHex;
  if (len <= 255) return "6a4c" + len.toString(16).padStart(2, "0") + payloadHex;
  throw new Error("nulldata payload too large");
}

// Same lock builder as 15_utxo_verifier: fee, principal P2WSH, change, optional
// nulldata. undefined → valid C.8 payload; null → omit (refusal case).
function buildLockTx({
  feeSats, principalSats, maturity, principalScript = null,
  nulldataPayload = undefined,
}) {
  const script = principalScript ?? cltvScript(maturity, PUBKEY);
  const scriptHash = ethers.sha256("0x" + script).slice(2);

  const feeSpk = "0014" + "22".repeat(20);
  const prinSpk = "0020" + scriptHash;
  const changeSpk = "0014" + "33".repeat(20);

  const outputs = [
    le(feeSats, 8)       + varInt(feeSpk.length / 2)    + feeSpk,
    le(principalSats, 8) + varInt(prinSpk.length / 2)   + prinSpk,
    le(1000, 8)          + varInt(changeSpk.length / 2) + changeSpk,
  ];

  if (nulldataPayload !== null) {
    const payload = nulldataPayload === undefined
      ? buildNulldataPayload({
          lockId: ethers.id("vf-btc-e2e-lock"),
          baseRecipient: "0x1111111111111111111111111111111111111111",
        })
      : nulldataPayload;
    const spk = opReturnScript(payload);
    outputs.push(le(0, 8) + varInt(spk.length / 2) + spk);
  }

  const tx =
    "01000000" +
    varInt(1) +
    "00".repeat(32) + "00000000" +
    "00" +
    "ffffffff" +
    varInt(outputs.length) +
    outputs.join("") +
    "00000000";

  return { tx, script, txid: dsha256(tx) };
}

function encodeProof(t, blockHash, merkleProof, txIndex, principalIndex, feeIndex) {
  return ethers.AbiCoder.defaultAbiCoder().encode(
    ["bytes", "bytes", "bytes32", "bytes32[]", "uint256", "uint256", "uint256"],
    ["0x" + t.tx, "0x" + t.script, blockHash,
     merkleProof, txIndex, principalIndex, feeIndex]
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

async function deployStack() {
  const signers = await ethers.getSigners();
  const [deployer] = signers;
  const publisher = signers[9];
  const relayer = signers[5];
  const recipient = signers[4];

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

  // Header chain + UtxoChainVerifier (15_ pattern), registered on issuance
  // the same way 31_ registers EthereumChainVerifier.
  const HC = await ethers.getContractFactory("Sha256dHeaderChainTestable");
  const chain = await HC.deploy(
    ethers.keccak256(ethers.toUtf8Bytes("checkpoint")), 100, 0x1d00ffff, launchTs
  );
  const UV = await ethers.getContractFactory("UtxoChainVerifier");
  const utxoVerifier = await UV.deploy(ENV, 1, await chain.getAddress());

  // In-test only: bitcoin:BTC at 8 decimals. Custody class 1 is the in-test
  // registration used for issuance math — not a registry-class claim.
  await verifier.registerAssetPrecision(ENV, AID, "BTC", DECIMALS, 1, 0);
  await verifier.registerChainVerifier(ENV, await utxoVerifier.getAddress());
  await verifier.registerHandshakeAllowance(ENV, 1);
  await verifier.configureDevFund(ENV, DEVFUND);
  await verifier.finalize();

  const ts = (await ethers.provider.getBlock("latest")).timestamp;
  const sig = await signBatch(verifier, publisher, 1n, [AID], [PRICE_MICRO], ts);
  await verifier.submitPriceBatch(1n, [AID], [PRICE_MICRO], ts, sig);

  return {
    deployer, publisher, relayer, recipient,
    verifier, utxoVerifier, chain, vclm, launchTs,
  };
}

async function realLockProveAndPackage(s, {
  feeSats, principalSats, baseRecipient, nulldataPayload, tag,
}) {
  const creation = (await ethers.provider.getBlock("latest")).timestamp;
  const duration = 30n * DAY;
  const maturity = creation + Number(duration);

  const payload = nulldataPayload === null
    ? null
    : (nulldataPayload ?? buildNulldataPayload({
        lockId: ethers.id(tag),
        baseRecipient,
      }));

  const t = buildLockTx({
    feeSats, principalSats, maturity, nulldataPayload: payload,
  });

  // Single-transaction block: merkle root is the txid (15_ pattern).
  await s.chain.testRegisterHeader(BLOCK, 101, t.txid, creation);

  const lockEventProof = encodeProof(t, BLOCK, [], 0, 1, 0);

  const commitmentVaultLockId = ethers.solidityPackedKeccak256(
    ["string", "bytes32", "uint256"], [ENV, t.txid, 1]
  );

  const pkg = {
    sourceEnvironmentId: ENV,
    commitmentVaultLockId,
    handshakeIdentity: `${ENV}:${ethers.keccak256("0x" + PUBKEY).slice(2)}`,
    handshakeAllowanceCount: 1,
    canonicalAssetId: AID,
    assetPrecision: DECIMALS,
    assetCustodyClass: 1,
    grossAmountSmallestUnits: BigInt(feeSats) + BigInt(principalSats),
    actualFeeAmountSmallestUnits: BigInt(feeSats),
    principalAmountSmallestUnits: BigInt(principalSats),
    feeAssetId: AID,
    devFundDestination: DEVFUND,
    feeTransferEvidence: ethers.keccak256(ethers.toUtf8Bytes(`fee-${tag}`)),
    valuationTimestamp: creation,
    maturityTimestamp: maturity,
    durationSecs: duration,
    selectedOutputToken: 0,
    baseRecipient,
    releaseDestination: "bc1qrelease000000000000000000000000000",
    chonxActivationReceipt: "0x",
    racIdentity: ethers.keccak256(ethers.toUtf8Bytes(`rac-${tag}`)),
    sourceFinalityProof: "0x",
    lockEventProof,
  };

  return { t, pkg, lockEventProof, creation, maturity, commitmentVaultLockId };
}

describe("Bitcoin end-to-end — real lock through UtxoChainVerifier to VCLM", function () {

  it("locks BTC UTXO, proves via UtxoChainVerifier, mints VCLM to payload Base recipient (S1 in-test only)", async function () {
    const s = await deployStack();

    // 0.001 BTC = 100_000 sat at $100,000/BTC → $100 gross.
    // STANDARD_FEE_BPS 5%: fee 5_000 sat, principal 95_000 sat.
    // VF-COM-018 with in-test custody class 1: $100 × 10 × 1.5 × 1.15 = 1725 VCLM.
    const grossSats = 100_000n;
    const expectedFee = 5_000n;
    const expectedPrincipal = 95_000n;
    const expectedMint = 1725n * 10n**18n;

    const { pkg, lockEventProof, commitmentVaultLockId } =
      await realLockProveAndPackage(s, {
        feeSats: Number(expectedFee),
        principalSats: Number(expectedPrincipal),
        baseRecipient: s.recipient.address,
        tag: "btc-e2e-1",
      });

    expect(pkg.actualFeeAmountSmallestUnits).to.equal(expectedFee);
    expect(pkg.principalAmountSmallestUnits).to.equal(expectedPrincipal);
    expect(pkg.grossAmountSmallestUnits).to.equal(grossSats);

    const [finalized] = await s.utxoVerifier.verifyFinality(lockEventProof, "0x");
    expect(finalized).to.equal(true);

    const facts = await s.utxoVerifier.extractFacts(lockEventProof);
    expect(facts.lockId).to.equal(commitmentVaultLockId);
    expect(facts.feeAmount).to.equal(expectedFee);
    expect(facts.principalAmount).to.equal(expectedPrincipal);
    expect(facts.grossAmount).to.equal(grossSats);
    expect(facts.canonicalAssetId).to.equal(AID);
    expect(ethers.getAddress(facts.baseRecipient)).to.equal(
      ethers.getAddress(s.recipient.address)
    );

    const before = await s.vclm.balanceOf(s.recipient.address);

    await s.verifier.connect(s.relayer).recordFeeAndRac(pkg);
    await s.verifier.connect(s.relayer).verifyAndMint(pkg);

    const minted = await s.vclm.balanceOf(s.recipient.address) - before;
    console.log(`\n    Bitcoin e2e: minted ${ethers.formatUnits(minted, 18)} VCLM to payload Base recipient\n`);
    expect(minted).to.equal(expectedMint);

    // Same amounts / maturity, but no nulldata → C.8 refuses; no mint.
    const noNull = await realLockProveAndPackage(s, {
      feeSats: Number(expectedFee),
      principalSats: Number(expectedPrincipal),
      baseRecipient: s.recipient.address,
      nulldataPayload: null,
      tag: "btc-e2e-no-nulldata",
    });

    await expect(s.utxoVerifier.extractFacts(noNull.lockEventProof)).to.be.reverted;

    const beforeNoNull = await s.vclm.balanceOf(s.recipient.address);
    await expect(s.verifier.connect(s.relayer).recordFeeAndRac(noNull.pkg)).to.be.reverted;
    await expect(s.verifier.connect(s.relayer).verifyAndMint(noNull.pkg)).to.be.reverted;
    expect(await s.vclm.balanceOf(s.recipient.address)).to.equal(beforeNoNull);
  });
});

// Real Bitcoin mainnet headers from 14_header_chain.test.cjs (do not invent).
const H0 =
  "01000000" +
  "0000000000000000000000000000000000000000000000000000000000000000" +
  "3ba3edfd7a7b12b27ac72c3e67768f617fc81bc3888a51323a9fb8aa4b1e5e4a" +
  "29ab5f49" + "ffff001d" + "1dac2b7c";

const H1 =
  "01000000" +
  "6fe28c0ab6f1b372c1a6a246ae63f74f931e8365e15a089c68d6190000000000" +
  "982051fd1e4ba744bbbe680e1fee14677ba1a3c3540bf7b1cdb606e857233e0e" +
  "61bc6649" + "ffff001d" + "01e36299";

const H2 =
  "01000000" +
  "4860eb18bf1b1620e37e9490fc8a427514416fd75159ab86688e9a8300000000" +
  "d5fdcc541e25de1c7a5addedf24858b8bb665c9f36ef744ee42c316022c90f9b" +
  "b0bc6649" + "ffff001d" + "08d2bd61";

function headerBlockHash(headerHex) {
  return ethers.sha256(ethers.sha256(ethers.getBytes("0x" + headerHex)));
}

describe("Bitcoin — finality refused when confirmation depth < 6", function () {

  it("checkpoints real genesis, submits H1+H2, lock at height 1; verifyFinality reverts (depth < 6)", async function () {
    // Production-path header chain fixture (same Testable as bitcoin e2e) but
    // checkpointed at real mainnet genesis — not a fabricated checkpoint hash.
    const HC = await ethers.getContractFactory("Sha256dHeaderChainTestable");
    const chain = await HC.deploy(headerBlockHash(H0), 0, 0x1d00ffff, 0x495fab29);

    const UV = await ethers.getContractFactory("UtxoChainVerifier");
    // Architecture C.8: minimum confirmations is 6. Do not lower below 6.
    const utxoVerifier = await UV.deploy(ENV, 6, await chain.getAddress());
    expect(await utxoVerifier.minConfirmations()).to.equal(6n);

    // Build a Bitcoin lock the same way the e2e test does (C.8 CLTV + nulldata).
    const creation = 0x4966bc61; // real H1 timestamp
    const duration = 30n * DAY;
    const maturity = creation + Number(duration);
    const t = buildLockTx({
      feeSats: 5_000,
      principalSats: 95_000,
      maturity,
      nulldataPayload: buildNulldataPayload({
        lockId: ethers.id("btc-depth-lt6"),
        baseRecipient: "0x1111111111111111111111111111111111111111",
      }),
    });

    const h1Hash = headerBlockHash(H1);

    // Include the lock in height 1 the e2e way: single-tx block, merkle root = txid.
    // Bind to the real height-1 block hash so subsequent real H2 links as parent.
    await chain.testRegisterHeader(h1Hash, 1, t.txid, creation);

    // Submit real mainnet height-1 and height-2 headers from 14_header_chain.
    // H1 is already known (idempotent); H2 extends the tip → depth(H1) = 2.
    await chain.submitHeaders("0x" + H1 + H2);
    expect(await chain.bestHeight()).to.equal(2n);
    expect(await chain.isKnown(h1Hash)).to.equal(true);
    expect(await chain.isKnown(headerBlockHash(H2))).to.equal(true);

    const depth = await chain.confirmations(h1Hash);
    console.log(`\n    Observed confirmation depth for lock block (height 1): ${depth}\n`);
    expect(depth).to.equal(2n);
    expect(depth).to.be.lt(6n);

    const lockEventProof = encodeProof(t, h1Hash, [], 0, 1, 0);

    await expect(utxoVerifier.verifyFinality(lockEventProof, "0x"))
      .to.be.revertedWithCustomError(utxoVerifier, "InsufficientConfirmations")
      .withArgs(depth, 6n);

    expect(await utxoVerifier.isFinal(lockEventProof)).to.equal(false);
  });
});
