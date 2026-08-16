// =============================================================================
// Sha256dHeaderChainTestable — TEST FIXTURE ONLY. Never deployed.
//
// Real Bitcoin mainnet blocks cannot contain a test transaction, so tests that
// exercise transaction parsing and inclusion need a way to register a block
// with a chosen merkle root.
//
// This bypasses proof-of-work validation and therefore MUST NOT be deployed.
// Proof-of-work verification is covered separately in 14_header_chain.test.cjs
// against real mainnet headers, where the work cannot be fabricated.
// =============================================================================

pragma solidity 0.8.19;

import "../light-clients/Sha256dHeaderChain.sol";

contract Sha256dHeaderChainTestable is Sha256dHeaderChain {

    constructor(
        bytes32 _checkpointHash,
        uint256 _checkpointHeight,
        uint32  _bits,
        uint32  _timestamp
    ) Sha256dHeaderChain(_checkpointHash, _checkpointHeight, _bits, _timestamp) {}

    /// @notice Register a header directly, without proof-of-work validation.
    /// @dev TEST ONLY. Present so tests can build blocks committing to
    ///      transactions they construct.
    function testRegisterHeader(
        bytes32 blockHash,
        uint256 height,
        bytes32 merkleRoot,
        uint32  timestamp
    ) external {
        headers[blockHash] = Header({
            parent: bestTip,
            height: height,
            accumulatedWork: bestWork + 1,
            merkleRoot: merkleRoot,
            timestamp: timestamp,
            bits: 0x1d00ffff,
            exists: true
        });

        bestTip = blockHash;
        bestWork = bestWork + 1;
        bestHeight = height;
    }
}
