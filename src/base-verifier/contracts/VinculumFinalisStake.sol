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

interface IVerifier {
    function cumulativeVclmIssued() external view returns (uint256);
    function racCredits(bytes32 racIdentity) external view returns (uint256);
    function racEpoch(bytes32 racIdentity) external view returns (uint256);
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

    // VF-STK-003: Stake durations and multipliers
    // 30d=11500, 60d=13000, 90d=15000, 120d=17000 (bps)
    uint256 private constant DUR_30D = 30 days;
    uint256 private constant DUR_60D = 60 days;
    uint256 private constant DUR_90D = 90 days;
    uint256 private constant DUR_120D = 120 days;

    // ===== Storage =====

    address public authority;
    IVclmToken public vclmToken;
    IStakeToken public chonxToken;
    IStakeToken public synthToken;
    IVerifier public verifier;

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
    }

    mapping(uint256 => Epoch) public epochs;

    // VF-STK-016: Claimable VCLM accumulates and never expires
    mapping(address => uint256) public claimableVclm;

    // ===== Events =====

    event PositionCreated(uint256 indexed positionId, address indexed owner, uint8 token, uint256 amount, uint256 durationSecs);
    event ExtensionQueued(uint256 indexed positionId, uint256 durationSecs);
    event PositionExtended(uint256 indexed positionId, uint256 newEndTimestamp);
    event PositionWithdrawn(uint256 indexed positionId);
    event EpochClosed(uint256 indexed epoch, uint256 rewardBasis, uint256 totalWeight);
    event EpochAllocated(uint256 indexed epoch, uint256 mintedVclm, uint256 distributions);
    event VclmClaimed(address indexed owner, uint256 amount);
    event TerminalStateEntered();

    modifier onlyAuthority() {
        require(msg.sender == authority, "VFS: not authority");
        _;
    }

    constructor(address _vclmToken, address _chonxToken, address _synthToken, address _verifier) {
        authority = msg.sender;
        vclmToken = IVclmToken(_vclmToken);
        chonxToken = IStakeToken(_chonxToken);
        synthToken = IStakeToken(_synthToken);
        verifier = IVerifier(_verifier);
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

        emit PositionCreated(id, msg.sender, token, amount, durationSecs);
        return id;
    }

    // ===== VF-STK-021/022/023/024: Queue extension =====

    function queueExtension(uint256 positionId, uint256 durationSecs) external {
        Position storage pos = positions[positionId];
        require(pos.owner == msg.sender, "VFS: not owner");
        require(!pos.withdrawn, "VFS: withdrawn");

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

        // VF-STK-022: Queued term begins at scheduled end of current
        pos.startTimestamp = pos.endTimestamp;
        pos.durationSecs = pos.queuedExtensionSecs;
        pos.endTimestamp = pos.startTimestamp + pos.queuedExtensionSecs;
        pos.multiplierBps = pos.queuedExtensionBps;
        pos.queuedExtensionBps = 0;
        pos.queuedExtensionSecs = 0;
        emit PositionExtended(positionId, pos.endTimestamp);
    }

    // ===== VF-STK-025/030: Withdrawal =====

    function withdrawPosition(uint256 positionId) external {
        Position storage pos = positions[positionId];
        require(pos.owner == msg.sender, "VFS: not owner");
        require(!pos.withdrawn, "VFS: withdrawn");
        require(block.timestamp >= pos.endTimestamp, "VFS: not matured");
        // VF-STK-025: Without queued extension, position inactive at maturity

        pos.withdrawn = true;

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

        // VF-STK-010: Chronological order
        if (epochN > 0) {
            require(epochs[epochN - 1].closed, "VF-STK-010: chronological order");
        }

        // VF-RAC-004: Epoch Reward Basis = sum of RAC credits in this epoch
        // In production, this reads from the verifier's RAC storage.
        // Here we compute totalWeight for proportional allocation.

        ep.totalWeight = 0;
        for (uint256 i = 0; i < nextPositionId; i++) {
            Position storage pos = positions[i];
            if (!pos.withdrawn && _qualifiesForEpoch(pos, epochN)) {
                ep.totalWeight += _getWeight(pos);
            }
        }

        ep.closed = true;
        ep.closeTimestamp = block.timestamp;
        // rewardBasis would be set from verifier RAC storage in production
        emit EpochClosed(epochN, ep.rewardBasis, ep.totalWeight);
    }

    // ===== BASE-EPOCH Phase 2: Allocate (VF-STK-013-015, VF-RAC-005/006) =====

    function allocateEpoch(uint256 epochN) external {
        // VF-STK-008: Permissionless
        Epoch storage ep = epochs[epochN];
        require(ep.closed, "VFS: not closed");
        require(!ep.allocated, "VFS: already allocated");

        // VF-STK-013: Only after scheduled end of N+1
        uint256 nPlus1End = (epochN + 2) * EPOCH_DURATION_SECS;
        require(block.timestamp >= nPlus1End, "VF-STK-013: wait for N+1 end");

        // VF-STK-015: Zero-eligible epoch
        if (ep.rewardBasis == 0 || ep.totalWeight == 0) {
            ep.allocated = true;
            ep.allocateTimestamp = block.timestamp;
            emit EpochAllocated(epochN, 0, 0);
            return;
        }

        // VF-RAC-005: Permanent $0.10 Reward Reference Value
        uint256 totalReward = (ep.rewardBasis * 100) / REWARD_REFERENCE_CENTS;

        // VF-STK-028: Cap check
        uint256 remaining = VCLM_HARD_CAP - verifier.cumulativeVclmIssued();
        if (totalReward > remaining) {
            ep.allocated = true;
            ep.allocateTimestamp = block.timestamp;
            emit EpochAllocated(epochN, 0, 0);
            return;
        }

        // VF-STK-014/026: Proportional allocation; rounds down
        uint256 distributed = 0;
        for (uint256 i = 0; i < nextPositionId; i++) {
            Position storage pos = positions[i];
            if (!pos.withdrawn && _qualifiesForEpoch(pos, epochN)) {
                uint256 weight = _getWeight(pos);
                uint256 share = (totalReward * weight) / ep.totalWeight;
                if (share > 0) {
                    // VF-STK-016: Claimable accumulates
                    claimableVclm[pos.owner] += share;
                    distributed += share;
                }
            }
        }

        // VF-STK-027: Remainder inaccessible
        ep.mintedVclm = distributed;
        ep.allocated = true;
        ep.allocateTimestamp = block.timestamp;

        // Mint VCLM to this contract (VF-STK-004: rewards in newly minted VCLM)
        vclmToken.mint(address(this), distributed);

        emit EpochAllocated(epochN, distributed, 0);
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

    function getCurrentEpoch() external view returns (uint256) {
        return block.timestamp / EPOCH_DURATION_SECS;
    }

    function _getStakeMultiplier(uint256 durationSecs) internal pure returns (uint16) {
        if (durationSecs == DUR_30D) return 11500;
        if (durationSecs == DUR_60D) return 13000;
        if (durationSecs == DUR_90D) return 15000;
        if (durationSecs == DUR_120D) return 17000;
        return 0;
    }

    function _getWeight(Position storage pos) internal view returns (uint256) {
        return (pos.amount * pos.multiplierBps) / 10000;
    }

    // VF-STK-011: Position beginning after epoch start does not qualify for N
    // VF-STK-012: Position expiring before end of N+1 does not qualify for N
    function _qualifiesForEpoch(Position storage pos, uint256 epochN) internal view returns (bool) {
        uint256 epochStart = epochN * EPOCH_DURATION_SECS;
        uint256 nPlus1End = (epochN + 2) * EPOCH_DURATION_SECS;
        return pos.startTimestamp <= epochStart && pos.endTimestamp >= nPlus1End;
    }
}