// =============================================================================
// OpStackFaultProofVerifier — C.7 fault-proof chain tests
//
// Supersedes 19_opstack_verifier.test.cjs, which validated the removed
// L2OutputOracle design (CL-83).
//
// Under fault proofs a rootClaim means nothing until its dispute game resolves.
// This suite proves the four conditions the old design could not:
//   - the game was created by the configured factory
//   - the game is of the respected type
//   - the game resolved DEFENDER_WINS
//   - the L1 airgap has elapsed since resolution
//
// EXTERNAL DEPENDENCY: event signatures and the output-root preimage formula
// are OP Stack protocol details, not stated in the governing artifacts. These
// tests prove the chain's logic against them; they cannot prove they match
// Optimism mainnet.
//
// Weighted negative per Verifier Completion Standard 5.2.
// =============================================================================

const { expect } = require("chai");
const { ethers } = require("hardhat");

const ZERO = "0x0000000000000000000000000000000000000000";
const FACTORY = "0x5555555555555555555555555555555555555555";
const GAME_PROXY = "0x6666666666666666666666666666666666666666";
const VAULT = "0x4444444444444444444444444444444444444444";

const CREATED_TOPIC = ethers.keccak256(
  ethers.toUtf8Bytes("DisputeGameCreated(address,uint32,bytes32)")
);
const RESOLVED_TOPIC = ethers.keccak256(ethers.toUtf8Bytes("Resolved(uint8)"));
const LOCK_TOPIC = ethers.keccak256(
  ethers.toUtf8Bytes("CommitVaultLock(bytes32,uint256)")
);

const RESPECTED_GAME_TYPE = 0;          // CANNON
const AIRGAP = 302400;                  // 3.5 days

// GameStatus
const IN_PROGRESS = 0;
const CHALLENGER_WINS = 1;
const DEFENDER_WINS = 2;

// ---- RLP -------------------------------------------------------------------

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
const topic32 = (v) => ethers.zeroPadValue(ethers.toBeHex(BigInt(v)), 32);

// ---- receipts, headers, tries ----------------------------------------------

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
const VAULT_LOCK_ID = ethers.keccak256(ethers.toUtf8Bytes("op-fp-lock-1"));

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

const VERSION = ethers.ZeroHash;
const L2_STATE = ethers.keccak256(ethers.toUtf8Bytes("l2-state"));
const MSG_PASSER = ethers.keccak256(ethers.toUtf8Bytes("msg-passer"));

const CREATED_BLOCK = 8000;
const CREATED_TS = 1700000000;
const RESOLVED_BLOCK = 8100;
const RESOLVED_TS = 1700003600;

function encodeProof(p) {
  return ethers.AbiCoder.defaultAbiCoder().encode(
    ["uint256[2]", "bytes[3]", "bytes[3]", "bytes[][3]", "bytes[3]", "bytes32[4]"],
    [
      [p.createdBlockNumber, p.resolvedBlockNumber],
      [p.createdHeader, p.resolvedHeader, p.l2Header],
      [p.createdKey, p.resolvedKey, p.l2Key],
      [p.createdProof, p.resolvedProof, p.l2Proof],
      [p.createdReceipt, p.resolvedReceipt, p.l2Receipt],
      [p.version, p.stateRoot, p.msgPasser, p.l2BlockHash],
    ]
  );
}

async function build(opts = {}) {
  const M = await ethers.getContractFactory("MockL1Block");
  const mock = await M.deploy();
  const R = await ethers.getContractFactory("L1BlockRegistry");
  const registry = await R.deploy(await mock.getAddress());

  // ---- L2: the vault's lock event ----------------------------------------
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
  const l2Header = buildHeader(l2Trie.root, "fp-l2");
  const l2BlockHash = ethers.keccak256(l2Header);

  const claim = outputRoot(VERSION, L2_STATE, MSG_PASSER, l2BlockHash);

  // ---- L1 block A: DisputeGameCreated -------------------------------------
  const createdLog = buildLog(
    opts.factoryEmitter ?? FACTORY,
    [
      CREATED_TOPIC,
      ethers.zeroPadValue(opts.gameProxy ?? GAME_PROXY, 32),
      topic32(opts.gameType ?? RESPECTED_GAME_TYPE),
      opts.claimOverride ?? claim,
    ],
    "0x"
  );
  const createdReceipt = hex(buildReceipt({
    status: opts.createdStatus ?? 1, logs: [createdLog],
  }));
  const createdTrie = buildTrie(createdReceipt);
  const createdHeader = buildHeader(createdTrie.root, "fp-created");

  // ---- L1 block B: the game's Resolved event ------------------------------
  const resolvedLog = buildLog(
    opts.resolvedEmitter ?? GAME_PROXY,
    [RESOLVED_TOPIC, topic32(opts.gameStatus ?? DEFENDER_WINS)],
    "0x"
  );
  const resolvedReceipt = hex(buildReceipt({
    status: opts.resolvedStatus ?? 1, logs: [resolvedLog],
  }));
  const resolvedTrie = buildTrie(resolvedReceipt);
  const resolvedHeader = buildHeader(resolvedTrie.root, "fp-resolved");

  // ---- record the L1 blocks ----------------------------------------------
  await mock.set(CREATED_BLOCK, ethers.keccak256(createdHeader), CREATED_TS);
  await registry.record();

  await mock.set(RESOLVED_BLOCK, ethers.keccak256(resolvedHeader), RESOLVED_TS);
  await registry.record();

  // A later L1 block establishing how far the chain has advanced. The airgap
  // is measured from this, not from anything the caller supplies.
  const latestTs = opts.latestTs ?? (RESOLVED_TS + AIRGAP);
  await mock.set(9000, ethers.keccak256(ethers.toUtf8Bytes("later")), latestTs);
  await registry.record();

  const V = await ethers.getContractFactory("OpStackFaultProofVerifier");
  const verifier = await V.deploy({
    environmentId: "optimism",
    registry: await registry.getAddress(),
    disputeGameFactory: FACTORY,
    gameCreatedTopic: CREATED_TOPIC,
    gameResolvedTopic: RESOLVED_TOPIC,
    respectedGameType: RESPECTED_GAME_TYPE,
    gameFinalityDelaySeconds: AIRGAP,
    sourceVault: VAULT,
    lockEventTopic: LOCK_TOPIC,
  });

  const parts = {
    createdBlockNumber: CREATED_BLOCK,
    createdHeader, createdKey: createdTrie.key,
    createdProof: createdTrie.proof, createdReceipt,
    resolvedBlockNumber: RESOLVED_BLOCK,
    resolvedHeader, resolvedKey: resolvedTrie.key,
    resolvedProof: resolvedTrie.proof, resolvedReceipt,
    version: VERSION, stateRoot: L2_STATE, msgPasser: MSG_PASSER, l2BlockHash,
    l2Header, l2Key: l2Trie.key, l2Proof: l2Trie.proof, l2Receipt,
  };

  return { registry, verifier, parts, proof: encodeProof(parts), claim };
}

describe("OpStackFaultProofVerifier — proof chain", function () {

  it("verifies a lock anchored to a resolved dispute game", async function () {
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

  it("exposes computeOutputRoot for verification against a real rootClaim",
    async function () {
      const s = await build();
      expect(await s.verifier.computeOutputRoot(
        VERSION, L2_STATE, MSG_PASSER, s.parts.l2BlockHash
      )).to.equal(s.claim);
    });
});

describe("OpStackFaultProofVerifier — the four fault-proof conditions", function () {

  // CL-85. Fail-closed check for the missing identity log, verified here
  // rather than implied. A receipt binding no identity cannot satisfy
  // VF-XCH-011, so extraction must revert rather than fall back to
  // caller-supplied values.
  it("rejects a receipt carrying no identity Detail log", async function () {
    const s = await build({ includeDetail: false });
    await expect(s.verifier.extractFacts(s.proof)).to.be.reverted;
  });

  it("rejects a game of an unrespected type", async function () {
    // A game type the portal does not respect proves nothing about this chain.
    const s = await build({ gameType: 99 });
    await expect(s.verifier.verifyFinality(s.proof, "0x"))
      .to.be.revertedWithCustomError(s.verifier, "UnrespectedGameType");
  });

  it("rejects a game still in progress", async function () {
    const s = await build({ gameStatus: IN_PROGRESS });
    await expect(s.verifier.verifyFinality(s.proof, "0x"))
      .to.be.revertedWithCustomError(s.verifier, "GameNotResolvedInFavour");
  });

  it("rejects a game the challenger won", async function () {
    const s = await build({ gameStatus: CHALLENGER_WINS });
    await expect(s.verifier.verifyFinality(s.proof, "0x"))
      .to.be.revertedWithCustomError(s.verifier, "GameNotResolvedInFavour");
  });

  it("rejects a resolution whose airgap has not elapsed", async function () {
    // The L1 chain has advanced only one second past resolution.
    const s = await build({ latestTs: RESOLVED_TS + 1 });
    await expect(s.verifier.verifyFinality(s.proof, "0x"))
      .to.be.revertedWithCustomError(s.verifier, "AirgapNotElapsed");
  });

  it("accepts once the airgap has exactly elapsed", async function () {
    const s = await build({ latestTs: RESOLVED_TS + AIRGAP });
    const [finalized] = await s.verifier.verifyFinality(s.proof, "0x");
    expect(finalized).to.equal(true);
  });
});

describe("OpStackFaultProofVerifier — each link attacked", function () {

  it("rejects an L1 block the registry never recorded", async function () {
    const s = await build();
    const bad = encodeProof({ ...s.parts, createdBlockNumber: 12345 });
    await expect(s.verifier.verifyFinality(bad, "0x"))
      .to.be.revertedWithCustomError(s.verifier, "L1BlockNotRecorded");
  });

  it("rejects a game created by a contract that is not the factory",
    async function () {
      const s = await build({ factoryEmitter: "0x7777777777777777777777777777777777777777" });
      await expect(s.verifier.verifyFinality(s.proof, "0x"))
        .to.be.revertedWithCustomError(s.verifier, "NoMatchingLog");
    });

  it("rejects a Resolved event emitted by a different contract", async function () {
    // Resolution must come from the game the factory actually created.
    const s = await build({ resolvedEmitter: "0x8888888888888888888888888888888888888888" });
    await expect(s.verifier.verifyFinality(s.proof, "0x"))
      .to.be.revertedWithCustomError(s.verifier, "NoMatchingLog");
  });

  it("rejects an output-root preimage that does not reproduce the rootClaim",
    async function () {
      const s = await build();
      const bad = encodeProof({
        ...s.parts,
        stateRoot: ethers.keccak256(ethers.toUtf8Bytes("different-state")),
      });
      await expect(s.verifier.verifyFinality(bad, "0x"))
        .to.be.revertedWithCustomError(s.verifier, "OutputRootMismatch");
    });

  it("rejects an L2 header that does not hash to the committed block hash",
    async function () {
      const s = await build();
      const forged = buildHeader(ethers.keccak256(ethers.toUtf8Bytes("forged")), "fp-l2");
      const bad = encodeProof({ ...s.parts, l2Header: forged });
      await expect(s.verifier.verifyFinality(bad, "0x"))
        .to.be.revertedWithCustomError(s.verifier, "L2HeaderMismatch");
    });

  it("rejects L2 receipt bytes differing from the proven value", async function () {
    const s = await build();
    const swapped = hex(buildReceipt({
      logs: [buildLog(VAULT, [LOCK_TOPIC, VAULT_LOCK_ID], "0x" + word(1).repeat(6))],
    }));
    const bad = encodeProof({ ...s.parts, l2Receipt: swapped });
    await expect(s.verifier.verifyFinality(bad, "0x"))
      .to.be.revertedWithCustomError(s.verifier, "ProvenBytesMismatch");
  });

  it("rejects a failed L1 creation receipt", async function () {
    const s = await build({ createdStatus: 0 });
    await expect(s.verifier.verifyFinality(s.proof, "0x"))
      .to.be.revertedWithCustomError(s.verifier, "ReceiptFailed");
  });

  it("rejects a failed L2 receipt", async function () {
    const s = await build({ l2Status: 0 });
    await expect(s.verifier.verifyFinality(s.proof, "0x"))
      .to.be.revertedWithCustomError(s.verifier, "ReceiptFailed");
  });

  it("rejects a lock event from a different L2 contract", async function () {
    const s = await build({ lockEmitter: "0x9999999999999999999999999999999999999999" });
    await expect(s.verifier.extractFacts(s.proof))
      .to.be.revertedWithCustomError(s.verifier, "NoMatchingLog");
  });
});

describe("OpStackFaultProofVerifier — construction", function () {

  function cfg(over = {}) {
    return {
      environmentId: "optimism",
      registry: FACTORY,
      disputeGameFactory: FACTORY,
      gameCreatedTopic: CREATED_TOPIC,
      gameResolvedTopic: RESOLVED_TOPIC,
      respectedGameType: RESPECTED_GAME_TYPE,
      gameFinalityDelaySeconds: AIRGAP,
      sourceVault: VAULT,
      lockEventTopic: LOCK_TOPIC,
      ...over,
    };
  }

  it("refuses zero addresses", async function () {
    const V = await ethers.getContractFactory("OpStackFaultProofVerifier");
    await expect(V.deploy(cfg({ registry: ZERO })))
      .to.be.revertedWithCustomError(V, "ZeroAddress");
    await expect(V.deploy(cfg({ disputeGameFactory: ZERO })))
      .to.be.revertedWithCustomError(V, "ZeroAddress");
    await expect(V.deploy(cfg({ sourceVault: ZERO })))
      .to.be.revertedWithCustomError(V, "ZeroAddress");
  });

  it("binds the factory, game type, airgap and topics immutably",
    async function () {
      const s = await build();
      expect((await s.verifier.disputeGameFactory()).toLowerCase())
        .to.equal(FACTORY.toLowerCase());
      expect(await s.verifier.respectedGameType()).to.equal(RESPECTED_GAME_TYPE);
      expect(await s.verifier.gameFinalityDelaySeconds()).to.equal(BigInt(AIRGAP));
      expect(await s.verifier.gameCreatedTopic()).to.equal(CREATED_TOPIC);
      expect(await s.verifier.gameResolvedTopic()).to.equal(RESOLVED_TOPIC);
      expect(s.verifier.interface.fragments.filter(
        f => f.type === "function" && /^set/i.test(f.name)
      ).length).to.equal(0);
    });
});
