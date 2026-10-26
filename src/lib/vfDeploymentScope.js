// Which source environments are part of this deployment.
//
// Base-only launch (operator decision t430u item 2, 2026-10-26): Base is the
// only active environment. Every other chain is left out of the active user
// interface: no picker offers it and no lock or proof package for it is
// accepted. The code and research for the other chains are kept (the Solana,
// XRPL, UTXO and other EVM modules are not deleted) but are not reachable
// from the app's pages for a new lock.
//
// Solana was already out of the deployment: no Solana reader is registered in
// the Base ceremony. The Solana lock engine and mock adapter refuse to build
// or submit a lock (fail closed). The XRPL lock page shows the same notice.

export const ACTIVE_ENVIRONMENTS = Object.freeze(['Base']);

// Every app environment that is not part of this deployment.
export const NOT_IN_THIS_DEPLOYMENT = Object.freeze([
  'Ethereum', 'BNB', 'Avalanche', 'Polygon', 'Arbitrum', 'Optimism',
  'Bitcoin', 'Litecoin', 'Dogecoin', 'DigiByte', 'Zcash', 'BitcoinCash',
  'XRPL', 'Stellar', 'Solana',
]);

export const NOT_IN_THIS_DEPLOYMENT_LABEL = 'Not part of this deployment';

export const SOLANA_NOT_DEPLOYED_MESSAGE =
  'VF-DEP-SOL: Solana is not part of this deployment. No Solana reader is registered, so a Solana lock cannot be built or submitted.';

export const XRPL_NOT_DEPLOYED_MESSAGE =
  'VF-DEP-BASE: XRPL is not part of this deployment, which is Base only. An XRPL lock cannot be built or submitted.';

export const BASE_ONLY_MESSAGE =
  'VF-DEP-BASE: this deployment is Base only. Other chains are not offered.';

const ALIASES = { 'XRP Ledger': 'XRPL', 'BNB Smart Chain': 'BNB', 'Bitcoin Cash': 'BitcoinCash' };

export function isInThisDeployment(envId) {
  const s = String(envId ?? '').trim();
  return ACTIVE_ENVIRONMENTS.includes(ALIASES[s] || s);
}

// False for this deployment. The Solana lock engine, mock adapter and
// instruction builder check it and refuse.
export const SOLANA_LOCKS_ENABLED = isInThisDeployment('Solana');

// False for this deployment. The XRPL lock page checks it and refuses.
export const XRPL_LOCKS_ENABLED = isInThisDeployment('XRPL');
