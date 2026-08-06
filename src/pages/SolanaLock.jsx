import React, { useState, useMemo, useRef } from 'react';
import { FileText, Lock, ScrollText } from 'lucide-react';
import ProvenanceBanner from '@/components/solana/ProvenanceBanner';
import ProgramStructure from '@/components/solana/ProgramStructure';
import PdaDerivation from '@/components/solana/PdaDerivation';
import LockConfigForm from '@/components/solana/LockConfigForm';
import PreflightPanel from '@/components/solana/PreflightPanel';
import LifecyclePanel from '@/components/solana/LifecyclePanel';
import { Button } from '@/components/ui/button';
import { AUTHORITY, SCALE, LOCK_STATES, ATTEMPT_STATES } from '@/lib/vfRevision6Authority';
import { validateLockRequest, computeOutput, buildHandshakeIdentity } from '@/lib/vfSolanaLockEngine';
import { SolanaMockAdapter } from '@/lib/vfSolanaMockAdapter';

// Parse a decimal string (e.g. "1.00") into 18-decimal fixed-point BigInt.
function parseUsdToFixedPoint(usdStr) {
  if (!usdStr || typeof usdStr !== 'string') return 0n;
  const parts = usdStr.trim().split('.');
  const intPart = (parts[0] || '0').replace(/^0+/, '') || '0';
  let fracPart = parts[1] || '';
  fracPart = fracPart.padEnd(18, '0').slice(0, 18);
  return BigInt(intPart + fracPart);
}

export default function SolanaLock() {
  const adapterRef = useRef(new SolanaMockAdapter());
  const adapter = adapterRef.current;

  const [values, setValues] = useState({
    assetSymbol: '', durationSecs: 604800, outputToken: 'VCLM',
    grossAssetUnits: '', verifiedGrossUsd: '', daysSinceLaunch: '0',
    baseRecipient: '', releaseDestination: '', sourceAccount: '',
    chonxActivationReceipt: '', cumulativeVclmIssued: '0',
  });

  const [lockState, setLockState] = useState(LOCK_STATES.DRAFT);
  const [attemptState, setAttemptState] = useState(null);
  const [preflight, setPreflight] = useState(null);
  const [output, setOutput] = useState(null);
  const [lockId, setLockId] = useState(null);
  const [identity, setIdentity] = useState(null);

  const handshakeUsed = useMemo(() => {
    if (!identity) return 0;
    return adapter.handshakeUsage.get(identity) || 0;
  }, [identity, adapter, attemptState]);

  function onRunPreflight() {
    const usdMicro = parseUsdToFixedPoint(values.verifiedGrossUsd);
    const result = validateLockRequest({
      assetSymbol: values.assetSymbol,
      durationSecs: values.durationSecs,
      outputToken: values.outputToken,
      baseRecipient: values.baseRecipient,
      releaseDestination: values.releaseDestination,
      sourceAccount: values.sourceAccount,
      grossAssetUnits: values.grossAssetUnits || '0',
      verifiedGrossUsdMicro: usdMicro.toString(),
      daysSinceLaunch: Number(values.daysSinceLaunch) || 0,
      chonxActivationReceipt: values.chonxActivationReceipt,
      cumulativeVclmIssued: BigInt(values.cumulativeVclmIssued || '0'),
    });
    setPreflight(result);
    if (result.ok) {
      setLockState(LOCK_STATES.PREFLIGHT_PASSED);
      setIdentity(result.identity);
    }
  }

  function onSubmit() {
    const id = `vf-sol-lock-${Date.now()}`;
    setLockId(id);
    const isHandshake = String(values.durationSecs) === '3600';
    const ident = buildHandshakeIdentity(values.sourceAccount);
    const r = adapter.submitSimulation({ lockId: id, identity: ident, isHandshake });
    if (r.ok) {
      setLockState(LOCK_STATES.SOURCE_SUBMITTED);
      setAttemptState(ATTEMPT_STATES.OBJECTIVELY_PENDING);
    }
  }

  function onDisposition(type) {
    if (!lockId) return;
    let r;
    if (type === 'FINALIZED_SUCCESS') r = adapter.finalizeSuccess(lockId);
    else if (type === 'FINALIZED_FAILURE') r = adapter.finalizeFailure(lockId);
    else if (type === 'RECENT_BLOCKHASH_EXPIRY') r = adapter.expireRecentBlockhash(lockId);
    else if (type === 'DURABLE_NONCE_ADVANCEMENT') r = adapter.advanceDurableNonce(lockId);
    if (r && r.ok) {
      setAttemptState(r.state);
      if (r.state === ATTEMPT_STATES.RECOGNIZED) {
        setLockState(LOCK_STATES.SOURCE_FINALIZED);
        // Compute output now that the source is finalized (VF-XCH-006: issuance after finality)
        const usdMicro = parseUsdToFixedPoint(values.verifiedGrossUsd);
        const out = computeOutput({
          verifiedGrossUsdMicro: usdMicro.toString(),
          outputToken: values.outputToken,
          assetClass: preflight?.asset?.class || 'S3',
          durationSecs: values.durationSecs,
          daysSinceLaunch: Number(values.daysSinceLaunch) || 0,
        });
        out._token = values.outputToken;
        setOutput(out);
      }
    }
  }

  function onIssue() {
    if (output && output.ok) {
      adapter.recordIssuance(lockId, values.outputToken, output.output);
      setLockState(LOCK_STATES.ISSUED);
    }
  }

  function onMature() {
    setLockState(LOCK_STATES.MATURED);
  }

  function onRelease() {
    adapter.recordRelease(lockId);
    setLockState(LOCK_STATES.PRINCIPAL_RELEASED);
  }

  function onReset() {
    adapter.reset();
    setLockState(LOCK_STATES.DRAFT);
    setAttemptState(null);
    setPreflight(null);
    setOutput(null);
    setLockId(null);
    setIdentity(null);
  }

  const events = adapter.events;

  return (
    <div className="min-h-screen bg-[#fafaf8] text-[#0a0a0a]">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <ProvenanceBanner />

        <header className="space-y-1">
          <div className="flex items-center gap-2">
            <Lock className="w-6 h-6 text-[#18324b]" />
            <h1 className="text-2xl font-bold text-[#18324b]">Native Solana Commitment Vault Lock</h1>
          </div>
          <p className="text-sm text-[#6b6b65]">
            Built directly from Revision 6. Environment: Solana (Non-EVM, account-model).
            Every decision traces to a governing requirement ID.
          </p>
        </header>

        {/* Program structure */}
        <ProgramStructure />

        {/* Live PDA derivation */}
        <PdaDerivation lockId={lockId} sourceAccount={values.sourceAccount} />

        {/* Section 1: Configuration */}
        <section className="rounded-lg border border-[#18324b]/20 bg-white p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-[#18324b]" />
            <h2 className="text-sm font-semibold text-[#18324b]">1. Lock Configuration (P1-04)</h2>
          </div>
          <LockConfigForm values={values} onChange={setValues} />
        </section>

        {/* Section 2: Preflight */}
        <section className="rounded-lg border border-[#18324b]/20 bg-white p-4">
          <PreflightPanel values={values} result={preflight} onRunPreflight={onRunPreflight} />
        </section>

        {/* Section 3: Lifecycle */}
        {preflight && (
          <section className="rounded-lg border border-[#18324b]/20 bg-white p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#18324b]" />
                <h2 className="text-sm font-semibold text-[#18324b]">2. Attempt, Issuance & Release (P1-05/06/07)</h2>
              </div>
              <Button size="sm" variant="ghost" onClick={onReset} className="text-[#6b6b65]">Reset</Button>
            </div>
            <LifecyclePanel
              lockState={lockState}
              attemptState={attemptState}
              output={output}
              identity={identity}
              handshakeUsed={handshakeUsed}
              onSubmit={onSubmit}
              onDisposition={onDisposition}
              onIssue={onIssue}
              onMature={onMature}
              onRelease={onRelease}
            />
          </section>
        )}

        {/* Event log */}
        {events.length > 0 && (
          <section className="rounded-lg border border-[#18324b]/20 bg-white p-4 space-y-2">
            <div className="flex items-center gap-2">
              <ScrollText className="w-4 h-4 text-[#18324b]" />
              <h2 className="text-sm font-semibold text-[#18324b]">Append-Only Event Log (Implementation Brief §5.5)</h2>
            </div>
            <div className="space-y-1 max-h-64 overflow-auto">
              {events.map((e, i) => (
                <div key={i} className="text-xs font-mono border-l-2 border-[#18324b]/30 pl-2 py-0.5">
                  <span className="text-[#6b6b65]">{e.timestamp}</span>{' '}
                  <span className="text-[#18324b]">{e.type}</span>
                  {e.disposition && <span className="text-[#6b6b65]"> [{e.disposition}]</span>}
                  {e.lockId && <span className="text-[#6b6b65]"> {e.lockId}</span>}
                  {e.state && <span className="text-emerald-600"> → {e.state}</span>}
                  {e.reason && <span className="text-rose-600"> — {e.reason}</span>}
                </div>
              ))}
            </div>
          </section>
        )}

        <footer className="text-xs text-[#6b6b65] space-y-1 pb-8">
          <p>Authority: {AUTHORITY.revision} ({AUTHORITY.revision_date}). Governing source SHA-256: {AUTHORITY.governing_source_sha256.slice(0, 16)}…</p>
          <p>Phase 1 simulation only. No live wallet, signing, RPC, broadcast, or deployment.</p>
        </footer>
      </div>
    </div>
  );
}