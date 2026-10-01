# LAST SESSION STATE

**Read this first.** It is the resume-here file. If `git log -1` shows a commit
later than the one below, this file is stale and the repository wins.

---

## 2026-10-01 — grok/ethereum-e2e (supersedes snapshot below)

The snapshot below is **superseded** by branch `grok/ethereum-e2e` at commit `ceebd8bdde336981197463719428142819932bfd`.
Tests **31–35** and `base-contracts/scripts/deploy-five.cjs` exist on this branch
(`deployFive` now configures Dev Fund / handshake / asset precision and vault
`finalizeConfiguration` for Base, Ethereum, Polygon, Arbitrum, Optimism; Ethereum
lock→prove→mint via the deployFive stack asserts 1725 VCLM and 95% release).
The other twelve environments are unchanged.

---

## Snapshot

| | |
|---|---|
| **Branch** | `redteam/prep` — **not `main`** |
| **HEAD when written** | `6a4553c` |
| **Suite** | **320 passing, 0 failing** |
| **Red-team phase** | Waves 1–5 complete. **Discovery closed.** |
| **Protocol defects open** | **None** |
| **Certification** | `LAUNCH_CERTIFICATION.md`, bound to `21b5b29` |
| **Deployment** | Not deployed. No addresses configured. |
| **Website repo** | `vinculum-protocol`, `main`, live at vinculumprotocol.com |

---

## What happened

**Waves 1–2** established that the verifier interface returned seven facts where
VF-XCH-011 required nineteen bound, and that the identity was already emitted by
the source vault in a second event no verifier opened.

**Wave 3 — CL-85** (`0ccf94d`). `extractFacts` gained four identity fields; the
Base verifier returns them from the lock record it already loaded; the four
remote EVM verifiers read them from `CommitVaultLockDetail`. The consumer
cross-check moved to step 2b, ahead of the registry lookup and valuation.
`22_evm_vault` passed unmodified — the stop condition.

**Wave 4** produced no new protocol defect; its lead candidate was retracted at
the gate as CL-76 residue.

**Wave 5** verified ten register entries as already remediated — their index rows
had been wrong for weeks, each citing `Verifier.sol`, a file that no longer
exists — and confirmed two real blockers, both since closed.

| Closed by | What it does | Commit |
|---|---|---|
| **CL-86** | `recordFeeAndRac` calls `_verifySource` before any write, so a package for a lock that does not exist creates no Reward-Accounting Credit | `b1ae4b7` |
| **CL-87** | `allocateEpoch` mints the complete Epoch Reward; the remainder is stranded permanently, unreachable by construction | `f193e8a` |
| **CL-89** | Bounded allocation. `epochPositions[n]` appended at registration (≤12 entries); allocation walks it from a cursor in batches | `8e9b19a` |

Each regression fails against its immediately preceding commit, by execution.

---

## Settled — do not reopen

**Forfeit on early withdrawal.** Withdrawing before an epoch's rewards have been
**allocated** forfeits that epoch. Settled by **VF-STK-020**: it protects only
*accumulated* claimable VCLM — already credited by a completed allocation — and
extends no protection to an unallocated entitlement. Pinned by
`29_withdrawal_forfeit.test.cjs`. A reviewer argued this from a code comment
twice in one session and changed the contract before reverting. Cite VF-STK-020
and stop.

**Dust.** Complete reward minted once (VF-STK-014); shares round down
(VF-STK-026); remainder stays permanently in the stake contract, inaccessible,
never reassigned or redirected (VF-STK-027). Owner decision, 5 Sep 2026, quoted
in full in the Findings Register.

**Rewards run one epoch behind.** §10.3 and VF-STK-013 — entitlement for epoch N
is fixed after the scheduled end of N+1, and *"the scheduled timestamp controls
eligibility even if finalization is delayed."* This is why a retry after failed
verification costs nothing, and why CL-09 measurements only work against epoch 2
onward.

---

## Measurements

| Claim | Evidence |
|---|---|
| Bounded allocation works | 0, 60 and 200 dead positions all cost **295,065 gas** for the same 5 live |
| Batch-independent | Single call and 7 batches credit identically |
| CL-87 dust | minted `150000000000000000`, shares `149999999999999999`, dust `1` |
| Same-chain issuance | `verifyAndMint` at 224,785 gas |
| Price pipeline | 1000/1001 assets priced, twice daily, unbroken |

---

## Open, by kind

**Test authoring, not defects.** 73 requirements implemented with no test naming
them. VF-VER-002/003/004 name behaviours with no named regression:
pending-attempt resolution, UTXO multi-key release paths, release-public-key
normalization.

**Deferred behind fail-closed verifiers.** Solana (vault does not compile — six
errors in `solana-vault/build_errors.txt`, recorded nowhere else), Cosmos Hub,
and the six UTXO environments (W2-05: no source-side mechanism binds the Base
recipient — an amendment to architecture C.8, not a Rev 6 revision).

**Repository hygiene.** `NATIVE_TO_BASE_CONNECTION_STATUS.md` at the root makes
three false claims about this repository. `src/base-verifier/contracts/` is an
unpatched duplicate contract tree, never built or tested, rendered in the UI.

**Deployment.** Not started. Highest-consequence value is `_pricePublisher` —
immutable at construction, no setter. `_launchTimestamp` defines every epoch
boundary forever. `configureDevFund` is **per environment** and takes a `string`,
not one address for all. After `finalize()` the deployer is zeroed and every
configuration function is permanently unreachable.

---

## Working conventions

- Whole files, never line edits. The owner does not program.
- Read the paste kit **from the repository**, never from Downloads or a Desktop
  staging folder. Both have gone stale and cost round trips.
- Check a file's **date** before trusting its name. Multiple AIs generate files
  with identical names.
- `git pull` before working in `vinculum-protocol` — the price bot pushes twice
  daily.
- Before opening any finding, read the gate in `reviewers/red-team/README.md`.
  Coverage gaps and documentation gaps are never findings.
- Find the governing requirement before asking the owner. He should not be asked
  to adjudicate what the specification already states.

---

## Reading order

1. `00_PROJECT_START_HERE.md`
2. this file
3. `PROJECT_EVIDENCE_INDEX.md`
4. `reviewers/red-team/README.md`
5. `LAUNCH_CERTIFICATION.md`
6. `reviewers/Vinculum_Finalis_Findings_Register_v16.md` (header reads v19)
