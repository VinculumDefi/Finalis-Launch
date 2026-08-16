// =============================================================================
// UtxoChainVerifier — SPV-backed finality tests
//
// The verifier no longer decodes a confirmation count from the caller. It
// verifies a Merkle inclusion proof against a header the SPV chain accepted
// under proof of work, and reads depth from that chain's own state.
//
// Weighted negative per Verifier Completion Standard 5.2.
// =============================================================================

const { expect } = require("chai");
const { ethers } = require("hardhat");

const ZERO = "0x0000000000000000000000000000000000000000";

// Real Bitcoin mainnet headers, verified byte-for-byte against their hashes.
const H0 =
  "01000000" +
  "0000000000000000000000000000000000000000000000000000000000000000" +
  "3ba3edfd7a7b12b27ac72c3e67768f617fc81bc3888a51323a9fb8aa4b1e5e4a" +
  "29ab5f49" + "ffff001d" + "1dac2b7c";

const H1 =
  "01000000" +
  "6fe28c0ab6f1b372c1a6a246ae63f74f931e8365e15a089c68d6190000000000" +
  "982051fd1e4ba744bbbe680e1fee14677ba1a3c3540bf7b1cdb606e857233e0e" +
  "61bc6649" + "ffff001d" + "01e36299";

const H2 =
  "01000000" +
  "4860eb18bf1b1620e37e9490fc8a427514416fd75159ab86688e9a8300000000" +
  "d5fdcc541e25de1c7a5addedf24858b8bb665c9f36ef744ee42c316022c90f9b" +
  "b0bc6649" + "ffff001d" + "08d2bd61";

function blockHash(hex) {
  return ethers.sha256(ethers.sha256(ethers.getBytes("0x" + hex)));
}

// Block 1 has one transaction, so its merkle root is that txid.
const TXID_B1 = "0x" + H1.slice(72, 136);

function finalityProof(txid, blockHashValue, proof, index) {
  return ethers.AbiCoder.defaultAbiCoder().encode(
    ["bytes32", "bytes32", "bytes32[]", "uint256"],
    [txid, blockHashValue, proof, index]
  );
}

// Deploys the header chain at genesis, syncs to the requested height, and
// returns a verifier requiring `minConf` confirmations.
async function deploy(minConf = 1) {
  const HC = await ethers.getContractFactory("Sha256dHeaderChain");
  const chain = await HC.deploy(blockHash(H0), 0, 0x1d00ffff, 0x495fab29);
  await chain.submitHeaders("0x" + H1 + H2);

  const V = await ethers.getContractFactory("UtxoChainVerifier");
  const verifier = await V.deploy("bitcoin", minConf, await chain.getAddress());

  return { chain, verifier };
}

describe("UtxoChainVerifier — SPV-backed finality", function () {

  it("verifies a transaction included in a proof-of-work-validated block", async function () {
    const { verifier } = await deploy(1);
    const proof = finalityProof(TXID_B1, blockHash(H1), [], 0);

    const [finalized, hash, depth] = await verifier.verifyFinality("0x", proof);
    expect(finalized).to.equal(true);
    expect(hash).to.equal(blockHash(H1));
    expect(depth).to.equal(2n);        // block 1, tip at block 2
  });

  it("rejects a block the header chain has never seen", async function () {
    const { verifier } = await deploy(1);
    const unknown = ethers.keccak256(ethers.toUtf8Bytes("not-a-real-block"));
    const proof = finalityProof(TXID_B1, unknown, [], 0);

    await expect(verifier.verifyFinality("0x", proof))
      .to.be.revertedWithCustomError(verifier, "HeaderNotKnown");
  });

  it("rejects a transaction that is not in the block", async function () {
    const { verifier } = await deploy(1);
    const bogusTx = ethers.keccak256(ethers.toUtf8Bytes("never-happened"));
    const proof = finalityProof(bogusTx, blockHash(H1), [], 0);

    await expect(verifier.verifyFinality("0x", proof))
      .to.be.revertedWithCustomError(verifier, "TxNotInBlock");
  });

  it("rejects a valid transaction paired with the wrong block", async function () {
    const { verifier } = await deploy(1);
    // Block 1's txid, claimed to be in block 2.
    const proof = finalityProof(TXID_B1, blockHash(H2), [], 0);

    await expect(verifier.verifyFinality("0x", proof))
      .to.be.revertedWithCustomError(verifier, "TxNotInBlock");
  });

  it("rejects insufficient confirmation depth", async function () {
    const { verifier } = await deploy(10);   // demands 10, chain has 3 blocks
    const proof = finalityProof(TXID_B1, blockHash(H1), [], 0);

    await expect(verifier.verifyFinality("0x", proof))
      .to.be.revertedWithCustomError(verifier, "InsufficientConfirmations");
  });

  it("reads depth from the header chain, not from the caller", async function () {
    const { chain, verifier } = await deploy(3);
    const proof = finalityProof(TXID_B1, blockHash(H1), [], 0);

    // Depth is 2 and the requirement is 3: no encoding the caller controls
    // can change that, because the count is never read from the proof.
    await expect(verifier.verifyFinality("0x", proof))
      .to.be.revertedWithCustomError(verifier, "InsufficientConfirmations");

    // The only way to satisfy it is genuine additional proof of work.
    expect(await chain.bestHeight()).to.equal(2n);
  });

  it("isFinal reports without reverting", async function () {
    const { verifier } = await deploy(1);
    expect(await verifier.isFinal(TXID_B1, blockHash(H1), [], 0)).to.equal(true);

    const unknown = ethers.keccak256(ethers.toUtf8Bytes("nope"));
    expect(await verifier.isFinal(TXID_B1, unknown, [], 0)).to.equal(false);
  });
});

describe("UtxoChainVerifier — extractFacts is blocked by CL-27", function () {

  it("fails closed rather than returning caller-decoded values", async function () {
    const { verifier } = await deploy(1);
    const lockProof = ethers.AbiCoder.defaultAbiCoder().encode(
      ["bytes32", "uint256", "uint256", "uint256", "uint256", "uint256", "uint256"],
      [ethers.ZeroHash, 1n, 1n, 1n, 1n, 1n, 1n]
    );

    // Returning the caller's own numbers here would reintroduce CL-76 through
    // the other half of the interface.
    await expect(verifier.extractFacts(lockProof))
      .to.be.revertedWithCustomError(verifier, "VerifierNotImplemented");
  });
});

describe("UtxoChainVerifier — construction", function () {

  it("refuses a zero header chain address", async function () {
    const V = await ethers.getContractFactory("UtxoChainVerifier");
    await expect(V.deploy("bitcoin", 6, ZERO))
      .to.be.revertedWithCustomError(V, "ZeroAddress");
  });

  it("binds the header chain immutably and exposes no setter", async function () {
    const { chain, verifier } = await deploy(6);
    expect(await verifier.headerChain()).to.equal(await chain.getAddress());
    expect(await verifier.minConfirmations()).to.equal(6n);
    expect(verifier.interface.fragments.filter(
      f => f.type === "function" && /^set/i.test(f.name)
    ).length).to.equal(0);
  });
});
