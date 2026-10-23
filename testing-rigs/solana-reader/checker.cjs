// Off-chain Solana lock checker. TEST RIG ONLY. Nothing here is registered,
// deployed or broadcast.
//
// What "finalized" means here, exactly: the queried Solana RPC node reports
// the transaction and its block at commitment "finalized". A finalized block
// is one the node's bank has rooted: a supermajority (at least 2/3 of active
// stake) has voted on it and its descendants under Tower BFT, so it has
// reached maximum lockout (31+ confirmations on top). This is the strongest
// finality Solana offers, but the checker learns it only from the RPC node.
// The RPC is off-chain trust. A lying or compromised RPC can return a
// fabricated block, logs or meta. The checker narrows what a lying RPC can
// fake: it checks every ed25519 transaction signature itself, so it cannot
// invent a lock the depositor did not sign, and it cross-checks the signed
// instruction data against the emitted event. It cannot check, by itself,
// that the transaction succeeded or that the block is on the canonical
// finalized fork. Those come from the RPC. Use several independent RPCs
// (quorum below) to reduce that trust.
"use strict";
const W = require("./solanaWire.cjs");

const PERMITTED_DURATIONS = [3600, 604800, 2592000, 5184000, 7776000, 15552000, 31536000, 63072000, 94608000,
  126144000, 157680000, 189216000, 220752000, 252288000, 283824000, 315360000].map(BigInt);
const STANDARD_FEE_BPS = 500n; // Rev 12: 5% for every duration, Handshake included.
const MAINNET_GENESIS = "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d";
const SYSTEM_PROGRAM = "11111111111111111111111111111111";

class CheckError extends Error { constructor(code, msg) { super(code + ": " + msg); this.code = code; } }
const req = (cond, code, msg) => { if (!cond) throw new CheckError(code, msg); };

// Log frames: only "Program data:" lines emitted while the expected program is
// the innermost running program count. CPI'd programs cannot inject events.
function eventsFromLogs(logs, programId) {
  const stack = []; const out = [];
  for (const line of logs || []) {
    let m;
    if ((m = line.match(/^Program (\w+) invoke \[(\d+)\]$/))) stack.push(m[1]);
    else if ((m = line.match(/^Program (\w+) (success|failed)/))) stack.pop();
    else if ((m = line.match(/^Program data: (.+)$/)) && stack[stack.length - 1] === programId) {
      for (const part of m[1].split(" ")) out.push(Buffer.from(part, "base64"));
    }
  }
  return out;
}

async function checkLock(rpc, cfg, pkg) {
  const programId = cfg.programId;
  // C1 cluster
  const genesis = await rpc("getGenesisHash", []);
  req(genesis === cfg.expectedGenesisHash, "SOL-CLUSTER", "RPC genesis hash is not the expected cluster");
  // C2 signature format
  let sigBytes; try { sigBytes = W.unb58(pkg.signature); } catch { sigBytes = Buffer.alloc(0); }
  req(sigBytes.length === 64, "SOL-SIG-FORMAT", "signature is not 64 bytes of base58");
  // C3 finalized transaction
  const tx = await rpc("getTransaction", [pkg.signature, { commitment: "finalized", encoding: "base64", maxSupportedTransactionVersion: 0 }]);
  req(tx, "SOL-NOT-FINALIZED", "transaction not found at finalized commitment");
  req(BigInt(tx.slot) === BigInt(pkg.slot), "SOL-SLOT", "transaction slot does not match the package slot");
  req(tx.meta && tx.meta.err === null, "SOL-TX-FAILED", "transaction failed");
  // C6 wire bytes, signatures checked locally
  const parsed = W.parseTransaction(Buffer.from(tx.transaction[0], "base64"));
  req(parsed.version === "legacy", "SOL-TX-VERSION", "only legacy transactions are accepted");
  req(W.b58(parsed.signatures[0]) === pkg.signature, "SOL-SIG-MISMATCH", "first signature is not the package signature");
  req(W.verifySignatures(parsed), "SOL-SIG-INVALID", "an ed25519 signature does not verify");
  // C7 finalized block, blockhash and inclusion
  const block = await rpc("getBlock", [Number(pkg.slot), { commitment: "finalized", transactionDetails: "signatures", rewards: false, maxSupportedTransactionVersion: 0 }]);
  req(block, "SOL-BLOCK-NOT-FINALIZED", "block not available at finalized commitment");
  req(block.blockhash === pkg.blockhash, "SOL-BLOCKHASH", "finalized blockhash does not match the package blockhash");
  req((block.signatures || []).includes(pkg.signature), "SOL-NOT-IN-BLOCK", "signature not in the finalized block");
  req(block.blockTime !== null && block.blockTime !== undefined, "SOL-BLOCKTIME", "block has no time");
  // C8 status
  const st = await rpc("getSignatureStatuses", [[pkg.signature], { searchTransactionHistory: true }]);
  const s0 = st && st.value && st.value[0];
  req(s0 && s0.confirmationStatus === "finalized" && s0.err === null, "SOL-STATUS", "signature status is not finalized");
  req(BigInt(s0.slot) === BigInt(pkg.slot), "SOL-SLOT", "status slot does not match");
  // C9 the signed instruction
  const keys = parsed.accountKeys;
  const vaultIxs = parsed.instructions.filter((ix) => keys[ix.programIdIndex] === programId);
  req(vaultIxs.length === 1, "SOL-PROGRAM", "transaction has no single top-level instruction to the expected program");
  const ix = vaultIxs[0];
  const disc = ix.data.subarray(0, 8);
  const isNative = disc.equals(W.anchorIx("commit_vault_lock_native"));
  const isSpl = disc.equals(W.anchorIx("commit_vault_lock_spl"));
  req(isNative || isSpl, "SOL-PROGRAM", "instruction is not a vault lock commit");
  const params = W.decodeCommitParams(ix.data.subarray(8));
  const ixAcc = ix.accounts.map((i) => keys[i]);
  req(ixAcc[0] === keys[0], "SOL-DEPOSITOR", "lock signer is not the fee payer");
  const cfgPda = W.findPda([Buffer.from("vf_config")], programId).address;
  const lockPda = W.findPda([Buffer.from("vf_lock"), Buffer.from(params.lockIdHash, "hex")], programId).address;
  req(ixAcc[1] === cfgPda && ixAcc[2] === lockPda, "SOL-ACCOUNTS", "config or lock account is not the program PDA");
  req(params.lockIdHash === W.sha256(Buffer.from(params.lockId)).toString("hex"), "SOL-LOCKID", "lock id hash mismatch");
  // C10 the event, from the expected program's own frame only
  const evDisc = W.anchorEvent("LockCreated");
  const evs = eventsFromLogs(tx.meta.logMessages, programId).filter((d) => d.subarray(0, 8).equals(evDisc));
  req(evs.length === 1, "SOL-EVENT", "expected exactly one LockCreated from the expected program");
  const ev = W.decodeLockCreated(evs[0].subarray(8));
  // C11 event equals the signed instruction
  req(ev.lockId === params.lockId && ev.grossAmount === params.grossAmount && ev.durationSecs === params.durationSecs
    && ev.baseRecipient === params.baseRecipient && ev.releaseDestination === params.releaseDestination
    && ev.outputToken === params.outputToken && ev.verifiedGrossUsd18 === params.verifiedGrossUsd18
    && ev.sourceAccount === keys[0], "SOL-EVENT-IX", "event does not match the signed instruction");
  // C12 economics and duration
  req(PERMITTED_DURATIONS.includes(ev.durationSecs), "SOL-DURATION", "duration not permitted");
  req(ev.feeAmount === (ev.grossAmount * STANDARD_FEE_BPS) / 10000n, "SOL-FEE", "fee is not 5% of gross");
  req(ev.principalAmount === ev.grossAmount - ev.feeAmount, "SOL-PRINCIPAL", "principal is not gross minus fee");
  req(ev.maturityTimeSecs - ev.durationSecs === BigInt(block.blockTime), "SOL-TIME", "creation time is not the block time");
  // C13 asset
  if (isNative) {
    req(ev.canonicalAsset === "SOL" && ev.lockType === 0, "SOL-ASSET", "native lock does not hold SOL");
    // Lamport movement from meta: Dev Fund gains exactly the fee.
    const devIdx = keys.indexOf(ixAcc[4]);
    req(devIdx >= 0 && BigInt(tx.meta.postBalances[devIdx]) - BigInt(tx.meta.preBalances[devIdx]) === ev.feeAmount, "SOL-FEE-MOVED", "Dev Fund did not receive the fee");
    const lockIdx = keys.indexOf(lockPda);
    req(BigInt(tx.meta.postBalances[lockIdx]) >= ev.principalAmount, "SOL-PRINCIPAL-MOVED", "lock account does not hold the principal");
  } else {
    req(ev.lockType === 1 && ev.canonicalAsset !== "SOL", "SOL-ASSET", "SPL lock asset");
  }
  // C14 the package claims
  const claim = {
    programId, depositor: ev.sourceAccount, asset: ev.canonicalAsset, grossAmount: ev.grossAmount.toString(),
    durationSecs: ev.durationSecs.toString(), baseRecipient: ev.baseRecipient.toLowerCase(), lockId: ev.lockId,
  };
  for (const k of ["depositor", "asset", "grossAmount", "durationSecs", "baseRecipient", "lockId"]) {
    req(String(pkg[k]).toLowerCase() === String(claim[k]).toLowerCase(), "SOL-PKG-" + k.toUpperCase(), "package " + k + " does not match the finalized lock");
  }
  req(pkg.programId === programId, "SOL-PROGRAM", "package program id is not the expected program");
  return {
    genesisHash: genesis, programId, signature: pkg.signature, slot: BigInt(tx.slot), blockhash: block.blockhash,
    blockTime: BigInt(block.blockTime), lockId: ev.lockId, lockIdHash: "0x" + params.lockIdHash, depositor: ev.sourceAccount,
    asset: ev.canonicalAsset, grossAmount: ev.grossAmount, feeAmount: ev.feeAmount, principalAmount: ev.principalAmount,
    durationSecs: ev.durationSecs, maturity: ev.maturityTimeSecs, baseRecipient: ev.baseRecipient,
    releaseDestination: ev.releaseDestination, outputToken: ev.outputToken, verifiedGrossUsd18: ev.verifiedGrossUsd18,
  };
}

// Every RPC must pass and return identical facts.
async function checkLockQuorum(rpcs, cfg, pkg) {
  const results = [];
  for (const rpc of rpcs) results.push(await checkLock(rpc, cfg, pkg));
  const j = (x) => JSON.stringify(x, (_, v) => (typeof v === "bigint" ? v.toString() : v));
  for (const r of results) req(j(r) === j(results[0]), "SOL-QUORUM", "RPCs disagree");
  return results[0];
}

function httpRpc(url) {
  return async (method, params) => {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
    const j = await res.json();
    if (j.error) throw new Error(method + ": " + JSON.stringify(j.error));
    return j.result;
  };
}
// Replays a recorded fixture: same method and params must have been recorded.
function replayRpc(calls, overrides = {}) {
  return async (method, params) => {
    const key = method + " " + JSON.stringify(params);
    if (key in overrides) return overrides[key];
    if (method in overrides) return overrides[method];
    const hit = calls.find((c) => c.key === key);
    if (!hit) return null;
    return JSON.parse(JSON.stringify(hit.result));
  };
}
function recordingRpc(inner, sink) {
  return async (method, params) => { const result = await inner(method, params); sink.push({ key: method + " " + JSON.stringify(params), result }); return result; };
}

module.exports = { checkLock, checkLockQuorum, httpRpc, replayRpc, recordingRpc, eventsFromLogs, CheckError, MAINNET_GENESIS, SYSTEM_PROGRAM, PERMITTED_DURATIONS };
