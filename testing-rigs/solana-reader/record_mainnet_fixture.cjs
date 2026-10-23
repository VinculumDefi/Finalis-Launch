// Records one real, finalized Solana MAINNET transaction (read-only RPC
// calls, nothing is sent) for the cluster and wrong-program tests. The
// transaction is an ordinary SPL Token program transaction, not a vault lock.
// The block's signature list is trimmed to the checked signature to keep the
// fixture small; the trim is recorded in the file.
// Usage: node record_mainnet_fixture.cjs [https://api.mainnet-beta.solana.com]
"use strict";
const fs = require("fs");
const path = require("path");
const C = require("./checker.cjs");
const URL_ = process.argv[2] || "https://api.mainnet-beta.solana.com";
const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const VAULT_PROGRAM = "E96mDgb9EjCKyxhrUPtDtAQ7Kp2bpkQW7foJDYxnVv1s";

async function main() {
  const rpc = C.httpRpc(URL_);
  const genesis = await rpc("getGenesisHash", []);
  if (genesis !== C.MAINNET_GENESIS) throw new Error("not mainnet");
  const sigs = await rpc("getSignaturesForAddress", [TOKEN_PROGRAM, { limit: 100, commitment: "finalized" }]);
  // Prefer a legacy transaction so the checker gets past the version check
  // and reaches the program check.
  let pick, tx;
  for (const s of sigs.filter((x) => x.err === null)) {
    tx = await rpc("getTransaction", [s.signature, { commitment: "finalized", encoding: "base64", maxSupportedTransactionVersion: 0 }]);
    pick = s;
    if (tx && tx.version === "legacy") break;
  }
  const blk = await rpc("getBlock", [tx.slot, { commitment: "finalized", transactionDetails: "signatures", rewards: false, maxSupportedTransactionVersion: 0 }]);
  const pkg = { programId: VAULT_PROGRAM, signature: pick.signature, slot: tx.slot, blockhash: blk.blockhash, depositor: "x", asset: "SOL", grossAmount: "1", durationSecs: "2592000", baseRecipient: "0x", lockId: "x" };
  const calls = [];
  const trimming = async (m, p) => {
    const r = await rpc(m, p);
    if (m === "getBlock" && r) return { ...r, signatures: r.signatures.filter((s) => s === pick.signature), signatureCountOriginal: r.signatures.length };
    return r;
  };
  let outcome;
  try { await C.checkLock(C.recordingRpc(trimming, calls), { expectedGenesisHash: C.MAINNET_GENESIS, programId: VAULT_PROGRAM }, pkg); outcome = "accepted"; }
  catch (e) { outcome = e.code || e.message; }
  const vault = await rpc("getAccountInfo", [VAULT_PROGRAM, { encoding: "base64", dataSlice: { offset: 0, length: 0 } }]);
  const out = { note: "Real Solana mainnet data, read-only. Block signature list trimmed to the checked signature.", recordedAt: new Date().toISOString(),
    rpc: URL_, genesis, pkg, calls, outcome, txVersion: tx.version, vaultProgramOnMainnet: vault.value !== null };
  fs.writeFileSync(path.join(__dirname, "fixtures", "mainnet_token_tx.json"), JSON.stringify(out, null, 1));
  console.log("mainnet fixture slot", tx.slot, "version", tx.version, "checker outcome", outcome, "vault program on mainnet:", vault.value !== null);
}
main().catch((e) => { console.error(e.message); process.exit(1); });
