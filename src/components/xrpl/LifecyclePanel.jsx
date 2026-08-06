import React from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Lock, Unlock, ArrowRight } from 'lucide-react';
import { LOCK_STATES, ATTEMPT_STATES, XRPL_HANDSHAKE_ALLOWANCE } from '@/lib/vfXrplAuthority';
import { XRPL_DISPOSITION } from '@/lib/vfXrplAuthority';
import { XRPL_DROPS_PER_XRP } from '@/lib/vfXrplAuthority';

function StatusBadge({ state, active }) {
  const color = active ? 'bg-[#18324b] text-white' : 'bg-[#18324b]/10 text-[#6b6b65]';
  return <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${color}`}>{state}</span>;
}

function fmtDrops(drops) {
  return `${BigInt(drops).toString()} drops (${(Number(BigInt(drops)) / XRPL_DROPS_PER_XRP).toFixed(6)} XRP)`;
}

export default function LifecyclePanel({
  lockState, attemptState, output, identity, handshakeUsed,
  onSubmit, onDisposition, onIssue, onMature, onRelease,
}) {
  const canSubmit = lockState === LOCK_STATES.PREFLIGHT_PASSED;
  const canIssue = attemptState === ATTEMPT_STATES.RECOGNIZED && output && output.ok && lockState !== LOCK_STATES.ISSUED;
  const canMature = lockState === LOCK_STATES.ISSUED;
  const canRelease = lockState === LOCK_STATES.MATURED;

  return (
    <div className="space-y-4">
      {/* State display */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-md border p-2">
          <div className="text-[#6b6b65] mb-1">Lock State</div>
          <StatusBadge state={lockState} active />
        </div>
        <div className="rounded-md border p-2">
          <div className="text-[#6b6b65] mb-1">Attempt State</div>
          <StatusBadge state={attemptState || '—'} active={!!attemptState} />
        </div>
      </div>

      {/* Handshake usage */}
      {identity && (
        <div className="rounded-md border border-[#18324b]/20 bg-[#18324b]/[0.02] p-3 text-xs space-y-1">
          <div className="font-medium text-[#18324b]">Handshake Identity (VF-COM-005)</div>
          <div className="font-mono text-[#6b6b65] break-all">{identity}</div>
          <div className="font-mono text-[#0a0a0a]">
            Usage: {handshakeUsed} / {XRPL_HANDSHAKE_ALLOWANCE}
            {handshakeUsed >= XRPL_HANDSHAKE_ALLOWANCE && (
              <span className="text-rose-600 ml-2">— EXHAUSTED (1-use, Q.2)</span>
            )}
          </div>
        </div>
      )}

      {/* Step 1: Submit */}
      <div className="space-y-1">
        <div className="text-xs font-medium text-[#18324b]">Step 1: Submit Source Transaction</div>
        <p className="text-xs text-[#6b6b65]">Submits Payment + EscrowCreate as an atomic batch with linked Sequence + shared LastLedgerSequence.</p>
        <Button size="sm" disabled={!canSubmit} onClick={onSubmit} className="bg-[#18324b] hover:bg-[#18324b]/90">
          <Lock className="w-3.5 h-3.5 mr-1" /> Submit Batch
        </Button>
      </div>

      {/* Step 2: Disposition */}
      {attemptState === ATTEMPT_STATES.OBJECTIVELY_PENDING && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-[#18324b]">Step 2: Objective Disposition (XRPL §4.7)</div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => onDisposition('FINALIZED_SUCCESS')}>
              <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" /> Finalized Success
            </Button>
            <Button size="sm" variant="outline" onClick={() => onDisposition('FINALIZED_FAILURE')}>
              <XCircle className="w-3.5 h-3.5 mr-1 text-rose-600" /> Finalized Failure
            </Button>
            <Button size="sm" variant="outline" onClick={() => onDisposition('LASTLEDGERSEQUENCE_EXPIRY')}>
              <XCircle className="w-3.5 h-3.5 mr-1 text-amber-600" /> LLS Expiry
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Issue */}
      {canIssue && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-[#18324b]">Step 3: Issue Output (Base-side)</div>
          {output && output.ok && (
            <div className="rounded-md border border-[#18324b]/20 bg-[#18324b]/[0.03] p-3 text-xs font-mono">
              <div><span className="text-[#6b6b65]">Token:</span> {output._token}</div>
              <div><span className="text-[#6b6b65]">Output:</span> {output.output.toString()} smallest units</div>
            </div>
          )}
          <Button size="sm" onClick={onIssue} className="bg-[#18324b] hover:bg-[#18324b]/90">
            Record Issuance <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </div>
      )}

      {/* Step 4: Mature */}
      {lockState === LOCK_STATES.ISSUED && (
        <div className="space-y-1">
          <div className="text-xs font-medium text-[#18324b]">Step 4: Maturity</div>
          <Button size="sm" variant="outline" onClick={onMature}>
            Advance to Maturity
          </Button>
        </div>
      )}

      {/* Step 5: Release */}
      {canRelease && (
        <div className="space-y-1">
          <div className="text-xs font-medium text-[#18324b]">Step 5: Permissionless Principal Release</div>
          <p className="text-xs text-[#6b6b65]">EscrowFinish — callable by anyone. Principal goes to bound destination only.</p>
          <Button size="sm" onClick={onRelease} className="bg-emerald-600 hover:bg-emerald-700">
            <Unlock className="w-3.5 h-3.5 mr-1" /> Release Principal
          </Button>
        </div>
      )}

      {lockState === LOCK_STATES.PRINCIPAL_RELEASED && (
        <div className="flex items-center gap-2 text-emerald-600 text-sm font-medium">
          <CheckCircle2 className="w-4 h-4" /> Principal released — lifecycle complete
        </div>
      )}
    </div>
  );
}