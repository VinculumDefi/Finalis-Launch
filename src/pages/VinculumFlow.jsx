import React, { useState, useMemo } from 'react';
import { Eye, ShieldAlert, Lock, Coins, Unlock, AlertTriangle, XCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Link } from 'react-router-dom';
import {
  BASE_CHAIN, PERMITTED_DURATIONS, DEPLOYMENT_STATE, isBaseLockDeployed, isBaseVerifierPresent,
} from '@/lib/vfIntegrationConfig';
import {
  buildCreateNativeLock, buildRelease, computeFee, ethToWei, resolvePageAsset, submitLock, submitRelease,
} from '@/lib/vfBaseEthLock';
import { useApprovedAssetRegistry } from '@/hooks/useApprovedAssetRegistry';

// The asset this page locks: Base native ETH (Revision D row 2), from the active list.

function StatusPill({ ok, children }) {
  return ok
    ? <span className="inline-flex items-center gap-1 text-emerald-600"><CheckCircle2 className="w-4 h-4" />{children}</span>
    : <span className="inline-flex items-center gap-1 text-rose-600"><XCircle className="w-4 h-4" />{children}</span>;
}

const short = (a) => (/^0x[0-9a-fA-F]{40}$/.test(String(a)) ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);

export default function VinculumFlow() {
  const [outputToken, setOutputToken] = useState('VCLM');
  const [durationSecs, setDurationSecs] = useState(604800);
  const [grossEth, setGrossEth] = useState('');
  const [priceUsd, setPriceUsd] = useState('');
  const [baseRecipient, setBaseRecipient] = useState('');
  const [releaseDestination, setReleaseDestination] = useState('');
  const [lockId, setLockId] = useState('');
  const [chonxReceipt, setChonxReceipt] = useState('');

  const [constructed, setConstructed] = useState(null);
  const [submitResult, setSubmitResult] = useState(null);
  const [releaseResult, setReleaseResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const registry = useApprovedAssetRegistry();
  const pageAsset = resolvePageAsset();

  const feePreview = useMemo(() => {
    const wei = ethToWei(grossEth);
    if (wei === null || wei === 0n) return null;
    return computeFee(wei);
  }, [grossEth]);

  async function onConstructAndSubmitLock() {
    setBusy(true); setConstructed(null); setSubmitResult(null);
    const built = buildCreateNativeLock({
      lockId, baseRecipient, outputToken, releaseDestination,
      durationSecs: Number(durationSecs), grossEth, priceUsd, chonxActivationReceipt: chonxReceipt,
    });
    setConstructed(built);
    if (built.ok) setSubmitResult(await submitLock(built));
    setBusy(false);
  }

  async function onRelease() {
    setBusy(true);
    setReleaseResult(await submitRelease(lockId));
    setBusy(false);
  }

  const lockDeployed = isBaseLockDeployed();
  const verifierPresent = isBaseVerifierPresent();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
        {/* Preview banner */}
        <div className="rounded-lg border-2 border-sky-500/60 bg-sky-500/5 p-4 flex items-start gap-3">
          <Eye className="w-6 h-6 text-sky-500 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-sky-700 dark:text-sky-300">Preview. Contract not connected.</p>
            <p className="text-sm text-muted-foreground">
              Mode: <b>{DEPLOYMENT_STATE}</b>. This page builds the exact Base lock call and shows it. Nothing is
              broadcast, and no hash, balance, receipt, lock record or mint result is made up. The new 5% Base lock
              and the Base Verifier are not deployed yet, so sending is blocked and the missing setting is shown.
            </p>
          </div>
        </div>

        <header className="space-y-2">
          <h1 className="text-3xl font-heading font-bold">Vinculum Finalis: Base ETH Lock, Proof, Mint</h1>
          <p className="text-sm text-muted-foreground">
            Source environment: <span className="font-mono">{BASE_CHAIN.environment_id}</span> (chain id {BASE_CHAIN.chain_id}) · asset{' '}
            {pageAsset.ok
              ? <span className="font-mono">ETH, Revision D row {pageAsset.entry.row}</span>
              : <span className="text-rose-600">{pageAsset.reason}</span>}
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            <Link to="/base-verifier"><Button variant="outline" size="sm">Base Verifier</Button></Link>
            <Link to="/token-layer"><Button variant="outline" size="sm">Token Layer</Button></Link>
            <Link to="/stake-layer"><Button variant="outline" size="sm">Stake Layer</Button></Link>
          </div>
        </header>

        {/* Registry status */}
        <div className={`rounded-lg border p-3 flex items-start gap-2 ${
          registry.loading ? 'border-slate-500/50 bg-slate-500/5'
          : registry.error ? 'border-rose-500/50 bg-rose-500/5'
          : 'border-emerald-500/50 bg-emerald-500/5'
        }`}>
          {registry.loading
            ? <AlertTriangle className="w-5 h-5 text-slate-500 mt-0.5 shrink-0" />
            : registry.error
              ? <XCircle className="w-5 h-5 text-rose-500 mt-0.5 shrink-0" />
              : <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0" />}
          <div className="text-sm text-muted-foreground">
            {registry.loading ? (
              <span>Loading hosted asset registry…</span>
            ) : registry.error ? (
              <span>Hosted registry load failed: {registry.error}. The Base ETH lock still uses the active list bundled with the app.</span>
            ) : (
              <>
                <span className="font-medium text-foreground">{registry.count} assets in the hosted registry</span>,{' '}
                {registry.offerable.length} on the active list, {registry.hiddenCount} hidden.
                {registry.sha256 && (
                  <span className="block text-xs mt-0.5">
                    SHA-256: <span className="font-mono">{registry.sha256.slice(0, 16)}…{registry.sha256.slice(-8)}</span>
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        {/* Step 1 - lock parameters */}
        <section className="rounded-lg border bg-card p-4 space-y-4">
          <div className="flex items-center gap-2"><Lock className="w-5 h-5" /><h2 className="text-lg font-heading font-semibold">1. Base lock construction</h2></div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Chain</Label>
              <Select value="base" disabled>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="base">Base (8453)</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Asset</Label>
              <Select value={pageAsset.ok ? 'eth' : undefined} disabled>
                <SelectTrigger><SelectValue placeholder="Not on the active list" /></SelectTrigger>
                <SelectContent>
                  {pageAsset.ok && <SelectItem value="eth">ETH · Base native (row {pageAsset.entry.row})</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Output token</Label>
              <Select value={outputToken} onValueChange={setOutputToken}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="VCLM">VCLM</SelectItem>
                  <SelectItem value="CHONX">CHONX</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Permitted duration</Label>
              <Select value={String(durationSecs)} onValueChange={(v) => setDurationSecs(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PERMITTED_DURATIONS.map((d) => (
                    <SelectItem key={d.secs} value={String(d.secs)}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Gross amount (ETH)</Label>
              <Input value={grossEth} onChange={(e) => setGrossEth(e.target.value)} placeholder="e.g. 0.01" inputMode="decimal" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Scheduled Base ETH price read from the Verifier (USD)</Label>
              <Input value={priceUsd} onChange={(e) => setPriceUsd(e.target.value)} placeholder="required; empty refuses" inputMode="decimal" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Base recipient (0x + 40 hex)</Label>
              <Input value={baseRecipient} onChange={(e) => setBaseRecipient(e.target.value)} placeholder="0x…" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Release destination (0x + 40 hex, must send the release)</Label>
              <Input value={releaseDestination} onChange={(e) => setReleaseDestination(e.target.value)} placeholder="0x…" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Lock ID (0x + 64 hex)</Label>
              <Input value={lockId} onChange={(e) => setLockId(e.target.value)} placeholder="0x…" />
            </div>
            {outputToken === 'CHONX' && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">CHONX activation receipt (VF-COM-025)</Label>
                <Input value={chonxReceipt} onChange={(e) => setChonxReceipt(e.target.value)} placeholder="activation receipt" />
              </div>
            )}
          </div>

          {feePreview && (
            <div className="rounded-md border bg-muted/30 p-3 text-sm font-mono">
              fee = floor(gross × 500 / 10000), every duration: <b>{feePreview.fee}</b> wei · principal{' '}
              <b>{feePreview.principal}</b> wei
            </div>
          )}

          <Button onClick={onConstructAndSubmitLock} disabled={busy || !pageAsset.ok} className="w-full">
            {busy ? 'Working…' : 'Build lock call'}
          </Button>
          <div className="text-xs text-muted-foreground">
            New 5% Base lock: <span className="font-mono">{short(BASE_CHAIN.lock_address)}</span> ·{' '}
            <StatusPill ok={lockDeployed}>{lockDeployed ? 'deployed' : 'pending deployment'}</StatusPill>
          </div>

          {constructed && (
            <div className="rounded-md border p-3 text-xs space-y-1">
              <div className="font-medium">createNativeLock call</div>
              {constructed.ok
                ? <pre className="font-mono whitespace-pre-wrap break-all">{JSON.stringify(constructed.call, null, 2)}</pre>
                : <div className="text-rose-600">{constructed.errors.join('; ')}</div>}
            </div>
          )}
          {submitResult && (
            <div className="rounded-md border p-3 text-xs">
              {submitResult.blocked
                ? <span className="text-amber-600">⚠ {submitResult.reason} <span className="font-mono">[{submitResult.missing}]</span></span>
                : <span className="text-rose-600">{submitResult.reason}</span>}
            </div>
          )}
        </section>

        {/* Step 2 - Base mint */}
        <section className="rounded-lg border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2"><Coins className="w-5 h-5" /><h2 className="text-lg font-heading font-semibold">2. Base verification and mint</h2></div>
          <div className="rounded-md border-2 border-amber-500/50 bg-amber-500/5 p-3 flex items-start gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
            <div className="text-sm text-muted-foreground">
              After a lock confirms, the app reads the lock record, then calls recordFeeAndRac and verifyAndMint on the
              Verifier with one package built from that record. The Base Verifier is{' '}
              <StatusPill ok={verifierPresent}>{verifierPresent ? 'deployed' : 'pending deployment'}</StatusPill>, so this step is not available.
            </div>
          </div>
          <Button disabled className="w-full">Submit to Base Verifier (blocked: pending deployment)</Button>
          <div className="text-xs text-muted-foreground">VCLM / CHONX: <span className="font-mono">{short(BASE_CHAIN.vclm_address)}</span> / <span className="font-mono">{short(BASE_CHAIN.chonx_address)}</span>.</div>
        </section>

        {/* Step 3 - maturity & release */}
        <section className="rounded-lg border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2"><Unlock className="w-5 h-5" /><h2 className="text-lg font-heading font-semibold">3. Maturity and principal release</h2></div>
          <p className="text-sm text-muted-foreground">
            Builds the <span className="font-mono">release(lockId)</span> call. The lock pays only the recorded release
            destination, and only that address can send it, at or after maturity.
          </p>
          <Button onClick={onRelease} disabled={busy || !lockId} variant="outline" className="w-full">
            {busy ? 'Working…' : 'Build release call'}
          </Button>
          {releaseResult && (
            <div className="rounded-md border p-3 text-xs">
              {releaseResult.blocked
                ? <span className="text-amber-600">⚠ {releaseResult.reason} <span className="font-mono">[{releaseResult.missing}]</span></span>
                : <span className="text-rose-600">{releaseResult.reason}</span>}
            </div>
          )}
          {releaseResult && releaseResult.blocked && (
            <pre className="text-xs font-mono bg-muted/30 rounded p-2 whitespace-pre-wrap break-all">{JSON.stringify(buildRelease(lockId), null, 2)}</pre>
          )}
        </section>
      </div>
    </div>
  );
}
