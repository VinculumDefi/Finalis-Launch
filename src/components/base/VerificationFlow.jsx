import React from 'react';
import { CheckCircle2, XCircle, ArrowRight } from 'lucide-react';

export default function VerificationFlow({ result }) {
  if (!result) return null;

  return (
    <div className="rounded-lg border border-[#18324b]/20 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[#18324b]">Verification Result</h2>
        <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded ${result.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
          {result.ok ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
          {result.decision}
        </div>
      </div>

      {result.reason && (
        <div className="text-xs text-rose-600 font-mono bg-rose-50 rounded p-2">{result.reason}</div>
      )}

      <div className="space-y-1">
        {result.checks?.map((check, i) => (
          <div key={i} className="flex items-start gap-2 text-[11px]">
            {check.pass ? (
              <CheckCircle2 className="w-3 h-3 text-emerald-600 flex-shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-3 h-3 text-rose-600 flex-shrink-0 mt-0.5" />
            )}
            <span className="text-[#18324b] font-mono">{check.step}</span>
            {check.detail && <span className="text-[#6b6b65]">— {check.detail}</span>}
          </div>
        ))}
      </div>

      {result.ok && result.issuance && (
        <div className="pt-3 border-t border-[#18324b]/10 space-y-2">
          <div className="flex items-center gap-1 text-xs font-semibold text-[#18324b]">
            <ArrowRight className="w-3 h-3" /> Issuance Authorized
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
            <div><span className="text-[#6b6b65]">Token:</span> <span className="text-[#18324b]">{result.issuance.token}</span></div>
            <div><span className="text-[#6b6b65]">Amount:</span> <span className="text-[#18324b]">{result.issuance.amount}</span></div>
            <div><span className="text-[#6b6b65]">Emission:</span> <span className="text-[#18324b]">{result.issuance.emissionRate.slice(0, 20)}…</span></div>
            <div><span className="text-[#6b6b65]">Asset mult:</span> <span className="text-[#18324b]">{result.issuance.assetMultiplierBps} bps</span></div>
            <div><span className="text-[#6b6b65]">Duration mult:</span> <span className="text-[#18324b]">{result.issuance.durationMultiplierBps} bps</span></div>
            <div><span className="text-[#6b6b65]">Recipient:</span> <span className="text-[#18324b]">{result.issuance.recipient.slice(0, 10)}…</span></div>
          </div>
        </div>
      )}

      {result.ok && result.state && (
        <div className="pt-2 border-t border-[#18324b]/10 grid grid-cols-2 gap-2 text-[10px] font-mono text-[#6b6b65]">
          <div>VCLM issued: {result.state.cumulativeVclmIssued}</div>
          <div>CHONX issued: {result.state.cumulativeChonxIssued}</div>
          <div>Locks consumed: {result.state.consumedLocks}</div>
          <div>RACs recorded: {result.state.recordedRacs}</div>
        </div>
      )}

      {result.chonxActivation && result.chonxActivation.newlyActivated && (
        <div className="text-xs text-amber-700 bg-amber-50 rounded p-2 font-semibold">
          ⚡ CHONX activated at VCLM issuance {result.chonxActivation.block.toString()}
        </div>
      )}
    </div>
  );
}