// t452u item 0: measure the real gas of registering each Revision E Base row on
// its own (Hardhat test chain, nothing broadcast). Output: per-symbol-bucket and
// per-token-address maxima used by the gas-sized batch planner in
// scripts/deploy-pages/baseCeremonyFlow.js. Run: OUT=<file> npx hardhat run scripts/revE/measureRowGas.cjs
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
(async () => {
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, "../deploy-pages/ceremony-data.json"), "utf8"));
  const SCALE = 10n ** 18n;
  const T = await ethers.getContractFactory("VinculumFinalisToken");
  const vclm = await T.deploy("Vinculum", "VCLM", 10_000_000_000n * SCALE);
  const chonx = await T.deploy("Chonx", "CHONX", 100_000_000_000n * SCALE);
  const v = await (await ethers.getContractFactory("VinculumFinalisVerifier")).deploy(await vclm.getAddress(), await chonx.getAddress());
  const rows = data.entries.map((e) => ({ environmentId: e.environmentId, canonicalAssetId: e.canonicalAssetId, symbol: e.symbol, decimals: e.decimals, custodyClass: e.custodyClass, custodyPath: e.custodyPath }));
  const bucket = {};
  for (const r of rows) {
    const g = Number((await (await v.registerAssetPrecisionBatch([r])).wait()).gasUsed);
    const b = Math.ceil(Buffer.byteLength(r.symbol) / 32) || 1;
    bucket[b] = Math.max(bucket[b] || 0, g);
  }
  let tokMax = 0;
  for (const t of data.tokenAddresses) {
    const g = Number((await (await v.registerTokenAddressBatch([t])).wait()).gasUsed);
    tokMax = Math.max(tokMax, g);
  }
  // Real batches of 50 (the contract cap) in registry order, on a fresh Verifier.
  const BATCH = 50;
  const v2 = await (await ethers.getContractFactory("VinculumFinalisVerifier")).deploy(await vclm.getAddress(), await chonx.getAddress());
  const regB = [], tokB = [];
  for (let i = 0; i < rows.length; i += BATCH) { const sl = rows.slice(i, i + BATCH); regB.push({ n: sl.length, gas: Number((await (await v2.registerAssetPrecisionBatch(sl)).wait()).gasUsed) }); }
  for (let i = 0; i < data.tokenAddresses.length; i += BATCH) { const sl = data.tokenAddresses.slice(i, i + BATCH); tokB.push({ n: sl.length, gas: Number((await (await v2.registerTokenAddressBatch(sl)).wait()).gasUsed) }); }
  // Worst case: the 50 costliest rows together in one transaction (single-row cost, then stacked).
  const cost = (r) => bucket[Math.ceil(Buffer.byteLength(r.symbol) / 32) || 1];
  const worst50 = [...rows].sort((a, b) => cost(b) - cost(a)).slice(0, BATCH);
  const v3 = await (await ethers.getContractFactory("VinculumFinalisVerifier")).deploy(await vclm.getAddress(), await chonx.getAddress());
  const worstRegGas = Number((await (await v3.registerAssetPrecisionBatch(worst50)).wait()).gasUsed);
  const per = (a) => Math.max(...a.map((x) => (x.gas - 21000) / x.n));
  const out = { batchSize: BATCH, regBatches: regB, tokBatches: tokB, regBatchMaxGas: Math.max(...regB.map((x) => x.gas)), tokBatchMaxGas: Math.max(...tokB.map((x) => x.gas)), regPerRowMax: per(regB), tokPerRowMax: per(tokB), worst50RegistryRowsOneTxGas: worstRegGas, rows: rows.length, tokens: data.tokenAddresses.length, symbolBucketSingleTxMaxGas: bucket, tokenSingleTxMaxGas: tokMax, txCap: 16777216, target85pct: 14260633 };
  fs.writeFileSync(process.env.OUT || "row_gas.json", JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out));
})().catch((e) => { console.error(e); process.exit(1); });
