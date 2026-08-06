// =============================================================================
// BASE-QNORM + BASE-REG — Immutable Asset-Precision Table & Environment Registry
//
// PROVENANCE: Built directly from Revision 6 authoritative documents:
//   - Vinculum_Finalis_Protocol_Constants.json (Revision 6, 2026-07-28)
//   - Vinculum_Finalis_Architecture_Design.md (Section C — 17 environments; Section P — precision)
//   - Vinculum_Finalis_Requirement_Traceability.csv
//
// This module is the Base-chain on-chain immutable table that BASE-VERIFY reads
// to resolve asset precision (never from User/relayer) and environment metadata.
// It is the chain-agnostic interface: every source environment normalizes into
// the same (environment_id, canonical_asset, precision, custody_class) tuple.
//
// VF-ORC-001/002: The registry also supplies pricing_identifier (CoinGecko ID)
// and contract address (for DexScreener) so the price cascade can resolve a
// USD reference rate. This eliminates any parallel pricing-identifier table —
// the registry is the single source of truth for asset metadata.
// =============================================================================

import { ASSET_CLASS_MULTIPLIERS_BPS } from './vfRevision6Authority';

// ---------------------------------------------------------------------------
// VF-XCH-001/002/003: 17 supported source environments
// Each entry carries the environment identity, family, Handshake allowance
// (determined by source-mechanism state capability — Q.2), and finality model.
// `registryName` is the display name used by the Approved Asset Registry and the
// price cascade (DexScreener/GeckoTerminal chain mapping).
// Canonical chain identifiers are DEFERRED EXTERNAL INPUT (VF-XCH-003) where
// not present in the governing constants.
// ---------------------------------------------------------------------------

export const ENVIRONMENTS = [
  // --- EVM family (7) — 3-use Handshake, source-enforced ---
  { id: 'Ethereum',  family: 'EVM',  registryName: 'Ethereum',       handshakeAllowance: 3, handshakeEnforcement: 'source', finality: 'PoS finalized', verificationStatus: 'DESIGN_DEFINED' },
  { id: 'BNB',       family: 'EVM',  registryName: 'BNB Smart Chain', handshakeAllowance: 3, handshakeEnforcement: 'source', finality: 'FFF',            verificationStatus: 'DESIGN_DEFINED' },
  { id: 'Avalanche', family: 'EVM',  registryName: 'Avalanche',      handshakeAllowance: 3, handshakeEnforcement: 'source', finality: 'Snowman',        verificationStatus: 'DESIGN_DEFINED' },
  { id: 'Polygon',   family: 'EVM',  registryName: 'Polygon',        handshakeAllowance: 3, handshakeEnforcement: 'source', finality: 'Heimdall v2',   verificationStatus: 'DESIGN_DEFINED' },
  { id: 'Arbitrum',  family: 'EVM',  registryName: 'Arbitrum',       handshakeAllowance: 3, handshakeEnforcement: 'source', finality: 'Optimistic',    verificationStatus: 'DESIGN_DEFINED' },
  { id: 'Base',      family: 'EVM',  registryName: 'Base',           handshakeAllowance: 3, handshakeEnforcement: 'source', finality: 'OP Stack',       verificationStatus: 'RESOLVED_SAME_CHAIN' },
  { id: 'Optimism',  family: 'EVM',  registryName: 'Optimism',       handshakeAllowance: 3, handshakeEnforcement: 'source', finality: 'OP Stack',       verificationStatus: 'DESIGN_DEFINED' },
  // --- Non-EVM programmable (1) — 3-use, source-enforced ---
  { id: 'Solana',    family: 'Non-EVM', registryName: 'Solana', handshakeAllowance: 3, handshakeEnforcement: 'source', finality: 'finalized slot',  verificationStatus: 'DESIGN_DEFINED' },
  // --- Non-EVM UTXO family (6) — 1-use per canonical release public key, Base-enforced ---
  { id: 'Bitcoin',     family: 'UTXO', registryName: 'Bitcoin',      handshakeAllowance: 1, handshakeEnforcement: 'base', finality: 'depth>=6',     verificationStatus: 'DESIGN_DEFINED' },
  { id: 'Litecoin',    family: 'UTXO', registryName: 'Litecoin',     handshakeAllowance: 1, handshakeEnforcement: 'base', finality: 'depth>=6',     verificationStatus: 'DESIGN_DEFINED' },
  { id: 'Dogecoin',    family: 'UTXO', registryName: 'Dogecoin',      handshakeAllowance: 1, handshakeEnforcement: 'base', finality: 'depth>=6',     verificationStatus: 'DESIGN_DEFINED' },
  { id: 'DigiByte',    family: 'UTXO', registryName: 'DigiByte',      handshakeAllowance: 1, handshakeEnforcement: 'base', finality: 'depth>=6',     verificationStatus: 'DESIGN_DEFINED' },
  { id: 'Zcash',       family: 'UTXO', registryName: 'Zcash',         handshakeAllowance: 1, handshakeEnforcement: 'base', finality: 'depth>=10',    verificationStatus: 'DESIGN_DEFINED' },
  { id: 'BitcoinCash', family: 'UTXO', registryName: 'Bitcoin Cash',  handshakeAllowance: 1, handshakeEnforcement: 'base', finality: 'depth>=6',     verificationStatus: 'DESIGN_DEFINED' },
  // --- Non-EVM account-model (2) — 1-use per account (unless deployable stateful), Base-enforced ---
  { id: 'XRPL',        family: 'XRPL',   registryName: 'XRP Ledger', handshakeAllowance: 1, handshakeEnforcement: 'base', finality: 'validated ledger', verificationStatus: 'DESIGN_DEFINED' },
  { id: 'Stellar',     family: 'Stellar', registryName: 'Stellar',   handshakeAllowance: 1, handshakeEnforcement: 'base', finality: 'SCP closed',      verificationStatus: 'DESIGN_DEFINED' },
  // --- Non-EVM CometBFT (1) — supported environment (VF-XCH-001; one of 17), held in
  //     EVIDENCE REQUIRED — CHAIN-NATIVE FEASIBILITY ANALYSIS INCOMPLETE per governing spec
  //     (Architecture Design §C.12 / §Q.5). Source mechanism, preflight, and Handshake
  //     allowance are pending CODA's complete six-step analysis; finality (CometBFT) and
  //     principal release are RESOLVED. This is a spec-defined evidence status, NOT an
  //     owner-decision/exclusion (§Q.5: a governance summary is not the required evidence;
  //     OWNER DECISION is reserved for when the complete analysis shows no design works).
  //     The verifier gates proofs at Step 3 until a mechanism is established. Do not clear
  //     these values without resolving the six-step feasibility conditionals.
  { id: 'CosmosHub',   family: 'CometBFT', registryName: 'Cosmos', handshakeAllowance: null, handshakeEnforcement: 'dependent', finality: 'CometBFT instant', verificationStatus: 'EVIDENCE_REQUIRED' },
];

export const ENVIRONMENT_COUNT = ENVIRONMENTS.length; // 17

// Lookup by environment id
export function findEnvironment(envId) {
  return ENVIRONMENTS.find((e) => e.id === envId) || null;
}

// ---------------------------------------------------------------------------
// BASE-QNORM: Immutable asset-precision table (Section P)
// Key = `${environmentId}/${canonicalAssetId}`
// Precision is NEVER supplied by User/relayer — always from this table.
// custodyClass drives the asset multiplier (S1=1.5x, S2=1.3x, S3=1.0x).
//
// VF-ORC-001/002: pricing_identifier (CoinGecko coin ID) and contract (ERC-20
// contract address for DexScreener fallback) are sourced from the Approved
// Asset Registry. For native assets, contract is null — CoinGecko resolves by
// pricing_identifier alone.
// ---------------------------------------------------------------------------

export const ASSET_PRECISION_TABLE = {
  // --- EVM native assets (Section P) ---
  'Ethereum/native-ETH':  { symbol: 'ETH',  decimals: 18, custodyClass: 'S2', custodyPath: 'native', pricing_identifier: 'ethereum',  contract: null },
  'BNB/native-BNB':       { symbol: 'BNB',  decimals: 18, custodyClass: 'S2', custodyPath: 'native', pricing_identifier: 'binancecoin', contract: null },
  'Avalanche/native-AVAX':{ symbol: 'AVAX', decimals: 18, custodyClass: 'S2', custodyPath: 'native', pricing_identifier: 'avalanche-2', contract: null },
  'Polygon/native-POL':   { symbol: 'POL',  decimals: 18, custodyClass: 'S2', custodyPath: 'native', pricing_identifier: 'matic-network', contract: null },
  'Arbitrum/native-ETH':  { symbol: 'ETH',  decimals: 18, custodyClass: 'S2', custodyPath: 'native', pricing_identifier: 'ethereum',  contract: null },
  'Base/native-ETH':      { symbol: 'ETH',  decimals: 18, custodyClass: 'S2', custodyPath: 'native', pricing_identifier: 'ethereum',  contract: null },
  'Optimism/native-ETH':  { symbol: 'ETH',  decimals: 18, custodyClass: 'S2', custodyPath: 'native', pricing_identifier: 'ethereum',  contract: null },

  // --- EVM canonical tokens (S1 class — USDC/USDT) ---
  'Ethereum/USDC':        { symbol: 'USDC', decimals: 6,  custodyClass: 'S1', custodyPath: 'token', pricing_identifier: 'usd-coin',  contract: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
  'Ethereum/USDT':        { symbol: 'USDT', decimals: 6,  custodyClass: 'S1', custodyPath: 'token', pricing_identifier: 'tether',    contract: '0xdAC17F958D2ee523a2206206994597C13D831ec7' },

  // --- EVM canonical tokens (S2 class — AAVE/LINK/UNI) ---
  'Ethereum/AAVE':        { symbol: 'AAVE', decimals: 18, custodyClass: 'S2', custodyPath: 'token', pricing_identifier: 'aave',     contract: '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9' },
  'Ethereum/LINK':        { symbol: 'LINK', decimals: 18, custodyClass: 'S2', custodyPath: 'token', pricing_identifier: 'chainlink', contract: '0x514910771af9ca656af840dff83e8264ecf986ca' },
  'Ethereum/UNI':         { symbol: 'UNI',  decimals: 18, custodyClass: 'S2', custodyPath: 'token', pricing_identifier: 'uniswap',  contract: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984' },

  // --- Solana native ---
  'Solana/native-SOL':    { symbol: 'SOL', decimals: 9,  custodyClass: 'S3', custodyPath: 'native', pricing_identifier: 'solana',  contract: null },

  // --- XRPL native ---
  'XRPL/native-XRP':      { symbol: 'XRP', decimals: 6,  custodyClass: 'S3', custodyPath: 'native', pricing_identifier: 'ripple',   contract: null },

  // --- Stellar native ---
  'Stellar/native-XLM':   { symbol: 'XLM', decimals: 7,  custodyClass: 'S3', custodyPath: 'native', pricing_identifier: 'stellar',  contract: null },

  // --- Cosmos Hub native ---
  'CosmosHub/native-uatom':{ symbol: 'ATOM', decimals: 6, custodyClass: 'S3', custodyPath: 'native', pricing_identifier: 'cosmos',  contract: null },

  // --- UTXO family native (all 10^8) ---
  'Bitcoin/native-BTC':      { symbol: 'BTC',  decimals: 8, custodyClass: 'S2', custodyPath: 'native', pricing_identifier: 'bitcoin',       contract: null },
  'Litecoin/native-LTC':     { symbol: 'LTC',  decimals: 8, custodyClass: 'S3', custodyPath: 'native', pricing_identifier: 'litecoin',      contract: null },
  'Dogecoin/native-DOGE':    { symbol: 'DOGE', decimals: 8, custodyClass: 'S3', custodyPath: 'native', pricing_identifier: 'dogecoin',      contract: null },
  'DigiByte/native-DGB':     { symbol: 'DGB',  decimals: 8, custodyClass: 'S3', custodyPath: 'native', pricing_identifier: 'digibyte',       contract: null },
  'Zcash/native-ZEC':        { symbol: 'ZEC',  decimals: 8, custodyClass: 'S3', custodyPath: 'native', pricing_identifier: 'zcash',          contract: null },
  'BitcoinCash/native-BCH':  { symbol: 'BCH',  decimals: 8, custodyClass: 'S3', custodyPath: 'native', pricing_identifier: 'bitcoin-cash',   contract: null },
};

export function findAssetPrecision(environmentId, canonicalAssetId) {
  const key = `${environmentId}/${canonicalAssetId}`;
  return ASSET_PRECISION_TABLE[key] || null;
}

// ---------------------------------------------------------------------------
// VF-ORC-001/002: Pricing info lookup — the registry is the SINGLE source of
// truth for pricing_identifier and contract address. No parallel table.
// Returns { symbol, pricing_identifier, contract, registryName, decimals,
//           custodyClass } or null if the asset is not in the registry.
// ---------------------------------------------------------------------------

export function getAssetPricingInfo(environmentId, canonicalAssetId) {
  const env = findEnvironment(environmentId);
  const asset = findAssetPrecision(environmentId, canonicalAssetId);
  if (!env || !asset) return null;
  return {
    symbol: asset.symbol,
    pricing_identifier: asset.pricing_identifier || null,
    contract: asset.contract || null,
    registryName: env.registryName,
    decimals: asset.decimals,
    custodyClass: asset.custodyClass,
  };
}

// Asset class multiplier lookup (Section P)
export function getAssetMultiplierBps(custodyClass) {
  return ASSET_CLASS_MULTIPLIERS_BPS[custodyClass] || ASSET_CLASS_MULTIPLIERS_BPS.S3;
}

// ---------------------------------------------------------------------------
// BASE-VERIFY: Dev Fund destination registry (VF-FEE-004/009)
// Per-environment fixed destinations. DEPLOYMENT INPUT — provisioned for the
// private preview. VF-FEE-009 requires a fixed receive address per environment;
// it does NOT require uniqueness across environments, so the 7 EVM environments
// legitimately share a single EVM address (identical 0x address space).
// CosmosHub remains PENDING_DEPLOYMENT: handshake allowance is null
// (EVIDENCE_REQUIRED), so the verifier rejects its proofs and no fees route
// there — a functioning preview does not require a CosmosHub Dev Fund address.
// ---------------------------------------------------------------------------

const EVM_DEV_FUND_ADDRESS = '0xD667644052eceF4118eFa34ea4381053a435b252';

export const DEV_FUND_DESTINATIONS = {
  // --- EVM family (7) — shared 0x address (valid on all EVM chains) ---
  Ethereum:  EVM_DEV_FUND_ADDRESS,
  BNB:       EVM_DEV_FUND_ADDRESS,
  Avalanche: EVM_DEV_FUND_ADDRESS,
  Polygon:   EVM_DEV_FUND_ADDRESS,
  Arbitrum:  EVM_DEV_FUND_ADDRESS,
  Base:      EVM_DEV_FUND_ADDRESS,
  Optimism:  EVM_DEV_FUND_ADDRESS,
  // --- Solana (base58) ---
  Solana: 'Dserz9cjpCDQH9HRsfjU7b7EJxCGoULLNBEQ3PiFgCdi',
  // --- UTXO family (6) — distinct per-chain address encodings ---
  Bitcoin:     'bc1qgf9h8m2fxeu66z9pq7dxgczuz5c4y52pek9jcu',
  Litecoin:    'ltc1qrjukwktjcyq84zseq7mkwgg7vd2atkv6gnyagh',
  Dogecoin:    'D8LkDKudBwvFs9Jwg6Hq2RSb63Z7uwkk9h',
  DigiByte:    'dgb1q6wznekwjk5fgtcyqgpj54hsh4g9qg92ccgnm3l',
  Zcash:       't1SgXBjwm5UShkP2FasQmWfR4DmH1XQVy7H',
  BitcoinCash: 'qr4ywpp0q393ur0wpng6rwdlz9n6mp90hgp9d6tx84',
  // --- XRPL (r-address) ---
  XRPL: 'raNwavDEycJ8XtAN71eezNMM6fQbMh1rJt',
  // --- Stellar (G-address) ---
  Stellar: 'GAN5TFL7YMDL6Z7WEDVRTDFTERFA5YASYJYXOTLEVOAKUMRIMZZMAZDL',
  // --- CosmosHub — EVIDENCE_REQUIRED (mechanism incomplete); no address required for preview ---
  CosmosHub: null,
};

export function isDevFundConfigured(environmentId) {
  return DEV_FUND_DESTINATIONS[environmentId] != null;
}