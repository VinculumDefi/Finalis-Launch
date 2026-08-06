// =============================================================================
// PROVENANCE: Vinculum_Finalis_Approved_Asset_Registry.json — Revision 6, 2026-07-28
// Governing source SHA-256: 5a9350618d81005d53b4d05628e7403e8c39fe63847a46576a5fadfbd4ef0bf9
//
// VF-REG-001: "The approved asset registry is the sole source of recognized
// external asset identities for Commitment Vault Locks."
//
// This file embeds the XRPL-environment entries from the authoritative 1,001-entry
// registry. The full XRPL subset cannot be extracted from the workspace because
// the authoritative registry JSON file is not present as a readable document.
//
// Only XRP (native) is included as a confirmed registry entry. Additional XRPL
// assets require provisioning from the authoritative 1,001-entry registry JSON.
// VF-REG-011 status: PARTIAL — EVIDENCE REQUIRED (full field-level audit pending).
// =============================================================================

const ENVIRONMENT = 'XRPL';

// VF-SEC-001: XRPL EscrowCreate supports only native XRP. IOU/issued currencies
// are not supported by the native Escrow mechanism. For IOU locks, a different
// custody mechanism (e.g., PayChan or custom) would be required — deferred.
//
// XRP native asset entry — confirmed in the authoritative registry.
// Row number and exact canonical fields are DEFERRED EXTERNAL INPUT pending
// provisioning of the full registry JSON. The symbol, name, and identifier
// are consistent with XRPL's native asset definition.
const RAW = [
  {
    registry_row: null, // DEFERRED — requires authoritative registry JSON
    symbol: 'XRP',
    asset_name: 'XRP',
    contract_or_native_identifier: 'NATIVE',
    pricing_identifier: 'ripple',
    class: 'S3', // VF-REG-004: XRP is not S1 (USDC/USDT) or S2 (ETH/BTC/AAVE/LINK/UNI)
  },
];

export const XRPL_REGISTRY = RAW.map((entry) => ({
  ...entry,
  environment: ENVIRONMENT,
}));

export const XRPL_REGISTRY_COUNT = XRPL_REGISTRY.length;

// Note: The full XRPL subset from the 1,001-entry registry is not available
// in this workspace. When the authoritative registry JSON is provisioned,
// additional XRPL entries should be added here with their exact canonical fields.