import { base44 } from '@/api/base44Client';
import { getAssetPricingInfo } from './vfBaseRegistry';

// =============================================================================
// Frontend price service — calls the fetchAssetPrice backend function which
// runs the 4-tier cascade (CoinGecko → DexScreener contract → DexScreener
// search → community-token override).
//
// Master Spec is the sole authority. This module is implementation infrastructure.
// Never fabricate prices. If usd is null, the caller MUST fail the pipeline
// rather than substitute a mock value (VF-ORC-005).
//
// VF-ORC-001/002: Pricing identifiers are sourced from the immutable registry
// (vfBaseRegistry.js) — no parallel pricing-identifier table exists.
// =============================================================================

// Re-export the registry lookup so callers have a single import surface.
export { getAssetPricingInfo };

// Fetch a USD price for an asset using the registry-supplied pricing info.
// Input: { symbol, pricing_identifier, contract, registryName }
//   (obtained from getAssetPricingInfo — the registry is the sole source)
// Returns { usd, source, timestamp, error? } or throws on network failure.
export async function fetchAssetPrice({ symbol, environment, pricing_identifier, contract, registryName }) {
  const resp = await base44.functions.invoke('fetchAssetPrice', {
    symbol,
    environment: registryName || environment,
    pricing_identifier,
    contract,
  });
  return resp.data;
}

// Compute verifiedGrossUsdMicro from the locked asset's gross amount,
// decimals, and fetched USD price.
//
// Formula (all BigInt, no float precision loss):
//   verifiedGrossUsdMicro = (grossAmount × priceScaled × SCALE) / (10^decimals × priceScale)
//
// where priceScaled = round(priceUsd × 10^8) and priceScale = 10^8.
//
// This produces the USD value of the gross locked amount in 18-decimal
// fixed-point, which is what the verifier's checkUsdBounds and
// computeIssuanceFromUsd functions expect.
export function computeVerifiedGrossUsdMicro(grossAmountStr, decimals, priceUsd, scale) {
  const grossAmount = BigInt(grossAmountStr);
  const priceScaled = BigInt(Math.round(priceUsd * 1e8));
  const priceScale = 10n ** 8n;
  const dec = BigInt(decimals);
  return (grossAmount * priceScaled * scale) / (10n ** dec * priceScale);
}