# Document register

Revision 1, 2026-10-24 (ET). This register is the single source of truth for
which edition of each controlled document governs. One live copy per document.
Superseded editions are in `archive/specifications/`. Nothing is deleted.

## Current editions

| Document | Current revision | Date | Path | Status |
|---|---|---|---|---|
| Master Specification | Revision 14 | 2026-10-24 | `docs/Vinculum_Finalis_Master_Specification_Revision_14_2026-10-24.md` | CURRENT GOVERNING EDITION |
| Session start | Revision 3 | 2026-10-24 | `VINCULUM_SESSION_START.md` | Current |
| Document register | Revision 1 | 2026-10-24 | `DOCUMENT_REGISTER.md` | Current (this file) |
| Specification archive index | Revision 1 | 2026-10-24 | `archive/specifications/README.md` | Current |

## Superseded editions kept in place

These files are superseded but stay at their paths because a file in the
repository names them by path. Each carries a superseded header.

| Document | Revision | Date | Path | Why it stays | Superseded by |
|---|---|---|---|---|---|
| Master Specification | Revision 12 | 2026-10-16 | `docs/Vinculum_Finalis_Master_Specification_Revision_12_2026-10-16.md` | Named at `testing-rigs/assumption-gap/assumptions.json:5` | Revision 14 |
| Master Specification | Revision 13 | 2026-10-22 | `docs/Vinculum_Finalis_Master_Specification_Revision_13_2026-10-22.md` | Named at `testing-rigs/assumption-gap/assumptions.json:6` | Revision 14 |

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
| Revision 7 candidate items | Candidate | 2026-08-06 (committed) | `archive/specifications/revision-7-candidates/REVISION_7_CANDIDATE_ITEMS.md` | Not adopted. Was in `src/`. |
| Revision 7 candidate review | Candidate | 2026-08-06 (committed) | `archive/specifications/revision-7-candidates/REVISION_7_CANDIDATE_ITEMS_REVIEW.md` | Not adopted. Was in `src/`. |
| Session start | Revision 1 | 2026-10-12 | `archive/specifications/session-start/VINCULUM_SESSION_START_Revision_1_2026-10-12.md` | From commit 31c237a. |
| Session start | Revision 2 | 2026-10-20 | `archive/specifications/session-start/VINCULUM_SESSION_START_Revision_2_2026-10-20.md` | From commit a989ee2. |

## Code that names the Revision 6 file

These files name the Revision 6 docx by its uploaded file name (prefixed `227826f11_`) only. They do not open it,
so the archive move does not affect them. They are code and are not changed
by document control.

- `src/lib/vfRevision6Authority.js` lines 3 and 13
- `src/lib/vfRegistryVerification.js` line 13
- `src/pages/ComplianceDashboard.jsx` line 44
- `src/lib/vfXrplAuthority.js` line 3

## Rules
- One live copy per document. It is the path in "Current editions".
- A new edition bumps the revision number, adds a history row in the document,
  and is recorded here.
- The superseded edition moves to `archive/specifications/`. Nothing is
  deleted.
- A file that code, a test or a script reads by path is not moved. It gets a
  superseded header and is listed under "Superseded editions kept in place".
