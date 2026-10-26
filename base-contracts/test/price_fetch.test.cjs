// Price fetcher (scripts/fetchPrices.cjs) -> price run (scripts/priceRun.cjs)
// -> Verifier on the in-process test chain, posted as the live poster by
// impersonation (no key). HTTP is mocked here; nothing is fetched or posted live.
// The fixture test/fixtures/price_fetch_sample.json is a slice of one real
// read-only fetch (t209u item 2).
// Base-only launch: the ceremony registers only the 129 Base rows of registry
// Revision D, so the fetcher and price run default to those rows. The
// fetcher's chain logic is still exercised offline on all 589 Revision D rows
// (baseOnly: false).
// Operator t430u item 1 (2026-10-26): the $10,000 pool minimum and its
// screening are removed. The rule tested here is the scheduled cascade of
// Master Specification Section 7.1: CoinGecko by pricingIdentifier, then
// DexScreener by the row's own contract on its own chain, then no price.
const { expect } = require("chai");
const hre = require("hardhat");
const { ethers } = hre;
const { fetchPrices, registryRows, rowAddress, summarize, CHAINS } = require("../scripts/fetchPrices.cjs");
const { buildPriceRun, buildPriceRuns, nextRunId, postOnTestChain, MAX_LINES_PER_RUN } = require("../scripts/priceRun.cjs");
const { FOUNDER_OVERRIDE } = require("../scripts/founderOverride.cjs");
const art = require("../scripts/deploy-pages/ceremony.json");
const data = require("../scripts/deploy-pages/ceremony-data.json");
const { runBaseCeremony } = require("../scripts/deploy-pages/baseCeremonyFlow.js");
const SAMPLE = require("./fixtures/price_fetch_sample.json");

const key = (env, id) => ethers.solidityPackedKeccak256(["string", "bytes32"], [env, id]);
const NOW = 1_800_000_000;
const NOPAUSE = { cg: 0, ds: 0, retry: 0 };

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

describe("Price fetcher -> price run (test chain)", function () {
  this.timeout(900000);
  const rows = registryRows(undefined, { baseOnly: false });
  const baseRows = registryRows();
  const lc = (a) => String(a).toLowerCase();
  const ogAddrs = new Set(FOUNDER_OVERRIDE.map((o) => lc(o.address)));
  const ogRows = baseRows.filter((r) => ogAddrs.has(lc(r.identifier)));
  // Distinct token rows (each with its own CoinGecko id) on their own chains.
  const toks = [];
  for (const r of rows) if (r.kind === "token" && r.pricingIdentifier && /^0x[0-9a-fA-F]{40}$/.test(r.identifier) && !toks.some((t) => t.pricingIdentifier === r.pricingIdentifier)) toks.push(r);
  const pickOn = (env, n) => toks.filter((r) => r.environmentId === env)[n];
  const T = { cgOnly: pickOn("Ethereum", 0), cgStale: pickOn("Ethereum", 1), tiny: pickOn("Ethereum", 2), split: pickOn("Ethereum", 3),
    idle: pickOn("Polygon", 0), overCap: pickOn("Ethereum", 4), quoteSide: pickOn("BNB Smart Chain", 0), wrongChain: pickOn("Avalanche", 0),
    dsDown: pickOn("Optimism", 0), noQuote: pickOn("Ethereum", 5), noPool: pickOn("Arbitrum", 0), baseTok: pickOn("Base", 1) };
  const btc = rows.find((r) => r.row === 3);
  const doge = rows.find((r) => r.row === 4);
  const baseEth = rows.find((r) => r.environmentId === "Base" && r.row === 2);
  const tel = baseRows.find((r) => r.row === 1082);
  const noId = baseRows.find((r) => r.kind === "token" && !r.pricingIdentifier && !ogAddrs.has(lc(r.identifier)));

  it("reads the 589 Revision D rows; the default is the 129 Base rows the ceremony registers", () => {
    expect(rows.length).to.equal(589);
    expect(baseRows.length).to.equal(129);
    expect(baseRows.every((r) => r.environmentId === "Base")).to.equal(true);
    expect(baseRows.filter((r) => r.row === 2).length).to.equal(1);
    expect(baseRows.map((r) => r.environmentId + "|" + lc(r.canonicalAssetId)).sort())
      .to.deep.equal(data.entries.map((e) => e.environmentId + "|" + lc(e.canonicalAssetId)).sort());
    expect(rows.filter((r) => r.environmentId === "Solana").length).to.equal(0);
    expect(rows.filter((r) => r.kind === "native").length).to.equal(12);
    expect(ogRows.map((r) => r.symbol).sort()).to.deep.equal(["TigerOG"]); // t431u: LionOG and FrogOG removed
    for (const r of ogRows) expect(r.pricingIdentifier, r.symbol).to.not.be.ok; // no price source is invented
    expect(lc(tel.identifier)).to.equal(lc("0x7E13B43065380aCdeC1c2d138c579cbBbafA0731"));
    expect(tel.pricingIdentifier).to.equal("telcoin");
    expect(baseRows.some((r) => lc(r.identifier) === lc("0x09bE1692ca16e06f536F0038fF11D1dA8524aDB1"))).to.equal(false);
    for (const t of Object.values(T)) expect(t, "test row").to.not.equal(undefined);
    expect(noId, "a Base token row with no pricingIdentifier").to.not.equal(undefined);
  });

  describe("scheduled cascade (Section 7.1; t430u item 1): no pool minimum, no freshness test, no screening", function () {
    let by, m;
    const pair = (t, o = {}) => ({ chainId: CHAINS[t.environmentId].ds, pairAddress: o.pair || "0x" + "a".repeat(40), baseToken: { address: o.addr || t.identifier }, quoteToken: { address: "0x" + "e".repeat(40) },
      priceUsd: o.price || "1.5", priceNative: o.native || "0.0005", liquidity: o.liq == null ? undefined : { usd: o.liq }, txns: { h24: { buys: o.buys ?? 3, sells: o.sells ?? 2 } }, volume: { h24: o.vol ?? 500 }, marketCap: o.mcap, fdv: o.fdv });
    const H = 3600;
    before(async () => {
      const sub = [...Object.values(T), btc, doge, baseEth, tel, noId, ...ogRows];
      m = mock([
        [/coingecko/, () => ({
          [T.cgOnly.pricingIdentifier]: { usd: 2.5, last_updated_at: NOW - H },
          [T.cgStale.pricingIdentifier]: { usd: 0.97, last_updated_at: NOW - 400 * 86400 }, // old, still the first valid price
          [T.overCap.pricingIdentifier]: { usd: 0 },                                        // zero is not a price
          [T.wrongChain.pricingIdentifier]: { usd: null },
          [btc.pricingIdentifier]: { usd: 60000, last_updated_at: NOW - H },
          [doge.pricingIdentifier]: { usd: 0.1, last_updated_at: NOW - 30 * 86400 },       // native, old: still used
          // baseEth, tel and the rest: id not found -> step 2 for tokens, no price for natives
        })],
        [/dexscreener\.com\/token-pairs\/v1\/optimism\//, () => { throw new Error("ECONNRESET"); }],
        [/dexscreener\.com\/token-pairs/, (u) => {
          const a = lc(u.split("/").pop());
          if (a === lc(T.cgOnly.identifier)) return [pair(T.cgOnly, { liq: 50000, price: "999" })]; // never requested (VF-ORC-002)
          if (a === lc(T.tiny.identifier)) return [pair(T.tiny, { liq: 50, price: "0.0123" })];
          if (a === lc(T.split.identifier)) return [pair(T.split, { liq: 5000, price: "2", pair: "0x" + "1".repeat(40) }), pair(T.split, { liq: 6000, price: "3", pair: "0x" + "2".repeat(40) })];
          if (a === lc(T.idle.identifier)) return [pair(T.idle, { liq: 1e6, price: "7", buys: 0, sells: 0, vol: 0 }), pair(T.idle, { liq: 4000, price: "8", pair: "0x" + "3".repeat(40) })];
          if (a === lc(T.overCap.identifier)) return [pair(T.overCap, { liq: 1e6, price: "4", mcap: 1000, fdv: 2000 })];
          if (a === lc(T.quoteSide.identifier)) return [{ ...pair(T.quoteSide, { liq: 20000, price: "8", native: "4" }), baseToken: { address: "0x" + "b".repeat(40) }, quoteToken: { address: T.quoteSide.identifier } }];
          if (a === lc(T.wrongChain.identifier)) return [{ ...pair(T.wrongChain, { liq: 1e7 }), chainId: "ethereum" }];
          if (a === lc(T.noQuote.identifier)) return [pair(T.noQuote, { liq: 30000, price: "0" })];
          if (a === lc(T.baseTok.identifier)) return [pair(T.baseTok, { price: "0.5" })]; // no liquidity field
          if (a === lc(tel.identifier)) return [pair(tel, { liq: 66165, price: "0.001398" }), pair(tel, { liq: 43801, price: "0.00139", pair: "0x" + "4".repeat(40) })];
          if (a === lc(noId.identifier)) return [pair(noId, { liq: 1200, price: "42" })];
          return [];
        }],
      ]);
      const res = await fetchPrices({ rows: sub, get: m.get, pause: NOPAUSE });
      by = new Map(res.map((r) => [r.environmentId + "|" + r.row, r]));
    });
    const R = (t) => by.get(t.environmentId + "|" + t.row);

    it("step 1: a CoinGecko price is used and later sources are not consulted (VF-ORC-002)", () => {
      expect(R(T.cgOnly)).to.include({ usd: "2.5", source: "CoinGecko", reason: null });
      expect(m.urls.some((u) => lc(u).endsWith(lc(T.cgOnly.identifier)))).to.equal(false);
    });
    it("no freshness test: an old CoinGecko price is still the first valid price", () => {
      expect(R(T.cgStale)).to.include({ usd: "0.97", source: "CoinGecko", reason: null });
      expect(R(doge)).to.include({ usd: "0.1", source: "CoinGecko", kind: "native" });
    });
    it("no pool minimum: a $50 pool gives the price when CoinGecko has none", () => {
      expect(R(T.tiny)).to.include({ usd: "0.0123", source: "DexScreener", reason: null, liquidityUsd: 50 });
      expect(R(T.baseTok)).to.include({ usd: "0.5", source: "DexScreener", liquidityUsd: 0 });
      expect(R(noId)).to.include({ usd: "42", source: "DexScreener" }); // no pricingIdentifier -> step 2 directly
    });
    it("the own-chain pair with the most liquidity gives the price; pools are never summed", () => {
      expect(R(T.split)).to.include({ usd: "3", source: "DexScreener", liquidityUsd: 6000, pairsSeen: 2 });
    });
    it("no trade-activity filter and no market-cap drop", () => {
      expect(R(T.idle)).to.include({ usd: "7", source: "DexScreener", liquidityUsd: 1000000 });
      expect(R(T.overCap)).to.include({ usd: "4", source: "DexScreener", liquidityUsd: 1000000 }); // CoinGecko usd 0 is not a price
    });
    it("token as quote side: priceUsd / priceNative", () => {
      expect(R(T.quoteSide)).to.include({ usd: "2", source: "DexScreener", pairSide: "quote" });
    });
    it("TEL (row 1082) is priced from the upgraded contract only", () => {
      expect(R(tel)).to.include({ usd: "0.001398", source: "DexScreener", liquidityUsd: 66165 });
      expect(m.urls.some((u) => lc(u).includes(lc("0x09bE1692ca16e06f536F0038fF11D1dA8524aDB1")))).to.equal(false);
    });
    it("fails closed: other-chain pair, a pair with no price, no pair at all", () => {
      expect(R(T.wrongChain)).to.include({ usd: null, source: null, reason: "no_price" });
      expect(R(T.noQuote)).to.include({ usd: null, reason: "no_price" });
      expect(R(T.noPool)).to.include({ usd: null, reason: "no_price" });
    });
    it("founder override rows get no invented price: no source -> no price", () => {
      for (const r of ogRows) expect(R(r), r.symbol).to.include({ usd: null, source: null, reason: "no_price" });
    });
    it("an API that stays down after the retries fails closed", () => {
      expect(R(T.dsDown)).to.include({ usd: null, source: null, reason: "fetch_error" });
      expect(m.urls.filter((u) => u.includes("token-pairs/v1/optimism/")).length).to.equal(5); // 5 tries
    });
    it("natives: CoinGecko only; no pool is looked up for a native", () => {
      expect(R(btc)).to.include({ usd: "60000", source: "CoinGecko", reason: null, kind: "native" });
      expect(R(baseEth)).to.include({ usd: null, source: null, reason: "no_price", kind: "native" });
      expect(rowAddress(btc)).to.equal(null);
      expect(rowAddress(baseEth)).to.equal(null);
    });
    it("only CoinGecko by id and DexScreener by the row's own chain and address are requested; never a symbol search", () => {
      for (const u of m.urls) expect(u).to.match(/^https:\/\/(api\.coingecko\.com\/api\/v3\/simple\/price\?ids=|api\.dexscreener\.com\/token-pairs\/v1\/[a-z]+\/[0-9A-Za-z]+$)/);
      expect(m.urls.some((u) => /search|geckoterminal/.test(u))).to.equal(false);
      expect(m.urls.some((u) => u === "https://api.dexscreener.com/token-pairs/v1/polygon/" + T.idle.identifier)).to.equal(true);
    });
  });

  describe("on the test chain (Base-only ceremony: 129 Base rows, poster = live poster)", function () {
    let v;
    before(async () => {
      const [signer] = await ethers.getSigners();
      v = (await runBaseCeremony({ ethers, signer, art, data })).verifier;
    });

    it("the real-fetch fixture feeds priceRun and posts: registered Base rows usable at the exact price; every other row skipped and unusable", async () => {
      expect(SAMPLE.length).to.be.gte(8);
      const inAllRevD = new Set(rows.map((x) => x.environmentId + "|" + x.canonicalAssetId.toLowerCase()));
      expect(SAMPLE.filter((f) => !inAllRevD.has(f.environmentId + "|" + f.canonicalAssetId.toLowerCase())).length).to.equal(6);
      const inRevB = new Set(baseRows.map((x) => x.environmentId + "|" + x.canonicalAssetId.toLowerCase()));
      const isIn = (f) => inRevB.has(f.environmentId + "|" + f.canonicalAssetId.toLowerCase());
      const r = buildPriceRun(SAMPLE, await nextRunId(v));
      // Fixture rows not in Revision D (Solana SOL, sUSD, ggAVAX, SWEAT, GT, IPOR)
      // and every non-Base row (not registered on the Base-only launch) are skipped, never posted.
      expect(r.skipped.map((x) => x.symbol).sort()).to.deep.equal(SAMPLE.filter((f) => !isIn(f)).map((f) => f.symbol).sort());
      expect(r.updates.length).to.be.gte(1);
      for (const x of r.skipped) expect(x.why).to.equal("not in registry");
      expect(r.updates.length).to.equal(SAMPLE.filter(isIn).length);
      await postOnTestChain(hre, v, r);
      for (const f of SAMPLE) {
        const sp = await v.scheduledPrices(key(f.environmentId, f.canonicalAssetId));
        expect(sp.usable, f.symbol).to.equal(isIn(f) && f.usd != null);
        if (isIn(f) && f.usd != null) expect(sp.priceUsd18).to.equal(r.updates.find((u) => u.canonicalAssetId === f.canonicalAssetId && u.environmentId === f.environmentId).priceUsd18);
      }
    });

    it("a full Base-row fetch (mocked HTTP, 129 rows) builds runs of <= 140 lines, each under the 2^24 gas cap, that the Verifier accepts", async () => {
      const failIds = new Set(baseRows.filter((r, i) => i % 7 === 0 && r.pricingIdentifier).map((r) => r.pricingIdentifier));
      const m = mock([
        [/coingecko/, (u) => Object.fromEntries(cgIds(u).filter((id) => !failIds.has(id)).map((id, j) => [id, { usd: (j + 1) / 8, last_updated_at: NOW }]))],
        // Every token has one small pool on its own chain, except the founder
        // override row, which is given none here to show it then fails
        // closed. (On 2026-10-26 TigerOG's one Base pool was listed on
        // GeckoTerminal, not DexScreener, so a live run does not price it.)
        [/dexscreener/, (u) => { const p = u.split("/"); if (ogAddrs.has(lc(p[p.length - 1]))) return [];
          return [{ chainId: p[p.length - 2], pairAddress: "0x" + "c".repeat(40), baseToken: { address: p[p.length - 1] }, quoteToken: { address: "0x" + "e".repeat(40) },
          priceUsd: "0.5", priceNative: "1", liquidity: { usd: 900 } }]; }],
      ]);
      const res = await fetchPrices({ rows: baseRows, get: m.get, pause: NOPAUSE });
      expect(res.length).to.equal(129);
      const c = summarize(res);
      const failNatives = baseRows.filter((r) => r.kind === "native" && failIds.has(r.pricingIdentifier)).length;
      const dsTokens = baseRows.filter((r) => r.kind === "token" && !ogAddrs.has(lc(r.identifier)) && (!r.pricingIdentifier || failIds.has(r.pricingIdentifier))).length;
      expect(c.CoinGecko + c.DexScreener + c.fail).to.equal(129);
      expect(c.fail).to.equal(failNatives + 1);      // natives with no CoinGecko price, and the founder override row
      expect(c.DexScreener).to.equal(dsTokens);      // a token with no CoinGecko price uses its own-chain pool, whatever its size
      expect(c.DexScreener).to.be.gt(0);
      for (const f of res.filter((x) => x.usd == null)) expect(f.reason).to.equal("no_price");
      const first = await nextRunId(v);
      const runs = buildPriceRuns(res, first);
      expect(runs.length).to.equal(Math.ceil(129 / MAX_LINES_PER_RUN));
      expect(runs.reduce((n, r) => n + r.updates.length, 0)).to.equal(129);
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
