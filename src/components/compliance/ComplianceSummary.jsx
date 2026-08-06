import React from 'react';
import { Card } from '@/components/ui/card';
import { STATUS, STATUS_META, getStatusCounts, REQUIREMENTS } from '@/lib/vfComplianceData';
import { CheckCircle2, AlertCircle, Clock, Lock, Database, FileWarning } from 'lucide-react';

const STATUS_ICONS = {
  [STATUS.IMPLEMENTED]: CheckCircle2,
  [STATUS.PARTIAL]: AlertCircle,
  [STATUS.EXTERNAL]: Lock,
  [STATUS.DEPLOYMENT]: Clock,
  [STATUS.DATA]: Database,
};

export default function ComplianceSummary() {
  const counts = getStatusCounts();
  const total = REQUIREMENTS.length;
  const implemented = counts[STATUS.IMPLEMENTED] || 0;
  const pct = ((implemented / total) * 100).toFixed(1);

  const summaryCards = [
    { status: STATUS.IMPLEMENTED, count: counts[STATUS.IMPLEMENTED] },
    { status: STATUS.PARTIAL, count: counts[STATUS.PARTIAL] },
    { status: STATUS.EXTERNAL, count: counts[STATUS.EXTERNAL] },
    { status: STATUS.DEPLOYMENT, count: counts[STATUS.DEPLOYMENT] },
    { status: STATUS.DATA, count: counts[STATUS.DATA] },
  ];

  return (
    <div className="space-y-4">
      {/* Overall progress bar */}
      <Card className="p-5 bg-slate-900 border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-lg font-bold text-slate-100">Overall Compliance</h3>
            <p className="text-xs text-slate-400">{implemented} of {total} requirements fully implemented</p>
          </div>
          <div className="text-3xl font-bold text-emerald-400">{pct}%</div>
        </div>
        <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </Card>

      {/* Status cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {summaryCards.map(({ status, count }) => {
          const meta = STATUS_META[status];
          const Icon = STATUS_ICONS[status] || FileWarning;
          return (
            <Card key={status} className={`p-4 ${meta.bg} ${meta.border} border`}>
              <div className="flex items-center justify-between mb-1">
                <Icon className={`w-5 h-5 ${meta.text}`} />
                <span className="text-2xl font-bold text-slate-100">{count}</span>
              </div>
              <p className={`text-xs font-medium ${meta.text}`}>{meta.label}</p>
              <p className="text-xs text-slate-500 mt-0.5">{((count / total) * 100).toFixed(1)}% of total</p>
            </Card>
          );
        })}
      </div>
    </div>
  );
}