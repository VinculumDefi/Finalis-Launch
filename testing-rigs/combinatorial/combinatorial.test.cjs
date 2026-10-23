// COMBINATORIAL rig (discovery only, no fixes). Local hardhat chain only.
// Skipped unless EXTRA_RIG=1. Run:
//   cd base-contracts && EXTRA_RIG=1 npx hardhat test ../testing-rigs/combinatorial/combinatorial.test.cjs
// Grid (exhaustive): chain context {Base, Ethereum} x asset class {native, standard
// ERC-20, stablecoin at $0.95, stablecoin above (1.00 at lock, 0.94 later),
// stablecoin below (0.94 at lock, 1.00 later), low-decimals ERC-20, protocol token}
// x all 16 durations x USD bucket {0.005, 0.01, 0.015, 0.02, 0.025, 5.00}
// x binding {bound: RAC recorded right after lock creation, before the next price
// run; unbound: first submission after the next price run}. Plus invalid-duration
// controls. Every cell is appended to results/cells.jsonl as soon as it finishes.
// The oracle is the spec: fee = floor(5% of gross), Handshake band $0.01-$0.02,
// others >= $0.01, VF-TOK-007 refusal, $0.95 stable rule, and price/valuation
// fixed at lock creation (VF-ORC-009/010). Lock ids are written truncated.
const path = require("path");
const fs = require("fs");
const { createRequire } = require("module");
const BC = path.resolve(__dirname, "../../base-contracts");
const req = createRequire(path.join(BC, "package.json"));
const { ethers, network } = req("hardhat");
const { ethLockEvidence, encodeEvidence } = req(path.join(BC, "test/lib/ethProof.cjs"));

const run = process.env.EXTRA_RIG ? it : it.skip;
const OUT = path.join(__dirname, "results");
const CELLS = process.env.COMB_CELLS || path.join(OUT, "cells.jsonl");
const LIMIT = Number(process.env.CELL_LIMIT || 0); // smoke runs only
const SCALE = 10n ** 18n;
const coder = ethers.AbiCoder.defaultAbiCoder();
const usd = (s) => ethers.parseUnits(s, 18);

const DURS = [3600, 604800, 2592000, 5184000, 7776000, 15552000, 31536000, 63072000, 94608000,
  126144000, 157680000, 189216000, 220752000, 252288000, 283824000, 315360000];
const MULT = { 3600: 10000, 604800: 10000, 2592000: 11500, 5184000: 13000, 7776000: 15000, 15552000: 20000,
  31536000: 25000, 63072000: 38000, 94608000: 50000, 126144000: 57500, 157680000: 65000, 189216000: 68000,
  220752000: 71000, 252288000: 74000, 283824000: 77000, 315360000: 80000 };
const BUCKETS = ["0.005", "0.01", "0.015", "0.02", "0.025", "5"];
const BAD_DURS = [0, 3599, 3601, 604801];

// asset classes; p1 = price at lock creation (run A), p2 = next run (run B)
const ASSETS = [
  { cls: "native", sym: "ETH", dec: 18, p1: usd("2000"), p2: usd("4000") },
  { cls: "erc20", sym: "TKN", dec: 18, p1: usd("2"), p2: usd("1") },
  { cls: "stable_at_0.95", sym: "USDC", dec: 18, p1: usd("0.95"), p2: usd("0.95") },
  { cls: "stable_above_then_below", sym: "USDT", dec: 18, p1: usd("1"), p2: usd("0.94") },
  { cls: "stable_below_then_above", sym: "USDC_X", dec: 18, p1: usd("0.94"), p2: usd("1") },
  { cls: "erc20_lowdec", sym: "LDX", dec: 2, p1: usd("1"), p2: usd("1") },
  { cls: "protocol", sym: "VCLM", dec: 18, p1: 0n, p2: 0n },
];
const isStableSym = (s) => /^(USDC|USDT)(_.+)?$|^USDTE$/.test(s);

function append(o) { fs.appendFileSync(CELLS, JSON.stringify(o) + "\n"); }
function why(e) {
  const m = String(e && (e.shortMessage || e.message) || e);
  const r = m.match(/reverted with reason string '([^']+)'/) || m.match(/reason="([^"]+)"/) || m.match(/reverted with custom error '([^']+)'/);
  return r ? r[1] : m.slice(0, 160);
}
function grossFor(target, price, dec, edge) {
  const num = target * 10n ** BigInt(dec), den = price;
  if (edge === "ceil") return (num + den - 1n) / den;
  if (edge === "floor") return num / den;
  return (num + den / 2n) / den;
}
function usdOf(gross, price, dec) { return ((gross * SCALE) / 10n ** BigInt(dec)) * price / SCALE; }
function rate(days) {
  let r = 10n * SCALE; const fl = SCALE;
  for (let i = 0n; i < days / 30n; i++) { r = (r * 983330000000000000n) / SCALE; if (r <= fl) { r = fl; break; } }
  return r < fl ? fl : r;
}
function issuance(u, custodyBps, durBps, days) {
  let s = (u * rate(days)) / SCALE;
  s = (s * ((SCALE * BigInt(custodyBps)) / 10000n)) / SCALE;
  return (s * ((SCALE * BigInt(durBps)) / 10000n)) / SCALE;
}

describe("COMBINATORIAL rig (skipped unless EXTRA_RIG=1)", function () {
  this.timeout(0);
  let S, runId = 1n;

  async function deploy() {
    const [deployer, user, recipient, dest, devFund] = await ethers.getSigners();
    const T = await ethers.getContractFactory("VinculumFinalisToken");
    const vclm = await T.deploy("Vinculum", "VCLM", 10_000_000_000n * SCALE);
    const chonx = await T.deploy("Chonx", "CHONX", 100_000_000_000n * SCALE);
    const verifier = await (await ethers.getContractFactory("VinculumFinalisVerifier")).deploy(await vclm.getAddress(), await chonx.getAddress());
    const stake = await (await ethers.getContractFactory("VinculumFinalisStake")).deploy(
      await vclm.getAddress(), await chonx.getAddress(), await vclm.getAddress(), await verifier.getAddress());
    await vclm.initialize(await verifier.getAddress(), await stake.getAddress());
    await chonx.initialize(await verifier.getAddress(), ethers.ZeroAddress);
    const baseLock = await (await ethers.getContractFactory("BaseCommitmentVaultLock")).deploy(
      "Base", devFund.address, await vclm.getAddress(), await chonx.getAddress(), await vclm.getAddress());
    const ethLock = await (await ethers.getContractFactory("CommitmentVaultLock")).deploy("Ethereum", devFund.address);
    await verifier.registerChainVerifier("Base", await (await (await ethers.getContractFactory("BaseLockRecordVerifier")).deploy(await baseLock.getAddress())).getAddress());
    await verifier.registerChainVerifier("Ethereum", await (await (await ethers.getContractFactory("SimpleEthereumLockReader")).deploy(await ethLock.getAddress())).getAddress());
    await verifier.configureDevFund("Base", devFund.address);
    await verifier.configureDevFund("Ethereum", devFund.address);
    const F = await ethers.getContractFactory("TestFixtureERC20");
    const P = await ethers.getContractFactory("ProtocolCopyFixtureERC20");
    const ctx = {};
    for (const env of ["Base", "Ethereum"]) {
      ctx[env] = { lock: env === "Base" ? baseLock : ethLock, assets: {} };
      for (const a of ASSETS) {
        let token = null, id;
        if (a.cls === "native") id = env === "Base" ? await verifier.BASE_NATIVE_ETH_ASSET_ID() : ethers.solidityPackedKeccak256(["string", "string"], [env, "native-ETH"]);
        else if (a.cls === "protocol") {
          token = env === "Base" ? vclm : await P.deploy("Vinculum Finalis VCLM", "VCLM");
          id = ethers.id(env + ":protocol");
        } else { token = await F.deploy(0); id = ethers.id(env + ":" + a.sym); }
        if (a.cls !== "protocol") {
          await verifier.registerAssetPrecision(env, id, a.sym, a.dec, 2, 0);
          if (token) await verifier.registerTokenAddressBatch([{ environmentId: env, token: await token.getAddress(), canonicalAssetId: id }]);
        }
        ctx[env].assets[a.cls] = { ...a, token, id };
      }
    }
    await verifier.setScheduledPricePoster(deployer.address);
    S = { verifier, ctx };
    await priceRun(1); // finalize needs a usable Base ETH price
    await verifier.finalize();
    S = { deployer, user, recipient, dest, devFund, vclm, verifier, ctx, launch: await verifier.protocolLaunchTimestamp() };
  }

  async function priceRun(which) {
    const rows = [];
    for (const env of ["Base", "Ethereum"]) for (const a of ASSETS) if (a.cls !== "protocol")
      rows.push({ environmentId: env, canonicalAssetId: S.ctx[env].assets[a.cls].id, priceUsd18: which === 1 ? a.p1 : a.p2, success: true });
    await S.verifier.applyScheduledPriceRun(runId++, rows);
  }

  async function makePkg(env, A, lockId, rc) {
    const lock = S.ctx[env].lock;
    const rec = await lock.lockRecord(lockId);
    const p = {
      sourceEnvironmentId: env, commitmentVaultLockId: lockId, handshakeAllowanceCount: 3,
      canonicalAssetId: A.id, assetPrecision: A.dec, assetCustodyClass: 2,
      grossAmountSmallestUnits: rec.gross, actualFeeAmountSmallestUnits: rec.fee,
      principalAmountSmallestUnits: rec.principal, feeAssetId: A.id, devFundDestination: "dev",
      feeTransferEvidence: ethers.id("fee"), valuationTimestamp: rec.createdAt, maturityTimestamp: rec.maturity,
      durationSecs: rec.duration, selectedOutputToken: 0, baseRecipient: S.recipient.address,
      releaseDestination: "release", chonxActivationReceipt: "0x",
      racIdentity: ethers.hexlify(ethers.randomBytes(32)), priceRecord: "0x", sourceFinalityProof: "0x",
      lockEventProof: coder.encode(["bytes32", "uint256", "uint256", "uint256", "uint256", "uint256", "uint256"],
        [lockId, rec.gross, rec.fee, rec.principal, rec.duration, rec.createdAt, rec.maturity]),
    };
    if (env === "Ethereum") {
      const ev = await ethLockEvidence(await lock.getAddress(), rc.hash, lockId);
      p.sourceFinalityProof = coder.encode(["uint256", "bytes32", "uint256"], [1, ev.block.hash, ev.block.number]);
      p.lockEventProof = encodeEvidence(ev);
    }
    return { p, rec };
  }

  async function cell(env, cls, duration, bucket, bound) {
    const A = S.ctx[env].assets[cls];
    const lock = S.ctx[env].lock;
    const o = { env, cls, sym: A.sym, duration, bucket, bound, handshake: duration === 3600 };
    const target = usd(bucket);
    const edge = bucket === "0.01" ? "ceil" : bucket === "0.02" ? "floor" : "round";
    const price = A.cls === "protocol" ? usd("1") : A.p1;
    const gross = grossFor(target, price, A.dec, edge);
    const usd1 = usdOf(gross, price, A.dec);
    o.gross = gross.toString(); o.usd_at_lock = ethers.formatUnits(usd1, 18);
    // spec oracle
    const inBand = duration === 3600 ? usd1 >= usd("0.01") && usd1 <= usd("0.02") : usd1 >= usd("0.01");
    const feeSpec = (gross * 500n) / 10000n;
    let expect;
    if (!MULT[duration]) expect = "refuse_lock:duration";
    else if (A.cls === "protocol") expect = "refuse_lock:VF-TOK-007";
    else if (!inBand) expect = "refuse_lock:band";
    else if (feeSpec === 0n) expect = "refuse_lock:zero_fee";
    else if (isStableSym(A.sym) && A.p1 < usd("0.95")) expect = "refuse:stable_below_0.95_at_lock";
    else expect = "mint";
    o.expect = expect;
    await priceRun(1);
    const lockId = ethers.hexlify(ethers.randomBytes(32));
    o.lock = lockId.slice(0, 10);
    let rc;
    const devBefore = A.token ? await A.token.balanceOf(S.devFund.address) : await ethers.provider.getBalance(S.devFund.address);
    try {
      if (A.cls === "native") {
        rc = await (await lock.connect(S.user).createNativeLock(lockId, S.recipient.address, 0, A.id, ethers.ZeroHash, S.dest.address, duration, usd1, { value: gross })).wait();
      } else {
        if (A.cls !== "protocol" || env !== "Base") await A.token.mint(S.user.address, gross);
        await A.token.connect(S.user).approve(await lock.getAddress(), gross);
        rc = await (await lock.connect(S.user).createErc20Lock(lockId, S.recipient.address, 0, A.id, ethers.ZeroHash, S.dest.address, duration, await A.token.getAddress(), gross, usd1)).wait();
      }
      o.lock_ok = true;
    } catch (e) { o.lock_ok = false; o.lock_err = why(e); }
    if (o.lock_ok) {
      const devAfter = A.token ? await A.token.balanceOf(S.devFund.address) : await ethers.provider.getBalance(S.devFund.address);
      const { p, rec } = await makePkg(env, A, lockId, rc);
      o.fee = rec.fee.toString(); o.principal = rec.principal.toString();
      o.fee_is_floor5pct = rec.fee === (rec.gross * 500n) / 10000n && rec.principal === rec.gross - rec.fee;
      o.devfund_received = (devAfter - devBefore).toString();
      o.fee_effective_bps = rec.gross > 0n ? Number((rec.fee * 1000000n) / rec.gross) / 100 : null;
      if (bound) {
        try { await S.verifier.recordFeeAndRac(p); o.record_ok = true; o.record_at = "A"; } catch (e) { o.record_ok = false; o.record_err_A = why(e); }
      }
      await priceRun(2);
      if (!o.record_ok) {
        try { await S.verifier.recordFeeAndRac(p); o.record_ok = true; o.record_at = "B"; } catch (e) { o.record_ok = false; o.record_err = why(e); }
      }
      if (o.record_ok) {
        const b0 = await S.vclm.balanceOf(S.recipient.address);
        try {
          await S.verifier.verifyAndMint(p, 0);
          o.mint_ok = true;
          o.minted = ((await S.vclm.balanceOf(S.recipient.address)) - b0).toString();
        } catch (e) { o.mint_ok = false; o.mint_err = why(e); }
      }
      const days = (rec.createdAt - S.launch) / 86400n;
      o.expected_mint_at_lock_price = expect === "mint" ? issuance(usd1, 13000, MULT[duration], days).toString() : null;
      if (o.mint_ok) {
        const u2 = usdOf(gross, A.p2, A.dec);
        o.mint_matches = o.minted === o.expected_mint_at_lock_price ? "lock_price" :
          o.minted === issuance(u2, 13000, MULT[duration], days).toString() ? "later_run_price" : "other";
      }
    }
    // verdict
    const observed = !o.lock_ok ? "refuse_lock" : o.mint_ok ? "mint" : "refuse_after_lock";
    o.observed = observed;
    if (expect === "mint") o.verdict = observed === "mint" ? (o.mint_matches === "lock_price" ? "PASS" : "DEVIATION:mint_at_later_price") :
      observed === "refuse_after_lock" ? "DEVIATION:valid_lock_not_minted" : "DEVIATION:valid_lock_refused";
    else if (expect.startsWith("refuse_lock")) o.verdict = observed === "refuse_lock" ? "PASS" : observed === "mint" ? "DEVIATION:minted_but_spec_refuses" : "DEVIATION:lock_accepted_fee_taken_no_mint";
    else /* stable below at lock */ o.verdict = observed === "mint" ? "DEVIATION:minted_but_spec_refuses" : observed === "refuse_after_lock" ? "DEVIATION:lock_accepted_fee_taken_no_mint" : "PASS";
    if (o.lock_ok && !o.fee_is_floor5pct) o.verdict += "|FEE_RULE_BROKEN";
    if (o.lock_ok && o.devfund_received !== o.fee) o.verdict += "|DEVFUND_DELTA_NE_FEE";
    append(o);
    return o;
  }

  run("exhaustive grid", async () => {
    fs.mkdirSync(OUT, { recursive: true });
    const done = new Set();
    if (fs.existsSync(CELLS)) for (const l of fs.readFileSync(CELLS, "utf8").split("\n")) if (l) { const o = JSON.parse(l); done.add([o.env, o.cls, o.duration, o.bucket, o.bound].join("|")); }
    await deploy();
    let n = 0;
    for (const env of ["Base", "Ethereum"]) for (const a of ASSETS) for (const d of DURS) for (const b of BUCKETS) for (const bound of [true, false]) {
      if (done.has([env, a.cls, d, b, bound].join("|"))) continue;
      if (LIMIT && n >= LIMIT) continue;
      await cell(env, a.cls, d, b, bound);
      if (++n % 100 === 0) console.log(`      ${n} cells`);
    }
    if (!LIMIT) for (const env of ["Base", "Ethereum"]) for (const d of BAD_DURS) {
      if (!done.has([env, "native", d, "5", true].join("|"))) await cell(env, "native", d, "5", true);
    }
    console.log(`      wrote ${n} new cells to ${path.relative(process.cwd(), CELLS)}`);
  });
});
