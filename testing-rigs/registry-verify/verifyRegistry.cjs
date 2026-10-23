// Batched on-chain verification of the historical registry's address-bearing rows.
//
// Input: base-contracts/deployment/assetRegistry.resolved.json (historical
// revision, 961 written rows + Base ETH), via registryFile.cjs HISTORICAL_FILE.
// Rows checked: every written row (decimals known, not a same-key duplicate)
// whose identifier is an EVM contract address, excluding Solana.
//
// For each row, on its home chain, read only (no transactions, no keys):
//   eth_getCode (JSON-RPC batch), and symbol(), decimals(), name() through
//   Multicall3 aggregate3 (allowFailure), all at one pinned block per batch.
// Batches: 50 to 100 rows, grouped by home chain. A batch whose RPC fails or
// times out is retried with backoff on the next RPC in the list, up to 3
// retries (4 attempts). Rows still unreachable are UNCHECKED, never pass.
//
// Status per row:
//   pass  : code present, decimals() equals the row's decimals, and symbol()
//           matches the row label: exact, ignoring case, a chain-suffixed
//           label (USDC_ETH reads USDC), a numbered label (FLOKI2 reads FLOKI,
//           as the 2026-10-20 check accepted), or a rename reviewed on 2026-10-20
//           (onchain_verify_20261020.csv renamed_ticker) where the contract
//           still reads the same symbol it read then.
//   fail  : no_code | call_reverted (symbol or decimals reverted or empty) |
//           decimals_mismatch | symbol_mismatch
//   unchecked : rpc_timeout | rpc_error (after all retries)
// Output (appended per batch, so an interrupted run keeps its work):
//   testing-rigs/registry-verify/results/verify-2026-10-23.jsonl
// Rerun skips rows already recorded as pass or fail; unchecked rows are retried.
//
// Usage: node testing-rigs/registry-verify/verifyRegistry.cjs [--batch 100]   (max rows per batch, 50..100)
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..", "..");
const { HISTORICAL_FILE } = require(path.join(ROOT, "base-contracts", "scripts", "registryFile.cjs"));
const PRIOR_CSV = path.join(ROOT, "base-contracts", "deployment", "onchain_verify_20261020.csv");
const OUT = path.join(__dirname, "results", "verify-2026-10-23.jsonl");
const MULTICALL3 = "0xcA11bde05977b3631167028862bE2a173976CA11";

const RPCS = {
  "Ethereum": ["https://ethereum-rpc.publicnode.com", "https://eth.drpc.org", "https://1rpc.io/eth", "https://eth.llamarpc.com"],
  "Arbitrum": ["https://arbitrum-one-rpc.publicnode.com", "https://arb1.arbitrum.io/rpc", "https://arbitrum.drpc.org", "https://1rpc.io/arb"],
  "Optimism": ["https://optimism-rpc.publicnode.com", "https://mainnet.optimism.io", "https://optimism.drpc.org", "https://1rpc.io/op"],
  "Polygon": ["https://polygon-bor-rpc.publicnode.com", "https://polygon-rpc.com", "https://polygon.drpc.org", "https://1rpc.io/matic"],
  "BNB Smart Chain": ["https://bsc-rpc.publicnode.com", "https://bsc-dataseed.bnbchain.org", "https://bsc.drpc.org", "https://1rpc.io/bnb"],
  "Avalanche": ["https://avalanche-c-chain-rpc.publicnode.com", "https://api.avax.network/ext/bc/C/rpc", "https://avalanche.drpc.org", "https://1rpc.io/avax/c"],
  "Base": ["https://base-rpc.publicnode.com", "https://mainnet.base.org", "https://base.drpc.org", "https://1rpc.io/base"],
};
const CHAIN_IDS = { "Ethereum": 1, "Arbitrum": 42161, "Optimism": 10, "Polygon": 137, "BNB Smart Chain": 56, "Avalanche": 43114, "Base": 8453 };
const SEL = { symbol: "95d89b41", decimals: "313ce567", name: "06fdde03" };
const isAddr = (s) => /^0x[0-9a-fA-F]{40}$/.test(s || "") && !/^0x0{40}$/.test(s);

function rowsToCheck() {
  const reg = JSON.parse(fs.readFileSync(HISTORICAL_FILE, "utf8"));
  const written = reg.entries.filter((e) => e.decimals != null && e.sameKeyAsRow == null);
  return written.filter((e) => e.environmentId !== "Solana" && isAddr(e.identifier));
}

function priorRenames() {
  const [h, ...ls] = fs.readFileSync(PRIOR_CSV, "utf8").trim().split("\n");
  const H = h.split(","); const m = new Map();
  for (const l of ls) {
    const v = []; let cur = "", q = false;
    for (let i = 0; i < l.length; i++) { const c = l[i];
      if (q) { if (c === '"' && l[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
      else if (c === '"') q = true; else if (c === ",") { v.push(cur); cur = ""; } else cur += c; }
    v.push(cur);
    const r = Object.fromEntries(H.map((k, i) => [k, v[i]]));
    if (r.status === "renamed_ticker") m.set(r.row + "|" + r.environment + "|" + r.address.toLowerCase(), r.onchain_symbol);
  }
  return m;
}

// ---- minimal ABI encode/decode for Multicall3.aggregate3((address,bool,bytes)[]) ----
const pad = (hex) => hex.padStart(64, "0");
const u = (n) => pad(BigInt(n).toString(16));
function encodeAggregate3(calls) {
  // calls: [{target, data(hex no 0x)}]
  let head = u(32) + u(calls.length);
  const tuples = calls.map((c) => {
    const dlen = c.data.length / 2;
    const dpad = c.data.padEnd(Math.ceil(dlen / 32) * 64, "0");
    return pad(c.target.slice(2).toLowerCase()) + u(1) + u(96) + u(dlen) + dpad;
  });
  let off = 32 * calls.length, offs = "";
  for (const t of tuples) { offs += u(off); off += t.length / 2; }
  return "0x82ad56cb" + head + offs + tuples.join("");
}
function decodeAggregate3(hex) {
  const b = hex.slice(2); const w = (i) => b.slice(i * 2, i * 2 + 64);
  const arr = parseInt(w(0), 16); const n = parseInt(w(arr), 16); const base = arr + 32; const out = [];
  for (let i = 0; i < n; i++) {
    const t = base + parseInt(w(base + 32 * i), 16);
    const ok = BigInt("0x" + w(t)) === 1n;
    const doff = t + parseInt(w(t + 32), 16); const len = parseInt(w(doff), 16);
    out.push({ ok, data: b.slice((doff + 32) * 2, (doff + 32 + len) * 2) });
  }
  return out;
}
function decodeString(data) {
  if (!data) return null;
  try {
    if (data.length >= 128) {
      const off = parseInt(data.slice(0, 64), 16);
      if (off === 32) { const len = parseInt(data.slice(64, 128), 16);
        if (len <= 256 && data.length >= 128 + len * 2) return Buffer.from(data.slice(128, 128 + len * 2), "hex").toString("utf8"); }
    }
    if (data.length === 64) return Buffer.from(data, "hex").toString("utf8").replace(/\0+$/g, ""); // bytes32 symbol (e.g. MKR)
  } catch { /* fallthrough */ }
  return null;
}
function decodeUint(data) { if (!data || data.length < 64) return null; const v = BigInt("0x" + data.slice(0, 64)); return v < 256n ? Number(v) : null; }

async function rpc(url, body, timeoutMs = 20000) {
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: ac.signal });
    if (!r.ok) throw Object.assign(new Error("HTTP " + r.status), { kind: "rpc_error" });
    return await r.json();
  } catch (e) {
    if (e.name === "AbortError") throw Object.assign(new Error("timeout after " + timeoutMs + " ms"), { kind: "rpc_timeout" });
    if (!e.kind) e.kind = /timeout/i.test(e.message) ? "rpc_timeout" : "rpc_error";
    throw e;
  } finally { clearTimeout(t); }
}

async function queryBatch(env, rows, url) {
  const cid = await rpc(url, { jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] });
  if (!cid.result || parseInt(cid.result, 16) !== CHAIN_IDS[env]) throw Object.assign(new Error("wrong or missing chainId " + JSON.stringify(cid.result || cid.error)), { kind: "rpc_error" });
  const bn = await rpc(url, { jsonrpc: "2.0", id: 2, method: "eth_blockNumber", params: [] });
  if (!bn.result) throw Object.assign(new Error("no block number"), { kind: "rpc_error" });
  const block = bn.result;
  // Codes: JSON-RPC batch, in chunks of 25 (some RPCs cap batch size).
  const codes = [];
  for (let i = 0; i < rows.length; i += 25) {
    const chunk = rows.slice(i, i + 25);
    const res = await rpc(url, chunk.map((e, j) => ({ jsonrpc: "2.0", id: 100 + j, method: "eth_getCode", params: [e.identifier, block] })));
    if (!Array.isArray(res)) throw Object.assign(new Error("batch eth_getCode not supported: " + JSON.stringify(res).slice(0, 120)), { kind: "rpc_error" });
    const byId = new Map(res.map((x) => [x.id, x]));
    for (let j = 0; j < chunk.length; j++) {
      const x = byId.get(100 + j);
      if (!x || x.error || typeof x.result !== "string") throw Object.assign(new Error("eth_getCode failed: " + JSON.stringify(x && x.error).slice(0, 120)), { kind: "rpc_error" });
      codes.push((x.result.length - 2) / 2);
    }
  }
  // symbol/decimals/name through Multicall3, chunks of 25 rows (75 calls).
  const reads = [];
  for (let i = 0; i < rows.length; i += 25) {
    const chunk = rows.slice(i, i + 25);
    const calls = [];
    for (const e of chunk) for (const s of ["symbol", "decimals", "name"]) calls.push({ target: e.identifier, data: SEL[s] });
    const res = await rpc(url, { jsonrpc: "2.0", id: 3, method: "eth_call", params: [{ to: MULTICALL3, data: encodeAggregate3(calls) }, block] });
    if (!res.result || res.result === "0x") throw Object.assign(new Error("multicall failed: " + JSON.stringify(res.error).slice(0, 160)), { kind: "rpc_error" });
    const d = decodeAggregate3(res.result);
    if (d.length !== calls.length) throw Object.assign(new Error("multicall length mismatch"), { kind: "rpc_error" });
    for (let j = 0; j < chunk.length; j++) reads.push({ symbol: d[3 * j], decimals: d[3 * j + 1], name: d[3 * j + 2] });
  }
  return { block: parseInt(block, 16), codes, reads };
}

const norm = (s) => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
function classify(e, codeBytes, rd, renames) {
  const symbol = rd.symbol.ok ? decodeString(rd.symbol.data) : null;
  const decimals = rd.decimals.ok ? decodeUint(rd.decimals.data) : null;
  const name = rd.name.ok ? decodeString(rd.name.data) : null;
  const base = { codeBytes, onchainSymbol: symbol, onchainDecimals: decimals, onchainName: name };
  if (!codeBytes) return { ...base, status: "fail", reason: "no_code" };
  if (symbol == null || symbol === "" || decimals == null) return { ...base, status: "fail", reason: "call_reverted", detail: (symbol == null || symbol === "" ? "symbol() " : "") + (decimals == null ? "decimals()" : "") };
  if (decimals !== e.decimals) return { ...base, status: "fail", reason: "decimals_mismatch", detail: `row ${e.decimals}, chain ${decimals}` };
  const label = e.symbol;
  let match = null;
  if (symbol === label) match = "exact";
  else if (symbol.toUpperCase() === label.toUpperCase()) match = "case";
  else if (label.includes("_") && norm(label.split("_")[0]) === norm(symbol)) match = "suffix-alias";
  else if (/^[A-Za-z]+[2-9]$/.test(label) && label.slice(0, -1).toUpperCase() === symbol.toUpperCase()) match = "numbered-alias";
  else {
    const rn = renames.get(e.row + "|" + e.environmentId + "|" + e.identifier.toLowerCase());
    if (rn != null && rn === symbol) match = "reviewed-rename-2026-10-20";
  }
  if (!match) return { ...base, status: "fail", reason: "symbol_mismatch", detail: `label ${label}, chain ${symbol}` };
  return { ...base, status: "pass", symbolMatch: match };
}

async function main() {
  const bi = process.argv.indexOf("--batch");
  const BATCH = bi > 0 ? Math.max(50, Math.min(100, Number(process.argv[bi + 1]))) : 100;
  const rows = rowsToCheck();
  const renames = priorRenames();
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const done = new Map();
  if (fs.existsSync(OUT)) for (const l of fs.readFileSync(OUT, "utf8").split("\n")) { if (!l.trim()) continue; const r = JSON.parse(l); done.set(r.row + "|" + r.environmentId, r); }
  const todo = rows.filter((e) => { const d = done.get(e.row + "|" + e.environmentId); return !d || d.status === "unchecked"; });
  console.log(`rows to check: ${rows.length} total, ${todo.length} not yet pass/fail`);
  const byEnv = new Map();
  for (const e of todo) { if (!byEnv.has(e.environmentId)) byEnv.set(e.environmentId, []); byEnv.get(e.environmentId).push(e); }
  let batchNo = 0;
  for (const [env, list] of byEnv) {
    // even split into ceil(len / BATCH) batches: every batch is 50..100 rows when
    // the chain has at least 50 rows; a chain with fewer rows is one batch.
    const n = Math.ceil(list.length / BATCH); const size = Math.ceil(list.length / n);
    for (let i = 0; i < list.length; i += size) {
      const batch = list.slice(i, i + size); batchNo++;
      const id = `${env}#${Math.floor(i / size) + 1}`;
      let res = null, lastErr = null, attempts = [];
      for (let a = 0; a < 4 && !res; a++) {
        const url = RPCS[env][a % RPCS[env].length];
        if (a > 0) await new Promise((r) => setTimeout(r, 2000 * 2 ** (a - 1)));
        try { res = await queryBatch(env, batch, url); res.url = url; attempts.push({ url, ok: true }); }
        catch (err) { lastErr = err; attempts.push({ url, ok: false, kind: err.kind, error: String(err.message).slice(0, 160) }); }
      }
      const at = new Date().toISOString();
      const lines = batch.map((e, j) => {
        const common = { row: e.row, environmentId: e.environmentId, chainId: CHAIN_IDS[env], label: e.symbol, address: e.identifier, rowDecimals: e.decimals, batch: id, batchSize: batch.length, checkedAt: at };
        if (!res) return { ...common, status: "unchecked", reason: lastErr.kind || "rpc_error", detail: String(lastErr.message).slice(0, 160), attempts: attempts.length };
        return { ...common, block: res.block, rpc: new URL(res.url).host, attempts: attempts.length, ...classify(e, res.codes[j], res.reads[j], renames) };
      });
      fs.appendFileSync(OUT, lines.map((l) => JSON.stringify(l)).join("\n") + "\n");
      const c = {}; for (const l of lines) c[l.status] = (c[l.status] || 0) + 1;
      console.log(`batch ${batchNo} ${id}: ${batch.length} rows, ${attempts.length} attempt(s), ${JSON.stringify(c)}`);
    }
  }
}

module.exports = { rowsToCheck, classify, encodeAggregate3, decodeAggregate3, decodeString, OUT };
if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
