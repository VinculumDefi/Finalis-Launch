// Rig 2 (Base live set): read-only probe of the live finalized Base contracts
// on a LOCAL Base fork, then two demonstrations against the live bytecode and
// live state, still only on the local fork: RAC replay (FINDING-HH-001) and
// caller-chosen valuationTimestamp (FINDING-HH-002). Nothing is broadcast.
// The live poster is impersonated only on the local fork to post a price run
// from the real Chainlink ETH/USD feed if the live price is not usable.
// Run: testing-rigs/run.sh base fork-integration/base_live_probe.test.cjs
const path = require("path");
const fs = require("fs");
const C = require("../lib/common.cjs");
const { expect } = require(path.join(C.BC, "node_modules/chai"));
const { ethers, network, art, DATA, SCALE, DAY7, ETH_ID, short, fmt, reason } = C;
const LIVE = require("/workspace/t301u/addrs.cjs");

describe("Rig 2: live finalized Base set (read-only probe on a local fork)", function () {
  this.timeout(1800000);
  let V, lock, vclm, chonx, stake;
  const out = {};

  before(async () => {
    expect((await ethers.provider.getNetwork()).chainId).to.equal(8453n);
    V = new ethers.Contract(LIVE.base.VinculumFinalisVerifier, art.VinculumFinalisVerifier.abi, ethers.provider);
    lock = new ethers.Contract(LIVE.base.BaseCommitmentVaultLock, art.BaseCommitmentVaultLock.abi, ethers.provider);
    vclm = new ethers.Contract(LIVE.base.TokenVCLM, art.TokenVCLM.abi, ethers.provider);
    chonx = new ethers.Contract(LIVE.base.TokenCHONX, art.TokenCHONX.abi, ethers.provider);
    stake = new ethers.Contract(LIVE.base.VinculumFinalisStake, art.VinculumFinalisStake.abi, ethers.provider);
  });

  it("live set: finalized, 15 readers as recorded, Solana absent, minters fixed, poster and prices", async () => {
    out.forkBlock = (await ethers.provider.getBlock("latest")).number;
    out.finalized = await V.configurationFinalized();
    out.launch = String(await V.protocolLaunchTimestamp());
    out.readers = {};
    for (const [env, [, a]] of Object.entries(LIVE.readers)) {
      const got = await V.chainVerifiers(env);
      out.readers[env] = got.toLowerCase() === a.toLowerCase() ? "matches record" : "MISMATCH " + short(got);
    }
    out.solana = (await V.chainVerifiers("Solana")) === ethers.ZeroAddress ? "not registered" : "REGISTERED";
    out.vclmMinters = [short(await vclm.minterVerifier()), short(await vclm.minterStake())];
    out.chonxMinters = [short(await chonx.minterVerifier()), short(await chonx.minterStake())];
    out.vclmMintersOk = (await vclm.minterVerifier()) === LIVE.base.VinculumFinalisVerifier && (await vclm.minterStake()) === LIVE.base.VinculumFinalisStake;
    out.chonxMintersOk = (await chonx.minterVerifier()) === LIVE.base.VinculumFinalisVerifier && (await chonx.minterStake()) === ethers.ZeroAddress;
    out.poster = short(await V.scheduledPricePoster());
    out.posterIsCeremonyData = (await V.scheduledPricePoster()) === ethers.getAddress(DATA.scheduledPricePoster);
    out.lastRun = String(await V.lastScheduledRunId());
    const key = ethers.solidityPackedKeccak256(["string", "bytes32"], ["Base", ETH_ID]);
    const sp = await V.scheduledPrices(key);
    out.baseEthPrice = { usable: sp.usable, usd: fmt(sp.priceUsd18) };
    out.vclmSupply = fmt(await vclm.totalSupply());
    out.chonxSupply = fmt(await chonx.totalSupply());
    out.lifetimeVclm = fmt(await V.lifetimeVclmIssued());
    out.chonxActivated = await V.chonxActivated();
    out.currentEpoch = String(await V.currentEpoch());
    out.lockFeeBps = String(await lock.STANDARD_FEE_BPS());
    out.lockDevFund = short(await lock.devFund());
    out.lockDevFundOk = (await lock.devFund()) === ethers.getAddress(DATA.devFund);
    out.vclmCode = (await ethers.provider.getCode(LIVE.base.TokenVCLM)).length > 2;
    console.log("      " + JSON.stringify(out));
    expect(out.finalized).to.equal(true);
    expect(Object.values(out.readers).every((x) => x === "matches record")).to.equal(true);
    expect(out.solana).to.equal("not registered");
    expect(out.vclmMintersOk).to.equal(true);
    expect(out.lockFeeBps).to.equal("500");
    await expect(V.connect(ethers.provider).registerChainVerifier.staticCall("Solana", LIVE.base.TokenVCLM)).to.be.reverted;
  });

  it("live bytecode on the fork: RAC replay and valuationTimestamp=0 (FINDING-HH-001, FINDING-HH-002)", async () => {
    const [, user, recipient, dest, stranger] = await ethers.getSigners();
    const key = ethers.solidityPackedKeccak256(["string", "bytes32"], ["Base", ETH_ID]);
    let sp = await V.scheduledPrices(key);
    if (!sp.usable) {
      const f = new ethers.Contract("0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70", ["function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)", "function description() view returns (string)"], ethers.provider);
      expect(await f.description()).to.equal("ETH / USD");
      const [, ans] = await f.latestRoundData();
      const poster = await V.scheduledPricePoster();
      await network.provider.send("hardhat_impersonateAccount", [poster]);
      await network.provider.send("hardhat_setBalance", [poster, "0x56BC75E2D63100000"]);
      const ps = await ethers.getSigner(poster);
      await (await V.connect(ps).applyScheduledPriceRun((await V.lastScheduledRunId()) + 1n, [{ environmentId: "Base", canonicalAssetId: ETH_ID, priceUsd18: BigInt(ans) * 10n ** 10n, success: true }])).wait();
      sp = await V.scheduledPrices(key);
      out.pricePostedOnFork = fmt(sp.priceUsd18);
    }
    const mk = async () => {
      const id = ethers.id("live:" + Math.random());
      await (await lock.connect(user).createNativeLock(id, recipient.address, 0, ETH_ID, ethers.ZeroHash, dest.address, DAY7, sp.priceUsd18, { value: SCALE })).wait();
      const rec = await lock.lockRecord(id);
      return C.basePkg(id, rec, ETH_ID, 2, 18);
    };
    const a = await mk();
    const ep = await V.currentEpoch();
    const b0 = await V.epochRewardBasis(ep);
    await (await V.connect(user).recordFeeAndRac(a)).wait();
    await (await V.connect(user).verifyAndMint(a, 0)).wait();
    const b1 = await V.epochRewardBasis(ep);
    for (let i = 0; i < 5; i++) await (await V.connect(stranger).recordFeeAndRac({ ...a, racIdentity: ethers.id("live-replay-" + i) })).wait();
    const b2 = await V.epochRewardBasis(ep);
    out.liveRacReplay = `epoch ${ep}: honest RAC +${fmt(b1 - b0)} USD; 5 replays by a stranger +${fmt(b2 - b1)} USD (= ${fmt((b2 - b1) * 10n)} future reward VCLM)`;
    expect(b2 - b1).to.equal((b1 - b0) * 5n);
    const h = await mk(), f = await mk();
    const v0 = await vclm.balanceOf(recipient.address);
    await (await V.connect(user).recordFeeAndRac(h)).wait(); await (await V.connect(user).verifyAndMint(h, 0)).wait();
    const v1 = await vclm.balanceOf(recipient.address);
    const f0 = { ...f, valuationTimestamp: 0 };
    await (await V.connect(user).recordFeeAndRac(f0)).wait(); await (await V.connect(user).verifyAndMint(f0, 0)).wait();
    const v2 = await vclm.balanceOf(recipient.address);
    out.liveValuationTs = `1 ETH 7d: honest ${fmt(v1 - v0)} VCLM, valuationTimestamp=0 ${fmt(v2 - v1)} VCLM`;
    console.log("      " + out.liveRacReplay + "\n      " + out.liveValuationTs);
    expect(v2 - v1).to.be.gte(v1 - v0);
  });

  after(() => fs.writeFileSync(path.join(__dirname, "base_live_probe_results.json"), JSON.stringify(out, null, 1)));
});
