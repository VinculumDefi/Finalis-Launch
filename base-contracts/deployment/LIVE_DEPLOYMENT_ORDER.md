# Live deployment order (Base-only launch, prepared, NOT executed)

Prepared from main for the founder. Nothing here has been broadcast, and no
keys are in the repository. Addresses are shortened on purpose.

Founder directive t357u: the launch is Base-only. One page, `base.html`, on
Base. No lock is deployed on any other chain and no other reader is
registered. The sixteen lock contracts and their readers stay in the source
tree and are not deployed.

Live price poster (from `deployment/liveConfig.json`): `0x6001…0DB4`.

The Base lock charges **5% of gross on every duration, including the 1-hour
Handshake**. `test/lock_deploy_files_5pct.test.cjs` deploys the exact
BaseCommitmentVaultLock bytecode in `ceremony.json` and checks all sixteen
durations. The post-deploy check is `scripts/prepareLockDeploy.cjs --check
Base <address>` (read only; every other environment is refused).

## On the day: checklist before anything is signed
None of these steps sends anything.
1. Build the deploy files once from `main`, right before the ceremony (the
   commands are in `scripts/deploy-pages/README.md`, under "Build on the day";
   the full day is in `deployment/DEPLOYMENT_DAY_RUNBOOK.md`). This also
   takes a fresh first Base ETH price into `ceremony-data.json`. Check the
   creation code hashes in runbook 1.5; if any differs, stop.
2. Run the Base-only SIMULATE dry-run (`npm run ceremony:dryrun:simulate`)
   and the full test suite alone
   (`NODE_OPTIONS=--max-old-space-size=12288 npx hardhat test`). Both must pass.
3. Fund the deployer wallet on Base only, with at least 3 times the dry-run
   gas total (17 transactions: 7 contract deploys and 10 calls).

## Step 1 - Base page (`scripts/deploy-pages/base.html`, chain id 8453)
Before anything is sent, the page refuses missing or non-Base ceremony data,
any alias, reader wiring other than the Base reader, Dev Fund wiring other
than Base, a price that is not positive, and a poster that is zero, an old
contract, or equal to the wallet or the Dev Fund. It then runs
`scripts/deploy-pages/baseCeremonyFlow.js`, which is the same code that
`test/base_ceremony_flow.test.cjs` runs on the test chain. In order:
1. Deploy VCLM, CHONX, the Verifier, **Forge** (VinculumFinalisSynth, the SYNTH token) and **Stake** (`Stake(VCLM, CHONX, Forge, Verifier)`; Stake epochs start at the Verifier's launch time).
2. Deploy the new 5% Base lock `BaseCommitmentVaultLock("Base", 0xFD21…3e9a, VCLM, CHONX, Forge)`, read back a 5% fee, and read back that it refuses VCLM, CHONX and SYNTH as lock inputs (VF-TOK-007). The old Base lock is left as it is.
3. `VCLM.initialize(Verifier, Stake)`, so Stake is on from the start. Then `CHONX.initialize(Verifier, 0)`. The Verifier is the only VCLM and CHONX minter (Stake also mints VCLM rewards).
4. Deploy and register **one reader**, BaseLockRecordVerifier bound to the new Base lock, and read it back. No other environment is registered.
5. Write the Base subset of Revision C (`deployment/assetRegistry.revC.json`, 487 rows; row 454 Base USDC is S1, operator decision t367u): 27 Base rows (26 tokens plus Base ETH) in one batch, then the 26 Base token addresses. No aliases.
6. Set the Base Dev Fund.
7. Set the price poster to the deployer wallet for the first Base ETH price only (run 1). Write that price, then read it back as usable.
8. Hand the price poster to `0x6001…0DB4` and read it back.
9. `finalize()`. This is permanent: after it, nothing can be registered.

After the 6th prompt the page logs the five token and core contract lines and then `Base lock 0x…`. Run `node scripts/prepareLockDeploy.cjs --check Base <address>` before signing the 7th prompt; if it fails, reject the prompt and stop. 17 prompts in all.

## Step 2 - Price runs (after finalize)
`scripts/priceRun.cjs` turns fetched prices into the poster's lines: a success
line for each fetched price, and a failure line for each miss. Run numbers
start at 2. The script writes the run and its calldata for `0x6001…0DB4` to
sign, and never sends to a live chain. It was tested on the test chain in
`test/price_run.test.cjs`.

## Closed (operator decisions, no contract change)
- **Token locks.** Resolved. A token lock is proven through the token address
  index written in step 5: the Base reader reports `keccak256(environment,
  token address)` for a token lock, and the Verifier accepts it only if `tokenAssetIndex` maps that key to the
  package's registry row (`VinculumFinalisVerifier._verifySource`). An
  unregistered address, an address from another chain, or a package naming a
  different row is refused (`test/token_locks.test.cjs`). The app currently
  offers Base ETH only; that is an app choice, not a Verifier limit.
- **Price is fixed at first fee recording.** The Verifier reads the asset's
  last successful scheduled price the first time a lock's fee is recorded
  (`recordFeeAndRac`) and keeps it for that lock; a later run does not reprice
  it. With no usable price it refuses (fail closed).
- **CHONX start state.** `CHONX.initialize(Verifier, 0)` is the start state.
  CHONX output activates at 10,000,000 lifetime VCLM (Revision 6 VF-TOK-002).
- **Standard minimum.** The contract minimum is $0.01. The $10 figure exists
  only in the app simulator.
- Revision 12 governs the Handshake; Revision 6 governs everything else.

## CHONX activation margin (VF-COM-025, t271u)
The Verifier mints CHONX for a lock only if the lock was created after CHONX
activation was recorded (`chonxActivationTimestamp()`). A Base lock must be
created strictly later (a lock in the activation block is refused). (The
1-day margin for other chains does not apply: the launch is Base-only.) Earlier CHONX locks are refused forever;
their principal is still released at maturity.

## Stake allocation order (t270u(g))
`allocateEpoch(N)` accepts only N = `lastAllocatedEpoch()` + 1 (epoch 1 first),
permissionless. Epochs with no fees, no eligible stake or no cap room still
count as allocated, so the order never blocks.
