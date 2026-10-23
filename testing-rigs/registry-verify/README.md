# Registry on-chain verification rig (2026-10-23)

Test branch only (`test/registry-candidate-2026-10-23`). Nothing here deploys,
broadcasts or finalizes anything, and no keys are used. Every call is a
read-only `eth_getCode` or `eth_call` to a public RPC. Revision B
(`base-contracts/deployment/assetRegistry.revB.json`), its pinned SHA in
`build_ceremony_artifacts.cjs`, the manifest and the ceremony files are not
touched.

## What was checked

Source: the historical file `base-contracts/deployment/assetRegistry.resolved.json`
(bytes unchanged). The rig checks every written row (decimals set, not a
same-key copy of another row) that carries a non-zero EVM address, Solana
excluded. That is **876 rows**:

| Chain | Rows | Batches |
|---|---|---|
| Ethereum | 464 | 5 (93, 93, 93, 93, 92) |
| BNB Smart Chain | 155 | 2 (78, 77) |
| Avalanche | 88 | 1 |
| Polygon | 78 | 1 |
| Arbitrum | 40 | 1 (whole chain is under 50 rows) |
| Base | 33 | 1 (whole chain is under 50 rows) |
| Optimism | 18 | 1 (whole chain is under 50 rows) |

Each batch is one JSON-RPC batch of `eth_getCode` plus one Multicall3
`aggregate3` call (`symbol()`, `decimals()`, `name()` per row, allowFailure on),
both pinned to the same block. Each batch tries up to 3 times across alternate
public RPCs. A row still unreachable after that is recorded as `unchecked`.

## Pass rule

A row passes when the address has code, `decimals()` equals the row decimals,
and `symbol()` matches the row label by one of these classes:

| Class | Rows |
|---|---|
| exact | 640 |
| suffix-alias (label like `USDC_ETH`) | 79 |
| case (case-insensitive) | 76 |
| reviewed-rename-2026-10-20 (renamed tickers already reviewed on 2026-10-20, symbol unchanged since) | 55 |
| numbered-alias (label like `FLOKI2`) | 7 |

## Result

- Checked: 876
- Pass: 857
- Fail: 19, all `symbol_mismatch` (Ethereum 16, Optimism 1, BNB Smart Chain 1, Avalanche 1)
- Unchecked: 0
- One batch needed a second attempt (BNB Smart Chain batch 1); no row ended unchecked.

## Comparison with Revision B

- All 475 Revision B tokens pass. None fail and none are unchecked.
- 382 passing rows are not in Revision B. After dropping 44 duplicate-address
  rows (same rule as `buildTokenAddressIndex.cjs`) and 3 operator-dropped rows,
  335 candidate tokens are not in Revision B.
- Revision B entries not in the candidate: its 11 natives other than Base ETH.
  The candidate is "verified rows plus Base ETH" only; this is a decision to revisit.

## Files

- `verifyRegistry.cjs` runs the check and writes `results/verify-2026-10-23.jsonl` (resumable).
- `results/run-2026-10-23.txt` is the batch log.
- `buildCandidate.cjs` writes the candidate list
  `base-contracts/deployment/assetRegistry.candidate-2026-10-23.json` (811 entries:
  810 tokens plus Base ETH as row 2), the app status file
  `src/data/tokenVerificationStatus.json`, and `results/summary-2026-10-23.json`.
  `node buildCandidate.cjs --check` confirms all three are current.
- The app hides any token whose row is `fail` or `unchecked`, or has no record
  (`src/lib/vfActiveAssetAllowlist.js`, tests in
  `src/tests/token-verification-status.test.js`).

The candidate is a CANDIDATE active list, not deployed. Revision B remains the live active list.
