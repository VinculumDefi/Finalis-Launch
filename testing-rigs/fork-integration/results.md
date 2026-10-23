# Rig 2: mainnet-fork integration (local forks only)

Run 2026-10-23 EDT on branch rigs/hardhat (main b0e38a9). Nothing broadcast, no keys.

| Suite | Fork | Result |
|---|---|---|
| eth_fork_tokens.test.cjs | Ethereum block 26255094 (eth.drpc.org) | 7 passing, EXIT 0 (eth_fork_run.log) |
| base_fork_stack.test.cjs | Base block 52983211 (mainnet.base.org) | 7 passing, 1 pending (cbETH, fail closed), EXIT 0 |
| base_live_probe.test.cjs | Base, live set read-only | 2 passing, EXIT 0 |

## Ethereum tokens (lock, release; CommitmentVaultLock)
- USDT: approve over a nonzero allowance reverts (HH-008, app Lock.jsx:171 has no reset). The lock path handles the no-bool return: fee 250, release 4750 of 5000.
- USDC: exact 5% fee, exact release.
- Fee-on-transfer (RigFeeOnTransfer, 1%; PAXG has a zero fee on this fork so a rig token was used): stated 2, recorded gross 1.98 (received delta), fee 0.099, Dev Fund received 0.09801 (short 0.00099), lock kept 1.881 = principal (solvent), release delivered 1.86219 of 1.881. Losses fall on the Dev Fund and the user (HH-007).
- Rebasing (AMPL): two 10k locks, then a -10% rebase. Pool 17,100 vs recorded principals 19,000. Release 1 paid 9,500, release 2 reverted "CVL: release" (HH-005).
- stETH: 1-wei rounding (HH-006).
- LINK, WBTC: exact.
- Ethereum mint on the fork: not exercised (EDR has no eth_getProof after local changes), INCOMPLETE TESTING (HH-012).

## Base full stack (deployed the way the ceremony page does)
- ETH, USDC, AERO, cbBTC: exact 5% fee, VCLM minted, principal returned at maturity.
- cbETH skipped: feed label "CBETH / USD" vs registry "cbETH / USD", fail closed (HH-013).
- $0.95 rule, CHONX opening at 10M VCLM, SYNTH 100M CHONX gate and 1,000 VCLM + 10,000 CHONX cost: pass.
- HH-001 on real Base state: one stranger call moved a lock basis from 3312.80 to 3384.82 USD.

## Live Base set (read only)
- Finalized, 15 readers as recorded, Solana absent, minters fixed, launch Oct 22.
- Simulated RAC replay on live state: +358.83 USD from 5 replays, about 3588 future VCLM (HH-001). Not sent.
- valuationTimestamp=0 gives the same value today (31098.86) because launch is recent; HH-002 is latent until decay.
