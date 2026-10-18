// Receipt-proof lock readers for Ethereum, Optimism, Polygon, BNB Smart Chain
// and Avalanche (same pattern as arbitrum_lock_reader.test.cjs).
// Local accept/reject cases use a real Hardhat CommitmentVaultLock(<env>).
// Ethereum and Optimism run the PRODUCTION reader locally (Hardhat headers
// have the same post-merge layout). BNB, Polygon and Avalanche use a test
// harness with only the header-shape check off; each production reader's
// shape check is tested on a REAL mainnet block fixture (parsing only: no
// CommitmentVaultLock lock exists on these chains yet). Fixtures come from
// scripts/fetchEvmReceiptFixture.cjs (read-only public RPC).
const { expect } = require("chai");
const { ethers, network } = require("hardhat");
const { ethLockEvidence, encodeEvidence, encodeBlockHeader, EVIDENCE_TYPE } = require("./lib/ethProof.cjs");

const DAY7 = 604800n;
const SCALE = 10n ** 18n;
const ETH_ID = "0xde7085290190e1f2f7f2f83d26fa72e411f9d765ddd608a77e8a7c388113943b";
const coder = ethers.AbiCoder.defaultAbiCoder();
// Native asset each reader reports for a native lock (registry key form).
const nativeId = (env) => ({
  Polygon: ethers.solidityPackedKeccak256(["string", "string"], ["Polygon", "native-POL"]),
  "BNB Smart Chain": ethers.solidityPackedKeccak256(["string", "string"], ["BNB Smart Chain", "native-BNB"]),
  Avalanche: ethers.solidityPackedKeccak256(["string", "string"], ["Avalanche", "native-AVAX"]),
}[env] || ETH_ID);
const claim = (chainId, hash, height) => coder.encode(["uint256", "bytes32", "uint256"], [chainId, hash, height]);

const CHAINS = [
  { env: "Ethereum", chainId: 1, prod: "SimpleEthereumLockReader", local: "SimpleEthereumLockReader", fx: "ethereum", shape: "Ethereum header fields" },
  { env: "Optimism", chainId: 10, prod: "OptimismLockReader", local: "OptimismLockReader", fx: "optimism", shape: "Optimism header fields" },
  { env: "Polygon", chainId: 137, prod: "PolygonLockReader", local: "PolygonLockReaderLocalHeaders", fx: "polygon", shape: "Polygon" },
  { env: "BNB Smart Chain", chainId: 56, prod: "BnbSmartChainLockReader", local: "BnbSmartChainLockReaderLocalHeaders", fx: "bnb_smart_chain", shape: "BNB" },
  { env: "Avalanche", chainId: 43114, prod: "AvalancheLockReader", local: "AvalancheLockReaderLocalHeaders", fx: "avalanche", shape: "Avalanche", avax: true },
];

function flip(hex, at) {
  const b = ethers.getBytes(hex);
  b[at] ^= 0x01;
  return ethers.hexlify(b);
}
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

// Avalanche evidence adds the storage proof for LockRecord word 9 (createdAt).
async function evidence(c, lockAddr, txHash, lockId) {
  const ev = await ethLockEvidence(lockAddr, txHash, lockId);
  if (c.avax) {
    const base = BigInt(ethers.keccak256(coder.encode(["bytes32", "uint256"], [lockId, 1])));
    const pr = await ethers.provider.send("eth_getProof", [lockAddr, [ethers.toBeHex(base + 9n, 32)], ev.block.number]);
    ev.createdAtSlotNodes = pr.storageProof[0].proof;
  }
  return ev;
}
function enc(c, e) {
  if (!c.avax) return encodeEvidence(e);
  return coder.encode([`tuple(${EVIDENCE_TYPE} base, bytes[] createdAtSlotNodes)`], [[
    [e.headerRlp, e.receipt, e.receiptIndex, e.receiptNodes, e.logIndex, e.accountNodes, e.envSlotNodes, e.recipientSlotNodes],
    e.createdAtSlotNodes ?? [],
  ]]);
}

for (const c of CHAINS) {
  describe(`${c.prod} (receipt proof, ${c.env} chain ${c.chainId})`, function () {
    let lock, reader, ev, lockId, recipient, other, dest, CVL, R;
    const FX = require(`./fixtures/${c.fx}_mainnet_receipt.json`);

    before(async function () {
      [, recipient, other, dest] = await ethers.getSigners();
      CVL = await ethers.getContractFactory("CommitmentVaultLock");
      R = await ethers.getContractFactory(c.local);
      lock = await CVL.deploy(c.env, dest.address);
      reader = await R.deploy(await lock.getAddress());
      let txHash;
      ({ lockId, txHash } = await openLock(lock, other, recipient.address, dest.address));
      ev = await evidence(c, await lock.getAddress(), txHash, lockId);
    });

    it("binds lock address, environment and chain id at construction", async function () {
      expect(await reader.lock()).to.equal(await lock.getAddress());
      expect(await reader.environmentId()).to.equal(c.env);
      expect(await reader.chainId()).to.equal(BigInt(c.chainId));
      await expect(R.deploy(ethers.ZeroAddress)).to.be.revertedWith("VF-XCH-011: lock");
    });

    it("accepts a real local lock: facts equal the LockRecord, block hash equals the claim", async function () {
      const rec = await lock.lockRecord(lockId);
      expect(rec.fee * 10000n).to.equal(rec.gross * 500n);
      const f = await reader.extractFacts(enc(c, ev));
      expect(f[0]).to.equal(lockId);
      expect(f[1]).to.equal(rec.gross);
      expect(f[2]).to.equal(rec.fee);
      // The lock's own asset (native) comes from the proven log.
      expect(await reader.extractAssetId(enc(c, ev))).to.equal(nativeId(c.env));
      expect(await reader.nativeAssetId()).to.equal(nativeId(c.env));
      await expect(reader.extractAssetId(enc(c, { ...ev, receipt: ethers.hexlify(ethers.randomBytes(300)) }))).to.be.reverted;
      expect(f[3]).to.equal(rec.principal);
      expect(f[4]).to.equal(rec.duration);
      expect(f[5]).to.equal(rec.createdAt);
      expect(f[6]).to.equal(rec.maturity);
      expect(f[7]).to.equal(recipient.address);
      expect(f[8]).to.equal(1n);
      const [ok, hash, height] = await reader.verifyFinality(enc(c, ev), claim(c.chainId, ev.block.hash, ev.block.number));
      expect(ok).to.equal(true);
      expect(hash).to.equal(ev.block.hash);
      expect(height).to.equal(BigInt(ev.block.number));
    });

    it("returns the real recipient and output token 0 for another lock", async function () {
      const { lockId: id0, txHash } = await openLock(lock, other, other.address, dest.address, 0);
      const e0 = await evidence(c, await lock.getAddress(), txHash, id0);
      const f = await reader.extractFacts(enc(c, e0));
      expect(f[7]).to.equal(other.address);
      expect(f[8]).to.equal(0n);
    });

    it("rejects fabricated receipt bytes and a tampered proof node", async function () {
      const fake = ethers.concat(["0x02", ethers.encodeRlp(["0x01", "0x5208", ethers.zeroPadValue("0x", 256), []])]);
      await expect(reader.extractFacts(enc(c, { ...ev, receipt: fake }))).to.be.revertedWith("VF-XCH-011: receipt");
      await expect(reader.extractFacts(enc(c, { ...ev, receipt: ethers.hexlify(ethers.randomBytes(300)) }))).to.be.revertedWith("VF-XCH-011: receipt");
      const bad = { ...ev, receiptNodes: ev.receiptNodes.map((n, i) => (i === ev.receiptNodes.length - 1 ? flip(n, 40) : n)) };
      await expect(reader.extractFacts(enc(c, bad))).to.be.revertedWith("mpt child hash");
    });

    it("rejects a wrong lock address", async function () {
      const otherLock = await CVL.deploy(c.env, dest.address);
      const wrong = await R.deploy(await otherLock.getAddress());
      await expect(wrong.extractFacts(enc(c, ev))).to.be.revertedWith("VF-XCH-011: log emitter");
    });

    it("rejects a tampered lock ID, amount or recipient", async function () {
      await expect(reader.extractFacts(enc(c, { ...ev, receipt: swap(ev.receipt, lockId, flip(lockId, 31)) })))
        .to.be.revertedWith("VF-XCH-011: receipt");
      const rec = await lock.lockRecord(lockId);
      await expect(reader.extractFacts(enc(c, { ...ev, receipt: swap(ev.receipt, ethers.toBeHex(rec.gross, 32), ethers.toBeHex(rec.gross * 2n, 32)) })))
        .to.be.revertedWith("VF-XCH-011: receipt");
      const leaf = ev.recipientSlotNodes.length - 1;
      const recBad = { ...ev, recipientSlotNodes: ev.recipientSlotNodes.map((n, i) => (i === leaf ? swap(n, recipient.address, other.address) : n)) };
      await expect(reader.extractFacts(enc(c, recBad))).to.be.reverted;
      const { lockId: id2, txHash } = await openLock(lock, other, other.address, dest.address);
      const e2 = await evidence(c, await lock.getAddress(), txHash, id2);
      await expect(reader.extractFacts(enc(c, { ...ev, recipientSlotNodes: e2.recipientSlotNodes }))).to.be.reverted;
      if (c.avax) await expect(reader.extractFacts(enc(c, { ...ev, createdAtSlotNodes: [] }))).to.be.reverted;
    });

    it("rejects a wrong block hash or height, an edited header, and a forged receiptsRoot", async function () {
      await expect(reader.verifyFinality(enc(c, ev), claim(c.chainId, ethers.keccak256("0x01"), ev.block.number)))
        .to.be.revertedWith("VF-XCH-006: block hash mismatch");
      await expect(reader.verifyFinality(enc(c, ev), claim(c.chainId, ev.block.hash, BigInt(ev.block.number) + 1n)))
        .to.be.revertedWith("VF-XCH-006: block height mismatch");
      await expect(reader.verifyFinality(enc(c, { ...ev, headerRlp: flip(ev.headerRlp, 20) }), claim(c.chainId, ev.block.hash, ev.block.number)))
        .to.be.revertedWith("VF-XCH-006: block hash mismatch");
      await expect(reader.extractFacts(enc(c, { ...ev, headerRlp: swap(ev.headerRlp, ev.block.receiptsRoot, ethers.keccak256("0x02")) }))).to.be.reverted;
      const prev = await network.provider.send("eth_getBlockByNumber", [ethers.toQuantity(BigInt(ev.block.number) - 1n), false]);
      await expect(reader.extractFacts(enc(c, { ...ev, headerRlp: encodeBlockHeader(prev) }))).to.be.reverted;
    });

    it("rejects a wrong chain: another chain id, or a lock set up for another environment", async function () {
      await expect(reader.verifyFinality(enc(c, ev), claim(c.chainId === 1 ? 10 : 1, ev.block.hash, ev.block.number)))
        .to.be.revertedWith("VF-XCH-006: wrong chain");
      const baseLock = await CVL.deploy("Base", dest.address);
      const r = await R.deploy(await baseLock.getAddress());
      const { lockId: id3, txHash } = await openLock(baseLock, other, recipient.address, dest.address);
      const e3 = await evidence(c, await baseLock.getAddress(), txHash, id3);
      await expect(r.extractFacts(enc(c, e3))).to.be.revertedWith("VF-XCH-011: environment");
    });

    describe(`real ${c.env} mainnet block ${FX.blockNumber} (parsing only, not a lock)`, function () {
      let prod;
      before(async function () {
        prod = await (await ethers.getContractFactory(c.prod)).deploy(await lock.getAddress());
      });

      it("the production reader opens the real header and proves every fixture receipt against receiptsRoot", async function () {
        expect(FX.chainId).to.equal(c.chainId);
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
      });

      it("rejects tampered real data and refuses a real non-lock receipt as a lock", async function () {
        const r = FX.receipts.find((x) => x.logs.length > 0);
        await expect(prod.proveReceipt(FX.headerRlp, flip(r.receipt, 10), r.index, r.nodes)).to.be.revertedWith("VF-XCH-011: receipt");
        await expect(prod.proveReceipt(swap(FX.headerRlp, FX.receiptsRoot, ethers.keccak256("0x02")), r.receipt, r.index, r.nodes)).to.be.reverted;
        const e = { headerRlp: FX.headerRlp, receipt: r.receipt, receiptIndex: r.index, receiptNodes: r.nodes, logIndex: 0, accountNodes: [], envSlotNodes: [], recipientSlotNodes: [] };
        await expect(prod.extractFacts(enc(c, e))).to.be.revertedWith("VF-XCH-011: log emitter");
        const [ok, h] = await prod.verifyFinality(enc(c, e), claim(c.chainId, FX.blockHash, FX.blockNumber));
        expect(ok).to.equal(true);
        expect(h).to.equal(FX.blockHash);
        await expect(prod.verifyFinality(enc(c, e), claim(c.chainId, ethers.ZeroHash, FX.blockNumber)))
          .to.be.revertedWith("VF-XCH-006: block hash mismatch");
      });

      if (c.local !== c.prod) {
        it("the production reader rejects a Hardhat (non-" + c.env + ") header", async function () {
          await expect(prod.extractFacts(enc(c, ev))).to.be.revertedWith(new RegExp(c.shape));
        });
      }

      it("rejects real headers from chains with a different header layout", async function () {
        const others = { Ethereum: ["polygon", "avalanche", "arbitrum"], Optimism: ["polygon", "avalanche", "arbitrum"],
          Polygon: ["ethereum", "avalanche", "arbitrum"], "BNB Smart Chain": ["ethereum", "polygon", "avalanche", "arbitrum"],
          Avalanche: ["ethereum", "polygon", "bnb_smart_chain", "arbitrum"] }[c.env];
        for (const o of others) {
          const O = require(`./fixtures/${o}_mainnet_receipt.json`);
          const r = O.receipts[0];
          await expect(prod.proveReceipt(O.headerRlp, r.receipt, r.index, r.nodes ?? r.nodes)).to.be.reverted;
        }
      });

      if (c.env === "Optimism") {
        it("accepts the real deposit receipt (type 0x7e) shape", async function () {
          expect(FX.receipts.some((r) => r.type === "0x7e")).to.equal(true);
        });
      }
      if (c.avax) {
        it("the real header's receiptsRoot commits to the settled block's receipts", async function () {
          expect(FX.receiptsBlockNumber).to.equal(FX.settledHeight);
          expect(FX.receiptsBlockNumber).to.be.lessThan(FX.blockNumber);
        });
      }
    });
  });
}
