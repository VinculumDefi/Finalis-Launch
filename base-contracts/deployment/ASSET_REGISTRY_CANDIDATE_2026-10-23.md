# Candidate active registry, 2026-10-23 (not deployed)

> **CANDIDATE active list, not deployed. Revision B remains the live active list.**
> `assetRegistry.revB.json` (487 entries) is what the Base ceremony registered on
> 2026-10-22 and what `build_ceremony_artifacts.cjs` pins by SHA-256. Nothing in
> the ceremony, verifier registration, token address index, price runs or deploy
> pages reads the candidate file. It exists on branch
> `test/registry-candidate-2026-10-23` only (git tag `registry-candidate-2026-10-23`).

File: `assetRegistry.candidate-2026-10-23.json`, built by
`testing-rigs/registry-verify/buildCandidate.cjs` from the on-chain check in
`testing-rigs/registry-verify/results/verify-2026-10-23.jsonl`.

## What was checked

Every written row of the historical revision (`assetRegistry.resolved.json`)
whose identifier is an EVM contract address, excluding Solana: **876 rows** on
7 chains (Ethereum 464, BNB Smart Chain 155, Avalanche 88, Polygon 78,
Arbitrum 40, Base 33, Optimism 18). Each row was read on its home chain through
public RPCs (code, `symbol()`, `decimals()`, `name()`), in 12 batches grouped by
chain, at one pinned block per batch.

| Result | Rows |
|---|---|
| pass | 857 |
| fail: symbol mismatch | 19 |
| fail: no code, call reverted, decimals mismatch | 0 |
| unchecked (RPC unreachable after retries) | 0 |

## What is in the candidate (811 entries)

- 810 tokens: the pass rows, minus 44 rows that lose the duplicate-address rule
  (another row on the same chain and contract is kept) and minus the 3 rows the
  operator dropped on 2026-10-19.
- Base ETH as row 2, copied from Revision B.

Row fields are copied unchanged from the historical file. Each token carries an
`onchain` object with the block, chain id and the symbol and decimals read.

Not in the candidate: the 19 failing rows, every Solana row, and the 11 other
native coins (ETH on Ethereum, BTC, DOGE, XRP, BNB, LTC, AVAX, BCH, DGB, ZEC,
XLM). The natives are not address-bearing, so they were not part of this check;
they stay on Revision B. Adding them to a later candidate is a separate decision.

## Compared with Revision B

- Revision B tokens failing now: **0**. All 475 Revision B tokens pass.
- Revision B entries not in the candidate: the 11 natives above.
- Candidate tokens not in Revision B: 335. These are the rows Revision B's
  per-pool liquidity filter removed; this check does not apply that filter.

## Historical revision

`assetRegistry.resolved.json` (961 written rows + Base ETH) is the **historical
revision**. Its bytes are unchanged: tests and the ceremony build guard read it
and refuse it as a ceremony registry by name and hash, so it is tagged here and
in `ASSET_REGISTRY_REVISIONS.md` rather than inside the file.
