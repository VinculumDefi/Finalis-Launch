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
const bitcoin = require("bitcoinjs-lib");
const ecc = require("tiny-secp256k1");
const { ECPairFactory } = require("ecpair");
const bitcore = require("bitcore-lib");

bitcoin.initEccLib(ecc);
const ECPair = ECPairFactory(ecc);

// Generator point, private key 1. The mined lock's CLTV script commits to this
// pubkey. BitcoinReleaseHarness is not the signature check: it never executes
// script. This test signs with the key and evaluates the spend under Bitcoin
// script rules (bitcore-lib's interpreter: witness program, CLTV, CHECKSIG).
const RELEASE_PRIV = Buffer.concat([Buffer.alloc(31, 0), Buffer.from([1])]);
const RELEASE_KEY = ECPair.fromPrivateKey(RELEASE_PRIV);
const RELEASE_PUBKEY = Buffer.from(RELEASE_KEY.publicKey).toString("hex");

// bitcore-lib applies SCRIPT_VERIFY_CLEANSTACK to the empty scriptSig stack of
// a native witness program and would reject every P2WSH spend. The witness
// program itself still requires the executed script to leave exactly one true
// stack element. The other flags are Bitcoin consensus script rules.
const BTC_SCRIPT_FLAGS = [
  "SCRIPT_VERIFY_P2SH",
  "SCRIPT_VERIFY_WITNESS",
  "SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY",
  "SCRIPT_VERIFY_CHECKSEQUENCEVERIFY",
  "SCRIPT_VERIFY_DERSIG",
  "SCRIPT_VERIFY_LOW_S",
  "SCRIPT_VERIFY_STRICTENC",
  "SCRIPT_VERIFY_MINIMALDATA",
  "SCRIPT_VERIFY_NULLDUMMY",
  "SCRIPT_VERIFY_NULLFAIL",
  "SCRIPT_VERIFY_WITNESS_PUBKEYTYPE",
].reduce((flags, name) => flags | bitcore.Script.Interpreter[name], 0);

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

// Headers mined from the real genesis checkpoint at bits 0x1d00ffff.
// Height 1 commits to the lock below (merkle root = txid). Heights 2..7 are
// successors on that same chain. Each header satisfies Sha256dHeaderChain's
// proof-of-work check; none were registered through testRegisterHeader.
const MINED = [
  "010000006fe28c0ab6f1b372c1a6a246ae63f74f931e8365e15a089c68d6190000000000d8a06abd948d7013e7eaeef4100cc7c725e8fce8c6d07c610f3c1892eea6aee681ad5f49ffff001dab7885c5",
  "01000000133c50f77aeaef80535d7d484d4cd404560b048f9d366d0ff1894574000000000000000000000000000000000000000000000000000000000000000000000000bdad5f49ffff001d19c31289",
  "01000000667d147d33528ffa5ceda2f0d9f813e435acb88668a9d5dd3e8ff570000000000000000000000000000000000000000000000000000000000000000000000000f9ad5f49ffff001ddf90640d",
  "01000000af082c1c3555d76d40f33c92084c97c474a4dc75dc981e35e4db3b350000000000000000000000000000000000000000000000000000000000000000000000003aae5f49ffff001d65ff1a63",
  "0100000058d3e9870a1697c7165709ecbd643054a1b7307cfedb904f3d21362700000000000000000000000000000000000000000000000000000000000000000000000076ae5f49ffff001dd6352527",
  "010000005d9b47354b73a74a159484f4bed3ed21a35da6c9a4ec7c91d3cfda7e000000000000000000000000000000000000000000000000000000000000000000000000b2ae5f49ffff001d07b10a2d",
  "01000000eb8116d9392f12b0d41c1f1ed175ad11b911f4229690814d0ee2644a000000000000000000000000000000000000000000000000000000000000000000000000eeae5f49ffff001dd654038d",
];

describe("Bitcoin — finality passes once mined confirmation depth >= 6", function () {

  it("checkpoints real genesis, submits a mined lock block and six successors; verifyFinality passes", async function () {
    const HC = await ethers.getContractFactory("Sha256dHeaderChainTestable");
    const chain = await HC.deploy(headerBlockHash(H0), 0, 0x1d00ffff, 0x495fab29);

    const UV = await ethers.getContractFactory("UtxoChainVerifier");
    // Architecture C.8: minimum confirmations is 6. Do not lower below 6.
    const utxoVerifier = await UV.deploy(ENV, 6, await chain.getAddress());
    expect(await utxoVerifier.minConfirmations()).to.equal(6n);

    const maturity = 1600000000;
    const t = buildLockTx({
      feeSats: 5_000,
      principalSats: 95_000,
      maturity,
      nulldataPayload: buildNulldataPayload({
        lockId: ethers.id("btc-pow-final-lock"),
        baseRecipient: "0x1111111111111111111111111111111111111111",
      }),
    });

    // Single-tx block: the mined height-1 merkle root is the lock txid.
    const lockHeader = MINED[0];
    expect(t.txid.slice(2)).to.equal(lockHeader.slice(72, 136));

    await chain.submitHeaders("0x" + MINED.join(""));

    const lockHash = headerBlockHash(lockHeader);
    expect(await chain.bestHeight()).to.equal(7n);
    expect(await chain.isKnown(headerBlockHash(H0))).to.equal(true);
    for (const h of MINED) {
      expect(await chain.isKnown(headerBlockHash(h))).to.equal(true);
    }

    const depth = await chain.confirmations(lockHash);
    const headersAfterLock = (await chain.bestHeight()) - 1n;
    console.log(`\n    Observed confirmation depth for mined lock block (height 1): ${depth}\n`);
    expect(headersAfterLock).to.be.gte(6n);
    expect(depth).to.be.gte(6n);

    const lockEventProof = encodeProof(t, lockHash, [], 0, 1, 0);
    const [finalized, sourceBlock, height] = await utxoVerifier.verifyFinality(lockEventProof, "0x");
    expect(finalized).to.equal(true);
    expect(sourceBlock).to.equal(lockHash);
    expect(height).to.equal(1n);
    expect(await utxoVerifier.isFinal(lockEventProof)).to.equal(true);
  });
});

// Issuance chain mined the same way as the depth-7 fixture: real genesis
// checkpoint, lock transaction at height 1 (merkle root = txid), six successor
// headers, bits 0x1d00ffff. The depth-7 headers themselves cannot be reused for
// mint: their 2009 timestamp precedes launch (VF-ORC-011) and the CLTV duration
// is not a permitted issuance duration. These headers keep that proof-of-work
// shape and the Bitcoin e2e amounts (fee 5_000, principal 95_000). The lock's
// CLTV script commits to RELEASE_PUBKEY, so the height-1 merkle root is that
// transaction's txid. No testRegisterHeader. minConfirmations stays 6.
//
// Lock-header timestamp is 2300000003. The test jumps the chain to 2300000000
// and then deployPowStack's three token deployments land launch at 2300000003,
// so valuation equals launch (daysSinceLaunch = 0) and the 30-day multiplier
// matches the Bitcoin e2e mint of 1725 VCLM.
const POW_TIME_ANCHOR = 2300000000;
const POW_LOCK_TIME = 2300000003;
const POW_DURATION = 2592000;
const POW_MATURITY = POW_LOCK_TIME + POW_DURATION;
const POW_RECIPIENT = "0x1111111111111111111111111111111111111111";
// P2WPKH bound at lock-release time. Principal (95% of gross) is paid here.
const BOUND_SPK = "0014" + "44".repeat(20);

const POW_HEADERS = [
  "010000006fe28c0ab6f1b372c1a6a246ae63f74f931e8365e15a089c68d6190000000000dfd1201264abacd041d29751b09248e6f68d6465d6e988a2af83d04e75e2924103371789ffff001d97f9c113",
  "010000006ca1fc20ebf635486208b0bf1bd86596eeaab5c0b56e1571b01f3bb50000000001000000000000000000000000000000000000000000000000000000000000003f371789ffff001d4edbf066",
  "0100000099b060b1fce63e3f9ff3a7a0f43728d4a843a54c33d836da10bf60700000000001000000000000000000000000000000000000000000000000000000000000007c371789ffff001dc3cae426",
  "01000000a544e8ad673d9ec507c05172b68a6a70d21e47848c4feb5f6bbee29d000000000000000000000000000000000000000000000000000000000000000000000000b7371789ffff001d15e1037b",
  "01000000f5531833164f71e786918c7083df0fb01b597d3d1df6cb383f2aaabf000000000000000000000000000000000000000000000000000000000000000000000000f6371789ffff001d0e01b512",
  "0100000077f516da95020121be2f83b312d749bf570b97d9e865f4a7a7b59a7c00000000000000000000000000000000000000000000000000000000000000000000000031381789ffff001d93a151aa",
  "01000000d9f7f98fa2fb24712f5c4d90a19c288c231bc091623cf6b43416ab870000000001000000000000000000000000000000000000000000000000000000000000006b381789ffff001dbc055b19"
];

// P2WSH spend of the principal output. witness = <sig> <witnessScript>.
// An empty witness is a real transaction with no script.
function buildSignedPrincipalSpend({
  prevTxid, witnessScript, prevValue, lockTime, spk, value, sign = true,
}) {
  const tx = new bitcoin.Transaction();
  tx.version = 2;
  tx.locktime = lockTime >>> 0;
  tx.addInput(Buffer.from(prevTxid.slice(2), "hex"), 1, 0xfffffffe);
  tx.addOutput(Buffer.from(spk, "hex"), value);
  if (sign) {
    const wscript = Buffer.from(witnessScript, "hex");
    const sighash = tx.hashForWitnessV0(
      0, wscript, prevValue, bitcoin.Transaction.SIGHASH_ALL
    );
    const sig = bitcoin.script.signature.encode(
      Buffer.from(RELEASE_KEY.sign(sighash)),
      bitcoin.Transaction.SIGHASH_ALL
    );
    tx.setWitness(0, [sig, wscript]);
  }
  return tx.toHex();
}

// Always runs the script interpreter. A spend is accepted only when the
// interpreter accepts it, the principal outpoint is still unspent, and the
// single output pays exactly prevValue sats to BOUND_SPK.
function judgePrincipalSpend(spendHex, prevSpkHex, prevValue, unspent) {
  const tx = new bitcore.Transaction(spendHex);
  const interp = new bitcore.Script.Interpreter();
  const witness = tx.inputs[0].witnesses || [];
  const scriptOk = interp.verify(
    tx.inputs[0].script,
    bitcore.Script(Buffer.from(prevSpkHex, "hex")),
    tx,
    0,
    BTC_SCRIPT_FLAGS,
    witness,
    prevValue
  );
  const out = tx.outputs[0];
  const spk = out.script.toHex();
  // bitcore reports the outpoint hash reversed from the serialized internal
  // byte order. The lock txid and the unspent set use internal order.
  const rawPrev = Buffer.from(tx.inputs[0].prevTxId);
  const prev = Buffer.from(rawPrev).reverse().toString("hex");
  const key = prev + ":" + tx.inputs[0].outputIndex;
  const available = unspent.has(key);
  const paysExact = tx.outputs.length === 1
    && tx.inputs.length === 1
    && out.satoshis === prevValue
    && spk === BOUND_SPK;
  const accept = scriptOk === true && paysExact && available;
  if (accept) unspent.delete(key);
  return {
    accept,
    scriptOk: scriptOk === true,
    err: interp.errstr || "",
    paysExact,
    available,
    value: out.satoshis,
    spk,
    key,
  };
}

async function deployPowStack() {
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

  // Production header chain. Real genesis checkpoint. Not Testable, so there
  // is no testRegisterHeader on this deployment.
  const HC = await ethers.getContractFactory("Sha256dHeaderChain");
  const chain = await HC.deploy(headerBlockHash(H0), 0, 0x1d00ffff, 0x495fab29);
  const UV = await ethers.getContractFactory("UtxoChainVerifier");
  const utxoVerifier = await UV.deploy(ENV, 6, await chain.getAddress());

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

describe("Bitcoin — mint and release on the mined depth-7 chain", function () {
  this.timeout(180000);

  after(async function () {
    // The time jump is local to this test. Put the chain back so later files
    // are not stuck in 2042.
    await ethers.provider.send("hardhat_reset", []);
  });

  it("mints 1725 VCLM from the mined lock; Bitcoin script rules reject an empty or early spend and accept one mature 95_000 sat release", async function () {
    // Three token deployments after this anchor block land launchTs on the
    // mined lock header's timestamp.
    await ethers.provider.send("evm_setNextBlockTimestamp", [POW_TIME_ANCHOR]);
    await ethers.provider.send("evm_mine");

    const s = await deployPowStack();
    expect(Number(s.launchTs)).to.equal(POW_LOCK_TIME);
    expect(await s.utxoVerifier.minConfirmations()).to.equal(6n);

    const grossSats = 100_000n;
    const expectedFee = 5_000n;
    const expectedPrincipal = 95_000n;
    const expectedMint = 1725n * 10n**18n;

    const witnessScript = cltvScript(POW_MATURITY, RELEASE_PUBKEY);
    const t = buildLockTx({
      feeSats: Number(expectedFee),
      principalSats: Number(expectedPrincipal),
      maturity: POW_MATURITY,
      principalScript: witnessScript,
      nulldataPayload: buildNulldataPayload({
        lockId: ethers.id("btc-pow-e2e-release-7"),
        baseRecipient: POW_RECIPIENT,
      }),
    });
    expect(t.script).to.equal(witnessScript);

    const lockHeader = POW_HEADERS[0];
    expect(t.txid.slice(2)).to.equal(lockHeader.slice(72, 136));

    await s.chain.submitHeaders("0x" + POW_HEADERS.join(""));

    const lockHash = headerBlockHash(lockHeader);
    expect(await s.chain.bestHeight()).to.equal(7n);
    expect(await s.chain.isKnown(headerBlockHash(H0))).to.equal(true);
    for (const h of POW_HEADERS) {
      expect(await s.chain.isKnown(headerBlockHash(h))).to.equal(true);
    }

    const depth = await s.chain.confirmations(lockHash);
    const headersAfterLock = (await s.chain.bestHeight()) - 1n;
    expect(headersAfterLock).to.be.gte(6n);
    expect(depth).to.be.gte(6n);

    const lockEventProof = encodeProof(t, lockHash, [], 0, 1, 0);
    const [finalized, sourceBlock, height] =
      await s.utxoVerifier.verifyFinality(lockEventProof, "0x");
    expect(finalized).to.equal(true);
    expect(sourceBlock).to.equal(lockHash);
    expect(height).to.equal(1n);

    const facts = await s.utxoVerifier.extractFacts(lockEventProof);
    const commitmentVaultLockId = ethers.solidityPackedKeccak256(
      ["string", "bytes32", "uint256"], [ENV, t.txid, 1]
    );
    expect(facts.lockId).to.equal(commitmentVaultLockId);
    expect(facts.feeAmount).to.equal(expectedFee);
    expect(facts.principalAmount).to.equal(expectedPrincipal);
    expect(facts.grossAmount).to.equal(grossSats);
    // Dev Fund output is 5% of gross. Principal is the other 95%.
    expect(facts.feeAmount * 10000n / facts.grossAmount).to.equal(500n);
    expect(facts.principalAmount * 10000n / facts.grossAmount).to.equal(9500n);
    expect(facts.canonicalAssetId).to.equal(AID);
    expect(ethers.getAddress(facts.baseRecipient)).to.equal(POW_RECIPIENT);
    expect(facts.durationSecs).to.equal(BigInt(POW_DURATION));
    expect(facts.creationTimestamp).to.equal(BigInt(POW_LOCK_TIME));
    expect(facts.maturityTimestamp).to.equal(BigInt(POW_MATURITY));

    const pkg = {
      sourceEnvironmentId: ENV,
      commitmentVaultLockId,
      handshakeIdentity: `${ENV}:${ethers.keccak256("0x" + RELEASE_PUBKEY).slice(2)}`,
      handshakeAllowanceCount: 1,
      canonicalAssetId: AID,
      assetPrecision: DECIMALS,
      assetCustodyClass: 1,
      grossAmountSmallestUnits: grossSats,
      actualFeeAmountSmallestUnits: expectedFee,
      principalAmountSmallestUnits: expectedPrincipal,
      feeAssetId: AID,
      devFundDestination: DEVFUND,
      feeTransferEvidence: ethers.keccak256(ethers.toUtf8Bytes("fee-btc-pow-e2e-release-7")),
      valuationTimestamp: POW_LOCK_TIME,
      maturityTimestamp: POW_MATURITY,
      durationSecs: BigInt(POW_DURATION),
      selectedOutputToken: 0,
      baseRecipient: POW_RECIPIENT,
      releaseDestination: "0x" + BOUND_SPK,
      chonxActivationReceipt: "0x",
      racIdentity: ethers.keccak256(ethers.toUtf8Bytes("rac-btc-pow-e2e-release-7")),
      sourceFinalityProof: "0x",
      lockEventProof,
    };

    const before = await s.vclm.balanceOf(POW_RECIPIENT);
    await s.verifier.connect(s.relayer).recordFeeAndRac(pkg);
    await s.verifier.connect(s.relayer).verifyAndMint(pkg);
    const minted = await s.vclm.balanceOf(POW_RECIPIENT) - before;
    console.log(`\n    Bitcoin mined-chain e2e: minted ${ethers.formatUnits(minted, 18)} VCLM\n`);
    expect(minted).to.equal(expectedMint);

    expect(await s.utxoVerifier.releaseKeyIdentity(lockEventProof))
      .to.equal(ethers.keccak256("0x" + RELEASE_PUBKEY));

    // Principal output scriptPubKey is P2WSH of the CLTV witness script.
    const prevSpk = "0020" + ethers.sha256("0x" + t.script).slice(2);
    const prevValue = Number(expectedPrincipal);
    const unspent = new Set([t.txid.slice(2) + ":1"]);

    const emptyHex = buildSignedPrincipalSpend({
      prevTxid: t.txid,
      witnessScript: t.script,
      prevValue,
      lockTime: POW_MATURITY,
      spk: BOUND_SPK,
      value: prevValue,
      sign: false,
    });
    const empty = judgePrincipalSpend(emptyHex, prevSpk, prevValue, unspent);
    expect(empty.scriptOk).to.equal(false);
    expect(empty.err).to.equal("SCRIPT_ERR_WITNESS_PROGRAM_WITNESS_EMPTY");
    expect(empty.accept).to.equal(false);
    expect(unspent.has(t.txid.slice(2) + ":1")).to.equal(true);

    const earlyHex = buildSignedPrincipalSpend({
      prevTxid: t.txid,
      witnessScript: t.script,
      prevValue,
      lockTime: POW_MATURITY - 1,
      spk: BOUND_SPK,
      value: prevValue,
    });
    const early = judgePrincipalSpend(earlyHex, prevSpk, prevValue, unspent);
    expect(early.scriptOk).to.equal(false);
    expect(early.err).to.equal("SCRIPT_ERR_UNSATISFIED_LOCKTIME");
    expect(early.accept).to.equal(false);
    expect(unspent.has(t.txid.slice(2) + ":1")).to.equal(true);

    const shortHex = buildSignedPrincipalSpend({
      prevTxid: t.txid,
      witnessScript: t.script,
      prevValue,
      lockTime: POW_MATURITY,
      spk: BOUND_SPK,
      value: prevValue - 1,
    });
    const shortPay = judgePrincipalSpend(shortHex, prevSpk, prevValue, unspent);
    expect(shortPay.scriptOk).to.equal(true);
    expect(shortPay.paysExact).to.equal(false);
    expect(shortPay.value).to.equal(prevValue - 1);
    expect(shortPay.accept).to.equal(false);
    expect(unspent.has(t.txid.slice(2) + ":1")).to.equal(true);

    const matureHex = buildSignedPrincipalSpend({
      prevTxid: t.txid,
      witnessScript: t.script,
      prevValue,
      lockTime: POW_MATURITY,
      spk: BOUND_SPK,
      value: prevValue,
    });
    const mature = judgePrincipalSpend(matureHex, prevSpk, prevValue, unspent);
    expect(mature.scriptOk).to.equal(true);
    expect(mature.err).to.equal("");
    expect(mature.paysExact).to.equal(true);
    expect(mature.value).to.equal(prevValue);
    expect(mature.spk).to.equal(BOUND_SPK);
    expect(mature.accept).to.equal(true);
    expect(unspent.has(t.txid.slice(2) + ":1")).to.equal(false);

    const second = judgePrincipalSpend(matureHex, prevSpk, prevValue, unspent);
    expect(second.scriptOk).to.equal(true);
    expect(second.available).to.equal(false);
    expect(second.accept).to.equal(false);
    expect(unspent.size).to.equal(0);
  });
});
