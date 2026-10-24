# Base ceremony page (Base-only launch)

Founder directive t357u: the launch is Base-only. This folder holds one page,
`base.html`. It loads `ceremony.json`, `ceremony-data.json` and
`baseCeremonyFlow.js` from this folder. The fifteen non-Base pages,
`buildDeployPages.cjs` and `registryGate.cjs` were removed (they are in git
history). The sixteen lock contracts, their readers and their tests are kept
in `contracts/` and `test/`; none of them is deployed or wired by this
ceremony.

| Environment | Page | What it does |
|---|---|---|
| Base | `base.html` | MetaMask, chain id 8453 only. Before any signature it refuses: incomplete ceremony data, any non-Base registry row or token address, any alias, reader wiring other than the Base reader, Dev Fund wiring other than Base, a Base ETH price that is not positive, and a live poster that is missing, zero, an old contract, or equal to the wallet or Dev Fund. Then, in order (`baseCeremonyFlow.js`): deploys VCLM, CHONX, VinculumFinalisVerifier (checks its Base ETH id equals registry row 2), VinculumFinalisSynth (Forge) and VinculumFinalisStake; deploys BaseCommitmentVaultLock("Base", Dev Fund, VCLM, CHONX, Forge) and reads back the 5% fee and that it refuses the three protocol tokens; calls `VCLM.initialize(Verifier, Stake)` and `CHONX.initialize(Verifier, 0)`; deploys and registers one reader, BaseLockRecordVerifier bound to the Base lock; writes the Base subset of registry Revision C (27 rows; Base USDC is S1), the Base token address index (26 addresses) and no aliases; sets the Base Dev Fund; sets the poster to the connected wallet, writes price run 1 (Base ETH) and reads it back; hands the poster to the live poster `0x6001…0DB4`; then `finalize()` and reads it back. |

The Base lock charges 5% of gross on every duration, including the 1-hour
Handshake. The Base Dev Fund is `0xFD21…3e9a`.

The Base subset is derived at build time from registry Revision C
(`deployment/assetRegistry.revC.json`, 487 rows; operator decision t367u):
every row whose environment is Base. Revision C is Revision B with one change,
row 454 Base USDC as S1 (1.5x); Revision B is unchanged. cbETH is registered and hidden in the app only.

## Build on the day (deploy files only)

```
npm install --legacy-peer-deps
npx hardhat compile --force                  # full compile; the reference build
node scripts/build_ceremony_artifacts.cjs --keep-price   # ceremony.json, and ceremony-data.json (Base subset of Revision C); keeps the committed Base ETH price (t364u)
npm run ceremony:dryrun:simulate             # Base-only SIMULATE rehearsal on a local Base fork, then Rig 10 reconciliation
```

`node scripts/prepareLockDeploy.cjs --check Base <lock> [probe]` is a
read-only check of a deployed Base lock. Every other environment is refused.

Retired, not used for this deployment: `scripts/broadcast.html`,
`scripts/ceremony.html`, `scripts/broadcastBaseTest.cjs`,
`scripts/broadcastRepresentativeBase.cjs`, `scripts/broadcastMintPath.cjs` and
`scripts/buildBroadcastPage.cjs`. Each is a stub that sends nothing and points
to `deployment/DEPLOYMENT_DAY_RUNBOOK.md`. The old versions are in git history.

## Registry rebuild (NOT on the day)

These re-read live sources and can change the registry files. They are not
part of the deployment day. Run them only when the operator asks for a new
registry revision.

```
node scripts/deploy-pages/resolveAssetRegistry.cjs   # read-only RPC reads; writes deployment/assetRegistry.resolved.json (prior revision, historical)
node scripts/buildRevisionB.cjs                      # writes deployment/assetRegistry.revB.json (current, Revision B)
node scripts/buildTokenAddressIndex.cjs              # writes deployment/tokenAddressIndex.json from Revision B
```

The ceremony data (Base subset) reads Revision C (`deployment/assetRegistry.revC.json`, 487 entries) through `CEREMONY_REGISTRY_FILE` in `scripts/registryFile.cjs`. The test-chain ceremony, token address index and price scripts still read Revision B (`deployment/assetRegistry.revB.json`, unchanged). `assetRegistry.resolved.json` is the prior revision and is kept unchanged. See `deployment/ASSET_REGISTRY_REVISIONS.md`.

`resolveAssetRegistry.cjs` reads the 1,001-row registry from the URL in `src/lib/vfRegistryVerification.js` and drops the Cosmos row. Token decimals come from `decimals()` on each token's own network or from the Solana mint account. Native decimals come from `src/lib/vfBaseRegistry.js`. If a row's decimals cannot be read, the script records the reason and the row is not written. No decimals are guessed. Two Solana rows share a mint with an earlier row, so they map to the same Verifier key and are not written a second time.
