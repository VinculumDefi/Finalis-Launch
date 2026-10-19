// Price fetcher for the scheduled price run (t209u item 2). READ-ONLY: HTTP
// GETs to public price APIs; it never signs, sends or posts anything.
//
// Input : deployment/assetRegistry.resolved.json - the 961 written rows
//         (decimals known, not a same-key duplicate) plus the Base ETH row
//         (row 2 under environment Base) = 962 registered rows. Same set as
//         priceRun.cjs registryKeys().
// Output: [{ environmentId, canonicalAssetId, usd | null, source, reason, row, symbol }]
//         usd is the fetched decimal string; null = confirmed fail with reason.
//         Feeds scripts/priceRun.cjs unchanged (it reads environmentId,
//         canonicalAssetId, usd).
//
// Steps, per row:
//  1. CoinGecko /simple/price by the row's own pricingIdentifier (batched).
//     Accepted if usd > 0. CoinGecko age is not filtered (operator opened freshness 2026-10-19); last_updated_at is recorded as cgLastUpdatedAt.
//  2. On a CoinGecko miss: DexScreener by the row's own chain + contract
//     address, then GeckoTerminal by the same chain + address.
//     Minimum-liquidity rule (no numeric rule exists in the registry or the
//     spec; this is the rule used here, an operator decision to confirm):
//       - DexScreener: only pairs on the row's own chain whose BASE token is
//         exactly the row's address; take the pair with the most liquidity;
//         its liquidity.usd must be >= MIN_LIQUIDITY_USD.
//       - GeckoTerminal: the token's total_reserve_in_usd across its pools on
//         the row's chain must be >= MIN_LIQUIDITY_USD.
//  3. No symbol search. No substitute price (no $1 for stablecoins, no price
//     borrowed from another row or chain). Native coins have no contract, so
//     they are priced by CoinGecko only, except where the row's own
//     identifier names a pricing reference contract (ETH -> WETH, SOL ->
//     wrapped SOL), which is then used on that reference's chain.
//  4. Anything else is a confirmed fail with a reason.
//
// CLI: node scripts/fetchPrices.cjs --out <file.json>
const fs = require("fs");
const path = require("path");
const https = require("https");

const MIN_LIQUIDITY_USD = 10000;
const CG_BATCH = 200, DS_BATCH = 30, GT_BATCH = 30;
const PAUSE = { cg: 6000, ds: 400, gt: 2500 };

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

function registryRows(regPath = path.join(__dirname, "..", "deployment", "assetRegistry.resolved.json")) {
  const reg = JSON.parse(fs.readFileSync(regPath, "utf8"));
  const rows = reg.entries.filter((e) => e.decimals != null && e.sameKeyAsRow == null);
  const row2 = reg.entries.find((e) => e.row === 2);
  rows.push({ ...row2, environmentId: "Base" }); // Base ETH (registered under Base)
  return rows;
}

// The row's own contract address and the chain it lives on, or null.
function rowAddress(r) {
  const id = String(r.identifier || "").trim();
  if (EVM_ADDR.test(id)) return CHAINS[r.environmentId] ? { chain: r.environmentId, address: id } : null;
  if (B58_ADDR.test(id)) return r.environmentId === "Solana" ? { chain: "Solana", address: id } : null;
  // Native rows: a pricing reference named by the row itself.
  const evm = id.match(/pricing reference \w+:(0x[0-9a-fA-F]{40})/);
  if (evm) return { chain: "Ethereum", address: evm[1] }; // row 2: WETH on Ethereum
  const sol = id.match(/\(([1-9A-HJ-NP-Za-km-z]{32,44}) wrapped\)/);
  if (sol && r.environmentId === "Solana") return { chain: "Solana", address: sol[1] };
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

// GET JSON with retry on 429/5xx. Returns parsed JSON or throws.
async function getJson(get, url, { tries = 5, wait = 0 } = {}) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await get(url);
      if (r.status === 200) return JSON.parse(r.body);
      last = new Error("HTTP " + r.status);
      if (r.status !== 429 && r.status < 500) throw last;
    } catch (e) { last = e; if (/HTTP 4(?!29)/.test(e.message)) throw e; }
    await sleep(wait * (i + 1) + 2000 * (i + 1));
  }
  throw last;
}
const chunks = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };
const same = (chain, a, b) => (chain === "Solana" ? a === b : String(a).toLowerCase() === String(b).toLowerCase());

async function fetchPrices({ rows = registryRows(), get = httpGet, now = () => Math.floor(Date.now() / 1000), pause = PAUSE, log = () => {} } = {}) {
  const out = new Map(); // index -> result
  const misses = new Map(); // index -> cg reason

  // 1. CoinGecko by pricingIdentifier.
  const ids = [...new Set(rows.map((r) => r.pricingIdentifier).filter(Boolean))];
  const cg = {};
  for (const b of chunks(ids, CG_BATCH)) {
    try {
      Object.assign(cg, await getJson(get, `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(b.join(","))}&vs_currencies=usd&include_last_updated_at=true`, { wait: pause.cg }));
    } catch (e) { log("CoinGecko batch failed: " + e.message); for (const id of b) cg[id] = { _error: e.message }; }
    await sleep(pause.cg);
  }
  rows.forEach((r, i) => {
    const q = cg[r.pricingIdentifier];
    if (!r.pricingIdentifier) misses.set(i, "coingecko: no pricingIdentifier");
    else if (!q || q._error) misses.set(i, q && q._error ? "coingecko: fetch error " + q._error : "coingecko: id not found");
    else if (!(Number(q.usd) > 0)) misses.set(i, "coingecko: no usd price");
    // CoinGecko age is not filtered (operator opened freshness 2026-10-19).
    else out.set(i, { usd: decimalString(q.usd), source: "CoinGecko", reason: null, cgLastUpdatedAt: q.last_updated_at || null });
  });
  log(`CoinGecko: ${out.size} priced, ${misses.size} misses`);

  // 2. DEX fallback by the row's own chain + address.
  const pending = new Map(); // i -> {chain,address,why[]}
  for (const [i, why] of misses) {
    const a = rowAddress(rows[i]);
    if (!a) out.set(i, { usd: null, source: null, reason: "no_contract_address", detail: why });
    else pending.set(i, { ...a, why: [why] });
  }
  const byChain = (m) => { const g = {}; for (const [i, p] of m) (g[p.chain] = g[p.chain] || []).push([i, p]); return g; };

  for (const [chain, list] of Object.entries(byChain(pending))) {
    for (const b of chunks(list, DS_BATCH)) {
      let pairs;
      try { pairs = await getJson(get, `https://api.dexscreener.com/tokens/v1/${CHAINS[chain].ds}/${b.map(([, p]) => p.address).join(",")}`, { wait: pause.ds }); }
      catch (e) { for (const [, p] of b) p.why.push("dexscreener: fetch error " + e.message); await sleep(pause.ds); continue; }
      for (const [i, p] of b) {
        const mine = (Array.isArray(pairs) ? pairs : []).filter((x) => x.chainId === CHAINS[chain].ds && same(chain, x.baseToken && x.baseToken.address, p.address) && Number(x.priceUsd) > 0);
        if (!mine.length) { p.why.push("dexscreener: no pair"); continue; }
        const best = mine.reduce((a, c) => (Number((c.liquidity || {}).usd || 0) > Number((a.liquidity || {}).usd || 0) ? c : a));
        const liq = Number((best.liquidity || {}).usd || 0);
        if (liq < MIN_LIQUIDITY_USD) { p.why.push(`dexscreener: below min liquidity ($${Math.round(liq)})`); p.dsLow = true; continue; }
        out.set(i, { usd: decimalString(best.priceUsd), source: "DexScreener", reason: null, liquidityUsd: Math.round(liq), detail: p.why.join("; ") });
        pending.delete(i);
      }
      await sleep(pause.ds);
    }
  }
  log(`DexScreener: ${[...out.values()].filter((x) => x.source === "DexScreener").length} priced`);

  for (const [chain, list] of Object.entries(byChain(pending))) {
    for (const b of chunks(list, GT_BATCH)) {
      let d;
      try { d = await getJson(get, `https://api.geckoterminal.com/api/v2/simple/networks/${CHAINS[chain].gt}/token_price/${b.map(([, p]) => p.address).join(",")}?include_total_reserve_in_usd=true`, { wait: pause.gt }); }
      catch (e) { for (const [, p] of b) p.why.push("geckoterminal: fetch error " + e.message); await sleep(pause.gt); continue; }
      const at = (d && d.data && d.data.attributes) || {};
      const find = (obj, addr) => { for (const k of Object.keys(obj || {})) if (same(chain, k, addr)) return obj[k]; return undefined; };
      for (const [i, p] of b) {
        const price = find(at.token_prices, p.address), res = Number(find(at.total_reserve_in_usd, p.address) || 0);
        if (!(Number(price) > 0)) { p.why.push("geckoterminal: no price"); continue; }
        if (res < MIN_LIQUIDITY_USD) { p.why.push(`geckoterminal: below min liquidity ($${Math.round(res)})`); p.gtLow = true; continue; }
        out.set(i, { usd: decimalString(price), source: "GeckoTerminal", reason: null, liquidityUsd: Math.round(res), detail: p.why.join("; ") });
        pending.delete(i);
      }
      await sleep(pause.gt);
    }
  }
  for (const [i, p] of pending) {
    const fetchErr = p.why.some((w) => /fetch error/.test(w)) && !p.why.some((w) => /no pair|no price|below/.test(w));
    out.set(i, { usd: null, source: null, reason: fetchErr ? "fetch_error" : (p.dsLow || p.gtLow) ? "below_min_liquidity" : "no_dex_price", detail: p.why.join("; ") });
  }

  return rows.map((r, i) => ({ environmentId: r.environmentId, canonicalAssetId: r.canonicalAssetId, row: r.row, symbol: r.symbol, ...out.get(i) }));
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

module.exports = { fetchPrices, registryRows, rowAddress, summarize, decimalString, MIN_LIQUIDITY_USD, CHAINS };

if (require.main === module) {
  const a = process.argv.slice(2);
  const out = a.includes("--out") ? a[a.indexOf("--out") + 1] : null;
  if (!out) { console.error("usage: node scripts/fetchPrices.cjs --out <file.json>"); process.exit(1); }
  fetchPrices({ log: (m) => console.error(new Date().toISOString() + " " + m) }).then((res) => {
    fs.writeFileSync(out, JSON.stringify(res, null, 1) + "\n");
    console.error(JSON.stringify(summarize(res), null, 1));
  }).catch((e) => { console.error(e); process.exit(1); });
}
