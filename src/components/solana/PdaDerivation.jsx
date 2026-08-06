import React, { useState, useEffect } from 'react';
import { KeyRound, Loader2, Search, CheckCircle2, XCircle, ArrowRight } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import {
  PROGRAM_ID,
  deriveConfigPda,
  deriveLockPda,
  deriveHandshakePda,
  isValidAddress,
} from '@/lib/vfSolanaProgram';

export default function PdaDerivation({ lockId, sourceAccount }) {
  const [pdaResults, setPdaResults] = useState(null);
  const [querying, setQuerying] = useState(false);
  const [queryResult, setQueryResult] = useState(null);
  const [queryTarget, setQueryTarget] = useState(null);

  // Derive PDAs whenever inputs change
  useEffect(() => {
    let cancelled = false;

    async function derive() {
      const results = {};

      // Config PDA (always derivable)
      try {
        const [pda, bump] = deriveConfigPda();
        results.config = { pda: pda.toBase58(), bump };
      } catch (e) {
        results.config = { error: e.message };
      }

      // Lock record PDA (needs lockId)
      if (lockId && lockId.trim()) {
        try {
          const [pda, bump] = await deriveLockPda(lockId.trim());
          results.lock = { pda: pda.toBase58(), bump, lockId: lockId.trim() };
        } catch (e) {
          results.lock = { error: e.message };
        }
      }

      // Handshake allowance PDA (needs valid sourceAccount)
      if (sourceAccount && sourceAccount.trim() && isValidAddress(sourceAccount.trim())) {
        try {
          const [pda, bump] = deriveHandshakePda(sourceAccount.trim());
          results.handshake = { pda: pda.toBase58(), bump, sourceAccount: sourceAccount.trim() };
        } catch (e) {
          results.handshake = { error: e.message };
        }
      }

      if (!cancelled) {
        setPdaResults(results);
        setQueryResult(null);
      }
    }

    derive();
    return () => { cancelled = true; };
  }, [lockId, sourceAccount]);

  async function handleQuery(pdaAddress, label) {
    setQuerying(true);
    setQueryResult(null);
    setQueryTarget(label);
    try {
      const response = await base44.functions.invoke('solanaVaultQuery', { pda: pdaAddress });
      setQueryResult({ label, ...response.data });
    } catch (e) {
      setQueryResult({ label, error: e.message });
    }
    setQuerying(false);
  }

  function PdaRow({ label, result }) {
    if (!result) return null;
    if (result.error) {
      return (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">
          {label}: {result.error}
        </div>
      );
    }
    const isQueryingThis = querying && queryTarget === label;
    return (
      <div className="rounded-md border p-2 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-[#18324b]">{label}</span>
          <span className="text-[10px] text-[#6b6b65] font-mono">bump: {result.bump}</span>
        </div>
        <div className="font-mono text-[10px] text-[#0a0a0a] break-all bg-[#f5f5f0] rounded px-1.5 py-1">
          {result.pda}
        </div>
        <button
          onClick={() => handleQuery(result.pda, label)}
          disabled={querying}
          className="w-full flex items-center justify-center gap-1 text-[10px] text-[#18324b] hover:text-[#0a0a0a] disabled:opacity-50 py-0.5"
        >
          {isQueryingThis ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
          Query on-chain (finalized)
        </button>
      </div>
    );
  }

  function QueryResultDisplay() {
    if (!queryResult) return null;
    const { label, exists, error, lamports, owner, rpcEndpoint, slot } = queryResult;
    if (error) {
      return (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">
          <b>{label}:</b> {error}
        </div>
      );
    }
    return (
      <div className="rounded-md border p-2 space-y-1">
        <div className="flex items-center gap-1.5 text-xs font-medium">
          {exists
            ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            : <XCircle className="w-3.5 h-3.5 text-amber-500" />}
          <span className={exists ? 'text-emerald-700' : 'text-amber-600'}>
            {label}: {exists ? 'account exists' : 'not found (program not deployed or no lock)'}
          </span>
        </div>
        {exists && (
          <div className="text-[10px] font-mono text-[#6b6b65] space-y-0.5">
            <div>lamports: {lamports?.toLocaleString()}</div>
            <div>owner: {owner}</div>
          </div>
        )}
        <div className="text-[10px] text-[#6b6b65]">
          RPC: {rpcEndpoint} · slot: {slot?.toLocaleString()}
        </div>
        {!exists && (
          <div className="text-[10px] text-amber-600">
            Expected — program ID is a placeholder. After deployment, replace PROGRAM_ID
            and re-derive PDAs to query live state.
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[#18324b]/20 bg-white p-4 space-y-3">
      <div className="flex items-center gap-2">
        <KeyRound className="w-5 h-5 text-[#18324b]" />
        <h3 className="text-sm font-semibold text-[#18324b]">Live PDA Derivation</h3>
        <span className="text-[10px] text-[#6b6b65] ml-auto">via @solana/web3.js</span>
      </div>

      <div className="text-[10px] font-mono text-[#6b6b65]">
        Program ID: <span className="text-[#18324b]">{PROGRAM_ID}</span>
      </div>

      <div className="space-y-2">
        <PdaRow label="Config PDA" result={pdaResults?.config} />
        <PdaRow label="Lock Record PDA" result={pdaResults?.lock} />
        <PdaRow label="Handshake Allowance PDA" result={pdaResults?.handshake} />
      </div>

      {!pdaResults?.lock && (
        <div className="text-[10px] text-[#6b6b65]">
          Enter a Lock ID above to derive the lock record PDA.
        </div>
      )}
      {!pdaResults?.handshake && sourceAccount && !isValidAddress(sourceAccount?.trim?.() || '') && (
        <div className="text-[10px] text-amber-600">
          Source account is not a valid Solana address.
        </div>
      )}

      <QueryResultDisplay />
    </div>
  );
}