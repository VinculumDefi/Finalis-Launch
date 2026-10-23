# Expanded sampling on the test chain (2026-10-23)

Test chain and repo only. Nothing here was deployed, broadcast or finalized on a live network, and no real keys were used.
Finalize runs only on the local Hardhat chain (chain id 31337), which the ceremony refuses to leave.

- Branch: test/solana-sampling-2026-10-23, cut from origin/main bc45618.
- Contracts: current main, unchanged. The test adds two mock tokens in base-contracts/contracts/test/SamplingTokens.sol.
- Test: base-contracts/test/sampling_expanded.test.cjs
- Results: results/locks.jsonl, results/stake.jsonl, results/decay.jsonl, results/deviations.jsonl (rewritten on every run).

Run it with:

```
cd base-contracts
NODE_OPTIONS=--max-old-space-size=4096 npx hardhat test test/sampling_expanded.test.cjs
```

## How the test chain is built

1. `runCeremony(hre)` from scripts/testChainCeremony.cjs deploys VCLM, CHONX, the Verifier, Synth and Stake. It registers all 487 Rev B rows, the token index and the aliases, and posts run 1.
2. The test initializes VCLM with (Verifier, Stake) and CHONX with (Verifier, 0).
3. For each sampled ERC-20, the test places mock token code at the indexed token address with `hardhat_setCode`. Standard and stable tokens use SamplingFeeToken with its fee at 0. USDT also runs in no-return mode, the way USDT behaves on Ethereum. AMPL and stETH use SamplingRebasingToken, which is share-based.
4. The test posts a price run with the prices fetched on 2026-10-23 between 09:41 and 09:51 ET (see testing-rigs/prices-2026-10-23). It then finalizes on the test chain.

## Assets sampled (11)

| Asset | Class in test | Environment | Lock |
|---|---|---|---|
| ETH | native | Base | BaseCommitmentVaultLock |
| ETH | native | Ethereum | CommitmentVaultLock |
| AERO | standard ERC-20 | Base | BaseCommitmentVaultLock |
| cbBTC | standard ERC-20 | Base | BaseCommitmentVaultLock |
| LINK | standard ERC-20 | Ethereum | CommitmentVaultLock |
| USDC_BASE | stablecoin | Base | BaseCommitmentVaultLock |
| USDC | stablecoin | Ethereum | CommitmentVaultLock |
| USDT | stablecoin (no-return transfer) | Ethereum | CommitmentVaultLock |
| PAXG | fee-capable (fee off, then 1% in a probe) | Ethereum | CommitmentVaultLock |
| AMPL | rebasing (elastic supply) | Ethereum | CommitmentVaultLock |
| stETH | rebasing (share-based) | Ethereum | CommitmentVaultLock |

Each asset's custody class must match the Rev 6 rule. The test checks this.

## Spec numbers the test checks

- VCLM rate is 10 per $1 at launch. It decays by 1.667% for each whole 30 days (survival factor 0.98333). The floor is 1 per $1.
- Minted VCLM = USD value x rate x custody class multiplier x duration multiplier. The class multipliers are S1 1.5x, S2 1.3x and S3 1.0x. Every division rounds down, the same way the contract does it.
- The rate is flat inside each 30-day period. Day 4109 is still above the floor, and day 4110 (period 137) is the first day at the floor.
- The fee is 5% (500 bps) and goes to the Dev Fund. Exactly 95% of what arrived is the principal.
- The 16 lock durations and their multipliers come from the spec table. A 17th duration (2 days) must be refused with "CVL: duration".
- The 4 Stake durations are 30, 60, 90 and 120 days, at 1.0x, 1.4x, 1.75x and 2.1x (docs/TRS_CORRECTION_2026-10-17.md). A 45-day position must be refused.
- USDC and USDT style stables: a price below $0.95 is refused. A price of exactly $0.95 mints at $0.95, with no $1 substitute. A failed price run is refused.

## What every asset test does

For each of the 11 assets:

1. It refuses a 17th duration.
2. It makes 16 locks, one for each duration. For each lock it checks the gross amount, the fee, the principal, the Dev Fund delta and the vault delta. Minted VCLM must equal the spec number exactly.
3. It opens 4 Stake positions from the minted VCLM, one for each duration, and checks that a 45-day position is refused.
4. In a snapshot, it checks that each position can't be withdrawn 1 second early or by a non-owner, then withdraws it once and refuses a second withdrawal.
5. In a snapshot, it checks that each lock can't be released 1 second early or by anyone other than the destination. It then releases each lock once, for exactly the principal, and refuses a second release.

## Counts (last run, 2026-10-23 ET)

- Tests: 22 passing, 0 failing, 0 pending.
- Locks: 176 (11 assets x 16 durations). All 176 minted exactly the spec amount, and all 176 released exactly the principal.
- Stake positions: 44 (11 x 4), all withdrawn at maturity. 11 refusals of the 45-day duration.
- Emission curve: 18 sample days from day 0 to day 4500, all exact (decay.jsonl).
- Deviation probes: 9 rows in deviations.jsonl, plus the constants check.

## Deviations

There are four classes: confirmed vulnerability, spec conflict, unverified assumption and incomplete testing.
"Live" means the path can be reached with the Rev B set and the contracts as they stand. "Latent" means no asset reachable today can trigger it.

| # | Finding | Class | Live or latent | Evidence | Already in MASTER_FINDINGS |
|---|---|---|---|---|---|
| S-1 | Fee-on-transfer token. The vault records the amount that arrived, so minting is not inflated. But the 5% fee transfer to the Dev Fund is also charged a fee, so the Dev Fund gets less than the recorded fee. The release is charged again, so the destination gets less than the principal. With a 1% token fee, the destination got 93.10% of what was sent, not 95%. | Confirmed vulnerability | Latent (no registered token charges a fee today; PAXG and USDT can switch one on) | fee-on-transfer-PAXG, fee-on-transfer-USDT | HH-007, part of AG-08 |
| S-2 | AMPL negative rebase. The principal is stored as a fixed amount, but the vault balance shrinks. After a 10% negative rebase, 16 of 18 AMPL locks released and the last 2 reverted with "CVL: release". About 33.66 AMPL stayed in the vault, and those 2 owners can't get part of it because there is no partial release or sweep. | Confirmed vulnerability | Live (on-chain; gated only by Ethereum prices not yet posted on the live set. AMPL row 610 is indexed on the Ethereum lock.) | rebasing-AMPL (negative) | HH-005, part of AG-08 |
| S-3 | AMPL positive rebase. After a 10% positive rebase, all 18 locks released, but the surplus (about 190.75 AMPL) stays in the vault forever. There is no function that can move it. | Confirmed vulnerability | Live (same gate as S-2) | rebasing-AMPL (positive) | HH-005, part of AG-08 |
| S-4 | Share-based rebasing token rounding (stETH style). A transfer is rounded down to whole shares, so the destination can get 1 wei less than the recorded principal. In the AMPL probe, 7 of 18 releases were also 1 wei short. | Confirmed vulnerability (dust only) | Live (same gate as S-2; stETH row 9 is indexed) | rebasing-stETH-rounding | HH-006, part of AG-08 |
| S-5 | The valuation timestamp is not bound to the lock time. A lock made on day 400 and submitted with valuationTimestamp equal to the launch time minted at the day-0 rate, 1.244x what an honest submission gets. | Confirmed vulnerability | Live (Base set) | valuation-timestamp-unbound | AG-05 (STATIC-H02, HH-002) |
| S-6 | The price is bound at the first proof, not at lock time. A lock made at the fetched price and proven after a run that doubled the price minted 2x the spec amount. | Confirmed vulnerability | Live (Base set) | price-bound-at-first-proof | AG-06 (STATIC-M01, HH-004) |
| S-7 | There is no on-chain staleness check on posted prices. The Verifier uses the latest run for an asset however old it is. Whether that is by design (the poster is trusted) is not stated in the spec. | Unverified assumption | Live (Base set) | Code review of the Verifier during this sampling | Related to AG-06 |
| S-8 | Stake reward amounts were not sampled. The test checks durations, multipliers, maturity, owner checks and return of principal, but not the reward payout. This sampling did not cover it. | Incomplete testing | Not applicable | Not applicable | New |
| S-9 | `verifyAndMint(pkg, daysSinceLaunch)` ignores its second argument. The days come from the package's valuation timestamp. This does not change minting on its own, but it is the reason S-5 is possible. | Spec conflict (interface is misleading) | Live (Base set) | Code review | Part of AG-05 |

What passed with no deviation:

- The $0.95 rule on USDT, USDC_BASE and USDC. Below $0.95 is refused, exactly $0.95 mints at $0.95, and a failed run is refused. No $1 hardcode was found.
- The exact emission curve over 18 sample days, including both sides of every period boundary tested and the floor at day 4110.
- Exact VCLM on all 176 locks, the exact 95% principal, and no early or double release on all 11 assets.
- All 4 Stake durations, and a refused fifth.
- USDT-style no-return transfers work on both lock and release.
