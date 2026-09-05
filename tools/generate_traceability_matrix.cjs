#!/usr/bin/env node
/**
 * generate_traceability_matrix.js — VF-VER-001 evidence generator
 *
 * VF-VER-001 requires each numbered requirement to map to applicable contracts,
 * source-environment programs, functions, tests, and deployment checks.
 *
 * `spec/Vinculum_Finalis_Requirement_Traceability.csv` already carries the
 * AUTHORED half of that: specification section, architecture component, and the
 * positive/negative test obligations. Those are judgement and cannot be
 * generated. This tool fills the GENERATED half — which contracts cite each
 * requirement, in which functions, and which tests name it — by reading the
 * repository, and merges the two.
 *
 * Determinism: output is sorted, contains no timestamps, and records the commit
 * it was generated from plus this tool's version. The same commit always
 * produces byte-identical output, so a reviewer can regenerate and diff rather
 * than trust the artifact (VF-VER-006).
 *
 * Usage:  node tools/generate_traceability_matrix.cjs
 * Writes: spec/Vinculum_Finalis_Requirement_Traceability_GENERATED.csv
 */

"use strict";

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const TOOL_VERSION = "1.0.0";
const REPO = path.resolve(__dirname, "..");
const AUTHORED = path.join(REPO, "spec", "Vinculum_Finalis_Requirement_Traceability.csv");
const OUT = path.join(REPO, "spec", "Vinculum_Finalis_Requirement_Traceability_GENERATED.csv");

const SCAN = [
  { dir: path.join(REPO, "base-contracts", "contracts"), ext: [".sol"], kind: "contract" },
  { dir: path.join(REPO, "base-contracts", "test"), ext: [".cjs", ".js"], kind: "test" },
  { dir: path.join(REPO, "solana-vault", "programs"), ext: [".rs"], kind: "program" },
  { dir: path.join(REPO, "cosmos-hub-vault", "contracts"), ext: [".rs"], kind: "program" },
];

const REQ = /VF-[A-Z]{3}-\d{3}/g;

function walk(dir, exts, out = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries.sort((a, b) => a.name < b.name ? -1 : 1)) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (["node_modules", "target", "artifacts", "cache", ".git"].includes(e.name)) continue;
      walk(p, exts, out);
    } else if (exts.includes(path.extname(e.name))) {
      out.push(p);
    }
  }
  return out;
}

/** Nearest enclosing function/test declaration at or above a line. */
function enclosing(lines, idx, kind) {
  const pat = kind === "contract"
    ? /^\s*function\s+(\w+)/
    : /^\s*(?:it|describe)\s*\(\s*["'`](.+?)["'`]/;
  for (let i = idx; i >= 0 && i > idx - 400; i--) {
    const m = lines[i].match(pat);
    if (m) return m[1];
  }
  return "";
}

// ---- scan --------------------------------------------------------------------
const hits = new Map();   // requirement -> { contract:Set, test:Set, program:Set }

for (const { dir, ext, kind } of SCAN) {
  for (const file of walk(dir, ext)) {
    const rel = path.relative(REPO, file).split(path.sep).join("/");
    const lines = fs.readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      const found = line.match(REQ);
      if (!found) return;
      for (const id of new Set(found)) {
        if (!hits.has(id)) hits.set(id, { contract: new Set(), test: new Set(), program: new Set() });
        const where = enclosing(lines, i, kind);
        hits.get(id)[kind].add(where ? `${rel}:${where}` : rel);
      }
    });
  }
}

// ---- read the authored half --------------------------------------------------
function parseCsvLine(line) {
  const out = []; let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}
const csvCell = (v) => /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;

const authoredLines = fs.readFileSync(AUTHORED, "utf8").split("\n").filter(l => l.trim());
const authoredHead = parseCsvLine(authoredLines[0]);
const authored = new Map();
for (const line of authoredLines.slice(1)) {
  const row = parseCsvLine(line);
  if (row[0] && /^VF-/.test(row[0])) authored.set(row[0].trim(), row);
}

// ---- merge -------------------------------------------------------------------
const commit = (() => {
  try { return execSync("git rev-parse --short HEAD", { cwd: REPO }).toString().trim(); }
  catch { return "UNKNOWN"; }
})();

const ids = [...new Set([...authored.keys(), ...hits.keys()])].sort();

const head = [
  authoredHead[0], authoredHead[1], authoredHead[2],
  "Implemented in (generated)",
  "Tested by (generated)",
  "Source-environment program (generated)",
  "Traceability (generated)",
  authoredHead[4], authoredHead[5], authoredHead[6], authoredHead[8],
];

const rows = [head.map(csvCell).join(",")];
let full = 0, impl = 0, none = 0;

for (const id of ids) {
  const a = authored.get(id) || [id, "", "", "", "", "", "", "", "", ""];
  const h = hits.get(id) || { contract: new Set(), test: new Set(), program: new Set() };
  const c = [...h.contract].sort().join(" | ");
  const t = [...h.test].sort().join(" | ");
  const p = [...h.program].sort().join(" | ");

  let status;
  if ((c || p) && t) { status = "TRACED"; full++; }
  else if (c || p) { status = "IMPLEMENTED — NO NAMED TEST"; impl++; }
  else if (t) { status = "TESTED — NO NAMED IMPLEMENTATION"; }
  else { status = "NOT TRACED IN CODE"; none++; }

  rows.push([id, a[1] || "", a[2] || "", c, t, p, status,
             a[4] || "", a[5] || "", a[6] || "", a[8] || ""].map(csvCell).join(","));
}

const banner =
`# GENERATED FILE — DO NOT EDIT BY HAND.
# Tool: tools/generate_traceability_matrix.cjs v${TOOL_VERSION}
# Commit: ${commit}
# Requirements: ${ids.length} | traced: ${full} | implemented without a named test: ${impl} | not traced in code: ${none}
#
# The authored columns come from spec/Vinculum_Finalis_Requirement_Traceability.csv.
# The columns marked (generated) are derived from the repository at the commit above.
# Regenerate with: node tools/generate_traceability_matrix.cjs
#
# "NOT TRACED IN CODE" is expected for governance, process, and website
# requirements that no contract implements. It is not a defect and is not a
# finding; see reviewers/red-team/README.md.
`;

fs.writeFileSync(OUT, banner + rows.join("\n") + "\n");
process.stdout.write(
  `${path.relative(REPO, OUT)}\n` +
  `  commit ${commit}\n` +
  `  ${ids.length} requirements | ${full} traced | ${impl} implemented without a named test | ${none} not traced in code\n`
);
