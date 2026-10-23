# Rig 4: invariants

| Invariant | Result |
|---|---|
| INV-1 supply = sum of balances | holds |
| INV-2 only authorized minters mint | holds |
| INV-3 no lock used twice for a mint | holds |
| INV-4 every VCLM mint traces to a real lock | BREAKS for non-Base readers (HH-003, the Oct 22 forged-header finding, as expected) |
| INV-5 CHONX opens at 10M VCLM | holds |
| INV-6 SYNTH needs 100M CHONX, costs 1,000 VCLM + 10,000 CHONX | holds |
| INV-7 5% fee on every duration, $0.95 rule | holds |

Default run (findings skipped with FINDING-id reasons): 9 passing, 3 pending, EXIT 0 (run_default.log).
Findings shown (RIG_SHOW_FINDINGS): 9 passing, 3 failing, EXIT 3 (run_show_findings.log): HH-003, HH-001, HH-002.

Evidence: Stake minted 15,609.24 VCLM from RAC replays (HH-001); day 840 valuation 31,098 vs 19,423 VCLM, x1.601 (HH-002); 5 Ethereum-labelled mints with no lock on chain 31337 (HH-003); stranger binding accepted (HH-004).
