// =============================================================================
// VinculumFinalisBaseVault — Base-native Commitment Vault source mechanism
//
// Addresses CL-79. Base is one of the 17 approved source environments
// (Rev 6 Section 11.1: EVM | Base | 33) and requires a chain-native locking
// mechanism (Rev 6 line 277) exactly as every other environment does.
//
// BEHAVIORAL REFERENCE: cosmos-hub-vault/contracts/vault/src/contract.rs
//   Protocol semantics are identical. Structure is not: CosmWasm's BankMsg and
//   single-denom model do not exist here, and every ERC-20 movement is an
//   external call.
//
// ISOLATION (VF-IMM-006): one CommitmentLock clone per lock. Each lock's
//   principal is isolated from every other lock's by construction, not by
//   accounting. Chosen deliberately over a shared-balance design: in an
//   immutable system with no upgrade path, a structural guarantee is preferable
//   to an arithmetic one, because only one of them can be wrong.
//
// VALUATION (VF-ORC-007/012): Verified Gross USD Value is DERIVED from the
//   oracle-signed price record held by VinculumFinalisVerifier, never supplied
//   by the caller. The Cosmos vault accepts an asserted value because Cosmos has
//   no on-chain valuation path; Base has one.
//
// REGISTRY (VF-REG-001, VF-ARC-004): the token address to canonical asset
//   binding is fixed at deployment. An unapproved asset is rejected before any
//   value moves — CL-71 records the cost of omitting this.
//
// SPDX-License-Identifier: PROTOCOL-RESTRICTED
// Solidity 0.8.19+
// =============================================================================

pragma solidity 0.8.19;

import "./CommitmentLock.sol";

interface IVinculumFinalisVerifier {
    function priceRecords(bytes32 canonicalAssetId)
        external view returns (
            uint256 priceUsdMicro,
            uint64  fetchTimestamp,
            uint64  runId,
            bool    available
        );

    function assetPrecisionTable(bytes32 key)
        external view returns (
            bytes32 canonicalAssetId,
            string memory symbol,
            uint8   decimals,
            uint8   custodyClass,
            uint8   custodyPath
        );
}

contract VinculumFinalisBaseVault {

    // -------------------------------------------------------------------------
    // Protocol constants — transcribed from Revision 6, SHA-256
    // 5a9350618d81005d53b4d05628e7403e8c39fe63847a46576a5fadfbd4ef0bf9
    // Values match VinculumFinalisVerifier exactly.
    // -------------------------------------------------------------------------

    string  public constant ENVIRONMENT_ID = "base";

    uint256 public constant HANDSHAKE_FEE_BPS      = 250;   // 2.50%
    uint256 public constant STANDARD_FEE_BPS       = 500;   // 5.00%
    uint64  public constant HANDSHAKE_DURATION_SECS = 3600;

    /// USD bounds are 18-decimal on Base (published prices are 6-decimal micro).
    uint256 public constant HANDSHAKE_USD_MIN = 0.95e18;
    uint256 public constant HANDSHAKE_USD_MAX = 1.05e18;
    uint256 public constant STANDARD_USD_MIN  = 10e18;

    uint256 private constant MAX_PRICE_RECORD_AGE = 48 hours;

    /// VF-COM-006: Solidity storage maintains persistent atomic per-identity
    /// state, which sets the allowance at three.
    uint32  public constant HANDSHAKE_ALLOWANCE = 3;

    uint8 public constant OUTPUT_VCLM  = 0;
    uint8 public constant OUTPUT_CHONX = 1;

    // -------------------------------------------------------------------------
    // Immutable configuration
    // -------------------------------------------------------------------------

    IVinculumFinalisVerifier public immutable verifier;
    address public immutable devFundDestination;
    address public immutable lockImplementation;
    address public immutable deployer;

    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------

    /// @notice The immutable VF-XCH-011 fact schema for one lock. Every field is
    ///         bound at creation and never mutated (VF-ARC-005).
    struct LockRecord {
        bytes32 lockId;
        address sourceAccount;
        address asset;                    // address(0) = native ETH
        bytes32 canonicalAssetId;
        address lockContract;
        uint256 grossAmount;
        uint256 feeAmount;
        uint256 principalAmount;
        uint256 verifiedGrossUsd;         // 18-decimal
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
    /// @notice Handshake allowance consumed per bound identity (VF-COM-006/007).
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
    error NoUsableValuation(bytes32 canonicalAssetId);
    error PriceRecordStale();
    error HandshakeValueOutOfRange(uint256 verifiedGrossUsd);
    error StandardBelowMinimum(uint256 verifiedGrossUsd);
    error AllowanceExhausted(address identity);
    error ChonxNotActivated();
    error InvalidOutputToken();
    error ZeroAmount();
    error ZeroFeeOrPrincipal();
    error EthValueMismatch(uint256 expected, uint256 actual);
    error UnexpectedEthValue();
    error TransferFailed();
    error GrossNotReceived(uint256 expected, uint256 actual);
    error CloneFailed();

    // -------------------------------------------------------------------------
    // Events — this event IS the VF-XCH-011 evidence.
    // -------------------------------------------------------------------------

    event CommitVaultLock(
        bytes32 indexed lockId,
        address indexed sourceAccount,
        bytes32 indexed canonicalAssetId,
        string  sourceEnvironment,
        address asset,
        address lockContract,
        uint256 grossAmount,
        uint256 feeAmount,
        uint256 principalAmount,
        uint256 verifiedGrossUsd,
        uint64  durationSecs,
        uint64  creationTime,
        uint64  maturityTime,
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
    // Construction and one-way configuration
    // -------------------------------------------------------------------------

    constructor(address _verifier, address _devFundDestination) {
        if (_verifier == address(0) || _devFundDestination == address(0)) {
            revert ZeroAddress();
        }
        verifier           = IVinculumFinalisVerifier(_verifier);
        devFundDestination = _devFundDestination;
        deployer           = msg.sender;
        lockImplementation = address(new CommitmentLock());
    }

    /// @notice Bind a token address to its canonical asset identity.
    /// @dev Deployment-only. Enforces VF-REG-001 at the source, so an
    ///      unapproved asset is rejected before any value moves (VF-ARC-004).
    ///      Native ETH is registered as address(0).
    function registerAsset(address asset, bytes32 canonicalAssetId)
        external onlyDuringDeployment
    {
        if (canonicalAssetId == bytes32(0)) revert AssetNotInRegistry(asset);
        approvedAsset[asset] = canonicalAssetId;
        emit AssetRegistered(asset, canonicalAssetId);
    }

    /// @notice Close configuration permanently. No reversal exists.
    function finalizeConfiguration() external onlyDuringDeployment {
        configurationFinalized = true;
        emit ConfigurationFinalized();
    }

    // -------------------------------------------------------------------------
    // Lock creation
    // -------------------------------------------------------------------------

    struct CommitParams {
        bytes32 lockId;
        address asset;                  // address(0) = native ETH
        uint256 grossAmount;
        uint64  durationSecs;
        address baseRecipient;
        address releaseDestination;
        uint8   outputToken;
        bytes32 chonxActivationReceipt;
    }

    /// @notice Create a Commitment Vault Lock on Base.
    /// @dev Fee routing, lock storage, allowance increment, and clone funding
    ///      all commit together or revert together.
    function commitVaultLock(CommitParams calldata p)
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

        // VF-ORC-007/012: value derived from the signed price record.
        uint256 verifiedGrossUsd = _verifiedGrossUsd(canonicalAssetId, p.grossAmount);

        bool isHandshake = p.durationSecs == HANDSHAKE_DURATION_SECS;
        if (isHandshake) {
            if (verifiedGrossUsd < HANDSHAKE_USD_MIN || verifiedGrossUsd > HANDSHAKE_USD_MAX) {
                revert HandshakeValueOutOfRange(verifiedGrossUsd);
            }
            if (handshakeUsed[msg.sender] >= HANDSHAKE_ALLOWANCE) {
                revert AllowanceExhausted(msg.sender);
            }
        } else if (verifiedGrossUsd < STANDARD_USD_MIN) {
            revert StandardBelowMinimum(verifiedGrossUsd);
        }

        // VF-COM-011/012/013.
        uint256 bps       = isHandshake ? HANDSHAKE_FEE_BPS : STANDARD_FEE_BPS;
        uint256 feeAmount = (p.grossAmount * bps) / 10000;
        uint256 principal = p.grossAmount - feeAmount;
        if (feeAmount == 0 || principal == 0) revert ZeroFeeOrPrincipal();

        // ---- take custody of the gross amount -------------------------------

        if (p.asset == address(0)) {
            if (msg.value != p.grossAmount) {
                revert EthValueMismatch(p.grossAmount, msg.value);
            }
        } else {
            if (msg.value != 0) revert UnexpectedEthValue();
            uint256 before = _erc20BalanceOf(p.asset, address(this));
            _safeTransferFrom(p.asset, msg.sender, address(this), p.grossAmount);
            uint256 received = _erc20BalanceOf(p.asset, address(this)) - before;
            // Fail closed on fee-on-transfer and rebasing assets rather than
            // silently locking a different amount than the record states.
            if (received != p.grossAmount) {
                revert GrossNotReceived(p.grossAmount, received);
            }
        }

        // ---- state ----------------------------------------------------------

        uint64 creationTime = uint64(block.timestamp);
        uint64 maturityTime = creationTime + p.durationSecs;

        lockContract = _cloneLock();
        CommitmentLock(payable(lockContract)).initialize(
            p.lockId,
            p.asset,
            principal,
            creationTime,
            maturityTime,
            p.releaseDestination
        );

        uint32 allowanceCount = handshakeUsed[msg.sender];
        if (isHandshake) {
            allowanceCount += 1;
            handshakeUsed[msg.sender] = allowanceCount;
        }

        _locks[p.lockId] = LockRecord({
            lockId:                 p.lockId,
            sourceAccount:          msg.sender,
            asset:                  p.asset,
            canonicalAssetId:       canonicalAssetId,
            lockContract:           lockContract,
            grossAmount:            p.grossAmount,
            feeAmount:              feeAmount,
            principalAmount:        principal,
            verifiedGrossUsd:       verifiedGrossUsd,
            durationSecs:           p.durationSecs,
            creationTime:           creationTime,
            maturityTime:           maturityTime,
            baseRecipient:          p.baseRecipient,
            releaseDestination:     p.releaseDestination,
            outputToken:            p.outputToken,
            chonxActivationReceipt: p.chonxActivationReceipt,
            handshakeAllowanceCount: allowanceCount,
            exists:                 true
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

        // The clone confirms it holds exactly the recorded principal, or the
        // entire creation reverts.
        CommitmentLock(payable(lockContract)).confirmFunded();

        _emitCommitEvent(p.lockId);
    }

    /// @dev Emitted from storage rather than from locals: nineteen live stack
    ///      variables exceed the EVM's reachable depth.
    function _emitCommitEvent(bytes32 lockId) private {
        LockRecord storage r = _locks[lockId];
        emit CommitVaultLock(
            r.lockId,
            r.sourceAccount,
            r.canonicalAssetId,
            ENVIRONMENT_ID,
            r.asset,
            r.lockContract,
            r.grossAmount,
            r.feeAmount,
            r.principalAmount,
            r.verifiedGrossUsd,
            r.durationSecs,
            r.creationTime,
            r.maturityTime,
            r.baseRecipient,
            r.releaseDestination,
            r.outputToken,
            r.chonxActivationReceipt,
            r.handshakeAllowanceCount,
            devFundDestination
        );
    }

    // -------------------------------------------------------------------------
    // Views — the same-chain verifier reads lock state through these.
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

    /// @dev VF-ORC-007/012. Mirrors VinculumFinalisVerifier._verifiedGrossUsdMicro:
    ///      published prices are 6-decimal micro-USD, protocol bounds are
    ///      18-decimal, and the precision divisor comes from the registry.
    function _verifiedGrossUsd(bytes32 canonicalAssetId, uint256 grossAmount)
        internal view returns (uint256)
    {
        (uint256 priceUsdMicro, uint64 fetchTimestamp, , bool available) =
            verifier.priceRecords(canonicalAssetId);
        if (!available) revert NoUsableValuation(canonicalAssetId);
        if (block.timestamp - uint256(fetchTimestamp) > MAX_PRICE_RECORD_AGE) {
            revert PriceRecordStale();
        }

        bytes32 key = keccak256(abi.encodePacked(ENVIRONMENT_ID, canonicalAssetId));
        (bytes32 registered, , uint8 decimals, , ) = verifier.assetPrecisionTable(key);
        if (registered == bytes32(0)) revert NoUsableValuation(canonicalAssetId);

        return (grossAmount * priceUsdMicro * 1e12) / (10 ** uint256(decimals));
    }

    /// @dev The 16 permitted durations, Revision 6 Section 5.1. Written as
    ///      explicit day counts times 86,400; year multipliers are deliberately
    ///      not used.
    function _isPermittedDuration(uint64 d) internal pure returns (bool) {
        return
            d == 3600            ||   // 1 hour — Trust-Building Handshake
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

    /// @dev EIP-1167 minimal proxy. Written inline because the codebase carries
    ///      no external dependencies.
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
