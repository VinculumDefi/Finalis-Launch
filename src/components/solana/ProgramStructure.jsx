import React from 'react';
import { FileCode, Database, Key, ListChecks, AlertTriangle } from 'lucide-react';
import { PROGRAM_ID } from '@/lib/vfSolanaProgram';

const INSTRUCTIONS = [
  { name: 'initialize', file: 'initialize.rs', reqs: 'VF-DEP-001/002' },
  { name: 'commit_vault_lock_native', file: 'commit_vault_lock.rs', reqs: 'VF-COM-001..026' },
  { name: 'commit_vault_lock_spl', file: 'commit_vault_lock.rs', reqs: 'VF-COM-001..026' },
  { name: 'release_principal_native', file: 'release_principal.rs', reqs: 'VF-PRI-001..006' },
  { name: 'release_principal_spl', file: 'release_principal.rs', reqs: 'VF-PRI-001..006' },
];

const PDAS = [
  { name: 'Config', seeds: '[b"vf_config"]', purpose: 'singleton config' },
  { name: 'Lock Record', seeds: '[b"vf_lock", sha256(lock_id)]', purpose: 'per-lock VF-XCH-011 facts' },
  { name: 'Handshake Allowance', seeds: '[b"vf_handshake", source_account]', purpose: 'per-identity usage' },
  { name: 'Vault (SPL)', seeds: '[b"vf_vault", mint]', purpose: 'principal custody' },
];

const FILES = [
  'Cargo.toml',
  'Anchor.toml',
  'rust-toolchain.toml',
  'package.json',
  'tsconfig.json',
  'programs/vf-solana-vault/Cargo.toml',
  'programs/vf-solana-vault/src/lib.rs',
  'programs/vf-solana-vault/src/constants.rs',
  'programs/vf-solana-vault/src/state.rs',
  'programs/vf-solana-vault/src/error.rs',
  'programs/vf-solana-vault/src/events.rs',
  'programs/vf-solana-vault/src/instructions/mod.rs',
  'programs/vf-solana-vault/src/instructions/initialize.rs',
  'programs/vf-solana-vault/src/instructions/commit_vault_lock.rs',
  'programs/vf-solana-vault/src/instructions/release_principal.rs',
  'tests/vault.ts',
  'migrations/deploy.ts',
  'README.md',
];

export default function ProgramStructure() {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-[#18324b]/20 bg-white p-4 space-y-4">
        <div className="flex items-center gap-2">
          <FileCode className="w-5 h-5 text-[#18324b]" />
          <h3 className="text-sm font-semibold text-[#18324b]">Anchor Program — Source Structure</h3>
        </div>

        <div className="text-xs space-y-1 font-mono">
          <div><span className="text-[#6b6b65]">Program ID (placeholder):</span> <span className="text-[#0a0a0a]">{PROGRAM_ID}</span></div>
          <div><span className="text-[#6b6b65]">Framework:</span> <span className="text-[#0a0a0a]">Anchor 0.30.1</span></div>
          <div><span className="text-[#6b6b65]">Toolchain:</span> <span className="text-[#0a0a0a]">Rust 1.18.0 · target bpfel-unknown-unknown</span></div>
          <div><span className="text-[#6b6b65]">Environment:</span> <span className="text-[#0a0a0a]">Solana (Non-EVM, account-model)</span></div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-[#18324b]">
            <ListChecks className="w-3.5 h-3.5" /> Instructions
          </div>
          <div className="rounded-md border divide-y">
            {INSTRUCTIONS.map((ix) => (
              <div key={ix.name} className="flex items-center justify-between p-2 text-xs">
                <span className="font-mono text-[#0a0a0a]">{ix.name}</span>
                <span className="text-[#6b6b65]">{ix.reqs} · {ix.file}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-[#18324b]">
            <Key className="w-3.5 h-3.5" /> PDA Seeds
          </div>
          <div className="rounded-md border divide-y">
            {PDAS.map((pda) => (
              <div key={pda.name} className="p-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-[#0a0a0a]">{pda.name}</span>
                  <span className="text-[#6b6b65]">{pda.purpose}</span>
                </div>
                <div className="font-mono text-[10px] text-[#18324b] mt-0.5">{pda.seeds}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-[#18324b]">
            <Database className="w-3.5 h-3.5" /> Files ({FILES.length})
          </div>
          <div className="rounded-md border p-2 max-h-48 overflow-auto">
            <div className="grid grid-cols-1 gap-0.5">
              {FILES.map((f) => (
                <div key={f} className="text-xs font-mono text-[#6b6b65]">
                  <span className="text-[#18324b]">src/solana-vault/</span>{f}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-amber-500/40 bg-amber-50 p-3 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
        <p className="text-xs text-amber-800">
          <b>Build and tests NOT executed.</b> The Base44 environment has no Rust toolchain or Solana CLI.
          Run <span className="font-mono">anchor build</span> and <span className="font-mono">anchor test</span> in a Solana development environment
          to verify compilation and execute the 10 integration tests. The program ID is a placeholder —
          replace after deployment.
        </p>
      </div>
    </div>
  );
}