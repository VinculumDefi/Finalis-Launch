import React, { useState } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, ShieldCheck, Server } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ENVIRONMENTS } from '@/lib/vfBaseRegistry';
import { isVerifierRegistered, getChainVerifier } from '@/lib/vfChainVerifierRegistry';

export default function ChainVerifierPanel() {
  return (
    <Card className="border-[#18324b]/20">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Server className="w-5 h-5 text-[#18324b]" />
          <CardTitle className="text-sm font-semibold text-[#18324b]">
            Per-Environment Chain Verifiers (Section O)
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-[#6b6b65] mb-3">
          Each of the 17 environments has a dedicated IChainVerifier that performs
          objective chain-native finality verification and independent fact extraction.
          16 are registered; Cosmos Hub is EVIDENCE_REQUIRED.
        </p>
        <div className="grid gap-1.5">
          {ENVIRONMENTS.map((env) => {
            const registered = isVerifierRegistered(env.id);
            const verifier = getChainVerifier(env.id);
            return (
              <div
                key={env.id}
                className="flex items-center justify-between rounded-md border border-[#18324b]/10 bg-[#fafaf8] px-3 py-1.5"
              >
                <div className="flex items-center gap-2">
                  {registered ? (
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                  )}
                  <span className="text-xs font-medium text-[#18324b]">{env.id}</span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {env.family}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#6b6b65] font-mono">
                    {verifier?.finalityModel || env.finality}
                  </span>
                  {registered ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-amber-500" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 pt-3 border-t border-[#18324b]/10 text-xs text-[#6b6b65] space-y-1">
          <p>
            <strong className="text-[#18324b]">VF-XCH-006:</strong> Issuance occurs only after
            source finality is verified by the environment's chain verifier.
          </p>
          <p>
            <strong className="text-[#18324b]">VF-XCH-010:</strong> Finality must be objective
            (chain-native evidence — not timers, mempool absence, or non-observation).
          </p>
          <p>
            <strong className="text-[#18324b]">VF-XCH-011:</strong> Immutable facts are
            independently extracted from the raw lock event proof and cross-checked
            against the ProofPackage to prevent tampering.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}