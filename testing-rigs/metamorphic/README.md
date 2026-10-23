# Metamorphic rig (discovery only)

Checks relations between pairs of runs on a local Hardhat deployment (Base environment). No contract or app code is changed.

| Relation | Expectation |
|---|---|
| MR1 | Doubling gross doubles the mint |
| MR2 | Two half locks mint the same total as one lock |
| MR3a | Same lock, same price, submitted 45 days later: same mint |
| MR3b | Same lock with valuationTimestamp set to launch: same mint, or refused |
| MR3c | Two identical locks from the same price run: same mint even if a later run doubles the price |
| MR4 | Fee is the floored 5%, Dev Fund delta equals the fee (40 fuzzed grosses) |
| MR5 | Decay sweep, days 300 to 4500 step 30, VCLM and CHONX, against the spec formula, monotonic, floor held |
| MR6 | Package output token must match the lock record |

## Run

```
export PATH=/tmp/node22bin:$PATH NODE_OPTIONS=--max-old-space-size=2048 EXTRA_RIG=1
cd base-contracts
npx hardhat test ../testing-rigs/metamorphic/metamorphic.test.cjs
python3 ../testing-rigs/metamorphic/summarize.py
```

Each relation is appended to results/relations.jsonl (or META_OUT) as it finishes; a rerun skips keys already written.

## Result (2026-10-23)

344 lines: 337 PASS, 6 VIOLATION, 1 setup. Findings in testing-rigs/findings/metamorphic.json:

- META-01 (merged into AG-05): backdated valuationTimestamp accepted; mint x1.14 at day 255 up to x10 at day 4500.
- META-02 (merged into AG-06): a price run between two identical locks doubles the second mint.
