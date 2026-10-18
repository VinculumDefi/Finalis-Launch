// Read-only: fetches one REAL block from a public RPC, rebuilds its header RLP
// (must hash to the block hash) and its receipts trie (must equal
// receiptsRoot), and writes a parsing fixture for EvmReceiptLockReader tests.
// Usage: node scripts/fetchEvmReceiptFixture.cjs <chain> [blockNumber]
// chain: ethereum | optimism | polygon | bsc | avalanche | arbitrum
// Nothing is signed or sent. The fixture is NOT a CommitmentVaultLock lock.
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");
const { rlpUint, nibblesOf, insert, prove, rootHash } = require("../test/lib/receiptTrie.cjs");

const STD = ["parentHash", "sha3Uncles", "miner", "stateRoot", "transactionsRoot", "receiptsRoot", "logsBloom",
  "difficulty:q", "number:q", "gasLimit:q", "gasUsed:q", "timestamp:q", "extraData", "mixHash", "nonce"];
const GETH_TAIL = ["baseFeePerGas:q", "withdrawalsRoot", "blobGasUsed:q", "excessBlobGas:q", "parentBeaconBlockRoot", "requestsHash"];
// coreth HeaderSerializable order, plus the later fields the live C-Chain
// returns (order fixed empirically: the encoding must reproduce the block hash).
const AVAX_TAIL = ["extDataHash", "baseFeePerGas:q", "extDataGasUsed:q", "blockGasCost:q", "blobGasUsed:q", "excessBlobGas:q",
  "parentBeaconBlockRoot", "timestampMilliseconds:q", "minDelayExcess:q", "targetExponent:q", "minPriceExponent:q",
  "settledHeight:q", "settledGasUnix:q", "settledGasNumerator:q", "settledExcess:q"];

const CHAINS = {
  ethereum: { rpc: "https://ethereum-rpc.publicnode.com", chainId: 1, env: "Ethereum", fields: [...STD, ...GETH_TAIL] },
  optimism: { rpc: "https://optimism-rpc.publicnode.com", chainId: 10, env: "Optimism", fields: [...STD, ...GETH_TAIL] },
  polygon: { rpc: "https://polygon-bor-rpc.publicnode.com", chainId: 137, env: "Polygon", fields: [...STD, ...GETH_TAIL] },
  bsc: { rpc: "https://bsc-rpc.publicnode.com", chainId: 56, env: "BNB Smart Chain", fields: [...STD, ...GETH_TAIL] },
  avalanche: { rpc: "https://avalanche-c-chain-rpc.publicnode.com", chainId: 43114, env: "Avalanche", fields: [...STD, ...AVAX_TAIL] },
  arbitrum: { rpc: "https://arb1.arbitrum.io/rpc", chainId: 42161, env: "Arbitrum", fields: [...STD, ...GETH_TAIL] },
};

const q = (v) => (BigInt(v) === 0n ? "0x" : ethers.toBeHex(BigInt(v)));

function encodeHeader(b, fields) {
  const items = [];
  for (const f of fields) {
    const [k, t] = f.split(":");
    if (b[k] === undefined || b[k] === null) break;
    items.push(t === "q" ? q(b[k]) : b[k]);
  }
  return ethers.encodeRlp(items);
}

function encodeReceipt(r) {
  const fields = [q(r.status), q(r.cumulativeGasUsed), r.logsBloom, r.logs.map((l) => [l.address, l.topics, l.data])];
  const type = Number(r.type);
  // OP Stack deposit receipts (0x7e) carry depositNonce and, from Canyon, depositReceiptVersion.
  if (type === 0x7e && r.depositNonce != null) {
    fields.push(q(r.depositNonce));
    if (r.depositReceiptVersion != null) fields.push(q(r.depositReceiptVersion));
  }
  const body = ethers.encodeRlp(fields);
  return type === 0 ? body : ethers.concat([ethers.toBeHex(type, 1), body]);
}

async function main() {
  const name = process.argv[2];
  const c = CHAINS[name];
  if (!c) throw new Error("chain: " + Object.keys(CHAINS).join(" | "));
  const p = new ethers.JsonRpcProvider(c.rpc, c.chainId, { staticNetwork: true });
  const tag = process.argv[3] ? ethers.toQuantity(BigInt(process.argv[3])) : "latest";
  const b = await p.send("eth_getBlockByNumber", [tag, false]);
  const headerRlp = encodeHeader(b, c.fields);
  if (ethers.keccak256(headerRlp) !== b.hash) throw new Error("header RLP does not reproduce the block hash");
  // Avalanche C-Chain (asynchronous settlement): a header's receiptsRoot
  // commits to the receipts of the block named by settledHeight, not its own.
  let receiptsBlock = b.number;
  if (b.settledHeight != null) {
    const prev = await p.send("eth_getBlockByNumber", [ethers.toQuantity(BigInt(b.number) - 1n), false]);
    if (BigInt(b.settledHeight) - BigInt(prev.settledHeight) !== 1n) throw new Error("pick a header that settles exactly one block");
    receiptsBlock = b.settledHeight;
  }
  let rs = await p.send("eth_getBlockReceipts", [receiptsBlock]);
  rs.sort((x, y) => Number(x.transactionIndex) - Number(y.transactionIndex));
  const build = (list) => {
    let root = null;
    list.forEach((r, i) => { root = insert(root, nibblesOf(rlpUint(i)), ethers.getBytes(encodeReceipt(r))); });
    return root;
  };
  let root = build(rs);
  let excluded = [];
  if (ethers.hexlify(rootHash(root)) !== b.receiptsRoot) {
    // Polygon (Bor): the state-sync receipt is kept outside the receipts trie.
    const kept = rs.filter((r) => r.from !== "0x0000000000000000000000000000000000000000" || r.to !== "0x0000000000000000000000000000000000000000");
    excluded = rs.filter((r) => !kept.includes(r)).map((r) => r.transactionHash);
    rs = kept;
    root = build(rs);
  }
  if (ethers.hexlify(rootHash(root)) !== b.receiptsRoot) throw new Error("receipts root mismatch");
  const pick = new Set([0, rs.length - 1]);
  const typed = rs.findIndex((r) => Number(r.type) === 2 && r.logs.length > 0 && r.status === "0x1");
  if (typed >= 0) pick.add(typed);
  const legacy = rs.findIndex((r) => Number(r.type) === 0 && r.logs.length > 0);
  if (legacy >= 0) pick.add(legacy);
  const receipts = [...pick].sort((a, x) => a - x).map((i) => ({
    index: i, type: rs[i].type, status: rs[i].status, txHash: rs[i].transactionHash,
    receipt: encodeReceipt(rs[i]),
    nodes: prove(root, nibblesOf(rlpUint(i))).map((n) => ethers.hexlify(n)),
    logs: rs[i].logs.map((l) => ({ address: l.address, topics: l.topics, data: l.data })),
  }));
  const out = {
    note: `REAL ${c.env} (chain ${c.chainId}) block and receipts, fetched read-only from ${new URL(c.rpc).host}. NOT a CommitmentVaultLock lock. Used for header/receipt parsing only.`,
    chainId: c.chainId, environmentId: c.env, blockNumber: Number(b.number), blockHash: b.hash,
    receiptsRoot: b.receiptsRoot, timestamp: Number(b.timestamp), headerFieldCount: ethers.decodeRlp(headerRlp).length,
    receiptCount: rs.length, receiptsBlockNumber: Number(receiptsBlock), excludedFromTrie: excluded, headerRlp, receipts,
  };
  if (b.settledHeight != null) out.settledHeight = Number(b.settledHeight);
  if (b.sendRoot) { out.sendRoot = b.sendRoot; out.l1BlockNumber = b.l1BlockNumber; }
  const file = path.join(__dirname, "..", "test", "fixtures", `${name === "bsc" ? "bnb_smart_chain" : name}_mainnet_receipt.json`);
  fs.writeFileSync(file, JSON.stringify(out, null, 1));
  console.log(name, "block", out.blockNumber, "fields", out.headerFieldCount, "receipts", rs.length, "excluded", excluded.length, "->", path.basename(file));
}
main().catch((e) => { console.error(e.message); process.exit(1); });
