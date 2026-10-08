// SPDX-License-Identifier: PROTOCOL-RESTRICTED
pragma solidity 0.8.19;

import "../CommitmentDurations.sol";

contract TestLock {
    address public immutable devFund;
    struct LockRecord {
        bool exists; bool released; address creator; address releaseDestination; address asset;
        address baseRecipient; uint8 outputToken; uint256 gross; uint256 fee; uint256 principal;
        uint256 duration; uint256 multiplierBps; uint256 createdAt; uint256 maturity;
        bytes32 assetIdentity; bytes32 valuationReference; bytes bindingPayload;
    }
    mapping(bytes32 => LockRecord) private _locks;
    constructor(address devFund_) { require(devFund_ != address(0), "dev fund"); devFund = devFund_; }
    function lockRecord(bytes32 lockId) external view returns (LockRecord memory) { return _locks[lockId]; }
    function createNativeLock(
        bytes32 lockId, address baseRecipient, uint8 outputToken, bytes32 assetIdentity,
        bytes32 valuationReference, address releaseDestination, uint256 duration, uint256 verifiedGrossUsd
    ) external payable returns (uint256 fee, uint256 principal) {
        require(msg.value > 0, "zero gross");
        uint256 multiplierBps = CommitmentDurations.multiplierBps(duration);
        require(multiplierBps > 0, "duration");
        uint256 bps = duration == 3600 ? 250 : 500;
        fee = msg.value * bps / 10000;
        principal = msg.value - fee;
        require(fee > 0 && principal > 0, "zero");
        bytes memory bindingPayload = abi.encodePacked(lockId, baseRecipient, outputToken, assetIdentity, valuationReference);
        require(bindingPayload.length == 117, "binding");
        _locks[lockId] = LockRecord(true, false, msg.sender, releaseDestination, address(0), baseRecipient, outputToken, msg.value, fee, principal, duration, multiplierBps, block.timestamp, block.timestamp + duration, assetIdentity, valuationReference, bindingPayload);
        (bool ok, ) = devFund.call{value: fee}("");
        require(ok, "fee");
    }
}
