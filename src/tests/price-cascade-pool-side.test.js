// t431u: DexScreener pricing must always give the price of the token being
// priced. When the token is the quote (second) token of a pair, its price is
// priceUsd / priceNative; the base token's priceUsd is never assigned to it.
import test from "node:test";
import assert from "node:assert/strict";
import { tokenUsdFromPair, bestDsPrice, dsByContract } from "../../base44/shared/vfPriceCascade.ts";

const TOKEN = "0x1111111111111111111111111111111111111111";
const WETH = "0x4200000000000000000000000000000000000006";
const OTHER = "0x2222222222222222222222222222222222222222";

// WETH/TOKEN pool: WETH is base at $3,000; 1 WETH = 60,000 TOKEN, so TOKEN = $0.05.
const quoteSide = { chainId: "base", pairAddress: "0xq", baseToken: { address: WETH }, quoteToken: { address: TOKEN.toUpperCase().replace("0X", "0x") }, priceUsd: "3000", priceNative: "60000", liquidity: { usd: 500000 } };
const baseSide = { chainId: "base", pairAddress: "0xb", baseToken: { address: TOKEN }, quoteToken: { address: WETH }, priceUsd: "0.051", priceNative: "0.000017", liquidity: { usd: 1000 } };
const unrelated = { chainId: "base", pairAddress: "0xu", baseToken: { address: OTHER }, quoteToken: { address: WETH }, priceUsd: "9", priceNative: "0.003", liquidity: { usd: 9e9 } };

test("token as base token: priceUsd is its price", () => {
  assert.deepEqual(tokenUsdFromPair(baseSide, TOKEN), { usd: 0.051, side: "base" });
});

test("token as quote (second) token: priceUsd / priceNative, never the base token's price", () => {
  const r = tokenUsdFromPair(quoteSide, TOKEN);
  assert.equal(r.side, "quote");
  assert.ok(Math.abs(r.usd - 0.05) < 1e-12);
  assert.notEqual(r.usd, 3000);
});

test("token as quote token without priceNative: pool skipped", () => {
  assert.equal(tokenUsdFromPair({ ...quoteSide, priceNative: undefined }, TOKEN), null);
  assert.equal(tokenUsdFromPair({ ...quoteSide, priceNative: "0" }, TOKEN), null);
});

test("pair that does not hold the token is skipped", () => {
  assert.equal(tokenUsdFromPair(unrelated, TOKEN), null);
});

test("best pool: most liquid usable pool, quote side derived correctly", () => {
  const r = bestDsPrice([unrelated, baseSide, quoteSide], "base", TOKEN);
  assert.equal(r.pairSide, "quote");
  assert.equal(r.pair, "0xq");
  assert.ok(Math.abs(r.usd - 0.05) < 1e-12);
});

test("quote-side pool unusable: falls back to another pool where the token is base", () => {
  const r = bestDsPrice([{ ...quoteSide, priceNative: null }, baseSide], "base", TOKEN);
  assert.equal(r.usd, 0.051);
  assert.equal(r.pairSide, "base");
});

test("other chains are ignored; no usable pool gives null", () => {
  assert.equal(bestDsPrice([{ ...baseSide, chainId: "ethereum" }, unrelated], "base", TOKEN), null);
});

const withFetch = async (fn, body) => {
  const orig = globalThis.fetch;
  globalThis.fetch = async (url) => ({ status: 200, json: async () => fn(String(url)) });
  try { await body(); } finally { globalThis.fetch = orig; }
};

test("dsByContract: chain-scoped endpoint, quote-side pool derived correctly", async () => {
  await withFetch((u) => (u.includes("/token-pairs/v1/base/") ? [quoteSide, unrelated] : null), async () => {
    const r = await dsByContract("Base", TOKEN);
    assert.equal(r.source, "DexScreener");
    assert.ok(Math.abs(r.usd - 0.05) < 1e-12);
  });
});

test("dsByContract: falls back to the all-chain endpoint when the scoped one is empty", async () => {
  await withFetch((u) => (u.includes("/token-pairs/v1/") ? [] : { pairs: [quoteSide, unrelated] }), async () => {
    const r = await dsByContract("Base", TOKEN);
    assert.ok(Math.abs(r.usd - 0.05) < 1e-12);
  });
});
