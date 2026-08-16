// =============================================================================
// MerklePatriciaProof — library tests
//
// Tries are constructed in the test from RLP primitives, and every root is the
// keccak256 of the node the library will actually parse. A proof only verifies
// if the library's RLP decoding, nibble handling, and hash chaining all agree
// with the encoding rules — no value is asserted by hand.
// =============================================================================

const { expect } = require("chai");
const { ethers } = require("hardhat");

// ---- minimal RLP encoder, used to build test tries -------------------------

function rlpLength(len, offset) {
  if (len < 56) return Uint8Array.from([len + offset]);
  const hex = len.toString(16);
  const lenBytes = ethers.getBytes("0x" + (hex.length % 2 ? "0" + hex : hex));
  return Uint8Array.from([lenBytes.length + offset + 55, ...lenBytes]);
}

function rlpBytes(input) {
  const b = typeof input === "string" ? ethers.getBytes(input) : input;
  if (b.length === 1 && b[0] < 0x80) return b;
  return Uint8Array.from([...rlpLength(b.length, 0x80), ...b]);
}

function rlpList(items) {
  const body = items.reduce((acc, x) => Uint8Array.from([...acc, ...x]), new Uint8Array());
  return Uint8Array.from([...rlpLength(body.length, 0xc0), ...body]);
}

function hex(u8) { return ethers.hexlify(u8); }

// ---- hex-prefix path encoding ----------------------------------------------

// nibbles: array of 0-15. isLeaf marks a terminating node.
function hexPrefix(nibbles, isLeaf) {
  const odd = nibbles.length % 2 === 1;
  const flag = (isLeaf ? 2 : 0) + (odd ? 1 : 0);
  const out = odd ? [(flag << 4) | nibbles[0]] : [flag << 4];
  const rest = odd ? nibbles.slice(1) : nibbles;
  for (let i = 0; i < rest.length; i += 2) {
    out.push((rest[i] << 4) | rest[i + 1]);
  }
  return Uint8Array.from(out);
}

function toNibbles(bytesLike) {
  const b = ethers.getBytes(bytesLike);
  const out = [];
  for (const x of b) { out.push(x >> 4); out.push(x & 0x0f); }
  return out;
}

describe("MerklePatriciaProof — single-leaf trie", function () {

  async function deploy() {
    const H = await ethers.getContractFactory("MptHarness");
    return await H.deploy();
  }

  it("recovers the value from a leaf node whose hash is the root", async function () {
    const h = await deploy();

    const key = "0x01";
    const value = "0xdeadbeef";
    const leaf = rlpList([rlpBytes(hexPrefix(toNibbles(key), true)), rlpBytes(value)]);
    const root = ethers.keccak256(leaf);

    const out = await h.verify(root, key, [hex(leaf)]);
    expect(out).to.equal(value);
  });

  it("rejects a proof whose node does not hash to the root", async function () {
    const h = await deploy();

    const key = "0x01";
    const leaf = rlpList([rlpBytes(hexPrefix(toNibbles(key), true)), rlpBytes("0xdeadbeef")]);
    const wrongRoot = ethers.keccak256(ethers.toUtf8Bytes("not-this-trie"));

    await expect(h.verify(wrongRoot, key, [hex(leaf)]))
      .to.be.revertedWithCustomError(h, "NodeHashMismatch");
  });

  it("rejects a leaf whose path does not match the key", async function () {
    const h = await deploy();

    const leaf = rlpList([rlpBytes(hexPrefix(toNibbles("0x01"), true)), rlpBytes("0xdeadbeef")]);
    const root = ethers.keccak256(leaf);

    // Same trie, different key.
    await expect(h.verify(root, "0x02", [hex(leaf)]))
      .to.be.revertedWithCustomError(h, "PathDivergence");
  });

  it("rejects an empty proof", async function () {
    const h = await deploy();
    await expect(h.verify(ethers.ZeroHash, "0x01", []))
      .to.be.revertedWithCustomError(h, "EmptyProof");
  });
});

describe("MerklePatriciaProof — branch node", function () {

  async function buildBranchTrie() {
    // Two leaves under a branch, distinguished by their first nibble.
    // Key 0x1234 -> nibbles [1,2,3,4];  key 0x5678 -> nibbles [5,6,7,8]
    const leafA = rlpList([rlpBytes(hexPrefix([2, 3, 4], true)), rlpBytes("0xaaaa")]);
    const leafB = rlpList([rlpBytes(hexPrefix([6, 7, 8], true)), rlpBytes("0xbbbb")]);

    const hashA = ethers.keccak256(leafA);
    const hashB = ethers.keccak256(leafB);

    const slots = [];
    for (let i = 0; i < 16; i++) {
      if (i === 1) slots.push(rlpBytes(hashA));
      else if (i === 5) slots.push(rlpBytes(hashB));
      else slots.push(rlpBytes("0x"));
    }
    slots.push(rlpBytes("0x"));           // slot 16, the branch value

    const branch = rlpList(slots);
    return { branch, leafA, leafB, root: ethers.keccak256(branch) };
  }

  it("descends a branch to the correct leaf", async function () {
    const H = await ethers.getContractFactory("MptHarness");
    const h = await H.deploy();
    const t = await buildBranchTrie();

    expect(await h.verify(t.root, "0x1234", [hex(t.branch), hex(t.leafA)]))
      .to.equal("0xaaaa");
    expect(await h.verify(t.root, "0x5678", [hex(t.branch), hex(t.leafB)]))
      .to.equal("0xbbbb");
  });

  it("rejects a key routed to an empty branch slot", async function () {
    const H = await ethers.getContractFactory("MptHarness");
    const h = await H.deploy();
    const t = await buildBranchTrie();

    // First nibble 9 - that slot is empty.
    await expect(h.verify(t.root, "0x9234", [hex(t.branch), hex(t.leafA)]))
      .to.be.revertedWithCustomError(h, "PathDivergence");
  });

  it("rejects a leaf swapped between branch slots", async function () {
    const H = await ethers.getContractFactory("MptHarness");
    const h = await H.deploy();
    const t = await buildBranchTrie();

    // Key routes to slot 1, which commits to leafA; supplying leafB breaks the
    // hash chain, which is the property that makes substitution impossible.
    await expect(h.verify(t.root, "0x1234", [hex(t.branch), hex(t.leafB)]))
      .to.be.revertedWithCustomError(h, "NodeHashMismatch");
  });
});

describe("MerklePatriciaProof — receipt decoding", function () {

  it("strips the type byte from a typed receipt and leaves legacy untouched", async function () {
    const H = await ethers.getContractFactory("MptHarness");
    const h = await H.deploy();

    const legacy = rlpList([rlpBytes("0x01"), rlpBytes("0x5208"), rlpBytes("0x"), rlpList([])]);
    expect(await h.stripReceiptType(hex(legacy))).to.equal(hex(legacy));

    // EIP-2718 type 2 prefix.
    const typed = Uint8Array.from([0x02, ...legacy]);
    expect(await h.stripReceiptType(hex(typed))).to.equal(hex(legacy));
  });

  it("decodes a receipt's status field", async function () {
    const H = await ethers.getContractFactory("MptHarness");
    const h = await H.deploy();

    const receipt = rlpList([
      rlpBytes("0x01"),        // status: success
      rlpBytes("0x5208"),      // cumulative gas
      rlpBytes("0x"),          // bloom (empty for the test)
      rlpList([]),             // logs
    ]);

    const [status] = await h.decodeReceipt(hex(receipt));
    expect(status).to.equal(1n);
  });

  it("reports a failed receipt as status zero", async function () {
    const H = await ethers.getContractFactory("MptHarness");
    const h = await H.deploy();

    const receipt = rlpList([
      rlpBytes("0x"),          // status: failure, encoded as empty
      rlpBytes("0x5208"),
      rlpBytes("0x"),
      rlpList([]),
    ]);

    const [status] = await h.decodeReceipt(hex(receipt));
    expect(status).to.equal(0n);
  });
});
