import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { formatTokenAmount } from '@/lib/vfTokenEngine';
import { SYNTH_FORGE } from '@/lib/vfRevision6Authority';
import { Flame } from 'lucide-react';

export default function ForgePanel({ tokenState, onForge, account }) {
  const [count, setCount] = useState('1');
  const [result, setResult] = useState(null);

  const handleForge = () => {
    const r = onForge(BigInt(count));
    setResult(r);
  };

  const vclmBal = tokenState?.getBalance('VCLM', account) || 0n;
  const chonxBal = tokenState?.getBalance('CHONX', account) || 0n;
  const synthBal = tokenState?.getBalance('SYNTH', account) || 0n;
  const n = BigInt(count || '0');
  const vclmNeeded = SYNTH_FORGE.vclm_burn * n;
  const chonxNeeded = SYNTH_FORGE.chonx_burn * n;
  const canForge = tokenState?.synthActivated && vclmBal >= vclmNeeded && chonxBal >= chonxNeeded && n > 0n;

  return (
    <Card className="p-5 bg-slate-900 border-slate-700">
      <div className="flex items-center gap-2 mb-4">
        <Flame className="w-5 h-5 text-amber-400" />
        <h3 className="text-lg font-bold text-amber-400">SYNTH Forge</h3>
        <Badge variant={tokenState?.synthActivated ? 'default' : 'secondary'} className={tokenState?.synthActivated ? 'bg-green-600' : 'bg-slate-700'}>
          {tokenState?.synthActivated ? 'SYNTH ACTIVATED' : 'SYNTH LOCKED'}
        </Badge>
      </div>

      <div className="space-y-3">
        <div className="text-xs text-slate-400">
          VF-TOK-004: Forging one SYNTH permanently destroys exactly 1,000 VCLM and 10,000 CHONX.
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="bg-slate-800 rounded p-2">
            <p className="text-slate-400">VCLM Balance</p>
            <p className="font-mono text-blue-300">{formatTokenAmount(vclmBal)}</p>
          </div>
          <div className="bg-slate-800 rounded p-2">
            <p className="text-slate-400">CHONX Balance</p>
            <p className="font-mono text-purple-300">{formatTokenAmount(chonxBal)}</p>
          </div>
          <div className="bg-slate-800 rounded p-2">
            <p className="text-slate-400">SYNTH Balance</p>
            <p className="font-mono text-amber-300">{formatTokenAmount(synthBal)}</p>
          </div>
        </div>

        <div>
          <Label htmlFor="forge-count" className="text-xs text-slate-400">SYNTH count to forge</Label>
          <Input
            id="forge-count"
            type="number"
            value={count}
            onChange={(e) => setCount(e.target.value)}
            className="bg-slate-800 border-slate-600 text-slate-100 mt-1"
            min="1"
          />
        </div>

        <div className="text-xs font-mono text-slate-300 bg-slate-800 rounded p-2">
          <p>Will burn: {formatTokenAmount(vclmNeeded)} VCLM + {formatTokenAmount(chonxNeeded)} CHONX</p>
          <p>Will mint: {formatTokenAmount(n * (10n ** 18n))} SYNTH</p>
        </div>

        <Button
          onClick={handleForge}
          disabled={!canForge}
          className="w-full bg-amber-600 hover:bg-amber-700 text-white"
        >
          <Flame className="w-4 h-4 mr-1" /> Forge SYNTH
        </Button>

        {result && (
          <div className={`text-xs rounded p-2 ${result.ok ? 'bg-green-900/40 text-green-300' : 'bg-red-900/40 text-red-300'}`}>
            {result.ok ? (
              <span>✓ Forged {count} SYNTH — burned {formatTokenAmount(result.vclmBurn)} VCLM + {formatTokenAmount(result.chonxBurn)} CHONX</span>
            ) : (
              <span>✗ {result.reason}</span>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}