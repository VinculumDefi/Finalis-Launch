// SPDX-License-Identifier: MIT
// Rig-only fee-on-transfer ERC-20 (1% to a sink on every transfer and
// transferFrom). Used on a LOCAL fork only, because the real PAXG on the fork
// block charges no transfer fee. Not part of the protocol.
pragma solidity 0.8.19;
contract RigFeeOnTransfer {
    string public name = "Rig FOT"; string public symbol = "RFOT"; uint8 public decimals = 18;
    uint256 public totalSupply; uint256 public constant FEE_BPS = 100; address public constant SINK = address(0xFEE);
    mapping(address => uint256) public balanceOf; mapping(address => mapping(address => uint256)) public allowance;
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    function mint(address to, uint256 v) external { totalSupply += v; balanceOf[to] += v; emit Transfer(address(0), to, v); }
    function approve(address s, uint256 v) external returns (bool) { allowance[msg.sender][s] = v; emit Approval(msg.sender, s, v); return true; }
    function transfer(address to, uint256 v) external returns (bool) { _move(msg.sender, to, v); return true; }
    function transferFrom(address f, address to, uint256 v) external returns (bool) { allowance[f][msg.sender] -= v; _move(f, to, v); return true; }
    function _move(address f, address to, uint256 v) internal {
        uint256 fee = v * FEE_BPS / 10000; balanceOf[f] -= v; balanceOf[to] += v - fee; balanceOf[SINK] += fee;
        emit Transfer(f, to, v - fee); emit Transfer(f, SINK, fee);
    }
}
