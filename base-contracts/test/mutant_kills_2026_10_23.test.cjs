// Batch fix 2026-10-23: tests that kill the mutants that survived the
// 2026-10-22 mutation run (VERIFIER, STAKE, SYNTH, TOKEN) and the BaseCVL
// pin-only mutants MUT-41..50 (run on both CVLs). Every test asserts the
// intended behavior of the unmutated code.
const { expect } = require("chai");
const { ethers, network } = require("hardhat");
const { finalizeCeremony } = require("./lib/finalizeCeremony.cjs");

const SCALE = 10n ** 18n;
const DAY = 86400n;
const D30 = 30n * DAY;
const D120 = 120n * DAY;
const coder = ethers.AbiCoder.defaultAbiCoder();
const ETH = ethers.id("mutkill/ETH");
const USDCX = ethers.id("mutkill/USDC_");

async function latest() {
  return BigInt((await ethers.provider.getBlock("latest")).timestamp);
}
async function at(ts) {
  await network.provider.send("evm_setNextBlockTimestamp", [Number(ts)]);
}
async function mineAt(ts) {
  await at(ts);
  await network.provider.send("evm_mine");
}

// ---------------------------------------------------------------- Token
describe("Mutant kills: VinculumFinalisToken", function () {
  async function token() {
    const [deployer, a, b, c] = await ethers.getSigners();
    const t = await (await ethers.getContractFactory("VinculumFinalisToken")).deploy("Vinculum", "VCLM", 10n ** 30n);
    return { deployer, a, b, c, t };
  }

  it("T-TK-03: initialize through a contract forwarder is refused (deployer is msg.sender, not tx.origin)", async function () {
    const { a, b, t } = await token();
    const fwd = await (await ethers.getContractFactory("TestForwarder")).deploy();
    const data = t.interface.encodeFunctionData("initialize", [a.address, b.address]);
    await expect(fwd.forward(await t.getAddress(), data)).to.be.revertedWith("VFT: not deployer");
    expect(await t.finalized()).to.equal(false);
  });

  it("G-Token-71: identical minters are refused", async function () {
    const { a, t } = await token();
    await expect(t.initialize(a.address, a.address)).to.be.revertedWith("VF-DEP-002: minters identical");
  });

  it("G-Token-144/145: a partial burn succeeds and removes exactly the amount from balance and supply", async function () {
    const { deployer, a, b, t } = await token();
    await t.initialize(deployer.address, b.address);
    await t.mint(a.address, 100n * SCALE);
    await t.connect(a).burn(30n * SCALE);
    expect(await t.balanceOf(a.address)).to.equal(70n * SCALE);
    expect(await t.totalSupply()).to.equal(70n * SCALE);
    await expect(t.connect(a).burn(71n * SCALE)).to.be.revertedWith("VFT: insufficient balance");
  });

  it("G-Token-155/174: burnFrom below the allowance succeeds and decrements the allowance by exactly the amount", async function () {
    const { deployer, a, b, c, t } = await token();
    await t.initialize(deployer.address, b.address);
    await t.mint(a.address, 100n * SCALE);
    await t.connect(a).approve(c.address, 40n * SCALE);
    await t.connect(c).burnFrom(a.address, 8n * SCALE);
    expect(await t.allowance(a.address, c.address)).to.equal(32n * SCALE);
    expect(await t.balanceOf(a.address)).to.equal(92n * SCALE);
    expect(await t.totalSupply()).to.equal(92n * SCALE);
    await expect(t.connect(c).burnFrom(a.address, 33n * SCALE)).to.be.revertedWith("VFT: insufficient allowance");
  });
});

// ---------------------------------------------------------------- Synth
describe("Mutant kills: VinculumFinalisSynth", function () {
  const THRESH = 100_000_000n * SCALE;
  async function synth() {
    const [deployer, a, b, stake] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("VinculumFinalisToken");
    const vclm = await Token.deploy("Vinculum", "VCLM", 10n ** 30n);
    const chonx = await Token.deploy("Chonx", "CHONX", 10n ** 30n);
    await vclm.initialize(deployer.address, stake.address);
    await chonx.initialize(deployer.address, stake.address);
    const counter = await (await ethers.getContractFactory("TestChonxCounter")).deploy();
    const s = await (await ethers.getContractFactory("VinculumFinalisSynth"))
      .deploy(await counter.getAddress(), await vclm.getAddress(), await chonx.getAddress());
    await vclm.mint(a.address, 10_000n * SCALE);
    await chonx.mint(a.address, 100_000n * SCALE);
    await vclm.connect(a).approve(await s.getAddress(), 5_000n * SCALE);
    await chonx.connect(a).approve(await s.getAddress(), 50_000n * SCALE);
    return { deployer, a, b, vclm, chonx, counter, s };
  }

  it("constants: 1,000 VCLM + 10,000 CHONX per SYNTH, 100M CHONX threshold, 10M hard cap", async function () {
    const { s } = await synth();
    expect(await s.VCLM_BURN_PER_SYNTH()).to.equal(1000n * SCALE);
    expect(await s.CHONX_BURN_PER_SYNTH()).to.equal(10_000n * SCALE);
    expect(await s.SYNTH_ACTIVATION_THRESHOLD()).to.equal(THRESH);
    expect(await s.HARD_CAP()).to.equal(10_000_000n * SCALE);
  });

  it("T-SY-03 / G-Synth-91: the activation view is false below 100M, true at exactly 100M and above", async function () {
    const { counter, s } = await synth();
    await counter.set(THRESH - 1n);
    expect(await s.isActivationThresholdReached()).to.equal(false);
    expect(await s.checkActivation.staticCall()).to.equal(false);
    await counter.set(THRESH);
    expect(await s.isActivationThresholdReached()).to.equal(true);
    await counter.set(THRESH + 1n);
    expect(await s.isActivationThresholdReached()).to.equal(true);
    expect(await s.checkActivation.staticCall()).to.equal(true);
  });

  it("G-Synth-67: activation is permanent even if the counter later reads lower", async function () {
    const { a, vclm, chonx, counter, s } = await synth();
    await counter.set(THRESH);
    await s.checkActivation();
    expect(await s.synthActivated()).to.equal(true);
    await counter.set(0n);
    expect(await s.checkActivation.staticCall()).to.equal(true);
    await s.connect(a).forge(2n);
    expect(await s.balanceOf(a.address)).to.equal(2n * SCALE);
    expect(await vclm.balanceOf(a.address)).to.equal(8_000n * SCALE);
    expect(await chonx.balanceOf(a.address)).to.equal(80_000n * SCALE);
    expect(await vclm.allowance(a.address, await s.getAddress())).to.equal(3_000n * SCALE);
    expect(await chonx.allowance(a.address, await s.getAddress())).to.equal(30_000n * SCALE);
  });

  it("forge is refused before activation", async function () {
    const { a, counter, s } = await synth();
    await counter.set(THRESH - 1n);
    await expect(s.connect(a).forge(1n)).to.be.revertedWith("VF-TOK-003: SYNTH not activated");
  });

  it("R-Synth-139: forge(0) is refused after activation", async function () {
    const { a, counter, s } = await synth();
    await counter.set(THRESH);
    await expect(s.connect(a).forge(0n)).to.be.revertedWith("SYNTH: zero forge count");
  });

  it("G-Synth-150 / G-Synth-204: transfer to zero refused; transferFrom decrements the allowance exactly", async function () {
    const { a, b, counter, s } = await synth();
    await counter.set(THRESH);
    await s.connect(a).forge(3n);
    await expect(s.connect(a).transfer(ethers.ZeroAddress, 1n)).to.be.revertedWith("SYNTH: transfer to zero address");
    await s.connect(a).approve(b.address, 2n * SCALE);
    await s.connect(b).transferFrom(a.address, b.address, SCALE);
    expect(await s.allowance(a.address, b.address)).to.equal(SCALE);
    expect(await s.balanceOf(b.address)).to.equal(SCALE);
    await s.connect(b).transferFrom(a.address, b.address, SCALE);
    expect(await s.allowance(a.address, b.address)).to.equal(0n);
    await expect(s.connect(b).transferFrom(a.address, b.address, 1n)).to.be.revertedWith("SYNTH: insufficient allowance");
  });
});

// ---------------------------------------------------------------- Stake
describe("Mutant kills: VinculumFinalisStake extensions", function () {
  async function stake() {
    const [, a, other] = await ethers.getSigners();
    const F = await ethers.getContractFactory("TestFixtureERC20");
    const v = await (await ethers.getContractFactory("StakeTestVerifier")).deploy();
    const vc = await (await ethers.getContractFactory("VinculumFinalisToken")).deploy("Vinculum", "VCLM", 10_000_000_000n * SCALE);
    const ch = await F.deploy(0), sy = await F.deploy(0);
    const st = await (await ethers.getContractFactory("VinculumFinalisStake"))
      .deploy(await vc.getAddress(), await ch.getAddress(), await sy.getAddress(), await v.getAddress());
    await vc.initialize(await v.getAddress(), await st.getAddress());
    await v.setStake(await st.getAddress());
    const t0 = (await latest()) + 100n;
    await v.setLaunch(t0);
    await ch.mint(a.address, 1000n * SCALE);
    await ch.connect(a).approve(await st.getAddress(), 2n ** 255n);
    await at(t0 + 5n);
    await st.connect(a).createPosition(1, 10n * SCALE, D30);
    await st.connect(a).queueExtension(0n, D120);
    const end = (await st.positions(0n)).endTimestamp;
    return { a, other, st, end };
  }

  it("T-ST-01: queueExtension through a contract forwarder is refused (owner is msg.sender)", async function () {
    const { a, st } = await stake();
    const fwd = await (await ethers.getContractFactory("TestForwarder")).deploy();
    const data = st.interface.encodeFunctionData("queueExtension", [0n, D30]);
    await expect(fwd.connect(a).forward(await st.getAddress(), data)).to.be.revertedWith("VFS: not owner");
  });

  it("T-ST-03: a non-owner cannot apply a matured queued extension", async function () {
    const { other, st, end } = await stake();
    await mineAt(end);
    await expect(st.connect(other).applyExtensionIfMatured(0n)).to.be.revertedWith("VFS: not owner");
  });

  it("R-Stake-346 / G-Stake-325: the owner applies exactly at the end; the new term has the queued duration", async function () {
    const { a, st, end } = await stake();
    await at(end - 1n);
    await expect(st.connect(a).applyExtensionIfMatured(0n)).to.be.revertedWith("VFS: not matured");
    await at(end);
    await st.connect(a).applyExtensionIfMatured(0n);
    const p = await st.positions(0n);
    expect(p.startTimestamp).to.equal(end);
    expect(p.durationSecs).to.equal(D120);
    expect(p.endTimestamp).to.equal(end + D120);
    expect(p.queuedExtensionSecs).to.equal(0n);
  });
});

// ---------------------------------------------------------------- Verifier
async function vfx({ harness = false, rewards = 0n } = {}) {
  const [deployer, recipient] = await ethers.getSigners();
  const Token = await ethers.getContractFactory("VinculumFinalisToken");
  const vclm = await Token.deploy("Vinculum", "VCLM", 10n ** 30n);
  const chonx = await Token.deploy("Chonx", "CHONX", 10n ** 30n);
  const verifier = await (await ethers.getContractFactory(harness ? "VerifierCapEdgeHarness" : "VinculumFinalisVerifier"))
    .deploy(await vclm.getAddress(), await chonx.getAddress());
  const mock = await (await ethers.getContractFactory("MockAlwaysFinalizedVerifier")).deploy();
  const counter = await (await ethers.getContractFactory("TestStakeRewardCounter")).deploy();
  if (rewards) await counter.set(rewards);
  await vclm.initialize(await verifier.getAddress(), await counter.getAddress());
  await chonx.initialize(await verifier.getAddress(), ethers.ZeroAddress);
  await verifier.registerChainVerifier("Ethereum", await mock.getAddress());
  await verifier.configureDevFund("Ethereum", deployer.address);
  await verifier.registerAssetPrecision("Ethereum", ETH, "ETH", 18, 2, 0);
  await verifier.registerAssetPrecision("Ethereum", USDCX, "USDC_", 6, 3, 0);
  await verifier.setScheduledPricePoster(deployer.address);
  await finalizeCeremony(verifier);
  return { deployer, recipient, vclm, chonx, verifier, counter };
}

async function post(verifier, rows) {
  const runId = (await verifier.lastScheduledRunId()) + 1n;
  await verifier.applyScheduledPriceRun(runId, rows.map(([env, asset, price]) => ({
    environmentId: env, canonicalAssetId: asset, priceUsd18: price, success: true,
  })));
  return (await latest()) + 1n;
}

function pkg({ lockId = ethers.hexlify(ethers.randomBytes(32)), asset = ETH, dec = 18, cls = 2,
  gross = SCALE, duration = D30, recipient, out = 0, created }) {
  const fee = (gross * 500n) / 10000n;
  const principal = gross - fee;
  return {
    sourceEnvironmentId: "Ethereum", commitmentVaultLockId: lockId, handshakeAllowanceCount: 3,
    canonicalAssetId: asset, assetPrecision: dec, assetCustodyClass: cls,
    grossAmountSmallestUnits: gross, actualFeeAmountSmallestUnits: fee, principalAmountSmallestUnits: principal,
    feeAssetId: asset, devFundDestination: "dev", feeTransferEvidence: ethers.id("fee"),
    valuationTimestamp: created, maturityTimestamp: 2n, durationSecs: duration,
    selectedOutputToken: out, baseRecipient: recipient, releaseDestination: "release", chonxActivationReceipt: "0x",
    racIdentity: ethers.hexlify(ethers.randomBytes(32)), priceRecord: "0x", sourceFinalityProof: "0x",
    lockEventProof: coder.encode(
      ["bytes32", "uint256", "uint256", "uint256", "uint256", "uint256", "uint256", "address", "uint8", "bytes32"],
      [lockId, gross, fee, principal, duration, created, 2n, recipient, out, asset]
    ),
  };
}

async function submit(f, p) {
  const tok = p.selectedOutputToken === 1 ? f.chonx : f.vclm;
  const before = await tok.balanceOf(p.baseRecipient);
  await f.verifier.recordFeeAndRac(p);
  await f.verifier.verifyAndMint(p, 0);
  return (await tok.balanceOf(p.baseRecipient)) - before;
}

const ACT = 10_000_000n * SCALE;
const VCAP = 10_000_000_000n * SCALE;
const CCAP = 100_000_000_000n * SCALE;
const PRICE = 1000n * SCALE; // $1,000 per ETH; 1 ETH gross is $1,000

describe("Mutant kills: VinculumFinalisVerifier", function () {
  it("T-VF-02/06/15/16: the spec constants", async function () {
    const { verifier } = await vfx();
    expect(await verifier.VCLM_HARD_CAP()).to.equal(VCAP);
    expect(await verifier.CHONX_HARD_CAP()).to.equal(CCAP);
    expect(await verifier.CHONX_ACTIVATION_THRESHOLD()).to.equal(ACT);
    expect(await verifier.DECAY_SURVIVAL_FP()).to.equal(983330000000000000n);
    const r0 = await verifier.previewEmissionRate(0, 0n);
    expect(await verifier.previewEmissionRate(0, 30n)).to.equal((r0 * 983330000000000000n) / SCALE);
  });

  it("T-VF-02/03 / G-Verifier-1698: CHONX activates at exactly 10M lifetime VCLM, recording the block time", async function () {
    const { verifier, counter } = await vfx();
    await counter.set(ACT - 1n);
    await verifier.syncChonxActivation();
    expect(await verifier.chonxActivated()).to.equal(false);
    await counter.set(ACT);
    const ts = (await latest()) + 7n;
    await at(ts);
    await verifier.syncChonxActivation();
    expect(await verifier.chonxActivated()).to.equal(true);
    expect(await verifier.chonxActivationTimestamp()).to.equal(ts);
  });

  it("R-Verifier-1141: currentEpoch counts 10-day epochs from launch, starting at 1", async function () {
    const { verifier } = await vfx();
    const t0 = await verifier.protocolLaunchTimestamp();
    expect(t0).to.be.gt(0n);
    await mineAt(t0 + 25n * DAY);
    expect(await verifier.currentEpoch()).to.equal(3n);
  });

  it("T-VF-10: deployment configuration through a contract forwarder is refused", async function () {
    const [deployer] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("VinculumFinalisToken");
    const vclm = await Token.deploy("Vinculum", "VCLM", 10n ** 30n);
    const chonx = await Token.deploy("Chonx", "CHONX", 10n ** 30n);
    const verifier = await (await ethers.getContractFactory("VinculumFinalisVerifier")).deploy(await vclm.getAddress(), await chonx.getAddress());
    const fwd = await (await ethers.getContractFactory("TestForwarder")).deploy();
    const data = verifier.interface.encodeFunctionData("configureDevFund", ["Ethereum", deployer.address]);
    await expect(fwd.forward(await verifier.getAddress(), data)).to.be.revertedWith("VF: not deployer");
  });

  it("T-VF-09: a scheduled price run through a contract forwarder is refused", async function () {
    const { verifier } = await vfx();
    const fwd = await (await ethers.getContractFactory("TestForwarder")).deploy();
    const data = verifier.interface.encodeFunctionData("applyScheduledPriceRun", [1n, [{
      environmentId: "Ethereum", canonicalAssetId: ETH, priceUsd18: PRICE, success: true }]]);
    await expect(fwd.forward(await verifier.getAddress(), data)).to.be.revertedWith("VF-ORC-007: not price poster");
  });

  it("G-Verifier-792: a zero Base recipient is refused", async function () {
    const f = await vfx();
    const created = await post(f.verifier, [["Ethereum", ETH, PRICE]]);
    await mineAt(created + 5n);
    const p = pkg({ recipient: ethers.ZeroAddress, created });
    let recorded = true;
    try { await f.verifier.recordFeeAndRac(p); } catch (e) {
      recorded = false;
      expect(String(e.message)).to.match(/VF-ARC-006: zero base recipient/);
    }
    if (recorded) await expect(f.verifier.verifyAndMint(p, 0)).to.be.revertedWith("VF-ARC-006: zero base recipient");
  });

  it("R-Verifier-977: an asset whose symbol is 'USDC_' is not a stablecoin and mints at its posted $0.90", async function () {
    const f = await vfx();
    const created = await post(f.verifier, [["Ethereum", USDCX, 9n * SCALE / 10n]]);
    await mineAt(created + 5n);
    const gross = 100_000_000n; // 100 units, 6 decimals
    const minted = await submit(f, pkg({ asset: USDCX, dec: 6, cls: 3, gross, recipient: f.recipient.address, created }));
    expect(minted).to.equal(await f.verifier.previewIssuance(90n * SCALE, 0, 3, D30, 0n));
  });

  it("T-VF-16 / G-Verifier-1102: the VCLM cap admits a lock that lands exactly on 10B", async function () {
    const usd = 1000n * SCALE;
    const f0 = await vfx();
    const A = await f0.verifier.previewIssuance(usd, 0, 2, D30, 0n);
    const f = await vfx({ rewards: VCAP - A });
    expect(await f.verifier.getRemainingVclmCap()).to.equal(A);
    const created = await post(f.verifier, [["Ethereum", ETH, PRICE]]);
    await mineAt(created + 5n);
    expect(await submit(f, pkg({ recipient: f.recipient.address, created }))).to.equal(A);
    expect(await f.verifier.getRemainingVclmCap()).to.equal(0n);
  });

  it("T-VF-16: one wei over the VCLM cap is refused in full", async function () {
    const usd = 1000n * SCALE;
    const f0 = await vfx();
    const A = await f0.verifier.previewIssuance(usd, 0, 2, D30, 0n);
    const f = await vfx({ rewards: VCAP - A + 1n });
    const created = await post(f.verifier, [["Ethereum", ETH, PRICE]]);
    await mineAt(created + 5n);
    const p = pkg({ recipient: f.recipient.address, created });
    await f.verifier.recordFeeAndRac(p);
    await expect(f.verifier.verifyAndMint(p, 0)).to.be.revertedWith("VF-SUP-015: exceeds VCLM cap");
  });

  describe("CHONX (activation, causal order and cap edges)", function () {
    async function activated() {
      const f = await vfx({ harness: true });
      await post(f.verifier, [["Ethereum", ETH, PRICE]]);
      await f.counter.set(ACT);
      await f.verifier.syncChonxActivation();
      f.actTs = await f.verifier.chonxActivationTimestamp();
      f.launch = await f.verifier.protocolLaunchTimestamp();
      return f;
    }

    it("G-Verifier-780: CHONX before activation is refused", async function () {
      const f = await vfx();
      const created = await post(f.verifier, [["Ethereum", ETH, PRICE]]);
      await mineAt(created + 5n);
      const p = pkg({ recipient: f.recipient.address, created, out: 1 });
      await f.verifier.recordFeeAndRac(p);
      await expect(f.verifier.verifyAndMint(p, 0)).to.be.revertedWith("VF-COM-025: CHONX not activated");
    });

    it("G-Verifier-830 / R-Verifier-839: a non-Base lock one second inside the clock margin is refused; at the margin it mints", async function () {
      const f = await activated();
      await mineAt(f.actTs + DAY + 5n);
      const early = pkg({ recipient: f.recipient.address, created: f.actTs + DAY - 1n, out: 1 });
      await f.verifier.recordFeeAndRac(early);
      await expect(f.verifier.verifyAndMint(early, 0)).to.be.revertedWith("VF-COM-025: lock created before CHONX activation");
      const ok = pkg({ recipient: f.recipient.address, created: f.actTs + DAY, out: 1 });
      expect(await submit(f, ok)).to.be.gt(0n);
    });

    it("G-Verifier-862 / R-Verifier-863 / T-VF-15: CHONX cap edges (normal, exactly to cap, one wei over)", async function () {
      const f = await activated();
      const created = f.actTs + DAY;
      await mineAt(created + 5n);
      const days = (created - f.launch) / DAY;
      const B = await f.verifier.previewIssuance(1000n * SCALE, 1, 2, D30, days);
      expect(await submit(f, pkg({ recipient: f.recipient.address, created, out: 1 }))).to.equal(B);
      await f.verifier.testSetCumulativeChonxIssued(CCAP - B);
      expect(await f.verifier.getRemainingChonxCap()).to.equal(B);
      expect(await submit(f, pkg({ recipient: f.recipient.address, created, out: 1 }))).to.equal(B);
      expect(await f.verifier.getRemainingChonxCap()).to.equal(0n);
      await f.verifier.testSetCumulativeChonxIssued(CCAP - B + 1n);
      const over = pkg({ recipient: f.recipient.address, created, out: 1 });
      await f.verifier.recordFeeAndRac(over);
      await expect(f.verifier.verifyAndMint(over, 0)).to.be.revertedWith("VF-SUP-015: exceeds CHONX cap");
    });
  });

  it("R-Verifier-1025-19: a lock created 30 days after launch earns the decayed rate", async function () {
    const f = await vfx();
    const t0 = await f.verifier.protocolLaunchTimestamp();
    await mineAt(t0 + D30 + 10n);
    const created = await post(f.verifier, [["Ethereum", ETH, PRICE]]);
    await mineAt(created + 5n);
    const minted = await submit(f, pkg({ recipient: f.recipient.address, created }));
    expect(minted).to.equal(await f.verifier.previewIssuance(1000n * SCALE, 0, 2, D30, 30n));
    expect(minted).to.be.lt(await f.verifier.previewIssuance(1000n * SCALE, 0, 2, D30, 0n));
  });
});

// ---------------------------------------------------------------- CVLs MUT-41..50
for (const kind of ["BaseCommitmentVaultLock", "CommitmentVaultLock"]) {
  describe(`Mutant kills: ${kind} (MUT-41..50)`, function () {
    async function cvlFx() {
      const [deployer, user, dest, devFund] = await ethers.getSigners();
      const F = await ethers.getContractFactory(kind);
      const cvl = kind === "CommitmentVaultLock"
        ? await F.deploy("Ethereum", devFund.address)
        : await F.deploy("Base", devFund.address, ethers.Wallet.createRandom().address, ethers.Wallet.createRandom().address, ethers.Wallet.createRandom().address);
      return { deployer, user, dest, devFund, cvl };
    }
    const HS = 3600n;
    function native(c, usd, id = ethers.hexlify(ethers.randomBytes(32))) {
      return c.cvl.connect(c.user).createNativeLock(id, c.user.address, 0, ethers.ZeroHash, ethers.ZeroHash, c.dest.address,
        HS, usd, { value: 10n ** 15n });
    }
    async function erc20(c, token, amount, id = ethers.hexlify(ethers.randomBytes(32)), duration = D30) {
      await token.connect(c.user).approve(await c.cvl.getAddress(), amount);
      return c.cvl.connect(c.user).createErc20Lock(id, c.user.address, 0, ethers.ZeroHash, ethers.ZeroHash, c.dest.address,
        duration, await token.getAddress(), amount, SCALE);
    }

    it("G-BaseCVL-417 / T-BC-02/03/04: handshake band is $0.01 to $0.02 inclusive", async function () {
      const c = await cvlFx();
      await expect(native(c, 9n * 10n ** 15n)).to.be.revertedWith("CVL: handshake usd");
      await expect(native(c, 21n * 10n ** 15n)).to.be.revertedWith("CVL: handshake usd");
      await expect(native(c, 10n ** 16n)).to.not.be.reverted;
      await expect(native(c, 2n * 10n ** 16n)).to.not.be.reverted;
    });

    it("R-BaseCVL-213: a zero amount is refused", async function () {
      const c = await cvlFx();
      const t = await (await ethers.getContractFactory("TestTransferFeeERC20")).deploy(0);
      await expect(erc20(c, t, 0n)).to.be.revertedWith("CVL: zero gross");
    });

    it("R-BaseCVL-217: an amount whose stated fee rounds to zero is refused even if the token over-credits", async function () {
      const c = await cvlFx();
      const t = await (await ethers.getContractFactory("TestBonusERC20")).deploy(1);
      await t.mint(c.user.address, 1000n);
      await expect(erc20(c, t, 19n)).to.be.revertedWith("CVL: zero fee or principal");
    });

    it("R-BaseCVL-227: a received amount whose fee rounds to zero is refused", async function () {
      const c = await cvlFx();
      const t = await (await ethers.getContractFactory("TestTransferFeeERC20")).deploy(500);
      await t.mint(c.user.address, 1000n);
      await expect(erc20(c, t, 20n)).to.be.revertedWith("CVL: zero fee or principal");
    });

    it("R-BaseCVL-255 / R-BaseCVL-365: a no-return token locks and releases exactly at maturity", async function () {
      const c = await cvlFx();
      const t = await (await ethers.getContractFactory("TestNoReturnERC20")).deploy();
      await t.mint(c.user.address, 1000n * SCALE);
      const id = ethers.id(`noret/${kind}`);
      await (await erc20(c, t, 1000n * SCALE, id)).wait();
      expect(await t.balanceOf(c.devFund.address)).to.equal(50n * SCALE);
      const maturity = (await c.cvl.lockRecord(id)).maturity;
      await at(maturity - 1n);
      await expect(c.cvl.connect(c.dest).release(id)).to.be.revertedWith("CVL: immature");
      await at(maturity);
      await c.cvl.connect(c.dest).release(id);
      expect(await t.balanceOf(c.dest.address)).to.equal(950n * SCALE);
    });

    it("T-BC-05: release through a contract forwarder from the destination EOA is refused", async function () {
      const c = await cvlFx();
      const t = await (await ethers.getContractFactory("TestTransferFeeERC20")).deploy(0);
      await t.mint(c.user.address, 1000n * SCALE);
      const id = ethers.id(`fwd/${kind}`);
      await (await erc20(c, t, 1000n * SCALE, id)).wait();
      await mineAt((await latest()) + D30 + 1n);
      const fwd = await (await ethers.getContractFactory("TestForwarder")).deploy();
      const data = c.cvl.interface.encodeFunctionData("release", [id]);
      await expect(fwd.connect(c.dest).forward(await c.cvl.getAddress(), data)).to.be.revertedWith("CVL: destination");
      expect(await t.balanceOf(await fwd.getAddress())).to.equal(0n);
    });
  });
}
