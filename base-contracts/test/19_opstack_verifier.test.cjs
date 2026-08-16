// =============================================================================
// OpStackChainVerifier — C.7 proof-chain tests
//
// Five chained verifications, each attacked separately: L1 header, output-root
// event, output-root preimage, L2 header, L2 receipt.
//
// EXTERNAL DEPENDENCY: the output-root preimage formula is OP Stack protocol
// knowledge, not stated in the governing artifacts. These tests prove the
// chain's logic against that formula; they cannot prove the formula matches
// Optimism mainnet. Verification against a real output root is required before
// deployment.
//
// Weighted negative per Verifier Completion Standard 5.2.
// =============================================================================

const { expect } = require("chai");
const { ethers } = require("hardhat");

const ZERO = "0x0000000000000000000000000000000000000000";
const ORACLE = "0x3333333333333333333333333333333333333333";
const VAULT = "0x4444444444444444444444444444444444444444";
const OUTPUT_TOPIC = ethers.keccak256(
  ethers.toUtf8Bytes("OutputProposed(bytes32,uint256,uint256,uint256)")
);
const LOCK_TOPIC = ethers.keccak256(
  ethers.toUtf8Bytes("CommitVaultLock(bytes32,uint256)")
);

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

// ---- receipts, logs, headers, tries ---------------------------------------

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

function outputRoot(version, stateRoot, msgPasser, blockHash) {
  return ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["bytes32", "bytes32", "bytes32", "bytes32"],
      [version, stateRoot, msgPasser, blockHash]
    )
  );
}

const FACTS = {
  gross: 2000000, fee: 100000, principal: 1900000,
  duration: 7776000, creation: 1700000000, maturity: 1707776000,
};
const VAULT_LOCK_ID = ethers.keccak256(ethers.toUtf8Bytes("op-lock-1"));

const VERSION = ethers.ZeroHash;
const L2_STATE = ethers.keccak256(ethers.toUtf8Bytes("l2-state"));
const MSG_PASSER = ethers.keccak256(ethers.toUtf8Bytes("msg-passer"));

function encodeProof(p) {
  return ethers.AbiCoder.defaultAbiCoder().encode(
    ["uint256", "bytes", "bytes", "bytes[]", "bytes",
     "bytes32[4]", "bytes", "bytes", "bytes[]", "bytes"],
    [p.l1BlockNumber, p.l1Header, p.l1Key, p.l1Proof, p.l1Receipt,
     [p.version, p.stateRoot, p.msgPasser, p.l2BlockHash],
     p.l2Header, p.l2Key, p.l2Proof, p.l2Receipt]
  );
}

async function build(opts = {}) {
  const M = await ethers.getContractFactory("MockL1Block");
  const mock = await M.deploy();
  const R = await ethers.getContractFactory("L1BlockRegistry");
  const registry = await R.deploy(await mock.getAddress());

  // L2 side: the vault's lock event.
  const lockLog = buildLog(
    opts.lockEmitter ?? VAULT,
    [opts.lockTopic ?? LOCK_TOPIC, VAULT_LOCK_ID],
    "0x" + word(FACTS.gross) + word(FACTS.fee) + word(FACTS.principal) +
           word(FACTS.duration) + word(FACTS.creation) + word(FACTS.maturity)
  );
  const l2Receipt = hex(buildReceipt({ status: opts.l2Status ?? 1, logs: [lockLog] }));
  const l2Trie = buildTrie(l2Receipt);
  const l2Header = buildHeader(l2Trie.root, "l2");
  const l2BlockHash = ethers.keccak256(l2Header);

  // The output root committing to that L2 block.
  const root = outputRoot(VERSION, L2_STATE, MSG_PASSER, l2BlockHash);

  // L1 side: the oracle's OutputProposed event carrying that root.
  const proposedLog = buildLog(
    opts.oracleEmitter ?? ORACLE,
    [opts.outputTopic ?? OUTPUT_TOPIC, root,
     ethers.zeroPadValue("0x01", 32), ethers.zeroPadValue("0x64", 32)],
    "0x" + word(1700000000)
  );
  const l1Receipt = hex(buildReceipt({ status: opts.l1Status ?? 1, logs: [proposedLog] }));
  const l1Trie = buildTrie(l1Receipt);
  const l1Header = buildHeader(l1Trie.root, "l1");

  await mock.set(8000, ethers.keccak256(l1Header), 1700000000);
  await registry.record();

  const V = await ethers.getContractFactory("OpStackChainVerifier");
  const verifier = await V.deploy(
    "optimism", await registry.getAddress(), ORACLE, OUTPUT_TOPIC, VAULT, LOCK_TOPIC
  );

  const parts = {
    l1BlockNumber: 8000, l1Header, l1Key: l1Trie.key,
    l1Proof: l1Trie.proof, l1Receipt,
    version: VERSION, stateRoot: L2_STATE, msgPasser: MSG_PASSER, l2BlockHash,
    l2Header, l2Key: l2Trie.key, l2Proof: l2Trie.proof, l2Receipt,
  };

  return { registry, verifier, parts, proof: encodeProof(parts), root };
}

describe("OpStackChainVerifier — proof chain", function () {

  it("verifies a lock anchored through the output root to L1", async function () {
    const s = await build();
    const [finalized, blockHash] = await s.verifier.verifyFinality(s.proof, "0x");
    expect(finalized).to.equal(true);
    expect(blockHash).to.equal(s.parts.l2BlockHash);
  });

  it("extracts lock facts from the proven L2 receipt", async function () {
    const s = await build();
    const f = await s.verifier.extractFacts(s.proof);

    expect(f.grossAmount).to.equal(BigInt(FACTS.gross));
    expect(f.feeAmount).to.equal(BigInt(FACTS.fee));
    expect(f.principalAmount).to.equal(BigInt(FACTS.principal));
    expect(f.durationSecs).to.equal(BigInt(FACTS.duration));

    const expected = ethers.solidityPackedKeccak256(
      ["string", "address", "bytes32"], ["optimism", VAULT, VAULT_LOCK_ID]
    );
    expect(f.lockId).to.equal(expected);
  });

  it("computeOutputRoot is exposed for verification against a real root", async function () {
    const s = await build();
    expect(await s.verifier.computeOutputRoot(VERSION, L2_STATE, MSG_PASSER, s.parts.l2BlockHash))
      .to.equal(s.root);
  });
});

describe("OpStackChainVerifier — each link attacked", function () {

  it("link 1: rejects an L1 block the registry never recorded", async function () {
    const s = await build();
    const bad = encodeProof({ ...s.parts, l1BlockNumber: 99999 });
    await expect(s.verifier.verifyFinality(bad, "0x"))
      .to.be.revertedWithCustomError(s.verifier, "L1BlockNotRecorded");
  });

  it("link 2: rejects an OutputProposed from the wrong contract", async function () {
    const s = await build({ oracleEmitter: "0x9999999999999999999999999999999999999999" });
    await expect(s.verifier.verifyFinality(s.proof, "0x")).to.be.reverted;
  });

  it("link 3: rejects an output-root preimage that does not reproduce the posted root",
    async function () {
      const s = await build();
      const bad = encodeProof({
        ...s.parts,
        stateRoot: ethers.keccak256(ethers.toUtf8Bytes("different-state")),
      });
      await expect(s.verifier.verifyFinality(bad, "0x"))
        .to.be.revertedWithCustomError(s.verifier, "OutputRootMismatch");
    });

  it("link 4: rejects an L2 header that does not hash to the committed block hash",
    async function () {
      const s = await build();
      const forged = buildHeader(ethers.keccak256(ethers.toUtf8Bytes("forged")), "l2");
      const bad = encodeProof({ ...s.parts, l2Header: forged });
      await expect(s.verifier.verifyFinality(bad, "0x"))
        .to.be.revertedWithCustomError(s.verifier, "L2HeaderMismatch");
    });

  it("link 5: rejects L2 receipt bytes differing from the proven value", async function () {
    const s = await build();
    const swapped = hex(buildReceipt({
      logs: [buildLog(VAULT, [LOCK_TOPIC, VAULT_LOCK_ID], "0x" + word(1).repeat(6))],
    }));
    const bad = encodeProof({ ...s.parts, l2Receipt: swapped });
    await expect(s.verifier.verifyFinality(bad, "0x"))
      .to.be.revertedWithCustomError(s.verifier, "ProvenBytesMismatch");
  });

  it("rejects a failed L1 receipt", async function () {
    const s = await build({ l1Status: 0 });
    await expect(s.verifier.verifyFinality(s.proof, "0x"))
      .to.be.revertedWithCustomError(s.verifier, "ReceiptFailed");
  });

  it("rejects a failed L2 receipt", async function () {
    const s = await build({ l2Status: 0 });
    await expect(s.verifier.verifyFinality(s.proof, "0x"))
      .to.be.revertedWithCustomError(s.verifier, "ReceiptFailed");
  });

  it("rejects a lock event from a different L2 contract", async function () {
    const s = await build({ lockEmitter: "0x8888888888888888888888888888888888888888" });
    await expect(s.verifier.extractFacts(s.proof))
      .to.be.revertedWithCustomError(s.verifier, "NoMatchingLog");
  });
});

describe("OpStackChainVerifier — construction", function () {

  it("refuses zero addresses", async function () {
    const V = await ethers.getContractFactory("OpStackChainVerifier");
    await expect(V.deploy("optimism", ZERO, ORACLE, OUTPUT_TOPIC, VAULT, LOCK_TOPIC))
      .to.be.revertedWithCustomError(V, "ZeroAddress");
    await expect(V.deploy("optimism", ORACLE, ZERO, OUTPUT_TOPIC, VAULT, LOCK_TOPIC))
      .to.be.revertedWithCustomError(V, "ZeroAddress");
    await expect(V.deploy("optimism", ORACLE, ORACLE, OUTPUT_TOPIC, ZERO, LOCK_TOPIC))
      .to.be.revertedWithCustomError(V, "ZeroAddress");
  });

  it("binds the oracle, vault and topics immutably", async function () {
    const s = await build();
    expect(await s.verifier.outputOracle()).to.equal(ORACLE);
    expect(await s.verifier.sourceVault()).to.equal(VAULT);
    expect(await s.verifier.outputProposedTopic()).to.equal(OUTPUT_TOPIC);
    expect(await s.verifier.lockEventTopic()).to.equal(LOCK_TOPIC);
    expect(s.verifier.interface.fragments.filter(
      f => f.type === "function" && /^set/i.test(f.name)
    ).length).to.equal(0);
  });
});
