const { expect } = require("chai");
const { ethers } = require("hardhat");
const { rows, handshakeAllowance } = require("../deployment/representativeBase.cjs");
const { deploySystem, VCLM_HARD_CAP, CHONX_HARD_CAP, SYNTH_HARD_CAP } = require("./00_smoke.test.cjs");

const USD = 10n ** 18n;
const SCALE = USD;
const SURVIVAL = SCALE - 16670000000000000n;
const HOUR = 3600n;
const SEVEN_DAYS = 7n * 86400n;
const EIGHT_DAYS = 8n * 86400n;

const COMMITMENT = [
  [3600n, 10000n],
  [604800n, 10000n],
  [2592000n, 11500n],
  [5184000n, 13000n],
  [7776000n, 15000n],
  [15552000n, 20000n],
  [31536000n, 25000n],
  [63072000n, 38000n],
  [94608000n, 50000n],
  [126144000n, 57500n],
  [157680000n, 65000n],
  [189216000n, 68000n],
  [220752000n, 71000n],
  [252288000n, 74000n],
  [283824000n, 77000n],
  [315360000n, 80000n],
];

describe("representative deployment destinations", function () {
  it("lists the sixteen environments and derives the handshake allowance", function () {
    expect(rows).to.have.length(16);
    const names = rows.map((row) => row.environment);
    expect(names).to.deep.equal([
      "Base",
      "Ethereum",
      "Polygon",
      "Optimism",
      "Arbitrum",
      "BNB Smart Chain",
      "Avalanche",
      "Bitcoin",
      "Bitcoin Cash",
      "Litecoin",
      "Dogecoin",
      "DigiByte",
      "Zcash",
      "Solana",
      "Stellar",
      "XRP Ledger",
    ]);
    expect(names.some((name) => /cosmos|atom/i.test(name))).to.equal(false);
    for (const row of rows) {
      expect(row.handshakeAllowance).to.equal(handshakeAllowance(row.countsPerIdentity));
      expect(row.handshakeAllowance).to.equal(row.countsPerIdentity ? 3 : 1);
      expect(row.devFund).to.be.a("string").and.not.empty;
    }
    const evm = rows.filter((row) =>
      ["Base", "Ethereum", "Polygon", "Optimism", "Arbitrum", "BNB Smart Chain", "Avalanche"].includes(row.environment)
    );
    for (const row of evm) {
      expect(row.devFund).to.equal("0xFD21BF773A193CDcb9F793100CB13a8baAdc3e9a");
      expect(row.countsPerIdentity).to.equal(true);
    }
    expect(rows.find((row) => row.environment === "Bitcoin").devFund).to.equal(
      "bc1qgf9h8m2fxeu66z9pq7dxgczuz5c4y52pek9jcu"
    );
  });
});

describe("CommitmentVaultLock exact rows, fees, and derived allowance", function () {
  async function vault() {
    const [creator] = await ethers.getSigners();
    const devFund = ethers.Wallet.createRandom().address;
    const Vault = await ethers.getContractFactory("CommitmentVaultLock");
    const deployed = await Vault.deploy("Base", devFund);
    await deployed.waitForDeployment();
    const Caller = await ethers.getContractFactory("TestReleaseCaller");
    const destination = await Caller.deploy();
    await destination.waitForDeployment();
    return { creator, devFund, deployed, destination };
  }

  function args(destination, duration) {
    return [
      ethers.hexlify(ethers.randomBytes(32)),
      ethers.Wallet.createRandom().address,
      0,
      ethers.id("asset"),
      ethers.id("valuation"),
      destination,
      duration,
    ];
  }

  it("rejects an in-range duration that is not one of the sixteen rows", async function () {
    const { creator, deployed, destination } = await vault();
    const call = args(await destination.getAddress(), EIGHT_DAYS);
    await expect(
      deployed.connect(creator).createNativeLock(...call, 10n * USD, { value: 10_000n })
    ).to.be.revertedWith("CVL: duration");
  });

  it("stores each row multiplier and prices the handshake against the standard lock", async function () {
    const { creator, devFund, deployed, destination } = await vault();
    const dest = await destination.getAddress();
    for (const [secs, bps] of COMMITMENT) {
      const call = args(dest, secs);
      const usd = secs === HOUR ? USD : 10n * USD;
      await deployed.connect(creator).createNativeLock(...call, usd, { value: 10_000n });
      const record = await deployed.lockRecord(call[0]);
      expect(record.multiplierBps).to.equal(bps);
      if (secs === HOUR) {
        expect(record.fee).to.equal(250n);
      } else {
        expect(record.fee).to.equal(500n);
      }
    }
    expect(await ethers.provider.getBalance(devFund)).to.equal(250n + 500n * 15n);
  });

  it("keeps the handshake inside $0.95 to $1.05 and the other rows at or above $10", async function () {
    const { creator, deployed, destination } = await vault();
    const dest = await destination.getAddress();
    const hour = args(dest, HOUR);
    await expect(
      deployed.connect(creator).createNativeLock(...hour, (95n * USD) / 100n - 1n, { value: 10_000n })
    ).to.be.revertedWith("CVL: handshake usd");
    await expect(
      deployed.connect(creator).createNativeLock(...hour, (105n * USD) / 100n + 1n, { value: 10_000n })
    ).to.be.revertedWith("CVL: handshake usd");
    const low = args(dest, HOUR);
    await deployed.connect(creator).createNativeLock(...low, (95n * USD) / 100n, { value: 10_000n });
    const high = args(dest, HOUR);
    await deployed.connect(creator).createNativeLock(...high, (105n * USD) / 100n, { value: 10_000n });

    const week = args(dest, SEVEN_DAYS);
    await expect(
      deployed.connect(creator).createNativeLock(...week, 10n * USD - 1n, { value: 10_000n })
    ).to.be.revertedWith("CVL: standard usd");
    const ok = args(dest, SEVEN_DAYS);
    await deployed.connect(creator).createNativeLock(...ok, 10n * USD, { value: 10_000n });
    expect((await deployed.lockRecord(ok[0])).fee).to.equal(500n);
  });

  it("derives the allowance from the counting capability", async function () {
    const { deployed } = await vault();
    const Probe = await ethers.getContractFactory("HandshakeCapabilityProbe");
    const probe = await Probe.deploy();
    await probe.waitForDeployment();
    expect(await deployed.countsPerIdentity()).to.equal(true);
    expect(await deployed.handshakeAllowance()).to.equal(await probe.allowance(true));
    expect(await probe.allowance(false)).to.equal(1n);
    expect(await probe.allowance(true)).to.equal(3n);
  });
});

describe("emission schedule and forge", function () {
  it("decays VCLM and CHONX from the authority rates and floors", async function () {
    const { verifier } = await deploySystem();
    expect(await verifier.DECAY_SURVIVAL_FP()).to.equal(SURVIVAL);
    expect(await verifier.previewEmissionRate(0, 0)).to.equal(10n * SCALE);
    expect(await verifier.previewEmissionRate(0, 29)).to.equal(10n * SCALE);
    expect(await verifier.previewEmissionRate(0, 30)).to.equal((10n * SCALE * SURVIVAL) / SCALE);
    expect(await verifier.previewEmissionRate(1, 0)).to.equal(100n * SCALE);
    expect(await verifier.previewEmissionRate(1, 30)).to.equal((100n * SCALE * SURVIVAL) / SCALE);

    let rate = 10n * SCALE;
    for (let i = 0; i < 400; i++) {
      rate = (rate * SURVIVAL) / SCALE;
      if (rate <= SCALE) {
        rate = SCALE;
        break;
      }
    }
    expect(await verifier.previewEmissionRate(0, 400 * 30)).to.equal(SCALE);
    expect(await verifier.previewEmissionRate(1, 400 * 30)).to.equal(10n * SCALE);
  });

  it("issues Verified Gross USD x emission x asset class x duration", async function () {
    const { verifier } = await deploySystem();
    const ten = 10n * SCALE;
    // $10 x 10 VCLM x 1.5 S1 x 1.0 (7 days) = 150
    expect(await verifier.previewIssuance(ten, 0, 1, SEVEN_DAYS, 0)).to.equal(150n * SCALE);
    // S2 1.3x
    expect(await verifier.previewIssuance(ten, 0, 2, SEVEN_DAYS, 0)).to.equal(130n * SCALE);
    // S3 1.0x, 30-day row 1.15x -> 115
    expect(await verifier.previewIssuance(ten, 0, 3, 2592000n, 0)).to.equal(115n * SCALE);
    // CHONX starts at 100 per dollar. $10 x 100 x 1.0 x 1.0 = 1000
    expect(await verifier.previewIssuance(ten, 1, 3, SEVEN_DAYS, 0)).to.equal(1000n * SCALE);
    await expect(verifier.previewIssuance(ten, 0, 3, EIGHT_DAYS, 0)).to.be.revertedWith(
      "VF-COM-002: duration not permitted"
    );
  });

  it("mints SYNTH only by burning 1,000 VCLM and 10,000 CHONX, and stops at 10,000,000", async function () {
    const [holder, other] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("VinculumFinalisToken");
    const vclm = await Token.deploy("Vinculum", "VCLM", VCLM_HARD_CAP);
    const chonx = await Token.deploy("Chunky Lion", "CHONX", CHONX_HARD_CAP);
    const Mock = await ethers.getContractFactory("MockSynthVerifier");
    const mock = await Mock.deploy();
    const Synth = await ethers.getContractFactory("VinculumFinalisSynth");
    const synth = await Synth.deploy(await mock.getAddress(), await vclm.getAddress(), await chonx.getAddress());
    await vclm.initialize(holder.address, other.address);
    await chonx.initialize(holder.address, other.address);

    expect(synth.mint).to.equal(undefined);
    expect(await synth.HARD_CAP()).to.equal(SYNTH_HARD_CAP);
    expect(await synth.VCLM_BURN_PER_SYNTH()).to.equal(1000n * SCALE);
    expect(await synth.CHONX_BURN_PER_SYNTH()).to.equal(10000n * SCALE);
    expect(await synth.SYNTH_ACTIVATION_THRESHOLD()).to.equal(100_000_000n * SCALE);

    await vclm.mint(holder.address, 1000n * SCALE);
    await chonx.mint(holder.address, 10000n * SCALE);
    await vclm.approve(await synth.getAddress(), 1000n * SCALE);
    await chonx.approve(await synth.getAddress(), 10000n * SCALE);
    await expect(synth.forge(1)).to.be.revertedWith("VF-TOK-003: SYNTH not activated");

    await mock.setCumulativeChonxIssued(100_000_000n * SCALE);
    await synth.forge(1);
    expect(await synth.balanceOf(holder.address)).to.equal(SCALE);
    expect(await synth.totalSupply()).to.equal(SCALE);
    expect(await vclm.balanceOf(holder.address)).to.equal(0n);
    expect(await chonx.balanceOf(holder.address)).to.equal(0n);

    // A second system fills the cap exactly: 10,000,000 SYNTH burns the whole VCLM and CHONX caps.
    const vclm2 = await Token.deploy("Vinculum", "VCLM", VCLM_HARD_CAP);
    const chonx2 = await Token.deploy("Chunky Lion", "CHONX", CHONX_HARD_CAP);
    const mock2 = await Mock.deploy();
    const synth2 = await Synth.deploy(await mock2.getAddress(), await vclm2.getAddress(), await chonx2.getAddress());
    await vclm2.initialize(holder.address, other.address);
    await chonx2.initialize(holder.address, other.address);
    await mock2.setCumulativeChonxIssued(100_000_000n * SCALE);
    await vclm2.mint(holder.address, VCLM_HARD_CAP);
    await chonx2.mint(holder.address, CHONX_HARD_CAP);
    await vclm2.approve(await synth2.getAddress(), VCLM_HARD_CAP);
    await chonx2.approve(await synth2.getAddress(), CHONX_HARD_CAP);
    await synth2.forge(10_000_000n);
    expect(await synth2.totalSupply()).to.equal(SYNTH_HARD_CAP);
    await vclm2.mint(holder.address, 1000n * SCALE).catch(() => {});
    await expect(synth2.forge(1)).to.be.revertedWith("VF-SUP-015: SYNTH hard cap exceeded - reject in full");
  });
});
