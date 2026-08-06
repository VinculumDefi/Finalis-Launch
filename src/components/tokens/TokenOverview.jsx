import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatTokenAmount } from '@/lib/vfTokenEngine';

const TOKEN_META = {
  VCLM: { name: 'Vinculum Finalis VCLM', color: 'text-blue-400', req: 'VF-TOK-001/009' },
  CHONX: { name: 'Vinculum Finalis CHONX', color: 'text-purple-400', req: 'VF-TOK-001/010/002' },
  SYNTH: { name: 'Vinculum Finalis SYNTH', color: 'text-amber-400', req: 'VF-TOK-001/003/004/010' },
};

export default function TokenOverview({ stats }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {['VCLM', 'CHONX', 'SYNTH'].map((sym) => {
        const s = stats[sym];
        const meta = TOKEN_META[sym];
        return (
          <Card key={sym} className="p-5 bg-slate-900 border-slate-700">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className={`text-lg font-bold ${meta.color}`}>{s}</h3>
                <p className="text-xs text-slate-400">{meta.name}</p>
              </div>
              <Badge variant={s.activated ? 'default' : 'secondary'} className={s.activated ? 'bg-green-600' : 'bg-slate-700'}>
                {s.activated ? 'ACTIVE' : 'INACTIVE'}
              </Badge>
            </div>
            <div className="space-y-2 text-sm">
              <Row label="Decimals" value={s.decimals} req="VF-TOK-001" />
              <Row label={sym === 'SYNTH' ? 'Minted' : 'Issued'} value={formatTokenAmount(sym === 'SYNTH' ? s.minted : s.issued)} />
              <Row label="Hard Cap" value={formatTokenAmount(s.cap)} req="VF-SUP-015" />
              <Row label="Remaining" value={formatTokenAmount(s.remaining)} />
              {s.activationThreshold && (
                <Row label="Activation Threshold" value={formatTokenAmount(s.activationThreshold)} req={sym === 'CHONX' ? 'VF-TOK-002' : 'VF-TOK-003'} />
              )}
              {sym === 'SYNTH' && s.forgeRatio && (
                <div className="pt-2 border-t border-slate-700 mt-2">
                  <p className="text-xs text-slate-400 mb-1">Forge Ratio (VF-TOK-004)</p>
                  <p className="text-xs font-mono text-amber-300">
                    Burn {formatTokenAmount(s.forgeRatio.vclmBurn)} VCLM + {formatTokenAmount(s.forgeRatio.chonxBurn)} CHONX → 1 SYNTH
                  </p>
                </div>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function Row({ label, value, req }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-slate-400 text-xs">{label}</span>
      <span className="font-mono text-slate-200 text-xs">{value}{req && <span className="text-slate-500 ml-1">({req})</span>}</span>
    </div>
  );
}