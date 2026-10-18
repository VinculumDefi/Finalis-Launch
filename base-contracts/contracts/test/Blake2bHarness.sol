// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;
import "../checkers/Blake2b.sol";
/// @dev TEST ONLY.
contract Blake2bHarness {
    function h(bytes16 person, bytes calldata data) external view returns (bytes32) {
        return Blake2b.personal256(person, data);
    }
}
