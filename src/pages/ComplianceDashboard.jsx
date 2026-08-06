import React from 'react';
import { Card } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { STATUS, STATUS_META, REQUIREMENTS } from '@/lib/vfComplianceData';
import { ShieldCheck, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ComplianceSummary from '@/components/compliance/ComplianceSummary';
import ComplianceCategoryBreakdown from '@/components/compliance/ComplianceCategoryBreakdown';
import ComplianceTable from '@/components/compliance/ComplianceTable';
import RegistryPanel from '@/components/compliance/RegistryPanel';

export default function ComplianceDashboard() {
  const blockedItems = REQUIREMENTS.filter(
    (r) => r.status !== STATUS.IMPLEMENTED
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/50">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <ShieldCheck className="w-7 h-7 text-emerald-400" />
                Compliance Dashboard
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                Master Specification — Revision 6 · {REQUIREMENTS.length} requirements traced
              </p>
            </div>
            <Link to="/">
              <Button variant="ghost" size="sm" className="text-slate-400">
                <ArrowLeft className="w-4 h-4 mr-1" /> Home
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Provenance Banner */}
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 text-xs text-slate-400">
          <span className="font-semibold text-slate-300">Source:</span> 227826f11_Vinculum_Finalis_Master_Specification_Revision_6_2026-07-28.docx (Revision 6, 2026-07-28)
          <span className="mx-2">·</span>
          <span className="font-semibold text-slate-300">Audit Date:</span> 2026-08-01
          <span className="mx-2">·</span>
          <span className="font-semibold text-slate-300">Governing Rule:</span> Master Spec is sole governing expression; all code traces to protocol constants in vfRevision6Authority.js
        </div>

        {/* Summary + Category Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ComplianceSummary />
          <ComplianceCategoryBreakdown />
        </div>

        {/* Blocked Items Summary */}
        {blockedItems.length > 0 && (
          <Card className="p-5 bg-slate-900 border-amber-500/30">
            <h3 className="text-lg font-bold text-slate-100 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              In-Progress & Blocked Items ({blockedItems.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {blockedItems.map((r) => {
                const meta = STATUS_META[r.status];
                return (
                  <div key={r.id} className="flex items-start gap-2 p-2 bg-slate-800/50 rounded-md">
                    <span className={`w-1.5 h-1.5 rounded-full ${meta.dot} mt-1.5 shrink-0`}></span>
                    <div className="min-w-0">
                      <span className="text-xs font-mono text-slate-400">{r.id}</span>
                      <p className="text-xs text-slate-300 truncate">{r.title}</p>
                      <p className={`text-xs ${meta.text} mt-0.5`}>{meta.label}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Registry Verification (VF-REG-011) */}
        <RegistryPanel />

        {/* Full Filterable Table */}
        <ComplianceTable />
      </div>
    </div>
  );
}