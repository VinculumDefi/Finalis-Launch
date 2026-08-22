// =============================================================================
// CL-84 · BASE-CAP owns lifetime issuance accounting
//
// Establishes the invariant Rev 6 §13.1 defines and the Requirement
// Traceability Matrix assigns to BASE-CAP:
//
//     Remaining lifetime capacity = hard cap − cumulative lifetime issuance
//
// The defect: epoch rewards read remaining capacity and minted against it, but
// nothing incremented the counter. Every epoch measured an unchanged number.
//
// These assertions fail if that behaviour returns.
// =============================================================================

const { expect } = require("chai");
const { ethers } = require("hardhat");

const VCLM_CAP  = 10_000_000_000n * 10n ** 18n;
const CHONX_CAP = 100_000_000_000n * 10n ** 18n;
const ZERO = "0x0000000000000000000000000000000000000000";

async function deployCap() {
  const C = await ethers.getContractFactory("VinculumFinalisCap");
  return await C.deploy(VCLM_CAP, CHONX_CAP);
}

describe("CL-84 · BASE-CAP monotonicity (VF-SUP-003)", function () {

  it("exposes the full hard cap before any issuance", async function () {
    const cap = await deployCap();
    expect(await cap.cumulativeVclmIssued()).to.equal(0n);
    expect(await cap.remainingVclmCapacity()).to.equal(VCLM_CAP);
  });

  it("consumes capacity permanently — there is no path that restores it",
    async function () {
      const cap = await deployCap();
      const [a, b] = await ethers.getSigners();
      await cap.initialize(a.address, b.address);

      await cap.connect(a).recordVclmIssuance(1000n);
      expect(await cap.cumulativeVclmIssued()).to.equal(1000n);
      expect(await cap.remainingVclmCapacity()).to.equal(VCLM_CAP - 1000n);

      // VF-SUP-003: no burn path, no decrement, no setter. The ABI itself is
      // the guarantee — capacity cannot be restored by any route.
      const names = cap.interface.fragments
        .filter(f => f.type === "function")
        .map(f => f.name);
      expect(names.some(n => /burn|decrease|reduce|reset|restore|set/i.test(n)))
        .to.equal(false);
    });

  it("rejects issuance beyond remaining capacity in full (VF-SUP-005)",
    async function () {
      const cap = await deployCap();
      const [a, b] = await ethers.getSigners();
      await cap.initialize(a.address, b.address);

      await expect(cap.connect(a).recordVclmIssuance(VCLM_CAP + 1n))
        .to.be.revertedWithCustomError(cap, "ExceedsVclmCap");

      // Rejected in full: nothing partial was recorded.
      expect(await cap.cumulativeVclmIssued()).to.equal(0n);
    });

  it("accepts only registered recorders (VF-SUP-013)", async function () {
    const cap = await deployCap();
    const signers = await ethers.getSigners();
    await cap.initialize(signers[0].address, signers[1].address);

    await expect(cap.connect(signers[5]).recordVclmIssuance(1n))
      .to.be.revertedWithCustomError(cap, "NotAuthorized");
  });

  it("closes registration permanently at initialization", async function () {
    const cap = await deployCap();
    const [a, b, c] = await ethers.getSigners();
    await cap.initialize(a.address, b.address);

    await expect(cap.initialize(a.address, c.address))
      .to.be.revertedWithCustomError(cap, "AlreadyInitialized");
    expect(await cap.deployer()).to.equal(ZERO);
  });

  it("refuses identical recorders", async function () {
    const cap = await deployCap();
    const [a] = await ethers.getSigners();
    await expect(cap.initialize(a.address, a.address))
      .to.be.revertedWithCustomError(cap, "RecordersIdentical");
  });
});

describe("CL-84 · both issuance paths draw the same cap (VF-SUP-002)",
  function () {

  it("vault issuance and stake rewards decrement one shared figure",
    async function () {
      const cap = await deployCap();
      const [verifierSim, stakeSim] = await ethers.getSigners();
      await cap.initialize(verifierSim.address, stakeSim.address);

      // Commitment Vault issuance.
      await cap.connect(verifierSim).recordVclmIssuance(400n);
      // Treasury Reward Stake rewards — the path that previously consumed
      // nothing. VF-SUP-002: both draw from the same VCLM lifetime hard cap.
      await cap.connect(stakeSim).recordVclmIssuance(600n);

      expect(await cap.cumulativeVclmIssued()).to.equal(1000n);
      expect(await cap.remainingVclmCapacity()).to.equal(VCLM_CAP - 1000n);
    });

  it("VCLM and CHONX capacity are tracked separately", async function () {
    const cap = await deployCap();
    const [a, b] = await ethers.getSigners();
    await cap.initialize(a.address, b.address);

    await cap.connect(a).recordVclmIssuance(500n);
    await cap.connect(a).recordChonxIssuance(700n);

    expect(await cap.cumulativeVclmIssued()).to.equal(500n);
    expect(await cap.cumulativeChonxIssued()).to.equal(700n);
    expect(await cap.remainingChonxCapacity()).to.equal(CHONX_CAP - 700n);
  });

  it("a preflight check reserves nothing", async function () {
    const cap = await deployCap();
    const [a, b] = await ethers.getSigners();
    await cap.initialize(a.address, b.address);

    expect(await cap.vclmIssuanceFits(VCLM_CAP)).to.equal(true);
    expect(await cap.vclmIssuanceFits(VCLM_CAP + 1n)).to.equal(false);
    expect(await cap.cumulativeVclmIssued()).to.equal(0n);
  });
});
