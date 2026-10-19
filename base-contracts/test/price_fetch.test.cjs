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
  const aero = rows.find((r) => r.environmentId === "Base" && r.symbol === "AERO");
  const toshi = rows.find((r) => r.environmentId === "Base" && r.symbol === "TOSHI");
  const usdcPol = rows.find((r) => r.environmentId === "Polygon" && r.symbol === "USDC_POL");
  const btc = rows.find((r) => r.row === 3);
  const sol = rows.find((r) => r.row === 5);
  const usdt = rows.find((r) => r.row === 6);
  const thin = rows.find((r) => r.environmentId === "Base" && /^0x[0-9a-fA-F]{40}$/.test(r.identifier) && ![aero, toshi].includes(r) && r.pricingIdentifier !== aero.pricingIdentifier && r.pricingIdentifier !== toshi.pricingIdentifier);

  it("reads the 962 registered rows: the 961 written rows plus Base ETH", () => {
    expect(rows.length).to.equal(962);
    expect(rows.filter((r) => r.environmentId === "Base" && r.row === 2).length).to.equal(1);
    expect(rows.every((r) => r.pricingIdentifier)).to.equal(true);
  });

  it("fresh CoinGecko first; else DexScreener then GeckoTerminal (row's own chain + address, min liquidity); else stale CoinGecko as last resort; no symbol search; no substitute", async () => {
    const sub = [aero, toshi, usdcPol, btc, sol, usdt, thin];
    const m = mock([
      [/coingecko/, (u) => ({
        [aero.pricingIdentifier]: { usd: 0.79, last_updated_at: NOW - FRESH_SECS },       // fresh (24h) -> CoinGecko
        [toshi.pricingIdentifier]: { usd: 0.0005, last_updated_at: NOW - 3 * 86400 },    // stale + DEX under $10k -> stale CoinGecko
        [usdcPol.pricingIdentifier]: { usd: 0.97, last_updated_at: NOW - 400 * 86400 },  // stale + DEX >= $10k -> DEX wins
        [btc.pricingIdentifier]: { usd: 60000, last_updated_at: NOW - 5 * 365 * 86400 }, // stale, no DEX possible -> stale CoinGecko
        [usdt.pricingIdentifier]: { usd: 1.0002 },                                       // undated + DEX under $10k -> stale CoinGecko
        // sol, thin: id not found -> DEX only
      })],
      [/dexscreener/, (u) => addrs(u).flatMap((a) => {
        if (a.toLowerCase() === toshi.identifier.toLowerCase()) return [
          { chainId: "base", baseToken: { address: a }, priceUsd: "0.0004", liquidity: { usd: MIN_LIQUIDITY_USD - 1 } }, // below min
          { chainId: "ethereum", baseToken: { address: a }, priceUsd: "9", liquidity: { usd: 1e9 } },              // wrong chain: ignored
          { chainId: "base", baseToken: { address: "0x" + "1".repeat(40) }, quoteToken: { address: a }, priceUsd: "7", liquidity: { usd: 1e9 } }, // quote side: ignored
        ];
        if (a.toLowerCase() === usdcPol.identifier.toLowerCase()) return [
          { chainId: "polygon", baseToken: { address: a }, priceUsd: "0.9998", liquidity: { usd: 5e6 } },
        ];
        return []; // wrapped SOL: no pair
      })],
      [/geckoterminal/, (u) => ({ data: { attributes: {
        token_prices: Object.fromEntries(addrs(u).map((a) => [a, a === sol.identifier.match(/\((\w+) wrapped/)[1] ? "150.5" : "0.00041"])),
        total_reserve_in_usd: Object.fromEntries(addrs(u).map((a) => [a, a.startsWith("0x") ? String(MIN_LIQUIDITY_USD - 1) : "90000000"])),
      } } })],
    ]);
    const res = await fetchPrices({ rows: sub, get: m.get, now: () => NOW, pause: NOPAUSE });
    const by = Object.fromEntries(res.map((r) => [r.symbol, r]));
    expect(by.AERO).to.include({ usd: "0.79", source: "CoinGecko", reason: null, cgLastUpdatedAt: NOW - FRESH_SECS });
    expect(by.USDC_POL).to.include({ usd: "0.9998", source: "DexScreener", reason: null });         // fresh DEX beats stale CoinGecko
    expect(by.USDC_POL.detail).to.match(/coingecko: stale \(400d old\)/);
    expect(by.TOSHI).to.include({ usd: "0.0005", source: "CoinGecko (stale)", reason: null, cgLastUpdatedAt: NOW - 3 * 86400 });
    expect(by.TOSHI.detail).to.match(/dexscreener: below min liquidity/);                           // the thin pool was not used
    expect(by.USDT).to.include({ usd: "1.0002", source: "CoinGecko (stale)", reason: null, cgLastUpdatedAt: null });
    expect(by.USDT.detail).to.match(/coingecko: no last_updated_at.*geckoterminal: below min liquidity/);
    expect(by.BTC).to.include({ usd: "60000", source: "CoinGecko (stale)", reason: null });
    expect(by.BTC.detail).to.match(/no contract address/);
    expect(by.SOL).to.include({ usd: "150.5", source: "GeckoTerminal", reason: null });
    expect(by[thin.symbol]).to.include({ usd: null, source: null, reason: "below_min_liquidity" });  // no CoinGecko, DEX under $10k -> fail
    // Only these endpoints; never a symbol search.
    for (const u of m.urls) expect(u).to.match(/^https:\/\/(api\.coingecko\.com\/api\/v3\/simple\/price\?ids=|api\.dexscreener\.com\/tokens\/v1\/|api\.geckoterminal\.com\/api\/v2\/simple\/networks\/)/);
    expect(m.urls.some((u) => /search/.test(u))).to.equal(false);
    // DEX lookups use the row's own chain and address.
    expect(m.urls.some((u) => u.includes("/tokens/v1/polygon/" + usdcPol.identifier))).to.equal(true);
    expect(rowAddress(btc)).to.equal(null);
  });

  describe("on the test chain (ceremony: 962 rows, poster = live poster)", function () {
    let v;
    before(async () => {
      const [signer] = await ethers.getSigners();
      const L = new ethers.ContractFactory(art.CommitmentVaultLock.abi, art.CommitmentVaultLock.bytecode, signer);
      const newLocks = {};
      for (const env of EVM_ENVS) newLocks[env] = await (await L.deploy(env, data.evmDevFunds[env])).getAddress();
      v = (await runBaseCeremony({ ethers, signer, art, data, newLocks })).verifier;
    });

    it("the real-fetch fixture feeds priceRun and posts: priced rows usable at the exact price, failed rows unusable", async () => {
      expect(SAMPLE.length).to.be.gte(8);
      const r = buildPriceRun(SAMPLE, await nextRunId(v));
      expect(r.skipped.length).to.equal(0);
      await postOnTestChain(hre, v, r);
      for (const f of SAMPLE) {
        const sp = await v.scheduledPrices(key(f.environmentId, f.canonicalAssetId));
        expect(sp.usable, f.symbol).to.equal(f.usd != null);
        if (f.usd != null) expect(sp.priceUsd18).to.equal(r.updates.find((u) => u.canonicalAssetId === f.canonicalAssetId && u.environmentId === f.environmentId).priceUsd18);
      }
    });

    it("a full 962-row fetch (mocked HTTP) builds consecutive runs of <= 250 lines, each under the 2^24 gas cap, that the Verifier accepts", async () => {
      const failIds = new Set(rows.filter((r, i) => i % 7 === 0).map((r) => r.pricingIdentifier));
      const m = mock([
        [/coingecko/, (u) => Object.fromEntries(cgIds(u).filter((id) => !failIds.has(id)).map((id, j) => [id, { usd: (j + 1) / 8, last_updated_at: NOW }]))],
        [/dexscreener/, () => []],
        [/geckoterminal/, () => ({ data: { attributes: { token_prices: {}, total_reserve_in_usd: {} } } })],
      ]);
      const res = await fetchPrices({ rows, get: m.get, now: () => NOW, pause: NOPAUSE });
      expect(res.length).to.equal(962);
      const c = summarize(res);
      expect(c.CoinGecko + c.fail).to.equal(962);
      expect(c.fail).to.be.gt(0);
      const first = await nextRunId(v);
      const runs = buildPriceRuns(res, first);
      expect(runs.length).to.equal(Math.ceil(962 / MAX_LINES_PER_RUN));
      expect(runs.reduce((n, r) => n + r.updates.length, 0)).to.equal(962);
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
