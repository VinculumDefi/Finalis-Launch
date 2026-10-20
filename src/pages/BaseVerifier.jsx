import React, { useState, useRef } from 'react';
import { ShieldCheck, FlaskConical, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AUTHORITY, SCALE, COMMITMENT_DURATIONS, TOKEN_HARD_CAPS, CHONX_ACTIVATION_THRESHOLD } from '@/lib/vfRevision6Authority';
import { VerifierState, verifyProof } from '@/lib/vfVerifierEngine';
import { normalizeSolanaEvidence, normalizeXrplEvidence, normalizeUtxoEvidence, normalizeStellarEvidence, normalizeEvmEvidence } from '@/lib/vfProofNormalizer';
import { buildMockEvent, buildFinalityProof } from '@/lib/vfMockEventBuilder';
import VerifierArchitecture from '@/components/base/VerifierArchitecture';
import ProofPackageViewer from '@/components/base/ProofPackageViewer';
import VerificationFlow from '@/components/base/VerificationFlow';
import ChainVerifierPanel from '@/components/base/ChainVerifierPanel';
import PendingAttemptPanel from '@/components/base/PendingAttemptPanel';
import { PendingAttemptLifecycle } from '@/lib/vfPendingAttemptLifecycle';
import { isOfferableEnvironmentNative, isOfferablePackageAsset, NOT_ACTIVE_MESSAGE } from '@/lib/vfActiveAssetAllowlist';
import { isInThisDeployment } from '@/lib/vfDeploymentScope';
import { hasUtxoMinimum, NO_FRESH_PRICE_MESSAGE, isUtxoHandshake, checkUtxoHandshakeLock, utxoHandshakeNote } from '@/lib/vfUtxoMinimumLock';

// Only environments whose simulated native asset is on the active list are offered
// (Revision B + on-chain verification). Solana is not part of this deployment
// and is not offered for new locks.
const ENV_GROUPS = [
  { label: 'EVM (3-use, source-enforced)', envs: ['Ethereum', 'BNB', 'Avalanche', 'Polygon', 'Arbitrum', 'Base', 'Optimism'] },
  { label: 'UTXO (1-use, Base-enforced)', envs: ['Bitcoin', 'Litecoin', 'Dogecoin', 'DigiByte', 'Zcash', 'BitcoinCash'] },
  { label: 'Account-model (1-use, Base-enforced)', envs: ['XRPL', 'Stellar'] },
].map((g) => ({ ...g, envs: g.envs.filter((e) => isInThisDeployment(e) && isOfferableEnvironmentNative(e)) })).filter((g) => g.envs.length);

function parseUsdToFixedPoint(usdStr) {
  if (!usdStr) return 0n;
  const parts = usdStr.trim().split('.');
  const intPart = (parts[0] || '0').replace(/^0+/, '') || '0';
  const frac = (parts[1] || '').padEnd(18, '0').slice(0, 18);
  return BigInt(intPart + frac);
}

export default function BaseVerifier() {
  const stateRef = useRef(new VerifierState());
  const state = stateRef.current;
  const lifecycleRef = useRef(new PendingAttemptLifecycle());
  const lifecycle = lifecycleRef.current;

  const [env, setEnv] = useState('Ethereum');
  const [verifiedUsd, setVerifiedUsd] = useState('10.00');
  const [daysSinceLaunch, setDaysSinceLaunch] = useState('0');
  const [duration, setDuration] = useState(604800);
  const [outputToken, setOutputToken] = useState('VCLM');
  const [result, setResult] = useState(null);
  const [pkg, setPkg] = useState(null);
  const [, setLifecycleVersion] = useState(0);

  function bumpLifecycle() { setLifecycleVersion((v) => v + 1); }

  function buildAndVerify() {
    const usdMicro = parseUsdToFixedPoint(verifiedUsd);
    const finalityProof = buildFinalityProof(env);
    const mock = buildMockEvent(env, duration, outputToken);

    let rawPkg;
    if (mock.type === 'solana') rawPkg = normalizeSolanaEvidence(mock.event, finalityProof);
    else if (mock.type === 'xrpl') rawPkg = normalizeXrplEvidence(mock.event.escrow, mock.event.payment, finalityProof);
    else if (mock.type === 'utxo') rawPkg = normalizeUtxoEvidence(env, mock.event, finalityProof);
    else if (mock.type === 'stellar') rawPkg = normalizeStellarEvidence(mock.event, finalityProof);
    else rawPkg = normalizeEvmEvidence(env, mock.event, finalityProof);

    if (!rawPkg.ok) {
      setResult({ ok: false, decision: 'NORMALIZE_FAILED', checks: [], reason: rawPkg.errors.join('; ') });
      setPkg(null);
      return;
    }

    // Active asset list: refuse a package whose asset is not offerable, however it was entered.
    if (!isOfferablePackageAsset(rawPkg.package.source_environment_id, rawPkg.package.canonical_asset_id)) {
      setResult({ ok: false, decision: 'NOT_ON_ACTIVE_LIST', checks: [], reason: NOT_ACTIVE_MESSAGE });
      setPkg(null);
      return;
    }

    // Minimum lock (t230u): a standard Bitcoin, Bitcoin Cash or Litecoin lock must be
    // checked against $20 / $1 / $1 with a fresh price. This page has only a typed
    // USD value and no fresh price, so it refuses (Token Layer with live prices checks it).
    if (hasUtxoMinimum(env) && Number(duration) !== 3600) {
      setResult({ ok: false, decision: 'MINIMUM_NOT_CHECKED', checks: [], reason: NO_FRESH_PRICE_MESSAGE });
      setPkg(null);
      return;
    }
    // Handshake (t239u): on these three chains a Handshake is a set coin amount (unit
    // band, same as the verifier and lock.py), checked here with no price. The typed USD
    // value is counted as at most $0.02 for VCLM and RAC by the engine.
    if (isUtxoHandshake(env, duration, rawPkg.package.canonical_asset_id)) {
      const band = checkUtxoHandshakeLock({ env, grossSmallestUnits: rawPkg.package.gross_amount_smallest_units });
      if (!band.ok) {
        setResult({ ok: false, decision: 'HANDSHAKE_OUTSIDE_BAND', checks: [], reason: band.reason });
        setPkg(null);
        return;
      }
    }

    setPkg(rawPkg.package);
    const r = verifyProof(state, rawPkg.package, {
      verifiedGrossUsdMicro: usdMicro.toString(),
      daysSinceLaunch: Number(daysSinceLaunch),
    });
    setResult(r);

    // Bridge to Pending Attempt Lifecycle: auto-confirm matching attempt on success
    if (r.ok && lifecycle.getAttempt(rawPkg.package.commitment_vault_lock_id)) {
      lifecycle.confirmAttempt(rawPkg.package.commitment_vault_lock_id);
      bumpLifecycle();
    }
  }

  function reset() {
    state.reset();
    lifecycle.reset();
    setResult(null);
    setPkg(null);
  }

  function handleRegisterAttempt(envId, handshakeIdentity, lockId, ts) {
    const r = lifecycle.registerAttempt(envId, handshakeIdentity, lockId, ts);
    bumpLifecycle();
    return r;
  }

  function handleConfirmAttempt(lockId) {
    const r = lifecycle.confirmAttempt(lockId);
    bumpLifecycle();
    return r;
  }

  function handleResolveAttempt(lockId, disposition) {
    const r = lifecycle.resolveFailedAttempt(lockId, disposition);
    bumpLifecycle();
    return r;
  }

  return (
    <div className="min-h-screen bg-[#fafaf8] text-[#0a0a0a]">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <header className="space-y-1">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-[#18324b]" />
            <h1 className="text-2xl font-bold text-[#18324b]">Base-Side Verification & Minting Contract</h1>
          </div>
          <p className="text-sm text-[#6b6b65]">
            The canonical verifier (BASE-VERIFY) — chain-agnostic recognition boundary.
            Accepts normalized ProofPackages from all 16 source environments and performs
            protocol verification before minting VCLM/CHONX.
          </p>
        </header>

        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
          <strong>AWAITING DEPLOYMENT.</strong> The Solidity contracts and per-environment chain verifiers are
          written — on-chain deployment and DEPLOYABILITY EVIDENCE are REQUIRED (Section O). No token contracts,
          Dev Fund addresses, or canonical chain identifiers are deployed. This interface exercises the off-chain
          verification engine which mirrors the on-chain logic, including real per-environment finality dispatch
          and independent fact cross-checking.
        </div>

        <VerifierArchitecture />

        <section className="rounded-lg border border-[#18324b]/20 bg-white p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-[#18324b]" />
              <h2 className="text-sm font-semibold text-[#18324b]">Verification Test Harness</h2>
            </div>
            <Button size="sm" variant="ghost" onClick={reset} className="text-[#6b6b65]">
              <RotateCcw className="w-3 h-3 mr-1" />Reset
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs space-y-1">
              <span className="text-[#6b6b65]">Source Environment</span>
              <select value={env} onChange={(e) => setEnv(e.target.value)} className="w-full border border-[#18324b]/20 rounded px-2 py-1 text-sm">
                {ENV_GROUPS.map((g) => (
                  <optgroup key={g.label} label={g.label}>{g.envs.map((e) => <option key={e}>{e}</option>)}</optgroup>
                ))}
              </select>
            </label>
            <label className="text-xs space-y-1">
              <span className="text-[#6b6b65]">Duration</span>
              <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="w-full border border-[#18324b]/20 rounded px-2 py-1 text-sm">
                {COMMITMENT_DURATIONS.map((d) => <option key={d.secs} value={d.secs}>{d.label} ({d.multiplier_bps / 100}x)</option>)}
              </select>
            </label>
            <label className="text-xs space-y-1">
              <span className="text-[#6b6b65]">Verified Gross USD</span>
              <input type="text" value={verifiedUsd} onChange={(e) => setVerifiedUsd(e.target.value)} className="w-full border border-[#18324b]/20 rounded px-2 py-1 text-sm font-mono" />
            </label>
            <label className="text-xs space-y-1">
              <span className="text-[#6b6b65]">Output Token</span>
              <select value={outputToken} onChange={(e) => setOutputToken(e.target.value)} className="w-full border border-[#18324b]/20 rounded px-2 py-1 text-sm">
                <option>VCLM</option><option>CHONX</option>
              </select>
            </label>
            <label className="text-xs space-y-1">
              <span className="text-[#6b6b65]">Days Since Launch</span>
              <input type="text" value={daysSinceLaunch} onChange={(e) => setDaysSinceLaunch(e.target.value)} className="w-full border border-[#18324b]/20 rounded px-2 py-1 text-sm font-mono" />
            </label>
            <div className="flex items-end">
              <Button onClick={buildAndVerify} className="w-full bg-[#18324b] text-white hover:bg-[#18324b]/90">
                <ShieldCheck className="w-4 h-4 mr-1" />Verify & Mint
              </Button>
            </div>
          </div>
          {isUtxoHandshake(env, duration) && (
            <p className="text-xs text-[#6b6b65] leading-relaxed">{utxoHandshakeNote(env)}</p>
          )}
        </section>

        {pkg && <ProofPackageViewer pkg={pkg} />}
        {result && <VerificationFlow result={result} />}

        <ChainVerifierPanel />

        <PendingAttemptPanel
          lifecycle={lifecycle}
          onRegister={handleRegisterAttempt}
          onConfirm={handleConfirmAttempt}
          onResolve={handleResolveAttempt}
        />

        <footer className="text-xs text-[#6b6b65] space-y-1 pb-8">
          <p>Authority: {AUTHORITY.revision} ({AUTHORITY.revision_date}). Governing source SHA-256: {AUTHORITY.governing_source_sha256.slice(0, 16)}…</p>
          <p>Off-chain engine mirrors the on-chain Solidity verifier. 16 per-environment chain verifiers are implemented (off-chain); on-chain Solidity contracts are written but not compiled/deployed. No live token contracts, Dev Fund addresses, or canonical chain identifiers are deployed. Pending Attempt Lifecycle engine (VF-COM-007/008) tracks in-flight identity reservations with chain-native terminal dispositions only.</p>
          <p>VCLM cap: {(Number(TOKEN_HARD_CAPS.VCLM / SCALE)).toLocaleString()} · CHONX cap: {(Number(TOKEN_HARD_CAPS.CHONX / SCALE)).toLocaleString()} · CHONX activates at: {(Number(CHONX_ACTIVATION_THRESHOLD / SCALE)).toLocaleString()} VCLM</p>
        </footer>
      </div>
    </div>
  );
}