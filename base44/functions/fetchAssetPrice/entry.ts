import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { fetchPrice } from "../../shared/vfPriceCascade.ts";

// =============================================================================
// fetchAssetPrice — On-demand price lookup using the 4-tier cascade.
//
// Input:  { symbol, environment, pricing_identifier, contract }
//   - pricing_identifier = CoinGecko ID (from registry)
//   - contract            = contract address (from registry, for DexScreener)
//   - environment         = registry environment name (e.g. "Ethereum", "BNB Smart Chain")
//
// Output: { usd: number | null, source: string, timestamp: string, error?: string }
//
// Never fabricates prices. If no source resolves, returns usd: null.
// =============================================================================

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { symbol, environment, pricing_identifier, contract } = body;

    if (!symbol || !environment) {
      return Response.json(
        { error: 'symbol and environment are required' },
        { status: 400 }
      );
    }

    const result = await fetchPrice({
      symbol,
      environment,
      pricing_identifier,
      contract,
    });

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}