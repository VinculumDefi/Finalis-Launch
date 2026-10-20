# Live deployment order (prepared, NOT executed)

Prepared from main for the operator. Nothing here has been broadcast, and no
keys are in the repository. Addresses are shortened on purpose.

Live price poster (from `deployment/liveConfig.json`): `0x6001…0DB4`.

Every lock below charges **5% on every duration, including the 1-hour Handshake**.
`test/lock_deploy_files_5pct.test.cjs` deploys the exact bytecode embedded in
each file and checks all sixteen durations on each of the seven chains.

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
write down the new lock address. The old locks stay on-chain, untouched.

## Step 2 - Base page (`scripts/deploy-pages/base.html`, chain id 8453)
Paste the six new lock addresses from Step 1 into the page. Before anything is
sent, the page refuses a missing or invalid address, an old 2.5% lock, or an
address equal to the poster, the Dev Fund or the wallet. It then runs
`scripts/deploy-pages/baseCeremonyFlow.js`, which is the same code that
`test/base_ceremony_flow.test.cjs` runs on the test chain. In order:
1. Deploy the new 5% Base lock `CommitmentVaultLock("Base", 0xFD21…3e9a)`. The old Base lock is left as it is.
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

## Step 3 - Price runs (after finalize)
`scripts/priceRun.cjs` turns fetched prices into the poster's lines: a success
line for each fetched price, and a failure line for each miss. Run numbers
start at 2. The script writes the run and its calldata for `0x6001…0DB4` to
sign, and never sends to a live chain. It was tested on the test chain in
`test/price_run.test.cjs`.

## Still open
- Token locks are refused until a token-address-to-registry mapping exists.
