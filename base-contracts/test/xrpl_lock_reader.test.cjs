// XrplLockReader: XRP Ledger locks proven from ledger data (local standalone
// rippled fixture, non-evm-locks/xrpl/reader_fixture.mjs).
const { expect } = require("chai");
const { ethers } = require("hardhat");
const crypto = require("crypto");
const FX = require("./fixtures/xrpl_local_locks.json");

const coder = ethers.AbiCoder.defaultAbiCoder();
const PROOF = "tuple(bytes header, bytes paymentTx, bytes paymentMeta, bytes[] paymentInner, bytes escrowTx, bytes escrowMeta, bytes[] escrowInner, bytes payload, uint256 durationSecs)";
const RIPPLE_EPOCH = 946684800;
const proof = (L, o = {}) => coder.encode([PROOF], [{
  header: L.header, paymentTx: L.payment.tx, paymentMeta: L.payment.meta, paymentInner: L.payment.inner,
  escrowTx: L.escrow.tx, escrowMeta: L.escrow.meta, escrowInner: L.escrow.inner, payload: L.payload, durationSecs: L.durationSecs, ...o,
}]);
const claim = (h, i) => coder.encode(["bytes32", "uint256"], [h, i]);
const flip = (hex, byteIndex) => {
  const b = Buffer.from(hex.slice(2), "hex"); b[byteIndex] ^= 1; return "0x" + b.toString("hex");
};

describe("XrplLockReader (XRP Ledger, local standalone rippled lock)", function () {
  this.timeout(300000);
  let reader;
  before(async function () {
    reader = await (await ethers.getContractFactory("XrplLockReader")).deploy(FX.devFundAccountId);
  });

  it("SHA-512Half in Solidity matches Node for empty, short, block-edge and long input", async function () {
    for (const n of [0, 1, 111, 112, 127, 128, 129, 300, 1000]) {
      const data = crypto.randomBytes(n);
      const want = "0x" + crypto.createHash("sha512").update(data).digest().subarray(0, 32).toString("hex");
      expect(await reader.sha512Half(data)).to.equal(want);
    }
  });

  it("verifyFinality: the header hashes to the claimed ledger hash and index", async function () {
    const L = FX.week;
    const r = await reader.verifyFinality(proof(L), claim(L.ledgerHash, L.ledgerIndex));
    expect(r[0]).to.equal(true);
    expect(r[1]).to.equal(L.ledgerHash.toLowerCase());
    await expect(reader.verifyFinality(proof(L), claim(ethers.ZeroHash, L.ledgerIndex))).to.be.revertedWith("VF-XCH-006: ledger hash mismatch");
    await expect(reader.verifyFinality(proof(L), claim(L.ledgerHash, L.ledgerIndex + 1))).to.be.revertedWith("VF-XCH-006: ledger index mismatch");
    await expect(reader.verifyFinality(proof(L, { header: flip(L.header, 5) }), claim(L.ledgerHash, L.ledgerIndex))).to.be.revertedWith("VF-XCH-006: ledger hash mismatch");
  });

  it("accepts a real 7-day lock: lock id, recipient, amounts, 5% fee, times and asset from ledger data", async function () {
    const L = FX.week;
    const f = await reader.extractFacts(proof(L));
    const pl = Buffer.from(L.payload.slice(2), "hex");
    expect(f[0]).to.equal("0x" + pl.subarray(0, 32).toString("hex"));
    expect(f[1]).to.equal(BigInt(L.gross));
    expect(f[2]).to.equal(BigInt(L.fee));
    expect(f[3]).to.equal(BigInt(L.principal));
    expect(f[2] * 10000n).to.equal(f[1] * 500n);
    expect(f[4]).to.equal(604800n);
    expect(f[5]).to.equal(BigInt(L.closeTime + RIPPLE_EPOCH));
    expect(f[6]).to.equal(BigInt(L.finishAfter + RIPPLE_EPOCH));
    expect(f[7].toLowerCase()).to.equal("0x" + pl.subarray(32, 52).toString("hex"));
    expect(f[8]).to.equal(0n);
    expect(await reader.extractAssetId(proof(L))).to.equal(ethers.solidityPackedKeccak256(["string", "string"], ["XRP Ledger", "native-XRP"]));
    const gas = await reader.extractFacts.estimateGas(proof(L));
    console.log("      extractFacts gas:", gas.toString());
  });

  it("accepts a real Handshake (1-hour) lock at 5%", async function () {
    const f = await reader.extractFacts(proof(FX.handshake));
    expect(f[4]).to.equal(3600n);
    expect(f[2] * 10000n).to.equal(f[1] * 500n);
  });

  it("rejects fabricated or edited transaction bytes, metadata and tree nodes", async function () {
    const L = FX.week;
    await expect(reader.extractFacts(proof(L, { paymentTx: "0x" + crypto.randomBytes(270).toString("hex") }))).to.be.reverted;
    await expect(reader.extractFacts(proof(L, { escrowTx: flip(L.escrow.tx, 20) }))).to.be.revertedWith("VF-XCH-011: not in transaction tree");
    await expect(reader.extractFacts(proof(L, { paymentMeta: flip(L.payment.meta, 10) }))).to.be.reverted;
    await expect(reader.extractFacts(proof(L, { escrowInner: L.escrow.inner.map((n) => flip(n, 400)) }))).to.be.reverted;
    // a real transaction of the same ledger that is not a lock
    await expect(reader.extractFacts(proof(L, { escrowTx: L.unrelated.tx, escrowMeta: L.unrelated.meta, escrowInner: L.unrelated.inner })))
      .to.be.revertedWith("VF-XCH-011: second transaction is not an EscrowCreate");
    // transactions from another ledger against this header
    await expect(reader.extractFacts(proof(L, { escrowTx: FX.handshake.escrow.tx, escrowMeta: FX.handshake.escrow.meta, escrowInner: FX.handshake.escrow.inner })))
      .to.be.reverted;
  });

  it("rejects an edited payload (lock id, recipient, output token) and a wrong duration", async function () {
    const L = FX.week;
    for (const at of [0, 40, 52]) {
      await expect(reader.extractFacts(proof(L, { payload: flip(L.payload, at) }))).to.be.revertedWith("VF-XCH-011: InvoiceID binding");
    }
    await expect(reader.extractFacts(proof(L, { durationSecs: 2592000 }))).to.be.revertedWith("VF-XCH-011: maturity does not match duration");
    await expect(reader.extractFacts(proof(L, { durationSecs: 604801 }))).to.be.revertedWith("VF-XCH-011: duration not permitted");
  });

  it("rejects a real lock whose fee is not 5%, and one that pays another account", async function () {
    await expect(reader.extractFacts(proof(FX.wrongFee))).to.be.revertedWith("VF-XCH-011: fee is not 5%");
    await expect(reader.extractFacts(proof(FX.wrongDevFund))).to.be.revertedWith("VF-XCH-011: fee not paid to the Dev Fund");
    const other = await (await ethers.getContractFactory("XrplLockReader")).deploy(FX.releaseAccountId);
    await expect(other.extractFacts(proof(FX.week))).to.be.revertedWith("VF-XCH-011: fee not paid to the Dev Fund");
  });
});
