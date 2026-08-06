// =============================================================================
// vfPriceCascade — Price lookup cascade ported from vinculum_price_fetcher_v9.py
//
// Master Specification is the sole authority. This module is implementation
// infrastructure, not protocol authority. The cascade order, community-token
// overrides, and failure behavior mirror the Python reference exactly.
//
// Cascade per asset:
//   Tier 1 — CoinGecko (by pricing_identifier / coingecko_id)
//   Tier 2 — DexScreener (by contract address; skipped for community tokens)
//   Tier 3 — DexScreener (symbol search; skipped for community tokens)
//   Tier 4 — Community-token override (DexScreener → GeckoTerminal)
//
// If no price is found, returns { usd: null } — never fabricates a value.
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

// Registry environment name → GeckoTerminal network ID
const GT_NET = {
  "Ethereum": "eth",
  "Base": "base",
  "Arbitrum": "arbitrum",
  "Optimism": "optimism",
  "Polygon": "polygon",
  "BNB Smart Chain": "bsc",
  "Avalanche": "avax",
  "Solana": "solana",
};

// Community token overrides — price source differs from display contract.
// Keyed by "SYMBOL@ENVIRONMENT" using registry display names.
const COMMUNITY_TOKENS = {
  "TigerOG@Base": {
    ds_chain: "bsc",
    ds_addr: "0xAC68931B666E086E9de380CFDb0Fb5704a35dc2D",
    gt_network: "bsc",
    gt_addr: "0xAC68931B666E086E9de380CFDb0Fb5704a35dc2D",
  },
  "LionOG@Base": {
    ds_chain: "bsc",
    ds_addr: "0xdA1689C5557564d06E2A546F8FD47350b9D44a73",
    gt_network: "bsc",
    gt_addr: "0xdA1689C5557564d06E2A546F8FD47350b9D44a73",
  },
  "FrogOG@Base": {
    ds_chain: "bsc",
    ds_addr: "0x64da67A12a46f1DDF337393e2dA12eD0A507Ad3D",
    gt_network: "bsc",
    gt_addr: "0x64da67A12a46f1DDF337393e2dA12eD0A507Ad3D",
  },
  "WKC@Ethereum": {
    ds_chain: "ethereum",
    ds_addr: "0x6ec90334d89dbdc89e08a133271be3d104128edb",
    gt_network: "eth",
    gt_addr: "0x6ec90334d89dbdc89e08a133271be3d104128edb",
  },
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

// Tier 3: DexScreener symbol search
async function dsBySearch(symbol, environment) {
  const dsChain = DS_CHAIN[environment];
  if (!dsChain) return null;
  const data = await fetchJson("https://api.dexscreener.com/latest/dex/search", {
    q: symbol,
  });
  if (!data || !data.pairs) return null;
  const pairs = data.pairs.filter(
    (p) =>
      p.chainId === dsChain &&
      (p.baseToken || {}).symbol.toUpperCase() === symbol.toUpperCase() &&
      parseFloat(p.priceUsd || "0") > 0 &&
      parseFloat((p.liquidity || {}).usd || "0") > 200
  );
  if (!pairs.length) return null;
  const best = pairs.reduce((a, b) =>
    parseFloat((b.liquidity || {}).usd || "0") > parseFloat((a.liquidity || {}).usd || "0") ? b : a
  );
  return { usd: parseFloat(best.priceUsd), source: "DexScreener_search" };
}

// Tier 4: Community token override (DexScreener → GeckoTerminal)
async function communityTokenPrice(key) {
  const cfg = COMMUNITY_TOKENS[key];
  if (!cfg) return null;

  // DexScreener first
  const dsData = await fetchJson(`https://api.dexscreener.com/latest/dex/tokens/${cfg.ds_addr}`);
  if (dsData && dsData.pairs) {
    const pairs = dsData.pairs.filter(
      (p) => p.chainId === cfg.ds_chain && parseFloat(p.priceUsd || "0") > 0
    );
    if (pairs.length) {
      const best = pairs.reduce((a, b) =>
        parseFloat((b.liquidity || {}).usd || "0") > parseFloat((a.liquidity || {}).usd || "0") ? b : a
      );
      return { usd: parseFloat(best.priceUsd), source: "DexScreener" };
    }
  }

  // GeckoTerminal fallback
  const gtData = await fetchJson(
    `https://api.geckoterminal.com/api/v2/networks/${cfg.gt_network}/tokens/${cfg.gt_addr}`
  );
  if (gtData && gtData.data) {
    const p = (gtData.data.attributes || {}).price_usd;
    const v = parseFloat(p);
    if (v && v > 0) return { usd: v, source: "GeckoTerminal" };
  }
  return null;
}

// Main cascade — runs tiers in the exact order prescribed by the reference.
export async function fetchPrice(params) {
  const { symbol, environment, pricing_identifier, contract } = params;
  const key = `${symbol}@${environment}`;
  const ts = new Date().toISOString();
  const isCommunity = key in COMMUNITY_TOKENS;

  // Tier 1: CoinGecko (all assets with pricing_identifier)
  if (pricing_identifier) {
    const r = await coingeckoPrice(pricing_identifier);
    if (r) return { ...r, timestamp: ts };
  }

  // Tiers 2-3: DexScreener (skipped for community tokens)
  if (!isCommunity) {
    const r2 = await dsByContract(environment, contract);
    if (r2) return { ...r2, timestamp: ts };

    const r3 = await dsBySearch(symbol, environment);
    if (r3) return { ...r3, timestamp: ts };
  }

  // Tier 4: Community token override
  if (isCommunity) {
    const r = await communityTokenPrice(key);
    if (r) return { ...r, timestamp: ts };
  }

  // No price found — fail per Master Spec (do not fabricate)
  return { usd: null, source: "none", timestamp: ts, error: "No price source resolved" };
}