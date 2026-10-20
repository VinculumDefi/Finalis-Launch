// Builds deployment/assetRegistry.revB.json (Revision B, operator directive
// t220u, 2026-10-19) from:
//   - deployment/revB_per_pool_filter.csv: the per-pool filter run on the 822
//     entries of deployment/assetRegistry.active.json (data pulled 2026-10-19,
//     5:48 PM to 6:12 PM ET);
//   - deployment/assetRegistry.active.json (the interim 822 set): membership;
//   - deployment/assetRegistry.resolved.json (prior revision, 961 written
//     rows + Base ETH): the row fields, copied unchanged.
// Neither source file is modified.
//
// Rules:
//   Token entry (475): survives = "yes" in the CSV. One single DEX pool of the
//     row's own contract on its own chain holds at least $10,000 of liquidity
//     AND that pool traded in the last 24 hours; pools reporting more than 2x
//     the token's market cap are dropped; the price is fresh (updated in the
//     last 24 hours). Liquidity summed across pools does not count.
//   Native entry (12): a fresh CoinGecko price (updated in the last 24 hours).
//     No wrapped pool is required (operator decision t219u).
// No row is relabelled and no row is added. Fail closed: a CSV row that does
// not match its registry row stops the build.
//
// CLI: node scripts/buildRevisionB.cjs
const fs = require("fs");
const path = require("path");
const DEP = path.join(__dirname, "..", "deployment");
const CSV_FILE = path.join(DEP, "revB_per_pool_filter.csv");
const NATIVE_ROWS = [
  { row: 2, environmentId: "Ethereum" }, { row: 2, environmentId: "Base" }, { row: 3, environmentId: "Bitcoin" },
  { row: 4, environmentId: "Dogecoin" }, { row: 12, environmentId: "XRP Ledger" }, { row: 18, environmentId: "BNB Smart Chain" },
  { row: 19, environmentId: "Litecoin" }, { row: 23, environmentId: "Avalanche" }, { row: 54, environmentId: "Bitcoin Cash" },
  { row: 100, environmentId: "DigiByte" }, { row: 166, environmentId: "Zcash" }, { row: 518, environmentId: "Stellar" },
];
const MIN_POOL_USD = 10000;
const MAX_AGE_HOURS = 24;

function parseCsv(t) {
  const rows = []; let row = [], f = "", q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"' && t[i + 1] === '"') { f += '"'; i++; } else if (c === '"') q = false; else f += c; }
    else if (c === '"') q = true; else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\r") continue;
    else if (c === "\n") { row.push(f); rows.push(row); row = []; f = ""; } else f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  const h = rows.shift();
  const bad = rows.filter((r) => r.length !== h.length);
  if (bad.length) throw new Error("CSV rows with the wrong column count: " + bad.length);
  return rows.map((r) => Object.fromEntries(h.map((k, i) => [k, r[i]])));
}

function buildRevisionB() {
  const hist = JSON.parse(fs.readFileSync(path.join(DEP, "assetRegistry.resolved.json"), "utf8"));
  const active = JSON.parse(fs.readFileSync(path.join(DEP, "assetRegistry.active.json"), "utf8"));
  const csv = parseCsv(fs.readFileSync(CSV_FILE, "utf8"));
  const key = (row, env) => row + "|" + env;
  const histByRow = new Map(hist.entries.map((e) => [e.row, e]));
  const activeByKey = new Map(active.entries.map((e) => [key(e.row, e.environmentId), e]));
  if (csv.length !== active.entries.length) throw new Error("CSV has " + csv.length + " rows, active registry " + active.entries.length);

  const nativeKeys = new Set(NATIVE_ROWS.map((n) => key(n.row, n.environmentId)));
  const entries = [];
  const failed = [];
  for (const c of csv) {
    const row = Number(c.row), k = key(row, c.chain);
    const a = activeByKey.get(k), h = histByRow.get(row);
    if (!a || !h) throw new Error("CSV row not in the active registry: " + k);
    if (a.symbol !== c.symbol || h.symbol !== c.symbol) throw new Error("CSV symbol differs from registry row " + k);
    const isNative = nativeKeys.has(k);
    if (isNative !== (a.kind === "native")) throw new Error("native set differs from active registry at " + k);
    let filter;
    if (isNative) {
      const age = c.price_age_hours === "" ? null : Number(c.price_age_hours);
      if (c.fresh_price_source !== "CoinGecko" || age == null || !(age <= MAX_AGE_HOURS)) { failed.push({ row, environmentId: c.chain, symbol: c.symbol, reason: "native: no fresh CoinGecko price" }); continue; }
      filter = { rule: "native: fresh CoinGecko price", priceSource: "CoinGecko", priceAgeHours: age };
    } else {
      if (c.address.toLowerCase() !== String(h.identifier).toLowerCase()) throw new Error("CSV address differs from registry row " + k);
      if (c.survives !== "yes") { failed.push({ row, environmentId: c.chain, symbol: c.symbol, reason: c.fail_reason }); continue; }
      const pool = Number(c.max_single_pool_usd), age = Number(c.price_age_hours);
      if (!(pool >= MIN_POOL_USD) || !(age <= MAX_AGE_HOURS) || !c.pool_address) throw new Error("survivor does not satisfy the rule: " + k);
      filter = { rule: "token: one pool >= $10,000 that traded in the last 24h; fresh price", maxSinglePoolUsd: pool,
        poolSource: c.pool_source, poolAddress: c.pool_address, priceSource: c.fresh_price_source, priceAgeHours: age };
    }
    // Row fields copied unchanged from the prior revision; Base ETH is row 2
    // registered under Base (as in every earlier ceremony).
    entries.push({ ...h, environmentId: a.environmentId, kind: a.kind, onchain: a.onchain, revB: filter });
  }
  entries.sort((x, y) => x.row - y.row || x.environmentId.localeCompare(y.environmentId));

  // Native-coin links (ceremony aliases): kept only if the target row is in Revision B.
  const nativeLinks = [], droppedLinks = [];
  for (const l of active.nativeLinks) {
    (entries.some((e) => e.row === l.usesRow && e.environmentId === l.rowEnvironmentId) ? nativeLinks : droppedLinks).push(l);
  }

  const byChain = {};
  for (const e of entries) byChain[e.environmentId] = (byChain[e.environmentId] || 0) + 1;
  const count = (f) => entries.filter(f).length;
  const counts = { total: entries.length, tokens: count((e) => e.kind === "token"), native: count((e) => e.kind === "native"),
    written: entries.length - 1, baseEth: 1, failedFilter: failed.length, byChain };
  return {
    _note: "REVISION B of the asset registry (operator directive t220u, 2026-10-19). This is the current registry for the ceremony, verifier registration, token address index, price runs and deploy pages. Rows copied unchanged from deployment/assetRegistry.resolved.json (prior revision). See deployment/ASSET_REGISTRY_REVISION_B.md and deployment/ASSET_REGISTRY_REVISIONS.md.",
    revision: "B",
    date: "2026-10-19",
    rules: {
      token: "survives only if at least one single DEX pool of the row's own contract on its own chain has >= $10,000 liquidity AND that pool traded in the last 24 hours; pools reporting more than 2x market cap dropped; price fresh (updated in the last 24 hours) from CoinGecko, DexScreener or GeckoTerminal; liquidity summed across pools does not count; no substitute price; fail closed",
      native: "survives on a fresh CoinGecko price (updated in the last 24 hours); no wrapped pool required (operator decision t219u)",
    },
    filterDataPulledAt: "2026-10-19 5:48 PM to 6:12 PM ET (2026-10-19T21:48Z to 22:12Z)",
    sources: { filter: "deployment/revB_per_pool_filter.csv", membership: "deployment/assetRegistry.active.json (822, interim, superseded)",
      rowFields: "deployment/assetRegistry.resolved.json (961 written rows + Base ETH, prior revision, unchanged)" },
    registry: hist.registry,
    counts,
    nativeLinks,
    droppedNativeLinks: droppedLinks,
    failedFilter: failed,
    entries,
  };
}
module.exports = { buildRevisionB, NATIVE_ROWS, CSV_FILE };

if (require.main === module) {
  const r = buildRevisionB();
  fs.writeFileSync(path.join(DEP, "assetRegistry.revB.json"), JSON.stringify(r, null, 1) + "\n");
  console.log(JSON.stringify(r.counts), "nativeLinks", r.nativeLinks.length, "dropped", r.droppedNativeLinks.length);
}
