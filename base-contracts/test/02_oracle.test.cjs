const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deploySystem } = require("./00_smoke.test.cjs");

// Helper: sign a price batch exactly as the contract expects.
async function signBatch(verifier, signer, runId, ids, prices, fetchTs) {
  const net = await ethers.provider.getNetwork();
  const digest = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint256", "address", "uint64", "bytes32", "bytes32", "uint64"],
      [
        net.chainId,
        await verifier.getAddress(),
        runId,
        ethers.solidityPackedKeccak256(["bytes32[]"], [ids]),
        ethers.solidityPackedKeccak256(["uint256[]"], [prices]),
        fetchTs,
      ]
    )
  );
  return await signer.signMessage(ethers.getBytes(digest));
}

const ASSET = ethers.keccak256(ethers.toUtf8Bytes("Solana:SOL"));

describe("CL-01 · VF-ORC-007 signed price records", function () {
  it("the arbitrary-issuance parameter no longer exists", async function () {
    const { verifier } = await deploySystem();
    // verifyAndMint previously took a caller-supplied USD value.
    const fn = verifier.interface.getFunction("verifyAndMint");
    expect(fn.inputs.length).to.equal(1);
    expect(fn.inputs[0].name).to.equal("pkg");
  });

  it("recordFeeAndRac no longer accepts a caller USD value", async function () {
    const { verifier } = await deploySystem();
    const fn = verifier.interface.getFunction("recordFeeAndRac");
    expect(fn.inputs.length).to.equal(1);
  });

  it("accepts a batch signed by the price publisher", async function () {
    const { verifier, pricePublisher } = await deploySystem();
    const ts = (await ethers.provider.getBlock("latest")).timestamp;
    const sig = await signBatch(verifier, pricePublisher, 1, [ASSET], [150_000_000n], ts);
    await verifier.submitPriceBatch(1, [ASSET], [150_000_000n], ts, sig);
    const rec = await verifier.priceRecords(ASSET);
    expect(rec.priceUsdMicro).to.equal(150_000_000n);
    expect(rec.available).to.equal(true);
  });

  it("rejects a batch signed by anyone else", async function () {
    const { verifier } = await deploySystem();
    const attacker = (await ethers.getSigners())[1];
    const ts = (await ethers.provider.getBlock("latest")).timestamp;
    const sig = await signBatch(verifier, attacker, 1, [ASSET], [999_000_000n], ts);
    await expect(
      verifier.submitPriceBatch(1, [ASSET], [999_000_000n], ts, sig)
    ).to.be.revertedWith("VF-ORC-007: bad publisher signature");
  });

  it("rejects a tampered price with a valid signature over different data", async function () {
    const { verifier, pricePublisher } = await deploySystem();
    const ts = (await ethers.provider.getBlock("latest")).timestamp;
    const sig = await signBatch(verifier, pricePublisher, 1, [ASSET], [150_000_000n], ts);
    await expect(
      verifier.submitPriceBatch(1, [ASSET], [999_000_000n], ts, sig)
    ).to.be.revertedWith("VF-ORC-007: bad publisher signature");
  });

  it("VF-SEC-005: any address may submit; the submitter gains no authority", async function () {
    const { verifier, pricePublisher } = await deploySystem();
    const stranger = (await ethers.getSigners())[5];
    const ts = (await ethers.provider.getBlock("latest")).timestamp;
    const sig = await signBatch(verifier, pricePublisher, 1, [ASSET], [150_000_000n], ts);
    await verifier.connect(stranger).submitPriceBatch(1, [ASSET], [150_000_000n], ts, sig);
    expect((await verifier.priceRecords(ASSET)).available).to.equal(true);
    // ...and the stranger cannot then configure anything.
    await expect(
      verifier.connect(stranger).registerChainVerifier("base", stranger.address)
    ).to.be.reverted;
  });

  it("VF-ORC-008: a run must be newer than the last accepted run", async function () {
    const { verifier, pricePublisher } = await deploySystem();
    const ts = (await ethers.provider.getBlock("latest")).timestamp;
    const s1 = await signBatch(verifier, pricePublisher, 5, [ASSET], [150_000_000n], ts);
    await verifier.submitPriceBatch(5, [ASSET], [150_000_000n], ts, s1);
    const s2 = await signBatch(verifier, pricePublisher, 4, [ASSET], [1n], ts);
    await expect(
      verifier.submitPriceBatch(4, [ASSET], [1n], ts, s2)
    ).to.be.revertedWith("VF-ORC-008: run not newer");
  });

  it("VF-ORC-005: a zero price marks the asset unavailable rather than substituting one", async function () {
    const { verifier, pricePublisher } = await deploySystem();
    const ts = (await ethers.provider.getBlock("latest")).timestamp;
    const sig = await signBatch(verifier, pricePublisher, 1, [ASSET], [0n], ts);
    await verifier.submitPriceBatch(1, [ASSET], [0n], ts, sig);
    expect((await verifier.priceRecords(ASSET)).available).to.equal(false);
  });

  it("a signature cannot be replayed against a different deployment", async function () {
    const { verifier, pricePublisher, vclm, chonx } = await deploySystem();
    const ts = (await ethers.provider.getBlock("latest")).timestamp;
    const sig = await signBatch(verifier, pricePublisher, 1, [ASSET], [150_000_000n], ts);

    const V = await ethers.getContractFactory("VinculumFinalisVerifier");
    const other = await V.deploy(
      await vclm.getAddress(), await chonx.getAddress(), pricePublisher.address, ts
    );
    await expect(
      other.submitPriceBatch(1, [ASSET], [150_000_000n], ts, sig)
    ).to.be.revertedWith("VF-ORC-007: bad publisher signature");
  });
});

describe("CL-01 · price publisher is immutable", function () {
  it("VF-DEP-002: a zero price publisher cannot be constructed", async function () {
    const { vclm, chonx } = await deploySystem();
    const V = await ethers.getContractFactory("VinculumFinalisVerifier");
    await expect(
      V.deploy(await vclm.getAddress(), await chonx.getAddress(),
               "0x0000000000000000000000000000000000000000", 1)
    ).to.be.revertedWith("VF-DEP-002: zero price publisher");
  });

  it("no function can change the price publisher", async function () {
    const { verifier } = await deploySystem();
    expect(verifier.setPricePublisher).to.equal(undefined);
  });
});

// ---------------------------------------------------------------------------
// CL-39 — a single signed batch must not be able to brick price updates.
// ---------------------------------------------------------------------------
describe("CL-39 · run watermark cannot be pushed beyond recovery", function () {
  const PRICE = 150_000_000n;

  it("rejects a run near the uint64 maximum", async function () {
    const { verifier, pricePublisher } = await deploySystem();
    const ts = (await ethers.provider.getBlock("latest")).timestamp;
    const huge = 18446744073709551615n; // 2^64 - 1
    const sig = await signBatch(verifier, pricePublisher, huge, [ASSET], [PRICE], ts);
    await expect(
      verifier.submitPriceBatch(huge, [ASSET], [PRICE], ts, sig)
    ).to.be.revertedWith("CL-39: run advance too large");
  });

  it("rejects an advance one beyond the permitted window", async function () {
    const { verifier, pricePublisher } = await deploySystem();
    const ts = (await ethers.provider.getBlock("latest")).timestamp;
    const sig = await signBatch(verifier, pricePublisher, 1001n, [ASSET], [PRICE], ts);
    await expect(
      verifier.submitPriceBatch(1001n, [ASSET], [PRICE], ts, sig)
    ).to.be.revertedWith("CL-39: run advance too large");
  });

  it("accepts an advance at the permitted boundary", async function () {
    const { verifier, pricePublisher } = await deploySystem();
    const ts = (await ethers.provider.getBlock("latest")).timestamp;
    const sig = await signBatch(verifier, pricePublisher, 1000n, [ASSET], [PRICE], ts);
    await verifier.submitPriceBatch(1000n, [ASSET], [PRICE], ts, sig);
    expect(await verifier.latestPriceRunId()).to.equal(1000n);
  });

  it("the window advances with the watermark, so long gaps stay recoverable", async function () {
    const { verifier, pricePublisher } = await deploySystem();
    const ts = (await ethers.provider.getBlock("latest")).timestamp;
    const s1 = await signBatch(verifier, pricePublisher, 900n, [ASSET], [PRICE], ts);
    await verifier.submitPriceBatch(900n, [ASSET], [PRICE], ts, s1);
    // 900 + 1000 = 1900 is now reachable, where it was not from zero.
    const s2 = await signBatch(verifier, pricePublisher, 1900n, [ASSET], [PRICE], ts);
    await verifier.submitPriceBatch(1900n, [ASSET], [PRICE], ts, s2);
    expect(await verifier.latestPriceRunId()).to.equal(1900n);
  });

  it("normal consecutive runs are unaffected", async function () {
    const { verifier, pricePublisher } = await deploySystem();
    const ts = (await ethers.provider.getBlock("latest")).timestamp;
    for (const r of [1n, 2n, 3n]) {
      const sig = await signBatch(verifier, pricePublisher, r, [ASSET], [PRICE], ts);
      await verifier.submitPriceBatch(r, [ASSET], [PRICE], ts, sig);
    }
    expect(await verifier.latestPriceRunId()).to.equal(3n);
  });
});

// ---------------------------------------------------------------------------
// CL-37 — 48-hour maximum price record age (Revision 7 decision 2026-08-07).
// Boundary is inclusive: exactly 48h valid, 48h + 1s stale.
// ---------------------------------------------------------------------------
describe("CL-37 · stale price records fail closed", function () {
  const PRICE = 150_000_000n;
  const H48 = 48 * 60 * 60;

  async function withPrice() {
    const s = await deploySystem();
    const ts = (await ethers.provider.getBlock("latest")).timestamp;
    const sig = await signBatch(s.verifier, s.pricePublisher, 1n, [ASSET], [PRICE], ts);
    await s.verifier.submitPriceBatch(1n, [ASSET], [PRICE], ts, sig);
    return s;
  }

  async function advance(sec) {
    await ethers.provider.send("evm_increaseTime", [sec]);
    await ethers.provider.send("evm_mine", []);
  }

  it("a fresh record has a usable valuation", async function () {
    const { verifier } = await withPrice();
    expect(await verifier.hasUsableValuation(ASSET)).to.equal(true);
  });

  it("remains usable just inside 48 hours", async function () {
    const { verifier } = await withPrice();
    await advance(H48 - 60);
    expect(await verifier.hasUsableValuation(ASSET)).to.equal(true);
  });

  it("is no longer usable past 48 hours", async function () {
    const { verifier } = await withPrice();
    await advance(H48 + 60);
    expect(await verifier.hasUsableValuation(ASSET)).to.equal(false);
  });

  it("an unavailable asset is never usable regardless of age", async function () {
    const { verifier, pricePublisher } = await deploySystem();
    const ts = (await ethers.provider.getBlock("latest")).timestamp;
    const sig = await signBatch(verifier, pricePublisher, 1n, [ASSET], [0n], ts);
    await verifier.submitPriceBatch(1n, [ASSET], [0n], ts, sig);
    expect(await verifier.hasUsableValuation(ASSET)).to.equal(false);
  });

  it("an asset never priced has no usable valuation", async function () {
    const { verifier } = await deploySystem();
    const unknown = ethers.keccak256(ethers.toUtf8Bytes("Nowhere:NONE"));
    expect(await verifier.hasUsableValuation(unknown)).to.equal(false);
  });

  it("a new batch restores usability after staleness", async function () {
    const { verifier, pricePublisher } = await withPrice();
    await advance(H48 + 60);
    expect(await verifier.hasUsableValuation(ASSET)).to.equal(false);
    const ts = (await ethers.provider.getBlock("latest")).timestamp;
    const sig = await signBatch(verifier, pricePublisher, 2n, [ASSET], [PRICE], ts);
    await verifier.submitPriceBatch(2n, [ASSET], [PRICE], ts, sig);
    expect(await verifier.hasUsableValuation(ASSET)).to.equal(true);
  });

  it("age is measured from the signed fetch timestamp, not from submission", async function () {
    const { verifier, pricePublisher } = await deploySystem();
    const block = await ethers.provider.getBlock("latest");
    // Publisher signs a price already 47 hours old, then submits it now.
    const oldTs = block.timestamp - (47 * 60 * 60);
    const sig = await signBatch(verifier, pricePublisher, 1n, [ASSET], [PRICE], oldTs);
    await verifier.submitPriceBatch(1n, [ASSET], [PRICE], oldTs, sig);
    expect(await verifier.hasUsableValuation(ASSET)).to.equal(true);
    // Two more hours puts it past 48h even though submission was minutes ago.
    await advance(2 * 60 * 60);
    expect(await verifier.hasUsableValuation(ASSET)).to.equal(false);
  });
});
