// t272u (founder item A): a Stake claim pays 100% of the earned VCLM. The
// claimer receives exactly floor(epoch VCLM x weight / total weight) per
// epoch; the only Transfer in the claim is Stake -> owner for that amount
// (no fee leg, no other recipient); the owner's ETH changes only by the gas
// the owner paid; the Stake mints only the epoch reward at allocation (no
// gas-related mint). Nothing is broadcast.
const { expect } = require("chai");
const { ethers, network } = require("hardhat");

const E = 864000n, D120 = 10368000n, D30 = 2592000n, SCALE = 10n ** 18n;

async function at(t) { await network.provider.send("evm_setNextBlockTimestamp", [Number(t)]); }

describe("t272u Stake claim pays the full entitlement, no deduction of any kind", function () {
  it("two stakers, three epochs: exact floor shares, one Transfer each, ETH changes by gas only", async () => {
    const [, a, b, caller] = await ethers.getSigners();
    const F = await ethers.getContractFactory("TestFixtureERC20");
    const v = await (await ethers.getContractFactory("StakeTestVerifier")).deploy();
    // the real VCLM token (emits Transfer), CHONX and SYNTH as test fixtures
    const vc = await (await ethers.getContractFactory("VinculumFinalisToken")).deploy("Vinculum Finalis VCLM", "VCLM", 10_000_000_000n * SCALE);
    const ch = await F.deploy(0), sy = await F.deploy(0);
    const st = await (await ethers.getContractFactory("VinculumFinalisStake")).deploy(await vc.getAddress(), await ch.getAddress(), await sy.getAddress(), await v.getAddress());
    await (await vc.initialize(await v.getAddress(), await st.getAddress())).wait();
    await (await v.setStake(await st.getAddress())).wait();
    const t0 = BigInt((await ethers.provider.getBlock("latest")).timestamp) + 100n;
    await (await v.setLaunch(t0)).wait();
    await (await ch.mint(a.address, 1000n * SCALE)).wait();
    await (await sy.mint(b.address, 7n * SCALE)).wait();
    await (await ch.connect(a).approve(await st.getAddress(), 2n ** 255n)).wait();
    await (await sy.connect(b).approve(await st.getAddress(), 2n ** 255n)).wait();
    await at(t0 + 5n);
    await (await st.connect(a).createPosition(1, 333n * SCALE, D120)).wait();   // CHONX 2x, 2.10x
    await (await st.connect(b).createPosition(2, 7n * SCALE, D30)).wait();      // SYNTH 4x, 1.00x
    for (const [n, usd] of [[2n, 1234567n], [3n, 999n], [4n, 31n]]) await (await v.setBasis(n, usd * SCALE / 100n)).wait();
    await at(t0 + 6n * E + 1n);
    for (let n = 1n; n <= 5n; n++) await (await st.connect(caller).closeEpoch(n)).wait();
    const supply0 = await vc.totalSupply();
    let minted = 0n;
    for (let n = 1n; n <= 4n; n++) { await (await st.connect(caller).allocateEpoch(n)).wait(); minted += (await st.epochs(n)).mintedVclm; }
    // the Stake mints exactly the epoch rewards and nothing else
    expect((await vc.totalSupply()) - supply0).to.equal(minted);
    expect(await st.cumulativeRewardVclmMinted()).to.equal(minted);
    for (const [who, id] of [[a, 0n], [b, 1n]]) {
      let exact = 0n;
      for (let n = 1n; n <= 4n; n++) { const e = await st.epochs(n); const w = await st.epochWeight(id, n); if (e.mintedVclm > 0n && w > 0n) exact += (e.mintedVclm * w) / e.totalWeight; }
      expect(exact).to.be.gt(0n);
      expect(await st.claimableVclm(id, 4n)).to.equal(exact);
      const vBefore = await vc.balanceOf(who.address), sBefore = await vc.balanceOf(await st.getAddress());
      const ethBefore = await ethers.provider.getBalance(who.address);
      const rc = await (await st.connect(who).claimPosition(id, 4n)).wait();
      const fee = rc.gasUsed * rc.gasPrice;
      expect((await vc.balanceOf(who.address)) - vBefore, "owner receives the full entitlement").to.equal(exact);
      expect(sBefore - (await vc.balanceOf(await st.getAddress())), "Stake pays out exactly that").to.equal(exact);
      expect(ethBefore - (await ethers.provider.getBalance(who.address)), "ETH changes by the owner's own gas only").to.equal(fee);
      const transfers = rc.logs.filter((l) => l.topics[0] === ethers.id("Transfer(address,address,uint256)"));
      expect(transfers.length, "one token transfer, no fee leg").to.equal(1);
      expect(ethers.getAddress("0x" + transfers[0].topics[2].slice(26))).to.equal(who.address);
      expect(BigInt(transfers[0].data)).to.equal(exact);
      const ev = st.interface.parseLog(rc.logs.find((l) => l.address === st.target && l.topics[0] === st.interface.getEvent("VclmClaimed").topicHash));
      expect(ev.args.amount).to.equal(exact);
    }
    // the VCLM left in Stake is only the floor dust (VF-STK-027)
    const left = await vc.balanceOf(await st.getAddress());
    expect(left).to.be.gte(0n);
    expect(left).to.be.lt(10n);
  });
});
