// Solana wire helpers for the test rig. TEST ONLY.
// Base58, legacy transaction encode/parse, ed25519 signature checks, PDA
// derivation, Anchor discriminators and the borsh layout of the vault
// program's LockCreated event. No network access here.
"use strict";
const crypto = require("crypto");
const path = require("path");
const nm = path.join(__dirname, "../../base-contracts/node_modules");
const bs58m = require(path.join(nm, "bs58"));
const bs58 = bs58m.default || bs58m;
const { ed25519 } = require(path.join(nm, "@noble/curves/ed25519"));

const sha256 = (...parts) => crypto.createHash("sha256").update(Buffer.concat(parts.map((p) => Buffer.from(p)))).digest();
const b58 = (buf) => bs58.encode(Buffer.from(buf));
const unb58 = (s) => Buffer.from(bs58.decode(s));

function isOnCurve(pk) {
  try { ed25519.ExtendedPoint.fromHex(Buffer.from(pk).toString("hex")); return true; } catch { return false; }
}

function findPda(seeds, programId) {
  const pid = unb58(programId);
  for (let bump = 255; bump >= 0; bump--) {
    const h = sha256(...seeds.map(Buffer.from), Buffer.from([bump]), pid, Buffer.from("ProgramDerivedAddress"));
    if (!isOnCurve(h)) return { address: b58(h), bump };
  }
  throw new Error("no PDA");
}

const anchorIx = (name) => sha256(Buffer.from("global:" + name)).subarray(0, 8);
const anchorEvent = (name) => sha256(Buffer.from("event:" + name)).subarray(0, 8);

// ---- compact-u16 (shortvec)
function shortvec(n) {
  const out = [];
  for (;;) { let b = n & 0x7f; n >>= 7; if (n) { out.push(b | 0x80); } else { out.push(b); return Buffer.from(out); } }
}
function readShortvec(buf, o) {
  let n = 0, s = 0;
  for (;;) { const b = buf[o++]; n |= (b & 0x7f) << s; s += 7; if (!(b & 0x80)) return [n, o]; }
}

// Legacy message. keys: [{pubkey, signer, writable}], first key is fee payer.
function compileMessage(payer, ixs, recentBlockhash) {
  const map = new Map();
  const add = (k, signer, writable) => {
    const e = map.get(k) || { pubkey: k, signer: false, writable: false };
    e.signer ||= signer; e.writable ||= writable; map.set(k, e);
  };
  add(payer, true, true);
  for (const ix of ixs) { for (const a of ix.keys) add(a.pubkey, a.signer, a.writable); add(ix.programId, false, false); }
  const all = [...map.values()];
  const rank = (e) => (e.signer ? (e.writable ? 0 : 1) : (e.writable ? 2 : 3));
  const keys = [all[0], ...all.slice(1).sort((a, b) => rank(a) - rank(b))];
  const idx = (k) => keys.findIndex((e) => e.pubkey === k);
  const header = Buffer.from([
    keys.filter((e) => e.signer).length,
    keys.filter((e) => e.signer && !e.writable).length,
    keys.filter((e) => !e.signer && !e.writable).length,
  ]);
  const parts = [header, shortvec(keys.length), ...keys.map((e) => unb58(e.pubkey)), unb58(recentBlockhash), shortvec(ixs.length)];
  for (const ix of ixs) {
    parts.push(Buffer.from([idx(ix.programId)]), shortvec(ix.keys.length), Buffer.from(ix.keys.map((a) => idx(a.pubkey))), shortvec(ix.data.length), Buffer.from(ix.data));
  }
  return { message: Buffer.concat(parts), signers: keys.filter((e) => e.signer).map((e) => e.pubkey) };
}

function signTransaction(message, signerSecrets /* array of 32-byte seeds, in signer order */) {
  const sigs = signerSecrets.map((sk) => Buffer.from(ed25519.sign(message, sk)));
  return Buffer.concat([shortvec(sigs.length), ...sigs, message]);
}

// Parse a legacy or v0 transaction (base64 wire bytes). v0 lookups are kept
// but not resolved; the checker refuses v0 for the vault program.
function parseTransaction(wire) {
  const buf = Buffer.from(wire);
  let [nsig, o] = readShortvec(buf, 0);
  const signatures = [];
  for (let i = 0; i < nsig; i++) { signatures.push(buf.subarray(o, o + 64)); o += 64; }
  const message = buf.subarray(o);
  let m = 0; let version = "legacy";
  if (message[0] & 0x80) { version = message[0] & 0x7f; m = 1; }
  const header = { numRequiredSignatures: message[m], numReadonlySigned: message[m + 1], numReadonlyUnsigned: message[m + 2] };
  m += 3;
  let nkeys; [nkeys, m] = readShortvec(message, m);
  const accountKeys = [];
  for (let i = 0; i < nkeys; i++) { accountKeys.push(b58(message.subarray(m, m + 32))); m += 32; }
  const recentBlockhash = b58(message.subarray(m, m + 32)); m += 32;
  let nix; [nix, m] = readShortvec(message, m);
  const instructions = [];
  for (let i = 0; i < nix; i++) {
    const programIdIndex = message[m++];
    let na; [na, m] = readShortvec(message, m);
    const accounts = [...message.subarray(m, m + na)]; m += na;
    let nd; [nd, m] = readShortvec(message, m);
    const data = message.subarray(m, m + nd); m += nd;
    instructions.push({ programIdIndex, accounts, data });
  }
  return { signatures, message, version, header, accountKeys, recentBlockhash, instructions };
}

function verifySignatures(tx) {
  if (tx.signatures.length !== tx.header.numRequiredSignatures) return false;
  for (let i = 0; i < tx.signatures.length; i++) {
    const pk = unb58(tx.accountKeys[i]);
    let ok = false;
    try { ok = ed25519.verify(tx.signatures[i], tx.message, pk); } catch { ok = false; }
    if (!ok) return false;
  }
  return true;
}

// ---- borsh
class Reader {
  constructor(buf) { this.b = Buffer.from(buf); this.o = 0; }
  need(n) { if (this.o + n > this.b.length) throw new Error("borsh: short"); }
  u8() { this.need(1); return this.b[this.o++]; }
  u32() { this.need(4); const v = this.b.readUInt32LE(this.o); this.o += 4; return v; }
  u64() { this.need(8); const v = this.b.readBigUInt64LE(this.o); this.o += 8; return v; }
  u128() { const lo = this.u64(); const hi = this.u64(); return (hi << 64n) | lo; }
  bytes(n) { this.need(n); const v = this.b.subarray(this.o, this.o + n); this.o += n; return Buffer.from(v); }
  str() { const n = this.u32(); return this.bytes(n).toString("utf8"); }
  done() { return this.o === this.b.length; }
}
const u64le = (v) => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(v)); return b; };
const u128le = (v) => Buffer.concat([u64le(BigInt(v) & ((1n << 64n) - 1n)), u64le(BigInt(v) >> 64n)]);
const u32le = (v) => { const b = Buffer.alloc(4); b.writeUInt32LE(v); return b; };
const borshStr = (s) => Buffer.concat([u32le(Buffer.byteLength(s)), Buffer.from(s)]);

function encodeCommitParams(p) {
  return Buffer.concat([
    borshStr(p.lockId), sha256(Buffer.from(p.lockId)), u128le(p.grossAmount), u64le(p.durationSecs),
    Buffer.from(p.baseRecipient.replace(/^0x/, ""), "hex"), unb58(p.releaseDestination),
    Buffer.from([p.outputToken]), u128le(p.verifiedGrossUsd18), borshStr(p.chonxReceipt || ""),
  ]);
}
function decodeCommitParams(data) {
  const r = new Reader(data);
  const p = {
    lockId: r.str(), lockIdHash: r.bytes(32).toString("hex"), grossAmount: r.u128(), durationSecs: r.u64(),
    baseRecipient: "0x" + r.bytes(20).toString("hex"), releaseDestination: b58(r.bytes(32)),
    outputToken: r.u8(), verifiedGrossUsd18: r.u128(), chonxReceipt: r.str(),
  };
  if (!r.done()) throw new Error("commit params: trailing bytes");
  return p;
}
function decodeLockCreated(data) {
  const r = new Reader(data);
  const e = {
    lockId: r.str(), sourceAccount: b58(r.bytes(32)), canonicalAsset: r.str(),
    grossAmount: r.u128(), feeAmount: r.u128(), principalAmount: r.u128(), verifiedGrossUsd18: r.u128(),
    durationSecs: r.u64(), maturityTimeSecs: r.u64(), baseRecipient: "0x" + r.bytes(20).toString("hex"),
    releaseDestination: b58(r.bytes(32)), outputToken: r.u8(), lockType: r.u8(),
  };
  if (!r.done()) throw new Error("LockCreated: trailing bytes");
  return e;
}

module.exports = {
  bs58, b58, unb58, sha256, findPda, anchorIx, anchorEvent, compileMessage, signTransaction, parseTransaction,
  verifySignatures, encodeCommitParams, decodeCommitParams, decodeLockCreated, u64le, ed25519,
};
