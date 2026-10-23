// Solana lock reader, simple bar. TEST ONLY. Two layers:
//  1. Off-chain checker (testing-rigs/solana-reader/checker.cjs) replaying RPC
//     answers recorded from a real lock on a local solana-test-validator and
//     one real finalized Solana mainnet transaction.
//  2. SolanaAttestedLockReader on Hardhat: k-of-n attestation of the checked facts.
// Set SOLANA_LIVE_RPC=http://127.0.0.1:8899 to also check the recorded lock live.
const { expect } = require("chai");
const { ethers } = require("hardhat");
const path = require("path");
const RIG = path.join(__dirname, "../../testing-rigs/solana-reader");
const C = require(path.join(RIG, "checker.cjs"));
const W = require(path.join(RIG, "solanaWire.cjs"));
const A = require(path.join(RIG, "attest.cjs"));
const LOCAL = require(path.join(RIG, "fixtures/local_lock.json"));
const MAIN = require(path.join(RIG, "fixtures/mainnet_token_tx.json"));

const clone = (x) => JSON.parse(JSON.stringify(x));
const rpcOf = (calls, ov) => C.replayRpc(calls, ov);
const txResult = () => clone(LOCAL.calls.find((c) => c.key.startsWith("getTransaction ")).result);
async function rejects(p, code) {
  let err;
  try { await p; } catch (e) { err = e; }
  expect(err, "expected rejection " + code).to.be.instanceOf(C.CheckError);
  expect(err.code).to.equal(code);
}
// A lying RPC: rewrites bytes inside the LockCreated "Program data" log line.
function tamperEvent(tx, fromBuf, toBuf) {
  const disc = W.anchorEvent("LockCreated");
  tx.meta.logMessages = tx.meta.logMessages.map((l) => {
    if (!l.startsWith("Program data: ")) return l;
    const d = Buffer.from(l.slice(14), "base64");
    if (!d.subarray(0, 8).equals(disc)) return l;
    const i = d.indexOf(fromBuf);
    if (i < 0) throw new Error("tamper target not found");
    toBuf.copy(d, i);
    return "Program data: " + d.toString("base64");
  });
  return tx;
}
const u128 = (v) => Buffer.concat([W.u64le(BigInt(v) & ((1n << 64n) - 1n)), W.u64le(BigInt(v) >> 64n)]);

describe("Solana reader: off-chain checker (recorded local lock and mainnet tx)", function () {
  const cfg = LOCAL.cfg; const pkg = LOCAL.pkg;

  it("accepts the real finalized local lock and returns its facts", async function () {
    const f = await C.checkLock(rpcOf(LOCAL.calls), cfg, pkg);
    expect(f.grossAmount).to.equal(2_000_000_000n);
    expect(f.feeAmount).to.equal(100_000_000n);
    expect(f.principalAmount).to.equal(1_900_000_000n);
    expect(f.durationSecs).to.equal(2592000n);
    expect(f.maturity - f.durationSecs).to.equal(f.blockTime);
    expect(f.baseRecipient).to.equal(pkg.baseRecipient);
    expect(f.depositor).to.equal(pkg.depositor);
    expect(f.asset).to.equal("SOL");
    expect(String(f.slot)).to.equal(String(pkg.slot));
  });

  it("live mode (optional): the same lock checks against the running validator", async function () {
    if (!process.env.SOLANA_LIVE_RPC) this.skip();
    const f = await C.checkLock(C.httpRpc(process.env.SOLANA_LIVE_RPC), cfg, pkg);
    expect(f.blockhash).to.equal(pkg.blockhash);
  });

  it("quorum: two agreeing RPCs pass, a disagreeing RPC fails", async function () {
    await C.checkLockQuorum([rpcOf(LOCAL.calls), rpcOf(LOCAL.calls)], cfg, pkg);
    // Disagreement in the facts themselves: block time differs.
    const blk = clone(LOCAL.calls.find((c) => c.key.startsWith("getBlock ")).result); blk.blockTime += 1;
    await rejects(C.checkLockQuorum([rpcOf(LOCAL.calls), rpcOf(LOCAL.calls, { getBlock: blk })], cfg, pkg), "SOL-TIME");
  });

  it("rejects a forged signature (unknown signature, and a lying RPC with altered signature bytes)", async function () {
    const forged = W.b58(Buffer.alloc(64, 7));
    await rejects(C.checkLock(rpcOf(LOCAL.calls), cfg, { ...pkg, signature: forged }), "SOL-NOT-FINALIZED");
    const tx = txResult();
    const wire = Buffer.from(tx.transaction[0], "base64"); wire[5] ^= 1; tx.transaction[0] = wire.toString("base64");
    const sig2 = W.b58(wire.subarray(1, 65));
    const block = clone(LOCAL.calls.find((c) => c.key.startsWith("getBlock ")).result); block.signatures.push(sig2);
    const st = clone(LOCAL.calls.find((c) => c.key.startsWith("getSignatureStatuses ")).result);
    await rejects(C.checkLock(rpcOf(LOCAL.calls, { getTransaction: tx, getBlock: block, getSignatureStatuses: st }), cfg, { ...pkg, signature: sig2 }), "SOL-SIG-INVALID");
    // Lying RPC rewrites the signed instruction amount: signature no longer verifies.
    const tx3 = txResult(); const w3 = Buffer.from(tx3.transaction[0], "base64");
    const at = w3.indexOf(u128(2_000_000_000n), 65); w3[at] ^= 1; tx3.transaction[0] = w3.toString("base64");
    await rejects(C.checkLock(rpcOf(LOCAL.calls, { getTransaction: tx3 }), cfg, pkg), "SOL-SIG-INVALID");
  });

  it("rejects a wrong program (other expected program, a plain transfer, a real mainnet token tx)", async function () {
    const other = W.b58(Buffer.alloc(32, 9));
    await rejects(C.checkLock(rpcOf(LOCAL.calls), { ...cfg, programId: other }, { ...pkg, programId: other }), "SOL-PROGRAM");
    await rejects(C.checkLock(rpcOf(LOCAL.transfer.calls), cfg, LOCAL.transfer.pkg), "SOL-PROGRAM");
    await rejects(C.checkLock(rpcOf(MAIN.calls), { expectedGenesisHash: C.MAINNET_GENESIS, programId: MAIN.pkg.programId }, MAIN.pkg), "SOL-PROGRAM");
    await rejects(C.checkLock(rpcOf(LOCAL.calls), cfg, { ...pkg, programId: other }), "SOL-PROGRAM");
  });

  it("rejects an altered amount (package claim, and a lying RPC rewriting the event)", async function () {
    await rejects(C.checkLock(rpcOf(LOCAL.calls), cfg, { ...pkg, grossAmount: "2000000001" }), "SOL-PKG-GROSSAMOUNT");
    const tx = tamperEvent(txResult(), u128(2_000_000_000n), u128(3_000_000_000n));
    await rejects(C.checkLock(rpcOf(LOCAL.calls, { getTransaction: tx }), cfg, pkg), "SOL-EVENT-IX");
  });

  it("rejects an altered recipient (package claim, and a lying RPC rewriting the event)", async function () {
    const r2 = "0x" + "11".repeat(20);
    await rejects(C.checkLock(rpcOf(LOCAL.calls), cfg, { ...pkg, baseRecipient: r2 }), "SOL-PKG-BASERECIPIENT");
    const tx = tamperEvent(txResult(), Buffer.from(pkg.baseRecipient.slice(2), "hex"), Buffer.from(r2.slice(2), "hex"));
    await rejects(C.checkLock(rpcOf(LOCAL.calls, { getTransaction: tx }), cfg, pkg), "SOL-EVENT-IX");
  });

  it("rejects a wrong slot or a wrong blockhash", async function () {
    await rejects(C.checkLock(rpcOf(LOCAL.calls), cfg, { ...pkg, slot: pkg.slot + 1 }), "SOL-SLOT");
    await rejects(C.checkLock(rpcOf(LOCAL.calls), cfg, { ...pkg, blockhash: W.b58(Buffer.alloc(32, 3)) }), "SOL-BLOCKHASH");
  });

  it("rejects a non-finalized tx (recorded while only confirmed, and a non-finalized status)", async function () {
    expect(LOCAL.earlyCalls[0].result).to.equal(null);
    expect(LOCAL.confirmedTx).to.not.equal(null);
    await rejects(C.checkLock(rpcOf(LOCAL.earlyCalls, { getGenesisHash: cfg.expectedGenesisHash }), cfg, pkg), "SOL-NOT-FINALIZED");
    const st = clone(LOCAL.calls.find((c) => c.key.startsWith("getSignatureStatuses ")).result);
    st.value[0].confirmationStatus = "confirmed";
    await rejects(C.checkLock(rpcOf(LOCAL.calls, { getSignatureStatuses: st }), cfg, pkg), "SOL-STATUS");
    await rejects(C.checkLock(rpcOf(LOCAL.calls, { getBlock: null }), cfg, pkg), "SOL-BLOCK-NOT-FINALIZED");
  });

  it("rejects a tx from another cluster (local lock vs mainnet, real mainnet tx vs local)", async function () {
    await rejects(C.checkLock(rpcOf(LOCAL.calls), { ...cfg, expectedGenesisHash: C.MAINNET_GENESIS }, pkg), "SOL-CLUSTER");
    await rejects(C.checkLock(rpcOf(MAIN.calls), { expectedGenesisHash: cfg.expectedGenesisHash, programId: MAIN.pkg.programId }, MAIN.pkg), "SOL-CLUSTER");
    expect(MAIN.vaultProgramOnMainnet).to.equal(false);
  });
});

describe("Solana reader: SolanaAttestedLockReader (test only, k-of-n attestation)", function () {
  let reader, attesters, outsider, proof, lock, chainId;
  const cfg = LOCAL.cfg;
  before(async function () {
    attesters = [0, 1, 2].map(() => ethers.Wallet.createRandom()); // TEST ONLY, never saved
    outsider = ethers.Wallet.createRandom();
    reader = await (await ethers.getContractFactory("SolanaAttestedLockReader")).deploy(
      A.hex32(cfg.expectedGenesisHash), A.hex32(cfg.programId), attesters.map((w) => w.address), 2);
    chainId = (await ethers.provider.getNetwork()).chainId;
    const facts = await C.checkLock(rpcOf(LOCAL.calls), cfg, LOCAL.pkg);
    lock = A.lockStruct(facts);
    proof = A.encodeLock(lock);
  });
  const sign = async (ws, p = proof, r) => A.attest(ws, A.digest(chainId, r || (await reader.getAddress()), cfg.expectedGenesisHash, cfg.programId, p));

  it("accepts the real lock with 2 of 3 attesters and returns its facts", async function () {
    const fin = await reader.verifyFinality(proof, await sign(attesters.slice(0, 2)));
    expect(fin[0]).to.equal(true);
    expect(fin[1]).to.equal(lock.blockhash);
    expect(fin[2]).to.equal(lock.slot);
    const f = await reader.extractFacts(proof);
    expect(f.lockId).to.equal(LOCAL.facts.lockIdHash);
    expect(f.grossAmount).to.equal(2_000_000_000n);
    expect(f.feeAmount).to.equal(100_000_000n);
    expect(f.principalAmount).to.equal(1_900_000_000n);
    expect(f.creationTimestamp).to.equal(lock.blockTime);
    expect(f.baseRecipient).to.equal(lock.baseRecipient);
    expect(await reader.extractAssetId(proof)).to.equal(ethers.keccak256(ethers.solidityPacked(["string", "string"], ["Solana", "native-SOL"])));
    expect(await reader.attestationDigest(proof)).to.equal(ethers.hashMessage(ethers.getBytes(A.digest(chainId, await reader.getAddress(), cfg.expectedGenesisHash, cfg.programId, proof))));
  });

  it("rejects a forged attestation, too few, or a repeated attester", async function () {
    await expect(reader.verifyFinality(proof, await sign([attesters[0], outsider]))).to.be.revertedWith("SAR: not an attester");
    await expect(reader.verifyFinality(proof, await sign([attesters[0]]))).to.be.revertedWith("SAR: below threshold");
    const one = ethers.AbiCoder.defaultAbiCoder().decode(["bytes[]"], await sign([attesters[0]]))[0][0];
    await expect(reader.verifyFinality(proof, ethers.AbiCoder.defaultAbiCoder().encode(["bytes[]"], [[one, one]]))).to.be.revertedWith("SAR: signers not strictly ascending");
  });

  it("rejects an altered amount or recipient after attestation", async function () {
    const att = await sign(attesters);
    const p1 = A.encodeLock({ ...lock, grossAmount: lock.grossAmount * 2n, feeAmount: lock.feeAmount * 2n, principalAmount: lock.principalAmount * 2n });
    await expect(reader.verifyFinality(p1, att)).to.be.revertedWith("SAR: not an attester");
    const p2 = A.encodeLock({ ...lock, baseRecipient: "0x" + "11".repeat(20) });
    await expect(reader.verifyFinality(p2, att)).to.be.revertedWith("SAR: not an attester");
    // Even if attested, a wrong fee or principal is refused on-chain.
    const bad = A.encodeLock({ ...lock, feeAmount: lock.feeAmount - 1n, principalAmount: lock.principalAmount + 1n });
    await expect(reader.verifyFinality(bad, await sign(attesters, bad))).to.be.revertedWith("SAR: fee");
  });

  it("rejects a wrong slot or blockhash after attestation", async function () {
    const att = await sign(attesters);
    await expect(reader.verifyFinality(A.encodeLock({ ...lock, slot: lock.slot + 1n }), att)).to.be.revertedWith("SAR: not an attester");
    await expect(reader.verifyFinality(A.encodeLock({ ...lock, blockhash: ethers.ZeroHash }), att)).to.be.revertedWith("SAR: not an attester");
  });

  it("rejects an attestation for another cluster, another program or another reader", async function () {
    const inner = (g, p) => A.digest(chainId, reader.target, g, p, proof);
    const mainnetAtt = await A.attest(attesters, inner(C.MAINNET_GENESIS, cfg.programId));
    await expect(reader.verifyFinality(proof, mainnetAtt)).to.be.revertedWith("SAR: not an attester");
    const progAtt = await A.attest(attesters, inner(cfg.expectedGenesisHash, W.b58(Buffer.alloc(32, 9))));
    await expect(reader.verifyFinality(proof, progAtt)).to.be.revertedWith("SAR: not an attester");
    const r2 = await (await ethers.getContractFactory("SolanaAttestedLockReader")).deploy(
      A.hex32(cfg.expectedGenesisHash), A.hex32(cfg.programId), attesters.map((w) => w.address), 2);
    await expect(r2.verifyFinality(proof, await sign(attesters))).to.be.revertedWith("SAR: not an attester");
  });

  it("rejects a duration outside the table and a wrong maturity", async function () {
    const d = A.encodeLock({ ...lock, durationSecs: 2592001n, maturityTimestamp: lock.blockTime + 2592001n });
    await expect(reader.extractFacts(d)).to.be.revertedWith("SAR: duration");
    const m = A.encodeLock({ ...lock, maturityTimestamp: lock.maturityTimestamp + 1n });
    await expect(reader.extractFacts(m)).to.be.revertedWith("SAR: maturity");
  });
});
