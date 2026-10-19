// Builds deployment/assetRegistry.active.json (t209u item 5) from the
// historical registry (deployment/assetRegistry.resolved.json: 961 written
// rows + Base ETH), which is NOT modified. Rows are copied unchanged (no
// relabelling); only status fields are added.
//
// Included:
//  - EVM token rows of the address index whose on-chain check (2026-10-19)
//    verified: contract code, symbol() = label (exact / case / chain suffix),
//    decimals() = row decimals;
//  - EVM token rows whose symbol() differs but is the same token: marked
//    "renamed" (new ticker) or "bridged" (bridged, wrapped or legacy contract
//    of the labelled asset), with the on-chain symbol;
//  - native coins already tested end to end: ETH (row 2, as Ethereum and as
//    Base ETH), BNB (18), AVAX (23) in the sampled CVL/TRS tests; BTC, DOGE,
//    LTC, BCH, DGB, ZEC (UTXO readers), XLM (Stellar), XRP (XRP Ledger);
//  - nativeLinks: Polygon native POL -> row 114 (POL), Arbitrum and Optimism
//    native ETH -> row 2 (ETH), the ceremony aliases; no new entries.
// Excluded: the 10 symbol failures (8 different-project + 2 uncertain), the
// dropped TigerOG/LionOG/FrogOG, the 4 mislabelled rows and the other
// duplicate-losing rows, every Solana row (no reader), and anything else not
// in the lists above. Price status is carried, never used to exclude.
//
// CLI: node scripts/buildActiveRegistry.cjs <onchain_verify.csv> <prices.json>
const fs = require("fs");
const path = require("path");
const DEP = path.join(__dirname, "..", "deployment");

const NATIVE_ROWS = [
  { row: 2, environmentId: "Ethereum" }, { row: 2, environmentId: "Base" }, { row: 18, environmentId: "BNB Smart Chain" },
  { row: 23, environmentId: "Avalanche" }, { row: 3, environmentId: "Bitcoin" }, { row: 4, environmentId: "Dogecoin" },
  { row: 19, environmentId: "Litecoin" }, { row: 54, environmentId: "Bitcoin Cash" }, { row: 100, environmentId: "DigiByte" },
  { row: 166, environmentId: "Zcash" }, { row: 518, environmentId: "Stellar" }, { row: 12, environmentId: "XRP Ledger" },
];
const DROPPED = [138, 999, 1000];      // TigerOG, LionOG, FrogOG (operator, 2026-10-19)
const MISLABELLED = [152, 991, 980, 345]; // ACM, DASH, ALGO, ASR

function parseCsv(t) {
  const rows = []; let row = [], f = "", q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"' && t[i + 1] === '"') { f += '"'; i++; } else if (c === '"') q = false; else f += c; }
    else if (c === '"') q = true; else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n") { row.push(f); rows.push(row); row = []; f = ""; } else f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  const h = rows.shift();
  return rows.filter((r) => r.length === h.length).map((r) => Object.fromEntries(h.map((k, i) => [k, r[i]])));
}

function buildActiveRegistry(onchainCsvPath, pricesPath) {
  const hist = JSON.parse(fs.readFileSync(path.join(DEP, "assetRegistry.resolved.json"), "utf8"));
  const byRow = new Map(hist.entries.map((e) => [e.row, e]));
  const onchain = parseCsv(fs.readFileSync(onchainCsvPath, "utf8"));
  const prices = JSON.parse(fs.readFileSync(pricesPath, "utf8"));
  const priceOf = new Map(prices.map((p) => [p.environmentId + "|" + p.canonicalAssetId.toLowerCase(), p]));
  const fetchedAt = (pricesPath.match(/(\d{8}-\d{4})/) || [])[1] || null;
  const priceStatus = (env, id) => {
    const p = priceOf.get(env + "|" + id.toLowerCase());
    if (!p) return { status: "not_fetched" };
    return p.usd != null ? { status: "priced", source: p.source, fetchedAt } : { status: "fail", reason: p.reason, fetchedAt };
  };
  const copy = (h, env) => ({ row: h.row, environmentId: env, assetId: h.assetId, canonicalAssetId: h.canonicalAssetId, symbol: h.symbol,
    decimals: h.decimals, custodyClass: h.custodyClass, custodyPath: h.custodyPath, identifier: h.identifier, pricingIdentifier: h.pricingIdentifier });
  const entries = [];
  for (const n of NATIVE_ROWS) {
    const h = byRow.get(n.row);
    if (n.environmentId !== "Base" && h.environmentId !== n.environmentId) throw new Error("native row env mismatch " + n.row);
    entries.push({ ...copy(h, n.environmentId), kind: "native", onchain: { status: "native" }, price: priceStatus(n.environmentId, h.canonicalAssetId) });
  }
  const excludedFail = [];
  for (const o of onchain) {
    const row = Number(o.row), h = byRow.get(row);
    if (!h || h.environmentId !== o.environment || h.symbol !== o.label) throw new Error("on-chain row does not match registry: " + row);
    if (o.status === "fail") { excludedFail.push({ row, reason: o.reason, note: o.note }); continue; }
    const status = o.status === "verify" ? "verified" : o.reason === "representation" ? "bridged" : "renamed";
    const oc = { status };
    if (status !== "verified") { oc.onchainSymbol = o.onchain_symbol; oc.note = o.note; }
    entries.push({ ...copy(h, h.environmentId), kind: "token", onchain: oc, price: priceStatus(h.environmentId, h.canonicalAssetId) });
  }
  entries.sort((a, b) => a.row - b.row || a.environmentId.localeCompare(b.environmentId));
  // Native-coin links (ceremony aliases, scripts/testChainCeremony.cjs): a chain
  // with no row of its own uses an existing row. Recorded here, not new entries.
  const { ASSET_ROW_ALIASES } = require("./testChainCeremony.cjs");
  const nativeLinks = ASSET_ROW_ALIASES.map((a) => {
    const h = hist.entries.find((e) => e.environmentId === a.rowEnvironmentId && e.canonicalAssetId.toLowerCase() === a.canonicalAssetId.toLowerCase());
    if (!h) throw new Error("alias row missing for " + a.environmentId);
    return { environmentId: a.environmentId, nativeCoin: true, usesRow: h.row, rowEnvironmentId: h.environmentId, symbol: h.symbol, canonicalAssetId: h.canonicalAssetId };
  });
  for (const l of nativeLinks) if (!entries.some((e) => e.row === l.usesRow && e.environmentId === l.rowEnvironmentId)) throw new Error("linked row not included: " + l.usesRow);
  const count = (f) => entries.filter(f).length;
  return {
    _note: "Active registry (t209u item 5). Subset of deployment/assetRegistry.resolved.json (961 written rows + Base ETH), rows copied unchanged. Not yet used by the verifier or the ceremony. See deployment/ASSET_REGISTRY_ACTIVE.md.",
    source: "deployment/assetRegistry.resolved.json", onchainCheckedAt: "2026-10-19", priceFetchedAt: fetchedAt,
    counts: { total: entries.length, verified: count((e) => e.onchain.status === "verified"), renamed: count((e) => e.onchain.status === "renamed"),
      bridged: count((e) => e.onchain.status === "bridged"), native: count((e) => e.kind === "native"),
      priced: count((e) => e.price.status === "priced"), priceFail: count((e) => e.price.status === "fail") },
    excluded: { symbolFailures: excludedFail.sort((a, b) => a.row - b.row), dropped: DROPPED, mislabelled: MISLABELLED,
      rule: "also excluded: every other duplicate-losing row, every Solana row (no reader), and every row not listed in included" },
    nativeLinks,
    entries,
  };
}
module.exports = { buildActiveRegistry, NATIVE_ROWS, DROPPED, MISLABELLED };

if (require.main === module) {
  const [csv, prices] = process.argv.slice(2);
  if (!csv || !prices) { console.error("usage: node scripts/buildActiveRegistry.cjs <onchain_verify.csv> <prices.json>"); process.exit(1); }
  const r = buildActiveRegistry(csv, prices);
  fs.writeFileSync(path.join(DEP, "assetRegistry.active.json"), JSON.stringify(r, null, 1) + "\n");
  console.log(JSON.stringify(r.counts));
}
