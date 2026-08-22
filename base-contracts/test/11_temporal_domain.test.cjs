const { expect } = require("chai");
const { ethers } = require("hardhat");

// ---------------------------------------------------------------------------
// Implementation-domain narrowing audit — uint64 temporal and counter fields.
//
// Representational range is not the concern: uint64 seconds runs to year
// ~584 billion. The question is whether the contract enforces a legitimate
// RELATIONSHIP between fetchTimestamp and block.timestamp in BOTH directions,
// and whether runId can wrap or be reused.
// ---------------------------------------------------------------------------

const ASSET = ethers.keccak256(ethers.toUtf8Bytes("Solana:SOL"));
const PRICE = 150_000_000n;

async function signBatch(v, s, runId, ids, prices, ts) {
  const net = await ethers.provider.getNetwork();
  const d = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
    ["uint256", "address", "uint64", "bytes32", "bytes32", "uint64"],
    [net.chainId, await v.getAddress(), runId,
     ethers.solidityPackedKeccak256(["bytes32[]"], [ids]),
     ethers.solidityPackedKeccak256(["uint256[]"], [prices]), ts]));
  return await s.signMessage(ethers.getBytes(d));
}

async function fresh() {
  const sg = await ethers.getSigners();
  const T = await ethers.getContractFactory("VinculumFinalisToken");
  const a = await T.deploy("A", "A", 10n ** 30n);
  const b = await T.deploy("B", "B", 10n ** 30n);
  const ts = (await ethers.provider.getBlock("latest")).timestamp;
  const V = await ethers.getContractFactory("VinculumFinalisVerifier");
  const __cap = await (await ethers.getContractFactory("VinculumFinalisCap")).deploy(10_000_000_000n * 10n ** 18n, 100_000_000_000n * 10n ** 18n);
  const v = await V.deploy(await a.getAddress(), await b.getAddress(), sg[9].address, ts, await __cap.getAddress());
  return { v, pub: sg[9] };
}

describe("CL-48 · fetchTimestamp is bounded in both temporal directions", function () {
  it("BACKWARD: a record older than 48 hours is not usable (CL-37)", async function () {
    const { v, pub } = await fresh();
    const now = (await ethers.provider.getBlock("latest")).timestamp;
    const old = now - (49 * 3600);
    await v.submitPriceBatch(1n, [ASSET], [PRICE], old, await signBatch(v, pub, 1n, [ASSET], [PRICE], old));
    expect(await v.hasUsableValuation(ASSET)).to.equal(false);
  });

  it("FORWARD: a future fetchTimestamp is rejected at submission", async function () {
    const { v, pub } = await fresh();
    const now = (await ethers.provider.getBlock("latest")).timestamp;
    for (const ahead of [60, 3600, 48 * 3600, 365 * 24 * 3600]) {
      const future = now + ahead;
      await expect(
        v.submitPriceBatch(1n, [ASSET], [PRICE], future, await signBatch(v, pub, 1n, [ASSET], [PRICE], future))
      ).to.be.revertedWith("VF-ORC: future fetch timestamp");
    }
  });

  it("a future timestamp cannot extend the freshness window, because it cannot be stored", async function () {
    const { v, pub } = await fresh();
    const now = (await ethers.provider.getBlock("latest")).timestamp;
    // An attacker's goal would be a record that stays fresh far longer than
    // 48 hours. Rejection at intake makes that unreachable.
    const far = now + (30 * 24 * 3600);
    await expect(
      v.submitPriceBatch(1n, [ASSET], [PRICE], far, await signBatch(v, pub, 1n, [ASSET], [PRICE], far))
    ).to.be.reverted;
    expect(await v.hasUsableValuation(ASSET)).to.equal(false);   // nothing was stored
    expect(await v.latestPriceRunId()).to.equal(0n);
  });

  it("a fetchTimestamp equal to the current block is accepted", async function () {
    const { v, pub } = await fresh();
    const now = (await ethers.provider.getBlock("latest")).timestamp;
    await v.submitPriceBatch(1n, [ASSET], [PRICE], now, await signBatch(v, pub, 1n, [ASSET], [PRICE], now));
    expect(await v.hasUsableValuation(ASSET)).to.equal(true);
  });
});

describe("CL-49 · runId cannot wrap, skip beyond recovery, or be reused", function () {
  it("the maximum permitted advance succeeds", async function () {
    const { v, pub } = await fresh();
    const ts = (await ethers.provider.getBlock("latest")).timestamp;
    await v.submitPriceBatch(1000n, [ASSET], [PRICE], ts, await signBatch(v, pub, 1000n, [ASSET], [PRICE], ts));
    expect(await v.latestPriceRunId()).to.equal(1000n);
  });

  it("one beyond the permitted advance is rejected", async function () {
    const { v, pub } = await fresh();
    const ts = (await ethers.provider.getBlock("latest")).timestamp;
    await expect(
      v.submitPriceBatch(1001n, [ASSET], [PRICE], ts, await signBatch(v, pub, 1001n, [ASSET], [PRICE], ts))
    ).to.be.revertedWith("CL-39: run advance too large");
  });

  it("a run id cannot be reused, so no batch can be replayed", async function () {
    const { v, pub } = await fresh();
    const ts = (await ethers.provider.getBlock("latest")).timestamp;
    const sig = await signBatch(v, pub, 5n, [ASSET], [PRICE], ts);
    await v.submitPriceBatch(5n, [ASSET], [PRICE], ts, sig);
    // The identical signed batch, replayed verbatim.
    await expect(
      v.submitPriceBatch(5n, [ASSET], [PRICE], ts, sig)
    ).to.be.revertedWith("VF-ORC-008: run not newer");
  });

  it("no earlier run id can be accepted after a later one", async function () {
    const { v, pub } = await fresh();
    const ts = (await ethers.provider.getBlock("latest")).timestamp;
    await v.submitPriceBatch(10n, [ASSET], [PRICE], ts, await signBatch(v, pub, 10n, [ASSET], [PRICE], ts));
    for (const earlier of [0n, 1n, 9n, 10n]) {
      await expect(
        v.submitPriceBatch(earlier, [ASSET], [PRICE], ts, await signBatch(v, pub, earlier, [ASSET], [PRICE], ts))
      ).to.be.revertedWith("VF-ORC-008: run not newer");
    }
  });
});
