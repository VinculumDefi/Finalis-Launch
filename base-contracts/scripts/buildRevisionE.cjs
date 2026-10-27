// Builds deployment/assetRegistry.revE.json (Revision E, Base-only launch
// candidate, operator order t448u, 2026-10-26).
//
// Revision E = Revision D with its Base subset extended to every technically
// compatible Base token of the recommendation list
// (deployment/baseRegistryRecommendation_2026-10-26.csv: Section A, the 130
// Revision D Base rows, plus Section B, 2,815 newly discovered Base tokens).
// Rows of other environments are carried over unchanged as history; the
// Base-only ceremony registers only the Base subset. Revisions D, C and B stay
// pinned and unchanged.
//
// Inputs (all in deployment/, no network access here):
//   assetRegistry.revD.json                       previous revision
//   baseRegistryRecommendation_2026-10-26.csv     Section A + Section B (+ Section X exclusions, skipped)
//   revE_onchain_2026-10-26.json                  code/name/symbol/decimals/balanceOf/paused at one Base block
//   revE_compatibility_2026-10-26.json            per-token verdict (on-chain checks + local fork lock/release simulation)
//
// Rules (t448u):
//   * Membership: every Section A and Section B token whose verdict is
//     compatible (simulated lock and release passed) or compatible_static_only
//     (on-chain checks passed; the fork simulation could not fund a test
//     account, so the lock was not simulated). A token with verdict
//     not_compatible is left out and listed under notTechnicallyCompatible
//     with its reason. Founder override (TigerOG) is always kept.
//   * Exclusions kept: BAR, ACM, ASR, XCN, FrogOG, LionOG and the old TEL
//     contract 0x09be...adb1. The build stops if any of them is in the subset.
//   * Classes: row 454 USDC is S1, native ETH row 2 is S2, every other row is
//     S3 (including USDT row 1086 and every Section B stablecoin or wrapped
//     token). No name-based multiplier.
//   * No liquidity, volume, market-cap or freshness threshold.
//   * Pricing identifier: Section A rows keep their Revision D identifier.
//     Section B rows take the recommendation's CoinGecko id only when the
//     CoinGecko coin list gives that id the same Base contract
//     (coingeckoBaseContractMatch in the compatibility file); otherwise null,
//     so the price comes from DexScreener by the row's own Base contract.
//     A row with no usable price is pending, never excluded.
//   * Section B rows get row numbers from 1104 in recommendation order.
//     assetId = the recommendation symbol when it is plain ASCII
//     ([A-Za-z0-9._$-], at most 32 characters) and unique among all Base
//     candidates; otherwise "<sanitized symbol>_<last 8 hex of the contract>" (the last
//     8, because vanity addresses such as 0xb2000000... share their first 8).
//     canonicalAssetId = solidityPackedKeccak256(["string","string"], ["Base", assetId]).
//   * Decimals are the on-chain decimals() value; a missing read stops the build.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { ethers } = require("ethers");
const { FOUNDER_OVERRIDE, REMOVED_T431U, isFounderOverride } = require("./founderOverride.cjs");

const DEP = path.join(__dirname, "..", "deployment");
const REVD = path.join(DEP, "assetRegistry.revD.json");
const RECOMMENDATION = path.join(DEP, "baseRegistryRecommendation_2026-10-26.csv");
const ONCHAIN = path.join(DEP, "revE_onchain_2026-10-26.json");
const COMPAT = path.join(DEP, "revE_compatibility_2026-10-26.json");
const OUT = path.join(DEP, "assetRegistry.revE.json");
const FIRST_NEW_ROW = 1104;
const S1_ROW = 454;
const S2_ROW = 2;

// t448u exclusions (kept from t430u, t431u and t447u).
const EXCLUDED_T448U = Object.freeze([
  ...REMOVED_T431U.map((r) => ({ symbol: r.symbol, address: r.address, why: "removed by operator t431u" })),
  { symbol: "TEL (old contract)", address: "0x09bE1692ca16e06f536F0038fF11D1dA8524aDB1", why: "superseded by the upgraded TEL contract (t430u item 3)" },
  { symbol: "BAR", why: "explicit exclusion (t447u, kept by t448u)" },
  { symbol: "ACM", why: "explicit exclusion (t447u, kept by t448u)" },
  { symbol: "ASR", why: "explicit exclusion (t447u, kept by t448u)" },
  { symbol: "XCN", why: "explicit exclusion (t447u, kept by t448u)" },
]);

function parseCsv(text) {
  const lines = text.replace(/\r/g, "").split("\n").filter(Boolean);
  const split = (l) => {
    const out = []; let cur = "", q = false;
    for (let i = 0; i < l.length; i++) {
      const c = l[i];
      if (q) { if (c === '"' && l[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
      else if (c === '"') q = true; else if (c === ",") { out.push(cur); cur = ""; } else cur += c;
    }
    out.push(cur); return out;
  };
  const head = split(lines[0]);
  return lines.slice(1).map((l) => Object.fromEntries(split(l).map((v, i) => [head[i], v])));
}

const canonical = (assetId) => ethers.solidityPackedKeccak256(["string", "string"], ["Base", assetId]);
const PLAIN = /^[A-Za-z0-9._$-]{1,32}$/;
const sanitize = (s) => (String(s).replace(/[^A-Za-z0-9._$-]/g, "").slice(0, 20) || "TOKEN");

function recommendation() {
  const rows = parseCsv(fs.readFileSync(RECOMMENDATION, "utf8"));
  return {
    a: rows.filter((r) => r.section.startsWith("A ")),
    b: rows.filter((r) => r.section.startsWith("B ")),
    x: rows.filter((r) => r.section.startsWith("X ")),
  };
}

function classFor(row) { return row === S1_ROW ? 1 : row === S2_ROW ? 2 : 3; }

function buildRevisionE() {
  const revD = JSON.parse(fs.readFileSync(REVD, "utf8"));
  const facts = JSON.parse(fs.readFileSync(ONCHAIN, "utf8"));
  const compat = JSON.parse(fs.readFileSync(COMPAT, "utf8"));
  const { a, b, x } = recommendation();
  if (a.length !== 130) throw new Error("Section A must hold the 130 Revision D Base rows, got " + a.length);
  const revDBase = revD.entries.filter((e) => e.environmentId === "Base");
  const revDByRow = new Map(revDBase.map((e) => [e.row, e]));
  const verdict = (addr) => {
    const v = compat.tokens[addr.toLowerCase()];
    if (!v || !v.verdict) throw new Error("no compatibility verdict for " + addr);
    return v;
  };
  const fact = (addr) => {
    const f = facts.tokens[addr.toLowerCase()];
    if (!f || f.decimals == null || !(f.codeBytes > 0)) throw new Error("no on-chain decimals/code for " + addr);
    return f;
  };

  const base = [], notCompatible = [];
  const keepOrDrop = (e, addr, source) => {
    const v = verdict(addr);
    if (v.verdict === "not_compatible" && !isFounderOverride("Base", addr)) {
      notCompatible.push({ source, row: e.row, assetId: e.assetId, symbol: e.symbol, address: ethers.getAddress(addr), reasonCode: v.reasonCode, reason: v.reason });
      return false;
    }
    e.compatibility = { verdict: v.verdict, simulation: v.simulation ? v.simulation.result : null, ...(isFounderOverride("Base", addr) && v.verdict === "not_compatible" ? { founderOverrideKept: true, reason: v.reason } : {}) };
    return true;
  };

  // Section A: the Revision D Base rows, unchanged except the class rule and compatibility.
  for (const r of a) {
    const row = Number(r.row_or_proposed_id);
    const src = revDByRow.get(row);
    if (!src) throw new Error("Section A row " + row + " is not a Revision D Base row");
    const e = JSON.parse(JSON.stringify(src));
    e.custodyClass = classFor(row);
    if (e.kind === "token") {
      if (e.identifier.toLowerCase() !== r.contract.toLowerCase()) throw new Error("Section A contract differs from Revision D row " + row);
      const f = fact(e.identifier);
      if (Number(f.decimals) !== e.decimals) throw new Error("decimals differ on chain for row " + row);
      e.onchainE = { block: facts.block, codeBytes: f.codeBytes, decimals: f.decimals, balanceOfOk: f.balanceOfOk, paused: f.paused };
      e.revE = { source: "Section A (Revision D row " + row + ")" };
      if (!keepOrDrop(e, e.identifier, "A")) continue;
    } else {
      e.revE = { source: "Section A (Revision D row " + row + ", native)" };
    }
    base.push(e);
  }
  if (base.length + notCompatible.length !== revDBase.length) throw new Error("Section A does not cover every Revision D Base row");

  // assetId uniqueness is decided over every Base candidate (A and B), not the
  // compatible subset, so the rule does not depend on simulation results.
  const symCount = new Map();
  for (const s of [...revDBase.map((e) => e.assetId), ...b.map((r) => r.symbol)]) symCount.set(s, (symCount.get(s) || 0) + 1);
  const usedIds = new Set(revDBase.map((e) => e.assetId));

  let next = FIRST_NEW_ROW;
  for (const r of b) {
    const addr = r.contract;
    if (!/^0x[0-9a-fA-F]{40}$/.test(addr)) throw new Error("Section B row without a contract: " + r.row_or_proposed_id);
    const rowNo = next++;
    const f = fact(addr);
    const v = verdict(addr);
    let assetId = PLAIN.test(r.symbol) && symCount.get(r.symbol) === 1 ? r.symbol : sanitize(r.symbol) + "_" + addr.slice(-8).toLowerCase();
    if (usedIds.has(assetId)) throw new Error("assetId collision " + assetId);
    usedIds.add(assetId);
    const pricingIdentifier = r.coingecko_id && v.coingeckoBaseContractMatch === true ? r.coingecko_id : null;
    const e = {
      row: rowNo, environmentId: "Base", assetId, canonicalAssetId: canonical(assetId), symbol: r.symbol,
      decimals: Number(f.decimals), decimalsFrom: "decimals() eth_call at Base block " + facts.block, unresolvedReason: null,
      custodyClass: 3, custodyPath: 1, identifier: ethers.getAddress(addr), pricingIdentifier, sameKeyAsRow: null, kind: "token",
      onchain: { status: "verified", block: facts.block, name: f.name, symbol: f.symbol, codeBytes: f.codeBytes },
      onchainE: { block: facts.block, codeBytes: f.codeBytes, decimals: f.decimals, balanceOfOk: f.balanceOfOk, paused: f.paused },
      revE: { source: "Section B " + r.row_or_proposed_id, name: r.name, ...(r.coingecko_id && !pricingIdentifier ? { coingeckoIdNotUsed: r.coingecko_id } : {}) },
    };
    if (!keepOrDrop(e, addr, "B " + r.row_or_proposed_id)) continue;
    base.push(e);
  }

  // Integrity.
  for (const k of ["row", "assetId", "canonicalAssetId"]) {
    const s = new Set(base.map((e) => String(e[k]))); if (s.size !== base.length) throw new Error("duplicate " + k + " in Base subset");
  }
  const addrs = base.filter((e) => e.kind === "token").map((e) => e.identifier.toLowerCase());
  if (new Set(addrs).size !== addrs.length) throw new Error("duplicate Base token address");
  for (const ex of EXCLUDED_T448U) {
    if (ex.address && addrs.includes(ex.address.toLowerCase())) throw new Error(ex.symbol + " is excluded but is in the Base subset");
    if (!ex.address && base.some((e) => e.symbol.toUpperCase() === ex.symbol)) throw new Error(ex.symbol + " is excluded but is in the Base subset");
  }
  for (const xr of x) if (xr.contract && addrs.includes(xr.contract.toLowerCase())) throw new Error("Section X row " + xr.symbol + " is in the Base subset");
  for (const o of FOUNDER_OVERRIDE) if (!addrs.includes(o.address.toLowerCase())) throw new Error("founder override " + o.symbol + " missing");
  for (const e of base) {
    if (e.canonicalAssetId !== canonical(e.assetId) && e.assetId !== "native-ETH") throw new Error("canonical id mismatch row " + e.row);
    if (e.custodyClass !== classFor(e.row)) throw new Error("class rule broken row " + e.row);
    if (e.decimals > 65) throw new Error("decimals above 65 row " + e.row);
  }
  if (!base.some((e) => e.row === S1_ROW && e.custodyClass === 1) || !base.some((e) => e.row === S2_ROW && e.custodyClass === 2)) throw new Error("S1 row 454 or S2 row 2 missing");

  const others = revD.entries.filter((e) => e.environmentId !== "Base");
  const entries = [...others, ...base].sort((p, q) => p.row - q.row || (p.environmentId === "Base" ? 1 : -1));
  const byChain = {};
  for (const e of entries) byChain[e.environmentId] = (byChain[e.environmentId] || 0) + 1;
  const sha = (f) => crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");
  const reasonCounts = {};
  for (const n of notCompatible) reasonCounts[n.reasonCode] = (reasonCounts[n.reasonCode] || 0) + 1;
  return {
    _note: "REVISION E of the asset registry (operator order t448u, 2026-10-26), PROPOSED, not adopted. Revision D (deployment/assetRegistry.revD.json, SHA-256 " + sha(REVD) + ") with its Base subset extended to every technically compatible Base token of deployment/baseRegistryRecommendation_2026-10-26.csv. Rows of other environments are history, carried over unchanged, and are not registered by the Base-only ceremony. Built by scripts/buildRevisionE.cjs.",
    revision: "E",
    date: "2026-10-26",
    rules: {
      membership: "Every Section A and Section B Base token that is technically compatible: on-chain checks at one Base block (code, decimals() at most 65, balanceOf) and a local fork lock-and-release simulation of the real BaseCommitmentVaultLock bytecode. A token whose simulation could not be funded is kept as compatible_static_only. A token that failed the simulation is listed under notTechnicallyCompatible. TigerOG is kept by founder override. No liquidity, volume, market-cap or freshness threshold (t448u).",
      classes: "Row 454 USDC is S1, native ETH row 2 is S2, every other row is S3, including USDT row 1086 and every Section B stablecoin and wrapped token. No name-based multiplier (t448u).",
      pricing: "Unchanged scheduled pricing rules: CoinGecko by the row's pricingIdentifier, then DexScreener by the row's own Base contract (TigerOG may use a pool on any chain for its exact contract). Prices are posted as USD per whole token with 30 decimals (VF-ORC-016). A row with no usable price is pending, never excluded.",
      exclusions: EXCLUDED_T448U.map((e) => e.symbol + (e.address ? " " + e.address : "") + ": " + e.why),
    },
    inputs: {
      revD: { file: "deployment/assetRegistry.revD.json", sha256: sha(REVD) },
      recommendation: { file: "deployment/" + path.basename(RECOMMENDATION), sha256: sha(RECOMMENDATION), sectionA: a.length, sectionB: b.length, sectionX: x.length },
      onchain: { file: "deployment/" + path.basename(ONCHAIN), sha256: sha(ONCHAIN), block: facts.block },
      compatibility: { file: "deployment/" + path.basename(COMPAT), sha256: sha(COMPAT), block: compat.block },
    },
    registry: revD.registry,
    counts: {
      total: entries.length, base: base.length, baseTokens: addrs.length, baseNative: base.length - addrs.length,
      fromSectionA: base.filter((e) => e.row < FIRST_NEW_ROW).length, fromSectionB: base.filter((e) => e.row >= FIRST_NEW_ROW).length,
      compatibleSimulated: base.filter((e) => e.compatibility && e.compatibility.verdict === "compatible").length,
      compatibleStaticOnly: base.filter((e) => e.compatibility && e.compatibility.verdict === "compatible_static_only").length,
      compatibleUnresolved: base.filter((e) => e.compatibility && e.compatibility.verdict === "unresolved").length,
      founderOverride: base.filter((e) => e.founderOverride).length,
      notTechnicallyCompatible: notCompatible.length, notTechnicallyCompatibleByReason: reasonCounts,
      classes: { S1: base.filter((e) => e.custodyClass === 1).length, S2: base.filter((e) => e.custodyClass === 2).length, S3: base.filter((e) => e.custodyClass === 3).length },
      historicalOtherEnvironments: others.length, byChain,
    },
    nativeLinks: revD.nativeLinks,
    notTechnicallyCompatible: notCompatible,
    entries,
  };
}

module.exports = { buildRevisionE, EXCLUDED_T448U, FIRST_NEW_ROW, OUT };

if (require.main === module) {
  const d = buildRevisionE();
  const out = JSON.stringify(d, null, 1) + "\n";
  if (process.argv.includes("--check")) {
    if (fs.readFileSync(OUT, "utf8") !== out) { console.error("assetRegistry.revE.json is out of date"); process.exit(1); }
    console.log("assetRegistry.revE.json is current");
  } else {
    fs.writeFileSync(OUT, out);
    console.log("wrote", path.relative(process.cwd(), OUT), JSON.stringify(d.counts));
  }
}
