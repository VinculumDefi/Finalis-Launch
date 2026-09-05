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
    /// CL-85. Kept in step with interfaces/IChainVerifier.sol. This local
    /// declaration had also drifted on mutability: it still said `pure` after
    /// CL-81 made the canonical interface `view`.
    function extractFacts(
        bytes calldata lockEventProof
    ) external view returns (
        bytes32 lockId,
        uint256 grossAmount,
        uint256 feeAmount,
        uint256 principalAmount,
        uint256 durationSecs,
        uint256 creationTimestamp,
        uint256 maturityTimestamp,
        bytes32 canonicalAssetId,
        address baseRecipient,
        address releaseDestination,
        uint8   outputToken
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

interface IVinculumFinalisCap {
    function recordVclmIssuance(uint256 amount) external returns (uint256);
    function recordChonxIssuance(uint256 amount) external returns (uint256);
    function cumulativeVclmIssued() external view returns (uint256);
    function cumulativeChonxIssued() external view returns (uint256);
    function remainingVclmCapacity() external view returns (uint256);
    function remainingChonxCapacity() external view returns (uint256);
}

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

    // CL-02 / VF-DEP-006: one-shot deployment right, destroyed by finalize().
    address public deployer;

    // VF-DEP-007: finalization independently verifiable on-chain.
    // Renamed from `finalized` to avoid shadowing the chain-finality local
    // at verifyAndMint(). Two unrelated meanings must not share a name in a
    // contract that cannot be patched after deployment (VF-IMM-006).
    bool public configurationFinalized;

    // ===== CL-01 / VF-ORC-007: signed and batched price records =====
    //
    // The Base valuation path accepts ONLY a signed, batched price record for
    // the exact approved asset identity. No caller-supplied USD value is
    // accepted anywhere in this contract.
    //
    // VF-SEC-005: a relayer or price-batch submitter obtains no authority.
    // Anyone may deliver a batch; only a signature from the immutable
    // publisher key makes it valid. The submitter is a courier, not a source.

    struct PriceRecord {
        uint256 priceUsdMicro;   // USD per WHOLE unit, 6-decimal micro
        uint64  fetchTimestamp;  // when the price process observed it
        uint64  runId;           // scheduled run that produced it
        bool    available;       // VF-ORC-005: false = no usable valuation
    }

    address public immutable pricePublisher;
    uint256 public immutable launchTimestamp;   // VF-ORC-013 emission origin
    uint64  public latestPriceRunId;

    // CL-39 / VF-IMM-006: bound how far a single batch may advance the run
    // watermark. Without this, one batch signed with a near-maximum runId
    // would set the watermark beyond any reachable future value and freeze
    // price updates permanently, with no repair path. At two scheduled runs
    // per day (VF-ORC-001) this tolerates roughly 500 days of missed runs.
    uint64 private constant MAX_RUN_ADVANCE = 1000;

    // CL-37 / Revision 7 decision (2026-08-07):
    //
    // A price record is valid where the elapsed time since its publication
    // timestamp does not exceed 48 hours — four scheduled publication
    // intervals at the twice-daily cadence of VF-ORC-001.
    //
    // Resolves the tension between VF-ORC-008 (a record remains applicable
    // until the next scheduled run) and VF-IMM-005 (failure of an external
    // dependency must prevent unsafe new issuance). Issuance fails closed on
    // stale data; Commitment Vault principal release is unaffected, because
    // release executes on the source chain and never depends on Base pricing.
    //
    // Age is measured from the SIGNED fetchTimestamp, not from the block in
    // which the batch was submitted. A delayed batch must not reset its own
    // clock and arrive fresh.
    uint256 private constant MAX_PRICE_RECORD_AGE = 48 hours;
    mapping(bytes32 => PriceRecord) public priceRecords;

    // ===== CL-11 / VF-COM-006: handshake allowance per environment =====
    //
    // The allowance is a property of the SELECTED SOURCE MECHANISM, not an
    // assertion in the proof package. A mechanism that can atomically maintain
    // persistent per-identity allowance state permits exactly three qualifying
    // handshakes per identity; one that cannot permits exactly one.
    //
    // Registered during the deployment ceremony alongside the chain verifier.
    // 0 means unregistered, and an unregistered environment cannot be used.
    mapping(string => uint8) public handshakeAllowanceByEnvironment;

    event HandshakeAllowanceRegistered(string environmentId, uint8 allowance);

    event PriceBatchAccepted(uint64 indexed runId, uint256 assetCount, uint64 fetchTimestamp);
    event AssetMarkedUnavailable(bytes32 indexed canonicalAssetId, uint64 runId);

    // VF-XCH-013: replay protection — keccak256(env, lockId) => consumed
    mapping(bytes32 => bool) public consumedLocks;

    // VF-RAC-001: RAC exact-once — racIdentity => recorded
    mapping(bytes32 => bool) public recordedRacs;

    // VF-COM-006/007: Handshake allowance counter (Base-enforced environments)
    // keccak256(handshakeIdentity) => count used
    mapping(bytes32 => uint256) public handshakeUsage;

    // BASE-CAP: lifetime issuance is owned by VinculumFinalisCap.
    // CL-84: the Requirement Traceability Matrix assigns VF-SUP-001/002/003/013
    // to BASE-CAP. These counters previously lived here, reachable only from
    // verifyAndMint, which is why BASE-STAKE could read remaining capacity but
    // never consume it.
    IVinculumFinalisCap public cap;

    // BASE-ACT: CHONX activation
    bool public chonxActivated;
    uint256 public chonxActivationBlock;

    // BASE-RAC: RAC credits (indexed by racIdentity)
    mapping(bytes32 => uint256) public racCredits;
    mapping(bytes32 => uint256) public racEpoch;

    // CL-06 / VF-RAC-004: Epoch Reward Basis is the SUM of credits assigned to
    // an epoch. Maintained as a RUNNING TOTAL, incremented as each credit is
    // recorded. Deliberately not derived by iterating credits at read time:
    // that is the unbounded-loop mistake CL-09 exists to correct, and it would
    // brick permanently once credit count outgrew the block gas limit.
    mapping(uint256 => uint256) public epochRewardBasis;

    // BASE-QNORM: immutable asset-precision table
    // keccak256(environmentId, canonicalAssetId) => AssetPrecisionEntry
    mapping(bytes32 => AssetPrecisionEntry) public assetPrecisionTable;

    // Per-environment verifier registry (Section O)
    // environmentId => IChainVerifier
    mapping(string => IChainVerifier) public chainVerifiers;

    // Dev Fund destinations (VF-FEE-004) — PENDING_DEPLOYMENT until provisioned
    // environmentId => devFundAddress
    // CL-12: fees route on the SOURCE chain, so a Dev Fund destination is a
    // source-chain address — a string, not an EVM address. Stored verbatim for
    // inspection, plus a hash for constant-gas comparison.
    mapping(string => string)  public devFundDestinations;
    mapping(string => bytes32) public devFundDestinationHashes;

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

    event DevFundConfigured(string environmentId, string devFundDestination);
    event ChainVerifierRegistered(string environmentId, address verifier);
    event DeploymentFinalized();

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

    constructor(
        address _vclmToken,
        address _chonxToken,
        address _pricePublisher,
        uint256 _launchTimestamp,
        address _cap
    ) {
        require(_pricePublisher != address(0), "VF-DEP-002: zero price publisher");
        require(_launchTimestamp > 0, "VF-DEP-002: launchTimestamp not set");
        require(_cap != address(0), "VF-DEP-002: zero cap");
        cap = IVinculumFinalisCap(_cap);
        deployer = msg.sender;
        vclmToken = IERC20(_vclmToken);
        chonxToken = IERC20(_chonxToken);
        pricePublisher = _pricePublisher;
        launchTimestamp = _launchTimestamp;
    }

    // ===== CL-01 / VF-ORC-007: price batch intake =====

    /// @notice Delivers a signed, batched price record set from a scheduled run.
    /// @dev Callable by ANYONE. VF-SEC-005: the submitter obtains no authority;
    ///      validity rests entirely on the publisher signature. VF-ORC-008: runs
    ///      are strictly ordered. A price of zero marks the asset unavailable
    ///      (VF-ORC-005) rather than substituting a value (VF-ORC-004).
    function submitPriceBatch(
        uint64 runId,
        bytes32[] calldata canonicalAssetIds,
        uint256[] calldata pricesUsdMicro,
        uint64 fetchTimestamp,
        bytes calldata publisherSignature
    ) external {
        require(canonicalAssetIds.length == pricesUsdMicro.length, "VF-ORC: length mismatch");
        require(canonicalAssetIds.length > 0, "VF-ORC: empty batch");
        require(runId > latestPriceRunId, "VF-ORC-008: run not newer");
        // CL-39: a permanent brick must not be one signature away.
        require(runId <= latestPriceRunId + MAX_RUN_ADVANCE, "CL-39: run advance too large");
        require(fetchTimestamp <= block.timestamp, "VF-ORC: future fetch timestamp");

        // Domain-bound: a signature cannot be replayed to another chain or
        // another deployment of this contract.
        bytes32 digest = keccak256(
            abi.encode(
                block.chainid,
                address(this),
                runId,
                keccak256(abi.encodePacked(canonicalAssetIds)),
                keccak256(abi.encodePacked(pricesUsdMicro)),
                fetchTimestamp
            )
        );
        require(
            _recoverSigner(_ethSignedMessageHash(digest), publisherSignature) == pricePublisher,
            "VF-ORC-007: bad publisher signature"
        );

        for (uint256 i = 0; i < canonicalAssetIds.length; i++) {
            bool ok = pricesUsdMicro[i] > 0;
            priceRecords[canonicalAssetIds[i]] = PriceRecord({
                priceUsdMicro: pricesUsdMicro[i],
                fetchTimestamp: fetchTimestamp,
                runId: runId,
                available: ok
            });
            if (!ok) emit AssetMarkedUnavailable(canonicalAssetIds[i], runId);
        }

        latestPriceRunId = runId;
        emit PriceBatchAccepted(runId, canonicalAssetIds.length, fetchTimestamp);
    }

    function _ethSignedMessageHash(bytes32 h) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", h));
    }

    function _recoverSigner(bytes32 digest, bytes memory sig) internal pure returns (address) {
        require(sig.length == 65, "VF-ORC-007: bad signature length");
        bytes32 r; bytes32 sv; uint8 v;
        assembly {
            r  := mload(add(sig, 32))
            sv := mload(add(sig, 64))
            v  := byte(0, mload(add(sig, 96)))
        }
        if (v < 27) v += 27;
        require(v == 27 || v == 28, "VF-ORC-007: bad signature v");
        require(
            uint256(sv) <= 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0,
            "VF-ORC-007: malleable signature"
        );
        address signer = ecrecover(digest, v, r, sv);
        require(signer != address(0), "VF-ORC-007: bad signature");
        return signer;
    }

    /// @notice The asset's decimals, from the immutable registry.
    /// @dev CL-41: precision is a DIVISOR in every USD derivation. Taking it
    ///      from the proof package let a caller understate decimals and inflate
    ///      the resulting credit by 10^(true - declared). Same class as CL-01:
    ///      a quantity that determines issuance must never be caller-supplied.
    function _registeredPrecision(ProofPackage calldata pkg) internal view returns (uint256) {
        bytes32 key = keccak256(abi.encodePacked(pkg.sourceEnvironmentId, pkg.canonicalAssetId));
        AssetPrecisionEntry storage e = assetPrecisionTable[key];
        require(e.canonicalAssetId != bytes32(0), "VF-REG-001: asset not in registry");
        return uint256(e.decimals);
    }

    /// @notice Verified Gross USD Value from the accepted reference price.
    /// @dev VF-ORC-007/012. Never caller-supplied.
    function _verifiedGrossUsdMicro(ProofPackage calldata pkg)
        internal view returns (uint256)
    {
        PriceRecord storage pr = priceRecords[pkg.canonicalAssetId];
        require(pr.available, "VF-ORC-005: no usable valuation for asset");
        // CL-37: exactly 48 hours remains valid; 48 hours plus one second does not.
        require(
            block.timestamp - uint256(pr.fetchTimestamp) <= MAX_PRICE_RECORD_AGE,
            "CL-37: price record stale"
        );
        // CL-40: the protocol's USD bounds (HANDSHAKE_USD_MIN etc.) are
        // 18-decimal, while published prices are 6-decimal micro-USD.
        // Scale by 1e12 to land in the units the rest of the contract uses.
        // CL-41: divisor from the registry, never from the package.
        return (pkg.grossAmountSmallestUnits * pr.priceUsdMicro * 1e12)
               / (10 ** _registeredPrecision(pkg));
    }

    /// @notice Whether an asset currently has a usable valuation.
    /// @dev CL-37. Available AND within the maximum record age. Exposed so
    ///      operators and the UI can observe fail-closed state directly
    ///      rather than inferring it from a reverted transaction.
    function hasUsableValuation(bytes32 canonicalAssetId) external view returns (bool) {
        PriceRecord storage pr = priceRecords[canonicalAssetId];
        if (!pr.available) return false;
        return block.timestamp - uint256(pr.fetchTimestamp) <= MAX_PRICE_RECORD_AGE;
    }

    /// @notice Days since launch, derived from the Valuation Timestamp.
    /// @dev VF-ORC-011/013. Never caller-supplied.
    function _daysSinceLaunch(ProofPackage calldata pkg)
        internal view returns (uint256)
    {
        require(pkg.valuationTimestamp >= launchTimestamp, "VF-ORC-011: valuation precedes launch");
        require(pkg.valuationTimestamp <= block.timestamp, "VF-ORC-011: valuation in future");
        return (pkg.valuationTimestamp - launchTimestamp) / 1 days;
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
        // CL-42 / VF-SEC-003: an unrecognized custody class must not fall
        // through to a valid economic multiplier. _computeIssuance selects
        // S1/S2/S3 by ternary, so any unlisted value would silently receive
        // the S3 multiplier. Registration is immutable after finalization
        // (VF-IMM-006), so a misregistration here is permanent.
        require(custodyClass >= 1 && custodyClass <= 3, "VF-SEC-003: custody class must be 1, 2 or 3");
        require(custodyPath <= 1, "VF-SEC-003: custody path must be 0 or 1");

        // CL-43: precision is an exponent in every USD derivation. Values the
        // arithmetic cannot execute would register an asset into a permanently
        // unusable state with no post-deployment correction path.
        require(decimals <= 18, "VF-REG: precision exceeds 18");

        bytes32 key = keccak256(abi.encodePacked(environmentId, canonicalAssetId));
        assetPrecisionTable[key] = AssetPrecisionEntry({
            canonicalAssetId: canonicalAssetId,
            symbol: symbol,
            decimals: decimals,
            custodyClass: custodyClass,
            custodyPath: custodyPath
        });
    }

    function registerChainVerifier(string calldata environmentId, address verifier) external onlyDuringDeployment {
        // VF-DEP-002: zero or provisional configuration cannot be finalized.
        require(verifier != address(0), "VF-DEP-002: zero chain verifier");
        chainVerifiers[environmentId] = IChainVerifier(verifier);
        emit ChainVerifierRegistered(environmentId, verifier);
    }

    /// @notice Registers the handshake allowance for a source environment.
    /// @dev CL-11 / VF-COM-006. Exactly 1 or exactly 3 — the specification
    ///      admits no other value. Deployment ceremony only.
    function registerHandshakeAllowance(string calldata environmentId, uint8 allowance)
        external onlyDuringDeployment
    {
        require(allowance == 1 || allowance == 3, "VF-COM-006: allowance must be 1 or 3");
        handshakeAllowanceByEnvironment[environmentId] = allowance;
        emit HandshakeAllowanceRegistered(environmentId, allowance);
    }

    /// @dev VF-FEE-009: missing, zero, guessed or substitute Dev Fund addresses
    ///      cannot complete a deployment package. An empty destination is rejected
    ///      here rather than discovered at issuance time.
    function configureDevFund(string calldata environmentId, string calldata devFundDestination) external onlyDuringDeployment {
        require(bytes(devFundDestination).length > 0, "VF-FEE-009: empty dev fund destination");
        devFundDestinationHashes[environmentId] = keccak256(bytes(devFundDestination));
        devFundDestinations[environmentId] = devFundDestination;
        emit DevFundConfigured(environmentId, devFundDestination);
    }

    /// @notice Closes the deployment ceremony permanently (VF-DEP-006).
    /// @dev Irreversible. No setter re-opens it. After this call there is no
    ///      address on earth that can alter registry, chain verifiers, or Dev
    ///      Fund destinations (VF-IMM-001/002/004, VF-DEP-003).
    function finalize() external onlyDuringDeployment {
        configurationFinalized = true;
        deployer = address(0);
        emit DeploymentFinalized();
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
        // CL-86 / CL-76 (accounting path). Section 9: a Reward-Accounting Credit
        // is created by a *successfully verified* Commitment Vault fee.
        // VF-FEE-007 requires the proof to establish the fee and its transfer;
        // VF-FEE-008 requires fee-routing and principal-lock evidence to refer
        // to the same completed lock. Verification therefore precedes every
        // write below. Before CL-86 no verifier was consulted here at all.
        _verifySource(pkg);

        // CL-01 / VF-ORC-007: derived from the signed price record, never supplied.
        uint256 verifiedGrossUsdMicro = _verifiedGrossUsdMicro(pkg);
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
        if (cap.cumulativeVclmIssued() < VCLM_HARD_CAP) {
            // CL-30 / VF-ORC-012: the SAME accepted reference price determines
            // both Verified Gross USD Value and Verified USD Fee Value.
            // Deriving the fee proportionally would introduce a second rounding.
            PriceRecord storage pr = priceRecords[pkg.canonicalAssetId];
            uint256 feeUsd = (pkg.actualFeeAmountSmallestUnits * pr.priceUsdMicro * 1e12)
                             / (10 ** _registeredPrecision(pkg));   // CL-41
            uint256 racCredit = (feeUsd * RAC_CREDIT_RATE_BPS) / 10000;
            // CL-05 / §10.2: epochs are launch-relative and 1-indexed.
            uint256 epoch = ((block.timestamp - launchTimestamp) / EPOCH_DURATION_SECS) + 1;
            racCredits[pkg.racIdentity] = racCredit;
            racEpoch[pkg.racIdentity] = epoch;
            // CL-06 / VF-RAC-004: accumulate into the epoch's Reward Basis.
            epochRewardBasis[epoch] += racCredit;
            emit RacCreditRecorded(pkg.racIdentity, racCredit, epoch);
        }
    }

    // -------------------------------------------------------------------------
    // Source verification (VF-XCH-006/010/011)
    // -------------------------------------------------------------------------

    /// @dev CL-86. Verifies source finality and cross-checks the package against
    ///      facts extracted independently by the registered chain verifier.
    ///
    ///      Called by BOTH recordFeeAndRac and verifyAndMint. Rev 6 section 9
    ///      states that a Reward-Accounting Credit is created by a *successfully
    ///      verified* Commitment Vault fee, and VF-FEE-007/008 require the proof
    ///      to establish the fee and tie it to the same completed lock. Before
    ///      CL-86 the credit was written by recordFeeAndRac with no verifier
    ///      consulted at all, so a package describing a lock that did not exist
    ///      credited the epoch reward basis permanently (CL-76, accounting path).
    ///
    ///      A package that cannot yet be verified is rejected and may be
    ///      resubmitted. Nothing is lost: the source lock persists, any address
    ///      may submit, and section 10.3 processes rewards one epoch behind with
    ///      eligibility fixed by scheduled timestamps, so a retry cannot change
    ///      who qualifies.
    function _verifySource(ProofPackage calldata pkg) internal view {
        //
        // CL-85 ORDERING. This ran as step 11 of verifyAndMint, after the registry
        // lookup, the USD valuation and the output-token eligibility gate had
        // already consumed the package's claimed identity. Validating identity
        // after acting on it left two consequences. A substituted output token
        // was rejected by the CHONX activation gate rather than by the
        // identity check, so the rejection was incidental and would not
        // survive CHONX activation. And valuation was computed from a
        // caller-supplied timestamp before that timestamp was checked against
        // the source. Nothing here depends on the steps that follow, so the
        // check runs first and everything downstream operates on validated
        // identity. Step numbering below is unchanged: 03_handshake slices
        // this source between step labels.
        IChainVerifier verifier = chainVerifiers[pkg.sourceEnvironmentId];
        require(address(verifier) != address(0), "VF-XCH-006: no verifier registered for environment");
        (bool finalized, , ) = verifier.verifyFinality(pkg.lockEventProof, pkg.sourceFinalityProof);
        require(finalized, "VF-XCH-006: source not finalized");

        // VF-XCH-011: Independently extract immutable facts from the raw lock event
        // proof and cross-check against the normalized ProofPackage fields. This
        // prevents tampering by the normalizer/relayer — the chain verifier
        // extracts directly from the chain-specific event, not from normalized fields.
        {
            (
                bytes32 extLockId,
                uint256 extGross,
                uint256 extFee,
                uint256 extPrincipal,
                uint256 extDuration,
                uint256 extCreation,
                ,
                bytes32 extAssetId,
                address extRecipient,
                ,
                uint8   extOutputToken
            ) = verifier.extractFacts(pkg.lockEventProof);

            require(
                keccak256(abi.encodePacked(extLockId)) == keccak256(abi.encodePacked(pkg.commitmentVaultLockId)),
                "VF-XCH-011: lockId mismatch"
            );
            require(extGross == pkg.grossAmountSmallestUnits, "VF-XCH-011: gross mismatch");
            require(extFee == pkg.actualFeeAmountSmallestUnits, "VF-XCH-011: fee mismatch");
            require(extPrincipal == pkg.principalAmountSmallestUnits, "VF-XCH-011: principal mismatch");
            require(extDuration == pkg.durationSecs, "VF-XCH-011: duration mismatch");

            // CL-85. Identity cross-check. Each field decides who is paid, how
            // much, or in what token. Before this block they were taken from
            // the caller, so a package naming a different recipient, asset, or
            // output token was accepted against an honest lock.
            require(extRecipient == pkg.baseRecipient, "VF-XCH-011: recipient mismatch");
            require(extAssetId == pkg.canonicalAssetId, "VF-XCH-011: asset mismatch");
            require(extOutputToken == pkg.selectedOutputToken, "VF-XCH-011: output token mismatch");

            // VF-ORC-009/010. The valuation timestamp is the source creation
            // time, not a value the caller may choose. A proof delay or retry
            // does not reprice, and a rewound timestamp cannot recover an
            // emission rate that has already decayed.
            require(extCreation == pkg.valuationTimestamp, "VF-XCH-011: valuation mismatch");
        }

    }


    // ===== Canonical verification entry point =====

    /// @notice Phase 2: Verifies a normalized proof package and mints tokens if valid.
    /// @dev Call recordFeeAndRac() first to persist RAC independently of issuance outcome.
    /// @param pkg The normalized ProofPackage from any source environment.
    /// @return success Whether verification succeeded and tokens were minted.
    function verifyAndMint(
        ProofPackage calldata pkg
    ) external onlyWhenFinalized returns (bool success) {
        // CL-01 / CL-10 — the two quantities that determine how many tokens
        // are minted are DERIVED here, not accepted from the caller.
        //   VF-ORC-007: gross USD comes from the signed price record.
        //   VF-ORC-011/013: emission rate comes from the Valuation Timestamp.
        uint256 verifiedGrossUsdMicro = _verifiedGrossUsdMicro(pkg);
        uint256 daysSinceLaunch = _daysSinceLaunch(pkg);
        bytes32 lockIdHash = keccak256(abi.encodePacked(pkg.sourceEnvironmentId, pkg.commitmentVaultLockId));

        // Step 1: Replay protection (VF-XCH-013)
        require(!consumedLocks[lockIdHash], "VF-XCH-013: replay");

        // Step 2: RAC must already be recorded (VF-FEE-011 two-phase pattern).
        // If not yet recorded, the caller must call recordFeeAndRac() first.
        require(recordedRacs[pkg.racIdentity], "VF-FEE-011: call recordFeeAndRac() first");

        // Step 2b: Source finality + identity cross-check (VF-XCH-006/010/011)
        // CL-86: the block that stood here is now _verifySource, so that
        // recordFeeAndRac performs the identical check before writing a
        // Reward-Accounting Credit. Behaviour here is unchanged.
        _verifySource(pkg);

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

        // Step 8: Handshake allowance (VF-COM-006/007/008)
        //
        // CL-11: the allowance comes from the environment registry, NEVER from
        // pkg.handshakeAllowanceCount. That field is caller-controlled and is
        // deliberately ignored; a caller cannot widen its own allowance by
        // asserting a larger number, nor skip the check by asserting a value
        // the old code did not branch on.
        //
        // VF-COM-008: a failed attempt consumes no allowance. The increment
        // below occurs inside the same transaction as every remaining check,
        // so any later revert unwinds it.
        if (isHandshake) {
            uint8 allowance = handshakeAllowanceByEnvironment[pkg.sourceEnvironmentId];
            require(allowance > 0, "VF-COM-006: environment allowance not registered");

            bytes32 handshakeKey = keccak256(abi.encodePacked(pkg.handshakeIdentity));
            require(
                handshakeUsage[handshakeKey] < allowance,
                "VF-COM-007: handshake allowance exhausted"
            );
            handshakeUsage[handshakeKey] += 1;
        }

        // Step 9: Base recipient (VF-ARC-006)
        require(pkg.baseRecipient != address(0), "VF-ARC-006: zero base recipient");

        // Step 10: Dev Fund destination (VF-FEE-006/008/009)
        //
        // CL-12, Revision 7 scope decision (2026-08-07):
        //
        // Revision 7 validates that the Dev Fund destination named in the proof
        // package MATCHES the destination registered during the deployment
        // ceremony. That is VF-FEE-006 — no user, relayer, implementer or
        // external message may substitute another fee destination.
        //
        // Independent cryptographic verification that the transfer actually
        // occurred on the source chain (VF-FEE-007) is DELIBERATELY OUT OF
        // SCOPE for Revision 7. It requires the chain verifier to understand
        // transfer evidence in addition to lock evidence, which expands the
        // IChainVerifier trust boundary. It is reserved for the chain-verifier
        // work tracked under CL-27. This is a conscious deferral, recorded so
        // it is not mistaken for an oversight.
        bytes32 registeredDevFund = devFundDestinationHashes[pkg.sourceEnvironmentId];
        require(registeredDevFund != bytes32(0), "VF-FEE-009: dev fund not configured");
        require(
            keccak256(bytes(pkg.devFundDestination)) == registeredDevFund,
            "VF-FEE-006: dev fund destination substituted"
        );

        // VF-FEE-008/009: fee-routing evidence must exist and must be bound to
        // the same Commitment Vault Lock as the principal evidence. Full
        // evidence validation is deferred with VF-FEE-007 above; a zero or
        // absent evidence hash is rejected here regardless.
        require(pkg.feeTransferEvidence != bytes32(0), "VF-FEE-008: missing fee transfer evidence");

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
            uint256 remaining = cap.remainingVclmCapacity();
            require(issuanceAmount <= remaining, "VF-SUP-015: exceeds VCLM cap");
        } else { // CHONX
            uint256 remaining = cap.remainingChonxCapacity();
            require(issuanceAmount <= remaining, "VF-SUP-015: exceeds CHONX cap");
        }

        // ===== All checks passed — authorize issuance =====
        // RAC already recorded at fee verification (step 6) above.

        // Mint tokens (BASE-EMIT)
        if (pkg.selectedOutputToken == 0) { // VCLM
            // BASE-CAP records; BASE-VERIFY mints. The returned figure is the
            // cumulative lifetime issuance after this authorization.
            uint256 newCumulative = cap.recordVclmIssuance(issuanceAmount);
            vclmToken.mint(pkg.baseRecipient, issuanceAmount);

            // Check CHONX activation (BASE-ACT) — VF-TOK-002 traces activation
            // to BASE-ACT + BASE-VERIFY, not to BASE-CAP.
            if (!chonxActivated && newCumulative >= CHONX_ACTIVATION_THRESHOLD) {
                chonxActivated = true;
                chonxActivationBlock = block.number;
                emit ChonxActivated(block.number);
            }
        } else { // CHONX
            cap.recordChonxIssuance(issuanceAmount);
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
        uint32 durBps = _getDurationMultiplierBps(durationSecs);
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

    function _getDurationMultiplierBps(uint256 secs) internal pure returns (uint32) {
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
        return cap.remainingVclmCapacity();
    }
    function getRemainingChonxCap() external view returns (uint256) {
        return cap.remainingChonxCapacity();
    }
    /// @notice Retained so existing readers keep working; BASE-CAP owns these.
    function cumulativeVclmIssued() external view returns (uint256) {
        return cap.cumulativeVclmIssued();
    }
    function cumulativeChonxIssued() external view returns (uint256) {
        return cap.cumulativeChonxIssued();
    }
}
