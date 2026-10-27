// Aggregates the Revision E compatibility evidence (t448u) into
// deployment/revE_compatibility_2026-10-26.json.
//
// Inputs (produced by scripts/revE/readStaticFacts.cjs and
// scripts/revE/forkLockSimulation.cjs against one pinned Base block):
//   --static <file>      on-chain facts per token (code, decimals, balanceOf, paused)
//   --cglist <file>      CoinGecko /coins/list?include_platform=true snapshot
//   --candidates <file>  recommendation rows (JSON form of the CSV)
//   --sim <file> ...     JSON lines, one simulation result per token per attempt
//
// Verdict per token (objective, automated, fail closed):
//   compatible               at least one simulated lock and release passed
//   not_compatible           a simulation failed with a funded account and none passed
//   compatible_static_only   on-chain checks passed, but no attempt could fund a
//                            local test account (no holder found in the log
//                            windows and no balance slot found), so the lock was
//                            not simulated; kept and flagged
// An attempt that ended in an RPC error is not a result; the token is retried.
const fs = require("fs");

function args() {
  const a = process.argv.slice(2), o = { sim: [] };
  for (let i = 0; i < a.length; i++) {
    if (a[i] === "--sim") { while (a[i + 1] && !a[i + 1].startsWith("--")) o.sim.push(a[++i]); }
    else o[a[i].slice(2)] = a[++i];
  }
  return o;
}

const REASONS = {
  FEE_ON_TRANSFER: "fee-on-transfer: the Dev Fund or the vault receives less than the amount sent",
  TRANSFERFROM_INTO_VAULT_REVERTS: "transferFrom into the vault reverts although a plain transfer works",
  TRANSFERS_RESTRICTED: "transfers revert for an ordinary funded account at the snapshot block (paused, trading disabled or restricted)",
  APPROVE_RESTRICTED: "approve reverts for an ordinary account",
  RELEASE_SHORT: "release delivers less than the principal (share or balance rounding)",
  RELEASE_OVERPAID: "release moves more than the principal paid out",
  FEE_OVERPAID: "fee transfer moves more than the fee",
  OTHER: "other simulation failure",
};

function classify(r) {
  const reason = String(r.reason || "");
  if (r.stage === "approve") return "APPROVE_RESTRICTED";
  if (/Dev Fund fee short/.test(reason) || (r.inboundShortfall && r.inboundShortfall !== "0")) return "FEE_ON_TRANSFER";
  if (/fee moved more than the fee/.test(reason)) return "FEE_OVERPAID";
  if (/release moved more than paid/.test(reason)) return "RELEASE_OVERPAID";
  if (/received less than principal/.test(reason)) return "RELEASE_SHORT";
  if (r.stage === "lock" && /CVL: transferFrom/.test(reason)) return r.plainTransferOk === false ? "TRANSFERS_RESTRICTED" : "TRANSFERFROM_INTO_VAULT_REVERTS";
  if (r.stage === "lock" && r.plainTransferOk === false) return "TRANSFERS_RESTRICTED";
  return "OTHER";
}

function main() {
  const o = args();
  const st = JSON.parse(fs.readFileSync(o.static, "utf8"));
  const cands = JSON.parse(fs.readFileSync(o.candidates, "utf8"));
  const cg = JSON.parse(fs.readFileSync(o.cglist, "utf8"));
  const cgBase = new Map(cg.map((c) => [c.id, c.platforms && c.platforms.base ? c.platforms.base.toLowerCase() : null]));
  const attempts = new Map();
  for (const f of o.sim) for (const line of fs.readFileSync(f, "utf8").split("\n")) {
    if (!line.trim()) continue;
    let r; try { r = JSON.parse(line); } catch { continue; }
    const k = String(r.address).toLowerCase();
    // An attempt that could fund only a zero amount tested nothing ("CVL: zero
    // gross"); it counts as not simulated, never as a compatibility failure.
    if (r.result === "FAIL" && String(r.amount) === "0") r = { ...r, result: "NOT_SIMULATED", note: "funded amount was 0; not a compatibility signal" };
    if (!attempts.has(k)) attempts.set(k, []);
    attempts.get(k).push(r);
  }
  const tokens = {}, counts = { compatible: 0, compatible_static_only: 0, not_compatible: 0, unresolved: 0 }, byReason = {};
  for (const c of cands) {
    if (!/^0x[0-9a-fA-F]{40}$/.test(c.contract)) continue;
    const k = c.contract.toLowerCase();
    const s = st.tokens[k];
    const all = attempts.get(k) || [];
    const results = all.filter((r) => ["PASS", "FAIL", "NOT_SIMULATED"].includes(r.result));
    const pass = results.filter((r) => r.result === "PASS");
    const fail = results.filter((r) => r.result === "FAIL");
    const holderFail = fail.filter((r) => String(r.fund || "").startsWith("holder"));
    let verdict, simulation, reasonCode = null;
    if (!s || !(s.codeBytes > 0) || s.decimals == null || s.decimals > 65 || s.balanceOfOk !== true) {
      verdict = "not_compatible"; reasonCode = "STATIC_CHECK_FAILED"; simulation = null;
    } else if (pass.length) {
      verdict = "compatible"; simulation = pass.find((r) => String(r.fund || "").startsWith("holder")) || pass[pass.length - 1];
    } else if (fail.length) {
      simulation = holderFail.length ? holderFail[holderFail.length - 1] : fail[fail.length - 1];
      verdict = "not_compatible"; reasonCode = classify(simulation);
    } else if (results.length) {
      verdict = "compatible_static_only"; simulation = results[results.length - 1];
    } else {
      verdict = "unresolved"; simulation = all[all.length - 1] || null;
    }
    counts[verdict]++;
    if (reasonCode) byReason[reasonCode] = (byReason[reasonCode] || 0) + 1;
    const cgId = c.coingecko_id || null;
    tokens[k] = {
      source: c.section.slice(0, 1) + " " + c.row_or_proposed_id, symbol: c.symbol, verdict, reasonCode,
      reason: reasonCode ? (REASONS[reasonCode] || "on-chain check failed") + (simulation && simulation.reason ? " [" + simulation.reason + "]" : "") : null,
      coingeckoId: cgId, coingeckoBaseContractMatch: cgId ? cgBase.get(cgId) === k : null,
      static: s ? { codeBytes: s.codeBytes, eip1967Impl: s.eip1967Impl || null, eip1167: !!s.eip1167, decimals: s.decimals, balanceOfOk: s.balanceOfOk, paused: s.paused } : null,
      attempts: all.length,
      simulation: simulation ? Object.fromEntries(Object.entries(simulation).filter(([kk]) => !["address", "id", "decimals"].includes(kk))) : null,
    };
  }
  const out = {
    _note: "Revision E technical-compatibility evidence (operator order t448u, 2026-10-26). On-chain facts by eth_call and a local anvil fork lock-and-release simulation of the real BaseCommitmentVaultLock bytecode, both at the pinned Base block. Built by scripts/revE/aggregateCompatibility.cjs. A token is never excluded for price, liquidity, volume, market cap or freshness.",
    block: st.block, chainId: st.chainId, readAt: st.readAt,
    method: {
      static: "eth_getCode, decimals(), name(), symbol(), totalSupply(), balanceOf(), paused(), owner(), EIP-1967 implementation slot, EIP-1167 pattern",
      simulation: "Fork at the pinned block; deploy BaseCommitmentVaultLock (5% fee, Dev Fund), fund a fresh test account (a transfer from a recent holder found in Transfer logs, else a balance storage-slot write confirmed by balanceOf), approve, createErc20Lock for 1 whole token (or the funded amount) with the 1-hour duration, check the Dev Fund received the exact fee and the vault the exact principal, advance to maturity, release, check the recipient received exactly the principal. On a lock failure, a plain transfer to an ordinary address is tried as a diagnostic.",
      verdicts: { compatible: "a simulated lock and release passed", not_compatible: "a funded simulation failed and none passed", compatible_static_only: "on-chain checks passed; no attempt could fund a test account, so the lock was not simulated (kept, flagged)" },
    },
    reasons: REASONS,
    counts, notCompatibleByReason: byReason,
    tokens,
  };
  fs.writeFileSync(o.out, JSON.stringify(out, null, 1) + "\n");
  console.log(JSON.stringify({ counts, byReason }));
}
main();
