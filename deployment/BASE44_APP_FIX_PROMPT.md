Make only the changes below to the Vinculum lock app. Change nothing else. Sections 1 to 4 are app changes only. Sections 7, 8, 9 and 11 are done together with section 6, after the Base ceremony. Section 10 (network fees) is an app change for every page, now: it adds a fee estimate, a balance check and the fee text before each send, including in the flows listed under "Leave these unchanged", and changes nothing else in them. Section 5 changes only what the existing fetchAssetPrice backend function returns. Section 6 is done only after the Base ceremony, when the operator gives you the values for it. Do not add or change any contract or deploy step, and do not add any other server function.

Leave these unchanged:
- the Base lock, mint and release flow: the lock call, fee recording, verifyAndMint, and the matching transfer check;
- the VCLM, CHONX, Synth/Forge, Stake, verifier and reader addresses (section 6 sets them after the ceremony);
- every contract ABI (section 6 changes the proof tuple, the Forge call and two unused lock ABI lines, after the ceremony);
- which networks, durations and pages are shown. Everything stays on. (Which tokens are shown changes only as described in section 4.)

1. Use the new 5% lock addresses (placeholders for now)
   The app must not point at any old 2.5% lock. Remove these two addresses from every file where they appear:
   - the address starting 0x4eDE54E1 (old non-Base lock)
   - the address starting 0x968BFD5b (old Base lock)
   In src/lib/protocolConfig.js, set each network's lock in the ENVIRONMENTS list to its own placeholder, written exactly as shown:
   - Base: NEW_BASE_LOCK_ADDRESS
   - Ethereum: NEW_ETHEREUM_LOCK_ADDRESS
   - Arbitrum: NEW_ARBITRUM_LOCK_ADDRESS
   - Optimism: NEW_OPTIMISM_LOCK_ADDRESS
   - Polygon: NEW_POLYGON_LOCK_ADDRESS
   - BNB Smart Chain: NEW_BNB_SMART_CHAIN_LOCK_ADDRESS
   - Avalanche: NEW_AVALANCHE_LOCK_ADDRESS
   Keep every placeholder as a plain string in that one file so it can be replaced later with the real address. Do not reuse one network's address for another.
   - While any placeholder is not yet a valid address, the Lock page must refuse to lock on that network. Show "Lock address not set for this network" and send nothing.
   - Where the Lock page checks the lock target against a single hard-coded address (the "Wrong lock target" check in src/pages/Lock.jsx), check it against the selected network's lock address instead. This includes Base.
   - The fee shown and charged is 5% for every duration, including the 1-hour Handshake. If the app shows 2.5% anywhere, change it to 5%.

2. Editable Base recipient
   In src/pages/Lock.jsx (about line 179), the lock call always uses the connected wallet (account) as the baseRecipient.
   - Add a "Base recipient" field on the Lock page. Prefill it with the connected wallet and let the user edit it.
   - Accept only a valid EVM address.
   - Pass the field's value as the baseRecipient argument instead of account.
   - Show the recipient on the review step before signing.
   - Keep every other argument exactly as it is.

3. XRP Ledger: submit the fee and the escrow together, in the same ledger
   An XRP Ledger lock is two transactions: the 5% fee Payment to the Dev Fund, and the EscrowCreate for the principal. Both carry the same binding hash (InvoiceID on the Payment, memo on both). The lock counts only if both succeed in the SAME validated ledger.
   - Sign both first, then submit them back to back with no wait in between. Give them consecutive Sequence numbers and the same LastLedgerSequence, set a few ledgers ahead.
   - After submitting, wait until both are validated. Check that both results are tesSUCCESS and that both have the same ledger_index.
   - If either one fails, or they land in different ledgers, tell the user plainly that this lock cannot be proven and will not mint. Do not show it as a successful lock.
   - Show the ledger index on the result screen.

4. Offer only assets on the active list (Revision B with on-chain verification)
   The app must offer an asset only if it is on the active asset list. Everything else is hidden. Do not delete anything from the hosted registry file; only hide.
   - Add the file src/data/activeAssetAllowlist.json. Copy it exactly from the repository VinculumDefi/Finalis-Launch, path src/data/activeAssetAllowlist.json, on main. It has 487 entries: 475 tokens and 12 native assets, plus 3 native links (Polygon POL, Arbitrum ETH, Optimism ETH). Do not edit it by hand.
   - Match a token by network + contract address, ignoring upper or lower case. Match a native asset by network + native id (for example native-BTC on Bitcoin). Never match by ticker or name alone.
   - When a record in the hosted registry has a row number, it must be the same row as the allowlist entry. Another row that uses the same address is hidden. (Example: row 152 "ACM" uses MKR's address; MKR row 32 is shown, row 152 is hidden.)
   - Network names in the hosted registry and the allowlist are the same, except where the app uses short names: XRPL means XRP Ledger, BNB means BNB Smart Chain, BitcoinCash means Bitcoin Cash, CosmosHub means Cosmos.
   - Hide every Solana asset.
   - Hide any asset that is not on the list. That includes Cosmos ATOM (row 479), BAR (row 77), TigerOG (row 138), LionOG (row 999) and FrogOG (row 1000).
   - Apply this in every place the app lets a user pick or enter an asset: every asset dropdown or list on the Lock page and any other page; a network picker whose lock uses that network's native coin (hide Solana and Cosmos Hub); any asset or token address typed in by hand; any asset read from the URL, from saved state, or from browser storage; and any proof or lock record the app is asked to process. If a value from any of these is not on the list, refuse it and show "This asset is not on the active asset list", and send nothing.
   - Do not pick a default asset that is not on the list. If the current default is not on the list, start with no asset selected.
   - Show the count, for example "486 offered of 1001 in registry; 515 hidden". (Base ETH is on the list but has no record in the hosted registry, so 486 of the 487 entries appear in the hosted list.)
   - Expected result against the current hosted registry: 486 shown and 515 hidden. Of the hidden: 78 Solana, 384 tokens not on the list, 48 extra rows on an address that is shown under another row, 3 natives not on the list (Cosmos ATOM, and the two Avalanche rows using the zero address, 398 AVAX_MEME and 433 AVAX_NATIVE), and 2 rows with a malformed address (978 APT and 989 HBAR).
   - Tests to add: Ethereum USDC (row 1) is shown; BAR (row 77), TigerOG (row 138), a Solana asset and a ticker-only match (the symbol USDC with no address, or with another token's address) are hidden; the natives BTC, ETH, XRP and XLM are shown; the list the app offers equals the allowlist file exactly.

5. Price function: return each price's own age (needed for the Bitcoin, Bitcoin Cash and Litecoin minimum lock)
   The app refuses a standard Bitcoin, Bitcoin Cash or Litecoin lock unless its gross is at least $20 (Bitcoin), $1 (Bitcoin Cash) or $1 (Litecoin), valued with a price that is under 24 hours old. Today the fetchAssetPrice function returns only "timestamp", which is the time of the fetch, not the age of the price. The app does not accept "timestamp" as a price age, so it refuses every one of those locks. Fix this in the function's response only.
   - Files: the fetchAssetPrice backend function (functions/fetchAssetPrice/entry.ts) and the price cascade it calls (shared/vfPriceCascade.ts). Change nothing else in them.
   - CoinGecko request: add include_last_updated_at=true to the existing simple/price request, next to ids and vs_currencies=usd. CoinGecko then returns, for each id, "usd" and "last_updated_at" (Unix seconds, UTC).
   - Response field: add a field named exactly price_as_of to the function's response. Its value is CoinGecko's last_updated_at for that id, copied as is: a JSON integer of Unix seconds (UTC). Not an ISO string, not milliseconds, not a quoted number.
     Example: { "usd": 82410, "source": "CoinGecko", "timestamp": "2026-10-20T15:35:44.000Z", "price_as_of": 1792510532 }
   - Keep "timestamp" exactly as it is now (the fetch time, ISO). Keep "usd", "source" and "error" exactly as they are now.
   - If CoinGecko does not return last_updated_at, or it is not a positive whole number, set price_as_of to null. Never fill it with the fetch time, the current time, or any other value.
   - Prices from DexScreener or the community-token override have no price age in this function: set price_as_of to null for them. (The app only needs price_as_of for Bitcoin, Bitcoin Cash and Litecoin, which are priced by CoinGecko ids bitcoin, bitcoin-cash and litecoin.)
   - When no price is found, return price_as_of: null with usd: null, as now.
   - Do not make the function decide freshness. The app checks that price_as_of is under 24 hours old (and not more than 5 minutes in the future) and refuses otherwise.
   - Tests to add: a CoinGecko answer with last_updated_at returns that same integer as price_as_of; a CoinGecko answer without it returns price_as_of null; a DexScreener price returns price_as_of null; "timestamp" is still present and unchanged in every case.
   - What the app reads (no app change needed): src/lib/vfUtxoMinimumLock.js priceAsOfSecs() reads price_as_of as an integer of Unix seconds (it also accepts last_updated_at, or an ISO string in price_as_of, but use the integer form above). src/pages/TokenLayer.jsx passes the function's response to priceAsOfSecs() and refuses the lock when it returns null.

6. After the Base ceremony: set the new contract addresses and the new mint ABI
   Do this section only after the operator says the Base ceremony is finalized. Sections 1 to 5 come first. The values below come from the file base44-values.json, which the operator makes with base-contracts/scripts/applyCeremonyAddresses.cjs (option --out). Each value in angle brackets, for example <VERIFIER>, means the "full" field of that name in that file. Copy each one exactly. Do not type an address by hand and do not take one from anywhere else.
   a) Lock addresses. In src/lib/protocolConfig.js, replace each placeholder from section 1 with its address:
      - NEW_BASE_LOCK_ADDRESS: <LOCKS.Base>
      - NEW_ETHEREUM_LOCK_ADDRESS: <LOCKS.Ethereum>
      - NEW_ARBITRUM_LOCK_ADDRESS: <LOCKS.Arbitrum>
      - NEW_OPTIMISM_LOCK_ADDRESS: <LOCKS.Optimism>
      - NEW_POLYGON_LOCK_ADDRESS: <LOCKS.Polygon>
      - NEW_BNB_SMART_CHAIN_LOCK_ADDRESS: <LOCKS.BNB Smart Chain>
      - NEW_AVALANCHE_LOCK_ADDRESS: <LOCKS.Avalanche>
      Two networks may have the same lock address. That is expected when the same wallet deployed them. Use exactly what the file says for each network.
   b) Base contracts. In src/lib/protocolConfig.js, set CONTRACTS to:
      - lock: <BASE_LOCK> (the same address as LOCKS.Base)
      - vclm: <VCLM>
      - chonx: <CHONX>
      - synth: <FORGE>
      - forge: <FORGE> (Forge is the Synth contract, as before)
      - verifier: <VERIFIER>
      - baseReader: <BASE_READER>
      - stake: <STAKE>
      The new Base lock is a BaseCommitmentVaultLock. Its createNativeLock, createErc20Lock, release and lockRecord calls are the same as the plain lock (same selectors, see g), so no Lock page call changes. The new Stake contract takes no launch time of its own: it reads the Verifier's launch time.
      Set LAUNCH_TIMESTAMP to <LAUNCH_TIMESTAMP> as a whole number (Unix seconds). It is the Verifier's protocolLaunchTimestamp.
   c) Remove every remaining hard-coded old address. Search all files for these and replace each use with the matching CONTRACTS field above:
      - 0xb0670826 (old Verifier) -> CONTRACTS.verifier
      - 0x655273f8 (old VCLM) -> CONTRACTS.vclm (in src/lib/lockMint.js both the token contract and the lower-case Transfer log check)
      - 0x5C5587db (old CHONX) -> CONTRACTS.chonx
      - 0x7A2c7787 (old Synth/Forge) -> CONTRACTS.synth or CONTRACTS.forge
      - 0xfa16a1cd (old Stake) -> CONTRACTS.stake
      - 0x1cBbb8C2 (old Base reader) -> CONTRACTS.baseReader
      - 0x968BFD5b (old Base lock) in src/lib/lockMint.js mintFromLock (the receipt.to check and the lock contract) -> CONTRACTS.lock
      Compare addresses ignoring upper or lower case.
   d) Mint ABI. The new Verifier's proof package has no handshakeIdentity field. In src/lib/mintConfig.js, in PROOF_TUPLE, delete exactly the text "string handshakeIdentity, " and change nothing else in that line. In src/lib/lockMint.js:
      - in mintFromLock, delete the line part handshakeIdentity: `(Base, ${record.creator})`, from the pkg object and keep every other field exactly as it is;
      - in readMintContext, change the two expected selectors: recordFeeAndRac from 0x489c7d2f to 0xf0f64b60, and verifyAndMint from 0x24816c7f to 0x8c24712a. Keep the check itself.
      The selector check stays as it is otherwise; both selectors were read from the new Verifier ABI (main 33f747b). The rest of this section lists every other ABI change. Do not change any ABI line not listed here.
   e) Old 2.5% locks are retired. The app never offers them for a new lock:
      - 0x968BFD5b… on Base and 0x4eDE54E1… on Ethereum, Arbitrum, Optimism, Polygon, BNB Smart Chain and Avalanche.
      - New locks use only the addresses in a).
      - Release of a lock that already exists on an old lock still works: on the Release page, a lock id the user owns on an old lock is released by calling release(lockId) on that old lock, from the recorded release destination, at or after maturity. Keep that path. If section 1 removed the old lock address from the Release page, add it back there for release only, in one constant named RETIRED_LOCKS in src/lib/protocolConfig.js, never in the Lock page. Show "Old 2.5% lock (retired): release only" next to such a lock.
      - A lock made on an old lock cannot be minted through the new Verifier. Do not offer mint for it.
   f) Checks after the change (on the live Base network, read only, no transaction):
      - The Lock page shows the Base lock as <BASE_LOCK short> and the fee as 5% for every duration.
      - readMintContext passes: the Verifier is finalized, chainVerifiers("Base") equals <BASE_READER>, the reader's vault() equals <BASE_LOCK>, vclmToken() and chonxToken() equal <VCLM> and <CHONX>, and Base ETH has a usable scheduled price.
      - Forge page: the button is disabled with the 100,000,000 CHONX message while isActivationThresholdReached() is false.
      - Lock page: entering <VCLM>, <CHONX> or <FORGE> as a token is refused with the VF-TOK-007 message and nothing is sent.
      - No file still contains 0x968BFD5b, 0x4eDE54E1, 0xb0670826, 0x655273f8, 0x5C5587db, 0x7A2c7787, 0xfa16a1cd or 0x1cBbb8C2, except the retired list in e) and the Release page's old-lock release path.
   g) Lock ABI (src/lib/protocolConfig.js, LOCK_ABI). Keep these three lines exactly; they match the new Base lock and the six new locks:
      - createNativeLock(bytes32,address,uint8,bytes32,bytes32,address,uint256,uint256), selector 0x7f22a052
      - createErc20Lock(bytes32,address,uint8,bytes32,bytes32,address,uint256,address,uint256,uint256), selector 0xa271dec9
      - release(bytes32), selector 0x67d42a8b
      Delete the two lines "function getLock(bytes32 lockId) view returns (...)" and "function nextLockId() view returns (uint256)". Neither function exists on the new locks (or the old ones), and no page calls them. If any code does call them, remove that call; lock details come from the LockCreated event and lockRecord, as now.
   h) VCLM, CHONX and SYNTH can never be locked (VF-TOK-007). The new Base lock refuses them on-chain with "VF-TOK-007: protocol token is not a lock input" before any fee or token moves, but the app must refuse first so the user never signs an approve or a lock for them:
      - In src/lib/protocolConfig.js add PROTOCOL_TOKENS = [CONTRACTS.vclm, CONTRACTS.chonx, CONTRACTS.synth] and a function isProtocolToken(address) that compares ignoring upper or lower case.
      - On the Lock page, and in every place listed in section 4 where a token can be picked or typed, refuse any token for which isProtocolToken is true, on every network. Show "VCLM, CHONX and SYNTH cannot be locked. They can be staked or forged." and send nothing (no approve, no lock).
      - Also refuse by ticker on Base: an asset whose symbol is VCLM, CHONX or SYNTH is never offered for a lock, even if its address is not one of the three.
      - If the lock call still reverts with a message containing "VF-TOK-007", show the same text.
   i) Forge (src/lib/protocolConfig.js FORGE_ABI and src/pages/Forge.jsx). The new Forge (VinculumFinalisSynth) has forge(uint256 count), selector 0xa94e834b. There is no forge() with no argument and no synthCap() function.
      - Replace FORGE_ABI with exactly:
        "function forge(uint256 count) returns (bool success)",
        "function totalSupply() view returns (uint256)",
        "function HARD_CAP() view returns (uint256)",
        "function synthActivated() view returns (bool)",
        "function isActivationThresholdReached() view returns (bool)"
      - In Forge.jsx change contract.forge() to contract.forge(1). Each forge(1) burns 1,000 VCLM and 10,000 CHONX from the user (by allowance, so the two approve calls to CONTRACTS.forge stay as they are) and mints 1 SYNTH.
      - Keep FORGE.synthCap at 10,000,000 (it equals HARD_CAP of 10,000,000 SYNTH). If the page reads the cap on-chain, read HARD_CAP().
      - Forging opens only when lifetime CHONX reaches 100,000,000 (VF-TOK-003). Read isActivationThresholdReached(); while it is false, disable the Forge button and show "Forge opens when 100,000,000 CHONX have been issued." Do not send forge while it is false.
   j) Stake (Treasury Reward Stake). Set CONTRACTS.stake in b). Section 8 adds the Stake page. The new Stake ABI is:
      - createPosition(uint8 token, uint256 amount, uint256 durationSecs) returns (uint256), selector 0x59f3d12c. token 0 = VCLM, 1 = CHONX, 2 = SYNTH; durationSecs 2592000, 5184000, 7776000 or 10368000 (30, 60, 90, 120 days); the user first approves Stake for the amount.
      - queueExtension(uint256 positionId, uint256 durationSecs), 0xdaa00eb7; applyExtensionIfMatured(uint256 positionId), 0x9bb1404b; withdrawPosition(uint256 positionId), 0x525c12ea.
      - Claims are per position: claimPosition(uint256 positionId, uint256 toEpoch) returns (uint256 amount), 0x06311c2f; claimPositions(uint256[] positionIds, uint256 toEpoch) returns (uint256 total), 0xde45ab84. Only the position's owner can claim. toEpoch must have ended its following epoch (toEpoch + 1) and every epoch the position earns in the range must be allocated; use toEpoch = getCurrentEpoch() - 2 after the operator has allocated it. A repeat claim of the same epochs is refused ("VFS: nothing to claim"). There is no claimVclm() and no claimableVclm(address) on the new Stake.
      - closeEpoch(uint256 epochN), 0xd16d9057; allocateEpoch(uint256 epochN), 0xea73ea0b. These are permissionless and are called by the operator, not by the app: closeEpoch(N) at or after launch + N x 10 days (epochs in order), allocateEpoch(N) at or after launch + (N+1) x 10 days, in epoch order: only N = lastAllocatedEpoch() + 1 is accepted (epoch 1 first). Launch is LAUNCH_TIMESTAMP.
      - Views: claimableVclm(uint256 positionId, uint256 toEpoch) 0x78807836, nextClaimEpoch(uint256 positionId) 0x2d06f309, epochTotalWeight(uint256 epochN) 0x4631aece, lastClosedEpoch() 0x2b23ee85, lastAllocatedEpoch() 0x70462f62, getCurrentEpoch() 0xb97dd9e2, launchTimestamp() 0x65cf7c9b, epochs(uint256) 0xc6b61e4c, positions(uint256) 0x99fbab88, stakeMultiplierBps(uint256) 0xd4d0ea82, epochWeight(uint256,uint256) 0xeadde31f (claimable amounts are shown from epochs and epochWeight, section 11; claimableVclm only as a short-range cross-check).
      - The old Stake's ABI is not used anywhere. The CHONX threshold shown anywhere in the app counts VCLM from locks and from staking rewards together (lifetime VCLM, Verifier lifetimeVclmIssued(), selector 0x7a197938).
   Tests to add: the pkg object built by mintFromLock has no handshakeIdentity key; the two selectors are 0xf0f64b60 and 0x8c24712a; a lock on 0x968BFD5b… or 0x4eDE54E1… is refused for a new lock and allowed for release; every CONTRACTS value is a valid address and none is an old address; LOCK_ABI has no getLock or nextLockId line and its three selectors are 0x7f22a052, 0xa271dec9 and 0x67d42a8b; FORGE_ABI's forge selector is 0xa94e834b and Forge.jsx calls forge(1); isProtocolToken is true for CONTRACTS.vclm, CONTRACTS.chonx and CONTRACTS.synth in any letter case and false for USDC; the Lock page refuses each of the three (and the tickers VCLM, CHONX, SYNTH on Base) before any approve.

7. CHONX as a lock output (after the Base ceremony, with section 6)
   Today the app can only request VCLM: src/lib/lockMint.js refuses any record whose outputToken is not 0, and the Lock page always passes 0 as outputToken. Rule VF-COM-025: CHONX must already be active when the lock is created; a later activation never makes an earlier CHONX lock eligible. The Verifier enforces this itself from trusted data: it compares the lock record's creation time (createdAt, read by the Base reader) with the recorded activation time chonxActivationTimestamp(), and mints CHONX for a Base lock only if createdAt is strictly later. For a lock on any other chain, createdAt must be at least 1 day (CHONX_SOURCE_CLOCK_MARGIN_SECS, 86,400 seconds) after chonxActivationTimestamp(), because other chains' clocks are not Base's; an earlier one is refused the same way and forever. A CHONX lock created before activation, or in the same block as activation, is refused with "VF-COM-025: lock created before CHONX activation", and stays refused forever (its principal can still be released at maturity). While CHONX is not active the mint is refused with "VF-COM-025: CHONX not activated". The package field chonxActivationReceipt stays in the tuple but is not read; the app sends "0x".
   a) Verifier ABI. Add these lines to VERIFIER_ABI in src/lib/mintConfig.js (selectors from the compiled Verifier with the VF-COM-025 fix):
      - "function chonxActivated() view returns (bool)", selector 0x8dae0c3c
      - "function chonxActivationTimestamp() view returns (uint256)", selector 0xf6e7ea65
      - "function lifetimeVclmIssued() view returns (uint256)", selector 0x7a197938
      - "function CHONX_ACTIVATION_THRESHOLD() view returns (uint256)", selector 0xffeae027 (10,000,000 VCLM, 18 decimals)
      - "function syncChonxActivation()", selector 0x609b7566
      - "function CHONX_SOURCE_CLOCK_MARGIN_SECS() view returns (uint256)", selector 0xc5defaeb (86,400 seconds)
      The mint calls stay exactly as in section 6 d): recordFeeAndRac 0xf0f64b60 and verifyAndMint 0x8c24712a, with the same proof tuple. Only selectedOutputToken changes for CHONX (it comes from the lock record); chonxActivationReceipt stays "0x".
   b) Output choice on the Lock page. Add an "Output" choice with two options, VCLM (default) and CHONX.
      - Read chonxActivated(), lifetimeVclmIssued() and CHONX_ACTIVATION_THRESHOLD() from CONTRACTS.verifier when the page loads and again right before sending the lock.
      - If chonxActivated() is false and lifetimeVclmIssued() is below the threshold: show CHONX but disabled, with "CHONX opens when 10,000,000 VCLM have been issued (now X)", X being lifetimeVclmIssued() with 18 decimals, rounded down to whole VCLM.
      - If chonxActivated() is false but lifetimeVclmIssued() is at or above the threshold (staking rewards can cross it): keep CHONX disabled and show a button "Record CHONX activation" that sends syncChonxActivation() to CONTRACTS.verifier. After it confirms, read chonxActivated() again; when it is true, enable CHONX. Show: "A CHONX lock counts only if it is created after activation is recorded."
      - Only when chonxActivated() is true is CHONX selectable. If it is selected and chonxActivated() is false at the re-read right before sending, stop with "CHONX is not active yet. No funds were locked." and send nothing.
      - On any chain other than Base, when CHONX is selected, read chonxActivationTimestamp() and CHONX_SOURCE_CLOCK_MARGIN_SECS(). Show: "On this chain a CHONX lock counts only if it is created at least 1 day after CHONX activation." If the current time is before chonxActivationTimestamp() + CHONX_SOURCE_CLOCK_MARGIN_SECS() at the re-read right before sending, stop with "On this chain CHONX locks open 1 day after activation, at T. No funds were locked." (T is that sum shown as a date and time) and send nothing.
      - Pass the choice as the outputToken argument of createNativeLock and createErc20Lock: 0 for VCLM, 1 for CHONX. No other argument changes.
   c) lockMint.js, mintFromLock:
      - Accept record.outputToken 0 or 1. Refuse anything else with "Confirmed lock record has an unknown output token."
      - For outputToken 1: read chonxActivationTimestamp() from CONTRACTS.verifier. It must be greater than 0 and less than record.createdAt for a Base lock. For a lock on any other chain, record.createdAt must be at least chonxActivationTimestamp() + CHONX_SOURCE_CLOCK_MARGIN_SECS(). If not, stop before sending anything with "CHONX was not active when this lock was created (VF-COM-025). It cannot mint CHONX. The locked funds can still be released at maturity."
      - chonxActivationReceipt stays "0x" for both outputs. Every other package field stays exactly as it is now. Build the package once and pass the same object to recordFeeAndRac and verifyAndMint, as now.
      - The arrival check: for outputToken 0 count Transfer logs from CONTRACTS.vclm, for outputToken 1 from CONTRACTS.chonx (from the zero address to record.baseRecipient). The success text and balance show the matching token name and contract.
   d) Errors. If verifyAndMint reverts with text containing "VF-COM-025: CHONX not activated", show "CHONX is not active yet. This lock cannot mint. Your funds remain locked and can be released at maturity." If it contains "VF-COM-025: lock created before CHONX activation", show "This lock was created before CHONX was active, so it can never mint CHONX. Your funds can be released at maturity." Do not retry either. Keep the existing VF-FEE-011 retry exactly as it is.
   e) Tests to add: with outputToken 1 the package has selectedOutputToken 1 and receipt "0x"; CHONX is disabled while chonxActivated() is false; a CHONX lock whose createdAt is not after chonxActivationTimestamp() is refused before any mint transaction; a non-Base CHONX lock created less than CHONX_SOURCE_CLOCK_MARGIN_SECS() after activation is refused before any mint transaction and one created at or after that margin is allowed; the arrival check reads the CHONX contract for outputToken 1. This exact package was proved on the real contracts on a test chain (repository test base-contracts/test/base44_app_chonx_output.test.cjs): a lock created before activation is refused before and after activation, a lock in the activation block is refused in either transaction order, and a lock created after activation mints CHONX to the Base recipient.

8. Stake page (Treasury Reward Stake), after the Base ceremony, with section 6
   Add a page "Stake" (route /stake, in the main menu) that uses CONTRACTS.stake on Base (chain id 8453) only. On any other network show "Switch to Base" and send nothing. While CONTRACTS.stake is not a valid address, show "Stake address not set" and send nothing.
   a) STAKE_ABI in src/lib/protocolConfig.js, exactly these lines (selectors from the compiled Stake with in-order allocation, t270u):
      - "function createPosition(uint8 token, uint256 amount, uint256 durationSecs) returns (uint256)" 0x59f3d12c
      - "function queueExtension(uint256 positionId, uint256 durationSecs)" 0xdaa00eb7
      - "function applyExtensionIfMatured(uint256 positionId)" 0x9bb1404b
      - "function withdrawPosition(uint256 positionId)" 0x525c12ea
      - "function claimPosition(uint256 positionId, uint256 toEpoch) returns (uint256 amount)" 0x06311c2f
      - "function claimPositions(uint256[] positionIds, uint256 toEpoch) returns (uint256 total)" 0xde45ab84
      - "function claimableVclm(uint256 positionId, uint256 toEpoch) view returns (uint256)" 0x78807836
      - "function nextClaimEpoch(uint256) view returns (uint256)" 0x2d06f309
      - "function positions(uint256) view returns (address owner, uint8 token, uint256 amount, uint256 durationSecs, uint256 startTimestamp, uint256 endTimestamp, uint32 multiplierBps, uint32 queuedExtensionBps, uint256 queuedExtensionSecs, bool withdrawn, uint256 activeSince, uint256 withdrawnAt)" 0x99fbab88
      - "function getPositionWeight(uint256 positionId) view returns (uint256)" 0x94a053ae
      - "function stakeMultiplierBps(uint256 durationSecs) pure returns (uint256)" 0xd4d0ea82
      - "function getCurrentEpoch() view returns (uint256)" 0xb97dd9e2
      - "function lastClosedEpoch() view returns (uint256)" 0x2b23ee85
      - "function lastAllocatedEpoch() view returns (uint256)" 0x70462f62
      - "function epochs(uint256) view returns (bool closed, bool allocated, uint256 rewardBasis, uint256 totalWeight, uint256 mintedVclm, uint256 closeTimestamp, uint256 allocateTimestamp)" 0xc6b61e4c
      - "function epochTotalWeight(uint256 epochN) view returns (uint256)" 0x4631aece
      - "function epochWeight(uint256 positionId, uint256 epochN) view returns (uint256)" 0xeadde31f
      - "function launchTimestamp() view returns (uint256)" 0x65cf7c9b
      - "function terminalState() view returns (bool)" 0x8815bd02
      - "function closeEpoch(uint256 epochN)" 0xd16d9057
      - "function allocateEpoch(uint256 epochN)" 0xea73ea0b
      - "event PositionCreated(uint256 indexed positionId, address indexed owner, uint8 token, uint256 amount, uint256 durationSecs)" topic 0xe41dab1d…
      - "event VclmClaimed(uint256 indexed positionId, address indexed owner, uint256 fromEpoch, uint256 toEpoch, uint256 amount)" topic 0xf7edd999…
      Tokens use the existing ERC20_ABI (balanceOf, allowance, approve, decimals, symbol).
   b) Stake form.
      - Token: VCLM (token 0, CONTRACTS.vclm), CHONX (token 1, CONTRACTS.chonx), SYNTH (token 2, CONTRACTS.synth). Token weight 1x, 2x, 4x (fixed in the contract; show as "1x", "2x", "4x").
      - Duration: 30, 60, 90, 120 days (durationSecs 2592000, 5184000, 7776000, 10368000). Show each duration's multiplier read from stakeMultiplierBps(durationSecs) divided by 10000, shown with two decimals: 1.00x, 1.40x, 1.75x, 2.10x. Never hard-code these numbers in the display; read them.
      - Amount: positive, at most the wallet balance. Show "Weight = amount x token multiplier x duration multiplier".
      - On submit: if allowance(account, CONTRACTS.stake) is below the amount, send approve(CONTRACTS.stake, amount) first and wait for it. Then send createPosition(token, amount, durationSecs). Read the new position id from the PositionCreated event in the receipt.
      - If terminalState() is true, disable the form and show "Stake is closed: the VCLM supply cap is reached. Staked tokens can be withdrawn now."
   c) My positions. Find the account's positions from PositionCreated logs on CONTRACTS.stake with topic owner = account (search from the Stake deployment block; page the log query in block ranges the RPC accepts). For each id read positions(id) and show: token, amount, current term (durationSecs and multiplierBps / 10000), start and scheduled end (endTimestamp, plus queuedExtensionSecs if a term is queued), weight (getPositionWeight), queued term if any, withdrawn or not, claimable VCLM (computed with exactClaimable from section 11 up to L; never with a single claimableVclm(id, L) read for display), next epoch to claim (nextClaimEpoch).
      - Extend: shown while now < endTimestamp, not withdrawn, no queued term, not terminal. Choose 30/60/90/120 days, send queueExtension(id, durationSecs). The new term starts at the current term's end.
      - Start queued term: shown when a term is queued and now >= endTimestamp. Sends applyExtensionIfMatured(id). Explain: "The queued term already counts from the end of the current term; this records it so another term can be queued."
      - Withdraw: shown when not withdrawn and either terminalState() is true or now >= the scheduled end (endTimestamp plus queuedExtensionSecs if queued). Sends withdrawPosition(id). Withdrawing does not remove claimable VCLM.
   d) Epochs and claims.
      - Show: current epoch getCurrentEpoch(), last closed epoch lastClosedEpoch(), last allocated epoch lastAllocatedEpoch(), and for the last few epochs epochs(N): closed, allocated, reward basis (USD, 18 decimals), minted VCLM, total weight. Epoch N runs from launchTimestamp() + (N-1) x 10 days to launchTimestamp() + N x 10 days.
      - The latest claimable epoch is L = min(getCurrentEpoch() - 2, lastAllocatedEpoch()). Epochs are allocated in order, so every epoch up to lastAllocatedEpoch() is allocated and final. If L < nextClaimEpoch(id), show "No allocated epoch to claim yet."
      - Claiming uses section 11 (batches of at most 8,000,000 gas). "Claim all" runs the section 11 planner over all the account's positions. "Claim" on one position runs the same planner with that one id. Advanced, optional: a "Claim up to epoch" field on one position (any value from nextClaimEpoch(id) to L) sends claimPosition(id, toEpoch) only if its eth_estimateGas is at most 8,000,000; otherwise show "This range is too long for one transaction. Use Claim, which splits it automatically." and send nothing. Note on the page: "Long histories are claimed in several transactions. Each one is confirmed in MetaMask."
      - Close and allocate are permissionless operator calls. Show two buttons for anyone, enabled only when the call can succeed: "Close epoch N" for N = lastClosedEpoch() + 1 when now >= launchTimestamp() + N x 10 days (closeEpoch(N)); "Allocate epoch N" only for N = lastAllocatedEpoch() + 1, enabled when epochs(N).closed is true and now >= launchTimestamp() + (N+1) x 10 days (allocateEpoch(N)). Never offer any other epoch: allocation is in strict epoch order.
   e) Error messages. Map each revert text (match the start of the reason) to this message and send nothing more:
      - "VF-STK-001: protocol not launched" -> "Staking opens when the Base ceremony is finalized."
      - "VF-STK-002: invalid token" -> "Only VCLM, CHONX or SYNTH can be staked."
      - "VF-STK-003: duration not permitted" -> "Choose 30, 60, 90 or 120 days."
      - "VF-STK-031: zero amount" -> "Enter an amount above zero."
      - "VF-STK-029: terminal state" -> "Stake is closed: the VCLM supply cap is reached."
      - "VF-STK-023: already queued" -> "A next term is already queued for this position."
      - "VF-STK-025: position not active" -> "This position's term has ended; it cannot be extended."
      - "VF-STK-008: epoch not ended" -> "This epoch has not ended yet."
      - "VF-STK-010: allocate in epoch order" -> "Allocate the earlier epoch first. Epochs are allocated in order."
      - "VF-STK-010: chronological order" or "VF-STK-010: epoch numbering begins at 1" -> "Close the earlier epoch first."
      - "VF-STK-013: wait for N+1 end" or "VF-STK-013: epoch not final" -> "This epoch is final only after the next epoch ends."
      - "VFS: already closed" -> "Already closed." ; "VFS: already allocated" -> "Already allocated." ; "VFS: not closed" -> "Close this epoch first."
      - "VFS: epoch not allocated" -> "An epoch in this range is not allocated yet. Choose an earlier last epoch."
      - "VFS: nothing to claim" -> "Already claimed up to this epoch."
      - "VFS: not owner" -> "Only the position owner can do this."
      - "VFS: withdrawn" -> "This position has been withdrawn."
      - "VFS: not matured" -> "This position is still in its term."
      - "VFS: no queued extension" -> "No next term is queued."
      - "VFS: unknown position" -> "Unknown position."
      - "VFS: received amount mismatch", "VFS: transfer failed", "VFS: return failed" -> "The token transfer did not complete. Nothing changed."
      - "VFT: insufficient allowance" or "SYNTH: insufficient allowance" -> "Approve the Stake contract for this amount first."
      - "VFT: insufficient balance" or "SYNTH: insufficient balance" -> "Not enough tokens in this wallet."
      - Anything else: show the reason text as it is.
   f) Tests to add: every STAKE_ABI selector equals the list above; the duration multipliers are read from stakeMultiplierBps; approve is sent before createPosition when the allowance is short and not otherwise; the latest claimable epoch is min(getCurrentEpoch() - 2, lastAllocatedEpoch()); the Allocate button offers only lastAllocatedEpoch() + 1 and is disabled until that epoch is closed and its following epoch has ended; each revert text above maps to its message; the page sends nothing on a network other than Base.

9. Lock USD bands must match the contracts (needed for every lock, with section 6)
   The app still uses the old bands: the 1-hour Handshake at $0.95 to $1.05 and a $10 minimum for every other duration (DURATIONS in src/lib/protocolConfig.js and the inRange check in src/pages/Lock.jsx). The new locks and Verifier use Revision 12: Handshake $0.01 to $0.02, every other duration at least $0.01 (lock constants HANDSHAKE_USD_MIN 0x0d10a241, HANDSHAKE_USD_MAX 0xb4fb6ac0, STANDARD_USD_MIN 0x4fe4b5e9; the lock refuses other values with "CVL: handshake usd" or "CVL: standard usd"). With the old bands a $1 Handshake is refused by the lock and a valid $0.015 Handshake is refused by the app.
   - Set the Handshake row to minUsd 0.01 and maxUsd 0.02, and every standard row to minUsd 0.01.
   - Set the Handshake row's feeRate from 0.025 to 0.05. The lock charges 5% on every duration including the Handshake (STANDARD_FEE_BPS 500, selector 0xbf224fcd); the app now shows 2.5% for the Handshake fee and principal, which is wrong.
   - In Lock.jsx compare the scheduled valuation with ethers.parseUnits("0.01", 18) and ethers.parseUnits("0.02", 18) for the Handshake, and with ethers.parseUnits("0.01", 18) for every other duration. Better: read the three constants from CONTRACTS.lock and compare with them.
   - Show "Handshake: $0.01 to $0.02" and "Minimum $0.01" in the duration list.
   - Tests to add: a $0.015 Handshake is in range, $0.009 and $0.021 are not; a $0.01 seven-day lock is in range, $0.009 is not; the Handshake fee shown is 5% of the amount.
   - Stablecoins (USDC and USDT rows on every chain: USDC and USDT on Ethereum, and USDC_ARB, USDT_ARB, USDC_OP, USDT_OP, USDC_POL, USDT_POL, USDC_BSC, USDT_BSC, USDC_AVAX, USDT_AVAX, USDTE and USDC_BASE). Never value them at a hardcoded $1. Use the last successful scheduled price, like every other asset. If that price is below $0.95, the asset is unavailable for every new lock at every duration (the Handshake and all standard durations) until a later successful run is at or above $0.95. Exactly $0.95 is allowed. Fail closed: no substitute price, no fallback to $1. Show "This stablecoin is below $0.95 and cannot be locked until a later price run is at or above $0.95." and do not send approve or the lock. A lock that already exists keeps the price it was created with; do not reprice it. The Verifier refuses a new valuation below $0.95 with "VF-ORC-005: USDC/USDT scheduled price below $0.95". DAI, USDS, USDe, CUSDC and other stablecoins are not covered by this rule.
   - Tests to add: USDC at $0.94 is refused for the Handshake and for a 30-day lock; USDC_OP at $0.94 is refused; USDT at exactly $0.95 is allowed; after a later run at $0.97 USDC is allowed again; no code path values USDC or USDT at $1 without a scheduled price; DAI at $0.94 is not refused by this rule.

10. Network fees (participants pay their own)
   Every participant pays their own network fee in ETH, from the wallet that sends the transaction. The protocol never pays, sponsors or refunds anyone's network fee, and never takes any fee in VCLM, CHONX or SYNTH for a transaction. Do not add any code that deducts a fee from rewards, mints, claims, stakes or withdrawals.
   a) Which transactions. Before EVERY transaction the app asks a participant to sign on Base (chain id 8453), run the steps in b) to h). This includes, with no exception: approve (any token, any spender), createNativeLock, createErc20Lock, release, recordFeeAndRac, verifyAndMint, syncChonxActivation, createPosition, queueExtension, applyExtensionIfMatured, withdrawPosition, claimPosition, claimPositions (every batch of section 11 separately), closeEpoch, allocateEpoch, forge, and any other contract call or ETH transfer the app sends. On the other EVM chains (Ethereum, Polygon, Optimism, Arbitrum, BNB Smart Chain, Avalanche) run the same steps for every lock, approve and release, without step d) (Base L1 data fee) and with the chain's own coin in place of ETH.
   Put the steps in one shared helper, src/lib/networkFee.js, exporting async function prepareAndConfirm({ provider, signer, tx, label }) that returns either { ok: false, message } (nothing sent) or { ok: true, gasLimit, estimate } (the caller then sends tx with that gasLimit). Every page uses this helper; no page sends a transaction without it.
   b) Build the exact transaction. tx = { from: the connected account, to, data (the encoded call with the exact arguments that will be sent), value (the ETH amount sent, 0n if none) }. Estimate exactly this object; never estimate a different call, a different amount or a different sender.
   c) Estimate gas. gas = await provider.estimateGas(tx) (eth_estimateGas). gasLimit = gas x 12 / 10, rounded up (20% headroom); send the transaction with this gasLimit.
      - If estimateGas reverts: decode the revert reason (ethers error.reason, or decode error.data as Error(string); if there is no reason, use "no reason given"). Map it to the page's message table where one exists (for example section 8 e)); otherwise show the reason text as it is. Show: "This transaction would fail: <message>. Nothing was sent." Do not open MetaMask and do not retry.
   d) Base L1 data fee (Base only). Call getL1FeeUpperBound(uint256 unsignedTxSize), selector 0xf1c7a58b, on the Base gas price oracle 0x420000000000000000000000000000000000000F, with unsignedTxSize = the byte length of tx.data + 100. If this call fails, use 0 and add "(Base L1 data fee not included)" after the fee line.
   e) Fee price and estimate. fee = await provider.getFeeData(). If fee.maxFeePerGas is not null, perGas = fee.maxFeePerGas (EIP-1559); otherwise perGas = BigInt(await provider.send("eth_gasPrice", [])). estimatedFee = gasLimit x perGas + l1Fee. This is an upper estimate; the fee actually charged is usually lower.
   f) Show the fee before MetaMask opens, in the same box as the action button:
      - "Estimated network fee: X ETH" where X is estimatedFee in ETH with up to 8 decimals (ethers.formatEther, trimmed). On other chains use that chain's coin symbol.
      - USD only from a fresh price: if the app's price service returned an ETH/USD price (for the other chains, that coin's USD price) read in the last 5 minutes, add " (about $Y)" with Y rounded to 2 decimals (to 4 decimals if under $0.01). If there is no such price, show no USD figure at all. Never use a fixed, cached-older-than-5-minutes or guessed price.
      - Always show, directly under it: "Estimate may change before execution. MetaMask shows the final fee."
      - Always show: "Network fees are paid in ETH by your wallet. No fee is taken from VCLM, CHONX or SYNTH."
   g) Balance check. balance = await provider.getBalance(account) (eth_getBalance). required = estimatedFee + tx.value. If balance < required: disable the submit button and show "Not enough ETH on Base for this transaction. Needed about R ETH (network fee F ETH plus amount V ETH). This wallet has B ETH. Add ETH on Base and try again." (on other chains, that chain's name and coin). Do not open MetaMask.
   h) Only then open MetaMask with tx and gasLimit. Run b) to g) again right before sending if more than 30 seconds passed since the last estimate or the user changed any input.
   i) Two-step actions (approve, then lock, stake or forge). Estimate and show the approve transaction first, with the line "A second transaction follows. Its network fee is shown before you sign it." After the approve confirms, run b) to h) for the second transaction (its estimate can only succeed after the approve).
   j) Close and allocate (Stake page, section 8 d)). Whoever presses "Close epoch N" or "Allocate epoch N" pays that transaction's ETH network fee. Show it exactly as in f) and g), plus: "You pay this network fee. Closing or allocating an epoch gives the caller no reward and no refund."
   k) Tests to add: prepareAndConfirm estimates the exact tx (same to, data, value, from); a reverting estimate returns ok false with the decoded reason and sends nothing; gasLimit is gas x 1.2 rounded up; with maxFeePerGas the fee is gasLimit x maxFeePerGas + l1Fee, without it gasLimit x eth_gasPrice + l1Fee; an oracle failure gives l1Fee 0 and the "(Base L1 data fee not included)" note; USD is hidden when the price is missing or older than 5 minutes; a balance below fee plus value blocks the send; every page's send path calls prepareAndConfirm (search the code for sendTransaction and contract writes outside the helper: none).

11. Claiming rewards in batches (Stake page, after the Base ceremony, with sections 6, 8 and 10)
   App change only. No contract change. A claim's gas grows with the number of epochs and positions it covers (about 79,000 gas for one epoch, then about 8,600 to 9,800 per further epoch; about 1,700 to 1,940 epochs fit Base's 16,777,216 per-transaction cap). "Claim all" therefore plans the claim as several transactions of at most 8,000,000 gas each.
   a) Add the file src/lib/vfClaimPlanner.js with exactly this content (it is the reference planner from the protocol repository, release/2026-10-21, file src/lib/vfClaimPlanner.js; it is tested there against the compiled Stake contract):

```js
// t276u: Stake claim planner (app level only; no contract change).
//
// Plans "Claim all" for a wallet's Stake positions as a series of
// transactions that each stay at or below MAX_CLAIM_GAS (8,000,000 by
// default, about half of Base's 16,777,216 per-transaction cap).
//
// Contract facts the planner relies on (VinculumFinalisStake, release/2026-10-21):
// - claimPosition(id, toEpoch) pays epochs nextClaimEpoch(id)..toEpoch and sets
//   nextClaimEpoch(id) = toEpoch + 1. It reverts "VFS: nothing to claim" when
//   toEpoch < nextClaimEpoch(id), "VF-STK-013: epoch not final" when toEpoch's
//   next epoch has not ended, and "VFS: epoch not allocated" when an epoch the
//   position earns in that range is not allocated.
// - claimPositions(ids, toEpoch) calls claimPosition for each id whose
//   nextClaimEpoch <= toEpoch and silently SKIPS the others (no revert).
// - Allocation is in strict epoch order, so every epoch up to
//   L = min(getCurrentEpoch() - 2, lastAllocatedEpoch()) is allocated and final.
// - A claim only moves nextClaimEpoch forward, so a stopped plan leaves the rest
//   claimable, and claiming a range again pays nothing (claimPosition reverts,
//   claimPositions skips).
//
// Every transaction is confirmed with eth_estimateGas (chain.estimateClaim)
// before it is offered; if the estimate is above the limit the batch is
// shrunk (half the positions, or half the epoch range for one position) and
// estimated again. The cost formula below is only used to size the first
// guess and for the "about N transactions" preview.
//
// Displayed amounts (t277u). claimableVclm(id, toEpoch) always starts at
// nextClaimEpoch(id) and its cost grows with the whole range, so it is NOT used
// for the total or the remaining amount. exactClaimable() computes the amount
// in the app, per epoch, from small public views, each epoch counted once:
//   sum over n = nextClaimEpoch(id) .. min(L, last eligible epoch) of
//   floor(epochs(n).mintedVclm x epochWeight(id, n) / epochs(n).totalWeight),
//   skipping epochs that minted nothing.
// This is the contract's _claimable sum: epochWeight(id, n) applies the same
// eligibility (activeSince, scheduled end incl. a queued term, withdrawal
// cutoff) and the multiplier in force at the epoch's start (incl. a queued
// term), with the same integer arithmetic. Reads go in groups of READ_GROUP
// epochs; each eth_call reads one epoch. claimableVclm(id, L) is read only as a
// cross-check when the range is at most CROSS_CHECK_MAX_EPOCHS; if it differs,
// the planner throws and no claim is offered.
//
// The planner talks to the chain through an adapter (see makeEthersStakeChain):
//   getCurrentEpoch(), lastAllocatedEpoch(), launchTimestamp(),
//   nextClaimEpoch(id), claimableVclm(id, toEpoch), position(id),
//   estimateClaim(tx) -> bigint gas (throws with the revert reason if it fails)
//   epochInfos(ns) -> [{ allocated, mintedVclm, totalWeight }] for epochs ns
//   epochWeights(id, ns) -> [bigint] epochWeight(id, n) for epochs ns
// A tx is { kind: 'one', ids: [id], toEpoch } for claimPosition(id, toEpoch)
// or { kind: 'many', ids, toEpoch } for claimPositions(ids, toEpoch).

export const MAX_CLAIM_GAS = 8_000_000n;
export const EPOCH_SECS = 864000n;
// Conservative sizing formula (measured on release/2026-10-21: one epoch
// about 79,200 gas, then 8,600 to 9,800 gas per extra epoch).
export const GAS_TX = 30_000n;
export const GAS_PER_POSITION = 60_000n;
export const GAS_PER_EPOCH = 11_000n;
const FORMULA_SHARE = 90n; // size the first guess at 90% of the limit
export const READ_GROUP = 500n; // epochs per group of reads
export const CROSS_CHECK_MAX_EPOCHS = 200n;

const big = (v) => (typeof v === 'bigint' ? v : BigInt(v));

// Last epoch N whose N+1 ends at or before T (0 if none). Same as the contract.
export function lastEligibleBy(T, t0) {
  T = big(T); t0 = big(t0);
  if (T < t0 + 2n * EPOCH_SECS) return 0n;
  return (T - t0) / EPOCH_SECS - 1n;
}

// Last epoch a position can earn in, from positions(id) and launchTimestamp().
export function lastEligibleEpoch(pos, t0) {
  const queued = big(pos.queuedExtensionBps ?? 0) > 0n ? big(pos.queuedExtensionSecs ?? 0) : 0n;
  let last = lastEligibleBy(big(pos.endTimestamp) + queued, t0);
  if (pos.withdrawn) {
    const w = lastEligibleBy(pos.withdrawnAt, t0);
    if (w < last) last = w;
  }
  return last;
}

export function latestClaimableEpoch(currentEpoch, lastAllocated) {
  const a = big(currentEpoch) - 2n;
  const b = big(lastAllocated);
  const L = a < b ? a : b;
  return L > 0n ? L : 0n;
}

export function formulaGas(spans) {
  let g = GAS_TX;
  for (const s of spans) g += GAS_PER_POSITION + GAS_PER_EPOCH * (s > 0n ? s : 0n);
  return g;
}

export function isUserRejection(e) {
  if (!e) return false;
  const codes = [e.code, e?.info?.error?.code, e?.error?.code, e?.data?.originalError?.code];
  if (codes.includes(4001) || codes.includes('ACTION_REJECTED')) return true;
  return /user (rejected|denied)/i.test(String(e.message || ''));
}

// Exact VCLM a position can claim for epochs from..toEpoch (from defaults to
// nextClaimEpoch(id)). toEpoch must be at most L. epochCache (a Map) shares
// epochs(n) reads between positions. Returns { amount, from, last, reads }.
export async function exactClaimable(chain, id, toEpoch, { t0, pos, from, epochCache = new Map(), group = READ_GROUP, crossCheck = true } = {}) {
  id = big(id);
  toEpoch = big(toEpoch);
  if (t0 === undefined) t0 = big(await chain.launchTimestamp());
  if (pos === undefined) pos = await chain.position(id);
  const start = from === undefined ? big(await chain.nextClaimEpoch(id)) : big(from);
  let last = lastEligibleEpoch(pos, t0);
  if (last > toEpoch) last = toEpoch;
  let amount = 0n;
  let reads = 0;
  for (let a = start; a <= last; a += big(group)) {
    const b = a + big(group) - 1n < last ? a + big(group) - 1n : last;
    const ns = [];
    for (let n = a; n <= b; n++) ns.push(n);
    const missing = ns.filter((n) => !epochCache.has(n));
    if (missing.length > 0) {
      const infos = await chain.epochInfos(missing);
      reads += missing.length;
      missing.forEach((n, i) => epochCache.set(n, infos[i]));
    }
    const paid = [];
    for (const n of ns) {
      const ep = epochCache.get(n);
      if (!ep.allocated) throw new Error(`Epoch ${n} is not allocated yet; claims stop at the last allocated epoch.`);
      if (big(ep.mintedVclm) > 0n) paid.push(n);
    }
    if (paid.length === 0) continue;
    const ws = await chain.epochWeights(id, paid);
    reads += paid.length;
    paid.forEach((n, i) => {
      const w = big(ws[i]);
      const ep = epochCache.get(n);
      if (w > 0n) amount += (big(ep.mintedVclm) * w) / big(ep.totalWeight);
    });
  }
  if (crossCheck && last >= start && last - start + 1n <= CROSS_CHECK_MAX_EPOCHS) {
    const v = big(await chain.claimableVclm(id, toEpoch));
    reads += 1;
    if (v !== amount) throw new Error(`Claim display check failed for position ${id}: app ${amount}, contract ${v}. No claim is offered.`);
  }
  return { amount, from: start, last, reads };
}

// Reads what the wallet can claim now. Positions with nothing to claim are left out.
export async function readClaimState(chain, ids) {
  const [cur, alloc, t0] = await Promise.all([chain.getCurrentEpoch(), chain.lastAllocatedEpoch(), chain.launchTimestamp()]);
  const L = latestClaimableEpoch(cur, alloc);
  const items = [];
  let total = 0n;
  let reads = 0;
  if (L === 0n) return { L, items, total, reads };
  const epochCache = new Map();
  for (const id of ids) {
    const from = big(await chain.nextClaimEpoch(id));
    if (from > L) continue; // claimed up to L already
    const pos = await chain.position(id);
    let last = lastEligibleEpoch(pos, t0);
    if (last > L) last = L;
    if (last < from) continue; // no earning epoch left in range
    const r = await exactClaimable(chain, id, L, { t0: big(t0), pos, from, epochCache });
    reads += r.reads;
    if (r.amount === 0n) continue; // nothing to pay: leave it out
    items.push({ id: big(id), from, last, amount: r.amount });
    total += r.amount;
  }
  return { L, items, total, reads };
}

// First guess from the formula: as many whole positions as fit (one claimPositions
// call, toEpoch L), or for a single long history, a prefix of its epoch range.
function firstGuess(state, budget) {
  const { L, items } = state;
  const sorted = [...items].sort((a, b) => (a.last - a.from < b.last - b.from ? -1 : a.last - a.from > b.last - b.from ? 1 : 0));
  const group = [];
  for (const it of sorted) {
    const spans = [...group, it].map((g) => g.last - g.from + 1n);
    if (formulaGas(spans) <= budget) group.push(it);
    else break;
  }
  if (group.length > 1) return { kind: 'many', ids: group.map((g) => g.id), toEpoch: L, items: group };
  if (group.length === 1) return { kind: 'one', ids: [group[0].id], toEpoch: L, items: group };
  // the shortest history alone is over budget: claim part of its range
  const it = sorted[0];
  let n = (budget - GAS_TX - GAS_PER_POSITION) / GAS_PER_EPOCH;
  if (n < 1n) n = 1n;
  const to = it.from + n - 1n < it.last ? it.from + n - 1n : L;
  return { kind: 'one', ids: [it.id], toEpoch: to, items: [it] };
}

async function amountOf(chain, tx, items) {
  if (tx.kind === 'one') return (await exactClaimable(chain, tx.ids[0], tx.toEpoch)).amount;
  let s = 0n;
  for (const it of items) if (tx.ids.includes(it.id)) s += it.amount;
  return s;
}

// The next transaction to send, confirmed by eth_estimateGas at or below maxGas.
// Returns null when there is nothing to claim.
export async function planNextClaim(chain, ids, { maxGas = MAX_CLAIM_GAS } = {}) {
  const state = await readClaimState(chain, ids);
  if (state.items.length === 0) return null;
  const budget = (big(maxGas) * FORMULA_SHARE) / 100n;
  let g = firstGuess(state, budget);
  let tx = { kind: g.kind, ids: g.ids, toEpoch: g.toEpoch };
  let items = g.items;
  const estimates = [];
  for (;;) {
    const gas = big(await chain.estimateClaim(tx));
    estimates.push({ ...tx, gas });
    if (gas <= big(maxGas)) {
      const amount = await amountOf(chain, tx, items);
      return { tx, gas, amount, L: state.L, totalClaimable: state.total, estimates };
    }
    if (tx.ids.length > 1) {
      const keep = tx.ids.slice(0, Math.ceil(tx.ids.length / 2));
      items = items.filter((it) => keep.includes(it.id));
      tx = keep.length === 1 ? { kind: 'one', ids: keep, toEpoch: state.L } : { kind: 'many', ids: keep, toEpoch: state.L };
      continue;
    }
    const it = items[0];
    if (tx.toEpoch <= it.from) throw new Error(`One epoch of position ${it.id} needs ${gas} gas, above the ${maxGas} limit`);
    const end = tx.toEpoch > it.last ? it.last : tx.toEpoch;
    tx = { kind: 'one', ids: [it.id], toEpoch: it.from + (end - it.from) / 2n };
  }
}

// Formula-only preview for the "Claim all" box: total, about how many
// transactions, and a gas estimate for each. Each real transaction is still
// confirmed with eth_estimateGas before it is offered.
export async function previewClaimAll(chain, ids, { maxGas = MAX_CLAIM_GAS } = {}) {
  const state = await readClaimState(chain, ids);
  const budget = (big(maxGas) * FORMULA_SHARE) / 100n;
  let rest = state.items.map((it) => ({ ...it }));
  const txs = [];
  while (rest.length > 0) {
    const g = firstGuess({ L: state.L, items: rest }, budget);
    const spans = g.items.map((it) => (g.toEpoch < it.last ? g.toEpoch : it.last) - it.from + 1n);
    txs.push({ kind: g.kind, ids: g.ids, toEpoch: g.toEpoch, gas: formulaGas(spans) });
    if (g.kind === 'one' && g.toEpoch < g.items[0].last) {
      rest = rest.map((it) => (it.id === g.ids[0] ? { ...it, from: g.toEpoch + 1n } : it));
    } else {
      rest = rest.filter((it) => !g.ids.includes(it.id));
    }
  }
  return { L: state.L, total: state.total, positions: state.items.length, txCount: txs.length, txs };
}

// Remaining claimable for display, or null if it cannot be computed (for
// example a failed cross-check); null means "do not show an amount".
async function safeRemaining(chain, ids) {
  try { return (await readClaimState(chain, ids)).total; } catch { return null; }
}

// Runs the plan. send({ tx, gas, amount, index, total }) must run the section 10
// fee check, open the wallet and resolve with the receipt after it is mined
// (throw on rejection or failure). After each mined transaction the state is
// read again from the chain and the rest is planned again.
export async function runClaimAll(chain, ids, { maxGas = MAX_CLAIM_GAS, send, onProgress } = {}) {
  const done = [];
  for (;;) {
    let next;
    try {
      next = await planNextClaim(chain, ids, { maxGas });
    } catch (error) {
      return { status: 'error', error, done, remaining: await safeRemaining(chain, ids) };
    }
    if (!next) return { status: 'complete', done, remaining: 0n };
    const preview = await previewClaimAll(chain, ids, { maxGas });
    const info = { ...next, index: done.length + 1, total: done.length + Math.max(1, preview.txCount), remainingBefore: next.totalClaimable };
    if (onProgress) await onProgress({ stage: 'before', ...info });
    let receipt;
    try {
      receipt = await send(info);
    } catch (error) {
      const total = await safeRemaining(chain, ids);
      const status = isUserRejection(error) ? 'stopped' : 'error';
      if (onProgress) await onProgress({ stage: status, ...info, remaining: total });
      return { status, error, done, remaining: total };
    }
    done.push({ ...info, receipt });
    const total = await safeRemaining(chain, ids);
    if (onProgress) await onProgress({ stage: 'after', ...info, receipt, remaining: total });
  }
}

// remaining null (could not be computed): say so without an amount.
export function stoppedMessage(remainingText) {
  if (remainingText === null || remainingText === undefined) return 'The remaining VCLM stays available. You can claim it any time.';
  return `The remaining ${remainingText} VCLM stays available. You can claim it any time.`;
}

// Adapter for an ethers v6 Stake contract connected to the user's signer.
export function makeEthersStakeChain(stake, account) {
  return {
    getCurrentEpoch: () => stake.getCurrentEpoch(),
    lastAllocatedEpoch: () => stake.lastAllocatedEpoch(),
    launchTimestamp: () => stake.launchTimestamp(),
    nextClaimEpoch: (id) => stake.nextClaimEpoch(id),
    claimableVclm: (id, to) => stake.claimableVclm(id, to),
    position: (id) => stake.positions(id),
    // one small eth_call per epoch, sent together (a JsonRpcProvider batches them)
    epochInfos: (ns) => Promise.all(ns.map(async (n) => { const e = await stake.epochs(n); return { allocated: e.allocated, mintedVclm: e.mintedVclm, totalWeight: e.totalWeight }; })),
    epochWeights: (id, ns) => Promise.all(ns.map((n) => stake.epochWeight(id, n))),
    estimateClaim: (tx) => (tx.kind === 'one'
      ? stake.claimPosition.estimateGas(tx.ids[0], tx.toEpoch, { from: account })
      : stake.claimPositions.estimateGas(tx.ids, tx.toEpoch, { from: account })),
  };
}
```

   b) Contract calls it uses (all in STAKE_ABI from section 8 a); do not add other lines): claimPosition(uint256,uint256) 0x06311c2f, claimPositions(uint256[],uint256) 0xde45ab84, claimableVclm(uint256,uint256) 0x78807836 (cross-check only), nextClaimEpoch(uint256) 0x2d06f309, epochs(uint256) 0xc6b61e4c, epochWeight(uint256,uint256) 0xeadde31f, positions(uint256) 0x99fbab88, getCurrentEpoch() 0xb97dd9e2, lastAllocatedEpoch() 0x70462f62, launchTimestamp() 0x65cf7c9b. Create the adapter with makeEthersStakeChain(stakeContractConnectedToSigner, account).
   c) Rules the planner follows (do not change them):
      - L = min(getCurrentEpoch() - 2, lastAllocatedEpoch()). Never claim past L.
      - Every VCLM amount the page shows (per position, "Available to claim", "This transaction claims", "Remaining") comes from exactClaimable: for each epoch n from nextClaimEpoch(id) to min(L, the position's last eligible epoch), floor(epochs(n).mintedVclm x epochWeight(id, n) / epochs(n).totalWeight), skipping epochs that minted nothing, each epoch read once. This is the contract's own claim sum. Do not compute display amounts with claimableVclm, and never add several claimableVclm reads together (each one starts again at nextClaimEpoch, so pieces would overlap and count twice).
      - claimableVclm(id, L) is read only as a cross-check when the range is at most 200 epochs. If it differs from the app value, the planner throws "Claim display check failed for position <id>: app <a>, contract <b>. No claim is offered." Show that text, offer no claim for any position, and show "The remaining VCLM stays available. You can claim it any time." without an amount.
      - Read the epochs in groups of 500: one small eth_call per epoch (epochs(n) once per epoch for all positions, then epochWeight(id, n) only for epochs that minted VCLM). Send the reads through a read-only ethers.JsonRpcProvider for Base (chain id 8453) created with { batchMaxCount: 100 } so they go out as JSON-RPC batches; use MetaMask only for signing. Show "Reading rewards: epoch a of b" while reading.
      - Positions with nothing to claim (amount 0), or whose nextClaimEpoch(id) is above L, are left out.
      - Positions that fit together are claimed with claimPositions(ids, L). A long single history is claimed with claimPosition(id, toEpoch) for part of its range, then the rest.
      - Every transaction is checked with eth_estimateGas before it is offered. If the estimate is above 8,000,000, the batch is halved (half the positions, or half the epoch range) and estimated again. The formula is only a first guess.
      - After each mined transaction, nextClaimEpoch and the exact amounts (exactClaimable) are read again from the chain and the rest is planned again.
   d) "Claim all" box on the Stake page (section 8 d)):
      - Before anything is sent, call previewClaimAll(chain, ids) and show: "Available to claim: X VCLM" (total, ethers.formatUnits(total, 18)), "Transactions needed: N" (txCount; if N is above 1 add "Long histories are claimed in several transactions, each confirmed in MetaMask."), and "Estimated network fee per transaction: about F ETH" using section 10 e) for the first planned transaction. If total is 0 show "Nothing to claim yet." and disable the button.
      - On "Claim all", call runClaimAll(chain, ids, { send, onProgress }). In send(info): build the claimPosition or claimPositions transaction from info.tx exactly, run section 10 prepareAndConfirm for it (fee, balance check, "Estimate may change before execution. MetaMask shows the final fee."), and only if it returns ok, send it with that gasLimit and wait for the receipt. If prepareAndConfirm returns ok false, throw an Error with its message (this stops the run; nothing more is sent). If the receipt status is not 1, throw "The claim transaction failed. Nothing was paid for it."
      - While running show "Transaction i of N" (info.index of info.total) and "This transaction claims Y VCLM" (info.amount). After each mined transaction show "Claimed so far: Z VCLM" and "Remaining: R VCLM" (remaining from onProgress stage "after").
      - When the user rejects a MetaMask prompt (runClaimAll returns status "stopped"): send nothing more and show exactly "The remaining X VCLM stays available. You can claim it any time." with X = remaining. Keep the "Claim all" button enabled so the user can resume later; it plans again from the chain.
      - When status is "error": show the error message (map revert texts with section 8 e)), then the same "The remaining X VCLM stays available. You can claim it any time." line.
      - When status is "complete": show "All available VCLM claimed in N transactions." and refresh the positions list.
      - Never start a second run while one is running (disable the button).
   e) Tests to add: the file equals the reference content above; with a stubbed chain whose estimates exceed 8,000,000 the planner halves until the estimate fits; a position with claimableVclm 0 is left out; a rejected prompt (error code 4001 or "ACTION_REJECTED") gives status "stopped" and the message with the remaining amount; send runs prepareAndConfirm before each transaction; "Transaction i of N" and the remaining amount update after each mined transaction; L is min(getCurrentEpoch() - 2, lastAllocatedEpoch()).

When done, list every file you changed and what changed in each.
