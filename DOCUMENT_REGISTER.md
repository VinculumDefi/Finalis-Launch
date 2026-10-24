# Document register

Revision 7, 2026-10-24 (ET). This register is the single source of truth for
which edition of each controlled document governs. One live copy per document.
Superseded editions are in `archive/specifications/`. Nothing is deleted.

## Current editions

| Document | Current revision | Date | Path | Status |
|---|---|---|---|---|
| Master Specification | Revision 18 | 2026-10-24 | `docs/Vinculum_Finalis_Master_Specification_Revision_18_2026-10-24.md` | CURRENT GOVERNING EDITION. SHA-256 `487735227ea32aa6914d180d5aa8fd0ef5028e56a5ab4c328a63168072ca44bc` |
| Asset registry | Revision C | 2026-10-24 | `base-contracts/deployment/assetRegistry.revC.json` | Registry written for the deployment under Master Specification Revision 18 (Appendix C, Appendix E item E-9). SHA-256 `5c3311eb4f7b59c34e7ccc8a6bd9e817b4f0bb02bdeff65c5cfed98f79cca581`. Full copy of Revision B with row 454 USDC_BASE class 3 to 1. Not read by the live path (`scripts/registryFile.cjs` reads Revision B). Revision B (`base-contracts/deployment/assetRegistry.revB.json`, 487 rows) stays pinned and unchanged, SHA-256 `1bdcb8346ab95abe5225adcffb9c5c3c7bb40c6cd5f1a851d3ed05bb2d77e2a9`. Operator t361u. |
| Session start | Revision 6 | 2026-10-24 | `VINCULUM_SESSION_START.md` | Current |
| Document register | Revision 7 | 2026-10-24 | `DOCUMENT_REGISTER.md` | Current (this file) |
| Specification archive index | Revision 7 | 2026-10-24 | `archive/specifications/README.md` | Current |

## Superseded editions kept in place

None. No file in the repository reads a superseded edition by path.

## Archived editions

| Document | Revision | Date | Archive path | Note |
|---|---|---|---|---|
| Master Specification | Revision 6 | 2026-07-28 | `archive/specifications/master-specification/Vinculum_Finalis_Master_Specification_Revision_6_2026-07-28.docx` | SHA-256 `5a9350618d81005d53b4d05628e7403e8c39fe63847a46576a5fadfbd4ef0bf9`. Copy of the file on branch redteam/prep. Text carried forward in Revision 14. |
| Master Specification | Revision 7 | 2026-10-03 | Not in the repository | Never committed. Not adopted. |
| Master Specification | Revision 8 | 2026-10-03 | `archive/specifications/master-specification/Vinculum_Finalis_Master_Specification_Revision_8_2026-10-03.docx` | Not adopted. Was at the repository root. |
| Revision 8 lock report | Revision 8 | 2026-10-03 | `archive/specifications/master-specification/LOCK_REPORT_REV8.md` | Not adopted. Was at the repository root. |
| Master Specification | Revision 9 | 2026-10-05 | `archive/specifications/master-specification/Vinculum_Finalis_Master_Specification_Revision_9_2026-10-05.docx` | Not adopted. Was at the repository root. |
| Master Specification | Revision 10 | 2026-10-06 | `archive/specifications/master-specification/Vinculum_Finalis_Master_Specification_Revision_10_2026-10-06.md` | Not adopted. Was in `docs/`. |
| Master Specification | Revision 11 | 2026-10-08 | `archive/specifications/master-specification/Vinculum_Finalis_Master_Specification_Revision_11_2026-10-08.md` | Expansion record. Copy of the file on branch redteam/prep. |
| Master Specification | Revision 12 | 2026-10-16 | `archive/specifications/master-specification/Vinculum_Finalis_Master_Specification_Revision_12_2026-10-16.md` | SHA-256 `5a393238b4b7907724fc777950745009a94562babba4cf4cd15f05e727d27aa5`. Superseded. Was in `docs/`. |
| Master Specification | Revision 13 | 2026-10-22 | `archive/specifications/master-specification/Vinculum_Finalis_Master_Specification_Revision_13_2026-10-22.md` | SHA-256 `80eb115171fc672fb19835a83f8394ff61bda1db1e44814d599844e6cdbce3b5`. Superseded. Was in `docs/`. |
| Master Specification | Revision 14 | 2026-10-24 | `archive/specifications/master-specification/Vinculum_Finalis_Master_Specification_Revision_14_2026-10-24.md` | SHA-256 `fe94333254009bfc5ac7cf7421e70af415cea107bc45224c7acfe50bd3f14777`. Superseded. Was in `docs/`. File kept as it was. |
| Master Specification | Revision 15 | 2026-10-24 | `archive/specifications/master-specification/Vinculum_Finalis_Master_Specification_Revision_15_2026-10-24.md` | SHA-256 `74080a46598c3664e24aa7b6a924b8aaf1316b3a18fac9a9be9b77b3ad3050fb`. Superseded by Revision 16. Archived in the same commit that added Revision 16. |
| Master Specification | Revision 16 | 2026-10-24 | `archive/specifications/master-specification/Vinculum_Finalis_Master_Specification_Revision_16_2026-10-24.md` | SHA-256 `ae61bddd9e8a136b11607a6a4bfc13d479ef707b56e87d0a2987c5d7786ff72d`. Superseded by Revision 17. Archived in the same commit that added Revision 17. |
| Master Specification | Revision 17 | 2026-10-24 | `archive/specifications/master-specification/Vinculum_Finalis_Master_Specification_Revision_17_2026-10-24.md` | SHA-256 `3b45aeeb25881c7f2465b2bf78400bfd94626df9fe0e3456d72cbe9e1452dace`. Superseded by Revision 18. Archived in the same commit that added Revision 18. |
| Revision 7 candidate items | Candidate | 2026-08-06 (committed) | `archive/specifications/revision-7-candidates/REVISION_7_CANDIDATE_ITEMS.md` | Not adopted. Was in `src/`. |
| Revision 7 candidate review | Candidate | 2026-08-06 (committed) | `archive/specifications/revision-7-candidates/REVISION_7_CANDIDATE_ITEMS_REVIEW.md` | Not adopted. Was in `src/`. |
| Session start | Revision 1 | 2026-10-12 | `archive/specifications/session-start/VINCULUM_SESSION_START_Revision_1_2026-10-12.md` | From commit 31c237a. |
| Session start | Revision 2 | 2026-10-20 | `archive/specifications/session-start/VINCULUM_SESSION_START_Revision_2_2026-10-20.md` | From commit a989ee2. |
| Session start | Revision 3 | 2026-10-24 | `archive/specifications/session-start/VINCULUM_SESSION_START_Revision_3_2026-10-24.md` | SHA-256 `8c63b5c82941695ecae74a6aea976a4fb13018b7f0d0f10536146181cbca70ef`. |
| Session start | Revision 4 | 2026-10-24 | `archive/specifications/session-start/VINCULUM_SESSION_START_Revision_4_2026-10-24.md` | SHA-256 `33e5dae3cd31fc775f8812cc48977b065e5cd86f749fcba256575133ec68e3bf`. |
| Session start | Revision 5 | 2026-10-24 | `archive/specifications/session-start/VINCULUM_SESSION_START_Revision_5_2026-10-24.md` | SHA-256 `805fd87e51cb03a63a4278b5396107da4279133bbb3775e210b7dc5b9ab0b242`. |
| Document register | Revision 1 | 2026-10-24 | `archive/specifications/document-register/DOCUMENT_REGISTER_Revision_1_2026-10-24.md` | SHA-256 `4941b6c9c10d976ba7575d92973641bebb9a593697e37741b3c4d18ea1e822c1`. |
| Document register | Revision 2 | 2026-10-24 | `archive/specifications/document-register/DOCUMENT_REGISTER_Revision_2_2026-10-24.md` | SHA-256 `5eeccf0791992b93e263330f210a81b4d2f900e086ae4c7eac65dc3f31abb279`. |
| Document register | Revision 3 | 2026-10-24 | `archive/specifications/document-register/DOCUMENT_REGISTER_Revision_3_2026-10-24.md` | SHA-256 `030a2eec6772f304c5a1e6513aea1cf9628dd6e4e3fcb7cf8fe216924ae0a79f`. |
| Document register | Revision 4 | 2026-10-24 | `archive/specifications/document-register/DOCUMENT_REGISTER_Revision_4_2026-10-24.md` | SHA-256 `b6f42ae04fc110336a0bb65503de4269d7af650c8e5aba3d1eb96dd7131d7a42`. |
| Document register | Revision 5 | 2026-10-24 | `archive/specifications/document-register/DOCUMENT_REGISTER_Revision_5_2026-10-24.md` | SHA-256 `8c8bfc90f5389f520b61a70136c9de7c66cd9ebedc4ae79212959bdc9002d676`. |
| Document register | Revision 6 | 2026-10-24 | `archive/specifications/document-register/DOCUMENT_REGISTER_Revision_6_2026-10-24.md` | SHA-256 `6ba5e70994d9775b85783e15aefe9eb43f9c5d98f48755143ebab3be47d71ab1`. |

## Files that name the Revision 6 file

These files name the Revision 6 docx by its uploaded file name (prefixed
`227826f11_`) only. They do not open it, so the archive move does not affect
them. They are not changed by document control. Checked on main 2026-10-24.

- `src/lib/vfRevision6Authority.js` lines 3 and 13
- `src/lib/vfRegistryVerification.js` line 13
- `src/lib/vfXrplAuthority.js` line 3
- `src/pages/ComplianceDashboard.jsx` line 44
- `src/solana-vault/README.md` line 6
- `src/cosmos_hub_coda/` (three files) and `cosmos_hub_coda/` (three files)
- `Vinculum_Finalis_Architecture_Design.md` line 6
- Comments in `base-contracts/contracts/` (Token, Stake, Synth, Verifier and
  `test/StakeV1Reference.sol`) and `testing-rigs/smtchecker/harness/`
  (Token and Synth)

## Rules
- One live copy per document. It is the path in "Current editions".
- A new edition bumps the revision number, adds a history row in the document,
  and is recorded here.
- The superseded edition moves to `archive/specifications/`. Nothing is
  deleted.
- A file that code, a test or a script reads by path is not moved. It gets a
  superseded header and is listed under "Superseded editions kept in place".
