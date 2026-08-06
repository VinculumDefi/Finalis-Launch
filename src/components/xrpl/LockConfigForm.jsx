import React from 'react';
import { COMMITMENT_DURATIONS, HANDSHAKE_DURATION_SECS } from '@/lib/vfRevision6Authority';
import { XRPL_REGISTRY } from '@/lib/vfXrplRegistry';

export default function LockConfigForm({ values, onChange }) {
  function set(key, val) {
    onChange({ ...values, [key]: val });
  }

  return (
    <div className="space-y-3">
      {/* Asset */}
      <div>
        <label className="text-xs font-medium text-[#6b6b65] mb-1 block">Source Asset (VF-REG-001)</label>
        <select
          value={values.assetSymbol}
          onChange={(e) => set('assetSymbol', e.target.value)}
          className="w-full rounded-md border border-[#18324b]/20 bg-white px-3 py-2 text-sm"
        >
          <option value="">Select asset…</option>
          {XRPL_REGISTRY.map((a) => (
            <option key={a.symbol} value={a.symbol}>
              {a.symbol} — {a.asset_name} (class {a.class})
            </option>
          ))}
        </select>
      </div>

      {/* Duration */}
      <div>
        <label className="text-xs font-medium text-[#6b6b65] mb-1 block">Duration (VF-COM-001)</label>
        <select
          value={values.durationSecs}
          onChange={(e) => set('durationSecs', Number(e.target.value))}
          className="w-full rounded-md border border-[#18324b]/20 bg-white px-3 py-2 text-sm"
        >
          {COMMITMENT_DURATIONS.map((d) => (
            <option key={d.secs} value={d.secs}>
              {d.label} ({d.multiplier_bps / 100}x){d.secs === HANDSHAKE_DURATION_SECS ? ' — Handshake' : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Output token */}
      <div>
        <label className="text-xs font-medium text-[#6b6b65] mb-1 block">Output Token (VF-COM-020)</label>
        <select
          value={values.outputToken}
          onChange={(e) => set('outputToken', e.target.value)}
          className="w-full rounded-md border border-[#18324b]/20 bg-white px-3 py-2 text-sm"
        >
          <option value="VCLM">VCLM</option>
          <option value="CHONX">CHONX (requires activation)</option>
        </select>
      </div>

      {/* CHONX activation receipt */}
      {values.outputToken === 'CHONX' && (
        <div>
          <label className="text-xs font-medium text-[#6b6b65] mb-1 block">CHONX Activation Receipt (VF-COM-025)</label>
          <input
            type="text"
            value={values.chonxActivationReceipt}
            onChange={(e) => set('chonxActivationReceipt', e.target.value)}
            placeholder="Causal activation receipt hash/block"
            className="w-full rounded-md border border-[#18324b]/20 bg-white px-3 py-2 text-sm font-mono"
          />
        </div>
      )}

      {/* Numeric inputs */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-[#6b6b65] mb-1 block">Gross Amount (drops)</label>
          <input
            type="text"
            value={values.grossAssetUnits}
            onChange={(e) => set('grossAssetUnits', e.target.value)}
            placeholder="e.g. 1000000 (1 XRP)"
            className="w-full rounded-md border border-[#18324b]/20 bg-white px-3 py-2 text-sm font-mono"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-[#6b6b65] mb-1 block">Verified Gross USD</label>
          <input
            type="text"
            value={values.verifiedGrossUsd}
            onChange={(e) => set('verifiedGrossUsd', e.target.value)}
            placeholder="e.g. 0.50 or 15.00"
            className="w-full rounded-md border border-[#18324b]/20 bg-white px-3 py-2 text-sm font-mono"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-[#6b6b65] mb-1 block">Days Since Launch</label>
          <input
            type="text"
            value={values.daysSinceLaunch}
            onChange={(e) => set('daysSinceLaunch', e.target.value)}
            className="w-full rounded-md border border-[#18324b]/20 bg-white px-3 py-2 text-sm font-mono"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-[#6b6b65] mb-1 block">Cumulative VCLM Issued</label>
          <input
            type="text"
            value={values.cumulativeVclmIssued}
            onChange={(e) => set('cumulativeVclmIssued', e.target.value)}
            className="w-full rounded-md border border-[#18324b]/20 bg-white px-3 py-2 text-sm font-mono"
          />
        </div>
      </div>

      {/* Addresses */}
      <div>
        <label className="text-xs font-medium text-[#6b6b65] mb-1 block">Source Account (XRPL r-address — VF-COM-005)</label>
        <input
          type="text"
          value={values.sourceAccount}
          onChange={(e) => set('sourceAccount', e.target.value)}
          placeholder="r..."
          className="w-full rounded-md border border-[#18324b]/20 bg-white px-3 py-2 text-sm font-mono"
        />
      </div>

      <div>
        <label className="text-xs font-medium text-[#6b6b65] mb-1 block">Base Recipient (EVM 0x-address — VF-ARC-006)</label>
        <input
          type="text"
          value={values.baseRecipient}
          onChange={(e) => set('baseRecipient', e.target.value)}
          placeholder="0x..."
          className="w-full rounded-md border border-[#18324b]/20 bg-white px-3 py-2 text-sm font-mono"
        />
      </div>

      <div>
        <label className="text-xs font-medium text-[#6b6b65] mb-1 block">Release Destination (XRPL r-address — VF-PRI-003)</label>
        <input
          type="text"
          value={values.releaseDestination}
          onChange={(e) => set('releaseDestination', e.target.value)}
          placeholder="r..."
          className="w-full rounded-md border border-[#18324b]/20 bg-white px-3 py-2 text-sm font-mono"
        />
      </div>
    </div>
  );
}