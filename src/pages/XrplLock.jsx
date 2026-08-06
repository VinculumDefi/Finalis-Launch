import React, { useState, useRef, useMemo } from 'react';
import { FileText, Lock, ScrollText } from 'lucide-react';
import ProvenanceBanner from '@/components/xrpl/ProvenanceBanner';
import TransactionStructure from '@/components/xrpl/TransactionStructure';
import LockConfigForm from '@/components/xrpl/LockConfigForm';
import PreflightPanel from '@/components/xrpl/PreflightPanel';
import LifecyclePanel from '@/components/xrpl/LifecyclePanel';
import { Button } from '@/components/ui/button';
import { AUTHORITY, LOCK_STATES, ATTEMPT_STATES, XRPL_HANDSHAKE_ALLOWANCE } from '@/lib/vfXrplAuthority';
import { validateLockRequest, computeOutput } from '@/lib/vfXrplLockEngine';
import { XrplMockAdapter } from '@/lib/vfXrplMockAdapter';
import { buildAtomicBatch } from '@/lib/vfXrplTransactionBuilder';

function parseUsdToFixedPoint(usdStr) {
  if (!usdStr || typeof usdStr !== 'string') return 0n;
  const parts = usdStr.trim().split('.');
  const intPart = (parts[0] || '0').replace(/^0+/, '') || '0';
  let fracPart = parts[1] || '';
  fracPart = fracPart.padEnd(18, '0').slice(0, 18);
  return BigInt(intPart + fracPart);
}

export default function XrplLock() {
  const adapterRef = useRef(new XrplMockAdapter());
  const adapter = adapterRef.current;

  const [values, setValues] = useState({
    assetSymbol: 'XRP', durationSecs: 604800, outputToken: 'VCLM',
    grossAssetUnits: '', verifiedGrossUsd: '', daysSinceLaunch: '0',
    sourceAccount: '', releaseDestination: '',
    chonxActivationReceipt: '', cumulativeVclmIssued: '0',
  });

  const [lockState, setLockState] = useState(LOCK_STATES.DRAFT);
  const [attemptState, setAttemptState] = useState(null);
  const [preflight, setPreflight] = useState(null);
  const [output, setOutput] = useState(null);
  const [lockId, setLockId] = useState(null);
  const [identity, setIdentity] = useState(null);
  const [batch, setBatch] = useState(null);

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
      baseRecipient: values.baseRecipient || '',
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
    const id = `vf-xrpl-lock-${Date.now()}`;
    setLockId(id);
    const isHandshake = String(values.durationSecs) === '3600';
    const ident = identity || `(XRPL, ${values.sourceAccount})`;

    // Build the atomic batch (Payment + EscrowCreate)
    if (preflight && preflight.fee) {
      const now = Math.floor(Date.now() / 1000);
      const built = buildAtomicBatch({
        lockId: id,
        sourceAccount: values.sourceAccount,
        devFundDestination: 'r-DEV-FUND-DEFERRED', // VF-DEP-001: deferred external input
        feeAmount: preflight.fee.fee,
        principalAmount: preflight.fee.principal,
        releaseDestination: values.releaseDestination,
        durationSecs: values.durationSecs,
        creationTimeSecs: now,
        verifiedGrossUsdMicro: parseUsdToFixedPoint(values.verifiedGrossUsd).toString(),
        outputToken: values.outputToken,
        chonxActivationReceipt: values.chonxActivationReceipt || 'not_applicable',
        baseRecipient: values.baseRecipient || '',
        sequence: 0, // Set by the XRPL account's actual sequence at signing time
      }, 12345678); // Placeholder ledger index — set from live ledger in production
      setBatch(built);
    }

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
    else if (type === 'LASTLEDGERSEQUENCE_EXPIRY') r = adapter.expireLastLedgerSequence(lockId);
    if (r && r.ok) {
      setAttemptState(r.state);
      if (r.state === ATTEMPT_STATES.RECOGNIZED) {
        setLockState(LOCK_STATES.SOURCE_FINALIZED);
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
    setBatch(null);
  }

  const events = adapter.events;

  return (
    <div className="min-h-screen bg-[#fafaf8] text-[#0a0a0a]">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <ProvenanceBanner />

        <header className="space-y-1">
          <div className="flex items-center gap-2">
            <Lock className="w-6 h-6 text-[#18324b]" />
            <h1 className="text-2xl font-bold text-[#18324b]">Native XRPL Commitment Vault Lock</h1>
          </div>
          <p className="text-sm text-[#6b6b65]">
            Built directly from Revision 6. Environment: XRPL (Non-EVM, account-model with Escrow).
            Every decision traces to a governing requirement ID.
          </p>
        </header>

        <TransactionStructure />

        {/* Configuration */}
        <section className="rounded-lg border border-[#18324b]/20 bg-white p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-[#18324b]" />
            <h2 className="text-sm font-semibold text-[#18324b]">1. Lock Configuration (VF-COM-001..026)</h2>
          </div>
          <LockConfigForm values={values} onChange={setValues} />
        </section>

        {/* Preflight */}
        <section className="rounded-lg border border-[#18324b]/20 bg-white p-4">
          <PreflightPanel values={values} result={preflight} onRunPreflight={onRunPreflight} />
        </section>

        {/* Lifecycle */}
        {preflight && (
          <section className="rounded-lg border border-[#18324b]/20 bg-white p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#18324b]" />
                <h2 className="text-sm font-semibold text-[#18324b]">2. Attempt, Issuance & Release</h2>
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

        {/* Transaction objects */}
        {batch && (
          <section className="rounded-lg border border-[#18324b]/20 bg-white p-4 space-y-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#18324b]" />
              <h2 className="text-sm font-semibold text-[#18324b]">Constructed Transactions (VF-COM-004 / VF-XCH-005)</h2>
            </div>
            <div className="space-y-2">
              <div className="text-xs font-medium text-[#18324b]">Payment (fee → Dev Fund)</div>
              <pre className="text-xs font-mono bg-[#18324b]/[0.03] rounded-md p-3 overflow-auto max-h-48">
{JSON.stringify(batch.payment, null, 2)}
              </pre>
              <div className="text-xs font-medium text-[#18324b]">EscrowCreate (principal → escrow)</div>
              <pre className="text-xs font-mono bg-[#18324b]/[0.03] rounded-md p-3 overflow-auto max-h-48">
{JSON.stringify(batch.escrowCreate, null, 2)}
              </pre>
              <div className="text-xs text-[#6b6b65]">
                LastLedgerSequence: {batch.lastLedgerSequence} · FinishAfter: {batch.finishAfter} (XRPL epoch)
              </div>
            </div>
          </section>
        )}

        {/* Event log */}
        {events.length > 0 && (
          <section className="rounded-lg border border-[#18324b]/20 bg-white p-4 space-y-2">
            <div className="flex items-center gap-2">
              <ScrollText className="w-4 h-4 text-[#18324b]" />
              <h2 className="text-sm font-semibold text-[#18324b]">Append-Only Event Log (§5.5)</h2>
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
          <p>Phase 1 simulation only. No live wallet, signing, XRPL RPC, broadcast, or deployment. EscrowCancel is never used (VF-COM-016).</p>
        </footer>
      </div>
    </div>
  );
}