// Price fetcher for the scheduled price run (t209u item 2). READ-ONLY: HTTP
// GETs to public price APIs; it never signs, sends or posts anything.
//
// Input : the ceremony registry, Revision D (deployment/assetRegistry.revD.json,
//         via scripts/registryFile.cjs CEREMONY_REGISTRY_FILE). By default only
//         its Base rows, the rows the Base-only ceremony registers: 130 Base
//         tokens plus Base ETH (row 2) = 131.
// Output: [{ environmentId, canonicalAssetId, usd | null, source, reason, row, symbol }]
//         usd is the fetched decimal string; null = confirmed fail with reason.
//         Feeds scripts/priceRun.cjs unchanged (it reads environmentId,
//         canonicalAssetId, usd).
//
// Rule: the scheduled first-valid-price cascade (Master Specification Section
// 7.1; same order as scripts/vinculum_price_fetcher_v9.py). Operator t430u
// item 1 (2026-10-26) removed the $10,000 liquidity-pool minimum and the
// screening that came with it (24-hour trade test, 2x market-cap drop and the
// 24-hour CoinGecko freshness test). None of them is applied here.
//
//  1. CoinGecko simple/price by the row's pricingIdentifier. Any usd > 0 is
//     the price. Natives use this step only.
//  2. Tokens not priced in step 1: DexScreener token-pairs for the row's own
//     contract on the row's own chain. Of the pairs on that chain that hold
//     the token and give it a USD price, the pair with the most liquidity
//     gives the price (token as base: priceUsd; token as quote:
//     priceUsd / priceNative).
//  3. Nothing else. No symbol search, no other-chain pair, no substitute or
//     hardcoded price (VF-ORC-004). No price -> confirmed fail "no_price";
//     the row has no usable valuation for that run (VF-ORC-005).
// The first valid price is used; later sources are not consulted for that row
// (VF-ORC-002). API errors are retried; a row that cannot be priced because
// an API stayed down fails "fetch_error".
//
// Founder override rows (TigerOG, LionOG, FrogOG; scripts/founderOverride.cjs,
// t430u item 5) go through the same cascade. No price is invented for them.
//
// CLI: node scripts/fetchPrices.cjs --out <file.json>
const fs = require("fs");
const https = require("https");
const { loadRegistry, CEREMONY_REGISTRY_FILE } = require("./registryFile.cjs");

const CG_BATCH = 200;
const PAUSE = { cg: 6000, ds: 250, retry: 2000 }; // retry: base back-off between tries

// Registry environment -> DexScreener chainId.
const CHAINS = {
  Ethereum: { ds: "ethereum" },
  Arbitrum: { ds: "arbitrum" },
  Base: { ds: "base" },
  Optimism: { ds: "optimism" },
  Polygon: { ds: "polygon" },
  "BNB Smart Chain": { ds: "bsc" },
  Avalanche: { ds: "avalanche" },
  Solana: { ds: "solana" },
};
const EVM_ADDR = /^0x[0-9a-fA-F]{40}$/;
const B58_ADDR = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

// Rows to price. Base-only launch: by default only the Base rows of the
// ceremony registry (Revision D, 131 rows). { baseOnly: false } gives every
// Revision D row (Base rows plus the historical rows of other chains).
function registryRows(regFile = CEREMONY_REGISTRY_FILE, { baseOnly = true } = {}) {
  return loadRegistry(regFile).all.filter((r) => !baseOnly || r.environmentId === "Base");
}

const isNative = (r) => (r.kind ? r.kind === "native" : r.custodyPath === 0);

// A token row's own contract address on its own chain, or null. Natives have
// no contract and are never priced from a pair.
function rowAddress(r) {
  if (isNative(r)) return null;
  const id = String(r.identifier || "").trim();
  if (EVM_ADDR.test(id)) return CHAINS[r.environmentId] ? { chain: r.environmentId, address: id } : null;
  if (B58_ADDR.test(id)) return r.environmentId === "Solana" ? { chain: "Solana", address: id } : null;
  return null;
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { accept: "application/json", "user-agent": "vinculum-price-fetcher" }, timeout: 30000 }, (res) => {
      let b = ""; res.on("data", (c) => (b += c));
      res.on("end", () => resolve({ status: res.statusCode, body: b }));
    });
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// GET JSON with retry on 429/5xx/network errors. 404 -> null (nothing listed).
// Other 4xx, or failure after the retries, throws.
async function getJson(get, url, { tries = 5, wait = 0, retry = 2000 } = {}) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await get(url);
      if (r.status === 200) return JSON.parse(r.body);
      if (r.status === 404) return null;
      last = new Error("HTTP " + r.status);
      if (r.status !== 429 && r.status < 500) throw last;
    } catch (e) { last = e; if (/HTTP 4(?!29)/.test(e.message)) throw e; }
    if (i < tries - 1) await sleep(wait * (i + 1) + retry * (i + 1));
  }
  throw last;
}
const chunks = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };
const same = (chain, a, b) => (chain === "Solana" ? a === b : String(a).toLowerCase() === String(b).toLowerCase());
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

// DexScreener token-pairs -> the token's own-chain pairs that give it a USD
// price, most liquidity first. No liquidity minimum.
function dsPairs(chain, address, pairs) {
  const out = [];
  for (const p of Array.isArray(pairs) ? pairs : []) {
    if (p.chainId && p.chainId !== CHAINS[chain].ds) continue; // own chain only
    const base = same(chain, p.baseToken && p.baseToken.address, address), quote = same(chain, p.quoteToken && p.quoteToken.address, address);
    if (!base && !quote) continue;
    let price = null;
    if (base && num(p.priceUsd) > 0) price = decimalString(p.priceUsd);
    else if (quote && num(p.priceUsd) > 0 && num(p.priceNative) > 0) price = decimalString(String(num(p.priceUsd) / num(p.priceNative)));
    if (!price) continue;
    out.push({ source: "DexScreener", address: String(p.pairAddress || "").toLowerCase(), liquidityUsd: num((p.liquidity || {}).usd), side: base ? "base" : "quote", price });
  }
  return out.sort((x, y) => y.liquidityUsd - x.liquidityUsd);
}

async function fetchPrices({ rows = registryRows(), get = httpGet, pause = PAUSE, log = () => {} } = {}) {
  // 1. CoinGecko by pricingIdentifier.
  const ids = [...new Set(rows.map((r) => r.pricingIdentifier).filter(Boolean))];
  const cg = {};
  for (const b of chunks(ids, CG_BATCH)) {
    try {
      Object.assign(cg, (await getJson(get, `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(b.join(","))}&vs_currencies=usd&include_last_updated_at=true`, { wait: pause.cg, retry: pause.retry ?? 2000 })) || {});
    } catch (e) { log("CoinGecko batch failed: " + e.message); for (const id of b) cg[id] = { _error: e.message }; }
    await sleep(pause.cg);
  }
  const cgOf = (r) => {
    if (!r.pricingIdentifier) return { ok: false, why: "coingecko: no pricingIdentifier" };
    const q = cg[r.pricingIdentifier];
    if (!q) return { ok: false, why: "coingecko: id not found" };
    if (q._error) return { ok: false, err: true, why: "coingecko: fetch error " + q._error };
    if (!(num(q.usd) > 0) || !decimalString(q.usd)) return { ok: false, why: "coingecko: no usd price" };
    return { ok: true, usd: decimalString(q.usd), at: q.last_updated_at || null };
  };

  // 2. DexScreener by the row's own contract, only for tokens step 1 did not price.
  const out = [];
  for (const r of rows) {
    const base = { environmentId: r.environmentId, canonicalAssetId: r.canonicalAssetId, row: r.row, symbol: r.symbol };
    const c = cgOf(r);
    if (c.ok) { out.push({ ...base, usd: c.usd, source: "CoinGecko", reason: null, cgLastUpdatedAt: c.at, kind: isNative(r) ? "native" : "token" }); continue; }
    if (isNative(r)) { out.push({ ...base, usd: null, source: null, reason: c.err ? "fetch_error" : "no_price", detail: c.why, kind: "native" }); continue; }
    const a = rowAddress(r);
    if (!a) { out.push({ ...base, usd: null, source: null, reason: c.err ? "fetch_error" : "no_price", detail: c.why + "; no own-chain contract", kind: "token" }); continue; }
    let pairs = null, dsErr = null;
    try {
      pairs = dsPairs(a.chain, a.address, await getJson(get, `https://api.dexscreener.com/token-pairs/v1/${CHAINS[a.chain].ds}/${a.address}`, { wait: pause.ds, retry: pause.retry ?? 2000 }));
    } catch (e) { dsErr = "dexscreener: fetch error " + e.message; }
    await sleep(pause.ds);
    if (pairs && pairs.length) {
      const p = pairs[0];
      out.push({ ...base, usd: p.price, source: "DexScreener", reason: null, pair: p.address, pairSide: p.side, liquidityUsd: Math.round(p.liquidityUsd), pairsSeen: pairs.length, detail: c.why, kind: "token" });
      continue;
    }
    const why = [c.why, dsErr || "dexscreener: no own-chain pair with a USD price"].join("; ");
    out.push({ ...base, usd: null, source: null, reason: c.err || dsErr ? "fetch_error" : "no_price", detail: why, kind: "token" });
  }
  log(`priced ${out.filter((x) => x.usd != null).length} of ${out.length} rows`);
  return out;
}

// Exact decimal string of an API number/string (no exponent), for toUsd18.
function decimalString(v) {
  let s = String(v).trim();
  const m = s.match(/^(\d+)(?:\.(\d+))?e([+-]?\d+)$/i); // shift the digits, no float arithmetic
  if (m) {
    const digits = m[1] + (m[2] || ""), exp = Number(m[3]), point = m[1].length + exp;
    s = point <= 0 ? "0." + "0".repeat(-point) + digits
      : point >= digits.length ? digits + "0".repeat(point - digits.length)
      : digits.slice(0, point) + "." + digits.slice(point);
    s = s.replace(/^0+(?=\d)/, "");
  }
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
}

function summarize(res) {
  const c = { total: res.length, CoinGecko: 0, DexScreener: 0, fail: 0, failByReason: {} };
  for (const r of res) {
    if (r.usd != null) c[r.source]++;
    else { c.fail++; c.failByReason[r.reason] = (c.failByReason[r.reason] || 0) + 1; }
  }
  return c;
}

module.exports = { fetchPrices, registryRows, rowAddress, summarize, decimalString, dsPairs, isNative, CHAINS };

if (require.main === module) {
  const a = process.argv.slice(2);
  const out = a.includes("--out") ? a[a.indexOf("--out") + 1] : null;
  if (!out) { console.error("usage: node scripts/fetchPrices.cjs --out <file.json>"); process.exit(1); }
  fetchPrices({ log: (m) => console.error(new Date().toISOString() + " " + m) }).then((res) => {
    fs.writeFileSync(out, JSON.stringify(res, null, 1) + "\n");
    console.error(JSON.stringify(summarize(res), null, 1));
  }).catch((e) => { console.error(e); process.exit(1); });
}
