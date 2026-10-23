# Re-run outputs, 2026-10-23

Outputs for branch fix/batch-2026-10-23 (see testing-rigs/FIX_LOG_2026-10-23.md and the Fix status section of testing-rigs/MASTER_FINDINGS.md). Times are America/New_York (EDT). Nothing was deployed, broadcast or finalized; every chain used here is a local Hardhat fork. Full-length addresses are abbreviated, and restricted token names are withheld.

## Final results (after the AG-20 Verifier change and the deploy-file rebuild)

| Output | Result |
|---|---|
| hardhat/full_suite.txt | Full Hardhat suite, run once and alone with NODE_OPTIONS=--max-old-space-size=12288, 14 GB available at start, 13:39 to 14:09 EDT: 849 passing, 0 failing. |
| app/app_tests.txt | node --test src/tests/*.test.js: 75 of 75 pass (includes the new solana-program-rev12.test.js). |
| app/lint.txt | npm run lint: clean. |
| app/build.txt | npm run build: built OK (chunk-size warning only). |
| ceremony-dryrun/dryrun_simulate_output.txt | npm run ceremony:dryrun:simulate (--simulate-non-base-locks): the fixed CommitmentVaultLock was deployed on local forks of the six non-Base chains, masked runtime hash 0x7ee4...b4b7 on every chain, steps 3 to 15 run. Result: "ceremony would succeed", "reconciliation PASS" (349 checks PASS). |
| ceremony-dryrun/dryrun_output.txt | npm run ceremony:dryrun (default mode, unchanged): "ceremony would FAIL at step 2". The six live non-Base locks are the old CommitmentVaultLock, so the page refuses them. This is the expected fail-closed result until the operator deploys the fixed lock on those chains. |

## Earlier outputs in this folder (first re-run, 12:19 to 12:50 EDT)

- adversarial, assumption-gap, static-poc, invariants, metamorphic, combinatorial, echidna: rig runs on the fixed contracts (see FIX_LOG "Re-run").
- mutation/: mutants_replay.jsonl, mutation_summary.json and mutants_changed.jsonl (fresh sample on the changed contracts). Six code-hash detail values in mutants_changed.jsonl were restored from the raw run output (commit 2939b16). The three real Verifier gaps in that sample (R-Verifier-639-37, R-Verifier-478-29, G-Verifier-532) are killed by tests added in d2c7e01.

The first full-suite run (844 passing, 2 failing, both fixed) was replaced by the final run above.
