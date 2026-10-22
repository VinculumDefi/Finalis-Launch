# Live Base verify report (ceremony of 2026-10-21)

Read-only checks on Base mainnet (chain 8453). No transaction was sent. No key was used.
Reference ceremony page: VinculumDefi/Finalis-Launch commit 7dee25d (2026-10-18). The five live contracts match that build byte for byte (immutables masked). They do not match main 41322f2.

Times below are America/New_York.

## Addresses checked

| Role | Address (short) | On-chain code vs 7dee25d | vs main 41322f2 |
|---|---|---|---|
| Base lock | 0x9dE3…A940 | PASS (CommitmentVaultLock, masked match) | FAIL (not BaseCommitmentVaultLock; no VF-TOK-007) |
| VCLM | 0xF138…044D | PASS (VinculumFinalisToken) | code PASS; role FAIL for staking (see Q1) |
| CHONX | 0x3e87…174F | PASS | PASS |
| Verifier | 0x3bce…9381 | PASS (exact runtime match) | FAIL (old Verifier; missing VF-COM-025 time fields, registry token index, lifetimeVclmIssued) |
| Base reader | 0xEcFB…8Ebd | PASS (BaseLockRecordVerifier) | FAIL (old reader; no extractAssetId / NATIVE_ASSET_ID) |

## Q1. Was a Stake (or Forge) deployed?

Ceremony wallet = Verifier.scheduledPricePoster = 0xE76F…55E4 (nonce at check time: 678).

CREATE addresses for nonces 0 through 677 were computed and eth_getCode was called on each. Contracts created by this wallet include earlier retired sets (for example VCLM/CHONX/lock/Verifier/Stake/Forge around nonces 131 to 158 and 503 to 508) and the live set at:

- nonce 646: Base lock 0x9dE3…A940 (6923 bytes)
- nonce 647: VCLM 0xF138…044D
- nonce 648: CHONX 0x3e87…174F
- nonce 649: Verifier 0x3bce…9381 (15201 bytes)
- nonces 650 and 651: no code (used for configuration calls)
- nonce 652: Base reader 0xEcFB…8Ebd (2101 bytes)
- nonces 653 to 677: no code

Between the Verifier and the reader there is no Stake and no Forge. No other CREATE address from this wallet in that window holds Stake or Synth runtime. Basescan / Blockscout HTTP APIs returned a Cloudflare challenge page from this environment, so the CREATE-address sweep is the evidence.

VCLM and CHONX state (live):

- finalized = true
- minterVerifier = the live Verifier
- minterStake = 0x0000…0000
- deployer = 0x0000…0000 (cleared by initialize)
- initialize(...) reverts with "VF-DEP-006: already finalized" (fork eth_call and on-chain static call)
- There is no setMinters function on this token

Verdict: no Stake was deployed with this ceremony. None can be attached to these tokens later. The same is true for Forge / SYNTH.

An earlier incomplete attempt on the same wallet (nonces 614 to 620) produced a parallel lock / VCLM / CHONX / Verifier / reader set that is not the one the operator listed. It is finalized against its own VCLM and is not used by the app.

## Q2. Usability for locks and minting as-is

### Registry and prices

- On-chain assetPrecisionTable holds all 962 rows of the ceremony file at 7dee25d (961 entries + Base ETH / row 2). Every row matches symbol, decimals, custody class and custody path. Distinct keys: 962.
- That file is the historical 961-row registry plus Base ETH. It is not Revision B (487 rows).
- usable scheduled prices on the live Verifier: only Base:ETH = 2414.15 USD (run id 1). Every other asset is unusable.
- cumulativeVclmIssued = 0, cumulativeChonxIssued = 0, chonxActivated = false, VCLM and CHONX totalSupply = 0 (live, at the time of the check).
- Base ETH precision is 18 and is registered. The earlier "precision 0" reading was a wrong key; Base ETH is fine.

### Handshake band

LOCK and Verifier constants: HANDSHAKE_USD_MIN = 0.01e18, HANDSHAKE_USD_MAX = 0.02e18, STANDARD_USD_MIN = 0.01e18, STANDARD_FEE_BPS = 500. That is Revision 12 (and matches the page text the operator saw). It is not the old $0.95 to $1.05 / $10 band.

### Fork tests (Hardhat fork of Base, test accounts only; nothing broadcast)

At fork block about 52926369 / 52926414:

1. Base ETH 7-day lock at about $1, then mint VCLM: success (about 13 VCLM).
2. Base ETH Handshake lock at about $0.015, then mint VCLM: success (about 0.195 VCLM).
3. Handshake with stated USD $1: lock reverts "CVL: handshake usd".
4. Base registry token (CBETH) with no usable price: mint reverts "VF-ORC-005: no usable scheduled price".
5. Worthless test ERC-20 locked and declared as Base ETH: mint succeeds and issues a large VCLM amount. The live Verifier does not check that the locked asset is the native Base ETH; it trusts the package's asset id and the lock record. The app must only offer Base ETH.
6. VCLM accepted as a lock input by the old lock (no VF-TOK-007). The app must refuse VCLM and CHONX client-side.
7. sourceEnvironmentId "Ethereum": mint reverts (no usable price / no reader). Non-Base minting cannot work.
8. CHONX lock created before activation: mint reverts "VF-COM-025: CHONX not activated". After activation (triggered by cumulative VCLM crossing 10,000,000 in a later mint on the fork), that same pre-activation CHONX lock mints CHONX. There is no recorded activation timestamp and no "created before activation" permanent refusal on this Verifier.
9. After finalization, VCLM/CHONX initialize and Verifier.registerChainVerifier all revert. The price poster can still mark Base ETH unusable; new mints then revert "VF-ORC-005".

### Verdict

- Usable for Base locks and VCLM / CHONX minting as-is: YES, with these exact limits:
  - Base (8453) only.
  - Base ETH (native) only, and only while its scheduled price is usable.
  - Handshake $0.01 to $0.02; every other duration at least $0.01; fee 5%.
  - CHONX output only after chonxActivated becomes true (when cumulative VCLM issued reaches 10,000,000).
  - Participants pay their own ETH gas.
- Can never work on this set (a new Base deployment from main is required for them):
  - Staking rewards and any Stake page / claim batching / claimable display (no Stake; VCLM minterStake permanently zero).
  - Forge / SYNTH.
  - The CHONX timing rule with a recorded activation time and the 1-day non-Base margin.
  - Locks and mints on every non-Base network (no readers registered; finalize already ran).
  - On-chain refusal of VCLM / CHONX / SYNTH as lock inputs (VF-TOK-007). The app must refuse them.
  - The Revision B 487-row active list as the on-chain registry (on-chain is the 962-row historical file).

## Method notes

- RPC used: https://mainnet.base.org, https://base-rpc.publicnode.com, https://base.drpc.org (eth_getCode, eth_call, Hardhat fork).
- Code match: compiled 7dee25d artifacts vs on-chain runtime with immutableReferences zeroed.
- Fork script and result: /workspace/t282u/fork/ (box only; not committed).
