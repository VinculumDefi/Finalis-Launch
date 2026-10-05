const { expect } = require("chai");
const { ethers } = require("hardhat");

const SCALE = 10n ** 18n;
const HOUR = 3600n;
const DAY30 = 2592000n;
const HANDSHAKE_BPS = 250n;
const STANDARD_BPS = 500n;

function feeOf(gross, bps) {
  return (gross * bps) / 10000n;
}

function encodeLockProof({ lockId, gross, fee, principal, duration, created = 1n, maturity = 2n }) {
  return ethers.AbiCoder.defaultAbiCoder().encode(
    ["bytes32", "uint256", "uint256", "uint256", "uint256", "uint256", "uint256"],
    [lockId, gross, fee, principal, duration, created, maturity]
  );
}

function encodePrice(priceUsd18) {
  return ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [priceUsd18]);
}

async function deployVerifierFixture({ finalize = true } = {}) {
  const [deployer, recipient] = await ethers.getSigners();
  const Token = await ethers.getContractFactory("VinculumFinalisToken");
  const vclm = await Token.deploy("Vinculum", "VCLM", 10n ** 30n);
  const chonx = await Token.deploy("Chonx", "CHONX", 10n ** 30n);
  const Verifier = await ethers.getContractFactory("VinculumFinalisVerifier");
  const verifier = await Verifier.deploy(await vclm.getAddress(), await chonx.getAddress());
  const Mock = await ethers.getContractFactory("MockAlwaysFinalizedVerifier");
  const mock = await Mock.deploy();

  const Stake = await ethers.getContractFactory("VinculumFinalisStake");
  const launchTimestamp = (await ethers.provider.getBlock("latest")).timestamp;
  const stake = await Stake.deploy(
    await vclm.getAddress(),
    await chonx.getAddress(),
    await vclm.getAddress(),
    await verifier.getAddress(),
    launchTimestamp
  );
  await vclm.initialize(await verifier.getAddress(), await stake.getAddress());
  await chonx.initialize(await verifier.getAddress(), ethers.ZeroAddress);

  await verifier.registerChainVerifier("Bitcoin", await mock.getAddress());
  await verifier.registerChainVerifier("Ethereum", await mock.getAddress());
  await verifier.registerChainVerifier("Base", await mock.getAddress());
  await verifier.configureDevFund("Bitcoin", deployer.address);
  await verifier.configureDevFund("Ethereum", deployer.address);
  await verifier.configureDevFund("Base", deployer.address);
  await verifier.setScheduledPricePoster(deployer.address);

  if (finalize) {
    await verifier.finalize();
  }

  return { deployer, recipient, vclm, chonx, verifier, mock, stake };
}

async function writeScheduledPrice(verifier, { env, assetId, priceUsd18, runId = 1n, success = true }) {
  await verifier.applyScheduledPriceRun(runId, [
    {
      environmentId: env,
      canonicalAssetId: assetId,
      priceUsd18: success ? priceUsd18 : 0n,
      success,
    },
  ]);
}

async function registerAsset(verifier, { env, assetId, symbol, decimals, custodyClass = 3, custodyPath = 0 }) {
  // registerAssetPrecision is onlyDuringDeployment — tests that need it must call before finalize.
  // This helper is used from fixtures that have not finalized yet, or via a fresh deploy.
  await verifier.registerAssetPrecision(env, assetId, symbol, decimals, custodyClass, custodyPath);
}

function buildPkg({
  env,
  lockId,
  identity,
  allowance,
  assetId,
  precision,
  custodyClass,
  gross,
  duration,
  recipient,
  racIdentity,
  priceRecord = "0x",
}) {
  const bps = duration === HOUR ? HANDSHAKE_BPS : STANDARD_BPS;
  const fee = feeOf(gross, bps);
  const principal = gross - fee;
  const lockEventProof = encodeLockProof({ lockId, gross, fee, principal, duration });
  return {
    sourceEnvironmentId: env,
    commitmentVaultLockId: lockId,
    handshakeIdentity: identity,
    handshakeAllowanceCount: allowance,
    canonicalAssetId: assetId,
    assetPrecision: precision,
    assetCustodyClass: custodyClass,
    grossAmountSmallestUnits: gross,
    actualFeeAmountSmallestUnits: fee,
    principalAmountSmallestUnits: principal,
    feeAssetId: assetId,
    devFundDestination: "dev",
    feeTransferEvidence: ethers.id("fee"),
    valuationTimestamp: 1n,
    maturityTimestamp: 2n,
    durationSecs: duration,
    selectedOutputToken: 0,
    baseRecipient: recipient,
    releaseDestination: "release",
    chonxActivationReceipt: "0x",
    racIdentity,
    priceRecord,
    sourceFinalityProof: "0x",
    lockEventProof,
  };
}

describe("CL-11 · handshake allowance lookup on Base", function () {
  it("wrong package allowance reverts", async function () {
    const [deployer, recipient] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("VinculumFinalisToken");
    const vclm = await Token.deploy("V", "V", 10n ** 30n);
    const chonx = await Token.deploy("C", "C", 10n ** 30n);
    const Verifier = await ethers.getContractFactory("VinculumFinalisVerifier");
    const verifier = await Verifier.deploy(await vclm.getAddress(), await chonx.getAddress());
    const Mock = await ethers.getContractFactory("MockAlwaysFinalizedVerifier");
    const mock = await Mock.deploy();
    const Stake = await ethers.getContractFactory("VinculumFinalisStake");
    const t0 = (await ethers.provider.getBlock("latest")).timestamp;
    const stake = await Stake.deploy(
      await vclm.getAddress(),
      await chonx.getAddress(),
      await vclm.getAddress(),
      await verifier.getAddress(),
      t0
    );
    await vclm.initialize(await verifier.getAddress(), await stake.getAddress());
    await chonx.initialize(await verifier.getAddress(), ethers.ZeroAddress);

    const assetId = ethers.id("BTC");
    await verifier.registerAssetPrecision("Bitcoin", assetId, "BTC", 8, 2, 0);
    const priceRecord = encodePrice(30000n * SCALE);
    await verifier.registerChainVerifier("Bitcoin", await mock.getAddress());
    await verifier.configureDevFund("Bitcoin", deployer.address);
    await verifier.setScheduledPricePoster(deployer.address);
    await verifier.finalize();
    await writeScheduledPrice(verifier, { env: "Bitcoin", assetId, priceUsd18: 30000n * SCALE, runId: 1n });

    // Bitcoin mechanism allowance is 1; package claims 3
    const gross = 100000n; // 0.001 BTC * $30k = $30
    const pkg = buildPkg({
      env: "Bitcoin",
      lockId: ethers.id("lock-wrong-allow"),
      identity: "btc-id-1",
      allowance: 3,
      assetId,
      precision: 8,
      custodyClass: 2,
      gross,
      duration: DAY30,
      recipient: recipient.address,
      racIdentity: ethers.id("rac-wrong-allow"),
      priceRecord,
    });
    await expect(verifier.recordFeeAndRac(pkg)).to.be.revertedWith(
      "VF-COM-006: handshake allowance mismatch"
    );
  });

  it("handshake consume only on 1h success", async function () {
    const [deployer, recipient] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("VinculumFinalisToken");
    const vclm = await Token.deploy("V", "V", 10n ** 30n);
    const chonx = await Token.deploy("C", "C", 10n ** 30n);
    const Verifier = await ethers.getContractFactory("VinculumFinalisVerifier");
    const verifier = await Verifier.deploy(await vclm.getAddress(), await chonx.getAddress());
    const Mock = await ethers.getContractFactory("MockAlwaysFinalizedVerifier");
    const mock = await Mock.deploy();
    const Stake = await ethers.getContractFactory("VinculumFinalisStake");
    const t0 = (await ethers.provider.getBlock("latest")).timestamp;
    const stake = await Stake.deploy(
      await vclm.getAddress(),
      await chonx.getAddress(),
      await vclm.getAddress(),
      await verifier.getAddress(),
      t0
    );
    await vclm.initialize(await verifier.getAddress(), await stake.getAddress());
    await chonx.initialize(await verifier.getAddress(), ethers.ZeroAddress);

    const assetId = ethers.id("BTC");
    await verifier.registerAssetPrecision("Bitcoin", assetId, "BTC", 8, 2, 0);
    // Handshake needs ~$1: 3334 sat * $30000 ≈ $1.0002
    const priceRecord = encodePrice(30000n * SCALE);
    await verifier.registerChainVerifier("Bitcoin", await mock.getAddress());
    await verifier.configureDevFund("Bitcoin", deployer.address);
    await verifier.setScheduledPricePoster(deployer.address);
    await verifier.finalize();
    await writeScheduledPrice(verifier, { env: "Bitcoin", assetId, priceUsd18: 30000n * SCALE, runId: 1n });

    const identity = "btc-handshake-id";
    const hsGross = 3334n;
    const stdGross = 100000n;

    // Standard (30d) success must NOT consume handshake allowance
    const stdPkg = buildPkg({
      env: "Bitcoin",
      lockId: ethers.id("lock-std"),
      identity,
      allowance: 1,
      assetId,
      precision: 8,
      custodyClass: 2,
      gross: stdGross,
      duration: DAY30,
      recipient: recipient.address,
      racIdentity: ethers.id("rac-std"),
      priceRecord,
    });
    await verifier.recordFeeAndRac(stdPkg);
    await verifier.verifyAndMint(stdPkg, 0);
    expect(await verifier.getHandshakeUsage(identity)).to.equal(0n);

    // One-hour Handshake success consumes exactly once
    const hsPkg = buildPkg({
      env: "Bitcoin",
      lockId: ethers.id("lock-hs"),
      identity,
      allowance: 1,
      assetId,
      precision: 8,
      custodyClass: 2,
      gross: hsGross,
      duration: HOUR,
      recipient: recipient.address,
      racIdentity: ethers.id("rac-hs"),
      priceRecord,
    });
    await verifier.recordFeeAndRac(hsPkg);
    await verifier.verifyAndMint(hsPkg, 0);
    expect(await verifier.getHandshakeUsage(identity)).to.equal(1n);

    // Second Handshake by same identity is exhausted
    const hsPkg2 = buildPkg({
      env: "Bitcoin",
      lockId: ethers.id("lock-hs-2"),
      identity,
      allowance: 1,
      assetId,
      precision: 8,
      custodyClass: 2,
      gross: hsGross,
      duration: HOUR,
      recipient: recipient.address,
      racIdentity: ethers.id("rac-hs-2"),
      priceRecord,
    });
    await verifier.recordFeeAndRac(hsPkg2);
    await expect(verifier.verifyAndMint(hsPkg2, 0)).to.be.revertedWith(
      "VF-COM-007: handshake allowance exhausted"
    );
    expect(await verifier.getHandshakeUsage(identity)).to.equal(1n);
  });
});

// Ethereum USDC/USDT: scheduled prices like every other asset; no $1 substitute.
async function deployStableFixture() {
  const [deployer, recipient] = await ethers.getSigners();
  const Token = await ethers.getContractFactory("VinculumFinalisToken");
  const vclm = await Token.deploy("V", "V", 10n ** 30n);
  const chonx = await Token.deploy("C", "C", 10n ** 30n);
  const Verifier = await ethers.getContractFactory("VinculumFinalisVerifier");
  const verifier = await Verifier.deploy(await vclm.getAddress(), await chonx.getAddress());
  const Mock = await ethers.getContractFactory("MockAlwaysFinalizedVerifier");
  const mock = await Mock.deploy();
  const Stake = await ethers.getContractFactory("VinculumFinalisStake");
  const t0 = (await ethers.provider.getBlock("latest")).timestamp;
  const stake = await Stake.deploy(
    await vclm.getAddress(),
    await chonx.getAddress(),
    await vclm.getAddress(),
    await verifier.getAddress(),
    t0
  );
  await vclm.initialize(await verifier.getAddress(), await stake.getAddress());
  await chonx.initialize(await verifier.getAddress(), ethers.ZeroAddress);

  const usdc = ethers.id("USDC");
  const usdt = ethers.id("USDT");
  await verifier.registerAssetPrecision("Ethereum", usdc, "USDC", 6, 1, 1);
  await verifier.registerAssetPrecision("Ethereum", usdt, "USDT", 6, 1, 1);
  await verifier.registerChainVerifier("Ethereum", await mock.getAddress());
  await verifier.configureDevFund("Ethereum", deployer.address);
  await verifier.setScheduledPricePoster(deployer.address);
  await verifier.finalize();
  return { deployer, recipient, vclm, verifier, usdc, usdt };
}

function stablePkg({ assetId, lockName, gross, duration = DAY30, recipient, priceRecord = "0x" }) {
  return buildPkg({
    env: "Ethereum",
    lockId: ethers.id(lockName),
    identity: `eth-${lockName}`,
    allowance: 3,
    assetId,
    precision: 6,
    custodyClass: 1,
    gross,
    duration,
    recipient,
    racIdentity: ethers.id(`rac-${lockName}`),
    priceRecord,
  });
}

function lockKey(env, lockName) {
  return ethers.keccak256(ethers.solidityPacked(["string", "bytes32"], [env, ethers.id(lockName)]));
}

const STABLE_BELOW = "VF-ORC-005: USDC/USDT scheduled price below $0.95";

describe("CL-01 / VF-ORC · Ethereum USDC/USDT priced from scheduled runs", function () {
  it("USDC without a scheduled price fails closed; no $1 substitute", async function () {
    const { recipient, verifier, usdc } = await deployStableFixture();
    const pkg = stablePkg({ assetId: usdc, lockName: "usdc-noprice", gross: 20_000_000n, recipient: recipient.address });
    await expect(verifier.recordFeeAndRac(pkg)).to.be.revertedWith("VF-ORC-005: no usable scheduled price");
  });

  it("USDC/USDT value = token amount x scheduled price; S1 stays 1.5x", async function () {
    const { recipient, vclm, verifier, usdc, usdt } = await deployStableFixture();
    const usdcPrice = 999_000_000_000_000_000n; // $0.999
    const usdtPrice = 1_002_000_000_000_000_000n; // $1.002
    await verifier.applyScheduledPriceRun(1n, [
      { environmentId: "Ethereum", canonicalAssetId: usdc, priceUsd18: usdcPrice, success: true },
      { environmentId: "Ethereum", canonicalAssetId: usdt, priceUsd18: usdtPrice, success: true },
    ]);
    expect(await verifier.S1_MULTIPLIER_BPS()).to.equal(15000n);

    for (const [assetId, price, name] of [
      [usdc, usdcPrice, "usdc-priced"],
      [usdt, usdtPrice, "usdt-priced"],
    ]) {
      const gross = 20_000_000n; // 20 tokens
      const pkg = stablePkg({ assetId, lockName: name, gross, recipient: recipient.address, priceRecord: encodePrice(price) });
      const before = await vclm.balanceOf(recipient.address);
      await verifier.recordFeeAndRac(pkg);
      await verifier.verifyAndMint(pkg, 0);
      const usd = (20n * SCALE * price) / SCALE;
      const expected = await verifier.previewIssuance(usd, 0, 1, DAY30, 0);
      // $1-flat valuation would give a different amount; the scheduled price decides.
      expect(expected).to.not.equal(await verifier.previewIssuance(20n * SCALE, 0, 1, DAY30, 0));
      expect((await vclm.balanceOf(recipient.address)) - before).to.equal(expected);
      const binding = await verifier.lockReferencePrices(lockKey("Ethereum", name));
      expect(binding.bound).to.equal(true);
      expect(binding.priceUsd18).to.equal(price);
    }
  });

  it("last successful price below $0.95 is unavailable until a later run >= $0.95", async function () {
    const { recipient, vclm, verifier, usdt } = await deployStableFixture();
    const gross = 20_000_000n;
    await writeScheduledPrice(verifier, { env: "Ethereum", assetId: usdt, priceUsd18: 949_999_999_999_999_999n, runId: 1n });
    const pkg = stablePkg({ assetId: usdt, lockName: "usdt-depeg", gross, recipient: recipient.address });
    await expect(verifier.recordFeeAndRac(pkg)).to.be.revertedWith(STABLE_BELOW);

    // Failed run keeps it unavailable (fail closed).
    await writeScheduledPrice(verifier, { env: "Ethereum", assetId: usdt, priceUsd18: 0n, runId: 2n, success: false });
    await expect(verifier.recordFeeAndRac(pkg)).to.be.revertedWith("VF-ORC-005: no usable scheduled price");

    // Still below on the next successful run.
    await writeScheduledPrice(verifier, { env: "Ethereum", assetId: usdt, priceUsd18: 900_000_000_000_000_000n, runId: 3n });
    await expect(verifier.recordFeeAndRac(pkg)).to.be.revertedWith(STABLE_BELOW);

    // Exactly $0.95 restores availability; valued at $0.95, not $1.
    const p95 = 950_000_000_000_000_000n;
    await writeScheduledPrice(verifier, { env: "Ethereum", assetId: usdt, priceUsd18: p95, runId: 4n });
    await verifier.recordFeeAndRac(pkg);
    await verifier.verifyAndMint(pkg, 0);
    const expected = await verifier.previewIssuance((20n * SCALE * p95) / SCALE, 0, 1, DAY30, 0);
    expect(await vclm.balanceOf(recipient.address)).to.equal(expected);
  });

  it("a lock already bound keeps its lock-creation price after a sub-$0.95 run", async function () {
    const { recipient, vclm, verifier, usdc } = await deployStableFixture();
    const p1 = 1_000_000_000_000_000_000n;
    await writeScheduledPrice(verifier, { env: "Ethereum", assetId: usdc, priceUsd18: p1, runId: 1n });
    const bound = stablePkg({ assetId: usdc, lockName: "usdc-bound", gross: 20_000_000n, recipient: recipient.address });
    await verifier.recordFeeAndRac(bound);

    await writeScheduledPrice(verifier, { env: "Ethereum", assetId: usdc, priceUsd18: 800_000_000_000_000_000n, runId: 2n });

    // New lock: unavailable.
    const fresh = stablePkg({ assetId: usdc, lockName: "usdc-fresh", gross: 20_000_000n, recipient: recipient.address });
    await expect(verifier.recordFeeAndRac(fresh)).to.be.revertedWith(STABLE_BELOW);

    // Bound lock: still mints at its $1.00 lock-creation reference.
    await verifier.verifyAndMint(bound, 0);
    const binding = await verifier.lockReferencePrices(lockKey("Ethereum", "usdc-bound"));
    expect(binding.priceUsd18).to.equal(p1);
    expect(await vclm.balanceOf(recipient.address)).to.equal(
      await verifier.previewIssuance(20n * SCALE, 0, 1, DAY30, 0)
    );
  });

  it("$10 standard floor applies to the priced dollar value", async function () {
    const { recipient, verifier, usdc } = await deployStableFixture();
    await writeScheduledPrice(verifier, { env: "Ethereum", assetId: usdc, priceUsd18: 990_000_000_000_000_000n, runId: 1n });
    // 10 USDC x $0.99 = $9.90 < $10.00 (would pass if priced at $1).
    const low = stablePkg({ assetId: usdc, lockName: "usdc-floor-low", gross: 10_000_000n, recipient: recipient.address });
    await expect(verifier.recordFeeAndRac(low)).to.be.revertedWith("VF-COM-009: standard USD below $10.00");
    // 10.11 USDC x $0.99 = $10.0089 >= $10.00
    const ok = stablePkg({ assetId: usdc, lockName: "usdc-floor-ok", gross: 10_110_000n, recipient: recipient.address });
    await expect(verifier.recordFeeAndRac(ok)).to.not.be.reverted;
  });

  it("Handshake $0.95-$1.05 band applies to the priced dollar value", async function () {
    const { recipient, verifier, usdt } = await deployStableFixture();
    await writeScheduledPrice(verifier, { env: "Ethereum", assetId: usdt, priceUsd18: 1_040_000_000_000_000_000n, runId: 1n });
    // 1.02 USDT x $1.04 = $1.0608 > $1.05 (would pass if priced at $1).
    const high = stablePkg({ assetId: usdt, lockName: "usdt-hs-high", gross: 1_020_000n, duration: HOUR, recipient: recipient.address });
    await expect(verifier.recordFeeAndRac(high)).to.be.revertedWith("VF-COM-003: handshake USD outside $0.95-$1.05");
    // 1.00 USDT x $1.04 = $1.04
    const ok = stablePkg({ assetId: usdt, lockName: "usdt-hs-ok", gross: 1_000_000n, duration: HOUR, recipient: recipient.address });
    await verifier.recordFeeAndRac(ok);
    await expect(verifier.verifyAndMint(ok, 0)).to.not.be.reverted;
  });
});

describe("CL-01 / VF-ORC · USD from scheduled registry price", function () {
  it("other asset without usable scheduled price reverts (VF-ORC-005)", async function () {
    const [deployer, recipient] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("VinculumFinalisToken");
    const vclm = await Token.deploy("V", "V", 10n ** 30n);
    const chonx = await Token.deploy("C", "C", 10n ** 30n);
    const Verifier = await ethers.getContractFactory("VinculumFinalisVerifier");
    const verifier = await Verifier.deploy(await vclm.getAddress(), await chonx.getAddress());
    const Mock = await ethers.getContractFactory("MockAlwaysFinalizedVerifier");
    const mock = await Mock.deploy();
    const Stake = await ethers.getContractFactory("VinculumFinalisStake");
    const t0 = (await ethers.provider.getBlock("latest")).timestamp;
    const stake = await Stake.deploy(
      await vclm.getAddress(),
      await chonx.getAddress(),
      await vclm.getAddress(),
      await verifier.getAddress(),
      t0
    );
    await vclm.initialize(await verifier.getAddress(), await stake.getAddress());
    await chonx.initialize(await verifier.getAddress(), ethers.ZeroAddress);

    const assetId = ethers.id("BTC");
    await verifier.registerAssetPrecision("Bitcoin", assetId, "BTC", 8, 2, 0);
    await verifier.registerChainVerifier("Bitcoin", await mock.getAddress());
    await verifier.configureDevFund("Bitcoin", deployer.address);
    await verifier.setScheduledPricePoster(deployer.address);
    await verifier.finalize();

    const pkg = buildPkg({
      env: "Bitcoin",
      lockId: ethers.id("lock-noprice"),
      identity: "btc-noprice",
      allowance: 1,
      assetId,
      precision: 8,
      custodyClass: 2,
      gross: 100000n,
      duration: DAY30,
      recipient: recipient.address,
      racIdentity: ethers.id("rac-noprice"),
      priceRecord: encodePrice(30000n * SCALE),
    });
    await expect(verifier.recordFeeAndRac(pkg)).to.be.revertedWith(
      "VF-ORC-005: no usable scheduled price"
    );
  });

  it("scheduled success then failed run marks asset unavailable (VF-ORC-008)", async function () {
    const [deployer, recipient] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("VinculumFinalisToken");
    const vclm = await Token.deploy("V", "V", 10n ** 30n);
    const chonx = await Token.deploy("C", "C", 10n ** 30n);
    const Verifier = await ethers.getContractFactory("VinculumFinalisVerifier");
    const verifier = await Verifier.deploy(await vclm.getAddress(), await chonx.getAddress());
    const Mock = await ethers.getContractFactory("MockAlwaysFinalizedVerifier");
    const mock = await Mock.deploy();
    const Stake = await ethers.getContractFactory("VinculumFinalisStake");
    const t0 = (await ethers.provider.getBlock("latest")).timestamp;
    const stake = await Stake.deploy(
      await vclm.getAddress(),
      await chonx.getAddress(),
      await vclm.getAddress(),
      await verifier.getAddress(),
      t0
    );
    await vclm.initialize(await verifier.getAddress(), await stake.getAddress());
    await chonx.initialize(await verifier.getAddress(), ethers.ZeroAddress);

    const assetId = ethers.id("BTC");
    await verifier.registerAssetPrecision("Bitcoin", assetId, "BTC", 8, 2, 0);
    await verifier.registerChainVerifier("Bitcoin", await mock.getAddress());
    await verifier.configureDevFund("Bitcoin", deployer.address);
    await verifier.setScheduledPricePoster(deployer.address);
    await verifier.finalize();

    await writeScheduledPrice(verifier, {
      env: "Bitcoin",
      assetId,
      priceUsd18: 30000n * SCALE,
      runId: 1n,
    });
    // Failed next run: fail closed, do not keep older price usable
    await writeScheduledPrice(verifier, {
      env: "Bitcoin",
      assetId,
      priceUsd18: 0n,
      runId: 2n,
      success: false,
    });

    const pkg = buildPkg({
      env: "Bitcoin",
      lockId: ethers.id("lock-stale"),
      identity: "btc-stale",
      allowance: 1,
      assetId,
      precision: 8,
      custodyClass: 2,
      gross: 100000n,
      duration: DAY30,
      recipient: recipient.address,
      racIdentity: ethers.id("rac-stale"),
      priceRecord: encodePrice(30000n * SCALE),
    });
    await expect(verifier.recordFeeAndRac(pkg)).to.be.revertedWith(
      "VF-ORC-005: no usable scheduled price"
    );
  });

  it("lock retains creation reference price across later registry change (VF-ORC-009/010)", async function () {
    const [deployer, recipient] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("VinculumFinalisToken");
    const vclm = await Token.deploy("V", "V", 10n ** 30n);
    const chonx = await Token.deploy("C", "C", 10n ** 30n);
    const Verifier = await ethers.getContractFactory("VinculumFinalisVerifier");
    const verifier = await Verifier.deploy(await vclm.getAddress(), await chonx.getAddress());
    const Mock = await ethers.getContractFactory("MockAlwaysFinalizedVerifier");
    const mock = await Mock.deploy();
    const Stake = await ethers.getContractFactory("VinculumFinalisStake");
    const t0 = (await ethers.provider.getBlock("latest")).timestamp;
    const stake = await Stake.deploy(
      await vclm.getAddress(),
      await chonx.getAddress(),
      await vclm.getAddress(),
      await verifier.getAddress(),
      t0
    );
    await vclm.initialize(await verifier.getAddress(), await stake.getAddress());
    await chonx.initialize(await verifier.getAddress(), ethers.ZeroAddress);

    const assetId = ethers.id("BTC");
    await verifier.registerAssetPrecision("Bitcoin", assetId, "BTC", 8, 2, 0);
    await verifier.registerChainVerifier("Bitcoin", await mock.getAddress());
    await verifier.configureDevFund("Bitcoin", deployer.address);
    await verifier.setScheduledPricePoster(deployer.address);
    await verifier.finalize();

    const price1 = 30000n * SCALE;
    await writeScheduledPrice(verifier, { env: "Bitcoin", assetId, priceUsd18: price1, runId: 1n });

    const pkg = buildPkg({
      env: "Bitcoin",
      lockId: ethers.id("lock-retain"),
      identity: "btc-retain",
      allowance: 1,
      assetId,
      precision: 8,
      custodyClass: 2,
      gross: 100000n,
      duration: DAY30,
      recipient: recipient.address,
      racIdentity: ethers.id("rac-retain"),
      priceRecord: encodePrice(price1),
    });
    await verifier.recordFeeAndRac(pkg);

    // Later scheduled run changes the market price and even fails closed —
    // already-bound lock must not reprice.
    await writeScheduledPrice(verifier, {
      env: "Bitcoin",
      assetId,
      priceUsd18: 31000n * SCALE,
      runId: 2n,
    });
    await writeScheduledPrice(verifier, {
      env: "Bitcoin",
      assetId,
      priceUsd18: 0n,
      runId: 3n,
      success: false,
    });

    await expect(verifier.verifyAndMint(pkg, 0)).to.not.be.reverted;
    const binding = await verifier.lockReferencePrices(
      ethers.keccak256(
        ethers.solidityPacked(["string", "bytes32"], ["Bitcoin", ethers.id("lock-retain")])
      )
    );
    expect(binding.bound).to.equal(true);
    expect(binding.priceUsd18).to.equal(price1);
    expect(await vclm.balanceOf(recipient.address)).to.be.gt(0n);
  });

  it("mismatched package price record reverts (VF-ORC-007)", async function () {
    const [deployer, recipient] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("VinculumFinalisToken");
    const vclm = await Token.deploy("V", "V", 10n ** 30n);
    const chonx = await Token.deploy("C", "C", 10n ** 30n);
    const Verifier = await ethers.getContractFactory("VinculumFinalisVerifier");
    const verifier = await Verifier.deploy(await vclm.getAddress(), await chonx.getAddress());
    const Mock = await ethers.getContractFactory("MockAlwaysFinalizedVerifier");
    const mock = await Mock.deploy();
    const Stake = await ethers.getContractFactory("VinculumFinalisStake");
    const t0 = (await ethers.provider.getBlock("latest")).timestamp;
    const stake = await Stake.deploy(
      await vclm.getAddress(),
      await chonx.getAddress(),
      await vclm.getAddress(),
      await verifier.getAddress(),
      t0
    );
    await vclm.initialize(await verifier.getAddress(), await stake.getAddress());
    await chonx.initialize(await verifier.getAddress(), ethers.ZeroAddress);

    const assetId = ethers.id("BTC");
    await verifier.registerAssetPrecision("Bitcoin", assetId, "BTC", 8, 2, 0);
    await verifier.registerChainVerifier("Bitcoin", await mock.getAddress());
    await verifier.configureDevFund("Bitcoin", deployer.address);
    await verifier.setScheduledPricePoster(deployer.address);
    await verifier.finalize();
    await writeScheduledPrice(verifier, {
      env: "Bitcoin",
      assetId,
      priceUsd18: 30000n * SCALE,
      runId: 1n,
    });

    const wrong = encodePrice(29999n * SCALE);
    const pkg = buildPkg({
      env: "Bitcoin",
      lockId: ethers.id("lock-mismatch"),
      identity: "btc-mismatch",
      allowance: 1,
      assetId,
      precision: 8,
      custodyClass: 2,
      gross: 100000n,
      duration: DAY30,
      recipient: recipient.address,
      racIdentity: ethers.id("rac-mismatch"),
      priceRecord: wrong,
    });
    await expect(verifier.recordFeeAndRac(pkg)).to.be.revertedWith(
      "VF-ORC-007: price record mismatch"
    );
  });

  it("no deployment-time registerAssetPriceHash remains", async function () {
    const Token = await ethers.getContractFactory("VinculumFinalisToken");
    const vclm = await Token.deploy("V", "V", 10n ** 30n);
    const chonx = await Token.deploy("C", "C", 10n ** 30n);
    const Verifier = await ethers.getContractFactory("VinculumFinalisVerifier");
    const verifier = await Verifier.deploy(await vclm.getAddress(), await chonx.getAddress());
    expect(verifier.registerAssetPriceHash).to.equal(undefined);
    expect(await verifier.scheduledPricePoster()).to.equal(ethers.ZeroAddress);
  });
});
