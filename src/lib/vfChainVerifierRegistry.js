// =============================================================================
// PER-ENVIRONMENT CHAIN VERIFIER REGISTRY (Section O)
//
// PROVENANCE: Built from Revision 6:
//   - Vinculum_Finalis_Architecture_Design.md (Section O — per-environment verifiers)
//   - Vinculum_Finalis_Protocol_Constants.json (17 environments, finality models)
//
// VF-XCH-006: Source finality gate — dispatches to the correct IChainVerifier.
// VF-XCH-010: Finality must be objective (chain-native evidence, not timers/mempool).
// VF-XCH-011: Immutable facts extracted independently from the raw lock event proof.
//
// 16 environments have registered verifiers. Cosmos Hub (EVIDENCE_REQUIRED) is
// intentionally unregistered — the verifier engine rejects it before finality.
// =============================================================================

import { findEnvironment } from './vfBaseRegistry';
import { EvmChainVerifier } from './vfEvmChainVerifier';
import { SolanaChainVerifier } from './vfSolanaChainVerifier';
import { UtxoChainVerifier } from './vfUtxoChainVerifier';
import { XrplChainVerifier } from './vfXrplChainVerifier';
import { StellarChainVerifier } from './vfStellarChainVerifier';

// EVM family — per-environment finality configuration (Section C)
const EVM_CONFIGS = {
  Ethereum:  { finalityModel: 'PoS finalized', minConfirmations: null, challengePeriodBlocks: null },
  BNB:       { finalityModel: 'FFF',            minConfirmations: 2,    challengePeriodBlocks: null },
  Avalanche: { finalityModel: 'Snowman',        minConfirmations: null, challengePeriodBlocks: null },
  Polygon:   { finalityModel: 'Heimdall v2',    minConfirmations: null, challengePeriodBlocks: null },
  Arbitrum:  { finalityModel: 'Optimistic',     minConfirmations: null, challengePeriodBlocks: 604800 },
  Base:      { finalityModel: 'OP Stack',       minConfirmations: null, challengePeriodBlocks: null, sameChain: true },
  Optimism:  { finalityModel: 'OP Stack',       minConfirmations: null, challengePeriodBlocks: 604800 },
};

// UTXO family — per-environment confirmation depth
// Bitcoin=6 and Zcash=10 are defined in protocol constants.
// Litecoin, Dogecoin, DigiByte, BitcoinCash: exact N is DEFERRED EXTERNAL INPUT.
const UTXO_CONFIGS = {
  Bitcoin:     { minConfirmations: 6 },
  Litecoin:    { minConfirmations: null },
  Dogecoin:    { minConfirmations: null },
  DigiByte:    { minConfirmations: null },
  Zcash:       { minConfirmations: 10 },
  BitcoinCash: { minConfirmations: null },
};

const verifiers = new Map();

for (const [envId, config] of Object.entries(EVM_CONFIGS)) {
  verifiers.set(envId, new EvmChainVerifier(envId, config));
}
verifiers.set('Solana', new SolanaChainVerifier());
for (const [envId, config] of Object.entries(UTXO_CONFIGS)) {
  verifiers.set(envId, new UtxoChainVerifier(envId, config));
}
verifiers.set('XRPL', new XrplChainVerifier());
verifiers.set('Stellar', new StellarChainVerifier());

export function getChainVerifier(environmentId) {
  return verifiers.get(environmentId) || null;
}

export function isVerifierRegistered(environmentId) {
  return verifiers.has(environmentId);
}

export function getRegisteredEnvironments() {
  return Array.from(verifiers.keys());
}

export function dispatchFinalityCheck(environmentId, lockEventProof, sourceFinalityProof) {
  const verifier = getChainVerifier(environmentId);
  if (!verifier) {
    const env = findEnvironment(environmentId);
    if (env && env.verificationStatus === 'EVIDENCE_REQUIRED') {
      return { ok: false, reason: `VF-ARC-002: environment "${environmentId}" mechanism incomplete (EVIDENCE REQUIRED)` };
    }
    return { ok: false, reason: `VF-XCH-006: no chain verifier registered for "${environmentId}"` };
  }
  return verifier.verifyFinality(lockEventProof, sourceFinalityProof);
}

export function dispatchFactExtraction(environmentId, lockEventProof) {
  const verifier = getChainVerifier(environmentId);
  if (!verifier) {
    return { ok: false, reason: `VF-XCH-011: no chain verifier for fact extraction ("${environmentId}")` };
  }
  return verifier.extractFacts(lockEventProof);
}