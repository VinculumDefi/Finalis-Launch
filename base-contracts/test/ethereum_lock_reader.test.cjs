// EthereumLockReader: facts come from the real header, the receipts trie and
// eth_getProof storage proofs of a live CommitmentVaultLock("Ethereum").
// Finality comes from EthereumBeaconLightClient. On this local chain there is
// no beacon chain, so a deterministic LOCAL sync committee (512 known BLS keys,
// @noble/curves) signs beacon headers whose bodies commit to the real local
// execution block hashes. Real mainnet signatures are covered in
// eth_beacon_light_client.test.cjs.
const { expect } = require("chai");
const { ethers, network } = require("hardhat");
const { ethLockEvidence, encodeEvidence } = require("./lib/ethProof.cjs");
const L = require("./lib/beaconLc.cjs");

const DAY7 = 604800n;
const SCALE = 10n ** 18n;
const ETH_ID = "0xde7085290190e1f2f7f2f83d26fa72e411f9d765ddd608a77e8a7c388113943b";
const coder = ethers.AbiCoder.defaultAbiCoder();
const FORK = "0x06000000";
const GVR = ethers.keccak256(ethers.toUtf8Bytes("local genesis validators root"));
const FT = "tuple(tuple(uint64,uint64,bytes32,bytes32,bytes32) finalized, tuple(uint64,uint64,bytes32,bytes32,bytes32) lockBeacon, bytes32[] blockRootsBranch, bytes32[] payloadBranch)";
const CHECKPOINT_SLOT = 8192 * 2 + 32;
const rnd = () => ethers.hexlify(ethers.randomBytes(32));
const hdr = (slot, stateRoot, bodyRoot) => ({ slot, proposerIndex: 7, parentRoot: rnd(), stateRoot, bodyRoot });
const T = (h) => [h.slot, h.proposerIndex, h.parentRoot, h.stateRoot, h.bodyRoot];

const C = L.localCommittee("local-sync-committee-A");
const C2 = L.localCommittee("local-sync-committee-B");
const CXY = L.committeeXY(C.pubkeys);
const C2XY = L.committeeXY(C2.pubkeys);

async function deployLightClient() {
  const st = L.sparseTree({ [L.G.CURRENT_SC]: C.root }, "cp-state");
  const cp = hdr(CHECKPOINT_SLOT, st.root, rnd());
  return (await ethers.getContractFactory("EthereumBeaconLightClient")).deploy(
    T(cp), L.beaconRoot(cp), C.root, st.branch(L.G.CURRENT_SC), GVR, FORK);
}

// Local beacon chain for an execution block: lockBeacon (body commits to the
// block hash), finalized header (state commits to lockBeacon in block_roots),
// attested header (state commits to finalized root), signed by `signer`.
function beaconFor(blockHash, opts = {}) {
  const lockSlot = opts.lockSlot ?? CHECKPOINT_SLOT + 40;
  const finSlot = opts.finSlot ?? lockSlot + 25;
  const body = L.sparseTree({ [L.G.BLOCK_HASH_IN_BODY]: blockHash }, "body" + lockSlot);
  const lockBeacon = hdr(lockSlot, rnd(), body.root);
  const rootsG = L.G.BLOCK_ROOTS * 8192 + (lockSlot % 8192);
  const finState = L.sparseTree({ [rootsG]: L.beaconRoot(lockBeacon) }, "fin" + finSlot);
  const finalized = hdr(finSlot, finState.root, rnd());
  const attState = L.sparseTree({ [L.G.FINALIZED_ROOT]: L.beaconRoot(finalized) }, "att" + finSlot);
  const attested = hdr(finSlot + 64, attState.root, rnd());
  const domain = L.forkDomain(opts.fork ?? FORK, GVR);
  const signer = opts.signer ?? C;
  const { bits, signature } = L.signBits(signer, L.signingRoot(attested, domain), opts.bitsFn);
  const update = {
    attested: T(attested), finalized: T(finalized), finalityBranch: attState.branch(L.G.FINALIZED_ROOT),
    nextCommittee: ethers.ZeroHash, nextCommitteeBranch: [], syncBits: bits, signature, signatureSlot: finSlot + 65,
  };
  const proof = coder.encode([FT], [[T(finalized), T(lockBeacon), finState.branch(rootsG), body.branch(L.G.BLOCK_HASH_IN_BODY)]]);
  return { update, proof, finalized, lockBeacon, finState, body };
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
  let lock, reader, lc, ev, lockId, recipient, other, dest;

  before(async function () {
    [, recipient, other, dest] = await ethers.getSigners();
    const CVL = await ethers.getContractFactory("CommitmentVaultLock");
    lock = await CVL.deploy("Ethereum", dest.address);
    lc = await deployLightClient();
    reader = await (await ethers.getContractFactory("EthereumLockReader")).deploy(await lock.getAddress(), await lc.getAddress());
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
    const b = beaconFor(ev.block.hash);
    await (await lc.submitUpdate(b.update, CXY, C.aggregate)).wait();
    const [ok, hash, height] = await reader.verifyFinality(encodeEvidence(ev), b.proof);
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
    const wrong = await (await ethers.getContractFactory("EthereumLockReader")).deploy(await otherLock.getAddress(), await lc.getAddress());
    await expect(wrong.extractFacts(encodeEvidence(ev))).to.be.revertedWith("VF-XCH-011: Ethereum log emitter");
  });

  it("rejects a lock from a non-Ethereum environment", async function () {
    const CVL = await ethers.getContractFactory("CommitmentVaultLock");
    const baseLock = await CVL.deploy("Base", dest.address);
    const r = await (await ethers.getContractFactory("EthereumLockReader")).deploy(await baseLock.getAddress(), await lc.getAddress());
    const { lockId: id2 } = await openLock(baseLock, other, recipient.address, dest.address);
    const logs = await baseLock.queryFilter(baseLock.filters.LockCreated(id2));
    const ev2 = await ethLockEvidence(await baseLock.getAddress(), logs[0].transactionHash, id2);
    await expect(r.extractFacts(encodeEvidence(ev2))).to.be.revertedWith("VF-XCH-011: Ethereum environment");
  });

  describe("finality (local sync committee)", function () {
    let fresh;
    beforeEach(async function () {
      fresh = await deployLightClient();
      reader = await (await ethers.getContractFactory("EthereumLockReader")).deploy(await lock.getAddress(), await fresh.getAddress());
    });
    const submit = (b, xy = CXY, agg = C.aggregate) => fresh.submitUpdate(b.update, xy, agg);

    it("accepts only after a signed, finalized update", async function () {
      const b = beaconFor(ev.block.hash);
      await expect(reader.verifyFinality(encodeEvidence(ev), b.proof)).to.be.revertedWith("VF-XCH-006: Ethereum beacon header not finalized");
      await (await submit(b)).wait();
      expect((await reader.verifyFinality(encodeEvidence(ev), b.proof))[0]).to.equal(true);
    });
    it("rejects an unsigned header", async function () {
      const b = beaconFor(ev.block.hash);
      await expect(fresh.submitUpdate({ ...b.update, signature: "0x" + "00".repeat(256) }, CXY, C.aggregate)).to.be.revertedWith("LC: signature");
    });
    it("rejects a wrong signature", async function () {
      const b = beaconFor(ev.block.hash);
      const other = beaconFor(ev.block.hash);
      await expect(fresh.submitUpdate({ ...b.update, signature: other.update.signature }, CXY, C.aggregate)).to.be.revertedWith("LC: signature");
    });
    it("rejects under 2/3 participation", async function () {
      const b = beaconFor(ev.block.hash, { bitsFn: (i) => i < 341 });
      await expect(submit(b)).to.be.revertedWith("LC: participation below 2/3");
      const ok = beaconFor(ev.block.hash, { bitsFn: (i) => i < 342 });
      await expect(submit(ok)).to.not.be.reverted;
    });
    it("rejects a wrong committee", async function () {
      const b = beaconFor(ev.block.hash, { signer: C2 });
      await expect(submit(b, C2XY, C2.aggregate)).to.be.revertedWith("LC: wrong sync committee");
      await expect(submit(b)).to.be.revertedWith("LC: signature");
    });
    it("rejects a wrong fork domain", async function () {
      await expect(submit(beaconFor(ev.block.hash, { fork: "0x05000000" }))).to.be.revertedWith("LC: signature");
    });
    it("rejects a bad finality branch", async function () {
      const b = beaconFor(ev.block.hash);
      b.update.finalityBranch = b.update.finalityBranch.map((x, i) => (i === 3 ? rnd() : x));
      await expect(submit(b)).to.be.revertedWith("LC: finality branch");
    });
    it("rejects a header not descending from the checkpoint", async function () {
      const old = beaconFor(ev.block.hash, { lockSlot: CHECKPOINT_SLOT - 30, finSlot: CHECKPOINT_SLOT - 1 });
      await expect(submit(old)).to.be.revertedWith("LC: not newer than checkpoint");
      const far = beaconFor(ev.block.hash, { lockSlot: 8192 * 4, finSlot: 8192 * 4 + 10 });
      await expect(submit(far)).to.be.revertedWith("LC: signature period");
    });
    it("rejects a tampered execution block hash binding", async function () {
      const b = beaconFor(ev.block.hash);
      await (await submit(b)).wait();
      // A different execution block (forged receiptsRoot) is not in the body.
      const forged = { ...ev, headerRlp: flip(ev.headerRlp, 170) };
      await expect(reader.verifyFinality(encodeEvidence(forged), b.proof)).to.be.revertedWith("VF-XCH-006: Ethereum payload not in beacon body");
      await expect(reader.extractFacts(encodeEvidence(forged))).to.be.revertedWith("mpt root");
      // A lock beacon block not in the finalized state's block_roots.
      const fake = beaconFor(ev.block.hash);
      const spliced = coder.encode([FT], [[T(b.finalized), T(fake.lockBeacon), b.finState.branch(L.G.BLOCK_ROOTS * 8192 + (fake.lockBeacon.slot % 8192)), fake.body.branch(L.G.BLOCK_HASH_IN_BODY)]]);
      await expect(reader.verifyFinality(encodeEvidence(ev), spliced)).to.be.revertedWith("VF-XCH-006: Ethereum block not under finalized header");
    });
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
