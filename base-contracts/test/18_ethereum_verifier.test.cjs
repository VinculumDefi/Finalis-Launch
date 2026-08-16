// =============================================================================
// EthereumChainVerifier — C.1 proof-chain tests
//
// Exercises the full chain: a block hash recorded from the predeploy, an RLP
// header verified against it, a receipt proven against that header's
// receiptsRoot, and the vault's lock event read out of the proven receipt.
//
// Every stage is attacked separately: wrong header, wrong receipt, wrong
// emitter, wrong event, failed receipt, unrecorded block.
//
// Weighted negative per Verifier Completion Standard 5.2.
// =============================================================================

const { expect } = require("chai");
const { ethers } = require("hardhat");

const ZERO = "0x0000000000000000000000000000000000000000";
const VAULT = "0x1111111111111111111111111111111111111111";
const OTHER_VAULT = "0x2222222222222222222222222222222222222222";
const TOPIC = ethers.keccak256(ethers.toUtf8Bytes("CommitVaultLock(bytes32,uint256)"));

// ---- RLP encoding ----------------------------------------------------------

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

// ---- receipt construction --------------------------------------------------

function word(v) {
  return ethers.zeroPadValue(ethers.toBeHex(BigInt(v)), 32).slice(2);
}

// Event data: gross, fee, principal, duration, creation, maturity
function lockData({ gross, fee, principal, duration, creation, maturity }) {
  return "0x" + word(gross) + word(fee) + word(principal) +
                word(duration) + word(creation) + word(maturity);
}

function buildLog(emitter, topics, data) {
  return rlpList([
    rlpBytes(emitter),
    rlpList(topics.map((t) => rlpBytes(t))),
    rlpBytes(data),
  ]);
}

function buildReceipt({ status = 1, logs = [] }) {
  return rlpList([
    rlpBytes(status === 1 ? "0x01" : "0x"),
    rlpBytes("0x5208"),
    rlpBytes("0x" + "00".repeat(256)),
    rlpList(logs),
  ]);
}

// ---- header construction ---------------------------------------------------

function buildHeader(receiptsRoot) {
  const f32 = (b) => "a0" + b.slice(2);
  const body =
    f32(ethers.keccak256(ethers.toUtf8Bytes("parent"))) +
    f32(ethers.keccak256(ethers.toUtf8Bytes("ommers"))) +
    "94" + "11".repeat(20) +
    f32(ethers.keccak256(ethers.toUtf8Bytes("state"))) +
    f32(ethers.keccak256(ethers.toUtf8Bytes("txs"))) +
    f32(receiptsRoot);

  const len = body.length / 2;
  return "0x" + "f9" + len.toString(16).padStart(4, "0") + body;
}

// ---- single-entry receipts trie --------------------------------------------
//
// One receipt at key 0x80 (the RLP of index 0). The trie is a lone leaf whose
// hash is the root, so the proof is that single node.

function buildTrie(receiptHex) {
  const key = "0x80";
  const nibbles = [8, 0];
  const path = Uint8Array.from([0x20, (nibbles[0] << 4) | nibbles[1]]);
  const leaf = rlpList([rlpBytes(path), rlpBytes(receiptHex)]);
  return { root: ethers.keccak256(leaf), key, proof: [hex(leaf)] };
}

function encodeProof(blockNumber, header, key, proof, receiptHex) {
  return ethers.AbiCoder.defaultAbiCoder().encode(
    ["uint256", "bytes", "bytes", "bytes[]", "bytes"],
    [blockNumber, header, key, proof, receiptHex]
  );
}

const FACTS = {
  gross: 1000000, fee: 50000, principal: 950000,
  duration: 2592000, creation: 1700000000, maturity: 1702592000,
};
const VAULT_LOCK_ID = ethers.keccak256(ethers.toUtf8Bytes("vault-lock-1"));

async function deploy({ status = 1, emitter = VAULT, topic0 = TOPIC } = {}) {
  const M = await ethers.getContractFactory("MockL1Block");
  const mock = await M.deploy();

  const R = await ethers.getContractFactory("L1BlockRegistry");
  const registry = await R.deploy(await mock.getAddress());

  const log = buildLog(emitter, [topic0, VAULT_LOCK_ID], lockData(FACTS));
  const receipt = hex(buildReceipt({ status, logs: [log] }));
  const trie = buildTrie(receipt);
  const header = buildHeader(trie.root);

  await mock.set(9000, ethers.keccak256(header), 1700000000);
  await registry.record();

  const V = await ethers.getContractFactory("EthereumChainVerifier");
  const verifier = await V.deploy("ethereum", await registry.getAddress(), VAULT, TOPIC);

  const proof = encodeProof(9000, header, trie.key, trie.proof, receipt);
  return { mock, registry, verifier, proof, header, trie, receipt };
}

describe("EthereumChainVerifier — proof chain", function () {

  it("verifies finality through header, receipt, and status", async function () {
    const s = await deploy();
    const [finalized, blockHash, height] = await s.verifier.verifyFinality(s.proof, "0x");

    expect(finalized).to.equal(true);
    expect(blockHash).to.equal(ethers.keccak256(s.header));
    expect(height).to.equal(9000n);
  });

  it("extracts lock facts from the proven receipt's event", async function () {
    const s = await deploy();
    const f = await s.verifier.extractFacts(s.proof);

    expect(f.grossAmount).to.equal(BigInt(FACTS.gross));
    expect(f.feeAmount).to.equal(BigInt(FACTS.fee));
    expect(f.principalAmount).to.equal(BigInt(FACTS.principal));
    expect(f.durationSecs).to.equal(BigInt(FACTS.duration));
    expect(f.creationTimestamp).to.equal(BigInt(FACTS.creation));
    expect(f.maturityTimestamp).to.equal(BigInt(FACTS.maturity));

    // C.1 replay id: env + vault + lock id.
    const expected = ethers.solidityPackedKeccak256(
      ["string", "address", "bytes32"], ["ethereum", VAULT, VAULT_LOCK_ID]
    );
    expect(f.lockId).to.equal(expected);
  });

  it("isFinal reports true without reverting", async function () {
    const s = await deploy();
    expect(await s.verifier.isFinal(s.proof)).to.equal(true);
  });
});

describe("EthereumChainVerifier — negative cases", function () {

  it("rejects a block the registry never recorded", async function () {
    const s = await deploy();
    const bad = encodeProof(12345, s.header, s.trie.key, s.trie.proof, s.receipt);

    await expect(s.verifier.verifyFinality(bad, "0x"))
      .to.be.revertedWithCustomError(s.verifier, "BlockNotRecorded");
  });

  it("rejects a header that does not hash to the recorded commitment", async function () {
    const s = await deploy();
    const forged = buildHeader(ethers.keccak256(ethers.toUtf8Bytes("forged-root")));
    const bad = encodeProof(9000, forged, s.trie.key, s.trie.proof, s.receipt);

    await expect(s.verifier.verifyFinality(bad, "0x")).to.be.reverted;
  });

  it("rejects a receipt not committed to by the header", async function () {
    const s = await deploy();

    const otherLog = buildLog(VAULT, [TOPIC, VAULT_LOCK_ID],
      lockData({ ...FACTS, gross: 999999999 }));
    const otherReceipt = hex(buildReceipt({ logs: [otherLog] }));
    const otherTrie = buildTrie(otherReceipt);

    // The proof is for a different trie than the header commits to.
    const bad = encodeProof(9000, s.header, otherTrie.key, otherTrie.proof, otherReceipt);
    await expect(s.verifier.verifyFinality(bad, "0x")).to.be.reverted;
  });

  it("rejects a receipt whose bytes differ from the proven value", async function () {
    const s = await deploy();

    // Prove the real receipt but supply different bytes to parse.
    const swapped = hex(buildReceipt({
      logs: [buildLog(VAULT, [TOPIC, VAULT_LOCK_ID], lockData({ ...FACTS, gross: 7 }))],
    }));
    const bad = encodeProof(9000, s.header, s.trie.key, s.trie.proof, swapped);

    await expect(s.verifier.verifyFinality(bad, "0x")).to.be.reverted;
  });

  it("rejects a failed transaction receipt", async function () {
    const s = await deploy({ status: 0 });
    await expect(s.verifier.verifyFinality(s.proof, "0x"))
      .to.be.revertedWithCustomError(s.verifier, "ReceiptFailed");
  });

  it("rejects an event emitted by a different contract", async function () {
    const s = await deploy({ emitter: OTHER_VAULT });
    await expect(s.verifier.extractFacts(s.proof)).to.be.revertedWithCustomError(s.verifier, 'NoMatchingLog');
  });

  it("rejects a different event from the correct contract", async function () {
    const s = await deploy({
      topic0: ethers.keccak256(ethers.toUtf8Bytes("SomethingElse(uint256)")),
    });
    await expect(s.verifier.extractFacts(s.proof)).to.be.reverted;
  });

  it("isFinal returns false rather than reverting on a bad proof", async function () {
    const s = await deploy();
    const bad = encodeProof(12345, s.header, s.trie.key, s.trie.proof, s.receipt);
    expect(await s.verifier.isFinal(bad)).to.equal(false);
  });
});

describe("EthereumChainVerifier — construction", function () {

  it("refuses zero addresses", async function () {
    const V = await ethers.getContractFactory("EthereumChainVerifier");
    await expect(V.deploy("ethereum", ZERO, VAULT, TOPIC))
      .to.be.revertedWithCustomError(V, "ZeroAddress");
    await expect(V.deploy("ethereum", VAULT, ZERO, TOPIC))
      .to.be.revertedWithCustomError(V, "ZeroAddress");
  });

  it("binds the source vault and event topic immutably", async function () {
    const s = await deploy();
    expect(await s.verifier.sourceVault()).to.equal(VAULT);
    expect(await s.verifier.lockEventTopic()).to.equal(TOPIC);
    expect(s.verifier.interface.fragments.filter(
      f => f.type === "function" && /^set/i.test(f.name)
    ).length).to.equal(0);
  });
});
