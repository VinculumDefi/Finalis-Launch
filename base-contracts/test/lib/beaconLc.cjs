// Helpers for the Altair sync-committee light client (EthereumBeaconLightClient).
// SSZ roots, signing domains, EIP-2537 point encodings, a sparse SSZ tree
// builder for local beacon states, and a deterministic local sync committee.
const { ethers } = require("hardhat");
const { bls12_381: bls } = require("@noble/curves/bls12-381");
const { beaconRoot } = require("./execHeader.cjs");

const DST = "BLS_SIG_BLS12381G2_XMD:SHA-256_SSWU_RO_POP_";
const DOMAIN_SYNC_COMMITTEE = "0x07000000";
const SLOTS_PER_PERIOD = 8192;
const G = { FINALIZED_ROOT: 169, CURRENT_SC: 86, NEXT_SC: 87, BLOCK_ROOTS: 69, BLOCK_HASH_IN_BODY: 812 };
const sha = (a, b) => ethers.sha256(ethers.concat([a, b]));
const Z = ethers.ZeroHash;

function merkleize(chunks, limit) {
  let n = 1;
  while (n < (limit || chunks.length)) n *= 2;
  let layer = chunks.slice();
  while (layer.length < n) layer.push(Z);
  while (layer.length > 1) {
    const next = [];
    for (let i = 0; i < layer.length; i += 2) next.push(sha(layer[i], layer[i + 1]));
    layer = next;
  }
  return layer[0];
}

const pad32 = (b) => ethers.zeroPadBytes(b, 32);
function uintLE(v, bytes = 8) {
  let n = BigInt(v);
  const out = new Uint8Array(32);
  for (let i = 0; i < bytes; i++) { out[i] = Number(n & 0xffn); n >>= 8n; }
  return ethers.hexlify(out);
}
const pubkeyRoot = (pk) => { const b = ethers.getBytes(pk); return sha(b.slice(0, 32), pad32(b.slice(32, 48))); };

function committeeRoot(pubkeys, aggregate) {
  return sha(merkleize(pubkeys.map(pubkeyRoot), 512), pubkeyRoot(aggregate));
}

function forkDomain(forkVersion, gvr, type = DOMAIN_SYNC_COMMITTEE) {
  const forkDataRoot = sha(pad32(forkVersion), gvr);
  return ethers.concat([type, ethers.dataSlice(forkDataRoot, 0, 28)]);
}

const signingRoot = (header, domain) => sha(beaconRoot(header), domain);

function chunkBytes(hex) {
  const b = ethers.getBytes(hex);
  const out = [];
  for (let i = 0; i < b.length; i += 32) out.push(pad32(b.slice(i, i + 32)));
  return out;
}

// Deneb..Fulu ExecutionPayloadHeader field roots (17 fields).
function payloadHeaderFields(e) {
  const extra = ethers.getBytes(e.extra_data);
  return [
    e.parent_hash, pad32(e.fee_recipient), e.state_root, e.receipts_root,
    merkleize(chunkBytes(e.logs_bloom)), e.prev_randao, uintLE(e.block_number), uintLE(e.gas_limit),
    uintLE(e.gas_used), uintLE(e.timestamp), sha(merkleize(extra.length ? chunkBytes(e.extra_data) : [], 1), uintLE(extra.length)),
    uintLE(e.base_fee_per_gas, 32), e.block_hash, e.transactions_root, e.withdrawals_root,
    uintLE(e.blob_gas_used), uintLE(e.excess_blob_gas),
  ];
}

// Branch from block_hash (field 12 of 32 leaves) to payload root, then the
// API's execution_branch (payload root -> body root): gindex 812 overall.
function blockHashBranch(e, executionBranch) {
  const leaves = payloadHeaderFields(e);
  while (leaves.length < 32) leaves.push(Z);
  const branch = [];
  let idx = 12;
  let layer = leaves;
  while (layer.length > 1) {
    branch.push(layer[idx ^ 1]);
    const next = [];
    for (let i = 0; i < layer.length; i += 2) next.push(sha(layer[i], layer[i + 1]));
    layer = next;
    idx >>= 1;
  }
  return branch.concat(executionBranch);
}

function verifyBranch(leaf, branch, gindex) {
  let h = leaf;
  let g = gindex;
  for (const s of branch) { h = g & 1 ? sha(s, h) : sha(h, s); g = Math.floor(g / 2); }
  return h;
}

// Sparse SSZ tree: set leaves at generalized indices; everything else is a
// deterministic filler. Returns root and branch(g).
function sparseTree(leaves, seed = "filler") {
  const memo = new Map();
  const set = new Map(Object.entries(leaves).map(([g, v]) => [BigInt(g), v]));
  const depthOf = (g) => { let d = 0; while (g > 1n) { g >>= 1n; d++; } return d; };
  const hasBelow = (g) => {
    for (const k of set.keys()) {
      let x = k;
      const dk = depthOf(k), dg = depthOf(g);
      if (dk < dg) continue;
      x >>= BigInt(dk - dg);
      if (x === g) return true;
    }
    return false;
  };
  const node = (g) => {
    const key = g.toString();
    if (memo.has(key)) return memo.get(key);
    let v;
    if (set.has(g)) v = set.get(g);
    else if (!hasBelow(g)) v = ethers.keccak256(ethers.toUtf8Bytes(seed + ":" + key));
    else v = sha(node(2n * g), node(2n * g + 1n));
    memo.set(key, v);
    return v;
  };
  return {
    root: node(1n),
    branch(g) {
      const out = [];
      let x = BigInt(g);
      while (x > 1n) { out.push(node(x ^ 1n)); x >>= 1n; }
      return out;
    },
  };
}

// ---- EIP-2537 encodings ----
const fp = (n) => ethers.toBeHex(n, 64);
function g1Bytes(point) { const a = point.toAffine(); return ethers.concat([fp(a.x), fp(a.y)]); }
function g2Bytes(point) {
  const a = point.toAffine();
  return ethers.concat([fp(a.x.c0), fp(a.x.c1), fp(a.y.c0), fp(a.y.c1)]);
}
const g1FromCompressed = (hex) => bls.G1.ProjectivePoint.fromHex(ethers.getBytes(hex).slice());
const g2FromCompressed = (hex) => bls.G2.ProjectivePoint.fromHex(ethers.getBytes(hex).slice());
// Committee as the contract wants it: per key x||y (48+48 bytes, big-endian).
function committeeXY(pubkeys) {
  return ethers.concat(pubkeys.map((pk) => {
    const a = g1FromCompressed(pk).toAffine();
    return ethers.concat([ethers.toBeHex(a.x, 48), ethers.toBeHex(a.y, 48)]);
  }));
}

// ---- deterministic local committee ----
function localCommittee(tag) {
  const sks = [];
  for (let i = 0; i < 512; i++) {
    const h = BigInt(ethers.keccak256(ethers.toUtf8Bytes(`${tag}:${i}`))) % bls.params.r;
    sks.push(h === 0n ? 1n : h);
  }
  const pts = sks.map((sk) => bls.G1.ProjectivePoint.BASE.multiply(sk));
  const pubkeys = pts.map((p) => ethers.hexlify(p.toRawBytes(true)));
  const agg = ethers.hexlify(pts.reduce((a, b) => a.add(b)).toRawBytes(true));
  return { sks, pubkeys, aggregate: agg, root: committeeRoot(pubkeys, agg) };
}

function signBits(committee, msg, bitsFn = () => true) {
  const H = bls.G2.hashToCurve(ethers.getBytes(msg), { DST });
  let sum = 0n;
  const bits = new Uint8Array(64);
  committee.sks.forEach((sk, i) => {
    if (bitsFn(i)) { bits[i >> 3] |= 1 << (i & 7); sum = (sum + sk) % bls.params.r; }
  });
  return { bits: ethers.hexlify(bits), signature: g2Bytes(H.multiply(sum)) };
}

const hdrTuple = (h) => [h.slot, h.proposer_index ?? h.proposerIndex, h.parent_root ?? h.parentRoot, h.state_root ?? h.stateRoot, h.body_root ?? h.bodyRoot];
const toHdr = (h) => ({ slot: BigInt(h.slot), proposerIndex: BigInt(h.proposer_index), parentRoot: h.parent_root, stateRoot: h.state_root, bodyRoot: h.body_root });

module.exports = {
  DST, G, SLOTS_PER_PERIOD, bls, sha, merkleize, committeeRoot, forkDomain, signingRoot, blockHashBranch,
  verifyBranch, sparseTree, g1Bytes, g2Bytes, g1FromCompressed, g2FromCompressed, committeeXY, localCommittee,
  signBits, hdrTuple, toHdr, beaconRoot,
};
