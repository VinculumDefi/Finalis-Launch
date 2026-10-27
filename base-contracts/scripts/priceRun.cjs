// Price run for the live price poster (deployment/liveConfig.json, 0x6001…0DB4).
// Turns fetched prices into the poster's lines for
// VinculumFinalisVerifier.applyScheduledPriceRun(runId, updates):
//   - a fetched positive price  -> success line  { success: true,  priceUsd30 }
//   - a miss / zero / bad price -> failure line  { success: false, priceUsd30: 0 }
//   - a price that rounds to 0 at 30 decimals, or is above the uint128 storage
//     bound (about 340,282,366 USD per whole token) -> failure line (fail closed)
// Prices are USD per whole token with 30 decimals (VF-ORC-016), truncated
// (floor), never rounded up.
//     (keeps that asset unusable until a later successful run)
// Run numbers start at 2 (run 1 is the ceremony's first Base ETH price) and must
// exceed the Verifier's lastScheduledRunId.
//
// This script NEVER sends to a live chain. Live use: it writes the run and the
// exact calldata for the poster to sign elsewhere. Only on the in-process
// Hardhat chain (31337) can postOnTestChain() send it, impersonating the poster
// address (no key).
//
// CLI: node scripts/priceRun.cjs <fetched.json> --run <N> [--out run.json]
//   fetched.json: [{ "environmentId", "canonicalAssetId", "usd": "1234.56" | null }]
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");
const { loadRegistry, CEREMONY_REGISTRY_FILE } = require("./registryFile.cjs");

const LIVE = require("../deployment/liveConfig.json");
const MIN_RUN_ID = 2n;
const ABI = ["function applyScheduledPriceRun(uint64 runId, (string environmentId, bytes32 canonicalAssetId, uint256 priceUsd30, bool success)[] updates)"];

// Exact decimal string (plain or scientific notation) -> 30-decimal integer,
// truncated toward zero. No floating point arithmetic on the value.
const PRICE_DECIMALS = 30;
const MAX_PRICE_USD30 = 2n ** 128n - 1n;
function toUsd30(usd) {
  if (usd === null || usd === undefined) return 0n;
  const s = typeof usd === "number" ? (Number.isFinite(usd) ? usd.toString() : "") : String(usd).trim();
  const m = s.match(/^\+?(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/);
  if (!m || (m[1] === "" && (m[2] === undefined || m[2] === ""))) return 0n;
  const intPart = m[1] || "0";
  const fracPart = m[2] || "";
  const exp = m[3] ? parseInt(m[3], 10) : 0;
  if (!Number.isSafeInteger(exp) || Math.abs(exp) > 1000) return 0n;
  // value = digits * 10^(exp - fracPart.length); scaled = value * 10^30
  const digits = BigInt(intPart + fracPart);
  const shift = exp - fracPart.length + PRICE_DECIMALS;
  return shift >= 0 ? digits * 10n ** BigInt(shift) : digits / 10n ** BigInt(-shift);
}

// Every line the Verifier has registered, as "environment|canonicalAssetId".
// Base-only launch: the ceremony registers only the Base rows of the ceremony
// registry, Revision E (2892 tokens plus Base ETH = 2893), and the Verifier
// refuses a price line for an unregistered row (VF-REG-001), so by default
// only Base rows are kept. { baseOnly: false } gives all 3353 Revision E rows.
function registryKeys(regFile = CEREMONY_REGISTRY_FILE, { baseOnly = true } = {}) {
  return new Set(loadRegistry(regFile).all.filter((e) => !baseOnly || e.environmentId === "Base")
    .map((e) => e.environmentId + "|" + e.canonicalAssetId.toLowerCase()));
}

function buildPriceRun(fetched, runId, { registry = registryKeys() } = {}) {
  const id = BigInt(runId);
  if (id < MIN_RUN_ID) throw new Error("run number must be 2 or higher (run 1 is the ceremony's)");
  if (id >= 2n ** 64n) throw new Error("run number exceeds uint64");
  const seen = new Set();
  const updates = [];
  const skipped = [];
  for (const f of fetched) {
    const k = f.environmentId + "|" + String(f.canonicalAssetId).toLowerCase();
    if (!registry.has(k)) { skipped.push({ ...f, why: "not in registry" }); continue; }
    if (seen.has(k)) throw new Error("duplicate asset in run: " + f.environmentId);
    seen.add(k);
    const p = toUsd30(f.usd);
    updates.push(p > 0n && p <= MAX_PRICE_USD30
      ? { environmentId: f.environmentId, canonicalAssetId: f.canonicalAssetId, priceUsd30: p, success: true }
      : { environmentId: f.environmentId, canonicalAssetId: f.canonicalAssetId, priceUsd30: 0n, success: false });
  }
  if (updates.length === 0) throw new Error("no registry assets in the fetched prices");
  return { runId: id, poster: LIVE.scheduledPricePoster, updates, skipped };
}

// A full registry run does not fit one transaction. Since the 2026-10-23 fix
// (AG-06: every line is also appended to the per-asset price history used for
// the price in effect at lock creation) a line costs about 102,000 gas (measured
// on the test chain), so 487 lines (Revision B) are about 50M gas, far above the
// 2^24 (16,777,216) per-transaction gas cap. Split the lines into consecutive
// runs of at most MAX_LINES_PER_RUN (140 lines, about 14.3M gas),
// numbered firstRunId, firstRunId + 1, ... Each run is posted on its own.
const MAX_LINES_PER_RUN = 140;
function buildPriceRuns(fetched, firstRunId, { registry = registryKeys(), maxLines = MAX_LINES_PER_RUN } = {}) {
  const all = buildPriceRun(fetched, firstRunId, { registry }); // validates and de-duplicates the whole set
  const runs = [];
  for (let i = 0; i < all.updates.length; i += maxLines) {
    const id = all.runId + BigInt(runs.length);
    if (id >= 2n ** 64n) throw new Error("run number exceeds uint64");
    runs.push({ runId: id, poster: all.poster, updates: all.updates.slice(i, i + maxLines), skipped: runs.length ? [] : all.skipped });
  }
  return runs;
}

function calldata(run) {
  return new ethers.Interface(ABI).encodeFunctionData("applyScheduledPriceRun", [run.runId, run.updates]);
}

// Next run number from the Verifier: max(2, lastScheduledRunId + 1).
async function nextRunId(verifier) {
  const last = BigInt(await verifier.lastScheduledRunId());
  return last + 1n > MIN_RUN_ID ? last + 1n : MIN_RUN_ID;
}

// TEST CHAIN ONLY. Sends the run as the live poster address via Hardhat
// impersonation (no key). Refuses any other network.
async function postOnTestChain(hre, verifier, run) {
  const { ethers: e, network } = hre;
  if ((await e.provider.getNetwork()).chainId !== 31337n || network.name !== "hardhat") throw new Error("REFUSED: priceRun posts only on the in-process Hardhat chain");
  if (e.getAddress(await verifier.scheduledPricePoster()) !== e.getAddress(run.poster)) throw new Error("verifier poster is not the live poster");
  await network.provider.send("hardhat_impersonateAccount", [run.poster]);
  await network.provider.send("hardhat_setBalance", [run.poster, "0xde0b6b3a7640000"]);
  try {
    const s = await e.getSigner(run.poster);
    return await (await verifier.connect(s).applyScheduledPriceRun(run.runId, run.updates)).wait();
  } finally {
    await network.provider.send("hardhat_stopImpersonatingAccount", [run.poster]);
  }
}

module.exports = { registryKeys, buildPriceRun, buildPriceRuns, toUsd30, PRICE_DECIMALS, MAX_PRICE_USD30, calldata, nextRunId, postOnTestChain, MIN_RUN_ID, MAX_LINES_PER_RUN };

if (require.main === module) {
  const a = process.argv.slice(2);
  const file = a[0], run = a[a.indexOf("--run") + 1], out = a.includes("--out") ? a[a.indexOf("--out") + 1] : null;
  if (!file || !a.includes("--run")) { console.error("usage: node scripts/priceRun.cjs <fetched.json> --run <N> [--out run.json]"); process.exit(1); }
  const runs = buildPriceRuns(JSON.parse(fs.readFileSync(file, "utf8")), run);
  const json = JSON.stringify(runs.map((r) => ({ runId: r.runId.toString(), poster: r.poster,
    updates: r.updates.map((u) => ({ ...u, priceUsd30: u.priceUsd30.toString() })), skipped: r.skipped, calldata: calldata(r) })), null, 2);
  if (out) fs.writeFileSync(out, json + "\n"); else console.log(json);
  for (const r of runs) console.error("Run " + r.runId + ": " + r.updates.filter((u) => u.success).length + " success, " + r.updates.filter((u) => !u.success).length + " failure lines.");
  console.error(runs.length + " run(s), NOT sent. Poster " + runs[0].poster.slice(0, 6) + "…" + runs[0].poster.slice(-4) + " signs each, in order.");
}
