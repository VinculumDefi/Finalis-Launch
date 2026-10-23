#!/usr/bin/env node
// Writes the app's deployed-address file from the Base ceremony page output.
//
// It never sends a transaction and never reads a key. With --rpc it only makes
// read-only eth_call / eth_getCode reads.
//
// Inputs
//   --log <file>    The text from base.html after "Finalized.": copy everything in
//                   the log box and the result box below it into one text file.
//                   Lines used: "Base lock 0x..", "VCLM 0x..", "CHONX 0x..",
//                   "Verifier 0x..", "Forge 0x..", "Stake 0x..",
//                   "reader <environment> 0x..", "Finalized.", and the result box
//                   lines "lock/vclm/chonx/verifier/forge/stake 0x..".
//   --locks <file>  JSON with the six new non-Base lock addresses, e.g.
//                   {"Ethereum":"0x..","Arbitrum":"0x..","Optimism":"0x..",
//                    "Polygon":"0x..","BNB Smart Chain":"0x..","Avalanche":"0x.."}
//   --rpc <url>     Optional. Read-only checks on Base (e.g. https://mainnet.base.org).
//   --write         Write src/lib/vfDeployedAddresses.js. Without it, nothing is
//                   written (dry run) and the result is only printed.
//   --out <file>    Optional. Write the values for Base44 section 6 as JSON.
//
// Usage (from base-contracts):
//   node scripts/applyCeremonyAddresses.cjs --log ceremony-log.txt --locks new-locks.json --rpc https://mainnet.base.org --write
//
// Fails closed: any missing, malformed, zero, duplicated or old address, a log
// without "Finalized.", a reader set that is not the expected 15, or (with --rpc)
// any on-chain read that does not match stops the script and nothing is written.
"use strict";
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

const ROOT = path.join(__dirname, "..", "..");
const APP_FILE = path.join(ROOT, "src", "lib", "vfDeployedAddresses.js");
const DATA = require("./deploy-pages/ceremony-data.json");

const EVM_ENVS = ["Ethereum", "Arbitrum", "Optimism", "Polygon", "BNB Smart Chain", "Avalanche"];
const READER_ENVS = ["Base", ...EVM_ENVS, ...DATA.readers.utxo.map((r) => r.env), DATA.readers.stellar.env, DATA.readers.xrpl.env];
const BASE_KEYS = ["lock", "vclm", "chonx", "verifier", "forge", "stake"];
const LOG_LABEL = { lock: "Base lock", vclm: "VCLM", chonx: "CHONX", verifier: "Verifier", forge: "Forge", stake: "Stake" };
// Base lock = BaseCommitmentVaultLock (t262u). Its runtime code holds four
// immutables (Dev Fund, VCLM, CHONX, SYNTH), so the code hash is taken with the
// immutable byte ranges zeroed (ranges from the compiler's immutableReferences),
// and the immutables are checked by their getters.
const LOCK_RUNTIME_HASH = "0x1273f544e21b20838f94c0e18c5790dda8ec2b014fe4881264f90898a0e2bea2";
const LOCK_IMMUTABLE_RANGES = [[1406, 32], [2721, 32], [4858, 32], [5265, 32], [5339, 32], [5493, 32], [6052, 32], [6108, 32], [6148, 32]];
function maskedCodeHash(codeHex) {
  const code = Buffer.from(codeHex.replace(/^0x/, ""), "hex");
  for (const [start, len] of LOCK_IMMUTABLE_RANGES) code.fill(0, start, start + len);
  return ethers.keccak256(code);
}

// Old contracts. None may appear as a new address.
const RETIRED = {
  locks: [
    { address: "0x968BFD5b580144b4398C10BB1E61bD8A6B1aC946", chains: ["Base"], note: "2.5% Handshake lock, 2026-10-12" },
    { address: "0x4eDE54E1cb6E337923F8D63Fa0799AE778263b1a", chains: EVM_ENVS, note: "2.5% Handshake lock on the six non-Base EVM chains" },
    { address: "0x5AB40cdD51036EA88889c26E182b2936Ddf76a8A", chains: EVM_ENVS, note: "f9e4d8c CommitmentVaultLock with HANDSHAKE_FEE_BPS=250 on the six non-Base EVM chains" },
  ],
  base: [
    { name: "Verifier (finalized 2026-10-12)", address: "0xb0670826b79e29cc6a1c216Eb396D383a54af47D" },
    { name: "VCLM (2026-10-12)", address: "0x655273f8f5d74f7D5b5C4E1B947AE4ed763Df305" },
    { name: "CHONX (2026-10-12)", address: "0x5C5587db545d7c2982e5001Df6e2b32c47dfea79" },
    { name: "Base reader (2026-10-12)", address: "0x1cBbb8C2B535dCe626f218aB06a3D181e82c679F" },
    { name: "Synth/Forge (2026-10-12)", address: "0x7A2c77879F2D1f4526682Fa5109b99a75dA288f8" },
    { name: "Stake (2026-10-12)", address: "0xfa16a1cdA94DD772498144814c9e4d0d7C81a6eF" },
    { name: "old copy VCLM", address: "0x6FdF43c396cefDa15630E628F160563563C84Af1" },
    { name: "old copy CHONX", address: "0x8Be366686006d6340e1fa32d8aF3BCd8fca78248" },
    { name: "old copy lock", address: "0xE727981580A9CbD6ff7b0d38c17a4876F5a56a8D" },
    { name: "old copy Verifier", address: "0x4e4D2d233812F513f7BAca618C35AA93799F0Df1" },
    { name: "old copy Forge", address: "0x91D8Ee15FAB6c194a96f2d51742b2bEE6B0e7682" },
    { name: "old copy Stake", address: "0x177182975853B5A39850d242F411b657CDFf0ED8" },
  ],
};
const OLD = new Set([...RETIRED.locks, ...RETIRED.base].map((x) => x.address.toLowerCase()));
const RESERVED = new Map([
  [ethers.getAddress(DATA.scheduledPricePoster).toLowerCase(), "the live price poster"],
  [ethers.getAddress(DATA.devFund).toLowerCase(), "the Dev Fund"],
]);

const short = (a) => (a && a.length > 12 ? a.slice(0, 6) + "…" + a.slice(-4) : String(a));

function fail(msg) { const e = new Error(msg + " Nothing was written."); e.ceremony = true; throw e; }

function checkAddress(label, a) {
  if (typeof a !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(a.trim())) fail(`${label}: missing or not an address.`);
  let g;
  try { g = ethers.getAddress(a.trim()); } catch { fail(`${label}: bad checksum.`); }
  if (g === ethers.ZeroAddress) fail(`${label}: zero address.`);
  if (OLD.has(g.toLowerCase())) fail(`${label}: ${short(g)} is an old contract.`);
  if (RESERVED.has(g.toLowerCase())) fail(`${label}: ${short(g)} is ${RESERVED.get(g.toLowerCase())}.`);
  return g;
}

// Parses the text copied from base.html. Returns { base, readers }.
function parseCeremonyLog(text) {
  if (typeof text !== "string" || !text.trim()) fail("ceremony log is empty.");
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.some((l) => /^Stopped/i.test(l))) fail("ceremony log contains a 'Stopped' line.");
  if (!lines.includes("Finalized.")) fail("ceremony log has no 'Finalized.' line, so the ceremony did not finish.");
  const seen = {};
  const put = (key, a) => {
    if (seen[key] && seen[key].toLowerCase() !== a.toLowerCase()) fail(`${key}: two different addresses in the log (${short(seen[key])}, ${short(a)}).`);
    seen[key] = a;
  };
  for (const l of lines) {
    let m;
    if ((m = l.match(/^reader (.+) (0x[0-9a-fA-F]{40})$/))) { put("reader:" + m[1], m[2]); continue; }
    for (const k of BASE_KEYS) {
      const re = new RegExp("^(?:" + LOG_LABEL[k] + "|" + k + ") (0x[0-9a-fA-F]{40})$");
      if ((m = l.match(re))) put(k, m[1]);
    }
  }
  const base = {};
  for (const k of BASE_KEYS) base[k] = checkAddress(LOG_LABEL[k], seen[k]);
  const readers = {};
  for (const env of READER_ENVS) readers[env] = checkAddress("reader " + env, seen["reader:" + env]);
  const extra = Object.keys(seen).filter((k) => k.startsWith("reader:") && !READER_ENVS.includes(k.slice(7)));
  if (extra.length) fail("unexpected reader(s) in the log: " + extra.map((k) => k.slice(7)).join(", ") + ".");
  return { base, readers };
}

function parseLocks(obj) {
  if (!obj || typeof obj !== "object") fail("new lock list is missing.");
  const keys = Object.keys(obj).filter((k) => !k.startsWith("_"));
  const unknown = keys.filter((k) => !EVM_ENVS.includes(k));
  if (unknown.length) fail("unknown chain(s) in the lock list: " + unknown.join(", ") + ".");
  const locks = {};
  for (const env of EVM_ENVS) locks[env] = checkAddress("new " + env + " lock", obj[env]);
  return locks;
}

// Cross-checks and builds the record written to the app.
function buildRecord({ logText, locksJson }) {
  const { base, readers } = parseCeremonyLog(logText);
  const locks = parseLocks(locksJson);
  // The Base contracts and readers are all separate deployments, so all distinct.
  const all = [...BASE_KEYS.map((k) => [k, base[k]]), ...Object.entries(readers).map(([e, a]) => ["reader " + e, a])];
  const byAddr = new Map();
  for (const [label, a] of all) {
    const k = a.toLowerCase();
    if (byAddr.has(k)) fail(`${label} and ${byAddr.get(k)} share the address ${short(a)}.`);
    byAddr.set(k, label);
  }
  // A non-Base lock may share an address with another non-Base lock (same deployer
  // and nonce on two chains), but not with a Base contract.
  for (const env of EVM_ENVS) if (byAddr.has(locks[env].toLowerCase())) fail(`new ${env} lock equals ${byAddr.get(locks[env].toLowerCase())} on Base.`);
  return {
    status: "FINALIZED",
    chainId: 8453,
    priceRunNext: 2,
    scheduledPricePoster: ethers.getAddress(DATA.scheduledPricePoster),
    base,
    locks: { Base: base.lock, ...locks },
    readers,
  };
}

// Read-only checks on Base. provider: an ethers provider.
async function verifyOnChain(provider, rec, art = require("./deploy-pages/ceremony.json")) {
  const c = (name, a) => new ethers.Contract(a, art[name].abi, provider);
  const v = c("VinculumFinalisVerifier", rec.base.verifier);
  const problems = [];
  const eq = (label, got, want) => { if (String(got).toLowerCase() !== String(want).toLowerCase()) problems.push(`${label}: got ${short(String(got))}, expected ${short(String(want))}`); };
  const net = await provider.getNetwork();
  if (net.chainId !== 8453n && !rec._testChain) problems.push(`network is chain id ${net.chainId}, not Base (8453)`);
  eq("verifier.configurationFinalized", await v.configurationFinalized(), true);
  eq("verifier.scheduledPricePoster", await v.scheduledPricePoster(), rec.scheduledPricePoster);
  for (const [env, a] of Object.entries(rec.readers)) eq("verifier.chainVerifiers(" + env + ")", await v.chainVerifiers(env), a);
  eq("verifier.chainVerifiers(Solana)", await v.chainVerifiers("Solana"), ethers.ZeroAddress);
  const vclm = c("TokenVCLM", rec.base.vclm), chonx = c("TokenCHONX", rec.base.chonx);
  eq("VCLM.minterVerifier", await vclm.minterVerifier(), rec.base.verifier);
  eq("VCLM.minterStake", await vclm.minterStake(), rec.base.stake);
  eq("CHONX.minterVerifier", await chonx.minterVerifier(), rec.base.verifier);
  eq("CHONX.minterStake", await chonx.minterStake(), ethers.ZeroAddress);
  eq("Forge.verifier", await c("VinculumFinalisSynth", rec.base.forge).verifier(), rec.base.verifier);
  eq("Stake.verifier", await c("VinculumFinalisStake", rec.base.stake).verifier(), rec.base.verifier);
  eq("Base reader.vault", await c("BaseLockRecordVerifier", rec.readers.Base).vault(), rec.base.lock);
  for (const r of DATA.readers.evm) eq(r.env + " reader.lock", await c(r.contract, rec.readers[r.env]).lock(), rec.locks[r.env]);
  const lock = c("BaseCommitmentVaultLock", rec.base.lock);
  eq("Base lock STANDARD_FEE_BPS", await lock.STANDARD_FEE_BPS(), 500n);
  eq("Base lock runtime code hash (immutables masked)", maskedCodeHash(await provider.getCode(rec.base.lock)), LOCK_RUNTIME_HASH);
  eq("Base lock devFund", await lock.devFund(), DATA.devFund);
  eq("Base lock vclmToken", await lock.vclmToken(), rec.base.vclm);
  eq("Base lock chonxToken", await lock.chonxToken(), rec.base.chonx);
  eq("Base lock synthToken", await lock.synthToken(), rec.base.forge);
  const launch = await v.protocolLaunchTimestamp();
  // T0: the Verifier's protocolLaunchTimestamp (set at finalize). The Stake
  // contract reads the same value (t262u), so epochs and emission decay agree.
  if (launch === 0n) problems.push("verifier.protocolLaunchTimestamp is zero");
  else {
    eq("Stake.launchTimestamp", await c("VinculumFinalisStake", rec.base.stake).launchTimestamp(), launch);
    rec.launchTimestamp = Number(launch);
  }
  return problems;
}

function q(a) { return a ? JSON.stringify(a) : "PENDING"; }

// The app file. Always the same shape; addresses or PENDING.
function renderAppFile(rec) {
  const P = "PENDING";
  const base = rec ? rec.base : {};
  const locks = rec ? rec.locks : {};
  const readers = rec ? rec.readers : {};
  const lines = [];
  lines.push("// GENERATED by base-contracts/scripts/applyCeremonyAddresses.cjs. Do not edit by hand.");
  lines.push("// The one place the app reads the Revision B contract addresses from.");
  lines.push("// Before the ceremony every address is PENDING_DEPLOYMENT. After it, run the script");
  lines.push("// with --write and commit this file.");
  lines.push("");
  lines.push("const PENDING = 'PENDING_DEPLOYMENT';");
  lines.push("");
  lines.push("export const CEREMONY = Object.freeze({");
  lines.push(`  status: ${rec ? "'FINALIZED'" : "'AWAITING_DEPLOYMENT'"},`);
  lines.push("  chain_id: 8453,");
  lines.push(`  finalized: ${rec ? "true" : "false"},`);
  lines.push("  next_price_run: 2,");
  lines.push(`  launch_timestamp: ${rec && rec.launchTimestamp ? rec.launchTimestamp : "null"}, // Unix seconds, read from the Verifier with --rpc`);
  lines.push("});");
  lines.push("");
  lines.push("// New Revision B contracts on Base.");
  lines.push("export const BASE_CONTRACTS = Object.freeze({");
  for (const k of BASE_KEYS) lines.push(`  ${k}: ${base[k] ? JSON.stringify(base[k]) : P},`);
  lines.push("});");
  lines.push("");
  lines.push("// The seven new 5% locks (5% on every duration): Base is BaseCommitmentVaultLock");
  lines.push("// (refuses VCLM, CHONX and SYNTH as inputs); the six others are CommitmentVaultLock.");
  lines.push("export const LOCKS_5PCT = Object.freeze({");
  for (const env of ["Base", ...EVM_ENVS]) lines.push(`  ${JSON.stringify(env)}: ${locks[env] ? JSON.stringify(locks[env]) : P},`);
  lines.push("});");
  lines.push("");
  lines.push("// The 15 readers registered on the Verifier (Solana is not registered).");
  lines.push("export const READERS = Object.freeze({");
  for (const env of READER_ENVS) lines.push(`  ${JSON.stringify(env)}: ${readers[env] ? JSON.stringify(readers[env]) : P},`);
  lines.push("});");
  lines.push("");
  lines.push("// Retired 2.5% locks: never offered for a new lock. Existing locks on them can");
  lines.push("// still be released by their recorded destination at maturity.");
  lines.push("export const RETIRED_LOCKS = Object.freeze([");
  for (const r of RETIRED.locks) lines.push(`  Object.freeze({ address: ${JSON.stringify(r.address)}, chains: ${JSON.stringify(r.chains)}, status: 'RETIRED', new_locks: false, release_allowed: true, note: ${JSON.stringify(r.note)} }),`);
  lines.push("]);");
  lines.push("");
  lines.push("// Older Base contracts. History only; the app must not target them.");
  lines.push("export const RETIRED_BASE_CONTRACTS = Object.freeze([");
  for (const r of RETIRED.base) lines.push(`  Object.freeze({ name: ${JSON.stringify(r.name)}, address: ${JSON.stringify(r.address)} }),`);
  lines.push("]);");
  lines.push("");
  return lines.join("\n");
}

function base44Values(rec) {
  const s = (a) => ({ full: a, short: short(a) });
  return {
    _note: "Values for /workspace/base44/BASE44_APP_FIX_PROMPT.md section 6. Generated by applyCeremonyAddresses.cjs.",
    BASE_LOCK: s(rec.base.lock), VERIFIER: s(rec.base.verifier), VCLM: s(rec.base.vclm), CHONX: s(rec.base.chonx),
    FORGE: s(rec.base.forge), STAKE: s(rec.base.stake), BASE_READER: s(rec.readers.Base),
    LOCKS: Object.fromEntries(Object.entries(rec.locks).map(([k, a]) => [k, s(a)])),
    PRICE_POSTER: { short: short(rec.scheduledPricePoster), source: "base-contracts/deployment/liveConfig.json" },
    LAUNCH_TIMESTAMP: rec.launchTimestamp || null,
    RETIRED_LOCKS: RETIRED.locks.map((r) => ({ ...s(r.address), chains: r.chains })),
  };
}

function arg(argv, name) { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; }

async function main(argv) {
  const logFile = arg(argv, "--log"), locksFile = arg(argv, "--locks"), rpcUrl = arg(argv, "--rpc"), out = arg(argv, "--out");
  if (!logFile || !locksFile) fail("usage: --log <file> --locks <file> [--rpc <url>] [--write] [--out <file>].");
  const rec = buildRecord({ logText: fs.readFileSync(logFile, "utf8"), locksJson: JSON.parse(fs.readFileSync(locksFile, "utf8")) });
  console.log("Base contracts:");
  for (const k of BASE_KEYS) console.log("  " + k.padEnd(9) + short(rec.base[k]));
  console.log("5% locks:");
  for (const [e, a] of Object.entries(rec.locks)) console.log("  " + e.padEnd(16) + short(a));
  console.log("Readers: " + Object.keys(rec.readers).length + " (" + Object.keys(rec.readers).join(", ") + ")");
  if (rpcUrl) {
    const provider = new ethers.JsonRpcProvider(rpcUrl, 8453, { staticNetwork: true });
    const problems = await verifyOnChain(provider, rec);
    if (problems.length) fail("on-chain check failed:\n  " + problems.join("\n  ") + "\n");
    console.log("On-chain read-only checks on Base: all passed.");
  } else {
    console.log("On-chain checks skipped (no --rpc). Run them before committing.");
  }
  if (argv.includes("--write") && !rec.launchTimestamp) fail("--write needs --rpc, so the launch time and every address are read back from Base first.");
  if (out) { fs.writeFileSync(out, JSON.stringify(base44Values(rec), null, 2) + "\n"); console.log("Base44 values written to " + out); }
  if (argv.includes("--write")) {
    fs.writeFileSync(APP_FILE, renderAppFile(rec));
    console.log("Wrote " + path.relative(ROOT, APP_FILE) + ". Next: run the app tests, then commit that one file.");
  } else {
    console.log("Dry run: nothing written. Add --write to write " + path.relative(ROOT, APP_FILE) + ".");
  }
}

module.exports = { parseCeremonyLog, parseLocks, buildRecord, verifyOnChain, renderAppFile, base44Values, RETIRED, READER_ENVS, EVM_ENVS, APP_FILE, LOCK_RUNTIME_HASH, LOCK_IMMUTABLE_RANGES, maskedCodeHash };

if (require.main === module) {
  main(process.argv.slice(2)).catch((e) => { console.error("STOPPED: " + (e && e.message ? e.message : e)); process.exitCode = 1; });
}
