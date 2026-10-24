# On-the-day checklist (Base-only launch)

Short form of `DEPLOYMENT_DAY_RUNBOOK.md`. The runbook is the full text and
wins if the two ever differ. Nothing here sends anything for you: every
transaction is a MetaMask prompt you sign. No key is typed, pasted or stored.

Founder directive t357u: the launch is Base-only. No lock is deployed on any
other chain, no other reader is registered, and only the 27 Base rows of
Revision B are registered (26 token addresses, no aliases). The sixteen lock
contracts and their readers stay in the source tree and are not deployed.

## A. Build and checks (from `base-contracts`, fresh copy of `main`)
- [ ] `git fetch` then `git checkout main` and `git pull`, then
      `npm install --legacy-peer-deps`
- [ ] `npx hardhat compile --force`
- [ ] `node scripts/build_ceremony_artifacts.cjs`: check the Base ETH price it
      prints is today's. No price: stop.
- [ ] `git status`: only `ceremony-data.json` changed. `ceremony.json`
      unchanged (the test `ceremony_artifacts_match_compile` fails if it
      differs from the compile). Anything else: stop.
- [ ] `npm run ceremony:dryrun:simulate`: prints
      `mode: SIMULATE (Base-only, ...)`, `ceremony would succeed` and
      `reconciliation PASS`. Anything else: stop.
- [ ] `NODE_OPTIONS=--max-old-space-size=12288 npx hardhat test`, alone,
      about 30 minutes, 0 failing.
- [ ] Hash check (runbook 1.5). Any differs: stop.

## B. Funding (fresh gas)
- [ ] Base only: the ceremony is 17 transactions. Fund the deployer wallet
      with at least 3 times the gas figure from the dry-run
      (`testing-rigs/ceremony-dryrun/dryrun_gas.json`).

## C. Page
Serve `scripts/deploy-pages` with `python3 -m http.server 8080` and open
`http://localhost:8080/base.html` (chain id 8453). "Connect wallet", read the
price line, then "Run ceremony". 17 prompts:

| Prompts | What |
|---|---|
| 1 to 5 | VCLM, CHONX, Verifier, Forge (SYNTH), Stake |
| 6 | Base lock (BaseCommitmentVaultLock) |
| 7 to 8 | `VCLM.initialize(Verifier, Stake)`, `CHONX.initialize(Verifier, 0)` |
| 9 to 10 | Base reader (BaseLockRecordVerifier) deploy and registration |
| 11 | 1 registry batch (27 Base rows) |
| 12 | 1 token address batch (26 Base token addresses) |
| 13 | Base Dev Fund |
| 14 to 16 | poster to your wallet, price run 1, poster to `0x6001…0DB4` |
| 17 | `finalize` |

## D. Stop points
- [ ] Stop point A, after prompt 6. The log shows `VCLM 0x…`, `CHONX 0x…`,
      `Verifier 0x…`, `Forge 0x…`, `Stake 0x…`, then `Base lock 0x…`.
      Before prompt 7 run
      `node scripts/prepareLockDeploy.cjs --check Base <Base lock address>`.
      It must print `ALL CHECKS PASSED` (code, 5% fee on every duration
      including the 1-hour Handshake, Dev Fund, the three token addresses
      with symbols VCLM, CHONX, SYNTH, and all three refused).
      Otherwise reject prompt 7 and stop.
- [ ] Stop point B, before prompt 17 (`finalize`). The log has exactly:
      one `reader Base` line, `registry 27/27`, `token addresses 26/26`.
      Anything else: reject.
- [ ] After `Finalized.` copy the log box and result box into
      `~/vf-ceremony/ceremony-log.txt`.

If anything stops before `finalize`: reload `base.html` and start again; it
makes a new full set. Never speed up or replace a pending transaction.

## E. After the ceremony
1. [ ] `node scripts/applyCeremonyAddresses.cjs --log ~/vf-ceremony/ceremony-log.txt --rpc https://mainnet.base.org --out ~/vf-ceremony/base44-values.json --write`
       must print "On-chain read-only checks on Base: all passed" (it also
       checks the Base lock's three token addresses, that Stake reads the
       Verifier's launch time, and that no other environment has a reader or
       a Dev Fund destination).
2. [ ] App tests, `npm run lint`, `npm run build`; secret-scan and commit only
       `src/lib/vfDeployedAddresses.js`; push.
3. [ ] Base44 section 6 with `base44-values.json`.
4. [ ] Price run 2: `node scripts/fetchPrices.cjs --out fetched.json`,
       `node scripts/priceRun.cjs fetched.json --run 2 --out run2.json`; the
       poster `0x6001…0DB4` signs it. Point the poster service at the new
       Verifier.
5. [ ] Stake epochs (from day 10 after finalize, then every 10 days). See
       below.
6. [ ] Final checklist in runbook section 5.

## F. Stake epoch calls after the ceremony
Epoch N runs from launch + (N-1) x 10 days to launch + N x 10 days. Launch
is the Verifier's `protocolLaunchTimestamp` (the `finalize` block time, also
`launch_timestamp` in `src/lib/vfDeployedAddresses.js`). Stake reads the same
value (`Stake.launchTimestamp()`).

Who: anyone. The calls are permissionless and move no user funds. Nobody
else is obliged to call them, so the operator's wallet should (the deployer
wallet or any funded Base wallet; no role is needed). The Base44 app does not
make these calls.

| Call (on Stake) | When | What it does | Gas (test chain) | Cost at 0.006 gwei |
|---|---|---|---|---|
| `closeEpoch(N)` | at or after launch + N x 10 days; epochs strictly in order 1, 2, 3, … (an epoch with no fees must still be closed) | records the Verifier's `epochRewardBasis(N)` and fixes the epoch's total weight | at most about 135,000, the same with 30 or 5,000 positions | under 0.000001 ETH |
| `allocateEpoch(N)` | at or after launch + (N+1) x 10 days, once N is closed, strictly in order: only N = `lastAllocatedEpoch()` + 1 is accepted, epoch 1 first (otherwise "VF-STK-010: allocate in epoch order (t270u)"); an epoch with no fees, no eligible stake or no cap room still counts as allocated | mints Basis / $0.10 VCLM to Stake once; 0 if no fees or no eligible stake | at most about 173,000, the same with 30 or 5,000 positions | under 0.000002 ETH |
| `claimPosition(positionId, toEpoch)` or `claimPositions([ids], toEpoch)` | by the position's owner, for epochs whose N+1 has ended and that are allocated | pays floor(epoch VCLM x weight / total weight) for each unclaimed epoch up to toEpoch; a second claim of the same epochs is refused | about 77,000 for 1 epoch, about 8,600 to 10,000 more per epoch (a 120-day position, 11 epochs: about 144,000); every claim pays the full floor(epoch VCLM x weight / total weight), nothing is deducted | under 0.000001 ETH |
| `syncChonxActivation()` (on the Verifier) | after an allocation that takes lifetime VCLM to 10,000,000 or more | records CHONX activation (the next CHONX lock would also do it) | small | under 0.000001 ETH |

Schedule: day 10 close 1; day 20 close 2 and allocate 1; day 30 close 3 and
allocate 2; and so on, every 10 days. Allocation is in strict epoch order
(t270u(g)): if one is missed, allocate the earliest unallocated epoch first. Late calls lose nothing (boundaries
never move and claims never expire), except that an allocation is refused in
full if the VCLM cap cannot hold the whole epoch reward at that time.

CHONX activation margin (VF-COM-025, t271u): the Verifier mints CHONX for a
lock only if the lock was created after CHONX activation was recorded
(`chonxActivationTimestamp()`). A Base lock must be created strictly later
(a lock in the activation block is refused). (The 1-day margin for other chains,
`CHONX_SOURCE_CLOCK_MARGIN_SECS`, does not apply: the launch is Base-only.) Earlier CHONX
locks are refused forever ("VF-COM-025: lock created before CHONX activation");
their principal is still released at maturity.

Read state with `epochs(N)`, `getCurrentEpoch()`, `claimableVclm(positionId, toEpoch)`, `nextClaimEpoch(positionId)`, `epochTotalWeight(N)`. No call loops over positions, so none can become too large for Base's 16,777,216 per-transaction gas cap; a claim covers at most the epochs the owner chooses (about 1,677 to 1,937 epochs, 46 years or more, fit in one transaction). Allocation catches up after any delay one epoch per transaction (99 in a row tested, about 88,000 gas each).
Each call is a normal transaction to the Stake address in `base44-values.json` (STAKE), sent from MetaMask or any wallet that can call a contract function; close and allocate take only N; a claim takes the position id(s) and the last epoch to claim.
