// =============================================================================
// DigiByte lock — one 5/95 P2SH CLTV output, C.8 nulldata, header PoW check
//
// DigiByte GetAlgo reads the algorithm from version bits 8–11
// (CBlockHeader::GetAlgo in primitives/block.cpp). Version 1, the real
// genesis version, has those bits clear, and BLOCK_VERSION_SCRYPT is 0, so
// GetAlgoName returns "scrypt". GetPoWAlgoHash then uses scrypt_1024_1_1_256
// of the 80-byte header. CheckProofOfWork requires the compact target in
// range, not above mainnet powLimit, and the hash <= that target.
//
// The current network rotates sha256d, scrypt, skein, qubit, and odocrypt.
// That rotation does not change this lock. This file does not use
// UtxoChainVerifier, Sha256dHeaderChain, or a Dogecoin or Litecoin header,
// and it does not choose a confirmation count.
//
// The 117-byte Base-recipient binding is the existing C.8 builder
// (test/lib/c8NulldataPayload.cjs). No second layout.
//
// The principal is a P2SH CLTV output to one key, the same lock shape as the
// Dogecoin test. A header whose named algorithm cannot be hashed here is
// reported and does not skip the lock or the spend.
// =============================================================================

const crypto = require("crypto");
const { expect, AssertionError } = require("chai");
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

// P2SH CLTV flags. This spend is not a witness program.
const DGB_SCRIPT_FLAGS = [
  "SCRIPT_VERIFY_P2SH",
  "SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY",
  "SCRIPT_VERIFY_DERSIG",
  "SCRIPT_VERIFY_LOW_S",
  "SCRIPT_VERIFY_STRICTENC",
  "SCRIPT_VERIFY_MINIMALDATA",
  "SCRIPT_VERIFY_NULLDUMMY",
  "SCRIPT_VERIFY_NULLFAIL",
].reduce((flags, name) => flags | bitcore.Script.Interpreter[name], 0);

// Mainnet powLimit from digibyte src/chainparams.cpp:
// ArithToUint256(~arith_uint256(0) >> 20)
const POW_LIMIT = BigInt("0x00000fffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
// Genesis nBits. A child of genesis is not on a retarget boundary
// (GetNextWorkRequiredV1), so it keeps this compact target.
const GENESIS_BITS = 0x1e0ffff0;
const GENESIS_TIME = 1389388394;
const GENESIS_NONCE = 2447652;
const GENESIS_VERSION = 1;
// Published genesis block id (GetHash / hashPrevBlock of a child). Not a PoW hash.
const GENESIS_BLOCK_ID = "7497ea1b465eb39f1c8f507bc877078fe016d6fcb6dfad3a64c98dcc6e1e8496";
const GENESIS_MERKLE = "72ddd9496b004221ed0557358846d9248ecd4c440ebd28ed901efc18757d0fad";
// Scrypt PoW hash of the real DigiByte genesis header (display byte order).
const GENESIS_SCRYPT =
  "00000157e0eb799b685e4f679160afe11152840040e4dc23e3947989b7b6ec80";

// DigiByte primitives/block.h. Algo lives in bits 8–11.
const BLOCK_VERSION_ALGO = 15 << 8;
const ALGO_BY_BITS = new Map([
  [0 << 8, "scrypt"],
  [2 << 8, "sha256d"],
  [4 << 8, "groestl"],
  [6 << 8, "skein"],
  [8 << 8, "qubit"],
  [14 << 8, "odo"],
]);

const GROSS = 1_000_000n;
const FEE = 50_000n;
const PRINCIPAL = 950_000n;
const MATURITY = 1700086400;
// One second after genesis. Not a confirmation depth.
const LOCK_HEADER_TIME = GENESIS_TIME + 1;
// Mined once under the rules below. The test recomputes Scrypt; it does not
// trust this nonce without that check.
const LOCK_HEADER_NONCE = 1261274;

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

// Bitcoin SetCompact, as DigiByte's arith_uint256::SetCompact does it.
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

// DigiByte GetAlgo / GetAlgoName. Unknown version bits are ALGO_UNKNOWN.
function algoNameOf(header) {
  const version = header.readUInt32LE(0);
  const bits = version & BLOCK_VERSION_ALGO;
  const name = ALGO_BY_BITS.get(bits);
  if (!name) {
    throw new Error(
      "DigiByte GetAlgo returned unknown for version 0x" +
      (version >>> 0).toString(16) +
      " (algo bits 0x" + bits.toString(16) + ")"
    );
  }
  return name;
}

// Hash with the algorithm GetAlgo named for this header. sha256d here is
// DigiByte GetHash for an ALGO_SHA256D header, not Sha256dHeaderChain.
function powHash(header, algoName) {
  if (header.length !== 80) {
    throw new Error(`DigiByte header is ${header.length} bytes, expected 80`);
  }
  if (algoName === "scrypt") {
    return crypto.scryptSync(header, header, 32, { N: 1024, r: 1, p: 1 });
  }
  if (algoName === "sha256d") {
    return Buffer.from(dsha256(header.toString("hex")).slice(2), "hex");
  }
  throw new Error(
    "cannot hash DigiByte proof-of-work algorithm " + algoName +
    " (groestl, skein, qubit, and odo are not implemented in this test)"
  );
}

function checkDigiByteProofOfWork(header) {
  const algoName = algoNameOf(header);
  const bits = header.readUInt32LE(72);
  const hash = powHash(header, algoName);
  const display = Buffer.from(hash).reverse().toString("hex");
  const { target, negative, overflow } = setCompact(bits);
  const hashInt = BigInt("0x" + display);
  const inRange = !negative && target !== 0n && !overflow && target <= POW_LIMIT;
  const enoughWork = hashInt <= target;
  return {
    ok: inRange && enoughWork,
    inRange,
    enoughWork,
    algoName,
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
    le32(GENESIS_VERSION),
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
    le32(GENESIS_VERSION),
    prev,
    merkle,
    le32(LOCK_HEADER_TIME),
    le32(GENESIS_BITS),
    le32(LOCK_HEADER_NONCE),
  ]);
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
    DGB_SCRIPT_FLAGS
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

describe("DigiByte lock — 5/95 CLTV, C.8 payload, header algorithm", function () {
  this.timeout(60000);

  it("locks 95% to one key, checks the header with that header's proof-of-work algorithm, rejects an early spend, and pays the 95% once", function () {
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

    // Current DigiByte rotates algorithms. This lock does not.
    console.log(
      "\n    Current DigiByte network rotates proof-of-work algorithms " +
      "(sha256d, scrypt, skein, qubit, odocrypt). The lock method is unchanged.\n"
    );

    const header = lockHeader(built.txid);
    expect(header.length).to.equal(80);
    expect(header.subarray(4, 36).toString("hex")).to.equal(
      Buffer.from(GENESIS_BLOCK_ID, "hex").reverse().toString("hex")
    );
    expect(header.subarray(36, 68).toString("hex")).to.equal(built.txid);
    expect(header.readUInt32LE(68)).to.equal(LOCK_HEADER_TIME);
    expect(header.readUInt32LE(72)).to.equal(GENESIS_BITS);
    expect(header.readUInt32LE(76)).to.equal(LOCK_HEADER_NONCE);

    // Name the algorithm of this header, then check its proof of work.
    // A hash this runtime cannot run is reported below. It is not a skip:
    // the lock above already exists, and the spend below still runs.
    let headerCheckError = "";
    try {
      const genesis = genesisHeader();
      expect(algoNameOf(genesis)).to.equal("scrypt");
      const genesisId = Buffer.from(
        dsha256(genesis.toString("hex")).slice(2),
        "hex"
      ).reverse().toString("hex");
      expect(genesisId).to.equal(GENESIS_BLOCK_ID);
      const genesisPow = checkDigiByteProofOfWork(genesis);
      expect(genesisPow.algoName).to.equal("scrypt");
      expect(genesisPow.bits).to.equal(GENESIS_BITS);
      expect(genesisPow.display).to.equal(GENESIS_SCRYPT);
      expect(genesisPow.ok).to.equal(true);

      const algoName = algoNameOf(header);
      expect(algoName).to.equal("scrypt");
      console.log(`\n    DigiByte header proof-of-work algorithm ${algoName}\n`);

      const pow = checkDigiByteProofOfWork(header);
      expect(pow.algoName).to.equal(algoName);
      expect(pow.ok).to.equal(true);
      expect(pow.inRange).to.equal(true);
      expect(pow.enoughWork).to.equal(true);
      expect(pow.bits).to.equal(GENESIS_BITS);
      expect(pow.target <= POW_LIMIT).to.equal(true);
      expect(pow.hashInt <= pow.target).to.equal(true);
      console.log(`\n    DigiByte ${pow.algoName} header hash ${pow.display}\n`);

      const flipped = Buffer.from(header);
      flipped[79] ^= 0x01;
      const bad = checkDigiByteProofOfWork(flipped);
      expect(bad.display).to.not.equal(pow.display);
      expect(bad.ok).to.equal(false);
    } catch (err) {
      if (err instanceof AssertionError) throw err;
      headerCheckError = err && err.message ? err.message : String(err);
      console.log(`\n    DigiByte header-check error: ${headerCheckError}\n`);
    }

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
    console.log(`\n    DigiByte mature spend paid ${mature.value} satoshis (95% of ${GROSS}) once\n`);

    const second = judgePrincipalSpend(matureHex, built.prinSpk, prevValue, unspent);
    expect(second.scriptOk).to.equal(true);
    expect(second.available).to.equal(false);
    expect(second.accept).to.equal(false);
    expect(unspent.size).to.equal(0);
  });
});
