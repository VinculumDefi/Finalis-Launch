/**
 * Universal Price Fetcher cascade (VF-ORC-001..006 / Section 7.1).
 * Twice-daily cadence is the publication schedule, not an on-chain age cutoff.
 * First valid source wins; no hardcoded fallback prices.
 */
// =============================================================================
// vfPriceCascade: price lookup cascade.
//
// Master Specification is the sole authority. This module is implementation
// infrastructure, not protocol authority.
//
// Cascade per asset (Revision 18 Section 7, D-64, VF-ORC-006):
//   Tier 1: CoinGecko (by pricing_identifier / coingecko_id)
//   Tier 2: DexScreener (by the registry's own contract address on its own chain)
//
// No symbol search (removed by D-64) and no community-token override
// (VF-ORC-006: no override applies, and a displayed registry contract is never
// replaced with a different lookup contract). The four former price-source
// overrides (TigerOG, LionOG, FrogOG, WKC) are removed. TigerOG is on the Base
// registry by founder override (t430u, t431u), which supplies no price; it is
// priced by this cascade like any other row.
//
// If no price is found, returns { usd: null } and never fabricates a value.
// =============================================================================

const TIMEOUT_MS = 14000;
const MAX_RETRY = 3;

// Registry environment name → DexScreener chain ID
const DS_CHAIN = {
  "Ethereum": "ethereum",
  "Base": "base",
  "Arbitrum": "arbitrum",
  "Optimism": "optimism",
  "Polygon": "polygon",
  "BNB Smart Chain": "bsc",
  "Avalanche": "avalanche",
  "Solana": "solana",
};

const PLACEHOLDER_PREFIXES = ["MISSING", "PENDING", "REVIEW", "NATIVE", "DEADBEEF"];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url, params) {
  for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
    try {
      const fullUrl = params ? `${url}?${new URLSearchParams(params)}` : url;
      const resp = await fetch(fullUrl, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          Accept: "application/json",
          "User-Agent": "vinculum-price-fetcher/9",
        },
      });
      if (resp.status === 200) return await resp.json();
      if (resp.status === 429) {
        await sleep(12000 * attempt);
        continue;
      }
      if (resp.status === 404) return null;
    } catch (e) {
      // retry
    }
    await sleep(3000 * attempt);
  }
  return null;
}

// Tier 1: CoinGecko by pricing_identifier (coingecko_id)
async function coingeckoPrice(coingeckoId) {
  const data = await fetchJson("https://api.coingecko.com/api/v3/simple/price", {
    ids: coingeckoId,
    vs_currencies: "usd",
  });
  if (data && data[coingeckoId] && data[coingeckoId].usd) {
    return { usd: parseFloat(data[coingeckoId].usd), source: "CoinGecko" };
  }
  return null;
}

// Tier 2: DexScreener by contract address
//
// The price is always the price of the token being priced. A DexScreener pair
// reports priceUsd for its base (first) token only. When the token is the base
// token, priceUsd is its price. When it is the quote (second) token, its price
// is priceUsd / priceNative (priceNative is the base token's price in quote
// tokens). A pair that does not hold the token on either side, or that lacks
// the fields needed, is skipped. Any pool may give the reference price; the
// pair with the most liquidity among the usable ones is taken. (Operator
// t431u: the pool choice does not matter; the other token's price must never
// be assigned.)
const sameAddr = (a, b) => typeof a === "string" && typeof b === "string" && a.toLowerCase() === b.toLowerCase();

export function tokenUsdFromPair(pair, contract) {
  if (!pair || !contract) return null;
  const priceUsd = parseFloat(pair.priceUsd || "0");
  if (!(priceUsd > 0)) return null;
  if (sameAddr((pair.baseToken || {}).address, contract)) return { usd: priceUsd, side: "base" };
  if (sameAddr((pair.quoteToken || {}).address, contract)) {
    const priceNative = parseFloat(pair.priceNative || "0");
    if (!(priceNative > 0)) return null;
    const usd = priceUsd / priceNative;
    return Number.isFinite(usd) && usd > 0 ? { usd, side: "quote" } : null;
  }
  return null;
}

export function bestDsPrice(pairs, dsChain, contract) {
  let best = null;
  for (const p of pairs || []) {
    if (!p || p.chainId !== dsChain) continue;
    const t = tokenUsdFromPair(p, contract);
    if (!t) continue;
    const liq = parseFloat((p.liquidity || {}).usd || "0") || 0;
    if (!best || liq > best.liq) best = { ...t, liq, pair: p.pairAddress || null };
  }
  return best ? { usd: best.usd, source: "DexScreener", pairSide: best.side, pair: best.pair } : null;
}

export async function dsByContract(environment, contract) {
  const dsChain = DS_CHAIN[environment];
  if (!dsChain || !contract) return null;
  if (PLACEHOLDER_PREFIXES.some((p) => contract.toUpperCase().startsWith(p))) return null;
  // Chain-scoped endpoint first: it lists the token's pools on its own chain.
  // The older all-chain endpoint returns a capped list that can leave out the
  // token's own-chain pools, so it is only a fallback.
  const scoped = await fetchJson(`https://api.dexscreener.com/token-pairs/v1/${dsChain}/${contract}`);
  const r = Array.isArray(scoped) ? bestDsPrice(scoped, dsChain, contract) : null;
  if (r) return r;
  const data = await fetchJson(`https://api.dexscreener.com/latest/dex/tokens/${contract}`);
  if (!data || !data.pairs) return null;
  return bestDsPrice(data.pairs, dsChain, contract);
}

// Main cascade: runs the tiers in the order of Revision 18 Section 7 (D-64).
export async function fetchPrice(params) {
  // symbol is accepted for callers but never used for lookup (D-64).
  const { environment, pricing_identifier, contract } = params;
  const ts = new Date().toISOString();

  // Tier 1: CoinGecko (all assets with pricing_identifier)
  if (pricing_identifier) {
    const r = await coingeckoPrice(pricing_identifier);
    if (r) return { ...r, timestamp: ts };
  }

  // Tier 2: DexScreener by the registry's exact contract
  const r2 = await dsByContract(environment, contract);
  if (r2) return { ...r2, timestamp: ts };

  // No price found: fail per Master Spec (do not fabricate)
  return { usd: null, source: "none", timestamp: ts, error: "No price source resolved" };
}