import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatTokenAmount } from '@/lib/vfTokenEngine';
import { ArrowRight, Lock, CheckCircle2, XCircle } from 'lucide-react';

const STEPS = [
  { key: 'lock', label: 'Source Lock', req: 'VF-COM-001' },
  { key: 'normalize', label: 'Normalize', req: 'VF-XCH-011' },
  { key: 'verify', label: 'Verify Proof', req: 'VF-XCH-006' },
  { key: 'mint', label: 'Mint Token', req: 'VF-COM-018' },
  { key: 'forge', label: 'Forge SYNTH', req: 'VF-TOK-004' },
];

export default function IssuancePipeline({ pipeline }) {
  return (
    <Card className="p-5 bg-slate-900 border-slate-700">
      <h3 className="text-lg font-bold text-slate-100 mb-4">Issuance Pipeline</h3>
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {STEPS.map((step, i) => {
          const state = pipeline[step.key] || { status: 'pending' };
          return (
            <React.Fragment key={step.key}>
              <div className="flex flex-col items-center min-w-[120px]">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                  state.status === 'done' ? 'bg-green-600 border-green-400' :
                  state.status === 'active' ? 'bg-blue-600 border-blue-400 animate-pulse' :
                  state.status === 'failed' ? 'bg-red-600 border-red-400' :
                  'bg-slate-800 border-slate-600'
                }`}>
                  {state.status === 'done' ? <CheckCircle2 className="w-5 h-5 text-white" /> :
                   state.status === 'failed' ? <XCircle className="w-5 h-5 text-white" /> :
                   state.status === 'pending' ? <Lock className="w-4 h-4 text-slate-500" /> :
                   <span className="text-white text-sm font-bold">{i + 1}</span>}
                </div>
                <p className="text-xs text-slate-300 mt-1 text-center font-medium">{step.label}</p>
                <p className="text-[10px] text-slate-500">{step.req}</p>
                {state.detail && (
                  <p className="text-[10px] text-slate-400 mt-1 text-center font-mono max-w-[120px] truncate">{state.detail}</p>
                )}
              </div>
              {i < STEPS.length - 1 && <ArrowRight className="w-4 h-4 text-slate-600 flex-shrink-0" />}
            </React.Fragment>
          );
        })}
      </div>

      {pipeline.result && (
        <div className={`mt-4 rounded p-3 text-sm ${pipeline.result.ok ? 'bg-green-900/30 text-green-300' : 'bg-red-900/30 text-red-300'}`}>
          {pipeline.result.ok ? (
            <div className="space-y-1">
              <p>✓ Decision: ISSUE</p>
              <p>Token: {pipeline.result.issuance.token}</p>
              <p>Amount: {formatTokenAmount(pipeline.result.issuance.amount)} {pipeline.result.issuance.token}</p>
              <p>Recipient: {pipeline.result.issuance.recipient.slice(0, 10)}...{pipeline.result.issuance.recipient.slice(-6)}</p>
            </div>
          ) : (
            <p>✗ Decision: REJECT — {pipeline.result.reason}</p>
          )}
        </div>
      )}
    </Card>
  );
}