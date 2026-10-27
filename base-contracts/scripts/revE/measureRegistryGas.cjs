// Revision E feasibility (t448u): gas of registration batches and scheduled
// price runs on the Hardhat test chain (nothing broadcast). N rows modelled on
// the Revision E Base subset. Run: N=<rows> OUT=<file> npx hardhat run scripts/revE/measureRegistryGas.cjs
const { ethers } = require("hardhat");
const fs = require("fs");
(async () => {
  const N = Number(process.env.N || 2945);
  const SCALE = 10n ** 18n;
  const [deployer] = await ethers.getSigners();
  const T = await ethers.getContractFactory("VinculumFinalisToken");
  const vclm = await T.deploy("Vinculum", "VCLM", 10_000_000_000n * SCALE);
  const chonx = await T.deploy("Chonx", "CHONX", 100_000_000_000n * SCALE);
  const v = await (await ethers.getContractFactory("VinculumFinalisVerifier")).deploy(await vclm.getAddress(), await chonx.getAddress());
  const ETH_ID = "0xde7085290190e1f2f7f2f83d26fa72e411f9d765ddd608a77e8a7c388113943b";
  const rows = [["Base", ETH_ID, "ETH", 18, 2, 0]];
  const toks = [];
  for (let i = 1; i < N; i++) {
    const sym = "TKN" + i + "_ABCD";
    const id = ethers.solidityPackedKeccak256(["string", "string"], ["Base", sym]);
    rows.push(["Base", id, sym, 18, 3, 1]);
    toks.push({ environmentId: "Base", token: ethers.getAddress("0x" + ethers.keccak256(ethers.toUtf8Bytes("t" + i)).slice(26)), canonicalAssetId: id });
  }
  const out = { N, reg: [], tok: [], runs: {} };
  for (let i = 0; i < rows.length; i += 50) out.reg.push(Number((await (await v.registerAssetPrecisionBatch(rows.slice(i, i + 50))).wait()).gasUsed));
  for (let i = 0; i < toks.length; i += 50) out.tok.push(Number((await (await v.registerTokenAddressBatch(toks.slice(i, i + 50))).wait()).gasUsed));
  await v.setScheduledPricePoster(deployer.address);
  let run = 1n;
  const line = (r, ok) => ({ environmentId: "Base", canonicalAssetId: r[1], priceUsd30: ok ? 123456789012345678901234567890n : 0n, success: ok });
  const measure = async (label, lines) => {
    const g = Number((await (await v.applyScheduledPriceRun(run++, lines, { gasLimit: 30_000_000 })).wait()).gasUsed);
    (out.runs[label] = out.runs[label] || []).push({ lines: lines.length, gas: g, perLine: Math.round(g / lines.length) });
  };
  // Round 1 (first ever writes) and rounds 2-3 (steady state) over all rows in 140-line runs.
  for (const round of [1, 2, 3]) for (let i = 0; i < rows.length; i += 140) await measure("round" + round, rows.slice(i, i + 140).map((r) => line(r, true)));
  for (let i = 0; i < 280; i += 140) await measure("failLines", rows.slice(i, i + 140).map((r) => line(r, false)));
  // largest steady-state run under 2^24
  for (const n of [140, 150, 160, 170, 180]) { try { await measure("size" + n, rows.slice(0, n).map((r) => line(r, true))); } catch (e) { out.runs["size" + n] = String(e.message).slice(0, 80); } }
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  out.summary = { regBatches: out.reg.length, regGas: sum(out.reg), regMax: Math.max(...out.reg), tokBatches: out.tok.length, tokGas: sum(out.tok), tokMax: Math.max(...out.tok) };
  for (const k of ["round1", "round2", "round3"]) out.summary[k] = { runs: out.runs[k].length, gas: sum(out.runs[k].map((x) => x.gas)), maxRun: Math.max(...out.runs[k].map((x) => x.gas)) };
  fs.writeFileSync(process.env.OUT || "gas_measure.json", JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out.summary), JSON.stringify(Object.fromEntries(Object.entries(out.runs).filter(([k]) => k.startsWith("size") || k === "failLines"))));
})().catch((e) => { console.error(e); process.exit(1); });
