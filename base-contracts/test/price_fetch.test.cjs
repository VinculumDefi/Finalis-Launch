// Price fetcher (scripts/fetchPrices.cjs) -> price run (scripts/priceRun.cjs)
// -> Verifier on the in-process test chain, posted as the live poster by
// impersonation (no key). HTTP is mocked here; nothing is fetched or posted live.
// The fixture test/fixtures/price_fetch_sample.json is a slice of one real
// read-only fetch (t209u item 2).
const { expect } = require("chai");
const hre = require("hardhat");
const { ethers } = hre;
const { fetchPrices, registryRows, rowAddress, summarize, MIN_LIQUIDITY_USD, FRESH_SECS } = require("../scripts/fetchPrices.cjs");
const { buildPriceRun, buildPriceRuns, nextRunId, postOnTestChain, MAX_LINES_PER_RUN } = require("../scripts/priceRun.cjs");
const art = require("../scripts/deploy-pages/ceremony.json");
const data = require("../scripts/deploy-pages/ceremony-data.json");
const { runBaseCeremony, EVM_ENVS } = require("../scripts/deploy-pages/baseCeremonyFlow.js");
const SAMPLE = require("./fixtures/price_fetch_sample.json");

const key = (env, id) => ethers.solidityPackedKeccak256(["string", "bytes32"], [env, id]);
const NOW = 1_800_000_000;
const NOPAUSE = { cg: 0, ds: 0, gt: 0 };

// Mock HTTP: answers from a table of handlers; records every URL requested.
function mock(handlers) {
  const urls = [];
  const get = async (url) => {
    urls.push(url);
    for (const [re, fn] of handlers) if (re.test(url)) return { status: 200, body: JSON.stringify(fn(url)) };
    return { status: 404, body: "{}" };
  };
  return { get, urls };
}
const cgIds = (u) => decodeURIComponent(u.match(/ids=([^&]+)/)[1]).split(",");
const addrs = (u) => u.split("/").pop().split("?")[0].split(",");

describe("Price fetcher -> price run (test chain)", function () {
  this.timeout(900000);
  const rows = registryRows();
  // Distinct token rows (each with its own CoinGecko id) on their own chains.
  const toks = [];
  for (const r of rows) if (r.kind === "token" && /^0x[0-9a-fA-F]{40}$/.test(r.identifier) && !toks.some((t) => t.pricingIdentifier === r.pricingIdentifier)) toks.push(r);
  const pickOn = (env, n) => toks.filter((r) => r.environmentId === env)[n];
  const T = { single: pickOn("Ethereum", 0), split: pickOn("Ethereum", 1), idle: pickOn("Ethereum", 2), noPool: pickOn("Ethereum", 3),
    staleWithPool: pickOn("Polygon", 0), staleOnly: pickOn("Base", 0), overCap: pickOn("Ethereum", 4), gtOnly: pickOn("Arbitrum", 0),
    quoteSide: pickOn("BNB Smart Chain", 0), wrongChain: pickOn("Avalanche", 0), dsDown: pickOn("Optimism", 0), noQuote: pickOn("Ethereum", 5) };
  const btc = rows.find((r) => r.row === 3);
  const doge = rows.find((r) => r.row === 4);
  const baseEth = rows.find((r) => r.environmentId === "Base" && r.row === 2);
  // Solana SOL (row 5) is not in Revision B; the prior-revision row is used only
  // to exercise the GeckoTerminal path on a non-EVM address.
  const sol = require("../scripts/registryFile.cjs").loadHistoricalWritten().find((r) => r.row === 5);
  const solMint = "So11111111111111111111111111111111111111112";
  const solRow = { ...sol, identifier: solMint, kind: "token" };
  const lc = (a) => String(a).toLowerCase();

  it("reads the 487 Revision B rows: the 486 written rows plus Base ETH; no Solana", () => {
    expect(rows.length).to.equal(487);
    expect(rows.filter((r) => r.environmentId === "Base" && r.row === 2).length).to.equal(1);
    expect(rows.filter((r) => r.environmentId === "Solana").length).to.equal(0);
    expect(sol.environmentId).to.equal("Solana");
    expect(rows.every((r) => r.pricingIdentifier)).to.equal(true);
    expect(rows.filter((r) => r.kind === "native").length).to.equal(12);
    for (const t of Object.values(T)) expect(t, "test row").to.not.equal(undefined);
  });

  describe("tightened rule (t222u): one traded pool >= $10,000 on its own, fresh price, natives on fresh CoinGecko only", function () {
    let by, m;
    const pair = (t, o = {}) => ({ chainId: CHAINS[t.environmentId].ds, pairAddress: o.pair || "0x" + "a".repeat(40), baseToken: { address: t.identifier }, quoteToken: { address: "0x" + "e".repeat(40) },
      priceUsd: o.price || "1.5", priceNative: o.native || "0.0005", liquidity: { usd: o.liq }, txns: { h24: { buys: o.buys ?? 3, sells: o.sells ?? 2 } }, volume: { h24: o.vol ?? 500 }, marketCap: o.mcap, fdv: o.fdv });
    const { CHAINS } = require("../scripts/fetchPrices.cjs");
    const H = 3600;
    before(async () => {
      const sub = [...Object.values(T), btc, doge, baseEth, solRow];
      m = mock([
        [/coingecko/, () => ({
          [T.single.pricingIdentifier]: { usd: 2.5, last_updated_at: NOW - H },          // fresh
          [T.split.pricingIdentifier]: { usd: 1, last_updated_at: NOW - H },             // fresh, but only split pools
          [T.idle.pricingIdentifier]: { usd: 1, last_updated_at: NOW - H },              // fresh, but the big pool is idle
          [T.noPool.pricingIdentifier]: { usd: 7, last_updated_at: NOW - H },            // fresh, no pool at all
          [T.staleWithPool.pricingIdentifier]: { usd: 0.97, last_updated_at: NOW - 3 * 86400 }, // stale + qualifying pool
          [T.staleOnly.pricingIdentifier]: { usd: 0.0005, last_updated_at: NOW - 3 * 86400 },   // stale, no pool
          [T.overCap.pricingIdentifier]: { usd: 1, last_updated_at: NOW - H },
          [T.gtOnly.pricingIdentifier]: { usd: 3, last_updated_at: NOW - 400 * 86400 },  // stale + GeckoTerminal-only pool
          [T.wrongChain.pricingIdentifier]: { usd: 1, last_updated_at: NOW - H },
          [T.dsDown.pricingIdentifier]: { usd: 1, last_updated_at: NOW - H },
          [T.noQuote.pricingIdentifier]: { usd: 4, last_updated_at: NOW - 2 * 86400 },  // stale + qualifying pool without a quote
          [btc.pricingIdentifier]: { usd: 60000, last_updated_at: NOW - H },             // native, fresh
          [doge.pricingIdentifier]: { usd: 0.1, last_updated_at: NOW - 30 * H },         // native, stale
          [baseEth.pricingIdentifier]: { usd: 2400, last_updated_at: NOW - FRESH_SECS }, // native, exactly 24h: fresh
          // quoteSide, sol: id not found -> pool price only
        })],
        [/dexscreener\.com\/token-pairs\/v1\/optimism\//, () => { throw new Error("ECONNRESET"); }],
        [/dexscreener\.com\/token-pairs/, (u) => {
          const a = lc(u.split("/").pop());
          if (a === lc(T.single.identifier)) return [pair(T.single, { liq: 50000 })];
          if (a === lc(T.split.identifier)) return [pair(T.split, { liq: 6000, pair: "0x" + "1".repeat(40) }), pair(T.split, { liq: 6000, pair: "0x" + "2".repeat(40) })];
          if (a === lc(T.idle.identifier)) return [pair(T.idle, { liq: 1e6, buys: 0, sells: 0, vol: 0 }), pair(T.idle, { liq: 4000, pair: "0x" + "3".repeat(40) })];
          if (a === lc(T.staleWithPool.identifier)) return [pair(T.staleWithPool, { liq: 5e6, price: "0.9998" }), pair(T.staleWithPool, { liq: 9000, price: "5", pair: "0x" + "4".repeat(40) })];
          if (a === lc(T.overCap.identifier)) return [pair(T.overCap, { liq: 1e6, mcap: 1000, fdv: 2000 })];
          if (a === lc(T.quoteSide.identifier)) return [{ ...pair(T.quoteSide, { liq: 20000, price: "8", native: "4" }), baseToken: { address: "0x" + "b".repeat(40) }, quoteToken: { address: T.quoteSide.identifier } }];
          if (a === lc(T.wrongChain.identifier)) return [{ ...pair(T.wrongChain, { liq: 1e7 }), chainId: "ethereum" }];
          if (a === lc(T.noQuote.identifier)) return [pair(T.noQuote, { liq: 30000, price: "0" })];
          return [];
        }],
        [/geckoterminal\.com\/api\/v2\/networks\/[^/]+\/tokens\/multi\//, (u) => {
          const list = u.split("/multi/")[1].split("?")[0].split(",");
          const data = [], included = [];
          for (const a of list) {
            if (lc(a) === lc(T.gtOnly.identifier)) {
              data.push({ attributes: { address: lc(a), market_cap_usd: "5000000" }, relationships: { top_pools: { data: [{ id: "arbitrum_0xpoolgt" }, { id: "arbitrum_0xpoolidle" }] } } });
              included.push({ id: "arbitrum_0xpoolgt", attributes: { address: "0xpoolgt", reserve_in_usd: "25000", base_token_price_usd: "3.21", quote_token_price_usd: "1", transactions: { h24: { buys: 1, sells: 0 } }, volume_usd: { h24: "10" } },
                relationships: { base_token: { data: { id: "arbitrum_" + lc(a) } } } });
              included.push({ id: "arbitrum_0xpoolidle", attributes: { address: "0xpoolidle", reserve_in_usd: "900000000", base_token_price_usd: "9", transactions: { h24: { buys: 0, sells: 0 } }, volume_usd: { h24: "0" } },
                relationships: { base_token: { data: { id: "arbitrum_" + lc(a) } } } });
            }
            if (a === solMint) {
              data.push({ attributes: { address: a }, relationships: { top_pools: { data: [{ id: "solana_P" }] } } });
              included.push({ id: "solana_P", attributes: { address: "P", reserve_in_usd: "90000000", base_token_price_usd: "150.5", transactions: { h24: { buys: 10, sells: 9 } }, volume_usd: { h24: "1" } },
                relationships: { base_token: { data: { id: "solana_" + a } } } });
            }
          }
          return { data, included };
        }],
        [/geckoterminal\.com\/api\/v2\/networks\/[^/]+\/tokens\/[^/]+\/pools/, () => ({ data: [] })],
      ]);
      const res = await fetchPrices({ rows: sub, get: m.get, now: () => NOW, pause: { ...NOPAUSE, retry: 0 } });
      by = new Map(res.map((r) => [r.environmentId + "|" + r.row, r]));
    });
    const R = (t) => by.get(t.environmentId + "|" + t.row);

    it("a single traded pool >= $10,000 passes; a fresh CoinGecko price is then used", () => {
      expect(R(T.single)).to.include({ usd: "2.5", source: "CoinGecko", reason: null });
      expect(R(T.single).qualifyingPool).to.include({ source: "DexScreener", liquidityUsd: 50000, tx24h: 5 });
    });
    it("two traded pools each under $10,000 that sum to $12,000 fail (no summing)", () => {
      expect(R(T.split)).to.include({ usd: null, source: null, reason: "no_single_traded_pool_10k", sumTradedPoolsUsd: 12000 });
      expect(R(T.split).bestTradedPool.liquidityUsd).to.equal(6000);
      expect(R(T.split).detail).to.match(/only when summed/);
    });
    it("a $1,000,000 pool with zero 24h trades and zero volume fails; idle pools are ignored completely", () => {
      expect(R(T.idle)).to.include({ usd: null, reason: "no_single_traded_pool_10k" });
      expect(R(T.idle).bestTradedPool.liquidityUsd).to.equal(4000); // the idle pool is not even the "best"
      expect(R(T.gtOnly).bestTradedPool.liquidityUsd).to.equal(25000); // the idle $900M GeckoTerminal pool is ignored
    });
    it("a fresh CoinGecko price with no qualifying pool fails", () => {
      expect(R(T.noPool)).to.include({ usd: null, source: null, reason: "no_single_traded_pool_10k" });
      expect(R(T.noPool).bestTradedPool).to.equal(null);
      expect(R(T.wrongChain)).to.include({ usd: null, reason: "no_single_traded_pool_10k" }); // other-chain pair ignored
    });
    it("a pool reporting more than 2x market cap is dropped", () => {
      expect(R(T.overCap)).to.include({ usd: null, reason: "no_single_traded_pool_10k", poolsDroppedOverCap: 1, marketCapUsd: 2000 });
    });
    it("stale CoinGecko + qualifying pool uses that pool's own quote (largest qualifying DexScreener pool)", () => {
      expect(R(T.staleWithPool)).to.include({ usd: "0.9998", source: "DexScreener", reason: null, liquidityUsd: 5000000 });
      expect(R(T.staleWithPool).detail).to.match(/coingecko: stale \(72\.0h old, not used\)/);
      expect(R(T.gtOnly)).to.include({ usd: "3.21", source: "GeckoTerminal", reason: null });
      expect(R(T.quoteSide)).to.include({ usd: "2", source: "DexScreener" }); // quote side: priceUsd / priceNative
      expect(by.get("Solana|5")).to.include({ usd: "150.5", source: "GeckoTerminal" });
    });
    it("stale CoinGecko only fails: there is no stale last resort", () => {
      expect(R(T.staleOnly)).to.include({ usd: null, source: null, reason: "no_single_traded_pool_10k" });
      expect(R(T.staleOnly).detail).to.match(/stale/);
      for (const r of by.values()) expect(r.source).to.not.equal("CoinGecko (stale)");
    });
    it("a qualifying pool with no quote and no fresh CoinGecko price fails", () => {
      expect(R(T.noQuote)).to.include({ usd: null, reason: "no_fresh_price" });
      expect(R(T.noQuote).qualifyingPool.liquidityUsd).to.equal(30000);
    });
    it("an API that stays down after the retries fails closed", () => {
      expect(R(T.dsDown)).to.include({ usd: null, source: null, reason: "fetch_error" });
      expect(m.urls.filter((u) => u.includes("token-pairs/v1/optimism/")).length).to.equal(5); // 5 tries
    });
    it("natives: a fresh CoinGecko price passes with no pool; a stale one fails; no pool is looked up for a native", () => {
      expect(R(btc)).to.include({ usd: "60000", source: "CoinGecko", reason: null, kind: "native" });
      expect(R(baseEth)).to.include({ usd: "2400", source: "CoinGecko", kind: "native" });
      expect(R(doge)).to.include({ usd: null, source: null, reason: "no_fresh_coingecko", kind: "native" });
      expect(m.urls.some((u) => /c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2/i.test(u))).to.equal(false); // no WETH pool for ETH
      expect(rowAddress(btc)).to.equal(null);
      expect(rowAddress(baseEth)).to.equal(null);
    });
    it("only the row's own chain and address are requested; never a symbol search", () => {
      for (const u of m.urls) expect(u).to.match(/^https:\/\/(api\.coingecko\.com\/api\/v3\/simple\/price\?ids=|api\.dexscreener\.com\/token-pairs\/v1\/[a-z]+\/[0-9A-Za-z]+$|api\.geckoterminal\.com\/api\/v2\/networks\/[a-z_]+\/tokens\/(multi\/[0-9A-Za-z,]+\?include=top_pools|[0-9A-Za-z]+\/pools\?page=1)$)/);
      expect(m.urls.some((u) => /search/.test(u))).to.equal(false);
      expect(m.urls.some((u) => u === "https://api.dexscreener.com/token-pairs/v1/polygon/" + T.staleWithPool.identifier)).to.equal(true);
      expect(MIN_LIQUIDITY_USD).to.equal(10000);
      expect(FRESH_SECS).to.equal(86400);
    });
  });

  describe("on the test chain (ceremony: Revision B, 487 rows, poster = live poster)", function () {
    let v;
    before(async () => {
      const [signer] = await ethers.getSigners();
      const L = new ethers.ContractFactory(art.CommitmentVaultLock.abi, art.CommitmentVaultLock.bytecode, signer);
      const newLocks = {};
      for (const env of EVM_ENVS) newLocks[env] = await (await L.deploy(env, data.evmDevFunds[env])).getAddress();
      v = (await runBaseCeremony({ ethers, signer, art, data, newLocks })).verifier;
    });

    it("the real-fetch fixture feeds priceRun and posts: Revision B rows usable at the exact price; rows not in Revision B skipped and unusable", async () => {
      expect(SAMPLE.length).to.be.gte(8);
      const inRevB = new Set(rows.map((x) => x.environmentId + "|" + x.canonicalAssetId.toLowerCase()));
      const isIn = (f) => inRevB.has(f.environmentId + "|" + f.canonicalAssetId.toLowerCase());
      const r = buildPriceRun(SAMPLE, await nextRunId(v));
      // Fixture rows dropped by Revision B (Solana SOL, sUSD, ggAVAX, TigerOG, SWEAT, GT, IPOR) are skipped, never posted.
      expect(r.skipped.map((x) => x.symbol).sort()).to.deep.equal(SAMPLE.filter((f) => !isIn(f)).map((f) => f.symbol).sort());
      expect(r.skipped.length).to.equal(7);
      for (const x of r.skipped) expect(x.why).to.equal("not in registry");
      expect(r.updates.length).to.equal(SAMPLE.filter(isIn).length);
      await postOnTestChain(hre, v, r);
      for (const f of SAMPLE) {
        const sp = await v.scheduledPrices(key(f.environmentId, f.canonicalAssetId));
        expect(sp.usable, f.symbol).to.equal(isIn(f) && f.usd != null);
        if (isIn(f) && f.usd != null) expect(sp.priceUsd18).to.equal(r.updates.find((u) => u.canonicalAssetId === f.canonicalAssetId && u.environmentId === f.environmentId).priceUsd18);
      }
    });

    it("a full 487-row Revision B fetch (mocked HTTP) builds consecutive runs of <= 140 lines, each under the 2^24 gas cap, that the Verifier accepts", async () => {
      const failIds = new Set(rows.filter((r, i) => i % 7 === 0).map((r) => r.pricingIdentifier));
      const m = mock([
        [/coingecko/, (u) => Object.fromEntries(cgIds(u).filter((id) => !failIds.has(id)).map((id, j) => [id, { usd: (j + 1) / 8, last_updated_at: NOW }]))],
        // Every token has one traded $50,000 pool on its own chain.
        [/dexscreener/, (u) => { const p = u.split("/"); return [{ chainId: p[p.length - 2], pairAddress: "0x" + "c".repeat(40), baseToken: { address: p[p.length - 1] }, quoteToken: { address: "0x" + "e".repeat(40) },
          priceUsd: "0.5", priceNative: "1", liquidity: { usd: 50000 }, txns: { h24: { buys: 1, sells: 1 } }, volume: { h24: 10 } }]; }],
        [/geckoterminal/, () => ({ data: [], included: [] })],
      ]);
      const res = await fetchPrices({ rows, get: m.get, now: () => NOW, pause: NOPAUSE });
      expect(res.length).to.equal(487);
      const c = summarize(res);
      const failNatives = rows.filter((r) => r.kind === "native" && failIds.has(r.pricingIdentifier)).length;
      const dsTokens = rows.filter((r) => r.kind === "token" && failIds.has(r.pricingIdentifier)).length;
      expect(c.CoinGecko + c.DexScreener + c.fail).to.equal(487);
      expect(c.fail).to.equal(failNatives);          // a native with no fresh CoinGecko price fails
      expect(c.DexScreener).to.equal(dsTokens);      // a token with no CoinGecko price uses its qualifying pool
      expect(c.DexScreener).to.be.gt(0);
      for (const f of res.filter((x) => x.usd == null)) expect(f.reason).to.equal("no_fresh_coingecko");
      const first = await nextRunId(v);
      const runs = buildPriceRuns(res, first);
      expect(runs.length).to.equal(Math.ceil(487 / MAX_LINES_PER_RUN));
      expect(runs.reduce((n, r) => n + r.updates.length, 0)).to.equal(487);
      expect(runs.map((r) => r.runId)).to.deep.equal(runs.map((_, i) => first + BigInt(i)));
      for (const r of runs) {
        const rc = await postOnTestChain(hre, v, r);
        expect(rc.gasUsed).to.be.lt(2n ** 24n);
        console.log(`      run ${r.runId}: ${r.updates.length} lines, gasUsed ${rc.gasUsed}`);
      }
      expect(await v.lastScheduledRunId()).to.equal(first + BigInt(runs.length - 1));
      for (const [i, f] of res.entries()) {
        if (i % 37 && f.usd != null) continue; // spot-check every 37th plus every failure
        expect((await v.scheduledPrices(key(f.environmentId, f.canonicalAssetId))).usable, f.symbol).to.equal(f.usd != null);
      }
    });
  });
});
