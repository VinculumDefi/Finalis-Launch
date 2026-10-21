# On-the-day checklist, tonight 2026-10-21

Short form of `DEPLOYMENT_DAY_RUNBOOK.md`. The runbook is the full text and
wins if the two ever differ. Nothing here sends anything for you: every
transaction is a MetaMask prompt you sign. No key is typed, pasted or stored.

## A. Build and checks (from `base-contracts`, fresh copy of main)
- [ ] `git pull` then `npm install --legacy-peer-deps`
- [ ] `npx hardhat compile --force`
- [ ] `node scripts/deploy-pages/buildDeployPages.cjs`
- [ ] `node scripts/build_ceremony_artifacts.cjs`: check the Base ETH price it
      prints is today's. No price: stop.
- [ ] `git status`: only `ceremony-data.json` and the fifteen chain pages
      (commit stamp) changed, plus `deployment/lockDeploy.prepared.json` if
      you ran the gas refresh. `ceremony.json` unchanged. Anything else: stop.
- [ ] `NODE_OPTIONS=--max-old-space-size=12288 npx hardhat test`, alone,
      about 20 minutes, 0 failing.
- [ ] Hash check (runbook 1.5). Expected:
      VinculumFinalisVerifier `0x4ad594b4…423fe3`,
      VinculumFinalisStake `0x049de69e…b79f47`,
      BaseCommitmentVaultLock `0x7954931f…789df9`,
      CommitmentVaultLock `0x2daadaf6…80bd99`. Any differs: stop.

## B. Funding (fresh gas)
- [ ] `node scripts/prepareLockDeploy.cjs` (read only) right before you start.
      Fund at least 3 times the figure it prints. Readings at 3:52 PM ET:

| Chain | Sends | Gas | Fund at least |
|---|---|---|---|
| Ethereum | 1 lock deploy | 1,596,454 | 0.0013 ETH (more if above 0.27 gwei) |
| Arbitrum | 1 lock deploy | 1,609,489 | 0.0001 ETH |
| Optimism | 1 lock deploy | 1,596,454 | 0.000006 ETH |
| Polygon | 1 lock deploy | 1,599,828 | 1.35 POL |
| BNB Smart Chain | 1 lock deploy | 1,596,538 | 0.00024 BNB |
| Avalanche | 1 lock deploy | 1,596,466 | 0.013 AVAX |
| Base | ceremony, 72 transactions | 109,665,401 | 0.002 ETH (more if above 0.02 gwei) |

Base at 0.006 gwei: about 0.000661 ETH in all (about $1.65).

## C. Pages, in this order
Serve `scripts/deploy-pages` with `python3 -m http.server 8080` and open
`http://localhost:8080/<page>.html`.

1. [ ] `ethereum.html`, `arbitrum.html`, `optimism.html`, `polygon.html`,
       `bnb-smart-chain.html`, `avalanche.html` (any order). One prompt each.
       Each logs `CommitmentVaultLock (<Chain>)  0x…`.
       After each: `node scripts/prepareLockDeploy.cjs --check "<Chain>" <address>`
       must print `ALL CHECKS PASSED`. Save the address in `new-locks.json`.
2. [ ] `base.html` (chain id 8453). Paste the six addresses, "Connect wallet",
       read the price line, then "Run ceremony". 72 prompts:

| Prompts | What |
|---|---|
| 1 to 5 | VCLM, CHONX, Verifier, Forge (SYNTH), Stake |
| 6 | Base lock (BaseCommitmentVaultLock) |
| 7 to 8 | `VCLM.initialize(Verifier, Stake)`, `CHONX.initialize(Verifier, 0)` |
| 9 to 38 | 15 reader deploys and 15 registrations |
| 39 to 48 | 10 registry batches |
| 49 to 58 | 10 token address batches |
| 59 to 61 | 3 aliases |
| 62 to 68 | 7 Dev Fund settings |
| 69 to 71 | poster to your wallet, price run 1, poster to `0x6001…0DB4` |
| 72 | `finalize` |

## D. Stop points
- [ ] Stop point A, after prompt 6. The log shows `VCLM 0x…`, `CHONX 0x…`,
      `Verifier 0x…`, `Forge 0x…`, `Stake 0x…`, then `Base lock 0x…`.
      Before prompt 7 run
      `node scripts/prepareLockDeploy.cjs --check Base <Base lock address>`.
      It must print `ALL CHECKS PASSED` (code, 5% fee, Dev Fund, the three
      token addresses with symbols VCLM, CHONX, SYNTH, and all three refused).
      Otherwise reject prompt 7 and stop.
- [ ] Stop point B, before prompt 72 (`finalize`). The log has exactly:
      15 `reader` lines (no Solana), `registry 487/487` (10 progress lines),
      `token addresses 475/475` (10 progress lines). Anything missing: reject.
- [ ] After `Finalized.` copy the log box and result box into
      `~/vf-ceremony/ceremony-log.txt`.

If anything stops before `finalize`: reload `base.html` and start again; it
makes a new full set (about 0.00066 ETH again). Never speed up or replace a
pending transaction.

## E. After the ceremony
1. [ ] `node scripts/applyCeremonyAddresses.cjs --log ~/vf-ceremony/ceremony-log.txt --locks ~/vf-ceremony/new-locks.json --rpc https://mainnet.base.org --out ~/vf-ceremony/base44-values.json --write`
       must print "On-chain read-only checks on Base: all passed" (it also
       checks the Base lock's three token addresses and that Stake reads the
       Verifier's launch time).
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
| `closeEpoch(N)` | at or after launch + N x 10 days; epochs strictly in order 1, 2, 3, … (an epoch with no fees must still be closed) | records the Verifier's `epochRewardBasis(N)` and fixes the epoch's total weight | at most about 135,000, the same with 30 or 3,000 positions | under 0.000001 ETH |
| `allocateEpoch(N)` | at or after launch + (N+1) x 10 days, once N is closed | mints Basis / $0.10 VCLM to Stake once; 0 if no fees or no eligible stake | at most about 151,000, the same with 30 or 3,000 positions | under 0.000001 ETH |
| `claimPosition(positionId, toEpoch)` or `claimPositions([ids], toEpoch)` | by the position's owner, for epochs whose N+1 has ended and that are allocated | pays floor(epoch VCLM x weight / total weight) for each unclaimed epoch up to toEpoch; a second claim of the same epochs is refused | about 72,000 for 2 epochs, about 7,700 more per epoch (a 120-day position, 11 epochs: about 142,000) | under 0.000001 ETH |
| `syncChonxActivation()` (on the Verifier) | after an allocation that takes lifetime VCLM to 10,000,000 or more | records CHONX activation (the next CHONX lock would also do it) | small | under 0.000001 ETH |

Schedule: day 10 close 1; day 20 close 2 and allocate 1; day 30 close 3 and
allocate 2; and so on, every 10 days. Late calls lose nothing (boundaries
never move and claims never expire), except that an allocation is refused in
full if the VCLM cap cannot hold the whole epoch reward at that time.
Read state with `epochs(N)`, `getCurrentEpoch()`, `claimableVclm(positionId, toEpoch)`, `nextClaimEpoch(positionId)`, `epochTotalWeight(N)`. No call loops over positions, so none can become too large for Base's 16,777,216 per-transaction gas cap; a claim covers at most the epochs the owner chooses (about 2,100 epochs fit in one transaction).
Each call is a normal transaction to the Stake address in `base44-values.json` (STAKE), sent from MetaMask or any wallet that can call a contract function; close and allocate take only N; a claim takes the position id(s) and the last epoch to claim.
