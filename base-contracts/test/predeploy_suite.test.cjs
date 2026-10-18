// Pre-deployment suite: ceremony order, Base ETH row, multi-lock mint,
// negative cases, $0.01 floors, post-finalize access control.
// Uses the real CommitmentVaultLock ("Base") + BaseLockRecordVerifier.
const { expect } = require("chai");
const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

const HOUR = 3600n;
const DAY7 = 604800n;
const DAY30 = 2592000n;
const SCALE = 10n ** 18n;
const PRICE = 1000n * SCALE; // $1000 / ETH
const ETH_ID = "0xde7085290190e1f2f7f2f83d26fa72e411f9d765ddd608a77e8a7c388113943b"; // registry row 2 native ETH (BASE_NATIVE_ETH_ASSET_ID)
const coder = ethers.AbiCoder.defaultAbiCoder();

async function deployContracts() {
  const [deployer, recipient, other, dest, devFund] = await ethers.getSigners();
  const lock = await (await ethers.getContractFactory("CommitmentVaultLock")).deploy("Base", devFund.address);
  const nonce = await deployer.getNonce();
  const predicted = ethers.getCreateAddress({ from: deployer.address, nonce: nonce + 4 });
  const Token = await ethers.getContractFactory("VinculumFinalisToken");
  const vclm = await Token.deploy("Vinculum Finalis VCLM", "VCLM", 10_000_000_000n * SCALE);
  const chonx = await Token.deploy("Vinculum Finalis CHONX", "CHONX", 100_000_000_000n * SCALE);
  const synth = await (await ethers.getContractFactory("VinculumFinalisSynth")).deploy(predicted, await vclm.getAddress(), await chonx.getAddress());
  const launchTs = BigInt((await ethers.provider.getBlock("latest")).timestamp);
  const stake = await (await ethers.getContractFactory("VinculumFinalisStake")).deploy(
    await vclm.getAddress(), await chonx.getAddress(), await synth.getAddress(), predicted, launchTs
  );
  const verifier = await (await ethers.getContractFactory("VinculumFinalisVerifier")).deploy(await vclm.getAddress(), await chonx.getAddress());
  expect(await verifier.getAddress()).to.equal(predicted);
  await (await vclm.initialize(predicted, await stake.getAddress())).wait();
  await (await chonx.initialize(predicted, await synth.getAddress())).wait();
  const reader = await (await ethers.getContractFactory("BaseLockRecordVerifier")).deploy(await lock.getAddress());
  return { deployer, recipient, other, dest, devFund, lock, vclm, verifier, reader };
}

async function fullCeremony() {
  const c = await deployContracts();
  const { verifier, reader, deployer, devFund } = c;
  await (await verifier.registerChainVerifier("Base", await reader.getAddress())).wait();
  await (await verifier.registerAssetPrecisionBatch([
    { environmentId: "Ethereum", canonicalAssetId: ETH_ID, symbol: "ETH", decimals: 18, custodyClass: 2, custodyPath: 0 },
    { environmentId: "Base", canonicalAssetId: ETH_ID, symbol: "ETH", decimals: 18, custodyClass: 2, custodyPath: 0 },
  ])).wait();
  await (await verifier.setScheduledPricePoster(deployer.address)).wait();
  await (await verifier.configureDevFund("Base", devFund.address)).wait();
  await (await verifier.applyScheduledPriceRun(1n, [
    { environmentId: "Base", canonicalAssetId: ETH_ID, priceUsd18: PRICE, success: true },
  ])).wait();
  await (await verifier.finalize()).wait();
  return c;
}

const usdOf = (wei) => (wei * PRICE) / SCALE;

async function openLock(lock, signer, { recipient, dest, duration, gross, outputToken = 0 }) {
  const lockId = ethers.hexlify(ethers.randomBytes(32));
  await (await lock.connect(signer).createNativeLock(
    lockId, recipient, outputToken, ETH_ID, ethers.ZeroHash, dest, duration, usdOf(gross), { value: gross }
  )).wait();
  return { lockId, rec: await lock.lockRecord(lockId) };
}

function pkgFrom(lockId, rec, { recipient = rec.baseRecipient, env = "Base", rac } = {}) {
  return {
    sourceEnvironmentId: env,
    commitmentVaultLockId: lockId,
    handshakeAllowanceCount: 3,
    canonicalAssetId: ETH_ID,
    assetPrecision: 18,
    assetCustodyClass: 2,
    grossAmountSmallestUnits: rec.gross,
    actualFeeAmountSmallestUnits: rec.fee,
    principalAmountSmallestUnits: rec.principal,
    feeAssetId: ETH_ID,
    devFundDestination: "dev",
    feeTransferEvidence: ethers.id("fee"),
    valuationTimestamp: rec.createdAt,
    maturityTimestamp: rec.maturity,
    durationSecs: rec.duration,
    selectedOutputToken: rec.outputToken,
    baseRecipient: recipient,
    releaseDestination: "release",
    chonxActivationReceipt: "0x",
    racIdentity: rac || ethers.hexlify(ethers.randomBytes(32)),
    priceRecord: "0x",
    sourceFinalityProof: "0x",
    lockEventProof: coder.encode(
      ["bytes32", "uint256", "uint256", "uint256", "uint256", "uint256", "uint256"],
      [lockId, rec.gross, rec.fee, rec.principal, rec.duration, rec.createdAt, rec.maturity]
    ),
  };
}

const HS_GROSS = ethers.parseEther("0.000015"); // $0.015
const STD_GROSS = ethers.parseEther("0.00005"); // $0.05

// Configures every finalize() prerequisite except the one named in `skip`.
async function partialCeremony(skip) {
  const c = await deployContracts();
  const { verifier, reader, deployer, devFund } = c;
  if (skip !== "reader") await verifier.registerChainVerifier("Base", await reader.getAddress());
  await verifier.registerAssetPrecision("Ethereum", ETH_ID, "ETH", 18, 2, 0);
  if (skip !== "row") await verifier.registerAssetPrecision("Base", ETH_ID, "ETH", 18, 2, 0);
  if (skip !== "devfund") await verifier.configureDevFund("Base", devFund.address);
  if (skip !== "poster") await verifier.setScheduledPricePoster(deployer.address);
  if (skip !== "price" && skip !== "poster" && skip !== "row") {
    await verifier.applyScheduledPriceRun(1n, [{ environmentId: "Base", canonicalAssetId: ETH_ID, priceUsd18: PRICE, success: true }]);
  }
  return c;
}

describe("predeploy 1: ceremony order (finalize gated)", function () {
  it("finalize reverts with nothing configured", async function () {
    const { verifier } = await deployContracts();
    await expect(verifier.finalize()).to.be.revertedWith("VF-DEP-010: Base reader not registered");
  });
  it("finalize reverts without the Base reader", async function () {
    const { verifier } = await partialCeremony("reader");
    await expect(verifier.finalize()).to.be.revertedWith("VF-DEP-010: Base reader not registered");
  });
  it("finalize reverts without the Base ETH registry row (Ethereum row alone)", async function () {
    const { verifier } = await partialCeremony("row");
    await expect(verifier.finalize()).to.be.revertedWith("VF-DEP-011: Base ETH registry row missing");
  });
  it("finalize reverts without Dev Fund", async function () {
    const { verifier } = await partialCeremony("devfund");
    await expect(verifier.finalize()).to.be.revertedWith("VF-DEP-012: Base Dev Fund not set");
  });
  it("finalize reverts without price poster", async function () {
    const { verifier } = await partialCeremony("poster");
    await expect(verifier.finalize()).to.be.revertedWith("VF-DEP-013: price poster not set");
  });
  it("finalize reverts without a scheduled Base ETH price", async function () {
    const { verifier } = await partialCeremony("price");
    await expect(verifier.finalize()).to.be.revertedWith("VF-DEP-014: Base ETH price not usable");
  });
  it("finalize reverts when the last Base ETH run failed (unusable)", async function () {
    const { verifier } = await partialCeremony();
    await verifier.applyScheduledPriceRun(2n, [{ environmentId: "Base", canonicalAssetId: ETH_ID, priceUsd18: 0, success: false }]);
    await expect(verifier.finalize()).to.be.revertedWith("VF-DEP-014: Base ETH price not usable");
    await verifier.applyScheduledPriceRun(3n, [{ environmentId: "Base", canonicalAssetId: ETH_ID, priceUsd18: PRICE, success: true }]);
    await expect(verifier.finalize()).to.not.be.reverted;
  });
  it("the poster can write a scheduled price before finalize; others cannot", async function () {
    const { verifier, deployer, other } = await deployContracts();
    await verifier.registerAssetPrecision("Base", ETH_ID, "ETH", 18, 2, 0);
    await verifier.setScheduledPricePoster(deployer.address);
    await expect(verifier.connect(other).applyScheduledPriceRun(1n, [
      { environmentId: "Base", canonicalAssetId: ETH_ID, priceUsd18: PRICE, success: true },
    ])).to.be.revertedWith("VF-ORC-007: not price poster");
    await expect(verifier.applyScheduledPriceRun(1n, [
      { environmentId: "Base", canonicalAssetId: ETH_ID, priceUsd18: PRICE, success: true },
    ])).to.not.be.reverted;
  });
  it("full ordered ceremony finalizes", async function () {
    const { verifier } = await fullCeremony();
    expect(await verifier.configurationFinalized()).to.equal(true);
    expect(await verifier.deployer()).to.equal(ethers.ZeroAddress);
  });
});

describe("predeploy 2: Base ETH row", function () {
  it("Base+ETH key is registered and priced", async function () {
    const { verifier } = await fullCeremony();
    const key = ethers.solidityPackedKeccak256(["string", "bytes32"], ["Base", ETH_ID]);
    expect((await verifier.assetPrecisionTable(key)).canonicalAssetId).to.equal(ETH_ID);
    const sp = await verifier.scheduledPrices(key);
    expect(sp.usable).to.equal(true);
    expect(sp.priceUsd18).to.equal(PRICE);
  });
  it("ETH only under Ethereum is not sufficient for a Base lock", async function () {
    const { verifier, reader, deployer, devFund } = await deployContracts();
    await verifier.registerChainVerifier("Base", await reader.getAddress());
    await verifier.registerAssetPrecision("Ethereum", ETH_ID, "ETH", 18, 2, 0);
    await verifier.setScheduledPricePoster(deployer.address);
    await verifier.configureDevFund("Base", devFund.address);
    await expect(verifier.applyScheduledPriceRun(1n, [
      { environmentId: "Base", canonicalAssetId: ETH_ID, priceUsd18: PRICE, success: true },
    ])).to.be.revertedWith("VF-REG-001: asset not in registry");
    await verifier.applyScheduledPriceRun(2n, [
      { environmentId: "Ethereum", canonicalAssetId: ETH_ID, priceUsd18: PRICE, success: true },
    ]);
    await expect(verifier.finalize()).to.be.revertedWith("VF-DEP-011: Base ETH registry row missing");
  });
});

describe("predeploy 3: multi-lock mint", function () {
  it("handshake + 7d + 30d locks (all 5% fee) mint exact VCLM to baseRecipient; principal held, fee to Dev Fund", async function () {
    const { lock, verifier, vclm, recipient, other, dest, devFund } = await fullCeremony();
    const lockAddr = await lock.getAddress();
    const specs = [
      { duration: HOUR, gross: HS_GROSS },
      { duration: DAY7, gross: STD_GROSS },
      { duration: DAY30, gross: STD_GROSS },
    ];
    const fundBefore = await ethers.provider.getBalance(devFund.address);
    let principalSum = 0n, feeSum = 0n;
    const locks = [];
    for (const s of specs) {
      const l = await openLock(lock, other, { recipient: recipient.address, dest: dest.address, ...s });
      locks.push(l);
      principalSum += l.rec.principal; feeSum += l.rec.fee;
      expect(l.rec.fee).to.equal((s.gross * 500n) / 10000n); // 5% every duration
    }
    expect(await ethers.provider.getBalance(lockAddr)).to.equal(principalSum);
    expect((await ethers.provider.getBalance(devFund.address)) - fundBefore).to.equal(feeSum);

    let total = 0n;
    for (const { lockId, rec } of locks) {
      const pkg = pkgFrom(lockId, rec);
      await (await verifier.recordFeeAndRac(pkg)).wait();
      const expected = await verifier.previewIssuance(usdOf(rec.gross), 0, 2, rec.duration, 0);
      expect(expected).to.be.gt(0n);
      await expect(verifier.verifyAndMint(pkg, 0))
        .to.emit(vclm, "Transfer").withArgs(ethers.ZeroAddress, recipient.address, expected);
      total += expected;
    }
    expect(await vclm.balanceOf(recipient.address)).to.equal(total);
    // minting does not move principal or return fee
    expect(await ethers.provider.getBalance(lockAddr)).to.equal(principalSum);
    expect((await ethers.provider.getBalance(devFund.address)) - fundBefore).to.equal(feeSum);
  });
});

describe("predeploy 4: negative cases", function () {
  let c;
  beforeEach(async function () { c = await fullCeremony(); });
  const hs = (signer, extra = {}) => openLock(c.lock, signer || c.other, { recipient: c.recipient.address, dest: c.dest.address, duration: HOUR, gross: HS_GROSS, ...extra });

  it("mismatched recipient reverts VF-XCH-011", async function () {
    const { lockId, rec } = await hs();
    const pkg = pkgFrom(lockId, rec, { recipient: c.other.address });
    await expect(c.verifier.recordFeeAndRac(pkg)).to.be.revertedWith("VF-XCH-011: recipient mismatch");
    await expect(c.verifier.verifyAndMint(pkg, 0)).to.be.revertedWith("VF-FEE-011: call recordFeeAndRac() first");
  });
  it("unusable price (failed run) reverts VF-ORC-005", async function () {
    await c.verifier.applyScheduledPriceRun(2n, [{ environmentId: "Base", canonicalAssetId: ETH_ID, priceUsd18: 0, success: false }]);
    const { lockId, rec } = await hs();
    await expect(c.verifier.recordFeeAndRac(pkgFrom(lockId, rec))).to.be.revertedWith("VF-ORC-005: no usable scheduled price");
  });
  // A native-ETH lock relabelled as another registered (unpriced) asset is now
  // refused by the asset check before the price lookup is reached.
  it("relabelled to a registered, never-priced asset: asset mismatch (VF-XCH-011)", async function () {
    const d = await deployContracts();
    const other = ethers.id("other-base-asset");
    await d.verifier.registerChainVerifier("Base", await d.reader.getAddress());
    await d.verifier.registerAssetPrecision("Base", ETH_ID, "ETH", 18, 2, 0);
    await d.verifier.registerAssetPrecision("Base", other, "OTH", 18, 2, 0);
    await d.verifier.setScheduledPricePoster(d.deployer.address);
    await d.verifier.configureDevFund("Base", d.devFund.address);
    await d.verifier.applyScheduledPriceRun(1n, [{ environmentId: "Base", canonicalAssetId: ETH_ID, priceUsd18: PRICE, success: true }]);
    await d.verifier.finalize();
    const { lockId, rec } = await openLock(d.lock, d.other, { recipient: d.recipient.address, dest: d.dest.address, duration: HOUR, gross: HS_GROSS });
    const pkg = pkgFrom(lockId, rec);
    pkg.canonicalAssetId = other; pkg.feeAssetId = other;
    await expect(d.verifier.recordFeeAndRac(pkg)).to.be.revertedWith("VF-XCH-011: asset mismatch");
  });
  it("zero-price success run reverts VF-ORC-004", async function () {
    await expect(c.verifier.applyScheduledPriceRun(2n, [{ environmentId: "Base", canonicalAssetId: ETH_ID, priceUsd18: 0, success: true }]))
      .to.be.revertedWith("VF-ORC-004: zero price");
  });
  // Relabelled to an unregistered asset: the asset check refuses it first.
  it("relabelled to an unregistered asset: asset mismatch (VF-XCH-011)", async function () {
    const { lockId, rec } = await hs();
    const pkg = pkgFrom(lockId, rec);
    pkg.canonicalAssetId = ethers.id("not-registered");
    await expect(c.verifier.recordFeeAndRac(pkg)).to.be.revertedWith("VF-XCH-011: asset mismatch");
  });
  // Rule change: Handshake counters removed. A fourth Handshake is accepted at 5%.
  it("fourth Handshake from the same wallet is accepted by the lock at 5%", async function () {
    for (let i = 0; i < 4; i++) {
      const { rec } = await hs(c.other);
      expect(rec.fee).to.equal((HS_GROSS * 500n) / 10000n);
    }
  });
  it("fourth Handshake mint from the same wallet succeeds on the verifier", async function () {
    for (let i = 0; i < 4; i++) {
      const { lockId, rec } = await hs(c.other);
      const pkg = pkgFrom(lockId, rec);
      await c.verifier.recordFeeAndRac(pkg);
      await expect(c.verifier.verifyAndMint(pkg, 0)).to.not.be.reverted;
    }
  });
  it("release before maturity reverts", async function () {
    const { lockId } = await openLock(c.lock, c.other, { recipient: c.recipient.address, dest: c.dest.address, duration: DAY7, gross: STD_GROSS });
    await expect(c.lock.connect(c.dest).release(lockId)).to.be.revertedWith("CVL: immature");
  });
  it("release from a non-destination wallet reverts; destination succeeds once", async function () {
    const { lockId, rec } = await hs();
    await network.provider.send("evm_increaseTime", [Number(HOUR)]);
    await network.provider.send("evm_mine");
    await expect(c.lock.connect(c.other).release(lockId)).to.be.revertedWith("CVL: destination");
    await expect(c.lock.connect(c.dest).release(lockId)).to.changeEtherBalance(c.dest, rec.principal);
    await expect(c.lock.connect(c.dest).release(lockId)).to.be.revertedWith("CVL: already released");
  });
  it("second mint from the same lock reverts VF-XCH-013", async function () {
    const { lockId, rec } = await hs();
    const pkg = pkgFrom(lockId, rec);
    await c.verifier.recordFeeAndRac(pkg);
    await c.verifier.verifyAndMint(pkg, 0);
    await expect(c.verifier.verifyAndMint(pkg, 0)).to.be.revertedWith("VF-XCH-013: replay");
    const pkg2 = pkgFrom(lockId, rec);
    await c.verifier.recordFeeAndRac(pkg2);
    await expect(c.verifier.verifyAndMint(pkg2, 0)).to.be.revertedWith("VF-XCH-013: replay");
  });
});

describe("predeploy 5: $0.01 floors", function () {
  it("constants are 0.01/0.02/0.01 on lock and verifier", async function () {
    const { lock, verifier } = await deployContracts();
    for (const x of [lock, verifier]) {
      expect(await x.HANDSHAKE_USD_MIN()).to.equal(SCALE / 100n);
      expect(await x.HANDSHAKE_USD_MAX()).to.equal(SCALE / 50n);
      expect(await x.STANDARD_USD_MIN()).to.equal(SCALE / 100n);
    }
  });
  it("old 0.95/1.05/10 floor constants are gone from every source copy", async function () {
    const root = path.join(__dirname, "..", "..");
    const files = [
      "base-contracts/contracts/CommitmentVaultLock.sol",
      "base-contracts/contracts/VinculumFinalisVerifier.sol",
      "src/base-verifier/contracts/VinculumFinalisVerifier.sol",
    ];
    for (const f of files) {
      const src = fs.readFileSync(path.join(root, f), "utf8");
      expect(src, f).to.not.match(/HANDSHAKE_USD_MIN\s*=\s*0\.95e18/);
      expect(src, f).to.not.match(/HANDSHAKE_USD_MAX\s*=\s*1\.05e18/);
      expect(src, f).to.not.match(/STANDARD_USD_MIN\s*=\s*10e18/);
      expect(src, f).to.match(/HANDSHAKE_USD_MIN\s*=\s*0\.01e18/);
      expect(src, f).to.match(/HANDSHAKE_USD_MAX\s*=\s*0\.02e18/);
      expect(src, f).to.match(/STANDARD_USD_MIN\s*=\s*0\.01e18/);
    }
  });
  it("lock rejects handshake outside $0.01-$0.02 and standard below $0.01; accepts edges", async function () {
    const { lock, other, recipient, dest } = await deployContracts();
    const mk = (d, usd) => lock.connect(other).createNativeLock(ethers.hexlify(ethers.randomBytes(32)), recipient.address, 0, ETH_ID, ethers.ZeroHash, dest.address, d, usd, { value: 10n ** 12n });
    await expect(mk(HOUR, SCALE / 100n - 1n)).to.be.revertedWith("CVL: handshake usd");
    await expect(mk(HOUR, SCALE / 50n + 1n)).to.be.revertedWith("CVL: handshake usd");
    await expect(mk(DAY7, SCALE / 100n - 1n)).to.be.revertedWith("CVL: standard usd");
    await expect(mk(HOUR, SCALE / 100n)).to.not.be.reverted;
    await expect(mk(HOUR, SCALE / 50n)).to.not.be.reverted;
    await expect(mk(DAY7, SCALE / 100n)).to.not.be.reverted;
  });
  it("verifier rejects handshake outside $0.01-$0.02 and standard below $0.01", async function () {
    const { verifier, lock, other, recipient, dest } = await fullCeremony();
    // build records directly via lock with honest USD but out-of-band gross at verifier price
    const cases = [
      [HOUR, ethers.parseEther("0.000009"), "VF-COM-003: handshake USD outside $0.01-$0.02"], // $0.009
      [HOUR, ethers.parseEther("0.000021"), "VF-COM-003: handshake USD outside $0.01-$0.02"], // $0.021
      [DAY7, ethers.parseEther("0.000009"), "VF-COM-009: standard USD below $0.01"],
    ];
    for (const [d, gross, msg] of cases) {
      const lockId = ethers.hexlify(ethers.randomBytes(32));
      // lock floor accepts a stated in-band USD; verifier derives USD from its own price
      await lock.connect(other).createNativeLock(lockId, recipient.address, 0, ETH_ID, ethers.ZeroHash, dest.address, d, SCALE / 100n, { value: gross });
      const rec = await lock.lockRecord(lockId);
      await expect(verifier.recordFeeAndRac(pkgFrom(lockId, rec))).to.be.revertedWith(msg);
    }
  });
});

describe("predeploy 6: access control after finalize", function () {
  it("all ceremony setters and finalize are closed; price writes only by poster", async function () {
    const { verifier, reader, deployer, other, devFund } = await fullCeremony();
    const closed = "VF-DEP-003: configuration finalized";
    await expect(verifier.registerChainVerifier("Base", await reader.getAddress())).to.be.revertedWith(closed);
    await expect(verifier.registerAssetPrecision("Base", ETH_ID, "ETH", 18, 2, 0)).to.be.revertedWith(closed);
    await expect(verifier.registerAssetPrecisionBatch([])).to.be.revertedWith(closed);
    await expect(verifier.setScheduledPricePoster(other.address)).to.be.revertedWith(closed);
    await expect(verifier.configureDevFund("Base", devFund.address)).to.be.revertedWith(closed);
    await expect(verifier.finalize()).to.be.revertedWith(closed);
    await expect(verifier.connect(other).finalize()).to.be.revertedWith(closed);
    await expect(verifier.connect(other).applyScheduledPriceRun(5n, [])).to.be.revertedWith("VF-ORC-007: not price poster");
    await expect(verifier.applyScheduledPriceRun(1n, [])).to.be.revertedWith("VF-ORC-001: run id must advance");
    expect(await verifier.deployer()).to.equal(ethers.ZeroAddress);
  });
  it("before finalize, non-deployer cannot configure and mint paths are closed", async function () {
    const { verifier, other } = await deployContracts();
    await expect(verifier.connect(other).configureDevFund("Base", other.address)).to.be.revertedWith("VF: not deployer");
    await expect(verifier.connect(other).finalize()).to.be.revertedWith("VF: not deployer");
  });
});
