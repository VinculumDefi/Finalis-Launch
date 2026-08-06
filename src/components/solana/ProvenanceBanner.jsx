import React from 'react';
import { ShieldCheck, AlertCircle } from 'lucide-react';
import { AUTHORITY } from '@/lib/vfRevision6Authority';
import { SOLANA_REGISTRY_COUNT } from '@/lib/vfSolanaRegistry';

export default function ProvenanceBanner() {
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-[#18324b]/30 bg-[#18324b]/[0.04] p-4">
        <div className="flex items-center gap-2 mb-2">
          <ShieldCheck className="w-5 h-5 text-[#18324b]" />
          <span className="font-semibold text-[#18324b] text-sm">Revision 6 — Sole Governing Authority</span>
        </div>
        <dl className="text-xs space-y-1 font-mono text-[#6b6b65]">
          <div><span className="text-[#6b6b65]">Revision:</span> <span className="text-[#0a0a0a]">{AUTHORITY.revision} · {AUTHORITY.revision_date}</span></div>
          <div><span className="text-[#6b6b65]">Source:</span> <span className="text-[#0a0a0a]">{AUTHORITY.governing_source_file}</span></div>
          <div><span className="text-[#6b6b65]">SHA-256:</span> <span className="text-[#0a0a0a] break-all">{AUTHORITY.governing_source_sha256}</span></div>
          <div><span className="text-[#6b6b65]">Governing requirements:</span> <span className="text-[#0a0a0a]">{AUTHORITY.requirements_count}</span></div>
          <div><span className="text-[#6b6b65]">Solana registry entries:</span> <span className="text-[#0a0a0a]">{SOLANA_REGISTRY_COUNT} (all class S3)</span></div>
        </dl>
      </div>
      <div className="rounded-lg border border-amber-500/40 bg-amber-50 p-3 flex items-start gap-2">
        <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
        <p className="text-xs text-amber-800">
          <b>PHASE 1 — SIMULATION — NO VALUE — NO LIVE TRANSACTIONS.</b> No wallet signing, no RPC, no broadcast.
          Price lookup is simulated. The Dev Fund destination, canonical chain identifier, and deployed program
          address are <b>DEFERRED EXTERNAL INPUT</b> (VF-DEP-001, VF-XCH-003) — not present in Revision 6 constants,
          not invented.
        </p>
      </div>
    </div>
  );
}