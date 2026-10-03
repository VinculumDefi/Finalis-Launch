const { expect } = require("chai");
const { ethers } = require("hardhat");

const BITS = 0x207fffff;
const TARGET = 0x7fffffn << (8n * (32n - 3n));

function u32le(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n >>> 0);
  return b;
}

function sha256d(data) {
  return ethers.sha256(ethers.sha256(data));
}

function leInt(hashHex) {
  const b = ethers.getBytes(hashHex);
  let n = 0n;
  for (let i = 0; i < 32; i++) n |= BigInt(b[i]) << (8n * BigInt(i));
  return n;
}

function header({ version, prev, merkle, time, bits, nonce }) {
  return Buffer.concat([
    u32le(version),
    Buffer.from(ethers.getBytes(prev)),
    Buffer.from(ethers.getBytes(merkle)),
    u32le(time),
    u32le(bits),
    u32le(nonce),
  ]);
}

function mine(fields) {
  for (let nonce = 0; nonce < 20000; nonce++) {
    const raw = header({ ...fields, nonce });
    const hash = sha256d(raw);
    if (leInt(hash) <= TARGET) return { raw, hash };
  }
  throw new Error("miner failed to find a header under the regtest target");
}

function chain(count, lockMerkle) {
  let prev = ethers.ZeroHash;
  const headers = [];
  const hashes = [];
  for (let i = 0; i < count; i++) {
    const mined = mine({
      version: 1,
      prev,
      merkle: i === 0 ? lockMerkle : ethers.ZeroHash,
      time: 1700000000 + i,
      bits: BITS,
    });
    if (mined.raw.length !== 80) throw new Error("header is not 80 bytes");
    headers.push(ethers.hexlify(mined.raw));
    hashes.push(mined.hash);
    prev = mined.hash;
  }
  return { headers, hashes };
}

function merkleRoot(txid, sibling) {
  return sha256d(ethers.concat([txid, sibling]));
}

describe("BitcoinHeaderChecker", function () {
  async function deploy() {
    const Factory = await ethers.getContractFactory("BitcoinHeaderChecker");
    return Factory.deploy();
  }

  it("accepts a mined 7-header chain with the lock tx in the merkle root and six headers after it", async function () {
    const checker = await deploy();
    const txid = ethers.hexlify(ethers.randomBytes(32));
    const sibling = ethers.hexlify(ethers.randomBytes(32));
    const root = merkleRoot(txid, sibling);
    expect(leInt(root)).to.be.a("bigint");
    const built = chain(7, root);
    expect(built.headers).to.have.length(7);
    for (const hash of built.hashes) expect(leInt(hash) <= TARGET).to.equal(true);
    await checker.verify(built.headers, built.hashes, 0, txid, [sibling], 0);
  });

  it("reverts a 5-header chain", async function () {
    const checker = await deploy();
    const txid = ethers.hexlify(ethers.randomBytes(32));
    const sibling = ethers.hexlify(ethers.randomBytes(32));
    const root = merkleRoot(txid, sibling);
    const built = chain(5, root);
    await expect(
      checker.verify(built.headers, built.hashes, 0, txid, [sibling], 0)
    ).to.be.revertedWithCustomError(checker, "NotEnoughConfirmations");
  });

  it("reverts when a header byte or a merkle sibling bit is flipped", async function () {
    const checker = await deploy();
    const txid = ethers.hexlify(ethers.randomBytes(32));
    const sibling = ethers.hexlify(ethers.randomBytes(32));
    const root = merkleRoot(txid, sibling);
    const built = chain(7, root);

    const flippedHeader = ethers.getBytes(built.headers[3]);
    flippedHeader[20] ^= 0x01;
    const badHeaders = built.headers.slice();
    badHeaders[3] = ethers.hexlify(flippedHeader);
    await expect(
      checker.verify(badHeaders, built.hashes, 0, txid, [sibling], 0)
    ).to.be.revertedWithCustomError(checker, "HashMismatch");

    const flippedSibling = ethers.getBytes(sibling);
    flippedSibling[0] ^= 0x01;
    await expect(
      checker.verify(built.headers, built.hashes, 0, txid, [ethers.hexlify(flippedSibling)], 0)
    ).to.be.revertedWithCustomError(checker, "BadMerkleProof");
  });
});
