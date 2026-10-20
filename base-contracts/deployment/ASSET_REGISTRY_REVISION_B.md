# Asset registry, Revision B

`assetRegistry.revB.json` is the current asset registry (operator directive
t220u, 2026-10-19). The ceremony, the verifier registration, the token address
index, the price fetch and price runs, and the deploy pages all read it, through
`scripts/registryFile.cjs`.

It holds **487 entries: 475 tokens and 12 native coins.** Every entry is a row
of the prior revision (`assetRegistry.resolved.json`) and of the interim 822
set (`assetRegistry.active.json`), copied unchanged: same row number, label,
asset id, canonical asset id, decimals, custody class, custody path and
address. Nothing is relabelled and no row is added. Neither source file was
changed.

Built by `node scripts/buildRevisionB.cjs` from `revB_per_pool_filter.csv`
(the per-pool filter run on the 822 entries; data pulled 2026-10-19 between
5:48 PM and 6:12 PM ET).

## Rules

A token stays in only if all of these hold:

1. At least one single DEX pool for the row's own contract, on the row's own
   chain, holds $10,000 or more of liquidity.
2. That same pool had at least one trade in the last 24 hours. A pool that
   reports large liquidity but has not traded does not count.
3. A pool that reports more than 2x the token's market cap is ignored.
4. The price is fresh: updated in the last 24 hours, from CoinGecko,
   DexScreener or GeckoTerminal.
5. Liquidity added up across several pools does not count. One pool has to
   reach $10,000 on its own.
6. No substitute price is used. If a token does not pass, it is left out.

A native coin stays in if CoinGecko has a price for it updated in the last 24
hours. No wrapped pool is required (operator decision t219u). All 12 had a
CoinGecko price under one hour old when checked.

## Counts by chain

| Chain | Tokens | Native | Total |
|---|---|---|---|
| Ethereum | 264 | 1 (ETH, row 2) | 265 |
| BNB Smart Chain | 95 | 1 (BNB, row 18) | 96 |
| Avalanche | 28 | 1 (AVAX, row 23) | 29 |
| Polygon | 28 | 0 | 28 |
| Base | 26 | 1 (ETH, row 2 under Base) | 27 |
| Arbitrum | 22 | 0 | 22 |
| Optimism | 12 | 0 | 12 |
| Bitcoin | 0 | 1 (BTC, row 3) | 1 |
| Dogecoin | 0 | 1 (DOGE, row 4) | 1 |
| XRP Ledger | 0 | 1 (XRP, row 12) | 1 |
| Litecoin | 0 | 1 (LTC, row 19) | 1 |
| Bitcoin Cash | 0 | 1 (BCH, row 54) | 1 |
| DigiByte | 0 | 1 (DGB, row 100) | 1 |
| Zcash | 0 | 1 (ZEC, row 166) | 1 |
| Stellar | 0 | 1 (XLM, row 518) | 1 |
| **Total** | **475** | **12** | **487** |

Solana has no entries (no reader; it stays out of the active set).

## What was left out of the 822

335 tokens did not pass:

- 228 have no single pool with $10,000 or more.
- 89 have a pool listed at $10,000 or more that had no trade in the last 24
  hours (GeckoTerminal). This includes XOR, SYRUP and WLFI.
- 18 reach $10,000 only when their pools are added together.

The five tokens that already had no usable price (SWEAT, PROM, XOR, SYRUP,
WLFI) are among the 335. The full list, with each token's best pool and
reason, is in `revB_per_pool_filter.csv` and in `failedFilter` inside
`assetRegistry.revB.json`.

## Native-coin links

Chains whose native coin has no row of its own use an existing row. All three
target rows are in Revision B, so all three links are kept:

- Polygon native POL uses row 114 (POL, environment Ethereum). Row 114 passed
  the per-pool filter (best pool about $37,600, traded in the last 24 hours).
- Arbitrum native ETH uses row 2 (ETH, environment Ethereum).
- Optimism native ETH uses row 2 (ETH, environment Ethereum).

## What the live path registers

- Registry: 486 entries under their own environment plus Base ETH (row 2
  under Base) = 487 lines, in batches of 50 (10 batches).
- Token address index (`tokenAddressIndex.json`): 475 addresses, one per token
  entry. No address in Revision B sits on two rows, so no duplicate rule was
  needed.
- Native-coin aliases: the three links above.
- Price runs: 487 lines, in 2 runs of at most 250 lines.
