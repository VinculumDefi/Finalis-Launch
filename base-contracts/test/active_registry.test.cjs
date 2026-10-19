// deployment/assetRegistry.active.json: strict subset of the historical
// registry, no excluded row, counts as built (t209u item 5). No chain needed.
const { expect } = require("chai");
const HIST = require("../deployment/assetRegistry.resolved.json").entries;
const ACTIVE = require("../deployment/assetRegistry.active.json");
const { buildTokenAddressIndex } = require("../scripts/buildTokenAddressIndex.cjs");

const FIELDS = ["row", "assetId", "canonicalAssetId", "symbol", "decimals", "custodyClass", "custodyPath", "identifier", "pricingIdentifier"];
const SYMBOL_FAILURES = [77, 259, 286, 323, 359, 366, 370, 406, 714, 996];
const DROPPED = [138, 999, 1000];
const MISLABELLED = [152, 991, 980, 345];

describe("Active asset registry (subset of the 961 + Base ETH)", function () {
  const written = HIST.filter((e) => e.decimals != null && e.sameKeyAsRow == null);
  const histKeys = new Set(written.map((e) => e.environmentId + "|" + e.row));
  histKeys.add("Base|2"); // Base ETH
  const byRow = new Map(HIST.map((e) => [e.row, e]));
  const E = ACTIVE.entries;

  it("every entry is a historical row, copied unchanged (no relabelling)", () => {
    for (const a of E) {
      expect(histKeys.has(a.environmentId + "|" + a.row), `${a.environmentId} row ${a.row}`).to.equal(true);
      const h = byRow.get(a.row);
      for (const f of FIELDS) expect(a[f], `row ${a.row} ${f}`).to.deep.equal(h[f]);
      if (!(a.environmentId === "Base" && a.row === 2)) expect(a.environmentId).to.equal(h.environmentId);
    }
  });

  it("is a strict subset with no duplicate entries", () => {
    const keys = E.map((a) => a.environmentId + "|" + a.row);
    expect(new Set(keys).size).to.equal(keys.length);
    expect(keys.length).to.be.lt(histKeys.size);
    expect(histKeys.size).to.equal(962);
  });

  it("contains no excluded row", () => {
    const rows = new Set(E.map((a) => a.row));
    for (const r of [...SYMBOL_FAILURES, ...DROPPED, ...MISLABELLED]) expect(rows.has(r), "row " + r).to.equal(false);
    expect(E.filter((a) => a.environmentId === "Solana").length).to.equal(0);
    // Duplicate-losing rows: on a duplicated address only the index's chosen row may appear.
    const { duplicates } = buildTokenAddressIndex();
    for (const d of duplicates) for (const r of d.rows) if (r.row !== d.chosenRow) expect(rows.has(r.row), "loser row " + r.row).to.equal(false);
    // Every token entry is an address-index entry.
    const idx = new Set(buildTokenAddressIndex().entries.map((x) => x.environmentId + "|" + x.row));
    for (const a of E.filter((x) => x.kind === "token")) expect(idx.has(a.environmentId + "|" + a.row), "row " + a.row).to.equal(true);
  });

  it("counts match: 755 verified, 40 renamed, 15 bridged, 12 natives = 822", () => {
    const c = (f) => E.filter(f).length;
    expect(c((a) => a.onchain.status === "verified")).to.equal(755);
    expect(c((a) => a.onchain.status === "renamed")).to.equal(40);
    expect(c((a) => a.onchain.status === "bridged")).to.equal(15);
    expect(c((a) => a.kind === "native")).to.equal(12);
    expect(E.length).to.equal(822);
    expect(ACTIVE.counts).to.deep.include({ total: 822, verified: 755, renamed: 40, bridged: 15, native: 12 });
    for (const a of E.filter((x) => ["renamed", "bridged"].includes(x.onchain.status))) expect(a.onchain.onchainSymbol, "row " + a.row).to.be.a("string").and.not.equal("");
    expect(ACTIVE.excluded.symbolFailures.map((x) => x.row)).to.deep.equal(SYMBOL_FAILURES);
  });

  it("carries a price status on every entry, priced or a confirmed fail with its reason", () => {
    for (const a of E) {
      expect(["priced", "fail"], "row " + a.row).to.include(a.price.status);
      if (a.price.status === "priced") expect(a.price.source).to.be.oneOf(["CoinGecko", "DexScreener", "GeckoTerminal"]);
      else expect(a.price.reason).to.be.oneOf(["below_min_liquidity", "no_dex_price", "no_contract_address", "fetch_error"]);
    }
    expect(E.filter((a) => a.price.status === "priced").length + E.filter((a) => a.price.status === "fail").length).to.equal(822);
  });

  it("native links: Polygon POL -> row 114, Arbitrum/Optimism ETH -> row 2, each linked row included", () => {
    const L = Object.fromEntries(ACTIVE.nativeLinks.map((l) => [l.environmentId, l.usesRow]));
    expect(L).to.deep.equal({ Polygon: 114, Arbitrum: 2, Optimism: 2 });
    for (const l of ACTIVE.nativeLinks) expect(E.some((a) => a.row === l.usesRow && a.environmentId === l.rowEnvironmentId), l.environmentId).to.equal(true);
    expect(E.some((a) => a.environmentId === "Base" && a.row === 2 && a.kind === "native"), "Base ETH").to.equal(true);
  });

  it("the historical file is unchanged: 961 written rows", () => {
    expect(written.length).to.equal(961);
  });
});
