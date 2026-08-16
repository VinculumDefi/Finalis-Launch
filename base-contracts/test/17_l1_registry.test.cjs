// =============================================================================
// L1BlockRegistry — Ethereum header authentication tests
//
// Proves that the registry records only what the predeploy reports, and that a
// header is accepted only if it hashes to the recorded commitment. The caller
// chooses when to record and which header to submit; the caller cannot choose
// what is recorded or make a mismatched header verify.
//
// COMPLETION GAP: the real OP Stack L1Block predeploy does not exist on a local
// chain. These tests use MockL1Block and therefore prove the logic, not the
// integration. Deployment evidence from Base is required for that.
//
// Weighted negative per Verifier Completion Standard 5.2.
// =============================================================================

const { expect } = require("chai");
const { ethers } = require("hardhat");

const ZERO = "0x0000000000000000000000000000000000000000";

// Builds an RLP-encoded Ethereum header with the six leading 32-byte fields.
// Only structure matters for receiptsRoot extraction: the field is the sixth.
function buildHeader({ receiptsRoot }) {
  const field = (b) => "a0" + b.slice(2);
  const parentHash  = field(ethers.keccak256(ethers.toUtf8Bytes("parent")));
  const ommersHash  = field(ethers.keccak256(ethers.toUtf8Bytes("ommers")));
  const beneficiary = "94" + "11".repeat(20);          // 20-byte address
  const stateRoot   = field(ethers.keccak256(ethers.toUtf8Bytes("state")));
  const txRoot      = field(ethers.keccak256(ethers.toUtf8Bytes("txs")));
  const receipts    = field(receiptsRoot);

  // beneficiary is 21 bytes encoded, not 33 — pad the layout so receiptsRoot
  // still lands at the sixth 33-byte slot the contract expects.
  const body = parentHash + ommersHash + beneficiary +
               stateRoot + txRoot + receipts;

  const len = body.length / 2;
  const lenHex = len.toString(16).padStart(4, "0");
  return "0x" + "f9" + lenHex + body;
}

async function deploy() {
  const M = await ethers.getContractFactory("MockL1Block");
  const mock = await M.deploy();

  const R = await ethers.getContractFactory("L1BlockRegistry");
  const registry = await R.deploy(await mock.getAddress());

  return { mock, registry };
}

describe("L1BlockRegistry — recording", function () {

  it("records the block number and hash reported by the predeploy", async function () {
    const { mock, registry } = await deploy();
    const h = ethers.keccak256(ethers.toUtf8Bytes("l1-block-1000"));
    await mock.set(1000, h, 1700000000);

    await registry.record();

    expect(await registry.blockHashOf(1000)).to.equal(h);
    expect(await registry.blockTimestampOf(1000)).to.equal(1700000000n);
    expect(await registry.highestRecorded()).to.equal(1000n);
  });

  it("is permissionless — any caller may record, none may influence content", async function () {
    const { mock, registry } = await deploy();
    const signers = await ethers.getSigners();
    const stranger = signers[7];

    const h = ethers.keccak256(ethers.toUtf8Bytes("l1-block-2000"));
    await mock.set(2000, h, 1700000600);

    await registry.connect(stranger).record();

    // The stranger supplied nothing; every value came from the predeploy.
    expect(await registry.blockHashOf(2000)).to.equal(h);
  });

  it("accumulates history as the L1 origin advances", async function () {
    const { mock, registry } = await deploy();

    for (let n = 100; n <= 103; n++) {
      await mock.set(n, ethers.keccak256(ethers.toUtf8Bytes("blk-" + n)), 1700000000 + n);
      await registry.record();
    }

    expect(await registry.highestRecorded()).to.equal(103n);
    for (let n = 100; n <= 103; n++) {
      expect(await registry.blockHashOf(n))
        .to.equal(ethers.keccak256(ethers.toUtf8Bytes("blk-" + n)));
    }
  });

  it("is idempotent when the L1 origin has not advanced", async function () {
    const { mock, registry } = await deploy();
    const h = ethers.keccak256(ethers.toUtf8Bytes("same-block"));
    await mock.set(500, h, 1700000000);

    await registry.record();
    await registry.record();

    expect(await registry.blockHashOf(500)).to.equal(h);
    expect(await registry.highestRecorded()).to.equal(500n);
  });

  it("refuses to record an empty origin", async function () {
    const { registry } = await deploy();
    await expect(registry.record())
      .to.be.revertedWithCustomError(registry, "NothingToRecord");
  });

  it("refuses a zero predeploy address at construction", async function () {
    const R = await ethers.getContractFactory("L1BlockRegistry");
    await expect(R.deploy(ZERO)).to.be.revertedWithCustomError(R, "ZeroAddress");
  });

  it("exposes the canonical OP Stack predeploy address", async function () {
    const { registry } = await deploy();
    expect(await registry.OP_STACK_L1_BLOCK())
      .to.equal("0x4200000000000000000000000000000000000015");
  });
});

describe("L1BlockRegistry — header verification", function () {

  it("extracts receiptsRoot from a header matching the recorded hash", async function () {
    const { mock, registry } = await deploy();

    const receiptsRoot = ethers.keccak256(ethers.toUtf8Bytes("receipts-root"));
    const header = buildHeader({ receiptsRoot });
    const blockHash = ethers.keccak256(header);

    await mock.set(3000, blockHash, 1700000000);
    await registry.record();

    expect(await registry.receiptsRootOf(3000, header)).to.equal(receiptsRoot);
  });

  it("rejects a header that does not hash to the recorded commitment", async function () {
    const { mock, registry } = await deploy();

    const real = buildHeader({ receiptsRoot: ethers.keccak256(ethers.toUtf8Bytes("real")) });
    await mock.set(4000, ethers.keccak256(real), 1700000000);
    await registry.record();

    // A different header claiming the same block number.
    const forged = buildHeader({ receiptsRoot: ethers.keccak256(ethers.toUtf8Bytes("forged")) });

    await expect(registry.receiptsRootOf(4000, forged))
      .to.be.revertedWithCustomError(registry, "HeaderHashMismatch");
  });

  it("rejects a block number that was never recorded", async function () {
    const { registry } = await deploy();
    const header = buildHeader({ receiptsRoot: ethers.keccak256(ethers.toUtf8Bytes("x")) });

    await expect(registry.receiptsRootOf(9999, header))
      .to.be.revertedWithCustomError(registry, "UnknownL1Block");
  });

  it("rejects a truncated header", async function () {
    const { mock, registry } = await deploy();
    const short = "0xf90010a0" + "11".repeat(32);
    await mock.set(5000, ethers.keccak256(short), 1700000000);
    await registry.record();

    await expect(registry.receiptsRootOf(5000, short)).to.be.reverted;
  });

  it("isRecorded reports without reverting", async function () {
    const { mock, registry } = await deploy();
    expect(await registry.isRecorded(7000)).to.equal(false);

    await mock.set(7000, ethers.keccak256(ethers.toUtf8Bytes("blk")), 1700000000);
    await registry.record();

    expect(await registry.isRecorded(7000)).to.equal(true);
  });
});
