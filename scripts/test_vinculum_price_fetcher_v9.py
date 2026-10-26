#!/usr/bin/env python3
"""t431u: the v9 DexScreener tier must always price the token being priced.
When the token is the quote (second) token of a pair, its price is
priceUsd / priceNative; the base token's priceUsd is never assigned to it.
t436u: the founder override row (TigerOG only) may be priced from a pool for
its exact contract on any chain, with no market-activity requirement; every
other row still uses its own chain's pools only.
Run: python3 scripts/test_vinculum_price_fetcher_v9.py"""
import os, sys, unittest
from unittest import mock
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import vinculum_price_fetcher_v9 as v9

TOKEN = "0x1111111111111111111111111111111111111111"
WETH = "0x4200000000000000000000000000000000000006"
OTHER = "0x2222222222222222222222222222222222222222"
QUOTE = {"chainId": "base", "baseToken": {"address": WETH}, "quoteToken": {"address": TOKEN.upper().replace("0X", "0x")},
         "priceUsd": "3000", "priceNative": "60000", "liquidity": {"usd": 500000}}
BASE = {"chainId": "base", "baseToken": {"address": TOKEN}, "quoteToken": {"address": WETH},
        "priceUsd": "0.051", "priceNative": "0.000017", "liquidity": {"usd": 1000}}
UNRELATED = {"chainId": "base", "baseToken": {"address": OTHER}, "quoteToken": {"address": WETH},
             "priceUsd": "9", "priceNative": "0.003", "liquidity": {"usd": 9e9}}

class PoolSide(unittest.TestCase):
    def test_base_side(self):
        self.assertEqual(v9.token_usd_from_pair(BASE, TOKEN), 0.051)
    def test_quote_side_inverted(self):
        usd = v9.token_usd_from_pair(QUOTE, TOKEN)
        self.assertAlmostEqual(usd, 0.05, places=12)
        self.assertNotEqual(usd, 3000.0)
    def test_quote_side_without_price_native_skipped(self):
        self.assertIsNone(v9.token_usd_from_pair(dict(QUOTE, priceNative=None), TOKEN))
        self.assertIsNone(v9.token_usd_from_pair(dict(QUOTE, priceNative="0"), TOKEN))
    def test_unrelated_pair_skipped(self):
        self.assertIsNone(v9.token_usd_from_pair(UNRELATED, TOKEN))
    def test_best_pool_quote_side(self):
        self.assertAlmostEqual(v9.best_ds_price([UNRELATED, BASE, QUOTE], "base", TOKEN), 0.05, places=12)
    def test_fallback_to_base_side_pool(self):
        self.assertEqual(v9.best_ds_price([dict(QUOTE, priceNative=None), BASE], "base", TOKEN), 0.051)
    def test_other_chain_ignored(self):
        self.assertIsNone(v9.best_ds_price([dict(BASE, chainId="ethereum"), UNRELATED], "base", TOKEN))
    def test_ds_by_contract_scoped_endpoint(self):
        def f(url, params=None):
            return [QUOTE, UNRELATED] if "/token-pairs/v1/base/" in url else None
        with mock.patch.object(v9, "fetch", side_effect=f):
            self.assertAlmostEqual(v9.ds_by_contract("Base", TOKEN), 0.05, places=12)
    def test_ds_by_contract_fallback_endpoint(self):
        def f(url, params=None):
            return [] if "/token-pairs/v1/" in url else {"pairs": [QUOTE, UNRELATED]}
        with mock.patch.object(v9, "fetch", side_effect=f):
            self.assertAlmostEqual(v9.ds_by_contract("Base", TOKEN), 0.05, places=12)

TIGER = "0xCF7Fc0De71238c9EC45EC2Fd24FDc8521345dbB5"
WBNB = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c"
# Shape of the live DexScreener answer seen on 2026-10-26 (bsc PancakeSwap
# TIGEROG/WBNB), with 24h volume and trades set to zero and a fresh pool.
TIGER_BSC = {"chainId": "bsc", "dexId": "pancakeswap", "pairAddress": "0xpair",
             "baseToken": {"address": TIGER, "symbol": "TIGEROG"},
             "quoteToken": {"address": WBNB, "symbol": "WBNB"},
             "priceUsd": "0.0000000000000000007353", "priceNative": "0.0000000000000000000009863",
             "liquidity": {"usd": 4879.08}, "volume": {"h24": 0, "h6": 0, "h1": 0},
             "txns": {"h24": {"buys": 0, "sells": 0}}, "pairCreatedAt": None}

class FounderOverrideAnyChain(unittest.TestCase):
    def test_identity_exact(self):
        self.assertTrue(v9.is_founder_override("Base", TIGER.lower()))
        self.assertFalse(v9.is_founder_override("BSC", TIGER))
        self.assertFalse(v9.is_founder_override("Base", TOKEN))
    def test_tigerog_priced_from_bsc_pair_zero_volume(self):
        def f(url, params=None):
            if "/token-pairs/v1/base/" in url:
                return []
            return {"pairs": [TIGER_BSC]}
        with mock.patch.object(v9, "fetch", side_effect=f):
            self.assertAlmostEqual(v9.ds_by_contract("Base", TIGER), 7.353e-19, delta=1e-30)
    def test_tigerog_quote_side_on_other_chain(self):
        q = dict(TIGER_BSC, baseToken={"address": WBNB}, quoteToken={"address": TIGER},
                 priceUsd="745.5", priceNative="1013850000000000000000")
        def f(url, params=None):
            return [] if "/token-pairs/v1/" in url else {"pairs": [q]}
        with mock.patch.object(v9, "fetch", side_effect=f):
            usd = v9.ds_by_contract("Base", TIGER)
        self.assertAlmostEqual(usd, 745.5 / 1013850000000000000000, delta=1e-30)
        self.assertNotEqual(usd, 745.5)
    def test_tigerog_most_liquid_pool_any_chain(self):
        base_pool = dict(TIGER_BSC, chainId="base", priceUsd="0.0000000000000000007", liquidity={"usd": 2330})
        def f(url, params=None):
            return [base_pool] if "/token-pairs/v1/base/" in url else {"pairs": [TIGER_BSC, base_pool]}
        with mock.patch.object(v9, "fetch", side_effect=f):
            self.assertAlmostEqual(v9.ds_by_contract("Base", TIGER), 7.353e-19, delta=1e-30)
    def test_non_override_token_ignores_other_chain_pairs(self):
        bsc_only = dict(BASE, chainId="bsc", volume={"h24": 1e6})
        def f(url, params=None):
            return [] if "/token-pairs/v1/" in url else {"pairs": [bsc_only]}
        with mock.patch.object(v9, "fetch", side_effect=f):
            self.assertIsNone(v9.ds_by_contract("Base", TOKEN))
    def test_non_override_token_zero_volume_own_chain_still_priced(self):
        zero = dict(BASE, volume={"h24": 0}, txns={"h24": {"buys": 0, "sells": 0}})
        with mock.patch.object(v9, "fetch", side_effect=lambda u, params=None: [zero]):
            self.assertEqual(v9.ds_by_contract("Base", TOKEN), 0.051)

if __name__ == "__main__":
    unittest.main(verbosity=2)
