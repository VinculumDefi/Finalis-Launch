// Builds a REAL CommitmentVaultLock lock on a LOCAL Avalanche network (one
// avalanchego node, network-id=local, its own C-Chain, chain id 43112) and
// writes base-contracts/test/fixtures/avalanche_local_lock.json for the
// production AvalancheLockReader test.
//
// The node is the official avalanchego release; its C-Chain headers are the
// genuine Avalanche format (extDataHash, settledHeight, ...), and a later
// header settles the lock's block: its receiptsRoot commits to the lock
// block's receipts. Nothing touches any public network.
//
// Run: start avalanchego locally (see README note in the test), then
//   node non-evm-locks/avalanche/local_lock_fixture.cjs [rpc]
// Funding: set AVAX_LOCAL_FUNDED_KEY to the local-network test key that
// avalanchego's local genesis pre-funds (published in avalanchego's docs as
// the "ewoq" key). No key is kept in this repository.
const fs = require("fs");
const path = require("path");
const { ethers } = require("../../base-contracts/node_modules/ethers");
const { rlpUint, nibblesOf, insert, prove, rootHash } = require("../../base-contracts/test/lib/receiptTrie.cjs");

const RPC = process.argv[2] || "http://127.0.0.1:9650/ext/bc/C/rpc";
const LOCAL_TEST_KEY = process.env.AVAX_LOCAL_FUNDED_KEY;
if (!LOCAL_TEST_KEY) throw new Error("set AVAX_LOCAL_FUNDED_KEY (local-network genesis test key)");
const FIELDS = ["parentHash", "sha3Uncles", "miner", "stateRoot", "transactionsRoot", "receiptsRoot", "logsBloom",
  "difficulty:q", "number:q", "gasLimit:q", "gasUsed:q", "timestamp:q", "extraData", "mixHash", "nonce",
  "extDataHash", "baseFeePerGas:q", "extDataGasUsed:q", "blockGasCost:q", "blobGasUsed:q", "excessBlobGas:q",
  "parentBeaconBlockRoot", "timestampMilliseconds:q", "minDelayExcess:q", "targetExponent:q", "minPriceExponent:q",
  "settledHeight:q", "settledGasUnix:q", "settledGasNumerator:q", "settledExcess:q"];
const q = (v) => (BigInt(v) === 0n ? "0x" : ethers.toBeHex(BigInt(v)));
function encodeHeader(b) {
  const items = [];
  for (const f of FIELDS) { const [k, t] = f.split(":"); if (b[k] == null) break; items.push(t === "q" ? q(b[k]) : b[k]); }
  return ethers.encodeRlp(items);
}
function encodeReceipt(r) {
  const body = ethers.encodeRlp([q(r.status), q(r.cumulativeGasUsed), r.logsBloom, r.logs.map((l) => [l.address, l.topics, l.data])]);
  return Number(r.type) === 0 ? body : ethers.concat([ethers.toBeHex(Number(r.type), 1), body]);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const p = new ethers.JsonRpcProvider(RPC, undefined, { staticNetwork: false, polling: true, pollingInterval: 300 });
  const chainId = Number((await p.getNetwork()).chainId);
  if (chainId === 43114) throw new Error("refusing: this is Avalanche mainnet, local only");
  const w = new ethers.NonceManager(new ethers.Wallet(LOCAL_TEST_KEY, p)); // async execution: track nonces locally
  const devFund = ethers.Wallet.createRandom().address;     // generated, test only
  const recipient = ethers.Wallet.createRandom().address;   // generated, test only
  const art = require("../../base-contracts/artifacts/contracts/CommitmentVaultLock.sol/CommitmentVaultLock.json");
  const lock = await new ethers.ContractFactory(art.abi, art.bytecode, w).deploy("Avalanche", devFund);
  await lock.waitForDeployment();
  const lockAddr = await lock.getAddress();

  const lockId = ethers.hexlify(ethers.randomBytes(32));
  const assetId = ethers.solidityPackedKeccak256(["string", "string"], ["Avalanche", "native-AVAX"]);
  const tx = await lock.createNativeLock(lockId, recipient, 1, assetId, ethers.ZeroHash, recipient, 604800, ethers.parseEther("25"),
    { value: ethers.parseEther("1") });
  const rc = await tx.wait();
  const N = BigInt(rc.blockNumber);

  // Produce further blocks until a header settles exactly block N.
  let settling = null;
  for (let i = 0; i < 60 && !settling; i++) {
    await (await w.sendTransaction({ to: devFund, value: 1n })).wait();
    const latest = BigInt(await p.send("eth_blockNumber", []));
    for (let n = N + 1n; n <= latest; n++) {
      const b = await p.send("eth_getBlockByNumber", [ethers.toQuantity(n), false]);
      const prev = await p.send("eth_getBlockByNumber", [ethers.toQuantity(n - 1n), false]);
      if (b.settledHeight != null && BigInt(b.settledHeight) === N && BigInt(prev.settledHeight) === N - 1n) { settling = b; break; }
      if (b.settledHeight != null && BigInt(b.settledHeight) > N) break;
    }
    if (!settling) await sleep(500);
  }
  if (!settling) throw new Error("no header settled exactly the lock block");
  const headerRlp = encodeHeader(settling);
  if (ethers.keccak256(headerRlp) !== settling.hash) throw new Error("header rlp does not reproduce block hash");

  const lockBlock = await p.send("eth_getBlockByNumber", [ethers.toQuantity(N), false]);
  let root = null; const enc = [];
  for (let i = 0; i < lockBlock.transactions.length; i++) {
    const r = await p.send("eth_getTransactionReceipt", [lockBlock.transactions[i]]);
    enc.push(encodeReceipt(r)); root = insert(root, nibblesOf(rlpUint(i)), ethers.getBytes(enc[i]));
  }
  if (ethers.hexlify(rootHash(root)) !== settling.receiptsRoot) throw new Error("settling header receiptsRoot != lock block receipts");
  const receiptIndex = Number(rc.index);
  const receiptNodes = prove(root, nibblesOf(rlpUint(receiptIndex))).map((n) => ethers.hexlify(n));
  const logIndex = rc.logs.findIndex((l) => l.address.toLowerCase() === lockAddr.toLowerCase() && l.topics[1] === lockId);

  // Storage proofs must open against the settling header's stateRoot: find the
  // block tag whose state that root is.
  const base = BigInt(ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(["bytes32", "uint256"], [lockId, 1])));
  const slots = [ethers.zeroPadValue("0x00", 32), ethers.toBeHex(base + 3n, 32), ethers.toBeHex(base + 9n, 32)];
  let pr = null, stateTag = null;
  for (let n = N; n <= BigInt(settling.number); n++) {
    const t = await p.send("eth_getProof", [lockAddr, slots, ethers.toQuantity(n)]);
    if (ethers.keccak256(t.accountProof[0]) === settling.stateRoot) { pr = t; stateTag = Number(n); break; }
  }
  if (!pr) throw new Error("no state proof opens against the settling header's stateRoot");

  const out = {
    note: "REAL CommitmentVaultLock lock on a LOCAL avalanchego " + "network (C-Chain id " + chainId + "). Genuine Avalanche header format; the settling header's receiptsRoot commits to the lock block's receipts. Generated dev fund and recipient. Not a public-network lock.",
    avalanchego: process.env.AVALANCHEGO_VERSION || "",
    localChainId: chainId, lock: lockAddr, devFund, recipient, lockId,
    lockBlock: Number(N), settlingBlock: Number(settling.number), settlingHash: settling.hash, settledHeight: Number(settling.settledHeight),
    stateTag, headerFieldCount: ethers.decodeRlp(headerRlp).length,
    evidence: { headerRlp, receipt: enc[receiptIndex], receiptIndex, receiptNodes, logIndex,
      accountNodes: pr.accountProof, envSlotNodes: pr.storageProof[0].proof, recipientSlotNodes: pr.storageProof[1].proof,
      createdAtSlotNodes: pr.storageProof[2].proof },
    gross: ethers.parseEther("1").toString(),
  };
  const f = path.join(__dirname, "../../base-contracts/test/fixtures/avalanche_local_lock.json");
  fs.writeFileSync(f, JSON.stringify(out, null, 2) + "\n");
  console.log("wrote", f, "lockBlock", out.lockBlock, "settling", out.settlingBlock, "stateTag", stateTag);
}
main().catch((e) => { console.error(e); process.exit(1); });
