// Which source environments are part of the deployment planned for 2026-10-21.
//
// Solana is not part of this deployment: no Solana reader is registered in the
// Base ceremony, so a Solana lock could never be verified or minted. The app
// keeps the Solana code (vfSolanaProgram.js mirrors the Rust program and is not
// changed) but does not offer Solana for a new lock, and the Solana lock
// engine and mock adapter refuse to build or submit one (fail closed).

export const NOT_IN_THIS_DEPLOYMENT = Object.freeze(['Solana']);

export const NOT_IN_THIS_DEPLOYMENT_LABEL = 'Not part of this deployment';

export const SOLANA_NOT_DEPLOYED_MESSAGE =
  'VF-DEP-SOL: Solana is not part of this deployment. No Solana reader is registered, so a Solana lock cannot be built or submitted.';

export function isInThisDeployment(envId) {
  return !NOT_IN_THIS_DEPLOYMENT.includes(String(envId ?? '').trim());
}

// False for this deployment. The Solana lock engine, mock adapter and
// instruction builder check it and refuse.
export const SOLANA_LOCKS_ENABLED = isInThisDeployment('Solana');
