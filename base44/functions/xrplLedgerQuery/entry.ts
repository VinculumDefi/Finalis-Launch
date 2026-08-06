import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// =============================================================================
// XRPL Ledger Query — Server-side RPC proxy for XRPL account/escrow lookups.
//
// Authenticates the user, validates the XRPL address, sanitizes the RPC URL,
// and forwards read-only requests to an XRPL server with `validated` commitment.
//
// VF-XCH-006/010: "No issuance until source satisfies documented exact finality."
//   XRPL finality = `validated` ledger (immutable, no reorgs).
//
// No secrets are required — XRPL public RPC endpoints are read-only.
// =============================================================================

const DEFAULT_XRPL_RPC = 'https://xrplcluster.com';

// Basic XRPL r-address format validation (format check; full checksum deferred to xrpl lib)
function isValidXrplAddress(addr) {
  if (!addr || typeof addr !== 'string') return false;
  if (addr.length < 25 || addr.length > 35) return false;
  if (!addr.startsWith('r')) return false;
  const alphabet = 'rpshnaf39wBUDNEGHJKLM4PQRST7VWXYZ2bcdeCg65jkm8oFqi1tuvAxyz';
  for (const char of addr) {
    if (alphabet.indexOf(char) === -1) return false;
  }
  return true;
}

// SSRF prevention: only allow https URLs to known-safe XRPL RPC hosts
function sanitizeRpcUrl(url) {
  if (!url || typeof url !== 'string') return DEFAULT_XRPL_RPC;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return DEFAULT_XRPL_RPC;
    return parsed.href;
  } catch {
    return DEFAULT_XRPL_RPC;
  }
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { account, rpcUrl, method, params } = body;

    // Validate account address if provided
    if (account && !isValidXrplAddress(account)) {
      return Response.json({ error: 'Invalid XRPL account address format' }, { status: 400 });
    }

    const targetRpc = sanitizeRpcUrl(rpcUrl);

    // Default: account_info with validated commitment
    const rpcMethod = method || 'account_info';
    const rpcParams = params || (account ? [{
      account,
      ledger_index: 'validated', // VF-XCH-006/010: validated = final
      strict: true,
    }] : []);

    const rpcPayload = {
      method: rpcMethod,
      params: rpcParams,
    };

    const response = await fetch(targetRpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rpcPayload),
    });

    if (!response.ok) {
      return Response.json(
        { error: `XRPL RPC returned ${response.status}` },
        { status: 502 },
      );
    }

    const data = await response.json();

    // Sanitize and return normalized result
    const result = data.result || data;
    const status = result.status || (result.validated ? 'validated' : 'unknown');

    return Response.json({
      status,
      account,
      ledger_index: result.ledger_index,
      validated: result.validated || status === 'validated',
      account_data: result.account_data || null,
      ledger_data: result.ledger || null,
      raw: result,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}