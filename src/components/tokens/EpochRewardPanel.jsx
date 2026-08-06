import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatTokenAmount } from '@/lib/vfTokenEngine';
import { Clock, Gift } from 'lucide-react';

export default function EpochRewardPanel({ tokenState, onDistribute, emissionRate }) {
  const epochStats = tokenState.getEpochStats();

  return (
    <Card className="p-5 bg-slate-900 border-slate-700">
      <h3 className="text-lg font-bold text-slate-100 mb-4 flex items-center gap-2">
        <Clock className="w-5 h-5 text-emerald-400" /> Epoch Reward Distribution
      </h3>
      <p className="text-xs text-slate-400 mb-3">
        VF-RAC: Reward Accounting Credits (60% of fee USD) accumulate per 10-day epoch.
        At epoch boundary, credits convert to VCLM at the current emission rate and distribute to base recipients.
      </p>
      <div className="space-y-2">
        {epochStats.epochs.length === 0 && (
          <div className="text-sm text-slate-500 italic py-2">No RAC credits recorded yet. Run the issuance pipeline to accumulate credits.</div>
        )}
        {epochStats.epochs.map((e) => (
          <div key={e.epoch} className="flex items-center justify-between bg-slate-800/50 rounded px-3 py-2 text-sm">
            <div className="flex items-center gap-2">
              <Badge variant={e.distributed ? 'secondary' : 'default'} className={e.distributed ? 'bg-slate-600' : 'bg-emerald-600'}>
                Epoch {e.epoch}
              </Badge>
              <span className="text-slate-400 text-xs">
                {e.creditCount} credit{e.creditCount !== 1 ? 's' : ''} · {formatTokenAmount(e.totalCredits)} RAC-USD
              </span>
              {e.isCurrent && <Badge variant="outline" className="border-amber-500 text-amber-400 text-xs">current</Badge>}
            </div>
            <div className="flex items-center gap-2">
              {e.distributed ? (
                <Badge variant="secondary" className="bg-slate-700 text-slate-400">distributed</Badge>
              ) : (
                <Button
                  size="sm"
                  onClick={() => onDistribute(e.epoch)}
                  disabled={e.isCurrent}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  <Gift className="w-3 h-3 mr-1" /> Distribute
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
      {tokenState.epochDistributions.length > 0 && (
        <div className="mt-4 space-y-1 max-h-32 overflow-y-auto">
          <div className="text-xs text-slate-500 font-semibold mb-1">Distribution History</div>
          {tokenState.epochDistributions.map((d, i) => (
            <div key={i} className="text-xs font-mono text-slate-400 flex justify-between">
              <span>Epoch {d.epoch}: {d.distributions.length} recipients · {formatTokenAmount(d.totalDistributed)} VCLM</span>
              <span className="text-slate-600">{new Date(d.ts).toLocaleTimeString()}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}