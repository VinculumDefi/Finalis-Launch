// =============================================================================
// CommitmentVaultLock — source-chain Commitment Vault for the seven EVM
// environments (Base, Ethereum, Polygon, Optimism, Arbitrum, BNB Smart Chain,
// Avalanche). One contract. Each deployment is one environment.
//
// Authority: Vinculum Finalis Master Specification Revision 8 (3 October 2026).
//
//   VF-COM-004 / VF-COM-009 / VF-COM-011 / VF-COM-012 / VF-COM-013
//     One-hour Trust-Building Handshake fee is 250 bps. A lock whose duration
//     is from 7 days through 3,650 days charges 500 bps. Fee units are
//     floor(gross * bps / 10_000). Principal is gross minus that fee. A zero
//     fee or a zero principal is rejected before the lock exists.
//   VF-FEE-001 / VF-FEE-006 / VF-FEE-010
//     The fee is paid, in the same asset, to the Dev Fund address supplied at
//     deployment. No production address is hardcoded.
//   VF-PRI-001 .. VF-PRI-006
//     Principal is released only once, only to the release destination bound
//     at creation, only at or after maturity. No early, admin, or oracle path.
//   VF-XCH-024
//     On Base the check is this chain's own lock record. requireLockRecord
//     reverts if that record was never created. No foreign proof is required.
//   VF-XCH-025 / VF-XCH-026 / VF-XCH-034
//     Release does not wait for a foreign Base checker. This contract does
//     not treat an empty block hash or height 0 as finalized, and it does not
//     accept any other header as finalized either.
//   VF-XCH-032
//     The binding payload stored with the lock is exactly 117 bytes:
//     lock id 32, Base recipient 20, output token 1, asset identity 32,
//     valuation reference 32.
//
// Maturity is block.timestamp + duration. The duration gate is an exact
// match against the sixteen COMMITMENT_DURATIONS rows. No range and no
// interpolated multiplier. The one-hour row is the Handshake ($0.95 to
// $1.05, fee 2.50%). The other fifteen charge 5.00% and require at least
// $10.00. This contract keeps handshakeUses per source account, so
// VF-COM-006 derives an allowance of 3. It does not store the number 3.
// =============================================================================

// SPDX-License-Identifier: PROTOCOL-RESTRICTED
pragma solidity 0.8.19;

import "./CommitmentDurations.sol";
import "./HandshakeCapability.sol";

contract CommitmentVaultLock {
    uint256 public constant HANDSHAKE_FEE_BPS = 250;
    uint256 public constant STANDARD_FEE_BPS = 500;
    uint256 public constant BPS_DENOMINATOR = 10000;
    uint256 public constant HANDSHAKE_DURATION = 1 hours;
    // VF-COM-003: $0.95 to $1.05 inclusive, 18-decimal USD.
    uint256 public constant HANDSHAKE_USD_MIN = 0.95e18;
    uint256 public constant HANDSHAKE_USD_MAX = 1.05e18;
    // VF-COM-009: at least $10.00 for every non-handshake duration.
    uint256 public constant STANDARD_USD_MIN = 10e18;
    // This contract stores handshakeUses per source account. The allowance
    // is HandshakeCapability.allowance(countsPerIdentity), not a literal 3.
    bool public constant countsPerIdentity = true;

    /// @notice Environment name supplied at deployment. Not a chain id guess.
    string public environmentId;

    /// @notice Dev Fund for this deployment. A deployment input, not a constant.
    address public immutable devFund;

    struct LockRecord {
        bool exists;
        bool released;
        address creator;
        address releaseDestination;
        address asset; // address(0) means the native asset
        address baseRecipient;
        uint8 outputToken;
        uint256 gross;
        uint256 fee;
        uint256 principal;
        uint256 duration;
        uint256 multiplierBps;
        uint256 createdAt;
        uint256 maturity;
        bytes32 assetIdentity;
        bytes32 valuationReference;
        bytes bindingPayload;
    }

    mapping(bytes32 => LockRecord) private _locks;
    mapping(address => uint8) public handshakeUses;

    uint256 private _entered;

    event LockCreated(
        bytes32 indexed lockId,
        address indexed creator,
        address indexed releaseDestination,
        address asset,
        uint256 gross,
        uint256 fee,
        uint256 principal,
        uint256 maturity
    );
    event FeeRouted(bytes32 indexed lockId, address indexed devFund, address asset, uint256 fee);
    event PrincipalReleased(bytes32 indexed lockId, address indexed releaseDestination, address asset, uint256 principal);

    modifier nonReentrant() {
        require(_entered == 0, "CVL: reentrant");
        _entered = 1;
        _;
        _entered = 0;
    }

    /// @param environmentId_ Canonical environment name for this deployment.
    /// @param devFund_ Fee destination. Must be supplied. Zero is rejected.
    ///        Absence of a production address is resolved by the deployer of
    ///        this input; this contract does not invent one.
    constructor(string memory environmentId_, address devFund_) {
        require(bytes(environmentId_).length != 0, "CVL: environment");
        require(devFund_ != address(0), "CVL: dev fund");
        environmentId = environmentId_;
        devFund = devFund_;
    }

    function lockRecord(bytes32 lockId) external view returns (LockRecord memory) {
        return _locks[lockId];
    }

    /// @notice Base same-chain check (VF-XCH-024). The record is this chain's
    ///         own storage. An id that was never created is absent.
    function requireLockRecord(bytes32 lockId) external view {
        if (!_locks[lockId].exists) {
            revert("VF-XCH-024: Base lock record absent");
        }
    }

    /// @notice Foreign header finality is not decided here. An empty hash or
    ///         height 0 is not finalized. No other input is finalized either,
    ///         because release waits only on the maturity timestamp.
    function foreignHeaderFinalized(bytes32 blockHash, uint256 height) external pure returns (bool) {
        return blockHash != bytes32(0) && height != 0 && false;
    }

    function handshakeAllowance() public pure returns (uint256) {
        return HandshakeCapability.allowance(countsPerIdentity);
    }

    function createNativeLock(
        bytes32 lockId,
        address baseRecipient,
        uint8 outputToken,
        bytes32 assetIdentity,
        bytes32 valuationReference,
        address releaseDestination,
        uint256 duration,
        uint256 verifiedGrossUsd
    ) external payable nonReentrant returns (uint256 fee, uint256 principal) {
        require(msg.value > 0, "CVL: zero gross");
        uint256 multiplierBps;
        (fee, principal, multiplierBps) = _quote(msg.value, duration, verifiedGrossUsd);
        require(fee > 0 && principal > 0, "CVL: zero fee or principal");
        _open(
            lockId,
            baseRecipient,
            outputToken,
            assetIdentity,
            valuationReference,
            releaseDestination,
            duration,
            address(0),
            msg.value,
            fee,
            principal,
            multiplierBps
        );
        (bool ok, ) = devFund.call{value: fee}("");
        require(ok, "CVL: fee");
        emit FeeRouted(lockId, devFund, address(0), fee);
    }

    /// @notice Pulls `amount` of an ERC-20 and accounts the balance delta, not
    ///         the requested amount, as the gross. Fee and principal are taken
    ///         from what this contract actually received.
    function createErc20Lock(
        bytes32 lockId,
        address baseRecipient,
        uint8 outputToken,
        bytes32 assetIdentity,
        bytes32 valuationReference,
        address releaseDestination,
        uint256 duration,
        address token,
        uint256 amount,
        uint256 verifiedGrossUsd
    ) external nonReentrant returns (uint256 fee, uint256 principal) {
        require(token != address(0), "CVL: token");
        require(amount > 0, "CVL: zero gross");
        // Reject a stated amount that cannot clear the fee and principal
        // floors before tokens move. The received delta is checked again.
        (uint256 previewFee, uint256 previewPrincipal, ) = _quote(amount, duration, verifiedGrossUsd);
        require(previewFee > 0 && previewPrincipal > 0, "CVL: zero fee or principal");

        uint256 beforeBal = _balanceOf(token, address(this));
        require(
            _erc20(token, abi.encodeWithSelector(IERC20Minimal.transferFrom.selector, msg.sender, address(this), amount)),
            "CVL: transferFrom"
        );
        uint256 received = _balanceOf(token, address(this)) - beforeBal;
        uint256 multiplierBps;
        (fee, principal, multiplierBps) = _quote(received, duration, verifiedGrossUsd);
        require(fee > 0 && principal > 0, "CVL: zero fee or principal");

        _open(
            lockId,
            baseRecipient,
            outputToken,
            assetIdentity,
            valuationReference,
            releaseDestination,
            duration,
            token,
            received,
            fee,
            principal,
            multiplierBps
        );
        require(
            _erc20(token, abi.encodeWithSelector(IERC20Minimal.transfer.selector, devFund, fee)),
            "CVL: fee"
        );
        emit FeeRouted(lockId, devFund, token, fee);
    }

    /// @notice Releases principal once, to the bound destination, at or after
    ///         maturity. The caller must be that destination. No oracle.
    function release(bytes32 lockId) external nonReentrant {
        LockRecord storage record = _locks[lockId];
        require(record.exists, "CVL: unknown lock");
        require(block.timestamp >= record.maturity, "CVL: immature");
        require(!record.released, "CVL: already released");
        require(msg.sender == record.releaseDestination, "CVL: destination");

        record.released = true;
        uint256 principal = record.principal;
        address asset = record.asset;

        if (asset == address(0)) {
            (bool ok, ) = msg.sender.call{value: principal}("");
            require(ok, "CVL: release");
        } else {
            require(
                _erc20(asset, abi.encodeWithSelector(IERC20Minimal.transfer.selector, msg.sender, principal)),
                "CVL: release"
            );
        }
        emit PrincipalReleased(lockId, msg.sender, asset, principal);
    }

    function _open(
        bytes32 lockId,
        address baseRecipient,
        uint8 outputToken,
        bytes32 assetIdentity,
        bytes32 valuationReference,
        address releaseDestination,
        uint256 duration,
        address asset,
        uint256 gross,
        uint256 fee,
        uint256 principal,
        uint256 multiplierBps
    ) internal {
        require(baseRecipient != address(0), "CVL: recipient");
        require(releaseDestination != address(0), "CVL: destination");
        require(!_locks[lockId].exists, "CVL: lock exists");

        if (duration == HANDSHAKE_DURATION) {
            require(handshakeUses[msg.sender] < handshakeAllowance(), "CVL: handshake allowance");
            handshakeUses[msg.sender] += 1;
        }

        bytes memory payload = abi.encodePacked(
            lockId,
            baseRecipient,
            outputToken,
            assetIdentity,
            valuationReference
        );
        require(payload.length == 117, "CVL: payload");

        uint256 createdAt = block.timestamp;
        _locks[lockId] = LockRecord({
            exists: true,
            released: false,
            creator: msg.sender,
            releaseDestination: releaseDestination,
            asset: asset,
            baseRecipient: baseRecipient,
            outputToken: outputToken,
            gross: gross,
            fee: fee,
            principal: principal,
            duration: duration,
            multiplierBps: multiplierBps,
            createdAt: createdAt,
            maturity: createdAt + duration,
            assetIdentity: assetIdentity,
            valuationReference: valuationReference,
            bindingPayload: payload
        });

        emit LockCreated(
            lockId,
            msg.sender,
            releaseDestination,
            asset,
            gross,
            fee,
            principal,
            createdAt + duration
        );
    }

    function _quote(uint256 gross, uint256 duration, uint256 verifiedGrossUsd)
        internal
        pure
        returns (uint256 fee, uint256 principal, uint256 multiplierBps)
    {
        multiplierBps = CommitmentDurations.multiplierBps(duration);
        if (multiplierBps == 0) revert("CVL: duration");
        uint256 bps;
        if (duration == HANDSHAKE_DURATION) {
            if (verifiedGrossUsd < HANDSHAKE_USD_MIN || verifiedGrossUsd > HANDSHAKE_USD_MAX) {
                revert("CVL: handshake usd");
            }
            bps = HANDSHAKE_FEE_BPS;
        } else {
            if (verifiedGrossUsd < STANDARD_USD_MIN) revert("CVL: standard usd");
            bps = STANDARD_FEE_BPS;
        }
        fee = (gross * bps) / BPS_DENOMINATOR;
        principal = gross - fee;
    }

    function _balanceOf(address token, address account) internal view returns (uint256) {
        (bool ok, bytes memory ret) = token.staticcall(
            abi.encodeWithSelector(IERC20Minimal.balanceOf.selector, account)
        );
        require(ok && ret.length >= 32, "CVL: balanceOf");
        return abi.decode(ret, (uint256));
    }

    /// @dev Accepts a bare success (no return data) or a single true bool.
    function _erc20(address token, bytes memory data) internal returns (bool) {
        (bool ok, bytes memory ret) = token.call(data);
        if (!ok) return false;
        if (ret.length == 0) return true;
        if (ret.length >= 32) return abi.decode(ret, (bool));
        return false;
    }
}

interface IERC20Minimal {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}
