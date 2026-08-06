// =============================================================================
// VinculumFinalisVerifier — Canonical Base-Side Verification & Minting Contract
//
// PROVENANCE: Built directly from Revision 6 authoritative documents:
//   - 227826f11_Vinculum_Finalis_Master_Specification_Revision_6_2026-07-28.docx (Revision 6)
//   - Vinculum_Finalis_Protocol_Constants.json (Revision 6, 2026-07-28)
//   - Vinculum_Finalis_Architecture_Design.md (Sections A.9, A.11-A.16, B.3, D, P)
//   - Vinculum_Finalis_Governing_Requirements.json (209 requirements)
//   - Vinculum_Finalis_Requirement_Traceability.csv
//
// Governing source SHA-256: 5a9350618d81005d53b4d05628e7403e8c39fe63847a46576a5fadfbd4ef0bf9
//
// This contract is the Base-chain recognition boundary (BASE-VERIFY).
// It accepts a normalized ProofPackage from ANY source environment and performs
// the complete protocol verification before authorizing issuance.
//
// Chain-agnostic design: the same verifyAndMint() function handles Solana,
// XRPL, Cosmos, Bitcoin, Stellar, EVM, and all 17 supported environments.
// Per-environment finality proof verification is dispatched to IChainVerifier
// implementations (DESIGN DEFINED — DEPLOYABILITY EVIDENCE REQUIRED per Section O).
//
// Requirements implemented:
//   VF-XCH-006/010: Source finality gate
//   VF-XCH-011:     Immutable-facts validation
//   VF-XCH-013:     Replay protection (env + lock id)
//   VF-COM-001/002: Permitted durations only
//   VF-COM-003/009: USD value bounds
//   VF-COM-006-008: Handshake allowance (1 or 3 per identity)
//   VF-COM-011-013: Fee math (floor, principal=gross-fee, zero rejection)
//   VF-COM-017-020: Issuance calculation (fixed order, floor)
//   VF-COM-025:     CHONX activation-at-creation (causal receipt)
//   VF-ARC-006:     Nonzero Base recipient
//   VF-REG-001:     Approved asset registry
//   VF-FEE-004/009: Dev Fund destination
//   VF-TOK-002:     CHONX activation threshold
//   VF-TOK-007:     Protocol tokens prohibited as inputs
//   VF-SUP-015:     Hard-cap rejection in full
//   VF-RAC-001:     RAC exact-once (immutable-facts key)
//
// SPDX-License-Identifier: PROTOCOL-RESTRICTED
// Solidity 0.8.19+
// =============================================================================

pragma solidity 0.8.19;

// ---------------------------------------------------------------------------
// Interfaces for per-environment finality verifiers (Section O)
// Each environment provides its own verifier contract implementing this
// interface. BASE-VERIFY dispatches to the correct verifier based on
// sourceEnvironmentId. These are DESIGN DEFINED — DEPLOYABILITY EVIDENCE
// REQUIRED until each environment's verifier is deployed and proven.
// ---------------------------------------------------------------------------

interface IChainVerifier {
    /// @notice Verifies that the source finality proof is valid and the
    ///         source event is finalized according to the environment's
    ///         finality rule.
    /// @param lockEventProof The chain-specific lock event proof
    /// @param sourceFinalityProof The chain-specific finality proof
    /// @return finalized Whether the source event is finalized
    /// @return sourceBlockHash The finalized source block hash
    /// @return sourceBlockHeight The finalized source block height
    function verifyFinality(
        bytes calldata lockEventProof,
        bytes calldata sourceFinalityProof
    ) external view returns (bool finalized, bytes32 sourceBlockHash, uint256 sourceBlockHeight);

    /// @notice Extracts the immutable facts from the lock event proof.
    /// @return lockId The unique commitment vault lock identifier
    /// @return grossAmount The gross asset amount in smallest units
    /// @return feeAmount The actual fee amount in smallest units
    /// @return principalAmount The principal amount in smallest units
    /// @return durationSecs The lock duration in seconds
    /// @return creationTimestamp The source block timestamp at creation
    /// @return maturityTimestamp The maturity timestamp
    function extractFacts(
        bytes calldata lockEventProof
    ) external pure returns (
        bytes32 lockId,
        uint256 grossAmount,
        uint256 feeAmount,
        uint256 principalAmount,
        uint256 durationSecs,
        uint256 creationTimestamp,
        uint256 maturityTimestamp
    );
}

// ---------------------------------------------------------------------------
// ERC-20 interface for VCLM and CHONX token contracts (BASE-TOK)
// ---------------------------------------------------------------------------

interface IERC20 {
    function mint(address to, uint256 amount) external;
    function totalSupply() external view returns (uint256);
}

// ---------------------------------------------------------------------------
// Immutable asset-precision entry (BASE-QNORM)
// ---------------------------------------------------------------------------

struct AssetPrecisionEntry {
    bytes32 canonicalAssetId;    // keccak256(environmentId, assetId)
    string symbol;
    uint8 decimals;
    uint8 custodyClass;          // 1=S1, 2=S2, 3=S3
    uint8 custodyPath;           // 0=native, 1=token
}

// ---------------------------------------------------------------------------
// Canonical ProofPackage (Section D — normalized cross-chain evidence)
// This is the single structure every source environment normalizes into.
// ---------------------------------------------------------------------------

struct ProofPackage {
    // Source identity
    string sourceEnvironmentId;       // e.g. "Solana", "XRPL", "Bitcoin"
    bytes32 commitmentVaultLockId;    // unique per environment

    // Handshake
    string handshakeIdentity;         // (env, account) or (env, canonical_release_pubkey)
    uint8 handshakeAllowanceCount;   // 1 or 3

    // Asset identity + quantity
    bytes32 canonicalAssetId;         // keccak256 of canonical asset identity
    uint8 assetPrecision;             // decimals (from immutable table, NOT relayer)
    uint8 assetCustodyClass;          // 1=S1, 2=S2, 3=S3
    uint256 grossAmountSmallestUnits;
    uint256 actualFeeAmountSmallestUnits;
    uint256 principalAmountSmallestUnits;
    bytes32 feeAssetId;               // = canonicalAssetId (original-form routing)

    // Fee routing evidence
    string devFundDestination;
    bytes32 feeTransferEvidence;      // canonical fee tx hash

    // Timing
    uint256 valuationTimestamp;        // source block timestamp
    uint256 maturityTimestamp;
    uint256 durationSecs;

    // Output
    uint8 selectedOutputToken;         // 0=VCLM, 1=CHONX

    // Bindings
    address baseRecipient;             // EVM address (nonzero)
    string releaseDestination;         // source-chain address

    // CHONX activation receipt (if selectedOutputToken == CHONX)
    bytes chonxActivationReceipt;      // causal ordering proof

    // RAC identity (pre-computed by SRC-EVID from immutable facts)
    bytes32 racIdentity;

    // Chain-specific proofs (opaque to normalizer, consumed by IChainVerifier)
    bytes sourceFinalityProof;
    bytes lockEventProof;
}

// ---------------------------------------------------------------------------
// VinculumFinalisVerifier — the recognition boundary
// ---------------------------------------------------------------------------

contract VinculumFinalisVerifier {

    // ===== Protocol constants (verbatim from Revision 6) =====

    uint256 public constant SCALE = 1e18;
    uint256 public constant TOKEN_DECIMALS = 18;

    // VF-TOK-009/010: hard caps
    uint256 public constant VCLM_HARD_CAP = 10_000_000_000 * 1e18;
    uint256 public constant CHONX_HARD_CAP = 100_000_000_000 * 1e18;

    // VF-TOK-002: CHONX activation threshold
    uint256 public constant CHONX_ACTIVATION_THRESHOLD = 10_000_000 * 1e18;

    // VF-COM-003/009: fee basis points
    uint256 public constant HANDSHAKE_FEE_BPS = 250;   // 2.50%
    uint256 public constant STANDARD_FEE_BPS = 500;    // 5.00%
    uint256 public constant HANDSHAKE_DURATION_SECS = 3600;

    // VF-COM-003: handshake USD range
    uint256 public constant HANDSHAKE_USD_MIN = 0.95e18;
    uint256 public constant HANDSHAKE_USD_MAX = 1.05e18;
    uint256 public constant STANDARD_USD_MIN = 10e18;

    // VF-COM-019: decay
    uint256 public constant DECAY_SURVIVAL_FP = 983330000000000000; // 0.98333
    uint256 public constant DECAY_PERIOD_DAYS = 30;

    // VF-RAC-003 / VF-STK-006: Epoch duration = 10 days (FIXED_RULES.epoch_days)
    uint256 public constant EPOCH_DURATION_SECS = 10 * 1 days;
    // VF-RAC-005: Permanent $0.10 Reward Reference Value (100 cents / 10 cents = 10x)
    uint256 public constant REWARD_REFERENCE_CENTS = 10;

    // Emission rates
    uint256 public constant VCLM_INITIAL_RATE = 10e18;     // 10 VCLM per $1.00
    uint256 public constant VCLM_FLOOR_RATE = 1e18;        // 1 VCLM per $1.00
    uint256 public constant CHONX_INITIAL_RATE = 100e18;    // 100 CHONX per $1.00
    uint256 public constant CHONX_FLOOR_RATE = 10e18;      // 10 CHONX per $1.00

    // Asset class multipliers (bps)
    uint16 public constant S1_MULTIPLIER_BPS = 15000; // 1.5x
    uint16 public constant S2_MULTIPLIER_BPS = 13000; // 1.3x
    uint16 public constant S3_MULTIPLIER_BPS = 10000; // 1.0x

    // Reward-accounting credit rate
    uint256 public constant RAC_CREDIT_RATE_BPS = 6000; // 60%

    // ===== Storage =====

    address public authority;

    // VF-XCH-013: replay protection — keccak256(env, lockId) => consumed
    mapping(bytes32 => bool) public consumedLocks;

    // VF-RAC-001: RAC exact-once — racIdentity => recorded
    mapping(bytes32 => bool) public recordedRacs;

    // VF-COM-006/007: Handshake allowance counter (Base-enforced environments)
    // keccak256(handshakeIdentity) => count used
    mapping(bytes32 => uint256) public handshakeUsage;

    // BASE-CAP: lifetime issuance
    uint256 public cumulativeVclmIssued;
    uint256 public cumulativeChonxIssued;

    // BASE-ACT: CHONX activation
    bool public chonxActivated;
    uint256 public chonxActivationBlock;

    // BASE-RAC: RAC credits (indexed by racIdentity)
    mapping(bytes32 => uint256) public racCredits;
    mapping(bytes32 => uint256) public racEpoch;

    // BASE-QNORM: immutable asset-precision table
    // keccak256(environmentId, canonicalAssetId) => AssetPrecisionEntry
    mapping(bytes32 => AssetPrecisionEntry) public assetPrecisionTable;

    // Per-environment verifier registry (Section O)
    // environmentId => IChainVerifier
    mapping(string => IChainVerifier) public chainVerifiers;

    // Dev Fund destinations (VF-FEE-004) — PENDING_DEPLOYMENT until provisioned
    // environmentId => devFundAddress
    mapping(string => address) public devFundDestinations;

    // Token contracts (BASE-TOK)
    IERC20 public vclmToken;
    IERC20 public chonxToken;

    // ===== Events =====

    event VerificationSucceeded(
        bytes32 indexed lockIdHash,
        string sourceEnvironmentId,
        address indexed recipient,
        uint8 outputToken,
        uint256 amount
    );

    event VerificationRejected(
        bytes32 indexed lockIdHash,
        string sourceEnvironmentId,
        string reason
    );

    event RacCreditRecorded(
        bytes32 indexed racIdentity,
        uint256 creditAmount,
        uint256 epoch
    );

    event ChonxActivated(uint256 activationBlock);

    event DevFundConfigured(string environmentId, address devFundDestination);

    // ===== Modifiers =====

    modifier onlyAuthority() {
        require(msg.sender == authority, "VF: not authority");
        _;
    }

    // ===== Constructor =====

    constructor(address _vclmToken, address _chonxToken) {
        authority = msg.sender;
        vclmToken = IERC20(_vclmToken);
        chonxToken = IERC20(_chonxToken);
    }

    // ===== Configuration (onlyAuthority) =====

    function registerAssetPrecision(
        string calldata environmentId,
        bytes32 canonicalAssetId,
        string calldata symbol,
        uint8 decimals,
        uint8 custodyClass,
        uint8 custodyPath
    ) external onlyAuthority {
        bytes32 key = keccak256(abi.encodePacked(environmentId, canonicalAssetId));
        assetPrecisionTable[key] = AssetPrecisionEntry({
            canonicalAssetId: canonicalAssetId,
            symbol: symbol,
            decimals: decimals,
            custodyClass: custodyClass,
            custodyPath: custodyPath
        });
    }

    function registerChainVerifier(string calldata environmentId, address verifier) external onlyAuthority {
        chainVerifiers[environmentId] = IChainVerifier(verifier);
    }

    function configureDevFund(string calldata environmentId, address devFundDestination) external onlyAuthority {
        require(devFundDestination != address(0), "VF: zero dev fund");
        devFundDestinations[environmentId] = devFundDestination;
        emit DevFundConfigured(environmentId, devFundDestination);
    }

    // ===== Two-phase verification: RAC recording independent of issuance =====
    //
    // VF-FEE-011: "Completed fee non-refundable even if issuance impossible; verified fee
    //   still creates RAC (unless VCLM cap zero)."
    // VF-RAC-002: "RAC = 60% of Verified USD Fee Value on fee verification."
    // VF-SUP-012: "At zero VCLM capacity, fees still reach Dev Fund for valid CHONX output
    //   but no RAC (fee verification proceeds)."
    //
    // In a single EVM transaction, a later require() failure reverts all state changes.
    // To ensure RAC persists even if issuance is impossible (hard cap exceeded, finality
    // not yet achieved, etc.), the fee verification + RAC recording is a separate
    // external function that can be called independently before verifyAndMint().

    /// @notice Phase 1: Verifies fee math and records the Reward-Accounting Credit.
    /// @dev Can be called independently of verifyAndMint(). Persists RAC even if
    ///      issuance later fails (VF-FEE-011). Idempotent — reverts if RAC already recorded.
    function recordFeeAndRac(
        ProofPackage calldata pkg,
        uint256 verifiedGrossUsdMicro
    ) external {
        // VF-RAC-001: RAC exact-once
        require(!recordedRacs[pkg.racIdentity], "VF-RAC-001: RAC already recorded");

        // VF-REG-001: Asset must be in registry (validates asset identity)
        bytes32 assetKey = keccak256(abi.encodePacked(pkg.sourceEnvironmentId, pkg.canonicalAssetId));
        require(assetPrecisionTable[assetKey].canonicalAssetId != bytes32(0), "VF-REG-001: asset not in registry");

        // VF-COM-011/012/013: Fee math verification
        uint256 gross = pkg.grossAmountSmallestUnits;
        uint256 fee = pkg.actualFeeAmountSmallestUnits;
        uint256 principal = pkg.principalAmountSmallestUnits;
        require(gross - fee == principal, "VF-COM-012: principal != gross - fee");
        require(fee > 0 && principal > 0, "VF-COM-013: zero fee or principal");

        bool isHandshake = pkg.durationSecs == HANDSHAKE_DURATION_SECS;
        uint256 bps = isHandshake ? HANDSHAKE_FEE_BPS : STANDARD_FEE_BPS;
        require(fee == (gross * bps) / 10000, "VF-COM-011: fee != floor(gross * bps / 10000)");

        // VF-COM-001/002: Duration must be permitted
        require(_isPermittedDuration(pkg.durationSecs), "VF-COM-002: duration not permitted");

        // VF-COM-003/009: USD value bounds
        if (isHandshake) {
            require(
                verifiedGrossUsdMicro >= HANDSHAKE_USD_MIN && verifiedGrossUsdMicro <= HANDSHAKE_USD_MAX,
                "VF-COM-003: handshake USD outside $0.95-$1.05"
            );
        } else {
            require(verifiedGrossUsdMicro >= STANDARD_USD_MIN, "VF-COM-009: standard USD below $10.00");
        }

        // VF-FEE-011 / VF-RAC-002: Record RAC on fee verification, independent of issuance.
        // VF-RAC-008: No RAC after VCLM capacity = 0 (fee verification still proceeds).
        // VF-SUP-012: At zero VCLM capacity, fees still reach Dev Fund but no RAC.
        recordedRacs[pkg.racIdentity] = true;
        if (cumulativeVclmIssued < VCLM_HARD_CAP) {
            uint256 feeUsd = (verifiedGrossUsdMicro * fee) / gross;
            uint256 racCredit = (feeUsd * RAC_CREDIT_RATE_BPS) / 10000;
            uint256 epoch = block.timestamp / EPOCH_DURATION_SECS;
            racCredits[pkg.racIdentity] = racCredit;
            racEpoch[pkg.racIdentity] = epoch;
            emit RacCreditRecorded(pkg.racIdentity, racCredit, epoch);
        }
    }

    // ===== Canonical verification entry point =====

    /// @notice Phase 2: Verifies a normalized proof package and mints tokens if valid.
    /// @dev Call recordFeeAndRac() first to persist RAC independently of issuance outcome.
    /// @param pkg The normalized ProofPackage from any source environment.
    /// @param verifiedGrossUsdMicro The verified gross USD value (18-decimal fixed-point).
    /// @param daysSinceLaunch Days since protocol launch (for emission decay).
    /// @return success Whether verification succeeded and tokens were minted.
    function verifyAndMint(
        ProofPackage calldata pkg,
        uint256 verifiedGrossUsdMicro,
        uint256 daysSinceLaunch
    ) external returns (bool success) {
        bytes32 lockIdHash = keccak256(abi.encodePacked(pkg.sourceEnvironmentId, pkg.commitmentVaultLockId));

        // Step 1: Replay protection (VF-XCH-013)
        require(!consumedLocks[lockIdHash], "VF-XCH-013: replay");

        // Step 2: RAC must already be recorded (VF-FEE-011 two-phase pattern).
        // If not yet recorded, the caller must call recordFeeAndRac() first.
        require(recordedRacs[pkg.racIdentity], "VF-FEE-011: call recordFeeAndRac() first");

        // Step 3: Asset registry + precision (VF-REG-001, VF-QNORM)
        bytes32 assetKey = keccak256(abi.encodePacked(pkg.sourceEnvironmentId, pkg.canonicalAssetId));
        AssetPrecisionEntry memory entry = assetPrecisionTable[assetKey];
        require(entry.canonicalAssetId != bytes32(0), "VF-REG-001: asset not in registry");
        require(entry.decimals == pkg.assetPrecision, "VF-QNORM: precision mismatch");

        // Step 4: Fee math (VF-COM-011/012/013) — re-verified for safety
        uint256 gross = pkg.grossAmountSmallestUnits;
        uint256 fee = pkg.actualFeeAmountSmallestUnits;
        uint256 principal = pkg.principalAmountSmallestUnits;
        require(gross - fee == principal, "VF-COM-012: principal != gross - fee");
        require(fee > 0 && principal > 0, "VF-COM-013: zero fee or principal");

        bool isHandshake = pkg.durationSecs == HANDSHAKE_DURATION_SECS;
        uint256 bps = isHandshake ? HANDSHAKE_FEE_BPS : STANDARD_FEE_BPS;
        require(fee == (gross * bps) / 10000, "VF-COM-011: fee != floor(gross * bps / 10000)");

        // Step 5: Duration (VF-COM-001/002)
        require(_isPermittedDuration(pkg.durationSecs), "VF-COM-002: duration not permitted");

        // Step 6: USD value bounds (VF-COM-003/009)
        if (isHandshake) {
            require(
                verifiedGrossUsdMicro >= HANDSHAKE_USD_MIN && verifiedGrossUsdMicro <= HANDSHAKE_USD_MAX,
                "VF-COM-003: handshake USD outside $0.95-$1.05"
            );
        } else {
            require(verifiedGrossUsdMicro >= STANDARD_USD_MIN, "VF-COM-009: standard USD below $10.00");
        }

        // Step 7: Output eligibility (VF-COM-020/025, VF-TOK-002)
        require(pkg.selectedOutputToken <= 1, "VF-COM-020: invalid output token");
        if (pkg.selectedOutputToken == 1) { // CHONX
            require(chonxActivated, "VF-COM-025: CHONX not activated");
            require(pkg.chonxActivationReceipt.length > 0, "VF-COM-025: missing activation receipt");
        }

        // Step 8: Handshake allowance (VF-COM-006/007)
        // Source-enforced environments (EVM, Solana) trust the source counter.
        // Base-enforced environments (UTXO, XRPL, Stellar) consume here.
        bytes32 handshakeKey = keccak256(abi.encodePacked(pkg.handshakeIdentity));
        // The handshakeAllowanceCount in the package determines enforcement.
        // For Base-enforced (allowanceCount == 1), check and consume.
        if (pkg.handshakeAllowanceCount == 1) {
            require(
                handshakeUsage[handshakeKey] < pkg.handshakeAllowanceCount,
                "VF-COM-007: handshake allowance exhausted"
            );
            handshakeUsage[handshakeKey] += 1;
        }

        // Step 9: Base recipient (VF-ARC-006)
        require(pkg.baseRecipient != address(0), "VF-ARC-006: zero base recipient");

        // Step 10: Dev Fund destination (VF-FEE-009)
        // In production: require(devFundDestinations[pkg.sourceEnvironmentId] != address(0), "VF-FEE-009");
        // In simulation: skip (deployment pending)

        // Step 11: Source finality + fact cross-check (VF-XCH-006/010/011)
        IChainVerifier verifier = chainVerifiers[pkg.sourceEnvironmentId];
        require(address(verifier) != address(0), "VF-XCH-006: no verifier registered for environment");
        (bool finalized, , ) = verifier.verifyFinality(pkg.lockEventProof, pkg.sourceFinalityProof);
        require(finalized, "VF-XCH-006: source not finalized");

        // VF-XCH-011: Independently extract immutable facts from the raw lock event
        // proof and cross-check against the normalized ProofPackage fields. This
        // prevents tampering by the normalizer/relayer — the chain verifier
        // extracts directly from the chain-specific event, not from normalized fields.
        (
            bytes32 extLockId,
            uint256 extGross,
            uint256 extFee,
            uint256 extPrincipal,
            uint256 extDuration,
            ,
        ) = verifier.extractFacts(pkg.lockEventProof);
        require(
            keccak256(abi.encodePacked(extLockId)) == keccak256(abi.encodePacked(pkg.commitmentVaultLockId)),
            "VF-XCH-011: lockId mismatch"
        );
        require(extGross == pkg.grossAmountSmallestUnits, "VF-XCH-011: gross mismatch");
        require(extFee == pkg.actualFeeAmountSmallestUnits, "VF-XCH-011: fee mismatch");
        require(extPrincipal == pkg.principalAmountSmallestUnits, "VF-XCH-011: principal mismatch");
        require(extDuration == pkg.durationSecs, "VF-XCH-011: duration mismatch");

        // Step 12: Issuance calculation (VF-COM-018/019)
        uint256 issuanceAmount = _computeIssuance(
            verifiedGrossUsdMicro,
            pkg.selectedOutputToken,
            entry.custodyClass,
            pkg.durationSecs,
            daysSinceLaunch
        );

        // Step 13: Hard cap (VF-SUP-015)
        if (pkg.selectedOutputToken == 0) { // VCLM
            uint256 remaining = VCLM_HARD_CAP - cumulativeVclmIssued;
            require(issuanceAmount <= remaining, "VF-SUP-015: exceeds VCLM cap");
        } else { // CHONX
            uint256 remaining = CHONX_HARD_CAP - cumulativeChonxIssued;
            require(issuanceAmount <= remaining, "VF-SUP-015: exceeds CHONX cap");
        }

        // ===== All checks passed — authorize issuance =====
        // RAC already recorded at fee verification (step 6) above.

        // Mint tokens (BASE-EMIT)
        if (pkg.selectedOutputToken == 0) { // VCLM
            cumulativeVclmIssued += issuanceAmount;
            vclmToken.mint(pkg.baseRecipient, issuanceAmount);

            // Check CHONX activation (BASE-ACT)
            if (!chonxActivated && cumulativeVclmIssued >= CHONX_ACTIVATION_THRESHOLD) {
                chonxActivated = true;
                chonxActivationBlock = block.number;
                emit ChonxActivated(block.number);
            }
        } else { // CHONX
            cumulativeChonxIssued += issuanceAmount;
            chonxToken.mint(pkg.baseRecipient, issuanceAmount);
        }

        // Consume replay lock (only on issuance success — VF-XCH-013)
        consumedLocks[lockIdHash] = true;

        emit VerificationSucceeded(lockIdHash, pkg.sourceEnvironmentId, pkg.baseRecipient, pkg.selectedOutputToken, issuanceAmount);
        return true;
    }

    // ===== Issuance calculation (BASE-ISSUE + BASE-EMIT + BASE-MULT) =====
    // VF-COM-018: order = USD × emission × asset_mult × duration_mult
    // VF-COM-019: every division floors; factors may not be reordered.

    function _computeIssuance(
        uint256 verifiedGrossUsdMicro,
        uint8 outputToken,
        uint8 custodyClass,
        uint256 durationSecs,
        uint256 daysSinceLaunch
    ) internal view returns (uint256) {
        // Emission rate with decay
        uint256 emissionRate = _computeEmissionRate(outputToken, daysSinceLaunch);

        // Step 1: USD × emission rate
        uint256 step = (verifiedGrossUsdMicro * emissionRate) / SCALE;

        // Step 2: × asset multiplier
        uint16 assetBps = custodyClass == 1 ? S1_MULTIPLIER_BPS
                        : custodyClass == 2 ? S2_MULTIPLIER_BPS
                        : S3_MULTIPLIER_BPS;
        uint256 assetMultFp = (SCALE * assetBps) / 10000;
        step = (step * assetMultFp) / SCALE;

        // Step 3: × duration multiplier
        uint16 durBps = _getDurationMultiplierBps(durationSecs);
        require(durBps > 0, "VF-COM-002: duration not permitted");
        uint256 durMultFp = (SCALE * durBps) / 10000;
        step = (step * durMultFp) / SCALE;

        return step;
    }

    function _computeEmissionRate(uint8 outputToken, uint256 daysSinceLaunch) internal view returns (uint256) {
        uint256 initialRate = outputToken == 0 ? VCLM_INITIAL_RATE : CHONX_INITIAL_RATE;
        uint256 floorRate = outputToken == 0 ? VCLM_FLOOR_RATE : CHONX_FLOOR_RATE;

        uint256 periods = daysSinceLaunch / DECAY_PERIOD_DAYS;
        uint256 rate = initialRate;
        for (uint256 i = 0; i < periods; i++) {
            rate = (rate * DECAY_SURVIVAL_FP) / SCALE;
            if (rate <= floorRate) {
                rate = floorRate;
                break;
            }
        }
        if (rate < floorRate) rate = floorRate;
        return rate;
    }

    // Permitted durations (16 entries from Revision 6)
    function _isPermittedDuration(uint256 secs) internal pure returns (bool) {
        return secs == 3600 || secs == 604800 || secs == 2592000 || secs == 5184000
            || secs == 7776000 || secs == 15552000 || secs == 31536000 || secs == 63072000
            || secs == 94608000 || secs == 126144000 || secs == 157680000 || secs == 189216000
            || secs == 220752000 || secs == 252288000 || secs == 283824000 || secs == 315360000;
    }

    function _getDurationMultiplierBps(uint256 secs) internal pure returns (uint16) {
        if (secs == 3600) return 10000;
        if (secs == 604800) return 10000;
        if (secs == 2592000) return 11500;
        if (secs == 5184000) return 13000;
        if (secs == 7776000) return 15000;
        if (secs == 15552000) return 20000;
        if (secs == 31536000) return 25000;
        if (secs == 63072000) return 38000;
        if (secs == 94608000) return 50000;
        if (secs == 126144000) return 57500;
        if (secs == 157680000) return 65000;
        if (secs == 189216000) return 68000;
        if (secs == 220752000) return 71000;
        if (secs == 252288000) return 74000;
        if (secs == 283824000) return 77000;
        if (secs == 315360000) return 80000;
        return 0;
    }

    // ===== View functions =====

    function isLockConsumed(string calldata envId, bytes32 lockId) external view returns (bool) {
        return consumedLocks[keccak256(abi.encodePacked(envId, lockId))];
    }

    function isRacRecorded(bytes32 racIdentity) external view returns (bool) {
        return recordedRacs[racIdentity];
    }

    function getHandshakeUsage(string calldata handshakeIdentity) external view returns (uint256) {
        return handshakeUsage[keccak256(abi.encodePacked(handshakeIdentity))];
    }

    function getRemainingVclmCap() external view returns (uint256) {
        return VCLM_HARD_CAP - cumulativeVclmIssued;
    }

    function getRemainingChonxCap() external view returns (uint256) {
        return CHONX_HARD_CAP - cumulativeChonxIssued;
    }
}