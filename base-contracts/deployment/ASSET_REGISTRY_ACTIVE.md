# Active asset registry

`assetRegistry.active.json` is the set of registry rows that are currently
usable. It is a strict subset of the historical registry
`assetRegistry.resolved.json` (the 961 written rows plus Base ETH). That file
is unchanged. Rows are copied as they are: same row number, label, asset id,
decimals, custody class and address. Nothing is relabelled. Built by
`scripts/buildActiveRegistry.cjs` from the on-chain check of 2026-10-19 and
the price fetch of 2026-10-19 07:10 ET.

## Contents (822 entries)

- 755 tokens verified on-chain: contract code present, `symbol()` equals the
  label (exactly, ignoring case, or apart from a chain suffix such as
  `USDC_BASE`), and `decimals()` equals the row's decimals.
- 40 tokens marked `renamed`: the same token under a new ticker (for example
  EUROC now reads EURC). The on-chain symbol is recorded.
- 15 tokens marked `bridged`: a bridged, wrapped or legacy contract of the
  labelled asset (for example LINK.e on Avalanche). The on-chain symbol is
  recorded.
- 12 native coins already tested end to end: ETH (row 2, under Ethereum and
  as Base ETH), BNB, AVAX, BTC, DOGE, LTC, BCH, DGB, ZEC, XLM and XRP.

`nativeLinks` records the three native coins that use another chain's row
(the ceremony aliases): Polygon native POL uses row 114 (POL on Ethereum), and
Arbitrum and Optimism native ETH use row 2 (ETH). These are links, not extra
entries, and both linked rows are included.

Each entry carries `price`: `priced` with its source, or `fail` with its
reason, from the latest fetch. Price status never excludes a row.

## Excluded

- The 10 symbol failures, where the contract is a different project (rows 77,
  286, 323, 359, 366, 370, 406 and 996) or the match is uncertain (rows 259
  and 714).
- TigerOG, LionOG and FrogOG (rows 138, 999 and 1000), dropped by the
  operator.
- The 4 mislabelled rows (ACM, DASH, ALGO and ASR) and every other row that
  loses the duplicate-address rule.
- Every Solana row, because there is no Solana reader.

## Not wired in yet

The verifier and the ceremony still use the historical file. Using this file
instead would mean:

- **Registry rows written:** the ceremony would write 822 rows instead of 962
  (`registerAssetPrecisionBatch`, in batches of 50). Each excluded asset would
  have no row, so the verifier would refuse it with "asset not in registry".
  The Polygon POL alias and the Arbitrum and Optimism native-ETH aliases still
  point at rows that are included (rows 114 and 2).
- **Address lookup:** `buildTokenAddressIndex` would build from this file. That
  gives 810 entries (755 + 40 + 15) instead of 823, and drops the 10 failing
  addresses and the three dropped tokens. Its duplicate rule would no longer
  be needed, because each address appears on one row only.
- **Price runs:** they would cover 822 lines instead of 962, in 4 runs of at
  most 250 lines each.
- **Tests:** the ceremony and price-run tests count 962 rows and 823 lookup
  entries, so they would need new counts.
