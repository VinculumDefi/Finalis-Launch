// Builds EthereumLockReader evidence from a live (hardhat) chain: the real
// block header RLP, the real receipts trie, and eth_getProof account/storage
// proofs. Nothing here is fabricated; tests tamper with the output.
const { ethers } = require("hardhat");
const { rlpUint, nibblesOf, insert, prove, rootHash } = require("./receiptTrie.cjs");

const HEADER_FIELDS = [
  ["parentHash", "b"], ["sha3Uncles", "b"], ["miner", "b"], ["stateRoot", "b"],
  ["transactionsRoot", "b"], ["receiptsRoot", "b"], ["logsBloom", "b"], ["difficulty", "q"],
  ["number", "q"], ["gasLimit", "q"], ["gasUsed", "q"], ["timestamp", "q"], ["extraData", "b"],
  ["mixHash", "b"], ["nonce", "b"], ["baseFeePerGas", "q"], ["withdrawalsRoot", "b"],
  ["blobGasUsed", "q"], ["excessBlobGas", "q"], ["parentBeaconBlockRoot", "b"], ["requestsHash", "b"],
];

function q(v) {
  const n = BigInt(v);
  return n === 0n ? "0x" : ethers.toBeHex(n);
}

function encodeBlockHeader(block) {
  const items = [];
  for (const [k, t] of HEADER_FIELDS) {
    if (block[k] === undefined || block[k] === null) break;
    items.push(t === "q" ? q(block[k]) : block[k]);
  }
  return ethers.encodeRlp(items);
}

function encodeReceipt(r) {
  const body = ethers.encodeRlp([
    q(r.status),
    q(r.cumulativeGasUsed),
    r.logsBloom,
    r.logs.map((l) => [l.address, l.topics, l.data]),
  ]);
  const type = Number(r.type);
  return type === 0 ? body : ethers.concat([ethers.toBeHex(type, 1), body]);
}

async function ethLockEvidence(lockAddr, txHash, lockId) {
  const provider = ethers.provider;
  const rcpt = await provider.send("eth_getTransactionReceipt", [txHash]);
  const block = await provider.send("eth_getBlockByNumber", [rcpt.blockNumber, false]);
  const headerRlp = encodeBlockHeader(block);
  if (ethers.keccak256(headerRlp) !== block.hash) throw new Error("header rlp does not reproduce block hash");

  let root = null;
  const encoded = [];
  for (let i = 0; i < block.transactions.length; i++) {
    const r = await provider.send("eth_getTransactionReceipt", [block.transactions[i]]);
    encoded.push(encodeReceipt(r));
    root = insert(root, nibblesOf(rlpUint(i)), ethers.getBytes(encoded[i]));
  }
  if (ethers.hexlify(rootHash(root)) !== block.receiptsRoot) throw new Error("receipts root mismatch");
  const receiptIndex = Number(rcpt.transactionIndex);
  const receiptNodes = prove(root, nibblesOf(rlpUint(receiptIndex))).map((n) => ethers.hexlify(n));
  const logIndex = rcpt.logs.findIndex(
    (l) => l.address.toLowerCase() === lockAddr.toLowerCase() && l.topics.length === 4 && l.topics[1] === lockId
  );

  const base = BigInt(ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(["bytes32", "uint256"], [lockId, 1])));
  const slot0 = ethers.zeroPadValue("0x00", 32);
  const slot3 = ethers.toBeHex(base + 3n, 32);
  const proof = await provider.send("eth_getProof", [lockAddr, [slot0, slot3], rcpt.blockNumber]);
  return {
    headerRlp,
    receipt: encoded[receiptIndex],
    receiptIndex,
    receiptNodes,
    logIndex,
    accountNodes: proof.accountProof,
    envSlotNodes: proof.storageProof[0].proof,
    recipientSlotNodes: proof.storageProof[1].proof,
    block,
  };
}

const EVIDENCE_TYPE =
  "tuple(bytes headerRlp, bytes receipt, uint256 receiptIndex, bytes[] receiptNodes, uint256 logIndex, bytes[] accountNodes, bytes[] envSlotNodes, bytes[] recipientSlotNodes)";

function encodeEvidence(e) {
  return ethers.AbiCoder.defaultAbiCoder().encode([EVIDENCE_TYPE], [[
    e.headerRlp, e.receipt, e.receiptIndex, e.receiptNodes, e.logIndex, e.accountNodes, e.envSlotNodes, e.recipientSlotNodes,
  ]]);
}

module.exports = { encodeBlockHeader, encodeReceipt, ethLockEvidence, encodeEvidence, EVIDENCE_TYPE };
