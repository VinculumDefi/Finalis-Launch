# Deployment day runbook (planned for 2026-10-21)

One document for the day. Plain steps, in order. The short tick list for
tonight is `CEREMONY_CHECKLIST_2026-10-21.md`. Nothing in this repository
sends a transaction for you: every transaction is a MetaMask prompt you sign
yourself. No key is ever typed, pasted or stored anywhere in this repository.
Addresses are shortened on purpose.

Rules that govern the day:
- Revision 12 governs the Handshake: 5% fee on every duration, Handshake worth
  $0.01 to $0.02. Bitcoin, Bitcoin Cash and Litecoin Handshakes use a coin unit
  band (11,000 to 22,000 sats; 110,000 to 220,000 litoshis) and count as at most
  $0.02. Revision 6 governs everything else.
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
- Registry: Revision B, 487 rows (486 plus Base ETH), 475 token addresses.
  Cosmos is dropped. Solana is not registered.
- Old 2.5% locks (`0x968B…C946` on Base, `0x4eDE…3b1a` on the six other EVM
  chains) are retired. They are never used for a new lock.

## 1. Before you start

### 1.1 Wallet funding (one deployer wallet, seven chains)
Figures read from public RPCs on 2026-10-21 at 3:52 PM ET. Gas prices move.
Re-run `node scripts/prepareLockDeploy.cjs` right before you start (read only;
it rewrites `deployment/lockDeploy.prepared.json`, which you do not need to
commit) and fund at least 3 times the figure it prints.

| Chain | What is sent | Gas | Cost at 3:52 PM ET | Fund at least |
|---|---|---|---|---|
| Ethereum | 1 lock deploy | 1,596,454 | 0.000163 ETH at 0.102 gwei | 0.0013 ETH (covers up to about 0.27 gwei) |
| Arbitrum | 1 lock deploy | 1,609,489 | 0.0000322 ETH at 0.020 gwei | 0.0001 ETH |
| Optimism | 1 lock deploy | 1,596,454 | 0.0000016 ETH at 0.001 gwei, plus at most about 0.00000025 ETH L1 data fee | 0.000006 ETH |
| Polygon | 1 lock deploy | 1,599,828 | 0.446 POL at 279 gwei | 1.35 POL |
| BNB Smart Chain | 1 lock deploy | 1,596,538 | 0.0000798 BNB at 0.05 gwei | 0.00024 BNB |
| Avalanche | 1 lock deploy | 1,596,466 | 0.00399 AVAX at 2.50 gwei | 0.013 AVAX |
| Base | the whole Base ceremony, 72 transactions | 108,965,768 | 0.000654 ETH at 0.006 gwei, plus at most 0.0000047 ETH L1 data fee = 0.000658 ETH | 0.002 ETH |

Ethereum gas moves the most. If Ethereum is above 0.27 gwei when you start,
fund 3 times the new figure instead of 0.0013 ETH.

How the Base figure was made: `baseCeremonyFlow.js` (the code `base.html`
runs) was run on the in-process test chain with the committed `ceremony.json`
and `ceremony-data.json`, and the gas used by every transaction the deployer
sent was added up: 72 transactions (21 contract deploys and 51 calls),
108,965,768 gas, 547,625 bytes of transaction data. The largest single
transaction used 4,132,368 gas. The Base gas price (0.006 gwei) was read with
`eth_gasPrice` from `https://mainnet.base.org`, and the L1 data fee upper bound
for each transaction was read from the Base gas price oracle
(`getL1FeeUpperBound`). At the CoinGecko ETH price read at the same time
($2,490.14, read at 4:22 PM ET) the Base total is about $1.64. Base's block gas limit was
400,000,000, so every transaction fits.

MetaMask may reserve more than the final fee for each transaction while it is
pending. A balance of 0.002 ETH on Base covers that for the largest
transaction many times over. If the Base gas price on the day is above
0.02 gwei, fund 3 times the new total instead.

### 1.2 Base44 app, sections 1 to 5
Sections 1 to 5 of the Base44 instructions (`BASE44_APP_FIX_PROMPT.md`) are
applied and checked in the live Base44 app before the ceremony. Section 6 is
done only after the ceremony (step 4.3).

### 1.3 Build the deploy files once, from main
In a fresh copy of main, from `base-contracts`:

```
git pull
npm install --legacy-peer-deps
npx hardhat compile --force
node scripts/deploy-pages/buildDeployPages.cjs
node scripts/build_ceremony_artifacts.cjs
```

The last command takes a fresh first Base ETH price into
`scripts/deploy-pages/ceremony-data.json`. Check the price it prints is today's.
If it reports no price, stop: the page will not send without one.

Then `git status` should show only `ceremony-data.json` and the fifteen chain
pages (their commit stamp) as changed (and `deployment/lockDeploy.prepared.json`
if you ran `prepareLockDeploy.cjs`). `ceremony.json` must be unchanged. If
anything else changed, stop. Do not run the registry rebuild scripts on this
day (`scripts/deploy-pages/README.md`, "Registry rebuild").

### 1.4 Full test suite
```
NODE_OPTIONS=--max-old-space-size=12288 npx hardhat test
```
Run it alone. It must pass with no failures (about 20 minutes).

### 1.5 Hash checks
```
node -e "const {ethers}=require('ethers');const a=require('./scripts/deploy-pages/ceremony.json');for(const k of ['VinculumFinalisVerifier','VinculumFinalisStake','BaseCommitmentVaultLock','CommitmentVaultLock'])console.log(k,ethers.keccak256(a[k].bytecode))"
```
Expected:
- VinculumFinalisVerifier `0x4ad594b4…423fe3`
- VinculumFinalisStake `0x50e8061e…466a76`
- BaseCommitmentVaultLock `0x7954931f…789df9` (the Base lock, deployed by `base.html`)
- CommitmentVaultLock `0x2daadaf6…80bd99` (the six other chains, unchanged)

If any differs, stop.

### 1.6 Open the pages from a local web server
MetaMask does not work on pages opened as files, and `base.html` must load
`ceremony.json` and `ceremony-data.json` next to it. From
`base-contracts/scripts/deploy-pages`:

```
python3 -m http.server 8080
```

Then open `http://localhost:8080/<page>.html`. Use only these pages:
`ethereum.html`, `arbitrum.html`, `optimism.html`, `polygon.html`,
`bnb-smart-chain.html`, `avalanche.html`, `base.html`. Do not use
`scripts/broadcast.html`, `scripts/ceremony.html` or the `broadcast*.cjs`
scripts. They are retired stubs: they send nothing and only point back to this
runbook.

Make a folder outside the repository, for example `~/vf-ceremony/`, with an
empty text file `new-locks.json` and an empty text file `ceremony-log.txt` to
write the results into. Keep these files, and `base44-values.json` later, out
of the repository folder.

## 2. Deploy steps, in order

### 2.1 Six lock pages (any order)
For each of Ethereum, Arbitrum, Optimism, Polygon, BNB Smart Chain and
Avalanche:
1. Open the chain's page. Click "Connect and deploy". The page refuses any
   other network.
2. Sign the one MetaMask prompt. Wait for the page to print
   `CommitmentVaultLock (<Chain>)  0x…`.
3. Write the full address into `new-locks.json` under that chain's name.
4. Run the read-only check, from `base-contracts`:
   `node scripts/prepareLockDeploy.cjs --check "<Chain>" <address>`
   It must print `ALL CHECKS PASSED`. If it does not, do not use that address
   (see section 3).

When all six are done, `new-locks.json` looks like this (your addresses):

```
{"Ethereum":"0x…","Arbitrum":"0x…","Optimism":"0x…","Polygon":"0x…","BNB Smart Chain":"0x…","Avalanche":"0x…"}
```

The same address on two chains is normal when the same wallet deployed both.

### 2.2 Base ceremony (`base.html`, chain id 8453)
1. Paste the six addresses into the six boxes. Click "Connect wallet". The page checks
   every input before anything is signed and prints the Base ETH price it will
   write as run 1. If it prints "Stopped before any signature", fix the input.
2. Click "Run ceremony". There are 72 MetaMask prompts in this order: VCLM,
   CHONX, Verifier, Forge, Stake, the Base lock, two initialize calls, 15
   reader deploys and 15 registrations, 10 registry batches, 10 token address
   batches, 3 aliases, 7 Dev Fund settings, the poster set to your wallet,
   price run 1, the poster handed to `0x6001…0DB4`, and `finalize`.
3. Stop point A: after the 6th prompt the page logs five lines (`VCLM 0x…`,
   `CHONX 0x…`, `Verifier 0x…`, `Forge 0x…`, `Stake 0x…`) and then
   `Base lock 0x…`. Before signing the 7th prompt run
   `node scripts/prepareLockDeploy.cjs --check Base <Base lock address>`.
   It checks the lock code, the 5% fee, the Dev Fund, and that the lock holds
   the VCLM, CHONX and Forge (SYNTH) addresses just logged and refuses them.
   If it does not print `ALL CHECKS PASSED`, reject the next prompt and stop.
4. Stop point B: the last prompt is `finalize`. MetaMask shows the function
   name. Before signing it, read the log: 15 `reader` lines (no Solana),
   `registry 487/487`, `token addresses 475/475`. If any is missing, reject.
5. When the page shows `Finalized.` and the result box, copy everything in the
   log box and the result box into `ceremony-log.txt`.

## 3. If something fails

General: a rejected or failed transaction sends nothing that matters on its
own. Never speed up or replace a pending transaction with different data. If a
transaction is pending for a long time, wait.

Lock pages (2.1):
- The deploy failed or was rejected: safe to retry on the same page.
- The lock deployed but `--check` failed: do not use it. Click "Forget saved
  address" and deploy again. The unused lock stays on-chain and is harmless as
  long as its address is never pasted into `base.html` or the app.
- The page says a saved lock has no code: the deploy did not land. Click
  "Forget saved address" and deploy again.

Base ceremony before `finalize` (2.2):
- Nothing is final until `finalize`. If the page stops for any reason (a
  rejected prompt, a failed transaction, a lost connection, stop point A or B),
  the contracts made so far are an unfinished set. Nobody else can configure
  them and the app never points at them.
- The page cannot resume an unfinished set. To retry, reload `base.html` and run
  it again from the start. It makes a new full set. This costs the Base gas
  again (about 0.00065 ETH at tonight's price).
- Do not run `applyCeremonyAddresses.cjs` on an unfinished set. It refuses a
  log without `Finalized.` and, with `--rpc`, a Verifier that is not finalized.

Base ceremony after `finalize`:
- Nothing can be changed. Not the readers, the registry, the Dev Funds or the
  poster.
- If a check in step 4.1 or section 5 fails, that set cannot be fixed. Do not
  write it into the app. The only remedy is a new full ceremony (2.2) with a
  new set, after the operator decides. The six lock pages do not need to be
  run again unless a lock itself failed its check.
- If the ETH price written in run 1 turns out wrong, it cannot be rewritten in
  run 1. The poster corrects it with run 2 (step 4.4). Locks already fee-recorded
  keep the price they were recorded with.

## 4. After the ceremony

### 4.1 Write the app config (one command, then one commit)
From `base-contracts`:

```
node scripts/applyCeremonyAddresses.cjs --log ~/vf-ceremony/ceremony-log.txt --locks ~/vf-ceremony/new-locks.json --rpc https://mainnet.base.org --out ~/vf-ceremony/base44-values.json --write
```

It refuses (and writes nothing) if any address is missing, malformed, zero, an
old contract, the poster or the Dev Fund, if the log has no `Finalized.`, if the
readers are not the expected 15, or if any read-only check on Base fails:
Verifier finalized, poster `0x6001…0DB4`, each reader registered, VCLM and
CHONX minters, Forge and Stake bound to the Verifier, each EVM reader bound to
its new lock, the Base reader bound to the Base lock, and the Base lock's code.
It also reads the Verifier's launch time and checks that Stake reads the same
launch time (Stake epochs start there). It writes
`src/lib/vfDeployedAddresses.js` and `~/vf-ceremony/base44-values.json` (for
Base44 section 6).

### 4.2 App commit
From the repository root: run the app tests (`node --test src/tests/
src/base-verifier/tests/ src/xrpl-lock/tests/`), `npm run lint`,
`npm run build`. Then secret-scan and commit only
`src/lib/vfDeployedAddresses.js`, and push.

### 4.3 Base44 section 6
Give the Base44 app section 6 of `BASE44_APP_FIX_PROMPT.md` together with the
values from `base44-values.json`. Section 6 sets the seven lock addresses and
the new Base contracts, removes the old addresses, changes the mint ABI (the
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
Epoch N runs from launch + (N-1) x 10 days to launch + N x 10 days, where
launch is the Verifier's launch time (finalize). Anyone may call these on
Stake; they move no user funds:
- `closeEpoch(N)` once epoch N has ended (epochs close in order, 1, 2, 3, …).
  It records the Verifier's Epoch Reward Basis for N.
- `allocateEpoch(N)` once epoch N+1 has ended. It mints Basis / $0.10 VCLM to
  Stake and shares it by weight and duration. An epoch with no fees pays 0.
- Stakers call `claimVclm()`. A second claim of the same amount is refused.

### 4.6 Retire the old locks
- The app (repository config and Base44 section 6) no longer offers
  `0x968B…C946` or `0x4eDE…3b1a` for a new lock.
- Release of locks already on them still works: the recorded release
  destination calls `release(lockId)` on that old lock at or after maturity.
- The old contracts stay on-chain and are not touched.

## 5. Final verification checklist
- [ ] Six `--check` runs and the Base lock `--check` printed `ALL CHECKS PASSED`.
- [ ] Stop point A passed after the 6th prompt; stop point B passed before
      `finalize` (72 prompts in all).
- [ ] `ceremony-log.txt` has `Finalized.`, 15 reader lines, `registry 487/487`,
      `token addresses 475/475`.
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
