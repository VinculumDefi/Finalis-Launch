// =============================================================================
// CommitmentLock — isolated principal holder for exactly one Commitment Vault Lock
//
// One instance exists per lock. It holds that lock's principal and nothing else.
// A defect in one instance's accounting cannot reach another lock's funds,
// because there are no other funds here (VF-IMM-006 blast-radius isolation).
//
// RELEASE INDEPENDENCE (VF-PRI-002..006, VF-SEC-006):
//   After initialization this contract depends on nothing external. It does not
//   call the factory, the verifier, a price feed, a relayer, or an administrator.
//   Everything release() needs is in its own storage. Principal is releasable at
//   maturity even if Base issuance fails permanently.
//
// Deployed as an EIP-1167 minimal proxy. The implementation instance itself is
// permanently disabled by initializing it with a sentinel at construction.
//
// SPDX-License-Identifier: PROTOCOL-RESTRICTED
// Solidity 0.8.19+
// =============================================================================

pragma solidity 0.8.19;

contract CommitmentLock {

    error AlreadyInitialized();
    error NotFactory();
    error NotMature(uint64 maturity, uint64 nowTime);
    error AlreadyReleased();
    error ZeroAddress();
    error ZeroPrincipal();
    error TransferFailed();
    error PrincipalNotReceived(uint256 expected, uint256 actual);

    /// @notice The factory that created this lock. Recorded for provenance only;
    ///         release() never calls it.
    address public factory;
    /// @notice address(0) denotes native ETH.
    address public asset;
    uint256 public principalAmount;
    uint64  public maturityTime;
    uint64  public creationTime;
    address public releaseDestination;
    bytes32 public lockId;
    bool    public released;
    bool    private _initialized;

    event PrincipalReleased(
        bytes32 indexed lockId,
        address indexed releasedTo,
        address asset,
        uint256 principalAmount
    );

    /// @dev Disables the implementation instance. Only clones are usable.
    constructor() {
        _initialized = true;
    }

    receive() external payable {}

    /// @notice Bind this lock's immutable facts. Called once by the factory in
    ///         the same transaction that deploys the clone.
    function initialize(
        bytes32 _lockId,
        address _asset,
        uint256 _principalAmount,
        uint64  _creationTime,
        uint64  _maturityTime,
        address _releaseDestination
    ) external {
        if (_initialized) revert AlreadyInitialized();
        if (_releaseDestination == address(0)) revert ZeroAddress();
        if (_principalAmount == 0) revert ZeroPrincipal();

        _initialized       = true;
        factory            = msg.sender;
        lockId             = _lockId;
        asset              = _asset;
        principalAmount    = _principalAmount;
        creationTime       = _creationTime;
        maturityTime       = _maturityTime;
        releaseDestination = _releaseDestination;
    }

    /// @notice Confirms the principal actually arrived. Called by the factory
    ///         immediately after funding, in the same transaction.
    /// @dev Fail-closed against fee-on-transfer and rebasing assets: if the
    ///      exact principal is not present, the whole creation reverts.
    function confirmFunded() external view {
        if (msg.sender != factory) revert NotFactory();
        uint256 bal = asset == address(0)
            ? address(this).balance
            : _erc20BalanceOf(asset, address(this));
        if (bal != principalAmount) revert PrincipalNotReceived(principalAmount, bal);
    }

    /// @notice Release matured principal to the destination bound at creation.
    /// @dev Permissionless (VF-PRI-002). The caller cannot influence the
    ///      destination or the amount (VF-PRI-003). Exactly once.
    function release() external {
        if (released) revert AlreadyReleased();
        if (block.timestamp < maturityTime) {
            revert NotMature(maturityTime, uint64(block.timestamp));
        }

        // Effects before interactions.
        released = true;

        address dest   = releaseDestination;
        uint256 amount = principalAmount;
        address tok    = asset;

        if (tok == address(0)) {
            (bool ok, ) = dest.call{value: amount}("");
            if (!ok) revert TransferFailed();
        } else {
            _safeTransfer(tok, dest, amount);
        }

        emit PrincipalReleased(lockId, dest, tok, amount);
    }

    /// @notice Whether this lock has matured.
    function isMature() external view returns (bool) {
        return block.timestamp >= maturityTime;
    }

    // -------------------------------------------------------------------------
    // Minimal ERC-20 helpers. The codebase carries no external dependencies, so
    // these replace SafeERC20. Both tolerate non-standard tokens that return no
    // boolean, and reject tokens that return false.
    // -------------------------------------------------------------------------

    function _safeTransfer(address token, address to, uint256 value) private {
        (bool ok, bytes memory data) =
            token.call(abi.encodeWithSelector(0xa9059cbb, to, value)); // transfer(address,uint256)
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
    }

    function _erc20BalanceOf(address token, address who) private view returns (uint256) {
        (bool ok, bytes memory data) =
            token.staticcall(abi.encodeWithSelector(0x70a08231, who)); // balanceOf(address)
        if (!ok || data.length < 32) revert TransferFailed();
        return abi.decode(data, (uint256));
    }
}
