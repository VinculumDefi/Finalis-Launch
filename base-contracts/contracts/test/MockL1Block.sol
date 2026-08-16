// =============================================================================
// MockL1Block — TEST FIXTURE ONLY. Never deployed.
//
// The OP Stack L1Block predeploy at 0x4200...0015 is written by Base's
// derivation pipeline and does not exist on a local development chain. This
// mock stands in for it so the recording and lookup logic can be exercised.
//
// Integration with the real predeploy requires deployment evidence from Base.
// This mock does not and cannot provide that.
// =============================================================================

pragma solidity 0.8.19;

contract MockL1Block {
    uint64  private _number;
    bytes32 private _hash;
    uint64  private _timestamp;

    function set(uint64 n, bytes32 h, uint64 t) external {
        _number = n;
        _hash = h;
        _timestamp = t;
    }

    function number() external view returns (uint64) { return _number; }
    function hash() external view returns (bytes32) { return _hash; }
    function timestamp() external view returns (uint64) { return _timestamp; }
}
