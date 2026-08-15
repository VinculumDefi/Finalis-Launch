# Verifier Completion Standard

**Status:** Proposed for adoption in Revision 7
**Version:** 1
**Date:** 2026-08-15
**Applies to:** every chain verifier implementing `IChainVerifier`, all
environments, all chain families
**Originates from:** CL-76, CL-77, CL-78

---

## 0. Definitions

For the purposes of this standard:

**Verifier** — a contract implementing `IChainVerifier` for a single
environment, whose function is to establish whether an asserted source-chain
lock event occurred and is final.

**Production verifier** — the verifier contract that is, or is intended to be,
registered for an environment in a deployed configuration. Distinguished from
mocks, harness doubles, and reference examples, none of which are production
verifiers regardless of how closely they resemble one.

**Source evidence** — data describing an event on a source chain. Source
evidence is a claim until authenticated; authentication is what converts it
into a basis for issuance.

**Authenticity** — the property that an asserted event actually occurred on the
source chain, established independently of the party asserting it. Distinct
from well-formedness (the input parses), internal consistency (the input agrees
with itself), and plausibility (the input describes something that could have
happened).

**Completion evidence** — the committed repository artifacts required by §5.
Discussion, recollection, reviewer agreement, and commit messages are not
completion evidence.

**Non-operational** — the state described in §4.1(2): a verifier that reverts
with a named not-implemented error on every call, and is therefore incapable of
being mistaken for a working one.

---

## 1. Purpose

A chain verifier is the mechanism by which the issuance contract on Base
establishes that a lock event occurred on a source chain. It is the only thing
standing between an assertion and the creation of supply.

This standard exists because a verifier can be structurally correct — right
interface, right dispatch, right per-chain finality vocabulary — and still
establish nothing. CL-76 is that case: five verifiers implementing a
well-designed interface, each decoding a claim supplied by the party who
benefits from it, each returning success. The architecture was sound. The
component was empty. Nothing in the codebase distinguished the two.

The purpose of this standard is to make that failure impossible to repeat by
defining what "complete" means before any verifier is written, rather than
inferring it afterward from whichever verifier happened to be built first.

A verifier that satisfies this standard is complete. A verifier that does not
is non-operational, regardless of how finished it appears, how many tests pass
against it, or how long it has been in the repository.

---

## 2. Applicability

This standard applies to every implementation of `IChainVerifier` without
exception, including:

- verifiers for environments where the protocol operates same-chain;
- verifiers implemented by adopting an external proof or messaging protocol;
- verifiers shared across a chain family;
- verifiers written as temporary, partial, reference, or example code.

There is no category of verifier exempt from this standard. A verifier intended
as a scaffold is governed by §4.1 and §5, not by an exemption.

---

## 3. Mandatory requirements

### 3.1 Authenticity

A verifier SHALL establish that the asserted source-chain event occurred, by a
mechanism that does not require trusting the party supplying the assertion.

The verifier SHALL derive its decision from independently authenticated
evidence rather than from values asserted by the caller.

Acceptable mechanisms are consensus verification performed on Base (light
client, SPV, or equivalent), verified messages delivered by a protocol whose
security properties are documented under §3.7, or direct reading of on-chain
state where the source chain is Base itself.

Decoding a caller-supplied structure and testing its fields is not
authentication. Neither is cross-checking two caller-supplied structures
against each other: a witness compared to itself yields no evidence.

### 3.2 Rejection of fabricated evidence

A verifier SHALL reject inputs that describe events which did not occur,
including inputs that are internally consistent, correctly encoded, and
well-formed in every respect.

Internal consistency is a property of the input. It is not a property of the
world.

### 3.3 Chain-specific finality

A verifier SHALL apply the finality rule appropriate to its source chain, and
SHALL NOT accept an event as final before that rule is satisfied. Where a chain
family shares a pattern but differs in parameter — confirmation depth across
Bitcoin-family chains, for example — the parameter SHALL be specific to the
environment rather than defaulted.

Finality parameters SHALL NOT be modifiable except by an authority declared in
the contract and constrained by §3.6.

### 3.4 Replay protection

A verifier SHALL ensure that a single source-chain event cannot be presented
more than once to produce issuance more than once, whether within an
environment or across environments.

### 3.5 Fail-closed behaviour

A verifier SHALL revert on any condition it cannot affirmatively verify.
Absence of evidence SHALL NOT be treated as evidence, and no code path SHALL
return success by default, by omission, or by short-circuit.

### 3.6 Compliance with VF-XCH-012 and VF-XCH-017

A verifier SHALL be structured so that no party can alter the contents of
evidence, select which evidence is honoured, redirect issuance, or exercise
discretionary approval over an outcome. A party that transports evidence
reports a fact; it SHALL NOT decide a result.

A verifier SHALL NOT introduce any person or group holding discretionary
authority to approve, alter, redirect, or reverse issuance.

A verifier that functions correctly but violates either requirement is
**not complete** under this standard. Correct operation does not cure a
prohibited trust structure.

### 3.7 Disclosed trust assumptions

A verifier SHALL document, in its own source and in the specification, every
assumption on which its correctness depends — including any external protocol
relied upon, any trusted initial state such as a checkpoint header, and the
conditions under which the mechanism would fail.

An undisclosed trust assumption is a defect under this standard whether or not
the mechanism is otherwise sound.

---

## 4. Prohibited behaviours

### 4.1 Placeholder success

A component SHALL NOT return success without performing the verification it
represents. A security-critical component may exist in only one of two states:

1. fully implemented and evidenced under §5; or
2. explicitly non-operational, reverting with a named not-implemented error.

Code that accepts structured input and returns success appears functional to
every reader, every caller, and every test. Code that reverts is unmistakably
unfinished. When the work is incomplete, the second state is the only
permitted representation of that fact.

### 4.2 Access control deferred by comment

A function SHALL NOT be left unguarded with a comment indicating that access
control belongs there in production. Either the guard exists, or the function
does not.

### 4.3 Success-path-only testing

A verifier SHALL NOT be considered tested on the basis of tests that exercise
only valid inputs. See §5.2.

### 4.4 Mock substitution in completion evidence

Evidence offered under §5 SHALL exercise the production verifier. A test that
substitutes a mock at the verifier seam produces no evidence about the
verifier, however comprehensive it is about everything else.

### 4.5 Inference of correctness from silence

The absence of a contradicting artifact SHALL NOT be recorded as evidence of
compliance. A requirement is satisfied when something demonstrates it is
satisfied, not when nothing demonstrates otherwise.

---

## 5. Evidence required for completion

A verifier is complete when all of the following exist as committed repository
artifacts. Recollection, review discussion, and reviewer agreement are not
evidence.

Evidence artifacts SHALL be committed to the repository under the `evidence/`
directory before a verifier may be considered complete. An artifact that exists
only in a working tree, a conversation, or a reviewer's possession does not
satisfy this section.

### 5.1 Positive evidence

Test output demonstrating that a genuine source-chain lock event is verified
and produces the expected issuance, exercising the production verifier.

### 5.2 Negative evidence

Test output demonstrating that fabricated, malformed, replayed, and
insufficiently-final inputs are **rejected**, exercising the production
verifier.

Negative evidence is mandatory and independent of positive evidence. A verifier
with passing success-path tests and no rejection tests has demonstrated
nothing about the property that matters. Where a defect motivated the
verifier's implementation, the test that demonstrated the defect SHALL be
retained, with its assertion inverted, as a permanent regression test.

### 5.3 Trust assumption record

A written statement of the mechanism's trust assumptions, sufficient for a
reader to determine what must hold for issuance to be sound, and what would
follow if it did not.

### 5.4 Specification conformance

Identification of the specification requirements the verifier satisfies, and
confirmation that §3.6 is met.

---

## 6. Deployment gate

**DG-07** — No environment may be deployed until its verifier satisfies every
requirement of §3, exhibits none of the behaviours in §4, and has produced
every artifact required by §5.

A verifier not meeting this standard SHALL remain in the non-operational state
described in §4.1. It SHALL NOT be registered for an environment in any
configuration intended for production, and configuration SHALL NOT be finalized
while any registered verifier is non-operational for an environment intended to
be active at launch.

---

## 7. Relationship to the specification

This standard is subordinate to the Master Specification. Where the
specification imposes a stricter requirement, the specification governs. This
standard does not create new protocol behaviour; it defines the evidentiary and
structural conditions under which an implementation of existing protocol
requirements may be considered finished.

VF-XCH-012 and VF-XCH-017 are incorporated as mandatory criteria under §3.6.
