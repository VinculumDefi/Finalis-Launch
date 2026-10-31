# Document register

Revision 13, 2026-10-31 (ET). This register is the single source of truth for
which edition of each controlled document governs. One live copy per document.
Superseded editions are in `archive/specifications/`. Nothing is deleted.

## Current editions

| Document | Current revision | Date | Path | Status |
|---|---|---|---|---|
| Master Specification | Revision 20 | 2026-10-31 | `docs/Vinculum_Finalis_Master_Specification_Revision_20_2026-10-31.md` | CURRENT GOVERNING EDITION. SHA-256 `b55060fe1a99a0179e2551ddea6eb8015127f44b275d7d498b5a0da695c91cad` (wording amended in place under t974u-t976u; first published text was `41ef25cf3d70fcb29460aa69b117d751ab177bf43d96007e2e9d4548eb5f943e`). Full copy of Revision 19 (as amended t855u) with the price process on an operator-set schedule, once every 4 days at launch (VF-ORC-001), website refresh on the same schedule and the lock offer screen showing the price used and when it was posted (VF-ORC-017). No contract change. Operator t969u/t970u and t974u-t976u. |
| Master Specification, Appendix C table | Revision 19 | 2026-10-26 | `docs/APPENDIX_C_BASE_REGISTRY_REVISION_E_2026-10-26.csv` | Part of Appendix C of Revision 19, carried unchanged into Revision 20. 2,893 Base entries. SHA-256 `15a8d0a7be9142b8926645549ee8fbe09bad21a69dd5bc0cdeee6d9027dddc6c`. Derived from, and subordinate to, registry Revision E. |
| Asset registry | Revision E | 2026-10-26 | `base-contracts/deployment/assetRegistry.revE.json` | Registry for the Base-only launch under Master Specification Revision 19 (Appendix C). 2,893 Base entries: 1 S1, 1 S2, 2,891 S3. SHA-256 `af8a4fc62af5be7baf50e2fe164e23202de8e03f1f92103d27b490dcfb56e2e6`. Revision D (`assetRegistry.revD.json`) stays pinned and unchanged. |
| Asset registry | Revision C (historical) | 2026-10-24 | `base-contracts/deployment/assetRegistry.revC.json` | Historical record. Registry written for the deployment under Master Specification Revision 18 (Appendix C, Appendix E item E-9). SHA-256 `5c3311eb4f7b59c34e7ccc8a6bd9e817b4f0bb02bdeff65c5cfed98f79cca581`. Full copy of Revision B with row 454 USDC_BASE class 3 to 1. Not read by the live path (`scripts/registryFile.cjs` reads Revision B). Revision B (`base-contracts/deployment/assetRegistry.revB.json`, 487 rows) stays pinned and unchanged, SHA-256 `1bdcb8346ab95abe5225adcffb9c5c3c7bb40c6cd5f1a851d3ed05bb2d77e2a9`. Operator t361u. |
| Session start | Revision 11 | 2026-10-27 | `VINCULUM_SESSION_START.md` | Current. Names Master Specification Revision 19 as governing. |
| Document register | Revision 13 | 2026-10-31 | `DOCUMENT_REGISTER.md` | Current (this file) |
| Specification archive index | Revision 13 | 2026-10-31 | `archive/specifications/README.md` | Current |

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
| Master Specification | Revision 18 | 2026-10-24 | `archive/specifications/master-specification/Vinculum_Finalis_Master_Specification_Revision_18_2026-10-24.md` | SHA-256 `487735227ea32aa6914d180d5aa8fd0ef5028e56a5ab4c328a63168072ca44bc`. Superseded by Revision 19. Archived in the same commit that added Revision 19. |
| Master Specification | Revision 19 | 2026-10-27 (amended 2026-10-30, t855u) | `archive/specifications/master-specification/Vinculum_Finalis_Master_Specification_Revision_19_2026-10-27.md` | Superseded by Revision 20 (t970u). Archived in the same commit that added Revision 20, with one header line added ("ARCHIVED 2026-10-31, superseded by Revision 20 (t970u)."); the text below it is unchanged, SHA-256 of that text `251de0c1a30249191166334bccddb5e4efd121838325d2ce1fe701e7b98673b6` (t468u adoption text `0d2d56cb37dbf11d7986a731b305a14c418273c5786a4c0db8c5ee9b38aabcad`). |
| Revision 7 candidate items | Candidate | 2026-08-06 (committed) | `archive/specifications/revision-7-candidates/REVISION_7_CANDIDATE_ITEMS.md` | Not adopted. Was in `src/`. |
| Revision 7 candidate review | Candidate | 2026-08-06 (committed) | `archive/specifications/revision-7-candidates/REVISION_7_CANDIDATE_ITEMS_REVIEW.md` | Not adopted. Was in `src/`. |
| Session start | Revision 1 | 2026-10-12 | `archive/specifications/session-start/VINCULUM_SESSION_START_Revision_1_2026-10-12.md` | From commit 31c237a. |
| Session start | Revision 2 | 2026-10-20 | `archive/specifications/session-start/VINCULUM_SESSION_START_Revision_2_2026-10-20.md` | From commit a989ee2. |
| Session start | Revision 3 | 2026-10-24 | `archive/specifications/session-start/VINCULUM_SESSION_START_Revision_3_2026-10-24.md` | SHA-256 `8c63b5c82941695ecae74a6aea976a4fb13018b7f0d0f10536146181cbca70ef`. |
| Session start | Revision 4 | 2026-10-24 | `archive/specifications/session-start/VINCULUM_SESSION_START_Revision_4_2026-10-24.md` | SHA-256 `33e5dae3cd31fc775f8812cc48977b065e5cd86f749fcba256575133ec68e3bf`. |
| Session start | Revision 5 | 2026-10-24 | `archive/specifications/session-start/VINCULUM_SESSION_START_Revision_5_2026-10-24.md` | SHA-256 `805fd87e51cb03a63a4278b5396107da4279133bbb3775e210b7dc5b9ab0b242`. |
| Session start | Revision 6 | 2026-10-24 | `archive/specifications/session-start/VINCULUM_SESSION_START_Revision_6_2026-10-24.md` | SHA-256 `5d4867b138a05bc2cf6395a492cc5b71c0eedc4f1da229d1207f432cadc5b9cb`. |
| Session start | Revision 7 | 2026-10-25 | `archive/specifications/session-start/VINCULUM_SESSION_START_Revision_7_2026-10-25.md` | SHA-256 `c5f27f10c26cc5af631ab2f6465318de32ac2816a509c704c7be55d75ae751f0`. |
| Session start | Revision 8 | 2026-10-25 | `archive/specifications/session-start/VINCULUM_SESSION_START_Revision_8_2026-10-25.md` | SHA-256 `833817cf6954d91588a069362dc680ab6afa3cee4f87ca69653dfe3e31b84ad1`. |
| Session start | Revision 9 | 2026-10-27 | `archive/specifications/session-start/VINCULUM_SESSION_START_Revision_9_2026-10-27.md` | SHA-256 `ad2ea527ebbcefd27584188201b1f205527d11b85beea9fe2d4cf86e06e01f3a`. Superseded by Revision 10. |
| Session start | Revision 10 | 2026-10-27 | `archive/specifications/session-start/VINCULUM_SESSION_START_Revision_10_2026-10-27.md` | SHA-256 `87fb04c5ef0fa1ff894439c60ed040316075f1cdce3d9bfef2792012da07bc18`. Superseded by Revision 11. |
| Document register | Revision 1 | 2026-10-24 | `archive/specifications/document-register/DOCUMENT_REGISTER_Revision_1_2026-10-24.md` | SHA-256 `4941b6c9c10d976ba7575d92973641bebb9a593697e37741b3c4d18ea1e822c1`. |
| Document register | Revision 2 | 2026-10-24 | `archive/specifications/document-register/DOCUMENT_REGISTER_Revision_2_2026-10-24.md` | SHA-256 `5eeccf0791992b93e263330f210a81b4d2f900e086ae4c7eac65dc3f31abb279`. |
| Document register | Revision 3 | 2026-10-24 | `archive/specifications/document-register/DOCUMENT_REGISTER_Revision_3_2026-10-24.md` | SHA-256 `030a2eec6772f304c5a1e6513aea1cf9628dd6e4e3fcb7cf8fe216924ae0a79f`. |
| Document register | Revision 4 | 2026-10-24 | `archive/specifications/document-register/DOCUMENT_REGISTER_Revision_4_2026-10-24.md` | SHA-256 `b6f42ae04fc110336a0bb65503de4269d7af650c8e5aba3d1eb96dd7131d7a42`. |
| Document register | Revision 5 | 2026-10-24 | `archive/specifications/document-register/DOCUMENT_REGISTER_Revision_5_2026-10-24.md` | SHA-256 `8c8bfc90f5389f520b61a70136c9de7c66cd9ebedc4ae79212959bdc9002d676`. |
| Document register | Revision 6 | 2026-10-24 | `archive/specifications/document-register/DOCUMENT_REGISTER_Revision_6_2026-10-24.md` | SHA-256 `6ba5e70994d9775b85783e15aefe9eb43f9c5d98f48755143ebab3be47d71ab1`. |
| Document register | Revision 7 | 2026-10-24 | `archive/specifications/document-register/DOCUMENT_REGISTER_Revision_7_2026-10-24.md` | SHA-256 `b6defd47bd41ee611245c39a3ba5e6bc0e0eef2b280172d5e80c35089426c355`. |
| Document register | Revision 8 | 2026-10-25 | `archive/specifications/document-register/DOCUMENT_REGISTER_Revision_8_2026-10-25.md` | SHA-256 `f6ccfe9a17f0956c2d8e7cdfec6681227cfe45167397f98e46eca41be72aa499`. |
| Document register | Revision 9 | 2026-10-25 | `archive/specifications/document-register/DOCUMENT_REGISTER_Revision_9_2026-10-25.md` | SHA-256 `1999efbb298c640d8809a6f9aed17657c7ef85dc66e81ad8c89b05c1341aae9b`. |
| Document register | Revision 10 | 2026-10-27 | `archive/specifications/document-register/DOCUMENT_REGISTER_Revision_10_2026-10-27.md` | SHA-256 `783815c33135a402f8308b450aad2a8f0fad41cc2ba860192b287abea9edbf20`. |
| Document register | Revision 11 | 2026-10-27 | `archive/specifications/document-register/DOCUMENT_REGISTER_Revision_11_2026-10-27.md` | SHA-256 `eb13939eb8b0d0e7d809ac1a675cc752ceb9b3724c9c4fff7590472331f593cd`. |
| Document register | Revision 12 | 2026-10-27 (amended 2026-10-30) | `archive/specifications/document-register/DOCUMENT_REGISTER_Revision_12_2026-10-27.md` | SHA-256 `4de02384c83ba399c53f35c627adaa373ad02844a425429f9c6c19bd30f0e97f`. Superseded by Revision 13. |

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
