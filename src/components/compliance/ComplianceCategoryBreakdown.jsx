import React from 'react';
import { Card } from '@/components/ui/card';
import { getCategoryStats, CATEGORIES, STATUS_META, STATUS } from '@/lib/vfComplianceData';

export default function ComplianceCategoryBreakdown() {
  const stats = getCategoryStats();

  return (
    <Card className="p-5 bg-slate-900 border-slate-700">
      <h3 className="text-lg font-bold text-slate-100 mb-4">Category Breakdown</h3>
      <div className="space-y-2.5">
        {CATEGORIES.map((cat) => {
          const s = stats[cat];
          if (!s || s.total === 0) return null;
          const implPct = (s.implemented / s.total) * 100;
          const partialPct = (s.partial / s.total) * 100;
          const blockedPct = (s.blocked / s.total) * 100;

          return (
            <div key={cat} className="flex items-center gap-3">
              <div className="w-32 md:w-40 shrink-0">
                <span className="text-xs font-medium text-slate-300">{cat}</span>
                <span className="text-xs text-slate-500 ml-1">({s.total})</span>
              </div>
              <div className="flex-1 h-5 bg-slate-800 rounded-full overflow-hidden flex">
                {s.implemented > 0 && (
                  <div
                    className="h-full bg-emerald-500 flex items-center justify-center"
                    style={{ width: `${implPct}%` }}
                    title={`${s.implemented} implemented`}
                  />
                )}
                {s.partial > 0 && (
                  <div
                    className="h-full bg-amber-500"
                    style={{ width: `${partialPct}%` }}
                    title={`${s.partial} partial`}
                  />
                )}
                {s.blocked > 0 && (
                  <div
                    className="h-full bg-slate-600"
                    style={{ width: `${blockedPct}%` }}
                    title={`${s.blocked} blocked`}
                  />
                )}
              </div>
              <div className="w-16 shrink-0 text-right">
                <span className="text-xs font-mono text-slate-400">
                  {s.implemented}/{s.total}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-4 mt-4 pt-3 border-t border-slate-800">
        <span className="flex items-center gap-1.5 text-xs text-slate-400">
          <span className="w-3 h-3 rounded bg-emerald-500"></span> Implemented
        </span>
        <span className="flex items-center gap-1.5 text-xs text-slate-400">
          <span className="w-3 h-3 rounded bg-amber-500"></span> Partial
        </span>
        <span className="flex items-center gap-1.5 text-xs text-slate-400">
          <span className="w-3 h-3 rounded bg-slate-600"></span> Blocked / External
        </span>
      </div>
    </Card>
  );
}