// deployment/assetRegistry.revB.json (Revision B, operator directive t220u,
// 2026-10-19): the current registry. Strict subset of the prior revision
// (assetRegistry.resolved.json, 961 written rows + Base ETH) and of the interim
// 822 set (assetRegistry.active.json), rows copied unchanged, 475 tokens that
// pass the per-pool filter + 12 native coins. No chain needed.
const { expect } = require("chai");
const fs = require("fs");
const path = require("path");
const HIST = require("../deployment/assetRegistry.resolved.json").entries;
const ACTIVE = require("../deployment/assetRegistry.active.json");
const REVB = require("../deployment/assetRegistry.revB.json");
const { buildRevisionB } = require("../scripts/buildRevisionB.cjs");
const { buildTokenAddressIndex } = require("../scripts/buildTokenAddressIndex.cjs");
const { loadRegistry, loadHistoricalWritten, REGISTRY_FILE } = require("../scripts/registryFile.cjs");

const FIELDS = ["row", "assetId", "canonicalAssetId", "symbol", "decimals", "custodyClass", "custodyPath", "identifier", "pricingIdentifier", "decimalsFrom", "unresolvedReason", "sameKeyAsRow"];
const SYMBOL_FAILURES = [77, 259, 286, 323, 359, 366, 370, 406, 714, 996];
const DROPPED = [138, 999, 1000];
const MISLABELLED = [152, 991, 980, 345];
const NATIVES = { "Base|2": "ETH", "Ethereum|2": "ETH", "Bitcoin|3": "BTC", "Dogecoin|4": "DOGE", "XRP Ledger|12": "XRP", "BNB Smart Chain|18": "BNB",
  "Litecoin|19": "LTC", "Avalanche|23": "AVAX", "Bitcoin Cash|54": "BCH", "DigiByte|100": "DGB", "Zcash|166": "ZEC", "Stellar|518": "XLM" };
const BY_CHAIN = { Ethereum: 265, "BNB Smart Chain": 96, Avalanche: 29, Polygon: 28, Arbitrum: 22, Base: 27, Optimism: 12,
  Bitcoin: 1, Dogecoin: 1, "XRP Ledger": 1, Litecoin: 1, "Bitcoin Cash": 1, DigiByte: 1, Zcash: 1, Stellar: 1 };

function parseCsv(t) {
  const lines = t.trim().split(/\r?\n/), h = lines.shift().split(",");
  return lines.map((l) => { const v = l.split(","); return Object.fromEntries(h.map((k, i) => [k, v[i]])); });
}

describe("Revision B asset registry (487: 475 per-pool tokens + 12 natives)", function () {
  const E = REVB.entries;
  const key = (a) => a.environmentId + "|" + a.row;
  const histWritten = HIST.filter((e) => e.decimals != null && e.sameKeyAsRow == null);
  const histKeys = new Set(histWritten.map(key)); histKeys.add("Base|2");
  const activeKeys = new Set(ACTIVE.entries.map(key));
  const byRow = new Map(HIST.map((e) => [e.row, e]));
  const csv = parseCsv(fs.readFileSync(path.join(__dirname, "..", "deployment", "revB_per_pool_filter.csv"), "utf8"));

  it("is the file the live path reads", () => {
    expect(path.basename(REGISTRY_FILE)).to.equal("assetRegistry.revB.json");
    expect(REVB.revision).to.equal("B");
    expect(REVB.date).to.equal("2026-10-19");
    expect(loadRegistry().all.length).to.equal(487);
  });

  it("is reproducible: buildRevisionB() from the committed CSV gives the committed file", () => {
    expect(JSON.parse(JSON.stringify(buildRevisionB()))).to.deep.equal(REVB);
  });

  it("487 entries: 475 tokens + 12 natives; counts by chain", () => {
    expect(E.length).to.equal(487);
    expect(E.filter((a) => a.kind === "token").length).to.equal(475);
    expect(E.filter((a) => a.kind === "native").length).to.equal(12);
    expect(REVB.counts).to.deep.include({ total: 487, tokens: 475, native: 12, written: 486, baseEth: 1 });
    const c = {}; for (const a of E) c[a.environmentId] = (c[a.environmentId] || 0) + 1;
    expect(c).to.deep.equal(BY_CHAIN);
    expect(REVB.counts.byChain).to.deep.equal(BY_CHAIN);
  });

  it("strict subset of the prior revision and of the interim 822 set, rows copied unchanged, no duplicates", () => {
    const keys = E.map(key);
    expect(new Set(keys).size).to.equal(keys.length);
    expect(histKeys.size).to.equal(962);
    expect(histWritten.length).to.equal(961); // the prior revision is unchanged
    expect(ACTIVE.entries.length).to.equal(822); // the interim set is unchanged
    for (const a of E) {
      expect(histKeys.has(key(a)), key(a)).to.equal(true);
      expect(activeKeys.has(key(a)), key(a)).to.equal(true);
      const h = byRow.get(a.row);
      for (const f of FIELDS) expect(a[f], `row ${a.row} ${f}`).to.deep.equal(h[f]);
      if (!(a.environmentId === "Base" && a.row === 2)) expect(a.environmentId).to.equal(h.environmentId);
    }
  });

  it("all 12 natives present, each with a fresh CoinGecko price (<= 24h)", () => {
    const n = E.filter((a) => a.kind === "native");
    expect(Object.fromEntries(n.map((a) => [key(a), a.symbol]))).to.deep.equal(NATIVES);
    for (const a of n) {
      expect(a.revB.priceSource, key(a)).to.equal("CoinGecko");
      expect(a.revB.priceAgeHours, key(a)).to.be.at.most(24);
    }
  });

  it("every token entry passes the per-pool rule; every CSV survivor is in, every CSV failure is out", () => {
    const inB = new Set(E.map(key));
    let yes = 0;
    for (const r of csv) {
      const k = r.chain + "|" + r.row;
      if (r.survives === "yes") { yes++; expect(inB.has(k), k).to.equal(true); }
      else if (r.survives === "no") expect(inB.has(k), k).to.equal(false);
    }
    expect(yes).to.equal(475);
    for (const a of E.filter((x) => x.kind === "token")) {
      expect(a.revB.maxSinglePoolUsd, key(a)).to.be.at.least(10000);
      expect(a.revB.priceAgeHours, key(a)).to.be.at.most(24);
      expect(a.revB.poolAddress, key(a)).to.be.a("string").and.not.equal("");
    }
    // The five that failed the earlier price fetch are not in Revision B.
    for (const s of ["SWEAT", "PROM", "XOR", "SYRUP", "WLFI"]) expect(E.some((a) => a.symbol === s && a.environmentId === "Ethereum"), s).to.equal(false);
    // Only-cumulative tokens are out (a single pool must clear $10,000 on its own).
    for (const r of csv.filter((x) => x.fail_reason === "only_cumulative_ge_10k")) expect(inB.has(r.chain + "|" + r.row), r.symbol).to.equal(false);
  });

  it("no Solana, no excluded row, no duplicate-losing row", () => {
    expect(E.filter((a) => a.environmentId === "Solana").length).to.equal(0);
    const rows = new Set(E.map((a) => a.row));
    for (const r of [...SYMBOL_FAILURES, ...DROPPED, ...MISLABELLED]) expect(rows.has(r), "row " + r).to.equal(false);
    const hist = buildTokenAddressIndex(loadHistoricalWritten());
    const inB = new Set(E.map(key));
    for (const d of hist.duplicates) for (const r of d.rows) if (r.row !== d.chosenRow) expect(inB.has(d.environmentId + "|" + r.row), "loser row " + r.row).to.equal(false);
  });

  it("native links kept, each target row in Revision B: Polygon POL -> row 114, Arbitrum/Optimism ETH -> row 2", () => {
    const L = Object.fromEntries(REVB.nativeLinks.map((l) => [l.environmentId, l.usesRow]));
    expect(L).to.deep.equal({ Polygon: 114, Arbitrum: 2, Optimism: 2 });
    expect(REVB.droppedNativeLinks).to.deep.equal([]);
    for (const l of REVB.nativeLinks) expect(E.some((a) => a.row === l.usesRow && a.environmentId === l.rowEnvironmentId), l.environmentId).to.equal(true);
  });

  it("token address index (deployment/tokenAddressIndex.json) is built from Revision B: 475 addresses", () => {
    const idx = buildTokenAddressIndex();
    const file = require("../deployment/tokenAddressIndex.json");
    expect(idx.entries.length).to.equal(475);
    expect(file.count).to.equal(475);
    expect(file.entries).to.deep.equal(idx.entries);
    const tokenKeys = new Set(E.filter((a) => a.kind === "token").map(key));
    for (const t of idx.entries) expect(tokenKeys.has(t.environmentId + "|" + t.row), t.symbol).to.equal(true);
  });
});
