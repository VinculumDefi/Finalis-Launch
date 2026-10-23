# Rig 6 SMTChecker results

solc 0.8.19 SMTChecker, CHC engine, z3 4.11.2. Certora not available (CERTORAKEY not set in env), so SMTChecker is the only formal layer.

Solidity 0.8 checked arithmetic: an overflow or underflow 'happens' result means the call reverts with Panic 0x11, not a silent wrap.

Verdict counts: counterexample 1, inconclusive 12, proven 7

| id | verdict | harness line | reason or note | BMC supplement |
|---|---|---|---|---|
| P2-token-conservation | inconclusive | TokenInstrumented.sol:194 | solver error (z3 gave up, likely memory pressure on the shared box) | counterexample |
| P2-token-cap | inconclusive | TokenInstrumented.sol:195 | solver error (z3 gave up, likely memory pressure on the shared box) | counterexample |
| P1-token-minter-only | inconclusive | TokenInstrumented.sol:196 | solver error (z3 gave up, likely memory pressure on the shared box) | proven |
| P1-token-no-mint-before-finalize | counterexample | TokenInstrumented.sol:197 | spurious: Trace needs msg.sender == address(0) while both minters are still unset (address(0)) before initialize(). No transaction can come from address(0); initialize() sets both minters and finalized=true in one call (VinculumFinalisToken.sol:95-107) and onlyMinter is VinculumFinalisToken.sol:65-71. | counterexample |
| P3-token-frozen | inconclusive | TokenInstrumented.sol:198 | solver error (z3 gave up, likely memory pressure on the shared box) | counterexample |
| P3-token-deployer-only | inconclusive | TokenInstrumented.sol:199 | solver error (z3 gave up, likely memory pressure on the shared box) | proven |
| P2-synth-conservation | inconclusive | SynthInstrumented.sol:205 | solver error (z3 gave up, likely memory pressure on the shared box) | counterexample |
| P2-synth-cap | inconclusive | SynthInstrumented.sol:206 | solver error (z3 gave up, likely memory pressure on the shared box) | counterexample |
| P1-synth-mint-when-activated | inconclusive | SynthInstrumented.sol:207 | solver error (z3 gave up, likely memory pressure on the shared box) | counterexample |
| P1-synth-whole-units | inconclusive | SynthInstrumented.sol:208 | solver error (z3 gave up, likely memory pressure on the shared box) | counterexample |
| P3-synth-activation-one-way | inconclusive | SynthInstrumented.sol:209 | solver error (z3 gave up, likely memory pressure on the shared box) | counterexample |
| F1-fee-conservation | proven | FeeMath.sol:48 | no warning for this line | n/a |
| F2-fee-exact | proven | FeeMath.sol:49 | no warning for this line | n/a |
| F3-verifier-accepts-cvl-fee | proven | FeeMath.sol:50 | no warning for this line | n/a |
| F4-principal-nonzero | proven | FeeMath.sol:51 | no warning for this line | n/a |
| F5-multiplier-range | proven | FeeMath.sol:52 | no warning for this line | n/a |
| I1-issuance-monotonic | inconclusive | IssuanceMath.sol:84 | CHC could not find an invariant within the 30 s per-query timeout | n/a |
| I2-issuance-upper-bound | inconclusive | IssuanceMath.sol:91 | CHC could not find an invariant within the 30 s per-query timeout | n/a |
| I3-rate-bounds | proven | IssuanceMath.sol:100 | no warning for this line | n/a |
| I4-day-zero-max | proven | IssuanceMath.sol:107 | no warning for this line | n/a |

BMC supplement column (run_bmc_supplement.sh): BMC proved it for every single call from an arbitrary starting state, which is stronger than needed for this per-call property. A counterexample there is not informative. BMC starts each call from an arbitrary state (for the synth it even picks HARD_CAP = 0 and burn constants of 0, and it forgets state after the external token calls). The traces start from states no real deployment can reach, for example finalized with a nonzero deployer, or ghostSum already different from totalSupply. Read by hand as spurious.

## Jobs

| job | exit | seconds |
|---|---|---|
| bmc_synth | 0 | 1 |
| bmc_token | 0 | 0 |
| harness_feemath | 0 | 26 |
| harness_issuance | 0 | 129 |
| harness_synth | 0 | 446 |
| harness_token | 0 | 714 |
| harness_token_assert_only | 247 | 639 |
| prod_basecvl | 0 | 192 |
| prod_stake | 0 | 201 |
| prod_synth | 245 | 24 |
| prod_synth_nocap | 139 | 32 |
| prod_token | 0 | 101 |
| prod_verifier | 0 | 261 |

## Production contracts (overflow, underflow, divByZero, outOfBounds, assert)

- prod_basecvl: exit 0, 192 s, {'counterexample': 3}, counterexample lines ['BaseCommitmentVaultLock.sol:224', 'BaseCommitmentVaultLock.sol:317', 'BaseCommitmentVaultLock.sol:349']
- prod_stake: exit 0, 201 s, {'solver_error': 92, 'unproved': 97}, counterexample lines none
- prod_synth: exit 245, 24 s, {}, counterexample lines none
- prod_synth_nocap: exit 139, 32 s, {}, counterexample lines none
- prod_token: exit 0, 101 s, {'counterexample': 1, 'unproved': 3}, counterexample lines ['VinculumFinalisToken.sol:122']
- prod_verifier: exit 0, 261 s, {'solver_error': 49, 'unproved': 56}, counterexample lines none

## Notes

- prod_synth (production VinculumFinalisSynth.sol): FAIL-TO-RUN. solc/libz3 crashes with SIGSEGV after about 25 s, three times, with a 5 GB cap, a 6.5 GB cap and no cap. The Synth properties are covered by the instrumented copy (harness_synth), which ran to completion.
- prod_stake and prod_verifier ran to exit 0 but almost every target came back 'Error trying to invoke SMT solver' (92 of 97 and 49 of 56). Those targets are inconclusive, not proven.
- harness_feemath first run inherited the whole BaseCommitmentVaultLock and was OOM-killed (exit 247). It was replaced by FeeMath.sol, a verbatim extract of _quote (extract_feemath.py), which ran in 26 s.
- A second token run with only the assert target was OOM-killed after 639 s (results/harness_token_assert_only.txt).
- The box rebooted about 07:18 EDT on Oct 23 and /workspace was restored from a snapshot. prod_verifier and prod_synth were rerun after that; all other outputs survived.
- Supplementary BMC runs (run_bmc_supplement.sh) are labelled as such and are not counted as CHC verdicts.

## SMT findings

- SMT-01 (info) base-contracts/contracts/VinculumFinalisSynth.sol:145 (also :144): CHC found a real overflow trace in forge() for a huge count. Solidity 0.8 checked math turns it into a revert, so no wrap and no free mint.
- SMT-02 (info) base-contracts/contracts/BaseCommitmentVaultLock.sol:349: CHC overflow trace for gross * STANDARD_FEE_BPS when gross > 2^256/500. Checked math reverts. No real token has that supply. Same trace on the extracted copy (FeeMath.sol:37).
- SMT-03 (info) base-contracts/contracts/BaseCommitmentVaultLock.sol:224: CHC underflow trace for _balanceOf(after) - beforeBal when the pulled token lowers the vault balance during transferFrom (a hostile or rebasing token). Checked math reverts, so the lock is refused. Ties to finding L04 (rebasing tokens).
- SMT-04 (info) base-contracts/contracts/BaseCommitmentVaultLock.sol:317: CHC overflow trace for createdAt + duration. duration is limited to the fixed CommitmentDurations table, so only a solver-chosen huge timestamp reaches it. Checked math reverts.
- SMT-05 (info) base-contracts/contracts/VinculumFinalisToken.sol:122 (hardCap set at :84 with no range check): CHC overflow trace for totalSupply + amount. It needs a deployment with hardCap near 2^256, which the constructor accepts without a check. Checked math reverts. Deployment script must pass the Rev 6 cap.
