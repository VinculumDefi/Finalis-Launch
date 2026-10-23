# Rig 1: baseline (main b0e38a9, Node 20.19.2, Hardhat 2.22, NODE_OPTIONS=--max-old-space-size=12288)

The shared box could not hold one 12 GB full-suite process next to the other
agents' runs (kernel OOM kill at 470 passing, 0 failing), so the suite ran one
Hardhat process per test file (run_baseline.sh MODE=files, same tests), and
every file the kernel killed (EXIT 137) was rerun alone (rerun_killed.sh).

| Pass | Files | Passing | Failing |
|---|---|---|---|
| per-file run (hardhat_files.log) | 52 of 61 completed, 9 OOM-killed | 672 | 0 |
| rerun 1 (rerun_killed_pass1.log) | 7 of 9 completed (Zcash, t277 killed again) | 101 | 0 |
| rerun 2, HEAP=3072 (rerun_killed_pass2.log) | Zcash completed, t277 killed again | 7 | 0 |
| rerun 3 (rerun_killed.log) | t277 completed | 3 | 0 |
| **Total** | **61 of 61 completed** | **783** | **0** |

Expected 779. The per-file sum is 783, 4 more than expected, with 0 failing and
0 pending. The difference was not traced (possibly tests added on main after
the 779 figure); it is reported, not explained away.

App: `node --test src/tests/*.js` 65 of 65 pass. Lint EXIT 0. Build EXIT 0.

Result: PASS (0 failing). Caveat: no single-process full-suite run completed on this box.
