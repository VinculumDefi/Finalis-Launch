// SPDX-License-Identifier: PROTOCOL-RESTRICTED
pragma solidity 0.8.19;

import "../chain-verifiers/SimpleEthereumLockReader.sol";
import "../chain-verifiers/OptimismLockReader.sol";
import "./ArbitrumLockReaderLocalHeaders.sol";
import "./EvmLockReaderLocalHeaders.sol";

interface ITestLockDevFund {
    function devFund() external view returns (address);
}

/// @dev TEST ONLY. Never deploy.
/// Since fix 2026-10-23 (AG-01) every production EVM receipt reader refuses
/// finality, because nothing on-chain anchors a non-Base header to the
/// chain's settled history. These harnesses stand in for that missing anchor
/// so the rest of the proof path (receipt, storage, fact extraction, the lock
/// asset) and the Verifier's issuance math can still be tested end to end on a
/// local chain. verifyFinality returns the result of the production
/// headerClaimMatches check. lockDevFund reads the bound local lock's Dev Fund
/// (VF-FEE-009, AG-09), which a production reader cannot prove today.
/// The production refusal itself is tested against the unmodified readers.

contract SimpleEthereumLockReaderTestAnchor is SimpleEthereumLockReader {
    constructor(address lock_) SimpleEthereumLockReader(lock_) {}

    function verifyFinality(bytes calldata p, bytes calldata f) external view override returns (bool, bytes32, uint256) {
        (bytes32 h, uint256 n) = this.headerClaimMatches(p, f);
        return (true, h, n);
    }

    function lockDevFund(string calldata, bytes calldata) external view returns (address) {
        return ITestLockDevFund(lock).devFund();
    }
}

contract OptimismLockReaderTestAnchor is OptimismLockReader {
    constructor(address lock_) OptimismLockReader(lock_) {}

    function verifyFinality(bytes calldata p, bytes calldata f) external view override returns (bool, bytes32, uint256) {
        (bytes32 h, uint256 n) = this.headerClaimMatches(p, f);
        return (true, h, n);
    }

    function lockDevFund(string calldata, bytes calldata) external view returns (address) {
        return ITestLockDevFund(lock).devFund();
    }
}

contract ArbitrumLockReaderTestAnchor is ArbitrumLockReaderLocalHeaders {
    constructor(address lock_) ArbitrumLockReaderLocalHeaders(lock_) {}

    function verifyFinality(bytes calldata p, bytes calldata f) external view override returns (bool, bytes32, uint256) {
        (bytes32 h, uint256 n) = this.headerClaimMatches(p, f);
        return (true, h, n);
    }

    function lockDevFund(string calldata, bytes calldata) external view returns (address) {
        return ITestLockDevFund(lock).devFund();
    }
}

contract PolygonLockReaderTestAnchor is PolygonLockReaderLocalHeaders {
    constructor(address lock_) PolygonLockReaderLocalHeaders(lock_) {}

    function verifyFinality(bytes calldata p, bytes calldata f) external view override returns (bool, bytes32, uint256) {
        (bytes32 h, uint256 n) = this.headerClaimMatches(p, f);
        return (true, h, n);
    }

    function lockDevFund(string calldata, bytes calldata) external view returns (address) {
        return ITestLockDevFund(lock).devFund();
    }
}

contract BnbSmartChainLockReaderTestAnchor is BnbSmartChainLockReaderLocalHeaders {
    constructor(address lock_) BnbSmartChainLockReaderLocalHeaders(lock_) {}

    function verifyFinality(bytes calldata p, bytes calldata f) external view override returns (bool, bytes32, uint256) {
        (bytes32 h, uint256 n) = this.headerClaimMatches(p, f);
        return (true, h, n);
    }

    function lockDevFund(string calldata, bytes calldata) external view returns (address) {
        return ITestLockDevFund(lock).devFund();
    }
}

contract AvalancheLockReaderTestAnchor is AvalancheLockReaderLocalHeaders {
    constructor(address lock_) AvalancheLockReaderLocalHeaders(lock_) {}

    function verifyFinality(bytes calldata p, bytes calldata f) external view override returns (bool, bytes32, uint256) {
        (bytes32 h, uint256 n) = this.headerClaimMatches(p, f);
        return (true, h, n);
    }

    function lockDevFund(string calldata, bytes calldata) external view returns (address) {
        return ITestLockDevFund(lock).devFund();
    }
}
