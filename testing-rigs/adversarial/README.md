# RIG 9 — Adversarial input and trust-boundary testing

Discovery only. Does not fix contracts. Local Hardhat only. No deploys, keys, or broadcasts.

## Run

```bash
export PATH=/tmp/node22bin:$PATH   # if system node is below Hardhat's requirement
cd base-contracts
# Branch-green suite (PASS cases only; FINDING cases skipped):
npx hardhat test --no-compile \
  ../testing-rigs/adversarial/adversarial_trust_boundary.test.cjs \
  ../testing-rigs/adversarial/adversarial_utxo_and_header.test.cjs
# Findings (tests fail the "safe" assertion by showing unauthorized mint/RAC):
ADVERSARIAL=1 npx hardhat test --no-compile \
  ../testing-rigs/adversarial/adversarial_trust_boundary.test.cjs \
  ../testing-rigs/adversarial/adversarial_utxo_and_header.test.cjs
```

## Outputs

- `testing-rigs/findings/adversarial.json` — ADV-nn findings with class, severity, amounts, AG cross-ref, live-or-latent
- This directory — test files

## Classification

Each result is exactly one of: CONFIRMED VULNERABILITY, SPEC CONFLICT, UNVERIFIED ASSUMPTION, INCOMPLETE TESTING, PASS.

## Spec cites

Rev 6 requirement traceability, Rev 12 Handshake, Rev 13 ITS timing. Cross-ref AG-01..AG-20 from the assumption-gap rig without duplicating their writeups.
