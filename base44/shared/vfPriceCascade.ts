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
// replaced with a different lookup contract). The four former overrides
// (TigerOG, LionOG, FrogOG, WKC) are removed; TigerOG, LionOG and FrogOG left
// the registry on 2026-10-19.
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
async function dsByContract(environment, contract) {
  const dsChain = DS_CHAIN[environment];
  if (!dsChain || !contract) return null;
  if (PLACEHOLDER_PREFIXES.some((p) => contract.toUpperCase().startsWith(p))) return null;
  const data = await fetchJson(`https://api.dexscreener.com/latest/dex/tokens/${contract}`);
  if (!data || !data.pairs) return null;
  const pairs = data.pairs.filter(
    (p) => p.chainId === dsChain && parseFloat(p.priceUsd || "0") > 0
  );
  if (!pairs.length) return null;
  const best = pairs.reduce((a, b) =>
    parseFloat((b.liquidity || {}).usd || "0") > parseFloat((a.liquidity || {}).usd || "0") ? b : a
  );
  return { usd: parseFloat(best.priceUsd), source: "DexScreener" };
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