// The live Base set the operator deployed on 2026-10-22, as recorded in
// deployment/BASE44_LIVE_CONFIG_2026-10-22.md on main (copied from
// /workspace/t301u/addrs.cjs; live_reconcile.cjs re-checks every address
// against that document). Full addresses live only in this data file;
// reports print them shortened.
module.exports = {
 base: {
  BaseCommitmentVaultLock: "0xa1bEA13021D48969210D2e28A3760653AF983558",
  TokenVCLM: "0xC8c7da1d7Ac2DDcE09410dD43663c3d91d8d9983",
  TokenCHONX: "0x2150230b14F81d7C77aB507F4a66fb430D220291",
  VinculumFinalisVerifier: "0xfA8A18e0ddE99a06C78231F82E26ec6160006328",
  VinculumFinalisSynth: "0xf1cA519B5b83525C8a659F6e66dB0ecCb5A75D27",
  VinculumFinalisStake: "0x8481d1e275eD8398C904005417813a3157e3Df55",
 },
 readers: {
  "Base": ["BaseLockRecordVerifier","0x9361339655caE3AEcC5ba605d4e57D5771EC2666"],
  "Ethereum": ["SimpleEthereumLockReader","0xE92ac194d9b53E4eD897e4334eE97dd14E96B07B"],
  "Arbitrum": ["ArbitrumLockReader","0xA310F01d529Bc9775E516422328B98CF6dB1fA87"],
  "Optimism": ["OptimismLockReader","0x02412446f6d080f6D5f7B602a311B84d9B8E5327"],
  "Polygon": ["PolygonLockReader","0xCc2F41197bB1413f85c33533b67b3667C2d71b6d"],
  "BNB Smart Chain": ["BnbSmartChainLockReader","0x9e0Ead13696899b919078bAaE96F16d66FF4b827"],
  "Avalanche": ["AvalancheLockReader","0x5d021f3bDB9A162913987bf7edcF14d26e568E4D"],
  "Bitcoin": ["BitcoinLockReader","0x2cb46E27268cE1F2A9Ce1aA45f7A38AE37bB9Dab"],
  "Bitcoin Cash": ["BitcoinCashLockReader","0x38bC1fEDB7f62DF8c25af486a5b03C83258C1A22"],
  "Litecoin": ["LitecoinLockReader","0x17BF2c3c72104C64D5c13f0C6A34cDDD95dFc445"],
  "Dogecoin": ["DogecoinLockReader","0x3C2b2B902415546fd49dff77Fde40be2D705F7d5"],
  "DigiByte": ["DigiByteLockReader","0x7393D6Ee141D6333e3b72BFF195e98b476487C75"],
  "Zcash": ["ZcashLockReader","0x0c3b7304D903f873acC7649cfe73C2e37ED63918"],
  "Stellar": ["StellarLockReader","0x821A566D3e8Aa0c3D9d26B57a1E7fDa62B0AF38C"],
  "XRP Ledger": ["XrplLockReader","0xfcbbe7Af0Ac36f2F0AFf429647AEcb9077880937"],
 },
 nonBaseLock: "0x115b2B47330cD1b7550D347f44df2e151D4A626E"
};
