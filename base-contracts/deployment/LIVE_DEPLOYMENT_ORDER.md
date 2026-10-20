# Live deployment order (prepared, NOT executed)

Prepared from main for the operator. Nothing here has been broadcast, and no
keys are in the repository. Addresses are shortened on purpose.

Live price poster (from `deployment/liveConfig.json`): `0x6001…0DB4`.

Every lock below charges **5% on every duration, including the 1-hour Handshake**.
`test/lock_deploy_files_5pct.test.cjs` deploys the exact bytecode embedded in
each file and checks all sixteen durations on each of the seven chains.
Per-chain values, gas and the post-deploy check are in
`deployment/LOCK_DEPLOYMENT_STEPS.md` and `scripts/prepareLockDeploy.cjs`.

## On the day: checklist before anything is signed
None of these steps sends anything.
1. Build all deploy files from main once, right before the ceremony (the three
   commands are in `scripts/deploy-pages/README.md`, under "Build on the day";
   the full day is in `deployment/DEPLOYMENT_DAY_RUNBOOK.md`). This also
   takes a fresh first Base ETH price into `ceremony-data.json`. Check that
   the verifier creation code hash is `0x63128c66…572263` and the
   CommitmentVaultLock creation code hash is `0x2daadaf6…80bd99`; if either
   differs, stop.
2. Run the full test suite alone:
   `NODE_OPTIONS=--max-old-space-size=12288 npx hardhat test`. It must pass.
3. Refresh gas: `node scripts/prepareLockDeploy.cjs` (read only). Every chain
   must show a gas figure, not an RPC error.
4. Fund the deployer wallet on all seven chains (Base, Ethereum, Arbitrum,
   Optimism, Polygon, BNB Smart Chain, Avalanche) with at least 3 times the
   estimated cost. On Base the ceremony sends many more transactions than one
   lock deploy (21 contract deploys and 51 further calls), so fund Base well
   above 3 times one lock deploy.
5. After each lock is deployed, run the read-only check
   `node scripts/prepareLockDeploy.cjs --check "<Chain>" <newLockAddress>`.
   It must print `ALL CHECKS PASSED` before the address is used anywhere.

## Step 1 - Non-Base locks (six pages, any order)
One page for each chain. Each one deploys `CommitmentVaultLock(<chain>, EVM Dev Fund 0xFD21…3e9a)`, and only that.

| Chain | Page | Chain id |
|---|---|---|
| Ethereum | `scripts/deploy-pages/ethereum.html` | 1 |
| Arbitrum | `scripts/deploy-pages/arbitrum.html` | 42161 |
| Optimism | `scripts/deploy-pages/optimism.html` | 10 |
| Polygon | `scripts/deploy-pages/polygon.html` | 137 |
| BNB Smart Chain | `scripts/deploy-pages/bnb-smart-chain.html` | 56 |
| Avalanche | `scripts/deploy-pages/avalanche.html` | 43114 |

For each chain: connect the deployer wallet, check the page's chain-id check, sign, then
write down the new lock address and run the `--check` above. The old locks stay on-chain, untouched.

## Step 2 - Base page (`scripts/deploy-pages/base.html`, chain id 8453)
Paste the six new lock addresses from Step 1 into the page. Before anything is
sent, the page refuses a missing or invalid address, an old 2.5% lock
(`0x968B…C946` or `0x4eDE…3b1a`), or an address equal to the poster, the Dev
Fund or the wallet. It also refuses missing ceremony data, a price that is not
positive, incomplete reader wiring, and a poster that is zero or equal to the
wallet or the Dev Fund. It then runs `scripts/deploy-pages/baseCeremonyFlow.js`,
which is the same code that `test/base_ceremony_flow.test.cjs` runs on the
test chain. In order:
1. Deploy the new 5% Base lock `CommitmentVaultLock("Base", 0xFD21…3e9a)` and read back a 5% fee. The old Base lock is left as it is.
2. Deploy VCLM, CHONX, the Verifier, **Forge** (VinculumFinalisSynth) and **Stake**.
3. `VCLM.initialize(Verifier, Stake)`, so Stake is on from the start. Then `CHONX.initialize(Verifier, 0)`.
4. Deploy and register **15 readers**, reading each one back:
   - Base, bound to the new Base lock.
   - Ethereum, Arbitrum, Optimism, Polygon, BNB Smart Chain and Avalanche, each bound to its new lock from Step 1.
   - Bitcoin, Bitcoin Cash, Litecoin, Dogecoin, DigiByte and Zcash, each with its live Dev Fund script.
   - Stellar (public network, live Dev Fund key) and XRP Ledger (live Dev Fund account).
   - Solana is not registered.
   The Dev Fund wiring is decoded and checksum-checked from the recorded Dev Funds by `scripts/build_ceremony_artifacts.cjs` into `ceremony-data.json`.
5. Write the registry in batches of 50: the Revision B rows (`deployment/assetRegistry.revB.json`): 486 rows plus the Base ETH row, 487 lines. Then the token address index (475 addresses) and the native-coin aliases (Polygon POL to row 114, Arbitrum and Optimism ETH to row 2).
6. Set the Dev Fund for all seven EVM chains.
7. Set the price poster to the deployer wallet for the first Base ETH price only (run 1). Write that price, then read it back as usable.
8. Hand the price poster to `0x6001…0DB4` and read it back.
9. `finalize()`. This is permanent: after it, nothing can be registered.

The page logs the new Base lock address first. Run the `--check` on it before signing the next MetaMask prompt; if it fails, reject the prompt and stop.

## Step 3 - Price runs (after finalize)
`scripts/priceRun.cjs` turns fetched prices into the poster's lines: a success
line for each fetched price, and a failure line for each miss. Run numbers
start at 2. The script writes the run and its calldata for `0x6001…0DB4` to
sign, and never sends to a live chain. It was tested on the test chain in
`test/price_run.test.cjs`.

## Closed (operator decisions, no contract change)
- **Token locks.** Resolved. A token lock is proven through the token address
  index written in step 5: the EVM reader reports `keccak256(environment,
  token address)` for a token lock (`EvmReceiptLockReader.extractAssetId`), and
  the Verifier accepts it only if `tokenAssetIndex` maps that key to the
  package's registry row (`VinculumFinalisVerifier._verifySource`). An
  unregistered address, an address from another chain, or a package naming a
  different row is refused (`test/token_locks.test.cjs`). The app currently
  offers Base ETH only; that is an app choice, not a Verifier limit.
- **Bitcoin, Bitcoin Cash and Litecoin Handshakes.** Resolved in the Verifier
  (commit b1ef1f5). A 1-hour Handshake on these three chains is sized in coin
  units, not USD: Bitcoin and Bitcoin Cash 11,000 to 22,000 sats, Litecoin
  110,000 to 220,000 litoshis, inclusive. The fee is still exactly 5%. Its VCLM
  and RAC count it as at most $0.02. Every other chain keeps the $0.01 to $0.02
  Handshake band. `utxo-locks/lock.py` and the app use the same band.
- **Price is fixed at first fee recording.** The Verifier reads the asset's
  last successful scheduled price the first time a lock's fee is recorded
  (`recordFeeAndRac`) and keeps it for that lock; a later run does not reprice
  it. With no usable price it refuses (fail closed).
- **CHONX start state.** `CHONX.initialize(Verifier, 0)` is the start state.
  CHONX output activates at 10,000,000 lifetime VCLM (Revision 6 VF-TOK-002).
- **Standard minimum.** The contract minimum is $0.01. The $10 figure exists
  only in the app simulator.
- Revision 12 governs the Handshake; Revision 6 governs everything else.
