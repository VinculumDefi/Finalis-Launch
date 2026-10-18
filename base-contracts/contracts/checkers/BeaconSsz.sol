// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

/// @notice SSZ helpers shared by the beacon light client and EthereumLockReader.
library BeaconSsz {
    struct BeaconHeader {
        uint64 slot;
        uint64 proposerIndex;
        bytes32 parentRoot;
        bytes32 stateRoot;
        bytes32 bodyRoot;
    }

    /// @dev hash_tree_root(BeaconBlockHeader): five chunks padded to eight.
    function root(BeaconHeader memory h) internal pure returns (bytes32) {
        bytes32 h01 = sha256(abi.encodePacked(u64(h.slot), u64(h.proposerIndex)));
        bytes32 h23 = sha256(abi.encodePacked(h.parentRoot, h.stateRoot));
        bytes32 h45 = sha256(abi.encodePacked(h.bodyRoot, bytes32(0)));
        bytes32 h67 = sha256(abi.encodePacked(bytes32(0), bytes32(0)));
        return sha256(abi.encodePacked(sha256(abi.encodePacked(h01, h23)), sha256(abi.encodePacked(h45, h67))));
    }

    /// @dev Root reached from `leaf` along `branch` at generalized index `gindex`.
    /// Reverts unless the branch length matches the gindex depth exactly.
    function branchRoot(bytes32 leaf, bytes32[] memory branch, uint256 gindex) internal pure returns (bytes32 h) {
        h = leaf;
        for (uint256 i = 0; i < branch.length; i++) {
            h = gindex & 1 == 1 ? sha256(abi.encodePacked(branch[i], h)) : sha256(abi.encodePacked(h, branch[i]));
            gindex >>= 1;
        }
        require(gindex == 1, "SSZ: branch depth");
    }

    function u64(uint64 x) internal pure returns (bytes32) {
        uint256 v = uint256(x);
        uint256 le;
        for (uint256 i = 0; i < 8; i++) {
            le = (le << 8) | (v & 0xff);
            v >>= 8;
        }
        return bytes32(le << 192);
    }
}
