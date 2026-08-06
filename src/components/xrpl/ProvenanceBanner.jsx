import React from 'react';
import { Shield, AlertTriangle } from 'lucide-react';
import { AUTHORITY, XRPL_ENVIRONMENT, XRPL_HANDSHAKE_ALLOWANCE } from '@/lib/vfXrplAuthority';

export default function ProvenanceBanner() {
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-[#18324b]/20 bg-[#18324b]/[0.02] p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-[#18324b]" />
          <h3 className="text-sm font-semibold text-[#18324b]">Protocol Authority</h3>
        </div>
        <div className="text-xs space-y-1 font-mono text-[#6b6b65]">
          <div>Revision: <span className="text-[#0a0a0a]">{AUTHORITY.revision}</span> ({AUTHORITY.revision_date})</div>
          <div>Governing source: <span className="text-[#0a0a0a]">{AUTHORITY.governing_source_file}</span></div>
          <div>Source SHA-256: <span className="text-[#0a0a0a] break-all">{AUTHORITY.governing_source_sha256.slice(0, 32)}…</span></div>
          <div>Requirements: <span className="text-[#0a0a0a]">{AUTHORITY.requirements_count}</span> · Registry: <span className="text-[#0a0a0a]">{AUTHORITY.approved_asset_count}</span> entries · Environments: <span className="text-[#0a0a0a]">{AUTHORITY.supported_environment_count}</span></div>
        </div>
        <div className="text-xs space-y-1 font-mono text-[#6b6b65] pt-1 border-t border-[#18324b]/10">
          <div>Environment: <span className="text-[#0a0a0a]">{XRPL_ENVIRONMENT.name}</span> ({XRPL_ENVIRONMENT.family})</div>
          <div>Handshake allowance: <span className="text-[#0a0a0a]">{XRPL_HANDSHAKE_ALLOWANCE}</span>-use (Section Q.2 — UTXO/XRPL/Stellar family)</div>
          <div>Canonical chain ID: <span className="text-amber-600">DEFERRED EXTERNAL INPUT</span></div>
        </div>
      </div>

      <div className="rounded-lg border border-amber-500/40 bg-amber-50 p-3 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
        <p className="text-xs text-amber-800">
          <b>Phase 1 simulation.</b> No live wallet, signing, XRPL RPC broadcast, or deployment.
          Transaction objects are constructed for inspection only. EscrowCancel is never used (VF-COM-016).
        </p>
      </div>
    </div>
  );
}