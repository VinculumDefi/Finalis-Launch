# Base44 app: hide cbETH on Base (operator decision 2026-10-24)

This file is instructions only. Nothing was changed in the live Base44 app. The operator applies the prompt below to the live Base44 project.

## Decision

cbETH on Base (Revision B row 25, symbol CBETH) is hidden at the app level only. It must never be shown or offered as a lock option. Reason: hidden by operator decision 2026-10-24 pending a Chainlink label-match fix (HH-013) or a decision to drop it permanently.

This is not a contract change. Do not change Revision B, its hash lock, the registry pin, the Verifier, the price poster or src/data/activeAssetAllowlist.json.

## What the live app shows

- Before the change: "485 offered of 962 in registry; 477 hidden"
- After the change: "484 offered of 962 in registry; 478 hidden"

## Paste-ready Base44 prompt

Copy everything between the two lines below and paste it into the live Base44 project.

---

Hide one asset from the app. Change nothing else.

Asset to hide:
- network: Base
- address: 0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0dec22
- symbol: CBETH

Rules:
1. Match by network plus lowercase address. Never match by ticker or symbol alone. Compare the address in lowercase.
2. Apply the hide on every path: the asset list, search, every asset picker, a token address typed in by hand, values from the URL or from saved state, lock preflight, and proof packages.
3. If cbETH reaches the app by any of those paths, refuse it with exactly this message: "This asset is not available."
4. Do not change any other asset, label, price, count rule or page.

Expected status line after the change: "484 offered of 962 in registry; 478 hidden"

After the change, search for cbETH and for CBETH. Nothing should appear.

---

## Check after applying

1. The status line reads "484 offered of 962 in registry; 478 hidden". Before the change it read "485 offered of 962 in registry; 477 hidden".
2. Searching cbETH or CBETH shows nothing.
3. Typing or pasting the cbETH address above, or opening a URL or saved state that names it, shows "This asset is not available."
4. No other asset changes.

## Reference copy in the repo

The same filter is in the repo on main of VinculumDefi/Finalis-Launch, for reference:
- src/lib/vfActiveAssetAllowlist.js has a HIDDEN_ASSETS list with this one entry (network Base, row 25, finding HH-013).
- src/tests/hidden-assets-cbeth.test.js checks that cbETH is never offered on any path and that the other allowlisted assets are unaffected.

The operator does not need to edit any file. The paste-ready prompt above is enough.

## To undo

Remove the cbETH entry once HH-013 is fixed, or drop the row in a future registry revision if the operator decides to drop it permanently.
