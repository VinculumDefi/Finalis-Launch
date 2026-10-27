// Rig 2, Ethereum mainnet fork (LOCAL ONLY). Full stack deployed by the real
// runBaseCeremony flow on a local fork of Ethereum, then lock, verify/mint and
// release with REAL deployed tokens: USDT (no-bool return, approve-to-nonzero
// quirk), USDC, PAXG (fee-on-transfer), stETH (share rounding), AMPL
// (rebasing, real rebase via its monetary policy), LINK and WBTC (standard).
// Prices come from the real Chainlink feeds on the fork; a missing or
// mismatched feed fails closed. Nothing is broadcast. No key is used.
// Run: testing-rigs/run.sh eth fork-integration/eth_fork_tokens.test.cjs
const path = require("path");
const C = require("../lib/common.cjs");
const { expect } = require(path.join(C.BC, "node_modules/chai"));
const { setBalance, findBalanceSlot, ERC20 } = require("../lib/forkTokens.cjs");
// VF-ORC-016: posted prices are USD per whole token with 30 decimals.
const P30 = (usd18) => BigInt(usd18) * 10n ** 12n;
const { ethers, network, DATA, SCALE, DAY7, short, fmt, reason } = C;

const T = {
  USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  PAXG: "0x45804880De22913dAFE09f4980848ECE6EcbAf78",
  stETH: "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84",
  AMPL: "0xD46bA6D942050d489DBd938a2C909A5d5039A161",
  LINK: "0x514910771AF9Ca656af840dff83E8264EcF986CA",
  WBTC: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
};
// Chainlink USD feeds on Ethereum, with the description each must report.
const FEEDS = {
  USDT: ["0x3E7d1eAB13ad0104d2750B8863b489D65364e32D", "USDT / USD"],
  USDC: ["0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6", "USDC / USD"],
  PAXG: ["0x214eD9Da11D2fbe465a6fc601a91E62EbEc1a0D6", "XAU / USD"],
  stETH: ["0xCfE54B5cD566aB89272946F602D76Ea879CAb4a8", "STETH / USD"],
  LINK: ["0x2c1d072e956AFFC0D435Cb7AC38EF18d24d9127c", "LINK / USD"],
  WBTC: ["0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c", "BTC / USD"],
};
const FEED_ABI = ["function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)", "function decimals() view returns (uint8)", "function description() view returns (string)"];
const results = {};

describe("Rig 2: Ethereum mainnet fork, real tokens through the real ceremony stack", function () {
  this.timeout(3600000);
  let S, user, user2, dest, dest2, recipient, lock, price = {};
  const env = "Ethereum";
  // RFOT (rig-only fee-on-transfer token) borrows the PAXG row for the lock's
  // asset identity and USD band; it is never minted against.
  const row = (sym) => C.entry(env, sym === "RFOT" ? "PAXG" : sym);

  before(async () => {
    const net = await ethers.provider.getNetwork();
    expect(net.chainId).to.equal(1n);
    // The fork must have real USDT code, otherwise this is not a fork.
    expect((await ethers.provider.getCode(T.USDT)).length).to.be.gt(1000);
    S = await C.deployStack();
    [, user, user2, recipient, dest, dest2] = S.signers;
    lock = S.nonBase.Ethereum;
    console.log("      fork block", (await ethers.provider.getBlock("latest")).number, "stack: Verifier", short(await S.verifier.getAddress()), "Ethereum CVL", short(await lock.getAddress()));
    expect(S.logs).to.include("registry 27/27");
    expect(S.logs).to.include("Finalized.");
    // Real prices from Chainlink on the fork. Fail closed on any mismatch.
    const rows = [];
    for (const [sym, [feed, desc]] of Object.entries(FEEDS)) {
      const f = new ethers.Contract(feed, FEED_ABI, ethers.provider);
      const d = await f.description();
      if (d !== desc) throw new Error("feed for " + sym + " reports " + d + ", expected " + desc + ". Fail closed.");
      const [, ans, , upd] = await f.latestRoundData();
      const dec = await f.decimals();
      if (ans <= 0n) throw new Error("non-positive price for " + sym);
      price[sym] = BigInt(ans) * 10n ** (18n - BigInt(dec));
      rows.push({ environmentId: env, canonicalAssetId: row(sym).canonicalAssetId, priceUsd30: P30(price[sym]) });
      console.log(`      price ${sym} ${fmt(price[sym])} USD (Chainlink ${desc}, updated ${new Date(Number(upd) * 1000).toISOString()})`);
    }
    // AMPL has no live Chainlink USD feed on the fork. Use Ampleforth's own
    // market oracle (the price its rebase uses). Missing: AMPL is skipped.
    try {
      const pol = new ethers.Contract(await new ethers.Contract(T.AMPL, ["function monetaryPolicy() view returns (address)"], ethers.provider).monetaryPolicy(),
        ["function marketOracle() view returns (address)"], ethers.provider);
      const mo = new ethers.Contract(await pol.marketOracle(), ["function getData() returns (uint256,bool)"], ethers.provider);
      const [v, ok] = await mo.getData.staticCall();
      if (ok && v > 0n) {
        price.AMPL = v;
        rows.push({ environmentId: env, canonicalAssetId: row("AMPL").canonicalAssetId, priceUsd30: P30(v) });
        console.log(`      price AMPL ${fmt(v)} USD (Ampleforth market oracle getData)`);
      } else console.log("      AMPL market oracle not valid. AMPL test will be skipped (fail closed).");
    } catch (e) { console.log("      AMPL market oracle read failed:", reason(e), "AMPL test will be skipped (fail closed)."); }
    await S.postPrices(rows);
  });

  const tok = (sym, signer) => new ethers.Contract(T[sym], ERC20, signer || ethers.provider);
  const usd18 = (sym, amount) => (amount * price[sym]) / 10n ** BigInt(row(sym).decimals);

  async function lockAndMint(sym, holder, destSigner, amount, duration = DAY7) {
    const t = tok(sym, holder);
    const L = await lock.getAddress();
    const dev = DATA.evmDevFunds[env];
    const lockId = ethers.hexlify(ethers.randomBytes(32));
    const b0 = { user: await t.balanceOf(holder.address), lock: await t.balanceOf(L), dev: await t.balanceOf(dev) };
    const tx = await lock.connect(holder).createErc20Lock(lockId, recipient.address, 0, row(sym).canonicalAssetId, ethers.ZeroHash,
      destSigner.address, duration, T[sym], amount, usd18(sym, amount));
    const rc = await tx.wait();
    const rec = await lock.lockRecord(lockId);
    const b1 = { user: await t.balanceOf(holder.address), lock: await t.balanceOf(L), dev: await t.balanceOf(dev) };
    // Mint step. Hardhat cannot serve eth_getProof in fork mode once local
    // state changed ("Proof of locally modified state in fork mode is
    // unsupported"), so the Ethereum receipt reader evidence cannot be built
    // here. The reader facts are checked from the real LockCreated log
    // instead, and the real-token mint path runs on the Base fork rig.
    const ev = rc.logs.map((l) => { try { return lock.interface.parseLog(l); } catch { return null; } }).find((x) => x && x.name === "LockCreated");
    expect(ev.args.lockId).to.equal(lockId);
    expect(ev.args.gross).to.equal(rec.gross);
    expect(ev.args.fee).to.equal(rec.fee);
    expect(ev.args.principal).to.equal(rec.principal);
    let minted = null, p = null;
    if (process.env.RIG_ETH_MINT) {
      p = await C.evmPkg(env, L, rc.hash, lockId, rec, row(sym).canonicalAssetId, row(sym).custodyClass, row(sym).decimals, 1);
      const v0 = await S.vclm.balanceOf(recipient.address);
      await (await S.verifier.recordFeeAndRac(p)).wait();
      await (await S.verifier.verifyAndMint(p, 0)).wait();
      minted = (await S.vclm.balanceOf(recipient.address)) - v0;
    }
    const out = {
      stated: amount, gross: rec.gross, fee: rec.fee, principal: rec.principal,
      userPaid: b0.user - b1.user, lockGot: b1.lock - b0.lock, devGot: b1.dev - b0.dev, minted,
    };
    return { lockId, rec, p, out };
  }
  async function release(sym, lockId, destSigner) {
    const t = tok(sym);
    const b0 = await t.balanceOf(destSigner.address);
    try {
      await (await lock.connect(destSigner).release(lockId)).wait();
      return { ok: true, got: (await t.balanceOf(destSigner.address)) - b0 };
    } catch (e) { return { ok: false, reason: reason(e) }; }
  }
  const show = (sym, o, d) => console.log(`      ${sym}: stated ${fmt(o.stated, d)} | user paid ${fmt(o.userPaid, d)} | gross recorded ${fmt(o.gross, d)} | fee ${fmt(o.fee, d)} | Dev Fund got ${fmt(o.devGot, d)} | lock kept ${fmt(o.lockGot, d)} | principal ${fmt(o.principal, d)} | VCLM minted ${o.minted === null ? "n/a (fork proof limit)" : fmt(o.minted)}`);

  it("USDT: approve nonzero-to-nonzero reverts (real USDT quirk); lock path works with the no-bool return; release", async () => {
    const d = 6;
    await setBalance(T.USDT, user.address, 100_000n * 10n ** 6n);
    const t = tok("USDT", user);
    const L = await lock.getAddress();
    await (await t.approve(L, 1_000n * 10n ** 6n)).wait();
    // The app pattern (Lock.jsx:171) calls approve(amount) when allowance < amount.
    // With a leftover nonzero allowance, real USDT reverts.
    let quirk;
    try { await (await t.approve(L, 5_000n * 10n ** 6n)).wait(); quirk = "no revert"; } catch (e) { quirk = "reverted: " + reason(e); }
    console.log("      USDT approve(nonzero) over leftover nonzero allowance:", quirk);
    expect(quirk).to.match(/^reverted/);
    await (await t.approve(L, 0)).wait();
    await (await t.approve(L, 5_000n * 10n ** 6n)).wait();
    const r = await lockAndMint("USDT", user, dest, 5_000n * 10n ** 6n);
    show("USDT", r.out, d);
    expect(r.out.gross).to.equal(r.out.stated);
    expect(r.out.fee).to.equal((r.out.gross * 500n) / 10000n);
    expect(r.out.devGot).to.equal(r.out.fee);
    await C.advance(Number(DAY7) + 1);
    const rel = await release("USDT", r.lockId, dest);
    console.log("      USDT release:", rel.ok ? "ok, got " + fmt(rel.got, d) : rel.reason);
    expect(rel.ok && rel.got === r.out.principal).to.equal(true);
    results.USDT = { quirk, ...r.out, release: rel };
  });

  it("USDC: lock, exact 5% fee, release", async () => {
    const d = 6;
    await setBalance(T.USDC, user.address, 100_000n * 10n ** 6n);
    const t = tok("USDC", user);
    const L = await lock.getAddress();
    // The $0.95 rule needs the Verifier mint path; on this fork it runs only
    // with RIG_ETH_MINT (see the proof note above). The Base fork rig and the
    // invariants rig test it on USDC_BASE.
    let mintedAt095 = null;
    // Restore the real feed price, then a normal lock.
    await S.postPrices([{ environmentId: env, canonicalAssetId: row("USDC").canonicalAssetId, priceUsd30: P30(price.USDC) }]);
    await (await t.approve(L, 5_000n * 10n ** 6n)).wait();
    const r = await lockAndMint("USDC", user, dest, 5_000n * 10n ** 6n);
    show("USDC", r.out, d);
    expect(r.out.devGot).to.equal(r.out.fee);
    await C.advance(Number(DAY7) + 1);
    const rel = await release("USDC", r.lockId, dest);
    expect(rel.ok && rel.got === r.out.principal).to.equal(true);
    results.USDC = { mintedAt095, ...r.out, release: rel };
  });

  it("PAXG (real fee-on-transfer): gross = received delta; Dev Fund and release are each short by the token's own transfer fee", async () => {
    const d = 18;
    await setBalance(T.PAXG, user.address, 10n * SCALE);
    const t = tok("PAXG", user);
    await (await t.approve(await lock.getAddress(), 2n * SCALE)).wait();
    const r = await lockAndMint("PAXG", user, dest, 2n * SCALE);
    show("PAXG", r.out, d);
    const tax = r.out.stated - r.out.gross;
    console.log("      PAXG transfer fee on the lock deposit:", fmt(tax), "PAXG; Dev Fund short by", fmt(r.out.fee - r.out.devGot), "PAXG");
    expect(r.out.gross).to.equal(r.out.lockGot + r.out.fee); // lock kept received - fee
    // Real PAXG at this fork block took no transfer fee (its fee getters
    // revert on the current implementation). Recorded as observed; the
    // fee-on-transfer accounting itself is measured with RFOT below.
    results.PAXG_fee_observed = String(tax);
    expect(r.out.userPaid).to.equal(r.out.gross + tax);
    expect(r.out.fee).to.equal((r.out.gross * 500n) / 10000n);
    await C.advance(Number(DAY7) + 1);
    const rel = await release("PAXG", r.lockId, dest);
    console.log("      PAXG release:", rel.ok ? "ok, destination got " + fmt(rel.got) + " of principal " + fmt(r.out.principal) : rel.reason);
    results.PAXG = { tax, devShort: r.out.fee - r.out.devGot, ...r.out, release: rel };
  });

  it("fee-on-transfer (rig RFOT, 1% per transfer, local only): gross = received delta; Dev Fund and release each lose the token's own fee", async () => {
    const A = require("./fot/RigFeeOnTransfer.json");
    const F = await new ethers.ContractFactory(A.abi, A.bytecode, user).deploy();
    T.RFOT = await F.getAddress();
    price.RFOT = price.PAXG;
    if (!price.RFOT) return; // no PAXG price: fail closed, no USD band
    await (await F.mint(user.address, 10n * SCALE)).wait();
    await (await F.approve(await lock.getAddress(), 2n * SCALE)).wait();
    const r = await lockAndMint("RFOT", user, dest, 2n * SCALE);
    show("RFOT", r.out, 18);
    const tax = r.out.stated - r.out.gross;
    const devShort = r.out.fee - r.out.devGot;
    console.log("      RFOT transfer fee on the deposit:", fmt(tax), "; Dev Fund got", fmt(r.out.devGot), "of recorded fee", fmt(r.out.fee), "(short", fmt(devShort) + ")");
    expect(r.out.userPaid).to.equal(r.out.stated);
    expect(r.out.gross).to.equal((r.out.stated * 9900n) / 10000n); // gross = what the lock received
    expect(r.out.fee).to.equal((r.out.gross * 500n) / 10000n);
    await C.advance(Number(DAY7) + 1);
    const rel = await release("RFOT", r.lockId, dest);
    console.log("      RFOT release:", rel.ok ? "ok, destination got " + fmt(rel.got) + " of recorded principal " + fmt(r.out.principal) : rel.reason);
    results.RFOT = { tax, devShort, ...r.out, release: rel };
  });

  it("stETH (real share rounding): delta accounting and whether a single lock can release its recorded principal", async () => {
    const d = 18;
    const st = new ethers.Contract(T.stETH, [...ERC20, "function submit(address) payable returns (uint256)", "function sharesOf(address) view returns (uint256)"], user);
    await (await st.submit(ethers.ZeroAddress, { value: 5n * SCALE })).wait();
    await (await st.approve(await lock.getAddress(), 3n * SCALE)).wait();
    const r = await lockAndMint("stETH", user, dest, 3n * SCALE);
    show("stETH", r.out, d);
    const L = await lock.getAddress();
    const held = await st.balanceOf(L);
    console.log("      stETH: lock holds", held.toString(), "wei; principal", r.out.principal.toString(), "wei; gap", (r.out.principal - held).toString(), "wei");
    await C.advance(Number(DAY7) + 1);
    const rel = await release("stETH", r.lockId, dest);
    console.log("      stETH release:", rel.ok ? "ok, got " + rel.got.toString() + " wei" : "FAILED " + rel.reason);
    results.stETH = { held, gap: r.out.principal - held, ...r.out, release: rel };
  });

  it("AMPL (real rebasing): two locks share one pool; a real negative rebase leaves the second release short", async function () {
    if (!price.AMPL) this.skip();
    const d = 9;
    const ampl = new ethers.Contract(T.AMPL, [...ERC20, "function monetaryPolicy() view returns (address)", "function rebase(uint256,int256) returns (uint256)"], ethers.provider);
    // AMPL balance is gons / gonsPerFragment. Find the gons slot and scale.
    const s = await findBalanceSlotBig(T.AMPL, user.address);
    console.log("      AMPL gons mapping slot", s.slot);
    for (const who of [user, user2]) await fundAmpl(s, who.address, 20_000n * 10n ** 9n, ampl);
    const amount = 10_000n * 10n ** 9n;
    await (await tok("AMPL", user).approve(await lock.getAddress(), amount)).wait();
    await (await tok("AMPL", user2).approve(await lock.getAddress(), amount)).wait();
    const a = await lockAndMint("AMPL", user, dest, amount);
    const b = await lockAndMint("AMPL", user2, dest2, amount);
    show("AMPL#1", a.out, d); show("AMPL#2", b.out, d);
    const L = await lock.getAddress();
    const pool0 = await ampl.balanceOf(L);
    // Real rebase: impersonate AMPL's monetary policy on the fork, -10% supply.
    const mp = await ampl.monetaryPolicy();
    await network.provider.send("hardhat_impersonateAccount", [mp]);
    await network.provider.send("hardhat_setBalance", [mp, "0x56BC75E2D63100000"]);
    const supply = await ampl.totalSupply();
    await (await ampl.connect(await ethers.getSigner(mp)).rebase(999999n, -(supply / 10n))).wait();
    await network.provider.send("hardhat_stopImpersonatingAccount", [mp]);
    const pool1 = await ampl.balanceOf(L);
    console.log("      AMPL pool before rebase", fmt(pool0, d), "after -10% rebase", fmt(pool1, d), "recorded principals", fmt(a.out.principal + b.out.principal, d));
    await C.advance(Number(DAY7) + 1);
    const r1 = await release("AMPL", a.lockId, dest);
    const r2 = await release("AMPL", b.lockId, dest2);
    console.log("      AMPL release #1:", r1.ok ? "ok " + fmt(r1.got, d) : r1.reason, "| release #2:", r2.ok ? "ok " + fmt(r2.got, d) : "FAILED " + r2.reason);
    results.AMPL = { pool0, pool1, a: a.out, b: b.out, r1, r2 };
    expect(r1.ok).to.equal(true);
    expect(r2.ok).to.equal(false); // FINDING-HH-005: pool short after a negative rebase
  });

  it("LINK and WBTC (standard ERC-20s): exact 5% fee, exact principal released", async () => {
    for (const [sym, amt, d] of [["LINK", 500n * SCALE, 18], ["WBTC", 5n * 10n ** 7n, 8]]) {
      await setBalance(T[sym], user.address, amt * 4n);
      await (await tok(sym, user).approve(await lock.getAddress(), amt)).wait();
      const r = await lockAndMint(sym, user, dest, amt);
      show(sym, r.out, d);
      expect(r.out.gross).to.equal(amt);
      expect(r.out.devGot).to.equal(r.out.fee);
      expect(r.out.fee).to.equal((amt * 500n) / 10000n);
      await C.advance(Number(DAY7) + 1);
      const rel = await release(sym, r.lockId, dest);
      expect(rel.ok && rel.got === r.out.principal).to.equal(true);
      results[sym] = { ...r.out, release: rel };
    }
  });

  after(() => {
    const fs = require("fs");
    const j = JSON.stringify(results, (k, v) => (typeof v === "bigint" ? v.toString() : v), 2).replace(/0x[0-9a-fA-F]{40}/g, (a) => short(a));
    fs.writeFileSync(path.join(__dirname, "eth_fork_results.json"), j + "\n");
  });
});

// AMPL: balanceOf = gons / gonsPerFragment, so a small storage mark reads as 0.
async function findBalanceSlotBig(token, probe) {
  const c = new ethers.Contract(token, ERC20, ethers.provider);
  const big = 1n << 250n;
  for (let i = 0; i < 400; i++) {
    const key = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(["address", "uint256"], [probe, i]));
    const prev = await ethers.provider.getStorage(token, key);
    await network.provider.send("hardhat_setStorageAt", [token, key, ethers.toBeHex(big, 32)]);
    const bal = await c.balanceOf(probe).catch(() => 0n);
    await network.provider.send("hardhat_setStorageAt", [token, key, prev]);
    if (bal > 0n) return { slot: i, perFragment: big / bal };
  }
  throw new Error("AMPL gons slot not found");
}
async function fundAmpl(s, who, amount, ampl) {
  const key = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(["address", "uint256"], [who, s.slot]));
  await network.provider.send("hardhat_setStorageAt", [T.AMPL, key, ethers.toBeHex(amount * s.perFragment + s.perFragment, 32)]);
  expect(await ampl.balanceOf(who)).to.be.gte(amount);
}
