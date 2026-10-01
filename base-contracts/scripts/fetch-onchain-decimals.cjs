// =============================================================================
// fetch-onchain-decimals.cjs — read-only eth_call decimals() for five-env
// Approved Asset Registry rows with exact 20-byte contract identifiers.
// Writes:
//   evidence/UNREGISTERED_DECIMALS.md
//   base-contracts/scripts/five-env-onchain-decimals.json  (generated from calls)
// Does not broadcast, deploy, or finalize.
// =============================================================================
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const REGISTRY_PATH = path.join(
  ROOT,
  "spec",
  "Vinculum_Finalis_Approved_Asset_Registry.json"
);
const OUT_JSON = path.join(__dirname, "five-env-onchain-decimals.json");
const OUT_MD = path.join(ROOT, "evidence", "UNREGISTERED_DECIMALS.md");
const VF_BASE_REGISTRY = path.join(ROOT, "src", "lib", "vfBaseRegistry.js");

const FIVE = new Set(["Base", "Ethereum", "Polygon", "Arbitrum", "Optimism"]);

const RPCS = {
  Ethereum: [
    "https://ethereum.publicnode.com",
    "https://ethereum-rpc.publicnode.com",
    "https://eth.drpc.org",
    "https://rpc.ankr.com/eth", // may require key; kept last
  ],
  Polygon: [
    "https://polygon-bor.publicnode.com",
    "https://polygon.drpc.org",
    "https://polygon-rpc.com",
  ],
  Arbitrum: [
    "https://arbitrum-one.publicnode.com",
    "https://arbitrum.drpc.org",
    "https://arb1.arbitrum.io/rpc",
  ],
  Optimism: [
    "https://optimism.publicnode.com",
    "https://optimism.drpc.org",
    "https://mainnet.optimism.io",
  ],
  Base: [
    "https://base.publicnode.com",
    "https://base.drpc.org",
    "https://mainnet.base.org",
  ],
};

const DECIMALS_DATA = "0x313ce567";

function isExact20ByteHexAddress(ident) {
  const s = String(ident || "");
  if (s.length !== 42 || s[0] !== "0" || s[1] !== "x") return false;
  for (let i = 2; i < 42; i++) {
    const c = s[i];
    if (
      !(
        (c >= "0" && c <= "9") ||
        (c >= "a" && c <= "f") ||
        (c >= "A" && c <= "F")
      )
    ) {
      return false;
    }
  }
  return true;
}

function loadPrecisionExpectations() {
  const src = fs.readFileSync(VF_BASE_REGISTRY, "utf8");
  const marker = "export const ASSET_PRECISION_TABLE = {";
  const start = src.indexOf(marker);
  if (start < 0) throw new Error("ASSET_PRECISION_TABLE not found");
  const bodyStart = start + marker.length;
  let depth = 1;
  let i = bodyStart;
  while (i < src.length && depth > 0) {
    const ch = src[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") depth -= 1;
    i += 1;
  }
  const body = src.slice(bodyStart, i - 1);
  const entryRe =
    /'([^']+)':\s*\{\s*symbol:\s*'([^']+)',\s*decimals:\s*(\d+),\s*custodyClass:\s*'([^']+)',\s*custodyPath:\s*'([^']+)'/g;
  const want = new Map();
  let m;
  while ((m = entryRe.exec(body)) !== null) {
    const tableKey = m[1];
    const slash = tableKey.indexOf("/");
    if (slash < 0) continue;
    const environment = tableKey.slice(0, slash);
    const symbol = m[2];
    want.set(`${environment}|${symbol}`, Number(m[3]));
  }
  return want;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function ethCallDecimals(rpcUrl, address) {
  const body = {
    jsonrpc: "2.0",
    id: 1,
    method: "eth_call",
    params: [{ to: address, data: DECIMALS_DATA }, "latest"],
  };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      return {
        ok: false,
        retryable: true,
        reason: `http_${res.status}_non_json: ${text.slice(0, 120)}`,
      };
    }
    if (json.error) {
      const msg = String(json.error.message || JSON.stringify(json.error));
      const retryable =
        /rate|limit|unauthorized|api key|capacity|timeout|429|403/i.test(msg);
      return {
        ok: false,
        retryable,
        reason: `rpc_error: ${msg}`,
      };
    }
    const result = json.result;
    if (result === undefined || result === null || result === "0x") {
      return { ok: false, retryable: false, reason: "empty_result" };
    }
    let value;
    try {
      value = Number(BigInt(result));
    } catch {
      return {
        ok: false,
        retryable: false,
        reason: `decode_failed: ${result}`,
      };
    }
    if (!Number.isInteger(value) || value < 1 || value > 77) {
      return {
        ok: false,
        retryable: false,
        reason: `out_of_range: ${value}`,
        value,
      };
    }
    return { ok: true, value };
  } catch (e) {
    return {
      ok: false,
      retryable: true,
      reason: `fetch_failed: ${e.message || e}`,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function callWithFallback(chain, address) {
  const urls = RPCS[chain];
  let last = { ok: false, retryable: false, reason: "no_rpc" };
  for (let round = 0; round < 3; round++) {
    for (const url of urls) {
      // Skip ankr unless last resort
      if (url.includes("ankr.com") && round < 2) continue;
      last = await ethCallDecimals(url, address);
      if (last.ok) return last;
      if (last.reason && last.reason.startsWith("out_of_range")) return last;
      if (last.reason === "empty_result") return last;
      if (!last.retryable) return last;
      await sleep(150 + round * 200);
    }
    await sleep(400 * (round + 1));
  }
  return last;
}

async function mapPool(items, concurrency, fn) {
  const out = new Array(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
      if (i % 25 === 0) {
        process.stdout.write(
          `\rprogress ${Math.min(i + 1, items.length)}/${items.length}`
        );
      }
    }
  }
  const n = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: n }, () => worker()));
  process.stdout.write(`\rprogress ${items.length}/${items.length}\n`);
  return out;
}

async function main() {
  const raw = JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf8"));
  const records = raw.records || [];
  if (records.length !== 1001) {
    throw new Error(`registry count ${records.length} !== 1001`);
  }

  const qualifying = [];
  for (const r of records) {
    if (!FIVE.has(r.environment)) continue;
    const ident = String(r.contract_or_native_identifier || "");
    if (!isExact20ByteHexAddress(ident)) continue;
    qualifying.push(r);
  }
  console.log(`qualifying rows: ${qualifying.length}`);

  const results = await mapPool(qualifying, 4, async (r) => {
    const addr = r.contract_or_native_identifier;
    const call = await callWithFallback(r.environment, addr);
    return { row: r, call };
  });

  const registered = {};
  const unregistered = [];

  for (const { row: r, call } of results) {
    if (call.ok) {
      registered[String(r.registry_row)] = call.value;
    } else {
      unregistered.push({
        registry_row: r.registry_row,
        environment: r.environment,
        address: r.contract_or_native_identifier,
        symbol: r.symbol,
        reason: call.reason || "unknown",
      });
    }
  }

  const expect = loadPrecisionExpectations();
  const fiveSyms = ["USDC", "USDT", "LINK", "UNI", "AAVE"];
  const disagreements = [];
  for (const r of qualifying) {
    if (!fiveSyms.includes(r.symbol)) continue;
    const key = `${r.environment}|${r.symbol}`;
    const tableDec = expect.get(key);
    if (tableDec === undefined) continue;
    const got = registered[String(r.registry_row)];
    if (got === undefined) {
      disagreements.push({
        symbol: r.symbol,
        environment: r.environment,
        registry_row: r.registry_row,
        address: r.contract_or_native_identifier,
        table: tableDec,
        onchain: null,
        note: "decimals() failed or out of range",
      });
    } else if (got !== tableDec) {
      disagreements.push({
        symbol: r.symbol,
        environment: r.environment,
        registry_row: r.registry_row,
        address: r.contract_or_native_identifier,
        table: tableDec,
        onchain: got,
      });
    }
  }

  if (disagreements.length) {
    console.error("FIVE-ASSET DECIMALS DISAGREEMENT — STOP");
    console.error(JSON.stringify(disagreements, null, 2));
    process.exitCode = 2;
  }

  const payload = {
    generated_at: new Date().toISOString(),
    source: "eth_call decimals() via public RPCs",
    selector: "0x313ce567",
    qualifying_count: qualifying.length,
    registered_count: Object.keys(registered).length,
    unregistered_count: unregistered.length,
    decimals_by_registry_row: registered,
  };
  fs.writeFileSync(OUT_JSON, JSON.stringify(payload, null, 2) + "\n");

  const lines = [];
  lines.push("# UNREGISTERED_DECIMALS");
  lines.push("");
  lines.push(
    "Approved Asset Registry rows (Base / Ethereum / Polygon / Arbitrum / Optimism)"
  );
  lines.push(
    "with an exact 20-byte `contract_or_native_identifier` whose `decimals()`"
  );
  lines.push(
    "eth_call failed or returned a value outside integer range 1..77."
  );
  lines.push("These rows are **not** registered by deployFive.");
  lines.push("");
  lines.push(`Generated: ${payload.generated_at}`);
  lines.push(`Qualifying exact-20-byte rows: ${qualifying.length}`);
  lines.push(`Registered (decimals 1..77): ${payload.registered_count}`);
  lines.push(`Unregistered: ${payload.unregistered_count}`);
  lines.push("");
  lines.push("| registry_row | chain | address | symbol | reason |");
  lines.push("|---:|---|---|---|---|");
  unregistered.sort((a, b) => a.registry_row - b.registry_row);
  for (const u of unregistered) {
    const reason = String(u.reason).replace(/\|/g, "\\|");
    lines.push(
      `| ${u.registry_row} | ${u.environment} | \`${u.address}\` | ${u.symbol} | ${reason} |`
    );
  }
  lines.push("");
  fs.writeFileSync(OUT_MD, lines.join("\n"));

  const fiveCheck = {};
  for (const r of qualifying) {
    if (!fiveSyms.includes(r.symbol) || r.environment !== "Ethereum") continue;
    fiveCheck[r.symbol] = {
      row: r.registry_row,
      onchain: registered[String(r.registry_row)] ?? null,
      table: expect.get(`Ethereum|${r.symbol}`),
    };
  }

  console.log(
    JSON.stringify(
      {
        registered_count: payload.registered_count,
        unregistered_count: payload.unregistered_count,
        disagreements,
        five_asset_check: fiveCheck,
        near_unregistered: unregistered.some((u) => u.symbol === "NEAR"),
        slp_unregistered: unregistered.some((u) => u.symbol === "SLP"),
        near_reason: (unregistered.find((u) => u.symbol === "NEAR") || {})
          .reason,
        slp_reason: (unregistered.find((u) => u.symbol === "SLP") || {}).reason,
      },
      null,
      2
    )
  );

  if (disagreements.length) process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
