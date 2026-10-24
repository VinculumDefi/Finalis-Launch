// eth_anchor.mjs: builds an Ethereum finality-anchor proof for the
// EthereumStorageLockReader from PUBLIC data only, read-only.
//
//   Base block (EIP-4788 entry) -> beacon root R (attested header)
//   -> BeaconState(R): genesis_validators_root, fork.current_version,
//      finalized_checkpoint.root = F
//   -> finalized beacon block F -> execution payload state_root,
//      block_number, block_hash
//   -> eth_getProof for the lock account and its storage at that block.
//
// It never signs, never sends a transaction and never needs a key.
// VF-XCH-012: whoever runs it is transport only; the contract checks
// everything it outputs.
//
// Usage: node eth_anchor.mjs <out.json> [lockId-hex]
//   env BASE_RPC, ETH_RPC, BEACON_API override the public endpoints.
import { computeDescriptor, createNodeFromProof, Tree } from "@chainsafe/persistent-merkle-tree";
import { ethers } from "ethers";
import { ssz } from "@lodestar/types";
import fs from "node:fs";

const BASE_RPC = process.env.BASE_RPC || "https://mainnet.base.org";
const ETH_RPC = process.env.ETH_RPC || "https://eth.drpc.org";
// Headers from any standard beacon API; SSZ proofs from a Lodestar node
// (/eth/v0/beacon/proof). Both are re-checked here and on-chain.
const BEACON = process.env.BEACON_API || "https://ethereum-beacon-api.publicnode.com";
const PROOF_API = process.env.PROOF_API || "https://lodestar-mainnet.chainsafe.io";
const BEACON_ROOTS = "0x000F3df6D732807Ef1319fB7B8bB8522d0Beac02";
const LOCK = "0x115b2B47330cD1b7550D347f44df2e151D4A626E";
const NON_LOCK = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"; // WETH9, a real non-lock contract
const RETIRED = ["0x5AB40cdD51036EA88889c26E182b2936Ddf76a8A", "0x4eDE54E1cb6E337923F8D63Fa0799AE778263b1a"];

// BeaconState (Electra/Fulu, 64 leaves): field 1 genesis_validators_root,
// field 3 fork (Fork: previous_version, current_version, epoch),
// field 20 finalized_checkpoint (Checkpoint: epoch, root).
const G_GVR = 65n, G_FORK_VERSION = 269n, G_FINALIZED_ROOT = 169n;
// BeaconBlockBody (16 leaves) field 9 execution_payload; ExecutionPayload
// (32 leaves) fields 2 state_root, 6 block_number, 12 block_hash.
const G_BODY = { stateRoot: 802n, blockNumber: 806n, blockHash: 812n };
const BODY_IN_BLOCK = 12n; // BeaconBlock field 4 (body), 8 leaves

const hx = (b) => "0x" + Buffer.from(b).toString("hex");

async function rpc(url, method, params) {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  const j = await r.json();
  if (j.error) throw new Error(`${url} ${method}: ${JSON.stringify(j.error)}`);
  return j.result;
}
async function retry(fn) {
  let last;
  for (let i = 0; i < 6; i++) {
    try { return await fn(); } catch (e) { last = e; await new Promise((r) => setTimeout(r, 2000)); }
  }
  throw last;
}
async function beaconJson(path) {
  return retry(async () => {
    const r = await fetch(BEACON + path);
    if (r.status !== 200) throw new Error(`${path}: HTTP ${r.status}`);
    return r.json();
  });
}
async function multiproof(kind, id, gindices) {
  return retry(() => multiproofOnce(kind, id, gindices));
}
async function multiproofOnce(kind, id, gindices) {
  const url = `${PROOF_API}/eth/v0/beacon/proof/${kind}/${id}?format=${hx(computeDescriptor(gindices))}`;
  const r = await fetch(url, { headers: { accept: "application/octet-stream" } });
  if (r.status !== 200) throw new Error(`${url}: HTTP ${r.status} ${await r.text()}`);
  const buf = new Uint8Array(await r.arrayBuffer());
  const dv = new DataView(buf.buffer);
  const o1 = dv.getUint32(0, true), o2 = dv.getUint32(4, true);
  const leaves = [];
  for (let i = o1; i < o2; i += 32) leaves.push(buf.slice(i, i + 32));
  return new Tree(createNodeFromProof({ type: "compactMulti", leaves, descriptor: buf.slice(o2) }));
}
// Branch from leaf upward (sibling at each level), the order BeaconSsz.branchRoot uses.
function branch(tree, gindex) {
  const out = [];
  for (let g = gindex; g > 1n; g >>= 1n) out.push(hx(tree.getNode(g ^ 1n).root));
  return out;
}
function sha(a, b) { return ethers.sha256(ethers.concat([a, b])); }
function branchRoot(leaf, br, gindex) {
  let h = leaf, g = gindex;
  for (const s of br) { h = (g & 1n) ? sha(s, h) : sha(h, s); g >>= 1n; }
  if (g !== 1n) throw new Error("branch depth");
  return h;
}
function u64le(n) { const b = Buffer.alloc(32); b.writeBigUInt64LE(BigInt(n)); return hx(b); }
function headerRoot(m) {
  const z = ethers.ZeroHash;
  return sha(sha(sha(u64le(m.slot), u64le(m.proposer_index)), sha(m.parent_root, m.state_root)),
    sha(sha(m.body_root, z), sha(z, z)));
}
const hdr = (m) => ({ slot: m.slot, proposerIndex: m.proposer_index, parentRoot: m.parent_root, stateRoot: m.state_root, bodyRoot: m.body_root });

async function payloadOf(blockRoot, m) {
  const gs = Object.values(G_BODY).map((g) => (BODY_IN_BLOCK << 9n) | (g - 512n));
  // Full block from the standard API, re-hashed here with the fork's SSZ types.
  const j = await beaconJson(`/eth/v2/beacon/blocks/${blockRoot}`);
  if (!["electra", "fulu"].includes(j.version)) throw new Error(`unsupported fork ${j.version}`);
  const T = ssz[j.version].BeaconBlock;
  const t = new Tree(T.toView(T.fromJson(j.data.message)).node);
  if (hx(t.root) !== blockRoot) throw new Error("block root mismatch");
  const out = {};
  for (const [k, g] of Object.entries(G_BODY)) {
    const full = (BODY_IN_BLOCK << 9n) | (g - 512n);
    const leaf = hx(t.getNode(full).root);
    const br = branch(t, full).slice(0, 9); // body-relative part only
    if (branchRoot(leaf, br, g) !== m.body_root) throw new Error(`body branch ${k}`);
    out[k] = { leaf, branch: br, gindex: Number(g) };
  }
  const bn = Number(Buffer.from(out.blockNumber.leaf.slice(2, 18), "hex").readBigUInt64LE());
  return { ...out, number: bn };
}

async function storageProof(address, slots, blockNumber) {
  return rpc(ETH_RPC, "eth_getProof", [address, slots, ethers.toQuantity(blockNumber)]);
}

const out = process.argv[2] || "eth_anchor_fixture.json";
const lockId = process.argv[3] || ethers.keccak256(ethers.toUtf8Bytes("vinculum eth anchor fixture: no lock with this id"));

// 1. Base block and its EIP-4788 entry.
const baseBlock = await rpc(BASE_RPC, "eth_getBlockByNumber", ["latest", false]);
const baseTs = BigInt(baseBlock.timestamp);
const R = baseBlock.parentBeaconBlockRoot;
const callData = ethers.zeroPadValue(ethers.toBeHex(baseTs), 32);
const viaCall = await rpc(BASE_RPC, "eth_call", [{ to: BEACON_ROOTS, data: callData }, baseBlock.number]);
if (viaCall.toLowerCase() !== R.toLowerCase()) throw new Error("4788 call does not return parentBeaconBlockRoot");
const idx = baseTs % 8191n;
const slotTs = ethers.toQuantity(idx), slotRoot = ethers.toQuantity(idx + 8191n);
const s1 = await rpc(BASE_RPC, "eth_getStorageAt", [BEACON_ROOTS, slotTs, baseBlock.number]);
const s2 = await rpc(BASE_RPC, "eth_getStorageAt", [BEACON_ROOTS, slotRoot, baseBlock.number]);
const code4788 = await rpc(BASE_RPC, "eth_getCode", [BEACON_ROOTS, baseBlock.number]);

// 2. Attested beacon header R and its state facts.
const att = (await beaconJson(`/eth/v1/beacon/headers/${R}`)).data.header.message;
if (headerRoot(att) !== R) throw new Error("attested header does not hash to R");
const st = await multiproof("state", att.state_root, [G_GVR, G_FORK_VERSION, G_FINALIZED_ROOT]);
if (hx(st.root) !== att.state_root) throw new Error("state proof root mismatch");
const leafOf = (g) => ({ leaf: hx(st.getNode(g).root), branch: branch(st, g), gindex: Number(g) });
const stateFacts = { gvr: leafOf(G_GVR), forkVersion: leafOf(G_FORK_VERSION), finalizedRoot: leafOf(G_FINALIZED_ROOT) };
const F = stateFacts.finalizedRoot.leaf;

// 3. Finalized beacon header and its execution payload fields.
const fin = (await beaconJson(`/eth/v1/beacon/headers/${F}`)).data.header.message;
if (headerRoot(fin) !== F) throw new Error("finalized header does not hash to F");
const finPayload = await payloadOf(F, fin);
const attPayload = await payloadOf(R, att); // head, NOT finalized: used by refusal tests

// 4. Independent cross-check of the finalized execution block over Ethereum RPC.
const ethFin = await rpc(ETH_RPC, "eth_getBlockByNumber", [ethers.toQuantity(finPayload.number), false]);
if (ethFin.hash !== finPayload.blockHash.leaf || ethFin.stateRoot !== finPayload.stateRoot.leaf) throw new Error("RPC disagrees with beacon payload");

// 5. Storage proofs at the finalized block (and at the head block for refusal tests).
const recBase = BigInt(ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(["bytes32", "uint256"], [lockId, 1])));
const slots = ["0x0", ...Array.from({ length: 13 }, (_, i) => ethers.toQuantity(recBase + BigInt(i)))];
const lockProof = await storageProof(LOCK, slots, finPayload.number);
const lockProofHead = await storageProof(LOCK, slots, attPayload.number);
const nonLockProof = await storageProof(NON_LOCK, ["0x0"], finPayload.number);
const retired = [];
for (const a of RETIRED) {
  const c = await rpc(ETH_RPC, "eth_getCode", [a, ethers.toQuantity(finPayload.number)]);
  if (c !== "0x") retired.push({ address: a, proof: await storageProof(a, slots, finPayload.number) });
}
const lockCode = await rpc(ETH_RPC, "eth_getCode", [LOCK, ethers.toQuantity(finPayload.number)]);
const devFund = ethers.getAddress("0x" + (await rpc(ETH_RPC, "eth_call", [{ to: LOCK, data: ethers.id("devFund()").slice(0, 10) }, ethers.toQuantity(finPayload.number)])).slice(26));

const fixture = {
  note: "REAL public mainnet data, fetched read-only. Base mainnet EIP-4788 entry, Ethereum beacon headers and SSZ proofs, Ethereum eth_getProof. Nothing synthetic in this file.",
  capturedAt: new Date().toISOString(),
  sources: { baseRpc: BASE_RPC, ethRpc: ETH_RPC, beaconApi: BEACON, proofApi: PROOF_API },
  base: { blockNumber: Number(baseBlock.number), blockHash: baseBlock.hash, timestamp: Number(baseTs),
    parentBeaconBlockRoot: R, beaconRoots: { address: BEACON_ROOTS, code: code4788, slots: { [slotTs]: s1, [slotRoot]: s2 } } },
  attested: { root: R, header: hdr(att), state: stateFacts, payload: attPayload },
  finalized: { root: F, header: hdr(fin), payload: finPayload, rpcCrossCheck: { number: Number(ethFin.number), hash: ethFin.hash, stateRoot: ethFin.stateRoot } },
  lock: { address: LOCK, lockId, recordBaseSlot: ethers.toQuantity(recBase), proof: lockProof, proofAtHead: lockProofHead, code: lockCode, devFund },
  nonLock: { address: NON_LOCK, proof: nonLockProof },
  retiredLocks: retired,
};
fs.writeFileSync(out, JSON.stringify(fixture, null, 1) + "\n");
console.log(`wrote ${out}: base ${fixture.base.blockNumber}, attested slot ${att.slot}, finalized slot ${fin.slot}, exec ${finPayload.number}, retired with code: ${retired.length}`);
