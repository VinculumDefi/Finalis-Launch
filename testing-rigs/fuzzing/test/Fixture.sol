// SPDX-License-Identifier: MIT
// Rig 3 shared fixture. Deploys the Base stack exactly in ceremony order from
// the production sources (vf/ = base-contracts/contracts): VCLM, CHONX,
// Verifier, Forge (SYNTH), Stake, BaseCommitmentVaultLock, Base reader.
// Registers the Base ETH row (registry row 2 values), a Base USDC test row,
// a price run, the Dev Fund, and finalizes. Test-only. Never deployed.
pragma solidity 0.8.19;

import {Test} from "forge-std/Test.sol";
import {VinculumFinalisToken} from "vf/VinculumFinalisToken.sol";
import {VinculumFinalisVerifier, ProofPackage} from "vf/VinculumFinalisVerifier.sol";
import {VinculumFinalisSynth} from "vf/VinculumFinalisSynth.sol";
import {VinculumFinalisStake} from "vf/VinculumFinalisStake.sol";
import {BaseCommitmentVaultLock} from "vf/BaseCommitmentVaultLock.sol";
import {BaseLockRecordVerifier} from "vf/chain-verifiers/BaseLockRecordVerifier.sol";

contract PlainToken {
    string public name;
    string public symbol;
    uint8 public decimals;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    constructor(string memory n, string memory s, uint8 d) {
        name = n;
        symbol = s;
        decimals = d;
    }

    function mint(address to, uint256 a) external {
        totalSupply += a;
        balanceOf[to] += a;
    }

    function approve(address sp, uint256 a) external returns (bool) {
        allowance[msg.sender][sp] = a;
        return true;
    }

    function transfer(address to, uint256 a) external returns (bool) {
        balanceOf[msg.sender] -= a;
        balanceOf[to] += a;
        return true;
    }

    function transferFrom(address f, address to, uint256 a) external returns (bool) {
        allowance[f][msg.sender] -= a;
        balanceOf[f] -= a;
        balanceOf[to] += a;
        return true;
    }
}

abstract contract Fixture is Test {
    VinculumFinalisToken internal vclm;
    VinculumFinalisToken internal chonx;
    VinculumFinalisVerifier internal verifier;
    VinculumFinalisSynth internal synth;
    VinculumFinalisStake internal stake;
    BaseCommitmentVaultLock internal lock;
    BaseLockRecordVerifier internal baseReader;
    PlainToken internal usdc;

    address internal deployerAddr = address(0xD0);
    address internal devFund = address(0xDF);
    address internal poster = address(0x9057);
    address internal user = address(0xA11CE);
    address internal recipient = address(0xB0B);

    bytes32 internal constant ETH_ID = 0xde7085290190e1f2f7f2f83d26fa72e411f9d765ddd608a77e8a7c388113943b;
    bytes32 internal usdcId;
    uint256 internal constant ETH_PRICE = 2000e18; // $2,000.00
    uint64 internal runId;

    uint256[16] internal DUR = [
        uint256(3600), 604800, 2592000, 5184000, 7776000, 15552000, 31536000, 63072000,
        94608000, 126144000, 157680000, 189216000, 220752000, 252288000, 283824000, 315360000
    ];
    uint256[16] internal MULT = [
        uint256(10000), 10000, 11500, 13000, 15000, 20000, 25000, 38000,
        50000, 57500, 65000, 68000, 71000, 74000, 77000, 80000
    ];

    function _deployStack(bool doFinalize) internal {
        // The Base reader proves finality with blockhash(block.number - 1); a
        // zero hash or height is refused (VF-XCH-034), so start past genesis.
        vm.roll(block.number + 100);
        vm.warp(block.timestamp + 1 days);
        vm.startPrank(deployerAddr);
        vclm = new VinculumFinalisToken("Vinculum Finalis VCLM", "VCLM", 10_000_000_000e18);
        chonx = new VinculumFinalisToken("Vinculum Finalis CHONX", "CHONX", 100_000_000_000e18);
        verifier = new VinculumFinalisVerifier(address(vclm), address(chonx));
        synth = new VinculumFinalisSynth(address(verifier), address(vclm), address(chonx));
        stake = new VinculumFinalisStake(address(vclm), address(chonx), address(synth), address(verifier));
        vclm.initialize(address(verifier), address(stake));
        chonx.initialize(address(verifier), address(0));
        lock = new BaseCommitmentVaultLock("Base", devFund, address(vclm), address(chonx), address(synth));
        baseReader = new BaseLockRecordVerifier(address(lock));
        usdc = new PlainToken("USD Coin", "USDC", 6);
        usdcId = keccak256(abi.encodePacked("Base", "USDC"));
        verifier.registerAssetPrecision("Base", ETH_ID, "ETH", 18, 2, 0);
        verifier.registerAssetPrecision("Base", usdcId, "USDC", 6, 1, 1);
        VinculumFinalisVerifier.TokenAddressInput[] memory t = new VinculumFinalisVerifier.TokenAddressInput[](1);
        t[0] = VinculumFinalisVerifier.TokenAddressInput("Base", address(usdc), usdcId);
        verifier.registerTokenAddressBatch(t);
        verifier.registerChainVerifier("Base", address(baseReader));
        verifier.configureDevFund("Base", devFund);
        verifier.setScheduledPricePoster(poster);
        vm.stopPrank();
        _postPrices(ETH_PRICE, 1e18);
        if (doFinalize) {
            vm.prank(deployerAddr);
            verifier.finalize();
        }
    }

    function _postPrices(uint256 ethPrice, uint256 usdcPrice) internal {
        VinculumFinalisVerifier.ScheduledPriceUpdate[] memory u = new VinculumFinalisVerifier.ScheduledPriceUpdate[](2);
        u[0] = VinculumFinalisVerifier.ScheduledPriceUpdate("Base", ETH_ID, ethPrice, ethPrice != 0);
        u[1] = VinculumFinalisVerifier.ScheduledPriceUpdate("Base", usdcId, usdcPrice, usdcPrice != 0);
        runId++;
        vm.prank(poster);
        verifier.applyScheduledPriceRun(runId, u);
        // AG-06 (fix 2026-10-23): a lock is valued at the price in effect strictly
        // before its creation, so move one second past the run.
        vm.warp(block.timestamp + 1);
        vm.roll(block.number + 1);
    }

    /// Lock-level USD stated to the lock (the lock trusts it; the Verifier
    /// recomputes). Chosen inside the lock band so the lock opens.
    function _lockUsd(uint256 dur) internal pure returns (uint256) {
        return dur == 3600 ? 0.015e18 : 1e18;
    }

    function _openNative(bytes32 id, uint256 gross, uint256 dur, uint8 outTok) internal {
        vm.deal(user, gross);
        vm.prank(user);
        lock.createNativeLock{value: gross}(id, recipient, outTok, ETH_ID, bytes32(0), user, dur, _lockUsd(dur));
    }

    function _pkg(bytes32 id, uint256 gross, uint256 dur, uint8 outTok, bytes32 rac, uint256 valuationTs)
        internal
        view
        returns (ProofPackage memory p)
    {
        uint256 fee = (gross * 500) / 10000;
        p.sourceEnvironmentId = "Base";
        p.commitmentVaultLockId = id;
        p.handshakeAllowanceCount = 3;
        p.canonicalAssetId = ETH_ID;
        p.assetPrecision = 18;
        p.assetCustodyClass = 2;
        p.grossAmountSmallestUnits = gross;
        p.actualFeeAmountSmallestUnits = fee;
        p.principalAmountSmallestUnits = gross - fee;
        p.feeAssetId = ETH_ID;
        p.devFundDestination = "Base";
        p.valuationTimestamp = valuationTs;
        p.maturityTimestamp = block.timestamp + dur;
        p.durationSecs = dur;
        p.selectedOutputToken = outTok;
        p.baseRecipient = recipient;
        p.releaseDestination = "user";
        p.racIdentity = rac;
        p.lockEventProof = abi.encode(id, uint256(0), uint256(0), uint256(0), uint256(0), uint256(0), uint256(0));
    }

    /// Independent reference for the Verifier issuance formula (VF-COM-018/019).
    function _refIssuance(uint256 usd, uint8 outTok, uint8 cls, uint256 durMult, uint256 daysSince)
        internal
        pure
        returns (uint256)
    {
        uint256 rate = outTok == 0 ? 10e18 : 100e18;
        uint256 floorRate = outTok == 0 ? 1e18 : 10e18;
        uint256 periods = daysSince / 30;
        for (uint256 i = 0; i < periods; i++) {
            rate = (rate * 983330000000000000) / 1e18;
            if (rate <= floorRate) {
                rate = floorRate;
                break;
            }
        }
        uint256 s = (usd * rate) / 1e18;
        uint256 a = cls == 1 ? 15000 : cls == 2 ? 13000 : 10000;
        s = (s * ((1e18 * a) / 10000)) / 1e18;
        s = (s * ((1e18 * durMult) / 10000)) / 1e18;
        return s;
    }
}
