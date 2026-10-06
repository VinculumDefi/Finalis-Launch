# Sixteen-network deploy pages

One page per network. Built from the current source by `buildDeployPages.cjs`.
Every page prints its addresses and the network they belong to, then stops before finalize.

| Environment | Page | What it does |
|---|---|---|
| Base | `base.html` | MetaMask, chain id 8453 only. Deploys VCLM, CHONX, CommitmentVaultLock("Base"), VinculumFinalisVerifier, VinculumFinalisSynth (forge), VinculumFinalisStake. Then sets scheduledPricePoster to the price fetcher address you enter (it refuses the connected wallet), configures the seven EVM Dev Funds, and writes the full Approved Asset Registry. It does not send finalize() or the token initialize() calls, and it writes no price. |
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

Dev Funds come from `deployment/representativeBase.cjs`. The Base Dev Fund is `0xFD21BF773A193CDcb9F793100CB13a8baAdc3e9a`.

## Rebuild

```
npm install --legacy-peer-deps
npx hardhat compile --force
node scripts/deploy-pages/resolveAssetRegistry.cjs   # read-only RPC reads; writes deployment/assetRegistry.resolved.json
node scripts/deploy-pages/buildDeployPages.cjs       # writes the sixteen pages
```

`resolveAssetRegistry.cjs` reads the 1,001-row registry from the URL in `src/lib/vfRegistryVerification.js` and drops the Cosmos row. Token decimals come from `decimals()` on each token's own network or from the Solana mint account. Native decimals come from `src/lib/vfBaseRegistry.js`. If a row's decimals cannot be read, the script records the reason and the row is not written. No decimals are guessed. Two Solana rows share a mint with an earlier row, so they map to the same Verifier key and are not written a second time.
