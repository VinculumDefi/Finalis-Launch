import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { COMMITMENT_DURATIONS } from '@/lib/vfRevision6Authority';
import { SOLANA_REGISTRY } from '@/lib/vfSolanaRegistry';

export default function LockConfigForm({ values, onChange }) {
  const set = (key) => (e) => onChange({ ...values, [key]: e?.target ? e.target.value : e });

  return (
    <div className="grid sm:grid-cols-2 gap-3">
      <div className="space-y-1">
        <Label className="text-xs text-[#6b6b65]">Source asset (VF-REG-001)</Label>
        <Select value={values.assetSymbol} onValueChange={set('assetSymbol')}>
          <SelectTrigger><SelectValue placeholder="Select Solana asset…" /></SelectTrigger>
          <SelectContent className="max-h-72">
            {SOLANA_REGISTRY.map((a) => (
              <SelectItem key={a.registry_row} value={a.symbol}>
                {a.symbol} · {a.asset_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="text-xs text-[#6b6b65]">Duration (VF-COM-001/002)</Label>
        <Select value={String(values.durationSecs)} onValueChange={(v) => onChange({ ...values, durationSecs: Number(v) })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent className="max-h-72">
            {COMMITMENT_DURATIONS.map((d) => (
              <SelectItem key={d.secs} value={String(d.secs)}>
                {d.label} · {(d.multiplier_bps / 10000).toFixed(2)}x ({d.role})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="text-xs text-[#6b6b65]">Output token (VF-COM-020)</Label>
        <Select value={values.outputToken} onValueChange={set('outputToken')}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="VCLM">VCLM</SelectItem>
            <SelectItem value="CHONX">CHONX (requires activation — VF-TOK-002)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="text-xs text-[#6b6b65]">Gross asset units (VF-COM-010/011)</Label>
        <Input value={values.grossAssetUnits} onChange={set('grossAssetUnits')} placeholder="e.g. 5000000000 (5 SOL in lamports)" inputMode="numeric" />
      </div>

      <div className="space-y-1">
        <Label className="text-xs text-[#6b6b65]">SIMULATION — Verified Gross USD Value ($)</Label>
        <Input value={values.verifiedGrossUsd} onChange={set('verifiedGrossUsd')} placeholder="e.g. 1.00 or 10.50" inputMode="decimal" />
        <p className="text-[10px] text-[#6b6b65]">Price lookup simulated. VF-COM-003: Handshake $0.95–$1.05. VF-COM-009: Standard ≥ $10.00.</p>
      </div>

      <div className="space-y-1">
        <Label className="text-xs text-[#6b6b65]">SIMULATION — Days since protocol launch (VF-TOK-008/009 decay)</Label>
        <Input value={values.daysSinceLaunch} onChange={set('daysSinceLaunch')} placeholder="e.g. 0 (launch) or 60 (2 decay periods)" inputMode="numeric" />
      </div>

      <div className="space-y-1">
        <Label className="text-xs text-[#6b6b65]">Base recipient — 0x + 40 hex (VF-ARC-006)</Label>
        <Input value={values.baseRecipient} onChange={set('baseRecipient')} placeholder="0x…" />
      </div>

      <div className="space-y-1">
        <Label className="text-xs text-[#6b6b65]">Release destination — Solana address (VF-PRI-003)</Label>
        <Input value={values.releaseDestination} onChange={set('releaseDestination')} placeholder="Solana base58 address" />
      </div>

      <div className="space-y-1">
        <Label className="text-xs text-[#6b6b65]">Source account — Solana address (VF-COM-005 identity)</Label>
        <Input value={values.sourceAccount} onChange={set('sourceAccount')} placeholder="Solana base58 address" />
      </div>

      {values.outputToken === 'CHONX' && (
        <div className="space-y-1">
          <Label className="text-xs text-[#6b6b65]">CHONX activation receipt (VF-COM-025)</Label>
          <Input value={values.chonxActivationReceipt} onChange={set('chonxActivationReceipt')} placeholder="activation receipt string" />
        </div>
      )}

      <div className="space-y-1">
        <Label className="text-xs text-[#6b6b65]">SIMULATION — Cumulative lifetime VCLM issued (VF-TOK-002 activation)</Label>
        <Input value={values.cumulativeVclmIssued} onChange={set('cumulativeVclmIssued')} placeholder="e.g. 0 (pre-activation) or 10000000 (CHONX activated)" inputMode="numeric" />
      </div>
    </div>
  );
}