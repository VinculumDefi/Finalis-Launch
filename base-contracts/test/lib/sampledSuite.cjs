// Shared suite for test/sampled/*.test.cjs (one file per chain, run separately).
// t209u: every lock asserts the EXACT minted amount (expected value computed
// here from Revision 6 constants in src/lib/vfRevision6Authority.js, not from
// the contract), release refused before maturity, release at maturity returns
// exactly rec.principal (95% of gross) to the destination, second release
// refused, a wallet other than the recorded destination refused. TRS: each of
// the four staking positions holds exactly the staked VCLM, withdraw is refused
// before maturity and for a non-owner, returns exactly the staked VCLM to the
// owner at maturity, and a second withdraw is refused (t224u piece 4).
// One CHONX case per lock configuration.
// Sampled CVL + TRS tests (t204u/t205u). For each of the seven EVM lock
// configurations, every sampled token (all when few, the seeded 10% plus the
// always-included well-known tokens and the native coin when many - see
// test/lib/sampling.cjs) is locked at ALL 16 CommitmentVaultLock durations at
// 5%; the chain's reader proves each lock; the Verifier mints; then the minted
// VCLM is staked at all four TRS durations. Tokens sit at their real registry
// addresses (ERC-20 test code placed there). In-process Hardhat chain only.
const { expect } = require("chai");
const path = require("path");
const { pathToFileURL } = require("url");
const { ethers, network } = require("hardhat");
const { ethLockEvidence, encodeEvidence, EVIDENCE_TYPE } = require("./ethProof.cjs");
const { sampleTokens, SEED } = require("./sampling.cjs");
const { ASSET_ROW_ALIASES } = require("../../scripts/testChainCeremony.cjs");
// Revision B rows under their own environment (deployment/assetRegistry.revB.json).
const REG = require("../../scripts/registryFile.cjs").loadRegistry().written;

const coder = ethers.AbiCoder.defaultAbiCoder();
const SCALE = 10n ** 18n;
const DURATIONS = [3600n, 604800n, 2592000n, 5184000n, 7776000n, 15552000n, 31536000n, 63072000n, 94608000n, 126144000n,
  157680000n, 189216000n, 220752000n, 252288000n, 283824000n, 315360000n];
const TRS = [[30n * 86400n, 10000n], [60n * 86400n, 14000n], [90n * 86400n, 17500n], [120n * 86400n, 21000n]];
const HS_UNITS = 10000n, STD_UNITS = 100000000n; // $0.015 and $150 at the price below
const HS_USD = 15n * SCALE / 1000n, STD_USD = 150n * SCALE;
const priceFor = (dec) => (HS_USD * 10n ** BigInt(dec)) / HS_UNITS; // so HS_UNITS is worth $0.015

const READERS = {
  Base: { contract: "BaseLockRecordVerifier", chainId: 8453 },
  Ethereum: { contract: "SimpleEthereumLockReader", chainId: 1 },
  Optimism: { contract: "OptimismLockReader", chainId: 10 },
  Arbitrum: { contract: "ArbitrumLockReaderLocalHeaders", chainId: 42161 },
  Polygon: { contract: "PolygonLockReaderLocalHeaders", chainId: 137 },
  "BNB Smart Chain": { contract: "BnbSmartChainLockReaderLocalHeaders", chainId: 56 },
  Avalanche: { contract: "AvalancheLockReaderLocalHeaders", chainId: 43114, avax: true },
};
const NATIVE = { // the row each chain's native coin resolves to (registry row number)
  Base: { row: 2, env: "Base" }, Ethereum: { row: 2 }, Arbitrum: { row: 2 }, Optimism: { row: 2 },
  Polygon: { row: 114 }, "BNB Smart Chain": { row: 18 }, Avalanche: { row: 23 },
};
const SAMPLE = sampleTokens();
const DAY = 86400n;
const row = (n) => REG.find((e) => e.row === n);

let V; // shared deployment
async function deployAll() {
  const [deployer, devFund] = await ethers.getSigners();
  const T = await ethers.getContractFactory("VinculumFinalisToken");
  const vclm = await T.deploy("Vinculum", "VCLM", 10_000_000_000n * SCALE);
  const chonx = await T.deploy("Chonx", "CHONX", 100_000_000_000n * SCALE);
  const verifier = await (await ethers.getContractFactory("VinculumFinalisVerifier")).deploy(await vclm.getAddress(), await chonx.getAddress());
  const launch = (await ethers.provider.getBlock("latest")).timestamp;
  const forge = await (await ethers.getContractFactory("VinculumFinalisSynth")).deploy(await verifier.getAddress(), await vclm.getAddress(), await chonx.getAddress());
  const stake = await (await ethers.getContractFactory("VinculumFinalisStake")).deploy(
    await vclm.getAddress(), await chonx.getAddress(), await forge.getAddress(), await verifier.getAddress(), launch);
  await vclm.initialize(await verifier.getAddress(), await stake.getAddress());
  await chonx.initialize(await verifier.getAddress(), ethers.ZeroAddress);

  const locks = {}, readers = {};
  for (const [env, r] of Object.entries(READERS)) {
    locks[env] = await (await ethers.getContractFactory("CommitmentVaultLock")).deploy(env, devFund.address);
    readers[env] = await (await ethers.getContractFactory(r.contract)).deploy(await locks[env].getAddress());
    await verifier.registerChainVerifier(env, await readers[env].getAddress());
    await verifier.configureDevFund(env, devFund.address);
  }
  // Registry rows (exact Revision B rows, Base ETH = row 2 under Base) for the natives and every sampled token.
  const rows = new Map();
  const add = (env, e) => rows.set(env + "|" + e.canonicalAssetId, [env, e.canonicalAssetId, e.symbol, e.decimals, e.custodyClass, e.custodyPath]);
  add("Base", row(2));
  for (const n of Object.values(NATIVE)) add(row(n.row).environmentId, row(n.row));
  for (const env of Object.keys(SAMPLE)) for (const t of SAMPLE[env].tokens) add(env, row(t.row));
  const list = [...rows.values()];
  for (let i = 0; i < list.length; i += 50) await verifier.registerAssetPrecisionBatch(list.slice(i, i + 50));
  const idx = Object.values(SAMPLE).flatMap((s) => s.tokens).map((t) => ({ environmentId: t.environmentId, token: t.token, canonicalAssetId: t.canonicalAssetId }));
  for (let i = 0; i < idx.length; i += 50) await verifier.registerTokenAddressBatch(idx.slice(i, i + 50));
  for (const a of ASSET_ROW_ALIASES) await verifier.registerAssetRowAlias(a.environmentId, a.canonicalAssetId, a.rowEnvironmentId);
  await verifier.setScheduledPricePoster(deployer.address);
  const prices = list.map(([env, id, , dec]) => ({ environmentId: env, canonicalAssetId: id, priceUsd18: priceFor(dec), success: true }));
  for (let i = 0; i < prices.length; i += 100) await verifier.applyScheduledPriceRun(BigInt(1 + i / 100), prices.slice(i, i + 100));
  await verifier.finalize();
  const code = await ethers.provider.getCode(await (await (await ethers.getContractFactory("TestFixtureERC20")).deploy(0)).getAddress());
  return { verifier, vclm, chonx, stake, locks, readers, devFund, code };
}

async function evidenceFor(env, lockAddr, txHash, lockId) {
  const ev = await ethLockEvidence(lockAddr, txHash, lockId);
  if (READERS[env].avax) {
    const base = BigInt(ethers.keccak256(coder.encode(["bytes32", "uint256"], [lockId, 1])));
    const pr = await ethers.provider.send("eth_getProof", [lockAddr, [ethers.toBeHex(base + 9n, 32)], ev.block.number]);
    return { proof: coder.encode([`tuple(${EVIDENCE_TYPE} base, bytes[] createdAtSlotNodes)`], [[
      [ev.headerRlp, ev.receipt, ev.receiptIndex, ev.receiptNodes, ev.logIndex, ev.accountNodes, ev.envSlotNodes, ev.recipientSlotNodes],
      pr.storageProof[0].proof]]), block: ev.block };
  }
  return { proof: encodeEvidence(ev), block: ev.block };
}


// ---- Independent expected issuance (Revision 6; Revision 12 changes only the Handshake) ----
let R6; // src/lib/vfRevision6Authority.js, loaded in before()
// Revision 6 asset classes: S1 canonical Ethereum USDC/USDT; S2 native ETH, BTC and
// canonical Ethereum AAVE, LINK, UNI; S3 every other entry.
function rev6Class(r) {
  if (r.environmentId === "Ethereum" && ["USDC", "USDT"].includes(r.symbol)) return 1;
  if (r.assetId === "native-ETH" || r.symbol === "BTC") return 2;
  if (r.environmentId === "Ethereum" && ["AAVE", "LINK", "UNI"].includes(r.symbol)) return 2;
  return 3;
}
function expectedIssuance({ gross, decimals, priceUsd18, custodyClass, duration, createdAt, launch, output }) {
  const S = R6.SCALE;
  // Verified Gross USD Value before fee (VF-COM-017), every division floors (VF-COM-019).
  const usd = (((gross * S) / 10n ** BigInt(decimals)) * priceUsd18) / S;
  const em = output === 0 ? R6.EMISSION.VCLM : R6.EMISSION.CHONX;
  const days = createdAt > launch ? (createdAt - launch) / DAY : 0n;
  let rate = em.initial_rate_per_dollar;
  for (let i = 0n; i < days / BigInt(R6.DECAY.period_days); i++) {
    rate = (rate * R6.DECAY.survival_fp) / S;
    if (rate <= em.permanent_floor_per_dollar) { rate = em.permanent_floor_per_dollar; break; }
  }
  const classBps = BigInt(R6.ASSET_CLASS_MULTIPLIERS_BPS["S" + custodyClass]);
  const dRow = R6.COMMITMENT_DURATIONS.find((d) => BigInt(d.secs) === duration);
  if (!dRow) throw new Error("duration not in Revision 6 table: " + duration);
  let step = (usd * rate) / S;                                   // x emission rate
  step = (step * ((S * classBps) / 10000n)) / S;                 // x asset multiplier
  step = (step * ((S * BigInt(dRow.multiplier_bps)) / 10000n)) / S; // x duration multiplier
  return { usd, rate, issuance: step };
}

// One lock -> proof -> mint, with the exact minted amount asserted.
async function lockProveMint(env, user, recipient, dest, asset, duration, opt = {}) {
  const output = opt.output || 0;
  const lock = V.locks[env].connect(user);
  const hs = duration === 3600n;
  const units = opt.units || (hs ? HS_UNITS : STD_UNITS);
  const usd = opt.usd || (hs ? HS_USD : STD_USD);
  const lockId = ethers.hexlify(ethers.randomBytes(32));
  const tx = asset.token
    ? await lock.createErc20Lock(lockId, recipient, output, ethers.ZeroHash, ethers.ZeroHash, dest, duration, asset.token, units, usd)
    : await lock.createNativeLock(lockId, recipient, output, ethers.ZeroHash, ethers.ZeroHash, dest, duration, usd, { value: units });
  const rc = await tx.wait();
  const rec = await V.locks[env].lockRecord(lockId);
  expect(rec.gross).to.equal(units);
  expect(rec.fee).to.equal((units * 500n) / 10000n); // 5% on every duration, Handshake included
  expect(rec.principal).to.equal(units - (units * 500n) / 10000n);
  expect(rec.releaseDestination).to.equal(dest); // the recorded destination is the one given at lock creation
  let proof, finality = "0x";
  if (env === "Base") proof = coder.encode(["bytes32", "uint256", "uint256", "uint256", "uint256", "uint256", "uint256"],
    [lockId, rec.gross, rec.fee, rec.principal, rec.duration, rec.createdAt, rec.maturity]);
  else {
    const ev = await evidenceFor(env, await V.locks[env].getAddress(), rc.hash, lockId);
    proof = ev.proof;
    finality = coder.encode(["uint256", "bytes32", "uint256"], [READERS[env].chainId, ev.block.hash, ev.block.number]);
  }
  const reported = await V.readers[env].extractAssetId(proof);
  expect(reported === asset.canonicalAssetId || (await V.verifier.tokenAssetIndex(reported)) === asset.canonicalAssetId).to.equal(true);
  const p = {
    sourceEnvironmentId: env, commitmentVaultLockId: lockId, handshakeAllowanceCount: 3,
    canonicalAssetId: asset.canonicalAssetId, assetPrecision: asset.decimals, assetCustodyClass: asset.custodyClass,
    grossAmountSmallestUnits: rec.gross, actualFeeAmountSmallestUnits: rec.fee, principalAmountSmallestUnits: rec.principal,
    feeAssetId: asset.canonicalAssetId, devFundDestination: "dev", feeTransferEvidence: ethers.id("fee"),
    valuationTimestamp: rec.createdAt, maturityTimestamp: rec.maturity, durationSecs: rec.duration,
    selectedOutputToken: output, baseRecipient: recipient, releaseDestination: "release",
    chonxActivationReceipt: opt.receipt || "0x", racIdentity: ethers.hexlify(ethers.randomBytes(32)), priceRecord: "0x",
    sourceFinalityProof: finality, lockEventProof: proof,
  };
  const out = output === 0 ? V.vclm : V.chonx;
  const before = await out.balanceOf(recipient);
  await V.verifier.recordFeeAndRac(p);
  if (opt.expectRevert) {
    await expect(V.verifier.verifyAndMint(p, 0)).to.be.revertedWith(opt.expectRevert);
    return { lockId, rec, pkg: p };
  }
  await V.verifier.verifyAndMint(p, 0);
  const minted = (await out.balanceOf(recipient)) - before;
  const exp = expectedIssuance({
    gross: rec.gross, decimals: asset.decimals, priceUsd18: priceFor(asset.decimals), custodyClass: asset.custodyClass,
    duration, createdAt: rec.createdAt, launch: V.launch, output,
  });
  expect(exp.issuance, `${env} ${asset.label} ${duration}s expected > 0`).to.be.gt(0n);
  expect(minted, `${env} ${asset.label} ${duration}s ${output ? "CHONX" : "VCLM"} minted`).to.equal(exp.issuance);
  // Release refused before maturity.
  await expect(V.locks[env].connect(opt.destSigner).release(lockId)).to.be.revertedWith("CVL: immature");
  return { lockId, rec, minted, exp };
}

// At maturity (Hardhat time), release returns exactly rec.principal; one second
// earlier it is refused; a second release is refused.
async function releaseAtMaturity(env, destSigner, asset, l) {
  const lock = V.locks[env].connect(destSigner);
  const now = BigInt((await ethers.provider.getBlock("latest")).timestamp);
  if (l.rec.maturity - 1n > now) {
    await network.provider.send("evm_setNextBlockTimestamp", [Number(l.rec.maturity - 1n)]);
    await expect(lock.release(l.lockId)).to.be.revertedWith("CVL: immature");
  }
  const now2 = BigInt((await ethers.provider.getBlock("latest")).timestamp);
  if (l.rec.maturity > now2) await network.provider.send("evm_setNextBlockTimestamp", [Number(l.rec.maturity)]);
  // At maturity, any wallet other than the recorded destination is refused.
  const other = (await ethers.getSigners())[3];
  expect(other.address).to.not.equal(l.rec.releaseDestination);
  await expect(V.locks[env].connect(other).release(l.lockId)).to.be.revertedWith("CVL: destination");
  // principal = gross - floor(5% of gross); exactly 95% when 5% of gross is a whole unit.
  expect(l.rec.principal).to.equal(l.rec.gross - (l.rec.gross * 500n) / 10000n);
  expect(l.rec.releaseDestination).to.equal(destSigner.address);
  if ((l.rec.gross * 500n) % 10000n === 0n) expect(l.rec.principal * 100n).to.equal(l.rec.gross * 95n);
  if (asset.token) {
    const tok = await ethers.getContractAt("TestFixtureERC20", asset.token);
    await expect(lock.release(l.lockId)).to.changeTokenBalances(tok, [destSigner, V.locks[env]], [l.rec.principal, -l.rec.principal]);
  } else {
    await expect(lock.release(l.lockId)).to.changeEtherBalances([destSigner, V.locks[env]], [l.rec.principal, -l.rec.principal]);
  }
  expect((await V.locks[env].lockRecord(l.lockId)).released).to.equal(true);
  await expect(lock.release(l.lockId)).to.be.revertedWith("CVL: already released");
}

async function stakeAllFour(holder) {
  const bal = await V.vclm.balanceOf(holder.address);
  const each = bal / 4n;
  expect(each).to.be.gt(0n);
  await V.vclm.connect(holder).approve(await V.stake.getAddress(), bal);
  const ids = [];
  const stakeBefore = await V.vclm.balanceOf(await V.stake.getAddress());
  for (const [secs, bps] of TRS) {
    const id = await V.stake.nextPositionId();
    await V.stake.connect(holder).createPosition(0, each, secs);
    const pos = await V.stake.positions(id);
    expect(pos.owner).to.equal(holder.address);
    expect(pos.amount).to.equal(each);
    expect(pos.durationSecs).to.equal(secs);
    expect(pos.multiplierBps).to.equal(bps);
    expect(pos.endTimestamp - pos.startTimestamp).to.equal(secs);
    ids.push(id);
  }
  expect((await V.vclm.balanceOf(await V.stake.getAddress())) - stakeBefore).to.equal(each * 4n);
  expect(await V.vclm.balanceOf(holder.address)).to.equal(bal - each * 4n);
  // Withdraw each position (in a snapshot, so the next token's timing is unchanged):
  // refused before maturity and for a non-owner; at maturity exactly the staked VCLM
  // returns to the owner; a second withdraw is refused.
  const snap = await network.provider.send("evm_snapshot", []);
  const other = (await ethers.getSigners())[3];
  for (const id of ids) {
    const pos = await V.stake.positions(id);
    const now = BigInt((await ethers.provider.getBlock("latest")).timestamp);
    if (pos.endTimestamp - 1n > now) {
      await network.provider.send("evm_setNextBlockTimestamp", [Number(pos.endTimestamp - 1n)]);
      await expect(V.stake.connect(holder).withdrawPosition(id)).to.be.revertedWith("VFS: not matured");
    }
    const now2 = BigInt((await ethers.provider.getBlock("latest")).timestamp);
    if (pos.endTimestamp > now2) await network.provider.send("evm_setNextBlockTimestamp", [Number(pos.endTimestamp)]);
    await expect(V.stake.connect(other).withdrawPosition(id)).to.be.revertedWith("VFS: not owner");
    await expect(V.stake.connect(holder).withdrawPosition(id)).to.changeTokenBalances(V.vclm, [holder, V.stake], [each, -each]);
    expect((await V.stake.positions(id)).withdrawn).to.equal(true);
    await expect(V.stake.connect(holder).withdrawPosition(id)).to.be.revertedWith("VFS: withdrawn");
  }
  expect(await V.vclm.balanceOf(holder.address)).to.equal(bal);
  await network.provider.send("evm_revert", [snap]);
}

async function funded() {
  const w = ethers.Wallet.createRandom().connect(ethers.provider);
  await network.provider.send("hardhat_setBalance", [w.address, "0x56bc75e2d63100000"]);
  return w;
}

function runSampled(ENVS) {
describe(`Sampled CVL x 16 durations + TRS x 4 durations (seed "${SEED}")`, function () {
  this.timeout(0);
  before(async () => {
    R6 = await import(pathToFileURL(path.join(__dirname, "..", "..", "..", "src", "lib", "vfRevision6Authority.js")).href);
    V = await deployAll();
    V.launch = await V.verifier.protocolLaunchTimestamp();
    expect(V.launch).to.be.gt(0n);
  });

  for (const env of ENVS) {
    const s = SAMPLE[env];
    const nat = row(NATIVE[env].row);
    const mk = (r, label, token) => ({ label, token, canonicalAssetId: r.canonicalAssetId, decimals: r.decimals, custodyClass: r.custodyClass, r });
    const assets = [mk(nat, "native", null), ...s.tokens.map((t) => mk(row(t.row), t.symbol + " (row " + t.row + ")", t.token))];
    describe(`${env}: ${s.tokens.length} of ${s.total} indexed tokens (${s.few ? "all" : "seeded 10% + well-known"}) + native`, function () {
      for (const a of assets) {
        it(`${a.label}: 16 CVL durations at 5%, proven, exact VCLM minted, released at maturity; TRS at 30/60/90/120 days`, async () => {
          // Revision 6 asset class of this row, checked against the registry row.
          expect(a.custodyClass, `${a.label} Revision 6 asset class`).to.equal(rev6Class(a.r));
          // Move one decay period forward per token so the emission rate varies.
          await network.provider.send("evm_increaseTime", [Number(31n * DAY)]);
          await network.provider.send("evm_mine");
          const user = await funded(), holder = await funded(), dest = await funded();
          if (a.token) {
            await network.provider.send("hardhat_setCode", [a.token, V.code]);
            const tok = await ethers.getContractAt("TestFixtureERC20", a.token);
            await tok.mint(user.address, STD_UNITS * 32n);
            await tok.connect(user).approve(await V.locks[env].getAddress(), STD_UNITS * 32n);
          }
          const locks = [];
          let total = 0n;
          for (const d of DURATIONS) {
            const l = await lockProveMint(env, user, holder.address, dest.address, a, d, { destSigner: dest });
            locks.push(l); total += l.minted;
          }
          expect(await V.vclm.balanceOf(holder.address)).to.equal(total);
          await stakeAllFour(holder);
          // Release each lock at its maturity, then roll time back for the next token.
          const snap = await network.provider.send("evm_snapshot", []);
          for (const l of locks.sort((x, y) => (x.rec.maturity < y.rec.maturity ? -1 : 1))) await releaseAtMaturity(env, dest, a, l);
          await network.provider.send("evm_revert", [snap]);
        });
      }

      it(`CHONX: native lock after activation mints the exact CHONX amount; released at maturity`, async () => {
        const nativeAsset = assets[0];
        const user = await funded(), holder = await funded(), dest = await funded();
        // Before activation a CHONX package is refused (VF-COM-025).
        if (!(await V.verifier.chonxActivated())) {
          await lockProveMint(env, user, holder.address, dest.address, nativeAsset, 315360000n,
            { output: 1, receipt: "0x01", destSigner: dest, expectRevert: "VF-COM-025: CHONX not activated" });
          // Activate: one VCLM lock large enough to take lifetime VCLM past 10,000,000.
          const need = R6.CHONX_ACTIVATION_THRESHOLD - (await V.verifier.cumulativeVclmIssued());
          const price = priceFor(nativeAsset.decimals);
          const units = (need * 10n ** BigInt(nativeAsset.decimals)) / price + 1n; // >= need USD at >= 1 VCLM per $
          await lockProveMint(env, user, holder.address, dest.address, nativeAsset, 315360000n,
            { units, usd: (units * price) / 10n ** BigInt(nativeAsset.decimals), destSigner: dest });
        }
        expect(await V.verifier.chonxActivated()).to.equal(true);
        expect(await V.verifier.cumulativeVclmIssued()).to.be.gte(R6.CHONX_ACTIVATION_THRESHOLD);
        const activationBlock = await V.verifier.chonxActivationBlock();
        const receipt = coder.encode(["uint256"], [activationBlock]);
        // A CHONX package without an activation receipt is refused.
        await lockProveMint(env, user, holder.address, dest.address, nativeAsset, 2592000n,
          { output: 1, receipt: "0x", destSigner: dest, expectRevert: "VF-COM-025: missing activation receipt" });
        // The CHONX lock, created after activation, at 30 days.
        const l = await lockProveMint(env, user, holder.address, dest.address, nativeAsset, 2592000n,
          { output: 1, receipt, destSigner: dest });
        expect(BigInt(l.rec.createdAt)).to.be.gt(0n);
        expect(l.minted).to.equal(l.exp.issuance);
        expect(await V.chonx.balanceOf(holder.address)).to.equal(l.minted);
        const snap = await network.provider.send("evm_snapshot", []);
        await releaseAtMaturity(env, dest, nativeAsset, l);
        await network.provider.send("evm_revert", [snap]);
      });
    });
  }
});
}
module.exports = { runSampled, expectedIssuance, rev6Class };
