import React, { useState } from 'react';
import { Clock, CheckCircle2, XCircle, AlertTriangle, Timer, ShieldX } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ENVIRONMENTS, findEnvironment } from '@/lib/vfBaseRegistry';
import { getTerminalDispositions, isSuccessDisposition } from '@/lib/vfPendingAttemptLifecycle';
import { ATTEMPT_STATES } from '@/lib/vfRevision6Authority';

const STATE_STYLES = {
  [ATTEMPT_STATES.OBJECTIVELY_PENDING]: { icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
  [ATTEMPT_STATES.RECOGNIZED]: { icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  [ATTEMPT_STATES.NOT_RECOGNIZED]: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-50', border: 'border-red-200' },
  [ATTEMPT_STATES.ELIGIBLE]: { icon: Timer, color: 'text-slate-400', bg: 'bg-slate-50', border: 'border-slate-200' },
};

export default function PendingAttemptPanel({ lifecycle, onRegister, onConfirm, onResolve }) {
  const [envId, setEnvId] = useState('Solana');
  const [handshakeIdentity, setHandshakeIdentity] = useState('');
  const [lockId, setLockId] = useState('');
  const [resolveLockId, setResolveLockId] = useState('');
  const [resolveDisposition, setResolveDisposition] = useState('');
  const [error, setError] = useState(null);

  const stats = lifecycle.getStats();
  const pending = lifecycle.getPendingAttempts();
  const resolved = lifecycle.getResolvedAttempts();
  const selectedEnv = findEnvironment(envId);
  const dispositions = selectedEnv ? getTerminalDispositions(selectedEnv.family) : [];
  const failureDispositions = dispositions.filter((d) => !isSuccessDisposition(d));

  function handleRegister() {
    setError(null);
    if (!handshakeIdentity || !lockId) {
      setError('Handshake identity and lock ID are required.');
      return;
    }
    const r = onRegister(envId, handshakeIdentity, lockId, Date.now());
    if (!r.ok) {
      setError(r.reason);
      return;
    }
    setHandshakeIdentity('');
    setLockId('');
  }

  function handleConfirm(lockId) {
    setError(null);
    const r = onConfirm(lockId);
    if (!r.ok) setError(r.reason);
  }

  function handleResolve() {
    setError(null);
    if (!resolveLockId || !resolveDisposition) {
      setError('Select a pending attempt and a terminal disposition.');
      return;
    }
    const r = onResolve(resolveLockId, resolveDisposition);
    if (!r.ok) {
      setError(r.reason);
      return;
    }
    setResolveLockId('');
    setResolveDisposition('');
  }

  return (
    <Card className="border-[#18324b]/20">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Timer className="w-5 h-5 text-[#18324b]" />
          <CardTitle className="text-sm font-semibold text-[#18324b]">
            Pending Attempt Lifecycle (VF-COM-007/008)
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-[#6b6b65]">
          Tracks in-flight lock submissions from source submission to finality confirmation.
          A pending attempt reserves the handshake identity, preventing concurrent reuse.
          Only chain-native objective terminal dispositions release the reservation.
        </p>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2">
          <StatBox label="Total" value={stats.total} icon={ShieldX} color="text-[#18324b]" />
          <StatBox label="Pending" value={stats.pending} icon={Clock} color="text-amber-600" />
          <StatBox label="Recognized" value={stats.recognized} icon={CheckCircle2} color="text-emerald-600" />
          <StatBox label="Not Recognized" value={stats.notRecognized} icon={XCircle} color="text-red-500" />
        </div>

        {/* Register Form */}
        <div className="rounded-md border border-[#18324b]/10 bg-[#fafaf8] p-3 space-y-2">
          <h4 className="text-xs font-semibold text-[#18324b]">Register Pending Attempt</h4>
          <div className="grid grid-cols-3 gap-2">
            <label className="text-xs space-y-1">
              <span className="text-[#6b6b65]">Environment</span>
              <select value={envId} onChange={(e) => setEnvId(e.target.value)} className="w-full border border-[#18324b]/20 rounded px-2 py-1 text-sm">
                {ENVIRONMENTS.filter(e => e.verificationStatus !== 'EVIDENCE_REQUIRED').map((env) => (
                  <option key={env.id} value={env.id}>{env.id}</option>
                ))}
              </select>
            </label>
            <label className="text-xs space-y-1">
              <span className="text-[#6b6b65]">Handshake Identity</span>
              <input type="text" value={handshakeIdentity} onChange={(e) => setHandshakeIdentity(e.target.value)} placeholder="(env, addr)" className="w-full border border-[#18324b]/20 rounded px-2 py-1 text-sm font-mono" />
            </label>
            <label className="text-xs space-y-1">
              <span className="text-[#6b6b65]">Lock ID</span>
              <input type="text" value={lockId} onChange={(e) => setLockId(e.target.value)} placeholder="lock-001" className="w-full border border-[#18324b]/20 rounded px-2 py-1 text-sm font-mono" />
            </label>
          </div>
          <Button onClick={handleRegister} size="sm" className="w-full bg-[#18324b] text-white hover:bg-[#18324b]/90">
            <Clock className="w-3 h-3 mr-1" />Register Pending
          </Button>
        </div>

        {/* Resolve Form */}
        {pending.length > 0 && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 space-y-2">
            <h4 className="text-xs font-semibold text-amber-800">Resolve Pending Attempt (Chain-Native Disposition Only)</h4>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs space-y-1">
                <span className="text-amber-700">Pending Attempt</span>
                <select value={resolveLockId} onChange={(e) => {
                  setResolveLockId(e.target.value);
                  setResolveDisposition('');
                }} className="w-full border border-amber-300 rounded px-2 py-1 text-sm">
                  <option value="">Select…</option>
                  {pending.map((a) => (
                    <option key={a.lockId} value={a.lockId}>{a.lockId} ({a.environmentId})</option>
                  ))}
                </select>
              </label>
              <label className="text-xs space-y-1">
                <span className="text-amber-700">Terminal Disposition</span>
                <select value={resolveDisposition} onChange={(e) => setResolveDisposition(e.target.value)} className="w-full border border-amber-300 rounded px-2 py-1 text-sm">
                  <option value="">Select…</option>
                  <option value="FINALIZED_SUCCESS">FINALIZED_SUCCESS (confirm)</option>
                  {failureDispositions.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex gap-2">
              {resolveDisposition === 'FINALIZED_SUCCESS' ? (
                <Button onClick={() => handleConfirm(resolveLockId)} size="sm" className="bg-emerald-700 text-white hover:bg-emerald-700/90">
                  <CheckCircle2 className="w-3 h-3 mr-1" />Confirm (Recognized)
                </Button>
              ) : (
                <Button onClick={handleResolve} size="sm" variant="destructive">
                  <XCircle className="w-3 h-3 mr-1" />Resolve (Not Recognized)
                </Button>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700 flex items-start gap-1">
            <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
            <span className="font-mono">{error}</span>
          </div>
        )}

        {/* Pending List */}
        {pending.length > 0 && (
          <div className="space-y-1.5">
            <h4 className="text-xs font-semibold text-[#18324b]">In-Flight Attempts</h4>
            {pending.map((a) => {
              const style = STATE_STYLES[a.state] || STATE_STYLES[ATTEMPT_STATES.OBJECTIVELY_PENDING];
              const Icon = style.icon;
              return (
                <div key={a.lockId} className={`flex items-center justify-between rounded-md border ${style.border} ${style.bg} px-3 py-1.5`}>
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${style.color}`} />
                    <span className="text-xs font-medium text-[#18324b] font-mono">{a.lockId}</span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">{a.environmentId}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[#6b6b65] font-mono truncate max-w-[120px]">{a.handshakeIdentity}</span>
                    <Badge className={`text-[10px] px-1.5 py-0 ${style.color} ${style.bg} border ${style.border}`} variant="outline">
                      {a.state}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Resolved List */}
        {resolved.length > 0 && (
          <div className="space-y-1.5">
            <h4 className="text-xs font-semibold text-[#18324b]">Resolved Attempts</h4>
            {resolved.slice(-10).reverse().map((a) => {
              const style = STATE_STYLES[a.state] || {};
              const Icon = style.icon || CheckCircle2;
              return (
                <div key={a.lockId} className={`flex items-center justify-between rounded-md border ${style.border || 'border-slate-200'} ${style.bg || 'bg-slate-50'} px-3 py-1.5`}>
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${style.color || 'text-slate-400'}`} />
                    <span className="text-xs font-medium text-[#18324b] font-mono">{a.lockId}</span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">{a.terminalDisposition}</Badge>
                  </div>
                  <Badge className={`text-[10px] px-1.5 py-0 ${style.color || ''} ${style.bg || ''} border ${style.border || ''}`} variant="outline">
                    {a.state}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-2 pt-2 border-t border-[#18324b]/10 text-xs text-[#6b6b65] space-y-1">
          <p>
            <strong className="text-[#18324b]">VF-COM-007:</strong> A pending attempt reserves the
            handshake identity. Concurrent reuse is blocked until a terminal disposition is reached.
          </p>
          <p>
            <strong className="text-[#18324b]">VF-COM-008:</strong> Only objective chain-native
            evidence (finalized success/failure, Solana blockhash/nonce expiry) clears a pending
            attempt. Timers, mempool absence, and non-observation are NOT valid dispositions.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function StatBox({ label, value, icon: Icon, color }) {
  return (
    <div className="rounded-md border border-[#18324b]/10 bg-[#fafaf8] px-2 py-1.5 text-center">
      <Icon className={`w-3.5 h-3.5 ${color} mx-auto mb-0.5`} />
      <div className="text-lg font-bold text-[#18324b]">{value}</div>
      <div className="text-[10px] text-[#6b6b65]">{label}</div>
    </div>
  );
}