// =============================================================================
// Test fixtures for the non-Base CommitmentVaultLock protocol-token refusal
// (VF-TOK-007 / VF-REG-008). Not protocol assets. Not mainnet addresses. Do
// not deploy these as part of a Vinculum production package.
// =============================================================================

// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

/// @notice Minimal ERC-20 balance and allowance logic shared by the fixtures.
abstract contract FixtureBalances {
    uint8 public constant decimals = 18;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    function mint(address to, uint256 amount) external {
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _move(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= amount, "fixture: allowance");
        allowance[from][msg.sender] = allowed - amount;
        _move(from, to, amount);
        return true;
    }

    function _move(address from, address to, uint256 amount) internal {
        require(balanceOf[from] >= amount, "fixture: balance");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
    }
}

/// @notice Stands in for an Axelar ITS mint-and-burn copy on a non-Base chain:
///         same name and symbol as the Base token, any address.
contract ProtocolCopyFixtureERC20 is FixtureBalances {
    string public name;
    string public symbol;

    constructor(string memory name_, string memory symbol_) {
        name = name_;
        symbol = symbol_;
    }
}

/// @notice Old-style token whose name() and symbol() return bytes32.
contract Bytes32MetadataFixtureERC20 is FixtureBalances {
    bytes32 public name;
    bytes32 public symbol;

    constructor(bytes32 name_, bytes32 symbol_) {
        name = name_;
        symbol = symbol_;
    }
}

/// @notice A normal ERC-20 whose name() and symbol() revert. Must still lock.
contract RevertingMetadataFixtureERC20 is FixtureBalances {
    function name() external pure returns (string memory) {
        revert("fixture: no name");
    }

    function symbol() external pure returns (string memory) {
        revert("fixture: no symbol");
    }
}
