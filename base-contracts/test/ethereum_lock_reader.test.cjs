// EthereumLockReader: facts come from the real header, the receipts trie and
// eth_getProof storage proofs of a live CommitmentVaultLock("Ethereum").
// LIMIT: the beacon-header chain below is a fixture (no signatures / trusted
// checkpoint); only the execution evidence is real chain data.
const { expect } = require("chai");
const { ethers, network } = require("hardhat");
const { ethLockEvidence, encodeEvidence } = require("./lib/ethProof.cjs");
const { beaconRoot } = require("./lib/execHeader.cjs");

const DAY7 = 604800n;
const SCALE = 10n ** 18n;
const ETH_ID = "0xde7085290190e1f2f7f2f83d26fa72e411f9d765ddd608a77e8a7c388113943b";
const BLOCK_HASH_GINDEX = 812;
const coder = ethers.AbiCoder.defaultAbiCoder();
const FINALITY_TYPE =
  "tuple(uint64 slot, tuple(uint64 slot, uint64 proposerIndex, bytes32 parentRoot, bytes32 stateRoot, bytes32 bodyRoot)[] beacons, uint64 finalizedEpoch, uint64 attestedEpoch, bytes32[] payloadBranch)";

function payloadBranch(leaf) {
  const branch = [];
  let h = leaf;
  let g = BLOCK_HASH_GINDEX;
  while (g > 1) {
    const sib = ethers.hexlify(ethers.randomBytes(32));
    branch.push(sib);
    h = g & 1 ? ethers.sha256(ethers.concat([sib, h])) : ethers.sha256(ethers.concat([h, sib]));
    g >>= 1;
  }
  return { branch, bodyRoot: h };
}

function finality(blockHash, { attestedEpoch = 4 } = {}) {
  const { branch, bodyRoot } = payloadBranch(blockHash);
  const rnd = () => ethers.hexlify(ethers.randomBytes(32));
  const b0 = { slot: 64, proposerIndex: 1, parentRoot: rnd(), stateRoot: rnd(), bodyRoot };
  const b1 = { slot: 80, proposerIndex: 2, parentRoot: beaconRoot(b0), stateRoot: rnd(), bodyRoot: rnd() };
  const b2 = { slot: attestedEpoch * 32, proposerIndex: 3, parentRoot: beaconRoot(b1), stateRoot: rnd(), bodyRoot: rnd() };
  const toT = (b) => [b.slot, b.proposerIndex, b.parentRoot, b.stateRoot, b.bodyRoot];
  return coder.encode([FINALITY_TYPE], [[64, [b0, b1, b2].map(toT), 2, attestedEpoch, branch]]);
}

async function openLock(lock, signer, recipient, dest) {
  const lockId = ethers.hexlify(ethers.randomBytes(32));
  const gross = ethers.parseEther("0.01");
  // Put an unrelated tx in the same block so the receipts trie has branches.
  await network.provider.send("evm_setAutomine", [false]);
  await signer.sendTransaction({ to: dest, value: 1n });
  const tx = await lock.connect(signer).createNativeLock(
    lockId, recipient, 1, ETH_ID, ethers.ZeroHash, dest, DAY7, 25n * SCALE, { value: gross }
  );
  await network.provider.send("evm_mine", []);
  await network.provider.send("evm_setAutomine", [true]);
  await tx.wait();
  return { lockId, tx };
}

function flip(hex, at) {
  const b = ethers.getBytes(hex);
  b[at] ^= 0x01;
  return ethers.hexlify(b);
}

describe("EthereumLockReader (authenticated source evidence)", function () {
  let lock, reader, ev, lockId, recipient, other, dest;

  before(async function () {
    [, recipient, other, dest] = await ethers.getSigners();
    const CVL = await ethers.getContractFactory("CommitmentVaultLock");
    lock = await CVL.deploy("Ethereum", dest.address);
    reader = await (await ethers.getContractFactory("EthereumLockReader")).deploy(await lock.getAddress());
    ({ lockId } = await openLock(lock, other, recipient.address, dest.address));
    ev = await ethLockEvidence(await lock.getAddress(), (await openLockTx()).hash, lockId);
    async function openLockTx() {
      const logs = await lock.queryFilter(lock.filters.LockCreated(lockId));
      return { hash: logs[0].transactionHash };
    }
  });

  it("accepts a real lock: facts equal the on-chain LockRecord", async function () {
    expect(ev.receiptIndex).to.equal(1);
    const rec = await lock.lockRecord(lockId);
    const f = await reader.extractFacts(encodeEvidence(ev));
    expect(f[0]).to.equal(lockId);
    expect(f[1]).to.equal(rec.gross);
    expect(f[2]).to.equal(rec.fee);
    expect(f[3]).to.equal(rec.principal);
    expect(f[4]).to.equal(rec.duration);
    expect(f[5]).to.equal(rec.createdAt);
    expect(f[6]).to.equal(rec.maturity);
    expect(f[7]).to.equal(recipient.address);
    expect(f[8]).to.equal(1n);
    const [ok, hash, height] = await reader.verifyFinality(encodeEvidence(ev), finality(ev.block.hash));
    expect(ok).to.equal(true);
    expect(hash).to.equal(ev.block.hash);
    expect(height).to.equal(BigInt(ev.block.number));
  });

  it("rejects a tampered receipt", async function () {
    const bad = { ...ev, receipt: flip(ev.receipt, ev.receipt.length / 2 - 40) };
    await expect(reader.extractFacts(encodeEvidence(bad))).to.be.revertedWith("VF-XCH-011: Ethereum receipt");
    const badNode = { ...ev, receiptNodes: ev.receiptNodes.map((n, i) => (i === ev.receiptNodes.length - 1 ? flip(n, 40) : n)) };
    await expect(reader.extractFacts(encodeEvidence(badNode))).to.be.revertedWith("mpt child hash");
  });

  it("rejects a lock log from the wrong emitter", async function () {
    const CVL = await ethers.getContractFactory("CommitmentVaultLock");
    const otherLock = await CVL.deploy("Ethereum", dest.address);
    const wrong = await (await ethers.getContractFactory("EthereumLockReader")).deploy(await otherLock.getAddress());
    await expect(wrong.extractFacts(encodeEvidence(ev))).to.be.revertedWith("VF-XCH-011: Ethereum log emitter");
  });

  it("rejects a lock from a non-Ethereum environment", async function () {
    const CVL = await ethers.getContractFactory("CommitmentVaultLock");
    const baseLock = await CVL.deploy("Base", dest.address);
    const r = await (await ethers.getContractFactory("EthereumLockReader")).deploy(await baseLock.getAddress());
    const { lockId: id2 } = await openLock(baseLock, other, recipient.address, dest.address);
    const logs = await baseLock.queryFilter(baseLock.filters.LockCreated(id2));
    const ev2 = await ethLockEvidence(await baseLock.getAddress(), logs[0].transactionHash, id2);
    await expect(r.extractFacts(encodeEvidence(ev2))).to.be.revertedWith("VF-XCH-011: Ethereum environment");
  });

  it("rejects an unauthenticated header and an unfinalized chain", async function () {
    // Header with a forged receiptsRoot cannot be bound into the beacon body.
    const forged = { ...ev, headerRlp: flip(ev.headerRlp, 170) };
    await expect(reader.verifyFinality(encodeEvidence(forged), finality(ev.block.hash)))
      .to.be.revertedWith("VF-XCH-006: Ethereum payload not in beacon body");
    await expect(reader.extractFacts(encodeEvidence(forged))).to.be.revertedWith("mpt root");
    await expect(reader.verifyFinality(encodeEvidence(ev), finality(ev.block.hash, { attestedEpoch: 3 })))
      .to.be.revertedWith("VF-XCH-006: Ethereum not finalized");
  });

  it("rejects a mismatched recipient (storage proof of another lock or edited value)", async function () {
    const { lockId: id3 } = await openLock(lock, other, other.address, dest.address);
    const logs = await lock.queryFilter(lock.filters.LockCreated(id3));
    const ev3 = await ethLockEvidence(await lock.getAddress(), logs[0].transactionHash, id3);
    // Fresh lock's own proof gives its own recipient, never the first one's.
    expect((await reader.extractFacts(encodeEvidence(ev3)))[7]).to.equal(other.address);
    // Splice the other lock's recipient-slot proof into this lock's evidence.
    const spliced = { ...ev, recipientSlotNodes: ev3.recipientSlotNodes };
    await expect(reader.extractFacts(encodeEvidence(spliced))).to.be.reverted;
    const edited = { ...ev, recipientSlotNodes: ev.recipientSlotNodes.map((n, i, a) => (i === a.length - 1 ? flip(n, n.length / 2 - 3) : n)) };
    await expect(reader.extractFacts(encodeEvidence(edited))).to.be.revertedWith("mpt child hash");
  });

  it("rejects plain caller fact bytes", async function () {
    const facts = coder.encode(
      ["bytes32", "uint256", "uint256", "uint256", "uint256", "uint256", "uint256", "address", "uint8"],
      [lockId, 1, 1, 1, DAY7, 1, 1 + Number(DAY7), recipient.address, 0]
    );
    await expect(reader.extractFacts(facts)).to.be.reverted;
    await expect(reader.verifyFinality(facts, "0x")).to.be.reverted;
  });
});
