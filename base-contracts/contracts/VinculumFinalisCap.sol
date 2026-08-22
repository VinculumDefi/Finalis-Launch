// =============================================================================
// VinculumFinalisCap — Global lifetime-cap accounting (BASE-CAP, A.12)
//
// WHY THIS COMPONENT EXISTS
//   Revision 6 §13.1 defines the lifetime issuance invariant:
//
//       Remaining lifetime capacity = hard cap − cumulative lifetime issuance
//
//   The Requirement Traceability Matrix assigns that invariant to BASE-CAP:
//     VF-SUP-001  BASE-CAP               every issuance path reconciles
//     VF-SUP-002  BASE-CAP               vault + stake draw the same VCLM cap
//     VF-SUP-003  BASE-CAP               burning does not restore capacity
//     VF-SUP-013  BASE-CAP               only Base issuance increases lifetime
//     VF-SUP-005  BASE-CAP + BASE-ISSUE
//     VF-SUP-009  BASE-EPOCH + BASE-CAP
//     VF-STK-028  BASE-EPOCH + BASE-CAP
//     VF-STK-029  BASE-STAKE + BASE-CAP
//     VF-XCH-021  AXELAR-ITS + BASE-CAP
//
//   Every path that touches lifetime capacity is traced as "that component
//   PLUS BASE-CAP". BASE-CAP is a participant each of them reconciles against,
//   not a responsibility folded inside any one of them.
//
//   Before this contract, the counters lived inside VinculumFinalisVerifier
//   (BASE-VERIFY) and were writable only from verifyAndMint. BASE-STAKE could
//   read remaining capacity but could not consume it, so epoch rewards checked
//   the cap without ever reducing it (CL-84).
//
// WHAT THIS CONTRACT DOES NOT DO — deliberately
//   **It does not evaluate activation thresholds.** VF-SUP-004, VF-TOK-002 and
//   VF-TOK-003 all trace to BASE-ACT, never to BASE-CAP. This contract exposes
//   the cumulative figures; BASE-ACT reads them and records activation.
//
//   **It holds no burn path and no decrement.** VF-SUP-003: burning reduces
//   circulating supply and does not restore issuance capacity. The counters
//   here are monotonic by construction, so no caller can restore capacity by
//   any route, including Axelar ITS transport (VF-XCH-021, VF-SUP-014).
//
//   **It does not mint.** It records that issuance was authorized. Minting
//   remains with the token, and the caller performs it after recording.
//
// AUTHORIZED RECORDERS
//   Fixed at initialization and permanent thereafter, matching the token's
//   one-shot pattern. Deployment authority is destroyed in the same call.
//
// SPDX-License-Identifier: PROTOCOL-RESTRICTED
// Solidity 0.8.19+
// =============================================================================

pragma solidity 0.8.19;

contract VinculumFinalisCap {

    error NotDeployer();
    error AlreadyInitialized();
    error NotInitialized();
    error NotAuthorized(address caller);
    error ZeroAddress();
    error RecordersIdentical();
    error ExceedsVclmCap(uint256 requested, uint256 remaining);
    error ExceedsChonxCap(uint256 requested, uint256 remaining);

    // ===== Hard caps (VF-TOK-009 / VF-TOK-010) =====
    uint256 public immutable vclmHardCap;
    uint256 public immutable chonxHardCap;

    // ===== Cumulative lifetime issuance — monotonic, never decremented =====
    uint256 public cumulativeVclmIssued;
    uint256 public cumulativeChonxIssued;

    // ===== Authorized issuance paths =====
    /// @notice BASE-VERIFY. Records Commitment Vault issuance.
    address public recorderVerifier;
    /// @notice BASE-STAKE. Records epoch reward issuance (VF-SUP-002).
    address public recorderStake;

    address public deployer;
    bool public initialized;

    event Initialized(address recorderVerifier, address recorderStake);
    event DeploymentAuthorityTerminated();
    event VclmIssuanceRecorded(address indexed recorder, uint256 amount, uint256 cumulative);
    event ChonxIssuanceRecorded(address indexed recorder, uint256 amount, uint256 cumulative);

    modifier onlyRecorder() {
        if (msg.sender != recorderVerifier && msg.sender != recorderStake) {
            revert NotAuthorized(msg.sender);
        }
        _;
    }

    modifier whenInitialized() {
        if (!initialized) revert NotInitialized();
        _;
    }

    constructor(uint256 _vclmHardCap, uint256 _chonxHardCap) {
        vclmHardCap = _vclmHardCap;
        chonxHardCap = _chonxHardCap;
        deployer = msg.sender;
    }

    /// @notice One-shot initialization. Sets both permanent recorders and
    ///         irreversibly terminates deployment authority in the same call.
    /// @dev Mirrors VinculumFinalisToken.initialize. There is no setter.
    function initialize(address _recorderVerifier, address _recorderStake) external {
        if (initialized) revert AlreadyInitialized();
        if (msg.sender != deployer) revert NotDeployer();
        if (_recorderVerifier == address(0) || _recorderStake == address(0)) {
            revert ZeroAddress();
        }
        if (_recorderVerifier == _recorderStake) revert RecordersIdentical();

        recorderVerifier = _recorderVerifier;
        recorderStake = _recorderStake;
        initialized = true;
        deployer = address(0);

        emit Initialized(_recorderVerifier, _recorderStake);
        emit DeploymentAuthorityTerminated();
    }

    // -------------------------------------------------------------------------
    // Recording — the only way cumulative issuance moves
    // -------------------------------------------------------------------------

    /// @notice Record authorized VCLM issuance against lifetime capacity.
    /// @dev VF-SUP-005: an amount exceeding remaining capacity is rejected in
    ///      full. The caller mints only after this returns.
    function recordVclmIssuance(uint256 amount)
        external onlyRecorder whenInitialized returns (uint256 newCumulative)
    {
        uint256 remaining = vclmHardCap - cumulativeVclmIssued;
        if (amount > remaining) revert ExceedsVclmCap(amount, remaining);

        cumulativeVclmIssued += amount;
        newCumulative = cumulativeVclmIssued;

        emit VclmIssuanceRecorded(msg.sender, amount, newCumulative);
    }

    /// @notice Record authorized CHONX issuance against lifetime capacity.
    function recordChonxIssuance(uint256 amount)
        external onlyRecorder whenInitialized returns (uint256 newCumulative)
    {
        uint256 remaining = chonxHardCap - cumulativeChonxIssued;
        if (amount > remaining) revert ExceedsChonxCap(amount, remaining);

        cumulativeChonxIssued += amount;
        newCumulative = cumulativeChonxIssued;

        emit ChonxIssuanceRecorded(msg.sender, amount, newCumulative);
    }

    // -------------------------------------------------------------------------
    // Views — BASE-ACT reads these to evaluate activation (VF-SUP-004)
    // -------------------------------------------------------------------------

    function remainingVclmCapacity() external view returns (uint256) {
        return vclmHardCap - cumulativeVclmIssued;
    }

    function remainingChonxCapacity() external view returns (uint256) {
        return chonxHardCap - cumulativeChonxIssued;
    }

    /// @notice Whether an amount would fit, without recording it.
    /// @dev VF-SUP-015: a preflight check reserves no capacity.
    function vclmIssuanceFits(uint256 amount) external view returns (bool) {
        return amount <= vclmHardCap - cumulativeVclmIssued;
    }

    function chonxIssuanceFits(uint256 amount) external view returns (bool) {
        return amount <= chonxHardCap - cumulativeChonxIssued;
    }

    function isAuthorizedRecorder(address who) external view returns (bool) {
        return who == recorderVerifier || who == recorderStake;
    }
}
