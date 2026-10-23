# Rig 8: mutation testing

Base: origin/main b0e38a9, branch rigs/foundry. Findings only, no contract or app changes.

## Tools
- Gambit v0.2.1 (commit 072ff4c6), run with --skip_validate. It has no relational-to-relational
  operator, so its type-error BinaryOp mutants are filtered out and Python ROR mutants
  (boundary flips < <=, > >=, == !=) are added in run_mutants.py.
- 39 targeted mutants (fee bps, 10M / 100M thresholds, 0.95e18 floor, decay, caps, msg.sender
  to tx.origin, owner checks), 46 seeded ROR mutants, 98 seeded Gambit mutants (seed 20261023).
- Hardhat (solc 0.8.19, viaIR). Node v20/v22. NODE_OPTIONS heap 6 GB first pass, 4 GB retry.

## Method (run_mutants.py)
Per mutant: compile (failure = stillborn), compare deployed bytecode (same = equivalent), then run
the mapped Hardhat tests for that contract with --bail and a 900 s timeout: fast set, slow set,
then the pinned set (lock_5pct_native_erc20_7chains, which checks the lock code hash). A kill that
comes only from that code-hash pin is pin_only and is NOT counted as killed. A timeout or a crashed
run is INCOMPLETE TESTING, never evidence of safety. Three first-pass records crashed with OOM
(rc 137) on the shared box; they were re-run one at a time with each test file on its own
(results/retry.jsonl, which supersedes them in the summary). All three survived on retry.

Excluded tests: ceremony_artifacts_match_compile (bytecode pin), live_config (needs git),
retired_scripts.

## Score (killed / (killed + survived))
| Contract | Killed | Survived | pin_only | Stillborn | Score |
|---|---|---|---|---|---|
| Verifier | 35 | 22 | 0 | 5 | 0.614 |
| Stake | 23 | 6 | 0 | 6 | 0.793 |
| Token | 8 | 6 | 0 | 5 | 0.571 |
| Synth | 7 | 6 | 0 | 2 | 0.538 |
| BaseCVL | 9 | 0 | 10 | 4 | 1.0 (10 not seen by behaviour tests) |
| CVL | 17 | 0 | 0 | 1 | 1.0 |
| Durations | 11 | 0 | 0 | 0 | 1.0 |
| Total | 110 | 40 | 10 | 23 | 0.733 |

Scores are sample scores (see IT-MUT-00). HandshakeCapability got 0 Gambit mutants.

## Files
- results/mutants_w0.jsonl, mutants_w1.jsonl, retry.jsonl: one line per mutant.
- results/mutation_summary.json: per-contract score, survivors, all records.
- build_findings.py: writes ../findings/fuzz_mutation.json (four classes plus LIVE/LATENT).

Rerun: `python3 summarize.py results results/mutation_summary.json` then
`python3 build_findings.py results/mutation_summary.json ../findings/fuzz_mutation.json`.
