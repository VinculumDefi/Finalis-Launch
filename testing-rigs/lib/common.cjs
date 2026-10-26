// Shared helpers for the testing rigs. In-process Hardhat only (plain or a
// local fork). Nothing is broadcast, nothing is signed with a real key.
const path = require("path");
const BC = path.resolve(__dirname, "../../base-contracts");
const { ethers, network } = require(path.join(BC, "node_modules/hardhat"));
const art = require(path.join(BC, "scripts/deploy-pages/ceremony.json"));
const DATA = require(path.join(BC, "scripts/deploy-pages/ceremony-data.json"));
const FLOW = require(path.join(BC, "scripts/deploy-pages/baseCeremonyFlow.js"));
const PROOF = require(path.join(BC, "test/lib/ethProof.cjs"));

const SCALE = 10n ** 18n;
const DAY7 = 604800n;
const YEAR10 = 315360000n;
const coder = ethers.AbiCoder.defaultAbiCoder();
const ETH_ID = DATA.row2.canonicalAssetId;
const ETH_PRICE = BigInt(DATA.priceUsd18);

// Never print a full address in a report.
const short = (a) => (a ? String(a).slice(0, 6) + "..." + String(a).slice(-4) : String(a));
const fmt = (x, d = 18) => ethers.formatUnits(x, d);

// Base-only launch: ceremony-data holds only the 130 Base rows. Rigs that
// probe non-Base rows (to show they are refused) look them up in the full
// ceremony source, registry Revision D (t430u).
let FULL_REVB = null;
const entry = (env, sym) => {
  let e = DATA.entries.find((x) => x.environmentId === env && x.symbol === sym);
  if (!e && env !== "Base") {
    if (!FULL_REVB) FULL_REVB = require(path.join(BC, "scripts/deploy-pages/resolveAssetRegistry.cjs")).resolveCeremonyRegistry().entries;
    e = FULL_REVB.find((x) => x.environmentId === env && x.symbol === sym);
  }
  if (!e) throw new Error("no registry row " + env + " " + sym);
  return e;
};

const EVM_ENVS = ["Ethereum", "Arbitrum", "Optimism", "Polygon", "BNB Smart Chain", "Avalanche"];
const CVL_ARTIFACT = path.join(BC, "artifacts/contracts/CommitmentVaultLock.sol/CommitmentVaultLock.json");

// Full stack the way the Base-only ceremony page does it: runBaseCeremony
// with the built ceremony.json artifacts and the Base subset in
// ceremony-data.json (one reader, Base). The poster is impersonated after
// the hand-over so tests can post price runs >= 2.
// nonBase: unregistered local stand-in CommitmentVaultLocks (compiled
// artifact) for the six EVM chains, so rigs can show that a lock on a
// non-Base chain is refused by the Verifier (no reader is registered).
async function deployStack({ log, withNonBaseStandIns = true } = {}) {
  const signers = await ethers.getSigners();
  const signer = signers[0];
  const logs = [];
  const r = await FLOW.runBaseCeremony({
    ethers, signer, art, data: DATA,
    log: (s) => { logs.push(...String(s).split("\n")); if (log) log(s); },
  });
  await network.provider.send("hardhat_impersonateAccount", [DATA.scheduledPricePoster]);
  await network.provider.send("hardhat_setBalance", [DATA.scheduledPricePoster, "0x56BC75E2D63100000"]);
  const poster = await ethers.getSigner(DATA.scheduledPricePoster);
  const nonBase = {};
  const newLocks = {};
  if (withNonBaseStandIns) {
    const cvl = require(CVL_ARTIFACT);
    const L = new ethers.ContractFactory(cvl.abi, cvl.bytecode, signer);
    for (const env of EVM_ENVS) {
      nonBase[env] = await L.deploy(env, DATA.devFund);
      await nonBase[env].waitForDeployment();
      newLocks[env] = await nonBase[env].getAddress();
    }
  }
  let run = 1n;
  const postPrices = async (rows) => {
    run += 1n;
    await (await r.verifier.connect(poster).applyScheduledPriceRun(run, rows.map((x) => ({ success: true, ...x })))).wait();
  };
  return { ...r, logs, poster, nonBase, newLocks, signers, postPrices };
}

// Package for a Base lock (the Base reader reads the live lock record).
function basePkg(lockId, rec, assetId, custodyClass, decimals, opts = {}) {
  return {
    sourceEnvironmentId: "Base", commitmentVaultLockId: lockId, handshakeAllowanceCount: 3,
    canonicalAssetId: assetId, assetPrecision: decimals, assetCustodyClass: custodyClass,
    grossAmountSmallestUnits: rec.gross, actualFeeAmountSmallestUnits: rec.fee, principalAmountSmallestUnits: rec.principal,
    feeAssetId: assetId, devFundDestination: "dev", feeTransferEvidence: ethers.id("fee:" + lockId),
    valuationTimestamp: opts.valuationTimestamp !== undefined ? opts.valuationTimestamp : rec.createdAt,
    maturityTimestamp: rec.maturity, durationSecs: rec.duration,
    selectedOutputToken: rec.outputToken, baseRecipient: rec.baseRecipient, releaseDestination: "release",
    chonxActivationReceipt: "0x", racIdentity: opts.racIdentity || ethers.id("rac:" + lockId), priceRecord: "0x",
    sourceFinalityProof: "0x",
    lockEventProof: coder.encode(["bytes32", "uint256", "uint256", "uint256", "uint256", "uint256", "uint256"],
      [lockId, rec.gross, rec.fee, rec.principal, rec.duration, rec.createdAt, rec.maturity]),
  };
}

// Package for an EVM receipt-reader lock, with evidence built from THIS
// chain (header RLP, receipts trie, eth_getProof). On a non-Ethereum chain
// this is exactly a "self-consistent header that is not Ethereum history".
async function evmPkg(env, lockAddr, txHash, lockId, rec, assetId, custodyClass, decimals, chainId, opts = {}) {
  const ev = await PROOF.ethLockEvidence(lockAddr, txHash, lockId);
  return {
    sourceEnvironmentId: env, commitmentVaultLockId: lockId, handshakeAllowanceCount: 3,
    canonicalAssetId: assetId, assetPrecision: decimals, assetCustodyClass: custodyClass,
    grossAmountSmallestUnits: rec.gross, actualFeeAmountSmallestUnits: rec.fee, principalAmountSmallestUnits: rec.principal,
    feeAssetId: assetId, devFundDestination: "dev", feeTransferEvidence: ethers.id("fee:" + lockId),
    valuationTimestamp: opts.valuationTimestamp !== undefined ? opts.valuationTimestamp : rec.createdAt,
    maturityTimestamp: rec.maturity, durationSecs: rec.duration,
    selectedOutputToken: rec.outputToken, baseRecipient: rec.baseRecipient, releaseDestination: "release",
    chonxActivationReceipt: "0x", racIdentity: opts.racIdentity || ethers.id("rac:" + env + lockId), priceRecord: "0x",
    sourceFinalityProof: coder.encode(["uint256", "bytes32", "uint256"], [chainId, ev.block.hash, ev.block.number]),
    lockEventProof: PROOF.encodeEvidence(ev),
  };
}

// Revert reason as text, for reports.
function reason(e) {
  const m = e && (e.reason || e.shortMessage || e.message) || String(e);
  return String(m).replace(/0x[0-9a-fA-F]{40}/g, (a) => short(a)).slice(0, 200);
}

const now = async () => BigInt((await ethers.provider.getBlock("latest")).timestamp);
const advance = async (secs) => { await network.provider.send("evm_increaseTime", [Number(secs)]); await network.provider.send("evm_mine"); };

module.exports = { BC, ethers, network, art, DATA, FLOW, PROOF, EVM_ENVS, SCALE, DAY7, YEAR10, coder, ETH_ID, ETH_PRICE,
  short, fmt, entry, deployStack, basePkg, evmPkg, reason, now, advance };
