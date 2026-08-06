import React from 'react';
import { FileCode, Key, ListChecks, AlertTriangle, Lock } from 'lucide-react';
import { XRPL_ENVIRONMENT, XRPL_DROPS_PER_XRP, XRPL_EPOCH_OFFSET } from '@/lib/vfXrplAuthority';

const TRANSACTIONS = [
  { name: 'Payment (fee routing)', txType: 'Payment', reqs: 'VF-FEE-001..006, VF-COM-004', fields: 'Account, Amount (fee drops), Destination (Dev Fund), Sequence, LastLedgerSequence' },
  { name: 'EscrowCreate (principal lock)', txType: 'EscrowCreate', reqs: 'VF-COM-016, VF-PRI-001, VF-XCH-005/011/013', fields: 'Account, Amount (principal drops), Destination (release), FinishAfter, Memos, Sequence, LastLedgerSequence. NO CancelAfter.' },
  { name: 'EscrowFinish (permissionless release)', txType: 'EscrowFinish', reqs: 'VF-PRI-002..006, VF-SEC-006', fields: 'Account (anyone), Owner (source), OfferSequence, Fee. No Condition (time-based only).' },
];

const DESIGN_RULES = [
  { rule: 'Atomic batch', desc: 'Payment + EscrowCreate with linked Sequence + shared LastLedgerSequence', status: 'DESIGN DEFINED' },
  { rule: 'No EscrowCancel', desc: 'VF-COM-016: early-cancel path removed from recognized design', status: 'RESOLVED' },
  { rule: '1-use Handshake', desc: 'VF-COM-006 Q.2: 1-use Base recognition counter for XRPL', status: 'RESOLVED' },
  { rule: 'LLS expiry', desc: 'VF-COM-007/008: LastLedgerSequence expiry = objective invalidation', status: 'RESOLVED' },
  { rule: 'Validated finality', desc: 'VF-XCH-006/010: XRPL validated ledger = immutable, no reorgs', status: 'RESOLVED' },
];

const FILES = [
  'package.json',
  'README.md',
  'tsconfig.json',
  'tests/escrow.test.js',
  'migrations/deploy-guide.md',
];

export default function TransactionStructure() {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-[#18324b]/20 bg-white p-4 space-y-4">
        <div className="flex items-center gap-2">
          <FileCode className="w-5 h-5 text-[#18324b]" />
          <h3 className="text-sm font-semibold text-[#18324b]">XRPL Transaction Structure — Native Escrow</h3>
        </div>

        <div className="text-xs space-y-1 font-mono">
          <div><span className="text-[#6b6b65]">Environment:</span> <span className="text-[#0a0a0a]">{XRPL_ENVIRONMENT.name}</span> ({XRPL_ENVIRONMENT.family})</div>
          <div><span className="text-[#6b6b65]">Mechanism:</span> <span className="text-[#0a0a0a]">EscrowCreate / EscrowFinish (native XRPL Escrow)</span></div>
          <div><span className="text-[#6b6b65]">Asset support:</span> <span className="text-[#0a0a0a]">Native XRP only (drops)</span> — 1 XRP = {XRPL_DROPS_PER_XRP.toLocaleString()} drops</div>
          <div><span className="text-[#6b6b65]">XRPL Epoch offset:</span> <span className="text-[#0a0a0a]">{XRPL_EPOCH_OFFSET}</span> seconds (Jan 1, 2000 UTC)</div>
          <div><span className="text-[#6b6b65]">EscrowCancel:</span> <span className="text-rose-600">DISABLED</span> (VF-COM-016)</div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-[#18324b]">
            <ListChecks className="w-3.5 h-3.5" /> Transaction Types
          </div>
          <div className="rounded-md border divide-y">
            {TRANSACTIONS.map((tx) => (
              <div key={tx.name} className="p-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-[#0a0a0a]">{tx.name}</span>
                  <span className="font-mono text-[#18324b]">{tx.txType}</span>
                </div>
                <div className="text-[#6b6b65] mt-0.5">{tx.reqs}</div>
                <div className="font-mono text-[10px] text-[#18324b] mt-0.5">{tx.fields}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-[#18324b]">
            <Key className="w-3.5 h-3.5" /> Design Rules
          </div>
          <div className="rounded-md border divide-y">
            {DESIGN_RULES.map((d) => (
              <div key={d.rule} className="p-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-[#0a0a0a]">{d.rule}</span>
                  <span className={`font-mono ${d.status === 'RESOLVED' ? 'text-emerald-600' : 'text-amber-600'}`}>{d.status}</span>
                </div>
                <div className="text-[#6b6b65] mt-0.5">{d.desc}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-[#18324b]">
            <Lock className="w-3.5 h-3.5" /> Files ({FILES.length})
          </div>
          <div className="rounded-md border p-2 max-h-40 overflow-auto">
            <div className="grid grid-cols-1 gap-0.5">
              {FILES.map((f) => (
                <div key={f} className="text-xs font-mono text-[#6b6b65]">
                  <span className="text-[#18324b]">src/xrpl-lock/</span>{f}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-amber-500/40 bg-amber-50 p-3 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
        <p className="text-xs text-amber-800">
          <b>Build and tests NOT executed.</b> The Base44 environment has no xrpl.js toolchain or XRPL CLI.
          Transaction objects are constructed as JSON for inspection. Signing, submission, and ledger
          verification require a native XRPL development environment with the <span className="font-mono">xrpl</span> npm package.
        </p>
      </div>
    </div>
  );
}