# Sixteen-network deploy pages

One page per network. The chain pages are built from the current source by
`buildDeployPages.cjs`. `base.html` is kept by hand (the builder does not
overwrite it); it loads `ceremony.json`, `ceremony-data.json` and
`baseCeremonyFlow.js` from this folder.

The six non-Base EVM pages each send one deploy and stop. The Base page runs
the whole Base ceremony and ends with `finalize()`, which is permanent.

| Environment | Page | What it does |
|---|---|---|
| Base | `base.html` | MetaMask, chain id 8453 only. You first paste the six new non-Base lock addresses. Before any signature it refuses: a missing or invalid lock address, an old 2.5% lock (`0x968B…C946`, `0x4eDE…3b1a`), a lock equal to the poster, Dev Fund or wallet, incomplete ceremony data, a Base ETH price that is not positive, incomplete reader wiring, and a live poster that is missing, zero, or equal to the wallet or Dev Fund. Then, in order (`baseCeremonyFlow.js`): deploys CommitmentVaultLock("Base", Dev Fund) and reads back a 5% fee; deploys VCLM, CHONX, VinculumFinalisVerifier (checks its Base ETH id equals registry row 2), VinculumFinalisSynth (Forge) and VinculumFinalisStake; calls `VCLM.initialize(Verifier, Stake)` and `CHONX.initialize(Verifier, 0)`; deploys and registers 15 readers (Base, the six EVM chains bound to the pasted locks, six UTXO chains, Stellar, XRP Ledger; not Solana), reading each back; writes the Revision B registry (487 rows, batches of 50), the token address index (475 addresses) and three native-coin aliases; sets the Dev Fund for the seven EVM chains; sets the poster to the connected wallet, writes price run 1 (Base ETH, from `ceremony-data.json`) and reads it back as usable; hands the poster to the live poster `0x6001…0DB4` and reads it back; then `finalize()` and reads it back. |
| Ethereum | `ethereum.html` | MetaMask, chain id 1 only. CommitmentVaultLock("Ethereum", Dev Fund). |
| Polygon | `polygon.html` | MetaMask, chain id 137 only. CommitmentVaultLock("Polygon", Dev Fund). |
| Optimism | `optimism.html` | MetaMask, chain id 10 only. CommitmentVaultLock("Optimism", Dev Fund). |
| Arbitrum | `arbitrum.html` | MetaMask, chain id 42161 only. CommitmentVaultLock("Arbitrum", Dev Fund). |
| BNB Smart Chain | `bnb-smart-chain.html` | MetaMask, chain id 56 only. CommitmentVaultLock("BNB Smart Chain", Dev Fund). |
| Avalanche | `avalanche.html` | MetaMask, chain id 43114 only. CommitmentVaultLock("Avalanche", Dev Fund). |
| Bitcoin, Bitcoin Cash, Litecoin, Dogecoin, DigiByte, Zcash | `bitcoin.html`, `bitcoin-cash.html`, `litecoin.html`, `dogecoin.html`, `digibyte.html`, `zcash.html` | Plan only. The utxo-locks CLTV P2SH lock is a per-user transaction, so there is nothing to deploy. Prints the Dev Fund, confirmations, dust and binding rule. |
| Solana | `solana.html` | Plan only. Prints the vf-solana-vault program id, config PDA and Dev Fund. Program upload needs the program keypair through the CLI. The page has one read-only mainnet status check. |
| Stellar | `stellar.html` | Plan only. Claimable-balance lock; nothing to deploy. |
| XRP Ledger | `xrp-ledger.html` | Plan only. EscrowCreate FinishAfter lock; nothing to deploy. |

Cosmos Hub is not a row.

Every lock charges 5% on every duration, including the 1-hour Handshake. The
order of use, the on-the-day checklist and the read-only post-deploy check are
in `deployment/LIVE_DEPLOYMENT_ORDER.md` and `deployment/LOCK_DEPLOYMENT_STEPS.md`.

Dev Funds come from `deployment/representativeBase.cjs`. The EVM Dev Fund, used on Base and the six EVM chains, is `0xFD21…3e9a`.

## Rebuild

```
npm install --legacy-peer-deps
npx hardhat compile --force
node scripts/deploy-pages/resolveAssetRegistry.cjs   # read-only RPC reads; writes deployment/assetRegistry.resolved.json (prior revision, historical)
node scripts/buildRevisionB.cjs                      # writes deployment/assetRegistry.revB.json (current, Revision B)
node scripts/buildTokenAddressIndex.cjs              # writes deployment/tokenAddressIndex.json from Revision B
node scripts/deploy-pages/buildDeployPages.cjs       # writes the fifteen chain pages from Revision B (base.html is kept)
node scripts/build_ceremony_artifacts.cjs            # writes ceremony.json (contracts) and ceremony-data.json (fresh Base ETH price)
node scripts/buildBroadcastPage.cjs                  # rewrites the contracts embedded in scripts/broadcast.html
```

Run these once, from main, right before the ceremony (see the checklist in
`deployment/LIVE_DEPLOYMENT_ORDER.md`).

The pages, the ceremony data and the test-chain ceremony read Revision B (`deployment/assetRegistry.revB.json`, 487 entries) through `scripts/registryFile.cjs`. `assetRegistry.resolved.json` is the prior revision and is kept unchanged. See `deployment/ASSET_REGISTRY_REVISIONS.md`.

`resolveAssetRegistry.cjs` reads the 1,001-row registry from the URL in `src/lib/vfRegistryVerification.js` and drops the Cosmos row. Token decimals come from `decimals()` on each token's own network or from the Solana mint account. Native decimals come from `src/lib/vfBaseRegistry.js`. If a row's decimals cannot be read, the script records the reason and the row is not written. No decimals are guessed. Two Solana rows share a mint with an earlier row, so they map to the same Verifier key and are not written a second time.
