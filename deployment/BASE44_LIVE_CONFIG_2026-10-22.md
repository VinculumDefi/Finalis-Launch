# Vinculum app: connect to the live Base contracts (Base ceremony of 2026-10-22)

Paste everything below this line into Base44 as one instruction.

---

Make only the changes below to the Vinculum lock app. Change nothing else. This instruction replaces sections 6, 7, 8, 9 and 11 of the earlier instruction ("Make only the changes below to the Vinculum lock app...", file deployment/BASE44_APP_FIX_PROMPT.md). Do not do those sections. Sections 1 to 5 and section 10 of the earlier instruction stay as they are, except where this instruction says otherwise. Do not add any contract, deploy step or server function. Do not add any ITS, bridge or cross-chain transfer UI. Do not say the protocol is "fully immutable" across chains.

## 1. What is live and what is not (read this first)

The Base ceremony of 2026-10-22 (main 5996ba1, Verifier launch 1792723969 = 2026-10-22 10:52:49 PM America/New_York) deployed and finalized on Base (chain id 8453): Base lock, VCLM, CHONX, Verifier, Stake, Forge/SYNTH, Base reader, and 14 non-Base readers. The same CommitmentVaultLock bytecode was also deployed at one address on Ethereum, Arbitrum, Optimism, Polygon, BNB Smart Chain and Avalanche.

What the app may offer now:

- On Base only: native Base ETH lock, mint (VCLM; CHONX after activation), release, Stake (create, extend, withdraw, claim with batching), Forge (gated).
- Fee 5.00% on every duration. Handshake band $0.01 to $0.02. Standard minimum $0.01.
- USDC/USDT rule: never hardcode $1; refuse when the last usable scheduled price is below $0.95.
- CVL refuses VCLM, CHONX and SYNTH as lock inputs (VF-TOK-007). Stake accepts them.
- Registry gate: 487 rows. Hide or mark unavailable any asset that has no usable scheduled price.

What the app must refuse (send nothing):

- Lock or mint on any network other than Base. Message: "This network is not offered for new locks yet."
- Reason (do not soften or omit): the registered non-Base readers prove a self-consistent header and receipt (or UTXO / Stellar / XRPL equivalent). They do not check that the header is part of that chain's settled history. Until a settled-history checker is registered for a chain, a package built from a forged but self-consistent block can pass verifyFinality and mint. Base is different: the Base reader reads live Base storage. Keep Release for any old 2.5% lock a user already owns (RETIRED_LOCKS).
- ITS, bridge, wrap, or "move to another chain" UI of any kind. Message if such a control already exists: "Bridging is not part of this release."
- Any marketing string that says locks or minting are "fully immutable" across chains. Remove those strings.

Only Base ETH has a usable scheduled price today (run 1 at $2,392.22). Any other asset reverts with "VF-ORC-005: no usable scheduled price". Do not invent a price. When the scheduled poster posts more runs, assets with usable=true become available under the same rules.

## 2. Live addresses (Base, chain id 8453)

In src/lib/protocolConfig.js set CONTRACTS exactly to these values. Do not invent any other address. Do not keep any old address for these roles.

```js
export const CONTRACTS = {
  lock: "0xa1bEA13021D48969210D2e28A3760653AF983558",
  vclm: "0xC8c7da1d7Ac2DDcE09410dD43663c3d91d8d9983",
  chonx: "0x2150230b14F81d7C77aB507F4a66fb430D220291",
  verifier: "0xfA8A18e0ddE99a06C78231F82E26ec6160006328",
  baseReader: "0x9361339655caE3AEcC5ba605d4e57D5771EC2666",
  stake: "0x8481d1e275eD8398C904005417813a3157e3Df55",
  forge: "0xf1cA519B5b83525C8a659F6e66dB0ecCb5A75D27",
  synth: "0xf1cA519B5b83525C8a659F6e66dB0ecCb5A75D27", // same as forge
};
export const LAUNCH_TIMESTAMP = 1792723969; // Verifier.protocolLaunchTimestamp (America/New_York 2026-10-22 10:52:49 PM)
export const CHAIN_ID = 8453;
export const BASE_NATIVE_ETH_ASSET_ID = "0xde7085290190e1f2f7f2f83d26fa72e411f9d765ddd608a77e8a7c388113943b";
```

Also in protocolConfig.js:

- NEW_BASE_LOCK_ADDRESS (and CONTRACTS.lock, and LOCKS.Base) = the lock address above.
- For every other network's NEW_*_LOCK_ADDRESS and LOCKS.<network>: leave the section 1 placeholder string (not a valid address). The Lock page must refuse that network with "This network is not offered for new locks yet." and send nothing. Do not put the non-Base lock address into LOCKS for a new lock.
- PROTOCOL_TOKENS = [CONTRACTS.vclm, CONTRACTS.chonx, CONTRACTS.synth]. isProtocolToken(address) compares ignoring upper or lower case.
- DURATIONS: Handshake minUsd 0.01 and maxUsd 0.02, feeRate 0.05; every other duration minUsd 0.01, feeRate 0.05. Prefer reading HANDSHAKE_USD_MIN (0x0d10a241), HANDSHAKE_USD_MAX (0xb4fb6ac0) and STANDARD_USD_MIN (0x4fe4b5e9) from CONTRACTS.lock.
- RETIRED_LOCKS (release only; never on the Lock page):
  - 0x968BFD5b… (old Base lock)
  - 0x4eDE54E1… (old non-Base lock on Ethereum, Arbitrum, Optimism, Polygon, BNB Smart Chain, Avalanche)
  - 0x5AB40cdD… (also in ceremony oldLocks)
  - The Oct 21 bad set, retired: 0x9dE38C43… (lock), 0xF1389726… (VCLM), 0x3e872399… (CHONX), 0x3bceB853… (Verifier), 0xEcFB8141… (Base reader). Never use these for CONTRACTS. Show "Old lock (retired): release only" next to a lock the user owns on an old lock. A lock made on an old lock cannot be minted through the new Verifier.

Remove every remaining hard-coded use of these old addresses, replacing each with the matching CONTRACTS field (compare ignoring upper or lower case): 0xb0670826 (older Verifier), 0x655273f8 (older VCLM), 0x5C5587db (older CHONX), 0x7A2c7787 (older Synth/Forge), 0xfa16a1cd (older Stake), 0x1cBbb8C2 (older Base reader), 0x968BFD5b, 0x4eDE54E1, 0x5AB40cdD, and the whole Oct 21 set 0x9dE3 / 0xF138 / 0x3e87 / 0x3bce / 0xEcFB. The Release page may keep the retired list above for release of old locks only.

## 3. Reader map and non-Base lock map (reference only; do not offer new locks)

Readers are all on Base. Do not call them from the app for minting while non-Base lock/mint is off. Listed so nothing is invented later.

```js
export const CHAIN_READERS = {
  Base:            "0x9361339655caE3AEcC5ba605d4e57D5771EC2666", // BaseLockRecordVerifier
  Ethereum:        "0xE92ac194d9b53E4eD897e4334eE97dd14E96B07B", // SimpleEthereumLockReader
  Arbitrum:        "0xA310F01d529Bc9775E516422328B98CF6dB1fA87", // ArbitrumLockReader
  Optimism:        "0x02412446f6d080f6D5f7B602a311B84d9B8E5327", // OptimismLockReader
  Polygon:         "0xCc2F41197bB1413f85c33533b67b3667C2d71b6d", // PolygonLockReader
  "BNB Smart Chain":"0x9e0Ead13696899b919078bAaE96F16d66FF4b827", // BnbSmartChainLockReader
  Avalanche:       "0x5d021f3bDB9A162913987bf7edcF14d26e568E4D", // AvalancheLockReader
  Bitcoin:         "0x2cb46E27268cE1F2A9Ce1aA45f7A38AE37bB9Dab", // BitcoinLockReader
  "Bitcoin Cash":  "0x38bC1fEDB7f62DF8c25af486a5b03C83258C1A22",
  Litecoin:        "0x17BF2c3c72104C64D5c13f0C6A34cDDD95dFc445",
  Dogecoin:        "0x3C2b2B902415546fd49dff77Fde40be2D705F7d5",
  DigiByte:        "0x7393D6Ee141D6333e3b72BFF195e98b476487C75",
  Zcash:           "0x0c3b7304D903f873acC7649cfe73C2e37ED63918",
  Stellar:         "0x821A566D3e8Aa0c3D9d26B57a1E7fDa62B0AF38C",
  "XRP Ledger":    "0xfcbbe7Af0Ac36f2F0AFf429647AEcb9077880937",
};
// Same address on Ethereum, Arbitrum, Optimism, Polygon, BNB Smart Chain, Avalanche.
export const NON_BASE_LOCK = "0x115b2B47330cD1b7550D347f44df2e151D4A626E";
```

Do not put NON_BASE_LOCK into LOCKS for new locks. Do not wire a mint path that builds sourceFinalityProof / lockEventProof for any non-Base reader in this release.

## 4. ABIs for the contracts that are live

Use only these ABIs. Delete getLock and nextLockId from LOCK_ABI. There is no handshakeIdentity in the proof.

In src/lib/mintConfig.js set:

```js
import { ethers } from "ethers";

export const PROOF_TUPLE =
  "tuple(string sourceEnvironmentId, bytes32 commitmentVaultLockId, uint8 handshakeAllowanceCount, bytes32 canonicalAssetId, uint8 assetPrecision, uint8 assetCustodyClass, uint256 grossAmountSmallestUnits, uint256 actualFeeAmountSmallestUnits, uint256 principalAmountSmallestUnits, bytes32 feeAssetId, string devFundDestination, bytes32 feeTransferEvidence, uint256 valuationTimestamp, uint256 maturityTimestamp, uint256 durationSecs, uint8 selectedOutputToken, address baseRecipient, string releaseDestination, bytes chonxActivationReceipt, bytes32 racIdentity, bytes priceRecord, bytes sourceFinalityProof, bytes lockEventProof)";

export const VERIFIER_ABI = [
  `function recordFeeAndRac(${PROOF_TUPLE} pkg)`, // 0xf0f64b60
  `function verifyAndMint(${PROOF_TUPLE} pkg, uint256 daysSinceLaunch) returns (bool)`, // 0x8c24712a
  "function configurationFinalized() view returns (bool)", // 0x0701d8f7
  "function chainVerifiers(string) view returns (address)", // 0x00c1aed1
  "function assetPrecisionTable(bytes32) view returns (bytes32 canonicalAssetId, string symbol, uint8 decimals, uint8 custodyClass, uint8 custodyPath)", // 0x451e046f
  "function scheduledPrices(bytes32) view returns (uint256 priceUsd18, bool usable)", // 0x3e72f4c9
  "function lastScheduledRunId() view returns (uint64)", // 0x0f6249c9
  "function vclmToken() view returns (address)", // 0x65a1c90c
  "function chonxToken() view returns (address)", // 0x19a9e9b6
  "function protocolLaunchTimestamp() view returns (uint256)", // 0x3e84ba2f
  "function lifetimeVclmIssued() view returns (uint256)", // 0x7a197938
  "function cumulativeVclmIssued() view returns (uint256)", // 0x1c467d64
  "function chonxActivated() view returns (bool)", // 0x8dae0c3c
  "function chonxActivationTimestamp() view returns (uint256)", // 0xf6e7ea65
  "function CHONX_ACTIVATION_THRESHOLD() view returns (uint256)", // 0xffeae027 = 10_000_000e18
  "function CHONX_SOURCE_CLOCK_MARGIN_SECS() view returns (uint256)", // 0xc5defaeb = 86400
  "function syncChonxActivation()", // 0x609b7566
  "function getRemainingVclmCap() view returns (uint256)", // 0x3704c08b
  "function isLockConsumed(string envId, bytes32 lockId) view returns (bool)", // 0x37e1c322
  "function isRacRecorded(bytes32) view returns (bool)", // 0x6ec9d1dc
  "function BASE_NATIVE_ETH_ASSET_ID() view returns (bytes32)", // 0xde8084c9
  "function USD_STABLE_MIN_PRICE() view returns (uint256)", // 0xbe3b1196 = 0.95e18
  "function STANDARD_FEE_BPS() view returns (uint256)", // 0xbf224fcd = 500
  "event VerificationSucceeded(bytes32 indexed lockIdHash, string sourceEnvironmentId, address indexed recipient, uint8 outputToken, uint256 amount)",
];

export const LOCK_RECORD_ABI = [
  "function environmentId() view returns (string)",
  "function devFund() view returns (address)",
  "function STANDARD_FEE_BPS() view returns (uint256)",
  "function HANDSHAKE_USD_MIN() view returns (uint256)",
  "function HANDSHAKE_USD_MAX() view returns (uint256)",
  "function STANDARD_USD_MIN() view returns (uint256)",
  "function isProtocolToken(address) view returns (bool)",
  "function lockRecord(bytes32) view returns (tuple(bool exists, bool released, address creator, address releaseDestination, address asset, address baseRecipient, uint8 outputToken, uint256 gross, uint256 fee, uint256 principal, uint256 duration, uint256 multiplierBps, uint256 createdAt, uint256 maturity, bytes32 assetIdentity, bytes32 valuationReference, bytes bindingPayload))",
  "event LockCreated(bytes32 indexed lockId, address indexed creator, address indexed releaseDestination, address asset, uint256 gross, uint256 fee, uint256 principal, uint256 maturity)",
  "event FeeRouted(bytes32 indexed lockId, address indexed devFund, address asset, uint256 fee)",
  "event PrincipalReleased(bytes32 indexed lockId, address indexed releaseDestination, address asset, uint256 principal)",
];

export const mintInterface = new ethers.Interface(VERIFIER_ABI);
export const lockRecordInterface = new ethers.Interface(LOCK_RECORD_ABI);
```

In src/lib/protocolConfig.js:

```js
export const LOCK_ABI = [
  "function createNativeLock(bytes32 lockId, address baseRecipient, uint8 outputToken, bytes32 assetIdentity, bytes32 valuationReference, address releaseDestination, uint256 duration, uint256 verifiedGrossUsd) payable returns (uint256 fee, uint256 principal)", // 0x7f22a052
  "function createErc20Lock(bytes32 lockId, address baseRecipient, uint8 outputToken, bytes32 assetIdentity, bytes32 valuationReference, address releaseDestination, uint256 duration, address token, uint256 amount, uint256 verifiedGrossUsd) returns (uint256 fee, uint256 principal)", // 0xa271dec9
  "function release(bytes32 lockId)", // 0x67d42a8b
];

export const READER_ABI = [
  "function ENVIRONMENT_ID() view returns (string)", // 0x6c8d258f
  "function vault() view returns (address)", // 0xfbfa77cf
];

export const FORGE_ABI = [
  "function forge(uint256 count) returns (bool success)", // 0xa94e834b
  "function totalSupply() view returns (uint256)",
  "function HARD_CAP() view returns (uint256)", // 10_000_000
  "function synthActivated() view returns (bool)",
  "function isActivationThresholdReached() view returns (bool)", // 100_000_000 CHONX
  "function VCLM_BURN_PER_SYNTH() view returns (uint256)", // 1000e18
  "function CHONX_BURN_PER_SYNTH() view returns (uint256)", // 10000e18
  "function SYNTH_ACTIVATION_THRESHOLD() view returns (uint256)",
];

export const STAKE_ABI = [
  "function createPosition(uint8 token, uint256 amount, uint256 durationSecs) returns (uint256)", // 0x59f3d12c
  "function queueExtension(uint256 positionId, uint256 durationSecs)", // 0xdaa00eb7
  "function applyExtensionIfMatured(uint256 positionId)", // 0x9bb1404b
  "function withdrawPosition(uint256 positionId)", // 0x525c12ea
  "function claimPosition(uint256 positionId, uint256 toEpoch) returns (uint256 amount)", // 0x06311c2f
  "function claimPositions(uint256[] positionIds, uint256 toEpoch) returns (uint256 total)", // 0xde45ab84
  "function claimableVclm(uint256 positionId, uint256 toEpoch) view returns (uint256)", // 0x78807836
  "function nextClaimEpoch(uint256) view returns (uint256)", // 0x2d06f309
  "function positions(uint256) view returns (address owner, uint8 token, uint256 amount, uint256 durationSecs, uint256 startTimestamp, uint256 endTimestamp, uint32 multiplierBps, uint32 queuedExtensionBps, uint256 queuedExtensionSecs, bool withdrawn, uint256 activeSince, uint256 withdrawnAt)", // 0x99fbab88
  "function getPositionWeight(uint256 positionId) view returns (uint256)", // 0x94a053ae
  "function stakeMultiplierBps(uint256 durationSecs) pure returns (uint256)", // 0xd4d0ea82
  "function getCurrentEpoch() view returns (uint256)", // 0xb97dd9e2
  "function lastClosedEpoch() view returns (uint256)", // 0x2b23ee85
  "function lastAllocatedEpoch() view returns (uint256)", // 0x70462f62
  "function epochs(uint256) view returns (bool closed, bool allocated, uint256 rewardBasis, uint256 totalWeight, uint256 mintedVclm, uint256 closeTimestamp, uint256 allocateTimestamp)", // 0xc6b61e4c
  "function epochTotalWeight(uint256 epochN) view returns (uint256)", // 0x4631aece
  "function epochWeight(uint256 positionId, uint256 epochN) view returns (uint256)", // 0xeadde31f
  "function launchTimestamp() view returns (uint256)", // 0x65cf7c9b
  "function terminalState() view returns (bool)", // 0x8815bd02
  "function closeEpoch(uint256 epochN)", // 0xd16d9057
  "function allocateEpoch(uint256 epochN)", // 0xea73ea0b
  "event PositionCreated(uint256 indexed positionId, address indexed owner, uint8 token, uint256 amount, uint256 durationSecs)",
  "event VclmClaimed(uint256 indexed positionId, address indexed owner, uint256 fromEpoch, uint256 toEpoch, uint256 amount)",
];
```

Keep ERC20_ABI as it is (balanceOf, allowance, approve, decimals, symbol, name, totalSupply).

## 5. Lock page: Base ETH only until more prices are posted

- The Lock page offers Base and Base ETH only. Hide every other network. For every other asset in the 487-row allowlist: hide it or show it as unavailable while scheduledPrices(key).usable is false. Do not invent a price. When a later run makes an asset usable, it may be offered under the same rules (still Base only in this release).
- Before any lock is sent, call readMintContext (below). If it fails, show its message and send nothing.
- Fee is 5% for every duration, including the 1-hour Handshake. Show "Handshake: $0.01 to $0.02" and "Minimum $0.01".
- Stablecoins (USDC and USDT rows named USDC, USDT, USDC_ARB, USDT_ARB, USDC_OP, USDT_OP, USDC_POL, USDT_POL, USDC_BSC, USDT_BSC, USDC_AVAX, USDT_AVAX, USDTE, USDC_BASE): never value at a hardcoded $1. Use the last successful scheduled price. If that price is below $0.95, the asset is unavailable for every new lock at every duration until a later successful run is at or above $0.95. Exactly $0.95 is allowed. Fail closed. Show "This stablecoin is below $0.95 and cannot be locked until a later price run is at or above $0.95." DAI and other stables are not covered by this rule.
- Output: VCLM (0, default) or CHONX (1). Read chonxActivated(), lifetimeVclmIssued() and CHONX_ACTIVATION_THRESHOLD() from CONTRACTS.verifier. While chonxActivated() is false and lifetime is below the threshold: show CHONX disabled with "CHONX opens when 10,000,000 VCLM have been issued (now X)". If lifetime is at or above the threshold but chonxActivated() is still false: keep CHONX disabled and offer "Record CHONX activation" that sends syncChonxActivation(). Only when chonxActivated() is true is CHONX selectable. Re-read right before sending; if false, stop with "CHONX is not active yet. No funds were locked." and send nothing. For Base, a CHONX lock counts only if createdAt is strictly after chonxActivationTimestamp().
- Base recipient: editable field, prefilled with the connected wallet, must be a valid EVM address, shown on the review step.
- For a Base ETH lock: assetIdentity = BASE_NATIVE_ETH_ASSET_ID, valuationReference = bytes32(0), releaseDestination = the connected wallet (or the field the page already uses), duration from DURATIONS, verifiedGrossUsd from the scheduled price in readMintContext. Call createNativeLock with value = amount.
- Do not call createErc20Lock for any token while that token has no usable scheduled price.

## 6. Refuse VCLM, CHONX and SYNTH as lock inputs (app-side; on-chain also refuses)

Before any approve or lock:

- If the selected token address equals any of PROTOCOL_TOKENS (any letter case), or the symbol is VCLM, CHONX or SYNTH, refuse with "VCLM, CHONX and SYNTH cannot be locked. They can be staked or forged." and send nothing.
- Apply this on every asset picker, typed address, URL value and saved state.
- If the lock call still reverts with a message containing "VF-TOK-007", show the same text.
- Stake accepts VCLM, CHONX and SYNTH. Forge burns VCLM and CHONX.

## 7. Mint path (src/lib/lockMint.js)

Use CONTRACTS.lock, CONTRACTS.verifier, CONTRACTS.vclm, CONTRACTS.chonx, CONTRACTS.baseReader. Selectors: recordFeeAndRac 0xf0f64b60, verifyAndMint 0x8c24712a. The proof has no handshakeIdentity. In PROOF_TUPLE delete any "string handshakeIdentity, " text. In mintFromLock delete any handshakeIdentity key from the pkg.

readMintContext(provider, asset):

1. Network must be chain id 8453. Else: "Switch to Base before locking."
2. Verifier code must contain selectors 0xf0f64b60 and 0x8c24712a. Else: "Verifier ABI mismatch. No transaction was sent."
3. lock.environmentId() must equal "Base".
4. verifier.configurationFinalized() must be true.
5. verifier.chainVerifiers("Base") must equal CONTRACTS.baseReader.
6. baseReader.ENVIRONMENT_ID() must equal "Base" and baseReader.vault() must equal CONTRACTS.lock.
7. verifier.vclmToken() and verifier.chonxToken() must equal CONTRACTS.vclm and CONTRACTS.chonx.
8. verifier.protocolLaunchTimestamp() must equal LAUNCH_TIMESTAMP (or be non-zero and then store it).
9. For the asset, key = keccak256(abi.encodePacked("Base", asset.assetIdentity)); assetPrecisionTable(key) must match the asset (canonicalAssetId and decimals); scheduledPrices(key) must have usable true and priceUsd18 > 0. Else: "No usable scheduled price. No funds will be locked."
10. For USDC/USDT rows: if priceUsd18 < USD_STABLE_MIN_PRICE (0.95e18), refuse with the stablecoin message in section 5.
11. Return { entry, price: priceUsd18, launchTimestamp }.

mintFromLock({ provider, account, lockId, receipt, onStep, onTransaction, onMinted }):

1. receipt.status must be 1 and receipt.to (lower case) must equal CONTRACTS.lock (lower case). Else refuse.
2. Read lockRecord(lockId) at receipt.blockNumber. Require exists, not released, baseRecipient non-zero, outputToken 0 or 1.
3. For outputToken 1: require verifier.chonxActivated() is true and chonxActivationTimestamp() > 0 and record.createdAt > chonxActivationTimestamp(). Else stop with "CHONX was not active when this lock was created (VF-COM-025). It cannot mint CHONX. The locked funds can still be released at maturity." Do not send.
4. Find the FeeRouted event for this lockId; its devFund and fee must match lock.devFund() and record.fee.
5. Build the package once and pass the same object to both calls. chonxActivationReceipt stays "0x". racIdentity = keccak256(abi.encodePacked("Base", lockId, receipt.hash, feeLog.index, record.assetIdentity, record.fee)). lockEventProof for Base is the 7-field encoding the Base reader expects (lockId and the six zeros, or the form the existing Base path already uses). sourceFinalityProof is "0x" for Base. No handshakeIdentity key.
6. Run section 10 (prepareAndConfirm) for recordFeeAndRac, then send it. Then run section 10 for verifyAndMint with the same pkg and daysSinceLaunch = 0, then send it. Keep the existing VF-FEE-011 retry: if verifyAndMint reverts with text containing "VF-FEE-011", retry once with the same stored package; do not rebuild it and do not create another lock.
7. Confirm VerificationSucceeded for this lock, and a Transfer from the zero address to record.baseRecipient on CONTRACTS.vclm (output 0) or CONTRACTS.chonx (output 1). Show that amount and token name.
8. Error text: "VF-COM-025: CHONX not activated" -> "CHONX is not active yet. This lock cannot mint. Your funds remain locked and can be released at maturity." "VF-COM-025: lock created before CHONX activation" -> "This lock was created before CHONX was active, so it can never mint CHONX. Your funds can be released at maturity." Do not retry either.

## 8. Forge page

Forge costs 1,000 VCLM + 10,000 CHONX per SYNTH (read VCLM_BURN_PER_SYNTH and CHONX_BURN_PER_SYNTH). SYNTH is gated on 100,000,000 CHONX lifetime (isActivationThresholdReached). Cap HARD_CAP = 10,000,000. CHONX as a lock output opens at 10,000,000 lifetime VCLM (Verifier), which is separate from Forge activation.

- Replace FORGE_ABI with the list in section 4. In Forge.jsx call contract.forge(1). Each forge(1) burns 1,000 VCLM and 10,000 CHONX from the user (approve CONTRACTS.forge for both first) and mints 1 SYNTH.
- While isActivationThresholdReached() is false, disable the button and show "Forge opens when 100,000,000 CHONX have been issued." Do not send forge while it is false.
- Keep FORGE.synthCap at 10,000,000 (equals HARD_CAP). If the page reads the cap on-chain, read HARD_CAP().

## 9. Stake page (Treasury Reward Stake)

Add or keep page "Stake" (route /stake, main menu) that uses CONTRACTS.stake on Base (chain id 8453) only. On any other network show "Switch to Base" and send nothing.

- Token: VCLM (0), CHONX (1), SYNTH (2). Duration: 30 / 60 / 90 / 120 days (2592000, 5184000, 7776000, 10368000). Multipliers from stakeMultiplierBps (1.00x, 1.40x, 1.75x, 2.10x). Never hard-code the display numbers; read them.
- createPosition after approve. queueExtension, applyExtensionIfMatured, withdrawPosition as in the earlier instruction section 8.
- Claims: claimPosition / claimPositions only. No claimVclm() and no claimableVclm(address). Use src/lib/vfClaimPlanner.js exactly as in the earlier instruction section 11 (MAX_CLAIM_GAS = 8_000_000). Plan claims so each transaction stays at or under about 8,000,000 gas; split by epochs and/or positions. One MetaMask confirmation per batch. After each success, re-read and update the remaining claimable. Anything not claimed stays claimable. Display amounts from exactClaimable (epochs + epochWeight), never by summing claimableVclm ranges. No Stake contract change.
- Close and allocate are permissionless operator calls on the page (closeEpoch / allocateEpoch in order). Whoever presses the button pays that transaction's ETH network fee.
- Map revert texts as in the earlier instruction section 8 e).

## 10. Network fees (participants pay 100%)

Keep and apply the earlier section 10 helper src/lib/networkFee.js prepareAndConfirm to EVERY write the app asks the user to sign on Base: approve, createNativeLock, createErc20Lock, release, recordFeeAndRac, verifyAndMint, syncChonxActivation, createPosition, queueExtension, applyExtensionIfMatured, withdrawPosition, claimPosition, claimPositions (every batch separately), closeEpoch, allocateEpoch, forge. Estimate gas on every write. The user pays 100% of their gas. No sponsorship, no refund, no fee taken from VCLM, CHONX or SYNTH. Show the estimated fee in ETH (and USD only from a price read in the last 5 minutes), the line "Estimate may change before execution. MetaMask shows the final fee.", the line "Network fees are paid in ETH by your wallet. No fee is taken from VCLM, CHONX or SYNTH.", and block the send when the wallet ETH balance is below the estimate plus the value being sent.

## 11. Registry gate (487 rows)

- Keep src/data/activeAssetAllowlist.json from main (487 entries). Match by network + address (or native id), never by ticker alone.
- Offer an asset only if it is on the allowlist AND scheduledPrices for its registry key has usable true. Otherwise hide it or mark it unavailable. Do not invent a price.
- Hide every Solana asset. Refuse Cosmos ATOM and any asset not on the list.
- Show a count such as "N offered of 487; others hidden or unavailable (no usable price)."

## 12. Acceptance checklist (operator)

Click through on the live Base app after this change. Every step is a read or a user-signed send the operator chooses; this instruction does not send anything by itself.

1. CONTRACTS equal the eight addresses in section 2; no file still contains 0x9dE3, 0xF138, 0x3e87, 0x3bce, 0xEcFB, 0x968BFD5b, 0x4eDE54E1, 0x5AB40cdD, 0xb0670826, 0x655273f8, 0x5C5587db, 0x7A2c7787, 0xfa16a1cd or 0x1cBbb8C2 except RETIRED_LOCKS / Release.
2. Lock page shows Base, Base ETH, fee 5%, Handshake $0.01 to $0.02, minimum $0.01. Other networks say "This network is not offered for new locks yet."
3. Stake page works on Base with the new STAKE_ABI. Forge page disables until 100M CHONX with the message above; forge(1) burns 1000 VCLM + 10000 CHONX.
4. Typing or picking VCLM, CHONX or SYNTH as a lock input is refused before MetaMask opens.
5. Before every write, the app shows an ETH fee estimate and a balance check; with too little ETH the send is blocked. No sponsorship.
6. A small Base ETH Handshake lock ($0.01 to $0.02) can be created and then minted to VCLM for the Base recipient (operator signs; optional).
7. CHONX output is disabled while chonxActivated() is false, with the 10,000,000 VCLM message.
8. Claim all uses the 8,000,000 gas planner; remaining claimable updates after each batch; unclaimed stays claimable.
9. No ITS / bridge UI. No "fully immutable" cross-chain marketing text.
10. Stablecoin path never hardcodes $1; below $0.95 is refused.

When done, list every file you changed and what changed in each.
