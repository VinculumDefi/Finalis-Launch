import React from 'react';
import { Shield, FileCode, Network } from 'lucide-react';
import { AUTHORITY } from '@/lib/vfRevision6Authority';
import { ENVIRONMENTS, ENVIRONMENT_COUNT } from '@/lib/vfBaseRegistry';

export default function VerifierArchitecture() {
  const evmCount = ENVIRONMENTS.filter((e) => e.family === 'EVM').length;
  const utxoCount = ENVIRONMENTS.filter((e) => e.family === 'UTXO').length;
  const threeUse = ENVIRONMENTS.filter((e) => e.handshakeAllowance === 3).length;
  const oneUse = ENVIRONMENTS.filter((e) => e.handshakeAllowance === 1).length;

  return (
    <div className="rounded-lg border border-[#18324b]/20 bg-white p-4 space-y-3">
      <div className="flex items-center gap-2">
        <FileCode className="w-4 h-4 text-[#18324b]" />
        <h2 className="text-sm font-semibold text-[#18324b]">Verifier Architecture (BASE-VERIFY)</h2>
      </div>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-[#6b6b65]">
            <Network className="w-3 h-3" /> Chain-Agnostic Interface
          </div>
          <div className="ml-4 space-y-0.5 font-mono text-[#18324b]">
            <div>IChainVerifier.verifyFinality()</div>
            <div>→ dispatched per environmentId</div>
            <div>→ same verifyAndMint() for all 17</div>
          </div>
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-[#6b6b65]">
            <Shield className="w-3 h-3" /> Verification Steps (14)
          </div>
          <div className="ml-4 space-y-0.5 font-mono text-[#18324b]">
            <div>1. Replay (VF-XCH-013)</div>
            <div>2. RAC dedup (VF-RAC-001)</div>
            <div>3. Registry (VF-REG-001)</div>
            <div>4. Fee math (VF-COM-011)</div>
            <div>5. Duration (VF-COM-001)</div>
            <div>6. USD bounds (VF-COM-003/009)</div>
            <div>7. Output (VF-COM-020/025)</div>
            <div>8. Handshake (VF-COM-006)</div>
            <div>9. Recipient (VF-ARC-006)</div>
            <div>10. Dev Fund (VF-FEE-009)</div>
            <div>11. Finality (VF-XCH-006)</div>
            <div>12. Issuance (VF-COM-018)</div>
            <div>13. Hard cap (VF-SUP-015)</div>
            <div>14. Mint + RAC (VF-RAC-001)</div>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 text-[10px] font-mono pt-2 border-t border-[#18324b]/10">
        <span className="px-2 py-0.5 bg-[#18324b]/5 rounded text-[#18324b]">{ENVIRONMENT_COUNT} environments</span>
        <span className="px-2 py-0.5 bg-[#18324b]/5 rounded text-[#18324b]">{evmCount} EVM</span>
        <span className="px-2 py-0.5 bg-[#18324b]/5 rounded text-[#18324b]">{utxoCount} UTXO</span>
        <span className="px-2 py-0.5 bg-emerald-50 rounded text-emerald-700">{threeUse} three-use (source-enforced)</span>
        <span className="px-2 py-0.5 bg-amber-50 rounded text-amber-700">{oneUse} one-use (Base-enforced)</span>
      </div>
      <div className="text-[10px] text-[#6b6b65] font-mono">
        Authority: {AUTHORITY.revision} ({AUTHORITY.revision_date}) · SHA-256: {AUTHORITY.governing_source_sha256.slice(0, 16)}…
      </div>
    </div>
  );
}