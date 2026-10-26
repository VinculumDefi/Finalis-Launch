// COMBINATORIAL rig. Local hardhat chain only.
// Converted 2026-10-23: always active, and the test FAILS if any cell deviates
// from the spec oracle. Run:
//   testing-rigs/run.sh none combinatorial/combinatorial.test.cjs
// Ethereum cells use the test-only anchored reader (SimpleEthereumLockReaderTestAnchor)
// because the production non-Base readers now refuse all evidence (AG-01). This keeps
// the price, band, fee and stablecoin rules covered for a non-Base CVL.
// Stablecoin below $0.95 at lock creation: a source-chain CVL has no price feed, so
// the lock itself cannot refuse it. The Verifier refuses it fail-closed (VF-ORC-005,
// no mint). The oracle accepts "refused at the lock" or "refused after the lock"
// for that class and fails on any mint.
// t430u item 4 (2026-10-26): the $0.95 rule applies to the exact USDC/USDT
// identities (Verifier isUsdStableIdentity: environment + contract), never to a
// ticker. The USDC and USDT classes run on fixture code placed at the real
// USDC/USDT contract of each chain (hardhat_setCode on the local chain). The
// USDC_X class carries a stablecoin-like ticker on another address: it is not
// a stablecoin identity, so the $0.95 rule does not apply to it.
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

const run = it;
const OUT = process.env.COMB_OUT || path.join(__dirname, "../rerun-2026-10-23/combinatorial");
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
  { cls: "stable_at_0.95", sym: "USDC", dec: 18, p1: usd("0.95"), p2: usd("0.95"), identity: "USDC" },
  { cls: "stable_above_then_below", sym: "USDT", dec: 18, p1: usd("1"), p2: usd("0.94"), identity: "USDT" },
  { cls: "stable_below_then_above", sym: "USDC_X", dec: 18, p1: usd("0.94"), p2: usd("1") }, // ticker only: not an identity
  { cls: "erc20_lowdec", sym: "LDX", dec: 2, p1: usd("1"), p2: usd("1") },
  { cls: "protocol", sym: "VCLM", dec: 18, p1: 0n, p2: 0n },
];
// The exact USDC/USDT contracts (Verifier isUsdStableIdentity) used for the identity classes.
const STABLE_IDENTITY = {
  Base: { USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", USDT: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2" },
  Ethereum: { USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7" },
};
const isStableIdentity = (a) => !!a.identity;

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

describe("COMBINATORIAL rig (active, fails on any deviation)", function () {
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
    await verifier.registerChainVerifier("Ethereum", await (await (await ethers.getContractFactory("SimpleEthereumLockReaderTestAnchor")).deploy(await ethLock.getAddress())).getAddress());
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
        } else if (a.identity) {
          // fixture code at the exact stablecoin contract (constructor storage: withholdBps 0)
          const tmp = await F.deploy(0);
          const at = STABLE_IDENTITY[env][a.identity];
          await network.provider.send("hardhat_setCode", [at, await ethers.provider.getCode(await tmp.getAddress())]);
          token = F.attach(at);
          if (!(await verifier.isUsdStableIdentity(env, at))) throw new Error("not a stablecoin identity: " + env + " " + a.identity);
          id = ethers.id(env + ":" + a.sym);
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
    else if (isStableIdentity(A) && A.p1 < usd("0.95")) expect = "refuse:stable_below_0.95_at_lock";
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
    else /* stable below at lock: fail-closed, no mint */ o.verdict = observed === "mint" ? "DEVIATION:minted_but_spec_refuses" :
      observed === "refuse_after_lock" ? (/VF-ORC-005/.test(o.record_err || o.mint_err || "") ? "PASS" : "DEVIATION:wrong_refusal") : "PASS";
    if (o.lock_ok && !o.fee_is_floor5pct) o.verdict += "|FEE_RULE_BROKEN";
    if (o.lock_ok && o.devfund_received !== o.fee) o.verdict += "|DEVFUND_DELTA_NE_FEE";
    append(o);
    return o;
  }

  run("exhaustive grid", async () => {
    fs.mkdirSync(OUT, { recursive: true });
    const done = new Set();
    if (fs.existsSync(CELLS)) fs.unlinkSync(CELLS); // always a fresh, complete grid
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
    const cells = fs.readFileSync(CELLS, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
    const counts = {};
    for (const o of cells) counts[o.verdict] = (counts[o.verdict] || 0) + 1;
    fs.writeFileSync(path.join(OUT, "summary.json"), JSON.stringify({ cells: cells.length, verdicts: counts }, null, 2) + "\n");
    console.log(`      verdicts ${JSON.stringify(counts)}`);
    const bad = cells.filter((o) => o.verdict !== "PASS");
    if (bad.length) console.log(bad.slice(0, 10).map((o) => JSON.stringify(o)).join("\n"));
    require("assert").strictEqual(bad.length, 0, `${bad.length} cells deviate from the spec oracle`);
  });
});
