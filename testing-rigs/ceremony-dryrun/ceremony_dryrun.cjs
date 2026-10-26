// Ceremony dry-run, Base-only launch (founder directive t357u). Runs the
// Base ceremony exactly as base.html does (baseCeremonyFlow.runBaseCeremony,
// built ceremony.json artifacts, the Base subset of registry Revision D in
// ceremony-data.json: 131 rows, 130 token addresses, 0 aliases, one reader)
// against a LOCAL fork of Base mainnet, then reconciles the deployed set
// (Rig 10), then checks Base USDC (row 454): registered as S1 and a real
// USDC lock on the fork mints at 1.5x the S3 amount (operator decision
// t367u; still S1 in Revision D). Then checks the t430u Revision D facts on the
// ceremony's own state: TEL indexed at the upgraded contract only, the three
// founder-override rows registered and indexed, and the $0.95 stablecoin flag
// set by exact identity (Base USDC and USDT) and on nothing else. Nothing is broadcast: the signer is a local Hardhat test account
// on the in-process fork. No other chain is read or touched.
//
// SIMULATE mode is the only mode: stdout is
//   "mode: SIMULATE (Base-only, ...)", "ceremony would succeed", then the
//   reconciliation verdict; or "ceremony would FAIL at step <n> <name>: <reason>"
//   followed by the dump. Progress goes to stderr.
// Run: cd base-contracts && npm run ceremony:dryrun:simulate
const path = require("path");
const fs = require("fs");
const hre = require("hardhat");
const { ethers } = hre;
const BC = path.resolve(__dirname, "../../base-contracts");
const art = require(path.join(BC, "scripts/deploy-pages/ceremony.json"));
const DATA = require(path.join(BC, "scripts/deploy-pages/ceremony-data.json"));
const FLOW = require(path.join(BC, "scripts/deploy-pages/baseCeremonyFlow.js"));
const RECON = require("../reconciliation/reconcile.cjs");

const TX_GAS_CAP = 16_777_216n; // Base Azul (May 28, 2026): EIP-7825 per-transaction gas maximum
const MODE_LINE = "mode: SIMULATE (Base-only, local Base fork, local test signer; nothing broadcast)";
const short = (a) => (typeof a === "string" && /^0x[0-9a-fA-F]{40}$/.test(a) ? a.slice(0, 6) + "..." + a.slice(-4) : a);
const scrub = (s) => String(s).replace(/0x[0-9a-fA-F]{40}/g, (a) => short(a));
const err = (...a) => process.stderr.write(scrub(a.join(" ")) + "\n");
const coder = ethers.AbiCoder.defaultAbiCoder();

const STEPS = [
  "inputs and artifacts (Base subset: 131 rows, 130 token addresses, 0 aliases)",
  "fork is Base mainnet",
  "deploy VCLM, CHONX, Verifier, Forge, Stake",
  "deploy Base lock",
  "initialize VCLM and CHONX, deploy and register the Base reader",
  "registry rows (131 Base rows)",
  "token address index (130 Base token addresses)",
  "Dev Fund, price run 1, poster hand-over, finalize",
  "post-finalize state (one reader, no other environment wired)",
  "Base reader with a real lock on the fork",
  "Rig 10 reconciliation: deployed set vs artifacts and ceremony-data",
  "Base USDC (row 454) is S1: registered class and a real USDC lock minted at 1.5x",
  "Revision D (t430u): TEL upgraded contract only, founder-override rows, stablecoin flag by exact identity",
];
let step = 0;
const gasRows = [];
const notes = [];
function at(n) { step = n; err(`[step ${n}] ${STEPS[n]}`); }

async function main() {
  at(0);
  for (const n of ["TokenVCLM", "TokenCHONX", "VinculumFinalisVerifier", "VinculumFinalisSynth", "VinculumFinalisStake", "BaseCommitmentVaultLock", "BaseLockRecordVerifier"]) {
    if (!art[n] || !art[n].bytecode || art[n].bytecode.length < 10) throw new Error(`ceremony.json has no bytecode for ${n}`);
    const built = await hre.artifacts.readArtifact(n).catch(() => null);
    if (built && built.bytecode !== art[n].bytecode) notes.push(`ceremony.json ${n} bytecode differs from the current Hardhat build (ceremony uses ceremony.json)`);
  }
  const extra = Object.keys(art).filter((n) => !["TokenVCLM", "TokenCHONX", "VinculumFinalisVerifier", "VinculumFinalisSynth", "VinculumFinalisStake", "BaseCommitmentVaultLock", "BaseLockRecordVerifier"].includes(n));
  if (extra.length) throw new Error(`ceremony.json carries non-Base contracts: ${extra.join(", ")}`);
  if (DATA.baseOnly !== true) throw new Error("ceremony-data is not marked baseOnly");
  if (DATA.registryRows !== 591) throw new Error(`registry source has ${DATA.registryRows} rows, expected 591 (Revision D)`);
  if (DATA.entries.length !== 131) throw new Error(`registry has ${DATA.entries.length} rows, expected 131 Base rows`);
  if (DATA.tokenAddresses.length !== 130) throw new Error(`token index has ${DATA.tokenAddresses.length} rows, expected 130`);
  if (DATA.assetRowAliases.length !== 0) throw new Error(`${DATA.assetRowAliases.length} aliases, expected 0`);
  if (!DATA.entries.every((e) => e.environmentId === "Base") || !DATA.tokenAddresses.every((t) => t.environmentId === "Base")) throw new Error("a non-Base row is in ceremony-data");
  if (JSON.stringify(Object.keys(DATA.readers)) !== JSON.stringify(["base"])) throw new Error("ceremony-data readers are not Base only");
  err(`  Base rows ${DATA.entries.length} of ${DATA.registryRows}, token addresses ${DATA.tokenAddresses.length}, aliases ${DATA.assetRowAliases.length}, registry sha256 ${String(DATA.registrySha256).slice(0, 12)}`);

  at(1);
  const net = await ethers.provider.getNetwork();
  if (net.chainId !== 8453n) throw new Error(`chain id ${net.chainId}, expected 8453 (run with RIG_FORK=base)`);
  const fb = await ethers.provider.getBlock("latest");
  err(`  forked Base block ${fb.number}, block gas limit ${fb.gasLimit}`);

  // The page connects MetaMask; here a local Hardhat test account stands in.
  const [signer] = await ethers.getSigners();
  FLOW.checkInputs(ethers, DATA, signer.address);
  const orig = signer.sendTransaction.bind(signer);
  signer.sendTransaction = async (tx) => {
    const resp = await orig(tx);
    const rc = await resp.wait();
    gasRows.push({ step, gasLimit: resp.gasLimit, gasUsed: rc.gasUsed, to: rc.to, created: rc.contractAddress });
    if (resp.gasLimit > TX_GAS_CAP) throw new Error(`transaction gas limit ${resp.gasLimit} (used ${rc.gasUsed}) is above the Base per-transaction maximum ${TX_GAS_CAP}`);
    return resp;
  };

  at(2);
  const r = await FLOW.runBaseCeremony({
    ethers, signer, art, data: DATA,
    log: (s) => {
      for (const line of String(s).split("\n")) {
        if (/^Base lock/.test(line)) at(3);
        else if (/^reader Base/.test(line)) at(4);
        else if (/^registry /.test(line) && step < 5) at(5);
        else if (/^token addresses /.test(line) && step < 6) at(6);
        if (/^token addresses 130\/130/.test(line)) at(7);
        if (/^(registry|token addresses) /.test(line) && !/\/(131|130)$/.test(line)) continue;
        err("  " + line);
      }
    },
  });

  at(8);
  const V = r.verifier;
  if (!(await V.configurationFinalized())) throw new Error("not finalized");
  if (ethers.getAddress(await V.scheduledPricePoster()) !== ethers.getAddress(DATA.scheduledPricePoster)) throw new Error("poster is not the live poster");
  try { await V.registerChainVerifier.staticCall("Ethereum", await r.lock.getAddress()); throw new Error("registerChainVerifier still open after finalize"); }
  catch (e) { if (/still open/.test(e.message)) throw e; }
  if (JSON.stringify(Object.keys(r.readers)) !== JSON.stringify(["Base"])) throw new Error("the flow deployed readers other than Base");
  if ((await V.chainVerifiers("Base")) !== (await r.readers.Base.getAddress())) throw new Error("Base reader not registered");
  if (ethers.getAddress(await r.readers.Base.vault()) !== ethers.getAddress(await r.lock.getAddress())) throw new Error("Base reader is not bound to the Base lock");
  if (ethers.getAddress(await V.devFundDestinations("Base")) !== ethers.getAddress(DATA.devFund)) throw new Error("Base Dev Fund destination mismatch");
  for (const env of RECON.NON_BASE_ENVS) {
    if ((await V.chainVerifiers(env)) !== ethers.ZeroAddress) throw new Error(`${env} reader registered`);
    if ((await V.devFundDestinations(env)) !== ethers.ZeroAddress) throw new Error(`${env} Dev Fund destination set`);
  }
  err(`  finalized; launch ${r.launch}; live poster set; one reader (Base); ${RECON.NON_BASE_ENVS.length} other environments have no reader and no Dev Fund destination`);

  at(9);
  // The Base lock's 5% fee on a real lock, then the Base reader verifies and mints.
  // Real native ETH lock on the new Base lock, valued with the ceremony's own
  // price run 1 (ceremony-data priceUsd18). Local fork only.
  const ETH_ID = DATA.row2.canonicalAssetId;
  const px = BigInt(DATA.priceUsd18);
  const S = (await ethers.getSigners())[1];
  const lockId = ethers.id("dryrun:" + Date.now());
  const wei = ethers.parseEther("0.5");
  await (await r.lock.connect(S).createNativeLock(lockId, S.address, 0, ETH_ID, ethers.ZeroHash, S.address, 604800, (wei * px) / 10n ** 18n, { value: wei })).wait();
  const rec = await r.lock.lockRecord(lockId);
  if (rec.fee !== (rec.gross * 500n) / 10000n) throw new Error("Base lock fee is not 5% of gross");
  const pkg = {
    sourceEnvironmentId: "Base", commitmentVaultLockId: lockId, handshakeAllowanceCount: 3,
    canonicalAssetId: ETH_ID, assetPrecision: 18, assetCustodyClass: 2,
    grossAmountSmallestUnits: rec.gross, actualFeeAmountSmallestUnits: rec.fee, principalAmountSmallestUnits: rec.principal,
    feeAssetId: ETH_ID, devFundDestination: "dev", feeTransferEvidence: ethers.id("fee:" + lockId),
    valuationTimestamp: rec.createdAt, maturityTimestamp: rec.maturity, durationSecs: rec.duration,
    selectedOutputToken: 0, baseRecipient: S.address, releaseDestination: "release",
    chonxActivationReceipt: "0x", racIdentity: ethers.id("rac:" + lockId), priceRecord: "0x", sourceFinalityProof: "0x",
    lockEventProof: coder.encode(["bytes32", "uint256", "uint256", "uint256", "uint256", "uint256", "uint256"],
      [lockId, rec.gross, rec.fee, rec.principal, rec.duration, rec.createdAt, rec.maturity]),
  };
  await (await V.connect(S).recordFeeAndRac(pkg)).wait();
  await (await V.connect(S).verifyAndMint(pkg, 0)).wait();
  const minted = await r.vclm.balanceOf(S.address);
  if (minted === 0n) throw new Error("Base lock verified but nothing minted");
  err(`  0.5 ETH 7-day lock: fee ${ethers.formatEther(rec.fee)} ETH, minted ${ethers.formatEther(minted)} VCLM`);

  at(10);
  // Rig 10: reconcile everything the rehearsal deployed. The operator's
  // transactions are read back from the local fork's blocks.
  const latest = await ethers.provider.getBlockNumber();
  const txs = [];
  for (let b = fb.number + 1; b <= latest; b++) {
    const blk = await ethers.provider.getBlock(b, true);
    for (const t of blk.prefetchedTransactions) {
      if (ethers.getAddress(t.from) !== ethers.getAddress(signer.address)) continue;
      const rc = await ethers.provider.getTransactionReceipt(t.hash);
      txs.push({ nonce: t.nonce, from: t.from, to: t.to, data: t.data, value: t.value, status: rc.status, created: rc.contractAddress, logs: rc.logs });
    }
  }
  const vAddr = ethers.getAddress(await V.getAddress());
  const finIdx = txs.findIndex((t) => t.to && ethers.getAddress(t.to) === vAddr && t.data.startsWith(V.interface.getFunction("finalize").selector));
  const cerTxs = txs.slice(0, finIdx + 1);
  const set = {
    vclm: await r.vclm.getAddress(), chonx: await r.chonx.getAddress(), verifier: await V.getAddress(), forge: await r.forge.getAddress(),
    stake: await r.stake.getAddress(), lock: await r.lock.getAddress(),
    readers: Object.fromEntries(await Promise.all(Object.entries(r.readers).map(async ([e, c]) => [e, await c.getAddress()]))),
  };
  const tokP = { Base: ethers.provider };
  const recon = await RECON.reconcile({
    hre, P: ethers.provider, set, DATA, art, mode: "dryrun",
    operator: signer.address, txs: cerTxs, fromBlock: fb.number + 1, simFrom: signer.address, tokenProviders: tokP, receiptLogs: cerTxs.flatMap((t) => t.logs),
    txListComplete: { ok: cerTxs.every((t, i) => i === 0 || t.nonce === cerTxs[i - 1].nonce + 1), detail: `${cerTxs.length} txs, local fork blocks ${fb.number + 1}..${latest}` },
    log: err,
  });
  fs.writeFileSync(path.join(__dirname, "../reconciliation/reconciliation_dryrun.json"), JSON.stringify(recon, null, 1));
  err(`  reconciliation: ${JSON.stringify(recon.counts)}`);

  at(11);
  // Revision C (t367u): Base USDC is S1. Read the class the ceremony wrote,
  // then lock real USDC on the fork and compare the mint with the Verifier's
  // own mint math at S3. Runs after reconciliation, so the reconciled set is
  // the ceremony's own state. Local fork only; the poster is impersonated
  // locally to post a $1.00 USDC price (run 2); nothing is broadcast.
  const usdcRow = DATA.entries.find((e) => e.row === 454);
  if (!usdcRow || usdcRow.environmentId !== "Base" || !/USDC/.test(usdcRow.symbol || usdcRow.assetId || "USDC")) throw new Error("ceremony-data has no Base USDC row 454");
  if (usdcRow.custodyClass !== 1) throw new Error(`ceremony-data row 454 custodyClass ${usdcRow.custodyClass}, expected 1 (S1, Revision C and D)`);
  const usdcKey = ethers.keccak256(ethers.solidityPacked(["string", "bytes32"], ["Base", usdcRow.canonicalAssetId]));
  const onchain = await V.assetPrecisionTable(usdcKey);
  if (onchain.canonicalAssetId !== usdcRow.canonicalAssetId) throw new Error("Base USDC row 454 not registered");
  if (Number(onchain.custodyClass) !== 1) throw new Error(`Base USDC registered as custodyClass ${onchain.custodyClass}, expected 1`);
  const usdcTok = DATA.tokenAddresses.find((t) => t.canonicalAssetId === usdcRow.canonicalAssetId);
  if (!usdcTok) throw new Error("Base USDC is not in the token address index");
  const USDC = ethers.getAddress(usdcTok.token || usdcTok.address);
  const posterAddr = await V.scheduledPricePoster();
  await ethers.provider.send("hardhat_impersonateAccount", [posterAddr]);
  await ethers.provider.send("hardhat_setBalance", [posterAddr, "0x56BC75E2D63100000"]);
  const P = await ethers.getSigner(posterAddr);
  const nextRun = (await V.lastScheduledRunId()) + 1n;
  await (await V.connect(P).applyScheduledPriceRun(nextRun, [{ success: true, environmentId: "Base", canonicalAssetId: usdcRow.canonicalAssetId, priceUsd18: 10n ** 18n }])).wait();
  await ethers.provider.send("hardhat_stopImpersonatingAccount", [posterAddr]);
  // Fund the test account with real USDC on the fork: FiatToken keeps
  // balances in slot 9 (balanceAndBlacklistStates). Checked with balanceOf.
  const erc = new ethers.Contract(USDC, ["function balanceOf(address) view returns (uint256)", "function approve(address,uint256) returns (bool)"], S);
  const amt = 1000n * 10n ** 6n;
  const slot = ethers.keccak256(coder.encode(["address", "uint256"], [S.address, 9]));
  await ethers.provider.send("hardhat_setStorageAt", [USDC, slot, ethers.toBeHex(amt, 32)]);
  if ((await erc.balanceOf(S.address)) !== amt) throw new Error("could not fund the test account with fork USDC");
  await (await erc.approve(await r.lock.getAddress(), amt)).wait();
  const uLockId = ethers.id("dryrun:usdc:" + Date.now());
  const dur = 604800n;
  await (await r.lock.connect(S).createErc20Lock(uLockId, S.address, 0, usdcRow.canonicalAssetId, ethers.ZeroHash, S.address, dur, USDC, amt, (amt * 10n ** 18n) / 10n ** 6n)).wait();
  const uRec = await r.lock.lockRecord(uLockId);
  const uPkg = {
    ...pkg, commitmentVaultLockId: uLockId, canonicalAssetId: usdcRow.canonicalAssetId, assetPrecision: 6, assetCustodyClass: 1,
    grossAmountSmallestUnits: uRec.gross, actualFeeAmountSmallestUnits: uRec.fee, principalAmountSmallestUnits: uRec.principal,
    feeAssetId: usdcRow.canonicalAssetId, feeTransferEvidence: ethers.id("fee:" + uLockId),
    valuationTimestamp: uRec.createdAt, maturityTimestamp: uRec.maturity, durationSecs: uRec.duration,
    racIdentity: ethers.id("rac:" + uLockId),
    lockEventProof: coder.encode(["bytes32", "uint256", "uint256", "uint256", "uint256", "uint256", "uint256"],
      [uLockId, uRec.gross, uRec.fee, uRec.principal, uRec.duration, uRec.createdAt, uRec.maturity]),
  };
  const v0 = await r.vclm.balanceOf(S.address);
  await (await V.connect(S).recordFeeAndRac(uPkg)).wait();
  await (await V.connect(S).verifyAndMint(uPkg, 0)).wait();
  const uMinted = (await r.vclm.balanceOf(S.address)) - v0;
  // The Verifier's own mint math (previewIssuance = _computeIssuance) at the
  // same USD, output, duration and emission day, for S1 and for S3.
  const launchTs = await V.protocolLaunchTimestamp();
  const days = uRec.createdAt > launchTs ? (uRec.createdAt - launchTs) / 86400n : 0n;
  // The Verifier's valuation: (gross * 1e18 / 10^decimals) * price / 1e18, at $1.00.
  const usdMicro = (((uRec.gross * 10n ** 18n) / 10n ** 6n) * 10n ** 18n) / 10n ** 18n;
  const asS1 = await V.previewIssuance(usdMicro, 0, 1, dur, days);
  const asS3 = await V.previewIssuance(usdMicro, 0, 3, dur, days);
  if (uMinted !== asS1) throw new Error(`Base USDC minted ${uMinted}, the S1 mint math gives ${asS1}`);
  const ratioBps = (uMinted * 10000n) / asS3;
  if (ratioBps !== 15000n) throw new Error(`Base USDC minted ${ratioBps} bps of the S3 amount, expected 15000 (1.5x)`);
  const usdcLine = `Base USDC (row 454): registered custodyClass ${onchain.custodyClass} (S1); 1000 USDC 7-day lock minted ${ethers.formatEther(uMinted)} VCLM vs ${ethers.formatEther(asS3)} at S3 = ${ratioBps} bps (${Number(ratioBps) / 10000}x)`;
  err("  " + usdcLine);

  at(12);
  // Revision D (t430u), read from the ceremony's own state on the fork.
  const tIdx = async (tok) => V.tokenAssetIndex(ethers.keccak256(coder.encode(["string", "address"], ["Base", tok])));
  const TEL_NEW = "0x7E13B43065380aCdeC1c2d138c579cbBbafA0731";
  const TEL_OLD = "0x09bE1692ca16e06f536F0038fF11D1dA8524aDB1";
  const telRow = DATA.entries.find((e) => e.row === 1082);
  if (!telRow || telRow.symbol !== "TEL") throw new Error("ceremony-data has no Base TEL row 1082");
  if ((await tIdx(TEL_NEW)) !== telRow.canonicalAssetId) throw new Error("upgraded TEL contract is not indexed to row 1082");
  if ((await tIdx(TEL_OLD)) !== ethers.ZeroHash) throw new Error("old TEL contract is indexed");
  const ogLines = [];
  for (const [row, sym] of [[138, "TigerOG"], [999, "LionOG"], [1000, "FrogOG"]]) {
    const e = DATA.entries.find((x) => x.row === row);
    if (!e || e.symbol !== sym) throw new Error(`ceremony-data has no founder-override row ${row} ${sym}`);
    const k = ethers.keccak256(ethers.solidityPacked(["string", "bytes32"], ["Base", e.canonicalAssetId]));
    if ((await V.assetPrecisionTable(k)).canonicalAssetId !== e.canonicalAssetId) throw new Error(`${sym} row ${row} not registered`);
    const t = DATA.tokenAddresses.find((x) => x.canonicalAssetId === e.canonicalAssetId);
    if (!t || (await tIdx(t.token)) !== e.canonicalAssetId) throw new Error(`${sym} row ${row} token not indexed`);
    ogLines.push(`${sym} row ${row} ${short(t.token)}`);
  }
  const stableFlagged = [];
  for (const e of DATA.entries) {
    const k = ethers.keccak256(ethers.solidityPacked(["string", "bytes32"], ["Base", e.canonicalAssetId]));
    if (await V.usdStableRow(k)) stableFlagged.push(e);
  }
  const wantStable = DATA.tokenAddresses.filter((t) => ["0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", "0xfde4c96c8593536e31f229ea8f37b2ada2699bb2"].includes(t.token.toLowerCase())).map((t) => t.canonicalAssetId).sort();
  const gotStable = stableFlagged.map((e) => e.canonicalAssetId).sort();
  if (JSON.stringify(gotStable) !== JSON.stringify(wantStable)) throw new Error(`stablecoin flag on ${stableFlagged.map((e) => e.symbol).join(",")}, expected Base USDC and USDT only`);
  const revDLine = `Revision D: TEL row 1082 indexed at ${short(TEL_NEW)} (old ${short(TEL_OLD)} not indexed); founder override ${ogLines.join(", ")}; $0.95 flag on ${stableFlagged.map((e) => `${e.symbol} row ${e.row}`).join(", ")} only`;
  err("  " + revDLine);

  const maxTx = gasRows.reduce((m, x) => (x.gasLimit > m.gasLimit ? x : m), gasRows[0]);
  const total = gasRows.filter((x) => x.step <= 7).reduce((s, x) => s + x.gasUsed, 0n);
  err(`  ceremony transactions ${gasRows.filter((x) => x.step <= 7).length}, total gas used ${total}, largest gas limit ${maxTx.gasLimit} at step ${maxTx.step} (cap ${TX_GAS_CAP})`);
  for (const n of notes) err("  NOTE " + n);
  fs.writeFileSync(path.join(__dirname, "dryrun_gas.json"), JSON.stringify(gasRows.map((x) => ({ step: x.step, gasLimit: String(x.gasLimit), gasUsed: String(x.gasUsed), to: short(x.to), created: short(x.created) })), null, 1));
  process.stdout.write(MODE_LINE + "\n");
  process.stdout.write("ceremony would succeed\n");
  process.stdout.write(usdcLine + "\n");
  process.stdout.write(revDLine + "\n");
  process.stdout.write(recon.verdict + "\n");
  if (recon.verdict !== "reconciliation PASS") process.exitCode = 2;
}

main().then(() => process.exit(process.exitCode || 0)).catch((e) => {
  process.stdout.write(MODE_LINE + "\n");
  process.stdout.write(`ceremony would FAIL at step ${step} ${STEPS[step]}: ${scrub(e.shortMessage || e.reason || e.message).slice(0, 400)}\n`);
  process.stdout.write("--- dump ---\n" + scrub((e.stack || String(e)).split("\n").slice(0, 12).join("\n")) + "\n");
  if (gasRows.length) {
    const last = gasRows[gasRows.length - 1];
    process.stdout.write(`last tx: step ${last.step} gasLimit ${last.gasLimit} gasUsed ${last.gasUsed} to ${short(last.to)}\n`);
  }
  for (const n of notes) process.stdout.write("NOTE " + scrub(n) + "\n");
  process.exit(1);
});
