# Specification archive

This folder holds superseded editions of the Vinculum specification documents.
Nothing here governs. Nothing here is deleted.

- The current edition of each document is the one listed in
  `DOCUMENT_REGISTER.md` at the repository root.
- The current governing specification is Revision 14:
  `docs/Vinculum_Finalis_Master_Specification_Revision_14_2026-10-24.md`.
- Files are kept as they were. Moved files keep their git history
  (`git log --follow <path>`).

## Folders
- `master-specification/`: Master Specification Revisions 6, 8, 9, 10 and 11,
  and the Revision 8 lock report.
  - Revision 6 (`Vinculum_Finalis_Master_Specification_Revision_6_2026-07-28.docx`)
    SHA-256 `5a9350618d81005d53b4d05628e7403e8c39fe63847a46576a5fadfbd4ef0bf9`.
    Its text is carried forward in Revision 14.
  - Revisions 6 and 11 are copies of the files on branch redteam/prep, which is
    unchanged.
  - Revision 7 was never committed to this repository.
  - Revisions 12 and 13 are not here. They stay in `docs/` because
    `testing-rigs/assumption-gap/assumptions.json` (lines 5 and 6) names their
    paths. Each carries a superseded header.
- `revision-7-candidates/`: the Revision 7 candidate list and its review.
  Neither was adopted.
- `session-start/`: earlier editions of `VINCULUM_SESSION_START.md`
  (Revision 1 of 2026-10-12 and Revision 2 of 2026-10-20).

## Rules
- One live copy per document, listed in `DOCUMENT_REGISTER.md`.
- When a new edition is issued, the old one moves here and the revision number
  goes up.
- A file that code, a test or a script reads by path is not moved. It gets a
  superseded header instead.
