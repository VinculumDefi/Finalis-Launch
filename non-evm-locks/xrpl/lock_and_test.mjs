/**
 * XRP Ledger Commitment Vault lock — Revision 8.
 *
 * Two objects bound by SHA-256(117-byte payload), not one transaction:
 *   Payment of floor(gross * 500 / 10000) drops to the Dev Fund fixture
 *   EscrowCreate of the principal to the release fixture
 *     FinishAfter set, CancelAfter omitted
 * The release account has Deposit Authorization so a non-destination
 * EscrowFinish is rejected. See SPLIT.md.
 *
 * Requires a local xrpld. This file starts one in standalone mode.
 */

// XRP Ledger lock cannot keep a per-identity handshake count.
const COUNTS_PER_IDENTITY = false;
function handshakeAllowance(countsPerIdentity) {
  return countsPerIdentity ? 3 : 1;
}
if (handshakeAllowance(COUNTS_PER_IDENTITY) !== 1) {
  throw new Error("XRP Ledger allowance must be derived as 1");
}


import { spawn } from "child_process";
import crypto from "crypto";
import fs from "fs";
import { createRequire } from "module";

const require = createRequire("/tmp/vf-js/package.json");
const xrpl = require("xrpl");

const RIPPLE_EPOCH = 946684800;
const HOME = "/tmp/vf-xrpl-rev8";
const RPC = "http://127.0.0.1:5005";
const WS = "ws://127.0.0.1:6006";
const XRPLD = process.env.XRPLD_BIN || "/usr/bin/xrpld";

function assert(cond, msg) {
  if (!cond) throw new Error("FAIL: " + msg);
  console.log("PASS:", msg);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function buildBindingPayload({ lockId32, baseRecipient20, outputToken, assetIdentity32, valuationRef32 }) {
  if (lockId32.length !== 32) throw new Error("lock id");
  if (baseRecipient20.length !== 20) throw new Error("base recipient");
  if (assetIdentity32.length !== 32) throw new Error("asset id");
  if (valuationRef32.length !== 32) throw new Error("valuation");
  const out = Buffer.alloc(117);
  lockId32.copy(out, 0);
  baseRecipient20.copy(out, 32);
  out[52] = outputToken & 0xff;
  assetIdentity32.copy(out, 53);
  valuationRef32.copy(out, 85);
  return out;
}

function txCode(resp) {
  const r = resp.result || resp;
  const meta = r.meta || r.metaData || {};
  return (
    meta.TransactionResult ||
    meta.transactionResult ||
    r.engine_result ||
    r.engineResult ||
    ""
  );
}

async function rpc(method, params) {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ method, params: [params || {}] }),
  });
  const body = await res.json();
  if (body.result && body.result.error) {
    throw new Error(method + " " + body.result.error + " " + (body.result.error_message || ""));
  }
  return body;
}

async function waitForRpc() {
  for (let i = 0; i < 60; i++) {
    try {
      const s = await rpc("server_info", {});
      if (s.result) return s;
    } catch (e) {}
    await sleep(500);
  }
  throw new Error("xrpld RPC did not come up");
}

function startXrpld() {
  fs.rmSync(HOME, { recursive: true, force: true });
  fs.mkdirSync(HOME + "/nudb", { recursive: true });
  const cfg = `
[server]
port_rpc_admin_local
port_ws_admin_local

[port_rpc_admin_local]
port = 5005
ip = 127.0.0.1
admin = 127.0.0.1
protocol = http

[port_ws_admin_local]
port = 6006
ip = 127.0.0.1
admin = 127.0.0.1
protocol = ws

[node_size]
tiny

[node_db]
type=NuDB
path=${HOME}/nudb
online_delete=256
advisory_delete=0

[ledger_history]
256

[database_path]
${HOME}/db

[debug_logfile]
${HOME}/debug.log

[rpc_startup]
{ "command": "log_level", "severity": "error" }
`;
  fs.writeFileSync(HOME + "/xrpld.cfg", cfg);
  const child = spawn(XRPLD, ["--standalone", "--conf", HOME + "/xrpld.cfg", "--start"], {
    stdio: ["ignore", "ignore", fs.openSync(HOME + "/stderr.log", "w")],
  });
  child.on("exit", (code) => console.log("xrpld exit", code));
  return child;
}

async function main() {
  if (!fs.existsSync(XRPLD)) throw new Error("xrpld binary missing at " + XRPLD);
  console.log("starting", XRPLD);
  const child = startXrpld();
  try {
    const info = await waitForRpc();
    console.log("server_info status", JSON.stringify(info.result.info || info.result).slice(0, 500));
    // Close the genesis ledger so account state is validated.
    await rpc("ledger_accept", {});
    const client = new xrpl.Client(WS);
    await client.connect();

    const master = xrpl.Wallet.fromSeed("snoPBrXtMeMyMHUVTgbuqAfg1SUTb", { algorithm: "secp256k1" });
    const source = xrpl.Wallet.generate();
    const devFund = xrpl.Wallet.generate();
    const release = xrpl.Wallet.generate();
    const stranger = xrpl.Wallet.generate();
    console.log("FIXTURE source", source.address, "seed", source.seed);
    console.log("FIXTURE devFund", devFund.address, "seed", devFund.seed);
    console.log("FIXTURE release", release.address, "seed", release.seed);
    console.log("FIXTURE stranger", stranger.address, "seed", stranger.seed);

    async function apply(wallet, tx, label) {
      const prepared = await client.autofill(tx);
      const signed = wallet.sign(prepared);
      const submitted = await client.submit(signed.tx_blob);
      const engine = submitted.result.engine_result || submitted.result.engineResult;
      console.log(label, "submit", engine, signed.hash);
      await client.request({ command: "ledger_accept" });
      let looked = null;
      for (let i = 0; i < 4; i++) {
        try {
          looked = await client.request({ command: "tx", transaction: signed.hash });
          break;
        } catch (e) {
          await client.request({ command: "ledger_accept" });
        }
      }
      const code = looked ? txCode(looked) : engine;
      console.log(label, "result", code);
      return { hash: signed.hash, code, prepared, looked, engine };
    }

    async function balance(addr) {
      const r = await client.request({
        command: "account_info",
        account: addr,
        ledger_index: "validated",
      });
      return BigInt(r.result.account_data.Balance);
    }

    const fundDrops = "200000000"; // 200 XRP, above reserve, so the 1 XRP gross lock fits
    for (const [w, name] of [
      [source, "fund-source"],
      [devFund, "fund-dev"],
      [release, "fund-release"],
      [stranger, "fund-stranger"],
    ]) {
      const r = await apply(master, {
        TransactionType: "Payment",
        Account: master.address,
        Destination: w.address,
        Amount: fundDrops,
      }, name);
      assert(r.code === "tesSUCCESS", name + " tesSUCCESS (" + r.code + ")");
    }

    const auth = await apply(release, {
      TransactionType: "AccountSet",
      Account: release.address,
      SetFlag: xrpl.AccountSetAsfFlags.asfDepositAuth,
    }, "deposit-auth");
    assert(auth.code === "tesSUCCESS", "release DepositAuth set (" + auth.code + ")");

    const payload = buildBindingPayload({
      lockId32: crypto.createHash("sha256").update("xrpl-lock-001").digest(),
      baseRecipient20: Buffer.from("12345678901234567890"),
      outputToken: 1,
      assetIdentity32: crypto.createHash("sha256").update("native-XRP").digest(),
      valuationRef32: crypto.createHash("sha256").update("valuation-ref-1").digest(),
    });
    assert(payload.length === 117, "payload 117 bytes");
    const binding = crypto.createHash("sha256").update(payload).digest();
    const bindingHex = binding.toString("hex").toUpperCase();

    const gross = 1_000_000n;
    const fee = (gross * 500n) / 10000n;
    const principal = gross - fee;
    assert(fee === 50_000n, "fee floor(1000000 * 500 / 10000) = 50000");
    assert(principal === 950_000n, "principal 950000");

    const memo = [{
      Memo: {
        MemoType: Buffer.from("vf-lock-sha256").toString("hex").toUpperCase(),
        MemoData: bindingHex,
      },
    }];

    const pay = await apply(source, {
      TransactionType: "Payment",
      Account: source.address,
      Destination: devFund.address,
      Amount: fee.toString(),
      InvoiceID: bindingHex,
      Memos: memo,
    }, "fee-payment");
    assert(pay.code === "tesSUCCESS", "fee Payment tesSUCCESS (" + pay.code + ")");
    assert(pay.prepared.Amount === "50000", "fee Payment amount is 50000 drops");
    assert(String(pay.prepared.InvoiceID).toUpperCase() === bindingHex, "InvoiceID is SHA-256 of 117-byte payload");

    const led = await client.request({ command: "ledger", ledger_index: "validated" });
    const parentClose = Number(led.result.ledger.close_time || led.result.ledger.closeTime);
    const finishAfter = parentClose + 20;
    console.log("parentClose", parentClose, "FinishAfter", finishAfter, "unix", finishAfter + RIPPLE_EPOCH);

    const esc = await apply(source, {
      TransactionType: "EscrowCreate",
      Account: source.address,
      Destination: release.address,
      Amount: principal.toString(),
      FinishAfter: finishAfter,
      Memos: memo,
    }, "escrow-create");
    assert(esc.code === "tesSUCCESS", "EscrowCreate tesSUCCESS (" + esc.code + ")");
    assert(!("CancelAfter" in esc.prepared), "CancelAfter omitted on EscrowCreate");
    assert(esc.prepared.Amount === "950000", "escrow Amount is principal 950000");
    assert(pay.hash !== esc.hash, "fee Payment and EscrowCreate are two transactions");

    const objects = await client.request({
      command: "account_objects",
      account: source.address,
      ledger_index: "validated",
      type: "escrow",
    });
    const rows = objects.result.account_objects || [];
    assert(rows.length === 1, "one escrow object");
    const row = rows[0];
    console.log("escrow object", JSON.stringify(row));
    assert(row.CancelAfter === undefined && row.cancelAfter === undefined, "escrow ledger object has no CancelAfter");
    assert(String(row.Amount) === "950000", "escrow object amount 950000");
    const offerSeq = Number(row.PreviousTxnLgrSeq ? esc.prepared.Sequence : esc.prepared.Sequence);
    const seq = Number(esc.prepared.Sequence);

    const devBefore = await balance(devFund.address);
    const relBefore = await balance(release.address);
    console.log("dev balance after fee", devBefore.toString(), "release before finish", relBefore.toString());

    const cancel = await apply(source, {
      TransactionType: "EscrowCancel",
      Account: source.address,
      Owner: source.address,
      OfferSequence: seq,
    }, "escrow-cancel");
    assert(cancel.code !== "tesSUCCESS", "EscrowCancel rejected (" + cancel.code + ")");
    assert(cancel.code === "tecNO_PERMISSION", "EscrowCancel tecNO_PERMISSION because CancelAfter is omitted (" + cancel.code + ")");
    const still = await client.request({
      command: "account_objects",
      account: source.address,
      ledger_index: "validated",
      type: "escrow",
    });
    assert((still.result.account_objects || []).length === 1, "principal stays escrowed after cancel attempt");

    const early = await apply(release, {
      TransactionType: "EscrowFinish",
      Account: release.address,
      Owner: source.address,
      OfferSequence: seq,
    }, "early-finish");
    assert(early.code === "tecNO_PERMISSION", "EscrowFinish before FinishAfter fails (" + early.code + ")");
    const still2 = await client.request({
      command: "account_objects",
      account: source.address,
      ledger_index: "validated",
      type: "escrow",
    });
    assert((still2.result.account_objects || []).length === 1, "principal stays escrowed before FinishAfter");
    const relMid = await balance(release.address);
    // early finish charges the destination a fee but does not deliver principal
    assert(relMid < relBefore, "early finish charged a fee");
    assert(relBefore - relMid < 1000n, "early finish did not deliver principal (delta " + (relBefore - relMid) + ")");

    const other = await apply(stranger, {
      TransactionType: "EscrowFinish",
      Account: stranger.address,
      Owner: source.address,
      OfferSequence: seq,
    }, "non-destination-finish");
    assert(other.code !== "tesSUCCESS", "non-destination cannot finish (" + other.code + ")");
    assert(other.code === "tecNO_PERMISSION", "non-destination EscrowFinish tecNO_PERMISSION (" + other.code + ")");
    const still3 = await client.request({
      command: "account_objects",
      account: source.address,
      ledger_index: "validated",
      type: "escrow",
    });
    assert((still3.result.account_objects || []).length === 1, "escrow remains after non-destination finish");

    const unixTarget = (finishAfter + RIPPLE_EPOCH + 2) * 1000;
    const waitMs = unixTarget - Date.now();
    console.log("sleeping ms", waitMs);
    if (waitMs > 0) await sleep(waitMs);
    await client.request({ command: "ledger_accept" });
    await client.request({ command: "ledger_accept" });
    const led2 = await client.request({ command: "ledger", ledger_index: "validated" });
    const close2 = Number(led2.result.ledger.close_time || led2.result.ledger.closeTime);
    console.log("close after wait", close2, "FinishAfter", finishAfter);
    assert(close2 > finishAfter, "parent close time is after FinishAfter");

    const relPre = await balance(release.address);
    const fin = await apply(release, {
      TransactionType: "EscrowFinish",
      Account: release.address,
      Owner: source.address,
      OfferSequence: seq,
    }, "destination-finish");
    assert(fin.code === "tesSUCCESS", "destination finishes once (" + fin.code + ")");
    const relPost = await balance(release.address);
    const networkFee = BigInt(fin.prepared.Fee);
    console.log("release delta", (relPost - relPre).toString(), "networkFee", networkFee.toString());
    assert(relPost - relPre === principal - networkFee, "destination receives principal net of the finish fee");
    const gone = await client.request({
      command: "account_objects",
      account: source.address,
      ledger_index: "validated",
      type: "escrow",
    });
    assert((gone.result.account_objects || []).length === 0, "escrow object consumed");

    const again = await apply(release, {
      TransactionType: "EscrowFinish",
      Account: release.address,
      Owner: source.address,
      OfferSequence: seq,
    }, "second-finish");
    assert(again.code !== "tesSUCCESS", "second finish fails (" + again.code + ")");

    const devAfter = await balance(devFund.address);
    // dev was funded then received exactly the fee payment (no other txs)
    console.log("devFund balance", devAfter.toString());
    assert(devAfter - BigInt(fundDrops) === fee, "Dev Fund received exactly 50000 drops");

    console.log("XRPL_HOLD_RELEASE_OK");
    await client.disconnect();
    child.kill("SIGTERM");
  } catch (e) {
    child.kill("SIGTERM");
    throw e;
  }
}

main().catch((e) => {
  console.error(e && e.stack ? e.stack : e);
  process.exit(1);
});
