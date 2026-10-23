// Mutant kills 2026-10-23: behavior tests that kill the mutants that
// survived the 2026-10-22 mutation run (Token, Synth, Stake, Verifier) and
// the BaseCommitmentVaultLock pin_only mutants MUT-41..50. Every test asserts
// the specified behavior directly. The CVL tests run on both lock contracts.
// Nothing is broadcast. No keys.
const { expect } = require("chai");
const { ethers, network } = require("hardhat");
const { finalizeCeremony } = require("./lib/finalizeCeremony.cjs");

const SCALE = 10n ** 18n;
const DAY = 86400n;
const D30 = 30n * DAY;
const HOUR = 3600n;
const coder = ethers.AbiCoder.defaultAbiCoder();
const ETH = ethers.id("mutkill/ETH");
const USDC = ethers.id("mutkill/USDC");
const USDCX = ethers.id("mutkill/USDC_");

async function latest() {
  return BigInt((await ethers.provider.getBlock("latest")).timestamp);
}
async function mineAt(ts) {
  await network.provider.send("evm_setNextBlockTimestamp", [Number(ts)]);
  await network.provider.send("evm_mine");
}

async function fx({ harness = false } = {}) {
  const [deployer, recipient, other] = await ethers.getSigners();
  const Token = await ethers.getContractFactory("VinculumFinalisToken");
  const vclm = await Token.deploy("Vinculum", "VCLM", 10n ** 30n);
  const chonx = await Token.deploy("Chonx", "CHONX", 10n ** 30n);
  const verifier = await (await ethers.getContractFactory(harness ? "VerifierCapEdgeHarness" : "VinculumFinalisVerifier"))
    .deploy(await vclm.getAddress(), await chonx.getAddress());
  const mock = await (await ethers.getContractFactory("MockAlwaysFinalizedVerifier")).deploy();
  const counter = await (await ethers.getContractFactory("TestStakeRewardCounter")).deploy();
  await vclm.initialize(await verifier.getAddress(), await counter.getAddress());
  await chonx.initialize(await verifier.getAddress(), ethers.ZeroAddress);
  await verifier.registerChainVerifier("Ethereum", await mock.getAddress());
  await verifier.configureDevFund("Ethereum", deployer.address);
  await verifier.registerAssetPrecision("Ethereum", ETH, "ETH", 18, 2, 0);
  await verifier.registerAssetPrecision("Ethereum", USDC, "USDC", 6, 3, 0);
  await verifier.registerAssetPrecision("Ethereum", USDCX, "USDC_", 6, 3, 0);
  await verifier.setScheduledPricePoster(deployer.address);
  await finalizeCeremony(verifier);
  return { deployer, recipient, other, vclm, chonx, verifier, mock, counter };
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

function usdOf(gross, dec, price) {
  return (((gross * SCALE) / 10n ** BigInt(dec)) * price) / SCALE;
}

async function emissionDay(verifier, created) {
  return (created - (await verifier.protocolLaunchTimestamp())) / DAY;
}

describe("Mutant kills 2026-10-23", function () {
  describe("Token (VinculumFinalisToken)", function () {
    async function token() {
      const [deployer, stake, user, spender] = await ethers.getSigners();
      const t = await (await ethers.getContractFactory("VinculumFinalisToken")).deploy("V", "V", 10n ** 30n);
      return { deployer, stake, user, spender, t };
    }
    it("T-TK-03: initialize through a contract called by the deployer is refused (msg.sender, not tx.origin)", async function () {
      const c = await token();
      const fwd = await (await ethers.getContractFactory("TestForwarder")).deploy();
      const data = c.t.interface.encodeFunctionData("initialize", [c.user.address, c.stake.address]);
      await expect(fwd.connect(c.deployer).forward(await c.t.getAddress(), data)).to.be.revertedWith("VFT: not deployer");
    });
    it("G-Token-71: identical minters are refused", async function () {
      const c = await token();
      await expect(c.t.initialize(c.user.address, c.user.address)).to.be.revertedWith("VF-DEP-002: minters identical");
    });
    it("G-Token-144/145: a partial burn succeeds and reduces balance and supply; an over-burn is refused", async function () {
      const c = await token();
      await c.t.initialize(c.deployer.address, c.stake.address);
      await c.t.mint(c.user.address, 100n);
      await c.t.connect(c.user).burn(30n);
      expect(await c.t.balanceOf(c.user.address)).to.equal(70n);
      expect(await c.t.totalSupply()).to.equal(70n);
      await expect(c.t.connect(c.user).burn(71n)).to.be.revertedWith("VFT: insufficient balance");
      await c.t.connect(c.user).burn(70n);
      expect(await c.t.balanceOf(c.user.address)).to.equal(0n);
    });
    it("G-Token-155/174: burnFrom below the allowance succeeds and leaves allowance minus amount", async function () {
      const c = await token();
      await c.t.initialize(c.deployer.address, c.stake.address);
      await c.t.mint(c.user.address, 100n);
      await c.t.connect(c.user).approve(c.spender.address, 100n);
      await c.t.connect(c.spender).burnFrom(c.user.address, 30n);
      expect(await c.t.allowance(c.user.address, c.spender.address)).to.equal(70n);
      expect(await c.t.balanceOf(c.user.address)).to.equal(70n);
      await expect(c.t.connect(c.spender).burnFrom(c.user.address, 71n)).to.be.revertedWith("VFT: insufficient allowance");
    });
  });

  describe("Synth (VinculumFinalisSynth)", function () {
    async function synth() {
      const [deployer, stake, user, other] = await ethers.getSigners();
      const Token = await ethers.getContractFactory("VinculumFinalisToken");
      const vclm = await Token.deploy("V", "VCLM", 10n ** 30n);
      const chonx = await Token.deploy("C", "CHONX", 10n ** 30n);
      await vclm.initialize(deployer.address, stake.address);
      await chonx.initialize(deployer.address, stake.address);
      const counter = await (await ethers.getContractFactory("TestChonxCounter")).deploy();
      const s = await (await ethers.getContractFactory("VinculumFinalisSynth")).deploy(
        await counter.getAddress(), await vclm.getAddress(), await chonx.getAddress());
      await vclm.mint(user.address, 10_000n * SCALE);
      await chonx.mint(user.address, 100_000n * SCALE);
      await vclm.connect(user).approve(await s.getAddress(), 10_000n * SCALE);
      await chonx.connect(user).approve(await s.getAddress(), 100_000n * SCALE);
      return { user, other, vclm, chonx, counter, s };
    }
    const T100M = 100_000_000n * SCALE;
    it("G-Synth-91 / T-SY-03: the threshold is reached at exactly 100M CHONX, not one unit below", async function () {
      const c = await synth();
      await c.counter.set(T100M - 1n);
      expect(await c.s.isActivationThresholdReached()).to.equal(false);
      await expect(c.s.connect(c.user).forge(1)).to.be.revertedWith("VF-TOK-003: SYNTH not activated");
      await c.counter.set(T100M);
      expect(await c.s.isActivationThresholdReached()).to.equal(true);
      await c.s.connect(c.user).forge(1);
      expect(await c.s.balanceOf(c.user.address)).to.equal(SCALE);
      expect(await c.vclm.balanceOf(c.user.address)).to.equal(9_000n * SCALE);
      expect(await c.chonx.balanceOf(c.user.address)).to.equal(90_000n * SCALE);
    });
    it("G-Synth-67: activation is permanent even if the counter reads lower later", async function () {
      const c = await synth();
      await c.counter.set(T100M);
      await c.s.connect(c.user).forge(1);
      await c.counter.set(0n);
      await c.s.connect(c.user).forge(1);
      expect(await c.s.balanceOf(c.user.address)).to.equal(2n * SCALE);
    });
    it("R-Synth-139: forge(0) is refused even when active", async function () {
      const c = await synth();
      await c.counter.set(T100M);
      await expect(c.s.connect(c.user).forge(0)).to.be.revertedWith("SYNTH: zero forge count");
    });
    it("G-Synth-150/204: transfer to zero is refused; transferFrom spends the allowance", async function () {
      const c = await synth();
      await c.counter.set(T100M);
      await c.s.connect(c.user).forge(2);
      await expect(c.s.connect(c.user).transfer(ethers.ZeroAddress, 1n)).to.be.revertedWith("SYNTH: transfer to zero address");
      await c.s.connect(c.user).approve(c.other.address, SCALE);
      await c.s.connect(c.other).transferFrom(c.user.address, c.other.address, 400n);
      expect(await c.s.allowance(c.user.address, c.other.address)).to.equal(SCALE - 400n);
      expect(await c.s.balanceOf(c.other.address)).to.equal(400n);
    });
  });

  describe("Stake (VinculumFinalisStake)", function () {
    async function stake() {
      const [, owner, other] = await ethers.getSigners();
      const F = await ethers.getContractFactory("TestFixtureERC20");
      const v = await (await ethers.getContractFactory("StakeTestVerifier")).deploy();
      const vc = await F.deploy(0), ch = await F.deploy(0), sy = await F.deploy(0);
      const st = await (await ethers.getContractFactory("VinculumFinalisStake")).deploy(
        await vc.getAddress(), await ch.getAddress(), await sy.getAddress(), await v.getAddress());
      await v.setStake(await st.getAddress());
      await v.setLaunch((await latest()) - 1n);
      await vc.mint(owner.address, 10n ** 24n);
      await vc.connect(owner).approve(await st.getAddress(), 10n ** 24n);
      const id = await st.nextPositionId();
      await st.connect(owner).createPosition(0, 1000n * SCALE, D30);
      return { owner, other, st, id };
    }
    it("T-ST-01: queueExtension through a contract called by the owner is refused (msg.sender, not tx.origin)", async function () {
      const c = await stake();
      const fwd = await (await ethers.getContractFactory("TestForwarder")).deploy();
      const data = c.st.interface.encodeFunctionData("queueExtension", [c.id, D30]);
      await expect(fwd.connect(c.owner).forward(await c.st.getAddress(), data)).to.be.revertedWith("VFS: not owner");
    });
    it("T-ST-03 / R-Stake-346 / G-Stake-325: only the owner applies; it applies at exactly the end; the new term length is recorded", async function () {
      const c = await stake();
      await c.st.connect(c.owner).queueExtension(c.id, 2n * D30);
      const end = (await c.st.positions(c.id)).endTimestamp;
      await network.provider.send("evm_setNextBlockTimestamp", [Number(end - 1n)]);
      await expect(c.st.connect(c.other).applyExtensionIfMatured(c.id)).to.be.revertedWith("VFS: not owner");
      await network.provider.send("evm_setNextBlockTimestamp", [Number(end)]);
      await c.st.connect(c.owner).applyExtensionIfMatured(c.id);
      const p = await c.st.positions(c.id);
      expect(p.startTimestamp).to.equal(end);
      expect(p.durationSecs).to.equal(2n * D30);
      expect(p.endTimestamp).to.equal(end + 2n * D30);
      expect(p.queuedExtensionBps).to.equal(0n);
    });
  });

  describe("Verifier (VinculumFinalisVerifier)", function () {
    it("T-VF-10: deployment configuration through a contract called by the deployer is refused", async function () {
      const [deployer] = await ethers.getSigners();
      const Token = await ethers.getContractFactory("VinculumFinalisToken");
      const a = await Token.deploy("V", "V", 1n), b = await Token.deploy("C", "C", 1n);
      const v = await (await ethers.getContractFactory("VinculumFinalisVerifier")).deploy(await a.getAddress(), await b.getAddress());
      const fwd = await (await ethers.getContractFactory("TestForwarder")).deploy();
      const data = v.interface.encodeFunctionData("configureDevFund", ["Ethereum", deployer.address]);
      await expect(fwd.connect(deployer).forward(await v.getAddress(), data)).to.be.revertedWith("VF: not deployer");
    });
    it("T-VF-09: a price run through a contract called by the poster is refused", async function () {
      const f = await fx();
      const fwd = await (await ethers.getContractFactory("TestForwarder")).deploy();
      const runId = (await f.verifier.lastScheduledRunId()) + 1n;
      const data = f.verifier.interface.encodeFunctionData("applyScheduledPriceRun",
        [runId, [{ environmentId: "Ethereum", canonicalAssetId: ETH, priceUsd18: 2000n * SCALE, success: true }]]);
      await expect(fwd.connect(f.deployer).forward(await f.verifier.getAddress(), data)).to.be.revertedWith("VF-ORC-007: not price poster");
    });
    it("T-VF-15/16 and constants: hard caps, threshold and decay are the Rev 6 values", async function () {
      const f = await fx();
      expect(await f.verifier.getRemainingChonxCap()).to.equal(100_000_000_000n * SCALE);
      expect(await f.verifier.getRemainingVclmCap()).to.equal(10_000_000_000n * SCALE);
      expect(await f.verifier.CHONX_ACTIVATION_THRESHOLD()).to.equal(10_000_000n * SCALE);
      const r0 = await f.verifier.previewEmissionRate(0, 0);
      expect(await f.verifier.previewEmissionRate(0, 30)).to.equal((r0 * 983330000000000000n) / SCALE);
      const c0 = await f.verifier.previewEmissionRate(1, 0);
      expect(await f.verifier.previewEmissionRate(1, 60)).to.equal((((c0 * 983330000000000000n) / SCALE) * 983330000000000000n) / SCALE);
    });
    it("R-Verifier-1141: currentEpoch is 1 right after launch and 2 after ten days", async function () {
      const f = await fx();
      expect(await f.verifier.currentEpoch()).to.equal(1n);
      await mineAt((await f.verifier.protocolLaunchTimestamp()) + 10n * DAY);
      expect(await f.verifier.currentEpoch()).to.equal(2n);
    });
    it("T-VF-02/03 / G-Verifier-1698: CHONX activates at exactly 10M lifetime VCLM and records the block time", async function () {
      const f = await fx();
      await f.counter.set(10_000_000n * SCALE - 1n);
      await f.verifier.syncChonxActivation();
      expect(await f.verifier.chonxActivated()).to.equal(false);
      await f.counter.set(10_000_000n * SCALE);
      await f.verifier.syncChonxActivation();
      expect(await f.verifier.chonxActivated()).to.equal(true);
      expect(await f.verifier.chonxActivationTimestamp()).to.equal(await latest());
    });
    it("G-Verifier-780: a CHONX request before activation is refused with the coded reason", async function () {
      const f = await fx();
      const created = await post(f.verifier, [["Ethereum", ETH, 2000n * SCALE]]);
      await mineAt(created);
      const p = pkg({ recipient: f.recipient.address, out: 1, created });
      await f.verifier.recordFeeAndRac(p);
      await expect(f.verifier.verifyAndMint(p, 0)).to.be.revertedWith("VF-COM-025: CHONX not activated");
    });
    it("G-Verifier-792: a zero Base recipient is refused with VF-ARC-006", async function () {
      const f = await fx();
      const created = await post(f.verifier, [["Ethereum", ETH, 2000n * SCALE]]);
      await mineAt(created);
      const p = pkg({ recipient: ethers.ZeroAddress, created });
      await f.verifier.recordFeeAndRac(p);
      await expect(f.verifier.verifyAndMint(p, 0)).to.be.revertedWith("VF-ARC-006: zero base recipient");
    });
    it("G-Verifier-830 / R-Verifier-839 / G-Verifier-862: non-Base CHONX lock edge at activation plus one day", async function () {
      const f = await fx();
      await post(f.verifier, [["Ethereum", ETH, 2000n * SCALE]]);
      await f.counter.set(10_000_000n * SCALE);
      await f.verifier.syncChonxActivation();
      const act = await f.verifier.chonxActivationTimestamp();
      const margin = await f.verifier.CHONX_SOURCE_CLOCK_MARGIN_SECS();
      expect(margin).to.equal(DAY);
      await mineAt(act + margin + 5n);
      const early = pkg({ recipient: f.recipient.address, out: 1, created: act + margin - 1n });
      await f.verifier.recordFeeAndRac(early);
      await expect(f.verifier.verifyAndMint(early, 0)).to.be.revertedWith("VF-COM-025: lock created before CHONX activation");
      const ok = pkg({ recipient: f.recipient.address, out: 1, created: act + margin });
      const usd = usdOf(SCALE, 18, 2000n * SCALE);
      const want = await f.verifier.previewIssuance(usd, 1, 2, D30, await emissionDay(f.verifier, act + margin));
      expect(await submit(f, ok)).to.equal(want);
      expect(await f.verifier.cumulativeChonxIssued()).to.equal(want);
    });
    it("R-Verifier-863: a CHONX mint that exactly fills the cap succeeds; one unit over is refused", async function () {
      const f = await fx({ harness: true });
      await post(f.verifier, [["Ethereum", ETH, 2000n * SCALE]]);
      await f.counter.set(10_000_000n * SCALE);
      await f.verifier.syncChonxActivation();
      const c = (await f.verifier.chonxActivationTimestamp()) + DAY;
      await mineAt(c + 1n);
      const p = pkg({ recipient: f.recipient.address, out: 1, created: c });
      const want = await f.verifier.previewIssuance(usdOf(SCALE, 18, 2000n * SCALE), 1, 2, D30, await emissionDay(f.verifier, c));
      const CAP = 100_000_000_000n * SCALE;
      await f.verifier.recordFeeAndRac(p);
      await f.verifier.testSetCumulativeChonxIssued(CAP - want + 1n);
      await expect(f.verifier.verifyAndMint(p, 0)).to.be.revertedWith("VF-SUP-015: exceeds CHONX cap");
      await f.verifier.testSetCumulativeChonxIssued(CAP - want);
      await f.verifier.verifyAndMint(p, 0);
      expect(await f.verifier.getRemainingChonxCap()).to.equal(0n);
    });
    it("T-VF-16: a VCLM mint that exactly fills the 10B cap succeeds; one unit over is refused", async function () {
      const f = await fx();
      const created = await post(f.verifier, [["Ethereum", ETH, 2000n * SCALE]]);
      await mineAt(created);
      const p = pkg({ recipient: f.recipient.address, created });
      const want = await f.verifier.previewIssuance(usdOf(SCALE, 18, 2000n * SCALE), 0, 2, D30, await emissionDay(f.verifier, created));
      const CAP = 10_000_000_000n * SCALE;
      await f.verifier.recordFeeAndRac(p);
      await f.counter.set(CAP - want + 1n);
      await expect(f.verifier.verifyAndMint(p, 0)).to.be.revertedWith("VF-SUP-015: exceeds VCLM cap");
      await f.counter.set(CAP - want);
      await f.verifier.verifyAndMint(p, 0);
      expect(await f.verifier.getRemainingVclmCap()).to.equal(0n);
    });
    it("R-Verifier-977: the bare symbol USDC_ is not a stablecoin row (no floor); USDC at $0.90 is refused", async function () {
      const f = await fx();
      const created = await post(f.verifier, [["Ethereum", USDCX, 90n * 10n ** 16n], ["Ethereum", USDC, 90n * 10n ** 16n]]);
      await mineAt(created);
      const x = pkg({ recipient: f.recipient.address, asset: USDCX, dec: 6, cls: 3, gross: 100_000_000n, created });
      const want = await f.verifier.previewIssuance(usdOf(100_000_000n, 6, 90n * 10n ** 16n), 0, 3, D30, await emissionDay(f.verifier, created));
      expect(await submit(f, x)).to.equal(want);
      const u = pkg({ recipient: f.recipient.address, asset: USDC, dec: 6, cls: 3, gross: 100_000_000n, created });
      await expect(f.verifier.recordFeeAndRac(u)).to.be.revertedWith("VF-ORC-005: USDC/USDT scheduled price below $0.95");
    });
  });

  for (const kind of ["CommitmentVaultLock", "BaseCommitmentVaultLock"]) {
    describe(`BaseCVL MUT-41..50 behavior in ${kind}`, function () {
      async function deployCvl() {
        const [, user, dest, devFund] = await ethers.getSigners();
        const F = await ethers.getContractFactory(kind);
        const cvl = kind === "CommitmentVaultLock"
          ? await F.deploy("Ethereum", devFund.address)
          : await F.deploy("Base", devFund.address, ethers.Wallet.createRandom().address, ethers.Wallet.createRandom().address, ethers.Wallet.createRandom().address);
        const t = await (await ethers.getContractFactory("TestTransferFeeERC20")).deploy(0);
        await t.mint(user.address, 10n ** 24n);
        await t.connect(user).approve(await cvl.getAddress(), 10n ** 24n);
        return { user, dest, devFund, cvl, t };
      }
      const lockArgs = (c, token, amount, duration, usd, id = ethers.hexlify(ethers.randomBytes(32))) =>
        [id, c.user.address, 0, ethers.ZeroHash, ethers.ZeroHash, c.dest.address, duration, token, amount, usd];

      it("G-417 / T-BC-02/03/04: Handshake accepts $0.01 and $0.02 and refuses $0.009 and $0.021", async function () {
        const c = await deployCvl();
        const t = await c.t.getAddress();
        await c.cvl.connect(c.user).createErc20Lock(...lockArgs(c, t, 1000n, HOUR, 10n ** 16n));
        await c.cvl.connect(c.user).createErc20Lock(...lockArgs(c, t, 1000n, HOUR, 2n * 10n ** 16n));
        await expect(c.cvl.connect(c.user).createErc20Lock(...lockArgs(c, t, 1000n, HOUR, 9n * 10n ** 15n))).to.be.revertedWith("CVL: handshake usd");
        await expect(c.cvl.connect(c.user).createErc20Lock(...lockArgs(c, t, 1000n, HOUR, 21n * 10n ** 15n))).to.be.revertedWith("CVL: handshake usd");
        await expect(c.cvl.connect(c.user).createErc20Lock(...lockArgs(c, t, 1000n, D30, 9n * 10n ** 15n))).to.be.revertedWith("CVL: standard usd");
      });
      it("R-213: a zero amount is refused with CVL: zero gross", async function () {
        const c = await deployCvl();
        await expect(c.cvl.connect(c.user).createErc20Lock(...lockArgs(c, await c.t.getAddress(), 0n, D30, SCALE))).to.be.revertedWith("CVL: zero gross");
      });
      it("R-217: an amount too small for a fee is refused before transfer, even if the token credits a bonus", async function () {
        const c = await deployCvl();
        const b = await (await ethers.getContractFactory("TestBonusERC20")).deploy(1);
        await b.mint(c.user.address, 1000n);
        await b.connect(c.user).approve(await c.cvl.getAddress(), 1000n);
        await expect(c.cvl.connect(c.user).createErc20Lock(...lockArgs(c, await b.getAddress(), 19n, D30, SCALE))).to.be.revertedWith("CVL: zero fee or principal");
        expect(await b.balanceOf(c.user.address)).to.equal(1000n);
      });
      it("R-227: the fee is recomputed on the received amount; a received amount with zero fee is refused", async function () {
        const c = await deployCvl();
        const t = await (await ethers.getContractFactory("TestTransferFeeERC20")).deploy(500);
        await t.mint(c.user.address, 1000n);
        await t.connect(c.user).approve(await c.cvl.getAddress(), 1000n);
        await expect(c.cvl.connect(c.user).createErc20Lock(...lockArgs(c, await t.getAddress(), 20n, D30, SCALE))).to.be.revertedWith("CVL: zero fee or principal");
      });
      it("R-255 / T-BC-05: release works at exactly maturity, only from the destination itself", async function () {
        const c = await deployCvl();
        const t = await c.t.getAddress();
        const b = ethers.id(kind + "/fwd"), a = ethers.id(kind + "/mat");
        await c.cvl.connect(c.user).createErc20Lock(...lockArgs(c, t, 1000n * SCALE, D30, SCALE, b));
        await c.cvl.connect(c.user).createErc20Lock(...lockArgs(c, t, 1000n * SCALE, D30, SCALE, a));
        const maturity = (await latest()) + D30;
        await network.provider.send("evm_setNextBlockTimestamp", [Number(maturity)]);
        await expect(c.cvl.connect(c.dest).release(a)).to.emit(c.cvl, "PrincipalReleased");
        expect(await c.t.balanceOf(c.dest.address)).to.equal(950n * SCALE);
        const fwd = await (await ethers.getContractFactory("TestForwarder")).deploy();
        const data = c.cvl.interface.encodeFunctionData("release", [b]);
        await expect(fwd.connect(c.dest).forward(await c.cvl.getAddress(), data)).to.be.revertedWith("CVL: destination");
        await c.cvl.connect(c.dest).release(b);
        expect(await c.t.balanceOf(c.dest.address)).to.equal(1900n * SCALE);
      });
      it("R-365: a token that returns no data on transfer is accepted and released", async function () {
        const c = await deployCvl();
        const n = await (await ethers.getContractFactory("TestNoReturnERC20")).deploy();
        await n.mint(c.user.address, 1000n * SCALE);
        await n.connect(c.user).approve(await c.cvl.getAddress(), 1000n * SCALE);
        const id = ethers.id(kind + "/noret");
        await c.cvl.connect(c.user).createErc20Lock(...lockArgs(c, await n.getAddress(), 1000n * SCALE, D30, SCALE, id));
        expect(await n.balanceOf(c.devFund.address)).to.equal(50n * SCALE);
        await mineAt((await latest()) + D30 + 1n);
        await c.cvl.connect(c.dest).release(id);
        expect(await n.balanceOf(c.dest.address)).to.equal(950n * SCALE);
      });
    });
  }
});
