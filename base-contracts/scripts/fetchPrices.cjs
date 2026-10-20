// Price fetcher for the scheduled price run (t209u item 2). READ-ONLY: HTTP
// GETs to public price APIs; it never signs, sends or posts anything.
//
// Input : the current registry, Revision B (deployment/assetRegistry.revB.json,
//         via scripts/registryFile.cjs): 486 written rows plus the Base ETH row
//         (row 2 under environment Base) = 487 registered rows. Same set as
//         priceRun.cjs registryKeys(). The prior revision
//         (assetRegistry.resolved.json, 962 rows) is no longer read.
// Output: [{ environmentId, canonicalAssetId, usd | null, source, reason, row, symbol }]
//         usd is the fetched decimal string; null = confirmed fail with reason.
//         Feeds scripts/priceRun.cjs unchanged (it reads environmentId,
//         canonicalAssetId, usd).
//
// Rule (operator directive t222u, 2026-10-19): the same rule that selected
// Revision B (scripts/buildRevisionB.cjs, deployment/revB_per_pool_filter.csv).
//
// TOKENS (every token, whichever source gives the price):
//  1. Pools of the row's own contract on the row's own chain are read from
//     DexScreener token-pairs (the token on either side of the pair),
//     GeckoTerminal tokens/multi with top_pools, and, when no qualifying pool
//     is found yet, GeckoTerminal's per-token pool list. A pool seen on both is
//     counted once (DexScreener first).
//  2. A pool reporting more than 2x the token's market cap (the larger of
//     market cap and FDV from GeckoTerminal and DexScreener) is dropped.
//  3. A pool counts only if it traded in the last 24 hours (buys + sells > 0
//     or 24h volume > 0). Idle pools are ignored completely.
//  4. Gate: at least ONE such pool has >= MIN_LIQUIDITY_USD ($10,000) on its
//     own. Liquidity is never summed across pools. No qualifying pool ->
//     confirmed fail "no_single_traded_pool_10k".
//  5. Price, only when the gate passes: CoinGecko if last_updated_at is within
//     FRESH_SECS (24h); else the qualifying pool's own quote (DexScreener,
//     then GeckoTerminal; largest qualifying pool first). A stale CoinGecko
//     price is never used. Gate passes but no fresh price -> fail
//     "no_fresh_price".
// NATIVE coins: a CoinGecko price updated within 24h only; no pool is
//  required or used. Otherwise fail "no_fresh_coingecko".
// No symbol search, no other-chain pools, no substitute price. API errors are
// retried; a token that cannot be judged after retries fails "fetch_error".
// Each result records the best single traded pool (after the 2x drop), so a
// fail shows how close it came.
//
// CLI: node scripts/fetchPrices.cjs --out <file.json>
const fs = require("fs");
const path = require("path");
const https = require("https");
const { loadRegistry } = require("./registryFile.cjs");

const MIN_LIQUIDITY_USD = 10000;
const FRESH_SECS = 24 * 3600; // CoinGecko price must be this fresh (tokens and natives)
const MCAP_MULTIPLE = 2;      // pools reporting more than 2x market cap are dropped
const CG_BATCH = 200, GT_BATCH = 30;
const PAUSE = { cg: 6000, ds: 250, gt: 2500, retry: 2000 }; // retry: base back-off between tries

// Registry environment -> DexScreener chainId / GeckoTerminal network.
const CHAINS = {
  Ethereum: { ds: "ethereum", gt: "eth" },
  Arbitrum: { ds: "arbitrum", gt: "arbitrum" },
  Base: { ds: "base", gt: "base" },
  Optimism: { ds: "optimism", gt: "optimism" },
  Polygon: { ds: "polygon", gt: "polygon_pos" },
  "BNB Smart Chain": { ds: "bsc", gt: "bsc" },
  Avalanche: { ds: "avalanche", gt: "avax" },
  Solana: { ds: "solana", gt: "solana" },
};
const EVM_ADDR = /^0x[0-9a-fA-F]{40}$/;
const B58_ADDR = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function registryRows(regFile) {
  return loadRegistry(regFile).all; // Revision B: written rows + Base ETH
}

const isNative = (r) => (r.kind ? r.kind === "native" : r.custodyPath === 0);

// A token row's own contract address on its own chain, or null. Natives have
// no contract and are never priced from a pool.
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

// DexScreener token-pairs -> pools where the token is base or quote; market caps from base-side pairs.
function dsPools(chain, address, pairs) {
  const pools = [], caps = [];
  for (const p of Array.isArray(pairs) ? pairs : []) {
    if (p.chainId && p.chainId !== CHAINS[chain].ds) continue; // own chain only
    const base = same(chain, p.baseToken && p.baseToken.address, address), quote = same(chain, p.quoteToken && p.quoteToken.address, address);
    if (!base && !quote) continue;
    if (base) for (const x of [p.marketCap, p.fdv]) if (num(x) > 0) caps.push(num(x));
    const t = (p.txns && p.txns.h24) || {};
    let price = null;
    if (base && num(p.priceUsd) > 0) price = String(p.priceUsd);
    else if (quote && num(p.priceUsd) > 0 && num(p.priceNative) > 0) price = String(num(p.priceUsd) / num(p.priceNative));
    pools.push({ source: "DexScreener", address: String(p.pairAddress || "").toLowerCase(), liquidityUsd: num((p.liquidity || {}).usd),
      tx24h: num(t.buys) + num(t.sells), volume24h: num((p.volume || {}).h24), price });
  }
  return { pools, caps };
}

// GeckoTerminal pool objects -> pools with the token's own side price.
function gtPools(chain, address, list) {
  const out = [];
  for (const p of list || []) {
    const at = p.attributes || {}, rel = p.relationships || {};
    const baseId = String(((rel.base_token || {}).data || {}).id || "");
    const isBase = chain === "Solana" ? baseId.endsWith(address) : baseId.toLowerCase().endsWith(String(address).toLowerCase());
    const price = isBase ? at.base_token_price_usd : at.quote_token_price_usd;
    const t = (at.transactions || {}).h24 || {};
    out.push({ source: "GeckoTerminal", address: String(at.address || "").toLowerCase(), liquidityUsd: num(at.reserve_in_usd),
      tx24h: num(t.buys) + num(t.sells), volume24h: num((at.volume_usd || {}).h24), price: num(price) > 0 ? String(price) : null });
  }
  return out;
}

// The gate, on one token's collected pools.
function judgePools(pools, caps) {
  const cap = caps.length ? Math.max(...caps) : null;
  const credible = pools.filter((p) => cap == null || p.liquidityUsd <= MCAP_MULTIPLE * cap);
  const traded = credible.filter((p) => p.tx24h > 0 || p.volume24h > 0);
  const byLiq = (a, b) => b.liquidityUsd - a.liquidityUsd;
  const qualifying = traded.filter((p) => p.liquidityUsd >= MIN_LIQUIDITY_USD).sort(byLiq);
  const best = traded.slice().sort(byLiq)[0] || null;
  const sumTraded = traded.reduce((n, p) => n + p.liquidityUsd, 0);
  const idleBig = pools.some((p) => !(p.tx24h > 0 || p.volume24h > 0) && p.liquidityUsd >= MIN_LIQUIDITY_USD);
  return { qualifying, best, sumTraded, idleBig, marketCapUsd: cap, droppedOverCap: pools.length - credible.length };
}
const poolInfo = (p) => (p ? { source: p.source, address: p.address, liquidityUsd: Math.round(p.liquidityUsd), tx24h: p.tx24h, volume24hUsd: Math.round(p.volume24h) } : null);

async function fetchPrices({ rows = registryRows(), get = httpGet, now = () => Math.floor(Date.now() / 1000), pause = PAUSE, log = () => {} } = {}) {
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
    const q = cg[r.pricingIdentifier];
    if (!r.pricingIdentifier) return { ok: false, why: "coingecko: no pricingIdentifier" };
    if (!q) return { ok: false, why: "coingecko: id not found" };
    if (q._error) return { ok: false, err: true, why: "coingecko: fetch error " + q._error };
    if (!(num(q.usd) > 0)) return { ok: false, why: "coingecko: no usd price" };
    if (!q.last_updated_at) return { ok: false, why: "coingecko: no last_updated_at (not used)" };
    const age = now() - q.last_updated_at;
    if (age > FRESH_SECS) return { ok: false, why: `coingecko: stale (${(age / 3600).toFixed(1)}h old, not used)`, at: q.last_updated_at };
    return { ok: true, usd: decimalString(q.usd), at: q.last_updated_at };
  };

  // 2. Pools for every token row (own chain + own address).
  const tok = new Map(); // i -> { chain, address, pools, caps, errors[] }
  rows.forEach((r, i) => { const a = rowAddress(r); if (a) tok.set(i, { ...a, pools: [], caps: [], errors: [], seen: new Set() }); });
  const addPools = (t, list) => { for (const p of list) { if (p.address && t.seen.has(p.address)) continue; t.seen.add(p.address); t.pools.push(p); } };

  for (const [, t] of tok) { // DexScreener token-pairs, one token per call
    try {
      const pairs = await getJson(get, `https://api.dexscreener.com/token-pairs/v1/${CHAINS[t.chain].ds}/${t.address}`, { wait: pause.ds, retry: pause.retry ?? 2000 });
      const d = dsPools(t.chain, t.address, pairs);
      addPools(t, d.pools); t.caps.push(...d.caps);
    } catch (e) { t.errors.push("dexscreener: fetch error " + e.message); }
    await sleep(pause.ds);
  }
  log(`DexScreener: pools read for ${tok.size} tokens`);

  const byChain = (m) => { const g = {}; for (const [i, t] of m) (g[t.chain] = g[t.chain] || []).push([i, t]); return g; };
  for (const [chain, list] of Object.entries(byChain(tok))) { // GeckoTerminal tokens/multi + top_pools
    for (const b of chunks(list, GT_BATCH)) {
      try {
        const d = (await getJson(get, `https://api.geckoterminal.com/api/v2/networks/${CHAINS[chain].gt}/tokens/multi/${b.map(([, t]) => t.address).join(",")}?include=top_pools`, { wait: pause.gt, retry: pause.retry ?? 2000 })) || {};
        const inc = new Map((d.included || []).map((p) => [p.id, p]));
        for (const [, t] of b) {
          const x = (d.data || []).find((y) => same(chain, (y.attributes || {}).address, t.address));
          if (!x) continue;
          for (const v of [x.attributes.market_cap_usd, x.attributes.fdv_usd]) if (num(v) > 0) t.caps.push(num(v));
          const refs = (((x.relationships || {}).top_pools || {}).data || []).map((r) => inc.get(r.id)).filter(Boolean);
          addPools(t, gtPools(chain, t.address, refs));
        }
      } catch (e) { for (const [, t] of b) t.errors.push("geckoterminal: fetch error " + e.message); }
      await sleep(pause.gt);
    }
  }
  for (const [, t] of tok) { // GeckoTerminal per-token pools, only where no qualifying pool yet
    if (judgePools(t.pools, t.caps).qualifying.length) continue;
    try {
      const d = await getJson(get, `https://api.geckoterminal.com/api/v2/networks/${CHAINS[t.chain].gt}/tokens/${t.address}/pools?page=1`, { wait: pause.gt, retry: pause.retry ?? 2000 });
      addPools(t, gtPools(t.chain, t.address, (d && d.data) || []));
    } catch (e) { t.errors.push("geckoterminal pools: fetch error " + e.message); }
    await sleep(pause.gt);
  }
  log("GeckoTerminal: pools read");

  // 3. Decide each row.
  return rows.map((r, i) => {
    const base = { environmentId: r.environmentId, canonicalAssetId: r.canonicalAssetId, row: r.row, symbol: r.symbol };
    const c = cgOf(r);
    if (isNative(r)) {
      if (c.ok) return { ...base, usd: c.usd, source: "CoinGecko", reason: null, cgLastUpdatedAt: c.at, kind: "native" };
      return { ...base, usd: null, source: null, reason: c.err ? "fetch_error" : "no_fresh_coingecko", detail: c.why, cgLastUpdatedAt: c.at || null, kind: "native" };
    }
    const t = tok.get(i);
    if (!t) return { ...base, usd: null, source: null, reason: "no_contract_address", detail: c.ok ? "coingecko fresh, but no own-chain contract to check pools" : c.why, kind: "token" };
    const j = judgePools(t.pools, t.caps);
    const info = { kind: "token", bestTradedPool: poolInfo(j.best), sumTradedPoolsUsd: Math.round(j.sumTraded), marketCapUsd: j.marketCapUsd, poolsSeen: t.pools.length, poolsDroppedOverCap: j.droppedOverCap };
    const detail = [c.ok ? "coingecko: fresh" : c.why, ...t.errors].join("; ");
    if (!j.qualifying.length) {
      const reason = t.errors.length ? "fetch_error" : "no_single_traded_pool_10k";
      const note = j.sumTraded >= MIN_LIQUIDITY_USD ? "traded pools reach $10,000 only when summed (not counted)" : j.idleBig ? "a pool >= $10,000 is listed but did not trade in 24h (ignored)" : "no traded pool >= $10,000";
      return { ...base, usd: null, source: null, reason, detail: detail + "; " + note, cgLastUpdatedAt: c.at || null, ...info };
    }
    const q = j.qualifying[0];
    if (c.ok) return { ...base, usd: c.usd, source: "CoinGecko", reason: null, cgLastUpdatedAt: c.at, qualifyingPool: poolInfo(q), detail, ...info };
    const pick = j.qualifying.find((p) => p.source === "DexScreener" && p.price) || j.qualifying.find((p) => p.source === "GeckoTerminal" && p.price);
    if (pick) return { ...base, usd: decimalString(pick.price), source: pick.source, reason: null, cgLastUpdatedAt: c.at || null, qualifyingPool: poolInfo(pick), liquidityUsd: Math.round(pick.liquidityUsd), detail, ...info };
    return { ...base, usd: null, source: null, reason: "no_fresh_price", detail: detail + "; qualifying pool has no quote", cgLastUpdatedAt: c.at || null, qualifyingPool: poolInfo(q), ...info };
  });
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
  const c = { total: res.length, CoinGecko: 0, DexScreener: 0, GeckoTerminal: 0, fail: 0, failByReason: {} };
  for (const r of res) {
    if (r.usd != null) c[r.source]++;
    else { c.fail++; c.failByReason[r.reason] = (c.failByReason[r.reason] || 0) + 1; }
  }
  return c;
}

module.exports = { fetchPrices, registryRows, rowAddress, summarize, decimalString, judgePools, dsPools, gtPools, isNative, MIN_LIQUIDITY_USD, FRESH_SECS, MCAP_MULTIPLE, CHAINS };

if (require.main === module) {
  const a = process.argv.slice(2);
  const out = a.includes("--out") ? a[a.indexOf("--out") + 1] : null;
  if (!out) { console.error("usage: node scripts/fetchPrices.cjs --out <file.json>"); process.exit(1); }
  fetchPrices({ log: (m) => console.error(new Date().toISOString() + " " + m) }).then((res) => {
    fs.writeFileSync(out, JSON.stringify(res, null, 1) + "\n");
    console.error(JSON.stringify(summarize(res), null, 1));
  }).catch((e) => { console.error(e); process.exit(1); });
}
