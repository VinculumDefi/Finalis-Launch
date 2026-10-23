// =============================================================================
// Test fixtures for the 2026-10-23 batch fix (AG-08, MUT tests). Not protocol
// assets. Never deploy these as part of a Vinculum production package.
// =============================================================================

// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

/// @notice Share-based rebasing ERC-20 (AMPL / stETH style). Balances are
/// shares * pooled / totalShares, rounded down, so transfers can round by a wei.
contract TestRebasingERC20 {
    string public constant name = "Test Rebasing";
    string public constant symbol = "TRB";
    uint8 public constant decimals = 18;

    uint256 public totalShares;
    uint256 public pooled;
    mapping(address => uint256) public sharesOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function totalSupply() external view returns (uint256) {
        return pooled;
    }

    function balanceOf(address a) public view returns (uint256) {
        return totalShares == 0 ? 0 : (sharesOf[a] * pooled) / totalShares;
    }

    function mint(address to, uint256 amount) external {
        uint256 s = totalShares == 0 ? amount : (amount * totalShares) / pooled;
        totalShares += s;
        pooled += amount;
        sharesOf[to] += s;
    }

    /// @notice Sets the pooled amount: a negative or positive rebase.
    function rebase(uint256 newPooled) external {
        pooled = newPooled;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _move(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= amount, "rebasing: allowance");
        allowance[from][msg.sender] = allowed - amount;
        _move(from, to, amount);
        return true;
    }

    function _move(address from, address to, uint256 amount) internal {
        uint256 s = (amount * totalShares) / pooled;
        require(sharesOf[from] >= s, "rebasing: balance");
        sharesOf[from] -= s;
        sharesOf[to] += s;
    }
}

/// @notice ERC-20 that burns feeBps of every transfer and transferFrom.
contract TestTransferFeeERC20 {
    string public constant name = "Test Transfer Fee";
    string public constant symbol = "TTF";
    uint8 public constant decimals = 18;
    uint256 public immutable feeBps;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    constructor(uint256 feeBps_) {
        feeBps = feeBps_;
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
        _move(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= amount, "fee token: allowance");
        allowance[from][msg.sender] = allowed - amount;
        _move(from, to, amount);
        return true;
    }

    function _move(address from, address to, uint256 amount) internal {
        require(balanceOf[from] >= amount, "fee token: balance");
        uint256 cut = (amount * feeBps) / 10000;
        balanceOf[from] -= amount;
        balanceOf[to] += amount - cut;
        totalSupply -= cut;
    }
}

/// @notice A contract caller. Calls made through it have msg.sender = this
/// contract and tx.origin = the EOA, which tells the two apart in tests.
contract TestForwarder {
    function forward(address target, bytes calldata data) external payable returns (bytes memory) {
        (bool ok, bytes memory ret) = target.call{value: msg.value}(data);
        if (!ok) {
            assembly {
                revert(add(ret, 32), mload(ret))
            }
        }
        return ret;
    }

    receive() external payable {}
}

/// @notice ERC-20 whose transfer and transferFrom return no value (USDT style).
contract TestNoReturnERC20 {
    string public constant name = "Test No Return";
    string public constant symbol = "TNR";
    uint8 public constant decimals = 18;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        totalSupply += amount;
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external {
        allowance[msg.sender][spender] = amount;
    }

    function transfer(address to, uint256 amount) external {
        require(balanceOf[msg.sender] >= amount, "no-return: balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
    }

    function transferFrom(address from, address to, uint256 amount) external {
        require(allowance[from][msg.sender] >= amount, "no-return: allowance");
        require(balanceOf[from] >= amount, "no-return: balance");
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
    }
}

/// @notice ERC-20 whose transferFrom credits the recipient bonus units more
/// than the stated amount (a positive transfer delta).
contract TestBonusERC20 {
    string public constant name = "Test Bonus";
    string public constant symbol = "TBN";
    uint8 public constant decimals = 18;
    uint256 public immutable bonus;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    constructor(uint256 bonus_) {
        bonus = bonus_;
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
        require(balanceOf[msg.sender] >= amount, "bonus: balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(allowance[from][msg.sender] >= amount, "bonus: allowance");
        require(balanceOf[from] >= amount, "bonus: balance");
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount + bonus;
        totalSupply += bonus;
        return true;
    }
}

/// @notice Stand-in Stake for the VCLM minterStake slot: the Verifier reads
/// cumulativeRewardVclmMinted() for lifetime VCLM, so tests can set lifetime
/// VCLM to an exact value (10M CHONX activation edge, VCLM cap edge).
contract TestStakeRewardCounter {
    uint256 public cumulativeRewardVclmMinted;

    function set(uint256 v) external {
        cumulativeRewardVclmMinted = v;
    }
}

/// @notice Stand-in Verifier for the SYNTH forge: cumulativeChonxIssued is
/// settable (and may go down) so the 100M activation edge and the
/// once-activated-stays-activated rule can be tested exactly.
contract TestChonxCounter {
    uint256 public cumulativeChonxIssued;
    bool public chonxActivated;

    function set(uint256 v) external {
        cumulativeChonxIssued = v;
    }
}

/// @notice Chain reader double WITHOUT lockDevFund: always finalized, echoes
/// the facts like MockAlwaysFinalizedVerifier, but cannot prove which Dev
/// Fund the lock paid (VF-FEE-009 must refuse it).
contract MockReaderNoDevFund {
    function verifyFinality(bytes calldata, bytes calldata) external pure returns (bool, bytes32, uint256) {
        return (true, bytes32(uint256(1)), 1);
    }

    function extractFacts(bytes calldata p)
        external
        pure
        returns (bytes32, uint256, uint256, uint256, uint256, uint256, uint256, address, uint8)
    {
        return abi.decode(p, (bytes32, uint256, uint256, uint256, uint256, uint256, uint256, address, uint8));
    }

    function extractAssetId(bytes calldata p) external pure returns (bytes32) {
        (, , , , , , , , , bytes32 a) =
            abi.decode(p, (bytes32, uint256, uint256, uint256, uint256, uint256, uint256, address, uint8, bytes32));
        return a;
    }
}
