// =============================================================================
// VinculumFinalisEvmVault — source-chain Commitment Vault for remote EVM
//
// Addresses CL-82. Architecture C.1 specifies the mechanism: "vault contract
// createLock() atomic. Native ETH path: payable with msg.value; Token path:
// ERC-20 transferFrom with actual-received verification." C.2 through C.5 and
// C.7 specify the same mechanism for BNB, Avalanche, Polygon, Arbitrum and
// Optimism.
//
// DEPLOYED ON THE SOURCE CHAIN, NOT ON BASE.
//   One instance per environment. Its lock event is what the corresponding
//   Base-side verifier proves — EthereumChainVerifier, OpStackChainVerifier,
//   PolygonChainVerifier, ArbitrumChainVerifier.
//
// NO PRICE ORACLE, AND THAT IS DELIBERATE
//   VF-ORC-007 places the valuation path on Base: "The Base valuation path
//   accepts only a valid signed and batched price record." VF-ORC-011 sets the
//   Valuation Timestamp from the source block, and VF-ORC-012 has one accepted
//   price determine both USD figures — all on the Base side.
//
//   So this vault records amounts in native units and never computes USD. The
//   handshake band (VF-COM-003) and the standard minimum (VF-COM-009) are
//   enforced at issuance by VinculumFinalisVerifier, which holds the signed
//   price records. A source-chain oracle would duplicate that and could
//   disagree with it.
//
//   This differs from VinculumFinalisBaseVault, which does derive USD — because
//   on Base the valuation path is local.
//
// EVENT LAYOUT IS LOAD-BEARING
//   The Base-side verifiers read this event: lockId as the first indexed topic,
//   then six data words in order — gross, fee, principal, duration, creation,
//   maturity. Changing the order or the indexing breaks every EVM verifier.
//
// ISOLATION (VF-IMM-006)
//   One CommitmentLock clone per lock, as on Base. Each lock's principal is
//   isolated by construction rather than by accounting, and release depends on
//   nothing outside that clone.
//
// SPDX-License-Identifier: PROTOCOL-RESTRICTED
// Solidity 0.8.19+
// =============================================================================

pragma solidity 0.8.19;

import "./CommitmentLock.sol";

contract VinculumFinalisEvmVault {

    // -------------------------------------------------------------------------
    // Protocol constants — Revision 6
    // -------------------------------------------------------------------------

    uint256 public constant HANDSHAKE_FEE_BPS       = 250;   // 2.50%
    uint256 public constant STANDARD_FEE_BPS        = 500;   // 5.00%
    uint64  public constant HANDSHAKE_DURATION_SECS = 3600;

    /// VF-COM-006: persistent atomic per-identity state permits three.
    uint32 public constant HANDSHAKE_ALLOWANCE = 3;

    uint8 public constant OUTPUT_VCLM  = 0;
    uint8 public constant OUTPUT_CHONX = 1;

    // -------------------------------------------------------------------------
    // Immutable configuration
    // -------------------------------------------------------------------------

    /// @notice This environment's identifier, e.g. "ethereum".
    string public environmentId;
    address public immutable devFundDestination;
    address public immutable lockImplementation;
    address public immutable deployer;

    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------

    struct LockRecord {
        bytes32 lockId;
        address sourceAccount;
        address asset;                  // address(0) = native
        bytes32 canonicalAssetId;
        address lockContract;
        uint256 grossAmount;
        uint256 feeAmount;
        uint256 principalAmount;
        uint64  durationSecs;
        uint64  creationTime;
        uint64  maturityTime;
        address baseRecipient;
        address releaseDestination;
        uint8   outputToken;
        bytes32 chonxActivationReceipt;
        uint32  handshakeAllowanceCount;
        bool    exists;
    }

    mapping(bytes32 => LockRecord) private _locks;
    /// @notice token address -> canonical asset id. Zero means not approved.
    mapping(address => bytes32) public approvedAsset;
    mapping(address => uint32) public handshakeUsed;

    bool public configurationFinalized;
    uint256 private _reentrancyFlag;

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error NotDeployer();
    error AlreadyFinalized();
    error NotFinalized();
    error Reentrancy();
    error ZeroAddress();
    error DurationNotPermitted(uint64 durationSecs);
    error LockAlreadyExists(bytes32 lockId);
    error InvalidLockId();
    error AssetNotInRegistry(address asset);
    error AllowanceExhausted(address identity);
    error ChonxNotActivated();
    error InvalidOutputToken();
    error ZeroAmount();
    error ZeroFeeOrPrincipal();
    error NativeValueMismatch(uint256 expected, uint256 actual);
    error UnexpectedNativeValue();
    error TransferFailed();
    error GrossNotReceived(uint256 expected, uint256 actual);
    error CloneFailed();

    // -------------------------------------------------------------------------
    // Events — the six data words are read by the Base-side verifiers.
    // -------------------------------------------------------------------------

    /// @notice The lock event. Order and indexing are load-bearing.
    event CommitVaultLock(
        bytes32 indexed lockId,
        uint256 grossAmount,
        uint256 feeAmount,
        uint256 principalAmount,
        uint256 durationSecs,
        uint256 creationTimestamp,
        uint256 maturityTimestamp
    );

    /// @notice Fields the verifiers do not read, emitted for observability and
    ///         for the Base-side cross-check (VF-XCH-011).
    event CommitVaultLockDetail(
        bytes32 indexed lockId,
        string  sourceEnvironment,
        address indexed sourceAccount,
        bytes32 indexed canonicalAssetId,
        address asset,
        address lockContract,
        address baseRecipient,
        address releaseDestination,
        uint8   outputToken,
        bytes32 chonxActivationReceipt,
        uint32  handshakeAllowanceCount,
        address feeDestination
    );

    event AssetRegistered(address indexed asset, bytes32 indexed canonicalAssetId);
    event ConfigurationFinalized();

    // -------------------------------------------------------------------------
    // Modifiers
    // -------------------------------------------------------------------------

    modifier onlyDuringDeployment() {
        if (configurationFinalized) revert AlreadyFinalized();
        if (msg.sender != deployer) revert NotDeployer();
        _;
    }

    modifier onlyWhenFinalized() {
        if (!configurationFinalized) revert NotFinalized();
        _;
    }

    modifier nonReentrant() {
        if (_reentrancyFlag != 0) revert Reentrancy();
        _reentrancyFlag = 1;
        _;
        _reentrancyFlag = 0;
    }

    // -------------------------------------------------------------------------
    // Construction
    // -------------------------------------------------------------------------

    constructor(string memory _environmentId, address _devFundDestination) {
        if (_devFundDestination == address(0)) revert ZeroAddress();
        environmentId = _environmentId;
        devFundDestination = _devFundDestination;
        deployer = msg.sender;
        lockImplementation = address(new CommitmentLock());
    }

    /// @notice Bind a token address to its canonical asset identity.
    /// @dev VF-ARC-004: a known-invalid request is rejected before assets move.
    ///      Native currency is registered as address(0).
    function registerAsset(address asset, bytes32 canonicalAssetId)
        external onlyDuringDeployment
    {
        if (canonicalAssetId == bytes32(0)) revert AssetNotInRegistry(asset);
        approvedAsset[asset] = canonicalAssetId;
        emit AssetRegistered(asset, canonicalAssetId);
    }

    /// @notice Close configuration permanently.
    function finalizeConfiguration() external onlyDuringDeployment {
        configurationFinalized = true;
        emit ConfigurationFinalized();
    }

    // -------------------------------------------------------------------------
    // Lock creation
    // -------------------------------------------------------------------------

    struct CommitParams {
        bytes32 lockId;
        address asset;
        uint256 grossAmount;
        uint64  durationSecs;
        address baseRecipient;
        address releaseDestination;
        uint8   outputToken;
        bytes32 chonxActivationReceipt;
    }

    /// @notice Create a Commitment Vault Lock on this source chain.
    /// @dev Atomic: fee routing, lock storage, allowance increment and clone
    ///      funding commit together or revert together.
    function createLock(CommitParams calldata p)
        external payable onlyWhenFinalized nonReentrant
        returns (address lockContract)
    {
        // ---- validation, before any value moves ----------------------------

        if (!_isPermittedDuration(p.durationSecs)) {
            revert DurationNotPermitted(p.durationSecs);
        }
        if (p.lockId == bytes32(0)) revert InvalidLockId();
        if (_locks[p.lockId].exists) revert LockAlreadyExists(p.lockId);
        if (p.baseRecipient == address(0) || p.releaseDestination == address(0)) {
            revert ZeroAddress();
        }
        if (p.outputToken != OUTPUT_VCLM && p.outputToken != OUTPUT_CHONX) {
            revert InvalidOutputToken();
        }
        if (p.grossAmount == 0) revert ZeroAmount();

        bytes32 canonicalAssetId = approvedAsset[p.asset];
        if (canonicalAssetId == bytes32(0)) revert AssetNotInRegistry(p.asset);

        // VF-COM-025: CHONX output requires a causal activation receipt.
        if (p.outputToken == OUTPUT_CHONX && p.chonxActivationReceipt == bytes32(0)) {
            revert ChonxNotActivated();
        }

        bool isHandshake = p.durationSecs == HANDSHAKE_DURATION_SECS;
        if (isHandshake && handshakeUsed[msg.sender] >= HANDSHAKE_ALLOWANCE) {
            revert AllowanceExhausted(msg.sender);
        }

        // VF-COM-011/012/013. No USD check here: valuation is Base's, per
        // VF-ORC-007.
        uint256 bps       = isHandshake ? HANDSHAKE_FEE_BPS : STANDARD_FEE_BPS;
        uint256 feeAmount = (p.grossAmount * bps) / 10000;
        uint256 principal = p.grossAmount - feeAmount;
        if (feeAmount == 0 || principal == 0) revert ZeroFeeOrPrincipal();

        // ---- take custody ---------------------------------------------------

        if (p.asset == address(0)) {
            if (msg.value != p.grossAmount) {
                revert NativeValueMismatch(p.grossAmount, msg.value);
            }
        } else {
            if (msg.value != 0) revert UnexpectedNativeValue();
            uint256 before = _erc20BalanceOf(p.asset, address(this));
            _safeTransferFrom(p.asset, msg.sender, address(this), p.grossAmount);
            uint256 received = _erc20BalanceOf(p.asset, address(this)) - before;
            // C.1: actual-received verification. Fail closed on fee-on-transfer
            // and rebasing assets rather than locking a different amount than
            // the record states.
            if (received != p.grossAmount) {
                revert GrossNotReceived(p.grossAmount, received);
            }
        }

        // ---- state -----------------------------------------------------------

        uint64 creationTime = uint64(block.timestamp);
        uint64 maturityTime = creationTime + p.durationSecs;

        lockContract = _cloneLock();
        CommitmentLock(payable(lockContract)).initialize(
            p.lockId, p.asset, principal, creationTime, maturityTime, p.releaseDestination
        );

        uint32 allowanceCount = handshakeUsed[msg.sender];
        if (isHandshake) {
            allowanceCount += 1;
            handshakeUsed[msg.sender] = allowanceCount;
        }

        _locks[p.lockId] = LockRecord({
            lockId:                  p.lockId,
            sourceAccount:           msg.sender,
            asset:                   p.asset,
            canonicalAssetId:        canonicalAssetId,
            lockContract:            lockContract,
            grossAmount:             p.grossAmount,
            feeAmount:               feeAmount,
            principalAmount:         principal,
            durationSecs:            p.durationSecs,
            creationTime:            creationTime,
            maturityTime:            maturityTime,
            baseRecipient:           p.baseRecipient,
            releaseDestination:      p.releaseDestination,
            outputToken:             p.outputToken,
            chonxActivationReceipt:  p.chonxActivationReceipt,
            handshakeAllowanceCount: allowanceCount,
            exists:                  true
        });

        // ---- value movement --------------------------------------------------

        if (p.asset == address(0)) {
            (bool okFee, ) = devFundDestination.call{value: feeAmount}("");
            if (!okFee) revert TransferFailed();
            (bool okPrin, ) = lockContract.call{value: principal}("");
            if (!okPrin) revert TransferFailed();
        } else {
            _safeTransfer(p.asset, devFundDestination, feeAmount);
            _safeTransfer(p.asset, lockContract, principal);
        }

        CommitmentLock(payable(lockContract)).confirmFunded();

        _emitLock(p.lockId);
    }

    /// @dev Emitted from storage so the event and the record cannot disagree.
    function _emitLock(bytes32 lockId) private {
        LockRecord storage r = _locks[lockId];

        emit CommitVaultLock(
            r.lockId,
            r.grossAmount,
            r.feeAmount,
            r.principalAmount,
            uint256(r.durationSecs),
            uint256(r.creationTime),
            uint256(r.maturityTime)
        );

        emit CommitVaultLockDetail(
            r.lockId,
            environmentId,
            r.sourceAccount,
            r.canonicalAssetId,
            r.asset,
            r.lockContract,
            r.baseRecipient,
            r.releaseDestination,
            r.outputToken,
            r.chonxActivationReceipt,
            r.handshakeAllowanceCount,
            devFundDestination
        );
    }

    // -------------------------------------------------------------------------
    // Views
    // -------------------------------------------------------------------------

    function getLock(bytes32 lockId) external view returns (LockRecord memory) {
        return _locks[lockId];
    }

    function lockExists(bytes32 lockId) external view returns (bool) {
        return _locks[lockId].exists;
    }

    function isReleased(bytes32 lockId) external view returns (bool) {
        address c = _locks[lockId].lockContract;
        if (c == address(0)) return false;
        return CommitmentLock(payable(c)).released();
    }

    function handshakeRemaining(address identity) external view returns (uint32) {
        uint32 used = handshakeUsed[identity];
        return used >= HANDSHAKE_ALLOWANCE ? 0 : HANDSHAKE_ALLOWANCE - used;
    }

    // -------------------------------------------------------------------------
    // Internal
    // -------------------------------------------------------------------------

    /// @dev The 16 permitted durations, Revision 6 Section 5.1.
    function _isPermittedDuration(uint64 d) internal pure returns (bool) {
        return
            d == 3600            ||
            d == 7    * 86400    ||
            d == 30   * 86400    ||
            d == 60   * 86400    ||
            d == 90   * 86400    ||
            d == 180  * 86400    ||
            d == 365  * 86400    ||
            d == 730  * 86400    ||
            d == 1095 * 86400    ||
            d == 1460 * 86400    ||
            d == 1825 * 86400    ||
            d == 2190 * 86400    ||
            d == 2555 * 86400    ||
            d == 2920 * 86400    ||
            d == 3285 * 86400    ||
            d == 3650 * 86400;
    }

    /// @dev EIP-1167 minimal proxy, written inline: no external dependencies.
    function _cloneLock() internal returns (address instance) {
        address impl = lockImplementation;
        assembly ("memory-safe") {
            let ptr := mload(0x40)
            mstore(ptr, 0x3d602d80600a3d3981f3363d3d373d3d3d363d73000000000000000000000000)
            mstore(add(ptr, 0x14), shl(0x60, impl))
            mstore(add(ptr, 0x28), 0x5af43d82803e903d91602b57fd5bf30000000000000000000000000000000000)
            instance := create(0, ptr, 0x37)
        }
        if (instance == address(0)) revert CloneFailed();
    }

    function _safeTransfer(address token, address to, uint256 value) private {
        (bool ok, bytes memory data) =
            token.call(abi.encodeWithSelector(0xa9059cbb, to, value));
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
    }

    function _safeTransferFrom(address token, address from, address to, uint256 value) private {
        (bool ok, bytes memory data) =
            token.call(abi.encodeWithSelector(0x23b872dd, from, to, value));
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
    }

    function _erc20BalanceOf(address token, address who) private view returns (uint256) {
        (bool ok, bytes memory data) =
            token.staticcall(abi.encodeWithSelector(0x70a08231, who));
        if (!ok || data.length < 32) revert TransferFailed();
        return abi.decode(data, (uint256));
    }
}
