// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "../checkers/ExecutionHeader.sol";

/// @dev TEST ONLY. Exposes the internal ExecutionHeader.open so FZ-06 can be
/// checked directly: malformed or truncated RLP must revert with a coded
/// error string, never an index or allocation panic.
contract TestExecutionHeaderHarness {
    function open(bytes memory rlp) external pure returns (bytes32 hash, uint256 number) {
        ExecutionHeader.View memory v = ExecutionHeader.open(rlp);
        return (v.hash, v.number);
    }
}
