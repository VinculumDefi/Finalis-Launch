// =============================================================================
// MptHarness — TEST FIXTURE ONLY. Never deployed.
//
// Exposes MerklePatriciaProof's internal functions so they can be exercised
// directly, and builds single-leaf and branch tries on-chain so proofs are
// verified against roots the contract itself computed from RLP — not against
// values transcribed by hand.
// =============================================================================

pragma solidity 0.8.19;

import "../libraries/MerklePatriciaProof.sol";

contract MptHarness {

    function verify(
        bytes32 root,
        bytes memory key,
        bytes[] memory proof
    ) external pure returns (bytes memory) {
        return MerklePatriciaProof.verify(root, key, proof);
    }

    function stripReceiptType(bytes memory receipt) external pure returns (bytes memory) {
        return MerklePatriciaProof.stripReceiptType(receipt);
    }

    function decodeReceipt(bytes memory receipt)
        external pure returns (uint256 status, bytes memory logsRlp)
    {
        return MerklePatriciaProof.decodeReceipt(receipt);
    }

    /// @notice keccak256 of arbitrary bytes, so tests can compute node hashes
    ///         the same way the library does.
    function hash(bytes memory data) external pure returns (bytes32) {
        return keccak256(data);
    }
}
