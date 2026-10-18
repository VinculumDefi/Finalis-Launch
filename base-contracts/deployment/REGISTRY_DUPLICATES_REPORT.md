# Registry duplicate-address report (t204u)

This report only states facts. It changes no rows. Sources:
- the 961 rows we wrote (`deployment/assetRegistry.resolved.json`);
- the public registry (https://vinculumprotocol.com/asset-registry.html, data file `approved_assets_final.json`, fetched 2026-10-18);
- each contract's on-chain `symbol()`/`name()`, read only (`deployment/tokenSymbolsSnapshot.json`);
- the CoinGecko coin API `platforms` field, fetched 2026-10-18.

Addresses are shortened.

## Summary

There are 52 addresses that each appear on two or more rows in the same environment, which makes 53 losing rows.

**For every one of these rows, the written address is identical to the public registry's address.** So none of these problems came from how we copied or wrote the data. Where an address is wrong, it is wrong in the public registry too.

- 43 losing rows are harmless aliases. They are the same token as the winning row under a chain-suffixed label, such as USDC_ETH. The address is correct for them.
- 6 rows have an address that belongs to a different token:
  - ACM, DASH, ALGO and ASR are genuinely wrong.
  - RENDER and INST are the same project under a new symbol. Their addresses are correct.
- HAY (now lisUSD) and GMT2 are correct addresses for the same token.
- SNS_OP and EUROC_ETH are correct addresses. The rule kept their sibling row because no row label matches the on-chain symbol.

## Genuinely wrong addresses

| Row | Label (public name) | Env | Written address = public address | On-chain symbol / name at that address | Does the token exist on that chain? | Correct address with its source |
|---|---|---|---|---|---|---|
| 152 | ACM (AC Milan Fan Token) | Ethereum | 0x9f8F…79A2 | MKR / Maker (it is the Maker token; row 32 MKR owns it) | No. CoinGecko lists ACM only on Chiliz (0x062f…89d1), Solana (H5qG…KHe1) and Base (0x886e…9cdc). The public entry is already flagged `contract_source: unresolved`, and its alternates are Solana and Base. | None on Ethereum. A real ACM address exists only on another environment (Base 0x886e…9cdc, per CoinGecko and the public alternate list). That is a different environment, so it cannot be this Ethereum row. |
| 991 | DASH (Dash) | Ethereum | 0x57Ab…5f51 | sUSD / Synth sUSD (row 186 sUSD owns it) | No. Dash is its own chain's native coin. CoinGecko lists no token platforms at all. | None |
| 980 | ALGO (Algorand) | Ethereum | 0x2770…F628 | ALEPH / aleph.im (row 609 ALEPH owns it) | No. ALGO is Algorand's native coin. CoinGecko lists no token platforms. | None |
| 345 | ASR (AS Roma Fan Token) | Ethereum | 0xfc82…b27d | PROM / Prom (row 369 PROM owns it) | No. CoinGecko lists ASR on Chiliz (0x0ac7…6eb0), Solana (3cVu…cSk1) and Base (0x5383…ba8b). | None on Ethereum. The same remark applies as for ACM: a real address exists only on Base and other chains. |

## Rename cases: the address is correct, only the ticker changed

| Row | Label | Env | Address | On-chain | Note |
|---|---|---|---|---|---|
| 977 | RENDER | Ethereum | 0x6De0…eb24 | RNDR | Same Render token. Row 53 RNDR is kept. The address is correct for both rows. |
| 330 | INST | Ethereum | 0x6f40…03eb | FLUID | Instadapp renamed INST to FLUID at the same contract. Row 158 FLUID is kept. Correct. |
| 781 | HAY | BNB Smart Chain | 0x0782…41E5 | lisUSD | Helio's HAY was renamed lisUSD at the same contract. Row 348 LISUSD is kept. Correct. |
| 235 | GMT2 | BNB Smart Chain | 0x3019…b2A1 | GMT | STEPN GMT on BSC. Row 147 GMT is kept. Correct. |
| 275 | SNS_OP | Optimism | 0x8700…99B4 | SNX | Synthetix on Optimism. Neither label equals SNX, so the lowest row, 141 SNS, is kept. The address is correct, but both labels misspell SNX. |
| 307 | EUROC_ETH | Ethereum | 0x1aBa…C33c | EURC | Circle renamed EUROC to EURC at the same contract. Neither label matches, so the lowest row, 190 EUROC, is kept. Correct. |

## Harmless alias rows: same token, correct address (43)

| Row | Label | Env | Address | On-chain symbol | Row kept for this address |
|---|---|---|---|---|---|
| 458 | USDC_ETH | Ethereum | 0xA0b8…eB48 | USDC | 1(USDC) |
| 459 | USDT_ETH | Ethereum | 0xdAC1…1ec7 | USDT | 6(USDT) |
| 457 | WBTC_ETH | Ethereum | 0x2260…C599 | WBTC | 7(WBTC) |
| 460 | LINK_ETH | Ethereum | 0x5149…86CA | LINK | 8(LINK) |
| 430 | STETH_ETH | Ethereum | 0xae7a…fE84 | stETH | 9(stETH) |
| 461 | UNI_ETH | Ethereum | 0x1f98…F984 | UNI | 13(UNI) |
| 466 | LDO_ETH | Ethereum | 0x5A98…1B32 | LDO | 15(LDO) |
| 447 | SHIB_ETH | Ethereum | 0x95aD…C4cE | SHIB | 17(SHIB) |
| 432 | ARB_TOKEN | Arbitrum | 0x912C…6548 | ARB | 22(ARB) |
| 453 | CBETH_BASE | Base | 0x2Ae3…Ec22 | cbETH | 25(CBETH) |
| 431 | OP_TOKEN | Optimism | 0x4200…0042 | OP | 26(OP) |
| 28 | CBBTC | Base | 0xcbB7…33Bf | cbBTC | 45(cbBTC) |
| 462 | MKR_ETH | Ethereum | 0x9f8F…79A2 | MKR | 32(MKR) |
| 473 | GRT_ETH | Ethereum | 0xc944…44a7 | GRT | 35(GRT) |
| 435 | IMX_ETH | Ethereum | 0xF57e…79fF | IMX | 46(IMX) |
| 474 | MATIC_ETH | Ethereum | 0x7D1A…eBB0 | MATIC | 52(MATIC) |
| 463 | SNX_ETH | Ethereum | 0xC011…2a6F | SNX | 55(SNX) |
| 465 | CRV_ETH | Ethereum | 0xD533…cd52 | CRV | 56(CRV) |
| 467 | RPL_ETH | Ethereum | 0xD335…A51f | RPL | 58(RPL) |
| 468 | RETH_ETH | Ethereum | 0xae78…6393 | rETH | 59(rETH) |
| 455 | CAKE_BSC | BNB Smart Chain | 0x0E09…cE82 | Cake | 62(CAKE) |
| 443 | CHZ_ETH | Ethereum | 0x3506…b4AF | CHZ | 63(CHZ) |
| 437 | FET_ETH | Ethereum | 0xaea4…Ad85 | FET | 64(FET) |
| 464 | COMP_ETH | Ethereum | 0xc00e…6888 | COMP | 69(COMP) |
| 441 | VIRTUAL_BASE | Base | 0x0b3e…7E1b | VIRTUAL | 73(VIRTUAL) |
| 161 | PYUSD_ETH | Ethereum | 0x6c3e…A0e8 | PYUSD | 81(PYUSD) |
| 471 | BAL_ETH | Ethereum | 0xba10…4e3D | BAL | 95(BAL) |
| 442 | BAT_ETH | Ethereum | 0x0D87…87EF | BAT | 101(BAT) |
| 472 | YFI_ETH | Ethereum | 0x0bc5…d93e | YFI | 115(YFI) |
| 469 | FXS_ETH | Ethereum | 0x3432…64D0 | FXS | 116(FXS) |
| 470 | CVX_ETH | Ethereum | 0x4e3F…9D2B | CVX | 120(CVX) |
| 456 | JOE_AVAX2 | Avalanche | 0x6e84…0fDd | JOE | 126(JOE) |
| 446 | MANA_ETH | Ethereum | 0x0F5D…C942 | MANA | 127(MANA) |
| 445 | SAND_ETH | Ethereum | 0x3845…a5d0 | SAND | 128(SAND) |
| 444 | AXS_ETH | Ethereum | 0xBB0E…B28b | AXS | 129(AXS) |
| 439 | OCEAN_ETH | Ethereum | 0x967d…9F48 | OCEAN | 130(OCEAN) |
| 438 | AGIX_ETH | Ethereum | 0x5B75…b542 | AGIX | 154(AGIX) |
| 448 | LUNC_BSC | BNB Smart Chain | 0x45b6…858A | LUNC | 193(LUNC) |
| 440 | NMR_ETH | Ethereum | 0x1776…6671 | NMR | 201(NMR) |
| 452 | TRB_ETH | Ethereum | 0x88dF…78a0 | TRB | 203(TRB) |
| 450 | GLM_ETH | Ethereum | 0x7DD9…6429 | GLM | 207(GLM) |
| 451 | BAND_ETH | Ethereum | 0xBA11…7f55 | BAND | 241(BAND) |
| 449 | RLC_ETH | Ethereum | 0x607F…7375 | RLC | 324(RLC) |

## What fits the registry format and Revision 6/12

1. **Rows are identified by label, not by address.** canonicalAssetId = keccak256(environment, label). The address is not part of a row as written on-chain. It only reaches the verifier through the token address index, which has one address per row per environment, and the index refuses duplicates.
   - So the 961 written rows (label, decimals, custody class) stay exactly as they are under every option below.
   - The frozen 961-row rule is not touched.
2. **Amend.** Writing a different address into ACM, DASH, ALGO or ASR on Ethereum is impossible, because no verifiable Ethereum address exists for any of them.
   - Moving ACM or ASR to their Base address would change the row's environment. That means a new canonicalAssetId, which is effectively a new row.
   - That breaks the 961-row rule, and the public registry does not list them as Base rows either. The index also refuses a cross-environment entry.
   - So amending does not fit.
3. **Leave.** This is what the current code already does, and it fits.
   - Under the duplicate rule, the wrong address indexes to its true owner (MKR, sUSD, ALEPH, PROM).
   - ACM, DASH, ALGO and ASR therefore have no provable token address. A lock of one of them can never verify, so a holder can never mint against a wrong price.
   - Their rows remain registered and harmless.
4. **Mark unavailable.** These four rows are already unavailable in practice: no token lock can prove them.
   - If an explicit flag is wanted, the right tool is the existing price mechanism. A scheduled price run posts `success:false` (or no price) for the row, so it has no usable last price and the verifier treats it as unavailable.
   - That needs no new row, no new field, and no format change, and the public registry's `unresolved` flag for ACM already matches it.
   - I did not post or prepare any such run.
5. **The old live verifier's rows** (0xb067…, finalized 2026-10-12):
   - They live only on that contract and bind only that contract.
   - A new deployment writes its own registry at its own ceremony. What binds us is the frozen 961-row list and the spec, not whatever the old contract stored.
   - Those 961 rows came from the same file, so they carry the same labels. Its rows had no token index at all, so token locks never verified there anyway.
   - Nothing in Revision 6/12 makes the old contract's state an input to the new one.
6. **Recommendation:** leave all rows unchanged and keep the duplicate rule. For the operator's decision:
   - The four wrong rows (ACM, DASH, ALGO, ASR) are unavailable for token locks, and could also be posted as failed prices.
   - The error originates in the public registry itself, so it should be corrected there in a later registry revision, not in this deployment.
