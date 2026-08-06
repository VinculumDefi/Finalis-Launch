import React from 'react';
import { Package } from 'lucide-react';
import { PROOF_PACKAGE_FIELDS, OUTPUT_TOKEN } from '@/lib/vfProofNormalizer';

export default function ProofPackageViewer({ pkg }) {
  if (!pkg) {
    return (
      <div className="rounded-lg border border-[#18324b]/20 bg-white p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-[#18324b]" />
          <h2 className="text-sm font-semibold text-[#18324b]">Canonical ProofPackage (Section D)</h2>
        </div>
        <p className="text-xs text-[#6b6b65]">No package normalized yet. Run a verification to see the normalized structure.</p>
        <div className="text-[10px] font-mono text-[#6b6b65] space-y-0.5">
          <div className="font-semibold text-[#18324b]">Fields ({PROOF_PACKAGE_FIELDS.length}):</div>
          {PROOF_PACKAGE_FIELDS.map((f) => (
            <div key={f} className="ml-2">· {f}</div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[#18324b]/20 bg-white p-4 space-y-2">
      <div className="flex items-center gap-2">
        <Package className="w-4 h-4 text-[#18324b]" />
        <h2 className="text-sm font-semibold text-[#18324b]">Normalized ProofPackage</h2>
      </div>
      <div className="grid grid-cols-1 gap-1 text-[11px] font-mono">
        {PROOF_PACKAGE_FIELDS.map((field) => {
          const val = pkg[field];
          let display = val;
          if (val === null || val === undefined) display = '—';
          else if (typeof val === 'object') display = JSON.stringify(val).slice(0, 80) + (JSON.stringify(val).length > 80 ? '…' : '');
          else display = String(val).slice(0, 80);
          return (
            <div key={field} className="flex gap-2">
              <span className="text-[#6b6b65] w-48 flex-shrink-0">{field}</span>
              <span className="text-[#18324b] break-all">{display}</span>
            </div>
          );
        })}
      </div>
      {pkg._environment && (
        <div className="text-[10px] text-[#6b6b65] pt-2 border-t border-[#18324b]/10">
          Resolved: {pkg._environment.id} · {pkg._precisionEntry?.symbol} ({pkg._precisionEntry?.decimals} dec, {pkg._precisionEntry?.custodyClass}) · mult {pkg._assetMultiplierBps} bps
        </div>
      )}
    </div>
  );
}