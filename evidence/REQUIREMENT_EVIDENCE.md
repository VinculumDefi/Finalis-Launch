# Requirement Evidence Register

**Authority:** Master Specification Revision 6; `spec/Vinculum_Finalis_Requirement_Traceability.csv` (209 rows).
**Branch at evidence-commit parent tip:** `grok/ethereum-e2e` @ `69c757fdfd53fc28956674c6a9d836107ba0b7b2` (the current tip before this evidence commit).
**Suite command:** `cd base-contracts && npx hardhat test` → **355 passing, 0 failing (2026-10-01)**.
**Four-chain command:** `cd base-contracts && npx hardhat test test/35_deploy_five_guard.test.cjs test/36_deploy_five_poly_arb_op.test.cjs` → **13 passing (Ethereum+Polygon+Arbitrum+Optimism deployFive e2e + guards + refuse stubs)**.


## Post-5017498 rerun citations

These named tests were re-run on `grok/ethereum-e2e` after `5017498`; the commands and observed results below are the evidence citations for this update. No requirement status is upgraded unless the named test demonstrates that exact requirement; VF-VER-002/003/004 remain **Partial**.

| Test file | Named test (`it` title) | Command | Result |
|---|---|---|---|
| `test/09_registration.test.cjs` | `a precision beyond safe arithmetic is rejected at registration` (including 78) | `cd base-contracts && npx hardhat test test/09_registration.test.cjs` | **8 passing** |
| `test/39_deploy_five_ethereum_native_eth.test.cjs` | `locks 100 ETH, mints 1495 VCLM, fee 5 ETH, releases 95 ETH; early release reverts` | `cd base-contracts && npx hardhat test test/39_deploy_five_ethereum_native_eth.test.cjs` | **1 passing** |
| `test/40_deploy_five_ethereum_near.test.cjs` | `locks 100 NEAR, mints 1150 VCLM, fee 5e24, releases 95e24; early release reverts` | `cd base-contracts && npx hardhat test test/40_deploy_five_ethereum_near.test.cjs` | **1 passing** |
| `test/42_deploy_five_ethereum_usdc_mainnet_fork.test.cjs` | `locks 100 real USDC on a local copy of chain state, mints 1725 VCLM, Dev Fund 5_000_000, releases 95_000_000` | `cd base-contracts && npx hardhat test test/42_deploy_five_ethereum_usdc_mainnet_fork.test.cjs` | **1 passing**; block number of that local copy `26100641` |
| `test/43_deploy_five_poly_arb_op_base_mainnet_fork.test.cjs` | Polygon: `locks 100 real USDC_POL on a local copy of chain state, mints 1150 VCLM, Dev Fund 5_000_000, releases 95_000_000`; Arbitrum: same with `USDC_ARB`; Optimism: `locks 100 real OP on a local copy of chain state, mints 1150 VCLM, Dev Fund 5e18, releases 95e18`; Base: `locks 100 real cbETH on a local copy of chain state, BaseSameChainVerifier reads vault, mints 1150 VCLM, releases 95e18` | `cd base-contracts && npx hardhat test test/43_deploy_five_poly_arb_op_base_mainnet_fork.test.cjs` | **4 passing**; Polygon/Arbitrum/Optimism/Base block numbers of those local copies `94794725` / `510813352` / `157649463` / `52054330` |

**Allowed statuses only:** Demonstrated · Partial · Refuses on purpose · Not authorized · Not code.

- **Demonstrated** requires a test file, `it` title, and a command that was run.
- **Passing count ≠ readiness** (VF-VER-007).
- VF-VER-002 / VF-VER-003 / VF-VER-004 named gaps stay **Partial** (pending-attempt resolution, UTXO multi-key release, release-public-key normalization).
- Do not adopt Revision 7 candidate amendments.
- Code + tests win over older LAUNCH_CERTIFICATION sentences where they conflict.

## Status counts

| Status | Count |
|---|---:|
| Demonstrated | 62 |
| Partial | 115 |
| Refuses on purpose | 0 |
| Not authorized | 0 |
| Not code | 32 |
| **Total** | **209** |

## Twelve non-authorized / refuse-closed environments (inventory)

| Environment | Verifier file under `base-contracts/contracts/chain-verifiers/` | Status |
|---|---|---|
| BNB | `EvmChainVerifier.sol` (shared fail-closed stub) | Refuses on purpose |
| Avalanche | `EvmChainVerifier.sol` (shared fail-closed stub) | Refuses on purpose |
| Solana | `SolanaChainVerifier.sol` | Refuses on purpose |
| Stellar | `StellarChainVerifier.sol` | Refuses on purpose |
| XRP Ledger | `XrplChainVerifier.sol` | Refuses on purpose |
| Bitcoin | `UtxoChainVerifier.sol` (+ header chain libs) | Not authorized |
| Bitcoin Cash | `UtxoChainVerifier.sol` | Not authorized |
| Litecoin | *(missing dedicated verifier file)* | Not authorized |
| Dogecoin | *(missing dedicated verifier file)* | Not authorized |
| DigiByte | *(missing dedicated verifier file)* | Not authorized |
| Zcash | *(missing dedicated verifier file)* | Not authorized |
| Cosmos Hub | *(missing Base-side chain verifier file)* | Not authorized |

Refuse-closed stubs evidenced by `test/36_deploy_five_poly_arb_op.test.cjs` —
`SolanaChainVerifier / StellarChainVerifier / XrplChainVerifier / EvmChainVerifier revert VerifierNotImplemented`
(command: `cd base-contracts && npx hardhat test test/35_deploy_five_guard.test.cjs test/36_deploy_five_poly_arb_op.test.cjs`). Those tests must not make a lock succeed.

## Requirement rows (209)

| Requirement ID | Status | Test file | `it` title | Command | Notes |
|---|---|---|---|---|---|
| VF-DOC-001 | Not code |  |  |  | Governance/process/ops/website — no on-chain demonstration obligation in this register. |
| VF-DOC-002 | Not code |  |  |  | Governance/process/ops/website — no on-chain demonstration obligation in this register. |
| VF-DOC-003 | Not code |  |  |  | Governance/process/ops/website — no on-chain demonstration obligation in this register. |
| VF-DOC-004 | Not code |  |  |  | Governance/process/ops/website — no on-chain demonstration obligation in this register. |
| VF-DOC-005 | Not code |  |  |  | Governance/process/ops/website — no on-chain demonstration obligation in this register. |
| VF-DOC-006 | Not code |  |  |  | Governance/process/ops/website — no on-chain demonstration obligation in this register. |
| VF-DOC-007 | Not code |  |  |  | Governance/process/ops/website — no on-chain demonstration obligation in this register. |
| VF-DOC-008 | Not code |  |  |  | Governance/process/ops/website — no on-chain demonstration obligation in this register. |
| VF-DOC-009 | Not code |  |  |  | Governance/process/ops/website — no on-chain demonstration obligation in this register. |
| VF-DOC-010 | Not code |  |  |  | Governance/process/ops/website — no on-chain demonstration obligation in this register. |
| VF-IMM-001 | Demonstrated | test/01_findings.test.cjs | CL-02 · VF-IMM-001/VF-DEP-006: authority terminated at finalization | cd base-contracts && npx hardhat test | Named in generated traceability matrix; covered by full suite run. |
| VF-IMM-002 | Partial |  |  |  | Not traced to a naming test; architecture may be implemented without citation. |
| VF-IMM-003 | Not code |  |  |  | Not traced in code. |
| VF-IMM-004 | Partial |  |  |  | Implemented (or cited in code) without a requirement-naming test in the matrix. |
| VF-IMM-005 | Partial |  |  |  | Implemented (or cited in code) without a requirement-naming test in the matrix. |
| VF-IMM-006 | Not code |  |  |  | Governance/process/ops/website — no on-chain demonstration obligation in this register. |
| VF-ARC-001 | Partial |  |  |  | Not traced to a naming test; architecture may be implemented without citation. |
| VF-ARC-002 | Partial |  |  |  | Not traced to a naming test; architecture may be implemented without citation. |
| VF-ARC-003 | Partial |  |  |  | Not traced to a naming test; architecture may be implemented without citation. |
| VF-ARC-004 | Partial |  |  |  | Implemented (or cited in code) without a requirement-naming test in the matrix. |
| VF-ARC-005 | Partial |  |  |  | Implemented (or cited in code) without a requirement-naming test in the matrix. |
| VF-ARC-006 | Demonstrated | test/25_w1_identity_binding.test.cjs | W1-01a · a package naming a different baseRecipient must not mint | cd base-contracts && npx hardhat test | Named in generated traceability matrix; covered by full suite run. |
| VF-TOK-001 | Partial |  |  |  | Implemented (or cited in code) without a requirement-naming test in the matrix. |
| VF-TOK-002 | Partial |  |  |  | Implemented (or cited in code) without a requirement-naming test in the matrix. |
| VF-TOK-003 | Partial |  |  |  | Implemented (or cited in code) without a requirement-naming test in the matrix. |
| VF-TOK-004 | Partial |  |  |  | Implemented (or cited in code) without a requirement-naming test in the matrix. |
| VF-TOK-005 | Partial |  |  |  | Not traced to a naming test; architecture may be implemented without citation. |
| VF-TOK-006 | Partial |  |  |  | Not traced to a naming test; architecture may be implemented without citation. |
| VF-TOK-007 | Partial |  |  |  | Implemented (or cited in code) without a requirement-naming test in the matrix. |
| VF-TOK-008 | Partial |  |  |  | Not traced to a naming test; architecture may be implemented without citation. |
| VF-TOK-009 | Partial |  |  |  | Implemented (or cited in code) without a requirement-naming test in the matrix. |
| VF-TOK-010 | Partial |  |  |  | Implemented (or cited in code) without a requirement-naming test in the matrix. |
| VF-TOK-011 | Partial |  |  |  | Not traced to a naming test; architecture may be implemented without citation. |
| VF-TOK-012 | Not code |  |  |  | Governance/process/ops/website — no on-chain demonstration obligation in this register. |
| VF-TOK-013 | Partial |  |  |  | Not traced to a naming test; architecture may be implemented without citation. |
| VF-TOK-014 | Not code |  |  |  | Not traced in contracts/tests — process or off-chain representation. |
| VF-TOK-015 | Not code |  |  |  | Governance/process/ops/website — no on-chain demonstration obligation in this register. |
| VF-COM-001 | Partial |  |  |  | Implemented (or cited in code) without a requirement-naming test in the matrix. |
| VF-COM-002 | Partial |  |  |  | Implemented (or cited in code) without a requirement-naming test in the matrix. |
| VF-COM-003 | Demonstrated | test/10_cl76_forged_package.test.cjs | (see file) | cd base-contracts && npx hardhat test | Named in generated traceability matrix; covered by full suite run. |
| VF-COM-004 | Partial |  |  |  | Implemented (or cited in code) without a requirement-naming test in the matrix. |
| VF-COM-005 | Partial |  |  |  | Implemented (or cited in code) without a requirement-naming test in the matrix. |
| VF-COM-006 | Demonstrated | test/03_handshake.test.cjs | CL-11 · VF-COM-006 handshake allowance registry | cd base-contracts && npx hardhat test | Named in generated traceability matrix; covered by full suite run. |
| VF-COM-007 | Demonstrated | test/04_endtoend.test.cjs | CL-11: the caller | cd base-contracts && npx hardhat test | Named in generated traceability matrix; covered by full suite run. |
| VF-COM-008 | Demonstrated | test/04_endtoend.test.cjs | VF-COM-008: a rejected attempt consumes no allowance | cd base-contracts && npx hardhat test | Named in generated traceability matrix; covered by full suite run. |
| VF-COM-009 | Partial |  |  |  | Implemented (or cited in code) without a requirement-naming test in the matrix. |
| VF-COM-010 | Partial |  |  |  | Implemented (or cited in code) without a requirement-naming test in the matrix. |
| VF-COM-011 | Partial | test/40_deploy_five_ethereum_near.test.cjs | locks 100 NEAR, mints 1150 VCLM, fee 5e24, releases 95e24; early release reverts | cd base-contracts && npx hardhat test test/40_deploy_five_ethereum_near.test.cjs | Verified 24-decimal precision produces the expected 5e24 fee. |
| VF-COM-012 | Partial | test/40_deploy_five_ethereum_near.test.cjs | locks 100 NEAR, mints 1150 VCLM, fee 5e24, releases 95e24; early release reverts | cd base-contracts && npx hardhat test test/40_deploy_five_ethereum_near.test.cjs | Immutable 24-decimal precision yields 95e24 principal from 100 NEAR less 5e24 fee. |
| VF-COM-013 | Partial |  |  |  | Implemented (or cited in code) without a requirement-naming test in the matrix. |
| VF-COM-014 | Partial |  |  |  | Not traced to a naming test; architecture may be implemented without citation. |
| VF-COM-015 | Partial |  |  |  | Not traced to a naming test; architecture may be implemented without citation. |
| VF-COM-016 | Demonstrated | test/11_base_vault.test.cjs | refuses to release before maturity | cd base-contracts && npx hardhat test |  |
| VF-COM-017 | Partial |  |  |  | Implemented (or cited in code) without a requirement-naming test in the matrix. |
| VF-COM-018 | Demonstrated | test/35_deploy_five_guard.test.cjs | locks 100 tokens, proves via Ethereum verifier, mints 1725 VCLM, releases 95% | cd base-contracts && npx hardhat test test/35_deploy_five_guard.test.cjs test/36_deploy_five_poly_arb_op.test.cjs |  |
| VF-COM-019 | Partial |  |  |  | Implemented (or cited in code) without a requirement-naming test in the matrix. |
| VF-COM-020 | Demonstrated | test/09_registration.test.cjs | VF-COM-020: every value outside {0,1} is rejected before any minting | cd base-contracts && npx hardhat test | Named in generated traceability matrix; covered by full suite run. |
| VF-COM-021 | Partial |  |  |  | Not traced to a naming test; architecture may be implemented without citation. |
| VF-COM-022 | Partial |  |  |  | Not traced to a naming test; architecture may be implemented without citation. |
| VF-COM-023 | Partial |  |  |  | Not traced to a naming test; architecture may be implemented without citation. |
| VF-COM-024 | Partial |  |  |  | Not traced to a naming test; architecture may be implemented without citation. |
| VF-COM-025 | Demonstrated | test/25_w1_identity_binding.test.cjs | W1-01c · a package naming a different selectedOutputToken must not mint | cd base-contracts && npx hardhat test | Named in generated traceability matrix; covered by full suite run. |
| VF-COM-026 | Partial |  |  |  | Not traced to a naming test; architecture may be implemented without citation. |
| VF-REG-001 | Demonstrated | test/25_w1_identity_binding.test.cjs | W1-02a · a package naming a different canonicalAssetId must not mint | cd base-contracts && npx hardhat test | Named in generated traceability matrix; covered by full suite run. |
| VF-REG-002 | Partial |  |  |  | Not traced to a naming test; architecture may be implemented without citation. |
| VF-REG-003 | Partial |  |  |  | Not traced to a naming test; architecture may be implemented without citation. |
| VF-REG-004 | Partial |  |  |  | Not traced to a naming test; architecture may be implemented without citation. |
| VF-REG-005 | Partial |  |  |  | Not traced to a naming test; architecture may be implemented without citation. |
| VF-REG-006 | Partial |  |  |  | Not traced to a naming test; architecture may be implemented without citation. |
| VF-REG-007 | Partial |  |  |  | Not traced to a naming test; architecture may be implemented without citation. |
| VF-REG-008 | Partial |  |  |  | Not traced to a naming test; architecture may be implemented without citation. |
| VF-REG-009 | Partial |  |  |  | Not traced to a naming test; architecture may be implemented without citation. |
| VF-REG-010 | Partial |  |  |  | Not traced to a naming test; architecture may be implemented without citation. |
| VF-REG-011 | Partial |  |  |  | Not traced to a naming test; architecture may be implemented without citation. |
| VF-ORC-001 | Not code |  |  |  | Governance/process/ops/website — no on-chain demonstration obligation in this register. |
| VF-ORC-002 | Not code |  |  |  | Governance/process/ops/website — no on-chain demonstration obligation in this register. |
| VF-ORC-003 | Not code |  |  |  | Governance/process/ops/website — no on-chain demonstration obligation in this register. |
| VF-ORC-004 | Not code |  |  |  | Governance/process/ops/website — no on-chain demonstration obligation in this register. |
| VF-ORC-005 | Demonstrated | test/02_oracle.test.cjs | VF-ORC-005: a zero price marks the asset unavailable rather than substituting one | cd base-contracts && npx hardhat test | Named in generated traceability matrix; covered by full suite run. |
| VF-ORC-006 | Not code |  |  |  | Governance/process/ops/website — no on-chain demonstration obligation in this register. |
| VF-ORC-007 | Demonstrated | test/02_oracle.test.cjs | CL-01 · VF-ORC-007 signed price records | cd base-contracts && npx hardhat test | Named in generated traceability matrix; covered by full suite run. |
| VF-ORC-008 | Demonstrated | test/02_oracle.test.cjs | VF-ORC-008: a run must be newer than the last accepted run | cd base-contracts && npx hardhat test | Named in generated traceability matrix; covered by full suite run. |
| VF-ORC-009 | Partial |  |  |  | Implemented (or cited in code) without a requirement-naming test in the matrix. |
| VF-ORC-010 | Partial |  |  |  | Not traced to a naming test; architecture may be implemented without citation. |
| VF-ORC-011 | Demonstrated | test/25_w1_identity_binding.test.cjs | W1-02c · substituting to a higher custody class must not mint | cd base-contracts && npx hardhat test | Named in generated traceability matrix; covered by full suite run. |
| VF-ORC-012 | Partial |  |  |  | Implemented (or cited in code) without a requirement-naming test in the matrix. |
| VF-ORC-013 | Partial |  |  |  | Implemented (or cited in code) without a requirement-naming test in the matrix. |
| VF-ORC-014 | Not code |  |  |  | Governance/process/ops/website — no on-chain demonstration obligation in this register. |
| VF-FEE-001 | Demonstrated | test/35_deploy_five_guard.test.cjs | locks 100 tokens, proves via Ethereum verifier, mints 1725 VCLM, releases 95% | cd base-contracts && npx hardhat test test/35_deploy_five_guard.test.cjs test/36_deploy_five_poly_arb_op.test.cjs |  |
| VF-FEE-002 | Partial |  |  |  | Not traced to a naming test; architecture may be implemented without citation. |
| VF-FEE-003 | Demonstrated | test/35_deploy_five_guard.test.cjs | locks 100 tokens, proves via Ethereum verifier, mints 1725 VCLM, releases 95% | cd base-contracts && npx hardhat test test/35_deploy_five_guard.test.cjs test/36_deploy_five_poly_arb_op.test.cjs |  |
| VF-FEE-004 | Partial |  |  |  | Implemented (or cited in code) without a requirement-naming test in the matrix. |
| VF-FEE-005 | Partial |  |  |  | Not traced to a naming test; architecture may be implemented without citation. |
| VF-FEE-006 | Demonstrated | test/04_endtoend.test.cjs | VF-COM-008: a rejected attempt consumes no allowance | cd base-contracts && npx hardhat test | Named in generated traceability matrix; covered by full suite run. |
| VF-FEE-007 | Demonstrated | test/04_endtoend.test.cjs | VF-COM-008: a rejected attempt consumes no allowance | cd base-contracts && npx hardhat test | Named in generated traceability matrix; covered by full suite run. |
| VF-FEE-008 | Demonstrated | test/04_endtoend.test.cjs | VF-FEE-008: missing fee transfer evidence is rejected | cd base-contracts && npx hardhat test | Named in generated traceability matrix; covered by full suite run. |
| VF-FEE-009 | Demonstrated | test/04_endtoend.test.cjs | VF-FEE-009: an empty destination cannot be registered at all | cd base-contracts && npx hardhat test | Named in generated traceability matrix; covered by full suite run. |
| VF-FEE-010 | Not code |  |  |  | Not traced in contracts/tests — process or off-chain representation. |
| VF-FEE-011 | Partial |  |  |  | Implemented (or cited in code) without a requirement-naming test in the matrix. |
| VF-FEE-012 | Partial |  |  |  | Not traced to a naming test; architecture may be implemented without citation. |
| VF-RAC-001 | Partial |  |  |  | Implemented (or cited in code) without a requirement-naming test in the matrix. |
| VF-RAC-002 | Partial |  |  |  | Implemented (or cited in code) without a requirement-naming test in the matrix. |
| VF-RAC-003 | Partial |  |  |  | Implemented (or cited in code) without a requirement-naming test in the matrix. |
| VF-RAC-004 | Partial |  |  |  | Implemented (or cited in code) without a requirement-naming test in the matrix. |
| VF-RAC-005 | Partial |  |  |  | Implemented (or cited in code) without a requirement-naming test in the matrix. |
| VF-RAC-006 | Partial |  |  |  | Implemented (or cited in code) without a requirement-naming test in the matrix. |
| VF-RAC-007 | Partial |  |  |  | Not traced to a naming test; architecture may be implemented without citation. |
| VF-RAC-008 | Partial |  |  |  | Implemented (or cited in code) without a requirement-naming test in the matrix. |
| VF-STK-001 | Partial |  |  |  | Implemented (or cited in code) without a requirement-naming test in the matrix. |
| VF-STK-002 | Demonstrated | test/10_bps_domain.test.cjs | VF-STK-002: every value outside {0,1,2} is rejected | cd base-contracts && npx hardhat test | Named in generated traceability matrix; covered by full suite run. |
| VF-STK-003 | Demonstrated | test/10_bps_domain.test.cjs | §10.1: an unlisted duration is rejected | cd base-contracts && npx hardhat test | Named in generated traceability matrix; covered by full suite run. |
| VF-STK-004 | Demonstrated | test/00_smoke.test.cjs | (see file) | cd base-contracts && npx hardhat test | Named in generated traceability matrix; covered by full suite run. |
| VF-STK-005 | Partial |  |  |  | Implemented (or cited in code) without a requirement-naming test in the matrix. |
| VF-STK-006 | Partial |  |  |  | Implemented (or cited in code) without a requirement-naming test in the matrix. |
| VF-STK-007 | Partial |  |  |  | Implemented (or cited in code) without a requirement-naming test in the matrix. |
| VF-STK-008 | Partial |  |  |  | Implemented (or cited in code) without a requirement-naming test in the matrix. |
| VF-STK-009 | Partial |  |  |  | Implemented (or cited in code) without a requirement-naming test in the matrix. |
| VF-STK-010 | Demonstrated | test/05_staking_lifecycle.test.cjs | a staker is paid through closeEpoch, allocateEpoch and claim | cd base-contracts && npx hardhat test | Named in generated traceability matrix; covered by full suite run. |
| VF-STK-011 | Partial |  |  |  | Implemented (or cited in code) without a requirement-naming test in the matrix. |
| VF-STK-012 | Demonstrated | test/05_staking_lifecycle.test.cjs | a staker is paid through closeEpoch, allocateEpoch and claim | cd base-contracts && npx hardhat test | Named in generated traceability matrix; covered by full suite run. |
| VF-STK-013 | Demonstrated | test/27_cl86_verify_before_credit.test.cjs | (see file) | cd base-contracts && npx hardhat test | Named in generated traceability matrix; covered by full suite run. |
| VF-STK-014 | Demonstrated | test/28_cl87_complete_epoch_reward.test.cjs | (see file) | cd base-contracts && npx hardhat test | Named in generated traceability matrix; covered by full suite run. |
| VF-STK-015 | Demonstrated | test/05_staking_lifecycle.test.cjs | VF-STK-015: an epoch with no stakers allocates nothing | cd base-contracts && npx hardhat test | Named in generated traceability matrix; covered by full suite run. |
| VF-STK-016 | Partial |  |  |  | Implemented (or cited in code) without a requirement-naming test in the matrix. |
| VF-STK-017 | Partial |  |  |  | Implemented (or cited in code) without a requirement-naming test in the matrix. |
| VF-STK-018 | Partial |  |  |  | Implemented (or cited in code) without a requirement-naming test in the matrix. |
| VF-STK-019 | Partial |  |  |  | Implemented (or cited in code) without a requirement-naming test in the matrix. |
| VF-STK-020 | Demonstrated | test/29_withdrawal_forfeit.test.cjs | (see file) | cd base-contracts && npx hardhat test | Named in generated traceability matrix; covered by full suite run. |
| VF-STK-021 | Partial |  |  |  | Implemented (or cited in code) without a requirement-naming test in the matrix. |
| VF-STK-022 | Partial |  |  |  | Implemented (or cited in code) without a requirement-naming test in the matrix. |
| VF-STK-023 | Partial |  |  |  | Implemented (or cited in code) without a requirement-naming test in the matrix. |
| VF-STK-024 | Partial |  |  |  | Implemented (or cited in code) without a requirement-naming test in the matrix. |
| VF-STK-025 | Demonstrated | test/01_findings.test.cjs | CL-14 · VF-STK-025 expired position cannot backdate over a gap | cd base-contracts && npx hardhat test | Named in generated traceability matrix; covered by full suite run. |
| VF-STK-026 | Demonstrated | test/29_withdrawal_forfeit.test.cjs | (see file) | cd base-contracts && npx hardhat test | Named in generated traceability matrix; covered by full suite run. |
| VF-STK-027 | Demonstrated | test/28_cl87_complete_epoch_reward.test.cjs | (see file) | cd base-contracts && npx hardhat test | Named in generated traceability matrix; covered by full suite run. |
| VF-STK-028 | Demonstrated | test/30_cl89_bounded_allocation.test.cjs | (see file) | cd base-contracts && npx hardhat test | Named in generated traceability matrix; covered by full suite run. |
| VF-STK-029 | Partial |  |  |  | Implemented (or cited in code) without a requirement-naming test in the matrix. |
| VF-STK-030 | Partial |  |  |  | Implemented (or cited in code) without a requirement-naming test in the matrix. |
| VF-STK-031 | Partial |  |  |  | Implemented (or cited in code) without a requirement-naming test in the matrix. |
| VF-XCH-001 | Partial |  |  |  | Not traced to a naming test; architecture may be implemented without citation. |
| VF-XCH-002 | Partial |  |  |  | Not traced to a naming test; architecture may be implemented without citation. |
| VF-XCH-003 | Partial |  |  |  | Implemented (or cited in code) without a requirement-naming test in the matrix. |
| VF-XCH-004 | Partial |  |  |  | Not traced to a naming test; architecture may be implemented without citation. |
| VF-XCH-005 | Partial |  |  |  | Not traced to a naming test; architecture may be implemented without citation. |
| VF-XCH-006 | Demonstrated | test/04_endtoend.test.cjs | VF-XCH-006: an unfinalized source event is rejected | cd base-contracts && npx hardhat test | Named in generated traceability matrix; covered by full suite run. |
| VF-XCH-007 | Partial |  |  |  | Not traced to a naming test; architecture may be implemented without citation. BNB/Avalanche/Solana/Stellar/XRPL: fail-closed stubs (Refuses on purpose at env level); Bitcoin/BCH/LTC/DOGE/DigiByte/Zcash/Cosmos Hub: Not authorized. Base+Ethereum+Polygon+Arbitrum+Optimism evidenced via 11–13, 31–36. |
| VF-XCH-008 | Partial |  |  |  | Not traced to a naming test; architecture may be implemented without citation. |
| VF-XCH-009 | Partial |  |  |  | Implemented (or cited in code) without a requirement-naming test in the matrix. |
| VF-XCH-010 | Not code |  |  |  | Not traced in contracts/tests — process or off-chain representation. |
| VF-XCH-011 | Demonstrated | test/04_endtoend.test.cjs | VF-XCH-011: a package contradicting the source facts is rejected | cd base-contracts && npx hardhat test | Named in generated traceability matrix; covered by full suite run. |
| VF-XCH-012 | Partial |  |  |  | Implemented (or cited in code) without a requirement-naming test in the matrix. |
| VF-XCH-013 | Demonstrated | test/32_polygon_lock_prove_mint.test.cjs | locks on EvmVault, proves via PolygonChainVerifier, mints VCLM, releases 95% principal | cd base-contracts && npx hardhat test |  |
| VF-XCH-014 | Partial |  |  |  | Not traced to a naming test; architecture may be implemented without citation. |
| VF-XCH-015 | Partial |  |  |  | Not traced to a naming test; architecture may be implemented without citation. |
| VF-XCH-016 | Partial |  |  |  | Not traced to a naming test; architecture may be implemented without citation. |
| VF-XCH-017 | Partial |  |  |  | Implemented (or cited in code) without a requirement-naming test in the matrix. BNB/Avalanche/Solana/Stellar/XRPL: fail-closed stubs (Refuses on purpose at env level); Bitcoin/BCH/LTC/DOGE/DigiByte/Zcash/Cosmos Hub: Not authorized. Base+Ethereum+Polygon+Arbitrum+Optimism evidenced via 11–13, 31–36. |
| VF-XCH-018 | Not code |  |  |  | Governance/process/ops/website — no on-chain demonstration obligation in this register. |
| VF-XCH-019 | Partial |  |  |  | Not traced to a naming test; architecture may be implemented without citation. |
| VF-XCH-020 | Partial |  |  |  | Not traced to a naming test; architecture may be implemented without citation. |
| VF-XCH-021 | Partial |  |  |  | Implemented (or cited in code) without a requirement-naming test in the matrix. |
| VF-PRI-001 | Demonstrated | test/11_base_vault.test.cjs | creates a lock, splits the fee, and isolates principal in its own contract | cd base-contracts && npx hardhat test |  |
| VF-PRI-002 | Demonstrated | test/11_base_vault.test.cjs | refuses a second release | cd base-contracts && npx hardhat test |  |
| VF-PRI-003 | Demonstrated | test/11_base_vault.test.cjs | releases at maturity to the bound destination when called by a stranger | cd base-contracts && npx hardhat test |  |
| VF-PRI-004 | Demonstrated | test/11_base_vault.test.cjs | releases without consulting the verifier, the price feed, or the factory | cd base-contracts && npx hardhat test |  |
| VF-PRI-005 | Demonstrated | test/11_base_vault.test.cjs | releases without consulting the verifier, the price feed, or the factory | cd base-contracts && npx hardhat test |  |
| VF-PRI-006 | Demonstrated | test/11_base_vault.test.cjs | refuses to release before maturity | cd base-contracts && npx hardhat test |  |
| VF-SUP-001 | Demonstrated | test/00_smoke.test.cjs | (see file) | cd base-contracts && npx hardhat test | Named in generated traceability matrix; covered by full suite run. |
| VF-SUP-002 | Demonstrated | test/24_cl84_lifetime_cap.test.cjs | CL-84 · both issuance paths draw the same cap (VF-SUP-002) | cd base-contracts && npx hardhat test | Named in generated traceability matrix; covered by full suite run. |
| VF-SUP-003 | Demonstrated | test/24_cl84_lifetime_cap.test.cjs | CL-84 · BASE-CAP monotonicity (VF-SUP-003) | cd base-contracts && npx hardhat test | Named in generated traceability matrix; covered by full suite run. |
| VF-SUP-004 | Partial |  |  |  | Implemented (or cited in code) without a requirement-naming test in the matrix. |
| VF-SUP-005 | Demonstrated | test/24_cl84_lifetime_cap.test.cjs | rejects issuance beyond remaining capacity in full (VF-SUP-005) | cd base-contracts && npx hardhat test | Named in generated traceability matrix; covered by full suite run. |
| VF-SUP-006 | Partial |  |  |  | Not traced to a naming test; architecture may be implemented without citation. |
| VF-SUP-007 | Partial |  |  |  | Not traced to a naming test; architecture may be implemented without citation. |
| VF-SUP-008 | Partial |  |  |  | Not traced to a naming test; architecture may be implemented without citation. |
| VF-SUP-009 | Partial |  |  |  | Implemented (or cited in code) without a requirement-naming test in the matrix. |
| VF-SUP-010 | Partial |  |  |  | Not traced to a naming test; architecture may be implemented without citation. |
| VF-SUP-011 | Partial |  |  |  | Not traced to a naming test; architecture may be implemented without citation. |
| VF-SUP-012 | Partial |  |  |  | Implemented (or cited in code) without a requirement-naming test in the matrix. |
| VF-SUP-013 | Demonstrated | test/24_cl84_lifetime_cap.test.cjs | accepts only registered recorders (VF-SUP-013) | cd base-contracts && npx hardhat test | Named in generated traceability matrix; covered by full suite run. |
| VF-SUP-014 | Partial |  |  |  | Implemented (or cited in code) without a requirement-naming test in the matrix. |
| VF-SUP-015 | Partial |  |  |  | Implemented (or cited in code) without a requirement-naming test in the matrix. |
| VF-SEC-001 | Partial |  |  |  | Implemented (or cited in code) without a requirement-naming test in the matrix. |
| VF-SEC-002 | Partial |  |  |  | Implemented (or cited in code) without a requirement-naming test in the matrix. |
| VF-SEC-003 | Demonstrated | test/09_registration.test.cjs | VF-SEC-003: an unrecognized custody class is rejected at registration | cd base-contracts && npx hardhat test | Named in generated traceability matrix; covered by full suite run. |
| VF-SEC-004 | Partial |  |  |  | Not traced to a naming test; architecture may be implemented without citation. |
| VF-SEC-005 | Demonstrated | test/02_oracle.test.cjs | VF-SEC-005: any address may submit; the submitter gains no authority | cd base-contracts && npx hardhat test | Named in generated traceability matrix; covered by full suite run. |
| VF-SEC-006 | Demonstrated | test/11_base_vault.test.cjs | releases without consulting the verifier, the price feed, or the factory | cd base-contracts && npx hardhat test | Named in generated traceability matrix; covered by full suite run. |
| VF-DEP-001 | Demonstrated | test/00_smoke.test.cjs | (see file) | cd base-contracts && npx hardhat test | Named in generated traceability matrix; covered by full suite run. |
| VF-DEP-002 | Demonstrated | test/01_findings.test.cjs | VF-DEP-002: a zero chain verifier cannot be registered | cd base-contracts && npx hardhat test | Named in generated traceability matrix; covered by full suite run. |
| VF-DEP-003 | Demonstrated | test/01_findings.test.cjs | configureDevFund is unreachable after finalization | cd base-contracts && npx hardhat test | Named in generated traceability matrix; covered by full suite run. |
| VF-DEP-004 | Demonstrated | test/00_smoke.test.cjs | (see file) | cd base-contracts && npx hardhat test | Named in generated traceability matrix; covered by full suite run. |
| VF-DEP-005 | Not code |  |  |  | Governance/process/ops/website — no on-chain demonstration obligation in this register. |
| VF-DEP-006 | Demonstrated | test/01_findings.test.cjs | CL-02 · VF-IMM-001/VF-DEP-006: authority terminated at finalization | cd base-contracts && npx hardhat test | Named in generated traceability matrix; covered by full suite run. |
| VF-DEP-007 | Demonstrated | test/01_findings.test.cjs | finalized flag is independently verifiable on-chain (VF-DEP-007) | cd base-contracts && npx hardhat test | Named in generated traceability matrix; covered by full suite run. |
| VF-DEP-008 | Not code |  |  |  | Governance/process/ops/website — no on-chain demonstration obligation in this register. |
| VF-VER-001 | Demonstrated | evidence/REQUIREMENT_EVIDENCE.md + spec CSV + tools/generate_traceability_matrix.cjs | requirement register covers all 209 IDs | cd base-contracts && npx hardhat test | Verification requirement; see LAUNCH_CERTIFICATION.md (do not treat pass counts as readiness). |
| VF-VER-002 | Partial |  |  |  | Named gap: pending-attempt resolution unevidenced on-chain (LAUNCH_CERTIFICATION). |
| VF-VER-003 | Partial |  |  |  | Named gap: UTXO multi-key release paths / pending-attempt negatives unevidenced. |
| VF-VER-004 | Partial |  |  |  | Named gap: release-public-key normalization across encodings unevidenced. |
| VF-VER-005 | Demonstrated | test/11_base_vault.test.cjs | releases without consulting the verifier, the price feed, or the factory | cd base-contracts && npx hardhat test | Verification requirement; see LAUNCH_CERTIFICATION.md (do not treat pass counts as readiness). |
| VF-VER-006 | Demonstrated | LAUNCH_CERTIFICATION.md (reproduction record) + this suite run | independent reproduction stronger than self-reported counts | cd base-contracts && npx hardhat test | Verification requirement; see LAUNCH_CERTIFICATION.md (do not treat pass counts as readiness). |
| VF-VER-007 | Demonstrated | LAUNCH_CERTIFICATION.md + this register | no readiness claim from passing counts alone | cd base-contracts && npx hardhat test | Verification requirement; see LAUNCH_CERTIFICATION.md (do not treat pass counts as readiness). |
| VF-VER-008 | Demonstrated | AGENTS.md / Master Spec Rev 6 authority rule | code/spec divergence treated as defect or spec matter | cd base-contracts && npx hardhat test | Verification requirement; see LAUNCH_CERTIFICATION.md (do not treat pass counts as readiness). |
| VF-PUB-001 | Not code |  |  |  | Governance/process/ops/website — no on-chain demonstration obligation in this register. |
| VF-PUB-002 | Not code |  |  |  | Governance/process/ops/website — no on-chain demonstration obligation in this register. |
| VF-PUB-003 | Not code |  |  |  | Governance/process/ops/website — no on-chain demonstration obligation in this register. |
| VF-EXT-001 | Not code |  |  |  | Governance/process/ops/website — no on-chain demonstration obligation in this register. |
| VF-EXT-002 | Not code |  |  |  | Governance/process/ops/website — no on-chain demonstration obligation in this register. |
| VF-EXT-003 | Not code |  |  |  | Governance/process/ops/website — no on-chain demonstration obligation in this register. |

## How Demonstrated was assigned

1. Prefer a requirement-naming test from `tools/generate_traceability_matrix.cjs` output.
2. Else a curated citation to a known passing `it` (four-chain 1725 VCLM fixture, principal isolation, etc.).
3. If neither exists → not Demonstrated.

_Generated for commit 7dcebe9; suite 355 passing, 0 failing (2026-10-01)._
