// AG-20 / Rev 12 Handshake: the Solana program (constants.rs) and its
// off-chain mirror (vfSolanaProgram.js PROGRAM_CONSTANTS) use the Rev 12
// Handshake band $0.01 to $0.02, a 5% fee on every duration, a $0.01 minimum
// for other durations and no Handshake allowance limit, the same values as
// vfLiveRules.js and the Base/EVM contracts. Before this fix both carried the
// Revision 6 values ($0.95 to $1.05, 2.5% fee, $10 minimum, 3-use limit).
// Run: node --test src/tests/solana-program-rev12.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { PROGRAM_CONSTANTS, computeFeeOffChain } from '../lib/vfSolanaProgram.js';
import { HANDSHAKE_USD_MIN_FP, HANDSHAKE_USD_MAX_FP, STANDARD_USD_MIN_FP } from '../lib/vfLiveRules.js';

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const progDir = path.join(SRC, 'solana-vault', 'programs');
const prog = readdirSync(progDir).find((d) => {
  try { readFileSync(path.join(progDir, d, 'src', 'constants.rs')); return true; } catch { return false; }
});
const rs = (f) => readFileSync(path.join(progDir, prog, 'src', f), 'utf8');
const rustConst = (src, name) => {
  const m = src.match(new RegExp(`pub const ${name}: [a-z0-9]+ = ([0-9_]+);`));
  assert.ok(m, `${name} not found in constants.rs`);
  return BigInt(m[1].replace(/_/g, ''));
};

test('constants.rs carries the Rev 12 Handshake values', () => {
  const c = rs('constants.rs');
  assert.equal(rustConst(c, 'HANDSHAKE_VALUE_USD_MIN_MICRO'), HANDSHAKE_USD_MIN_FP);
  assert.equal(rustConst(c, 'HANDSHAKE_VALUE_USD_MAX_MICRO'), HANDSHAKE_USD_MAX_FP);
  assert.equal(rustConst(c, 'STANDARD_MINIMUM_VALUE_USD_MICRO'), STANDARD_USD_MIN_FP);
  assert.equal(rustConst(c, 'HANDSHAKE_FEE_BPS'), 500n);
  assert.equal(rustConst(c, 'STANDARD_FEE_BPS'), 500n);
});

test('vfSolanaProgram.js mirrors constants.rs (no Revision 6 band, fee or minimum)', () => {
  const c = rs('constants.rs');
  assert.equal(PROGRAM_CONSTANTS.HANDSHAKE_VALUE_USD_MIN_MICRO, rustConst(c, 'HANDSHAKE_VALUE_USD_MIN_MICRO'));
  assert.equal(PROGRAM_CONSTANTS.HANDSHAKE_VALUE_USD_MAX_MICRO, rustConst(c, 'HANDSHAKE_VALUE_USD_MAX_MICRO'));
  assert.equal(PROGRAM_CONSTANTS.STANDARD_MINIMUM_VALUE_USD_MICRO, rustConst(c, 'STANDARD_MINIMUM_VALUE_USD_MICRO'));
  assert.equal(BigInt(PROGRAM_CONSTANTS.HANDSHAKE_FEE_BPS), rustConst(c, 'HANDSHAKE_FEE_BPS'));
  assert.equal(BigInt(PROGRAM_CONSTANTS.STANDARD_FEE_BPS), rustConst(c, 'STANDARD_FEE_BPS'));
  assert.equal(PROGRAM_CONSTANTS.HANDSHAKE_ALLOWANCE_ENFORCED, false);
  // $1.00 (inside the old Revision 6 band) is outside the Rev 12 band
  assert.ok(10n ** 18n > PROGRAM_CONSTANTS.HANDSHAKE_VALUE_USD_MAX_MICRO);
});

test('off-chain fee: the Handshake pays 5%, the same as every other duration', () => {
  const h = computeFeeOffChain(10_000n, 3600);
  assert.equal(h.isHandshake, true);
  assert.equal(h.fee, 500n);
  assert.equal(h.principal, 9_500n);
  const w = computeFeeOffChain(10_000n, 604800);
  assert.equal(w.fee, 500n);
});

test('the program no longer refuses a Handshake for an exhausted allowance', () => {
  const ix = rs('instructions/commit_vault_lock.rs');
  assert.ok(!/require!\([^;]*remaining[^;]*HandshakeAllowanceExhausted/s.test(ix), 'allowance check still present');
  assert.ok(!/err!\(VaultError::HandshakeAllowanceExhausted\)/.test(ix), 'allowance error still returned');
});
