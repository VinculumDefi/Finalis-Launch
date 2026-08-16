// =============================================================================
// Sha256dHeaderChain — SPV core tests
//
// Uses real Bitcoin mainnet headers. Neither the implementation nor the test
// can fabricate proof of work: a header only passes if its double-SHA256
// genuinely falls below the target it declares.
// =============================================================================

const { expect } = require("chai");
const { ethers } = require("hardhat");

// Real Bitcoin mainnet block headers, 80 bytes each, raw wire format.
// version | prevBlock(32) | merkleRoot(32) | time(4) | bits(4) | nonce(4)
const H0 =
  "01000000" +
  "0000000000000000000000000000000000000000000000000000000000000000" +
  "3ba3edfd7a7b12b27ac72c3e67768f617fc81bc3888a51323a9fb8aa4b1e5e4a" +
  "29ab5f49" + "ffff001d" + "1dac2b7c";

const H1 =
  "01000000" +
  "6fe28c0ab6f1b372c1a6a246ae63f74f931e8365e15a089c68d6190000000000" +
  "982051fd1e4ba744bbbe680e1fee14677ba1a3c3540bf7b1cdb606e857233e0e" +
  "61bc6649" + "ffff001d" + "01e36299";

const H2 =
  "01000000" +
  "4860eb18bf1b1620e37e9490fc8a427514416fd75159ab86688e9a8300000000" +
  "d5fdcc541e25de1c7a5addedf24858b8bb665c9f36ef744ee42c316022c90f9b" +
  "b0bc6649" + "ffff001d" + "08d2bd61";

// Double-SHA256 of a header, in internal byte order — what the contract computes.
function blockHash(headerHex) {
  const bytes = ethers.getBytes("0x" + headerHex);
  return ethers.sha256(ethers.sha256(bytes));
}

function hdr(hex) { return "0x" + hex; }

// Genesis is the checkpoint: bits 0x1d00ffff, time 0x495fab29.
async function deployAtGenesis() {
  const C = await ethers.getContractFactory("Sha256dHeaderChain");
  return await C.deploy(blockHash(H0), 0, 0x1d00ffff, 0x495fab29);
}

describe("Sha256dHeaderChain — proof of work", function () {

  it("accepts a real header whose work meets its declared target", async function () {
    const c = await deployAtGenesis();
    await c.submitHeaders(hdr(H1));
    expect(await c.isKnown(blockHash(H1))).to.equal(true);
    expect(await c.bestHeight()).to.equal(1n);
  });

  it("accepts consecutive headers in one call", async function () {
    const c = await deployAtGenesis();
    await c.submitHeaders(hdr(H1 + H2));
    expect(await c.isKnown(blockHash(H2))).to.equal(true);
    expect(await c.bestHeight()).to.equal(2n);
    expect(await c.bestTip()).to.equal(blockHash(H2));
  });

  it("rejects a header whose nonce has been altered", async function () {
    const c = await deployAtGenesis();
    // Same header, one byte of the nonce changed: the work no longer meets
    // the target, and no amount of caller insistence can change that.
    const forged = H1.slice(0, 152) + "ffffffff";
    await expect(c.submitHeaders(hdr(forged)))
      .to.be.revertedWithCustomError(c, "InsufficientWork");
  });

  it("rejects a header with an altered merkle root", async function () {
    const c = await deployAtGenesis();
    const forged = H1.slice(0, 72) +
      "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff" +
      H1.slice(136);
    await expect(c.submitHeaders(hdr(forged)))
      .to.be.revertedWithCustomError(c, "InsufficientWork");
  });

  it("rejects a header whose parent is unknown", async function () {
    const c = await deployAtGenesis();
    await expect(c.submitHeaders(hdr(H2)))
      .to.be.revertedWithCustomError(c, "UnknownParent");
  });

  it("rejects a malformed header length", async function () {
    const c = await deployAtGenesis();
    await expect(c.submitHeaders("0x1234"))
      .to.be.revertedWithCustomError(c, "BadHeaderLength");
    await expect(c.submitHeaders("0x"))
      .to.be.revertedWithCustomError(c, "BadHeaderLength");
  });

  it("rejects a difficulty change off a retarget boundary", async function () {
    const c = await deployAtGenesis();
    // An easier target declared at height 1 - not a multiple of 2016.
    const forged = H1.slice(0, 144) + "ffff011d" + H1.slice(152);
    await expect(c.submitHeaders(hdr(forged))).to.be.reverted;
  });
});

describe("Sha256dHeaderChain — chain state", function () {

  it("is idempotent: resubmitting a known header is a no-op", async function () {
    const c = await deployAtGenesis();
    await c.submitHeaders(hdr(H1));
    await c.submitHeaders(hdr(H1));
    expect(await c.bestHeight()).to.equal(1n);
  });

  it("reports confirmation depth from the best tip", async function () {
    const c = await deployAtGenesis();
    await c.submitHeaders(hdr(H1 + H2));
    expect(await c.confirmations(blockHash(H2))).to.equal(1n);
    expect(await c.confirmations(blockHash(H1))).to.equal(2n);
    expect(await c.confirmations(blockHash(H0))).to.equal(3n);
  });

  it("reports zero confirmations for an unknown block", async function () {
    const c = await deployAtGenesis();
    const unknown = ethers.keccak256(ethers.toUtf8Bytes("not-a-block"));
    expect(await c.confirmations(unknown)).to.equal(0n);
  });

  it("accumulates work rather than counting height", async function () {
    const c = await deployAtGenesis();
    const before = await c.bestWork();
    await c.submitHeaders(hdr(H1));
    expect(await c.bestWork()).to.be.greaterThan(before);
  });

  it("refuses a zero checkpoint", async function () {
    const C = await ethers.getContractFactory("Sha256dHeaderChain");
    await expect(C.deploy(ethers.ZeroHash, 0, 0x1d00ffff, 0x495fab29))
      .to.be.revertedWithCustomError(C, "ZeroCheckpoint");
  });
});

describe("Sha256dHeaderChain — merkle inclusion", function () {

  it("verifies the coinbase of a single-transaction block", async function () {
    const c = await deployAtGenesis();
    await c.submitHeaders(hdr(H1));
    // Block 1 holds one transaction, so the merkle root IS the txid.
    const merkleRoot = "0x" + H1.slice(72, 136);
    expect(await c.verifyTxInclusion(merkleRoot, blockHash(H1), [], 0))
      .to.equal(true);
  });

  it("rejects a transaction that is not in the block", async function () {
    const c = await deployAtGenesis();
    await c.submitHeaders(hdr(H1));
    const bogus = ethers.keccak256(ethers.toUtf8Bytes("not-in-block"));
    expect(await c.verifyTxInclusion(bogus, blockHash(H1), [], 0))
      .to.equal(false);
  });

  it("reverts for an unknown block", async function () {
    const c = await deployAtGenesis();
    const unknown = ethers.keccak256(ethers.toUtf8Bytes("no-such-block"));
    await expect(c.verifyTxInclusion(unknown, unknown, [], 0))
      .to.be.revertedWithCustomError(c, "UnknownBlock");
  });
});
