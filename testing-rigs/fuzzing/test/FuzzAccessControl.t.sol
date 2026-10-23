// SPDX-License-Identifier: MIT
// Rig 3: access control fuzz. A random caller against every restricted
// function on Token, Verifier, Stake and the Base lock. Before finalize the
// only authority is the deployer; after finalize no one (deployer included)
// can call a configuration function.
pragma solidity 0.8.19;

import {Fixture} from "./Fixture.sol";
import {VinculumFinalisVerifier, ProofPackage} from "vf/VinculumFinalisVerifier.sol";
import {VinculumFinalisToken} from "vf/VinculumFinalisToken.sol";

contract FuzzAccessControl is Fixture {
    function setUp() public {
        vm.warp(1_800_000_000);
        _deployStack(false); // configuration still open
    }

    function _cfgCalls() internal view returns (bytes[] memory c) {
        VinculumFinalisVerifier.AssetPrecisionInput[] memory a = new VinculumFinalisVerifier.AssetPrecisionInput[](1);
        a[0] = VinculumFinalisVerifier.AssetPrecisionInput("Base", bytes32(uint256(7)), "X", 18, 3, 0);
        VinculumFinalisVerifier.TokenAddressInput[] memory t = new VinculumFinalisVerifier.TokenAddressInput[](1);
        t[0] = VinculumFinalisVerifier.TokenAddressInput("Base", address(0x7777), ETH_ID);
        c = new bytes[](8);
        c[0] = abi.encodeCall(VinculumFinalisVerifier.registerAssetPrecision, ("Base", bytes32(uint256(9)), "Y", 18, 3, 0));
        c[1] = abi.encodeCall(VinculumFinalisVerifier.registerAssetPrecisionBatch, (a));
        c[2] = abi.encodeCall(VinculumFinalisVerifier.registerAssetRowAlias, ("Optimism", ETH_ID, "Base"));
        c[3] = abi.encodeCall(VinculumFinalisVerifier.registerTokenAddressBatch, (t));
        c[4] = abi.encodeCall(VinculumFinalisVerifier.setScheduledPricePoster, (address(0x5555)));
        c[5] = abi.encodeCall(VinculumFinalisVerifier.registerChainVerifier, ("Optimism", address(0x6666)));
        c[6] = abi.encodeCall(VinculumFinalisVerifier.configureDevFund, ("Optimism", address(0x6667)));
        c[7] = abi.encodeCall(VinculumFinalisVerifier.finalize, ());
    }

    function testFuzz_verifierConfigOnlyDeployer(address caller, uint8 which) public {
        vm.assume(caller != deployerAddr);
        bytes[] memory c = _cfgCalls();
        vm.prank(caller);
        (bool ok, bytes memory ret) = address(verifier).call(c[which % c.length]);
        assertFalse(ok, "non-deployer configured the Verifier");
        assertEq(keccak256(ret), keccak256(abi.encodeWithSignature("Error(string)", "VF: not deployer")));
    }

    function testFuzz_verifierConfigClosedAfterFinalize(address caller, uint8 which) public {
        vm.prank(deployerAddr);
        verifier.finalize();
        assertEq(verifier.deployer(), address(0));
        bytes[] memory c = _cfgCalls();
        vm.prank(caller);
        (bool ok, bytes memory ret) = address(verifier).call(c[which % c.length]);
        assertFalse(ok, "configuration changed after finalize");
        assertEq(keccak256(ret), keccak256(abi.encodeWithSignature("Error(string)", "VF-DEP-003: configuration finalized")));
        vm.prank(deployerAddr);
        (ok,) = address(verifier).call(c[which % c.length]);
        assertFalse(ok, "deployer configured after finalize");
    }

    function testFuzz_priceRunOnlyPoster(address caller, uint64 rid, uint256 price) public {
        vm.assume(caller != poster);
        VinculumFinalisVerifier.ScheduledPriceUpdate[] memory u = new VinculumFinalisVerifier.ScheduledPriceUpdate[](1);
        u[0] = VinculumFinalisVerifier.ScheduledPriceUpdate("Base", ETH_ID, price, true);
        vm.prank(caller);
        vm.expectRevert(bytes("VF-ORC-007: not price poster"));
        verifier.applyScheduledPriceRun(rid, u);
    }

    function testFuzz_priceRunMustAdvance(uint64 rid) public {
        rid = uint64(bound(rid, 0, runId));
        VinculumFinalisVerifier.ScheduledPriceUpdate[] memory u = new VinculumFinalisVerifier.ScheduledPriceUpdate[](0);
        vm.prank(poster);
        vm.expectRevert(bytes("VF-ORC-001: run id must advance"));
        verifier.applyScheduledPriceRun(rid, u);
    }

    function testFuzz_mintersOnly(address caller, uint256 amount) public {
        vm.assume(caller != address(verifier) && caller != address(stake) && caller != address(0));
        amount = bound(amount, 1, 1e30);
        vm.startPrank(caller);
        vm.expectRevert();
        vclm.mint(caller, amount);
        vm.expectRevert();
        chonx.mint(caller, amount);
        vm.stopPrank();
        assertEq(vclm.totalSupply() + chonx.totalSupply(), 0);
    }

    function testFuzz_chonxHasNoStakeMinter(uint256 amount) public {
        amount = bound(amount, 1, 1e30);
        vm.prank(address(stake));
        vm.expectRevert();
        chonx.mint(address(stake), amount);
    }

    function testFuzz_tokenInitializeOneShot(address caller, address a, address b) public {
        vm.prank(caller);
        vm.expectRevert();
        vclm.initialize(a, b);
        VinculumFinalisToken t = new VinculumFinalisToken("T", "T", 1e30);
        vm.assume(caller != address(this));
        vm.prank(caller);
        vm.expectRevert(bytes("VFT: not deployer"));
        t.initialize(address(0x1), address(0x2));
    }

    function testFuzz_burnFromNeedsAllowance(address spender, uint256 amount, uint256 allowance_) public {
        vm.assume(spender != address(0) && spender != user);
        amount = bound(amount, 1, 1e24);
        allowance_ = bound(allowance_, 0, amount - 1);
        VinculumFinalisToken t = new VinculumFinalisToken("T", "T", 1e30);
        t.initialize(address(this), address(0xBEEF));
        t.mint(user, amount);
        vm.prank(user);
        t.approve(spender, allowance_);
        vm.prank(spender);
        vm.expectRevert();
        t.burnFrom(user, amount);
        assertEq(t.balanceOf(user), amount);
    }

    function testFuzz_stakeOwnerOnly(address caller) public {
        vm.prank(deployerAddr);
        verifier.finalize();
        bytes32 id = keccak256("acl-stake");
        _openNative(id, 1 ether, 604800, 0);
        ProofPackage memory p = _pkg(id, 1 ether, 604800, 0, id, block.timestamp);
        verifier.recordFeeAndRac(p);
        verifier.verifyAndMint(p, 0);
        uint256 bal = vclm.balanceOf(recipient);
        vm.startPrank(recipient);
        vclm.approve(address(stake), bal);
        uint256 pid = stake.createPosition(0, bal, 30 days);
        vm.stopPrank();
        vm.assume(caller != recipient);
        vm.warp(block.timestamp + 200 days);
        vm.startPrank(caller);
        vm.expectRevert(bytes("VFS: not owner"));
        stake.withdrawPosition(pid);
        vm.expectRevert(bytes("VFS: not owner"));
        stake.queueExtension(pid, 30 days);
        vm.expectRevert(bytes("VFS: not owner"));
        stake.claimPosition(pid, 1);
        vm.stopPrank();
    }

    function testFuzz_releaseOnlyDestination(address caller) public {
        vm.prank(deployerAddr);
        verifier.finalize();
        vm.assume(caller != user);
        bytes32 id = keccak256("acl-rel");
        _openNative(id, 1 ether, 3600, 0);
        vm.warp(block.timestamp + 365 days);
        vm.prank(caller);
        vm.expectRevert();
        lock.release(id);
    }

    function testFuzz_recordAndMintClosedBeforeFinalize(address caller) public {
        bytes32 id = keccak256("pre");
        _openNative(id, 1 ether, 604800, 0);
        ProofPackage memory p = _pkg(id, 1 ether, 604800, 0, id, block.timestamp);
        vm.startPrank(caller);
        vm.expectRevert(bytes("VF-DEP-001: not finalized"));
        verifier.recordFeeAndRac(p);
        vm.expectRevert(bytes("VF-DEP-001: not finalized"));
        verifier.verifyAndMint(p, 0);
        vm.stopPrank();
    }
}
