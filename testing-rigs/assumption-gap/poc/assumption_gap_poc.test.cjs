// Assumption-gap rig (AG-01..AG-09). Converted 2026-10-23 from skipped
// proofs of concept to ACTIVE safe-behavior tests: each test replays the
// original attack on a LOCAL hardhat chain and asserts that the fixed code
// refuses it. Run:
//   testing-rigs/run.sh none assumption-gap/poc/assumption_gap_poc.test.cjs
// Each test name carries its FINDING id (see ../gap_table.md and
// ../../findings/assumption_gap.json). A passing test means the gap is closed.
const path = require("path");
const crypto = require("crypto");
const { createRequire } = require("module");
const BC = path.resolve(__dirname, "../../../base-contracts");
const req = createRequire(path.join(BC, "package.json"));
const { expect } = req("chai");
const { ethers, network } = req("hardhat");
const { ethLockEvidence, encodeEvidence } = req(path.join(BC, "test/lib/ethProof.cjs"));
const UTXO = req(path.join(BC, "test/fixtures/utxo_local_locks.json"));
const XLM = req(path.join(BC, "test/fixtures/stellar_local_locks.json"));
const XRP = req(path.join(BC, "test/fixtures/xrpl_local_locks.json"));

const run = it;
const SCALE = 10n ** 18n;
const DAY = 86400n, DAY7 = 7n * DAY;
const ETH_ID = ethers.solidityPackedKeccak256(["string", "string"], ["Ethereum", "native-ETH"]);
const coder = ethers.AbiCoder.defaultAbiCoder();
const PRICE = 2392n * SCALE;

async function advance(secs) {
  await network.provider.send("evm_increaseTime", [Number(secs)]);
  await network.provider.send("evm_mine", []);
}

// Same deployment shape as base-contracts/test/non_base_finality_trust_model.test.cjs.
async function deploySystem({ ethDevFundOnVerifier, ethReaderContract = "SimpleEthereumLockReader" } = {}) {
  const [deployer, recipient, other, dest, devFund, stranger] = await ethers.getSigners();
  const T = await ethers.getContractFactory("VinculumFinalisToken");
  const vclm = await T.deploy("Vinculum", "VCLM", 10_000_000_000n * SCALE);
  const chonx = await T.deploy("Chonx", "CHONX", 100_000_000_000n * SCALE);
  const verifier = await (await ethers.getContractFactory("VinculumFinalisVerifier")).deploy(
    await vclm.getAddress(), await chonx.getAddress());
  const stake = await (await ethers.getContractFactory("VinculumFinalisStake")).deploy(
    await vclm.getAddress(), await chonx.getAddress(), await vclm.getAddress(), await verifier.getAddress());
  await vclm.initialize(await verifier.getAddress(), await stake.getAddress());
  await chonx.initialize(await verifier.getAddress(), ethers.ZeroAddress);
  const baseLock = await (await ethers.getContractFactory("BaseCommitmentVaultLock")).deploy(
    "Base", devFund.address, await vclm.getAddress(), await chonx.getAddress(), await vclm.getAddress());
  const baseReader = await (await ethers.getContractFactory("BaseLockRecordVerifier")).deploy(await baseLock.getAddress());
  await verifier.registerChainVerifier("Base", await baseReader.getAddress());
  await verifier.registerAssetPrecision("Base", ETH_ID, "ETH", 18, 2, 0);
  await verifier.configureDevFund("Base", devFund.address);
  const ethLock = await (await ethers.getContractFactory("CommitmentVaultLock")).deploy("Ethereum", devFund.address);
  const ethReader = await (await ethers.getContractFactory(ethReaderContract)).deploy(await ethLock.getAddress());
  await verifier.registerChainVerifier("Ethereum", await ethReader.getAddress());
  await verifier.registerAssetPrecision("Ethereum", ETH_ID, "ETH", 18, 2, 0);
  await verifier.configureDevFund("Ethereum", (ethDevFundOnVerifier || devFund).address);
  await verifier.setScheduledPricePoster(deployer.address);
  await verifier.applyScheduledPriceRun(1n, [
    { environmentId: "Base", canonicalAssetId: ETH_ID, priceUsd18: PRICE, success: true },
    { environmentId: "Ethereum", canonicalAssetId: ETH_ID, priceUsd18: PRICE, success: true },
  ]);
  await verifier.finalize();
  return { deployer, recipient, other, dest, devFund, stranger, vclm, chonx, verifier, stake, baseLock, ethLock, ethReader };
}

async function baseLockPkg(c, { valueWei = SCALE / 100n, duration = DAY7 } = {}) {
  const lockId = ethers.hexlify(ethers.randomBytes(32));
  await c.baseLock.connect(c.other).createNativeLock(
    lockId, c.recipient.address, 0, ETH_ID, ethers.ZeroHash, c.dest.address, duration,
    (valueWei * PRICE) / SCALE, { value: valueWei });
  const rec = await c.baseLock.lockRecord(lockId);
  return {
    sourceEnvironmentId: "Base", commitmentVaultLockId: lockId, handshakeAllowanceCount: 3,
    canonicalAssetId: ETH_ID, assetPrecision: 18, assetCustodyClass: 2,
    grossAmountSmallestUnits: rec.gross, actualFeeAmountSmallestUnits: rec.fee,
    principalAmountSmallestUnits: rec.principal, feeAssetId: ETH_ID, devFundDestination: "dev",
    feeTransferEvidence: ethers.id("fee"), valuationTimestamp: rec.createdAt, maturityTimestamp: rec.maturity,
    durationSecs: rec.duration, selectedOutputToken: 0, baseRecipient: c.recipient.address,
    releaseDestination: "release", chonxActivationReceipt: "0x",
    racIdentity: ethers.hexlify(ethers.randomBytes(32)), priceRecord: "0x",
    sourceFinalityProof: "0x",
    lockEventProof: coder.encode(["bytes32", "uint256", "uint256", "uint256", "uint256", "uint256", "uint256"],
      [lockId, rec.gross, rec.fee, rec.principal, rec.duration, rec.createdAt, rec.maturity]),
  };
}

function rlpReplace(rlpHex, index, valueHex) {
  const items = ethers.decodeRlp(rlpHex);
  items[index] = valueHex;
  return ethers.encodeRlp(items);
}

function ethPkg(c, lockId, rec, ev, headerRlp) {
  return {
    sourceEnvironmentId: "Ethereum", commitmentVaultLockId: lockId, handshakeAllowanceCount: 3,
    canonicalAssetId: ETH_ID, assetPrecision: 18, assetCustodyClass: 2,
    grossAmountSmallestUnits: rec.gross, actualFeeAmountSmallestUnits: rec.fee,
    principalAmountSmallestUnits: rec.principal, feeAssetId: ETH_ID, devFundDestination: "dev",
    feeTransferEvidence: ethers.id("fee"), valuationTimestamp: rec.createdAt, maturityTimestamp: rec.maturity,
    durationSecs: rec.duration, selectedOutputToken: 0, baseRecipient: c.recipient.address,
    releaseDestination: "release", chonxActivationReceipt: "0x",
    racIdentity: ethers.hexlify(ethers.randomBytes(32)), priceRecord: "0x",
    sourceFinalityProof: coder.encode(["uint256", "bytes32", "uint256"], [1, ethers.keccak256(headerRlp), ev.block.number]),
    lockEventProof: encodeEvidence({ ...ev, headerRlp }),
  };
}

async function ethLockWithEvidence(c) {
  const lockId = ethers.hexlify(ethers.randomBytes(32));
  const rc = await (await c.ethLock.connect(c.other).createNativeLock(
    lockId, c.recipient.address, 0, ETH_ID, ethers.ZeroHash, c.dest.address, DAY7, PRICE / 100n,
    { value: SCALE / 100n })).wait();
  const ev = await ethLockEvidence(await c.ethLock.getAddress(), rc.hash, lockId);
  return { lockId, ev, rec: await c.ethLock.lockRecord(lockId) };
}

const REFUSED = (env) => `VF-XCH-006: ${env} settled-history anchor not enforced on-chain; environment disabled`;

describe("assumption-gap: every gap is closed (safe behavior, fix 2026-10-23)", function () {
  this.timeout(600000);

  run("AG-01: a forged Ethereum header is refused, and so is a real one (environment disabled until anchored)", async () => {
    const c = await deploySystem();
    const { lockId, ev, rec } = await ethLockWithEvidence(c);
    let forged = rlpReplace(ev.headerRlp, 13, ethers.hexlify(ethers.randomBytes(32)));
    forged = rlpReplace(forged, 0, ethers.hexlify(ethers.randomBytes(32)));
    expect(ethers.keccak256(forged)).to.not.equal(ev.block.hash);
    await expect(c.verifier.recordFeeAndRac(ethPkg(c, lockId, rec, ev, forged))).to.be.revertedWith(REFUSED("Ethereum"));
    await expect(c.verifier.recordFeeAndRac(ethPkg(c, lockId, rec, ev, ev.headerRlp))).to.be.revertedWith(REFUSED("Ethereum"));
    expect(await c.vclm.balanceOf(c.recipient.address)).to.equal(0n);
  });

  run("AG-02: a Bitcoin header with no proof of work is refused (environment disabled until anchored)", async () => {
    const S = UTXO.chains.Bitcoin.standard;
    const reader = await (await ethers.getContractFactory("BitcoinLockReader")).deploy(S.devFundScript);
    const PROOF = "tuple(bytes header, bytes coinbaseTx, bytes32[] coinbaseBranch, bytes lockTx, bytes32[] lockBranch, uint256 lockIndex, bytes redeemScript, bytes payload, uint256 durationSecs)";
    const proof = (h) => coder.encode([PROOF], [[h, S.coinbaseTx, S.coinbaseBranch, S.lockTx, S.lockBranch, S.lockIndex, S.redeemScript, S.payload, S.durationSecs]]);
    const b = Buffer.from(S.header.slice(2), "hex");
    crypto.randomBytes(32).copy(b, 4);
    b.writeUInt32LE(0x1d00ffff, 72);
    b.writeUInt32LE(0x12345678, 76);
    const forged = "0x" + b.toString("hex");
    await expect(reader.verifyFinality(proof(forged), coder.encode(["bytes32", "uint256"], [ethers.ZeroHash, S.height])))
      .to.be.revertedWith(REFUSED("Bitcoin"));
    await expect(reader.verifyFinality(proof(S.header), coder.encode(["bytes32", "uint256"], [S.blockHash, S.height])))
      .to.be.revertedWith(REFUSED("Bitcoin"));
  });

  run("AG-03a: a Stellar ledger header with an arbitrary previous-ledger hash is refused", async () => {
    const L = XLM.week;
    const reader = await (await ethers.getContractFactory("StellarLockReader")).deploy(XLM.networkId, XLM.devFund);
    const PROOF = "tuple(bytes header, bytes resultSet, bytes txXdr, bytes payload, uint256 durationSecs)";
    const b = Buffer.from(L.header.slice(2), "hex");
    crypto.randomBytes(32).copy(b, 4);
    const forged = "0x" + b.toString("hex");
    const forgedHash = "0x" + crypto.createHash("sha256").update(b).digest("hex");
    const pr = coder.encode([PROOF], [{ header: forged, resultSet: L.resultSet, txXdr: L.tx, payload: L.payload, durationSecs: L.durationSecs }]);
    await expect(reader.verifyFinality(pr, coder.encode(["bytes32", "uint256"], [forgedHash, L.ledgerSeq]))).to.be.revertedWith(REFUSED("Stellar"));
  });

  run("AG-03b: an XRPL ledger header with an arbitrary parent hash is refused", async () => {
    const L = XRP.week;
    const reader = await (await ethers.getContractFactory("XrplLockReader")).deploy(XRP.devFundAccountId);
    const PROOF = "tuple(bytes header, bytes paymentTx, bytes paymentMeta, bytes[] paymentInner, bytes escrowTx, bytes escrowMeta, bytes[] escrowInner, bytes payload, uint256 durationSecs)";
    const b = Buffer.from(L.header.slice(2), "hex");
    crypto.randomBytes(32).copy(b, 12);
    const forged = "0x" + b.toString("hex");
    const forgedHash = "0x" + crypto.createHash("sha512").update(Buffer.concat([Buffer.from("4c575200", "hex"), b])).digest().subarray(0, 32).toString("hex");
    const pr = coder.encode([PROOF], [{ header: forged, paymentTx: L.payment.tx, paymentMeta: L.payment.meta, paymentInner: L.payment.inner,
      escrowTx: L.escrow.tx, escrowMeta: L.escrow.meta, escrowInner: L.escrow.inner, payload: L.payload, durationSecs: L.durationSecs }]);
    await expect(reader.verifyFinality(pr, coder.encode(["bytes32", "uint256"], [forgedHash, L.ledgerIndex]))).to.be.revertedWith(REFUSED("XRP Ledger"));
  });

  run("AG-04: one real Base lock records RAC exactly once, whatever racIdentity is supplied", async () => {
    const c = await deploySystem();
    const p = await baseLockPkg(c);
    await c.verifier.recordFeeAndRac(p);
    await c.verifier.verifyAndMint(p, 0);
    const epoch = await c.verifier.currentEpoch();
    const one = await c.verifier.epochRewardBasis(epoch);
    expect(one).to.equal(await c.verifier.racCredits(await c.verifier.racKey("Base", p.commitmentVaultLockId)));
    for (let i = 1; i < 20; i++) {
      await expect(c.verifier.connect(c.stranger).recordFeeAndRac({ ...p, racIdentity: ethers.hexlify(ethers.randomBytes(32)) }))
        .to.be.revertedWith("VF-RAC-001: RAC already recorded");
    }
    expect(await c.verifier.epochRewardBasis(epoch)).to.equal(one);
  });

  run("AG-04 (damage): the stake reward for an epoch is the one credit per lock, not a multiple", async () => {
    const c = await deploySystem();
    const seed = await baseLockPkg(c);
    await c.verifier.recordFeeAndRac(seed);
    await c.verifier.verifyAndMint(seed, 0);
    const staked = await c.vclm.balanceOf(c.recipient.address);
    await c.vclm.connect(c.recipient).approve(await c.stake.getAddress(), staked);
    const posId = await c.stake.nextPositionId();
    await c.stake.connect(c.recipient).createPosition(0, staked, 120n * DAY);
    await advance(10n * DAY); // epoch 2
    const p = await baseLockPkg(c);
    await c.verifier.recordFeeAndRac(p);
    for (let i = 1; i < 50; i++) {
      await expect(c.verifier.recordFeeAndRac({ ...p, racIdentity: ethers.hexlify(ethers.randomBytes(32)) }))
        .to.be.revertedWith("VF-RAC-001: RAC already recorded");
    }
    const e = await c.verifier.currentEpoch();
    const basis = await c.verifier.epochRewardBasis(e);
    expect(basis).to.equal(await c.verifier.racCredits(await c.verifier.racKey("Base", p.commitmentVaultLockId)));
    await advance(25n * DAY);
    for (let n = 1n; n <= e + 1n; n++) await c.stake.closeEpoch(n);
    for (let n = 1n; n <= e; n++) await c.stake.allocateEpoch(n);
    expect((await c.stake.epochs(e)).mintedVclm).to.equal(basis * 10n);
    let total = 0n;
    for (let n = 1n; n <= e; n++) total += (await c.stake.epochs(n)).mintedVclm;
    const before = await c.vclm.balanceOf(c.recipient.address);
    await c.stake.connect(c.recipient).claimPosition(posId, e);
    const claimed = (await c.vclm.balanceOf(c.recipient.address)) - before;
    expect(claimed).to.be.gt(0n);
    expect(claimed).to.be.lte(total);
  });

  run("AG-05: valuationTimestamp = 0 is refused; the proven creation time sets the decayed rate", async () => {
    const c = await deploySystem();
    await advance(400n * DAY);
    await c.verifier.applyScheduledPriceRun(2n, [{ environmentId: "Base", canonicalAssetId: ETH_ID, priceUsd18: PRICE, success: true }]);
    const honest = await baseLockPkg(c);
    const cheat = await baseLockPkg(c);
    const r = c.recipient.address;
    await c.verifier.recordFeeAndRac(honest);
    await c.verifier.verifyAndMint(honest, 0);
    const a = await c.vclm.balanceOf(r);
    await c.verifier.recordFeeAndRac(cheat);
    await expect(c.verifier.verifyAndMint({ ...cheat, valuationTimestamp: 0 }, 0))
      .to.be.revertedWith("VF-ORC-011: valuation timestamp != proven lock creation time");
    await c.verifier.verifyAndMint(cheat, 0);
    expect((await c.vclm.balanceOf(r)) - a).to.equal(a);
  });

  run("AG-06: a later price run does not reprice an older lock (price in effect at creation)", async () => {
    const c = await deploySystem();
    const p = await baseLockPkg(c); // created while ETH = $2,392
    await c.verifier.applyScheduledPriceRun(2n, [{ environmentId: "Base", canonicalAssetId: ETH_ID, priceUsd18: PRICE * 10n, success: true }]);
    await c.verifier.recordFeeAndRac(p);
    await c.verifier.verifyAndMint(p, 0);
    const got = await c.vclm.balanceOf(c.recipient.address);
    const c2 = await deploySystem();
    const p2 = await baseLockPkg(c2);
    await c2.verifier.recordFeeAndRac(p2);
    await c2.verifier.verifyAndMint(p2, 0);
    const fair = await c2.vclm.balanceOf(c2.recipient.address);
    expect(got).to.equal(fair);
  });

  run("AG-07: run ids are sequential, so runId = 2^64-1 cannot freeze future runs", async () => {
    const c = await deploySystem();
    await expect(c.verifier.applyScheduledPriceRun(2n ** 64n - 1n, [{ environmentId: "Base", canonicalAssetId: ETH_ID, priceUsd18: PRICE * 1000n, success: true }]))
      .to.be.revertedWith("VF-ORC-001: run id must be the next in sequence");
    await c.verifier.applyScheduledPriceRun(2n, [{ environmentId: "Base", canonicalAssetId: ETH_ID, priceUsd18: PRICE, success: true }]);
    expect(await c.verifier.lastScheduledRunId()).to.equal(2n);
    await c.verifier.applyScheduledPriceRun(3n, []);
    expect(await c.verifier.lastScheduledRunId()).to.equal(3n);
  });

  run("AG-09: a lock whose Dev Fund differs from the configured Dev Fund is refused", async () => {
    const [, , , , , stranger] = await ethers.getSigners();
    const c = await deploySystem({ ethDevFundOnVerifier: stranger, ethReaderContract: "SimpleEthereumLockReaderTestAnchor" });
    expect(await c.verifier.devFundDestinations("Ethereum")).to.not.equal(await c.ethLock.devFund());
    const { lockId, ev, rec } = await ethLockWithEvidence(c);
    await expect(c.verifier.recordFeeAndRac(ethPkg(c, lockId, rec, ev, ev.headerRlp)))
      .to.be.revertedWith("VF-FEE-009: lock Dev Fund != configured Dev Fund");
    // Control: with the matching Dev Fund the same proof path passes.
    const ok = await deploySystem({ ethReaderContract: "SimpleEthereumLockReaderTestAnchor" });
    const g = await ethLockWithEvidence(ok);
    await ok.verifier.recordFeeAndRac(ethPkg(ok, g.lockId, g.rec, g.ev, g.ev.headerRlp));
    expect(await ok.verifier.isLockRacRecorded("Ethereum", g.lockId)).to.equal(true);
  });
});
