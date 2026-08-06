import React, { useState, useMemo } from 'react';
import { Eye, ShieldAlert, Link2, Lock, FileCheck2, Coins, Unlock, AlertTriangle, XCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Link } from 'react-router-dom';
import {
  COSMOS_HUB, BASE_CHAIN, PERMITTED_DURATIONS, DEPLOYMENT_STATE, isVaultDeployed, isBaseVerifierPresent,
} from '@/lib/vfIntegrationConfig';
import {
  buildCommitVaultLockMsg, buildReleasePrincipalMsg, computeFee, validateBaseRecipient,
  connectKeplr, isKeplrAvailable, submitLock, submitRelease,
} from '@/lib/vfCosmosLock';
import { normalizeLockEvent } from '@/lib/vfProofAdapter';
import { useApprovedAssetRegistry } from '@/hooks/useApprovedAssetRegistry';

function StatusPill({ ok, children }) {
  return ok
    ? <span className="inline-flex items-center gap-1 text-emerald-600"><CheckCircle2 className="w-4 h-4" />{children}</span>
    : <span className="inline-flex items-center gap-1 text-rose-600"><XCircle className="w-4 h-4" />{children}</span>;
}

export default function VinculumFlow() {
  const [outputToken, setOutputToken] = useState('VCLM');
  const [durationSecs, setDurationSecs] = useState(3600);
  const [amountUatom, setAmountUatom] = useState('');
  const [baseRecipient, setBaseRecipient] = useState('');
  const [releaseDestination, setReleaseDestination] = useState('');
  const [lockId, setLockId] = useState('');
  const [chonxReceipt, setChonxReceipt] = useState('');
  const [verifiedUsd, setVerifiedUsd] = useState('');

  const [wallet, setWallet] = useState({ address: null, signer: null });
  const [walletErr, setWalletErr] = useState(null);
  const [connectBusy, setConnectBusy] = useState(false);

  const [constructed, setConstructed] = useState(null);
  const [normalizeResult, setNormalizeResult] = useState(null);
  const [submitResult, setSubmitResult] = useState(null);
  const [releaseResult, setReleaseResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const registry = useApprovedAssetRegistry();
  const [selectedAssetRow, setSelectedAssetRow] = useState(479); // ATOM default

  const feePreview = useMemo(() => {
    if (!amountUatom) return null;
    try { return computeFee(amountUatom, Number(durationSecs)); } catch { return null; }
  }, [amountUatom, durationSecs]);

  async function onConnectWallet() {
    setConnectBusy(true); setWalletErr(null);
    const r = await connectKeplr();
    if (r.ok) setWallet({ address: r.address, signer: r.signer });
    else setWalletErr(r.reason);
    setConnectBusy(false);
  }

  async function onConstructAndSubmitLock() {
    setBusy(true); setConstructed(null); setNormalizeResult(null); setSubmitResult(null);
    const built = buildCommitVaultLockMsg({
      durationSecs: Number(durationSecs),
      baseRecipient, releaseDestination, outputToken,
      verifiedGrossUsdMicro: verifiedUsd, lockId, chonxActivationReceipt: chonxReceipt,
    });
    if (!built.ok) { setConstructed({ ok: false, errors: built.errors }); setBusy(false); return; }
    setConstructed({ ok: true, msg: built.msg });

    // Feed the constructed facts into the REAL existing proof adapter normalizer.
    const facts = {
      source_environment: COSMOS_HUB.source_environment,
      lock_id: lockId,
      canonical_asset: COSMOS_HUB.base_denom,
      source_account: wallet.address || '(wallet not connected)',
      gross_amount: feePreview ? feePreview.gross : '0',
      fee_amount: feePreview ? feePreview.fee : '0',
      principal_amount: feePreview ? feePreview.principal : '0',
      verified_gross_usd_micro: String(verifiedUsd),
      duration_secs: Number(durationSecs),
      creation_time_secs: 0,
      maturity_time_secs: Number(durationSecs),
      base_recipient: baseRecipient,
      release_destination: releaseDestination,
      output_token: outputToken,
      fee_destination: '(set by contract at deployment)',
      fee_transfer_evidence: '(no source transaction — broadcast blocked)',
      handshake_identity: `(${COSMOS_HUB.source_environment}, ${wallet.address || '(no wallet)'})`,
      handshake_allowance_count: 0,
      chonx_activation_receipt: outputToken === 'CHONX' ? chonxReceipt : 'not_applicable',
    };
    setNormalizeResult(normalizeLockEvent(facts));

    // Attempt real submission — blocked at broadcast because the vault is PENDING_DEPLOYMENT.
    const r = await submitLock({
      signer: wallet.signer, senderAddress: wallet.address, msg: built.msg,
      funds: amountUatom ? [{ denom: COSMOS_HUB.base_denom, amount: amountUatom }] : [],
    });
    setSubmitResult(r);
    setBusy(false);
  }

  async function onRelease() {
    setBusy(true); setReleaseResult(null);
    const r = await submitRelease({ signer: wallet.signer, senderAddress: wallet.address, lockId });
    setReleaseResult(r);
    setBusy(false);
  }

  const vaultDeployed = isVaultDeployed();
  const baseVerifierPresent = isBaseVerifierPresent();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
        {/* Preview banner */}
        <div className="rounded-lg border-2 border-sky-500/60 bg-sky-500/5 p-4 flex items-start gap-3">
          <Eye className="w-6 h-6 text-sky-500 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-sky-700 dark:text-sky-300">Preview — contract not connected.</p>
            <p className="text-sm text-muted-foreground">
              Base44 application preview for visual inspection. Mode: <b>{DEPLOYMENT_STATE}</b>. No contract is deployed,
              no blockchain transaction is broadcast, and no hash, balance, receipt, address, lock record, or mint result
              is fabricated. Each button calls a real implemented function; unavailable deployments are blocked at the
              broadcast boundary with the exact missing configuration shown.
            </p>
          </div>
        </div>

        <header className="space-y-2">
          <h1 className="text-3xl font-heading font-bold">Vinculum Finalis — Native Lock → Proof → Base Mint</h1>
          <p className="text-sm text-muted-foreground">
            Source environment: <span className="font-mono">{COSMOS_HUB.source_environment}</span> · asset{' '}
            <span className="font-mono">{COSMOS_HUB.base_denom}</span> ({COSMOS_HUB.asset_symbol}).
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            <Link to="/base-verifier"><Button variant="outline" size="sm">Base Verifier</Button></Link>
            <Link to="/token-layer"><Button variant="outline" size="sm">Token Layer</Button></Link>
            <Link to="/stake-layer"><Button variant="outline" size="sm">Stake Layer</Button></Link>
            <Link to="/solana-lock"><Button variant="outline" size="sm">Solana Lock</Button></Link>
            <Link to="/xrpl-lock"><Button variant="outline" size="sm">XRPL Lock</Button></Link>
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
              <span>Loading authoritative Approved Asset Registry…</span>
            ) : registry.error ? (
              <span>Registry load failed: {registry.error}</span>
            ) : (
              <>
                <span className="font-medium text-foreground">{registry.count} assets loaded</span> from{' '}
                <span className="font-mono text-xs">{registry.url}</span>
                {registry.sha256 && (
                  <span className="block text-xs mt-0.5">
                    SHA-256: <span className="font-mono">{registry.sha256.slice(0, 16)}…{registry.sha256.slice(-8)}</span>
                  </span>
                )}
                {registry.source && (
                  <span className="block text-xs">
                    Governing source: {registry.source.file_name} · {registry.source.revision} · {registry.source.date}
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        {/* Step 1 — lock parameters */}
        <section className="rounded-lg border bg-card p-4 space-y-4">
          <div className="flex items-center gap-2"><Lock className="w-5 h-5" /><h2 className="text-lg font-heading font-semibold">1. Native lock construction</h2></div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Chain</Label>
              <Select value="cosmoshub-4" disabled>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="cosmoshub-4">Cosmos Hub (cosmoshub-4)</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                Asset {registry.loading ? '(loading…)' : `(${registry.count} in registry)`}
              </Label>
              <Select
                value={String(selectedAssetRow)}
                onValueChange={(v) => setSelectedAssetRow(Number(v))}
                disabled={registry.loading || !!registry.error}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {!registry.loading && !registry.error && registry.records.map((r) => (
                    <SelectItem key={r.registry_row} value={String(r.registry_row)}>
                      {r.symbol} · {r.asset_name} ({r.environment}, row {r.registry_row})
                    </SelectItem>
                  ))}
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
              <Label className="text-xs text-muted-foreground">Gross amount ({COSMOS_HUB.base_denom})</Label>
              <Input value={amountUatom} onChange={(e) => setAmountUatom(e.target.value)} placeholder="e.g. 1000000" inputMode="numeric" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Verified gross USD (micro-USD)</Label>
              <Input value={verifiedUsd} onChange={(e) => setVerifiedUsd(e.target.value)} placeholder="e.g. 1000000 ($1.00)" inputMode="numeric" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Base recipient (0x + 40 hex)</Label>
              <Input value={baseRecipient} onChange={(e) => setBaseRecipient(e.target.value)} placeholder="0x…" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Release destination (cosmos1…)</Label>
              <Input value={releaseDestination} onChange={(e) => setReleaseDestination(e.target.value)} placeholder="cosmos1…" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Lock ID</Label>
              <Input value={lockId} onChange={(e) => setLockId(e.target.value)} placeholder="unique lock id" />
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
              fee = floor(gross × bps/10000): <b>{feePreview.fee}</b> {COSMOS_HUB.base_denom} · principal{' '}
              <b>{feePreview.principal}</b> {COSMOS_HUB.base_denom}
            </div>
          )}

          {/* Wallet */}
          <div className="rounded-md border p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm"><Link2 className="w-4 h-4" /> Keplr wallet</div>
              <Button size="sm" onClick={onConnectWallet} disabled={connectBusy || !isKeplrAvailable()}>
                {connectBusy ? 'Connecting…' : wallet.address ? 'Reconnect' : 'Connect Keplr'}
              </Button>
            </div>
            <div className="text-xs text-muted-foreground">
              {isKeplrAvailable() ? (wallet.address ? `Connected: ${wallet.address}` : 'Keplr detected — not yet connected.') : 'Keplr extension not detected in this browser.'}
            </div>
            {walletErr && <div className="text-xs text-rose-600">{walletErr}</div>}
          </div>

          <Button onClick={onConstructAndSubmitLock} disabled={busy} className="w-full">
            {busy ? 'Working…' : 'Construct & submit lock'}
          </Button>
          <div className="text-xs text-muted-foreground">
            Vault contract address: <span className="font-mono">{COSMOS_HUB.vault_contract_address}</span> ·{' '}
            <StatusPill ok={vaultDeployed}>{vaultDeployed ? 'deployed' : 'pending deployment'}</StatusPill>
          </div>

          {constructed && (
            <div className="rounded-md border p-3 text-xs space-y-1">
              <div className="font-medium">Constructed ExecuteMsg</div>
              {constructed.ok
                ? <pre className="font-mono whitespace-pre-wrap break-all">{JSON.stringify(constructed.msg, null, 2)}</pre>
                : <div className="text-rose-600">{constructed.errors.join('; ')}</div>}
            </div>
          )}
          {submitResult && (
            <div className="rounded-md border p-3 text-xs">
              {submitResult.blocked
                ? <span className="text-amber-600">⚠ {submitResult.reason} <span className="font-mono">[{submitResult.missing}]</span></span>
                : (submitResult.ok ? <span className="text-emerald-600">Submitted.</span> : <span className="text-rose-600">{submitResult.reason}</span>)}
            </div>
          )}
        </section>

        {/* Step 2 — proof */}
        <section className="rounded-lg border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2"><FileCheck2 className="w-5 h-5" /><h2 className="text-lg font-heading font-semibold">2. Proof normalization (existing adapter)</h2></div>
          <p className="text-sm text-muted-foreground">
            The constructed lock facts are fed to the real existing proof adapter
            (<span className="font-mono">src/cosmos-hub-proof-adapter</span>, ported to the client). No proof is marked
            complete without a real finalized source transaction.
          </p>
          {normalizeResult ? (
            <div className="rounded-md border p-3 text-xs">
              <StatusPill ok={normalizeResult.ok}>{normalizeResult.ok ? 'facts normalized' : 'normalization failed'}</StatusPill>
              {normalizeResult.errors && <pre className="font-mono mt-1 text-rose-600">{normalizeResult.errors.join('\n')}</pre>}
              {normalizeResult.facts && <pre className="font-mono mt-1 whitespace-pre-wrap break-all">{JSON.stringify(normalizeResult.facts, null, 2)}</pre>}
            </div>
          ) : <div className="text-xs text-muted-foreground">Awaiting lock construction.</div>}
          <div className="text-xs text-amber-600">Source finality: no real source transaction exists (broadcast blocked) — proof status awaiting.</div>
        </section>

        {/* Step 3 — Base mint */}
        <section className="rounded-lg border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2"><Coins className="w-5 h-5" /><h2 className="text-lg font-heading font-semibold">3. Base proof-verification &amp; mint</h2></div>
          <div className="rounded-md border-2 border-rose-500/50 bg-rose-500/5 p-3 flex items-start gap-2">
            <ShieldAlert className="w-5 h-5 text-rose-500 mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-semibold text-rose-600">Genuine missing component — cannot be implemented without inventing it.</p>
              <p className="text-muted-foreground">
                No Base-chain (Solidity/EVM) proof-verifier or minting contract, ABI, or deployed address exists anywhere
                in the accessible workspace. <span className="font-mono">BASE_CHAIN.proof_verifier_address</span> ={' '}
                <span className="font-mono">{BASE_CHAIN.proof_verifier_address}</span>;{' '}
                <span className="font-mono">proof_verifier_abi</span> = <span className="font-mono">{BASE_CHAIN.proof_verifier_abi}</span>.
                Constructing a real proof-submission call is impossible because the entry point does not exist; inventing
                an ABI or contract is prohibited.
              </p>
            </div>
          </div>
          <Button disabled className="w-full">Submit proof to Base verifier (blocked: no contract/ABI)</Button>
          <div className="text-xs text-muted-foreground">VCLM / CHONX / SYNTH addresses: all <span className="font-mono">PENDING_DEPLOYMENT</span>.</div>
        </section>

        {/* Step 4 — maturity & release */}
        <section className="rounded-lg border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2"><Unlock className="w-5 h-5" /><h2 className="text-lg font-heading font-semibold">4. Maturity &amp; principal release</h2></div>
          <p className="text-sm text-muted-foreground">
            Constructs the real <span className="font-mono">release_principal</span> message; broadcast is blocked at the
            same vault-address boundary.
          </p>
          <Button onClick={onRelease} disabled={busy || !lockId} variant="outline" className="w-full">
            {busy ? 'Working…' : 'Construct & release principal'}
          </Button>
          {releaseResult && (
            <div className="rounded-md border p-3 text-xs">
              {releaseResult.blocked
                ? <span className="text-amber-600">⚠ {releaseResult.reason} <span className="font-mono">[{releaseResult.missing}]</span></span>
                : (releaseResult.ok ? <span className="text-emerald-600">Released.</span> : <span className="text-rose-600">{releaseResult.reason}</span>)}
            </div>
          )}
          {releaseResult && releaseResult.blocked && (
            <pre className="text-xs font-mono bg-muted/30 rounded p-2 whitespace-pre-wrap break-all">{JSON.stringify(buildReleasePrincipalMsg(lockId), null, 2)}</pre>
          )}
        </section>
      </div>
    </div>
  );
}