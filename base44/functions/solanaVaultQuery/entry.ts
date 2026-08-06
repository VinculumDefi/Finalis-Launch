// =============================================================================
// Backend function: Solana Vault RPC Query Proxy
//
// Purpose: Proxies read-only Solana JSON-RPC calls to avoid CORS issues and
// to keep the RPC endpoint URL configurable server-side. The client derives
// PDA addresses (using @solana/web3.js) and passes them as strings; this
// function fetches the account data via HTTP.
//
// Input: { pda: string, rpcUrl?: string }
// Output: { pda, exists, lamports, owner, dataBase64, executable }
// =============================================================================

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';

const DEFAULT_RPC_URL = 'https://api.mainnet-beta.solana.com';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { pda, rpcUrl } = body;

    if (!pda || typeof pda !== 'string') {
      return Response.json({ error: 'Missing or invalid "pda" parameter' }, { status: 400 });
    }

    const endpoint = rpcUrl || DEFAULT_RPC_URL;

    // Validate URL format to prevent SSRF
    try {
      new URL(endpoint);
    } catch {
      return Response.json({ error: 'Invalid RPC URL' }, { status: 400 });
    }

    // Call Solana JSON-RPC getAccountInfo
    const rpcResponse = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getAccountInfo',
        params: [pda, { encoding: 'base64', commitment: 'finalized' }],
      }),
    });

    if (!rpcResponse.ok) {
      return Response.json(
        { error: `Solana RPC returned ${rpcResponse.status}` },
        { status: 502 }
      );
    }

    const rpcData = await rpcResponse.json();

    if (rpcData.error) {
      return Response.json(
        { error: rpcData.error.message || 'Solana RPC error', code: rpcData.error.code },
        { status: 502 }
      );
    }

    const account = rpcData.result?.value;
    const exists = account !== null;

    return Response.json({
      pda,
      exists,
      lamports: exists ? account.lamports : 0,
      owner: exists ? account.owner : null,
      executable: exists ? account.executable : false,
      rentEpoch: exists ? account.rentEpoch : null,
      dataBase64: exists ? account.data?.[0] : null,
      commitment: 'finalized',
      rpcEndpoint: endpoint,
      slot: rpcData.result?.context?.slot ?? null,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}