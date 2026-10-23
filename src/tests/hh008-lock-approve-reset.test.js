// HH-008: the lock page must work with tokens that refuse approve() over a
// nonzero allowance (USDT). The approve block of each dated Lock.jsx copy is
// run against a USDT-style token mock. The live Base44 app is not touched.
// Run: node --test src/tests/hh008-lock-approve-reset.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const COPIES = ['app/base44-lock-2026-10-12', 'app/base44-lock-2026-10-13'];
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

function approveBlock(copy) {
  const src = readFileSync(path.join(ROOT, copy, 'src/pages/Lock.jsx'), 'utf8');
  const start = src.indexOf('if (asset.kind !== "native") {');
  const end = src.indexOf('setStep("locking");', start);
  assert.ok(start > 0 && end > start, `${copy}: approve block not found`);
  return new AsyncFunction('asset', 'getSignerContract', 'ERC20_ABI', 'provider', 'account', 'CONTRACTS', 'amountWei', 'setStep',
    src.slice(start, end));
}

// USDT rule: approve(spender, v) reverts when v != 0 and the current allowance != 0.
function usdtLike(initial) {
  const calls = [];
  let allowance = initial;
  const tx = () => ({ wait: async () => ({ status: 1 }) });
  return {
    calls,
    get allowanceNow() { return allowance; },
    allowance: async () => allowance,
    approve: async (_spender, v) => {
      calls.push(v);
      if (v !== 0n && allowance !== 0n) throw new Error('USDT: approve over nonzero allowance');
      allowance = v;
      return tx();
    },
  };
}

async function run(copy, initial, amount) {
  const token = usdtLike(initial);
  const fn = approveBlock(copy);
  await fn({ kind: 'erc20', address: '0xtoken' }, async () => token, [], {}, '0xacct', { lock: '0xlock' }, amount, () => {});
  return token;
}

for (const copy of COPIES) {
  test(`${copy}: smaller nonzero allowance is reset to 0, then approved (HH-008 safe)`, async () => {
    const t = await run(copy, 5n, 100n);
    assert.deepEqual(t.calls, [0n, 100n]);
    assert.equal(t.allowanceNow, 100n);
  });
  test(`${copy}: zero allowance approves once, no reset`, async () => {
    const t = await run(copy, 0n, 100n);
    assert.deepEqual(t.calls, [100n]);
  });
  test(`${copy}: enough allowance sends no approve`, async () => {
    const t = await run(copy, 100n, 100n);
    assert.deepEqual(t.calls, []);
  });
}
