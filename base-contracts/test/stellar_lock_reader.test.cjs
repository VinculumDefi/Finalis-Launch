// StellarLockReader: Stellar locks proven from ledger data (local standalone
// stellar-core 22.4.1, protocol 22; non-evm-locks/stellar/reader_fixture.mjs).
const { expect } = require("chai");
const { ethers } = require("hardhat");
const crypto = require("crypto");
const FX = require("./fixtures/stellar_local_locks.json");

const coder = ethers.AbiCoder.defaultAbiCoder();
const PROOF = "tuple(bytes header, bytes resultSet, bytes txXdr, bytes payload, uint256 durationSecs)";
const proof = (L, o = {}) => coder.encode([PROOF], [{ header: L.header, resultSet: L.resultSet, txXdr: L.tx, payload: L.payload, durationSecs: L.durationSecs, ...o }]);
const claim = (h, s) => coder.encode(["bytes32", "uint256"], [h, s]);
const flip = (hex, i) => { const b = Buffer.from(hex.slice(2), "hex"); b[i] ^= 1; return "0x" + b.toString("hex"); };

describe("StellarLockReader (Stellar, local standalone stellar-core lock)", function () {
  this.timeout(300000);
  let reader;
  before(async function () {
    reader = await (await ethers.getContractFactory("StellarLockReader")).deploy(FX.networkId, FX.devFund);
  });

  it("verifyFinality: SHA-256 of the header XDR is the claimed ledger hash; sequence matches", async function () {
    const L = FX.week;
    const r = await reader.verifyFinality(proof(L), claim(L.ledgerHash, L.ledgerSeq));
    expect(r[1]).to.equal(L.ledgerHash);
    expect(r[2]).to.equal(BigInt(L.ledgerSeq));
    await expect(reader.verifyFinality(proof(L), claim(ethers.ZeroHash, L.ledgerSeq))).to.be.revertedWith("VF-XCH-006: ledger hash mismatch");
    await expect(reader.verifyFinality(proof(L), claim(L.ledgerHash, L.ledgerSeq + 1))).to.be.revertedWith("VF-XCH-006: ledger sequence mismatch");
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
    expect(f[5]).to.equal(BigInt(L.closeTime));
    expect(f[6]).to.equal(BigInt(L.maturity));
    expect(f[7].toLowerCase()).to.equal("0x" + pl.subarray(32, 52).toString("hex"));
    expect(await reader.extractAssetId(proof(L))).to.equal(ethers.solidityPackedKeccak256(["string", "string"], ["Stellar", "native-XLM"]));
    console.log("      extractFacts gas:", (await reader.extractFacts.estimateGas(proof(L))).toString());
  });

  it("accepts a real Handshake (1-hour) lock at 5%", async function () {
    const f = await reader.extractFacts(proof(FX.handshake));
    expect(f[4]).to.equal(3600n);
  });

  it("rejects a lock transaction that is in the ledger but failed (txFAILED)", async function () {
    expect(FX.failed.resultCode).to.equal("txFailed");
    await expect(reader.extractFacts(proof(FX.failed))).to.be.revertedWith("VF-XCH-011: transaction not applied successfully in this ledger");
  });

  it("rejects fabricated or edited transaction bytes, result sets and headers", async function () {
    const L = FX.week;
    await expect(reader.extractFacts(proof(L, { txXdr: "0x" + crypto.randomBytes(252).toString("hex") }))).to.be.revertedWith("VF-XCH-011: transaction not applied successfully in this ledger");
    await expect(reader.extractFacts(proof(L, { txXdr: flip(L.tx, 150) }))).to.be.revertedWith("VF-XCH-011: transaction not applied successfully in this ledger");
    await expect(reader.extractFacts(proof(L, { resultSet: flip(L.resultSet, 60) }))).to.be.revertedWith("VF-XCH-011: result set hash");
    await expect(reader.extractFacts(proof(L, { header: flip(L.header, 120) }))).to.be.reverted;
    // a real transaction from another ledger, against this ledger
    await expect(reader.extractFacts(proof(L, { txXdr: FX.handshake.tx }))).to.be.revertedWith("VF-XCH-011: transaction not applied successfully in this ledger");
    // a real, successful transaction of this ledger that is not a lock
    await expect(reader.extractFacts(proof(L, { txXdr: L.noiseTx }))).to.be.revertedWith("VF-XCH-011: memo is not a hash");
  });

  it("rejects an edited payload and a wrong duration", async function () {
    const L = FX.week;
    for (const at of [0, 40, 52]) await expect(reader.extractFacts(proof(L, { payload: flip(L.payload, at) }))).to.be.revertedWith("VF-XCH-011: memo binding");
    await expect(reader.extractFacts(proof(L, { durationSecs: 2592000 }))).to.be.revertedWith("VF-XCH-011: maturity does not match duration");
    await expect(reader.extractFacts(proof(L, { durationSecs: 604801 }))).to.be.revertedWith("VF-XCH-011: duration not permitted");
  });

  it("rejects a real lock whose fee is not 5%, one paying another account, and another network", async function () {
    await expect(reader.extractFacts(proof(FX.wrongFee))).to.be.revertedWith("VF-XCH-011: fee is not 5%");
    await expect(reader.extractFacts(proof(FX.wrongDevFund))).to.be.revertedWith("VF-XCH-011: fee not paid to the Dev Fund");
    const pub = await (await ethers.getContractFactory("StellarLockReader")).deploy(
      ethers.sha256(ethers.toUtf8Bytes("Public Global Stellar Network ; September 2015")), FX.devFund);
    await expect(pub.extractFacts(proof(FX.week))).to.be.revertedWith("VF-XCH-011: transaction not applied successfully in this ledger");
  });
});
