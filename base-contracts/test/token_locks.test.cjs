// Token locks resolve through the Verifier's token address index (environment +
// token address -> registry row), built from the addresses already on the
// Revision B rows (deployment/assetRegistry.revB.json). Polygon native POL
// resolves to the existing POL row (environment Ethereum, row 114, in Revision
// B) through a ceremony alias. The duplicate-address rule is also checked on
// the prior revision's 961 rows, where the duplicates occur. In-process Hardhat
// chain only.
const { expect } = require("chai");
const { ethers, network } = require("hardhat");
const { ethLockEvidence, encodeEvidence } = require("./lib/ethProof.cjs");
const { buildTokenAddressIndex } = require("../scripts/buildTokenAddressIndex.cjs");
const { loadRegistry, loadHistoricalWritten } = require("../scripts/registryFile.cjs");
// VF-ORC-016: posted prices are USD per whole token with 30 decimals.
const P30 = (usd18) => BigInt(usd18) * 10n ** 12n;
const REG = loadRegistry().written; // Revision B rows under their own environment (Base ETH excluded)
const HIST_INDEX = buildTokenAddressIndex(loadHistoricalWritten()); // prior revision, 961 rows

const SCALE = 10n ** 18n;
const DAY7 = 604800n;
const coder = ethers.AbiCoder.defaultAbiCoder();
const ETH_ID = "0xde7085290190e1f2f7f2f83d26fa72e411f9d765ddd608a77e8a7c388113943b";
const POL_ROW_ID = ethers.solidityPackedKeccak256(["string", "string"], ["Ethereum", "POL"]);
const INDEX = buildTokenAddressIndex();
const idx = (env, sym) => INDEX.entries.find((e) => e.environmentId === env && e.symbol === sym);
const row = (n) => REG.find((e) => e.row === n);
const AERO = idx("Base", "AERO");            // a registered Base token row (18 decimals)
const ETH_USDC = idx("Ethereum", "USDC");    // registered on Ethereum only

async function setup({ polygon = false } = {}) {
  const [deployer, recipient, other, dest, devFund] = await ethers.getSigners();
  const T = await ethers.getContractFactory("VinculumFinalisToken");
  const vclm = await T.deploy("Vinculum", "VCLM", 10_000_000_000n * SCALE);
  const chonx = await T.deploy("Chonx", "CHONX", 100_000_000_000n * SCALE);
  const verifier = await (await ethers.getContractFactory("VinculumFinalisVerifier")).deploy(await vclm.getAddress(), await chonx.getAddress());
  const launch = (await ethers.provider.getBlock("latest")).timestamp;
  const stake = await (await ethers.getContractFactory("VinculumFinalisStake")).deploy(
    await vclm.getAddress(), await chonx.getAddress(), await vclm.getAddress(), await verifier.getAddress());
  await vclm.initialize(await verifier.getAddress(), await stake.getAddress());
  await chonx.initialize(await verifier.getAddress(), ethers.ZeroAddress);
  const lock = await (await ethers.getContractFactory("CommitmentVaultLock")).deploy("Base", devFund.address);
  const reader = await (await ethers.getContractFactory("BaseLockRecordVerifier")).deploy(await lock.getAddress());
  await verifier.registerChainVerifier("Base", await reader.getAddress());
  const r = (n) => { const e = row(n); return [e.environmentId, e.canonicalAssetId, e.symbol, e.decimals, e.custodyClass, e.custodyPath]; };
  await verifier.registerAssetPrecisionBatch([["Base", ETH_ID, "ETH", 18, 2, 0], r(AERO.row), r(ETH_USDC.row), r(114)]);
  await verifier.registerTokenAddressBatch([AERO, ETH_USDC].map((t) => ({ environmentId: t.environmentId, token: t.token, canonicalAssetId: t.canonicalAssetId })));
  let polyLock, polyReader;
  if (polygon) {
    polyLock = await (await ethers.getContractFactory("CommitmentVaultLock")).deploy("Polygon", devFund.address);
    polyReader = await (await ethers.getContractFactory("PolygonLockReaderTestAnchor")).deploy(await polyLock.getAddress());
    await verifier.registerChainVerifier("Polygon", await polyReader.getAddress());
    await verifier.configureDevFund("Polygon", devFund.address);
    await verifier.registerAssetRowAlias("Polygon", POL_ROW_ID, "Ethereum");
  }
  await verifier.configureDevFund("Base", devFund.address);
  await verifier.setScheduledPricePoster(deployer.address);
  await verifier.applyScheduledPriceRun(1n, [
    { environmentId: "Base", canonicalAssetId: ETH_ID, priceUsd30: P30(1000n * SCALE), success: true },
    { environmentId: "Base", canonicalAssetId: AERO.canonicalAssetId, priceUsd30: P30(SCALE), success: true },
    { environmentId: "Ethereum", canonicalAssetId: POL_ROW_ID, priceUsd30: P30(SCALE), success: true },
  ]);
  await verifier.finalize();
  return { deployer, recipient, other, dest, verifier, lock, reader, vclm, polyLock, polyReader };
}

// A working ERC-20 placed at a given address (a registered row's real address).
async function tokenAt(addr) {
  const f = await (await ethers.getContractFactory("TestFixtureERC20")).deploy(0);
  await network.provider.send("hardhat_setCode", [addr, await ethers.provider.getCode(await f.getAddress())]);
  return ethers.getContractAt("TestFixtureERC20", addr);
}

async function tokenLock(c, token, amount = 100n * SCALE) {
  await token.mint(c.other.address, amount);
  await token.connect(c.other).approve(await c.lock.getAddress(), amount);
  const lockId = ethers.hexlify(ethers.randomBytes(32));
  await c.lock.connect(c.other).createErc20Lock(lockId, c.recipient.address, 0, ETH_ID, ethers.ZeroHash, c.dest.address, DAY7,
    await token.getAddress(), amount, 100n * SCALE);
  return { lockId, rec: await c.lock.lockRecord(lockId) };
}

function pkg(env, lockId, rec, assetId, proof, finality = "0x") {
  return {
    sourceEnvironmentId: env, commitmentVaultLockId: lockId, handshakeAllowanceCount: 3,
    canonicalAssetId: assetId, assetPrecision: 18, assetCustodyClass: 3,
    grossAmountSmallestUnits: rec.gross, actualFeeAmountSmallestUnits: rec.fee, principalAmountSmallestUnits: rec.principal,
    feeAssetId: assetId, devFundDestination: "dev", feeTransferEvidence: ethers.id("fee"),
    valuationTimestamp: rec.createdAt, maturityTimestamp: rec.maturity, durationSecs: rec.duration,
    selectedOutputToken: rec.outputToken, baseRecipient: rec.baseRecipient, releaseDestination: "release",
    chonxActivationReceipt: "0x", racIdentity: ethers.hexlify(ethers.randomBytes(32)), priceRecord: "0x",
    sourceFinalityProof: finality,
    lockEventProof: proof ?? coder.encode(["bytes32", "uint256", "uint256", "uint256", "uint256", "uint256", "uint256"],
      [lockId, rec.gross, rec.fee, rec.principal, rec.duration, rec.createdAt, rec.maturity]),
  };
}

describe("Token locks: registered token addresses verify and mint", function () {
  it("a lock of a registered Base token address verifies and mints VCLM", async () => {
    const c = await setup();
    const token = await tokenAt(AERO.token);
    const { lockId, rec } = await tokenLock(c, token);
    const p = pkg("Base", lockId, rec, AERO.canonicalAssetId);
    expect(await c.reader.extractAssetId(p.lockEventProof)).to.equal(await c.verifier.tokenAddressKey("Base", AERO.token));
    expect(await c.verifier.tokenAssetIndex(await c.verifier.tokenAddressKey("Base", AERO.token))).to.equal(AERO.canonicalAssetId);
    await c.verifier.recordFeeAndRac(p);
    await c.verifier.verifyAndMint(p, 0);
    expect(await c.vclm.balanceOf(c.recipient.address)).to.be.gt(0n);
  });

  it("an unregistered token address is refused", async () => {
    const c = await setup();
    const token = await (await ethers.getContractFactory("TestFixtureERC20")).deploy(0);
    const { lockId, rec } = await tokenLock(c, token);
    await expect(c.verifier.recordFeeAndRac(pkg("Base", lockId, rec, AERO.canonicalAssetId))).to.be.revertedWith("VF-XCH-011: asset mismatch");
    const key = await c.verifier.tokenAddressKey("Base", await token.getAddress());
    await expect(c.verifier.recordFeeAndRac(pkg("Base", lockId, rec, key))).to.be.reverted; // the key is not a registry row
  });

  it("a wrong-chain address is refused: an address indexed on Ethereum does not resolve on Base", async () => {
    const c = await setup();
    const token = await tokenAt(ETH_USDC.token);
    const { lockId, rec } = await tokenLock(c, token);
    expect(await c.verifier.tokenAssetIndex(await c.verifier.tokenAddressKey("Base", ETH_USDC.token))).to.equal(ethers.ZeroHash);
    await expect(c.verifier.recordFeeAndRac(pkg("Base", lockId, rec, ETH_USDC.canonicalAssetId))).to.be.revertedWith("VF-XCH-011: asset mismatch");
  });

  it("a package naming another registered token is refused even for a registered lock", async () => {
    const c = await setup();
    const { lockId, rec } = await tokenLock(c, await tokenAt(AERO.token));
    await expect(c.verifier.recordFeeAndRac(pkg("Base", lockId, rec, ETH_ID))).to.be.revertedWith("VF-XCH-011: asset mismatch");
  });

  it("the index refuses a row from another environment, a zero address, and a second row for one address", async () => {
    const [d] = await ethers.getSigners();
    const T = await ethers.getContractFactory("VinculumFinalisToken");
    const v = await (await ethers.getContractFactory("VinculumFinalisVerifier")).deploy(await (await T.deploy("a", "A", 1n)).getAddress(), await (await T.deploy("b", "B", 1n)).getAddress());
    const e = row(ETH_USDC.row);
    await v.registerAssetPrecisionBatch([[e.environmentId, e.canonicalAssetId, e.symbol, e.decimals, e.custodyClass, e.custodyPath]]);
    await expect(v.registerTokenAddressBatch([{ environmentId: "Base", token: ETH_USDC.token, canonicalAssetId: ETH_USDC.canonicalAssetId }]))
      .to.be.revertedWith("VF-REG: row not registered in this environment");
    await expect(v.registerTokenAddressBatch([{ environmentId: "Ethereum", token: ethers.ZeroAddress, canonicalAssetId: ETH_USDC.canonicalAssetId }]))
      .to.be.revertedWith("VF-REG: zero token address");
    const one = { environmentId: "Ethereum", token: ETH_USDC.token, canonicalAssetId: ETH_USDC.canonicalAssetId };
    await v.registerTokenAddressBatch([one]);
    await expect(v.registerTokenAddressBatch([one])).to.be.revertedWith("VF-REG: address already indexed");
    void d;
  });
});

describe("Duplicate addresses: one row per (environment, address)", function () {
  const pick = (env, prefix) => HIST_INDEX.duplicates.find((x) => x.environmentId === env && x.address.toLowerCase().startsWith(prefix)).chosenRow;
  it("prior revision: 52 addresses on two or more same-environment rows, each resolved to exactly one row (823 addresses)", () => {
    expect(HIST_INDEX.entries.length).to.equal(823);
    expect(HIST_INDEX.duplicates.length).to.equal(52);
    const keys = HIST_INDEX.entries.map((e) => e.environmentId + "|" + e.token.toLowerCase());
    expect(new Set(keys).size).to.equal(keys.length);
    for (const d of HIST_INDEX.duplicates) expect(d.rows.map((r) => r.row)).to.include(d.chosenRow);
  });
  it("Revision B: 475 addresses, one per token entry, no duplicate left, and no duplicate-losing row present", () => {
    expect(INDEX.entries.length).to.equal(475);
    expect(INDEX.duplicates.length).to.equal(0);
    const keys = INDEX.entries.map((e) => e.environmentId + "|" + e.token.toLowerCase());
    expect(new Set(keys).size).to.equal(keys.length);
    const tokenRows = REG.filter((e) => e.kind === "token");
    expect(tokenRows.length).to.equal(475);
    const idxRows = new Set(INDEX.entries.map((e) => e.environmentId + "|" + e.row));
    for (const e of tokenRows) expect(idxRows.has(e.environmentId + "|" + e.row), "row " + e.row).to.equal(true);
    const revRows = new Set(REG.map((e) => e.environmentId + "|" + e.row));
    for (const d of HIST_INDEX.duplicates) for (const r of d.rows)
      if (r.row !== d.chosenRow) expect(revRows.has(d.environmentId + "|" + r.row), "loser row " + r.row).to.equal(false);
  });
  it("rule: the row matching the contract's own symbol() wins; else case-insensitive; else lowest row", () => {
    expect(pick("Ethereum", "0xfc82bb")).to.equal(369); // PROM, not ASR (row 345)
    expect(pick("Ethereum", "0x9f8f72")).to.equal(32);  // MKR, not ACM / MKR_ETH
    expect(pick("Ethereum", "0x57ab1e")).to.equal(186); // sUSD, not DASH
    expect(pick("Ethereum", "0x27702a")).to.equal(609); // ALEPH, not ALGO
    expect(pick("Ethereum", "0xa0b869")).to.equal(1);   // USDC, not USDC_ETH
    expect(pick("Base", "0xcbb7c0")).to.equal(45);      // cbBTC exact case
    expect(pick("Base", "0x2ae3f1")).to.equal(25);      // CBETH, case-insensitive
    expect(pick("Optimism", "0x8700da")).to.equal(141); // no symbol match -> lowest row
  });
  it("the same address on two chains maps independently (environment is part of the key)", () => {
    const cb = INDEX.entries.filter((e) => e.token.toLowerCase().startsWith("0xcbb7c0"));
    expect(cb.map((e) => e.environmentId).sort()).to.deep.equal(["Base", "Ethereum"]);
    expect(cb[0].canonicalAssetId).to.not.equal(cb[1].canonicalAssetId);
  });
});

describe("Polygon native POL resolves to the existing POL row (environment Ethereum)", function () {
  it("no Polygon POL row; the reader reports the POL row's id; the alias supplies decimals and price; a native lock mints", async () => {
    expect(REG.some((e) => e.environmentId === "Polygon" && e.symbol === "POL")).to.equal(false);
    expect(row(114).symbol).to.equal("POL");
    expect(row(114).environmentId).to.equal("Ethereum");
    expect(row(114).canonicalAssetId).to.equal(POL_ROW_ID);
    const c = await setup({ polygon: true });
    expect(await c.polyReader.nativeAssetId()).to.equal(POL_ROW_ID);
    const lockId = ethers.hexlify(ethers.randomBytes(32));
    const tx = await c.polyLock.connect(c.other).createNativeLock(lockId, c.recipient.address, 0, POL_ROW_ID, ethers.ZeroHash, c.dest.address, DAY7, 1n * SCALE,
      { value: ethers.parseEther("1") });
    const rc = await tx.wait();
    const ev = await ethLockEvidence(await c.polyLock.getAddress(), rc.hash, lockId);
    const rec = await c.polyLock.lockRecord(lockId);
    const finality = coder.encode(["uint256", "bytes32", "uint256"], [137, ev.block.hash, ev.block.number]);
    const p = pkg("Polygon", lockId, rec, POL_ROW_ID, encodeEvidence(ev), finality);
    expect(await c.polyReader.extractAssetId(p.lockEventProof)).to.equal(POL_ROW_ID);
    await c.verifier.recordFeeAndRac(p);
    await c.verifier.verifyAndMint(p, 0);
    expect(await c.vclm.balanceOf(c.recipient.address)).to.be.gt(0n);
    // Without the alias the same package has no row: label it with a Polygon key and it is refused.
    const polyLabel = ethers.solidityPackedKeccak256(["string", "string"], ["Polygon", "native-POL"]);
    await expect(c.verifier.recordFeeAndRac({ ...p, canonicalAssetId: polyLabel, feeAssetId: polyLabel, racIdentity: ethers.id("x") }))
      .to.be.revertedWith("VF-XCH-011: asset mismatch");
  });
  it("the alias is ceremony-only and needs the row to exist", async () => {
    const T = await ethers.getContractFactory("VinculumFinalisToken");
    const v = await (await ethers.getContractFactory("VinculumFinalisVerifier")).deploy(await (await T.deploy("a", "A", 1n)).getAddress(), await (await T.deploy("b", "B", 1n)).getAddress());
    await expect(v.registerAssetRowAlias("Polygon", POL_ROW_ID, "Ethereum")).to.be.revertedWith("VF-REG: alias row not registered");
  });
});
