// Price fetch rig (test branch test/solana-sampling-2026-10-23, t310u).
// READ-ONLY. Runs the repo's existing price fetcher,
// base-contracts/scripts/fetchPrices.cjs (the Revision B rule: one own-chain
// pool >= $10,000 that traded in the last 24h, then a fresh CoinGecko price or
// that pool's own quote; natives need a CoinGecko price under 24h old), on:
//   revB      : base-contracts/deployment/assetRegistry.revB.json (487 rows,
//               via scripts/registryFile.cjs loadRegistry, the live path's file)
//   candidate : assetRegistry.candidate-2026-10-23.json from branch
//               test/registry-candidate-2026-10-23, read with `git show`
//               (not merged; written to a temp file only for loading).
// The union of both lists is fetched once (same moment for both), then each
// list gets its own results file. Nothing is signed, sent or posted.
//
// Extra rule applied here as data (VinculumFinalisVerifier USD_STABLE_MIN_PRICE,
// _isUsdStable): a USDC/USDT row (symbol USDC, USDT, USDC_<chain>,
// USDT_<chain>, USDTE) whose fetched price is below $0.95 is reported as
// unavailable, reason "usd_stable_below_0.95". No price is invented, no $1
// substitute, no hardcoded price anywhere.
//
// Output per row: status "priced" with usd, source, priceTimestamp, or status
// "fail" with reason and detail. Addresses are shortened (0x1234...abcd).
//
// CLI: node testing-rigs/price-fetch/run.cjs [--outdir testing-rigs/price-fetch]
//      [--candidate-ref origin/test/registry-candidate-2026-10-23]
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..", "..");
const BC = path.join(ROOT, "base-contracts");
const { fetchPrices, summarize } = require(path.join(BC, "scripts", "fetchPrices.cjs"));
const { loadRegistry, REGISTRY_FILE } = require(path.join(BC, "scripts", "registryFile.cjs"));

const CAND_PATH = "base-contracts/deployment/assetRegistry.candidate-2026-10-23.json";
const STABLE_MIN = "0.95";

const arg = (k, d) => { const a = process.argv.slice(2); const i = a.indexOf(k); return i >= 0 ? a[i + 1] : d; };
const OUT = path.resolve(arg("--outdir", __dirname));
const CAND_REF = arg("--candidate-ref", "origin/test/registry-candidate-2026-10-23");

const sha256 = (buf) => crypto.createHash("sha256").update(buf).digest("hex");
const git = (...a) => execFileSync("git", a, { cwd: ROOT, maxBuffer: 1 << 28 }).toString();

// Same test as the Verifier's _isUsdStable.
function isUsdStable(sym) {
  const b = String(sym || "");
  if (b.length < 4 || b.slice(0, 3) !== "USD") return false;
  if (b[3] !== "C" && b[3] !== "T") return false;
  if (b.length === 4) return true;
  if (b[4] === "_") return b.length > 5;
  return b.length === 5 && b[3] === "T" && b[4] === "E";
}
// Exact decimal compare, no floating point: a < b ?
function decLess(a, b) {
  const p = (s) => { const [i, f = ""] = String(s).split("."); return [BigInt(i), f]; };
  const [ai, af] = p(a), [bi, bf] = p(b);
  if (ai !== bi) return ai < bi;
  const n = Math.max(af.length, bf.length);
  return BigInt(af.padEnd(n, "0") || "0") < BigInt(bf.padEnd(n, "0") || "0");
}
const short = (s) => { const x = String(s || ""); return /^0x[0-9a-fA-F]{40}/.test(x) || x.length > 24 ? x.slice(0, 6) + "..." + x.slice(-4) : x; };
const shortPool = (p) => (p ? { ...p, address: p.address ? p.address.split("-").map(short).join("-") : p.address } : p);
const key = (r) => r.environmentId + "|" + String(r.canonicalAssetId).toLowerCase();

async function main() {
  const startedAt = new Date().toISOString();
  // Inputs
  const revBBuf = fs.readFileSync(REGISTRY_FILE);
  const revB = loadRegistry().all;
  const candCommit = git("rev-parse", CAND_REF).trim();
  const candBuf = execFileSync("git", ["show", CAND_REF + ":" + CAND_PATH], { cwd: ROOT, maxBuffer: 1 << 28 });
  const tmp = path.join(os.tmpdir(), "price-fetch-candidate-" + process.pid + ".json");
  fs.writeFileSync(tmp, candBuf);
  const cand = loadRegistry(tmp).all;
  fs.unlinkSync(tmp);
  if (revB.length !== 487) throw new Error("Revision B should have 487 rows, got " + revB.length);

  // Union, fetched once.
  const union = new Map();
  for (const r of [...revB, ...cand]) if (!union.has(key(r))) union.set(key(r), r);
  const rows = [...union.values()];
  console.error(startedAt + " fetching " + rows.length + " distinct rows (revB " + revB.length + ", candidate " + cand.length + ")");
  const res = await fetchPrices({ rows, log: (m) => console.error(new Date().toISOString() + " " + m) });
  const fetchedAt = new Date().toISOString();
  const byKey = new Map(rows.map((r, i) => [key(r), res[i]]));

  const lineFor = (list, r) => {
    const f = byKey.get(key(r));
    const o = { list, row: r.row, environmentId: r.environmentId, symbol: r.symbol, kind: f.kind || r.kind,
      identifier: short(r.identifier), canonicalAssetId: short(r.canonicalAssetId), pricingIdentifier: r.pricingIdentifier || null, fetchedAt };
    if (f.usd != null) {
      const ts = f.source === "CoinGecko" && f.cgLastUpdatedAt ? new Date(f.cgLastUpdatedAt * 1000).toISOString() : fetchedAt;
      if (isUsdStable(r.symbol) && decLess(f.usd, STABLE_MIN)) {
        Object.assign(o, { status: "fail", usd: null, fetchedUsd: f.usd, source: f.source, priceTimestamp: ts,
          reason: "usd_stable_below_0.95", detail: "USDC/USDT row fetched below $0.95: unavailable (Verifier VF-ORC-005)" });
      } else {
        Object.assign(o, { status: "priced", usd: f.usd, source: f.source, priceTimestamp: ts,
          priceTimestampFrom: f.source === "CoinGecko" ? "coingecko last_updated_at" : "pool quote read at fetch time", reason: null, usdStableRow: isUsdStable(r.symbol) });
      }
    } else {
      Object.assign(o, { status: "fail", usd: null, source: null, reason: f.reason, detail: f.detail || null,
        cgLastUpdatedAt: f.cgLastUpdatedAt ? new Date(f.cgLastUpdatedAt * 1000).toISOString() : null });
    }
    if (f.qualifyingPool) o.qualifyingPool = shortPool(f.qualifyingPool);
    if (f.bestTradedPool !== undefined) o.bestTradedPool = shortPool(f.bestTradedPool);
    if (f.marketCapUsd !== undefined) o.marketCapUsd = f.marketCapUsd;
    if (f.sumTradedPoolsUsd !== undefined) o.sumTradedPoolsUsd = f.sumTradedPoolsUsd;
    return o;
  };
  const sum = (lines) => {
    const s = { total: lines.length, priced: 0, failed: 0, pricedBySource: {}, failByReason: {}, usdStableRows: 0, usdStableBelow095: [] };
    for (const l of lines) {
      if (isUsdStable(l.symbol)) s.usdStableRows++;
      if (l.status === "priced") { s.priced++; s.pricedBySource[l.source] = (s.pricedBySource[l.source] || 0) + 1; }
      else { s.failed++; s.failByReason[l.reason] = (s.failByReason[l.reason] || 0) + 1; }
      if (l.reason === "usd_stable_below_0.95") s.usdStableBelow095.push({ row: l.row, environmentId: l.environmentId, symbol: l.symbol, fetchedUsd: l.fetchedUsd });
    }
    s.failByReason = Object.fromEntries(Object.entries(s.failByReason).sort((a, b) => b[1] - a[1]));
    return s;
  };
  const out = {};
  for (const [list, rs] of [["revB", revB], ["candidate", cand]]) {
    const lines = rs.map((r) => lineFor(list, r));
    fs.writeFileSync(path.join(OUT, "results-" + list + ".jsonl"), lines.map((l) => JSON.stringify(l)).join("\n") + "\n");
    out[list] = sum(lines);
  }
  const summary = {
    rig: "price-fetch", branch: "test/solana-sampling-2026-10-23", readOnly: true, startedAt, fetchedAt,
    fetcher: "base-contracts/scripts/fetchPrices.cjs (Revision B rule), wrapped by testing-rigs/price-fetch/run.cjs",
    usdStableRule: "USDC/USDT rows below $0.95 are reported unavailable (reason usd_stable_below_0.95); no $1 substitute",
    inputs: {
      revB: { file: "base-contracts/deployment/assetRegistry.revB.json", sha256: sha256(revBBuf), rows: revB.length, headCommit: git("rev-parse", "HEAD").trim() },
      candidate: { file: CAND_PATH, ref: CAND_REF, commit: candCommit, sha256: sha256(candBuf), rows: cand.length, merged: false },
      distinctRowsFetched: rows.length,
    },
    fetcherRawSummary: summarize(res),
    revB: out.revB, candidate: out.candidate,
  };
  fs.writeFileSync(path.join(OUT, "summary.json"), JSON.stringify(summary, null, 1) + "\n");
  console.error(JSON.stringify({ revB: { priced: out.revB.priced, failed: out.revB.failed }, candidate: { priced: out.candidate.priced, failed: out.candidate.failed } }));
}

main().catch((e) => { console.error(e); process.exit(1); });
