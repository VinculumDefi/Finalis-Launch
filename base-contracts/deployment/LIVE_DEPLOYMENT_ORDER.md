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

## Step 2 - Readers for those chains (no page yet)
For each new lock, deploy that chain's reader on Base. The reader takes the new lock
address: `SimpleEthereumLockReader`, `ArbitrumLockReader`, `OptimismLockReader`,
`PolygonLockReader`, `BnbSmartChainLockReader`, `AvalancheLockReader`.
The UTXO readers (Bitcoin, Bitcoin Cash, Litecoin, Dogecoin, DigiByte, Zcash) take the Dev
Fund script. Stellar takes the network id and the Dev Fund key. XRP Ledger takes the Dev Fund
account. `scripts/testChainCeremony.cjs` shows the exact constructor inputs.
**No deploy page does this yet** (see "Gaps").

## Step 3 - Base page (`scripts/deploy-pages/base.html`, chain id 8453)
In order, as the page runs it:
1. Deploy the new 5% Base lock `CommitmentVaultLock("Base", 0xFD21…3e9a)`. The old Base lock is left as it is.
2. Deploy VCLM, CHONX and the Verifier, plus the Base reader for the new lock. Initialise the tokens to the Verifier.
3. `registerChainVerifier("Base", reader)`.
4. Write the registry in batches of 50: the 961 existing rows plus the Base ETH row.
5. Set the Dev Fund.
6. Set the price poster to the deployer wallet, but only for the first Base ETH price. Write that price, then read it back as usable.
7. Hand the price poster to `0x6001…0DB4` and read it back. The page refuses the handover if this address
   is missing or equals the wallet, the Dev Fund, the new lock or an old contract.
8. `finalize()`.

## Gaps to close before going live
- After `finalize()`, the readers from Step 2 can no longer be registered, because
  `registerChainVerifier` works only during the ceremony. The Base page registers
  only the Base reader. A page, or an added step before step 8, has to register
  the other 14 readers (6 EVM, 6 UTXO, Stellar, XRP Ledger). Solana stays unregistered.
- The Base page as it stands does not deploy Forge (VinculumFinalisSynth) or Stake.
  The test-chain ceremony does deploy them.
- Token locks are refused until a token-address-to-registry mapping exists.
