# Deployment day runbook (Base-only launch)

Founder directive t357u: the launch is Base-only. One page (`base.html`) on
Base. No lock is deployed on any other chain, no other reader is registered,
and only the 27 Base rows of registry Revision C are registered (26 token addresses,
no aliases). Operator decision t367u: Revision C is Revision B with row 454
Base USDC as S1 (1.5x). The sixteen lock contracts and their readers stay in the source
tree and are not deployed. The founder signs every transaction.

One document for the day. Plain steps, in order. The short tick list for
tonight is `CEREMONY_CHECKLIST_2026-10-21.md`. Nothing in this repository
sends a transaction for you: every transaction is a MetaMask prompt you sign
yourself. No key is ever typed, pasted or stored anywhere in this repository.
Addresses are shortened on purpose.

Rules that govern the day:
- Revision 12 governs the Handshake: 5% fee on every duration, Handshake worth
  $0.01 to $0.02. Revision 6 governs everything else.
- Contract minimum for every other duration: $0.01.
- A lock's price is fixed at its first fee recording. With no usable price the
  Verifier refuses (fails closed).
- `CHONX.initialize(Verifier, 0)` is the start state. CHONX output activates at
  10,000,000 lifetime VCLM: VCLM minted for locks plus VCLM minted as
  Treasury Reward Stake rewards (operator t264u). If rewards cross the line,
  anyone may call `syncChonxActivation()` on the Verifier, or the next CHONX
  lock records it. SYNTH forging opens at 100,000,000 cumulative CHONX.
- Locks refuse VCLM, CHONX and SYNTH as lock inputs before any fee is taken
  (the Base lock by its own check, the Verifier by refusing to index them).
  Stake (TRS) accepts all three at 1x / 2x / 4x weight for 30, 60, 90 or 120
  days.
- Stake rewards per 10-day epoch are the Verifier's Epoch Reward Basis for that
  epoch (60% of the USD fees recorded) divided by $0.10, in VCLM, shared by
  weight and duration. Epochs start at the Verifier's launch time (finalize).
- Live price poster: `0x6001…0DB4`.
- Registry: the Base subset of Revision C (`assetRegistry.revC.json`, 487
  rows; Base USDC row 454 is S1, 1.5x): 27 Base rows (26 tokens plus Base ETH), 26 token
  addresses, no aliases. No other environment is registered. cbETH is
  registered and hidden in the app only.
- Old 2.5% locks (`0x968B…C946` on Base, `0x4eDE…3b1a` on the six other EVM
  chains) are retired. They are never used for a new lock.

## 1. Before you start

### 1.1 Wallet funding (one deployer wallet, Base only)
The Base ceremony is 17 transactions (7 contract deploys and 10 calls). The
gas used by each is in `testing-rigs/ceremony-dryrun/dryrun_gas.json` from
the SIMULATE dry-run (1.4). Read the Base gas price on the day and fund at
least 3 times the total. Nothing is sent on any other chain.

### 1.2 Base44 app, sections 1 to 5
Sections 1 to 5 of the Base44 instructions (`BASE44_APP_FIX_PROMPT.md`) are
applied and checked in the live Base44 app before the ceremony. Section 6 is
done only after the ceremony (step 4.3).

### 1.3 Build the deploy files once, from `main`
In a fresh copy of `main`, from `base-contracts`:

```
git pull
npm install --legacy-peer-deps
npx hardhat compile --force
node scripts/build_ceremony_artifacts.cjs --keep-price
```

The last command rebuilds `scripts/deploy-pages/ceremony-data.json` from
Revision C and keeps the committed first Base ETH price (t364u: no price
refresh before the ceremony; no network call). `git status` should then show
no change. If it refuses, stop.

Then `git status` should show only `ceremony-data.json` as changed.
`ceremony.json` must be unchanged. If
anything else changed, stop. Do not run the registry rebuild scripts on this
day (`scripts/deploy-pages/README.md`, "Registry rebuild").

### 1.4 Dry-run and full test suite
```
npm run ceremony:dryrun:simulate
NODE_OPTIONS=--max-old-space-size=12288 npx hardhat test
```
The dry-run is a Base-only SIMULATE rehearsal on a local Base fork with a
local test signer (nothing is broadcast). It must print
`mode: SIMULATE (Base-only, ...)`, `ceremony would succeed` and
`reconciliation PASS`. Run the suite alone. It must pass with no failures
(about 30 minutes).

### 1.5 Hash checks
```
node -e "const {ethers}=require('ethers');const a=require('./scripts/deploy-pages/ceremony.json');for(const k of ['VinculumFinalisVerifier','VinculumFinalisStake','BaseCommitmentVaultLock','BaseLockRecordVerifier'])console.log(k,ethers.keccak256(a[k].bytecode))"
```
Expected:
```
VinculumFinalisVerifier 0xb42533648baca33b7b026add76955dc70045507bd1d8e4ba5407608785aa2d1f
VinculumFinalisStake 0xd2221a1a456915a91513fe0eef89ed1049f75cd5e634fe56ff4c56c9cfb3d07e
BaseCommitmentVaultLock 0xc37af7c9c27c0f3167a50793ccdcaae0b21e18ac8a9a8b0491962cee75e3b15e
BaseLockRecordVerifier 0x94a9466ae42e088ac881209ac982c2a21a2443acd3d18303a47f37e601b805b3
```

If any differs, stop.

### 1.6 Open the pages from a local web server
MetaMask does not work on pages opened as files, and `base.html` must load
`ceremony.json` and `ceremony-data.json` next to it. From
`base-contracts/scripts/deploy-pages`:

```
python3 -m http.server 8080
```

Then open `http://localhost:8080/base.html`. It is the only page. Do not use
`scripts/broadcast.html`, `scripts/ceremony.html` or the `broadcast*.cjs`
scripts. They are retired stubs: they send nothing and only point back to this
runbook.

Make a folder outside the repository, for example `~/vf-ceremony/`, with an
empty text file `ceremony-log.txt` to
write the results into. Keep these files, and `base44-values.json` later, out
of the repository folder.

## 2. Deploy steps, in order

### 2.2 Base ceremony (`base.html`, chain id 8453)
1. Click "Connect wallet". The page checks
   every input before anything is signed and prints the Base ETH price it will
   write as run 1. If it prints "Stopped before any signature", fix the input.
2. Click "Run ceremony". There are 17 MetaMask prompts in this order: VCLM,
   CHONX, Verifier, Forge, Stake, the Base lock, two initialize calls, the
   Base reader deploy and its registration, 1 registry batch (27 Base rows),
   1 token address batch (26 addresses), the Base Dev Fund, the poster set
   to your wallet, price run 1, the poster handed to `0x6001…0DB4`, and
   `finalize`.
3. Stop point A: after the 6th prompt the page logs five lines (`VCLM 0x…`,
   `CHONX 0x…`, `Verifier 0x…`, `Forge 0x…`, `Stake 0x…`) and then
   `Base lock 0x…`. Before signing the 7th prompt run
   `node scripts/prepareLockDeploy.cjs --check Base <Base lock address>`.
   It checks the lock code, the 5% fee on every duration including the
   1-hour Handshake, the Dev Fund, and that the lock holds
   the VCLM, CHONX and Forge (SYNTH) addresses just logged and refuses them.
   If it does not print `ALL CHECKS PASSED`, reject the next prompt and stop.
4. Stop point B: the last prompt is `finalize`. MetaMask shows the function
   name. Before signing it, read the log: one `reader Base` line,
   `registry 27/27`, `token addresses 26/26`. If anything else, reject.
5. When the page shows `Finalized.` and the result box, copy everything in the
   log box and the result box into `ceremony-log.txt`.

## 3. If something fails

General: a rejected or failed transaction sends nothing that matters on its
own. Never speed up or replace a pending transaction with different data. If a
transaction is pending for a long time, wait.

Base ceremony before `finalize` (2.2):
- Nothing is final until `finalize`. If the page stops for any reason (a
  rejected prompt, a failed transaction, a lost connection, stop point A or B),
  the contracts made so far are an unfinished set. Nobody else can configure
  them and the app never points at them.
- The page cannot resume an unfinished set. To retry, reload `base.html` and run
  it again from the start. It makes a new full set. This costs the Base gas
  again.
- Do not run `applyCeremonyAddresses.cjs` on an unfinished set. It refuses a
  log without `Finalized.` and, with `--rpc`, a Verifier that is not finalized.

Base ceremony after `finalize`:
- Nothing can be changed. Not the readers, the registry, the Dev Funds or the
  poster.
- If a check in step 4.1 or section 5 fails, that set cannot be fixed. Do not
  write it into the app. The only remedy is a new full ceremony (2.2) with a
  new set, after the operator decides.
- If the ETH price written in run 1 turns out wrong, it cannot be rewritten in
  run 1. The poster corrects it with run 2 (step 4.4). Locks already fee-recorded
  keep the price they were recorded with.

## 4. After the ceremony

### 4.1 Write the app config (one command, then one commit)
From `base-contracts`:

```
node scripts/applyCeremonyAddresses.cjs --log ~/vf-ceremony/ceremony-log.txt --rpc https://mainnet.base.org --out ~/vf-ceremony/base44-values.json --write
```

It refuses (and writes nothing) if any address is missing, malformed, zero, an
old contract, the poster or the Dev Fund, if the log has no `Finalized.`, if the
reader is not the Base reader only, or if any read-only check on Base fails:
Verifier finalized, poster `0x6001…0DB4`, the Base reader registered and no
other environment with a reader or a Dev Fund destination, VCLM and CHONX
minters, Forge and Stake bound to the Verifier, the Base reader bound to the
Base lock, and the Base lock's code.
It also reads the Verifier's launch time and checks that Stake reads the same
launch time (Stake epochs start there). It writes
`src/lib/vfDeployedAddresses.js` and `~/vf-ceremony/base44-values.json` (for
Base44 section 6).

### 4.2 App commit
From the repository root: run the app tests (`node --test src/tests/
src/xrpl-lock/tests/`), `npm run lint`,
`npm run build`. Then secret-scan and commit only
`src/lib/vfDeployedAddresses.js`, and push.

### 4.3 Base44 section 6
Give the Base44 app section 6 of `BASE44_APP_FIX_PROMPT.md` together with the
values from `base44-values.json`. Section 6 sets the Base lock address and
the new Base contracts (Base-only: no other lock is offered), removes the old addresses, changes the mint ABI (the
new Verifier has no `handshakeIdentity` field, so the two mint selectors change
to `0xf0f64b60` and `0x8c24712a`), and keeps release for locks already on the
old 2.5% locks. Until section 6 is applied, the live app's mint step stops
before sending ("Verifier ABI mismatch"), because its old mint ABI is not on
the new Verifier.

### 4.4 First price run (run 2)
Run 1 is the ceremony's Base ETH price. The live poster's first run is run 2:

```
node scripts/fetchPrices.cjs --out fetched.json
node scripts/priceRun.cjs fetched.json --run 2 --out run2.json
```

Neither command sends anything. `run2.json` holds the run and the exact
calldata. The poster `0x6001…0DB4` signs it as a transaction to the new
Verifier (`base44-values.json`, VERIFIER). If the script splits the work into
several runs, they are signed in order (2, 3, …). Assets with no fresh price get
a failure line and stay unavailable until a later successful run. The price
poster service must be pointed at the new Verifier address.

### 4.5 Stake epochs (from 10 days after finalize)
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

### 4.6 Retire the old locks
- The app (repository config and Base44 section 6) no longer offers
  `0x968B…C946` or `0x4eDE…3b1a` for a new lock.
- Release of locks already on them still works: the recorded release
  destination calls `release(lockId)` on that old lock at or after maturity.
- The old contracts stay on-chain and are not touched.

## 5. Final verification checklist
- [ ] The Base lock `--check` printed `ALL CHECKS PASSED`.
- [ ] Stop point A passed after the 6th prompt; stop point B passed before
      `finalize` (17 prompts in all).
- [ ] `ceremony-log.txt` has `Finalized.`, one `reader Base` line,
      `registry 27/27`, `token addresses 26/26`.
- [ ] `applyCeremonyAddresses.cjs --rpc … --write` printed "On-chain read-only
      checks on Base: all passed".
- [ ] App tests, lint and build pass; `vfDeployedAddresses.js` committed and
      pushed.
- [ ] Base44 section 6 applied; the Lock page shows the new Base lock and 5%
      on every duration; the mint step's own checks pass on Base.
- [ ] A first real Handshake on Base ($0.01 to $0.02) records its fee and mints
      VCLM to its Base recipient (test-chain proof:
      `test/base44_app_mint_rev_b.test.cjs`).
- [ ] Run 2 signed by `0x6001…0DB4`; `lastScheduledRunId` reads 2 or more.
- [ ] No page or app file offers `0x968B…C946` or `0x4eDE…3b1a` for a new lock.
