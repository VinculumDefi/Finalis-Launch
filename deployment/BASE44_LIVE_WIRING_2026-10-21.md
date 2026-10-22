# Vinculum app: connect to the live Base contracts (Base ceremony of 2026-10-21)

Paste everything below this line into Base44 as one instruction.

---

Make only the changes below to the Vinculum lock app. Change nothing else. This instruction replaces sections 6, 7, 8, 9 and 11 of the earlier instruction ("Make only the changes below to the Vinculum lock app..."). Do not do those sections. Sections 1 to 5 and section 10 of the earlier instruction stay as they are, except where this instruction says otherwise. Do not add any contract, deploy step or server function.

## 1. What is missing (read this first)

The Base ceremony of 2026-10-21 deployed five contracts on Base (chain id 8453): a Base lock, VCLM, CHONX, a Verifier and a Base lock reader. These are the contracts the app connects to. Several features the app was planned to have are not part of this deployment. Each one must be turned off in the app, with the message given, and must not be connected to any address.

- Staking (Treasury Reward Stake): no Stake contract was deployed. VCLM has no staking minter, and VCLM is finalized, so none can be added later to these tokens. Turn off the Stake page, positions, claims, "Claim all", claim batching and the claimable amounts. Message: "Staking is not live yet."
- Forge and SYNTH: not deployed. Turn off the Forge page. Message: "Forging is not live yet."
- Locks on other networks (Ethereum, Arbitrum, Optimism, Polygon, BNB Smart Chain, Avalanche, Bitcoin, Bitcoin Cash, Litecoin, Dogecoin, DigiByte, Zcash, Stellar, XRP Ledger, Solana, Cosmos): no lock and no reader are registered for any of them on this Verifier, and the Verifier is finalized so none can be added. On every page that would lock or mint on those networks, refuse and show "This network is not live yet." and send nothing. Keep the Release path for any old 2.5% lock a user already owns (section 6 e of the earlier instruction), and nothing else.
- The CHONX timing rule (VF-COM-025 with a recorded activation time and a 1-day margin on other chains) is not on this Verifier. CHONX opens when cumulative VCLM issued reaches 10,000,000, in the same mint that crosses that threshold. There is no syncChonxActivation and no chonxActivationTimestamp. Do not add them.
- Protocol-token refusal on-chain (VF-TOK-007): this lock accepts VCLM and CHONX as lock inputs. The app must refuse them itself (section 5 below). SYNTH is not deployed, so refuse the ticker SYNTH as well.

What does work on this set, only on Base, only for Base ETH, and only while Base ETH has a usable scheduled price:

- create a Base ETH lock (native) for VCLM or, after CHONX is active, for CHONX;
- record the fee and RAC, then mint the matching token to the Base recipient;
- release a matured Base lock.

## 2. Live addresses (chain id 8453 only)

In src/lib/protocolConfig.js set CONTRACTS exactly to these values. Do not invent any other address. Do not keep any old address for these roles.

```js
export const CONTRACTS = {
  lock: "0x9dE38C4308de010CBB4EDA39601bA18Fae96A940",
  vclm: "0xF1389726E28C53bCF5CD1ea75B73A01C9a10044D",
  chonx: "0x3e87239964B4Da6eb0F827210388CaB6276A174F",
  verifier: "0x3bceB853F74981A03eCfebBB493EdAb9c8eA9381",
  baseReader: "0xEcFB8141367429ff544b3f18C73C69e6EcDb8Ebd",
  // Not live. Leave these as empty strings. Never set a placeholder address.
  stake: "",
  forge: "",
  synth: "",
};
export const LAUNCH_TIMESTAMP = 1792641171; // Verifier.protocolLaunchTimestamp (Unix seconds, America/New_York 2026-10-21 11:52:51 PM)
export const CHAIN_ID = 8453;
export const BASE_NATIVE_ETH_ASSET_ID = "0xde7085290190e1f2f7f2f83d26fa72e411f9d765ddd608a77e8a7c388113943b";
```

Also in protocolConfig.js:

- NEW_BASE_LOCK_ADDRESS (and CONTRACTS.lock, and LOCKS.Base) = the lock address above.
- For every other network's NEW_*_LOCK_ADDRESS keep the section 1 placeholder. While a placeholder is not a valid address, the Lock page must refuse that network with "Lock address not set for this network" (or "This network is not live yet.") and send nothing.
- Remove every remaining hard-coded use of these old addresses, replacing each with the matching CONTRACTS field above (compare ignoring upper or lower case): 0xb0670826 (old Verifier), 0x655273f8 (old VCLM), 0x5C5587db (old CHONX), 0x7A2c7787 (old Synth/Forge), 0xfa16a1cd (old Stake), 0x1cBbb8C2 (old Base reader), 0x968BFD5b (old Base lock). The Release page may still keep 0x968BFD5b and 0x4eDE54E1 in RETIRED_LOCKS for release of old locks only.
- PROTOCOL_TOKENS = [CONTRACTS.vclm, CONTRACTS.chonx]. isProtocolToken(address) compares ignoring upper or lower case. (There is no SYNTH address.)
- DURATIONS: Handshake minUsd 0.01 and maxUsd 0.02, feeRate 0.05; every other duration minUsd 0.01, feeRate 0.05. That is Revision 12 and matches this lock. Prefer reading HANDSHAKE_USD_MIN, HANDSHAKE_USD_MAX and STANDARD_USD_MIN from CONTRACTS.lock.

## 3. ABIs for the contracts that are actually live

Use only these ABIs. Do not use the Stake ABI, the Forge ABI, or any Verifier line that is not listed (no chonxActivationTimestamp, no CHONX_SOURCE_CLOCK_MARGIN_SECS, no syncChonxActivation, no lifetimeVclmIssued, no tokenAddressIndex, no assetRowAlias, no handshakeIdentity in the proof). Delete getLock and nextLockId from LOCK_ABI; they do not exist on this lock.

In src/lib/mintConfig.js set:

```js
import { ethers } from "ethers";

// ProofPackage for the live Verifier. There is no handshakeIdentity field.
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
  "function cumulativeVclmIssued() view returns (uint256)", // 0x1c467d64
  "function cumulativeChonxIssued() view returns (uint256)", // 0xc07f8412
  "function chonxActivated() view returns (bool)", // 0x8dae0c3c
  "function CHONX_ACTIVATION_THRESHOLD() view returns (uint256)", // 0xffeae027 = 10_000_000e18
  "function getRemainingVclmCap() view returns (uint256)", // 0x3704c08b
  "function isLockConsumed(string envId, bytes32 lockId) view returns (bool)", // 0x37e1c322
  "function isRacRecorded(bytes32) view returns (bool)", // 0x6ec9d1dc
  "function BASE_NATIVE_ETH_ASSET_ID() view returns (bytes32)", // 0xde8084c9
  "event VerificationSucceeded(bytes32 indexed lockIdHash, string sourceEnvironmentId, address indexed recipient, uint8 outputToken, uint256 amount)",
];

export const LOCK_RECORD_ABI = [
  "function environmentId() view returns (string)",
  "function devFund() view returns (address)",
  "function STANDARD_FEE_BPS() view returns (uint256)",
  "function HANDSHAKE_USD_MIN() view returns (uint256)",
  "function HANDSHAKE_USD_MAX() view returns (uint256)",
  "function STANDARD_USD_MIN() view returns (uint256)",
  "function lockRecord(bytes32) view returns (tuple(bool exists, bool released, address creator, address releaseDestination, address asset, address baseRecipient, uint8 outputToken, uint256 gross, uint256 fee, uint256 principal, uint256 duration, uint256 multiplierBps, uint256 createdAt, uint256 maturity, bytes32 assetIdentity, bytes32 valuationReference, bytes bindingPayload))",
  "event LockCreated(bytes32 indexed lockId, address indexed creator, address indexed releaseDestination, address asset, uint256 gross, uint256 fee, uint256 principal, uint256 maturity)",
  "event FeeRouted(bytes32 indexed lockId, address indexed devFund, address asset, uint256 fee)",
  "event PrincipalReleased(bytes32 indexed lockId, address indexed releaseDestination, address asset, uint256 principal)",
];

export const mintInterface = new ethers.Interface(VERIFIER_ABI);
export const lockRecordInterface = new ethers.Interface(LOCK_RECORD_ABI);
```

In src/lib/protocolConfig.js set LOCK_ABI to exactly these three write lines (selectors 0x7f22a052, 0xa271dec9, 0x67d42a8b). Use LOCK_RECORD_ABI from mintConfig.js for reads.

```js
export const LOCK_ABI = [
  "function createNativeLock(bytes32 lockId, address baseRecipient, uint8 outputToken, bytes32 assetIdentity, bytes32 valuationReference, address releaseDestination, uint256 duration, uint256 verifiedGrossUsd) payable returns (uint256 fee, uint256 principal)",
  "function createErc20Lock(bytes32 lockId, address baseRecipient, uint8 outputToken, bytes32 assetIdentity, bytes32 valuationReference, address releaseDestination, uint256 duration, address token, uint256 amount, uint256 verifiedGrossUsd) returns (uint256 fee, uint256 principal)",
  "function release(bytes32 lockId)",
];
```

READER_ABI (for CONTRACTS.baseReader):

```js
export const READER_ABI = [
  "function ENVIRONMENT_ID() view returns (string)",
  "function vault() view returns (address)",
];
```

Keep ERC20_ABI as it is (balanceOf, allowance, approve, decimals, symbol, name, totalSupply). Do not keep FORGE_ABI or STAKE_ABI in any page that can send a transaction.

## 4. Lock page: Base ETH only, for now

- The Lock page offers Base and Base ETH only. Hide every other network and every other asset. The live registry has 962 rows (the historical 961 plus Base ETH), but only Base ETH has a usable scheduled price. Any other asset reverts with "VF-ORC-005: no usable scheduled price". Do not invent a price.
- Before any lock is sent, call readMintContext (below). If it fails, show its message and send nothing.
- Fee is 5% for every duration, including the 1-hour Handshake. Show "Handshake: $0.01 to $0.02" and "Minimum $0.01".
- Pass outputToken 0 for VCLM (default). For CHONX (outputToken 1): read chonxActivated() and cumulativeVclmIssued() and CHONX_ACTIVATION_THRESHOLD(). While chonxActivated() is false, show CHONX disabled with "CHONX opens when 10,000,000 VCLM have been issued (now X)", X = floor(cumulativeVclmIssued / 1e18). Only when chonxActivated() is true is CHONX selectable. Re-read right before sending; if it is false, stop with "CHONX is not active yet. No funds were locked." and send nothing.
- Base recipient: editable field, prefilled with the connected wallet, must be a valid EVM address, shown on the review step. Pass it as baseRecipient.
- For a Base ETH lock: assetIdentity = BASE_NATIVE_ETH_ASSET_ID, valuationReference = bytes32(0), releaseDestination = the connected wallet (or the field the page already uses for release), duration from DURATIONS, verifiedGrossUsd = scheduledGrossUsd(amount, 18, price) from the scheduled price in readMintContext. Call createNativeLock with value = amount.
- Do not call createErc20Lock for any token on this deployment. There is no usable scheduled price for any Base ERC-20.

## 5. Refuse VCLM and CHONX as lock inputs (app-side)

This lock has no VF-TOK-007. Before any approve or lock:

- If the selected token address equals CONTRACTS.vclm or CONTRACTS.chonx (any letter case), or the symbol is VCLM, CHONX or SYNTH, refuse with "VCLM, CHONX and SYNTH cannot be locked. They can be staked or forged when those features are live." and send nothing.
- Apply this on every asset picker, typed address, URL value and saved state.

## 6. Mint path (src/lib/lockMint.js)

Replace the old hard-coded addresses and the old selectors. Use CONTRACTS.lock, CONTRACTS.verifier, CONTRACTS.vclm, CONTRACTS.chonx, CONTRACTS.baseReader. Selectors: recordFeeAndRac 0xf0f64b60, verifyAndMint 0x8c24712a. The proof has no handshakeIdentity.

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
10. Return { entry, price: priceUsd18, launchTimestamp }.

mintFromLock({ provider, account, lockId, receipt, onStep, onTransaction, onMinted }):

1. receipt.status must be 1 and receipt.to (lower case) must equal CONTRACTS.lock (lower case). Else refuse.
2. Read lockRecord(lockId) at receipt.blockNumber. Require exists, not released, baseRecipient non-zero, outputToken 0 or 1.
3. For outputToken 1: require verifier.chonxActivated() is true. Else: "CHONX is not active yet. This lock cannot mint. Your funds remain locked and can be released at maturity." Do not send.
4. Find the FeeRouted event for this lockId; its devFund and fee must match lock.devFund() and record.fee.
5. Build the package once and pass the same object to both calls:

```js
const encode = ethers.AbiCoder.defaultAbiCoder();
const pkg = {
  sourceEnvironmentId: "Base",
  commitmentVaultLockId: lockId,
  handshakeAllowanceCount: 3,
  canonicalAssetId: record.assetIdentity,
  assetPrecision: Number((await verifier.assetPrecisionTable(ethers.solidityPackedKeccak256(["string", "bytes32"], ["Base", record.assetIdentity]))).decimals),
  assetCustodyClass: Number((await verifier.assetPrecisionTable(ethers.solidityPackedKeccak256(["string", "bytes32"], ["Base", record.assetIdentity]))).custodyClass),
  grossAmountSmallestUnits: record.gross,
  actualFeeAmountSmallestUnits: record.fee,
  principalAmountSmallestUnits: record.principal,
  feeAssetId: record.assetIdentity,
  devFundDestination: (await lock.devFund()),
  feeTransferEvidence: receipt.hash,
  valuationTimestamp: record.createdAt,
  maturityTimestamp: record.maturity,
  durationSecs: record.duration,
  selectedOutputToken: Number(record.outputToken),
  baseRecipient: record.baseRecipient,
  releaseDestination: record.releaseDestination,
  // For VCLM send 0x. For CHONX the live Verifier only checks length > 0; send 0x01.
  chonxActivationReceipt: Number(record.outputToken) === 1 ? "0x01" : "0x",
  racIdentity: ethers.solidityPackedKeccak256(
    ["string", "bytes32", "bytes32", "uint256", "bytes32", "uint256"],
    ["Base", lockId, receipt.hash, feeLog.index, record.assetIdentity, record.fee]
  ),
  priceRecord: "0x",
  sourceFinalityProof: "0x",
  lockEventProof: encode.encode(
    ["bytes32", "uint256", "uint256", "uint256", "uint256", "uint256", "uint256"],
    [lockId, 0, 0, 0, 0, 0, 0]
  ),
};
```

(The Base reader only decodes the lock id from lockEventProof; the rest of that encoding is unused. Do not put a handshakeIdentity key on the package.)

6. Run section 10 (prepareAndConfirm) for recordFeeAndRac, then send it. Then run section 10 for verifyAndMint with the same pkg and daysSinceLaunch = 0, then send it. Keep the existing VF-FEE-011 retry: if verifyAndMint reverts with text containing "VF-FEE-011", retry once with the same stored package; do not rebuild it and do not create another lock.
7. Confirm VerificationSucceeded for this lock, and a Transfer from the zero address to record.baseRecipient on CONTRACTS.vclm (output 0) or CONTRACTS.chonx (output 1) for the same amount. Show that amount and token name.
8. Error text for "VF-COM-025: CHONX not activated": "CHONX is not active yet. This lock cannot mint. Your funds remain locked and can be released at maturity." Do not retry. (There is no "lock created before CHONX activation" revert on this Verifier.)

## 7. Turn off features that are not live

- Stake page / route / menu: show only "Staking is not live yet." Send nothing. Do not load vfClaimPlanner.js. Do not call any stake address.
- Forge page / route / menu: show only "Forging is not live yet." Send nothing.
- Any network other than Base on Lock, Mint or Release (except the retired-lock release path): show "This network is not live yet." and send nothing.
- Do not show a claimable VCLM amount, a claim button, a close-epoch button or an allocate-epoch button.

## 8. Network fees (section 10 of the earlier instruction, for every Base send)

Keep and apply the earlier section 10 helper src/lib/networkFee.js prepareAndConfirm to every transaction the app asks the user to sign on Base: approve (none needed for a native Base ETH lock), createNativeLock, release, recordFeeAndRac, verifyAndMint. Participants pay their own ETH network fee. Never deduct a fee from VCLM or CHONX. Show the estimated fee in ETH (and USD only from a price read in the last 5 minutes), the line "Estimate may change before execution. MetaMask shows the final fee.", the line "Network fees are paid in ETH by your wallet. No fee is taken from VCLM, CHONX or SYNTH.", and block the send when the wallet ETH balance is below the estimate plus the value being sent.

## 9. Acceptance checklist (operator)

Click through on the live Base app after this change. Every step is a read or a user-signed send the operator chooses; this instruction does not send anything by itself.

1. CONTRACTS in the built app equal the five addresses above; stake, forge and synth are empty; no file still contains 0xb0670826, 0x655273f8, 0x5C5587db, 0x7A2c7787, 0xfa16a1cd, 0x1cBbb8C2 or 0x968BFD5b except RETIRED_LOCKS / Release.
2. Lock page shows Base, Base ETH, fee 5%, Handshake $0.01 to $0.02, minimum $0.01. Other networks say "This network is not live yet." or "Lock address not set for this network."
3. Stake page and Forge page each show only their "not live yet" message.
4. Typing or picking VCLM or CHONX as a lock input is refused before MetaMask opens.
5. Before a Base ETH lock, the app shows an ETH fee estimate and a balance check; with too little ETH the send is blocked.
6. A small Base ETH Handshake lock ($0.01 to $0.02) can be created and then minted to VCLM for the Base recipient (operator signs; optional).
7. CHONX output is disabled while chonxActivated() is false, with the 10,000,000 VCLM message showing the current cumulativeVclmIssued.
8. A lock on any non-Base network cannot be started.
9. Release of a matured lock the operator owns still works on CONTRACTS.lock.

When done, list every file you changed and what changed in each.
