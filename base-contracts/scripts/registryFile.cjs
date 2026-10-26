// Registry files. REGISTRY_FILE (the loadRegistry() default) is read by the
// token address index, price fetch and price runs, and the test-chain rigs:
// deployment/assetRegistry.revB.json (Revision B, 487 entries), kept as the
// multi-chain historical record. The Base-only ceremony reads
// CEREMONY_REGISTRY_FILE (Revision D), see below.
// deployment/assetRegistry.resolved.json is the prior revision (961 written
// rows + Base ETH) and is kept unchanged; it is not read by the live path.
// See deployment/ASSET_REGISTRY_REVISIONS.md.
//
// Base-only ceremony package (operator decision t367u, 2026-10-24): the
// ceremony read Revision C (deployment/assetRegistry.revC.json, 487 entries).
// Revision C is a full copy of Revision B with one change: row 454 USDC_BASE
// is S1 (Master Specification Revision 18, Section 6.1). CEREMONY_REGISTRY_FILE
// Revision C is kept unchanged as the prior ceremony source.
//
// Base-only launch candidate (operator t430u, 2026-10-26): the ceremony reads
// Revision D (deployment/assetRegistry.revD.json, 590 entries). Revision D is
// Revision C with its Base rows replaced by the expanded Base registry
// (130 Base rows: 129 tokens plus Base ETH), built by scripts/buildRevisionD.cjs.
// Non-Base rows are carried unchanged as history; the ceremony registers only
// the Base rows. CEREMONY_REGISTRY_FILE below is the ceremony source;
// resolveCeremonyRegistry() and build_ceremony_artifacts.cjs use it. Revision B
// stays pinned and unchanged; it remains the record of the finalized Oct 22 set.
//
// Fail closed: there is no fallback to assetRegistry.resolved.json, no folder
// glob, and no alternate default path. If the requested file is missing, or
// a default path is not exactly its expected basename, loadRegistry throws.
const fs = require("fs");
const path = require("path");

const DEP = path.join(__dirname, "..", "deployment");
const REGISTRY_FILE = path.join(DEP, "assetRegistry.revB.json");
const REGISTRY_NAME = "deployment/assetRegistry.revB.json";
const REGISTRY_BASENAME = "assetRegistry.revB.json";
const CEREMONY_REGISTRY_FILE = path.join(DEP, "assetRegistry.revD.json");
const CEREMONY_REGISTRY_NAME = "deployment/assetRegistry.revD.json";
const CEREMONY_REGISTRY_BASENAME = "assetRegistry.revD.json";
const HISTORICAL_FILE = path.join(DEP, "assetRegistry.resolved.json");
const HISTORICAL_BASENAME = "assetRegistry.resolved.json";

const isBaseEth = (e) => e.environmentId === "Base" && e.row === 2;

// { reg, written, baseEth, all }
//   written: every registry entry except Base ETH (its own environment, own row)
//   baseEth: row 2 (native ETH) registered under Base
//   all:     written + baseEth = every registered line
function loadRegistry(file = REGISTRY_FILE) {
  const resolved = path.resolve(file);
  const base = path.basename(resolved);
  if (base === HISTORICAL_BASENAME || resolved === path.resolve(HISTORICAL_FILE)) {
    throw new Error(
      "REGISTRY GUARD REFUSAL: refusing historical " + HISTORICAL_BASENAME +
      " as the ceremony registry. Expected " + CEREMONY_REGISTRY_BASENAME + " (Revision D, 590 rows)."
    );
  }
  if (file === REGISTRY_FILE || resolved === path.resolve(REGISTRY_FILE)) {
    if (base !== REGISTRY_BASENAME) {
      throw new Error("REGISTRY GUARD REFUSAL: ceremony registry basename must be " + REGISTRY_BASENAME + ", got " + base);
    }
  }
  if (file === CEREMONY_REGISTRY_FILE || resolved === path.resolve(CEREMONY_REGISTRY_FILE)) {
    if (base !== CEREMONY_REGISTRY_BASENAME) {
      throw new Error("REGISTRY GUARD REFUSAL: ceremony registry basename must be " + CEREMONY_REGISTRY_BASENAME + ", got " + base);
    }
  }
  if (!fs.existsSync(resolved)) {
    throw new Error(
      "REGISTRY GUARD REFUSAL: registry missing at " + resolved +
      ". No fallback to " + HISTORICAL_BASENAME + " or any other file."
    );
  }
  const reg = JSON.parse(fs.readFileSync(resolved, "utf8"));
  if (!Array.isArray(reg.entries) || reg.entries.length === 0) throw new Error("registry has no entries: " + resolved);
  const baseEth = reg.entries.find(isBaseEth);
  if (!baseEth || baseEth.symbol !== "ETH" || baseEth.assetId !== "native-ETH") throw new Error("Base ETH (row 2) missing from " + resolved);
  const written = reg.entries.filter((e) => !isBaseEth(e));
  return { reg, written, baseEth, all: [...written, baseEth] };
}

// The prior revision's 961 written rows (decimals known, not a same-key
// duplicate). For comparison and tests only; the live path does not use it.
function loadHistoricalWritten() {
  const reg = JSON.parse(fs.readFileSync(HISTORICAL_FILE, "utf8"));
  return reg.entries.filter((e) => e.decimals != null && e.sameKeyAsRow == null);
}

module.exports = {
  REGISTRY_FILE,
  REGISTRY_NAME,
  REGISTRY_BASENAME,
  CEREMONY_REGISTRY_FILE,
  CEREMONY_REGISTRY_NAME,
  CEREMONY_REGISTRY_BASENAME,
  HISTORICAL_FILE,
  HISTORICAL_BASENAME,
  loadRegistry,
  loadHistoricalWritten,
  isBaseEth,
};
