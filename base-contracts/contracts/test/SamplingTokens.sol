// =============================================================================
// Test doubles for the expanded sampling rig (testing-rigs/sampling/). Not
// protocol assets. Never deploy these. The test places their runtime code at
// the real registry token addresses on the in-process Hardhat chain only
// (hardhat_setCode), so every setting starts at zero storage.
// =============================================================================

// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

/// @notice ERC-20 with an optional fee on every transfer and transferFrom
///         (the fee is burned), and an optional USDT-style mode where
///         transfer and transferFrom return no data. Defaults: fee 0, returns bool.
contract SamplingFeeToken {
    uint256 public totalSupply;
    uint256 public feeBps;     // 0 = no transfer fee (PAXG and USDT today)
    bool public noReturn;      // true = USDT-style, no return value
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function setFeeBps(uint256 bps) external { require(bps < 10000, "fee"); feeBps = bps; }
    function setNoReturn(bool v) external { noReturn = v; }
    function mint(address to, uint256 amount) external { totalSupply += amount; balanceOf[to] += amount; }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function _move(address from, address to, uint256 amount) internal {
        require(balanceOf[from] >= amount, "balance");
        uint256 fee = (amount * feeBps) / 10000;
        balanceOf[from] -= amount;
        balanceOf[to] += amount - fee;
        totalSupply -= fee;
    }

    function _ret() internal view {
        if (noReturn) assembly { return(0, 0) }
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _move(msg.sender, to, amount);
        _ret();
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(allowance[from][msg.sender] >= amount, "allowance");
        allowance[from][msg.sender] -= amount;
        _move(from, to, amount);
        _ret();
        return true;
    }
}

/// @notice Share-based rebasing ERC-20 (AMPL and stETH style). balanceOf is
///         shares * index / 1e18; an index of 0 reads as 1e18. A transfer
///         moves floor(amount * 1e18 / index) shares, so it can deliver one
///         unit less than asked, as stETH does.
contract SamplingRebasingToken {
    uint256 internal _index; // 0 = 1e18
    uint256 public totalShares;
    mapping(address => uint256) public sharesOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function index() public view returns (uint256) { return _index == 0 ? 1e18 : _index; }
    function setIndex(uint256 i) external { require(i > 0, "index"); _index = i; }
    function totalSupply() external view returns (uint256) { return (totalShares * index()) / 1e18; }
    function balanceOf(address a) public view returns (uint256) { return (sharesOf[a] * index()) / 1e18; }

    function mint(address to, uint256 amount) external {
        uint256 s = (amount * 1e18) / index();
        totalShares += s;
        sharesOf[to] += s;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function _move(address from, address to, uint256 amount) internal {
        uint256 s = (amount * 1e18) / index();
        require(sharesOf[from] >= s, "balance");
        sharesOf[from] -= s;
        sharesOf[to] += s;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _move(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(allowance[from][msg.sender] >= amount, "allowance");
        allowance[from][msg.sender] -= amount;
        _move(from, to, amount);
        return true;
    }
}
