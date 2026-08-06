# Revision 7 Candidate Items — Review Against Revision 6

**Purpose:** Re-examine each original candidate (VF-R7-001 … VF-R7-016) against the Revision 6 Master Specification to determine whether it is a genuine specification defect, already addressed, an implementation misunderstanding, or a design proposal.

**Method:** A candidate survives only if Revision 6 is genuinely silent or ambiguous on a point required for deterministic implementation. A candidate is dismissed when Revision 6 either states the rule, delegates the input to the deployment package, or when the observation concerns how the implementer organized code rather than what the specification requires.

**No protocol behavior is proposed. No specification text is modified.**

---

## Disposition of all 16 original candidates

| ID | Disposition | Reason |
|---|---|---|
| VF-R7-001 | **Invalid — implementation / design proposal** | The "two tables" issue is a code-organization choice. The "single authoritative table" suggestion is a design proposal for how to present the spec, not a defect in the spec text. The 120-day stake multiplier uncertainty is an implementation transcription gap, not a confirmed omission. |
| VF-R7-002 | **Invalid — already addressed** | VF-COM-006 explicitly states the allowance is "determined by the actual selected source mechanism, not by a broad chain label." The specification already says exactly this. Keying a constant by chain name was an implementation choice the spec does not require. |
| VF-R7-003 | **Invalid — already addressed** | The per-environment terminal dispositions exist in the Implementation Brief (§4.7). The principle is stated in VF-COM-007/008. Reorganizing them into one table is a presentation preference, not a specification defect. |
| VF-R7-004 | **Remains — genuine ambiguity** | See below. |
| VF-R7-005 | **Invalid — already addressed (deployment input)** | VF-XCH-003 explicitly delegates canonical chain identifiers to the deployment package. A null value in code is an incomplete deployment, not a specification defect. |
| VF-R7-006 | **Invalid — already addressed (deployment input)** | Dev Fund destination addresses are on-chain deployment inputs. The specification defines the role (fixed destination, original asset); addresses are supplied at deployment, like contract addresses. Not a specification defect. |
| VF-R7-007 | **Invalid — already addressed (deployment input) / out of scope** | The release public key is a deployment input. Key-rotation semantics are a Phase-2 / governance concern, not a Revision 6 defect; Phase 1 fixed rules intentionally scope this out. |
| VF-R7-008 | **Invalid — implementation defect** | The specification already establishes one Approved Asset Registry. A hand-maintained parallel projection is an implementation choice the spec neither requires nor permits; fixing it is an implementation task, not a Revision 7 text change. "Source swappability" is a design proposal. |
| VF-R7-009 | **Invalid — implementation hygiene** | The specification defines the real fee constants. Distinguishing simulation fixtures from constants is an implementation-labeling concern. The specification is clear on the real values. |
| VF-R7-010 | **Invalid — already addressed** | The registry defines its own keys. The `canonical_asset_id` convention is established by the authoritative registry itself, not by spec prose. An implementer reads the key from the registry; the spec need not restate it. |
| VF-R7-011 | **Remains — genuine ambiguity** | See below. |
| VF-R7-012 | **Invalid — already addressed (operational)** | The specification defines the USD bounds (the protocol rule). The choice of price source is an operational matter the specification intentionally leaves to the implementation. Defining a mandatory cascade would be a new protocol behavior, which this review forbids. |
| VF-R7-013 | **Invalid — derivable from wording** | "Decays 1.667% per completed 30-day period" with a permanent positive floor is the standard geometric-decay convention; the permanent floor is consistent with that reading. The survival-factor representation is an implementation choice. Not a confirmed ambiguity. |
| VF-R7-014 | **Invalid — implementation / engineering proposal** | Cross-toolchain constant equivalence is a build and test practice. The specification already names Revision 6 as the single source. How native toolchains consume it is an engineering process matter, not a specification text defect. |
| VF-R7-015 | **Invalid — derivable from wording** | "Cumulative lifetime" issuance unambiguously denotes a single global accumulator since genesis. "Lifetime" and "cumulative" together rule out a per-environment reading. Not a genuine ambiguity. |
| VF-R7-016 | **Invalid — roadmap marker, not a defect** | "Phase 1" is a scoping label. The absence of a Phase-2 boundary is intentional (Phase 2 is future scope), not an omission in the current revision. Defining the transition would be new protocol behavior. |

---

## Design proposals separated out (not specification defects)

These were bundled as candidates but are engineering/design suggestions, not defects in Revision 6 text. They are recorded here for the owner's awareness only and are **not** Revision 7 specification candidates:

- **DP-001 (from VF-R7-001):** Consolidate the commitment-vault and stake duration tables into one authoritative table with staking as a declared projection. This is a presentation redesign, not a correction of an existing defect.
- **DP-002 (from VF-R7-008):** Make the registry source a single swappable configuration point and require the pricing/precision projection to be derived, not hand-maintained. This is an implementation-architecture proposal.
- **DP-003 (from VF-R7-014):** Generate native (Rust/XRPL) constants from the Revision 6 JSON at build time, or run a cross-toolchain constant-equivalence test. This is a build/engineering practice proposal.

None of these change protocol behavior; none require Revision 6 to be wrong.

---

## Revised candidate list (genuine specification defects / ambiguities only)

### CANDIDATE VF-R7-004 — UTXO confirmation counts: protocol constant or deployment parameter?

- **Master Specification section affected:** VF-COM-007 / VF-COM-008 as applied to the UTXO family (Litecoin, Dogecoin, DigiByte, Bitcoin Cash).
- **Current Revision 6 wording (summary):** A pending attempt on a UTXO environment is cleared only by an objective, chain-native terminal event — PoW confirmation. The required confirmation count is not stated in the transcribed constants.
- **What implementation revealed:** The UTXO chain verifier cannot assert a hard confirmation threshold because no constant is supplied. Unlike canonical chain identifiers, which VF-XCH-003 *explicitly* delegates to the deployment package, the specification does not state whether UTXO confirmation counts are protocol constants or deployment/security parameters.
- **Why this is a genuine ambiguity:** The objective-terminal-event rule for UTXO chains is only enforceable once a confirmation count is fixed. Revision 6 neither supplies the count nor explicitly delegates it. This silence is the defect: an implementer cannot tell whether the count is a protocol rule (must be in constants) or a per-chain security decision (delegated to deployment). Two implementers could therefore choose different counts and both claim compliance.
- **Recommended Revision 7 change:** State explicitly whether the UTXO confirmation count is (a) a protocol constant to be listed per environment, or (b) a deployment-package parameter with a minimum floor. If (a), enumerate the counts; if (b), name the deployment artifact and any floor.
- **Reason:** Makes the UTXO finality rule unambiguously enforceable.
- **Behavioral impact:** Clarification if the intended locus is merely made explicit; behavior-relevant only if a specific count is newly fixed that differs from current assumptions. The owner decides.

### CANDIDATE VF-R7-011 — RAC dedup identity key is not specified

- **Master Specification section affected:** Reward Accounting Credit (RAC) recording and the two-phase RAC pattern.
- **Current Revision 6 wording (summary):** Fees and RAC are recorded independently of issuance verification (two-phase). RAC must not double-count credits but must allow re-issuance for verified fees.
- **What implementation revealed:** The dedup rule was implemented with a chosen identity key, but the specification describes the *intent* (no double-count, allow re-issuance) without defining the *key* that identifies a "verified fee" for dedup purposes. The natural identity of an on-chain fee event (environment + transaction hash + log/output index) is arguably inherent, but the specification does not state it, and normalized proofs add a second representation that must agree.
- **Why this is a genuine ambiguity:** A dedup rule without a defined key is non-deterministic across independent implementations: two verifiers using different keys will accept or reject the same replay differently. This is the one candidate where specification silence directly threatens cross-implementation determinism rather than being a deployment or operational matter.
- **Recommended Revision 7 change:** Define the exact RAC dedup key (the set of fields that identify a unique verified fee) and require that the normalized-proof representation and the chain-native event resolve to the same key.
- **Reason:** Guarantees identical RAC accounting across independent compliant implementations.
- **Behavioral impact:** Clarification if the intended key is already what implementations chose; behavior-relevant only if implementations diverge today. The owner decides.

---

## Summary

- **Original candidates:** 16
- **Invalid — already addressed by Revision 6:** 6 (VF-R7-002, VF-R7-003, VF-R7-005, VF-R7-006, VF-R7-010, VF-R7-013)
- **Invalid — implementation misunderstanding / implementation defect:** 5 (VF-R7-001, VF-R7-008, VF-R7-009, VF-R7-014, VF-R7-015)
- **Invalid — derivable from wording or roadmap marker:** 2 (VF-R7-013 also derivable; VF-R7-016 roadmap marker)
- **Invalid — would propose new protocol behavior:** 1 (VF-R7-012)
- **Invalid — deployment input / out of Phase-1 scope:** 1 (VF-R7-007)
- **Design proposals separated (not spec defects):** 3 (DP-001, DP-002, DP-003)
- **Genuine candidates remaining:** **2** (VF-R7-004, VF-R7-011)

The revised list contains only genuine specification ambiguities supported by Revision 6: the UTXO confirmation-count locus, and the RAC dedup identity key. Neither proposes new protocol behavior; both ask the specification to make an existing rule unambiguously enforceable. The project owner decides whether either belongs in Revision 7.