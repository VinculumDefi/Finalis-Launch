// Centralized Vinculum Finalis integration configuration.
// REAL values present in the workspace are used verbatim. Genuinely-undeployed or
// absent addresses are marked "PENDING_DEPLOYMENT" or "NOT_PRESENT" — never invented.
// See NATIVE_TO_BASE_CONNECTION_STATUS.md for the factual evidence backing each entry.

export const DEPLOYMENT_STATE = 'AWAITING_DEPLOYMENT'; // Preview / Awaiting deployment / Configured / Live

export const PENDING = 'PENDING_DEPLOYMENT';
export const NOT_PRESENT = 'NOT_PRESENT';

// --- Cosmos Hub source environment (real, from src/cosmos-hub-vault/.../msg.rs + cosmosCandidateData) ---
export const COSMOS_HUB = {
  source_environment: 'cosmoshub-4',
  chain_id: 'cosmoshub-4',
  chain_name: 'Cosmos Hub',
  bech32_prefix: 'cosmos',
  base_denom: 'uatom',           // micro-ATOM, 6 decimals
  asset_symbol: 'ATOM',
  registry_row: 479,
  mechanism: 'no-admin CosmWasm Commitment Vault (no migrate / no sudo entry)',
  rpc: 'https://rpc.cosmoshub-4.cosmoshq.app',
  rest: 'https://lcd-cosmoshub.cosmoshq.app',
  explorer_tx: 'https://www.mintscan.io/cosmos/tx/{txHash}',
  // The CosmWasm vault is undeployed source (src/cosmos-hub-vault/contracts/vault). No address exists yet.
  vault_contract_address: PENDING,
  gas_price: '0.025uatom',
};

// --- Permitted durations and multipliers (Master Spec §5.1, 16 entries) ---
// VF-COM-002: No intermediate duration or interpolated multiplier is permitted.
export const PERMITTED_DURATIONS = [
  { secs: 3600,     label: '1 hour — Trust-Building Handshake (1.0x)',         multiplier_bps: 10000,  role: 'Trust-Building Handshake' },
  { secs: 604800,   label: '7 days — Shortest standard (1.0x)',               multiplier_bps: 10000,  role: 'Shortest standard' },
  { secs: 2592000,  label: '30 days — Short (1.15x)',                          multiplier_bps: 11500,  role: 'Short' },
  { secs: 5184000,  label: '60 days — Short-to-medium (1.3x)',                 multiplier_bps: 13000,  role: 'Short-to-medium' },
  { secs: 7776000,  label: '90 days — Medium (1.5x)',                          multiplier_bps: 15000,  role: 'Medium' },
  { secs: 15552000, label: '180 days — Six-month (2.0x)',                      multiplier_bps: 20000,  role: 'Six-month' },
  { secs: 31536000, label: '365 days — One-year (2.5x)',                       multiplier_bps: 25000,  role: 'One-year' },
  { secs: 63072000, label: '730 days — Two-year (3.8x)',                       multiplier_bps: 38000,  role: 'Two-year' },
  { secs: 94608000, label: '1,095 days — Three-year (5.0x)',                   multiplier_bps: 50000,  role: 'Three-year' },
  { secs: 126144000,label: '1,460 days — Four-year (5.75x)',                  multiplier_bps: 57500,  role: 'Four-year' },
  { secs: 157680000,label: '1,825 days — Five-year (6.5x)',                   multiplier_bps: 65000,  role: 'Five-year' },
  { secs: 189216000,label: '2,190 days — Six-year (6.8x)',                    multiplier_bps: 68000,  role: 'Six-year' },
  { secs: 220752000,label: '2,555 days — Seven-year (7.1x)',                  multiplier_bps: 71000,  role: 'Seven-year' },
  { secs: 252288000,label: '2,920 days — Eight-year (7.4x)',                 multiplier_bps: 74000,  role: 'Eight-year' },
  { secs: 283824000,label: '3,285 days — Nine-year (7.7x)',                  multiplier_bps: 77000,  role: 'Nine-year' },
  { secs: 315360000,label: '3,650 days — Ten-year (8.0x)',                    multiplier_bps: 80000,  role: 'Ten-year' },
];
export const DURATION_HANDSHAKE = 3600;

// --- Fee basis points (verbatim from msg.rs) ---
export const FEE_BPS_HANDSHAKE = 250;   // 2.50%
export const FEE_BPS_STANDARD = 500;   // 5.00%

// --- Verified Gross USD value bounds, micro-USD (verbatim from msg.rs) ---
export const HANDSHAKE_USD_MIN_MICRO = 950000;    // $0.95
export const HANDSHAKE_USD_MAX_MICRO = 1050000;   // $1.05
export const STANDARD_USD_MIN_MICRO = 10000000;   // $10.00

// --- Handshake allowance for the Cosmos Hub persistent-state mechanism (msg.rs: 3) ---
export const HANDSHAKE_ALLOWANCE = 3;

// --- Base chain (EVM L2) recognition / issuance boundary ---
// GENUINELY MISSING: no Solidity source, no ABI, no IDL, and no deployed address for any
// BASE-* component (BASE-VERIFY / BASE-ISSUE / BASE-EMIT / BASE-TOK / BASE-FORGE / BASE-ACT /
// BASE-CAP) exists anywhere in the accessible workspace. These are described only as design
// responsibilities in Vinculum_Finalis_Architecture_Design.md. Inventing them is prohibited.
export const BASE_CHAIN = {
  name: 'Base',
  chain_id: NOT_PRESENT,        // no deployed system present
  rpc: NOT_PRESENT,
  vclm_address: PENDING,      // no deployed token contract
  chonx_address: PENDING,
  synth_address: PENDING,
  proof_verifier_address: PENDING,   // the recognition/minting entry point — does not exist
  proof_verifier_abi: NOT_PRESENT,    // no ABI exists; cannot construct a real call
  explorer_tx: 'https://basescan.org/tx/{txHash}',
};

// --- Approved asset registry ---
// The governing file `vinculum_finalis_approved_asset_registry.json` is referenced in the
// architecture doc as an external governing input but is NOT present in the workspace. Only the
// single asset identity actually present in the existing candidate data (ATOM / cosmoshub-4 /
// uatom) is exposed. The full 1,001-asset registry cannot drive selection because it is absent.
export const REGISTRY = {
  registry_file_present: false,
  governing_file_referenced: 'vinculum_finalis_approved_asset_registry.json',
  declared_total_assets: 1001,
  present_assets: [
    {
      row: 479,
      source_environment: 'cosmoshub-4',
      canonical_asset: 'uatom',
      symbol: 'ATOM',
      decimals: 6,
      custody_class: 'S3',
    },
  ],
};

export function isVaultDeployed() {
  return COSMOS_HUB.vault_contract_address !== PENDING;
}
export function isBaseVerifierPresent() {
  return BASE_CHAIN.proof_verifier_address !== PENDING && BASE_CHAIN.proof_verifier_abi !== NOT_PRESENT;
}