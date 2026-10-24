// Cosmos is dropped (t228u, t251u): the app simulator has 16 environments and
// no Cosmos page, route, mock, normalizer or library.
// Run: node --test src/tests/cosmos-removed.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { ENVIRONMENTS, ENVIRONMENT_COUNT, findEnvironment, findAssetPrecision, DEV_FUND_DESTINATIONS } from '../lib/vfBaseRegistry.js';
import { getRegisteredEnvironments } from '../lib/vfChainVerifierRegistry.js';
import * as normalizer from '../lib/vfProofNormalizer.js';
import * as mocks from '../lib/vfMockEventBuilder.js';

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const SIXTEEN = [
  'Ethereum', 'BNB', 'Avalanche', 'Polygon', 'Arbitrum', 'Base', 'Optimism',
  'Solana', 'Bitcoin', 'Litecoin', 'Dogecoin', 'DigiByte', 'Zcash', 'BitcoinCash',
  'XRPL', 'Stellar',
];

// App code the simulator builds from. Test files, the historical Revision 6
// record and dated reports are not app code.
const APP_DIRS = ['lib', 'pages', 'components', 'hooks', 'api', 'utils'];
const APP_FILES = ['App.jsx', 'Layout.jsx', 'main.jsx'];
// The hosted Revision 6 registry (1,001 rows) has one row named Cosmos. This
// file describes that hosted file's environment counts only; the row is hidden
// by the active asset list.
const ALLOWED = new Map([[path.join('lib', 'vfRegistryVerification.js'), 1]]);

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(js|jsx|mjs|cjs|ts|tsx|json)$/.test(name)) out.push(p);
  }
  return out;
}

test('16 environments, none of them Cosmos', () => {
  assert.equal(ENVIRONMENT_COUNT, 16);
  assert.deepEqual(ENVIRONMENTS.map((e) => e.id).sort(), [...SIXTEEN].sort());
  assert.equal(findEnvironment('CosmosHub'), null);
  assert.equal(findAssetPrecision('CosmosHub', 'native-uatom'), null);
  assert.equal('CosmosHub' in DEV_FUND_DESTINATIONS, false);
  assert.deepEqual(Object.keys(DEV_FUND_DESTINATIONS).sort(), [...SIXTEEN].sort());
  assert.equal(getRegisteredEnvironments().length, 16);
  // Revision 12: no environment carries a Handshake allowance, a counting flag
  // or an enforcement side, so none is held back or limited.
  for (const e of ENVIRONMENTS) {
    for (const k of ['handshakeAllowance', 'countsPerIdentity', 'handshakeEnforcement']) {
      assert.equal(k in e, false, `${e.id} still has ${k}`);
    }
  }
});

test('no Cosmos normalizer or mock event builder', () => {
  assert.equal('normalizeCosmosEvidence' in normalizer, false);
  assert.equal('buildCosmosMockEvent' in mocks, false);
});

test('Cosmos page, route, candidate data and proof adapter are removed', () => {
  assert.equal(existsSync(path.join(SRC, 'pages', 'CosmosHubCandidate.jsx')), false);
  assert.equal(existsSync(path.join(SRC, 'lib', 'cosmosCandidateData.js')), false);
  assert.equal(existsSync(path.join(SRC, 'cosmos-hub-proof-adapter')), false);
  const app = readFileSync(path.join(SRC, 'App.jsx'), 'utf8');
  assert.ok(!/cosmos/i.test(app), 'App.jsx still mentions Cosmos');
});

test('no app source file references Cosmos, ATOM or uatom', () => {
  const files = [
    ...APP_DIRS.flatMap((d) => walk(path.join(SRC, d))),
    ...APP_FILES.map((f) => path.join(SRC, f)).filter(existsSync),
  ];
  assert.ok(files.length > 50, `only ${files.length} files scanned`);
  const hits = [];
  for (const f of files) {
    const rel = path.relative(SRC, f);
    const lines = readFileSync(f, 'utf8').split('\n');
    const bad = lines.filter((l) => /cosmos|uatom|\bATOM\b/i.test(l));
    const allowed = ALLOWED.get(rel) ?? 0;
    if (bad.length > allowed) hits.push(`${rel}: ${bad.map((l) => l.trim()).join(' | ')}`);
  }
  assert.deepEqual(hits, []);
});
