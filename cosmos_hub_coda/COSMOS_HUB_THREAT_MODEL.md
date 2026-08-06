# Cosmos Hub Implementation Threat Model

**Author:** Base44 CODA (clean-room, re-executed with governing .docx)
**Date:** 2026-07-28
**Candidate mechanism:** no-admin CosmWasm Commitment Vault contract on cosmoshub-4 holding native ATOM, CometBFT/ICS-23 proofs verified on Base.

> Conditional threat model; the candidate is **not** deployed. Governing quotes are verbatim from the Master Specification (Revision 6). Each "Open verification" item maps to an unblock condition in `COSMOS_HUB_FEASIBILITY_REPORT.md` §8.

---

## 1. Governance / privileged-alteration threats (VF-IMM-001..006, VF-DEP-003/007)

### T1 — Governance sudo on a no-admin contract
- **Governing text (VF-IMM-001):** "After deployment there is no governance, proposal system, voting system, council, administrator, owner role, upgrade authority, proxy administrator, pause authority, emergency role, rescue role, or discretionary parameter-setting authority."
- **Vector:** Cosmos Hub governance passes a proposal containing `MsgSudoContract` targeting the vault.
- **Exposure if exploitable:** if the contract implemented a `sudo` handler that alters state, governance could move principal or break immutability.
- **Mitigation (design):** the contract implements **no `sudo` entry point** (or a documented no-op).
- **RESOLVED (C2):** wasmd v0.60.7 commit `edb607cb`, `x/wasm/keeper/keeper.go:618/636` — `Sudo` calls the contract's own `sudo` entry point; a contract with **no `sudo` entry** (this design) returns an error and changes no state. Governance's `MsgSudoContract` (msg_server.go:286) is therefore a no-op against this contract.

### T2 — Governance migration / admin-change on an empty-admin contract
- **Governing text (VF-DEP-007):** "The absence of proxy upgrade paths, pause paths, rescue paths, and discretionary value routes must be independently verifiable."
- **Vector:** governance attempts `MsgMigrateContract` or `MsgUpdateAdmin` on the vault.
- **Exposure if exploitable:** code replacement or admin assignment → loss of immutability.
- **Mitigation (design):** contract instantiated with `admin=""`.
- **RESOLVED (C2):** `x/wasm/keeper/keeper.go:747/753` — `setContractAdmin` gates on `authZ.CanModifyContract(contractInfo.AdminAddr(), caller)`; `authz_policy.go:22-23` — default policy = `admin != nil && admin.Equals(actor)`, so an empty admin rejects every non-gov caller; the gov policy (`:66-67`) returns true but migrate still requires the contract's `migrate` entry (`keeper.go:512`), which this design omits. Empty admin therefore blocks admin-change for all in-protocol actors.

### T3 — Governance software-upgrade (chain-level hard-fork equivalent)
- **Governing text (VF-XCH-017):** "…it may not introduce a person with discretionary power to approve, alter, redirect, or reverse issuance."
- **Vector:** governance passes `SoftwareUpgrade` that rewrites the Gaia binary and any state (including contract storage or bank balances).
- **Exposure:** fundamental and irremovable on any Cosmos SDK chain.
- **Treatment:** under the governing chain-equivalent principle (VF-XCH-017/VF-EXT-001), a chain-level social hard-fork is outside the recognized deployed-mechanism design. A chain-level upgrade is not "a person with discretionary power" over the deployed mechanism. **If the deployed wasmd nonetheless exposes a non-upgrade governance path that can mutate the contract or its balance (C2), the verdict is `NOT FEASIBLE NOW`.**

### T4 — Bank-balance drain without a software upgrade
- **Governing text (VF-IMM-002):** "No person, multisignature wallet, organization, AI agent, or implementer may alter protocol economics or redirect protocol-controlled value after finalization."
- **Vector:** a non-upgrade governance path that transfers the contract's bank balance.
- **Mitigation (design):** the bank module requires the account owner's signature to transfer; governance can mint but cannot drain a specific contract balance without an upgrade.
- **RESOLVED (C2):** the bank module requires the account owner's signature to spend; a contract account has no spendable key, so only the contract's own `Execute` can move its balance. This contract's `Execute` transfers only the rounded fee to the fixed Dev Fund and never transfers principal before maturity. No wasmd message drains a contract balance without the contract's cooperation (`MsgSudoContract` needs a `sudo` entry, which is absent).

---

## 2. Source-chain atomicity / partial-completion threats (VF-ARC-004, VF-COM-004/011/012/013, VF-SEC-002)

### T5 — Partial recognized completion
- **Governing text (VF-ARC-004):** "A known-invalid Commitment Vault Lock request must be rejected before fee or principal assets move whenever the source environment can determine the invalidity."
- **Vector:** a state transition that routes the fee but fails to lock principal (or vice versa).
- **Mitigation (design):** the vault's `Execute` handler performs fee transfer + principal retention + immutable-fact binding + lock-id creation + allowance increment as a single atomic state transition; any failure reverts the whole transaction (CosmWasm/SDK atomicity).
- **Test obligation:** negative tests prove no partial recognized completion survives a revert.

### T6 — Over-limit qualifying Handshake reaching value transfer
- **Governing text (VF-COM-007):** "For a three-use mechanism, the first three successes consume the allowance and the fourth qualifying attempt is rejected."
- **Vector:** a fourth qualifying Handshake passes the allowance check.
- **Mitigation (design):** allowance check precedes fee/principal transfer and reverts on over-limit before any value moves.
- **Test obligation:** fourth-rejected-atomically; failed-execution-consumes-no-allowance (VF-COM-008); concurrent-same-account-cannot-exceed.

### T7 — Non-canonical asset / denom / encoding substitution
- **Governing text (VF-SEC-003):** "No failure path may substitute a default asset, price, environment, user, recipient, output, duration, multiplier, or Dev Fund destination."
- **Vector:** deposit of an unsupported denom or a decimal-incompatible asset presented as eligible.
- **Mitigation (design):** contract accepts only the exact canonical native denom (ATOM, base units per registry + live confirmation); rejects zero amount, unsupported denom, invalid duration/output/recipient/destination/valuation binding, zero fee, zero principal before state commit.
- **Test obligation:** invalid-asset/denom/duration/output/recipient/destination/activation-receipt/valuation rejection.

---

## 3. Pending-attempt / allowance threats (VF-COM-007/008, Section 5.2.3)

### T8 — Stale application state authorizes a second recognized Handshake
- **Governing text (Section 5.2.3):** "Before authorizing another official submission, the application must recheck objective source-chain disposition and Base recognition state."
- **Vector:** application cache, after restart/recovery, authorizes another submission without re-querying objective + Base state.
- **Mitigation (design):** application-local state is preventive only; before authorizing another Handshake the application re-queries objective Cosmos Hub sequence state and Base recognition state.
- **Test obligation:** stale-cache-cannot-authorize-after-restart; duplicate-official-submission-while-pending-prevented (VF-VER-003).

### T9 — Elapsed-time / mempool / non-observation clears a still-valid transaction
- **Governing text (Section 5.2.3):** "Elapsed time, mempool disappearance, failure to appear within an estimated or finality window, and application-local abandonment timers are not proof that a source transaction can no longer become recognized."
- **Vector:** treating mempool eviction or non-observation as objective invalidation → authorizing a second submission while the original can still become recognized.
- **Mitigation (design):** a still-valid, rebroadcastable Cosmos Hub transaction remains pending; only terminal disposition or objective invalidation — **finalized source-account sequence consumption** — clears it (proposed Cosmos Hub criterion, by analogy to the Stellar criterion in Section 5.2.3).
- **Open verification (C5):** confirm the deployed Cosmos SDK tx format has no genuine finite validity bound by default; document and test the exact objective expiry if one exists.
- **Test obligation:** elapsed-time/mempool/non-observation clearing rejected; account-sequence conflict disposition (VF-VER-003/004).

---

## 4. Proof / cross-chain verification threats (VF-XCH-010/011/012/013/016/017)

### T10 — Substituted or malformed proof authorizes issuance
- **Governing text (VF-XCH-011):** "Evidence binds the source environment, unique Commitment Vault Lock identifier, canonical asset identity and precision, user, gross amount, actual fee amount and asset, fixed Dev Fund destination and fee-transfer evidence, principal, creation timestamp, maturity, selected output, authorized Base-chain recipient, release destination, applicable valuation record, immutable-facts Reward-Accounting Credit identity, objectively bound Handshake identity, applicable Handshake allowance count, and CHONX-activation receipt."
- **Vector:** a relayer submits a malformed or field-substituted event/state proof.
- **Mitigation (design):** Base verifies ICS-23 existence/non-existence proofs against the committed AppHash; the normalizer binds every VF-XCH-011 field and rejects mismatches; a JSON event parser alone is not a verifier (CODA Section 7.3).
- **Test obligation:** malformed/substituted proof rejection (VF-VER-003).

### T11 — Replay of a verified lock
- **Governing text (VF-XCH-013/015):** "The combination of source environment and unique Commitment Vault Lock identifier may authorize Base issuance only once." / "After successful issuance, every replay or duplicate submission is rejected."
- **Mitigation (design):** replay protection keyed by `(cosmoshub-4, unique_lock_id)`.
- **Test obligation:** duplicate-proof/replay rejection.

### T12 — Proof failure blocks matured principal release
- **Governing text (VF-XCH-016):** "Proof failure prevents issuance but never prevents release of matured Commitment Vault principal." (also VF-PRI-005/006)
- **Vector:** a Base/relayer/price outage prevents principal release at maturity.
- **Mitigation (design):** principal release is on-chain and permissionless; it depends on no price, Base issuance, relayer, oracle, administrator, or external service.
- **Test obligation:** release succeeds when every external dependency is unavailable (VF-VER-005).

### T13 — Reorg / reversal of a finalized event
- **Governing text (VF-XCH-010):** "Tests must establish that premature, unconfirmed, and later-reversed source events cannot authorize Base issuance."
- **Vector:** a finalized Cosmos Hub event is reversed (requires >1/3 validator Byzantine fault under CometBFT BFT finality).
- **Mitigation (design):** CometBFT instant finality on commit; the proof path requires finality before issuance.
- **Open verification (C3/C5):** build the Base verifier and prove finality gating.
- **Test obligation:** finality and reversal tests.

---

## 5. Operational / supply-chain threats (VF-DEP-001/002/005, VF-FEE-009)

### T14 — Compiler / dependency drift
- **Governing text (VF-DEP-005):** "The deployment package records contract addresses, environment identifiers, configuration values, source hashes, compiler settings, dependency lockfiles, and deployed bytecode hashes…"
- **Vector:** an unpinned or mismatched toolchain produces a contract that differs from the audited artifact.
- **Mitigation (design):** pinned Rust/CosmWasm toolchain matching the live chain; deterministic build; file hashes recorded.
- **Open verification:** build reproducibility (C6/C7).

### T15 — Production input unavailability
- **Governing text (VF-FEE-009):** "Missing, zero, guessed, or substitute Dev Fund addresses cannot complete a deployment package."
- **Vector:** the fixed Cosmos Hub Dev Fund destination or canonical denom is unavailable at deployment.
- **Mitigation (design):** deployment refuses to finalize with placeholder/missing addresses (VF-DEP-002).
- **Open verification:** provision of fixed Hub Dev Fund destination + confirm exact canonical native base denom (C4a/C4b).

---

## 6. Rejected-candidate threat summary
- **Existing Gaia modules:** `authz`/`feegrant`/`vesting`/`group`/`staking` — all introduce discretionary/time-based actor authority or cannot atomically enforce the full vault invariant. Rejected (VF-XCH-017, VF-PRI-005).
- **New Gaia module / future upgrade:** depends on a not-yet-active upgrade. Rejected as present-deployability route (CODA Section 5).
- **IBC escrow / ICA / consumer chain:** moves principal off the Hub. Rejected (VF-ARC-002, VF-XCH-004).

---

*Adversarial-review aid, not a production-readiness claim. Each "Open verification" item maps to unblock conditions C1–C7 in the feasibility report.*