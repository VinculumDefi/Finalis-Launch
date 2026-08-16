// =============================================================================
// PolygonChainVerifier — C.4 checkpoint proof-chain tests
//
// Four chained verifications, each attacked separately: L1 header, checkpoint
// event, checkpoint Merkle path and range, Bor receipt.
//
// EXTERNAL DEPENDENCIES: the checkpoint leaf preimage and NewHeaderBlock data
// layout are Polygon protocol knowledge, not stated in the governing artifacts.
// These tests prove the chain's logic against that construction; they cannot
// prove it matches Polygon mainnet.
//
// Weighted negative per Verifier Completion Standard 5.2.
// =============================================================================

const { expect } = require("chai");
const { ethers } = require("hardhat");

const ZERO = "0x0000000000000000000000000000000000000000";
const CHECKPOINT = "0x5555555555555555555555555555555555555555";
const VAULT = "0x6666666666666666666666666666666666666666";
const HEADER_TOPIC = ethers.keccak256(
  ethers.toUtf8Bytes("NewHeaderBlock(address,uint256,uint256,uint256,uint256,bytes32)")
);
const LOCK_TOPIC = ethers.keccak256(ethers.toUtf8Bytes("CommitVaultLock(bytes32,uint256)"));

// ---- RLP ------------------------------------------------------------------

function rlpLen(len, offset) {
  if (len < 56) return Uint8Array.from([len + offset]);
  let h = len.toString(16);
  if (h.length % 2) h = "0" + h;
  const b = ethers.getBytes("0x" + h);
  return Uint8Array.from([b.length + offset + 55, ...b]);
}
function rlpBytes(input) {
  const b = typeof input === "string" ? ethers.getBytes(input) : input;
  if (b.length === 1 && b[0] < 0x80) return b;
  return Uint8Array.from([...rlpLen(b.length, 0x80), ...b]);
}
function rlpList(items) {
  const body = items.reduce((a, x) => Uint8Array.from([...a, ...x]), new Uint8Array());
  return Uint8Array.from([...rlpLen(body.length, 0xc0), ...body]);
}
const hex = (u8) => ethers.hexlify(u8);
const word = (v) => ethers.zeroPadValue(ethers.toBeHex(BigInt(v)), 32).slice(2);

function buildLog(emitter, topics, data) {
  return rlpList([rlpBytes(emitter), rlpList(topics.map(rlpBytes)), rlpBytes(data)]);
}
function buildReceipt({ status = 1, logs = [] }) {
  return rlpList([
    rlpBytes(status === 1 ? "0x01" : "0x"),
    rlpBytes("0x5208"),
    rlpBytes("0x" + "00".repeat(256)),
    rlpList(logs),
  ]);
}
function buildHeader(receiptsRoot, salt) {
  const f = (b) => "a0" + b.slice(2);
  const body =
    f(ethers.keccak256(ethers.toUtf8Bytes("parent" + salt))) +
    f(ethers.keccak256(ethers.toUtf8Bytes("ommers"))) +
    "94" + "11".repeat(20) +
    f(ethers.keccak256(ethers.toUtf8Bytes("state"))) +
    f(ethers.keccak256(ethers.toUtf8Bytes("txs"))) +
    f(receiptsRoot);
  const len = body.length / 2;
  return "0x" + "f9" + len.toString(16).padStart(4, "0") + body;
}
function buildTrie(receiptHex) {
  const path = Uint8Array.from([0x20, 0x80]);
  const leaf = rlpList([rlpBytes(path), rlpBytes(receiptHex)]);
  return { root: ethers.keccak256(leaf), key: "0x80", proof: [hex(leaf)] };
}

// ---- checkpoint tree ------------------------------------------------------

function checkpointLeaf(blockNumber, blockTime, txRoot, receiptRoot) {
  return ethers.solidityPackedKeccak256(
    ["uint256", "uint256", "bytes32", "bytes32"],
    [blockNumber, blockTime, txRoot, receiptRoot]
  );
}

// Two-leaf tree: our block at index 0, a sibling at index 1.
function buildCheckpointTree(leaf, sibling) {
  const root = ethers.solidityPackedKeccak256(["bytes32", "bytes32"], [leaf, sibling]);
  return { root, proof: [sibling] };
}

const START = 1000;
const BOR_BLOCK = 1000;
const BOR_TIME = 1700000000;
const BOR_TX_ROOT = ethers.keccak256(ethers.toUtf8Bytes("bor-tx-root"));
const END = 1010;

const FACTS = {
  gross: 3000000, fee: 150000, principal: 2850000,
  duration: 15552000, creation: 1700000000, maturity: 1715552000,
};
const VAULT_LOCK_ID = ethers.keccak256(ethers.toUtf8Bytes("polygon-lock-1"));

function encodeProof(p) {
  return ethers.AbiCoder.defaultAbiCoder().encode(
    ["uint256", "bytes", "bytes", "bytes[]", "bytes",
     "uint256[2]", "bytes32[2]", "bytes32[]", "bytes", "bytes[]", "bytes"],
    [p.l1BlockNumber, p.l1Header, p.l1Key, p.l1Proof, p.l1Receipt,
     [p.borBlockNumber, p.borTime], [p.borTxRoot, p.borReceiptRoot],
     p.checkpointProof, p.borKey, p.borProof, p.borReceipt]
  );
}

async function build(opts = {}) {
  const M = await ethers.getContractFactory("MockL1Block");
  const mock = await M.deploy();
  const R = await ethers.getContractFactory("L1BlockRegistry");
  const registry = await R.deploy(await mock.getAddress());

  // Bor side: the vault's lock event.
  const lockLog = buildLog(
    opts.lockEmitter ?? VAULT,
    [LOCK_TOPIC, VAULT_LOCK_ID],
    "0x" + word(FACTS.gross) + word(FACTS.fee) + word(FACTS.principal) +
           word(FACTS.duration) + word(FACTS.creation) + word(FACTS.maturity)
  );
  const borReceipt = hex(buildReceipt({ status: opts.borStatus ?? 1, logs: [lockLog] }));
  const borTrie = buildTrie(borReceipt);

  // The checkpoint leaf commits to that receiptRoot.
  const leaf = checkpointLeaf(BOR_BLOCK, BOR_TIME, BOR_TX_ROOT, borTrie.root);
  const sibling = ethers.keccak256(ethers.toUtf8Bytes("sibling-leaf"));
  const tree = buildCheckpointTree(leaf, sibling);

  // L1 side: the checkpoint contract's NewHeaderBlock event.
  const ckLog = buildLog(
    opts.checkpointEmitter ?? CHECKPOINT,
    [HEADER_TOPIC,
     ethers.zeroPadValue("0x01", 32),
     ethers.zeroPadValue("0x02", 32),
     ethers.zeroPadValue("0x03", 32)],
    "0x" + word(START) + word(END) + tree.root.slice(2)
  );
  const l1Receipt = hex(buildReceipt({ status: opts.l1Status ?? 1, logs: [ckLog] }));
  const l1Trie = buildTrie(l1Receipt);
  const l1Header = buildHeader(l1Trie.root, "l1");

  await mock.set(7000, ethers.keccak256(l1Header), 1700000000);
  await registry.record();

  const V = await ethers.getContractFactory("PolygonChainVerifier");
  const verifier = await V.deploy(
    "polygon", await registry.getAddress(), CHECKPOINT, HEADER_TOPIC, VAULT, LOCK_TOPIC
  );

  const parts = {
    l1BlockNumber: 7000, l1Header, l1Key: l1Trie.key,
    l1Proof: l1Trie.proof, l1Receipt,
    borBlockNumber: BOR_BLOCK, borTime: BOR_TIME,
    borTxRoot: BOR_TX_ROOT, borReceiptRoot: borTrie.root,
    checkpointProof: tree.proof,
    borKey: borTrie.key, borProof: borTrie.proof, borReceipt,
  };

  return { registry, verifier, parts, proof: encodeProof(parts), leaf, tree };
}

describe("PolygonChainVerifier — proof chain", function () {

  it("verifies a lock anchored through a Heimdall checkpoint to L1", async function () {
    const s = await build();
    const [finalized, , height] = await s.verifier.verifyFinality(s.proof, "0x");
    expect(finalized).to.equal(true);
    expect(height).to.equal(BigInt(BOR_BLOCK));
  });

  it("extracts lock facts from the proven Bor receipt", async function () {
    const s = await build();
    const f = await s.verifier.extractFacts(s.proof);

    expect(f.grossAmount).to.equal(BigInt(FACTS.gross));
    expect(f.feeAmount).to.equal(BigInt(FACTS.fee));
    expect(f.principalAmount).to.equal(BigInt(FACTS.principal));

    const expected = ethers.solidityPackedKeccak256(
      ["string", "address", "bytes32"], ["polygon", VAULT, VAULT_LOCK_ID]
    );
    expect(f.lockId).to.equal(expected);
  });

  it("exposes computeLeaf and verifyCheckpointPath for external verification",
    async function () {
      const s = await build();
      expect(await s.verifier.computeLeaf(
        BOR_BLOCK, BOR_TIME, BOR_TX_ROOT, s.parts.borReceiptRoot
      )).to.equal(s.leaf);

      expect(await s.verifier.verifyCheckpointPath(s.leaf, 0, s.tree.proof))
        .to.equal(s.tree.root);
    });
});

describe("PolygonChainVerifier — each link attacked", function () {

  it("link 1: rejects an L1 block the registry never recorded", async function () {
    const s = await build();
    const bad = encodeProof({ ...s.parts, l1BlockNumber: 88888 });
    await expect(s.verifier.verifyFinality(bad, "0x"))
      .to.be.revertedWithCustomError(s.verifier, "L1BlockNotRecorded");
  });

  it("link 2: rejects a checkpoint event from the wrong contract", async function () {
    const s = await build({ checkpointEmitter: "0x7777777777777777777777777777777777777777" });
    await expect(s.verifier.verifyFinality(s.proof, "0x"))
      .to.be.revertedWithCustomError(s.verifier, "NoMatchingLog");
  });

  it("link 3: rejects a Bor block outside the checkpointed range", async function () {
    const s = await build();
    const bad = encodeProof({ ...s.parts, borBlockNumber: 5000 });
    await expect(s.verifier.verifyFinality(bad, "0x"))
      .to.be.revertedWithCustomError(s.verifier, "BlockOutsideCheckpoint");
  });

  it("link 3: rejects a leaf that does not prove to the posted root", async function () {
    const s = await build();
    const bad = encodeProof({
      ...s.parts,
      borTxRoot: ethers.keccak256(ethers.toUtf8Bytes("different-tx-root")),
    });
    await expect(s.verifier.verifyFinality(bad, "0x"))
      .to.be.revertedWithCustomError(s.verifier, "CheckpointProofFailed");
  });

  it("link 3: rejects a tampered Merkle path", async function () {
    const s = await build();
    const bad = encodeProof({
      ...s.parts,
      checkpointProof: [ethers.keccak256(ethers.toUtf8Bytes("wrong-sibling"))],
    });
    await expect(s.verifier.verifyFinality(bad, "0x"))
      .to.be.revertedWithCustomError(s.verifier, "CheckpointProofFailed");
  });

  it("link 4: rejects Bor receipt bytes differing from the proven value", async function () {
    const s = await build();
    const swapped = hex(buildReceipt({
      logs: [buildLog(VAULT, [LOCK_TOPIC, VAULT_LOCK_ID], "0x" + word(1).repeat(6))],
    }));
    const bad = encodeProof({ ...s.parts, borReceipt: swapped });
    await expect(s.verifier.verifyFinality(bad, "0x"))
      .to.be.revertedWithCustomError(s.verifier, "ProvenBytesMismatch");
  });

  it("rejects a failed L1 receipt", async function () {
    const s = await build({ l1Status: 0 });
    await expect(s.verifier.verifyFinality(s.proof, "0x"))
      .to.be.revertedWithCustomError(s.verifier, "ReceiptFailed");
  });

  it("rejects a failed Bor receipt", async function () {
    const s = await build({ borStatus: 0 });
    await expect(s.verifier.verifyFinality(s.proof, "0x"))
      .to.be.revertedWithCustomError(s.verifier, "ReceiptFailed");
  });

  it("rejects a lock event from a different Bor contract", async function () {
    const s = await build({ lockEmitter: "0x1212121212121212121212121212121212121212" });
    await expect(s.verifier.extractFacts(s.proof))
      .to.be.revertedWithCustomError(s.verifier, "NoMatchingLog");
  });
});

describe("PolygonChainVerifier — construction", function () {

  it("refuses zero addresses", async function () {
    const V = await ethers.getContractFactory("PolygonChainVerifier");
    await expect(V.deploy("polygon", ZERO, CHECKPOINT, HEADER_TOPIC, VAULT, LOCK_TOPIC))
      .to.be.revertedWithCustomError(V, "ZeroAddress");
    await expect(V.deploy("polygon", CHECKPOINT, ZERO, HEADER_TOPIC, VAULT, LOCK_TOPIC))
      .to.be.revertedWithCustomError(V, "ZeroAddress");
    await expect(V.deploy("polygon", CHECKPOINT, CHECKPOINT, HEADER_TOPIC, ZERO, LOCK_TOPIC))
      .to.be.revertedWithCustomError(V, "ZeroAddress");
  });

  it("binds the checkpoint contract, vault and topics immutably", async function () {
    const s = await build();
    expect(await s.verifier.checkpointContract()).to.equal(CHECKPOINT);
    expect(await s.verifier.sourceVault()).to.equal(VAULT);
    expect(s.verifier.interface.fragments.filter(
      f => f.type === "function" && /^set/i.test(f.name)
    ).length).to.equal(0);
  });
});
