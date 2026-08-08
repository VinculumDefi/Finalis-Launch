# Revision 7 — Candidate Specification Amendments
## Vinculum Finalis · drafted 2026-08-07

**Status: CANDIDATE TEXT. Not yet incorporated.**

Revision 6 is hash-locked at SHA-256 `5a9350618d81005d53b4d05628e7403e8c39fe63847a46576a5fadfbd4ef0bf9` (re-verified 2026-08-07) and is not edited by this document. The text below is drafted against Revision 6's structure and continues its identifier sequences without gaps.

**Four protocol decisions taken during the Revision 7 remediation currently exist in code, in contract comments, or in the evidence register, but not in the specification.** This document exists so that the answer to *"where does the specification define this?"* is a section reference rather than a source-file comment.

**Identifier allocation** (verified against Revision 6, no collisions):

| Family | Highest in Rev 6 | Allocated here |
|---|---|---|
| VF-ORC | 014 | 015, 016 |
| VF-SEC | 006 | 007 |
| VF-REG | 011 | 012 |
| VF-FEE | 012 | 013 |

---

# 1 · Maximum Price Record Age

**Origin:** CL-37. **Resolves a conflict internal to Revision 6.**

## The conflict being resolved

Revision 6 contains two requirements that cannot both hold without qualification:

- **VF-ORC-008** states that a successful scheduled price record remains applicable until the next scheduled run. Read literally, a record never expires.
- **VF-IMM-005** requires that failure of an external dependency prevent unsafe new issuance without preventing release of matured Commitment Vault principal. A price publication outage is such a failure.

If a record never expires, a publication outage does not prevent issuance — it permits issuance against a price of arbitrary age.

Revision 7 resolves this conflict by qualifying VF-ORC-008 through the requirements of VF-IMM-005. Neither requirement is discarded: VF-ORC-008 continues to govern which record applies between scheduled runs, and VF-IMM-005 bounds how long that record may continue to apply when the next run does not arrive.

## Proposed insertion — §7.2, following VF-ORC-014

> **VF-ORC-015:** A price record is valid where the elapsed time since its publication timestamp does not exceed forty-eight hours. Forty-eight hours is four scheduled publication intervals at the twice-daily cadence established in VF-ORC-001.
>
> Any operation that derives or depends upon the current United States dollar valuation of an asset shall fail closed where no valid price record exists. Operations that do not require current market valuation, including Commitment Vault principal release, shall continue to operate normally.
>
> The elapsed time is measured from the publication timestamp carried within the signed record, not from the block in which the record was delivered to Base. A delayed delivery does not restore freshness to an aged observation.
>
> This requirement prevents issuance using stale market data while ensuring temporary publication outages cannot permanently affect existing commitments or principal release.

## Notes for the editor

**Boundary.** The condition is expressed as *does not exceed*. Exactly forty-eight hours is valid; forty-eight hours and one second is not. This was stated as an inequality deliberately: "a maximum of 48 hours" leaves the boundary case ambiguous, and ambiguity at a boundary becomes a defect.

**Scope.** "Any operation that derives or depends upon the current United States dollar valuation of an asset" is deliberately specific. It is not "operations requiring current market valuation," which would leave a reader unable to determine whether staking, forging or governance are affected.

**Measurement point.** The clause about publication timestamp versus delivery block is not editorial detail. An implementation that measures from the delivery block allows a delayed batch to reset its own clock, and an aged observation arrives fresh.

**Implementation status:** implemented and verified end-to-end. `MAX_PRICE_RECORD_AGE = 48 hours`, enforced in `_verifiedGrossUsdMicro` so that every USD-dependent path inherits it. Age measured from the signed `fetchTimestamp`. Both temporal directions bounded — future-dated records are rejected at intake.

**Consequential amendment:** VF-ORC-008 should carry a cross-reference to VF-ORC-015 so that a reader of the earlier requirement is not left with the literal reading.

---

# 2 · Production Price Signing Configuration

**Origin:** CL-38. **Records an accepted operational risk.**

Revision 6 §7.2 delegates the production signing configuration to architecture and deployment deliverables. This section records the configuration chosen, and the risk accepted with it, as VF-EXT-002 requires.

## Proposed insertion — §7.2, following VF-ORC-015

> **VF-ORC-016:** Production price signing uses a single hardware-backed signing authority, fixed at deployment and not thereafter alterable.
>
> A threshold arrangement requiring multiple independent signatures was considered and rejected for this deployment, because five genuinely independent custody and failure domains cannot be established. Implementing nominal threshold signing without independent custody would represent resilience the deployment does not possess.
>
> Compromise of the production signing key can compromise valuation input for the life of the protocol. Permanent loss of the key permanently halts all issuance-dependent operations, while Commitment Vault principal release continues unaffected under VF-PRI-004 and VF-SEC-006. These consequences are accepted, and shall be disclosed under VF-EXT-002 and addressed by the deployment custody procedure.

## Proposed insertion — §14, following VF-SEC-006

> **VF-SEC-007:** Signing-key redundancy and price-source redundancy are distinct properties and shall not be conflated. A threshold signing arrangement, where adopted, protects the ability to authenticate a price publication against key compromise or loss. It does not establish an alternative source of truth for the price itself.
>
> VF-SEC-003 remains absolute regardless of signing configuration. Insufficient valid signatures, stale data, missing data, or any other verification failure results in no valuation and therefore no issuance-dependent operation. No fallback price source, last-known-good substitution, or administrative override shall be introduced to maintain availability.

## Notes for the editor

VF-SEC-007 exists to close a specific future argument. Without it, a later reader may reason that because the protocol has "redundancy" in signing, a fallback price source is consistent with the design. It is not. The two are different security properties and the requirement says so in terms.

**Implementation status:** implemented as `address public immutable pricePublisher`. No rotation function exists. **No code change was made for CL-38** — the decision was to accept and document the existing configuration rather than build an arrangement whose claimed property the deployment cannot supply.

---

# 3 · Approved Asset Precision Domain

**Origin:** CL-43. **⚠️ UNRESOLVED — requires data the specification does not currently contain.**

## The problem

Asset decimal precision is a divisor in every United States dollar derivation. Revision 6 does not define its permitted domain anywhere.

The implementation currently bounds it at eighteen. **That bound is a convention of Ethereum Virtual Machine tokens, not a value derived from this specification**, and it must not be frozen as permanent without justification.

Revision 6 states that issuance calculations use eighteen-decimal fixed-point arithmetic. That describes the protocol's *internal* arithmetic precision. It is **not** a statement that an approved asset may have at most eighteen decimals. These are different claims and were nearly collapsed into one during the implementation-domain audit.

Three facts bear on the correct bound:

- The authoritative registry `vinculum_finalis_approved_asset_registry.json` carries identity, environment, class and pricing identifier for all 1,001 assets. **It contains no decimals field.** No maximum can be computed from it.
- The arithmetic ceiling is seventy-seven. Above that, ten raised to the precision exceeds the unsigned 256-bit range and the operation cannot execute.
- Assets across seventeen environments include six-decimal, seven-decimal, eight-decimal and nine-decimal native precisions. Assets exceeding eighteen decimals exist generally among tokens.

**The registry is immutable after finalization, so the risk runs in both directions.** A bound set too tight permanently prevents registration of a legitimate approved asset. A bound set too loose permits registering an asset into a permanently unusable or silently mispriced state.

## Proposed insertion — §6, following VF-REG-011 — TEXT INCOMPLETE

> **VF-REG-012:** The decimal precision of an approved asset shall lie within the domain [0, **N**], where **N** is *[to be determined — see below]*. Registration shall reject any precision outside this domain. The domain shall be chosen such that every asset in the Approved Asset Registry can be represented, and such that ten raised to the precision remains within the unsigned 256-bit range.

## What is required before this requirement can be completed

**Either:**

1. The authoritative precision dataset corresponding to the 1,001 approved assets, from which the true maximum is computed and **N** set to that value; **or**
2. A deployment rule that explicitly defines the permitted precision domain, with assets outside it excluded from the registry by policy rather than by arithmetic.

**Until one of these exists, eighteen is provisional.** The implementation is protected against arithmetic poisoning — an unbounded precision can no longer be registered — but the specific bound is not yet specification-derived.

**This is the only item in this document that is not ready for incorporation.** It is included so that the gap is recorded rather than forgotten, as VF-EXT-002 requires.

---

# 4 · Dev Fund Verification Boundary

**Origin:** CL-12. **Records a conscious deferral.**

## The boundary being drawn

Revision 6 contains two distinct requirements concerning Dev Fund fee routing:

- **VF-FEE-006** — no user, relayer, implementer or external message may substitute another fee destination. This is *destination integrity*.
- **VF-FEE-007** — the proof establishes the exact actual fee and its transfer to the configured destination. This is *transfer verification*.

Revision 7 implements the first and defers the second.

## Proposed insertion — §8, following VF-FEE-012

> **VF-FEE-013:** Revision 7 validates that the Dev Fund destination named within the proof package matches the destination registered for that source environment during the deployment ceremony, satisfying VF-FEE-006. A fee transfer evidence reference shall be present and non-zero.
>
> Independent cryptographic verification that the fee transfer occurred on the source chain, as contemplated by VF-FEE-007, is outside the scope of Revision 7 and is reserved for future chain verifier enhancements. That capability requires the chain verifier interface to interpret transfer evidence in addition to lock evidence, which expands the trust boundary of that interface and warrants its own specification work, threat model and test plan.
>
> This deferral is a deliberate scoping decision and shall not be construed as an omission.

## Notes for the editor

**Why the distinction matters.** Destination matching establishes that the payee is correct. It does not establish that the payment occurred. These are different assurances and Revision 7 should not imply the stronger one.

**A representation correction accompanies this.** The Dev Fund destination registry was implemented as an Ethereum address. Fees route on the source chain, so a destination is a source-chain address — eleven of the seventeen supported environments are not EVM-compatible. The registry now stores the destination as a string. Revision 7 should state that a Dev Fund destination is a source-environment-native address, so that a future implementer does not repeat the narrowing.

**Implementation status:** implemented and verified end-to-end. Substituted destinations, empty destinations, unconfigured environments and zero evidence references are all rejected.

---

# Appendix · Engineering Decisions and Lessons Learned

These are not requirements. They record decisions and failures from the Revision 7 remediation whose reasoning would otherwise be lost. Each exists because the mistake it describes was actually made on this project, and each is written so a future maintainer does not repeat it.

**A1 — §5.1 and §10.1 define different multiplier tables.** The Commitment Vault duration multipliers of §5.1 and the Treasury Reward Stake multipliers of §10.1 are distinct and must not be transcribed between mechanisms. Doing so was a defect found during remediation, present simultaneously in the implementation and in the test suite that was supposed to detect it.

**A2 — The JavaScript preview layer is not dead code.** Two implementations of the protocol logic exist by design: the Solidity contracts, which are the production target, and a JavaScript layer that drives the live preview. Divergence between them is expected. The JavaScript layer should not be deleted as duplication, nor treated as authoritative where the two disagree.

**A3 — Test vectors derive from this specification, never from an implementation.** A test constructed to match the code under test cannot detect a defect in that code. Two multiplier defects passed an eighty-five-assertion suite for exactly this reason.

**A4 — A reported fix is not an applied fix.** Remediation status shall be recorded only from a test executed against the file in the repository. Three findings were once marked resolved on the strength of a reviewed diff; the file was later compiled and found unchanged.

**A5 — Restoring a dormant path makes latent defects in it consequential.** The reward pipeline was inert because a required value was never assigned. Repairing that assignment did not introduce the precision defect that followed — it made a pre-existing defect economically effective. Any newly activated path requires renewed adversarial testing regardless of its age.
