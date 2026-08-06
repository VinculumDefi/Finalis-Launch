import React from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Calculator } from 'lucide-react';
import { SCALE } from '@/lib/vfRevision6Authority';
import { computeFee } from '@/lib/vfSolanaLockEngine';

function fmtFP(value, displayDecimals = 6) {
  const v = BigInt(value);
  const intPart = v / SCALE;
  const fracPart = v % SCALE;
  const fracStr = fracPart.toString().padStart(18, '0').slice(0, displayDecimals);
  return `${intPart.toString()}.${fracStr}`;
}

export default function PreflightPanel({ values, result, onRunPreflight }) {
  const handshake = String(values.durationSecs) === '3600';
  const feePreview = values.grossAssetUnits
    ? computeFee(values.grossAssetUnits, values.durationSecs)
    : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#18324b]">Preflight Validation (VF-ARC-004)</h3>
        <Button size="sm" onClick={onRunPreflight} className="bg-[#18324b] hover:bg-[#18324b]/90">
          <Calculator className="w-4 h-4 mr-1" /> Run Preflight
        </Button>
      </div>

      <p className="text-xs text-[#6b6b65]">
        VF-ARC-004: "A known-invalid request must be rejected before fee or principal assets move."
        {handshake && ' This is a Trust-Building Handshake (1 hour).'}
      </p>

      {feePreview && feePreview.ok && (
        <div className="rounded-md border border-[#18324b]/20 bg-[#18324b]/[0.03] p-3 text-xs font-mono">
          <span className="text-[#6b6b65]">Fee (VF-COM-011):</span> {feePreview.fee.toString()} units ({(feePreview.bps / 100).toFixed(2)}%)
          <br />
          <span className="text-[#6b6b65]">Principal (VF-COM-012):</span> {feePreview.principal.toString()} units
        </div>
      )}

      {result && (
        <div className="space-y-2">
          {result.ok ? (
            <div className="flex items-center gap-2 text-emerald-600 text-sm font-medium">
              <CheckCircle2 className="w-4 h-4" /> Preflight passed — all checks satisfied
            </div>
          ) : (
            <div className="flex items-start gap-2 text-rose-600 text-sm font-medium">
              <XCircle className="w-4 h-4 mt-0.5" /> Preflight failed — {result.errors.length} issue(s)
            </div>
          )}

          <div className="rounded-md border divide-y">
            {result.checks.map((c, i) => (
              <div key={i} className="flex items-start gap-2 p-2 text-xs">
                {c.pass
                  ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                  : <XCircle className="w-3.5 h-3.5 text-rose-500 mt-0.5 shrink-0" />}
                <div className="flex-1">
                  <span className="font-mono text-[#18324b]">{c.id}</span>
                  {c.detail && <span className="text-[#6b6b65] ml-2">{c.detail}</span>}
                </div>
              </div>
            ))}
          </div>

          {result.errors.length > 0 && (
            <div className="rounded-md border border-rose-300/50 bg-rose-50 p-3 text-xs text-rose-700 space-y-1">
              {result.errors.map((e, i) => <div key={i}>• {e}</div>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}