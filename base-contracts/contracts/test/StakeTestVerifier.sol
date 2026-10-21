// =============================================================================
// TEST ONLY. Minimal stand-in for the Verifier views that VinculumFinalisStake
// reads, so the Stake reward maths can be compared and scale-tested quickly.
// Never deployed.
// =============================================================================
// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

interface IStakeRewardCounter {
    function cumulativeRewardVclmMinted() external view returns (uint256);
}

contract StakeTestVerifier {
    uint256 public protocolLaunchTimestamp;
    uint256 public cumulativeVclmIssued;
    address public stake;
    mapping(uint256 => uint256) public epochRewardBasis;

    function setLaunch(uint256 t) external { protocolLaunchTimestamp = t; }
    function setStake(address s) external { stake = s; }
    function setBasis(uint256 n, uint256 b) external { epochRewardBasis[n] = b; }
    function setLockIssued(uint256 v) external { cumulativeVclmIssued = v; }

    function lifetimeVclmIssued() external view returns (uint256) {
        uint256 r = stake == address(0) ? 0 : IStakeRewardCounter(stake).cumulativeRewardVclmMinted();
        return cumulativeVclmIssued + r;
    }
}
