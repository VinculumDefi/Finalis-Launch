# CL-38 — Price Publisher Key Model
## Decision brief · 2026-08-07 · **decision required before code freeze**

---

## THE FINDING

`VinculumFinalisVerifier.sol` — `pricePublisher` is a **single immutable address**, set at construction. Every price batch is validated by recovering an ECDSA signature and comparing it to that one address.

```solidity
address public immutable pricePublisher;
...
require(
    _recoverSigner(_ethSignedMessageHash(digest), publisherSignature) == pricePublisher,
    "VF-ORC-007: bad publisher signature"
);
```

**Consequence of compromise.** An attacker holding that key can sign arbitrary prices for the life of the protocol. There is no rotation function, no revocation, no recovery. Under VF-IMM-006 the defect is unrepairable once deployed.

**Consequence of loss.** If the key is lost rather than stolen, no further price batch can ever be accepted. Every USD-dependent operation fails closed permanently under CL-37's 48-hour staleness bound. Issuance stops forever. Principal release continues (VF-PRI-004, VF-SEC-006).

**Severity:** High. **Not currently a specification violation** — see below.

---

## WHAT THE SPECIFICATION ACTUALLY SAYS

Verbatim, the governing text:

**§7.2** — *"The concrete integration and production signing configuration are architecture and deployment deliverables; they may not silently change the twice-daily first-valid-price rule."*

The signing configuration is **explicitly delegated** to deployment deliverables. A single key is therefore permitted. This is a design choice the specification leaves open, not a gap in the implementation.

**VF-ORC-007** — the Base valuation path accepts only a valid signed and batched price record for the exact approved asset identity. Satisfied by any of the options below.

**VF-SEC-005** — *"A relayer or price-batch submitter obtains no authority to change protocol parameters or redirect user or Dev Fund value."* Already satisfied and tested: anyone may submit a batch; only a signature from the publisher makes it valid. The submitter is a courier.

**VF-SEC-003** — *"No failure path may substitute a default asset, price, environment, user, recipient, output, duration, multiplier, or Dev Fund destination."* This constrains the options: **no fallback price source may be introduced** as a compromise or loss mitigation. Whatever is chosen must fail closed, not fail over.

**VF-IMM-001** — no administrator, owner role, upgrade authority, or discretionary parameter-setting authority after deployment. **This is the binding constraint on option 3.**

**VF-EXT-002** — an unavailable external address or unfinished architecture deliverable must be reported as incomplete rather than replaced with an invented value. If this is deferred, it must be *recorded* as deferred.

---

## THE OPTIONS

### Option 1 — Single key, documented

Keep the current implementation. Record the custody model, the compromise consequence, and the loss consequence in the deployment evidence and in public disclosure.

**Specification standing:** compliant. §7.2 permits it.

**In favour**
- Already implemented and tested. Zero further work, zero regression risk.
- Simplest possible verification path — nothing for an auditor to misread.
- No constructor change, so nothing downstream moves.

**Against**
- Single point of compromise for the protocol's entire valuation input.
- Single point of *loss*: a lost key permanently halts issuance.
- An auditor will raise it. Documented acceptance is a defensible answer, but it is an answer you will have to give.

**Custody requirement if chosen:** the key must be held in hardware, never on an internet-connected machine, with a documented signing procedure. Absent that, this option is not genuinely defensible.

---

### Option 2 — Fixed publisher set, M-of-N threshold

Constructor takes N immutable public keys. A batch requires M valid signatures from distinct members. No rotation; the set is fixed at deployment.

**Specification standing:** compliant. Still a "production signing configuration" under §7.2. Still satisfies VF-SEC-005 — signers hold no protocol authority, only the ability to attest a price.

**In favour**
- No single point of compromise. An attacker needs M keys.
- No single point of loss. Up to N−M keys can be lost without halting the protocol.
- This is what an auditor will expect to see for an oracle input on an immutable protocol.

**Against**
- Constructor and verification path change. **This is the ordering constraint** — it must land before any further work builds on the single-key assumption.
- More gas per batch (M signature recoveries rather than one).
- Operationally heavier: M parties must coordinate twice daily, or one party must hold M keys, which silently collapses it back toward option 1.

**Honest note:** if M keys end up on the same machine under the same operator, this option provides the *appearance* of distribution without the substance. It is only worth its cost if the keys are genuinely separated.

---

### Option 3 — Rotation via an immutable successor rule

A mechanism permitting the current publisher to designate a successor.

**Specification standing: NOT RECOMMENDED, and arguably non-compliant.**

VF-IMM-001 forbids any *discretionary parameter-setting authority* after deployment. A key that can designate its own successor is precisely that — the holder can change who controls protocol valuation input. Under VF-IMM-004, "temporary control to be removed later" is also foreclosed.

There may exist a formulation narrow enough to survive scrutiny, but designing it days before code freeze, against a specification that names this failure mode explicitly, is the wrong trade.

**Recommend rejecting.**

---

## WHAT IS NOT AN OPTION

**A fallback price source** — a secondary oracle, a last-known-good substitution, an admin override for stale prices. **VF-SEC-003 forbids substituting a default price on any failure path.** CL-37 already establishes the correct behaviour: fail closed, and principal release continues regardless (VF-PRI-004, VF-SEC-006).

---

## THE QUESTION IN PLAIN TERMS

Not "how many keys." It is:

> **If the person holding the price key is compromised, how much of the protocol goes with them — and can it be prevented from happening in the first place, given that nothing can be fixed afterward?**

Under option 1 the answer is: all valuation input, permanently, unless custody is genuinely hardened.
Under option 2: nothing, unless M holders are compromised together.

And the mirror question, which is easier to overlook:

> **If the key is lost — a failed drive, a person unavailable, a hardware wallet destroyed — does the protocol stop forever?**

Under option 1, yes. Under option 2, not until N−M+1 keys are gone.

---

## MY READING, NOT A DECISION

**Option 2 if the keys can be genuinely separated. Option 1 with hardened custody and written disclosure if they cannot.**

The deciding factor is not cryptographic — it is operational. A 3-of-5 scheme whose five keys live on one laptop is worse than an honest single key on a hardware wallet, because it claims a property it does not have.

**Whichever is chosen, VF-EXT-002 requires the decision be recorded** — in the deployment evidence, in the specification for Revision 7, and in public disclosure. A deferred or accepted risk that is written down is a decision. The same risk unwritten is an oversight.

---

## IMPLEMENTATION COST IF OPTION 2

| Item | Detail |
|---|---|
| Constructor | Takes `address[] publishers` and `uint8 threshold`, both immutable; validates N ≥ M ≥ 1, no duplicates, no zero addresses (VF-DEP-002) |
| Verification | Loop M recoveries; reject duplicate signers within a batch |
| Regression risk | Medium. Contained to `submitPriceBatch` and construction; the 91-test baseline must survive unchanged |
| New tests | M valid accepted · M−1 rejected · duplicate signature from one key not counted twice · non-member rejected · threshold boundary · construction validation |
| Estimated | Two to three hours including evidence |

**If option 2 is wanted, it must be done before the implementation-domain narrowing audit**, so the audit examines the final types rather than types that are about to change.
