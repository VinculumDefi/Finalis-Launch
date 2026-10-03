// =============================================================================
// Test fixtures for CommitmentVaultLock. Not protocol assets. Not mainnet
// addresses. Do not deploy these as part of a Vinculum production package.
// =============================================================================

// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

/// @notice ERC-20 test double. withholdBps == 0 delivers the full amount.
///         A nonzero withhold applies only to transferFrom, so the vault's
///         inbound balance delta is smaller than the requested amount while
///         a later transfer of the computed fee still delivers that fee in full.
contract TestFixtureERC20 {
    string public constant name = "Test Fixture ERC20";
    string public constant symbol = "TFX";
    uint8 public constant decimals = 18;

    uint256 public totalSupply;
    uint256 public immutable withholdBps;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    constructor(uint256 withholdBps_) {
        require(withholdBps_ < 10000, "fixture: withhold");
        withholdBps = withholdBps_;
    }

    function mint(address to, uint256 amount) external {
        totalSupply += amount;
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _move(msg.sender, to, amount, 0);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= amount, "fixture: allowance");
        if (allowed != type(uint256).max) {
            allowance[from][msg.sender] = allowed - amount;
        }
        _move(from, to, amount, withholdBps);
        return true;
    }

    function _move(address from, address to, uint256 amount, uint256 bps) internal {
        require(balanceOf[from] >= amount, "fixture: balance");
        uint256 withheld = (amount * bps) / 10000;
        balanceOf[from] -= amount;
        balanceOf[to] += amount - withheld;
        totalSupply -= withheld;
    }
}

interface ICommitmentVaultRelease {
    function release(bytes32 lockId) external;
}

/// @notice Bound release destination for tests. Calling release() here makes
///         this contract the vault caller, so principal lands here with no
///         gas deducted from the asserted balance.
contract TestReleaseCaller {
    function release(address vault, bytes32 lockId) external {
        ICommitmentVaultRelease(vault).release(lockId);
    }

    receive() external payable {}
}
