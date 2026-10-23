# Combinatorial rig (discovery only)

Exhaustive grid over the lock and Verifier path on a local Hardhat deployment. No contract or app code is changed.

Grid: 2 environments (Base, Ethereum) x 7 asset classes (native, erc20, erc20_lowdec, protocol, stable_above_then_below, stable_below_then_above, stable_at_0.95) x 16 valid durations x 6 USD buckets (0.005, 0.01, 0.015, 0.02, 0.025, 5) x bound/unbound = 2688 cells, plus 8 invalid-duration controls (2696 total).

- Bound: recordFeeAndRac is called right after the lock, at the creation-time price run.
- Unbound: a new price run is posted first (p1 to p2), then the lock is submitted.
- Each cell records lock result, fee, Dev Fund delta, record/mint result, and a verdict against the spec oracle.

## Run

```
export PATH=/tmp/node22bin:$PATH NODE_OPTIONS=--max-old-space-size=1536 EXTRA_RIG=1
cd base-contracts
CELL_LIMIT=200 npx hardhat test ../testing-rigs/combinatorial/combinatorial.test.cjs   # repeat until 2688 lines
npx hardhat test ../testing-rigs/combinatorial/combinatorial.test.cjs                   # adds the 8 controls
python3 ../testing-rigs/combinatorial/summarize.py
```

Each cell is appended to results/cells.jsonl as it finishes. A rerun skips cells already written (key env|cls|duration|bucket|bound), so a killed run resumes from the last written cell. The 2026-10-23 run was killed once by memory pressure at 1810 cells and was finished in 200-cell chunks.

## Result (2026-10-23)

1916 PASS, 780 DEVIATION. Findings in testing-rigs/findings/combinatorial.json:

- COMB-01 (merged into AG-06): unbound locks mint at the later run price (244 cells).
- COMB-02: a valid lock becomes unmintable after a price move, fee kept (68 cells).
- COMB-03: the $0.95 stablecoin rule is applied at first submission, not at lock creation, in both directions (468 cells).

The fee rule held on all 1620 accepted locks.
