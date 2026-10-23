// Creates a real Commitment Vault Lock on a LOCAL solana-test-validator and
// records the RPC answers the checker reads. TEST ONLY.
// Keys are generated in memory for this run and never written to disk.
// Refuses any RPC whose genesis hash is Solana mainnet.
// Usage: node record_local_lock.cjs [http://127.0.0.1:8899]
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const W = require("./solanaWire.cjs");
const C = require("./checker.cjs");

const URL_ = process.argv[2] || "http://127.0.0.1:8899";
const PROGRAM_ID = "E96mDgb9EjCKyxhrUPtDtAQ7Kp2bpkQW7foJDYxnVv1s";
const rpc = C.httpRpc(URL_);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const newKey = () => { const sk = crypto.randomBytes(32); return { sk, pk: W.b58(W.ed25519.getPublicKey(sk)) }; };

async function waitStatus(sig, level) {
  for (let i = 0; i < 120; i++) {
    const s = (await rpc("getSignatureStatuses", [[sig]])).value[0];
    if (s && s.err) throw new Error("tx failed " + JSON.stringify(s.err));
    if (s && (s.confirmationStatus === level || (level === "confirmed" && s.confirmationStatus === "finalized"))) return s;
    await sleep(500);
  }
  throw new Error("timeout waiting for " + level);
}
async function send(payer, ixs, extraSigners = []) {
  const { blockhash } = (await rpc("getLatestBlockhash", [{ commitment: "confirmed" }])).value;
  const { message } = W.compileMessage(payer.pk, ixs, blockhash);
  const wire = W.signTransaction(message, [payer.sk, ...extraSigners.map((k) => k.sk)]);
  return rpc("sendTransaction", [wire.toString("base64"), { encoding: "base64", preflightCommitment: "confirmed" }]);
}

async function main() {
  const genesis = await rpc("getGenesisHash", []);
  if (genesis === C.MAINNET_GENESIS) throw new Error("REFUSED: this is Solana mainnet");
  const payer = newKey(); const devFund = newKey(); const releaseDest = newKey(); const other = newKey();
  const air = await rpc("requestAirdrop", [payer.pk, 20_000_000_000]);
  await waitStatus(air, "confirmed");

  const cfgPda = W.findPda([Buffer.from("vf_config")], PROGRAM_ID).address;
  const existing = await rpc("getAccountInfo", [cfgPda, { encoding: "base64" }]);
  let dev = devFund.pk;
  if (!existing.value) {
    const initSig = await send(payer, [{ programId: PROGRAM_ID, keys: [
      { pubkey: payer.pk, signer: true, writable: true }, { pubkey: cfgPda, signer: false, writable: true },
      { pubkey: C.SYSTEM_PROGRAM, signer: false, writable: false }],
      data: Buffer.concat([W.anchorIx("initialize"), W.unb58(devFund.pk)]) }]);
    await waitStatus(initSig, "confirmed");
  } else {
    // Config layout: 8 disc + dev_fund_destination first.
    dev = W.b58(Buffer.from(existing.value.data[0], "base64").subarray(8, 40));
  }

  const lockId = "solsamp-" + crypto.randomBytes(6).toString("hex");
  const baseRecipient = "0x" + crypto.randomBytes(20).toString("hex"); // random test address
  const params = { lockId, grossAmount: 2_000_000_000n, durationSecs: 2592000n, baseRecipient, releaseDestination: releaseDest.pk,
    outputToken: 0, verifiedGrossUsd18: 300n * 10n ** 18n, chonxReceipt: "" };
  const lockPda = W.findPda([Buffer.from("vf_lock"), W.sha256(Buffer.from(lockId))], PROGRAM_ID).address;
  const hsPda = W.findPda([Buffer.from("vf_handshake"), W.unb58(payer.pk)], PROGRAM_ID).address;
  const sig = await send(payer, [{ programId: PROGRAM_ID, keys: [
    { pubkey: payer.pk, signer: true, writable: true }, { pubkey: cfgPda, signer: false, writable: false },
    { pubkey: lockPda, signer: false, writable: true }, { pubkey: hsPda, signer: false, writable: true },
    { pubkey: dev, signer: false, writable: true }, { pubkey: C.SYSTEM_PROGRAM, signer: false, writable: false }],
    data: Buffer.concat([W.anchorIx("commit_vault_lock_native"), W.encodeCommitParams(params)]) }]);
  const conf = await waitStatus(sig, "confirmed");

  // Snapshot before finality: what a finalized query returns while the lock is
  // only confirmed, plus the confirmed-level transaction an attacker could show.
  const early = [];
  const recEarly = C.recordingRpc(rpc, early);
  await recEarly("getTransaction", [sig, { commitment: "finalized", encoding: "base64", maxSupportedTransactionVersion: 0 }]);
  const confirmedTx = await rpc("getTransaction", [sig, { commitment: "confirmed", encoding: "base64", maxSupportedTransactionVersion: 0 }]);
  const earlyStatus = await rpc("getSignatureStatuses", [[sig], { searchTransactionHistory: true }]);

  // A plain system transfer, finalized, for the wrong-program test.
  const xfer = await send(payer, [{ programId: C.SYSTEM_PROGRAM, keys: [
    { pubkey: payer.pk, signer: true, writable: true }, { pubkey: other.pk, signer: false, writable: true }],
    data: Buffer.concat([Buffer.from([2, 0, 0, 0]), W.u64le(1_000_000_000n)]) }]);

  await waitStatus(sig, "finalized");
  await waitStatus(xfer, "finalized");
  const tx = await rpc("getTransaction", [sig, { commitment: "finalized", encoding: "base64", maxSupportedTransactionVersion: 0 }]);
  const blk = await rpc("getBlock", [tx.slot, { commitment: "finalized", transactionDetails: "signatures", rewards: false, maxSupportedTransactionVersion: 0 }]);
  const pkg = { programId: PROGRAM_ID, signature: sig, slot: tx.slot, blockhash: blk.blockhash, depositor: payer.pk, asset: "SOL",
    grossAmount: params.grossAmount.toString(), durationSecs: params.durationSecs.toString(), baseRecipient, lockId };
  const cfg = { expectedGenesisHash: genesis, programId: PROGRAM_ID };
  const calls = [];
  const facts = await C.checkLock(C.recordingRpc(rpc, calls), cfg, pkg);

  const xtx = await rpc("getTransaction", [xfer, { commitment: "finalized", encoding: "base64", maxSupportedTransactionVersion: 0 }]);
  const xblk = await rpc("getBlock", [xtx.slot, { commitment: "finalized", transactionDetails: "signatures", rewards: false, maxSupportedTransactionVersion: 0 }]);
  const xcalls = [];
  const xpkg = { ...pkg, signature: xfer, slot: xtx.slot, blockhash: xblk.blockhash };
  try { await C.checkLock(C.recordingRpc(rpc, xcalls), cfg, xpkg); throw new Error("transfer unexpectedly accepted"); }
  catch (e) { if (!(e instanceof C.CheckError)) throw e; }

  const out = {
    note: "TEST ONLY. Recorded from a local solana-test-validator running the vault program built from src/solana-vault at the declared program id. Keys were generated in memory and discarded.",
    recordedAt: new Date().toISOString(), validator: "solana-test-validator 1.18.18", cfg, pkg,
    calls, earlyCalls: early, confirmedTx, earlyStatus, confirmedAtSlot: conf.slot,
    transfer: { pkg: xpkg, calls: xcalls },
    facts: JSON.parse(JSON.stringify(facts, (_, v) => (typeof v === "bigint" ? v.toString() : v))),
  };
  const file = path.join(__dirname, "fixtures", "local_lock.json");
  fs.writeFileSync(file, JSON.stringify(out, null, 1));
  console.log("recorded", path.relative(process.cwd(), file), "slot", tx.slot, "early finalized lookup:", early[0].result === null ? "null" : "present");
}
main().catch((e) => { console.error(e.message); process.exit(1); });
