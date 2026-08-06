import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { STAKE_DURATIONS } from '@/lib/vfRevision6Authority';
import { formatTokenAmount } from '@/lib/vfTokenEngine';
import { Lock, Unlock, Coins, Clock, AlertCircle } from 'lucide-react';

export default function StakingPanel({ engine, account }) {
  const [, forceUpdate] = useState(0);
  const refresh = () => forceUpdate((v) => v + 1);

  const [token, setToken] = useState('VCLM');
  const [amount, setAmount] = useState('100');
  const [durationIdx, setDurationIdx] = useState(0);
  const [result, setResult] = useState(null);

  const stats = engine.getStats();
  const claimable = engine.getClaimableVclm(account);
  const currentEpoch = engine.getCurrentEpoch();

  const handleStake = () => {
    const dur = STAKE_DURATIONS[durationIdx];
    const r = engine.createStakePosition(account, token, amount, dur.secs);
    setResult(r);
    refresh();
  };

  const handleCloseEpoch = () => {
    const r = engine.closeEpoch(currentEpoch);
    setResult(r);
    refresh();
  };

  const handleAllocateEpoch = () => {
    const r = engine.allocateEpoch(currentEpoch - 2);
    setResult(r);
    refresh();
  };

  const handleClaim = () => {
    const r = engine.claimVclm(account);
    setResult(r);
    refresh();
  };

  const positions = Array.from(engine.positions.values()).filter((p) => p.owner === account);

  return (
    <div className="space-y-4">
      {/* Terminal state warning */}
      {stats.terminalState && (
        <div className="rounded-lg border border-red-700 bg-red-950/50 p-3 text-xs text-red-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span><strong>VF-STK-029:</strong> Terminal state — VCLM capacity exhausted. No new positions or extensions. Staked tokens are immediately withdrawable.</span>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3 bg-slate-900 border-slate-700">
          <div className="text-xs text-slate-400">Active Positions</div>
          <div className="text-xl font-bold text-slate-100">{stats.activePositions}</div>
        </Card>
        <Card className="p-3 bg-slate-900 border-slate-700">
          <div className="text-xs text-slate-400">Current Epoch</div>
          <div className="text-xl font-bold text-slate-100">{stats.currentEpoch}</div>
        </Card>
        <Card className="p-3 bg-slate-900 border-slate-700">
          <div className="text-xs text-slate-400">Staked VCLM</div>
          <div className="text-lg font-bold text-amber-400">{formatTokenAmount(stats.staked.VCLM)}</div>
        </Card>
        <Card className="p-3 bg-slate-900 border-slate-700">
          <div className="text-xs text-slate-400">Claimable VCLM</div>
          <div className="text-lg font-bold text-green-400">{formatTokenAmount(claimable.toString())}</div>
        </Card>
      </div>

      {/* Create Position */}
      <Card className="p-4 bg-slate-900 border-slate-700">
        <h3 className="text-sm font-bold text-slate-100 mb-3 flex items-center gap-2">
          <Lock className="w-4 h-4 text-blue-400" /> Create Stake Position
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs text-slate-400">Token</Label>
            <Select value={token} onValueChange={setToken}>
              <SelectTrigger className="bg-slate-800 border-slate-600 mt-1"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-600">
                <SelectItem value="VCLM">VCLM</SelectItem>
                <SelectItem value="CHONX">CHONX</SelectItem>
                <SelectItem value="SYNTH">SYNTH</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-slate-400">Amount</Label>
            <input
              type="text"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-slate-800 border border-slate-600 rounded mt-1 px-2 py-1 text-sm text-slate-100 font-mono"
            />
          </div>
          <div>
            <Label className="text-xs text-slate-400">Duration</Label>
            <Select value={String(durationIdx)} onValueChange={(v) => setDurationIdx(Number(v))}>
              <SelectTrigger className="bg-slate-800 border-slate-600 mt-1"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-600">
                {STAKE_DURATIONS.map((d, i) => (
                  <SelectItem key={i} value={String(i)}>{d.label} ({d.multiplier_bps / 100}x)</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button onClick={handleStake} disabled={stats.terminalState} className="w-full bg-blue-600 hover:bg-blue-700">
              <Lock className="w-4 h-4 mr-1" /> Stake
            </Button>
          </div>
        </div>
      </Card>

      {/* Epoch Controls */}
      <Card className="p-4 bg-slate-900 border-slate-700">
        <h3 className="text-sm font-bold text-slate-100 mb-3 flex items-center gap-2">
          <Clock className="w-4 h-4 text-purple-400" /> Epoch Finalization (Two-Phase)
        </h3>
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleCloseEpoch} variant="outline" size="sm" className="border-slate-600 text-slate-300">
            Close Epoch {currentEpoch} (Phase 1)
          </Button>
          <Button onClick={handleAllocateEpoch} variant="outline" size="sm" className="border-slate-600 text-slate-300">
            Allocate Epoch {currentEpoch - 2} (Phase 2)
          </Button>
          <Button onClick={handleClaim} variant="outline" size="sm" className="border-green-700 text-green-400">
            <Coins className="w-4 h-4 mr-1" /> Claim VCLM
          </Button>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          VF-STK-013: Phase 2 allocation requires scheduled end of N+1. VF-RAC-005: Uses permanent $0.10 Reward Reference Value.
        </p>
      </Card>

      {/* Positions List */}
      {positions.length > 0 && (
        <Card className="p-4 bg-slate-900 border-slate-700">
          <h3 className="text-sm font-bold text-slate-100 mb-3">Your Positions</h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {positions.map((pos) => (
              <div key={pos.id} className="flex items-center justify-between text-xs border border-slate-700 rounded p-2">
                <div className="flex items-center gap-3">
                  <Badge variant={pos.withdrawn ? 'outline' : pos.isActive ? 'default' : 'secondary'}>
                    {pos.withdrawn ? 'Withdrawn' : pos.isActive ? 'Active' : 'Matured'}
                  </Badge>
                  <span className="font-mono text-slate-300">{formatTokenAmount(pos.amount.toString())} {pos.token}</span>
                  <span className="text-slate-500">{pos.multiplierBps / 100}x · {STAKE_DURATIONS.find((d) => d.secs === pos.durationSecs)?.label || `${pos.durationSecs}s`}</span>
                  {pos.queuedExtension && <Badge variant="outline" className="text-purple-400">ext queued</Badge>}
                </div>
                {pos.isMatured && !pos.withdrawn && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs h-6"
                    onClick={() => { const r = engine.withdrawPosition(pos.id); setResult(r); refresh(); }}
                  >
                    <Unlock className="w-3 h-3 mr-1" /> Withdraw
                  </Button>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Result */}
      {result && (
        <div className={`rounded-lg border p-3 text-xs ${result.ok ? 'border-green-700 bg-green-950/30 text-green-300' : 'border-red-700 bg-red-950/30 text-red-300'}`}>
          {result.ok ? '✓ ' + (result.reason || 'Success') : '✗ ' + result.reason}
        </div>
      )}
    </div>
  );
}