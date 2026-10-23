// Batch fix 2026-10-23: safe-behavior tests for the confirmed findings.
// Each block names the finding it covers. Every test asserts the fixed,
// fail-closed behavior; none pins the old vulnerable behavior.
const { expect } = require("chai");
const { ethers, network } = require("hardhat");
const { finalizeCeremony } = require("./lib/finalizeCeremony.cjs");
const { encodeBlockHeader } = require("./lib/ethProof.cjs");
const FX = require("./fixtures/utxo_local_locks.json");

const SCALE = 10n ** 18n;
const DAY = 86400n;
const D30 = 30n * DAY;
const coder = ethers.AbiCoder.defaultAbiCoder();
const ETH = ethers.id("batchfix/ETH");
const USDC = ethers.id("batchfix/USDC");
const USDCX = ethers.id("batchfix/USDC_");
const ERROR_SELECTOR = "0x08c379a0";
const PANIC_SELECTOR = "0x4e487b71";

async function latest() {
  return BigInt((await ethers.provider.getBlock("latest")).timestamp);
}
async function mineAt(ts) {
  await network.provider.send("evm_setNextBlockTimestamp", [Number(ts)]);
  await network.provider.send("evm_mine");
}

async function fx({ harness = false } = {}) {
  const [deployer, recipient, other, dest] = await ethers.getSigners();
  const Token = await ethers.getContractFactory("VinculumFinalisToken");
  const vclm = await Token.deploy("Vinculum", "VCLM", 10n ** 30n);
  const chonx = await Token.deploy("Chonx", "CHONX", 10n ** 30n);
  const verifier = await (await ethers.getContractFactory(harness ? "VerifierCapEdgeHarness" : "VinculumFinalisVerifier"))
    .deploy(await vclm.getAddress(), await chonx.getAddress());
  const mock = await (await ethers.getContractFactory("MockAlwaysFinalizedVerifier")).deploy();
  const mockOverride = await (await ethers.getContractFactory("MockAlwaysFinalizedVerifier")).deploy();
  const noDevFund = await (await ethers.getContractFactory("MockReaderNoDevFund")).deploy();
  const counter = await (await ethers.getContractFactory("TestStakeRewardCounter")).deploy();
  await vclm.initialize(await verifier.getAddress(), await counter.getAddress());
  await chonx.initialize(await verifier.getAddress(), ethers.ZeroAddress);
  for (const [env, r] of [["Ethereum", mock], ["Optimism", mockOverride], ["Polygon", noDevFund]]) {
    await verifier.registerChainVerifier(env, await r.getAddress());
    await verifier.configureDevFund(env, deployer.address);
    await verifier.registerAssetPrecision(env, ETH, "ETH", 18, 2, 0);
  }
  await verifier.registerAssetPrecision("Ethereum", USDC, "USDC", 6, 3, 0);
  await verifier.registerAssetPrecision("Ethereum", USDCX, "USDC_", 6, 3, 0);
  await verifier.setScheduledPricePoster(deployer.address);
  await finalizeCeremony(verifier);
  return { deployer, recipient, other, dest, vclm, chonx, verifier, mock, mockOverride, noDevFund, counter };
}

// Posts one scheduled run; returns the creation time to use for a lock
// created right after it (one second after the run's block).
async function post(verifier, rows) {
  const runId = (await verifier.lastScheduledRunId()) + 1n;
  await verifier.applyScheduledPriceRun(runId, rows.map(([env, asset, price, success = true]) => ({
    environmentId: env, canonicalAssetId: asset, priceUsd18: success ? price : 0n, success,
  })));
  return (await latest()) + 1n;
}

function pkg({ env = "Ethereum", lockId = ethers.hexlify(ethers.randomBytes(32)), asset = ETH, dec = 18, cls = 2,
  gross = SCALE, duration = D30, recipient, out = 0, created, valuation, racIdentity }) {
  const fee = (gross * 500n) / 10000n;
  const principal = gross - fee;
  return {
    sourceEnvironmentId: env, commitmentVaultLockId: lockId, handshakeAllowanceCount: 3,
    canonicalAssetId: asset, assetPrecision: dec, assetCustodyClass: cls,
    grossAmountSmallestUnits: gross, actualFeeAmountSmallestUnits: fee, principalAmountSmallestUnits: principal,
    feeAssetId: asset, devFundDestination: "dev", feeTransferEvidence: ethers.id("fee"),
    valuationTimestamp: valuation === undefined ? created : valuation, maturityTimestamp: 2n, durationSecs: duration,
    selectedOutputToken: out, baseRecipient: recipient, releaseDestination: "release", chonxActivationReceipt: "0x",
    racIdentity: racIdentity || ethers.hexlify(ethers.randomBytes(32)), priceRecord: "0x", sourceFinalityProof: "0x",
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

async function expectCodedRevert(promise) {
  let err;
  try {
    await promise;
  } catch (e) {
    err = e;
  }
  expect(err, "expected a revert").to.not.equal(undefined);
  const data = (err.data && typeof err.data === "string") ? err.data : (err.error && err.error.data) || "";
  expect(String(err.message)).to.not.match(/panic/i);
  if (data && data !== "0x") {
    expect(data.slice(0, 10)).to.not.equal(PANIC_SELECTOR);
    expect(data.slice(0, 10)).to.equal(ERROR_SELECTOR);
  } else {
    expect(String(err.message)).to.match(/reverted with reason string/);
  }
}

describe("Batch fix 2026-10-23", function () {
  describe("AG-01/02/03: every production non-Base reader refuses finality (environment disabled)", function () {
    it("EVM, UTXO, Stellar, XRP Ledger and Solana readers all revert in verifyFinality", async function () {
      const [deployer] = await ethers.getSigners();
      const refused = (env) => `VF-XCH-006: ${env} settled-history anchor not enforced on-chain; environment disabled`;
      const evm = [["SimpleEthereumLockReader", "Ethereum"], ["OptimismLockReader", "Optimism"], ["ArbitrumLockReader", "Arbitrum"],
        ["PolygonLockReader", "Polygon"], ["BnbSmartChainLockReader", "BNB Smart Chain"], ["AvalancheLockReader", "Avalanche"]];
      for (const [name, env] of evm) {
        const r = await (await ethers.getContractFactory(name)).deploy(deployer.address);
        await expect(r.verifyFinality("0x", "0x")).to.be.revertedWith(refused(env));
      }
      const utxo = { Bitcoin: "BitcoinLockReader", "Bitcoin Cash": "BitcoinCashLockReader", Litecoin: "LitecoinLockReader",
        Dogecoin: "DogecoinLockReader", DigiByte: "DigiByteLockReader", Zcash: "ZcashLockReader" };
      for (const [env, name] of Object.entries(utxo)) {
        const r = await (await ethers.getContractFactory(name)).deploy(FX.chains[env].standard.devFundScript);
        await expect(r.verifyFinality("0x", "0x")).to.be.revertedWith(refused(env));
      }
      const stellar = await (await ethers.getContractFactory("StellarLockReader")).deploy(ethers.id("net"), ethers.id("dev"));
      await expect(stellar.verifyFinality("0x", "0x")).to.be.revertedWith(refused("Stellar"));
      const xrpl = await (await ethers.getContractFactory("XrplLockReader")).deploy("0x" + "11".repeat(20));
      await expect(xrpl.verifyFinality("0x", "0x")).to.be.revertedWith(refused("XRP Ledger"));
      const sol = await (await ethers.getContractFactory("SolanaLockReader")).deploy();
      await expect(sol.verifyFinality("0x", "0x")).to.be.revertedWith("VF-XCH-006: Solana reader blocked");
    });
  });

  describe("AG-09: the proven lock must have paid the configured Dev Fund", function () {
    it("a reader that cannot prove the Dev Fund is refused; a different Dev Fund is refused; the matching one passes", async function () {
      const f = await fx();
      const created = await post(f.verifier, [["Polygon", ETH, 1000n * SCALE], ["Optimism", ETH, 1000n * SCALE]]);
      await mineAt(created);
      const poly = pkg({ env: "Polygon", recipient: f.recipient.address, created });
      await expect(f.verifier.recordFeeAndRac(poly)).to.be.revertedWith("VF-FEE-009: reader cannot prove the lock Dev Fund");
      await f.mockOverride.setDevFundOverride(f.other.address);
      const op = pkg({ env: "Optimism", recipient: f.recipient.address, created });
      await expect(f.verifier.recordFeeAndRac(op)).to.be.revertedWith("VF-FEE-009: lock Dev Fund != configured Dev Fund");
      expect(await f.verifier.isLockRacRecorded("Optimism", op.commitmentVaultLockId)).to.equal(false);
      await f.mockOverride.setDevFundOverride(ethers.ZeroAddress);
      expect(await submit(f, op)).to.be.gt(0n);
    });
  });

  describe("AG-04: one RAC per proven lock, whatever racIdentity the package states", function () {
    it("a second package for the same lock with a new racIdentity cannot record a second RAC; mint happens once", async function () {
      const f = await fx();
      const created = await post(f.verifier, [["Ethereum", ETH, 1000n * SCALE]]);
      await mineAt(created);
      const p1 = pkg({ recipient: f.recipient.address, created, racIdentity: ethers.id("A") });
      const p2 = { ...p1, racIdentity: ethers.id("B") };
      await f.verifier.recordFeeAndRac(p1);
      await expect(f.verifier.recordFeeAndRac(p2)).to.be.revertedWith("VF-RAC-001: RAC already recorded");
      expect(await f.verifier.recordedRacs(await f.verifier.racKey("Ethereum", p1.commitmentVaultLockId))).to.equal(true);
      await f.verifier.verifyAndMint(p2, 0);
      await expect(f.verifier.verifyAndMint(p1, 0)).to.be.revertedWith("VF-XCH-013: replay");
    });
  });

  describe("AG-05: valuation uses the proven creation time", function () {
    it("a package Valuation Timestamp other than the proven creation time is refused", async function () {
      const f = await fx();
      const created = await post(f.verifier, [["Ethereum", ETH, 1000n * SCALE]]);
      await mineAt(created);
      for (const v of [1n, created - 1n, created + 1n]) {
        const p = pkg({ recipient: f.recipient.address, created, valuation: v });
        await expect(f.verifier.recordFeeAndRac(p)).to.be.revertedWith("VF-ORC-011: valuation timestamp != proven lock creation time");
      }
    });
    it("a proven creation time in the future is refused", async function () {
      const f = await fx();
      const created = (await post(f.verifier, [["Ethereum", ETH, 1000n * SCALE]])) + 1000n;
      const p = pkg({ recipient: f.recipient.address, created });
      await expect(f.verifier.recordFeeAndRac(p)).to.be.revertedWith("VF-ORC-011: lock creation time in the future");
    });
    it("emission follows the proven day: a lock created 30 days after launch mints the day-30 amount, less than day 0", async function () {
      const f = await fx();
      const launch = await f.verifier.protocolLaunchTimestamp();
      await post(f.verifier, [["Ethereum", ETH, 1000n * SCALE]]);
      const created = launch + D30 + 5n;
      await mineAt(created);
      const p = pkg({ recipient: f.recipient.address, created });
      const usd = usdOf(SCALE, 18, 1000n * SCALE);
      const day30 = await f.verifier.previewIssuance(usd, 0, 2, D30, 30);
      const day0 = await f.verifier.previewIssuance(usd, 0, 2, D30, 0);
      expect(day30).to.be.lt(day0);
      expect(await submit(f, p)).to.equal(day30);
    });
  });

  describe("AG-06 and COMB-01/02/03: price in effect at lock creation", function () {
    it("COMB-01: a lock created before any usable price is refused forever, even after a later run", async function () {
      const f = await fx();
      const created = await latest();
      await post(f.verifier, [["Ethereum", ETH, 1000n * SCALE]]);
      const p = pkg({ recipient: f.recipient.address, created });
      await expect(f.verifier.recordFeeAndRac(p)).to.be.revertedWith("VF-ORC-005: no usable scheduled price");
      await post(f.verifier, [["Ethereum", ETH, 2000n * SCALE]]);
      await expect(f.verifier.recordFeeAndRac(p)).to.be.revertedWith("VF-ORC-005: no usable scheduled price");
      expect(await f.verifier.isLockRacRecorded("Ethereum", p.commitmentVaultLockId)).to.equal(false);
    });
    it("COMB-02: a failed run in effect at creation refuses the lock, and a later success does not cure it", async function () {
      const f = await fx();
      await post(f.verifier, [["Ethereum", ETH, 1000n * SCALE]]);
      const created = await post(f.verifier, [["Ethereum", ETH, 0n, false]]);
      await mineAt(created);
      await post(f.verifier, [["Ethereum", ETH, 1000n * SCALE]]);
      const p = pkg({ recipient: f.recipient.address, created });
      await expect(f.verifier.recordFeeAndRac(p)).to.be.revertedWith("VF-ORC-005: no usable scheduled price");
      expect(await f.verifier.isLockRacRecorded("Ethereum", p.commitmentVaultLockId)).to.equal(false);
    });
    it("AG-06: a later run does not reprice an earlier lock; a lock created after it uses the new price", async function () {
      const f = await fx();
      const c1 = await post(f.verifier, [["Ethereum", ETH, 1000n * SCALE]]);
      await mineAt(c1);
      const c2 = await post(f.verifier, [["Ethereum", ETH, 500n * SCALE]]);
      await mineAt(c2);
      const a = pkg({ recipient: f.recipient.address, created: c1 });
      const b = pkg({ recipient: f.recipient.address, created: c2 });
      expect(await submit(f, a)).to.equal(await f.verifier.previewIssuance(usdOf(SCALE, 18, 1000n * SCALE), 0, 2, D30, 0));
      expect(await submit(f, b)).to.equal(await f.verifier.previewIssuance(usdOf(SCALE, 18, 500n * SCALE), 0, 2, D30, 0));
      expect(await f.verifier.priceInEffectAt("Ethereum", ETH, c1)).to.equal(1000n * SCALE);
    });
    it("COMB-03a: a USDC lock created at $1.00 still mints at $1.00 after a later depeg run", async function () {
      const f = await fx();
      const created = await post(f.verifier, [["Ethereum", USDC, SCALE]]);
      await mineAt(created);
      await post(f.verifier, [["Ethereum", USDC, 90n * SCALE / 100n]]);
      const p = pkg({ asset: USDC, dec: 6, cls: 3, gross: 100_000_000n, recipient: f.recipient.address, created });
      expect(await submit(f, p)).to.equal(await f.verifier.previewIssuance(100n * SCALE, 0, 3, D30, 0));
    });
    it("COMB-03b: a USDC lock created during a depeg (< $0.95) stays refused after recovery", async function () {
      const f = await fx();
      const created = await post(f.verifier, [["Ethereum", USDC, 94n * SCALE / 100n]]);
      await mineAt(created);
      await post(f.verifier, [["Ethereum", USDC, SCALE]]);
      const p = pkg({ asset: USDC, dec: 6, cls: 3, gross: 100_000_000n, recipient: f.recipient.address, created });
      await expect(f.verifier.recordFeeAndRac(p)).to.be.revertedWith("VF-ORC-005: USDC/USDT scheduled price below $0.95");
      expect(await f.verifier.isLockRacRecorded("Ethereum", p.commitmentVaultLockId)).to.equal(false);
      expect(await f.vclm.balanceOf(f.recipient.address)).to.equal(0n);
    });
    it("$0.95 floor: exactly $0.95 and $0.97 mint at the posted price, never a hardcoded $1", async function () {
      const f = await fx();
      for (const cents of [95n, 97n]) {
        const created = await post(f.verifier, [["Ethereum", USDC, cents * SCALE / 100n]]);
        await mineAt(created);
        const p = pkg({ asset: USDC, dec: 6, cls: 3, gross: 100_000_000n, recipient: f.recipient.address, created });
        expect(await submit(f, p)).to.equal(await f.verifier.previewIssuance(cents * SCALE, 0, 3, D30, 0));
      }
    });
  });

  describe("AG-07: scheduled run ids are sequential", function () {
    it("a skipped or maximal run id is refused, and a reverted run does not consume an id", async function () {
      const f = await fx();
      const last = await f.verifier.lastScheduledRunId();
      const row = [{ environmentId: "Ethereum", canonicalAssetId: ETH, priceUsd18: SCALE, success: true }];
      await expect(f.verifier.applyScheduledPriceRun(last + 2n, row)).to.be.revertedWith("VF-ORC-001: run id must be the next in sequence");
      await expect(f.verifier.applyScheduledPriceRun((1n << 64n) - 1n, row)).to.be.revertedWith("VF-ORC-001: run id must be the next in sequence");
      const bad = [{ environmentId: "Ethereum", canonicalAssetId: ethers.id("not registered"), priceUsd18: SCALE, success: true }];
      await expect(f.verifier.applyScheduledPriceRun(last + 1n, bad)).to.be.revertedWith("VF-REG-001: asset not in registry");
      expect(await f.verifier.lastScheduledRunId()).to.equal(last);
      await f.verifier.applyScheduledPriceRun(last + 1n, row);
      expect(await f.verifier.lastScheduledRunId()).to.equal(last + 1n);
    });
  });

  describe("FZ-04: oversized gross is a coded error, not an arithmetic panic", function () {
    it("gross above max/1e18 reverts VF-COM-011: gross out of range", async function () {
      const f = await fx();
      const created = await post(f.verifier, [["Ethereum", ETH, SCALE]]);
      await mineAt(created);
      const gross = ethers.MaxUint256 / SCALE + 1n;
      const p = pkg({ recipient: f.recipient.address, created, gross });
      await expect(f.verifier.recordFeeAndRac(p)).to.be.revertedWith("VF-COM-011: gross out of range");
      await expectCodedRevert(f.verifier.recordFeeAndRac(pkg({ recipient: f.recipient.address, created, gross: ethers.MaxUint256 })));
    });
  });

  describe("FZ-06: ExecutionHeader RLP parsing fails with coded errors", function () {
    it("every truncation of a real header, random bytes and oversized length prefixes revert with a reason string", async function () {
      const h = await (await ethers.getContractFactory("TestExecutionHeaderHarness")).deploy();
      const raw = await network.provider.send("eth_getBlockByNumber", ["latest", false]);
      const rlp = encodeBlockHeader(raw);
      const [hash] = await h.open(rlp);
      expect(hash).to.equal(ethers.keccak256(rlp));
      const bytes = ethers.getBytes(rlp);
      for (let n = 0; n < bytes.length; n += 7) {
        await expectCodedRevert(h.open(ethers.hexlify(bytes.slice(0, n))));
      }
      const crafted = ["0xf9ffff", "0xf9ffffb9ffff", "0xc5b9ffff0000", "0xf8", "0xc1b8", "0xc2b8ff", "0xc4bbffffffff",
        "0xf90010" + "a0".repeat(16)];
      for (const c of crafted) await expectCodedRevert(h.open(c));
      let seed = 20261023n;
      for (let i = 0; i < 40; i++) {
        const len = Number(seed % 90n) + 2;
        const b = new Uint8Array(len);
        for (let j = 0; j < len; j++) {
          seed = (seed * 6364136223846793005n + 1442695040888963407n) % (1n << 64n);
          b[j] = Number(seed >> 56n);
        }
        b[0] = 0xc0 | (b[0] & 0x3f);
        await expectCodedRevert(h.open(ethers.hexlify(b)));
      }
    });
  });

  describe("FZ-07: UTXO input count is bounded before allocation", function () {
    const PROOF = "tuple(bytes header, bytes coinbaseTx, bytes32[] coinbaseBranch, bytes lockTx, bytes32[] lockBranch, uint256 lockIndex, bytes redeemScript, bytes payload, uint256 durationSecs)";
    const NAME = { Bitcoin: "BitcoinLockReader", "Bitcoin Cash": "BitcoinCashLockReader", Litecoin: "LitecoinLockReader",
      Dogecoin: "DogecoinLockReader", DigiByte: "DigiByteLockReader", Zcash: "ZcashLockReader" };
    const enc = (p) => coder.encode([PROOF], [[p.header, p.coinbaseTx, p.coinbaseBranch, p.lockTx, p.lockBranch, p.lockIndex, p.redeemScript, p.payload, p.durationSecs]]);
    const bloat = (tx, at) => {
      const b = ethers.getBytes(tx);
      return ethers.hexlify(ethers.concat([b.slice(0, at), "0xfeffffff7f", b.slice(at + 1)]));
    };
    for (const env of Object.keys(NAME)) {
      it(`${env}: a huge input count in the lock or coinbase transaction reverts VF-XCH-011: input count`, async function () {
        const S = FX.chains[env].standard;
        const r = await (await ethers.getContractFactory(NAME[env])).deploy(S.devFundScript);
        const at = env === "Zcash" ? 20 : 4;
        await expect(r.extractFacts(enc({ ...S, lockTx: bloat(S.lockTx, at) }))).to.be.revertedWith("VF-XCH-011: input count");
        await expect(r.extractFacts(enc({ ...S, coinbaseTx: bloat(S.coinbaseTx, at) }))).to.be.revertedWith("VF-XCH-011: input count");
      });
    }
  });

  for (const kind of ["CommitmentVaultLock", "BaseCommitmentVaultLock"]) {
    describe(`AG-08: rebasing and transfer-exactness in ${kind}`, function () {
      async function deployCvl() {
        const [deployer, user, dest, devFund] = await ethers.getSigners();
        const F = await ethers.getContractFactory(kind);
        const cvl = kind === "CommitmentVaultLock"
          ? await F.deploy("Ethereum", devFund.address)
          : await F.deploy("Base", devFund.address, ethers.Wallet.createRandom().address, ethers.Wallet.createRandom().address, ethers.Wallet.createRandom().address);
        return { deployer, user, dest, devFund, cvl };
      }
      async function lock(c, token, amount) {
        const id = ethers.hexlify(ethers.randomBytes(32));
        await token.connect(c.user).approve(await c.cvl.getAddress(), amount);
        await c.cvl.connect(c.user).createErc20Lock(id, c.user.address, 0, ethers.ZeroHash, ethers.ZeroHash, c.dest.address,
          D30, await token.getAddress(), amount, SCALE);
        return id;
      }
      async function mature() {
        await mineAt((await latest()) + D30 + 1n);
      }

      it("an exact token: fee reaches the Dev Fund exactly and release pays the exact principal", async function () {
        const c = await deployCvl();
        const t = await (await ethers.getContractFactory("TestTransferFeeERC20")).deploy(0);
        await t.mint(c.user.address, 1000n * SCALE);
        const id = await lock(c, t, 1000n * SCALE);
        expect(await t.balanceOf(c.devFund.address)).to.equal(50n * SCALE);
        expect(await c.cvl.owedPrincipal(await t.getAddress())).to.equal(950n * SCALE);
        await mature();
        await expect(c.cvl.connect(c.dest).release(id)).to.emit(c.cvl, "PrincipalReleased")
          .withArgs(id, c.dest.address, await t.getAddress(), 950n * SCALE);
        expect(await t.balanceOf(c.dest.address)).to.equal(950n * SCALE);
        expect(await c.cvl.owedPrincipal(await t.getAddress())).to.equal(0n);
      });

      it("a fee-on-transfer token is refused (the Dev Fund would be short)", async function () {
        const c = await deployCvl();
        const t = await (await ethers.getContractFactory("TestTransferFeeERC20")).deploy(100);
        await t.mint(c.user.address, 1000n * SCALE);
        await t.connect(c.user).approve(await c.cvl.getAddress(), 1000n * SCALE);
        await expect(c.cvl.connect(c.user).createErc20Lock(ethers.id("fot"), c.user.address, 0, ethers.ZeroHash, ethers.ZeroHash,
          c.dest.address, D30, await t.getAddress(), 1000n * SCALE, SCALE)).to.be.revertedWith("CVL: Dev Fund fee short");
      });

      it("a negative rebase blocks new locks and releases pay a pro-rata share; later lockers are not robbed", async function () {
        const c = await deployCvl();
        const t = await (await ethers.getContractFactory("TestRebasingERC20")).deploy();
        await t.mint(c.user.address, 3000n * SCALE);
        const a = await lock(c, t, 1000n * SCALE);
        const b = await lock(c, t, 1000n * SCALE);
        const token = await t.getAddress();
        const owed = await c.cvl.owedPrincipal(token);
        expect(owed).to.equal(1900n * SCALE);
        await t.rebase((await t.pooled()) / 2n);
        await t.connect(c.user).approve(await c.cvl.getAddress(), 1000n * SCALE);
        await expect(c.cvl.connect(c.user).createErc20Lock(ethers.id("late"), c.user.address, 0, ethers.ZeroHash, ethers.ZeroHash,
          c.dest.address, D30, token, 1000n * SCALE, SCALE)).to.be.revertedWith("CVL: token balance below owed principal");
        await mature();
        const bal = await t.balanceOf(await c.cvl.getAddress());
        const payA = (950n * SCALE * bal) / owed;
        await expect(c.cvl.connect(c.dest).release(a)).to.emit(c.cvl, "PrincipalReleasedProRata").withArgs(a, 950n * SCALE, payA, bal, owed);
        const bal2 = await t.balanceOf(await c.cvl.getAddress());
        const payB = (950n * SCALE * bal2) / (owed - 950n * SCALE);
        await expect(c.cvl.connect(c.dest).release(b)).to.emit(c.cvl, "PrincipalReleasedProRata");
        expect(payB).to.be.gte(payA - 2n);
        expect(payB).to.be.lte(payA + 2n);
        expect(await c.cvl.owedPrincipal(token)).to.equal(0n);
      });

      it("a positive rebase pays exactly the principal and leaves the surplus in the contract", async function () {
        const c = await deployCvl();
        const t = await (await ethers.getContractFactory("TestRebasingERC20")).deploy();
        await t.mint(c.user.address, 1000n * SCALE);
        const id = await lock(c, t, 1000n * SCALE);
        await t.rebase((await t.pooled()) * 2n);
        await mature();
        const token = await t.getAddress();
        await expect(c.cvl.connect(c.dest).release(id)).to.emit(c.cvl, "PrincipalReleased").withArgs(id, c.dest.address, token, 950n * SCALE);
        const got = await t.balanceOf(c.dest.address);
        expect(got).to.be.gte(950n * SCALE - 1n);
        expect(got).to.be.lte(950n * SCALE);
        expect(await t.balanceOf(await c.cvl.getAddress())).to.be.gte(949n * SCALE);
        expect(await c.cvl.owedPrincipal(token)).to.equal(0n);
      });
    });
  }
});
