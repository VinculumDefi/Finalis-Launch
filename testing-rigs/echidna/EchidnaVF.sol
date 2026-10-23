// SPDX-License-Identifier: MIT
// Rig 3 (Echidna): stateful invariant campaign on the production Token,
// Verifier, Stake and Synth (SYNTH forge), wired with the Base lock and Base
// reader exactly as in the ceremony order. The harness is deployer, price
// poster, user and recipient. Test-only. Never deployed.
pragma solidity 0.8.19;

import {VinculumFinalisToken} from "vf/VinculumFinalisToken.sol";
import {VinculumFinalisVerifier, ProofPackage} from "vf/VinculumFinalisVerifier.sol";
import {VinculumFinalisSynth} from "vf/VinculumFinalisSynth.sol";
import {VinculumFinalisStake} from "vf/VinculumFinalisStake.sol";
import {BaseCommitmentVaultLock} from "vf/BaseCommitmentVaultLock.sol";
import {BaseLockRecordVerifier} from "vf/chain-verifiers/BaseLockRecordVerifier.sol";

contract EchidnaVF {
    VinculumFinalisToken internal vclm;
    VinculumFinalisToken internal chonx;
    VinculumFinalisVerifier internal verifier;
    VinculumFinalisSynth internal synth;
    VinculumFinalisStake internal stake;
    BaseCommitmentVaultLock internal lock;
    BaseLockRecordVerifier internal reader;

    bytes32 internal constant ETH_ID = 0xde7085290190e1f2f7f2f83d26fa72e411f9d765ddd608a77e8a7c388113943b;
    address internal constant DEV_FUND = address(0xDF);
    uint64 internal runId;

    uint256[16] internal DUR = [
        uint256(3600), 604800, 2592000, 5184000, 7776000, 15552000, 31536000, 63072000,
        94608000, 126144000, 157680000, 189216000, 220752000, 252288000, 283824000, 315360000
    ];

    // ghosts
    bytes32[] internal lockIds;
    mapping(bytes32 => uint256) internal grossOf;
    mapping(bytes32 => uint256) internal durOf;
    mapping(bytes32 => uint8) internal outOf;
    mapping(bytes32 => uint256) internal racCount;
    mapping(bytes32 => uint256) internal mintCount;
    uint256 internal maxRacCount;
    uint256 internal maxMintCount;
    uint256 internal stakedVclm; // live staked VCLM principal by the harness
    uint256[] internal positionIds;
    mapping(uint256 => uint256) internal posAmount;
    mapping(uint256 => bool) internal posOut;

    constructor() payable {
        vclm = new VinculumFinalisToken("Vinculum Finalis VCLM", "VCLM", 10_000_000_000e18);
        chonx = new VinculumFinalisToken("Vinculum Finalis CHONX", "CHONX", 100_000_000_000e18);
        verifier = new VinculumFinalisVerifier(address(vclm), address(chonx));
        synth = new VinculumFinalisSynth(address(verifier), address(vclm), address(chonx));
        stake = new VinculumFinalisStake(address(vclm), address(chonx), address(synth), address(verifier));
        vclm.initialize(address(verifier), address(stake));
        chonx.initialize(address(verifier), address(0));
        lock = new BaseCommitmentVaultLock("Base", DEV_FUND, address(vclm), address(chonx), address(synth));
        reader = new BaseLockRecordVerifier(address(lock));
        verifier.registerAssetPrecision("Base", ETH_ID, "ETH", 18, 2, 0);
        verifier.registerChainVerifier("Base", address(reader));
        verifier.configureDevFund("Base", DEV_FUND);
        verifier.setScheduledPricePoster(address(this));
        _post();
        verifier.finalize();
        vclm.approve(address(stake), type(uint256).max);
        vclm.approve(address(synth), type(uint256).max);
        chonx.approve(address(synth), type(uint256).max);
    }

    receive() external payable {}

    function _post() internal {
        VinculumFinalisVerifier.ScheduledPriceUpdate[] memory u = new VinculumFinalisVerifier.ScheduledPriceUpdate[](1);
        u[0] = VinculumFinalisVerifier.ScheduledPriceUpdate("Base", ETH_ID, 2000e18, true);
        runId++;
        verifier.applyScheduledPriceRun(runId, u);
    }

    function _pkg(bytes32 id, bytes32 rac) internal view returns (ProofPackage memory p) {
        uint256 gross = grossOf[id];
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
        p.valuationTimestamp = block.timestamp;
        p.maturityTimestamp = block.timestamp + durOf[id];
        p.durationSecs = durOf[id];
        p.selectedOutputToken = outOf[id];
        p.baseRecipient = address(this);
        p.releaseDestination = "user";
        p.racIdentity = rac;
        p.lockEventProof = abi.encode(id, uint256(0), uint256(0), uint256(0), uint256(0), uint256(0), uint256(0));
    }

    // ---------------------------------------------------------------- actions

    function repostPrices() public {
        _post();
    }

    function openLock(uint256 gross, uint8 durIdx, bool chonxOut) public {
        if (lockIds.length >= 12) return;
        uint256 dur = DUR[durIdx % 16];
        gross = dur == 3600 ? 5e12 + (gross % 4e12) : 1e15 + (gross % 50 ether);
        if (address(this).balance < gross) return;
        bytes32 id = keccak256(abi.encode("echidna", lockIds.length));
        uint256 usd = dur == 3600 ? 0.015e18 : 1e18;
        uint8 out_ = chonxOut ? 1 : 0;
        try lock.createNativeLock{value: gross}(id, address(this), out_, ETH_ID, bytes32(0), address(this), dur, usd) {
            lockIds.push(id);
            grossOf[id] = gross;
            durOf[id] = dur;
            outOf[id] = out_;
        } catch {}
    }

    function recordRac(uint256 which, uint256 racSeed) public {
        if (lockIds.length == 0) return;
        bytes32 id = lockIds[which % lockIds.length];
        try verifier.recordFeeAndRac(_pkg(id, keccak256(abi.encode(id, racSeed % 4)))) {
            racCount[id]++;
            if (racCount[id] > maxRacCount) maxRacCount = racCount[id];
        } catch {}
    }

    function mint(uint256 which, uint256 racSeed) public {
        if (lockIds.length == 0) return;
        bytes32 id = lockIds[which % lockIds.length];
        try verifier.verifyAndMint(_pkg(id, keccak256(abi.encode(id, racSeed % 4))), 0) {
            mintCount[id]++;
            if (mintCount[id] > maxMintCount) maxMintCount = mintCount[id];
        } catch {}
    }

    function releaseLock(uint256 which) public {
        if (lockIds.length == 0) return;
        try lock.release(lockIds[which % lockIds.length]) {} catch {}
    }

    function stakeVclm(uint256 amount, uint8 d) public {
        uint256 bal = vclm.balanceOf(address(this));
        if (bal == 0) return;
        amount = 1 + (amount % bal);
        uint256 dur = (1 + (d % 4)) * 30 days;
        try stake.createPosition(0, amount, dur) returns (uint256 pid) {
            positionIds.push(pid);
            posAmount[pid] = amount;
            stakedVclm += amount;
        } catch {}
    }

    function withdraw(uint256 which) public {
        if (positionIds.length == 0) return;
        uint256 pid = positionIds[which % positionIds.length];
        try stake.withdrawPosition(pid) {
            if (!posOut[pid]) {
                posOut[pid] = true;
                stakedVclm -= posAmount[pid];
            }
        } catch {}
    }

    function closeAllocateClaim(uint256 which) public {
        uint256 e = stake.getCurrentEpoch();
        if (e > 1) {
            try stake.closeEpoch(e - 1) {} catch {}
            try stake.allocateEpoch(e - 1) {} catch {}
        }
        if (positionIds.length == 0) return;
        try stake.claimPosition(positionIds[which % positionIds.length], e > 1 ? e - 1 : 1) {} catch {}
    }

    function forgeSynth(uint256 count) public {
        try synth.forge(1 + (count % 3)) {} catch {}
    }

    function burnVclm(uint256 amount) public {
        uint256 bal = vclm.balanceOf(address(this));
        if (bal == 0) return;
        try vclm.burn(amount % (bal + 1)) {} catch {}
    }

    // ------------------------------------------------------------- invariants

    /// VF-RAC-001 exact-once per lock. Expected to BREAK (FZ-01).
    function echidna_one_rac_per_lock() public view returns (bool) {
        return maxRacCount <= 1;
    }

    /// VF-XCH-013 replay: one mint per lock.
    function echidna_one_mint_per_lock() public view returns (bool) {
        return maxMintCount <= 1;
    }

    function echidna_vclm_within_cap() public view returns (bool) {
        return vclm.totalSupply() <= vclm.hardCap();
    }

    function echidna_chonx_within_cap() public view returns (bool) {
        return chonx.totalSupply() <= chonx.hardCap();
    }

    function echidna_synth_within_cap() public view returns (bool) {
        return synth.totalSupply() <= synth.HARD_CAP();
    }

    /// SYNTH only exists after the 100M CHONX activation.
    function echidna_no_synth_before_activation() public view returns (bool) {
        return synth.totalSupply() == 0 || verifier.cumulativeChonxIssued() >= 100_000_000e18;
    }

    /// Stake custody: Stake holds at least the live staked principal.
    function echidna_stake_solvent() public view returns (bool) {
        return vclm.balanceOf(address(stake)) >= stakedVclm;
    }

    /// Verifier-side VCLM issuance never exceeds the token's supply history.
    function echidna_lifetime_le_cap() public view returns (bool) {
        return verifier.lifetimeVclmIssued() <= vclm.hardCap();
    }
}
