# Slither triage (Rig 7)

173 results. Verdict TP means the pattern is really present; FP means the detector pattern does not apply. Severity is ours, not Slither's.

| Detector | Slither impact | Count | Verdict | Our severity | Locations |
|---|---|---|---|---|---|
| encode-packed-collision | High | 2 | FP | info | chain-verifiers/XrplLockReader.sol:182, chain-verifiers/UtxoLockReader.sol:82 |
| reentrancy-balance | High | 1 | FP | info | VinculumFinalisStake.sol:253 |
| boolean-cst | Medium | 2 | FP | info | CommitmentVaultLock.sol:175, BaseCommitmentVaultLock.sol:154 |
| divide-before-multiply | Medium | 6 | TP | info | VinculumFinalisVerifier.sol:646, VinculumFinalisVerifier.sol:1035, VinculumFinalisStake.sol:533, VinculumFinalisVerifier.sol:981, VinculumFinalisVerifier.sol:1035, checkers/Sha512.sol:16 |
| incorrect-equality | Medium | 7 | FP | info | VinculumFinalisStake.sol:428, VinculumFinalisStake.sol:671, VinculumFinalisStake.sol:589, VinculumFinalisVerifier.sol:1139, VinculumFinalisStake.sol:253, VinculumFinalisStake.sol:671, VinculumFinalisStake.sol:611 |
| incorrect-equality | Medium | 1 | TP | high | VinculumFinalisVerifier.sol:1023 |
| reentrancy-no-eth | Medium | 3 | FP | low | VinculumFinalisVerifier.sol:763, VinculumFinalisSynth.sol:138, VinculumFinalisVerifier.sol:763 |
| uninitialized-local | Medium | 27 | FP | info | checkers/PolygonFinalityChecker.sol:91, checkers/MptProof.sol:94, checkers/ZcashHeaderChecker.sol:95, checkers/EthereumBeaconLightClient.sol:143, checkers/MptGet.sol:17, chain-verifiers/UtxoLockReader.sol:213, chain-verifiers/UtxoLockReader.sol:212, checkers/MptGet.sol:89 and 19 more |
| unused-return | Medium | 4 | FP | info | chain-verifiers/StellarLockReader.sol:118, chain-verifiers/XrplLockReader.sol:154, chain-verifiers/EvmReceiptLockReader.sol:117, chain-verifiers/UtxoLockReader.sol:111 |
| unused-return | Medium | 2 | TP | info | VinculumFinalisVerifier.sol:713, VinculumFinalisVerifier.sol:713 |
| shadowing-builtin | Low | 5 | TP | info | chain-verifiers/UtxoLockReader.sol:202, chain-verifiers/UtxoLockReader.sol:191, chain-verifiers/UtxoLockReader.sol:261, chain-verifiers/UtxoLockReader.sol:281, chain-verifiers/UtxoLockReader.sol:350 |
| calls-loop | Low | 4 | TP | low | VinculumFinalisStake.sol:496, VinculumFinalisStake.sol:231, VinculumFinalisVerifier.sol:512, VinculumFinalisVerifier.sol:512 |
| reentrancy-benign | Low | 6 | FP | info | VinculumFinalisStake.sol:428, BaseCommitmentVaultLock.sol:198, VinculumFinalisVerifier.sol:763, CommitmentVaultLock.sol:219, VinculumFinalisSynth.sol:138, VinculumFinalisStake.sol:253 |
| reentrancy-events | Low | 7 | FP | info | VinculumFinalisVerifier.sol:763, VinculumFinalisSynth.sol:138, VinculumFinalisStake.sol:253, VinculumFinalisStake.sol:428, VinculumFinalisVerifier.sol:763, VinculumFinalisStake.sol:361, VinculumFinalisStake.sol:496 |
| timestamp | Low | 24 | TP | info | VinculumFinalisStake.sol:719, VinculumFinalisStake.sol:533, VinculumFinalisStake.sol:361, BaseCommitmentVaultLock.sol:252, VinculumFinalisStake.sol:515, VinculumFinalisStake.sol:428, VinculumFinalisVerifier.sol:1139, VinculumFinalisStake.sol:341 and 16 more |
| assembly | Informational | 34 | TP | info | checkers/Sha512.sol:16, chain-verifiers/BaseLockRecordVerifier.sol:146, checkers/ZcashHeaderChecker.sol:261, checkers/Sha512.sol:61, checkers/ExecutionHeader.sol:47, checkers/RlpReader.sol:37, checkers/MptProof.sol:103, chain-verifiers/StellarLockReader.sol:135 and 26 more |
| costly-loop | Informational | 2 | TP | info | checkers/PolygonFinalityChecker.sol:43, checkers/AvalancheFinalityChecker.sol:42 |
| cyclomatic-complexity | Informational | 1 | TP | info | chain-verifiers/StellarLockReader.sol:205 |
| dead-code | Informational | 1 | TP | info | chain-verifiers/EvmReceiptLockReader.sol:174 |
| low-level-calls | Informational | 11 | TP | info | CommitmentVaultLock.sol:383, CommitmentVaultLock.sol:374, BaseCommitmentVaultLock.sol:252, CommitmentVaultLock.sol:138, checkers/Bls12381.sol:22, BaseCommitmentVaultLock.sol:362, CommitmentVaultLock.sol:273, CommitmentVaultLock.sol:183 and 3 more |
| missing-inheritance | Informational | 3 | TP | info | chain-verifiers/BaseLockRecordVerifier.sol:68, CommitmentVaultLock.sol:55, BaseCommitmentVaultLock.sol:50 |
| naming-convention | Informational | 2 | TP | info | VinculumFinalisToken.sol:95, VinculumFinalisToken.sol:95 |
| redundant-statements | Informational | 2 | TP | info | chain-verifiers/UtxoLockReader.sol:347, VinculumFinalisVerifier.sol:846 |
| too-many-digits | Informational | 8 | TP | info | checkers/BitcoinHeaderChecker.sol:59, checkers/Bls12381.sol:10, chain-verifiers/UtxoLockReader.sol:239, chain-verifiers/UtxoLockReader.sol:381, checkers/ZcashHeaderChecker.sol:23, checkers/ZcashHeaderChecker.sol:316, checkers/EthereumBeaconLightClient.sol:17, VinculumFinalisVerifier.sol:191 |
| unindexed-event-address | Informational | 4 | TP | info | VinculumFinalisVerifier.sol:379, VinculumFinalisVerifier.sol:377, VinculumFinalisToken.sol:61, VinculumFinalisVerifier.sol:376 |
| immutable-states | Optimization | 4 | TP | info | VinculumFinalisVerifier.sol:350, VinculumFinalisVerifier.sol:349, checkers/PolygonFinalityChecker.sol:26, checkers/AvalancheFinalityChecker.sol:31 |

## Reasons

- **encode-packed-collision** (FP, info): XrplLockReader: every variable field is preceded by its XRPL VL length prefix (_vl), so two inputs cannot produce the same packed bytes. UtxoLockReader constructor: keccak(env string, nativeAsset bytes) is computed once at deploy from ceremony constants, not from user input.
- **reentrancy-balance** (FP, info): Stake.createPosition measures balanceOf before and after transferFrom. The stake token is VCLM, CHONX or SYNTH (protocol tokens with no hooks or callbacks), so no reentrant call can run between the reads.
- **boolean-cst** (FP, info): foreignHeaderFinalityNotDecided returns a constant false by design (this CVL does not decide foreign header finality).
- **divide-before-multiply** (TP, info): Rounding at each step is intended: VF-COM-019 floors after every multiplier. Precision loss is at most a few wei per step and always rounds against the minter. Sha512 instance is word packing, not money math.
- **incorrect-equality** (FP, info): Strict equalities are on sentinel values (zero launch time, enum ids, zero weight), not on balances an attacker can nudge.
- **reentrancy-no-eth** (FP, low): State is written after calls only to protocol tokens (VCLM, CHONX, SYNTH mint and burnFrom) that have no callbacks. consumedLocks in verifyAndMint is written after mint; if a token with hooks were ever wired in, this would become exploitable. Checks-effects-interactions is not followed.
- **uninitialized-local** (FP, info): Counters and accumulators that rely on the Solidity default of zero.
- **unused-return** (FP, info): Tuple fields deliberately skipped: maturityTimestamp (duration is checked instead), source block hash and height from verifyFinality, and unused parts of the reader parse in extractAssetId.
- **shadowing-builtin** (TP, info): Local variables named tx shadow the tx builtin. No tx.origin use, so no effect.
- **calls-loop** (TP, low): claimPositions loops over positions with one transfer each; a long array only hurts the caller. registerTokenAddressBatch is ceremony-only and already closed.
- **reentrancy-benign** (FP, info): Same pattern as reentrancy-no-eth; callees are protocol tokens or guarded by nonReentrant (CVL createErc20Lock).
- **reentrancy-events** (FP, info): Events emitted after calls to trusted protocol tokens; ordering only.
- **timestamp** (TP, info): Epochs, maturities and price schedules depend on block.timestamp by design. A block producer can shift time by seconds, not enough to cross daily or epoch boundaries in a useful way except at the exact edge.
- **assembly** (TP, info): Inline assembly in proof parsers and hash code. Reviewed by the reader rigs, not here.
- **costly-loop** (TP, info): Storage writes inside loops in ceremony or batch paths.
- **cyclomatic-complexity** (TP, info): One very complex function; review aid only.
- **dead-code** (TP, info): Unused internal function.
- **low-level-calls** (TP, info): Low-level calls in CVL token handling and precompile calls in checkers; return values are checked.
- **missing-inheritance** (TP, info): Contracts implement an interface without declaring it.
- **naming-convention** (TP, info): Style only.
- **redundant-statements** (TP, info): No-op statements.
- **too-many-digits** (TP, info): Long literals; style only.
- **unindexed-event-address** (TP, info): Address fields in events are not indexed; off-chain filtering cost only.
- **immutable-states** (TP, info): State variables that could be immutable; gas only.

## What Slither cannot see

Slither does not model protocol semantics. The manual review in this rig found three issues no detector flags (STATIC-C01, STATIC-H02, STATIC-M01 in findings/static.json), all proven by the PoC in testing-rigs/static-poc/.
