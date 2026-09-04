// =============================================================================
// ArbitrumChainVerifier — C.5 assertion proof-chain tests
//
// Four chained verifications, each attacked separately: L1 header, confirmed
// assertion, L2 header, L2 receipt.
//
// EXTERNAL DEPENDENCY: the confirmation event's identity and data layout are
// Arbitrum protocol knowledge, not stated in the governing artifacts. These
// tests prove the chain's logic against that layout; they cannot prove it
// matches Arbitrum mainnet.
//
// Weighted negative per Verifier Completion Standard 5.2.
// =============================================================================

const { expect } = require("chai");
const { ethers } = require("hardhat");

const ZERO = "0x0000000000000000000000000000000000000000";
const ROLLUP = "0xaaaa000000000000000000000000000000000001";
const VAULT = "0xbbbb000000000000000000000000000000000002";
const CONFIRM_TOPIC = ethers.keccak256(
  ethers.toUtf8Bytes("AssertionConfirmed(bytes32,bytes32,bytes32)")
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

const FACTS = {
  gross: 4000000, fee: 200000, principal: 3800000,
  duration: 31536000, creation: 1700000000, maturity: 1731536000,
};
const VAULT_LOCK_ID = ethers.keccak256(ethers.toUtf8Bytes("arb-lock-1"));

// CL-85. The vault emits two logs per lock. This fixture predates
// CommitVaultLockDetail (event added in 15df4bf), so its receipt modelled a
// shape the vault has not emitted since. The encoding below was verified
// byte-for-byte against the compiler's own Interface.encodeEventLog output.
const TOPIC_DETAIL = ethers.keccak256(ethers.toUtf8Bytes(
  "CommitVaultLockDetail(bytes32,string,address,bytes32,address,address,address,address,uint8,bytes32,uint32,address)"));
const D_ASSET   = ethers.getAddress("0xffffffffffffffffffffffffffffffffffffffff");
const D_LOCKC   = ethers.getAddress("0xdddddddddddddddddddddddddddddddddddddddd");
const D_RECIP   = ethers.getAddress("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
const D_RELEASE = ethers.getAddress("0xcccccccccccccccccccccccccccccccccccccccc");
const D_FEEDEST = ethers.getAddress("0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee");
const D_SRCACCT = ethers.getAddress("0x9999999999999999999999999999999999999999");
const D_ASSETID = ethers.keccak256(ethers.toUtf8Bytes("source:USDC"));

function detailData({ env = "src", outputToken = 0, allowanceCount = 3 } = {}) {
  const envBytes = ethers.toUtf8Bytes(env);
  const envPadded = ethers.hexlify(envBytes).slice(2).padEnd(64, "0");
  const w = (n) => ethers.toBeHex(n, 32).slice(2);
  const a = (x) => ethers.zeroPadValue(x, 32).slice(2);
  return "0x" + w(0x120) + a(D_ASSET) + a(D_LOCKC) + a(D_RECIP) + a(D_RELEASE) +
    w(outputToken) + ethers.ZeroHash.slice(2) + w(allowanceCount) + a(D_FEEDEST) +
    w(envBytes.length) + envPadded;
}

function detailLog(emitter, lockId) {
  return buildLog(emitter,
    [TOPIC_DETAIL, lockId, ethers.zeroPadValue(D_SRCACCT, 32), D_ASSETID],
    detailData());
}

const SEND_ROOT = ethers.keccak256(ethers.toUtf8Bytes("send-root"));

function encodeProof(p) {
  return ethers.AbiCoder.defaultAbiCoder().encode(
    ["uint256", "bytes", "bytes", "bytes[]", "bytes",
     "bytes", "bytes", "bytes[]", "bytes"],
    [p.l1BlockNumber, p.l1Header, p.l1Key, p.l1Proof, p.l1Receipt,
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
    [LOCK_TOPIC, VAULT_LOCK_ID],
    "0x" + word(FACTS.gross) + word(FACTS.fee) + word(FACTS.principal) +
           word(FACTS.duration) + word(FACTS.creation) + word(FACTS.maturity)
  );
  const l2Logs = [lockLog];
  if (opts.includeDetail !== false) l2Logs.push(detailLog(VAULT, VAULT_LOCK_ID));
  const l2Receipt = hex(buildReceipt({ status: opts.l2Status ?? 1, logs: l2Logs }));
  const l2Trie = buildTrie(l2Receipt);
  const l2Header = buildHeader(l2Trie.root, "arb-l2");
  const l2BlockHash = ethers.keccak256(l2Header);

  // L1 side: the rollup's assertion confirmation, carrying that block hash.
  const confirmLog = buildLog(
    opts.rollupEmitter ?? ROLLUP,
    [opts.confirmTopic ?? CONFIRM_TOPIC, ethers.keccak256(ethers.toUtf8Bytes("assertion"))],
    (opts.confirmedBlockHash ?? l2BlockHash) + SEND_ROOT.slice(2)
  );
  const l1Receipt = hex(buildReceipt({ status: opts.l1Status ?? 1, logs: [confirmLog] }));
  const l1Trie = buildTrie(l1Receipt);
  const l1Header = buildHeader(l1Trie.root, "arb-l1");

  await mock.set(6000, ethers.keccak256(l1Header), 1700000000);
  await registry.record();

  const V = await ethers.getContractFactory("ArbitrumChainVerifier");
  const verifier = await V.deploy(
    "arbitrum", await registry.getAddress(), ROLLUP, CONFIRM_TOPIC, VAULT, LOCK_TOPIC
  );

  const parts = {
    l1BlockNumber: 6000, l1Header, l1Key: l1Trie.key,
    l1Proof: l1Trie.proof, l1Receipt,
    l2Header, l2Key: l2Trie.key, l2Proof: l2Trie.proof, l2Receipt,
  };

  return { registry, verifier, parts, proof: encodeProof(parts), l2BlockHash };
}

describe("ArbitrumChainVerifier — proof chain", function () {

  it("verifies a lock in a block whose assertion was confirmed on L1", async function () {
    const s = await build();
    const [finalized, blockHash] = await s.verifier.verifyFinality(s.proof, "0x");
    expect(finalized).to.equal(true);
    expect(blockHash).to.equal(s.l2BlockHash);
  });

  it("extracts lock facts from the proven L2 receipt", async function () {
    const s = await build();
    const f = await s.verifier.extractFacts(s.proof);

    expect(f.grossAmount).to.equal(BigInt(FACTS.gross));
    expect(f.feeAmount).to.equal(BigInt(FACTS.fee));
    expect(f.principalAmount).to.equal(BigInt(FACTS.principal));
    expect(f.durationSecs).to.equal(BigInt(FACTS.duration));

    const expected = ethers.solidityPackedKeccak256(
      ["string", "address", "bytes32"], ["arbitrum", VAULT, VAULT_LOCK_ID]
    );
    expect(f.lockId).to.equal(expected);
  });
});

describe("ArbitrumChainVerifier — each link attacked", function () {

  it("link 1: rejects an L1 block the registry never recorded", async function () {
    const s = await build();
    const bad = encodeProof({ ...s.parts, l1BlockNumber: 77777 });
    await expect(s.verifier.verifyFinality(bad, "0x"))
      .to.be.revertedWithCustomError(s.verifier, "L1BlockNotRecorded");
  });

  it("link 2: rejects a confirmation from the wrong rollup contract", async function () {
    const s = await build({ rollupEmitter: "0xcccc000000000000000000000000000000000003" });
    await expect(s.verifier.verifyFinality(s.proof, "0x"))
      .to.be.revertedWithCustomError(s.verifier, "NoMatchingLog");
  });

  it("link 2: rejects a different event from the correct rollup", async function () {
    const s = await build({
      confirmTopic: ethers.keccak256(ethers.toUtf8Bytes("NodeCreated(uint64)")),
    });
    await expect(s.verifier.verifyFinality(s.proof, "0x"))
      .to.be.revertedWithCustomError(s.verifier, "NoMatchingLog");
  });

  it("link 3: rejects an L2 block never named by a confirmed assertion", async function () {
    // The confirmation names a different block than the header supplied.
    const s = await build({
      confirmedBlockHash: ethers.keccak256(ethers.toUtf8Bytes("unconfirmed-block")),
    });
    await expect(s.verifier.verifyFinality(s.proof, "0x"))
      .to.be.revertedWithCustomError(s.verifier, "L2HeaderMismatch");
  });

  it("link 3: rejects a forged L2 header", async function () {
    const s = await build();
    const forged = buildHeader(ethers.keccak256(ethers.toUtf8Bytes("forged")), "arb-l2");
    const bad = encodeProof({ ...s.parts, l2Header: forged });
    await expect(s.verifier.verifyFinality(bad, "0x"))
      .to.be.revertedWithCustomError(s.verifier, "L2HeaderMismatch");
  });

  it("link 4: rejects L2 receipt bytes differing from the proven value", async function () {
    const s = await build();
    const swapped = hex(buildReceipt({
      logs: [buildLog(VAULT, [LOCK_TOPIC, VAULT_LOCK_ID], "0x" + word(1).repeat(6))],
    }));
    const bad = encodeProof({ ...s.parts, l2Receipt: swapped });
    await expect(s.verifier.verifyFinality(bad, "0x"))
      .to.be.revertedWithCustomError(s.verifier, "ProvenBytesMismatch");
  });

  // CL-85. Fail-closed check for the missing identity log, verified here
  // rather than implied. A receipt binding no identity cannot satisfy
  // VF-XCH-011, so extraction must revert rather than fall back to
  // caller-supplied values.
  it("rejects a receipt carrying no identity Detail log", async function () {
    const s = await build({ includeDetail: false });
    await expect(s.verifier.extractFacts(s.proof)).to.be.reverted;
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
    const s = await build({ lockEmitter: "0xdddd000000000000000000000000000000000004" });
    await expect(s.verifier.extractFacts(s.proof))
      .to.be.revertedWithCustomError(s.verifier, "NoMatchingLog");
  });
});

describe("ArbitrumChainVerifier — construction", function () {

  it("refuses zero addresses", async function () {
    const V = await ethers.getContractFactory("ArbitrumChainVerifier");
    await expect(V.deploy("arbitrum", ZERO, ROLLUP, CONFIRM_TOPIC, VAULT, LOCK_TOPIC))
      .to.be.revertedWithCustomError(V, "ZeroAddress");
    await expect(V.deploy("arbitrum", ROLLUP, ZERO, CONFIRM_TOPIC, VAULT, LOCK_TOPIC))
      .to.be.revertedWithCustomError(V, "ZeroAddress");
    await expect(V.deploy("arbitrum", ROLLUP, ROLLUP, CONFIRM_TOPIC, ZERO, LOCK_TOPIC))
      .to.be.revertedWithCustomError(V, "ZeroAddress");
  });

  it("names the confirmation event explicitly at deployment", async function () {
    const s = await build();
    // Arbitrum has revised this event across versions, so the deployed
    // configuration records which one was relied upon.
    expect(await s.verifier.assertionConfirmedTopic()).to.equal(CONFIRM_TOPIC);
    expect((await s.verifier.rollupContract()).toLowerCase()).to.equal(ROLLUP.toLowerCase());
  });

  it("exposes no setter", async function () {
    const s = await build();
    expect(s.verifier.interface.fragments.filter(
      f => f.type === "function" && /^set/i.test(f.name)
    ).length).to.equal(0);
  });
});
