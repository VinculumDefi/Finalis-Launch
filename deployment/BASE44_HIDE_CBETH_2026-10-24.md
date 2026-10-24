# Base44 app: hide cbETH on Base (operator decision 2026-10-24)

This file is instructions only. Nothing was changed in the live Base44 app.

## Decision

cbETH on Base (Revision B row 25, symbol CBETH) is hidden at the app level only. It must never be shown or offered as a lock option. Reason: hidden by operator decision 2026-10-24 pending Chainlink label-match fix (HH-013) or permanent drop.

Do not change Revision B, its hash lock, the registry pin, the Verifier, the price poster or src/data/activeAssetAllowlist.json. The allowlist file still has 487 entries. The app offers 486 of them.

## What to change in the Base44 app

1. Copy src/lib/vfActiveAssetAllowlist.js from main of VinculumDefi/Finalis-Launch. It now has a small HIDDEN_ASSETS list with one entry:
   - network: Base
   - kind: token
   - address: the Base cbETH contract (0x2ae3...ec22, full value in the file)
   - row: 25
   - finding: HH-013
   - reason: hidden by operator decision 2026-10-24 pending Chainlink label-match fix (HH-013) or permanent drop
2. Hidden entries are left out of every lookup, so every path that already goes through the allowlist helpers hides cbETH: the asset pickers, a token address typed in by hand, values from the URL or saved state, lock preflight and proof packages. Match by network and address, never by ticker alone.
3. If the Base44 app builds its asset list some other way (for example from the hosted registry or from scheduledPrices), apply the same filter there: drop the record whose network is Base and whose address is the cbETH address above.
4. Copy src/tests/hidden-assets-cbeth.test.js from main and run it. Expected: 5 pass. It checks that cbETH is never offered on any path and that the other 486 allowlisted assets are unaffected.

## Expected result

- The Base lock options no longer include cbETH.
- Against the current hosted registry the count becomes 485 shown and 516 hidden (it was 486 and 515, see BASE44_APP_FIX_PROMPT.md).
- If the live Lock page still offers Base ETH only (BASE44_LIVE_CONFIG_2026-10-22.md), cbETH is not offered there today; the filter keeps it hidden when more Base assets are opened.
- No other asset changes.

## To undo

Remove the cbETH entry from HIDDEN_ASSETS once HH-013 is fixed, or remove the row from a future registry revision if the operator drops it permanently.
