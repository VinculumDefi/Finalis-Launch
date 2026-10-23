// End to end: the PRODUCTION AvalancheLockReader against a REAL CommitmentVaultLock
// lock made on a LOCAL avalanchego network (official release, C-Chain), with a
// genuine Avalanche-format header that settles the lock's block.
// Fixture: non-evm-locks/avalanche/local_lock_fixture.cjs -> test/fixtures/avalanche_local_lock.json
const { expect } = require("chai");
const { ethers } = require("hardhat");
const fx = require("./fixtures/avalanche_local_lock.json");

const coder = ethers.AbiCoder.defaultAbiCoder();
const EVIDENCE = "tuple(tuple(bytes headerRlp, bytes receipt, uint256 receiptIndex, bytes[] receiptNodes, uint256 logIndex, bytes[] accountNodes, bytes[] envSlotNodes, bytes[] recipientSlotNodes) base, bytes[] createdAtSlotNodes)";
const AVAX_ID = ethers.solidityPackedKeccak256(["string", "string"], ["Avalanche", "native-AVAX"]);
function encode(e) {
  return coder.encode([EVIDENCE], [[[e.headerRlp, e.receipt, e.receiptIndex, e.receiptNodes, e.logIndex, e.accountNodes, e.envSlotNodes, e.recipientSlotNodes], e.createdAtSlotNodes]]);
}
function flip(hex, at) { const b = ethers.getBytes(hex); b[at] ^= 1; return ethers.hexlify(b); }
const claim = (c, h, n) => coder.encode(["uint256", "bytes32", "uint256"], [c, h, n]);

describe("AvalancheLockReader (production) against a real local Avalanche lock", function () {
  let reader;
  before(async () => {
    reader = await (await ethers.getContractFactory("AvalancheLockReader")).deploy(fx.lock);
  });

  it("the fixture is a local network lock settled by a later genuine Avalanche header", async () => {
    expect(fx.localChainId).to.not.equal(43114);
    expect(fx.settledHeight).to.equal(fx.lockBlock);
    expect(fx.settlingBlock).to.be.greaterThan(fx.lockBlock);
    expect(ethers.keccak256(fx.evidence.headerRlp)).to.equal(fx.settlingHash);
    expect(fx.headerFieldCount).to.be.at.least(16);
  });

  it("verifyFinality refuses (AG-01, no settled-history anchor); headerClaimMatches binds the settling header", async () => {
    await expect(reader.verifyFinality(encode(fx.evidence), claim(43114, fx.settlingHash, fx.settlingBlock)))
      .to.be.revertedWith("VF-XCH-006: Avalanche settled-history anchor not enforced on-chain; environment disabled");
    const r = await reader.headerClaimMatches(encode(fx.evidence), claim(43114, fx.settlingHash, fx.settlingBlock));
    expect(r[0]).to.equal(fx.settlingHash);
    expect(r[1]).to.equal(BigInt(fx.settlingBlock));
  });

  it("extractFacts proves the lock: id, amounts, 5% fee, 7-day duration, recipient, output token", async () => {
    const f = await reader.extractFacts(encode(fx.evidence));
    const gross = BigInt(fx.gross);
    expect(f[0]).to.equal(fx.lockId);
    expect(f[1]).to.equal(gross);
    expect(f[2]).to.equal((gross * 500n) / 10000n);
    expect(f[3]).to.equal(gross - (gross * 500n) / 10000n);
    expect(f[4]).to.equal(604800n);
    expect(f[7]).to.equal(fx.recipient);
    expect(f[8]).to.equal(1n);
    expect(await reader.extractAssetId(encode(fx.evidence))).to.equal(AVAX_ID);
  });

  it("rejects a tampered header, receipt, storage proof, or a reader bound to another lock", async () => {
    const e = fx.evidence;
    await expect(reader.headerClaimMatches(encode(e), claim(43114, fx.settlingHash, fx.lockBlock))).to.be.reverted;
    await expect(reader.headerClaimMatches(encode(e), claim(1, fx.settlingHash, fx.settlingBlock))).to.be.revertedWith("VF-XCH-006: wrong chain");
    // Any changed header byte breaks the hash the finality claim names.
    await expect(reader.headerClaimMatches(encode({ ...e, headerRlp: flip(e.headerRlp, 200) }), claim(43114, fx.settlingHash, fx.settlingBlock)))
      .to.be.revertedWith("VF-XCH-006: block hash mismatch");
    // A changed stateRoot byte (header offset 100) breaks the storage proofs.
    await expect(reader.extractFacts(encode({ ...e, headerRlp: flip(e.headerRlp, 100) }))).to.be.reverted;
    await expect(reader.extractFacts(encode({ ...e, receipt: flip(e.receipt, e.receipt.length / 2 - 40) }))).to.be.reverted;
    const n = [...e.createdAtSlotNodes]; n[0] = flip(n[0], 5);
    await expect(reader.extractFacts(encode({ ...e, createdAtSlotNodes: n }))).to.be.reverted;
    await expect(reader.extractFacts(encode({ ...e, createdAtSlotNodes: [] }))).to.be.reverted;
    const other = await (await ethers.getContractFactory("AvalancheLockReader")).deploy(ethers.Wallet.createRandom().address);
    await expect(other.extractFacts(encode(e))).to.be.reverted;
  });
});
