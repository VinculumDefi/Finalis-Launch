import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { StakingEngine } from '@/lib/vfStakingEngine';
import StakingPanel from '@/components/staking/StakingPanel';
import { Link } from 'react-router-dom';
import { Lock, ShieldCheck } from 'lucide-react';

export default function StakeLayer() {
  const [engine] = useState(() => new StakingEngine());
  const [account] = useState('0x' + 'a'.repeat(40));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="border-b border-slate-800 bg-slate-900/50">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Lock className="w-7 h-7 text-purple-400" />
                Treasury Reward Stake
              </h1>
              <p className="text-sm text-slate-400 mt-1">BASE-STAKE + BASE-EPOCH — Staking, epoch finalization, and reward allocation (Revision 6)</p>
            </div>
            <div className="flex gap-2">
              <Link to="/token-layer">
                <Button variant="outline" size="sm" className="border-slate-700 text-slate-300">
                  <ShieldCheck className="w-4 h-4 mr-1" /> Token Layer
                </Button>
              </Link>
              <Link to="/">
                <Button variant="ghost" size="sm" className="text-slate-400">Home</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 text-xs text-slate-400">
          <span className="text-blue-400 font-semibold mr-2">VF-STK-001–031</span>
          Stake positions (VCLM/CHONX/SYNTH) · 30/60/90/120d durations · two-phase epoch (close N / allocate after N+1) · permanent $0.10 Reward Reference Value · proportional distribution · claimable VCLM · queued extensions · terminal state at zero VCLM capacity.
        </div>

        <StakingPanel engine={engine} account={account} />
      </div>
    </div>
  );
}