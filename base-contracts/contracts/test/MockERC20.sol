// =============================================================================
// MockERC20 — TEST FIXTURE ONLY. Never deployed to any network.
//
// Minimal ERC-20 with an optional transfer fee, so the Base vault's
// fee-on-transfer rejection can be exercised. Deliberately not a protocol
// contract: VinculumFinalisToken is mint-controlled and premints nothing.
// =============================================================================

pragma solidity 0.8.19;

contract MockERC20 {
    string public name;
    string public symbol;
    uint8  public decimals;
    uint256 public totalSupply;

    /// @notice Basis points skimmed on every transfer. Zero for a normal token.
    uint256 public transferFeeBps;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(string memory _name, string memory _symbol, uint8 _decimals, uint256 _supply) {
        name = _name;
        symbol = _symbol;
        decimals = _decimals;
        totalSupply = _supply;
        balanceOf[msg.sender] = _supply;
        emit Transfer(address(0), msg.sender, _supply);
    }

    function setTransferFeeBps(uint256 bps) external {
        require(bps < 10000, "bad bps");
        transferFeeBps = bps;
    }

    function approve(address spender, uint256 value) external returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transfer(address to, uint256 value) external returns (bool) {
        _move(msg.sender, to, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        uint256 a = allowance[from][msg.sender];
        require(a >= value, "MockERC20: allowance");
        if (a != type(uint256).max) allowance[from][msg.sender] = a - value;
        _move(from, to, value);
        return true;
    }

    function _move(address from, address to, uint256 value) private {
        require(balanceOf[from] >= value, "MockERC20: balance");
        uint256 fee = (value * transferFeeBps) / 10000;
        uint256 net = value - fee;
        balanceOf[from] -= value;
        balanceOf[to] += net;
        if (fee != 0) {
            balanceOf[address(0xdead)] += fee;
            emit Transfer(from, address(0xdead), fee);
        }
        emit Transfer(from, to, net);
    }
}
