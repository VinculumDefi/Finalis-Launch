// ArbitrumLockReader: the lock is proven from its real receipt and LockCreated
// log against the block header's receiptsRoot, the header hash must equal the
// package's claimed block hash, and recipient / output token come from the
// lock's proven storage.
// Local accept/reject cases use a real Hardhat CommitmentVaultLock("Arbitrum")
// and the ArbitrumLockReaderLocalHeaders harness (same code path; Hardhat
// cannot produce Arbitrum-format headers). The Arbitrum header layout and
// Arbitrum receipt types are tested on a REAL Arbitrum One block fixture
// (parsing only: no CommitmentVaultLock lock exists on Arbitrum yet).
const { expect } = require("chai");
const { ethers, network } = require("hardhat");
const { ethLockEvidence, encodeEvidence, encodeBlockHeader } = require("./lib/ethProof.cjs");
const FX = require("./fixtures/arbitrum_mainnet_receipt.json");

const DAY7 = 604800n;
const SCALE = 10n ** 18n;
const ETH_ID = "0xde7085290190e1f2f7f2f83d26fa72e411f9d765ddd608a77e8a7c388113943b";
const coder = ethers.AbiCoder.defaultAbiCoder();
const claim = (chainId, hash, height) => coder.encode(["uint256", "bytes32", "uint256"], [chainId, hash, height]);

function flip(hex, at) {
  const b = ethers.getBytes(hex);
  b[at] ^= 0x01;
  return ethers.hexlify(b);
}
// Replace the first occurrence of `from` (hex, no 0x) with `to` inside `hex`.
function swap(hex, from, to) {
  const s = hex.toLowerCase(), f = from.toLowerCase().replace(/^0x/, "");
  const i = s.indexOf(f, 2);
  if (i < 0) throw new Error("pattern not found");
  return s.slice(0, i) + to.toLowerCase().replace(/^0x/, "") + s.slice(i + f.length);
}

async function openLock(lock, signer, recipient, dest, outputToken = 1) {
  const lockId = ethers.hexlify(ethers.randomBytes(32));
  await network.provider.send("evm_setAutomine", [false]);
  await signer.sendTransaction({ to: dest, value: 1n });
  const tx = await lock.connect(signer).createNativeLock(
    lockId, recipient, outputToken, ETH_ID, ethers.ZeroHash, dest, DAY7, 25n * SCALE, { value: ethers.parseEther("0.01") }
  );
  await network.provider.send("evm_mine", []);
  await network.provider.send("evm_setAutomine", [true]);
  const r = await tx.wait();
  return { lockId, txHash: r.hash };
}

describe("ArbitrumLockReader (receipt proof)", function () {
  let lock, reader, ev, lockId, recipient, other, dest, CVL, R;

  before(async function () {
    [, recipient, other, dest] = await ethers.getSigners();
    CVL = await ethers.getContractFactory("CommitmentVaultLock");
    R = await ethers.getContractFactory("ArbitrumLockReaderLocalHeaders");
    lock = await CVL.deploy("Arbitrum", dest.address);
    reader = await R.deploy(await lock.getAddress());
    let txHash;
    ({ lockId, txHash } = await openLock(lock, other, recipient.address, dest.address));
    ev = await ethLockEvidence(await lock.getAddress(), txHash, lockId);
  });

  it("binds lock address, environment and chain id at construction", async function () {
    expect(await reader.lock()).to.equal(await lock.getAddress());
    expect(await reader.environmentId()).to.equal("Arbitrum");
    expect(await reader.chainId()).to.equal(42161n);
    await expect(R.deploy(ethers.ZeroAddress)).to.be.revertedWith("VF-XCH-011: lock");
  });

  it("accepts a real lock: facts equal the on-chain LockRecord, block hash equals the claim", async function () {
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
    const [ok, hash, height] = await reader.verifyFinality(encodeEvidence(ev), claim(42161, ev.block.hash, ev.block.number));
    expect(ok).to.equal(true);
    expect(hash).to.equal(ev.block.hash);
    expect(height).to.equal(BigInt(ev.block.number));
  });

  it("returns the real output token (0) for a second lock", async function () {
    const { lockId: id0, txHash } = await openLock(lock, other, other.address, dest.address, 0);
    const ev0 = await ethLockEvidence(await lock.getAddress(), txHash, id0);
    const f = await reader.extractFacts(encodeEvidence(ev0));
    expect(f[7]).to.equal(other.address);
    expect(f[8]).to.equal(0n);
  });

  it("rejects fabricated receipt bytes", async function () {
    const fake = ethers.concat(["0x02", ethers.encodeRlp(["0x01", "0x5208", ethers.zeroPadValue("0x", 256), []])]);
    await expect(reader.extractFacts(encodeEvidence({ ...ev, receipt: fake }))).to.be.revertedWith("VF-XCH-011: receipt");
    const random = ethers.hexlify(ethers.randomBytes(300));
    await expect(reader.extractFacts(encodeEvidence({ ...ev, receipt: random }))).to.be.revertedWith("VF-XCH-011: receipt");
    const badNode = { ...ev, receiptNodes: ev.receiptNodes.map((n, i) => (i === ev.receiptNodes.length - 1 ? flip(n, 40) : n)) };
    await expect(reader.extractFacts(encodeEvidence(badNode))).to.be.revertedWith("mpt child hash");
  });

  it("rejects a wrong lock address", async function () {
    const otherLock = await CVL.deploy("Arbitrum", dest.address);
    const wrong = await R.deploy(await otherLock.getAddress());
    await expect(wrong.extractFacts(encodeEvidence(ev))).to.be.revertedWith("VF-XCH-011: log emitter");
  });

  it("rejects a tampered lock ID, amount or recipient", async function () {
    const idBad = { ...ev, receipt: swap(ev.receipt, lockId, flip(lockId, 31)) };
    await expect(reader.extractFacts(encodeEvidence(idBad))).to.be.revertedWith("VF-XCH-011: receipt");
    const rec = await lock.lockRecord(lockId);
    const grossWord = ethers.toBeHex(rec.gross, 32);
    const amtBad = { ...ev, receipt: swap(ev.receipt, grossWord, ethers.toBeHex(rec.gross * 2n, 32)) };
    await expect(reader.extractFacts(encodeEvidence(amtBad))).to.be.revertedWith("VF-XCH-011: receipt");
    // Recipient lives in the lock's storage; a substituted value breaks the storage proof.
    const leaf = ev.recipientSlotNodes.length - 1;
    const recBad = { ...ev, recipientSlotNodes: ev.recipientSlotNodes.map((n, i) => (i === leaf ? swap(n, recipient.address, other.address) : n)) };
    await expect(reader.extractFacts(encodeEvidence(recBad))).to.be.reverted;
    // A storage proof for another lock's record does not match this lock ID.
    const { lockId: id2, txHash } = await openLock(lock, other, other.address, dest.address);
    const ev2 = await ethLockEvidence(await lock.getAddress(), txHash, id2);
    await expect(reader.extractFacts(encodeEvidence({ ...ev, recipientSlotNodes: ev2.recipientSlotNodes }))).to.be.reverted;
  });

  it("rejects a wrong block hash or height", async function () {
    await expect(reader.verifyFinality(encodeEvidence(ev), claim(42161, ethers.keccak256("0x01"), ev.block.number)))
      .to.be.revertedWith("VF-XCH-006: block hash mismatch");
    await expect(reader.verifyFinality(encodeEvidence(ev), claim(42161, ev.block.hash, BigInt(ev.block.number) + 1n)))
      .to.be.revertedWith("VF-XCH-006: block height mismatch");
    // A header from a different block cannot carry this receipt.
    const prev = await network.provider.send("eth_getBlockByNumber", [ethers.toQuantity(BigInt(ev.block.number) - 1n), false]);
    await expect(reader.extractFacts(encodeEvidence({ ...ev, headerRlp: encodeBlockHeader(prev) }))).to.be.reverted;
    // Any edited header no longer hashes to the claimed block hash.
    const edited = { ...ev, headerRlp: flip(ev.headerRlp, 20) };
    await expect(reader.verifyFinality(encodeEvidence(edited), claim(42161, ev.block.hash, ev.block.number)))
      .to.be.revertedWith("VF-XCH-006: block hash mismatch");
    // A header with a forged receiptsRoot cannot carry the real receipt proof.
    const rootForged = { ...ev, headerRlp: swap(ev.headerRlp, ev.block.receiptsRoot, ethers.keccak256("0x02")) };
    await expect(reader.extractFacts(encodeEvidence(rootForged))).to.be.reverted;
  });

  it("rejects a wrong chain: claim for another chain id, or a lock from another environment", async function () {
    await expect(reader.verifyFinality(encodeEvidence(ev), claim(1, ev.block.hash, ev.block.number)))
      .to.be.revertedWith("VF-XCH-006: wrong chain");
    const ethLock = await CVL.deploy("Ethereum", dest.address);
    const r = await R.deploy(await ethLock.getAddress());
    const { lockId: id3, txHash } = await openLock(ethLock, other, recipient.address, dest.address);
    const ev3 = await ethLockEvidence(await ethLock.getAddress(), txHash, id3);
    await expect(r.extractFacts(encodeEvidence(ev3))).to.be.revertedWith("VF-XCH-011: environment");
  });

  it("the production ArbitrumLockReader rejects a Hardhat-shaped (non-Arbitrum) header", async function () {
    const prod = await (await ethers.getContractFactory("ArbitrumLockReader")).deploy(await lock.getAddress());
    await expect(prod.extractFacts(encodeEvidence(ev))).to.be.revertedWith("VF-XCH-011: Arbitrum header fields");
  });

  describe("real Arbitrum One data (parsing only, not a lock)", function () {
    let prod;
    before(async function () {
      prod = await (await ethers.getContractFactory("ArbitrumLockReader")).deploy(await lock.getAddress());
    });

    it("opens a real Arbitrum header: hash, number, sendRoot, L1 block number", async function () {
      const x = await prod.arbitrumHeaderExtras(FX.headerRlp);
      expect(x[0]).to.equal(FX.blockHash);
      expect(x[1]).to.equal(BigInt(FX.blockNumber));
      expect(x[2]).to.equal(FX.sendRoot);
      expect(x[4]).to.equal(BigInt(FX.l1BlockNumber));
    });

    it("proves every real receipt (incl. Arbitrum type 0x6a) against receiptsRoot and decodes its logs", async function () {
      for (const r of FX.receipts) {
        const [h, n, status, logCount] = await prod.proveReceipt(FX.headerRlp, r.receipt, r.index, r.nodes);
        expect(h).to.equal(FX.blockHash);
        expect(n).to.equal(BigInt(FX.blockNumber));
        expect(status).to.equal(BigInt(r.status));
        expect(logCount).to.equal(BigInt(r.logs.length));
        for (let i = 0; i < r.logs.length; i++) {
          const [emitter, topics, data] = await prod.receiptLog(r.receipt, i);
          expect(emitter.toLowerCase()).to.equal(r.logs[i].address.toLowerCase());
          expect(topics).to.deep.equal(r.logs[i].topics);
          expect(data).to.equal(r.logs[i].data);
        }
      }
      expect(FX.receipts.some((r) => r.type === "0x6a")).to.equal(true);
    });

    it("rejects tampered real data and a real non-lock receipt as a lock", async function () {
      const r = FX.receipts.find((x) => x.logs.length > 0);
      await expect(prod.proveReceipt(FX.headerRlp, flip(r.receipt, 10), r.index, r.nodes)).to.be.revertedWith("VF-XCH-011: receipt");
      await expect(prod.proveReceipt(swap(FX.headerRlp, FX.receiptsRoot, ethers.keccak256("0x02")), r.receipt, r.index, r.nodes)).to.be.reverted;
      const proofOnly = { headerRlp: FX.headerRlp, receipt: r.receipt, receiptIndex: r.index, receiptNodes: r.nodes, logIndex: 0, accountNodes: [], envSlotNodes: [], recipientSlotNodes: [] };
      await expect(prod.extractFacts(encodeEvidence(proofOnly))).to.be.revertedWith("VF-XCH-011: log emitter");
      const [ok, h] = await prod.verifyFinality(encodeEvidence(proofOnly), claim(42161, FX.blockHash, FX.blockNumber));
      expect(ok).to.equal(true);
      expect(h).to.equal(FX.blockHash);
      await expect(prod.verifyFinality(encodeEvidence(proofOnly), claim(42161, ethers.ZeroHash, FX.blockNumber)))
        .to.be.revertedWith("VF-XCH-006: block hash mismatch");
    });
  });
});
