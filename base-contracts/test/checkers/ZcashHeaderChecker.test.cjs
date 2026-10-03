const { expect } = require("chai");
const { ethers } = require("hardhat");
const fx = require("./zcash-equihash-fixtures.json");

function u32le(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n >>> 0);
  return b;
}

function sha256d(data) {
  return ethers.sha256(ethers.sha256(data));
}

function hx(value) {
  return value.startsWith("0x") ? value : "0x" + value;
}

function transparentTx() {
  return ethers.hexlify(Buffer.concat([
    u32le(0x80000005),
    u32le(0x26a7270a),
    u32le(0x37a5165b),
    u32le(0),
    u32le(0),
    Buffer.from([0, 0, 0, 0, 0]),
  ]));
}

function shieldedMarker(which) {
  const counts = which === "orchard" ? [0, 0, 1] : [0, 1, 0];
  return ethers.hexlify(Buffer.concat([
    u32le(0x80000005),
    u32le(0x26a7270a),
    u32le(0x37a5165b),
    u32le(0),
    u32le(0),
    Buffer.from([0, 0, ...counts]),
  ]));
}

describe("ZcashHeaderChecker", function () {
  this.timeout(300000);

  async function deploy() {
    const Factory = await ethers.getContractFactory("ZcashHeaderChecker");
    return Factory.deploy();
  }

  const headers = fx.headers.map(hx);
  const hashes = fx.hashes.map(hx);
  const genesis = hx(fx.genesis);
  const above = hx(fx.aboveTarget);

  it("accepts the mainnet genesis Equihash solution under its nBits target", async function () {
    const checker = await deploy();
    const parsed = await checker.parseHeader(genesis);
    expect(parsed.version).to.equal(4);
    expect(parsed.bits).to.equal(0x1f07ffff);
    expect(parsed.solutionLength).to.equal(1344);
    await checker.checkWork(genesis);
    await checker.verifyEquihash(genesis);
    await checker.verifyTarget(genesis);
  });

  it("reverts a mutated Equihash solution", async function () {
    const checker = await deploy();
    const mutated = ethers.getBytes(genesis);
    mutated[400] ^= 0x01;
    const raw = ethers.hexlify(mutated);
    await expect(checker.verifyEquihash(raw)).to.be.revertedWithCustomError(checker, "BadEquihash");
    await expect(checker.checkWork(raw)).to.be.revertedWithCustomError(checker, "BadEquihash");
  });

  it("reverts when the header hash is above the nBits target", async function () {
    const checker = await deploy();
    await checker.verifyEquihash(above);
    await expect(checker.verifyTarget(above)).to.be.revertedWithCustomError(checker, "AboveTarget");
    await expect(checker.checkWork(above)).to.be.revertedWithCustomError(checker, "AboveTarget");
  });

  it("accepts 10 headers after a lock whose solution meets Equihash and its nBits target", async function () {
    const checker = await deploy();
    const root = sha256d(ethers.concat([fx.txid, fx.sibling]));
    const parsed = await checker.parseHeader(headers[0]);
    expect(parsed.version).to.equal(4);
    expect(parsed.prevHash).to.equal(ethers.ZeroHash);
    expect(parsed.merkleRoot).to.equal(root);
    expect(parsed.time).to.equal(1700000000);
    expect(parsed.bits).to.equal(0x207fffff);
    expect(parsed.solutionLength).to.equal(1344);
    await checker.checkWork(headers[0]);
    await checker.verify(headers, hashes, 0, transparentTx(), fx.txid, [fx.sibling], 0);
  });

  it("reverts when fewer than 10 headers follow the lock header", async function () {
    const checker = await deploy();
    await expect(
      checker.verify(headers.slice(0, 10), hashes.slice(0, 10), 0, transparentTx(), fx.txid, [fx.sibling], 0)
    ).to.be.revertedWithCustomError(checker, "NotEnoughConfirmations");
  });

  it("reverts a one-bit flip of a header or a merkle sibling", async function () {
    const checker = await deploy();
    const flipped = ethers.getBytes(headers[4]);
    flipped[10] ^= 0x01;
    const bad = headers.slice();
    bad[4] = ethers.hexlify(flipped);
    await expect(
      checker.verify(bad, hashes, 0, transparentTx(), fx.txid, [fx.sibling], 0)
    ).to.be.revertedWithCustomError(checker, "HashMismatch");

    const flippedSibling = ethers.getBytes(fx.sibling);
    flippedSibling[1] ^= 0x01;
    await expect(
      checker.verify(headers, hashes, 0, transparentTx(), fx.txid, [ethers.hexlify(flippedSibling)], 0)
    ).to.be.revertedWithCustomError(checker, "BadMerkleProof");
  });

  it("refuses a shielded-shaped sapling output marker and an orchard action marker", async function () {
    const checker = await deploy();
    await expect(
      checker.verify(headers, hashes, 0, shieldedMarker("sapling-output"), fx.txid, [fx.sibling], 0)
    ).to.be.revertedWithCustomError(checker, "Shielded");
    await expect(
      checker.verify(headers, hashes, 0, shieldedMarker("orchard"), fx.txid, [fx.sibling], 0)
    ).to.be.revertedWithCustomError(checker, "Shielded");
  });
});
