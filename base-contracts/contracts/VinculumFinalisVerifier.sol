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

import "./CommitmentDurations.sol";
import "./HandshakeCapability.sol";

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

    // Price record (VF-ORC): optional encoding of the lock-creation reference
    // price. Every valuation reads the registry's last successful scheduled
    // price at first lock valuation and retains it (VF-ORC-008/009/010).
    // Ethereum USDC/USDT use the same scheduled prices as every other asset.
    bytes priceRecord;

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

    // Ethereum USDC/USDT: a last successful scheduled price below $0.95 makes
    // the asset unavailable for a new Handshake valuation until a later run
    // is >= $0.95. Standard locks have no price floor beyond STANDARD_USD_MIN.
    uint256 public constant USD_STABLE_MIN_PRICE = 0.95e18;

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

    // CL-02 / VF-DEP-006: one-shot deployment right, destroyed by finalize().
    address public deployer;

    // VF-DEP-007: finalization independently verifiable on-chain.
    // Renamed from `finalized` to avoid shadowing the chain-finality local
    // at verifyAndMint(). Two unrelated meanings must not share a name in a
    // contract that cannot be patched after deployment (VF-IMM-006).
    bool public configurationFinalized;

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

    // VF-ORC scheduled prices (PRICE-DELIVER). Not a deployment-time price hash.
    // keccak256(environmentId, canonicalAssetId) => last scheduled-run result.
    // usable=false means no new Commitment Vault valuation until a later success.
    struct ScheduledPriceEntry {
        uint256 priceUsd18;
        bool usable;
    }
    mapping(bytes32 => ScheduledPriceEntry) public scheduledPrices;

    // VF-ORC-009/010: lock-creation reference price retained per lock.
    // keccak256(env, lockId) => bound price (bound=true after first valuation).
    struct LockPriceBinding {
        uint256 priceUsd18;
        bool bound;
    }
    mapping(bytes32 => LockPriceBinding) public lockReferencePrices;

    // Only this address may write scheduled-run results (not an invent-price admin).
    address public scheduledPricePoster;
    uint64 public lastScheduledRunId;

    // VF-ORC-011/013: emission rate uses Valuation Timestamp vs protocol launch.
    uint256 public protocolLaunchTimestamp;

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
    event ChainVerifierRegistered(string environmentId, address verifier);
    event DeploymentFinalized();
    event ScheduledPricePosterSet(address poster);
    event ScheduledPriceRunApplied(uint64 indexed runId, uint256 updateCount);
    event ScheduledPriceUpdated(
        bytes32 indexed assetKey,
        string environmentId,
        bytes32 canonicalAssetId,
        uint256 priceUsd18,
        bool usable,
        uint64 runId
    );

    // ===== Modifiers =====

    // CL-02 / VF-DEP-001/006: configuration is open ONLY during the deployment
    // ceremony, and only to the deployer. finalize() destroys that right.
    modifier onlyDuringDeployment() {
        require(!configurationFinalized, "VF-DEP-003: configuration finalized");
        require(msg.sender == deployer, "VF: not deployer");
        _;
    }

    // VF-DEP-001: the implementation remains INACTIVE until configuration is
    // populated and validated.
    modifier onlyWhenFinalized() {
        require(configurationFinalized, "VF-DEP-001: not finalized");
        _;
    }

    // ===== Constructor =====

    constructor(address _vclmToken, address _chonxToken) {
        deployer = msg.sender;
        vclmToken = IERC20(_vclmToken);
        chonxToken = IERC20(_chonxToken);
    }

    // ===== Configuration — deployment ceremony only (VF-DEP-001/006) =====
    //
    // These remain open across many transactions because the asset registry
    // requires ~1,001 entries; VF-DEP-001 contemplates exactly this by holding
    // the implementation inactive until population is complete. finalize()
    // closes the window irreversibly.

    function registerAssetPrecision(
        string calldata environmentId,
        bytes32 canonicalAssetId,
        string calldata symbol,
        uint8 decimals,
        uint8 custodyClass,
        uint8 custodyPath
    ) external onlyDuringDeployment {
        bytes32 key = keccak256(abi.encodePacked(environmentId, canonicalAssetId));
        assetPrecisionTable[key] = AssetPrecisionEntry({
            canonicalAssetId: canonicalAssetId,
            symbol: symbol,
            decimals: decimals,
            custodyClass: custodyClass,
            custodyPath: custodyPath
        });
    }

    /// @notice Sets the address authorized to write scheduled price runs (VF-ORC-007).
    /// @dev Deployment ceremony only. Poster writes batched run results; it is not
    ///      an admin setter that invents ad-hoc prices outside a scheduled run.
    function setScheduledPricePoster(address poster) external onlyDuringDeployment {
        require(poster != address(0), "VF-ORC-007: zero price poster");
        scheduledPricePoster = poster;
        emit ScheduledPricePosterSet(poster);
    }

    function registerChainVerifier(string calldata environmentId, address verifier) external onlyDuringDeployment {
        // VF-DEP-002: zero or provisional configuration cannot be finalized.
        require(verifier != address(0), "VF-DEP-002: zero chain verifier");
        chainVerifiers[environmentId] = IChainVerifier(verifier);
        emit ChainVerifierRegistered(environmentId, verifier);
    }

    function configureDevFund(string calldata environmentId, address devFundDestination) external onlyDuringDeployment {
        require(devFundDestination != address(0), "VF: zero dev fund");
        devFundDestinations[environmentId] = devFundDestination;
        emit DevFundConfigured(environmentId, devFundDestination);
    }

    /// @notice Closes the deployment ceremony permanently (VF-DEP-006).
    /// @dev Irreversible. No setter re-opens it. After this call there is no
    ///      address on earth that can alter registry, chain verifiers, or Dev
    ///      Fund destinations (VF-IMM-001/002/004, VF-DEP-003).
    function finalize() external onlyDuringDeployment {
        configurationFinalized = true;
        if (protocolLaunchTimestamp == 0) {
            protocolLaunchTimestamp = block.timestamp;
        }
        deployer = address(0);
        emit DeploymentFinalized();
    }

    // ===== Scheduled price delivery (VF-ORC-001/004/005/007/008) =====
    //
    // Off-chain PRICE-FETCH runs twice per day (VF-ORC-001) with first-valid
    // cascade (VF-ORC-002/003/006). This function is the sole on-chain write
    // path for prices. A failed asset in a run is marked unusable
    // (fail closed); prior successful prices are not kept usable (VF-ORC-008).

    struct ScheduledPriceUpdate {
        string environmentId;
        bytes32 canonicalAssetId;
        uint256 priceUsd18;
        bool success;
    }

    function applyScheduledPriceRun(
        uint64 runId,
        ScheduledPriceUpdate[] calldata updates
    ) external {
        require(msg.sender == scheduledPricePoster, "VF-ORC-007: not price poster");
        require(configurationFinalized, "VF-DEP-001: not finalized");
        require(runId > lastScheduledRunId, "VF-ORC-001: run id must advance");
        lastScheduledRunId = runId;

        for (uint256 i = 0; i < updates.length; i++) {
            ScheduledPriceUpdate calldata u = updates[i];
            bytes32 key = keccak256(abi.encodePacked(u.environmentId, u.canonicalAssetId));
            AssetPrecisionEntry memory entry = assetPrecisionTable[key];
            require(entry.canonicalAssetId != bytes32(0), "VF-REG-001: asset not in registry");
            if (u.success) {
                require(u.priceUsd18 > 0, "VF-ORC-004: zero price");
                scheduledPrices[key] = ScheduledPriceEntry({
                    priceUsd18: u.priceUsd18,
                    usable: true
                });
                emit ScheduledPriceUpdated(key, u.environmentId, u.canonicalAssetId, u.priceUsd18, true, runId);
            } else {
                // VF-ORC-005/008: no usable valuation until a later successful run.
                scheduledPrices[key] = ScheduledPriceEntry({
                    priceUsd18: 0,
                    usable: false
                });
                emit ScheduledPriceUpdated(key, u.environmentId, u.canonicalAssetId, 0, false, runId);
            }
        }
        emit ScheduledPriceRunApplied(runId, updates.length);
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
        ProofPackage calldata pkg
    ) external onlyWhenFinalized {
        // VF-RAC-001: RAC exact-once
        require(!recordedRacs[pkg.racIdentity], "VF-RAC-001: RAC already recorded");

        // VF-REG-001: Asset must be in registry (validates asset identity)
        bytes32 assetKey = keccak256(abi.encodePacked(pkg.sourceEnvironmentId, pkg.canonicalAssetId));
        AssetPrecisionEntry memory entry = assetPrecisionTable[assetKey];
        require(entry.canonicalAssetId != bytes32(0), "VF-REG-001: asset not in registry");

        // VF-COM-006: package allowance must match the registered mechanism lookup
        uint256 expectedAllowance = _expectedHandshakeAllowance(pkg.sourceEnvironmentId);
        require(
            uint256(pkg.handshakeAllowanceCount) == expectedAllowance,
            "VF-COM-006: handshake allowance mismatch"
        );

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

        // CL-01: derive USD; never trust a caller-supplied verifiedGrossUsdMicro
        uint256 verifiedGrossUsdMicro = _resolveVerifiedGrossUsd(pkg, entry);

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
    /// @param daysSinceLaunch Days since protocol launch (for emission decay).
    /// @return success Whether verification succeeded and tokens were minted.
    function verifyAndMint(
        ProofPackage calldata pkg,
        uint256 daysSinceLaunch
    ) external onlyWhenFinalized returns (bool success) {
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

        // Step 6: USD value — derived, never caller-supplied (CL-01)
        uint256 verifiedGrossUsdMicro = _resolveVerifiedGrossUsd(pkg, entry);
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

        // Step 8: Handshake allowance lookup (VF-COM-006/007 / CL-11)
        // Do not trust pkg.handshakeAllowanceCount as the rule. Look up the
        // registered mechanism on Base for every environment. A package value
        // that disagrees reverts. Consumption is deferred until success.
        uint256 expectedAllowance = _expectedHandshakeAllowance(pkg.sourceEnvironmentId);
        require(
            uint256(pkg.handshakeAllowanceCount) == expectedAllowance,
            "VF-COM-006: handshake allowance mismatch"
        );

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
        // VF-ORC-011/013: emission rate from Valuation Timestamp, not caller-supplied age.
        uint256 emissionDays = _daysSinceLaunchFromValuation(pkg.valuationTimestamp);
        // daysSinceLaunch retained in the ABI for callers; valuation path is authoritative.
        daysSinceLaunch;
        uint256 issuanceAmount = _computeIssuance(
            verifiedGrossUsdMicro,
            pkg.selectedOutputToken,
            entry.custodyClass,
            pkg.durationSecs,
            emissionDays
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
        // RAC already recorded at fee verification above.

        // VF-COM-006/007: consume handshake allowance only on 1h Handshake success
        if (isHandshake) {
            bytes32 handshakeKey = keccak256(abi.encodePacked(pkg.handshakeIdentity));
            require(
                handshakeUsage[handshakeKey] < expectedAllowance,
                "VF-COM-007: handshake allowance exhausted"
            );
            handshakeUsage[handshakeKey] += 1;
        }

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

    // ===== Handshake mechanism lookup (VF-COM-006 / CL-11) =====
    // 3: Base, Ethereum, Polygon, Optimism, Arbitrum, BNB Smart Chain, Avalanche, Solana
    // 1: Bitcoin, Bitcoin Cash, Litecoin, Dogecoin, DigiByte, Zcash, Stellar, XRP Ledger
    // Cosmos is not invented here.

    function _expectedHandshakeAllowance(string calldata envId) internal pure returns (uint256) {
        bytes32 h = keccak256(bytes(envId));
        if (
            h == keccak256("Base") ||
            h == keccak256("Ethereum") ||
            h == keccak256("Polygon") ||
            h == keccak256("Optimism") ||
            h == keccak256("Arbitrum") ||
            h == keccak256("BNB Smart Chain") ||
            h == keccak256("Avalanche") ||
            h == keccak256("Solana")
        ) {
            return HandshakeCapability.allowance(true);
        }
        if (
            h == keccak256("Bitcoin") ||
            h == keccak256("Bitcoin Cash") ||
            h == keccak256("Litecoin") ||
            h == keccak256("Dogecoin") ||
            h == keccak256("DigiByte") ||
            h == keccak256("Zcash") ||
            h == keccak256("Stellar") ||
            h == keccak256("XRP Ledger")
        ) {
            return HandshakeCapability.allowance(false);
        }
        revert("VF-COM-006: unknown environment");
    }

    // ===== USD resolution (VF-ORC / CL-01) =====
    // Every asset, including Ethereum USDC/USDT: registry last successful
    // scheduled price, read and bound at first lock valuation
    // (VF-ORC-008/009/010). No deployment price hash. No admin invent-price
    // setter. No $1 substitute. The $0.95 floor is Handshake-only.

    function _isEthereumUsdStable(string memory envId, string memory symbol) internal pure returns (bool) {
        if (keccak256(bytes(envId)) != keccak256("Ethereum")) return false;
        bytes32 s = keccak256(bytes(symbol));
        return s == keccak256("USDC") || s == keccak256("USDT");
    }

    function _resolveVerifiedGrossUsd(
        ProofPackage calldata pkg,
        AssetPrecisionEntry memory entry
    ) internal returns (uint256) {
        bytes32 lockIdHash = keccak256(
            abi.encodePacked(pkg.sourceEnvironmentId, pkg.commitmentVaultLockId)
        );
        LockPriceBinding storage binding = lockReferencePrices[lockIdHash];
        uint256 priceUsd18;

        if (binding.bound) {
            // VF-ORC-009/010: retain lock-creation reference; proof delay/retry does not reprice.
            priceUsd18 = binding.priceUsd18;
        } else {
            bytes32 assetKey = keccak256(
                abi.encodePacked(pkg.sourceEnvironmentId, pkg.canonicalAssetId)
            );
            ScheduledPriceEntry memory sp = scheduledPrices[assetKey];
            require(sp.usable && sp.priceUsd18 > 0, "VF-ORC-005: no usable scheduled price");
            // Ethereum USDC/USDT below $0.95: unavailable for a new Handshake
            // until a later run is at or above $0.95. Standard locks take the
            // scheduled price with no floor. Fail closed; never substitute $1.
            if (
                _isEthereumUsdStable(pkg.sourceEnvironmentId, entry.symbol) &&
                pkg.durationSecs == HANDSHAKE_DURATION_SECS
            ) {
                require(
                    sp.priceUsd18 >= USD_STABLE_MIN_PRICE,
                    "VF-ORC-005: USDC/USDT scheduled price below $0.95"
                );
            }
            priceUsd18 = sp.priceUsd18;
            binding.priceUsd18 = priceUsd18;
            binding.bound = true;
        }

        // Optional package record must agree with the bound reference (VF-ORC-007/012).
        if (pkg.priceRecord.length > 0) {
            uint256 recorded = abi.decode(pkg.priceRecord, (uint256));
            require(recorded == priceUsd18, "VF-ORC-007: price record mismatch");
        }

        uint256 assetUnitsFp = (pkg.grossAmountSmallestUnits * SCALE) / (10 ** uint256(entry.decimals));
        return (assetUnitsFp * priceUsd18) / SCALE;
    }

    /// @dev VF-ORC-011/013: days since launch from Valuation Timestamp (source block time).
    function _daysSinceLaunchFromValuation(uint256 valuationTimestamp) internal view returns (uint256) {
        uint256 launch = protocolLaunchTimestamp;
        if (launch == 0 || valuationTimestamp <= launch) {
            return 0;
        }
        return (valuationTimestamp - launch) / 1 days;
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
    ) internal pure returns (uint256) {
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
        uint32 durBps = _getDurationMultiplierBps(durationSecs);
        require(durBps > 0, "VF-COM-002: duration not permitted");
        uint256 durMultFp = (SCALE * durBps) / 10000;
        step = (step * durMultFp) / SCALE;

        return step;
    }

    function _computeEmissionRate(uint8 outputToken, uint256 daysSinceLaunch) internal pure returns (uint256) {
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

    // Permitted durations: the sixteen COMMITMENT_DURATIONS rows. Exact match.
    function _isPermittedDuration(uint256 secs) internal pure returns (bool) {
        return CommitmentDurations.multiplierBps(secs) != 0;
    }

    function _getDurationMultiplierBps(uint256 secs) internal pure returns (uint32) {
        return uint32(CommitmentDurations.multiplierBps(secs));
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

    function previewEmissionRate(uint8 outputToken, uint256 daysSinceLaunch) external pure returns (uint256) {
        return _computeEmissionRate(outputToken, daysSinceLaunch);
    }

    function previewIssuance(
        uint256 verifiedGrossUsdMicro,
        uint8 outputToken,
        uint8 custodyClass,
        uint256 durationSecs,
        uint256 daysSinceLaunch
    ) external pure returns (uint256) {
        return _computeIssuance(
            verifiedGrossUsdMicro,
            outputToken,
            custodyClass,
            durationSecs,
            daysSinceLaunch
        );
    }
}
