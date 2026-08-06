// =============================================================================
// VinculumFinalisToken — VCLM and CHONX ERC-20 Token Contract (BASE-TOK)
//
// PROVENANCE: Built directly from Revision 6 authoritative documents:
//   - 227826f11_Vinculum_Finalis_Master_Specification_Revision_6_2026-07-28.docx (Revision 6)
//   - Vinculum_Finalis_Protocol_Constants.json (Revision 6, 2026-07-28)
//   - Vinculum_Finalis_Architecture_Design.md (Sections A.9, A.11-A.13, P)
//
// Requirements implemented:
//   VF-TOK-001: 18 decimal places for VCLM, CHONX (and SYNTH)
//   VF-TOK-007: Protocol tokens are prohibited as Commitment Vault Lock inputs
//   VF-TOK-009: VCLM hard cap = 10,000,000,000 (10 billion)
//   VF-TOK-010: CHONX hard cap = 100,000,000,000 (100 billion)
//   VF-SUP-015: Hard-cap rejection in full — mint reverts if cap exceeded
//
// This contract is deployed TWICE — once as VCLM, once as CHONX.
// The minter role is set to the VinculumFinalisVerifier address after deployment.
//
// SPDX-License-Identifier: PROTOCOL-RESTRICTED
// Solidity 0.8.19+
// =============================================================================

pragma solidity 0.8.19;

contract VinculumFinalisToken {

    // ===== Token metadata =====
    string public name;
    string public symbol;
    uint8 public constant decimals = 18; // VF-TOK-001

    // ===== Protocol parameters (immutable per deployment) =====
    uint256 public immutable hardCap; // VF-TOK-009/010

    // ===== Access control =====
    address public authority;        // deployer / governance
    address public minter;            // VinculumFinalisVerifier

    // ===== ERC-20 state =====
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    // ===== Events =====
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event Minted(address indexed to, uint256 amount);
    event Burned(address indexed from, uint256 amount);
    event MinterChanged(address oldMinter, address newMinter);

    // ===== Modifiers =====
    modifier onlyMinter() {
        require(msg.sender == minter, "VFT: not minter");
        _;
    }

    modifier onlyAuthority() {
        require(msg.sender == authority, "VFT: not authority");
        _;
    }

    // ===== Constructor =====
    /// @param _name Token name ("Vinculum Finalis VCLM" or "Vinculum Finalis CHONX")
    /// @param _symbol Token symbol ("VCLM" or "CHONX")
    /// @param _hardCap Maximum total supply in smallest units (VF-TOK-009/010)
    constructor(
        string memory _name,
        string memory _symbol,
        uint256 _hardCap
    ) {
        name = _name;
        symbol = _symbol;
        hardCap = _hardCap;
        authority = msg.sender;
    }

    // ===== Configuration =====

    /// @notice Sets the minter (verifier) address. Only callable by authority.
    function setMinter(address _minter) external onlyAuthority {
        emit MinterChanged(minter, _minter);
        minter = _minter;
    }

    // ===== Minting (called by verifier after successful verifyAndMint) =====

    /// @notice Mints tokens to a recipient. Only callable by the minter (verifier).
    /// @dev VF-SUP-015: Reverts if minting would exceed the hard cap.
    function mint(address to, uint256 amount) external onlyMinter {
        require(to != address(0), "VFT: mint to zero address");
        require(totalSupply + amount <= hardCap, "VF-SUP-015: hard cap exceeded");
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Minted(to, amount);
        emit Transfer(address(0), to, amount);
    }

    // ===== Burning (for SYNTH forge and user-initiated burn) =====

    /// @notice Burns tokens from the caller's own balance.
    function burn(uint256 amount) external {
        require(balanceOf[msg.sender] >= amount, "VFT: insufficient balance");
        _burn(msg.sender, amount);
    }

    /// @notice Burns tokens from an account that has approved the caller.
    /// @dev Used by the SYNTH forge contract to burn VCLM + CHONX.
    function burnFrom(address account, uint256 amount) external {
        uint256 currentAllowance = allowance[account][msg.sender];
        require(currentAllowance >= amount, "VFT: insufficient allowance");
        require(balanceOf[account] >= amount, "VFT: insufficient balance");
        // Reduce allowance first (CEI pattern)
        allowance[account][msg.sender] = currentAllowance - amount;
        _burn(account, amount);
    }

    function _burn(address account, uint256 amount) internal {
        balanceOf[account] -= amount;
        totalSupply -= amount;
        emit Burned(account, amount);
        emit Transfer(account, address(0), amount);
    }

    // ===== Standard ERC-20 =====

    function transfer(address to, uint256 amount) external returns (bool) {
        require(to != address(0), "VFT: transfer to zero address");
        require(balanceOf[msg.sender] >= amount, "VFT: insufficient balance");
        _transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(to != address(0), "VFT: transfer to zero address");
        uint256 currentAllowance = allowance[from][msg.sender];
        require(currentAllowance >= amount, "VFT: insufficient allowance");
        require(balanceOf[from] >= amount, "VFT: insufficient balance");
        allowance[from][msg.sender] = currentAllowance - amount;
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
    }
}