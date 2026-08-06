import React from 'react';
import { ShieldAlert, AlertTriangle, CheckCircle2, XCircle, FileText, Database, ArrowRight, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';
import { COSMOS_HUB_CANDIDATE as C } from '@/lib/cosmosCandidateData';

export default function CosmosHubCandidate() {
  const statusIcon = (s) =>
    s === 'resolved' ? <CheckCircle2 className="w-5 h-5 text-emerald-500" />
    : s === 'partial' ? <AlertTriangle className="w-5 h-5 text-amber-500" />
    : <XCircle className="w-5 h-5 text-rose-500" />;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-5xl mx-auto px-4 py-10 space-y-8">
        <div className="rounded-lg border-2 border-sky-500/60 bg-sky-500/5 p-4 flex items-start gap-3">
          <Eye className="w-6 h-6 text-sky-500 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-sky-700 dark:text-sky-300">Preview — contract not connected.</p>
            <p className="text-sm text-muted-foreground">
              Base44 application preview for visual inspection only. No CosmWasm contract is deployed, no
              blockchain transactions are broadcast, and no wallet, seed phrase, or deployer credential is used.
              No transaction hash, balance, contract address, lock record, or mainnet status is represented as live.
            </p>
          </div>
        </div>

        <div className="rounded-lg border-2 border-rose-500/60 bg-rose-500/5 p-4 flex items-start gap-3">
          <ShieldAlert className="w-6 h-6 text-rose-500 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-rose-600 dark:text-rose-400">{C.label}</p>
            <p className="text-sm text-muted-foreground">
              Clean-room Cosmos Hub candidate for the Vinculum Finalis protocol. Not production-ready.
              Not deployment-ready. No broadcast authorized.
            </p>
          </div>
        </div>

        <header className="space-y-2">
          <h1 className="text-3xl font-heading font-bold">Cosmos Hub Commitment Vault — Candidate</h1>
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/10 border border-amber-500/40 px-3 py-1 text-sm font-medium text-amber-700 dark:text-amber-300">
            <AlertTriangle className="w-4 h-4" /> Verdict: {C.verdict}
          </div>
        </header>

        <section className="grid sm:grid-cols-2 gap-4">
          <div className="rounded-lg border bg-card p-4 space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground text-sm"><Database className="w-4 h-4" /> Environment</div>
            <p className="font-mono text-sm">chain_id: {C.environment.chain_id}</p>
            <p className="font-mono text-sm">base_denom: {C.environment.base_denom}</p>
            <p className="font-mono text-sm">asset: {C.environment.asset}</p>
            <p className="font-mono text-sm">registry row: {C.environment.registry_row}</p>
          </div>
          <div className="rounded-lg border bg-card p-4 space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground text-sm"><FileText className="w-4 h-4" /> Mechanism</div>
            <p className="text-sm">{C.environment.mechanism}</p>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-heading font-semibold mb-3">Evidence gates (C1–C7)</h2>
          <ul className="space-y-2">
            {C.evidence.map((e) => (
              <li key={e.id} className="flex items-start gap-3 rounded-lg border bg-card p-3">
                {statusIcon(e.status)}
                <div>
                  <p className="font-medium text-sm">{e.id} — {e.name} <span className="text-xs uppercase tracking-wide text-muted-foreground ml-1">{e.status}</span></p>
                  <p className="text-sm text-muted-foreground">{e.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-heading font-semibold mb-3">Test results</h2>
          <div className="space-y-2">
            {C.testResults.map((t) => (
              <div key={t.suite} className="flex items-center justify-between rounded-lg border bg-card p-3">
                <span className="text-sm font-mono">{t.suite}</span>
                <span className={`text-sm font-medium ${t.executed ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {t.executed ? `${t.passed}/${t.total} passed` : 'not executed'}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border bg-card p-4 space-y-2">
          <h2 className="text-xl font-heading font-semibold">Pinned versions</h2>
          <ul className="text-sm font-mono space-y-1">
            {Object.entries(C.versions).map(([k, v]) => (
              <li key={k}><span className="text-muted-foreground">{k}:</span> {v}</li>
            ))}
          </ul>
        </section>

        <footer className="text-sm text-muted-foreground space-y-1">
          <p>Artifacts: {C.artifacts.join(', ')}</p>
          <p>Download: <span className="font-mono">{C.download}</span></p>
          <Link to="/" className="inline-flex items-center gap-1 text-primary hover:underline mt-2">
            Back to home <ArrowRight className="w-4 h-4" />
          </Link>
        </footer>
      </div>
    </div>
  );
}