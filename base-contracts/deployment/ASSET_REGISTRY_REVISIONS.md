# Asset registry revisions

| File | Status | Entries | What it is |
|---|---|---|---|
| `assetRegistry.revB.json` | **Current (Revision B, 2026-10-19)** | 487 | 475 tokens that pass the per-pool filter plus 12 native coins. Read by the ceremony, verifier registration, token address index, price fetch and price runs, and deploy pages (`scripts/registryFile.cjs`). See `ASSET_REGISTRY_REVISION_B.md`. |
| `assetRegistry.active.json` | Superseded (interim set, 2026-10-19) | 822 | On-chain-checked subset of the prior revision. Kept unchanged as a record. Not read by the live path. Revision B was cut from it. See `ASSET_REGISTRY_ACTIVE.md`. |
| `assetRegistry.resolved.json` | Prior revision (historical) | 961 written rows + Base ETH = 962 | The resolved Approved Asset Registry (1,000 rows, 961 writable). Kept unchanged; do not delete or rewrite. Still written by `scripts/deploy-pages/resolveAssetRegistry.cjs`. Not read by the live path. |

Rows are never relabelled between revisions. Each later file is a strict
subset of the earlier one, with the row fields copied unchanged.

Rebuild the current revision and what depends on it:

```
node scripts/buildRevisionB.cjs            # deployment/assetRegistry.revB.json
node scripts/buildTokenAddressIndex.cjs    # deployment/tokenAddressIndex.json
node scripts/build_ceremony_artifacts.cjs  # scripts/deploy-pages/ceremony-data.json (fetches the ETH price)
node scripts/deploy-pages/buildDeployPages.cjs
```
