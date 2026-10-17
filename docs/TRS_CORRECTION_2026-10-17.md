# TRS correction — 2026-10-17

Authorized by the operator on 2026-10-17.

## Treasury Reward Stake durations (VF-STK-003 / VF-STK-021)

The stake contract uses its own four-duration table. It no longer reuses the
sixteen Commitment Vault lock durations (`CommitmentDurations.sol`).

| Duration | Seconds    | Multiplier (bps) | Multiplier |
|----------|------------|------------------|------------|
| 30 days  | 2,592,000  | 10000            | 1.00×      |
| 60 days  | 5,184,000  | 14000            | 1.40×      |
| 90 days  | 7,776,000  | 17500            | 1.75×      |
| 120 days | 10,368,000 | 21000            | 2.10×      |

Any other duration is rejected with `VF-STK-003: duration not permitted`, both
when creating a position and when queuing an extension. VF-STK-021 reads
"Queue one future term 30/60/90/120d".

## 120-day multiplier

Historical Solidity used 20000 bps (2.00×) for 120 days. The operator
authorized 21000 bps (2.10×) on 2026-10-17.

## Files changed

- `base-contracts/contracts/VinculumFinalisStake.sol`: removed
  `import "./CommitmentDurations.sol";`; four constants; `stakeDurationCount()`
  returns 4; `stakeMultiplierBps` and `_getStakeMultiplier` accept only the
  four durations and revert otherwise.
- `src/lib/vfRevision6Authority.js`: `STAKE_DURATIONS` is a distinct four-row
  array (`label`, `secs`, `multiplier_bps`) with the values above.
- `base-contracts/test/01_findings.test.cjs` and
  `src/base-verifier/tests/representative-rules.test.js`: expect the four-row
  table and reject unsupported durations.

Not changed: `CommitmentVaultLock.sol`, `CommitmentDurations.sol`, the verifier
lock path, and all mint and release logic.
