import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { STAKE_DURATIONS } from '@/lib/vfRevision6Authority';
import { formatTokenAmount } from '@/lib/vfTokenEngine';
import { TOKEN_MULTIPLIER_BPS, EPOCH_SECS } from '@/lib/vfStakingEngine';
import { Lock, Unlock, Coins, Clock, AlertCircle, FastForward } from 'lucide-react';

// Simulator panel. Mirrors VinculumFinalisStake: per-position claims up to a
// chosen epoch, token 1x/2x/4x, durations 1.00x/1.40x/1.75x/2.10x.
const multLabel = (bps) => `${(bps / 10000).toFixed(2)}x`;

export default function StakingPanel({ engine, account }) {
  const [, forceUpdate] = useState(0);
  const refresh = () => forceUpdate((v) => v + 1);

  const [token, setToken] = useState('VCLM');
  const [amount, setAmount] = useState('100');
  const [durationIdx, setDurationIdx] = useState(0);
  const [extIdx, setExtIdx] = useState(0);
  const [result, setResult] = useState(null);

  const stats = engine.getStats();
  const currentEpoch = engine.getCurrentEpoch();
  const latest = engine.latestClaimableEpoch();
  const claimable = engine.getClaimableVclm(account);
  const show = (r) => { setResult(r); refresh(); };

  const toUnits = (v) => {
    const [w, f = ''] = String(v).trim().split('.');
    if (!/^\d+$/.test(w || '0') || !/^\d*$/.test(f) || f.length > 18) return -1n;
    return BigInt(w || '0') * 10n ** 18n + BigInt((f + '0'.repeat(18)).slice(0, 18) || '0');
  };

  const handleStake = () => {
    const dur = STAKE_DURATIONS[durationIdx];
    const r = engine.createStakePosition(account, token, toUnits(amount), dur.secs);
    show(r.ok ? { ok: true, reason: `Position ${r.positionId} created` } : r);
  };

  const toClose = stats.lastClosedEpoch + 1;
  // t270u(g): allocation is in strict epoch order. Only the next epoch after the
  // last allocated one is offered, and only once it is closed and N+1 has ended.
  const toAllocate = stats.nextAllocatable.epoch;
  const canAllocate = stats.nextAllocatable.ready;

  const handleClose = () => show(engine.closeEpoch(toClose));
  const handleAllocate = () => {
    const r = engine.allocateEpoch(toAllocate);
    show(r.ok ? { ok: true, reason: `Epoch ${toAllocate} allocated, minted ${formatTokenAmount(r.minted.toString())} VCLM${r.reason ? ' (' + r.reason + ')' : ''}` } : r);
  };
  const handleAdvance = () => { engine.advanceTime(EPOCH_SECS); refresh(); };

  const positions = Array.from(engine.positions.values()).filter((p) => p.owner === account);
  const claimIds = positions.filter((p) => latest > 0 && engine.claimableVclm(p.id, latest) > 0n).map((p) => p.id);

  const handleClaimAll = () => {
    const r = engine.claimPositions(account, claimIds, latest);
    show(r.ok ? { ok: true, reason: `Claimed ${formatTokenAmount(r.amount.toString())} VCLM up to epoch ${latest}` } : r);
  };

  return (
    <div className="space-y-4">
      {stats.terminalState && (
        <div className="rounded-lg border border-red-700 bg-red-950/50 p-3 text-xs text-red-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span><strong>VF-STK-029:</strong> Terminal state. VCLM capacity exhausted. No new positions or extensions. Staked tokens are immediately withdrawable.</span>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3 bg-slate-900 border-slate-700">
          <div className="text-xs text-slate-400">Active Positions</div>
          <div className="text-xl font-bold text-slate-100">{stats.activePositions}</div>
        </Card>
        <Card className="p-3 bg-slate-900 border-slate-700">
          <div className="text-xs text-slate-400">Current Epoch / Last Closed</div>
          <div className="text-xl font-bold text-slate-100">{stats.currentEpoch} / {stats.lastClosedEpoch}</div>
        </Card>
        <Card className="p-3 bg-slate-900 border-slate-700">
          <div className="text-xs text-slate-400">Staked VCLM</div>
          <div className="text-lg font-bold text-amber-400">{formatTokenAmount(stats.staked.VCLM)}</div>
        </Card>
        <Card className="p-3 bg-slate-900 border-slate-700">
          <div className="text-xs text-slate-400">Claimable VCLM (to epoch {latest})</div>
          <div className="text-lg font-bold text-green-400">{formatTokenAmount(claimable.toString())}</div>
        </Card>
      </div>

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
                {Object.entries(TOKEN_MULTIPLIER_BPS).map(([t, bps]) => (
                  <SelectItem key={t} value={t}>{t} ({bps / 10000}x)</SelectItem>
                ))}
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
                  <SelectItem key={i} value={String(i)}>{d.label} ({multLabel(d.multiplier_bps)})</SelectItem>
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
        <p className="text-xs text-slate-500 mt-2">Weight = amount x token multiplier x duration multiplier.</p>
      </Card>

      <Card className="p-4 bg-slate-900 border-slate-700">
        <h3 className="text-sm font-bold text-slate-100 mb-3 flex items-center gap-2">
          <Clock className="w-4 h-4 text-purple-400" /> Epoch Finalization (Two-Phase)
        </h3>
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleClose} variant="outline" size="sm" className="border-slate-600 text-slate-300">
            Close Epoch {toClose} (Phase 1)
          </Button>
          <Button onClick={handleAllocate} disabled={!canAllocate} variant="outline" size="sm" className="border-slate-600 text-slate-300">
            Allocate Epoch {toAllocate} (Phase 2)
          </Button>
          <Button onClick={handleClaimAll} disabled={claimIds.length === 0} variant="outline" size="sm" className="border-green-700 text-green-400">
            <Coins className="w-4 h-4 mr-1" /> Claim all positions to epoch {latest}
          </Button>
          <Button onClick={handleAdvance} variant="ghost" size="sm" className="text-slate-400">
            <FastForward className="w-4 h-4 mr-1" /> Simulate +10 days
          </Button>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          Epoch {currentEpoch} is running. VF-STK-013: allocation of N needs the end of N+1. VF-STK-010 (t270u): epochs are allocated in order, one at a time, by anyone. Claims are per position up to the last allocated epoch (at most current - 2). VF-RAC-005: permanent $0.10 Reward Reference Value.
        </p>
      </Card>

      {positions.length > 0 && (
        <Card className="p-4 bg-slate-900 border-slate-700">
          <h3 className="text-sm font-bold text-slate-100 mb-3">Your Positions</h3>
          <div className="mb-2 flex items-center gap-2 text-xs text-slate-400">
            <span>Extend by</span>
            <Select value={String(extIdx)} onValueChange={(v) => setExtIdx(Number(v))}>
              <SelectTrigger className="bg-slate-800 border-slate-600 h-7 w-40"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-600">
                {STAKE_DURATIONS.map((d, i) => (
                  <SelectItem key={i} value={String(i)}>{d.label} ({multLabel(d.multiplier_bps)})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {positions.map((pos) => {
              const c = latest > 0 ? engine.claimableVclm(pos.id, latest) : 0n;
              return (
                <div key={pos.id} className="flex items-center justify-between text-xs border border-slate-700 rounded p-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-slate-500">#{pos.id}</span>
                    <Badge variant={pos.withdrawn ? 'outline' : pos.isActive ? 'default' : 'secondary'}>
                      {pos.withdrawn ? 'Withdrawn' : pos.isActive ? 'Active' : 'Ended'}
                    </Badge>
                    <span className="font-mono text-slate-300">{formatTokenAmount(pos.amount.toString())} {pos.token}</span>
                    <span className="text-slate-500">{multLabel(pos.multiplierBps)} · {STAKE_DURATIONS.find((d) => d.secs === pos.durationSecs)?.label || `${pos.durationSecs}s`}</span>
                    {pos.queuedExtension && <Badge variant="outline" className="text-purple-400">next term {multLabel(pos.queuedExtensionBps)} queued</Badge>}
                    <span className="text-green-400">claimable {formatTokenAmount(c.toString())} VCLM</span>
                  </div>
                  <div className="flex gap-1">
                    {pos.isActive && !pos.queuedExtension && !stats.terminalState && (
                      <Button size="sm" variant="ghost" className="text-xs h-6" onClick={() => show(engine.queueExtension(account, pos.id, STAKE_DURATIONS[extIdx].secs))}>Extend</Button>
                    )}
                    {pos.queuedExtension && !pos.isActive && !pos.withdrawn && (
                      <Button size="sm" variant="ghost" className="text-xs h-6" onClick={() => show(engine.applyExtensionIfMatured(account, pos.id))}>Start queued term</Button>
                    )}
                    {c > 0n && (
                      <Button size="sm" variant="ghost" className="text-xs h-6 text-green-400" onClick={() => {
                        const r = engine.claimPosition(account, pos.id, latest);
                        show(r.ok ? { ok: true, reason: `Claimed ${formatTokenAmount(r.amount.toString())} VCLM for position ${pos.id}` } : r);
                      }}>Claim</Button>
                    )}
                    {!pos.withdrawn && (pos.isMatured || stats.terminalState) && (
                      <Button size="sm" variant="ghost" className="text-xs h-6" onClick={() => show(engine.withdrawPosition(account, pos.id))}>
                        <Unlock className="w-3 h-3 mr-1" /> Withdraw
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {result && (
        <div className={`rounded-lg border p-3 text-xs ${result.ok ? 'border-green-700 bg-green-950/30 text-green-300' : 'border-red-700 bg-red-950/30 text-red-300'}`}>
          {result.ok ? '✓ ' + (result.reason || 'Success') : '✗ ' + result.reason}
        </div>
      )}
    </div>
  );
}
