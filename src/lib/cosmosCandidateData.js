// base44-simulation — NON-PRODUCTION data module for the Cosmos Hub candidate.
// RED-TEAM / NON-PRODUCTION. This module backs the CosmosHubCandidate simulation page and does NOT
// drive any production protocol logic. It summarizes the CODA evidence status for display only.

export const COSMOS_HUB_CANDIDATE = {
  label: 'RED-TEAM / NON-PRODUCTION',
  verdict: 'CONDITIONALLY FEASIBLE — NOT FEASIBLE NOW',
  environment: {
    chain_id: 'cosmoshub-4',
    base_denom: 'uatom',
    asset: 'ATOM (S3)',
    bech32_prefix: 'cosmos',
    registry_row: 479,
    mechanism: 'no-admin CosmWasm Commitment Vault (no migrate / no sudo entry)',
  },
  versions: {
    gaia: 'v27.5.0',
    wasmd: 'v0.60.7 (edb607cb)',
    cosmos_sdk: 'v0.53.4',
    cometbft: 'v0.38.23 (live nodes report 0.38.22)',
    ibc_go: 'v10.7.0',
  },
  evidence: [
    { id: 'C1', name: 'Live permissionless params', status: 'pending', detail: 'chain-registry + 3 live LCDs confirm cosmoshub-4/uatom; CosmWasm active (code_id 1). Authoritative code_upload_access needs gRPC/CLI (REST route 501).' },
    { id: 'C2', name: 'No-admin / no-migrate / no-sudo immutability', status: 'resolved', detail: 'wasmd v0.60.7 source-verified: empty admin + no migrate/sudo entry = immutable vs all in-protocol actors incl. governance.' },
    { id: 'C3', name: 'Base-side ICS-23 / CometBFT proof path', status: 'partial', detail: 'Off-chain adapter skeleton tested 22/22; full validator-set commitment pending.' },
    { id: 'C4b', name: 'Fixed Dev Fund destination', status: 'pending', detail: 'Deferred external input (Section 8.2); non-production fixture until deployment gate.' },
    { id: 'C5', name: 'Cosmos Hub finality + pending-attempt', status: 'partial', detail: 'Defined (CometBFT commit + sequence-consumption invalidation); tested 22/22; live tx-validity verification pending.' },
    { id: 'C6', name: 'Exact version pins vs live node', status: 'pending', detail: 'Reconcile 0.38.22 vs 0.38.23; pin all commits against a live node.' },
    { id: 'C7', name: 'Pinned local Rust build/test', status: 'pending', detail: 'Rust workspace source complete; no toolchain in Base44 sandbox; reproduce under pinned toolchain.' },
  ],
  testResults: [
    { suite: 'cosmos-hub-proof-adapter (Node v20.20.2)', total: 22, passed: 22, failed: 0, executed: true },
    { suite: 'cosmos-hub-vault (Rust/CosmWasm)', total: null, passed: null, failed: null, executed: false, note: 'no Rust toolchain in this environment' },
  ],
  artifacts: [
    'cosmos_hub_coda/COSMOS_HUB_FEASIBILITY_REPORT.md',
    'cosmos_hub_coda/COSMOS_HUB_REQUIREMENT_MATRIX.csv',
    'cosmos_hub_coda/COSMOS_HUB_OFFICIAL_EVIDENCE.json',
    'cosmos_hub_coda/COSMOS_HUB_THREAT_MODEL.md',
    'cosmos_hub_coda/COSMOS_HUB_BUILD_AND_TEST_REPORT.md',
    'cosmos_hub_coda/COSMOS_HUB_SOURCE_MANIFEST.json',
  ],
  download: 'public/vinculum-finalis-cosmos-hub-clean-room.zip',
};