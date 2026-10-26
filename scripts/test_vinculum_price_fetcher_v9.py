#!/usr/bin/env python3
"""t431u: the v9 DexScreener tier must always price the token being priced.
When the token is the quote (second) token of a pair, its price is
priceUsd / priceNative; the base token's priceUsd is never assigned to it.
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

if __name__ == "__main__":
    unittest.main(verbosity=2)
