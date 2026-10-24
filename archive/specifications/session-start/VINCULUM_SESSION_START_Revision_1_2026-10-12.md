# Vinculum session start

You are starting a new Vinculum session. The document list below is the required reading. Download every file and extract the text yourself. Read it. Do not skim. Do not answer from memory, and do not say you have read a file unless the extracted text is in this chat.

Read the redteam/prep list first, in the order given. Confirm the Revision 6 hash before treating it as the governing spec. Then read the main-branch files. Revision 11 is an expansion record. It does not replace Revision 6.

The Base deployment is real. LAST_SESSION_STATE is stale on that point. Do not report the deployment as missing, and do not discard it because an older file says nothing was deployed.

Do not build, commit, or change a file until the operator asks. First state what you actually read, what the governing rule is, and what the current state is.

The operator is not a programmer. One step at a time. If a file is missing, list the folder. Do not invent the file.

## Required reading

Repo: https://github.com/VinculumDefi/Finalis-Launch

Two branches. Do not collapse them.

Branch redteam/prep, commit a7aa9824d3c32df8bacf0f0c53d25578a5f60543, is the orientation set. Read in this order:

0. 00_PROJECT_START_HERE.md
1. LAST_SESSION_STATE.md
2. PROJECT_EVIDENCE_INDEX.md
3. reviewers/Vinculum_Finalis_Session_Handoff_Brief_v2.md
4. standards/COMPONENT_IMPLEMENTATION_INVENTORY_v1.md
5. standards/BUILD_CLASSIFICATION_FROZEN_v1.md
6. reviewers/Vinculum_Finalis_Findings_Register_v16.md
7. reviewers/red-team/Wave_1/ and reviewers/red-team/Wave_2/
8. standards/VERIFIER_COMPLETION_STANDARD.md
9. docs/Vinculum_Finalis_Master_Specification_Revision_11_2026-10-08.md

Governing specification on that branch:

- spec/Vinculum_Finalis_Master_Specification_Revision_6_2026-07-28.docx
- Hash must be 5a9350618d81005d53b4d05628e7403e8c39fe63847a46576a5fadfbd4ef0bf9
- src/lib/vfRevision6Authority.js

Revision 6 governs. Revision 11 is an expansion record of what was built. It has not been reviewed by Claude or ChatGPT. It does not replace Revision 6. If a file is missing, list the folder. Do not invent it.

Branch main holds later files that are not on redteam/prep:

- Vinculum_Finalis_Master_Specification_Revision_8_2026-10-03.docx
- Vinculum_Finalis_Master_Specification_Revision_9_2026-10-05.docx
- docs/Vinculum_Finalis_Master_Specification_Revision_10_2026-10-06.md
- LOCK_REPORT_REV8.md

Read those after the orientation set. Do not treat 8, 9, or 10 as adopted until you have read them. LAST_SESSION_STATE says nothing was deployed. That file is stale. The Base deployment is real. Do not flush it.

## Working rules

- The operator is not a programmer. One step at a time. Whole files, not line edits.
- A lock issues one token, VCLM or activated CHONX, to the bound Base recipient after Base verification. Maturity returns principal only.
- Only the sixteen durations in Revision 6 Section 5.1 are permitted. Ten years is 8.0x.
- Handshake is one hour, $0.95 to $1.05, fee 2.50%. Allowance is three if the mechanism can remember an identity, one if it cannot.
- The last successful scheduled price stays usable until the next successful run. Do not treat a fresh price run as required to keep an already priced asset available. Fail closed. No substitute price. A lock already created keeps its creation price.
- Do not read full contract addresses back to the operator. Use the name, or the first few characters.
- Do not invent labels. Use the names in the specification and the repository.
- Do not build, commit, or change a file until the operator asks.

## Current state, 2026-10-12

Do not treat LAST_SESSION_STATE as current. Do not treat the old "custody without mint" note as the live app gap. That gap is closed for the saved app.

The Base ceremony finished. These are the live contracts:

- Lock, the one the reader is bound to: 0x968BFD5b580144b4398C10BB1E61bD8A6B1aC946
- Verifier: 0xb0670826b79e29cc6a1c216Eb396D383a54af47D
- VCLM: 0x655273f8f5d74f7D5b5C4E1B947AE4ed763Df305
- CHONX: 0x5C5587db545d7c2982e5001Df6e2b32c47dfea79
- Base reader: 0x1cBbb8C2B535dCe626f218aB06a3D181e82c679F

Do not deploy replacements. The verifier is finalized.

The registry file has 1,000 rows. The ceremony wrote the 961 rows that had decimals. It skipped 37 unresolved rows and 2 duplicate keys. Only native ETH under Base has a usable scheduled price. The other registered lines are written and have no last price, so they stay unavailable. That is not a pending deployment.

The saved app is on main at app/base44-lock-2026-10-12/, commit ad34aa8c8461bb26725880ca388871f2301e613a. It calls createNativeLock on the lock above. After the lock confirms, it reads lockRecord and calls recordFeeAndRac, then verifyAndMint, on the verifier above, with one package built from that record. A lock alone is not success.

Proven on 2026-10-12:

- Wallet 0x7c17… sent a Handshake to the lock. The app completed the fee call and the mint. 12.47542608 VCLM arrived in that wallet. A second mint from the same wallet brought the balance to 24.95085216 VCLM.
- The sixteen app durations match the sixteen exact second counts in the lock. The mint path is the same for every duration. Handshake is 2.50% and $0.95 to $1.05. Every other duration is 5.00% and at least $10.
- Wallet 0xe76f…55e4 has used 3 of 3 Handshakes. That limit cannot be reset. Wallet 0x7c17… has used 2 of 3.

The live verifier was built from main. It checks the recipient, the output token, and the amounts. It does not check that the package asset is the asset stored on the lock, and recordFeeAndRac does not require the lock to exist. Those fixes are on redteam/prep, not on what was deployed. Do not redeploy to chase that unless the operator asks.

Do not let a later edit replace the saved app without a check. If Base44 changes the live app, app/base44-lock-2026-10-12/ is the version that minted.
