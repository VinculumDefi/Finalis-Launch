// The registry file the live path reads: ceremony, verifier registration,
// token address index, price fetch and price runs, deploy pages.
// Current: deployment/assetRegistry.revB.json (Revision B, 487 entries).
// deployment/assetRegistry.resolved.json is the prior revision (961 written
// rows + Base ETH) and is kept unchanged; it is not read by the live path.
// See deployment/ASSET_REGISTRY_REVISIONS.md.
//
// Fail closed: there is no fallback to assetRegistry.resolved.json, no folder
// glob, and no alternate default path. If Revision B is missing or the path
// is not exactly assetRegistry.revB.json, loadRegistry throws.
const fs = require("fs");
const path = require("path");

const DEP = path.join(__dirname, "..", "deployment");
const REGISTRY_FILE = path.join(DEP, "assetRegistry.revB.json");
const REGISTRY_NAME = "deployment/assetRegistry.revB.json";
const REGISTRY_BASENAME = "assetRegistry.revB.json";
const HISTORICAL_FILE = path.join(DEP, "assetRegistry.resolved.json");
const HISTORICAL_BASENAME = "assetRegistry.resolved.json";

const isBaseEth = (e) => e.environmentId === "Base" && e.row === 2;

// { reg, written, baseEth, all }
//   written: every Revision B entry except Base ETH (its own environment, own row)
//   baseEth: row 2 (native ETH) registered under Base
//   all:     written + baseEth = every registered line
function loadRegistry(file = REGISTRY_FILE) {
  const resolved = path.resolve(file);
  const base = path.basename(resolved);
  if (base === HISTORICAL_BASENAME || resolved === path.resolve(HISTORICAL_FILE)) {
    throw new Error(
      "REGISTRY GUARD REFUSAL: refusing historical " + HISTORICAL_BASENAME +
      " as the ceremony registry. Expected " + REGISTRY_BASENAME + " (Revision B, 487 rows)."
    );
  }
  if (file === REGISTRY_FILE || resolved === path.resolve(REGISTRY_FILE)) {
    if (base !== REGISTRY_BASENAME) {
      throw new Error("REGISTRY GUARD REFUSAL: ceremony registry basename must be " + REGISTRY_BASENAME + ", got " + base);
    }
  }
  if (!fs.existsSync(resolved)) {
    throw new Error(
      "REGISTRY GUARD REFUSAL: Revision B registry missing at " + resolved +
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
  HISTORICAL_FILE,
  HISTORICAL_BASENAME,
  loadRegistry,
  loadHistoricalWritten,
  isBaseEth,
};
