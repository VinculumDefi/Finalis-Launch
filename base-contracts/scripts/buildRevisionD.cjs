// Builds deployment/assetRegistry.revD.json (Revision D, Base-only launch
// candidate, operator decision t430u, 2026-10-26).
//
// Revision D = Revision C with its Base subset replaced by the expanded Base
// registry. Rows of other environments are carried over unchanged as history;
// the Base-only ceremony registers only the Base subset.
//
// Inputs (all in deployment/, no network access here):
//   assetRegistry.revC.json                 previous revision (row fields)
//   assetRegistry.resolved.json             prior revision (fields of rows 28, 138, 999, 1000)
//   baseRegistryCandidate_2026-10-26.csv    approved Base list (128 entries, 4 EXCLUDED rows skipped)
//   revD_onchain_2026-10-26.json            name/symbol/decimals/code read on Base (scripts/readBaseTokenFacts.cjs)
//
// Rules:
//   * Approved candidate entries (status other than EXCLUDED), in candidate order.
//   * Founder override (t430u item 5): TigerOG, LionOG, FrogOG (scripts/founderOverride.cjs)
//     are added regardless of any screening.
//   * TEL uses the upgraded Base contract 0x7E13…0731 (t430u item 3), not the
//     old 0x09bE…aDB1 in the candidate file. Decimals come from the chain (18).
//   * Existing Base rows keep their Revision C row number, assetId and
//     canonicalAssetId. Row 28 CBBTC (prior revision) replaces Revision C row 45
//     (same contract; the candidate kept the lower row).
//   * New Base rows get row numbers from 1002 in candidate order, assetId = the
//     candidate symbol, canonicalAssetId = solidityPackedKeccak256(["string","string"], ["Base", assetId]).
//     MFER on Base (candidate "row 286", which is the Ethereum contract in the
//     prior revision) is a new Base row that records correctsRow 286.
//   * Decimals of every token row are the on-chain decimals() value. A row
//     whose on-chain read failed stops the build (fail closed).
//   * No liquidity, freshness or market-cap screening (t430u item 1).
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { ethers } = require("ethers");
const { FOUNDER_OVERRIDE, FOUNDER_OVERRIDE_NAME } = require("./founderOverride.cjs");

const DEP = path.join(__dirname, "..", "deployment");
const CANDIDATE = path.join(DEP, "baseRegistryCandidate_2026-10-26.csv");
const ONCHAIN = path.join(DEP, "revD_onchain_2026-10-26.json");
const OUT = path.join(DEP, "assetRegistry.revD.json");
const FIRST_NEW_ROW = 1002;

const TEL_MIGRATION = Object.freeze({
  symbol: "TEL",
  oldAddress: "0x09bE1692ca16e06f536F0038fF11D1dA8524aDB1",
  newAddress: "0x7E13B43065380aCdeC1c2d138c579cbBbafA0731",
  evidence: "deployment/evidence/TEL_BASE_MIGRATION_2026-10-26.json",
});

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

function approvedCandidates() {
  const rows = parseCsv(fs.readFileSync(CANDIDATE, "utf8")).filter((r) => r.status !== "EXCLUDED");
  return rows.map((r) => (r.symbol === TEL_MIGRATION.symbol && r.address.toLowerCase() === TEL_MIGRATION.oldAddress.toLowerCase())
    ? { ...r, address: TEL_MIGRATION.newAddress, telMigratedFrom: TEL_MIGRATION.oldAddress } : r);
}

function candidateTokenAddresses() {
  const a = approvedCandidates().filter((r) => /^0x[0-9a-fA-F]{40}$/.test(r.address)).map((r) => r.address);
  for (const f of FOUNDER_OVERRIDE) a.push(f.address);
  return a;
}

const CLASS = { S1: 1, S2: 2, S3: 3 };
const canonical = (assetId) => ethers.solidityPackedKeccak256(["string", "string"], ["Base", assetId]);

function buildRevisionD() {
  const revC = JSON.parse(fs.readFileSync(path.join(DEP, "assetRegistry.revC.json"), "utf8"));
  const prior = JSON.parse(fs.readFileSync(path.join(DEP, "assetRegistry.resolved.json"), "utf8")).entries;
  const facts = JSON.parse(fs.readFileSync(ONCHAIN, "utf8"));
  const revCBase = new Map(revC.entries.filter((e) => e.environmentId === "Base").map((e) => [e.row, e]));
  const priorBase = new Map(prior.filter((e) => e.environmentId === "Base").map((e) => [e.row, e]));

  const fact = (addr, label) => {
    const f = facts.tokens[addr.toLowerCase()];
    if (!f || f.decimals == null || !(f.codeBytes > 0)) throw new Error("no on-chain decimals/code for " + label + " " + addr);
    return f;
  };
  const onchain = (f) => ({ status: "verified", block: facts.block, name: f.name, symbol: f.symbol, codeBytes: f.codeBytes });

  const base = [];
  let next = FIRST_NEW_ROW;
  for (const c of approvedCandidates()) {
    const revD = { source: "candidate #" + c.candidate_no + " (" + c.source_entry + ")", candidateStatus: c.status, basis: c.basis };
    const pricingIdentifier = c.price_id || null;
    const m = /^row (\d+)$/.exec(c.source_entry);
    const fromRow = m ? Number(m[1]) : null;
    if (fromRow != null && (revCBase.has(fromRow) || priorBase.has(fromRow))) {
      const src = revCBase.get(fromRow) || priorBase.get(fromRow);
      const e = { ...src };
      delete e.revB;
      e.kind = src.custodyPath === 0 ? "native" : "token";
      e.pricingIdentifier = pricingIdentifier;
      e.custodyClass = CLASS[c.custody_class];
      if (e.kind === "token") {
        if (e.identifier.toLowerCase() !== c.address.toLowerCase()) throw new Error("candidate address differs from row " + fromRow);
        const f = fact(e.identifier, e.symbol);
        if (Number(f.decimals) !== e.decimals) throw new Error("decimals differ on chain for row " + fromRow);
        e.onchain = onchain(f);
      } else e.onchain = { status: "native" };
      if (!revCBase.has(fromRow)) revD.from = "prior revision row " + fromRow;
      if (src.pricingIdentifier !== pricingIdentifier) revD.pricingIdentifierWas = src.pricingIdentifier;
      e.revD = revD;
      base.push(e);
      continue;
    }
    // New Base row (additions, MFER on Base, upgraded TEL).
    const f = fact(c.address, c.symbol);
    const e = {
      row: next++, environmentId: "Base", assetId: c.symbol, canonicalAssetId: canonical(c.symbol), symbol: c.symbol,
      decimals: Number(f.decimals), decimalsFrom: "decimals() eth_call at Base block " + facts.block, unresolvedReason: null,
      custodyClass: CLASS[c.custody_class], custodyPath: 1, identifier: ethers.getAddress(c.address),
      pricingIdentifier, sameKeyAsRow: null, kind: "token", onchain: onchain(f), revD,
    };
    if (fromRow != null) revD.correctsRow = fromRow;
    if (c.telMigratedFrom) { revD.migratedFrom = c.telMigratedFrom; revD.migration = "official upgraded TEL contract (t430u item 3); evidence " + TEL_MIGRATION.evidence; }
    base.push(e);
  }
  for (const o of FOUNDER_OVERRIDE) {
    const src = priorBase.get(o.row);
    if (!src || src.identifier.toLowerCase() !== o.address.toLowerCase()) throw new Error("founder override row mismatch " + o.symbol);
    const f = fact(o.address, o.symbol);
    if (Number(f.decimals) !== src.decimals) throw new Error("decimals differ on chain for " + o.symbol);
    const e = { ...src, pricingIdentifier: null, kind: "token", onchain: onchain(f), founderOverride: true,
      revD: { source: "prior revision row " + o.row, founderOverride: FOUNDER_OVERRIDE_NAME } };
    base.push(e);
  }

  // Integrity: unique row numbers, assetIds, canonical ids and addresses within Base.
  for (const k of ["row", "assetId", "canonicalAssetId"]) {
    const s = new Set(base.map((e) => String(e[k]))); if (s.size !== base.length) throw new Error("duplicate " + k + " in Base subset");
  }
  const addrs = base.filter((e) => e.kind === "token").map((e) => e.identifier.toLowerCase());
  if (new Set(addrs).size !== addrs.length) throw new Error("duplicate Base token address");
  for (const e of base) if (e.canonicalAssetId !== canonical(e.assetId) && e.assetId !== "native-ETH") throw new Error("canonical id mismatch row " + e.row);

  const others = revC.entries.filter((e) => e.environmentId !== "Base");
  const entries = [...others, ...base].sort((a, b) => a.row - b.row || (a.environmentId === "Base" ? 1 : -1));
  const byChain = {};
  for (const e of entries) byChain[e.environmentId] = (byChain[e.environmentId] || 0) + 1;
  const revCSha = crypto.createHash("sha256").update(fs.readFileSync(path.join(DEP, "assetRegistry.revC.json"))).digest("hex");
  return {
    _note: "REVISION D of the asset registry (operator decision t430u, 2026-10-26). Revision C (deployment/assetRegistry.revC.json, SHA-256 " + revCSha + ") with its Base subset replaced by the expanded Base registry. Rows of other environments are history, carried over unchanged, and are not registered by the Base-only ceremony. Built by scripts/buildRevisionD.cjs.",
    revision: "D",
    date: "2026-10-26",
    rules: {
      membership: "Base entries approved in deployment/baseRegistryCandidate_2026-10-26.csv (EXCLUDED rows skipped) plus TigerOG, LionOG and FrogOG by founder override (t430u item 5). No liquidity-pool minimum, no freshness rule and no market-cap screen (t430u item 1).",
      pricing: "Unchanged scheduled pricing rules: CoinGecko by the row's pricingIdentifier, then DexScreener by the row's own Base contract. A row with no usable price has no valuation for that run (VF-ORC-005). No substitute price.",
      tel: "TEL uses the upgraded Base contract " + TEL_MIGRATION.newAddress + " (t430u item 3); the old Base contract " + TEL_MIGRATION.oldAddress + " is not registered.",
    },
    onchainFacts: { file: "deployment/" + path.basename(ONCHAIN), block: facts.block, readAt: facts.readAt },
    registry: revC.registry,
    counts: { total: entries.length, base: base.length, baseTokens: addrs.length, baseNative: base.length - addrs.length,
      baseNewRows: base.filter((e) => e.row >= FIRST_NEW_ROW).length, founderOverride: base.filter((e) => e.founderOverride).length,
      historicalOtherEnvironments: others.length, byChain },
    nativeLinks: revC.nativeLinks,
    entries,
  };
}

module.exports = { buildRevisionD, approvedCandidates, candidateTokenAddresses, TEL_MIGRATION, FIRST_NEW_ROW, OUT };

if (require.main === module) {
  const d = buildRevisionD();
  fs.writeFileSync(OUT, JSON.stringify(d, null, 1) + "\n");
  console.log("wrote", path.relative(process.cwd(), OUT), JSON.stringify(d.counts));
}
