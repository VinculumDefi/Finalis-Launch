// =============================================================================
// Dogecoin lock — one 5/95 CLTV output, C.8 nulldata, Scrypt header check
//
// Dogecoin Core checks proof of work with scrypt_1024_1_1_256 of the 80-byte
// header (CPureBlockHeader::GetPoWHash in primitives/pureheader.cpp) and
// CheckProofOfWork / CheckAuxPowProofOfWork for non-AuxPoW headers: the compact
// target must be in range and must not exceed mainnet powLimit, and the Scrypt
// hash must be <= that target. This file does that check on Dogecoin's own
// genesis parameters. It does not use UtxoChainVerifier, Sha256dHeaderChain, or
// Litecoin's published header, and it does not choose a confirmation count.
//
// The 117-byte Base-recipient binding is the existing C.8 builder
// (test/lib/c8NulldataPayload.cjs). No second layout.
//
// SegWit is disabled on Dogecoin mainnet (DEPLOYMENT_SEGWIT nTimeout = 0), so
// the principal is a P2SH CLTV output, not a witness program.
// =============================================================================

const crypto = require("crypto");
const { expect } = require("chai");
const { ethers } = require("ethers");
const bitcoin = require("bitcoinjs-lib");
const ecc = require("tiny-secp256k1");
const { ECPairFactory } = require("ecpair");
const bitcore = require("bitcore-lib");

const {
  buildNulldataPayload,
  PAYLOAD_LOCK_ID,
  PAYLOAD_RECIPIENT,
  PAYLOAD_ASSET,
  PAYLOAD_VALUATION,
  PAYLOAD_OUTPUT_TOKEN,
} = require("./lib/c8NulldataPayload.cjs");

bitcoin.initEccLib(ecc);
const ECPair = ECPairFactory(ecc);

// One bound release key (generator, private key 1). The principal redeem
// script commits to this pubkey and no other.
const RELEASE_PRIV = Buffer.concat([Buffer.alloc(31, 0), Buffer.from([1])]);
const RELEASE_KEY = ECPair.fromPrivateKey(RELEASE_PRIV);
const RELEASE_PUBKEY = Buffer.from(RELEASE_KEY.publicKey).toString("hex");

// Dogecoin script flags for a P2SH CLTV spend. No WITNESS flags: SegWit is
// not active on Dogecoin mainnet.
const DOGE_SCRIPT_FLAGS = [
  "SCRIPT_VERIFY_P2SH",
  "SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY",
  "SCRIPT_VERIFY_DERSIG",
  "SCRIPT_VERIFY_LOW_S",
  "SCRIPT_VERIFY_STRICTENC",
  "SCRIPT_VERIFY_MINIMALDATA",
  "SCRIPT_VERIFY_NULLDUMMY",
  "SCRIPT_VERIFY_NULLFAIL",
].reduce((flags, name) => flags | bitcore.Script.Interpreter[name], 0);

// Mainnet powLimit from dogecoin src/chainparams.cpp:
// uint256S("0x00000fffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")
const POW_LIMIT = BigInt("0x00000fffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
// Genesis nBits. Height 1 does not retarget, so a child of genesis uses this.
const GENESIS_BITS = 0x1e0ffff0;
const GENESIS_TIME = 1386325540;
const GENESIS_NONCE = 99943;
// Published genesis block id (hashPrevBlock of a child). Not a PoW hash.
const GENESIS_BLOCK_ID = "1a91e3dace36e2be3bf030a65679fe821aa1d6ef92e7c9902eb318182c355691";
const GENESIS_MERKLE = "5b2a3f53f605d62c53e62932dac6925e3d74afa5a4b459745c36d42d0ed26a69";
// Scrypt PoW hash of the real Dogecoin genesis header (display byte order).
// This is Dogecoin's own header, not Litecoin's.
const GENESIS_SCRYPT =
  "0000026f3f7874ca0c251314eaed2d2fcf83d7da3acfaacf59417d485310b448";

const GROSS = 1_000_000n;
const FEE = 50_000n;
const PRINCIPAL = 950_000n;
const MATURITY = 1700086400;
// One second after genesis. Not a confirmation depth.
const LOCK_HEADER_TIME = GENESIS_TIME + 1;
// Mined once under the rules below. The test recomputes Scrypt; it does not
// trust this nonce without that check.
const LOCK_HEADER_NONCE = 4007931;

// Single spend destination (P2PKH). Principal is paid here, once.
const BOUND_SPK = "76a914" + "44".repeat(20) + "88ac";

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

function cltvScript(maturity, pubkeyHex) {
  let h = BigInt(maturity).toString(16);
  if (h.length % 2) h = "0" + h;
  const leBytes = h.match(/../g).reverse();
  if (parseInt(leBytes[leBytes.length - 1], 16) >= 0x80) leBytes.push("00");
  const push = leBytes.length.toString(16).padStart(2, "0") + leBytes.join("");
  return push + "b1" + "75" + "21" + pubkeyHex + "ac";
}

function opReturnScript(payloadHex) {
  const len = payloadHex.length / 2;
  if (len <= 75) return "6a" + len.toString(16).padStart(2, "0") + payloadHex;
  if (len <= 255) return "6a4c" + len.toString(16).padStart(2, "0") + payloadHex;
  throw new Error("nulldata payload too large");
}

function hash160(scriptHex) {
  const sha = ethers.sha256("0x" + scriptHex).slice(2);
  return crypto.createHash("ripemd160").update(Buffer.from(sha, "hex")).digest("hex");
}

function buildLockTx({ feeSats, principalSats, maturity, principalScript, nulldataPayload }) {
  const script = principalScript;
  const feeSpk = "76a914" + "22".repeat(20) + "88ac";
  const prinSpk = "a914" + hash160(script) + "87";
  const changeSpk = "76a914" + "33".repeat(20) + "88ac";
  const nullSpk = opReturnScript(nulldataPayload);
  const outputs = [
    le(feeSats, 8) + varInt(feeSpk.length / 2) + feeSpk,
    le(principalSats, 8) + varInt(prinSpk.length / 2) + prinSpk,
    le(1000, 8) + varInt(changeSpk.length / 2) + changeSpk,
    le(0, 8) + varInt(nullSpk.length / 2) + nullSpk,
  ];
  const tx =
    "01000000" +
    varInt(1) +
    "00".repeat(32) + "00000000" +
    "00" +
    "ffffffff" +
    varInt(outputs.length) +
    outputs.join("") +
    "00000000";
  return { tx, script, txid: dsha256(tx).slice(2), prinSpk };
}

function readVarInt(buf, offset) {
  const first = buf[offset];
  if (first < 0xfd) return { n: first, next: offset + 1 };
  if (first === 0xfd) return { n: buf.readUInt16LE(offset + 1), next: offset + 3 };
  if (first === 0xfe) return { n: buf.readUInt32LE(offset + 1), next: offset + 5 };
  return { n: Number(buf.readBigUInt64LE(offset + 1)), next: offset + 9 };
}

function parseTx(hex) {
  const buf = Buffer.from(hex, "hex");
  let o = 0;
  const version = buf.readUInt32LE(o); o += 4;
  const vin = readVarInt(buf, o); o = vin.next;
  for (let i = 0; i < vin.n; i++) {
    o += 36;
    const sl = readVarInt(buf, o); o = sl.next + sl.n;
    o += 4;
  }
  const vout = readVarInt(buf, o); o = vout.next;
  const outputs = [];
  for (let i = 0; i < vout.n; i++) {
    const value = buf.readBigUInt64LE(o); o += 8;
    const sl = readVarInt(buf, o); o = sl.next;
    const script = buf.subarray(o, o + sl.n); o += sl.n;
    outputs.push({ value, script: Buffer.from(script) });
  }
  const locktime = buf.readUInt32LE(o); o += 4;
  return { version, outputs, locktime, consumed: o, length: buf.length };
}

// Bitcoin SetCompact, as Dogecoin's arith_uint256::SetCompact does it.
function setCompact(bits) {
  const nSize = bits >>> 24;
  const nWord = bits & 0x007fffff;
  let word = nWord;
  let target;
  if (nSize <= 3) {
    word = nWord >>> (8 * (3 - nSize));
    target = BigInt(word);
  } else {
    target = BigInt(nWord) << (8n * BigInt(nSize - 3));
  }
  const negative = nWord !== 0 && (bits & 0x00800000) !== 0;
  const overflow = nWord !== 0 && (
    nSize > 34 ||
    (nWord > 0xff && nSize > 33) ||
    (nWord > 0xffff && nSize > 32)
  );
  return { target, negative, overflow };
}

// Dogecoin GetPoWHash: scrypt_1024_1_1_256(header). Same N/r/p as Litecoin's
// function name, but this test feeds Dogecoin genesis bytes and Dogecoin
// powLimit — not Litecoin's published header.
function scrypt1024(header) {
  if (header.length !== 80) {
    throw new Error(`Dogecoin header is ${header.length} bytes, expected 80`);
  }
  return crypto.scryptSync(header, header, 32, { N: 1024, r: 1, p: 1 });
}

function checkDogecoinProofOfWork(header) {
  const bits = header.readUInt32LE(72);
  const hash = scrypt1024(header);
  const display = Buffer.from(hash).reverse().toString("hex");
  const { target, negative, overflow } = setCompact(bits);
  const hashInt = BigInt("0x" + display);
  const inRange = !negative && target !== 0n && !overflow && target <= POW_LIMIT;
  const enoughWork = hashInt <= target;
  return {
    ok: inRange && enoughWork,
    inRange,
    enoughWork,
    bits,
    target,
    hashInt,
    display,
    hash,
  };
}

function le32(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n >>> 0);
  return b;
}

function genesisHeader() {
  const merkle = Buffer.from(GENESIS_MERKLE, "hex").reverse();
  return Buffer.concat([
    le32(1),
    Buffer.alloc(32),
    merkle,
    le32(GENESIS_TIME),
    le32(GENESIS_BITS),
    le32(GENESIS_NONCE),
  ]);
}

function lockHeader(txidHex) {
  const prev = Buffer.from(GENESIS_BLOCK_ID, "hex").reverse();
  const merkle = Buffer.from(txidHex, "hex");
  return Buffer.concat([
    le32(1),
    prev,
    merkle,
    le32(LOCK_HEADER_TIME),
    le32(GENESIS_BITS),
    le32(LOCK_HEADER_NONCE),
  ]);
}

// Version bit VERSION_AUXPOW = (1 << 8). Genesis and this lock child use
// version 1 with no auxpow payload — not a merged-mined header. AuxPoW on
// mainnet begins at height 371337.
function isMergedMinedHeader(header) {
  const version = header.readUInt32LE(0);
  return (version & (1 << 8)) !== 0;
}

function buildSignedPrincipalSpend({
  prevTxid, redeemScript, prevValue, lockTime, spk, value, sign = true,
}) {
  const tx = new bitcoin.Transaction();
  tx.version = 1;
  tx.locktime = lockTime >>> 0;
  tx.addInput(Buffer.from(prevTxid, "hex"), 1, 0xfffffffe);
  tx.addOutput(Buffer.from(spk, "hex"), value);
  if (sign) {
    const rs = Buffer.from(redeemScript, "hex");
    const sighash = tx.hashForSignature(0, rs, bitcoin.Transaction.SIGHASH_ALL);
    const sig = bitcoin.script.signature.encode(
      Buffer.from(RELEASE_KEY.sign(sighash)),
      bitcoin.Transaction.SIGHASH_ALL
    );
    tx.setInputScript(0, bitcoin.script.compile([sig, rs]));
  }
  return tx.toHex();
}

function judgePrincipalSpend(spendHex, prevSpkHex, prevValue, unspent) {
  const tx = new bitcore.Transaction(spendHex);
  const interp = new bitcore.Script.Interpreter();
  const scriptOk = interp.verify(
    tx.inputs[0].script,
    bitcore.Script(Buffer.from(prevSpkHex, "hex")),
    tx,
    0,
    DOGE_SCRIPT_FLAGS
  );
  const out = tx.outputs[0];
  const spk = out.script.toHex();
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

describe("Dogecoin lock — 5/95 CLTV, C.8 payload, Scrypt header", function () {
  this.timeout(60000);

  it("locks 95% to one key, checks the header with Dogecoin Scrypt, rejects an early spend, and pays the 95% once", function () {
    const payload = buildNulldataPayload();
    const payloadBytes = Buffer.from(payload, "hex");
    expect(payloadBytes.length).to.equal(117);
    expect(ethers.hexlify(payloadBytes.subarray(0, 32))).to.equal(PAYLOAD_LOCK_ID);
    expect(ethers.getAddress(ethers.hexlify(payloadBytes.subarray(32, 52)))).to.equal(
      ethers.getAddress(PAYLOAD_RECIPIENT)
    );
    expect(payloadBytes[52]).to.equal(PAYLOAD_OUTPUT_TOKEN);
    expect(ethers.hexlify(payloadBytes.subarray(53, 85))).to.equal(PAYLOAD_ASSET);
    expect(ethers.hexlify(payloadBytes.subarray(85, 117))).to.equal(PAYLOAD_VALUATION);

    expect(FEE * 10000n / GROSS).to.equal(500n);
    expect(PRINCIPAL * 10000n / GROSS).to.equal(9500n);
    expect(FEE + PRINCIPAL).to.equal(GROSS);
    expect(FEE * 95n).to.equal(PRINCIPAL * 5n);

    const redeemScript = cltvScript(MATURITY, RELEASE_PUBKEY);
    expect(redeemScript.endsWith("21" + RELEASE_PUBKEY + "ac")).to.equal(true);
    // One compressed pubkey push, then CHECKSIG. Not a multisig.
    const pubkeyPushes = redeemScript.split("21" + RELEASE_PUBKEY).length - 1;
    expect(pubkeyPushes).to.equal(1);

    const built = buildLockTx({
      feeSats: Number(FEE),
      principalSats: Number(PRINCIPAL),
      maturity: MATURITY,
      principalScript: redeemScript,
      nulldataPayload: payload,
    });
    expect(built.script).to.equal(redeemScript);
    expect(built.prinSpk.startsWith("a914")).to.equal(true);
    expect(built.prinSpk.endsWith("87")).to.equal(true);

    const parsed = parseTx(built.tx);
    expect(parsed.consumed).to.equal(parsed.length);
    expect(parsed.outputs).to.have.length(4);
    expect(parsed.outputs[0].value).to.equal(FEE);
    expect(parsed.outputs[1].value).to.equal(PRINCIPAL);
    expect(parsed.outputs[2].value).to.equal(1000n);
    expect(parsed.outputs[3].value).to.equal(0n);
    expect(parsed.outputs[1].script.toString("hex")).to.equal(built.prinSpk);
    expect(parsed.outputs[0].script.toString("hex")).to.not.equal(built.prinSpk);
    expect(parsed.outputs[2].script.toString("hex")).to.not.equal(built.prinSpk);

    const nullScript = parsed.outputs[3].script;
    expect(nullScript[0]).to.equal(0x6a);
    expect(nullScript[1]).to.equal(0x4c);
    expect(nullScript[2]).to.equal(117);
    expect(nullScript.subarray(3).toString("hex")).to.equal(payload);

    // Real Dogecoin genesis header. If this Scrypt call does not reproduce
    // Dogecoin's PoW hash, the lock header below is not evidence.
    const genesis = checkDogecoinProofOfWork(genesisHeader());
    expect(genesis.bits).to.equal(GENESIS_BITS);
    expect(genesis.display).to.equal(GENESIS_SCRYPT);
    expect(genesis.ok).to.equal(true);
    const genesisId = Buffer.from(
      dsha256(genesisHeader().toString("hex")).slice(2),
      "hex"
    ).reverse().toString("hex");
    expect(genesisId).to.equal(GENESIS_BLOCK_ID);

    const header = lockHeader(built.txid);
    expect(header.length).to.equal(80);
    expect(header.subarray(4, 36).toString("hex")).to.equal(
      Buffer.from(GENESIS_BLOCK_ID, "hex").reverse().toString("hex")
    );
    expect(header.subarray(36, 68).toString("hex")).to.equal(built.txid);
    expect(header.readUInt32LE(68)).to.equal(LOCK_HEADER_TIME);
    expect(header.readUInt32LE(72)).to.equal(GENESIS_BITS);
    expect(header.readUInt32LE(76)).to.equal(LOCK_HEADER_NONCE);

    // Not a merged-mined header: version 1, no AuxPoW bit, child of genesis.
    // This is a Scrypt-checked header under Dogecoin genesis rules; it is not
    // a current mainnet Dogecoin header.
    expect(isMergedMinedHeader(header)).to.equal(false);
    expect(header.readUInt32LE(0)).to.equal(1);
    console.log(
      "\n    Dogecoin lock header is not merged-mined " +
      "(version 1, no AuxPoW; not a current mainnet Dogecoin header)\n"
    );

    const pow = checkDogecoinProofOfWork(header);
    expect(pow.ok).to.equal(true);
    expect(pow.inRange).to.equal(true);
    expect(pow.enoughWork).to.equal(true);
    expect(pow.bits).to.equal(GENESIS_BITS);
    expect(pow.target <= POW_LIMIT).to.equal(true);
    expect(pow.hashInt <= pow.target).to.equal(true);
    console.log(`\n    Dogecoin Scrypt header hash ${pow.display}\n`);

    const flipped = Buffer.from(header);
    flipped[79] ^= 0x01;
    const bad = checkDogecoinProofOfWork(flipped);
    expect(bad.display).to.not.equal(pow.display);
    expect(bad.ok).to.equal(false);

    const prevValue = Number(PRINCIPAL);
    const unspent = new Set([built.txid + ":1"]);

    const earlyHex = buildSignedPrincipalSpend({
      prevTxid: built.txid,
      redeemScript,
      prevValue,
      lockTime: MATURITY - 1,
      spk: BOUND_SPK,
      value: prevValue,
    });
    const early = judgePrincipalSpend(earlyHex, built.prinSpk, prevValue, unspent);
    expect(early.scriptOk).to.equal(false);
    expect(early.err).to.equal("SCRIPT_ERR_UNSATISFIED_LOCKTIME");
    expect(early.accept).to.equal(false);
    expect(unspent.has(built.txid + ":1")).to.equal(true);

    const matureHex = buildSignedPrincipalSpend({
      prevTxid: built.txid,
      redeemScript,
      prevValue,
      lockTime: MATURITY,
      spk: BOUND_SPK,
      value: prevValue,
    });
    const mature = judgePrincipalSpend(matureHex, built.prinSpk, prevValue, unspent);
    expect(mature.scriptOk).to.equal(true);
    expect(mature.err).to.equal("");
    expect(mature.paysExact).to.equal(true);
    expect(mature.value).to.equal(prevValue);
    expect(mature.spk).to.equal(BOUND_SPK);
    expect(mature.accept).to.equal(true);
    expect(unspent.has(built.txid + ":1")).to.equal(false);
    console.log(`\n    Dogecoin mature spend paid ${mature.value} koinu (95% of ${GROSS}) once\n`);

    const second = judgePrincipalSpend(matureHex, built.prinSpk, prevValue, unspent);
    expect(second.scriptOk).to.equal(true);
    expect(second.available).to.equal(false);
    expect(second.accept).to.equal(false);
    expect(unspent.size).to.equal(0);
  });
});
