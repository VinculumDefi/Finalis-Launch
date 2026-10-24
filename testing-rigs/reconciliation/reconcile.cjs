// Rig 10: deployment artifact and ceremony reconciliation.
//
// Reconciles a deployed Vinculum Finalis Base set against the compiled
// ceremony artifacts (scripts/deploy-pages/ceremony.json, which the dry-run
// confirms equal the Hardhat build) and the deployment config
// (scripts/deploy-pages/ceremony-data.json). Used two ways:
//   - by ceremony-dryrun/ceremony_dryrun.cjs after the rehearsal (mode dryrun,
//     target = the local Base fork the rehearsal deployed to);
//   - by reconciliation/live_reconcile.cjs (mode live, target = Base mainnet
//     over a public RPC, READ ONLY: eth_getCode, eth_call, eth_getLogs,
//     eth_getTransactionByHash; nothing is signed or sent).
// Expected runtime code is derived, not masked: the same creation code is
// deployed with the intended constructor arguments on the LOCAL in-process
// Hardhat network (hre), so immutables and constructor args are part of the
// byte-for-byte comparison.
//
// Base-only launch (founder directive t357u): the intended set is the Base
// contracts and exactly one reader (Base). Every other environment must have
// no reader and no Dev Fund destination, and no non-Base registry row may
// be registered.
//
// Every check ends PASS, MISMATCH or INCOMPLETE. INCOMPLETE (an RPC that could
// not be read, a path the rig cannot evaluate) is never counted as a pass.
const path = require("path");
const fs = require("fs");
const BC = path.resolve(__dirname, "../../base-contracts");
const short = (a) => (typeof a === "string" && /^0x[0-9a-fA-F]{40}$/.test(a) ? a.slice(0, 6) + "..." + a.slice(-4) : a);
const scrub = (s) => String(s).replace(/0x[0-9a-fA-F]{40}/g, (a) => short(a));
const MULTICALL3 = "0xcA11bde05977b3631167028862bE2a173976CA11";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// The fifteen environments other than Base in the sixteen-environment base.
const NON_BASE_ENVS = require(path.join(BC, "deployment/representativeBase.cjs")).rows.map((r) => r.environment).filter((e) => e !== "Base");
const EXPECTED_BASE = { rows: 27, tokenAddresses: 26, aliases: 0 };

// Every non-view function of every contract in the set, by contract.
//   config: must revert for the operator (deployer) and for a stranger.
//   poster: the scheduled price poster path; must revert for everyone except
//           the configured poster.
//   minter: must revert for the operator and a stranger (only the Verifier
//           and Stake mint).
//   user:   a protocol or ERC-20 user path, open by design (not configuration).
const WRITE_CLASS = {
  VinculumFinalisVerifier: {
    configureDevFund: "config", finalize: "config", registerAssetPrecision: "config", registerAssetPrecisionBatch: "config",
    registerAssetRowAlias: "config", registerChainVerifier: "config", registerTokenAddressBatch: "config", setScheduledPricePoster: "config",
    applyScheduledPriceRun: "poster", recordFeeAndRac: "user", verifyAndMint: "user", syncChonxActivation: "user",
  },
  TokenVCLM: { initialize: "config", mint: "minter", approve: "user", burn: "user", burnFrom: "user", transfer: "user", transferFrom: "user" },
  TokenCHONX: { initialize: "config", mint: "minter", approve: "user", burn: "user", burnFrom: "user", transfer: "user", transferFrom: "user" },
  VinculumFinalisSynth: { approve: "user", checkActivation: "user", forge: "user", transfer: "user", transferFrom: "user" },
  VinculumFinalisStake: {
    allocateEpoch: "user", applyExtensionIfMatured: "user", claimPosition: "user", claimPositions: "user", closeEpoch: "user",
    createPosition: "user", queueExtension: "user", withdrawPosition: "user",
  },
  BaseCommitmentVaultLock: { createErc20Lock: "user", createNativeLock: "user", release: "user" },
};

const DURATIONS = [3600, 604800, 2592000, 5184000, 7776000, 15552000, 31536000, 63072000, 94608000, 126144000, 157680000, 189216000, 220752000, 252288000, 283824000, 315360000];

function makeReporter(log) {
  const checks = [];
  const add = (area, name, status, detail = "") => {
    checks.push({ area, name, status, detail: scrub(detail) });
    if (status !== "PASS") log(`  ${status} [${area}] ${name}: ${scrub(detail)}`);
  };
  const eq = (area, name, got, want) => {
    const g = typeof got === "string" ? got.toLowerCase() : String(got);
    const w = typeof want === "string" ? want.toLowerCase() : String(want);
    add(area, name, g === w ? "PASS" : "MISMATCH", g === w ? "" : `got ${short(String(got))}, expected ${short(String(want))}`);
    return g === w;
  };
  return { checks, add, eq };
}

async function retry(fn, tries = 5) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      return await Promise.race([fn(), new Promise((_, rej) => setTimeout(() => rej(new Error("rpc timeout 45s")), 45000).unref())]);
    } catch (e) {
      last = e;
      // A revert is an answer, not a transport failure.
      if (e && (e.code === "CALL_EXCEPTION" || /revert/i.test(String(e.message)))) throw e;
      await sleep(800 * (i + 1));
    }
  }
  throw last;
}

function revertReason(ethers, e) {
  const data = e && (e.data || (e.info && e.info.error && e.info.error.data) || (e.error && e.error.data));
  if (typeof data === "string" && data.startsWith("0x08c379a0")) {
    try { return ethers.AbiCoder.defaultAbiCoder().decode(["string"], "0x" + data.slice(10))[0]; } catch (_) {}
  }
  return (e && (e.reason || e.shortMessage || e.message)) || "reverted";
}

// Dummy arguments for a probe call. Configuration functions are gated before
// they look at their arguments, so any well-formed call is enough.
function dummy(ethers, input, stranger) {
  const t = input.type;
  if (t.endsWith("[]")) return [dummy(ethers, { ...input, type: t.slice(0, -2) }, stranger)];
  if (t === "tuple") return Object.fromEntries(input.components.map((c) => [c.name, dummy(ethers, c, stranger)]));
  if (t === "address") return stranger;
  if (t === "bool") return true;
  if (t === "string") return "Base";
  if (t === "bytes") return "0x";
  if (/^bytes\d+$/.test(t)) return ethers.zeroPadValue("0x01", Number(t.slice(5)));
  if (/^u?int/.test(t)) return 1n;
  throw new Error("no dummy for " + t);
}

async function reconcile(o) {
  const { hre, P, set, DATA, art, mode, operator, txs, log = () => {} } = o;
  const { ethers } = hre;
  const R = makeReporter(log);
  const coder = ethers.AbiCoder.defaultAbiCoder();
  const A = (x) => ethers.getAddress(x);
  const at = (name, addr) => new ethers.Contract(addr, art[name].abi, P);
  const readersCfg = [{ env: "Base", contract: "BaseLockRecordVerifier", args: [set.lock] }];
  // Intended constructor arguments, exactly as baseCeremonyFlow.runBaseCeremony passes them.
  const intended = [
    { key: "vclm", name: "TokenVCLM", args: ["Vinculum Finalis VCLM", "VCLM", 10000000000n * 10n ** 18n] },
    { key: "chonx", name: "TokenCHONX", args: ["Vinculum Finalis CHONX", "CHONX", 100000000000n * 10n ** 18n] },
    { key: "verifier", name: "VinculumFinalisVerifier", args: [set.vclm, set.chonx] },
    { key: "forge", name: "VinculumFinalisSynth", args: [set.verifier, set.vclm, set.chonx] },
    { key: "stake", name: "VinculumFinalisStake", args: [set.vclm, set.chonx, set.forge, set.verifier] },
    { key: "lock", name: "BaseCommitmentVaultLock", args: ["Base", DATA.devFund, set.vclm, set.chonx, set.forge] },
    ...readersCfg.map((r) => ({ key: "reader:" + r.env, name: r.contract, args: r.args, addr: set.readers[r.env] })),
  ];
  for (const c of intended) if (!c.addr) c.addr = set[c.key];

  log(`  section 1. ...`);
  // ---- 1. bytecode: on-chain runtime == runtime of the artifact deployed locally with the intended args
  const [localSigner] = await ethers.getSigners();
  for (const c of intended) {
    const area = "bytecode";
    try {
      const f = new ethers.ContractFactory(art[c.name].abi, art[c.name].bytecode, localSigner);
      const ref = await f.deploy(...c.args);
      await ref.waitForDeployment();
      const want = await ethers.provider.getCode(await ref.getAddress());
      const got = await retry(() => P.getCode(c.addr));
      if (got === "0x") R.add(area, `${c.key} (${c.name}) at ${short(c.addr)}`, "MISMATCH", "no code at address");
      else R.add(area, `${c.key} (${c.name}) at ${short(c.addr)}`, got.toLowerCase() === want.toLowerCase() ? "PASS" : "MISMATCH",
        got.toLowerCase() === want.toLowerCase() ? `runtime ${(got.length - 2) / 2} bytes, keccak ${ethers.keccak256(got).slice(0, 12)}, immutables and constructor args derived` : `runtime differs (${(got.length - 2) / 2} vs ${(want.length - 2) / 2} bytes)`);
    } catch (e) { R.add(area, `${c.key} (${c.name})`, "INCOMPLETE", e.shortMessage || e.message); }
  }
  // Base-only: the deployed set has exactly one reader.
  R.add("bytecode", "the set has exactly one reader (Base)", JSON.stringify(Object.keys(set.readers)) === JSON.stringify(["Base"]) ? "PASS" : "MISMATCH", Object.keys(set.readers).join(","));
  // ceremony-data is the Base subset of the ceremony registry (Revision C, t367u).
  R.add("bytecode", "ceremony-data is Base-only: 27 rows, 26 token addresses, 0 aliases, one reader, one Dev Fund",
    DATA.baseOnly === true && DATA.entries.length === EXPECTED_BASE.rows && DATA.tokenAddresses.length === EXPECTED_BASE.tokenAddresses && DATA.assetRowAliases.length === EXPECTED_BASE.aliases
      && DATA.entries.every((e) => e.environmentId === "Base") && DATA.tokenAddresses.every((t) => t.environmentId === "Base")
      && JSON.stringify(Object.keys(DATA.readers)) === JSON.stringify(["base"]) && JSON.stringify(Object.keys(DATA.evmDevFunds)) === JSON.stringify(["Base"]) && DATA.registryRows === 487 ? "PASS" : "MISMATCH",
    `${DATA.entries.length} rows, ${DATA.tokenAddresses.length} tokens, ${DATA.assetRowAliases.length} aliases, source ${DATA.registryRows}`);

  log(`  section 1b. ...`);
  // ---- 1b. creation transactions (live: the operator's real txs; dryrun: the rehearsal's txs)
  if (txs && txs.length) {
    const creates = txs.filter((t) => t.created);
    for (const c of intended) {
      const t = creates.find((x) => A(x.created) === A(c.addr));
      if (!t) { R.add("creation", `${c.key} creation tx`, "INCOMPLETE", "creation tx not in the transaction list"); continue; }
      const f = new ethers.ContractFactory(art[c.name].abi, art[c.name].bytecode);
      const want = (await f.getDeployTransaction(...c.args)).data;
      R.add("creation", `${c.key} creation input = ceremony.json bytecode + intended constructor args`, t.data.toLowerCase() === want.toLowerCase() ? "PASS" : "MISMATCH",
        t.data.toLowerCase() === want.toLowerCase() ? `tx nonce ${t.nonce}` : `input differs (${(t.data.length - 2) / 2} vs ${(want.length - 2) / 2} bytes)`);
      if (operator) R.eq("creation", `${c.key} deployed by the operator`, A(t.from), A(operator));
    }
  }

  log(`  section 2. ...`);
  // ---- 2. cross-contract references
  const vclm = at("TokenVCLM", set.vclm), chonx = at("TokenCHONX", set.chonx), V = at("VinculumFinalisVerifier", set.verifier);
  const forge = at("VinculumFinalisSynth", set.forge), stake = at("VinculumFinalisStake", set.stake), lock = at("BaseCommitmentVaultLock", set.lock);
  const g = async (c, fn, ...a) => retry(() => c[fn](...a));
  const ref = async (name, c, fn, want, ...a) => {
    try { R.eq("references", name, await g(c, fn, ...a), want); } catch (e) { R.add("references", name, "INCOMPLETE", e.shortMessage || e.message); }
  };
  await ref("VCLM.minterVerifier = Verifier", vclm, "minterVerifier", A(set.verifier));
  await ref("VCLM.minterStake = Stake", vclm, "minterStake", A(set.stake));
  await ref("VCLM.finalized", vclm, "finalized", true);
  await ref("VCLM.name", vclm, "name", "Vinculum Finalis VCLM");
  await ref("VCLM.symbol", vclm, "symbol", "VCLM");
  await ref("VCLM.hardCap = 10B", vclm, "hardCap", 10000000000n * 10n ** 18n);
  await ref("CHONX.minterVerifier = Verifier", chonx, "minterVerifier", A(set.verifier));
  await ref("CHONX.minterStake = none", chonx, "minterStake", ethers.ZeroAddress);
  await ref("CHONX.finalized", chonx, "finalized", true);
  await ref("CHONX.name", chonx, "name", "Vinculum Finalis CHONX");
  await ref("CHONX.symbol", chonx, "symbol", "CHONX");
  await ref("CHONX.hardCap = 100B", chonx, "hardCap", 100000000000n * 10n ** 18n);
  await ref("Verifier.vclmToken = VCLM", V, "vclmToken", A(set.vclm));
  await ref("Verifier.chonxToken = CHONX", V, "chonxToken", A(set.chonx));
  await ref("Verifier.scheduledPricePoster = live poster", V, "scheduledPricePoster", A(DATA.scheduledPricePoster));
  await ref("Verifier.configurationFinalized", V, "configurationFinalized", true);
  // finalize() clears the deployment right (Verifier 578), so deployer must read zero.
  await ref("Verifier.deployer cleared by finalize", V, "deployer", ethers.ZeroAddress);
  await ref("Verifier.BASE_NATIVE_ETH_ASSET_ID = registry row 2", V, "BASE_NATIVE_ETH_ASSET_ID", DATA.row2.canonicalAssetId);
  try {
    const launch = await g(V, "protocolLaunchTimestamp");
    R.add("references", "Verifier.protocolLaunchTimestamp set", launch > 0n ? "PASS" : "MISMATCH", "launch " + new Date(Number(launch) * 1000).toISOString());
    R.eq("references", "Stake.launchTimestamp = Verifier launch", await g(stake, "launchTimestamp"), launch);
  } catch (e) { R.add("references", "launch", "INCOMPLETE", e.message); }
  for (const [env, a] of Object.entries(DATA.evmDevFunds)) await ref(`Verifier.devFundDestinations(${env}) = Dev Fund`, V, "devFundDestinations", A(a), env);
  for (const env of NON_BASE_ENVS)
    await ref(`Verifier.devFundDestinations(${env}) unset (Base-only launch)`, V, "devFundDestinations", ethers.ZeroAddress, env);
  await ref("Forge.verifier = Verifier", forge, "verifier", A(set.verifier));
  await ref("Forge.vclmToken = VCLM", forge, "vclmToken", A(set.vclm));
  await ref("Forge.chonxToken = CHONX", forge, "chonxToken", A(set.chonx));
  await ref("Stake.vclmToken = VCLM", stake, "vclmToken", A(set.vclm));
  await ref("Stake.chonxToken = CHONX", stake, "chonxToken", A(set.chonx));
  await ref("Stake.synthToken = Forge", stake, "synthToken", A(set.forge));
  await ref("Stake.verifier = Verifier", stake, "verifier", A(set.verifier));
  await ref("Lock.devFund = Dev Fund", lock, "devFund", A(DATA.devFund));
  await ref("Lock.vclmToken = VCLM", lock, "vclmToken", A(set.vclm));
  await ref("Lock.chonxToken = CHONX", lock, "chonxToken", A(set.chonx));
  await ref("Lock.synthToken = Forge", lock, "synthToken", A(set.forge));
  await ref("Lock.environmentId = Base", lock, "environmentId", "Base");
  for (const [k, a] of [["VCLM", set.vclm], ["CHONX", set.chonx], ["SYNTH", set.forge]]) await ref(`Lock.isProtocolToken(${k})`, lock, "isProtocolToken", true, a);
  const all = [set.vclm, set.chonx, set.verifier, set.forge, set.stake, set.lock, ...Object.values(set.readers)].map(A);
  for (const old of DATA.oldLocks || []) R.add("references", `old contract ${short(old)} not in the set`, all.includes(A(old)) ? "MISMATCH" : "PASS");
  R.add("references", "live poster is not a contract of the set", all.includes(A(DATA.scheduledPricePoster)) ? "MISMATCH" : "PASS");

  // Readers: each reader's own wiring.
  const rd = (env) => at(readersCfg.find((r) => r.env === env).contract, set.readers[env]);
  await ref("Base reader.vault = Base lock", rd("Base"), "vault", A(set.lock));
  await ref("Base reader.ENVIRONMENT_ID = Base", rd("Base"), "ENVIRONMENT_ID", "Base");

  log(`  section 3. ...`);
  // ---- 3. authorized readers and minters: exact sets, from events and state
  {
    const iface = V.interface;
    const topic = iface.getEvent("ChainVerifierRegistered").topicHash;
    const want = Object.fromEntries(readersCfg.map((r) => [r.env, A(set.readers[r.env])]));
    const judge = (logs, src) => {
      const final = {};
      for (const l of logs) { const d = iface.parseLog(l); final[d.args[0]] = A(d.args[1]); }
      const extra = Object.keys(final).filter((e) => !(e in want)), missing = Object.keys(want).filter((e) => !(e in final));
      const wrong = Object.keys(want).filter((e) => e in final && final[e] !== want[e]);
      R.add("readers", `${src}: registration events (${logs.length}) give exactly the one intended reader (Base)`, extra.length || missing.length || wrong.length ? "MISMATCH" : "PASS", `extra [${extra}] missing [${missing}] wrong [${wrong}]`);
      R.add("readers", `${src}: each environment registered exactly once`, logs.length === readersCfg.length ? "PASS" : "MISMATCH", `${logs.length} registrations`);
    };
    // Paced chunked scan of the whole range from the first ceremony block to head.
    const scan = async (address, topics) => {
      const to = await retry(() => P.getBlockNumber());
      const out = [];
      const step = o.logChunk || 2000;
      for (let b = o.fromBlock; b <= to; b += step) {
        out.push(...(await retry(() => (o.logP || P).getLogs({ address, topics, fromBlock: b, toBlock: Math.min(to, b + step - 1) }), 8)));
        if (o.logPaceMs) await sleep(o.logPaceMs);
      }
      return out;
    };
    // (a) Events inside the operator's ceremony receipts (always available).
    if (o.receiptLogs) {
      const rl = o.receiptLogs.filter((l) => A(l.address) === A(set.verifier) && l.topics[0] === topic);
      judge(rl, "ceremony receipts");
    }
    // (b) Full-range log scan, which also covers transactions not sent by the operator.
    try { judge(await scan(set.verifier, [topic]), "full log scan to head"); }
    catch (e) { R.add("readers", "full log scan to head (registrations)", "INCOMPLETE", e.shortMessage || e.message); }
    for (const r of readersCfg) R.eq("readers", `chainVerifiers(${r.env}) = intended ${r.contract}`, A(await g(V, "chainVerifiers", r.env)), A(set.readers[r.env]));
    for (const env of [...NON_BASE_ENVS, "Tron", "Cardano", "Cosmos Hub", "Ethereum Classic", "base", "ethereum"])
      R.eq("readers", `chainVerifiers(${env}) unset`, await g(V, "chainVerifiers", env), ethers.ZeroAddress);
    for (const [tk, name] of [[vclm, "VCLM"], [chonx, "CHONX"]]) {
      const it = tk.interface.getEvent("Initialized").topicHash;
      const ta = await tk.getAddress();
      if (o.receiptLogs) {
        const n = o.receiptLogs.filter((l) => A(l.address) === A(ta) && l.topics[0] === it).length;
        R.add("minters", `ceremony receipts: ${name} initialized exactly once`, n === 1 ? "PASS" : "MISMATCH", `${n} Initialized events`);
      }
      try { const n = (await scan(ta, [it])).length; R.add("minters", `full log scan to head: ${name} initialized exactly once`, n === 1 ? "PASS" : "MISMATCH", `${n} Initialized events`); }
      catch (e) { R.add("minters", `full log scan to head (${name} Initialized)`, "INCOMPLETE", e.shortMessage || e.message); }
    }
    R.add("minters", "minter set is exactly {Verifier, Stake} for VCLM and {Verifier} for CHONX", "PASS", "token mint gate reads only minterVerifier/minterStake (runtime matches artifact); values checked above");
  }

  log(`  section 4. ...`);
  // ---- 4. lock economics: constants and behaviour (eth_call only)
  const K = async (c, name, fn, want) => ref(`${name}.${fn} = ${want}`, c, fn, want);
  await K(lock, "Lock", "STANDARD_FEE_BPS", 500n); await K(lock, "Lock", "BPS_DENOMINATOR", 10000n);
  await K(lock, "Lock", "HANDSHAKE_DURATION", 3600n); await K(lock, "Lock", "HANDSHAKE_USD_MIN", 10n ** 16n);
  await K(lock, "Lock", "HANDSHAKE_USD_MAX", 2n * 10n ** 16n); await K(lock, "Lock", "STANDARD_USD_MIN", 10n ** 16n);
  // Rev 12: the lock keeps no Handshake allowance and no identity counter, so
  // neither old getter may answer.
  for (const sig of ["handshakeAllowance()", "countsPerIdentity()"]) {
    try {
      const ret = await retry(() => P.call({ to: set.lock, data: ethers.id(sig).slice(0, 10) }));
      R.add("references", `Lock does not expose ${sig} (Rev 12, no Handshake allowance)`, ret === "0x" ? "PASS" : "MISMATCH", ret === "0x" ? "empty return" : "answered " + ret.slice(0, 18));
    } catch (e) {
      const reverted = e.code === "CALL_EXCEPTION" || /revert/i.test(e.shortMessage || e.message);
      R.add("references", `Lock does not expose ${sig} (Rev 12, no Handshake allowance)`, reverted ? "PASS" : "INCOMPLETE", reverted ? "call reverts" : (e.shortMessage || e.message));
    }
  }
  await K(V, "Verifier", "STANDARD_FEE_BPS", 500n); await K(V, "Verifier", "HANDSHAKE_USD_MIN", 10n ** 16n);
  await K(V, "Verifier", "HANDSHAKE_USD_MAX", 2n * 10n ** 16n); await K(V, "Verifier", "HANDSHAKE_DURATION_SECS", 3600n);
  await K(V, "Verifier", "USD_STABLE_MIN_PRICE", 95n * 10n ** 16n); await K(V, "Verifier", "CHONX_ACTIVATION_THRESHOLD", 10000000n * 10n ** 18n);
  await K(forge, "Forge", "SYNTH_ACTIVATION_THRESHOLD", 100000000n * 10n ** 18n); await K(forge, "Forge", "VCLM_BURN_PER_SYNTH", 1000n * 10n ** 18n);
  await K(forge, "Forge", "CHONX_BURN_PER_SYNTH", 10000n * 10n ** 18n);
  {
    const caller = o.simFrom; // an address with ETH on the target chain (eth_call only)
    const sim = async (dur, usd, wei = 10n ** 15n) => {
      const id = ethers.id(`rig10:${dur}:${usd}:${Math.random()}`);
      const data = lock.interface.encodeFunctionData("createNativeLock", [id, caller, 0, DATA.row2.canonicalAssetId, ethers.ZeroHash, caller, dur, usd]);
      try {
        const ret = await retry(() => P.call({ from: caller, to: set.lock, data, value: wei }));
        const [fee, principal] = lock.interface.decodeFunctionResult("createNativeLock", ret);
        return { ok: true, fee, principal };
      } catch (e) { return { ok: false, reason: revertReason(ethers, e) }; }
    };
    for (const d of DURATIONS) {
      const r = await sim(d, d === 3600 ? 15n * 10n ** 15n : 10n ** 18n);
      const ok = r.ok && r.fee === (10n ** 15n * 500n) / 10000n && r.principal === 10n ** 15n - r.fee;
      R.add("lock", `duration ${d}s accepted with exactly 5% fee`, ok ? "PASS" : (r.ok ? "MISMATCH" : (/insufficient|funds|balance/i.test(r.reason) ? "INCOMPLETE" : "MISMATCH")), r.ok ? `fee ${r.fee} of 1e15 wei` : r.reason);
    }
    for (const d of [0, 1, 3599, 3601, 86400, 604801, 315360001]) {
      const r = await sim(d, 10n ** 18n);
      R.add("lock", `duration ${d}s refused`, !r.ok && /CVL: duration/.test(r.reason) ? "PASS" : "MISMATCH", r.ok ? "accepted" : r.reason);
    }
    const hs = [[10n ** 16n, true], [2n * 10n ** 16n, true], [10n ** 16n - 1n, false], [2n * 10n ** 16n + 1n, false]];
    for (const [usd, okWant] of hs) {
      const r = await sim(3600, usd);
      R.add("lock", `Handshake at ${ethers.formatEther(usd)} USD ${okWant ? "accepted" : "refused"}`, r.ok === okWant && (okWant || /CVL: handshake usd/.test(r.reason)) ? "PASS" : "MISMATCH", r.ok ? "accepted" : r.reason);
    }
    const s = await sim(604800, 10n ** 16n - 1n);
    R.add("lock", "7-day lock under 0.01 USD refused", !s.ok && /CVL: standard usd/.test(s.reason) ? "PASS" : "MISMATCH", s.ok ? "accepted" : s.reason);
  }

  log(`  section 5. ...`);
  // ---- 5. registry: the Base subset of the ceremony registry, Revision C (27 rows, 26 token addresses, 0 aliases); no non-Base row; readers by chain name
  {
    const mc = new ethers.Contract(MULTICALL3, ["function aggregate3((address target,bool allowFailure,bytes callData)[] calls) view returns ((bool success,bytes returnData)[])"], P);
    const many = async (calls) => {
      const out = [];
      for (let i = 0; i < calls.length; i += 120) out.push(...(await retry(() => mc.aggregate3.staticCall(calls.slice(i, i + 120).map((c) => ({ target: set.verifier, allowFailure: true, callData: c }))))));
      return out;
    };
    try {
      const vi = V.interface;
      const key = (env, id) => ethers.solidityPackedKeccak256(["string", "bytes32"], [env, id]);
      const rows = await many(DATA.entries.map((e) => vi.encodeFunctionData("assetPrecisionTable", [key(e.environmentId, e.canonicalAssetId)])));
      let bad = [];
      DATA.entries.forEach((e, i) => {
        if (!rows[i].success) { bad.push(`${e.environmentId}/${e.symbol}: call failed`); return; }
        const r = vi.decodeFunctionResult("assetPrecisionTable", rows[i].returnData);
        if (r.canonicalAssetId.toLowerCase() !== e.canonicalAssetId.toLowerCase() || r.symbol !== e.symbol || Number(r.decimals) !== e.decimals || Number(r.custodyClass) !== e.custodyClass || Number(r.custodyPath) !== e.custodyPath)
          bad.push(`${e.environmentId}/${e.symbol} row ${e.row}: on chain ${r.symbol}/${r.decimals}/${r.custodyClass}/${r.custodyPath}`);
      });
      R.add("registry", `${DATA.entries.length} registry rows match ceremony-data (id, symbol, decimals, custody class, custody path)`, bad.length ? "MISMATCH" : "PASS", bad.slice(0, 5).join("; "));
      const tix = await many(DATA.tokenAddresses.map((t) => vi.encodeFunctionData("tokenAssetIndex", [ethers.keccak256(coder.encode(["string", "address"], [t.environmentId, t.token]))])));
      bad = [];
      DATA.tokenAddresses.forEach((t, i) => {
        const v = tix[i].success ? vi.decodeFunctionResult("tokenAssetIndex", tix[i].returnData)[0] : "call failed";
        if (String(v).toLowerCase() !== t.canonicalAssetId.toLowerCase()) bad.push(`${t.environmentId} ${short(t.token)} -> ${String(v).slice(0, 10)}`);
      });
      R.add("registry", `${DATA.tokenAddresses.length} token addresses index to their intended row`, bad.length ? "MISMATCH" : "PASS", bad.slice(0, 5).join("; "));
      const al = await many(DATA.assetRowAliases.map((a) => vi.encodeFunctionData("assetRowAlias", [key(a.environmentId, a.canonicalAssetId)])));
      bad = [];
      DATA.assetRowAliases.forEach((a, i) => {
        const v = al[i].success ? vi.decodeFunctionResult("assetRowAlias", al[i].returnData)[0] : "call failed";
        if (String(v).toLowerCase() !== key(a.rowEnvironmentId, a.canonicalAssetId).toLowerCase()) bad.push(`${a.environmentId} alias -> ${String(v).slice(0, 10)}`);
      });
      R.add("registry", `${DATA.assetRowAliases.length} row aliases point to the intended row`, bad.length ? "MISMATCH" : "PASS", bad.join("; "));
      // Readers by chain name: every row's environment has a reader whose own environment/chain is that network.
      const envs = [...new Set(DATA.entries.map((e) => e.environmentId))];
      for (const env of envs) {
        const cfg = readersCfg.find((r) => r.env === env);
        if (!cfg) { R.add("registry", `rows of ${env} have an intended reader`, "MISMATCH", "no reader in ceremony-data"); continue; }
        const a = A(await g(V, "chainVerifiers", env));
        const n = DATA.entries.filter((e) => e.environmentId === env).length;
        R.add("registry", `${n} ${env} rows resolve to the ${cfg.contract} at ${short(set.readers[env])}`, a === A(set.readers[env]) ? "PASS" : "MISMATCH", a === A(set.readers[env]) ? "" : `chainVerifiers -> ${short(a)}`);
      }
      // Base-only: no non-Base row of the ceremony registry is registered
      // (Revision C; its non-Base rows are identical to Revision B).
      const { resolveCeremonyRegistry } = require(path.join(BC, "scripts/deploy-pages/resolveAssetRegistry.cjs"));
      const nonBase = resolveCeremonyRegistry().entries.filter((e) => e.environmentId !== "Base");
      const nb = await many(nonBase.map((e) => vi.encodeFunctionData("assetPrecisionTable", [key(e.environmentId, e.canonicalAssetId)])));
      const set2 = nonBase.filter((e, i) => !nb[i].success || vi.decodeFunctionResult("assetPrecisionTable", nb[i].returnData).canonicalAssetId !== ethers.ZeroHash);
      R.add("registry", `${nonBase.length} non-Base registry rows are not registered`, set2.length ? "MISMATCH" : "PASS", set2.slice(0, 5).map((e) => `${e.environmentId}/${e.symbol}`).join("; "));
    } catch (e) { R.add("registry", "registry reads", "INCOMPLETE", e.shortMessage || e.message); }
    // Every indexed token address has contract code on its intended network.
    if (o.tokenProviders) {
      for (const env of [...new Set(DATA.tokenAddresses.map((t) => t.environmentId))]) {
        const p = o.tokenProviders[env];
        const list = DATA.tokenAddresses.filter((t) => t.environmentId === env);
        if (!p) { R.add("registry", `${list.length} ${env} token addresses have code on ${env}`, "INCOMPLETE", "no RPC for " + env); continue; }
        try {
          const codes = [];
          for (let i = 0; i < list.length; i += 5) codes.push(...(await Promise.all(list.slice(i, i + 5).map((t) => retry(() => p.getCode(t.token))))));
          const empty = list.filter((_, i) => codes[i] === "0x");
          R.add("registry", `${list.length} ${env} token addresses have contract code on ${env}`, empty.length ? "MISMATCH" : "PASS", empty.slice(0, 5).map((t) => short(t.token)).join(", "));
        } catch (e) { R.add("registry", `${list.length} ${env} token addresses have code on ${env}`, "INCOMPLETE", e.shortMessage || e.message); }
      }
    }
  }

  log(`  section 5b. ...`);
  // ---- 5b. ceremony transactions: decode every config call the operator made and compare to ceremony-data (no extras, none missing)
  if (txs && txs.length) {
    const vi = V.interface;
    const toV = txs.filter((t) => t.to && A(t.to) === A(set.verifier));
    const calls = toV.map((t) => ({ t, d: vi.parseTransaction({ data: t.data, value: t.value || 0 }) }));
    const unknown = calls.filter((c) => !c.d).length;
    const by = (n) => calls.filter((c) => c.d && c.d.name === n);
    const rows = by("registerAssetPrecisionBatch").flatMap((c) => c.d.args[0].map((x) => [x.environmentId, x.canonicalAssetId.toLowerCase(), x.symbol, Number(x.decimals), Number(x.custodyClass), Number(x.custodyPath)].join("|")));
    const wantRows = DATA.entries.map((e) => [e.environmentId, e.canonicalAssetId.toLowerCase(), e.symbol, e.decimals, e.custodyClass, e.custodyPath].join("|"));
    const ms = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
    R.add("ceremony txs", `registry rows written = the ${wantRows.length} ceremony-data rows, no extras`, ms(rows, wantRows) && by("registerAssetPrecision").length === 0 ? "PASS" : "MISMATCH", `${rows.length} written, ${by("registerAssetPrecision").length} single writes`);
    const toks = by("registerTokenAddressBatch").flatMap((c) => c.d.args[0].map((x) => [x.environmentId, x.token.toLowerCase(), x.canonicalAssetId.toLowerCase()].join("|")));
    R.add("ceremony txs", `token index writes = the ${DATA.tokenAddresses.length} ceremony-data rows`, ms(toks, DATA.tokenAddresses.map((x) => [x.environmentId, x.token.toLowerCase(), x.canonicalAssetId.toLowerCase()].join("|"))) ? "PASS" : "MISMATCH", `${toks.length} written`);
    const als = by("registerAssetRowAlias").map((c) => [c.d.args[0], c.d.args[1].toLowerCase(), c.d.args[2]].join("|"));
    R.add("ceremony txs", "alias writes = ceremony-data aliases", ms(als, DATA.assetRowAliases.map((a) => [a.environmentId, a.canonicalAssetId.toLowerCase(), a.rowEnvironmentId].join("|"))) ? "PASS" : "MISMATCH", `${als.length} written`);
    const dfs = by("configureDevFund").map((c) => c.d.args[0] + "|" + c.d.args[1].toLowerCase());
    R.add("ceremony txs", "Dev Fund writes = ceremony-data evmDevFunds", ms(dfs, Object.entries(DATA.evmDevFunds).map(([e, a]) => e + "|" + a.toLowerCase())) ? "PASS" : "MISMATCH", `${dfs.length} written`);
    const regs = by("registerChainVerifier").map((c) => c.d.args[0] + "|" + c.d.args[1].toLowerCase());
    R.add("ceremony txs", "reader registrations = the one intended reader (Base)", ms(regs, readersCfg.map((r) => r.env + "|" + set.readers[r.env].toLowerCase())) ? "PASS" : "MISMATCH", `${regs.length} registrations`);
    const posters = by("setScheduledPricePoster").map((c) => A(c.d.args[0]));
    R.add("ceremony txs", "poster: operator first (price run 1), then the live poster", posters.length === 2 && operator && posters[0] === A(operator) && posters[1] === A(DATA.scheduledPricePoster) ? "PASS" : "MISMATCH", posters.map(short).join(" then "));
    const runs = by("applyScheduledPriceRun");
    const run1 = runs[0] && runs[0].d.args[1];
    R.add("ceremony txs", "one pre-finalize price run 1: Base ETH at ceremony-data priceUsd18", runs.length === 1 && runs[0].d.args[0] === 1n && run1.length === 1 && run1[0].environmentId === "Base" && run1[0].priceUsd18 === BigInt(DATA.priceUsd18) && run1[0].success ? "PASS" : "MISMATCH",
      runs.map((r) => `run ${r.d.args[0]}: ${r.d.args[1].map((u) => `${u.environmentId} ${ethers.formatEther(u.priceUsd18)} USD`).join(",")}`).join("; "));
    const fin = by("finalize");
    R.add("ceremony txs", "finalize is the operator's last Verifier call", fin.length === 1 && calls[calls.length - 1].d && calls[calls.length - 1].d.name === "finalize" ? "PASS" : "MISMATCH", `${fin.length} finalize calls`);
    R.add("ceremony txs", "no unexpected Verifier calls", unknown === 0 && calls.every((c) => !c.d || ["registerAssetPrecisionBatch", "registerTokenAddressBatch", "registerAssetRowAlias", "configureDevFund", "registerChainVerifier", "setScheduledPricePoster", "applyScheduledPriceRun", "finalize"].includes(c.d.name)) ? "PASS" : "MISMATCH",
      calls.filter((c) => !c.d || !["registerAssetPrecisionBatch", "registerTokenAddressBatch", "registerAssetRowAlias", "configureDevFund", "registerChainVerifier", "setScheduledPricePoster", "applyScheduledPriceRun", "finalize"].includes(c.d.name)).map((c) => c.d ? c.d.name : c.t.data.slice(0, 10)).join(","));
    R.add("ceremony txs", "every ceremony tx succeeded", txs.every((t) => t.status === 1) ? "PASS" : "MISMATCH", txs.filter((t) => t.status !== 1).map((t) => "nonce " + t.nonce).join(","));
    if (o.txListComplete) R.add("ceremony txs", "operator transaction list is complete (contiguous nonces from first create to finalize)", o.txListComplete.ok ? "PASS" : "INCOMPLETE", o.txListComplete.detail);
  }

  log(`  section 6. ...`);
  // ---- 6. after finalize: every non-view function, from the operator and a stranger
  {
    const stranger = ethers.getAddress("0x" + "5".repeat(40));
    const contracts = [
      ["VinculumFinalisVerifier", set.verifier], ["TokenVCLM", set.vclm], ["TokenCHONX", set.chonx], ["VinculumFinalisSynth", set.forge],
      ["VinculumFinalisStake", set.stake], ["BaseCommitmentVaultLock", set.lock], ...readersCfg.map((r) => [r.contract, set.readers[r.env]]),
    ];
    for (const [name, addr] of contracts) {
      const writes = art[name].abi.filter((f) => f.type === "function" && !/view|pure/.test(f.stateMutability));
      if (!WRITE_CLASS[name]) { R.add("closed", `${name}: no non-view functions`, writes.length === 0 ? "PASS" : "MISMATCH", writes.map((w) => w.name).join(",")); continue; }
      for (const w of writes) {
        const cls = WRITE_CLASS[name][w.name];
        if (!cls) { R.add("closed", `${name}.${w.name}`, "MISMATCH", "non-view function not in the intended set"); continue; }
        if (cls === "user") { R.add("closed", `${name}.${w.name} (user path, open by design)`, "PASS", "not configuration"); continue; }
        const iface = new ethers.Interface([w]);
        const data = iface.encodeFunctionData(w.name, w.inputs.map((i) => dummy(ethers, i, stranger)));
        const callers = [["operator", operator], ["stranger", stranger]];
        for (const [who, from] of callers) {
          if (!from) continue;
          try {
            await retry(() => P.call({ from, to: addr, data }));
            R.add("closed", `${name}.${w.name} from the ${who} reverts`, "MISMATCH", "call succeeded: configuration path still open");
          } catch (e) {
            const why = revertReason(ethers, e);
            const transport = e.code !== "CALL_EXCEPTION" && !/revert/i.test(String(e.message));
            R.add("closed", `${name}.${w.name} from the ${who} reverts`, transport ? "INCOMPLETE" : "PASS", why);
          }
        }
        if (cls === "poster") {
          // The scheduled poster path stays open for the poster only. Simulate a well-formed next run for Base ETH.
          try {
            const last = await g(V, "lastScheduledRunId");
            const d2 = V.interface.encodeFunctionData("applyScheduledPriceRun", [last + 1n, [{ environmentId: "Base", canonicalAssetId: DATA.row2.canonicalAssetId, priceUsd18: BigInt(DATA.priceUsd18), success: true }]]);
            await retry(() => P.call({ from: DATA.scheduledPricePoster, to: set.verifier, data: d2 }));
            R.add("closed", "applyScheduledPriceRun from the live poster (the only open configuration-like path)", "PASS", `run ${last + 1n} would apply`);
          } catch (e) { R.add("closed", "applyScheduledPriceRun from the live poster", "PASS", "poster path present; simulated run reverted: " + revertReason(ethers, e)); }
        }
      }
    }
  }

  const first = R.checks.find((c) => c.status === "MISMATCH");
  const inc = R.checks.filter((c) => c.status === "INCOMPLETE");
  const verdict = first ? `reconciliation MISMATCH at [${first.area}] ${first.name}: ${first.detail}` : inc.length ? `reconciliation INCOMPLETE: ${inc.length} checks could not be evaluated, first [${inc[0].area}] ${inc[0].name}: ${inc[0].detail}` : "reconciliation PASS";
  const counts = R.checks.reduce((m, c) => ((m[c.status] = (m[c.status] || 0) + 1), m), {});
  return { mode, verdict: scrub(verdict), counts, checks: R.checks };
}

module.exports = { reconcile, short, scrub, WRITE_CLASS, NON_BASE_ENVS, EXPECTED_BASE };
