# Specification archive

This folder holds superseded editions of the Vinculum specification documents.
Nothing here governs. Nothing here is deleted.

- The current edition of each document is the one listed in
  `DOCUMENT_REGISTER.md` at the repository root.
- The current governing specification is Revision 17:
  `docs/Vinculum_Finalis_Master_Specification_Revision_17_2026-10-24.md`.
  Its SHA-256 is recorded in `DOCUMENT_REGISTER.md`.
- Files are kept as they were. Moved files keep their git history
  (`git log --follow <path>`).

## Folders
- `master-specification/`: Master Specification Revisions 6, 8, 9, 10, 11,
  12, 13, 14, 15 and 16, and the Revision 8 lock report. Hashes are in
  `DOCUMENT_REGISTER.md`.
  - Revision 6 (`Vinculum_Finalis_Master_Specification_Revision_6_2026-07-28.docx`)
    SHA-256 `5a9350618d81005d53b4d05628e7403e8c39fe63847a46576a5fadfbd4ef0bf9`.
    Its text is carried forward in Revision 14 and every later revision.
  - Revisions 6 and 11 are copies of the files on branch redteam/prep, which is
    unchanged.
  - Revision 7 was never committed to this repository.
  - Revisions 12, 13, 14 and 15 moved here from `docs/` on 2026-10-24, in
    the same commit that added Revision 16. Revision 16 moved here in the
    same commit that added Revision 17.
- `revision-7-candidates/`: the Revision 7 candidate list and its review.
  Neither was adopted.
- `document-register/`: earlier editions of `DOCUMENT_REGISTER.md`.
- `session-start/`: earlier editions of `VINCULUM_SESSION_START.md`
  (Revision 1 of 2026-10-12, Revision 2 of 2026-10-20, and Revisions 3 and 4
  of 2026-10-24).

## Rules
- One live copy per document, listed in `DOCUMENT_REGISTER.md`.
- When a new edition is issued, the old one moves here and the revision number
  goes up.
- A file that code, a test or a script reads by path is not moved. It gets a
  superseded header instead.
