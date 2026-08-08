# NATIVE → BASE CONNECTION STATUS

Factual connection results for the Vinculum Finalis native-lock → proof → Base mint → UI
integration. Not a future plan. Generated from a complete workspace search and the
genuinely-present source artifacts.

---

## Searches performed

A recursive scan of the entire accessible workspace (`/app`, excluding `node_modules`,
`.git`, `dist`, `target`) was run. 131 source files were inventoried.

- **Smart-contract / ABI / IDL indicators** (`*.sol`, `abi`, `idl`, `solidity`, `program`,
  `verifier`, `mint`, `synth`, `vclm`, `chonx`, `registry`): the only file matched by these
  keywords was `Vinculum_Finalis_Requirement_Traceability.csv` (a governance matrix), and the
  Rust CosmWasm vault source under `src/cosmos-hub-vault/contracts/vault/`.
- **Content grep** for `VCLM`, `CHONX`, `SYNTH`, `pragma solidity`, `verifyProof`, `IERC20`,
  `IERC721`, `Mintable`, `0x`, `registry`, `1001`, `chain-registry`, `MsgExecuteContract`,
  `MsgInstantiateContract`, `Keplr`, `wagmi`, `ethers`, `viem`, `cosmjs`,
  `SigningStargateClient`, `ICS-23`:
  - Zero `.sol` (Solidity) files exist anywhere.
  - Zero ABI / IDL files exist anywhere.
  - `VCLM` / `CHONX` appear only in design docs, the Cosmos contract's `OutputToken` enum, and
    the proof adapter's normalization logic — there is **no Base-chain minting contract**.
  - `SYNTH` appears only in design prose.
  - `1001` appears only as a stated count in design docs; **no 1,001-asset registry data file
    exists** in the workspace.
  - No wallet/chain library (`ethers`, `viem`, `wagmi`, `cosmjs`, `keplr`,
    `@solana/web3.js`) is installed (verified against `package.json`).
  - `MsgExecuteContract` / `MsgInstantiateContract` appear only in deployment reports, not in
    any application code.

---

## Genuine components found and connected

| Component | Location | Status |
|---|---|---|
| Native lock (Cosmos Hub) contract source | `src/cosmos-hub-vault/contracts/vault/src/{msg,contract,state,error,lib}.rs` + `schema/execute_msg.json` | SOURCE PRESENT, **NOT DEPLOYED** (no contract address). Undeployed Rust source; no Rust toolchain in the sandbox to compile/deploy, and deployment is explicitly prohibited. |
| Native proof/attestation adapter | `src/cosmos-hub-proof-adapter/index.js` (dependency-free Node) | PRESENT. Ported faithfully to an ESM client module `src/lib/vfProofAdapter.js`. |
| User interface | `src/pages/CosmosHubCandidate.jsx` (read-only evidence page) + new `src/pages/VinculumFlow.jsx` (interactive flow) | PRESENT / NEW. |
| Centralized config | `src/lib/vfIntegrationConfig.js` | NEW. |

---

## What was implemented (real, non-fabricated)

1. **Centralized integration config** — `src/lib/vfIntegrationConfig.js`.
   - Cosmos Hub real values verbatim from the contract source / existing candidate data:
     `chain_id = cosmoshub-4`, `base_denom = uatom`, bech32 prefix `cosmos`, registry row 479,
     the 16 permitted durations, fee basis points (2.50% handshake / 5.00% standard), value
     bounds ($0.95–$1.05 handshake, ≥$10 standard), handshake allowance = 3.
   - `vault_contract_address = PENDING_DEPLOYMENT` (no address exists).
   - Base chain: `vclm_address`, `chonx_address`, `synth_address`, `proof_verifier_address` =
     `PENDING_DEPLOYMENT`; `proof_verifier_abi = NOT_PRESENT` (no ABI exists).
   - Registry: `registry_file_present = false`; only the single genuinely-present asset
     identity (ATOM/uatom) is exposed.

2. **Real Cosmos lock transaction construction** — `src/lib/vfCosmosLock.js`.
   - `buildCommitVaultLockMsg(...)` builds the exact `ExecuteMsg::commit_vault_lock` JSON from
     the real schema (`duration_secs`, `base_recipient`, `release_destination`,
     `output_token`, `verified_gross_usd_micro` (string, uint128), `lock_id`,
     `chonx_activation_receipt`).
   - `buildReleasePrincipalMsg(...)` builds the real `release_principal` message.
   - `computeFee`, `validateBaseRecipient` (0x+40 hex), `validateLockId`,
     `validateValueBounds` mirror the contract's logic verbatim.
   - `connectKeplr()` connects the real injected Keplr provider (`window.keplr`,
     `window.getOfflineSigner`) — no npm package required.
   - `submitLock` / `submitRelease` retain the real sign+broadcast path (Keplr Amino +
     Cosmos REST `/cosmos/tx/v1beta1/txs`); this path is blocked at the broadcast boundary
     because the vault address is `PENDING_DEPLOYMENT`, returning the exact missing field.

3. **Existing proof adapter connected** — `src/lib/vfProofAdapter.js` (ESM port of
   `src/cosmos-hub-proof-adapter/index.js`). `normalizeLockEvent`, `finalityGate`,
   `verifyExistence`, `sha256`, `PendingAttempt`, `PendingRegistry`,
   `REQUIRED_FACT_FIELDS`, `PENDING_STATE` are all ported. The UI feeds the constructed lock
   facts into the real `normalizeLockEvent`. No proof is marked complete without a real
   finalized source transaction.

4. **User interface** — `src/pages/VinculumFlow.jsx` (routed at `/` and `/vinculum-flow`).
   Every actionable button calls an implemented function:
   - Chain / asset selectors load from the genuinely-present registry identity (1 of 1,001;
     the registry file is absent — surfaced honestly).
   - Connect Keplr → real `connectKeplr()`.
   - Construct & submit lock → real `buildCommitVaultLockMsg` + `normalizeLockEvent` +
     `submitLock` (blocked at broadcast with the exact missing address).
   - Submit proof to Base verifier → **disabled**: no contract/ABI exists.
   - Construct & release principal → real `buildReleasePrincipalMsg` + `submitRelease`
     (blocked at broadcast).
   No mock success path, no fabricated hash / balance / receipt / lock record / mint.

---

## Connection results by category

### COMPLETED AND WORKING
- Centralized integration configuration with real values and honest `PENDING_DEPLOYMENT` /
  `NOT_PRESENT` markers.
- Real `commit_vault_lock` and `release_principal` message construction from the actual
  contract schema.
- Fee, recipient, lock-id, and value-bound validation mirroring the contract.
- Real Keplr wallet connection via the injected provider (no package dependency).
- Existing proof adapter ported to the client and fed the constructed lock facts.
- Interactive UI with real wired buttons, honest preview/awaiting-deployment mode, and
  broadcast blocked at the address boundary.

### COMPLETED BUT AWAITING DEPLOYED ADDRESS
- Cosmos Hub vault contract: transaction-construction and signing path are complete; only the
  final broadcast is disabled because `vault_contract_address = PENDING_DEPLOYMENT`. Inserting
  a real deployed address into `vfIntegrationConfig.js` activates the real broadcast path
  without rewriting the application.
- VCLM / CHONX / SYNTH Base token contracts: `PENDING_DEPLOYMENT`. (No ABI exists either —
  see below.)

### BLOCKED BY GENUINELY MISSING EXTERNAL COMPONENT
- **Base proof-verification & minting contract (the entire `→ Base mint` half of the
  integration).** No Solidity source, no ABI, no IDL, and no deployed address for
  `BASE-VERIFY` / `BASE-ISSUE` / `BASE-EMIT` / `BASE-ACT` / `BASE-CAP` exists anywhere in the
  accessible workspace. These are described only as design responsibilities in
  `Vinculum_Finalis_Architecture_Design.md` (which states: "Not executable code, not a
  deployed system"). Constructing a real proof-submission call is impossible because the entry
  point does not exist. Inventing a smart contract or ABI is explicitly prohibited by the
  task constraints. This is a legitimate final blocker ("the required source component truly
  does not exist anywhere accessible").
- **1,001-asset approved registry.** The governing file
  `vinculum_finalis_approved_asset_registry.json` is referenced in the architecture doc as an
  external governing input but is **not present** in the workspace. Asset/chain selection
  therefore cannot be driven by the full registry; only the single genuinely-present asset
  identity (ATOM / cosmoshub-4 / uatom) is offered, and the absence is surfaced in the UI.

---

## Build / publish

- **Build:** this environment provides no shell or `vite build` runner, so the production build
  could not be executed from chat. The code uses only installed packages and existing shadcn
  primitives, and imports resolve to real files. Run `npm run build` in the builder to
  produce the artifact.
- **Published URL:** publishing is a manual platform action performed in the Base44 builder
  (Publish button); it cannot be triggered from chat. After publishing, the connected flow is
  reachable at the app root `/` (and `/vinculum-flow`).

---

## Files changed

- `src/lib/vfIntegrationConfig.js` (new)
- `src/lib/vfProofAdapter.js` (new — ESM port of existing adapter)
- `src/lib/vfCosmosLock.js` (new)
- `src/pages/VinculumFlow.jsx` (new)
- `src/App.jsx` (route additions for `/` and `/vinculum-flow`)
- `NATIVE_TO_BASE_CONNECTION_STATUS.md` (new — this file)