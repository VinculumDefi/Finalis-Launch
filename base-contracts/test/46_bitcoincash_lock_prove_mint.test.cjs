// =============================================================================
// Bitcoin Cash environment — C.8/C.17 nulldata + lock → prove → mint
//
// Applies the same OP_RETURN identity payload as Bitcoin C.8 to bitcoincash:
// exactly one nulldata ok; missing refused; two refused. Mints VCLM to the
// Base recipient bound in the payload. Fee 5% of gross / principal 95%.
//
// bitcoincash:BCH is registered in this test only (8 decimals). Custody class
// is named in the test title; this does not claim an Approved Asset Registry
// class and does not add a registry row.
//
// Finality uses the confirmation depth configured on UtxoChainVerifier for
// this test. Architecture C.17: exact N is DESIGN DEFINED — DEPLOYABILITY
// EVIDENCE REQUIRED; Bitcoin's 6-confirmation recommendation is not a BCH rule.
// =============================================================================

const { expect } = require("chai");
const { ethers } = require("hardhat");

const ENV = "bitcoincash";
const ZERO = "0x0000000000000000000000000000000000000000";
const DAY = 86400n;
const DECIMALS = 8;
const DEVFUND = "bitcoincash:qpvfdevfund000000000000000000000000";
const PRICE_MICRO = 100_000_000_000n; // in-test $100,000.00 per BCH, micro-USD
// Test-configured finality threshold only — not an official BCH confirmation count.
const TEST_MIN_CONFIRMATIONS = 3;

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
const AID = ethers.keccak256(ethers.toUtf8Bytes("bitcoincash:BCH"));
const BLOCK = ethers.keccak256(ethers.toUtf8Bytes("bch-e2e-lockblock"));

function buildNulldataPayload({
  lockId,
  baseRecipient,
  outputToken = 0,
  assetIdentity = AID,
  valuationReference = ethers.id("valuation-ref-bch-e2e"),
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

// fee, principal P2WSH, change, optional nulldata (+ optional second for refusal).
// undefined → valid C.8/C.17 payload; null → omit (refusal case).
function buildLockTx({
  feeSats, principalSats, maturity, principalScript = null,
  nulldataPayload = undefined, secondNulldataPayload = null,
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
          lockId: ethers.id("vf-bch-e2e-lock"),
          baseRecipient: "0x1111111111111111111111111111111111111111",
        })
      : nulldataPayload;
    const spk = opReturnScript(payload);
    outputs.push(le(0, 8) + varInt(spk.length / 2) + spk);
  }
  if (secondNulldataPayload !== null) {
    const spk = opReturnScript(secondNulldataPayload);
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

const CREATION_UNIT = 1700000600;
const MATURITY_UNIT = 1700086400;
const BLOCK_UNIT = ethers.keccak256(ethers.toUtf8Bytes("bch-nulldata-block"));

async function deployVerifierOnly(t, minConf = TEST_MIN_CONFIRMATIONS) {
  const HC = await ethers.getContractFactory("Sha256dHeaderChainTestable");
  const chain = await HC.deploy(
    ethers.keccak256(ethers.toUtf8Bytes("checkpoint-bch")), 100, 0x1d00ffff, 1700000000
  );
  await chain.testRegisterHeader(BLOCK_UNIT, 101, t.txid, CREATION_UNIT);

  const V = await ethers.getContractFactory("UtxoChainVerifier");
  const utxoVerifier = await V.deploy(ENV, minConf, await chain.getAddress());
  return { chain, utxoVerifier };
}

async function deployStack(minConf = TEST_MIN_CONFIRMATIONS) {
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

  const HC = await ethers.getContractFactory("Sha256dHeaderChainTestable");
  const chain = await HC.deploy(
    ethers.keccak256(ethers.toUtf8Bytes("checkpoint-bch-e2e")), 100, 0x1d00ffff, launchTs
  );
  const UV = await ethers.getContractFactory("UtxoChainVerifier");
  const utxoVerifier = await UV.deploy(ENV, minConf, await chain.getAddress());

  // In-test only: bitcoincash:BCH at 8 decimals. Custody class 1 is the in-test
  // registration used for issuance math — not a registry-class claim / no registry row.
  await verifier.registerAssetPrecision(ENV, AID, "BCH", DECIMALS, 1, 0);
  await verifier.registerChainVerifier(ENV, await utxoVerifier.getAddress());
  await verifier.registerHandshakeAllowance(ENV, 1);
  await verifier.configureDevFund(ENV, DEVFUND);
  await verifier.finalize();

  const ts = (await ethers.provider.getBlock("latest")).timestamp;
  const sig = await signBatch(verifier, publisher, 1n, [AID], [PRICE_MICRO], ts);
  await verifier.submitPriceBatch(1n, [AID], [PRICE_MICRO], ts, sig);

  return {
    deployer, publisher, relayer, recipient,
    verifier, utxoVerifier, chain, vclm, launchTs, minConf,
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

  // Single-transaction block: merkle root is the txid.
  // Advance tip past the lock height so confirmations >= TEST_MIN_CONFIRMATIONS.
  const lockHeight = 101;
  await s.chain.testRegisterHeader(BLOCK, lockHeight, t.txid, creation);
  for (let i = 1; i < s.minConf; i++) {
    const tip = ethers.keccak256(ethers.toUtf8Bytes(`bch-tip-${tag}-${i}`));
    await s.chain.testRegisterHeader(tip, lockHeight + i, tip, creation + i);
  }

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
    releaseDestination: "bitcoincash:qprelease0000000000000000000000000",
    chonxActivationReceipt: "0x",
    racIdentity: ethers.keccak256(ethers.toUtf8Bytes(`rac-${tag}`)),
    sourceFinalityProof: "0x",
    lockEventProof,
  };

  return { t, pkg, lockEventProof, creation, maturity, commitmentVaultLockId };
}

describe("UtxoChainVerifier — Bitcoin Cash C.17 nulldata", function () {

  it("accepts exactly one nulldata payload and returns the Base recipient", async function () {
    const recipient = ethers.getAddress("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    const payload = buildNulldataPayload({
      lockId: ethers.id("vf-bch-one"),
      baseRecipient: recipient,
    });
    const t = buildLockTx({
      feeSats: 50000, principalSats: 950000, maturity: MATURITY_UNIT,
      nulldataPayload: payload,
    });
    const s = await deployVerifierOnly(t, 1);

    const f = await s.utxoVerifier.extractFacts(encodeProof(t, BLOCK_UNIT, [], 0, 1, 0));
    expect(f.baseRecipient).to.equal(recipient);
    expect(f.canonicalAssetId).to.equal(AID);
    expect(f.feeAmount).to.equal(50000n);
    expect(f.principalAmount).to.equal(950000n);
    expect(f.grossAmount).to.equal(1000000n);
  });

  it("refuses a transaction with no nulldata output", async function () {
    const t = buildLockTx({
      feeSats: 50000, principalSats: 950000, maturity: MATURITY_UNIT,
      nulldataPayload: null,
    });
    const s = await deployVerifierOnly(t, 1);

    await expect(s.utxoVerifier.extractFacts(encodeProof(t, BLOCK_UNIT, [], 0, 1, 0)))
      .to.be.reverted;
  });

  it("refuses a transaction with two nulldata outputs", async function () {
    const t = buildLockTx({
      feeSats: 50000,
      principalSats: 950000,
      maturity: MATURITY_UNIT,
      secondNulldataPayload: buildNulldataPayload({
        lockId: ethers.id("vf-bch-two"),
        baseRecipient: "0x2222222222222222222222222222222222222222",
      }),
    });
    const s = await deployVerifierOnly(t, 1);

    await expect(s.utxoVerifier.extractFacts(encodeProof(t, BLOCK_UNIT, [], 0, 1, 0)))
      .to.be.reverted;
  });

  it("refuses finality when depth is below the test-configured minimum", async function () {
    const t = buildLockTx({
      feeSats: 50000, principalSats: 950000, maturity: MATURITY_UNIT,
    });
    // Tip stays at lock height → confirmations == 1; required == TEST_MIN_CONFIRMATIONS (3).
    const s = await deployVerifierOnly(t, TEST_MIN_CONFIRMATIONS);

    await expect(s.utxoVerifier.verifyFinality(encodeProof(t, BLOCK_UNIT, [], 0, 1, 0), "0x"))
      .to.be.revertedWithCustomError(s.utxoVerifier, "InsufficientConfirmations");
  });
});

describe("Bitcoin Cash end-to-end — real lock through UtxoChainVerifier to VCLM", function () {

  it("locks BCH UTXO, proves via UtxoChainVerifier, mints VCLM to payload Base recipient (custody class in-test only)", async function () {
    const s = await deployStack(TEST_MIN_CONFIRMATIONS);

    // 0.001 BCH = 100_000 sat at in-test $100,000/BCH → $100 gross.
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
        tag: "bch-e2e-1",
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
    console.log(`\n    Bitcoin Cash e2e: minted ${ethers.formatUnits(minted, 18)} VCLM to payload Base recipient\n`);
    expect(minted).to.equal(expectedMint);

    // Same amounts / maturity, but no nulldata → C.17 refuses; no mint.
    const noNull = await realLockProveAndPackage(s, {
      feeSats: Number(expectedFee),
      principalSats: Number(expectedPrincipal),
      baseRecipient: s.recipient.address,
      nulldataPayload: null,
      tag: "bch-e2e-no-nulldata",
    });

    await expect(s.utxoVerifier.extractFacts(noNull.lockEventProof)).to.be.reverted;

    const beforeNoNull = await s.vclm.balanceOf(s.recipient.address);
    await expect(s.verifier.connect(s.relayer).recordFeeAndRac(noNull.pkg)).to.be.reverted;
    await expect(s.verifier.connect(s.relayer).verifyAndMint(noNull.pkg)).to.be.reverted;
    expect(await s.vclm.balanceOf(s.recipient.address)).to.equal(beforeNoNull);
  });
});
