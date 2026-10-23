// Rig 2 (Base): the full stack deployed the way the ceremony page does it
// (runBaseCeremony, ceremony.json, 487 rows) on a LOCAL fork of Base mainnet,
// then real Base tokens through lock -> recordFeeAndRac -> verifyAndMint ->
// release. The Base reader reads the lock record from storage, so the whole
// mint path runs on real token code. Prices come from real Chainlink feeds on
// Base (description() must match, else that token is skipped: fail closed).
// Nothing is broadcast. Balances are funded by local storage writes only.
// Run: testing-rigs/run.sh base fork-integration/base_fork_stack.test.cjs
const path = require("path");
const fs = require("fs");
const C = require("../lib/common.cjs");
const { expect } = require(path.join(C.BC, "node_modules/chai"));
const { ERC20, setBalance } = require("../lib/forkTokens.cjs");
const { ethers, network, DATA, SCALE, DAY7, YEAR10, ETH_ID, short, fmt, reason } = C;

const T = {
  USDC_BASE: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  CBETH: "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22",
  AERO: "0x940181a94A35A4569E4529A3CDfB74e38FD98631",
  cbBTC: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf",
};
// Chainlink USD feeds on Base and the description each must report.
const FEEDS = {
  ETH: ["0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70", "ETH / USD"],
  USDC_BASE: ["0x7e860098F58bBFC8648a4311b374B1D669a2bc6B", "USDC / USD"],
  CBETH: ["0xd7818272B9e248357d13057AAb0B417aF31E817d", "cbETH / USD"],
  AERO: ["0x4EC5970fC728C5f65ba413992CD5fF6FD70fcfF0", "AERO / USD"],
  cbBTC: ["0x07DA0E54543a844a80ABE69c8A12F22B3aA59f9D", "cbBTC / USD"],
};
const FEED_ABI = ["function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)", "function decimals() view returns (uint8)", "function description() view returns (string)"];

describe("Rig 2: Base mainnet fork, full ceremony stack, real Base tokens", function () {
  this.timeout(3600000);
  let S, user, recipient, dest;
  const price = {};
  const results = {};
  const row = (sym) => (sym === "ETH" ? { canonicalAssetId: ETH_ID, custodyClass: 2, decimals: 18 } : C.entry("Base", sym));

  before(async () => {
    expect((await ethers.provider.getNetwork()).chainId).to.equal(8453n);
    expect((await ethers.provider.getCode(T.USDC_BASE)).length).to.be.gt(100);
    S = await C.deployStack();
    [, user, recipient, dest] = S.signers;
    expect(S.logs).to.include("registry 487/487");
    expect(S.logs).to.include("token addresses 475/475");
    expect(S.logs).to.include("Finalized.");
    console.log("      fork block", (await ethers.provider.getBlock("latest")).number, "Verifier", short(await S.verifier.getAddress()), "Base lock", short(await S.lock.getAddress()));
    const rows = [];
    for (const [sym, [feed, desc]] of Object.entries(FEEDS)) {
      try {
        const f = new ethers.Contract(feed, FEED_ABI, ethers.provider);
        const d = await f.description();
        if (d !== desc) { console.log(`      ${sym}: feed reports "${d}", expected "${desc}". Skipped (fail closed).`); continue; }
        const [, ans, , upd] = await f.latestRoundData();
        if (ans <= 0n) continue;
        price[sym] = BigInt(ans) * 10n ** (18n - BigInt(await f.decimals()));
        rows.push({ environmentId: "Base", canonicalAssetId: row(sym).canonicalAssetId, priceUsd18: price[sym] });
        console.log(`      price ${sym} ${fmt(price[sym])} USD (Chainlink ${desc}, ${new Date(Number(upd) * 1000).toISOString()})`);
      } catch (e) { console.log(`      ${sym}: feed read failed (${reason(e)}). Skipped (fail closed).`); }
    }
    await S.postPrices(rows);
  });

  async function lockMintRelease(sym, amount, { duration = DAY7, output = 0, release = true } = {}) {
    const rw = row(sym);
    const lockId = ethers.id(`base-fork:${sym}:${Date.now()}:${Math.random()}`);
    const L = S.lock.connect(user);
    const usd = (amount * price[sym]) / 10n ** BigInt(rw.decimals);
    const out = { sym, amount: String(amount) };
    if (sym === "ETH") {
      await (await L.createNativeLock(lockId, recipient.address, output, ETH_ID, ethers.ZeroHash, dest.address, duration, usd, { value: amount })).wait();
    } else {
      const t = new ethers.Contract(T[sym], ERC20, user);
      await setBalance(T[sym], user.address, amount);
      const u0 = await t.balanceOf(user.address), d0 = await t.balanceOf(DATA.devFund), l0 = await t.balanceOf(await S.lock.getAddress());
      await (await t.approve(await S.lock.getAddress(), amount)).wait();
      await (await L.createErc20Lock(lockId, recipient.address, output, rw.canonicalAssetId, ethers.ZeroHash, dest.address, duration, T[sym], amount, usd)).wait();
      out.userPaid = String(u0 - (await t.balanceOf(user.address)));
      out.devGot = String((await t.balanceOf(DATA.devFund)) - d0);
      out.lockGot = String((await t.balanceOf(await S.lock.getAddress())) - l0);
    }
    const rec = await S.lock.lockRecord(lockId);
    expect(rec.fee).to.equal((rec.gross * 500n) / 10000n);
    out.gross = String(rec.gross); out.fee = String(rec.fee); out.principal = String(rec.principal);
    if (sym !== "ETH") expect(BigInt(out.devGot)).to.equal(rec.fee);
    const p = C.basePkg(lockId, rec, rw.canonicalAssetId, rw.custodyClass, rw.decimals);
    const tok = output === 1 ? S.chonx : S.vclm;
    const v0 = await tok.balanceOf(recipient.address);
    await (await S.verifier.recordFeeAndRac(p)).wait();
    await (await S.verifier.verifyAndMint(p, 0)).wait();
    out.minted = String((await tok.balanceOf(recipient.address)) - v0);
    out.racCredit = String(await S.verifier.racCredits(p.racIdentity));
    if (release) {
      await C.advance(Number(duration) + 1);
      const tk = sym === "ETH" ? null : new ethers.Contract(T[sym], ERC20, ethers.provider);
      const b0 = tk ? await tk.balanceOf(dest.address) : await ethers.provider.getBalance(dest.address);
      const rr = await (await S.lock.connect(dest).release(lockId)).wait();
      const gasPaid = tk ? 0n : rr.gasUsed * rr.gasPrice; // dest pays gas for native release
      const b1 = (tk ? await tk.balanceOf(dest.address) : await ethers.provider.getBalance(dest.address)) + gasPaid;
      out.released = String(b1 - b0);
      expect(b1 - b0).to.equal(rec.principal);
      await expect(S.lock.connect(dest).release(lockId)).to.be.reverted;
    }
    console.log(`      ${sym}: gross ${fmt(rec.gross, rw.decimals)} fee ${fmt(rec.fee, rw.decimals)} minted ${fmt(BigInt(out.minted))} ${output ? "CHONX" : "VCLM"}${release ? ", released " + fmt(BigInt(out.released), rw.decimals) : ""}`);
    results[sym + (output ? "_CHONX" : "")] = out;
    return { lockId, rec, p, out };
  }

  it("native ETH: lock, verify/mint, release (Base reader reads real fork state)", async () => {
    await lockMintRelease("ETH", ethers.parseEther("1"));
  });

  for (const sym of ["USDC_BASE", "CBETH", "AERO", "cbBTC"]) {
    it(`${sym} (real token code): exact 5% fee to the Dev Fund, mint, exact principal back`, async function () {
      if (!price[sym]) this.skip();
      const dec = BigInt(row(sym).decimals);
      const amt = sym === "cbBTC" ? 1n * 10n ** (dec - 2n) : sym === "USDC_BASE" ? 2_000n * 10n ** dec : 500n * 10n ** dec;
      await lockMintRelease(sym, amt);
    });
  }

  it("$0.95 rule on real USDC_BASE: a run below 0.95 makes new valuations fail closed; >= 0.95 accepted; earlier bound valuation unaffected", async function () {
    if (!price.USDC_BASE) this.skip();
    const rw = row("USDC_BASE");
    const t = new ethers.Contract(T.USDC_BASE, ERC20, user);
    const mk = async () => {
      const id = ethers.id("usdc95:" + Math.random());
      await setBalance(T.USDC_BASE, user.address, 1_000n * 10n ** 6n);
      await (await t.approve(await S.lock.getAddress(), 1_000n * 10n ** 6n)).wait();
      await (await S.lock.connect(user).createErc20Lock(id, recipient.address, 0, rw.canonicalAssetId, ethers.ZeroHash, dest.address, DAY7, T.USDC_BASE, 1_000n * 10n ** 6n, 1_000n * SCALE)).wait();
      return C.basePkg(id, await S.lock.lockRecord(id), rw.canonicalAssetId, rw.custodyClass, rw.decimals);
    };
    const early = await mk();
    await (await S.verifier.recordFeeAndRac(early)).wait(); // bound at the real price
    // Simulated depeg run (test scenario, not a market price).
    await S.postPrices([{ environmentId: "Base", canonicalAssetId: rw.canonicalAssetId, priceUsd18: 94n * 10n ** 16n }]);
    const late = await mk();
    await expect(S.verifier.recordFeeAndRac(late)).to.be.revertedWith("VF-ORC-005: USDC/USDT scheduled price below $0.95");
    await (await S.verifier.verifyAndMint(early, 0)).wait(); // already bound: mints
    await S.postPrices([{ environmentId: "Base", canonicalAssetId: rw.canonicalAssetId, priceUsd18: 95n * 10n ** 16n }]);
    await (await S.verifier.recordFeeAndRac(late)).wait();
    await (await S.verifier.verifyAndMint(late, 0)).wait();
    await S.postPrices([{ environmentId: "Base", canonicalAssetId: rw.canonicalAssetId, priceUsd18: price.USDC_BASE }]);
    results.usdc095 = "below 0.95 refused (VF-ORC-005); at 0.95 accepted; valuation bound before the dip still minted";
  });

  it("CHONX opens at 10M lifetime VCLM; SYNTH needs 100M lifetime CHONX; forge burns 1,000 VCLM + 10,000 CHONX", async function () {
    if (!price.ETH) this.skip();
    await network.provider.send("hardhat_setBalance", [user.address, "0x" + (10_000n * SCALE).toString(16)]);
    let i = 0;
    while (!(await S.verifier.chonxActivated()) && i++ < 6) await lockMintRelease("ETH", 45n * SCALE, { duration: YEAR10, release: false });
    expect(await S.verifier.chonxActivated()).to.equal(true);
    expect(await S.verifier.lifetimeVclmIssued()).to.be.gte(10_000_000n * SCALE);
    await C.advance(2 * 86400);
    const F = await S.forge.getAddress();
    await (await S.vclm.connect(recipient).approve(F, 1000n * SCALE)).wait();
    await (await S.chonx.connect(recipient).approve(F, 10_000n * SCALE)).wait();
    await expect(S.forge.connect(recipient).forge(1)).to.be.revertedWith("VF-TOK-003: SYNTH not activated");
    i = 0;
    while ((await S.verifier.cumulativeChonxIssued()) < 100_000_000n * SCALE && i++ < 8) await lockMintRelease("ETH", 45n * SCALE, { duration: YEAR10, output: 1, release: false });
    const v0 = await S.vclm.balanceOf(recipient.address), c0 = await S.chonx.balanceOf(recipient.address);
    await (await S.forge.connect(recipient).forge(1)).wait();
    expect(v0 - (await S.vclm.balanceOf(recipient.address))).to.equal(1000n * SCALE);
    expect(c0 - (await S.chonx.balanceOf(recipient.address))).to.equal(10_000n * SCALE);
    expect(await S.forge.balanceOf(recipient.address)).to.equal(SCALE);
    results.chonxSynth = `lifetime VCLM ${fmt(await S.verifier.lifetimeVclmIssued())}, lifetime CHONX ${fmt(await S.verifier.cumulativeChonxIssued())}, 1 SYNTH forged`;
    console.log("      " + results.chonxSynth);
  });

  it("FINDING-HH-001 on real Base state: a settled lock's RAC can be recorded again with a fresh racIdentity", async function () {
    if (!price.ETH) this.skip();
    const { p } = await lockMintRelease("ETH", ethers.parseEther("1"), { release: false });
    const ep = await S.verifier.currentEpoch();
    const b0 = await S.verifier.epochRewardBasis(ep);
    await (await S.verifier.connect(S.signers[7]).recordFeeAndRac({ ...p, racIdentity: ethers.id("again") })).wait();
    const b1 = await S.verifier.epochRewardBasis(ep);
    expect(b1).to.be.gt(b0);
    results.racReplay = `epoch ${ep} basis ${fmt(b0)} -> ${fmt(b1)} USD from one extra call by a stranger`;
    console.log("      " + results.racReplay);
  });

  after(() => {
    fs.writeFileSync(path.join(__dirname, "base_fork_results.json"), JSON.stringify(results, null, 1));
  });
});
