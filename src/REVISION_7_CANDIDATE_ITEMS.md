# Revision 7 Candidate Items

**Status:** Post-implementation engineering review — documentation only.
**Scope:** Observations discovered during the implementation and verification of Revision 6.
**Constraint:** No code modified. No Master Specification modified. No recommendation assumed accepted.
**Authority:** This document does not change protocol behavior. It records ambiguities, omissions, duplications, and inconsistencies the implementation exposed, so the project owner can decide what, if anything, belongs in Revision 7.

---

## CANDIDATE VF-R7-001 — Commitment Vault duration table duplicates the Stake duration table

- **Master Specification section affected:** §5.1 (Commitment Vault Lock durations and multipliers) and §7 (Treasury Reward Stake durations and multipliers, VF-STK-003 / VF-STK-021).
- **Current Revision 6 wording (summary):** §5.1 enumerates 16 permitted commitment vault durations with per-duration multipliers. VF-STK-003 states "only listed token+duration multipliers apply" and VF-STK-021 permits "queue one future term 30/60/90/120d." The stake multiplier schedule is not given a dedicated 16-row table; it is described as inheriting the commitment-vault pattern for 30/60/90 days and a separately derived 120-day term.
- **What implementation revealed:** The off-chain engines maintain two parallel arrays (`COMMITMENT_DURATIONS` and `STAKE_DURATIONS`). The 30/60/90-day entries appear in both tables with identical seconds and multipliers. The 120-day stake multiplier had no governing table to source from and was derived by pattern, requiring an explicit "must be verified when re-provisioned" annotation.
- **Why the current wording is difficult to implement:** The specification does not state whether stake durations are a subset of commitment durations (shared definition) or an independent schedule. This forces the implementer to either (a) duplicate the shared rows — creating two sources of truth that can drift — or (b) assume inheritance without textual support. The 120-day term exists only for staking, so it cannot be a pure subset.
- **Recommended Revision 7 change:** Provide a single authoritative duration/multiplier table and define the stake set as an explicit projection (e.g. "stake-eligible durations are the 30/60/90 entries from §5.1 plus the 120-day entry below at Xx"). Give the 120-day stake multiplier an explicit value in the constants file rather than leaving it pattern-derived.
- **Reason for the recommendation:** Removes the duplicate definition, eliminates the undocumented derivation for the 120-day term, and gives staking its own complete table so implementers do not infer.
- **Behavioral impact:** Specification clarity only. No protocol behavior changes (the intended values are already what the implementation uses); the recommendation only makes them explicit and removes duplication.

---

## CANDIDATE VF-R7-002 — "Handshake allowance" is defined by chain label rather than by source mechanism

- **Master Specification section affected:** VF-COM-006 (qualifying Handshake mechanism allowance).
- **Current Revision 6 wording (summary):** A qualifying Handshake is a one-hour lock. The allowance of qualifying Handshakes "per identity" is determined by the source mechanism's capability — account-model mechanisms that maintain atomic persistent per-identity state qualify for three. The constants file records a `SOLANA_HANDSHAKE_ALLOWANCE = 3` but annotates it as the *prototype mechanism's* capability, not a chain-wide rule.
- **What implementation revealed:** The implementation exposes the allowance as a per-environment constant keyed to "Solana," but the specification text explicitly states the allowance is "determined by the actual selected source mechanism, not by a broad chain label." The code therefore cannot assert a chain-level constant without deployment evidence (VF-DEP-001) proving which mechanism is deployed. The result is a constant that looks authoritative in code but is actually conditional on an external deliverable.
- **Why the current wording is ambiguous:** The specification ties the allowance to mechanism, but the constants file and the supported-environments list both key data by environment name. There is no field in the registry that records the *mechanism* of a deployed lock program, so a consumer reading the registry cannot confirm an allowance without a separate mechanism-identity artifact.
- **Recommended Revision 7 change:** Add a "source mechanism identity" field to the environment/deployment record and require that the qualifying-Handshake allowance be recorded against that mechanism identity, not against the chain name. Make explicit that the allowance is unproven until the deployment package (VF-DEP-001) records the mechanism.
- **Reason for the recommendation:** Aligns the registry schema with the specification's mechanism-based rule and removes the appearance of a chain-level constant that the specification does not actually grant.
- **Behavioral impact:** Specification clarity only. The allowed count does not change; the recommendation only changes where the value is recorded and proven.

---

## CANDIDATE VF-R7-003 — Pending-attempt terminal dispositions are environment-specific with no shared contract

- **Master Specification section affected:** VF-COM-007 / VF-COM-008 (objective pending-attempt disposition) and Implementation Brief §4.7.
- **Current Revision 6 wording (summary):** A pending attempt may only be cleared by an objective, chain-native terminal event. Timers, mempool disappearance, and non-observation never clear a still-valid attempt. The Implementation Brief lists per-environment dispositions (e.g. Solana: finalized success/failure, recent-blockhash expiry, or durable-nonce advancement).
- **What implementation revealed:** Each non-EVM environment needed its own enumerated set of terminal dispositions (UTXO confirmation counts, XRPL ledger close, Stellar ledger close, EVM finality, Solana finality + nonce advancement). The specification defines the *principle* (objective, chain-native, immutable) but does not enumerate the full per-environment set in one place, leaving the implementer to assemble the enumeration from the Implementation Brief plus individual environment requirements.
- **Why the current wording is incomplete:** A reader cannot determine the complete terminal-disposition set for every supported environment from a single section. The principle is stated once; the enumeration is scattered. This invites an implementer to miss a disposition for an environment they did not individually study.
- **Recommended Revision 7 change:** Add a single table mapping each supported environment to its complete, authoritative set of terminal pending-attempt dispositions, with a note that no other event (timer, absence, non-observation) ever clears a valid attempt.
- **Reason for the recommendation:** Centralizes the enumeration so verification logic can be built and audited against one table instead of inferred across multiple requirement lines.
- **Behavioral impact:** Specification clarity only. The allowed dispositions are unchanged; the recommendation only collects them.

---

## CANDIDATE VF-R7-004 — PoW confirmation counts for UTXO environments are not specified

- **Master Specification section affected:** VF-COM-007 / VF-COM-008 as applied to Litecoin, Dogecoin, DigiByte, and Bitcoin Cash (UTXO family).
- **Current Revision 6 wording (summary):** UTXO environments require on-chain PoW confirmation as their objective terminal event. The number of confirmations required for finality is not given as a constant.
- **What implementation revealed:** The UTXO chain verifier cannot assert a specific confirmation threshold because no constant is provided. The implementation must either accept a deployment-configured threshold or leave the check parameterized. This was recorded as a known issue during verification.
- **Why the current wording is incomplete:** Finality for a UTXO chain is only objective once a confirmation count is fixed; without it the "objective terminal event" rule is unimplementable as a hard check.
- **Recommended Revision 7 change:** Specify the required confirmation count per UTXO environment in the constants file (or explicitly delegate it to the deployment package with a minimum floor).
- **Reason for the recommendation:** Makes the UTXO finality rule executable as a constant rather than a configuration assumption.
- **Behavioral impact:** Could change protocol behavior if the specified count differs from a deployment's current assumption. The project owner should decide whether this is a clarification (fixing an already-intended value) or a behavior change.

---

## CANDIDATE VF-R7-005 — Canonical chain identifiers are deferred, breaking environment identity

- **Master Specification section affected:** VF-XCH-003 (canonical network/chain identifier per environment).
- **Current Revision 6 wording (summary):** The deployment package must record the exact canonical network or chain identifier for each environment. The Revision 6 constants list environment names (e.g. "Solana") but not the genesis hash / chain id / cluster identifier.
- **What implementation revealed:** The `SOLANA_ENVIRONMENT.canonical_chain_identifier` is explicitly `null` and annotated as deferred external input. Every environment in the registry has a human-readable name but no machine-verifiable canonical identifier. Any cross-chain verifier that wants to reject proofs from the wrong network has nothing to compare against.
- **Why the current wording is difficult to implement:** The requirement mandates the identifier, but the constants file does not supply it and does not say *where* it will be supplied (deployment package, registry, or a separate artifact). The implementer cannot hardcode a value without inventing it, which the clean-room policy forbids.
- **Recommended Revision 7 change:** Either (a) populate the canonical identifier per environment in the constants file, or (b) define the exact artifact and field in the deployment package that carries it, and require verifiers to read it from there before accepting any proof.
- **Reason for the recommendation:** Makes VF-XCH-003 enforceable rather than aspirational.
- **Behavioral impact:** Specification clarity only if the identifiers are merely relocated; behavior change if new identifiers are introduced that alter which proofs are accepted.

---

## CANDIDATE VF-R7-006 — Dev Fund destinations are null for all 17 environments

- **Master Specification section affected:** VF-COM fee routing ("100% to fixed Dev Fund destination in original asset").
- **Current Revision 6 wording (summary):** Fees route entirely to a fixed Dev Fund destination per environment, in the original asset. The destination address is not enumerated in the constants file.
- **What implementation revealed:** The registry records `dev_fund_destination: null` for all 17 environments. The implementation correctly refuses to broadcast any fee-bearing transaction while destinations are null, but this means the fee-routing requirement is structurally unsatisfied until external addresses are supplied. The "family-clean" consolidation strategy (one key pair per chain family) was adopted to prepare for this, but no addresses exist yet.
- **Why the current wording is incomplete:** The requirement names the destination role but the constants do not provide the addresses, and there is no specified artifact for delivering them. An implementer cannot tell whether destinations are a protocol constant, a deployment deliverable, or a governance action.
- **Recommended Revision 7 change:** Define the artifact and format for Dev Fund destinations (per-environment address, in the deployment package or a dedicated registry field), and state whether one address per environment or one per chain family is the intended structure.
- **Reason for the recommendation:** Removes the current state where a core fee-routing rule cannot be executed because its inputs are undefined.
- **Behavioral impact:** No behavior change to the rule itself; only defines where its inputs live. Once addresses are supplied, broadcasts become unblocked — that is the intended behavior, not a change.

---

## CANDIDATE VF-R7-007 — Oracle signature verification has no deployment-key binding

- **Master Specification section affected:** Oracle / on-chain signature verification (release signing).
- **Current Revision 6 wording (summary):** A canonical release public key serves as the single UTXO Handshake identity per environment. On-chain signature verification must validate against this key.
- **What implementation revealed:** The release signing key is not embedded; verification logic is structured to accept a key but none is provisioned. The implementation notes this as a known issue: "Oracle on-chain signature verification requires deployment key integration." Without the key, the verifier can validate structure but cannot authenticate a signature.
- **Why the current wording is difficult to implement:** The specification names the key's *role* but does not specify how the key is delivered to the verifier (compiled in, deployment-configured, or rotated via governance) or how key rotation is handled.
- **Recommended Revision 7 change:** Specify the key delivery mechanism (deployment package field vs. compiled constant), the key-rotation procedure, and how verifiers must behave during a rotation window.
- **Reason for the recommendation:** Makes signature verification complete and auditable rather than structural-only.
- **Behavioral impact:** Specification clarity for the mechanism; potential behavior change if rotation semantics are newly defined.

---

## CANDIDATE VF-R7-008 — Asset registry exists in two layers with no derivation contract

- **Master Specification section affected:** Approved Asset Registry (1,001 entries) and the pricing/precision projection used by verifiers.
- **Current Revision 6 wording (summary):** The Approved Asset Registry is the authoritative list of 1,001 assets. Verifiers and pricing services consume registry metadata (precision, custody class, pricing identifiers, contract addresses).
- **What implementation revealed:** Two representations coexist: (a) the hosted governing registry JSON (1,001 rows, the canonical source), and (b) a hand-maintained local projection (`vfBaseRegistry`) holding the subset of fields the pricing service needs (CoinGecko IDs, contract addresses, decimals, custody classes). The projection was transcribed by hand from the registry rather than derived programmatically, so it can silently drift. A dead single-asset stub also remained in the integration config until cleanup.
- **Why the current wording is duplicated/incomplete:** The specification names one registry but does not specify the relationship between the governing registry and the derived pricing/precision view, permitting a hand-maintained parallel copy.
- **Recommended Revision 7 change:** State that the hosted registry is the single canonical source and that any pricing/precision projection must be programmatically derived from it (or read live), not hand-maintained. Require the source URL (or future bundled/IPFS/contract source) to be a single swappable configuration point.
- **Reason for the recommendation:** Eliminates the second source of truth and makes the registry source swappable without an app rebuild.
- **Behavioral impact:** Specification clarity only. The registry content is unchanged; the recommendation only constrains how consumers obtain it.

---

## CANDIDATE VF-R7-009 — Mock fee basis points and TokenLayer simulation values are implementation fixtures, not protocol constants

- **Master Specification section affected:** VF-COM-004 (handshake fee 2.50%) and VF-COM-009 (standard fee 5.00%); TokenLayer simulation pricing.
- **Current Revision 6 wording (summary):** Fees are fixed: 250 bps for the one-hour Handshake duration (VF-COM-004) and 500 bps for all standard durations (VF-COM-009).
- **What implementation revealed:** The simulation layer uses these exact bps values, but also carries companion *simulation* values (e.g. a $1.00 USD simulation price for handshake durations and $10.00 for standard) that are not protocol constants — they are test fixtures. During implementation these had to be carefully distinguished from the authoritative bps so that a reader does not mistake a fixture for a constant.
- **Why the current wording is difficult to implement:** The specification defines real fees but is silent on how a simulation/preview mode should label non-protocol values, inviting confusion between fixture and constant.
- **Recommended Revision 7 change:** Add a non-normative note distinguishing protocol constants from simulation fixtures, or specify that any reference implementation must tag simulation values as out-of-protocol.
- **Reason for the recommendation:** Prevents a future implementer from promoting a fixture to a constant.
- **Behavioral impact:** Specification clarity only.

---

## CANDIDATE VF-R7-010 — Non-native EVM token canonical_asset_id convention is implicit

- **Master Specification section affected:** Registry key construction for non-native EVM tokens (USDC, USDT, AAVE, LINK, UNI).
- **Current Revision 6 wording (summary):** Registry entries are keyed by canonical asset id. For native assets this is the native symbol; the convention for non-native EVM tokens is not explicitly stated.
- **What implementation revealed:** The implementation uses `assetSymbol` as the `canonical_asset_id` for non-native EVM tokens to keep registry keys consistent, and records this as an implementation decision. The specification does not state this rule, so a second implementer could choose a different key (e.g. `chainId:contractAddress`) and produce a non-interoperable registry.
- **Why the current wording is ambiguous:** The key construction rule for an entire asset class is left to the implementer.
- **Recommended Revision 7 change:** Explicitly define `canonical_asset_id` construction per asset class (native, ERC-20, SPL, XRPL, UTXO, Stellar).
- **Reason for the recommendation:** Guarantees registry interoperability across independent implementations.
- **Behavioral impact:** Specification clarity only if all implementers already chose the same convention; behavior-relevant if any did not.

---

## CANDIDATE VF-R7-011 — RAC dedup semantics are described behaviorally, not formally

- **Master Specification section affected:** Reward Accounting Credit (RAC) recording and dedup; two-phase RAC pattern.
- **Current Revision 6 wording (summary):** Fees and RAC are recorded independently of issuance verification (two-phase). RAC must not double-count credits but must allow re-issuance for verified fees.
- **What implementation revealed:** The dedup rule was implemented as "allow re-issuance for verified fees while preventing double-counting of credits," but the exact identity key for dedup (fee event hash? (lockId, epoch)? (environment, txHash, logIndex)?) had to be chosen by the implementer. The specification describes the *intent* (no double-count, allow re-issuance) without defining the *key*.
- **Why the current wording is difficult to implement:** A dedup rule without a defined key is unimplementable deterministically; two implementers will pick different keys and diverge under replay/re-org.
- **Recommended Revision 7 change:** Define the exact RAC dedup key and the exact set of fields that constitute a "verified fee" for re-issuance.
- **Reason for the recommendation:** Makes RAC accounting deterministic and cross-implementation identical.
- **Behavioral impact:** Specification clarity if the intended key is already what implementations chose; behavior change otherwise.

---

## CANDIDATE VF-R7-012 — Price fetcher cascade tiers are implementation-defined

- **Master Specification section affected:** Authoritative reference rate for USD valuation (VF-COM-003 / VF-COM-009 bounds).
- **Current Revision 6 wording (summary):** A verified gross USD value is required within the handshake band ($0.95–$1.05) or at/above the standard minimum ($10.00). The source of the reference rate is not enumerated.
- **What implementation revealed:** A four-tier cascade was built (CoinGecko → DexScreener contract → DexScreener search → community-token override) to obtain the rate. The tier order, the fallback rule, and the community-token override mechanism are all implementation choices. The specification is silent on what counts as an "authoritative" rate source.
- **Why the current wording is incomplete:** Without a defined cascade or authority hierarchy, two implementations can price the same event differently and both claim compliance.
- **Recommended Revision 7 change:** Define the authoritative price-source hierarchy, the fallback order, and the conditions under which a community-token override is permitted (and by whom).
- **Reason for the recommendation:** Makes the USD valuation rule reproducible.
- **Behavioral impact:** Could change behavior if the specified hierarchy differs from the implemented cascade. The project owner should confirm the implemented cascade is the intended one before promoting it to the spec.

---

## CANDIDATE VF-R7-013 — Emission decay is defined as a rate but the survival factor is implementation-derived

- **Master Specification section affected:** Emission schedules (VF-COM-017 / VF-COM-018); Phase 1 fixed rules (`decay_rate = 0.01667`, `decay_period_days = 30`).
- **Current Revision 6 wording (summary):** VCLM begins at 10 per $1.00, CHONX at 100 per $1.00; each decays 1.667% per completed 30-day period; permanent floors are 1 and 10 per $1.00.
- **What implementation revealed:** The implementation computes an 18-decimal fixed-point *survival factor* (`1 - 0.01667 = 0.98333`) to apply decay multiplicatively. The survival factor is derived from the rate; the specification gives the rate but not the fixed-point survival representation, nor whether decay compounds (multiplicative) or subtracts (linear).
- **Why the current wording is ambiguous:** "Decays 1.667% after each completed 30-day period" permits both a multiplicative survival (geometric) and an additive reduction (arithmetic). The floors imply geometric decay, but this is not stated.
- **Recommended Revision 7 change:** State explicitly that decay is geometric (multiplicative survival) and define the fixed-point survival factor as the canonical representation, with the arithmetic for applying it to a completed-period count.
- **Reason for the recommendation:** Removes the geometric-vs-arithmetic ambiguity and the fixed-point representation choice.
- **Behavioral impact:** Specification clarity if geometric was already intended; behavior change if arithmetic was intended.

---

## CANDIDATE VF-R7-014 — Native (Solana, XRPL) lock implementations are separate toolchains with no shared spec contract

- **Master Specification section affected:** Cross-environment lock construction (Solana native, XRPL native) vs. EVM/Base verifier.
- **Current Revision 6 wording (summary):** Locks are constructed on the source environment; proofs are normalized and verified on Base. Non-EVM environments use native mechanisms (Solana PDAs, XRPL Escrows).
- **What implementation revealed:** The Solana (Anchor/Rust) and XRPL lock programs are built in their own toolchains and cannot import the JS authority constants; they must mirror them in Rust/XRPL. The specification does not define a shared "protocol constant contract" that all toolchains derive from, so each native implementation maintains its own copy of durations, multipliers, fees, and handshake limits.
- **Why the current wording is difficult to implement:** A single authoritative constants source (Revision 6 JSON) exists, but there is no specified mechanism to propagate it into Rust/XRPL compilation, so native constants can drift from the JS authority without a test catching it.
- **Recommended Revision 7 change:** Specify that the Revision 6 constants file is the single source and require each native implementation to either generate its constants from it at build time or run a cross-toolchain constant-equivalence test.
- **Reason for the recommendation:** Prevents silent drift between the JS authority and native contract constants.
- **Behavioral impact:** Specification clarity only (process/test requirement); no protocol behavior change.

---

## CANDIDATE VF-R7-015 — CHONX/SYNTH activation thresholds are cumulative-lifetime, but the "cumulative" scope is not pinned

- **Master Specification section affected:** VF-TOK-002 (CHONX activation) and VF-TOK-003 (SYNTH activation).
- **Current Revision 6 wording (summary):** CHONX activates permanently when cumulative lifetime VCLM issuance reaches 10,000,000; SYNTH activates permanently when cumulative lifetime CHONX issuance reaches 100,000,000.
- **What implementation revealed:** "Cumulative lifetime" was read as a single global accumulator. The implementation tracks one global cumulative figure per token. The specification does not state whether "lifetime" means since genesis, since activation, or per-environment-aggregated.
- **Why the current wording is ambiguous:** If "lifetime" were per-environment, activation could occur at different times on different environments; if global, it is a single protocol-wide event. The choice materially changes issuance sequencing.
- **Recommended Revision 7 change:** State that "cumulative lifetime" is a single protocol-wide global accumulator (or define the alternative explicitly) and specify that activation is irreversible and global.
- **Reason for the recommendation:** Removes the scope ambiguity that would cause two implementations to activate tokens at different points.
- **Behavioral impact:** Specification clarity if global was intended; behavior change if per-environment was intended.

---

## CANDIDATE VF-R7-016 — Principal early-release and live-networking flags are fixed-false but their Phase boundary is undefined

- **Master Specification section affected:** Phase 1 fixed rules (`principal_early_release: false`, `live_networking: false`).
- **Current Revision 6 wording (summary):** Phase 1 fixes principal early-release to false and live networking to false.
- **What implementation revealed:** The implementation enforces both as false. The specification does not define what event or revision transitions Phase 1 to a subsequent phase, so an implementer cannot know when these flags may become true.
- **Why the current wording is incomplete:** A "Phase 1" implies a Phase 2, but no Phase boundary condition is given. Implementers hardcode the flags without knowing the exit criterion.
- **Recommended Revision 7 change:** Define the Phase boundary (e.g. a specific cumulative-issuance threshold, a revision, or a governance event) and the flag values that apply in the next phase.
- **Reason for the recommendation:** Makes the phase model complete and lets implementers write forward-compatible code.
- **Behavioral impact:** Specification clarity only until a phase transition is defined; defining the transition is a behavior change the owner must approve.

---

## Summary

| ID | Section | Clarity | Behavior |
|---|---|---|---|
| VF-R7-001 | §5.1 / VF-STK-003/021 | ✔ | — |
| VF-R7-002 | VF-COM-006 | ✔ | — |
| VF-R7-003 | VF-COM-007/008 | ✔ | — |
| VF-R7-004 | VF-COM-007/008 (UTXO) | ✔ | ⚠ possible |
| VF-R7-005 | VF-XCH-003 | ✔ | ⚠ possible |
| VF-R7-006 | VF-COM fee routing | ✔ | — |
| VF-R7-007 | Oracle signature | ✔ | ⚠ possible |
| VF-R7-008 | Approved Asset Registry | ✔ | — |
| VF-R7-009 | VF-COM-004/009 (fixtures) | ✔ | — |
| VF-R7-010 | Registry keys (EVM non-native) | ✔ | ⚠ possible |
| VF-R7-011 | RAC dedup | ✔ | ⚠ possible |
| VF-R7-012 | USD reference rate | ⚠ possible | ⚠ possible |
| VF-R7-013 | Emission decay | ✔ | ⚠ possible |
| VF-R7-014 | Native lock constants | ✔ | — |
| VF-R7-015 | VF-TOK-002/003 | ✔ | ⚠ possible |
| VF-R7-016 | Phase 1 fixed rules | ✔ | ⚠ possible |

**Items that may change protocol behavior if accepted:** VF-R7-004, VF-R7-005, VF-R7-007, VF-R7-010, VF-R7-011, VF-R7-012, VF-R7-013, VF-R7-015, VF-R7-016.
**Items that improve specification clarity only:** VF-R7-001, VF-R7-002, VF-R7-003, VF-R7-006, VF-R7-008, VF-R7-009, VF-R7-014.

This document is a candidate list, not a revision. No item is adopted. The project owner decides what, if anything, belongs in Revision 7.