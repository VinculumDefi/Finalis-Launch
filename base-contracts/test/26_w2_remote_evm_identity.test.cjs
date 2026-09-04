// =============================================================================
// W2 · REMOTE EVM IDENTITY BINDING (Ethereum) — written to FAIL on this tree
//
// Wave 1 established the shape that finds these defects: a real lock, plus a
// package that disagrees with it on an identity field. Wave 1 proved it against
// the same-chain Base door. This file proves the same door is open on Ethereum,
// and it does so one layer lower — at the verifier, before any consumer.
//
// The gap under test: VinculumFinalisEvmVault emits TWO logs per lock.
//
//   CommitVaultLock        — six data words, read by every EVM verifier
//   CommitVaultLockDetail  — sourceEnvironment, sourceAccount, canonicalAssetId,
//                            asset, lockContract, baseRecipient,
//                            releaseDestination, outputToken,
//                            chonxActivationReceipt, handshakeAllowanceCount,
//                            feeDestination
//
// The Detail event's own comment in the vault names VF-XCH-011 as its purpose.
// EvmReceipt.findLog matches a single topic0, and every EVM verifier passes the
// CommitVaultLock topic, so the Detail log sits unread in the same receipt.
//
// These tests build a receipt containing BOTH logs — exactly what the vault
// actually emits — and assert that extractFacts surfaces the identity. It does
// not, because IChainVerifier returns seven facts and none of them is identity.
//
// Expected on the unfixed tree:        4 failing, 1 passing (control)
// Expected after the Path A change:    5 passing
//
// Companion: reviewers/red-team/Wave_2/REDTEAM_WAVE2_REMEDY_PATH.md
// =============================================================================

const { expect } = require("chai");
const { ethers } = require("hardhat");

const VAULT = "0x1111111111111111111111111111111111111111";

const TOPIC_LOCK = ethers.keccak256(ethers.toUtf8Bytes("CommitVaultLock(bytes32,uint256)"));
const TOPIC_DETAIL = ethers.keccak256(ethers.toUtf8Bytes("CommitVaultLockDetail(bytes32,string,address,bytes32,address,address,address,address,uint8,bytes32,uint32,address)"));

const HONEST_RECIPIENT = ethers.getAddress("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
const ATTACKER        = ethers.getAddress("0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
const RELEASE_DEST    = ethers.getAddress("0xcccccccccccccccccccccccccccccccccccccccc");
const LOCK_CONTRACT   = ethers.getAddress("0xdddddddddddddddddddddddddddddddddddddddd");
const FEE_DEST        = ethers.getAddress("0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee");
const ASSET           = ethers.getAddress("0xffffffffffffffffffffffffffffffffffffffff");
const SOURCE_ACCOUNT  = ethers.getAddress("0x9999999999999999999999999999999999999999");

const CANONICAL_ASSET_ID = ethers.keccak256(ethers.toUtf8Bytes("ethereum:USDC"));
const VAULT_LOCK_ID      = ethers.keccak256(ethers.toUtf8Bytes("vault-lock-w2"));

// ---- RLP encoding (mirrors 18_ethereum_verifier) ---------------------------

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

function word(v) {
  return ethers.zeroPadValue(ethers.toBeHex(BigInt(v)), 32).slice(2);
}
function addrWord(a) {
  return ethers.zeroPadValue(a, 32).slice(2).toLowerCase();
}
function b32Word(b) {
  return b.slice(2);
}

// ---- the two events --------------------------------------------------------

function lockData({ gross, fee, principal, duration, creation, maturity }) {
  return "0x" + word(gross) + word(fee) + word(principal) +
                word(duration) + word(creation) + word(maturity);
}

// CommitVaultLockDetail non-indexed payload.
//
// Three fields are indexed (lockId, sourceAccount, canonicalAssetId) so they
// become topics. The nine remaining encode head-first. ABI head entries are
// fixed width even for dynamic types, so `string sourceEnvironment` occupies
// word 0 as an offset pointer and every field after it sits at a fixed index:
//
//   word 0  offset to sourceEnvironment (0x120 = 9 words)
//   word 1  asset
//   word 2  lockContract
//   word 3  baseRecipient          <-- W1-01
//   word 4  releaseDestination
//   word 5  outputToken            <-- W1-01
//   word 6  chonxActivationReceipt
//   word 7  handshakeAllowanceCount
//   word 8  feeDestination
//   word 9  string length
//   word 10 string bytes, right-padded
function detailData({ env, asset, lockContract, baseRecipient, releaseDestination,
                      outputToken, chonxReceipt, allowanceCount, feeDestination }) {
  const envBytes = ethers.toUtf8Bytes(env);
  const envPadded = ethers.hexlify(envBytes).slice(2).padEnd(64, "0");
  return "0x" +
    word(0x120) +
    addrWord(asset) +
    addrWord(lockContract) +
    addrWord(baseRecipient) +
    addrWord(releaseDestination) +
    word(outputToken) +
    b32Word(chonxReceipt) +
    word(allowanceCount) +
    addrWord(feeDestination) +
    word(envBytes.length) +
    envPadded;
}

function buildLog(emitter, topics, data) {
  return rlpList([rlpBytes(emitter), rlpList(topics.map((t) => rlpBytes(t))), rlpBytes(data)]);
}
function buildReceipt({ status = 1, logs = [] }) {
  return rlpList([
    rlpBytes(status === 1 ? "0x01" : "0x"),
    rlpBytes("0x5208"),
    rlpBytes("0x" + "00".repeat(256)),
    rlpList(logs),
  ]);
}
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
function buildTrie(receiptHex) {
  const path = Uint8Array.from([0x20, 0x80]);
  const leaf = rlpList([rlpBytes(path), rlpBytes(receiptHex)]);
  return { root: ethers.keccak256(leaf), key: "0x80", proof: [hex(leaf)] };
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

// Deploys the stack and produces a proof over a receipt carrying BOTH logs,
// which is what VinculumFinalisEvmVault actually emits.
async function deployWithDetail({ baseRecipient = HONEST_RECIPIENT,
                                  outputToken = 0,
                                  canonicalAssetId = CANONICAL_ASSET_ID,
                                  includeDetail = true } = {}) {
  const M = await ethers.getContractFactory("MockL1Block");
  const mock = await M.deploy();
  const R = await ethers.getContractFactory("L1BlockRegistry");
  const registry = await R.deploy(await mock.getAddress());

  const logs = [buildLog(VAULT, [TOPIC_LOCK, VAULT_LOCK_ID], lockData(FACTS))];

  if (includeDetail) {
    logs.push(buildLog(
      VAULT,
      [TOPIC_DETAIL, VAULT_LOCK_ID, ethers.zeroPadValue(SOURCE_ACCOUNT, 32), canonicalAssetId],
      detailData({
        env: "ethereum",
        asset: ASSET,
        lockContract: LOCK_CONTRACT,
        baseRecipient,
        releaseDestination: RELEASE_DEST,
        outputToken,
        chonxReceipt: ethers.ZeroHash,
        allowanceCount: 3,
        feeDestination: FEE_DEST,
      })
    ));
  }

  const receipt = hex(buildReceipt({ logs }));
  const trie = buildTrie(receipt);
  const header = buildHeader(trie.root);

  await mock.set(9000, ethers.keccak256(header), 1700000000);
  await registry.record();

  const V = await ethers.getContractFactory("EthereumChainVerifier");
  const verifier = await V.deploy("ethereum", await registry.getAddress(), VAULT, TOPIC_LOCK);

  return { verifier, proof: encodeProof(9000, header, trie.key, trie.proof, receipt), header };
}

describe("W2 · remote EVM identity must be extractable from the source receipt", function () {

  it("control · the six numeric facts are extracted from a two-log receipt", async function () {
    // Establishes the fixture is sound. If this fails, the RLP is wrong and
    // the four assertions below prove nothing.
    const s = await deployWithDetail();
    const f = await s.verifier.extractFacts(s.proof);

    expect(f.grossAmount).to.equal(BigInt(FACTS.gross));
    expect(f.feeAmount).to.equal(BigInt(FACTS.fee));
    expect(f.principalAmount).to.equal(BigInt(FACTS.principal));
    expect(f.durationSecs).to.equal(BigInt(FACTS.duration));
    expect(f.creationTimestamp).to.equal(BigInt(FACTS.creation));
    expect(f.maturityTimestamp).to.equal(BigInt(FACTS.maturity));

    expect(await s.verifier.isFinal(s.proof)).to.equal(true);
  });

  it("W2-01 · extractFacts must surface the bound baseRecipient", async function () {
    const s = await deployWithDetail({ baseRecipient: HONEST_RECIPIENT });
    const f = await s.verifier.extractFacts(s.proof);

    expect(
      f.baseRecipient,
      "IChainVerifier returns no baseRecipient, so the consumer takes it from the caller"
    ).to.not.equal(undefined);
    expect(ethers.getAddress(f.baseRecipient)).to.equal(ethers.getAddress(HONEST_RECIPIENT));
  });

  it("W2-02 · extractFacts must surface the bound canonicalAssetId", async function () {
    const s = await deployWithDetail();
    const f = await s.verifier.extractFacts(s.proof);

    expect(
      f.canonicalAssetId,
      "no canonicalAssetId is returned, so valuation follows the caller's chosen asset"
    ).to.not.equal(undefined);
    expect(f.canonicalAssetId).to.equal(CANONICAL_ASSET_ID);
  });

  it("W2-03 · extractFacts must surface the bound outputToken and releaseDestination", async function () {
    const s = await deployWithDetail({ outputToken: 0 });
    const f = await s.verifier.extractFacts(s.proof);

    // The BigNumber matcher rejects a comparison against undefined for a
    // numeric return, so the presence check is made directly.
    expect(f.outputToken === undefined, "no outputToken is returned").to.equal(false);
    expect(Number(f.outputToken)).to.equal(0);
    expect(ethers.getAddress(f.releaseDestination)).to.equal(ethers.getAddress(RELEASE_DEST));
  });

  it("W2-04 · a receipt with no Detail log must not verify", async function () {
    // A lock that bound no identity cannot satisfy VF-XCH-011. Once the
    // verifier reads the Detail log, its absence must fail closed rather than
    // fall back to caller-supplied values.
    const s = await deployWithDetail({ includeDetail: false });

    let threw = false;
    try {
      await s.verifier.extractFacts(s.proof);
    } catch { threw = true; }

    expect(threw, "extraction succeeded against a receipt binding no identity").to.equal(true);
  });
});
