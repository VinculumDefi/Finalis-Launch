// Shared suite for test/sampled/*.test.cjs (one file per chain, run separately).
// Sampled CVL + TRS tests (t204u/t205u). For each of the seven EVM lock
// configurations, every sampled token (all when few, the seeded 10% plus the
// always-included well-known tokens and the native coin when many - see
// test/lib/sampling.cjs) is locked at ALL 16 CommitmentVaultLock durations at
// 5%; the chain's reader proves each lock; the Verifier mints; then the minted
// VCLM is staked at all four TRS durations. Tokens sit at their real registry
// addresses (ERC-20 test code placed there). In-process Hardhat chain only.
const { expect } = require("chai");
const { ethers, network } = require("hardhat");
const { ethLockEvidence, encodeEvidence, EVIDENCE_TYPE } = require("./ethProof.cjs");
const { sampleTokens, SEED } = require("./sampling.cjs");
const { ASSET_ROW_ALIASES } = require("../../scripts/testChainCeremony.cjs");
const REG = require("../../deployment/assetRegistry.resolved.json").entries;

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
  // Registry rows (exact rows from the 961 + Base ETH) for the natives and every sampled token.
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
  return { verifier, vclm, stake, locks, readers, devFund, code };
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

// One lock -> proof -> mint. Returns the VCLM minted.
async function lockProveMint(env, user, recipient, asset, duration) {
  const lock = V.locks[env].connect(user);
  const hs = duration === 3600n;
  const units = hs ? HS_UNITS : STD_UNITS, usd = hs ? HS_USD : STD_USD;
  const lockId = ethers.hexlify(ethers.randomBytes(32));
  const tx = asset.token
    ? await lock.createErc20Lock(lockId, recipient, 0, ethers.ZeroHash, ethers.ZeroHash, recipient, duration, asset.token, units, usd)
    : await lock.createNativeLock(lockId, recipient, 0, ethers.ZeroHash, ethers.ZeroHash, recipient, duration, usd, { value: units });
  const rc = await tx.wait();
  const rec = await V.locks[env].lockRecord(lockId);
  expect(rec.fee).to.equal((units * 500n) / 10000n); // 5% on every duration, Handshake included
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
    selectedOutputToken: 0, baseRecipient: recipient, releaseDestination: "release",
    chonxActivationReceipt: "0x", racIdentity: ethers.hexlify(ethers.randomBytes(32)), priceRecord: "0x",
    sourceFinalityProof: finality, lockEventProof: proof,
  };
  const before = await V.vclm.balanceOf(recipient);
  await V.verifier.recordFeeAndRac(p);
  await V.verifier.verifyAndMint(p, 0);
  const minted = (await V.vclm.balanceOf(recipient)) - before;
  expect(minted, `${env} ${asset.label} ${duration}s minted`).to.be.gt(0n);
  return minted;
}

async function stakeAllFour(holder) {
  const bal = await V.vclm.balanceOf(holder.address);
  const each = bal / 4n;
  expect(each).to.be.gt(0n);
  await V.vclm.connect(holder).approve(await V.stake.getAddress(), bal);
  for (const [secs, bps] of TRS) {
    const id = await V.stake.nextPositionId();
    await V.stake.connect(holder).createPosition(0, each, secs);
    const pos = await V.stake.positions(id);
    expect(pos.owner).to.equal(holder.address);
    expect(pos.durationSecs).to.equal(secs);
    expect(pos.multiplierBps).to.equal(bps);
  }
}

function runSampled(ENVS) {
describe(`Sampled CVL x 16 durations + TRS x 4 durations (seed "${SEED}")`, function () {
  this.timeout(0);
  before(async () => { V = await deployAll(); });

  for (const env of ENVS) {
    const s = SAMPLE[env];
    const nat = row(NATIVE[env].row);
    const assets = [
      { label: "native", token: null, canonicalAssetId: nat.canonicalAssetId, decimals: nat.decimals, custodyClass: nat.custodyClass },
      ...s.tokens.map((t) => ({ label: t.symbol + " (row " + t.row + ")", token: t.token, canonicalAssetId: t.canonicalAssetId,
        decimals: row(t.row).decimals, custodyClass: row(t.row).custodyClass })),
    ];
    describe(`${env}: ${s.tokens.length} of ${s.total} indexed tokens (${s.few ? "all" : "seeded 10% + well-known"}) + native`, function () {
      for (const a of assets) {
        it(`${a.label}: 16 CVL durations at 5%, proven and minted; TRS at 30/60/90/120 days`, async () => {
          const user = ethers.Wallet.createRandom().connect(ethers.provider);
          const holder = ethers.Wallet.createRandom().connect(ethers.provider);
          await network.provider.send("hardhat_setBalance", [user.address, "0x56bc75e2d63100000"]);
          await network.provider.send("hardhat_setBalance", [holder.address, "0x56bc75e2d63100000"]);
          if (a.token) {
            await network.provider.send("hardhat_setCode", [a.token, V.code]);
            const tok = await ethers.getContractAt("TestFixtureERC20", a.token);
            await tok.mint(user.address, STD_UNITS * 32n);
            await tok.connect(user).approve(await V.locks[env].getAddress(), STD_UNITS * 32n);
          }
          for (const d of DURATIONS) await lockProveMint(env, user, holder.address, a, d);
          await stakeAllFour(holder);
        });
      }
    });
  }
});
}
module.exports = { runSampled };
