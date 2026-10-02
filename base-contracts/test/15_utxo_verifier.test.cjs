// =============================================================================
// UtxoChainVerifier — C.8 conformance tests
//
// Builds real Bitcoin transactions in the test: a Dev Fund fee output and a
// P2WSH principal output committing to a CLTV script. Every fact the verifier
// returns is derived from those bytes — nothing is asserted by the test and
// adopted by the contract.
//
// Proof-of-work verification is covered in 14_header_chain.test.cjs against
// real mainnet headers. This suite uses a testable header chain so blocks can
// commit to transactions constructed here.
//
// Weighted negative per Verifier Completion Standard 5.2.
// =============================================================================

const { expect } = require("chai");
const { ethers } = require("hardhat");

const ZERO = "0x0000000000000000000000000000000000000000";

function dsha256(hexNo0x) {
  return ethers.sha256(ethers.sha256(ethers.getBytes("0x" + hexNo0x)));
}

// ---- Bitcoin serialization helpers -----------------------------------------

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

// C.8 nulldata payload: lockId | baseRecipient | outputToken | assetIdentity | valuationReference
const PAYLOAD_LOCK_ID = ethers.id("vf-btc-lock-1");
const PAYLOAD_RECIPIENT = "0x1111111111111111111111111111111111111111";
const PAYLOAD_ASSET = ethers.id("bitcoin:BTC");
const PAYLOAD_VALUATION = ethers.id("valuation-ref-1");
const PAYLOAD_OUTPUT_TOKEN = 0;

function buildNulldataPayload({
  lockId = PAYLOAD_LOCK_ID,
  baseRecipient = PAYLOAD_RECIPIENT,
  outputToken = PAYLOAD_OUTPUT_TOKEN,
  assetIdentity = PAYLOAD_ASSET,
  valuationReference = PAYLOAD_VALUATION,
} = {}) {
  const recipient = ethers.getBytes(baseRecipient); // 20 bytes
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

function buildLockTx({
  feeSats, principalSats, maturity, principalScript = null, nulldataPayload = undefined,
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

  // undefined → include a valid C.8 payload; null → omit nulldata (refusal case)
  if (nulldataPayload !== null) {
    const payload = nulldataPayload === undefined
      ? buildNulldataPayload()
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

function encodeProof(t, blockHash, merkleProof, txIndex, principalIndex, feeIndex, scriptOverride) {
  return ethers.AbiCoder.defaultAbiCoder().encode(
    ["bytes", "bytes", "bytes32", "bytes32[]", "uint256", "uint256", "uint256"],
    ["0x" + t.tx, "0x" + (scriptOverride ?? t.script), blockHash,
     merkleProof, txIndex, principalIndex, feeIndex]
  );
}

const CREATION = 1700000600;
const MATURITY = 1700086400;
const BLOCK = ethers.keccak256(ethers.toUtf8Bytes("lockblock"));

async function deployWith(t, minConf = 1) {
  const HC = await ethers.getContractFactory("Sha256dHeaderChainTestable");
  const chain = await HC.deploy(
    ethers.keccak256(ethers.toUtf8Bytes("checkpoint")), 100, 0x1d00ffff, 1700000000
  );
  // Single-transaction block: the merkle root is the txid.
  await chain.testRegisterHeader(BLOCK, 101, t.txid, CREATION);

  const V = await ethers.getContractFactory("UtxoChainVerifier");
  const verifier = await V.deploy("bitcoin", minConf, await chain.getAddress());
  return { chain, verifier };
}

describe("UtxoChainVerifier — C.8 fact extraction", function () {

  it("derives every lock fact from the transaction bytes", async function () {
    const t = buildLockTx({ feeSats: 50000, principalSats: 950000, maturity: MATURITY });
    const s = await deployWith(t);

    const f = await s.verifier.extractFacts(encodeProof(t, BLOCK, [], 0, 1, 0));

    expect(f.feeAmount).to.equal(50000n);
    expect(f.principalAmount).to.equal(950000n);
    expect(f.grossAmount).to.equal(1000000n);
    expect(f.maturityTimestamp).to.equal(BigInt(MATURITY));
    expect(f.creationTimestamp).to.equal(BigInt(CREATION));
    expect(f.durationSecs).to.equal(BigInt(MATURITY - CREATION));

    const expectedId = ethers.solidityPackedKeccak256(
      ["string", "bytes32", "uint256"], ["bitcoin", t.txid, 1]
    );
    expect(f.lockId).to.equal(expectedId);
    expect(f.baseRecipient).to.equal(PAYLOAD_RECIPIENT);
    expect(f.canonicalAssetId).to.equal(PAYLOAD_ASSET);
    expect(f.outputToken).to.equal(PAYLOAD_OUTPUT_TOKEN);
  });

  it("returns the Base recipient bound in the nulldata payload", async function () {
    const recipient = ethers.getAddress("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    const payload = buildNulldataPayload({ baseRecipient: recipient });
    const t = buildLockTx({
      feeSats: 50000, principalSats: 950000, maturity: MATURITY, nulldataPayload: payload,
    });
    const s = await deployWith(t);

    const f = await s.verifier.extractFacts(encodeProof(t, BLOCK, [], 0, 1, 0));
    expect(f.baseRecipient).to.equal(recipient);
  });

  it("refuses a transaction with no nulldata output", async function () {
    const t = buildLockTx({
      feeSats: 50000, principalSats: 950000, maturity: MATURITY, nulldataPayload: null,
    });
    const s = await deployWith(t);

    await expect(s.verifier.extractFacts(encodeProof(t, BLOCK, [], 0, 1, 0)))
      .to.be.reverted;
  });

  it("rejects a witness script that does not match the output commitment", async function () {
    const t = buildLockTx({ feeSats: 50000, principalSats: 950000, maturity: MATURITY });
    const s = await deployWith(t);
    const other = cltvScript(MATURITY + 999, PUBKEY);

    await expect(s.verifier.extractFacts(encodeProof(t, BLOCK, [], 0, 1, 0, other)))
      .to.be.reverted;
  });

  it("rejects a principal output that is not P2WSH", async function () {
    const t = buildLockTx({ feeSats: 50000, principalSats: 950000, maturity: MATURITY });
    const s = await deployWith(t);
    await expect(s.verifier.extractFacts(encodeProof(t, BLOCK, [], 0, 0, 1)))
      .to.be.reverted;
  });

  it("rejects a maturity expressed as a block height", async function () {
    const t = buildLockTx({ feeSats: 50000, principalSats: 950000, maturity: 800000 });
    const s = await deployWith(t);
    await expect(s.verifier.extractFacts(encodeProof(t, BLOCK, [], 0, 1, 0)))
      .to.be.reverted;
  });

  it("rejects a script with a trailing opcode after OP_CHECKSIG", async function () {
    const base = cltvScript(MATURITY, PUBKEY);
    const t = buildLockTx({
      feeSats: 50000, principalSats: 950000, maturity: MATURITY,
      principalScript: base + "75",
    });
    const s = await deployWith(t);
    await expect(s.verifier.extractFacts(encodeProof(t, BLOCK, [], 0, 1, 0)))
      .to.be.reverted;
  });

  it("rejects identical principal and fee output indices", async function () {
    const t = buildLockTx({ feeSats: 50000, principalSats: 950000, maturity: MATURITY });
    const s = await deployWith(t);
    await expect(s.verifier.extractFacts(encodeProof(t, BLOCK, [], 0, 1, 1)))
      .to.be.reverted;
  });

  it("exposes the canonical release public key as the handshake identity", async function () {
    const t = buildLockTx({ feeSats: 50000, principalSats: 950000, maturity: MATURITY });
    const s = await deployWith(t);
    const id = await s.verifier.releaseKeyIdentity(encodeProof(t, BLOCK, [], 0, 1, 0));
    expect(id).to.equal(ethers.keccak256("0x" + PUBKEY));
  });
});

describe("UtxoChainVerifier — inclusion and depth", function () {

  it("verifies finality for an included transaction at sufficient depth", async function () {
    const t = buildLockTx({ feeSats: 50000, principalSats: 950000, maturity: MATURITY });
    const s = await deployWith(t, 1);

    const [finalized, hash] = await s.verifier.verifyFinality(
      encodeProof(t, BLOCK, [], 0, 1, 0), "0x"
    );
    expect(finalized).to.equal(true);
    expect(hash).to.equal(BLOCK);
  });

  it("rejects a transaction not committed to by the block", async function () {
    const t = buildLockTx({ feeSats: 50000, principalSats: 950000, maturity: MATURITY });
    const s = await deployWith(t);
    const other = buildLockTx({ feeSats: 111, principalSats: 222, maturity: MATURITY });

    await expect(s.verifier.verifyFinality(encodeProof(other, BLOCK, [], 0, 1, 0), "0x"))
      .to.be.revertedWithCustomError(s.verifier, "TxNotInBlock");
  });

  it("rejects a block the header chain has never seen", async function () {
    const t = buildLockTx({ feeSats: 50000, principalSats: 950000, maturity: MATURITY });
    const s = await deployWith(t);
    const unknown = ethers.keccak256(ethers.toUtf8Bytes("no-such-block"));

    await expect(s.verifier.verifyFinality(encodeProof(t, unknown, [], 0, 1, 0), "0x"))
      .to.be.revertedWithCustomError(s.verifier, "HeaderNotKnown");
  });

  it("rejects insufficient confirmation depth", async function () {
    const t = buildLockTx({ feeSats: 50000, principalSats: 950000, maturity: MATURITY });
    const s = await deployWith(t, 100);

    await expect(s.verifier.verifyFinality(encodeProof(t, BLOCK, [], 0, 1, 0), "0x"))
      .to.be.revertedWithCustomError(s.verifier, "InsufficientConfirmations");
  });

  it("extractFacts re-verifies inclusion rather than trusting a prior call", async function () {
    const t = buildLockTx({ feeSats: 50000, principalSats: 950000, maturity: MATURITY });
    const s = await deployWith(t);
    const unknown = ethers.keccak256(ethers.toUtf8Bytes("elsewhere"));

    await expect(s.verifier.extractFacts(encodeProof(t, unknown, [], 0, 1, 0)))
      .to.be.revertedWithCustomError(s.verifier, "HeaderNotKnown");
  });

  it("isFinal reports without reverting", async function () {
    const t = buildLockTx({ feeSats: 50000, principalSats: 950000, maturity: MATURITY });
    const s = await deployWith(t, 1);
    expect(await s.verifier.isFinal(encodeProof(t, BLOCK, [], 0, 1, 0))).to.equal(true);

    const unknown = ethers.keccak256(ethers.toUtf8Bytes("nope"));
    expect(await s.verifier.isFinal(encodeProof(t, unknown, [], 0, 1, 0))).to.equal(false);
  });
});

describe("UtxoChainVerifier — construction", function () {

  it("refuses a zero header chain address", async function () {
    const V = await ethers.getContractFactory("UtxoChainVerifier");
    await expect(V.deploy("bitcoin", 6, ZERO))
      .to.be.revertedWithCustomError(V, "ZeroAddress");
  });

  it("binds configuration immutably and exposes no setter", async function () {
    const t = buildLockTx({ feeSats: 50000, principalSats: 950000, maturity: MATURITY });
    const s = await deployWith(t, 6);
    expect(await s.verifier.minConfirmations()).to.equal(6n);
    expect(s.verifier.interface.fragments.filter(
      f => f.type === "function" && /^set/i.test(f.name)
    ).length).to.equal(0);
  });
});
