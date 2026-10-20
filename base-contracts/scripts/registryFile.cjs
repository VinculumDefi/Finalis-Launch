// The registry file the live path reads: ceremony, verifier registration,
// token address index, price fetch and price runs, deploy pages.
// Current: deployment/assetRegistry.revB.json (Revision B, 487 entries).
// deployment/assetRegistry.resolved.json is the prior revision (961 written
// rows + Base ETH) and is kept unchanged; it is not read by the live path.
// See deployment/ASSET_REGISTRY_REVISIONS.md.
const fs = require("fs");
const path = require("path");

const DEP = path.join(__dirname, "..", "deployment");
const REGISTRY_FILE = path.join(DEP, "assetRegistry.revB.json");
const REGISTRY_NAME = "deployment/assetRegistry.revB.json";
const HISTORICAL_FILE = path.join(DEP, "assetRegistry.resolved.json");

const isBaseEth = (e) => e.environmentId === "Base" && e.row === 2;

// { reg, written, baseEth, all }
//   written: every Revision B entry except Base ETH (its own environment, own row)
//   baseEth: row 2 (native ETH) registered under Base
//   all:     written + baseEth = every registered line
function loadRegistry(file = REGISTRY_FILE) {
  const reg = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!Array.isArray(reg.entries) || reg.entries.length === 0) throw new Error("registry has no entries: " + file);
  const baseEth = reg.entries.find(isBaseEth);
  if (!baseEth || baseEth.symbol !== "ETH" || baseEth.assetId !== "native-ETH") throw new Error("Base ETH (row 2) missing from " + file);
  const written = reg.entries.filter((e) => !isBaseEth(e));
  return { reg, written, baseEth, all: [...written, baseEth] };
}

// The prior revision's 961 written rows (decimals known, not a same-key
// duplicate). For comparison and tests only; the live path does not use it.
function loadHistoricalWritten() {
  const reg = JSON.parse(fs.readFileSync(HISTORICAL_FILE, "utf8"));
  return reg.entries.filter((e) => e.decimals != null && e.sameKeyAsRow == null);
}

module.exports = { REGISTRY_FILE, REGISTRY_NAME, HISTORICAL_FILE, loadRegistry, loadHistoricalWritten, isBaseEth };
