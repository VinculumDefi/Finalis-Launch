// Builds, from the 2026-10-23 on-chain verification results
// (testing-rigs/registry-verify/results/verify-2026-10-23.jsonl):
//   1. base-contracts/deployment/assetRegistry.candidate-2026-10-23.json
//      CANDIDATE active list, not deployed. Revision B remains the live list.
//      Rows: every verified (pass) row, minus duplicate-address losers and the
//      3 rows the operator dropped on 2026-10-19, plus Base ETH as row 2 (as
//      in Revision B). Row fields are copied unchanged from the historical file.
//   2. src/data/tokenVerificationStatus.json
//      The status the app reads: one record per checked token row
//      (pass / fail / unchecked, with the reason). A token with no record was
//      never checked and is hidden by the app.
//   3. testing-rigs/registry-verify/results/summary-2026-10-23.json
//      Counts by status and reason, and the comparison with Revision B.
//
// Duplicate-address rule (same as scripts/buildTokenAddressIndex.cjs, using
// today's on-chain symbol()): among rows on one (chain, address), keep the row
// whose label equals symbol() exactly, else ignoring case, else the lowest row.
// Only the kept row can enter the candidate, and only if it passed.
//
// Usage: node testing-rigs/registry-verify/buildCandidate.cjs [--check]
//   --check: rebuild in memory and fail if any committed output differs.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const ROOT = path.join(__dirname, "..", "..");
const DEP = path.join(ROOT, "base-contracts", "deployment");
const { HISTORICAL_FILE, REGISTRY_FILE } = require(path.join(ROOT, "base-contracts", "scripts", "registryFile.cjs"));
const { rowsToCheck } = require("./verifyRegistry.cjs");
const RESULTS = path.join(__dirname, "results", "verify-2026-10-23.jsonl");
const OUT_CANDIDATE = path.join(DEP, "assetRegistry.candidate-2026-10-23.json");
const OUT_STATUS = path.join(ROOT, "src", "data", "tokenVerificationStatus.json");
const OUT_SUMMARY = path.join(__dirname, "results", "summary-2026-10-23.json");
const OPERATOR_DROPPED_ROWS = [138, 999, 1000]; // dropped by the operator on 2026-10-19 (see ASSET_REGISTRY_ACTIVE.md)
const sha = (f) => crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");
const rel = (f) => path.relative(ROOT, f).split(path.sep).join("/");
const key = (env, row) => env + "|" + row;

function build() {
  const hist = JSON.parse(fs.readFileSync(HISTORICAL_FILE, "utf8"));
  const revB = JSON.parse(fs.readFileSync(REGISTRY_FILE, "utf8"));
  const checked = rowsToCheck();
  const lines = fs.readFileSync(RESULTS, "utf8").split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l));
  const latest = new Map(); for (const r of lines) latest.set(key(r.environmentId, r.row), r); // last record per row wins
  const results = checked.map((e) => latest.get(key(e.environmentId, e.row)) ||
    { row: e.row, environmentId: e.environmentId, label: e.symbol, address: e.identifier, status: "unchecked", reason: "not_run" });

  // duplicate-address rule
  const groups = new Map();
  for (const r of results) { const k = r.environmentId + "|" + r.address.toLowerCase(); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); }
  const loser = new Map();
  for (const [, g] of groups) {
    if (g.length < 2) continue;
    g.sort((a, b) => a.row - b.row);
    const sym = g.map((r) => r.onchainSymbol).find((s) => s != null);
    const pick = (sym != null && (g.find((r) => r.label === sym) || g.find((r) => r.label.toUpperCase() === String(sym).toUpperCase()))) || g[0];
    for (const r of g) if (r !== pick) loser.set(key(r.environmentId, r.row), pick.row);
  }

  const histByKey = new Map(hist.entries.map((e) => [key(e.environmentId, e.row), e]));
  const entries = [], excluded = [];
  const baseEth = revB.entries.find((e) => e.environmentId === "Base" && e.row === 2);
  for (const r of results) {
    const k = key(r.environmentId, r.row);
    const ex = (reason, extra = {}) => excluded.push({ row: r.row, environmentId: r.environmentId, reason, ...extra });
    if (r.status !== "pass") { ex(r.status + ":" + r.reason); continue; }
    if (OPERATOR_DROPPED_ROWS.includes(r.row)) { ex("operator_dropped_2026-10-19"); continue; }
    if (loser.has(k)) { ex("duplicate_address", { keptRow: loser.get(k) }); continue; }
    const h = histByKey.get(k);
    entries.push({ ...h, kind: "token", onchain: { status: "verified", checkedAt: r.checkedAt, block: r.block, chainId: r.chainId, symbolMatch: r.symbolMatch, onchainSymbol: r.onchainSymbol, onchainDecimals: r.onchainDecimals } });
  }
  const { revB: _drop, ...baseEthRow } = baseEth;
  entries.splice(0, 0, { ...baseEthRow, kind: "native", onchain: { status: "native" } });
  entries.sort((a, b) => a.row - b.row || (a.environmentId === "Base" ? -1 : 1));

  const byReason = {}; const byStatus = {};
  for (const r of results) { byStatus[r.status] = (byStatus[r.status] || 0) + 1; if (r.status !== "pass") { const k = r.status + ":" + r.reason; byReason[k] = (byReason[k] || 0) + 1; } }
  const byChain = {}; for (const e of entries) byChain[e.environmentId] = (byChain[e.environmentId] || 0) + 1;

  const candidate = {
    _note: "CANDIDATE active list, not deployed; Revision B remains the live active list (deployment/assetRegistry.revB.json, 487 entries, pinned by build_ceremony_artifacts.cjs). Not read by the ceremony, verifier registration, token address index, price runs or deploy pages. Generated by testing-rigs/registry-verify/buildCandidate.cjs. Rows copied unchanged from deployment/assetRegistry.resolved.json (historical revision).",
    status: "CANDIDATE active list, not deployed; Revision B remains the live active list",
    revision: "candidate-2026-10-23",
    date: "2026-10-23",
    deployed: false,
    liveActiveList: { file: "base-contracts/deployment/assetRegistry.revB.json", revision: revB.revision, entries: revB.entries.length, sha256: sha(REGISTRY_FILE) },
    historicalRevision: { file: "base-contracts/deployment/assetRegistry.resolved.json", sha256: sha(HISTORICAL_FILE), note: "historical revision (961 written rows + Base ETH), unchanged" },
    rules: {
      checked: "every written row of the historical revision whose identifier is an EVM contract address, excluding Solana (" + checked.length + " rows)",
      pass: "contract code present; decimals() equals the row's decimals; symbol() equals the label exactly, ignoring case, as a chain-suffixed label (USDC_ETH), as a numbered label (FLOKI2), or as a rename reviewed on 2026-10-20 that still reads the same symbol",
      included: "pass rows, minus duplicate-address losers and the 3 operator-dropped rows, plus Base ETH as row 2",
      notIncluded: "fail and unchecked rows; every Solana row; the other native coins (not address-bearing, so not part of this check)",
    },
    sources: { verification: rel(RESULTS), verificationSha256: sha(RESULTS), script: "testing-rigs/registry-verify/verifyRegistry.cjs" },
    counts: { total: entries.length, tokens: entries.length - 1, baseEth: 1, byChain, excluded: excluded.length },
    entries, excluded,
  };

  const status = {
    _note: "Generated by testing-rigs/registry-verify/buildCandidate.cjs from the 2026-10-23 on-chain verification. Do not edit by hand. The app shows a token only if its row here has status pass. fail or unchecked is hidden, and a token with no record (never checked) is hidden.",
    checkedOn: "2026-10-23",
    source: rel(RESULTS),
    sourceSha256: sha(RESULTS),
    counts: { records: results.length, ...byStatus },
    records: results.map((r) => ({ environmentId: r.environmentId, row: r.row, address: r.address.toLowerCase(), status: r.status, ...(r.status === "pass" ? {} : { reason: r.reason }) })),
  };

  const passKeys = new Set(results.filter((r) => r.status === "pass").map((r) => key(r.environmentId, r.row)));
  const resKeys = new Map(results.map((r) => [key(r.environmentId, r.row), r]));
  const revTokens = revB.entries.filter((e) => e.kind === "token");
  const revKeys = new Set(revB.entries.map((e) => key(e.environmentId, e.row)));
  const candKeys = new Set(entries.map((e) => key(e.environmentId, e.row)));
  const revFailing = revTokens.filter((e) => resKeys.get(key(e.environmentId, e.row))?.status === "fail");
  const revUnchecked = revTokens.filter((e) => !passKeys.has(key(e.environmentId, e.row)) && resKeys.get(key(e.environmentId, e.row))?.status !== "fail");
  const passNotRev = results.filter((r) => r.status === "pass" && !revKeys.has(key(r.environmentId, r.row)));
  const candNotRev = entries.filter((e) => !revKeys.has(key(e.environmentId, e.row)));
  const summary = {
    checkedOn: "2026-10-23",
    rowsChecked: results.length,
    batches: [...new Set(lines.map((l) => l.batch))].length,
    byStatus, failOrUncheckedByReason: byReason,
    candidate: { file: rel(OUT_CANDIDATE), total: entries.length, tokens: entries.length - 1, excluded: candidate.counts.excluded,
      excludedPassRows: { duplicateAddress: excluded.filter((x) => x.reason === "duplicate_address").length, operatorDropped: excluded.filter((x) => x.reason.startsWith("operator_dropped")).length } },
    revisionB: {
      tokens: revTokens.length, natives: revB.entries.length - revTokens.length,
      tokensFailingNow: revFailing.map((e) => ({ row: e.row, environmentId: e.environmentId })),
      tokensUncheckedNow: revUnchecked.map((e) => ({ row: e.row, environmentId: e.environmentId })),
      tokensPassingNow: revTokens.length - revFailing.length - revUnchecked.length,
      passingNotInRevB: passNotRev.length,
      candidateNotInRevB: candNotRev.length,
      revBNotInCandidate: revB.entries.filter((e) => !candKeys.has(key(e.environmentId, e.row))).map((e) => ({ row: e.row, environmentId: e.environmentId, kind: e.kind })),
    },
  };
  return { candidate, status, summary };
}

module.exports = { build };
if (require.main === module) {
  const { candidate, status, summary } = build();
  const outs = [[OUT_CANDIDATE, candidate], [OUT_STATUS, status], [OUT_SUMMARY, summary]];
  let bad = 0;
  for (const [f, obj] of outs) {
    const text = JSON.stringify(obj, null, 1) + "\n";
    if (process.argv.includes("--check")) { const cur = fs.existsSync(f) ? fs.readFileSync(f, "utf8") : ""; if (cur !== text) { console.error(rel(f) + " is out of date"); bad = 1; } else console.log(rel(f) + " is current"); }
    else { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); console.log("wrote " + rel(f)); }
  }
  console.log(JSON.stringify({ byStatus: summary.byStatus, reasons: summary.failOrUncheckedByReason, candidate: summary.candidate, revB: { ...summary.revisionB, revBNotInCandidate: summary.revisionB.revBNotInCandidate.length } }));
  process.exit(bad);
}
