/**
 * XRP Ledger reader fixture (test only, local standalone rippled).
 *
 * Makes real XRP Ledger Commitment Vault locks on a local standalone node and
 * writes what the Base reader needs to prove them:
 *   - the closed ledger header fields (ledger hash = SHA-512Half("LWR\0" || header)),
 *   - every transaction + metadata of that ledger (the full transaction tree),
 *   - for the lock's two transactions (fee Payment to the Dev Fund and
 *     EscrowCreate of the principal, same ledger, same account, bound by
 *     SHA-256 of the 117-byte payload in InvoiceID / MemoData): the inner
 *     nodes from the leaf to transaction_hash.
 * All accounts are generated here. The standalone genesis account is the
 * well-known public test genesis of rippled --standalone. No live network.
 *
 * Usage: XRPLD_BIN=/path/to/rippled node non-evm-locks/xrpl/reader_fixture.mjs out.json
 */
import { spawn } from "child_process";
import crypto from "crypto";
import fs from "fs";
import { createRequire } from "module";

const require = createRequire(process.env.VF_JS_PACKAGE || "/tmp/vf-js/package.json");
const xrpl = require("xrpl");

const HOME = "/tmp/vf-xrpl-reader";
const WS = "ws://127.0.0.1:6016";
const XRPLD = process.env.XRPLD_BIN || "/usr/bin/xrpld";
const OUT = process.argv[2];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sha512half = (b) => crypto.createHash("sha512").update(b).digest().subarray(0, 32);
const u32 = (n) => { const b = Buffer.alloc(4); b.writeUInt32BE(Number(n)); return b; };
const u64 = (n) => { const b = Buffer.alloc(8); b.writeBigUInt64BE(BigInt(n)); return b; };
function vl(b) {
  const n = b.length;
  if (n <= 192) return Buffer.concat([Buffer.from([n]), b]);
  if (n <= 12480) { const m = n - 193; return Buffer.concat([Buffer.from([193 + (m >> 8), m & 0xff]), b]); }
  const m = n - 12481; return Buffer.concat([Buffer.from([241 + (m >> 16), (m >> 8) & 0xff, m & 0xff]), b]);
}

function startNode() {
  fs.rmSync(HOME, { recursive: true, force: true });
  fs.mkdirSync(HOME + "/db", { recursive: true });
  fs.writeFileSync(HOME + "/rippled.cfg", `
[server]
port_ws_admin_local

[port_ws_admin_local]
port = 6016
ip = 127.0.0.1
admin = 127.0.0.1
protocol = ws

[node_size]
tiny

[node_db]
type=NuDB
path=${HOME}/db/nudb

[database_path]
${HOME}/db

[debug_logfile]
${HOME}/debug.log
`);
  return spawn(XRPLD, ["--standalone", "--conf", HOME + "/rippled.cfg", "--start"], { stdio: "ignore" });
}

function payload117({ lockId, recipient, outputToken, assetIdentity, valuation }) {
  const out = Buffer.alloc(117);
  lockId.copy(out, 0); recipient.copy(out, 32); out[52] = outputToken; assetIdentity.copy(out, 53); valuation.copy(out, 85);
  return out;
}

// SHAMap of the ledger's transactions. Leaf: SHA512Half("SND\0"||VL(tx)||VL(meta)||txid).
function buildTree(items) {
  const leaf = (it) => sha512half(Buffer.concat([Buffer.from("534E4400", "hex"), vl(it.tx), vl(it.meta), it.id]));
  const nib = (id, d) => (d % 2 === 0 ? id[d >> 1] >> 4 : id[d >> 1] & 15);
  function node(list, depth) {
    if (list.length === 1 && depth > 0) return { hash: leaf(list[0]), leafOf: list[0] };
    const kids = Array.from({ length: 16 }, () => []);
    for (const it of list) kids[nib(it.id, depth)].push(it);
    const children = kids.map((k) => (k.length ? node(k, depth + 1) : null));
    const hashes = children.map((c) => (c ? c.hash : Buffer.alloc(32)));
    return { hash: sha512half(Buffer.concat([Buffer.from("4D494E00", "hex"), ...hashes])), children, hashes };
  }
  const root = node(items, 0);
  function path(id) {
    const inner = []; let n = root; let d = 0;
    while (!n.leafOf) { inner.push(Buffer.concat(n.hashes)); n = n.children[nib(id, d)]; d++; }
    if (!n.leafOf.id.equals(id)) throw new Error("path");
    return inner.reverse(); // leaf-side first
  }
  return { root: root.hash, path };
}

async function main() {
  const child = startNode();
  let client;
  try {
    for (let i = 0; i < 60; i++) {
      try { client = new xrpl.Client(WS); await client.connect(); break; } catch (e) { client = null; await sleep(500); }
    }
    if (!client) throw new Error("rippled did not start");
    await client.request({ command: "ledger_accept" });
    const genesis = xrpl.Wallet.fromSeed("snoPBrXtMeMyMHUVTgbuqAfg1SUTb", { algorithm: "secp256k1" });
    const source = xrpl.Wallet.generate(), devFund = xrpl.Wallet.generate(), release = xrpl.Wallet.generate(), other = xrpl.Wallet.generate();
    const submit = async (w, tx) => {
      const p = await client.autofill(tx);
      const s = w.sign(p);
      const r = await client.submit(s.tx_blob);
      return { hash: s.hash, engine: r.result.engine_result, prepared: p };
    };
    for (const w of [source, devFund, release, other]) {
      await submit(genesis, { TransactionType: "Payment", Account: genesis.address, Destination: w.address, Amount: "1000000000" });
      await client.request({ command: "ledger_accept" });
    }

    async function lockInOneLedger(tag, gross, durationSecs, extra = {}) {
      const p = payload117({
        lockId: crypto.createHash("sha256").update("xrpl-lock-" + tag).digest(),
        recipient: Buffer.from("1234567890123456789012345678901234567890", "hex"),
        outputToken: 0,
        assetIdentity: crypto.createHash("sha256").update("native-XRP").digest(),
        valuation: crypto.createHash("sha256").update("valuation-" + tag).digest(),
      });
      const binding = crypto.createHash("sha256").update(p).digest().toString("hex").toUpperCase();
      const fee = (gross * 500n) / 10000n;
      const principal = gross - fee;
      const memo = [{ Memo: { MemoType: Buffer.from("vf-lock-sha256").toString("hex").toUpperCase(), MemoData: binding } }];
      const led = await client.request({ command: "ledger", ledger_index: "validated" });
      const finishAfter = Number(led.result.ledger.close_time) + durationSecs;
      const a = await submit(source, { TransactionType: "Payment", Account: source.address, Destination: extra.payTo || devFund.address,
        Amount: (extra.fee ?? fee).toString(), InvoiceID: binding, Memos: memo });
      const e = await submit(source, { TransactionType: "EscrowCreate", Account: source.address, Destination: release.address,
        Amount: principal.toString(), FinishAfter: finishAfter, Memos: memo, Sequence: a.prepared.Sequence + 1 });
      // an unrelated transaction in the same ledger, so the tree has a third leaf
      const n = await submit(other, { TransactionType: "Payment", Account: other.address, Destination: release.address, Amount: "12345" });
      await client.request({ command: "ledger_accept" });
      const H0 = (await client.request({ command: "ledger", ledger_index: "validated" })).result.ledger;
      const L = (await client.request({ command: "ledger", ledger_index: Number(H0.ledger_index), transactions: true, expand: true, binary: true })).result.ledger;
      L.ledger_index = H0.ledger_index;
      const items = L.transactions.map((t) => ({ tx: Buffer.from(t.tx_blob, "hex"), meta: Buffer.from(t.meta_blob || t.meta, "hex") }));
      if (!items.length || !items[0].meta.length) throw new Error("keys " + JSON.stringify(Object.keys(L.transactions[0] || {})));
      for (const it of items) it.id = sha512half(Buffer.concat([Buffer.from("54584E00", "hex"), it.tx]));
      const tree = buildTree(items);
      const H = (await client.request({ command: "ledger", ledger_index: L.ledger_index })).result.ledger;
      Object.assign(L, { total_coins: H.total_coins, parent_hash: H.parent_hash, account_hash: H.account_hash, transaction_hash: H.transaction_hash,
        parent_close_time: H.parent_close_time, close_time: H.close_time, close_time_resolution: H.close_time_resolution, close_flags: H.close_flags,
        ledger_hash: H.ledger_hash, ledger_index: H.ledger_index });
      const header = Buffer.concat([u32(L.ledger_index), u64(L.total_coins), Buffer.from(L.parent_hash, "hex"), Buffer.from(L.transaction_hash, "hex"),
        Buffer.from(L.account_hash, "hex"), u32(L.parent_close_time), u32(L.close_time), Buffer.from([L.close_time_resolution, L.close_flags])]);
      if (!sha512half(Buffer.concat([Buffer.from("4C575200", "hex"), header])).equals(Buffer.from(L.ledger_hash, "hex"))) throw new Error("ledger hash mismatch");
      if (!tree.root.equals(Buffer.from(L.transaction_hash, "hex"))) throw new Error("transaction tree root mismatch");
      const pick = (h) => items.find((it) => it.id.toString("hex").toUpperCase() === h);
      const pay = pick(a.hash), esc = pick(e.hash), noise = pick(n.hash);
      if (!pay || !esc || !noise) throw new Error("lock transactions not in one ledger: " + [a.engine, e.engine, n.engine].join(","));
      const hex = (b) => "0x" + b.toString("hex");
      const ent = (it) => ({ tx: hex(it.tx), meta: hex(it.meta), inner: tree.path(it.id).map(hex) });
      return {
        ledgerHash: "0x" + L.ledger_hash, ledgerIndex: Number(L.ledger_index), header: hex(header), closeTime: Number(L.close_time),
        payload: hex(p), durationSecs, gross: gross.toString(), fee: fee.toString(), principal: principal.toString(), finishAfter,
        payment: ent(pay), escrow: ent(esc), unrelated: ent(noise),
        engines: [a.engine, e.engine, n.engine],
      };
    }

    const out = {
      note: "Local standalone rippled; generated accounts; test only.",
      devFundAccountId: "0x" + Buffer.from(xrpl.decodeAccountID(devFund.address)).toString("hex"),
      releaseAccountId: "0x" + Buffer.from(xrpl.decodeAccountID(release.address)).toString("hex"),
      week: await lockInOneLedger("week", 10_000_000n, 604800),
      handshake: await lockInOneLedger("hs", 1_000_000n, 3600),
      wrongFee: await lockInOneLedger("wrongfee", 10_000_000n, 604800, { fee: 400_000n }),
      wrongDevFund: await lockInOneLedger("wrongdev", 10_000_000n, 604800, { payTo: other.address }),
    };
    fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
    console.log("wrote", OUT, out.week.engines, "ledger", out.week.ledgerIndex);
  } finally {
    if (client) await client.disconnect().catch(() => {});
    child.kill("SIGTERM");
  }
}
main().catch((e) => { console.error(e.stack || e); process.exit(1); });
