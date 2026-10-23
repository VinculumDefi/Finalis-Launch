// Ceremony dry-run. Runs the Base ceremony exactly as base.html does
// (baseCeremonyFlow.runBaseCeremony, built ceremony.json artifacts, the
// 487-row ceremony-data.json, publicProviders for the six non-Base lock
// checks) against a LOCAL fork of Base mainnet, then checks every reader
// against real data. Nothing is broadcast: the signer is a local Hardhat
// test account on the in-process fork and the six public RPCs are only read.
//
// stdout is exactly one line: "ceremony would succeed", or
// "ceremony would FAIL at step <n> <name>: <reason>" followed by the dump.
// Progress goes to stderr.
// Run: cd base-contracts && npm run ceremony:dryrun
//
// Simulate mode (npm run ceremony:dryrun:simulate, or dryrun.sh
// --simulate-non-base-locks, which sets DRYRUN_SIMULATE_NON_BASE_LOCKS=1):
// the live non-Base locks are old code, and the fixed CommitmentVaultLock can
// only be put on the six chains by the operator. This mode starts a LOCAL
// Hardhat fork of each of the six chains, deploys the fixed
// CommitmentVaultLock from ceremony.json there (a throwaway random key, only
// on the local forks), checks its masked runtime hash equals the pinned
// CVL_RUNTIME_HASH, and then runs steps 3 to 15 against those simulated
// locks. stdout then starts with a "mode: SIMULATED" line before the verdict.
// It says what would happen after the operator redeploys; it is not a check
// of the live locks. Live headers and receipts (steps 12 and 13) are still
// read from the public RPCs. The default mode is unchanged.
const path = require("path");
const fs = require("fs");
const hre = require("hardhat");
const { ethers, network } = hre;
const BC = path.resolve(__dirname, "../../base-contracts");
const art = require(path.join(BC, "scripts/deploy-pages/ceremony.json"));
const DATA = require(path.join(BC, "scripts/deploy-pages/ceremony-data.json"));
const FLOW = require(path.join(BC, "scripts/deploy-pages/baseCeremonyFlow.js"));
const PROOF = require(path.join(BC, "test/lib/ethProof.cjs"));
const RECON = require("../reconciliation/reconcile.cjs");
const RPCS = require("../reconciliation/rpcs.cjs");

const TX_GAS_CAP = 16_777_216n; // Base Azul (May 28, 2026): EIP-7825 per-transaction gas maximum
// The live 5% non-Base lock (same address on all six EVM chains), from
// deployment/BASE44_LIVE_CONFIG_2026-10-22.md. The page has it typed in.
const LIVE_NON_BASE_LOCK = process.env.DRYRUN_NON_BASE_LOCK || "0x115b2B47330cD1b7550D347f44df2e151D4A626E";
const SIMULATE = process.env.DRYRUN_SIMULATE_NON_BASE_LOCKS === "1";
const short = (a) => (typeof a === "string" && /^0x[0-9a-fA-F]{40}$/.test(a) ? a.slice(0, 6) + "..." + a.slice(-4) : a);
const scrub = (s) => String(s).replace(/0x[0-9a-fA-F]{40}/g, (a) => short(a));
const err = (...a) => process.stderr.write(scrub(a.join(" ")) + "\n");
const coder = ethers.AbiCoder.defaultAbiCoder();

const STEPS = [
  "inputs and artifacts",
  "fork is Base mainnet",
  SIMULATE
    ? "SIMULATED non-Base locks: deploy the fixed CommitmentVaultLock on local forks of the six chains, masked hash, slot 0, devFund, 5% fee"
    : "six live non-Base locks (eth_getCode, slot 0, devFund, 5% fee) over public RPCs",
  "deploy VCLM, CHONX, Verifier, Forge, Stake",
  "deploy Base lock",
  "initialize VCLM and CHONX, deploy and register 15 readers",
  "registry rows in batches of 50",
  "token address index",
  "aliases, Dev Funds, price run 1, poster hand-over, finalize",
  "post-finalize state",
  "Base reader with a real lock on the fork",
  SIMULATE ? "EVM readers bound to the simulated locks and their slot 0" : "EVM readers bound to the live locks and real slot 0",
  "EVM readers on real mainnet receipts",
  "Ethereum reader on a real finalized header",
  "UTXO, Stellar and XRPL reader wiring",
  "Rig 10 reconciliation: deployed set vs artifacts and ceremony-data",
];
let step = 0;
const gasRows = [];
const notes = [];
function at(n) { step = n; err(`[step ${n}] ${STEPS[n]}`); }

// ---- simulate mode: local forks of the six non-Base chains ----
const { spawn } = require("child_process");
const children = [];
function stopForks() { for (const c of children) { try { c.kill("SIGKILL"); } catch (_) {} } children.length = 0; }
process.on("exit", stopForks);
async function waitRpc(url, chainId, ms) {
  const t0 = Date.now();
  for (;;) {
    try {
      const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }) });
      const j = await r.json();
      if (BigInt(j.result) === BigInt(chainId)) return;
      throw new Error(`fork answered chain id ${j.result}, expected ${chainId}`);
    } catch (e) {
      if (/expected/.test(e.message)) throw e;
      if (Date.now() - t0 > ms) throw new Error(`local fork at ${url} did not start in ${ms / 1000}s`);
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}
async function simulateNonBaseLocks() {
  const cli = path.join(BC, "node_modules/hardhat/internal/cli/cli.js");
  const cfg = path.join(__dirname, "hardhat.simfork.config.cjs");
  const basePort = Number(process.env.DRYRUN_SIM_PORT || 18700);
  const provs = {};
  const tail = {};
  FLOW.EVM_ENVS.forEach((env, i) => {
    const port = basePort + i;
    const forkUrl = process.env[`DRYRUN_SIM_RPC_${i}`] || RPCS.URLS[env] || FLOW.EVM_RPC[env].url;
    const c = spawn(process.execPath, [cli, "--config", cfg, "node", "--hostname", "127.0.0.1", "--port", String(port)], {
      cwd: BC, env: { ...process.env, SIM_FORK_URL: forkUrl, SIM_CHAIN_ID: String(FLOW.EVM_RPC[env].chainId), NODE_OPTIONS: "--max-old-space-size=1536" }, stdio: ["ignore", "pipe", "pipe"],
    });
    tail[env] = "";
    const keep = (d) => { tail[env] = (tail[env] + d.toString()).slice(-400); };
    c.stdout.on("data", keep); c.stderr.on("data", keep);
    children.push(c);
    provs[env] = { url: `http://127.0.0.1:${port}`, port };
  });
  const out = {};
  for (const env of FLOW.EVM_ENVS) {
    const chainId = FLOW.EVM_RPC[env].chainId;
    try { await waitRpc(provs[env].url, chainId, 120000); }
    catch (e) { throw new Error(`${env}: ${e.message}; fork log: ${scrub(tail[env]).replace(/\s+/g, " ").slice(-200)}`); }
    out[env] = new ethers.JsonRpcProvider(provs[env].url, chainId, { staticNetwork: true, batchMaxCount: 1 });
  }
  // One throwaway key, funded only on the local forks, so nonce 0 gives the
  // same lock address on all six chains (as the operator's deployment does).
  const key = ethers.Wallet.createRandom();
  let addr = null;
  const res = {};
  for (const env of FLOW.EVM_ENVS) {
    const p = out[env];
    await p.send("hardhat_setBalance", [key.address, "0x3635C9ADC5DEA00000"]);
    if ((await p.getTransactionCount(key.address)) !== 0) throw new Error(`${env}: throwaway key already has a nonce on the fork`);
    const w = key.connect(p);
    const dev = (DATA.evmDevFunds && DATA.evmDevFunds[env]) || DATA.devFund;
    const f = new ethers.ContractFactory(art.CommitmentVaultLock.abi, art.CommitmentVaultLock.bytecode, w);
    const c = await f.deploy(env, dev);
    await c.waitForDeployment();
    const a = ethers.getAddress(await c.getAddress());
    if (addr && a !== addr) throw new Error(`${env}: simulated lock address differs from the other chains`);
    addr = a;
    const h = FLOW.maskedCodeHash(ethers, await p.getCode(a));
    if (h.toLowerCase() !== FLOW.CVL_RUNTIME_HASH.toLowerCase()) throw new Error(`${env}: simulated lock masked hash ${h} != pinned ${FLOW.CVL_RUNTIME_HASH}`);
    res[env] = h;
  }
  return { providers: out, lock: addr, hashes: res };
}

async function main() {
  at(0);
  for (const n of ["TokenVCLM", "TokenCHONX", "VinculumFinalisVerifier", "VinculumFinalisSynth", "VinculumFinalisStake", "BaseCommitmentVaultLock", "BaseLockRecordVerifier"]) {
    if (!art[n] || !art[n].bytecode || art[n].bytecode.length < 10) throw new Error(`ceremony.json has no bytecode for ${n}`);
    const built = await hre.artifacts.readArtifact(n).catch(() => null);
    if (built && built.bytecode !== art[n].bytecode) notes.push(`ceremony.json ${n} bytecode differs from the current Hardhat build (ceremony uses ceremony.json)`);
  }
  if (DATA.entries.length !== 487) throw new Error(`registry has ${DATA.entries.length} rows, expected 487`);
  if (DATA.tokenAddresses.length !== 475) throw new Error(`token index has ${DATA.tokenAddresses.length} rows, expected 475`);
  err(`  registry rows ${DATA.entries.length}, token addresses ${DATA.tokenAddresses.length}, registry sha256 ${String(DATA.registrySha256).slice(0, 12)}`);

  at(1);
  const net = await ethers.provider.getNetwork();
  if (net.chainId !== 8453n) throw new Error(`chain id ${net.chainId}, expected 8453 (run with RIG_FORK=base)`);
  const fb = await ethers.provider.getBlock("latest");
  err(`  forked Base block ${fb.number}, block gas limit ${fb.gasLimit}`);

  // The page connects MetaMask; here a local Hardhat test account stands in.
  const [signer] = await ethers.getSigners();
  const orig = signer.sendTransaction.bind(signer);
  signer.sendTransaction = async (tx) => {
    const resp = await orig(tx);
    const rc = await resp.wait();
    gasRows.push({ step, gasLimit: resp.gasLimit, gasUsed: rc.gasUsed, to: rc.to, created: rc.contractAddress });
    if (resp.gasLimit > TX_GAS_CAP) throw new Error(`transaction gas limit ${resp.gasLimit} (used ${rc.gasUsed}) is above the Base per-transaction maximum ${TX_GAS_CAP}`);
    return resp;
  };

  at(2);
  // providers: the six public read-only RPCs (live headers, receipts).
  // lockProviders / NB: where the non-Base lock is read. Default mode: the
  // live lock over the public RPCs. Simulate mode: the fixed lock on local forks.
  const providers = FLOW.publicProviders(ethers);
  let lockProviders = providers;
  let NB = LIVE_NON_BASE_LOCK;
  if (SIMULATE) {
    err("  SIMULATED non-Base locks (local forks), not live: the operator must still redeploy the fixed CommitmentVaultLock on the six chains");
    const sim = await simulateNonBaseLocks();
    lockProviders = sim.providers;
    NB = sim.lock;
    err(`  simulated fixed lock ${short(NB)} on 6 local forks, masked runtime hash ${FLOW.CVL_RUNTIME_HASH.slice(0, 6)}...${FLOW.CVL_RUNTIME_HASH.slice(-4)} on every chain`);
  }
  const newLocks = Object.fromEntries(FLOW.EVM_ENVS.map((e) => [e, NB]));
  // The flow re-checks with the same providers; check here too so a refusal is
  // attributed to this step.
  await FLOW.verifyAllNonBaseLocks(ethers, lockProviders, newLocks, DATA);
  err(SIMULATE ? `  simulated non-Base lock ${short(NB)} passes on all 6 local forks` : `  live non-Base lock ${short(LIVE_NON_BASE_LOCK)} passes on all 6 chains`);

  at(3);
  const r = await FLOW.runBaseCeremony({
    ethers, signer, art, data: DATA, newLocks, providersByEnv: lockProviders,
    log: (s) => {
      for (const line of String(s).split("\n")) {
        if (/^Base lock/.test(line)) at(5);
        else if (/^registry /.test(line) && step < 6) at(6);
        else if (/^token addresses /.test(line) && step < 7) at(7);
        if (/^token addresses 475\/475/.test(line)) at(8);
        if (/^(registry|token addresses) /.test(line) && !/\/(487|475)$/.test(line)) continue;
        err("  " + line);
      }
      if (/^VCLM /.test(String(s))) at(4);
    },
  });

  at(9);
  const V = r.verifier;
  if (!(await V.configurationFinalized())) throw new Error("not finalized");
  if (ethers.getAddress(await V.scheduledPricePoster()) !== ethers.getAddress(DATA.scheduledPricePoster)) throw new Error("poster is not the live poster");
  try { await V.registerChainVerifier.staticCall("Solana", await r.lock.getAddress()); throw new Error("registerChainVerifier still open after finalize"); }
  catch (e) { if (/still open/.test(e.message)) throw e; }
  for (const env of ["Base", ...FLOW.EVM_ENVS]) if ((await V.chainVerifiers(env)) !== (await r.readers[env].getAddress())) throw new Error(`${env} reader not registered`);
  if ((await V.chainVerifiers("Solana")) !== ethers.ZeroAddress) throw new Error("Solana reader registered");
  err(`  finalized; launch ${r.launch}; live poster set; Solana not registered`);

  at(10);
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

  at(11);
  for (const env of FLOW.EVM_ENVS) {
    const rd = r.readers[env];
    const cfg = FLOW.EVM_RPC[env];
    if (ethers.getAddress(await rd.lock()) !== ethers.getAddress(NB)) throw new Error(`${env} reader lock() is not the ${SIMULATE ? "simulated" : "live"} lock`);
    if ((await rd.chainId()) !== BigInt(cfg.chainId)) throw new Error(`${env} reader chain id ${await rd.chainId()} != ${cfg.chainId}`);
    const word = await lockProviders[env].getStorage(NB, 0);
    if ((await rd.environmentWord()).toLowerCase() !== word.toLowerCase()) throw new Error(`${env} reader environment word does not match ${SIMULATE ? "the simulated lock's" : "real"} slot 0 on ${env}`);
  }
  err(SIMULATE ? "  6 EVM readers: lock(), chainId() and environment word match the simulated locks' slot 0" : "  6 EVM readers: lock(), chainId() and environment word match the live locks' real slot 0");

  at(12);
  const fx = { Ethereum: "ethereum", Arbitrum: "arbitrum", Optimism: "optimism", Polygon: "polygon", "BNB Smart Chain": "bnb_smart_chain", Avalanche: "avalanche" };
  for (const env of FLOW.EVM_ENVS) {
    const F = require(path.join(BC, `test/fixtures/${fx[env]}_mainnet_receipt.json`));
    if (BigInt(F.chainId) !== BigInt(FLOW.EVM_RPC[env].chainId)) throw new Error(`${env} fixture chain id mismatch`);
    for (const x of F.receipts) {
      const [h, n, status] = await r.readers[env].proveReceipt(F.headerRlp, x.receipt, x.index, x.nodes);
      if (h !== F.blockHash || n !== BigInt(F.blockNumber) || status !== BigInt(x.status)) throw new Error(`${env} reader rejected a real receipt at block ${F.blockNumber}`);
    }
    // Confirm the fixture header is real chain history (read-only RPC).
    const live = await providers[env].send("eth_getBlockByNumber", ["0x" + BigInt(F.blockNumber).toString(16), false]);
    if (!live || live.hash !== F.blockHash) throw new Error(`${env} fixture block ${F.blockNumber} is not on the live chain`);
  }
  err("  6 EVM readers prove real mainnet receipts against real headers (headers confirmed on each live chain)");

  at(13);
  const ethP = providers.Ethereum;
  const fin = await ethP.send("eth_getBlockByNumber", ["finalized", false]);
  const hdr = PROOF.encodeBlockHeader(fin);
  if (ethers.keccak256(hdr) !== fin.hash) throw new Error("re-encoded finalized Ethereum header does not hash to its block hash");
  const ev = (headerRlp) => coder.encode(["tuple(bytes,bytes,uint256,bytes[],uint256,bytes[],bytes[],bytes[])"], [[headerRlp, "0x", 0, [], 0, [], [], []]]);
  const claim = (h, n) => coder.encode(["uint256", "bytes32", "uint256"], [1, h, n]);
  const er = r.readers.Ethereum;
  const [ok] = await er.verifyFinality(ev(hdr), claim(fin.hash, BigInt(fin.number)));
  if (!ok) throw new Error("Ethereum reader refused a real finalized header");
  err(`  Ethereum reader accepts real finalized block ${BigInt(fin.number)}`);
  // FINDING-HH-003 context (not a ceremony failure): a header that is not
  // Ethereum history is accepted the same way.
  const local = await ethers.provider.send("eth_getBlockByNumber", ["latest", false]);
  const fake = { ...fin, parentHash: local.hash, stateRoot: local.stateRoot, receiptsRoot: local.receiptsRoot, number: fin.number };
  const fhdr = PROOF.encodeBlockHeader(fake);
  try {
    const [ok2] = await er.verifyFinality(ev(fhdr), claim(ethers.keccak256(fhdr), BigInt(fin.number)));
    if (ok2) notes.push(`FINDING-HH-003: the Ethereum reader also accepts a made-up header at height ${BigInt(fin.number)} (hash ${ethers.keccak256(fhdr).slice(0, 10)}) that is not Ethereum history`);
  } catch (e) { notes.push("made-up Ethereum header refused: " + scrub(e.shortMessage || e.message).slice(0, 120)); }

  at(14);
  for (const u of DATA.readers.utxo) {
    const rd = r.readers[u.env];
    if ((await rd.devFundScript()).toLowerCase() !== u.devFundScript.toLowerCase()) throw new Error(`${u.env} reader Dev Fund script mismatch`);
    if ((await rd.environmentId()) !== u.env) throw new Error(`${u.env} reader environment mismatch`);
  }
  const st = r.readers[DATA.readers.stellar.env];
  if ((await st.devFundKey()).toLowerCase() !== DATA.readers.stellar.devFundKey.toLowerCase()) throw new Error("Stellar Dev Fund key mismatch");
  if ((await st.networkId()).toLowerCase() !== DATA.readers.stellar.networkId.toLowerCase()) throw new Error("Stellar network id mismatch");
  const xr = r.readers[DATA.readers.xrpl.env];
  const xrAbi = art[DATA.readers.xrpl.contract].abi.find((f) => f.type === "function" && /devFund/i.test(f.name) && f.inputs.length === 0);
  if (!xrAbi) throw new Error("XRPL reader exposes no Dev Fund getter");
  const xv = await xr[xrAbi.name]();
  if (String(xv).toLowerCase() !== String(DATA.readers.xrpl.devFundAccount).toLowerCase()) throw new Error("XRPL Dev Fund account mismatch");
  err("  6 UTXO readers, Stellar and XRPL carry the ceremony-data Dev Fund wiring");

  at(15);
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
  const tokP = { ...RPCS.providers(ethers, FLOW.EVM_ENVS), Base: ethers.provider };
  const recon = await RECON.reconcile({
    hre, P: ethers.provider, set, DATA, art, FLOW, mode: "dryrun", nonBaseProviders: lockProviders, nonBaseLock: NB,
    operator: signer.address, txs: cerTxs, fromBlock: fb.number + 1, simFrom: signer.address, tokenProviders: tokP, receiptLogs: cerTxs.flatMap((t) => t.logs),
    txListComplete: { ok: cerTxs.every((t, i) => i === 0 || t.nonce === cerTxs[i - 1].nonce + 1), detail: `${cerTxs.length} txs, local fork blocks ${fb.number + 1}..${latest}` },
    log: err,
  });
  fs.writeFileSync(path.join(__dirname, "../reconciliation/reconciliation_dryrun.json"), JSON.stringify(recon, null, 1));
  err(`  reconciliation: ${JSON.stringify(recon.counts)}`);

  const maxTx = gasRows.reduce((m, x) => (x.gasLimit > m.gasLimit ? x : m), gasRows[0]);
  const total = gasRows.filter((x) => x.step <= 8).reduce((s, x) => s + x.gasUsed, 0n);
  err(`  ceremony transactions ${gasRows.filter((x) => x.step <= 8).length}, total gas used ${total}, largest gas limit ${maxTx.gasLimit} at step ${maxTx.step} (cap ${TX_GAS_CAP})`);
  for (const n of notes) err("  NOTE " + n);
  fs.writeFileSync(path.join(__dirname, "dryrun_gas.json"), JSON.stringify(gasRows.map((x) => ({ step: x.step, gasLimit: String(x.gasLimit), gasUsed: String(x.gasUsed), to: short(x.to), created: short(x.created) })), null, 1));
  stopForks();
  if (SIMULATE) process.stdout.write("mode: SIMULATED non-Base locks (fixed CommitmentVaultLock on local forks of the six chains, not the live locks)\n");
  process.stdout.write("ceremony would succeed\n");
  process.stdout.write(recon.verdict + "\n");
  if (recon.verdict !== "reconciliation PASS") process.exitCode = 2;
}

main().then(() => process.exit(process.exitCode || 0)).catch((e) => {
  stopForks();
  if (SIMULATE) process.stdout.write("mode: SIMULATED non-Base locks (fixed CommitmentVaultLock on local forks of the six chains, not the live locks)\n");
  process.stdout.write(`ceremony would FAIL at step ${step} ${STEPS[step]}: ${scrub(e.shortMessage || e.reason || e.message).slice(0, 400)}\n`);
  process.stdout.write("--- dump ---\n" + scrub((e.stack || String(e)).split("\n").slice(0, 12).join("\n")) + "\n");
  if (gasRows.length) {
    const last = gasRows[gasRows.length - 1];
    process.stdout.write(`last tx: step ${last.step} gasLimit ${last.gasLimit} gasUsed ${last.gasUsed} to ${short(last.to)}\n`);
  }
  for (const n of notes) process.stdout.write("NOTE " + scrub(n) + "\n");
  process.exit(1);
});
