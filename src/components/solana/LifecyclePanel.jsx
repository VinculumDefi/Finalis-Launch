import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Send, CheckCircle2, XCircle, Clock, Coins, Unlock, FileText } from 'lucide-react';
import { SCALE, LOCK_STATES, ATTEMPT_STATES } from '@/lib/vfRevision6Authority';

function fmtFP(value, displayDecimals = 6) {
  if (value === null || value === undefined) return '—';
  const v = BigInt(value);
  const intPart = v / SCALE;
  const fracPart = v % SCALE;
  const fracStr = fracPart.toString().padStart(18, '0').slice(0, displayDecimals);
  return `${intPart.toString()}.${fracStr}`;
}

function StateBadge({ state }) {
  const color = state === LOCK_STATES.ISSUED || state === LOCK_STATES.PRINCIPAL_RELEASED
    ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
    : state === LOCK_STATES.REJECTED || state === ATTEMPT_STATES.NOT_RECOGNIZED
    ? 'bg-rose-100 text-rose-700 border-rose-300'
    : state === ATTEMPT_STATES.OBJECTIVELY_PENDING || state === LOCK_STATES.SOURCE_SUBMITTED
    ? 'bg-amber-100 text-amber-700 border-amber-300'
    : 'bg-[#18324b]/10 text-[#18324b] border-[#18324b]/30';
  return <Badge variant="outline" className={`text-xs font-mono ${color}`}>{state}</Badge>;
}

export default function LifecyclePanel({
  lockState, attemptState, output, identity, handshakeUsed,
  onSubmit, onDisposition, onIssue, onMature, onRelease,
}) {
  const isPending = attemptState === ATTEMPT_STATES.OBJECTIVELY_PENDING;
  const recognized = attemptState === ATTEMPT_STATES.RECOGNIZED;
  const canSubmit = lockState === LOCK_STATES.PREFLIGHT_PASSED;
  const canIssue = recognized && lockState === LOCK_STATES.SOURCE_FINALIZED;
  const canMature = lockState === LOCK_STATES.ISSUED;
  const canRelease = lockState === LOCK_STATES.MATURED;

  return (
    <div className="space-y-4">
      {/* State */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-[#6b6b65]">Lock state:</span>
        <StateBadge state={lockState} />
        {attemptState && (<><span className="text-xs text-[#6b6b65]">Attempt:</span> <StateBadge state={attemptState} /></>)}
      </div>

      {/* Handshake tracking */}
      {identity && (
        <div className="rounded-md border border-[#18324b]/20 bg-[#18324b]/[0.03] p-3 text-xs space-y-1">
          <div><span className="text-[#6b6b65]">Handshake identity (VF-COM-005):</span> <span className="font-mono text-[#0a0a0a]">{identity}</span></div>
          <div><span className="text-[#6b6b65]">Qualifying Handshakes used:</span> <span className="font-mono text-[#0a0a0a]">{handshakeUsed} / 3</span></div>
          <div className="text-[10px] text-[#6b6b65]">VF-COM-006: account-model mechanism with persistent per-identity state → three-use allowance.</div>
        </div>
      )}

      {/* Submit */}
      {canSubmit && (
        <Button onClick={onSubmit} className="w-full bg-[#18324b] hover:bg-[#18324b]/90">
          <Send className="w-4 h-4 mr-1" /> Submit Simulation (creates OBJECTIVELY_PENDING)
        </Button>
      )}

      {/* Disposition controls — Solana objective pending-attempt (Implementation Brief §4.7) */}
      {isPending && (
        <div className="space-y-2">
          <p className="text-xs text-[#6b6b65]">
            Solana objective disposition (§4.7): finalized success/failure, recent-blockhash expiry, or
            durable-nonce advancement. <b>No timer-based clearing</b> (VF-COM-007/008).
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" variant="outline" onClick={() => onDisposition('FINALIZED_SUCCESS')} className="border-emerald-500 text-emerald-700">
              <CheckCircle2 className="w-4 h-4 mr-1" /> Finalized Success
            </Button>
            <Button size="sm" variant="outline" onClick={() => onDisposition('FINALIZED_FAILURE')} className="border-rose-500 text-rose-700">
              <XCircle className="w-4 h-4 mr-1" /> Finalized Failure
            </Button>
            <Button size="sm" variant="outline" onClick={() => onDisposition('RECENT_BLOCKHASH_EXPIRY')}>
              <Clock className="w-4 h-4 mr-1" /> Blockhash Expiry
            </Button>
            <Button size="sm" variant="outline" onClick={() => onDisposition('DURABLE_NONCE_ADVANCEMENT')}>
              <Clock className="w-4 h-4 mr-1" /> Nonce Advancement
            </Button>
          </div>
        </div>
      )}

      {/* Not recognized */}
      {attemptState === ATTEMPT_STATES.NOT_RECOGNIZED && (
        <div className="rounded-md border border-rose-300/50 bg-rose-50 p-3 text-xs text-rose-700">
          Attempt NOT RECOGNIZED. <b>VF-COM-008: no allowance consumed.</b> VF-COM-015: any fee actually transferred
          to the Dev Fund is permanently non-refundable; principal remains deterministically releasable at maturity.
        </div>
      )}

      {/* Output calculation */}
      {output && output.ok && (
        <div className="rounded-md border border-[#18324b]/20 bg-[#18324b]/[0.03] p-3 text-xs space-y-1">
          <div className="font-semibold text-[#18324b] mb-1">Output Calculation (VF-COM-017/018/019/020)</div>
          <div><span className="text-[#6b6b65]">Formula:</span> Verified Gross USD × emission rate × asset multiplier × duration multiplier</div>
          <div><span className="text-[#6b6b65]">Emission rate:</span> {fmtFP(output.emissionRate, 4)} per $1.00</div>
          <div><span className="text-[#6b6b65]">Asset multiplier:</span> {(output.assetMultiplierBps / 10000).toFixed(2)}x (S3)</div>
          <div><span className="text-[#6b6b65]">Duration multiplier:</span> {(output.durationMultiplierBps / 10000).toFixed(2)}x</div>
          <div className="pt-1 border-t mt-1"><span className="text-[#6b6b65]">Output:</span> <span className="font-mono text-[#0a0a0a] font-bold">{fmtFP(output.output)} {output._token || ''}</span></div>
        </div>
      )}

      {/* Issue */}
      {canIssue && (
        <Button onClick={onIssue} className="w-full bg-[#18324b] hover:bg-[#18324b]/90">
          <Coins className="w-4 h-4 mr-1" /> Record Issuance (VF-XCH-013: once only)
        </Button>
      )}

      {/* Maturity */}
      {canMature && (
        <Button onClick={onMature} variant="outline" className="w-full border-[#18324b] text-[#18324b]">
          <Clock className="w-4 h-4 mr-1" /> Advance Simulation Clock to Maturity
        </Button>
      )}

      {/* Release */}
      {canRelease && (
        <Button onClick={onRelease} variant="outline" className="w-full border-emerald-600 text-emerald-700">
          <Unlock className="w-4 h-4 mr-1" /> Release Principal (VF-PRI-001..006)
        </Button>
      )}

      {lockState === LOCK_STATES.PRINCIPAL_RELEASED && (
        <div className="rounded-md border border-emerald-300/50 bg-emerald-50 p-3 text-xs text-emerald-700">
          Principal released once to the bound destination (VF-PRI-002/003). Release required no Base issuance,
          oracle, price service, epoch, registry, relayer, or administrator (VF-PRI-004/005/006).
        </div>
      )}
    </div>
  );
}