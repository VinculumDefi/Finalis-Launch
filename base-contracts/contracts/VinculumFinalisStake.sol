// =============================================================================
// VinculumFinalisStake — Treasury Reward Stake + Epoch Contract
// (BASE-STAKE + BASE-EPOCH)
//
// PROVENANCE: Built directly from Revision 6 authoritative documents:
//   - 227826f11_Vinculum_Finalis_Master_Specification_Revision_6_2026-07-28.docx (Revision 6)
//   - Vinculum_Finalis_Protocol_Constants.json (Revision 6, 2026-07-28)
//   - Vinculum_Finalis_Architecture_Design.md (Section A.16, B.11)
//
// Requirements implemented:
//   VF-STK-001: Stake active from launch (not dependent on CHONX activation)
//   VF-STK-002: Only VCLM/CHONX/SYNTH stakable
//   VF-STK-003: Only listed token+duration multipliers apply
//   VF-STK-004: Rewards paid only in newly minted VCLM
//   VF-STK-005: S1/S2/S3 never affects Weight
//   VF-STK-006: Every epoch = exactly 10 days
//   VF-STK-007: Credit belongs to epoch recorded
//   VF-STK-008: Permissionless finalization
//   VF-STK-009: Delayed finalization never shifts boundaries
//   VF-STK-010: Pending epochs finalized in chronological order
//   VF-STK-011: Position beginning after epoch start does not qualify
//   VF-STK-012: Position expiring before end of N+1 does not qualify
//   VF-STK-013: Entitlement fixed only after scheduled end of N+1
//   VF-STK-014: Single mint to stake contract; proportional entitlements
//   VF-STK-015: Zero-eligible epoch mints nothing
//   VF-STK-016: Claimable VCLM accumulates and never expires
//   VF-STK-017: User may claim all in one tx
//   VF-STK-018: Claims transfer minted VCLM; no re-mint
//   VF-STK-019: Claims only to owner
//   VF-STK-020: Withdrawal does not erase claimable
//   VF-STK-021: Queue one future term 30/60/90/120d
//   VF-STK-022: Queued term begins at scheduled end of current
//   VF-STK-023: Only one future term at a time
//   VF-STK-024: Extension adds/removes no tokens, charges no fee
//   VF-STK-025: Without extension position inactive at maturity
//   VF-STK-026: Proportional share; rounds down to base unit
//   VF-STK-027: Microscopic remainder inaccessible
//   VF-STK-028: Epoch reward exceeding capacity mints nothing
//   VF-STK-029: At zero VCLM capacity stake closes to new positions
//   VF-STK-030: At terminal state staked tokens withdrawable
//   VF-STK-031: Position requires positive nonzero token amount
//   VF-RAC-004: Epoch Reward Basis = sum of RAC closed in epoch
//   VF-RAC-005: Permanent $0.10 Reward Reference Value
//   VF-RAC-006: Credit becomes Used only at allocation
//
// SPDX-License-Identifier: PROTOCOL-RESTRICTED
// Solidity 0.8.19+
// =============================================================================

pragma solidity 0.8.19;

interface IVinculumFinalisCap {
    function recordVclmIssuance(uint256 amount) external returns (uint256);
    function cumulativeVclmIssued() external view returns (uint256);
    function remainingVclmCapacity() external view returns (uint256);
}

interface IVerifier {
    function cumulativeVclmIssued() external view returns (uint256);
    function racCredits(bytes32 racIdentity) external view returns (uint256);
    function racEpoch(bytes32 racIdentity) external view returns (uint256);
    // CL-06 / VF-RAC-004
    function epochRewardBasis(uint256 epochN) external view returns (uint256);
}

interface IStakeToken {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IVclmToken is IStakeToken {
    function mint(address to, uint256 amount) external;
}

contract VinculumFinalisStake {

    // ===== Protocol constants =====

    uint256 public constant SCALE = 1e18;
    uint256 public constant VCLM_HARD_CAP = 10_000_000_000 * 1e18;

    // VF-STK-006 / VF-RAC-003: Epoch = 10 days
    uint256 public constant EPOCH_DURATION_SECS = 10 * 1 days;

    // VF-RAC-005: Permanent $0.10 Reward Reference Value
    uint256 public constant REWARD_REFERENCE_CENTS = 10;

    // VF-STK-003 / §10.1: Stake durations and staking-duration multipliers
    // 30d=1.0x, 60d=1.4x, 90d=1.75x, 120d=2.0x (bps)
    uint16 private constant DUR_30D_BPS  = 10000;
    uint16 private constant DUR_60D_BPS  = 14000;
    uint16 private constant DUR_90D_BPS  = 17500;
    uint16 private constant DUR_120D_BPS = 20000;

    // CL-03 / §10.1 / VF-STK-003: Token multipliers
    // VCLM=1.0x, CHONX=2.0x, SYNTH=4.0x (bps)
    uint16 private constant TOKEN_VCLM_BPS  = 10000;
    uint16 private constant TOKEN_CHONX_BPS = 20000;
    uint16 private constant TOKEN_SYNTH_BPS = 40000;
    uint256 private constant DUR_30D = 30 days;
    uint256 private constant DUR_60D = 60 days;
    uint256 private constant DUR_90D = 90 days;
    uint256 private constant DUR_120D = 120 days;

    // ===== Storage =====


    // CL-05 / CL-24 / §10.2: T0. Epoch N spans [T0+(N-1)E, T0+N*E). Immutable.
    uint256 public immutable launchTimestamp;
    IVclmToken public vclmToken;
    IStakeToken public chonxToken;
    IStakeToken public synthToken;
    IVerifier public verifier;
    // CL-84 / A.12: BASE-CAP owns lifetime issuance accounting. BASE-STAKE
    // reconciles against it (VF-SUP-002, VF-STK-028, VF-STK-029).
    IVinculumFinalisCap public cap;
    // CL-84 / A.12: BASE-CAP owns lifetime issuance accounting. BASE-STAKE
    // reconciles against it (VF-SUP-002, VF-STK-028, VF-STK-029).

    bool public terminalState;

    struct Position {
        address owner;
        uint8 token;      // 0=VCLM, 1=CHONX, 2=SYNTH
        uint256 amount;
        uint256 durationSecs;
        uint256 startTimestamp;
        uint256 endTimestamp;
        uint16 multiplierBps;
        uint16 queuedExtensionBps;  // 0 = no extension
        uint256 queuedExtensionSecs;
        bool withdrawn;
    }

    mapping(uint256 => Position) public positions;
    uint256 public nextPositionId;

    struct Epoch {
        bool closed;
        bool allocated;
        uint256 rewardBasis;
        uint256 totalWeight;
        uint256 mintedVclm;
        uint256 closeTimestamp;
        uint256 allocateTimestamp;
        // CL-89 bounded allocation.
        uint256 allocStartTimestamp;  // set on the first batch; 0 = not started
        uint256 allocCursor;          // next index into epochPositions[n]
        uint256 distributedSoFar;     // running sum across batches
    }

    mapping(uint256 => Epoch) public epochs;

    // ===== CL-89: bounded allocation =====
    //
    // Three rules, and nothing else:
    //   1. everyone who earned a reward is paid,
    //   2. nobody is paid twice,
    //   3. no transaction is ever too large for a block.
    //
    // `epochPositions[n]` is the work list for epoch n, appended at
    // registration. A position qualifies for a CONTIGUOUS range of epochs, and
    // the maximum term is 120 days = 12 epochs, so registration appends at most
    // 12 entries. That cost is paid ONCE per position. The previous design paid
    // ~14,473 gas per lifetime position on EVERY allocation, forever.
    //
    // Allocation walks that list from `allocCursor` in bounded batches. One
    // transaction or thirty-two makes no difference to the result.
    mapping(uint256 => uint256[]) public epochPositions;

    /// @notice Positions still to process for an epoch's allocation.
    function remainingToAllocate(uint256 epochN) external view returns (uint256) {
        uint256 total = epochPositions[epochN].length;
        uint256 done = epochs[epochN].allocCursor;
        return done >= total ? 0 : total - done;
    }

    // CL-89 / VF-STK-020. The moment a position was withdrawn, so allocation can
    // tell "withdrew before the payout began" (forfeits) from "withdrew while
    // the payout was running" (already earned; batch position is irrelevant).
    // Without this the outcome would depend on which batch a position landed in.
    mapping(uint256 => uint256) public withdrawnAt;

    // ===== CL-09: bounded epoch accounting via a difference array =====
    //
    // A position qualifies for a CONTIGUOUS RANGE of epochs: those N where
    // start <= T0+(N-1)E and end >= T0+(N+1)E. Rather than iterating every
    // position at close time (which grows without bound and eventually bricks
    // the reward system permanently, with no repair path under VF-IMM-006),
    // each position records its weight at the first epoch it qualifies for and
    // withdraws it at the first epoch it no longer does.
    //
    // VF-STK-010 forces epochs to close chronologically, which is exactly the
    // property that lets a running accumulator advance in O(1) per epoch.
    mapping(uint256 => uint256) public weightAddedAt;
    mapping(uint256 => uint256) public weightRemovedAt;
    uint256 public runningQualifyingWeight;
    uint256 public lastClosedEpoch;

    // Each position's registered qualifying range, so a later mutation can
    // undo precisely what was recorded rather than recomputing it.
    mapping(uint256 => uint256) public posFirstEpoch;
    mapping(uint256 => uint256) public posLastEpoch;
    mapping(uint256 => uint256) public posRegisteredWeight;

    // VF-STK-016: Claimable VCLM accumulates and never expires
    mapping(address => uint256) public claimableVclm;

    // ===== Events =====

    event PositionCreated(uint256 indexed positionId, address indexed owner, uint8 token, uint256 amount, uint256 durationSecs);
    event ExtensionQueued(uint256 indexed positionId, uint256 durationSecs);
    event PositionExtended(uint256 indexed positionId, uint256 newEndTimestamp);
    event PositionWithdrawn(uint256 indexed positionId);
    event EpochClosed(uint256 indexed epoch, uint256 rewardBasis, uint256 totalWeight);
    event EpochAllocationProgress(uint256 indexed epochN, uint256 processed, uint256 total);
    event EpochAllocated(uint256 indexed epoch, uint256 mintedVclm, uint256 distributions);
    event VclmClaimed(address indexed owner, uint256 amount);
    event TerminalStateEntered();
    constructor(

        address _vclmToken,
        address _chonxToken,
        address _synthToken,
        address _verifier,
        uint256 _launchTimestamp,
        address _cap
    ) {
        require(_cap != address(0), "VF-DEP-002: zero cap");
        // CL-21: an unset T0 is rejected, never defaulted to zero.
        require(_launchTimestamp > 0, "CL-21: launchTimestamp not set");
        launchTimestamp = _launchTimestamp;
        vclmToken = IVclmToken(_vclmToken);
        chonxToken = IStakeToken(_chonxToken);
        synthToken = IStakeToken(_synthToken);
        verifier = IVerifier(_verifier);
        cap = IVinculumFinalisCap(_cap);
    }

    // ===== VF-STK-001/002/031: Create stake position =====

    function createPosition(uint8 token, uint256 amount, uint256 durationSecs) external returns (uint256) {
        // VF-STK-029: Terminal state — no new positions
        require(!terminalState, "VF-STK-029: terminal state");

        // VF-STK-002: Only VCLM/CHONX/SYNTH
        require(token <= 2, "VF-STK-002: invalid token");

        // VF-STK-031: Positive nonzero amount
        require(amount > 0, "VF-STK-031: zero amount");

        // VF-STK-003: Only listed durations
        uint16 multBps = _getStakeMultiplier(durationSecs);
        require(multBps > 0, "VF-STK-003: duration not permitted");

        // Transfer staked tokens from caller
        IStakeToken stakeToken = token == 0 ? vclmToken : (token == 1 ? chonxToken : synthToken);
        require(stakeToken.transferFrom(msg.sender, address(this), amount), "VFS: transfer failed");

        uint256 id = nextPositionId++;
        uint256 start = block.timestamp;
        positions[id] = Position({
            owner: msg.sender,
            token: token,
            amount: amount,
            durationSecs: durationSecs,
            startTimestamp: start,
            endTimestamp: start + durationSecs,
            multiplierBps: multBps,
            queuedExtensionBps: 0,
            queuedExtensionSecs: 0,
            withdrawn: false
        });

        // CL-09: record this position's weight across its qualifying range.
        _registerWeight(id, _getWeight(positions[id]), start, start + durationSecs);

        emit PositionCreated(id, msg.sender, token, amount, durationSecs);
        return id;
    }

    // ===== VF-STK-021/022/023/024: Queue extension =====

    function queueExtension(uint256 positionId, uint256 durationSecs) external {
        Position storage pos = positions[positionId];
        require(pos.owner == msg.sender, "VFS: not owner");
        require(!pos.withdrawn, "VFS: withdrawn");

        // CL-14 / VF-STK-021: extensions may only be queued while the position
        // is ACTIVE. VF-STK-025 forbids an expired position retroactively
        // covering an inactivity gap.
        require(block.timestamp < pos.endTimestamp, "VF-STK-025: position not active");

        // VF-STK-023: Only one future term at a time
        require(pos.queuedExtensionBps == 0, "VF-STK-023: already queued");

        uint16 multBps = _getStakeMultiplier(durationSecs);
        require(multBps > 0, "VF-STK-003: duration not permitted");

        // VF-STK-024: Extension adds/removes no tokens, charges no fee
        pos.queuedExtensionBps = multBps;
        pos.queuedExtensionSecs = durationSecs;
        emit ExtensionQueued(positionId, durationSecs);
    }

    function applyExtensionIfMatured(uint256 positionId) external {
        Position storage pos = positions[positionId];
        require(pos.owner == msg.sender, "VFS: not owner");
        require(!pos.withdrawn, "VFS: withdrawn");
        require(pos.queuedExtensionBps > 0, "VFS: no queued extension");
        require(block.timestamp >= pos.endTimestamp, "VFS: not matured");

        // CL-09: the extension changes both start and end, so the previously
        // registered range is cancelled in full and re-registered.
        _unregisterWeight(positionId);

        // VF-STK-022: Queued term begins at scheduled end of current
        pos.startTimestamp = pos.endTimestamp;
        pos.durationSecs = pos.queuedExtensionSecs;
        pos.endTimestamp = pos.startTimestamp + pos.queuedExtensionSecs;
        pos.multiplierBps = pos.queuedExtensionBps;
        pos.queuedExtensionBps = 0;
        pos.queuedExtensionSecs = 0;
        _registerWeight(positionId, _getWeight(pos), pos.startTimestamp, pos.endTimestamp);

        emit PositionExtended(positionId, pos.endTimestamp);
    }

    // ===== VF-STK-025/030: Withdrawal =====

    function withdrawPosition(uint256 positionId) external {
        Position storage pos = positions[positionId];
        require(pos.owner == msg.sender, "VFS: not owner");
        require(!pos.withdrawn, "VFS: withdrawn");
        // CL-15 / VF-STK-030: at terminal state all staked tokens become
        // IMMEDIATELY withdrawable, matured or not.
        if (!terminalState) {
            require(block.timestamp >= pos.endTimestamp, "VFS: not matured");
        }
        // VF-STK-025: Without queued extension, position inactive at maturity

        pos.withdrawn = true;
        withdrawnAt[positionId] = block.timestamp;   // CL-89

        // PROTOCOL RULE — leave before the payout, get nothing. INTENTIONAL.
        // Do not "fix" this. Closed under VF-STK-020, which protects only
        // ACCUMULATED claimable VCLM — rewards already credited by a completed
        // allocation. An entitlement that has not yet been allocated is not
        // protected, so withdrawing before the payout forfeits it. VF-STK-013
        // makes an entitlement "fixed and allocatable" after the scheduled end
        // of N+1; allocatable is not the same as accumulated.
        //
        // Mechanics: this cuts at `lastClosedEpoch + 1`, so a closed epoch keeps
        // the weight it closed with (VF-STK-026 freezes the denominator).
        // `allocateEpoch` skips withdrawn positions, so the share is credited to
        // nobody and joins the stranded remainder (VF-STK-027, CL-87).
        // Denominator unchanged, numerator forfeited — deliberate.
        //
        // Regression: 29_withdrawal_forfeit.test.cjs.
        _cancelFutureWeight(positionId);

        // Return staked tokens (VF-STK-030: immediately withdrawable at terminal state)
        IStakeToken stakeToken = pos.token == 0 ? vclmToken : (pos.token == 1 ? chonxToken : synthToken);
        require(stakeToken.transfer(pos.owner, pos.amount), "VFS: return failed");

        // VF-STK-020: Withdrawal does not erase claimable VCLM
        emit PositionWithdrawn(positionId);
    }

    // ===== BASE-EPOCH Phase 1: Close (VF-RAC-004, VF-STK-006-010) =====

    function closeEpoch(uint256 epochN) external {
        // VF-STK-008: Permissionless finalization
        Epoch storage ep = epochs[epochN];
        require(!ep.closed, "VFS: already closed");

        // CL-22: epochs are 1-indexed.
        require(epochN >= 1, "VF-STK-010: epoch numbering begins at 1");

        // VF-STK-010: Chronological order
        if (epochN > 1) {
            require(epochs[epochN - 1].closed, "VF-STK-010: chronological order");
        }

        // CL-06 / VF-RAC-004: Epoch Reward Basis is the sum of RAC credits
        // assigned to this epoch. Read from the Verifier's running total.
        // Previously this line did not exist, so rewardBasis stayed zero and
        // allocateEpoch always took the zero-eligible branch — no staker could
        // ever be paid.
        ep.rewardBasis = verifier.epochRewardBasis(epochN);

        // CL-09: O(1). The running accumulator advances by this epoch's
        // deltas rather than iterating every position ever created.
        // VF-STK-010's chronological requirement is what makes this sound:
        // epoch N-1 is always closed before N, so the accumulator is always
        // current when read.
        require(epochN == lastClosedEpoch + 1, "VF-STK-010: chronological order");
        runningQualifyingWeight =
            runningQualifyingWeight + weightAddedAt[epochN] - weightRemovedAt[epochN];
        lastClosedEpoch = epochN;
        ep.totalWeight = runningQualifyingWeight;
        {
        }

        ep.closed = true;
        ep.closeTimestamp = block.timestamp;
        // rewardBasis would be set from verifier RAC storage in production
        emit EpochClosed(epochN, ep.rewardBasis, ep.totalWeight);
    }

    // ===== BASE-EPOCH Phase 2: Allocate (VF-STK-013-015, VF-RAC-005/006) =====

    /// @notice Allocate an epoch's reward. May be called repeatedly until done.
    /// @param maxCount Maximum positions to process in this call. 0 = no limit.
    ///
    /// CL-89. The reward is minted once, complete, on the FIRST call
    /// (VF-STK-014, CL-87). Entitlements are then recorded over as many calls as
    /// needed. VF-STK-028 prohibits partial epoch reward MINTING; it does not
    /// prohibit recording entitlements across transactions, and no requirement
    /// in Rev 6 mandates single-transaction allocation.
    ///
    /// The result is identical whether this takes one call or fifty:
    ///   - `totalReward` and `ep.totalWeight` are both frozen before the first
    ///     entitlement is recorded, so every share is computed against the same
    ///     numerator and denominator (VF-STK-026);
    ///   - the work list `epochPositions[epochN]` is fixed at registration;
    ///   - `allocStartTimestamp` fixes who counts as withdrawn, so a withdrawal
    ///     during allocation cannot change the outcome for anyone.
    function allocateEpoch(uint256 epochN, uint256 maxCount) public {
        Epoch storage ep = epochs[epochN];
        require(epochN >= 1, "VF-STK-011: epoch numbering begins at 1");
        require(ep.closed, "VFS: not closed");
        require(!ep.allocated, "VFS: already allocated");

        uint256 nPlus1End = launchTimestamp + ((epochN + 1) * EPOCH_DURATION_SECS);
        require(block.timestamp >= nPlus1End, "VF-STK-013: wait for N+1 end");

        if (ep.rewardBasis == 0 || ep.totalWeight == 0) {
            // VF-STK-015: nothing to allocate.
            ep.allocated = true;
            ep.allocateTimestamp = block.timestamp;
            emit EpochAllocated(epochN, 0, 0);
            return;
        }

        // VF-RAC-005: reward derived from the epoch basis at the permanent reference value.
        uint256 totalReward = (ep.rewardBasis * 100) / REWARD_REFERENCE_CENTS;

        // ---- first call only: mint once, complete, and freeze the payout ----
        if (ep.allocStartTimestamp == 0) {
            uint256 remaining = cap.remainingVclmCapacity();

            // CL-08 / VF-STK-029: terminal state at zero remaining capacity.
            if (remaining == 0 && !terminalState) {
                terminalState = true;
                emit TerminalStateEntered();
            }

            if (totalReward > remaining) {
                ep.allocated = true;
                ep.allocateTimestamp = block.timestamp;
                emit EpochAllocated(epochN, 0, 0);
                return;
            }

            ep.allocStartTimestamp = block.timestamp;

            // CL-87 / VF-STK-014: the COMPLETE Epoch Reward is minted once, not
            // the rounded-down sum. Shares round down (VF-STK-026); the
            // remainder stays permanently in this contract, inaccessible,
            // never reassigned or redirected (VF-STK-027).
            ep.mintedVclm = totalReward;
            cap.recordVclmIssuance(totalReward);
            vclmToken.mint(address(this), totalReward);
        }

        // ---- record entitlements, bounded ----
        uint256[] storage work = epochPositions[epochN];
        uint256 i = ep.allocCursor;
        uint256 stop = work.length;
        if (maxCount != 0 && i + maxCount < stop) {
            stop = i + maxCount;
        }

        uint256 distributed = ep.distributedSoFar;
        for (; i < stop; i++) {
            uint256 id = work[i];
            Position storage pos = positions[id];

            // PROTOCOL RULE (VF-STK-020): leave before the payout, get nothing.
            // The specification protects ACCUMULATED claimable VCLM only. A
            // position withdrawn before this epoch's payout began is not paid.
            // One withdrawn AFTER it began is paid, because the payout was
            // already under way — which is also what makes the result
            // independent of batch size.
            if (pos.withdrawn && withdrawnAt[id] < ep.allocStartTimestamp) continue;

            if (!_qualifiesForEpoch(pos, epochN)) continue;

            uint256 weight = _getWeight(pos);
            uint256 share = (totalReward * weight) / ep.totalWeight;
            if (share > 0) {
                claimableVclm[pos.owner] += share;   // VF-STK-016
                distributed += share;
            }
        }

        ep.allocCursor = i;
        ep.distributedSoFar = distributed;

        if (i >= work.length) {
            ep.allocated = true;
            ep.allocateTimestamp = block.timestamp;
            emit EpochAllocated(epochN, ep.mintedVclm, 0);
        } else {
            emit EpochAllocationProgress(epochN, i, work.length);
        }
    }

    /// @notice Allocate an epoch in one call. Reverts if it would not fit.
    function allocateEpoch(uint256 epochN) external {
        allocateEpoch(epochN, 0);
    }

    // ===== VF-STK-016/017/018/019: Claim =====

    function claimVclm() external returns (uint256) {
        uint256 amount = claimableVclm[msg.sender];
        require(amount > 0, "VFS: no claimable");
        claimableVclm[msg.sender] = 0;
        // VF-STK-018: Transfer minted VCLM; no re-mint
        // VF-STK-019: Only to owner
        require(vclmToken.transfer(msg.sender, amount), "VFS: transfer failed");
        emit VclmClaimed(msg.sender, amount);
        return amount;
    }

    // ===== Views =====

    function getClaimableVclm(address owner) external view returns (uint256) {
        return claimableVclm[owner];
    }

    // CL-23: returns 0 before launch rather than underflowing.
    function getCurrentEpoch() external view returns (uint256) {
        if (block.timestamp < launchTimestamp) return 0;
        return ((block.timestamp - launchTimestamp) / EPOCH_DURATION_SECS) + 1;
    }

    function _getStakeMultiplier(uint256 durationSecs) internal pure returns (uint16) {
        if (durationSecs == DUR_30D) return DUR_30D_BPS;
        if (durationSecs == DUR_60D) return DUR_60D_BPS;
        if (durationSecs == DUR_90D) return DUR_90D_BPS;
        if (durationSecs == DUR_120D) return DUR_120D_BPS;
        return 0;
    }

    // CL-03 / §10.1: Weight = amount x token multiplier x duration multiplier.
    // Single division floors once; do not split into two divisions.
    function _getWeight(Position storage pos) internal view returns (uint256) {
        return (pos.amount * _getTokenMultiplier(pos.token) * pos.multiplierBps) / 1e8;
    }

    // VF-STK-002 bounds token to 0..2; revert rather than default (CL-26).
    function _getTokenMultiplier(uint8 token) internal pure returns (uint16) {
        if (token == 0) return TOKEN_VCLM_BPS;
        if (token == 1) return TOKEN_CHONX_BPS;
        if (token == 2) return TOKEN_SYNTH_BPS;
        revert("VF-STK-002: invalid token");
    }

    // CL-34: §10.1 must be observable from outside the contract.
    function getPositionWeight(uint256 positionId) external view returns (uint256) {
        Position storage pos = positions[positionId];
        require(pos.owner != address(0), "VFS: unknown position");
        return _getWeight(pos);
    }

    // VF-STK-011: Position beginning after epoch start does not qualify for N
    // VF-STK-012: Position expiring before end of N+1 does not qualify for N
    // CL-09: first epoch N with start <= T0+(N-1)E  ->  N = ceil((start-T0)/E)+1
    function _firstQualifyingEpoch(uint256 start) internal view returns (uint256) {
        if (start <= launchTimestamp) return 1;
        uint256 d = start - launchTimestamp;
        uint256 n = d / EPOCH_DURATION_SECS;
        if (d % EPOCH_DURATION_SECS != 0) n += 1;   // ceil
        return n + 1;
    }

    // CL-09: last epoch N with end >= T0+(N+1)E  ->  N = floor((end-T0)/E)-1
    function _lastQualifyingEpoch(uint256 end) internal view returns (uint256) {
        if (end <= launchTimestamp) return 0;
        uint256 n = (end - launchTimestamp) / EPOCH_DURATION_SECS;
        if (n == 0) return 0;
        return n - 1;
    }

    /// @dev Registers a position's weight across its qualifying epoch range.
    function _registerWeight(uint256 id, uint256 weight, uint256 start, uint256 end) internal {
        uint256 first = _firstQualifyingEpoch(start);
        uint256 last = _lastQualifyingEpoch(end);
        posRegisteredWeight[id] = weight;
        if (last < first || weight == 0) {
            posFirstEpoch[id] = 0;
            posLastEpoch[id] = 0;
            return;   // qualifies for no epoch at all
        }
        posFirstEpoch[id] = first;
        posLastEpoch[id] = last;
        weightAddedAt[first] += weight;
        weightRemovedAt[last + 1] += weight;

        // CL-89: append to each qualifying epoch's work list. Bounded by
        // maxTerm / EPOCH = 12. Extensions re-register with a range beginning at
        // the previous end, so ranges never overlap and no position is listed
        // twice for one epoch.
        for (uint256 e = first; e <= last; e++) {
            epochPositions[e].push(id);
        }
    }

    /// @dev Removes a previously registered range in full. Used before
    ///      re-registering on extension.
    function _unregisterWeight(uint256 id) internal {
        uint256 first = posFirstEpoch[id];
        if (first == 0) { posRegisteredWeight[id] = 0; return; }
        uint256 last = posLastEpoch[id];
        uint256 w = posRegisteredWeight[id];
        weightAddedAt[first] -= w;
        weightRemovedAt[last + 1] -= w;
        posFirstEpoch[id] = 0;
        posLastEpoch[id] = 0;
        posRegisteredWeight[id] = 0;
    }

    /// @dev Cancels a position's contribution from the first epoch not yet
    ///      closed. Used for terminal-state early withdrawal, where epochs
    ///      already closed must keep the weight they were closed with.
    function _cancelFutureWeight(uint256 id) internal {
        uint256 first = posFirstEpoch[id];
        if (first == 0) return;
        uint256 last = posLastEpoch[id];
        uint256 w = posRegisteredWeight[id];
        uint256 cutoff = lastClosedEpoch + 1;
        if (cutoff <= first) {
            // Nothing of it has been counted yet: remove the whole range.
            weightAddedAt[first] -= w;
            weightRemovedAt[last + 1] -= w;
        } else if (cutoff <= last) {
            // Partly counted: move the removal boundary earlier.
            weightRemovedAt[cutoff] += w;
            weightRemovedAt[last + 1] -= w;
        }
        // cutoff > last: already fully expired, nothing to cancel.
        posFirstEpoch[id] = 0;
        posLastEpoch[id] = 0;
        posRegisteredWeight[id] = 0;
    }

    function _qualifiesForEpoch(Position storage pos, uint256 epochN) internal view returns (bool) {
        // CL-22: epochs are 1-indexed; epoch 0 does not exist.
        require(epochN >= 1, "VF-STK-011: epoch numbering begins at 1");
        uint256 epochStart = launchTimestamp + ((epochN - 1) * EPOCH_DURATION_SECS);
        uint256 nPlus1End = launchTimestamp + ((epochN + 1) * EPOCH_DURATION_SECS);
        return pos.startTimestamp <= epochStart && pos.endTimestamp >= nPlus1End;
    }
}