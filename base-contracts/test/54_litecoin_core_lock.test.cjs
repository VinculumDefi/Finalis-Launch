// =============================================================================
// Litecoin Core regtest — one 5/95 lock, mined and spent by the node itself.
//
// litecoind creates the coins and mines every transaction. The dev fund output
// is exactly 5%. The principal is exactly 95%, in one P2SH script:
//   <maturity> OP_CHECKLOCKTIMEVERIFY OP_DROP <pubkey> OP_CHECKSIG
// There is no second path. The script binds one key at creation. The node
// rejects a signed spend before that maturity time and, after maturity, mines
// one spend that pays that key exactly the 95%. A second spend is rejected.
//
// The 117-byte payload is test/lib/c8NulldataPayload.cjs. If the node rejects
// that output as too large, the output is the SHA-256 of those same bytes.
// This file does not use bitcore, does not use digibyted, does not choose a
// confirmation count, and does not hand-build a header. A step the node
// cannot perform throws.
// =============================================================================

const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const net = require("net");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const { expect } = require("chai");
const bitcoin = require("bitcoinjs-lib");
const ecc = require("tiny-secp256k1");
const { ECPairFactory } = require("ecpair");

const { buildNulldataPayload } = require("./lib/c8NulldataPayload.cjs");

bitcoin.initEccLib(ecc);
const ECPair = ECPairFactory(ecc);

// One key, bound into the redeem script at creation. Private key 1.
const RELEASE_PRIV = Buffer.concat([Buffer.alloc(31, 0), Buffer.from([1])]);
const RELEASE_KEY = ECPair.fromPrivateKey(RELEASE_PRIV);
const RELEASE_PUBKEY = Buffer.from(RELEASE_KEY.publicKey);

const GROSS = 1_000_000n;
const DEV_SATS = 50_000n;
const PRINCIPAL_SATS = 950_000n;
// Miner fee is not part of the 5/95 split. It is paid from the coinbase change.
const MINER_FEE_SATS = 200_000n;
// Each block time is this far after the previous header the node reported.
// Litecoin regtest does not retarget, and this is not a confirmation count
// and not a header we build. Staying on that clock also keeps the chain
// below the MWEB BIP9 start, which is a timestamp in the node, not a depth.
const BLOCK_TIME_STEP = 150;

const RPC_USER = "ltctest";
const RPC_PASSWORD = "ltctest";

function findLitecoind() {
  const candidates = [
    process.env.LITECOIND,
    "/opt/litecoin/bin/litecoind",
    "/usr/local/bin/litecoind",
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  const pathEnv = process.env.PATH || "";
  for (const dir of pathEnv.split(":")) {
    if (!dir) continue;
    const candidate = path.join(dir, "litecoind");
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(
    "Litecoin Core (litecoind) is not installed; refusing to skip"
  );
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close((err) => (err ? reject(err) : resolve(port)));
    });
  });
}

function rpcCall({ port, wallet, method, params }) {
  const body = JSON.stringify({
    jsonrpc: "1.0",
    id: "litecoin-lock",
    method,
    params,
  });
  const urlPath = wallet ? "/wallet/" + encodeURIComponent(wallet) : "/";
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        path: urlPath,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          Authorization:
            "Basic " +
            Buffer.from(RPC_USER + ":" + RPC_PASSWORD).toString("base64"),
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let parsed;
          try {
            parsed = JSON.parse(text);
          } catch (err) {
            reject(
              new Error(
                "Litecoin RPC " +
                  method +
                  " returned non-JSON (" +
                  res.statusCode +
                  "): " +
                  text
              )
            );
            return;
          }
          if (parsed.error) {
            const error = new Error(
              "Litecoin RPC " +
                method +
                " error " +
                parsed.error.code +
                ": " +
                parsed.error.message
            );
            error.code = parsed.error.code;
            error.rpcMessage = parsed.error.message;
            reject(error);
            return;
          }
          resolve(parsed.result);
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

function parseTxChecked(hex) {
  const tx = bitcoin.Transaction.fromHex(hex);
  const outputs = tx.outs.map((out) => ({
    value: BigInt(out.value),
    script: Buffer.from(out.script),
  }));
  return { tx, outputs };
}

function sats(amountLtc) {
  return BigInt(Math.round(Number(amountLtc) * 1e8));
}

function cltvRedeem(maturity, pubkey) {
  return bitcoin.script.compile([
    bitcoin.script.number.encode(maturity),
    bitcoin.opcodes.OP_CHECKLOCKTIMEVERIFY,
    bitcoin.opcodes.OP_DROP,
    pubkey,
    bitcoin.opcodes.OP_CHECKSIG,
  ]);
}

function assertSinglePath(redeem, maturity, pubkey) {
  const chunks = bitcoin.script.decompile(redeem);
  const forbidden = [
    bitcoin.opcodes.OP_IF,
    bitcoin.opcodes.OP_NOTIF,
    bitcoin.opcodes.OP_ELSE,
    bitcoin.opcodes.OP_ENDIF,
    bitcoin.opcodes.OP_CHECKMULTISIG,
    bitcoin.opcodes.OP_CHECKMULTISIGVERIFY,
  ];
  for (const op of forbidden) {
    if (chunks.includes(op)) {
      throw new Error("principal script has a second path (opcode " + op + ")");
    }
  }
  const expected = cltvRedeem(maturity, pubkey);
  if (!redeem.equals(expected)) {
    throw new Error("principal script is not maturity CLTV plus one CHECKSIG");
  }
  const pubkeys = chunks.filter(
    (chunk) => Buffer.isBuffer(chunk) && chunk.length === 33 && chunk.equals(pubkey)
  );
  if (pubkeys.length !== 1) {
    throw new Error("principal script does not bind exactly one key");
  }
}

function opReturn(data) {
  return bitcoin.script.compile([bitcoin.opcodes.OP_RETURN, data]);
}

function nulldataPayload(script) {
  const chunks = bitcoin.script.decompile(script);
  if (!chunks || chunks.length !== 2 || chunks[0] !== bitcoin.opcodes.OP_RETURN) {
    throw new Error("output is not a single nulldata push: " + script.toString("hex"));
  }
  if (!Buffer.isBuffer(chunks[1])) {
    throw new Error("nulldata push is not data");
  }
  return chunks[1];
}

describe("Litecoin Core regtest — 5/95 CLTV lock", function () {
  this.timeout(600000);

  it("pays the dev fund 5%, locks 95% to one key, and lets Litecoin Core mine the only mature spend", async function () {
    const litecoind = findLitecoind();
    const payloadHex = buildNulldataPayload();
    const payload = Buffer.from(payloadHex, "hex");
    if (payload.length !== 117) {
      throw new Error("C.8 payload is " + payload.length + " bytes, expected 117");
    }
    const payloadHash = crypto.createHash("sha256").update(payload).digest();

    if (DEV_SATS + PRINCIPAL_SATS !== GROSS) {
      throw new Error("5% and 95% do not sum to the gross");
    }
    if (DEV_SATS * 95n !== PRINCIPAL_SATS * 5n) {
      throw new Error("dev fund is not exactly 5% of the gross");
    }

    const datadir = fs.mkdtempSync(path.join(os.tmpdir(), "ltc-lock-"));
    const rpcPort = await freePort();
    const p2pPort = await freePort();
    const stdoutFd = fs.openSync(path.join(datadir, "stdout.log"), "a");
    const stderrFd = fs.openSync(path.join(datadir, "stderr.log"), "a");
    const child = spawn(
      litecoind,
      [
        "-regtest",
        "-datadir=" + datadir,
        "-listen=0",
        "-dnsseed=0",
        "-discover=0",
        "-txindex=1",
        "-fallbackfee=0.01",
        "-rpcuser=" + RPC_USER,
        "-rpcpassword=" + RPC_PASSWORD,
        "-rpcbind=127.0.0.1",
        "-rpcallowip=127.0.0.1",
        "-rpcport=" + rpcPort,
        "-port=" + p2pPort,
      ],
      { stdio: ["ignore", stdoutFd, stderrFd] }
    );

    const rpc = (method, params = [], wallet) =>
      rpcCall({ port: rpcPort, wallet, method, params });

    const nodeLog = () => {
      const stderr = fs.readFileSync(path.join(datadir, "stderr.log"), "utf8");
      const stdout = fs.readFileSync(path.join(datadir, "stdout.log"), "utf8");
      return (stderr + "\n" + stdout).slice(-8000);
    };

    const stopNode = async () => {
      try {
        await rpc("stop");
      } catch (err) {
        child.kill("SIGTERM");
      }
      await new Promise((resolve) => {
        const timer = setTimeout(() => {
          child.kill("SIGKILL");
          resolve();
        }, 5000);
        child.once("exit", () => {
          clearTimeout(timer);
          resolve();
        });
      });
      fs.closeSync(stdoutFd);
      fs.closeSync(stderrFd);
    };

    try {
      let started = false;
      let startError = "";
      for (let i = 0; i < 100; i++) {
        if (child.exitCode !== null) {
          throw new Error(
            "Litecoin Core exited before RPC was ready (code " +
              child.exitCode +
              ")\n" +
              nodeLog()
          );
        }
        try {
          await rpc("getblockchaininfo");
          started = true;
          break;
        } catch (err) {
          startError = err && err.message ? err.message : String(err);
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }
      if (!started) {
        throw new Error(
          "Litecoin Core did not accept RPC: " + startError + "\n" + nodeLog()
        );
      }

      await rpc("createwallet", ["miner"]);
      const devAddress = await rpc("getnewaddress", ["", "bech32"], "miner");
      const changeAddress = await rpc("getnewaddress", ["", "bech32"], "miner");
      const devInfo = await rpc("getaddressinfo", [devAddress], "miner");
      const changeInfo = await rpc("getaddressinfo", [changeAddress], "miner");
      const devScript = Buffer.from(devInfo.scriptPubKey, "hex");
      const changeScript = Buffer.from(changeInfo.scriptPubKey, "hex");
      if (devScript.equals(changeScript)) {
        throw new Error("dev fund address and change address are the same");
      }

      const chainAtStart = await rpc("getblockchaininfo");
      const cltvFork = chainAtStart.softforks && chainAtStart.softforks.bip65;
      if (!cltvFork || typeof cltvFork.height !== "number") {
        throw new Error(
          "Litecoin Core did not report the buried CLTV activation height: " +
            JSON.stringify(chainAtStart.softforks)
        );
      }

      async function mineOne(notBefore) {
        const tip = await rpc("getbestblockhash");
        const header = await rpc("getblockheader", [tip]);
        const nextTime = Math.max(header.time + BLOCK_TIME_STEP, notBefore || 0);
        await rpc("setmocktime", [nextTime]);
        const hashes = await rpc("generatetoaddress", [
          1,
          changeAddress,
          5000000,
        ]);
        if (!Array.isArray(hashes) || hashes.length !== 1) {
          throw new Error(
            "Litecoin miner did not return a block: " + JSON.stringify(hashes)
          );
        }
        const mined = await rpc("getblockheader", [hashes[0]]);
        if (mined.previousblockhash !== tip) {
          throw new Error("miner returned a block that does not extend the tip");
        }
        return mined;
      }

      // Mine until the node itself reports CHECKLOCKTIMEVERIFY active at or
      // after the activation height it reported, and until its wallet has a
      // coin the node will let us spend. The height and the coinbase depth
      // come from the node, not from a chosen confirmation count.
      let coin = null;
      let guard = 0;
      while (!coin) {
        const info = await rpc("getblockchaininfo");
        const fork = info.softforks.bip65;
        const cltvActive = fork.active === true && info.blocks >= fork.height;
        if (cltvActive) {
          const utxos = await rpc("listunspent", [1, 9999999], "miner");
          coin = utxos.find((utxo) => sats(utxo.amount) > GROSS + MINER_FEE_SATS);
          if (coin) break;
        }
        await mineOne(0);
        guard += 1;
        if (guard > cltvFork.height + 5000) {
          throw new Error(
            "Litecoin Core never reported an active CLTV fork with a spendable coin " +
              "(height " +
              (await rpc("getblockcount")) +
              ", fork " +
              JSON.stringify(await rpc("getblockchaininfo")).slice(0, 500) +
              ")"
          );
        }
      }

      const inputSats = sats(coin.amount);
      const changeSats = inputSats - GROSS - MINER_FEE_SATS;
      if (changeSats <= 0n) {
        throw new Error("funding coin cannot pay the 5/95 split and the miner fee");
      }

      const chainNow = await rpc("getblockchaininfo");
      const maturity = chainNow.mediantime + 7200;
      if (maturity <= chainNow.mediantime) {
        throw new Error("maturity time is not after the current median time");
      }
      if (maturity < 500000000) {
        throw new Error("maturity must be a timestamp, not a block height");
      }

      const redeem = cltvRedeem(maturity, RELEASE_PUBKEY);
      assertSinglePath(redeem, maturity, RELEASE_PUBKEY);
      const principal = bitcoin.payments.p2sh({ redeem: { output: redeem } });
      const principalScript = Buffer.from(principal.output);
      const bound = bitcoin.payments.p2pkh({ pubkey: RELEASE_PUBKEY });
      const boundScript = Buffer.from(bound.output);
      if (boundScript.equals(principalScript) || boundScript.equals(devScript)) {
        throw new Error("bound key script collides with another output");
      }

      function lockTransaction(data) {
        const tx = new bitcoin.Transaction();
        tx.version = 1;
        tx.locktime = 0;
        tx.addInput(Buffer.from(coin.txid, "hex").reverse(), coin.vout, 0xffffffff);
        tx.addOutput(devScript, Number(DEV_SATS));
        tx.addOutput(principalScript, Number(PRINCIPAL_SATS));
        tx.addOutput(opReturn(data), 0);
        tx.addOutput(changeScript, Number(changeSats));
        return tx;
      }

      async function signFunding(tx) {
        const signed = await rpc(
          "signrawtransactionwithwallet",
          [tx.toHex()],
          "miner"
        );
        if (!signed.complete) {
          throw new Error(
            "Litecoin wallet did not sign the funding input: " +
              JSON.stringify(signed.errors || signed)
          );
        }
        const parsed = bitcoin.Transaction.fromHex(signed.hex);
        if (!parsed.hasWitnesses()) {
          throw new Error("wallet signature did not produce a witness spend of its coin");
        }
        return signed.hex;
      }

      let carried = "bytes";
      let lockHex = await signFunding(lockTransaction(payload));
      let lockTxid;
      try {
        const accepted = await rpc("testmempoolaccept", [[lockHex]]);
        const verdict = accepted && accepted[0];
        if (!verdict) {
          throw new Error(
            "testmempoolaccept returned no verdict: " + JSON.stringify(accepted)
          );
        }
        if (verdict.allowed) {
          lockTxid = await rpc("sendrawtransaction", [lockHex]);
        } else {
          const reason = String(verdict["reject-reason"] || "");
          // IsStandard rejects a nulldata script larger than the node's
          // datacarrier limit, and IsStandardTx reports that failure as
          // "scriptpubkey" (it does not say "datacarrier"). The SHA-256 of
          // the same 117 bytes has to be accepted, or this was some other
          // scriptpubkey failure and the test must throw.
          if (reason !== "scriptpubkey" && !/datacarrier|too-large|oversize/i.test(reason)) {
            throw new Error(
              "node rejected the 117-byte payload for a reason other than size: " +
                JSON.stringify(verdict)
            );
          }
          carried = "sha256";
          lockHex = await signFunding(lockTransaction(payloadHash));
          const hashed = await rpc("testmempoolaccept", [[lockHex]]);
          if (!hashed[0] || hashed[0].allowed !== true) {
            throw new Error(
              "node also rejected the SHA-256 of the 117-byte payload: " +
                JSON.stringify(hashed)
            );
          }
          lockTxid = await rpc("sendrawtransaction", [lockHex]);
        }
      } catch (err) {
        if (carried === "bytes" && err && err.rpcMessage && /datacarrier|scriptpubkey/i.test(err.rpcMessage)) {
          carried = "sha256";
          lockHex = await signFunding(lockTransaction(payloadHash));
          lockTxid = await rpc("sendrawtransaction", [lockHex]);
        } else {
          throw err;
        }
      }

      await mineOne(0);
      const lockVerbose = await rpc("getrawtransaction", [lockTxid, true]);
      if (!lockVerbose.blockhash) {
        throw new Error(
          "Litecoin miner did not include the lock transaction " + lockTxid
        );
      }
      const lockRaw = await rpc("getrawtransaction", [lockTxid, false]);
      const lockParsed = parseTxChecked(lockRaw);
      const devOuts = lockParsed.outputs.filter(
        (out) => out.script.equals(devScript) && out.value === DEV_SATS
      );
      const principalOuts = lockParsed.outputs.filter(
        (out) => out.script.equals(principalScript) && out.value === PRINCIPAL_SATS
      );
      if (devOuts.length !== 1) {
        throw new Error(
          "dev fund did not receive exactly " + DEV_SATS + " satoshis in one output"
        );
      }
      if (principalOuts.length !== 1) {
        throw new Error(
          "principal is not exactly " + PRINCIPAL_SATS + " satoshis in the CLTV script"
        );
      }
      const devVout = lockParsed.outputs.findIndex(
        (out) => out.script.equals(devScript)
      );
      const principalVout = lockParsed.outputs.findIndex(
        (out) => out.script.equals(principalScript)
      );
      const dataVout = lockParsed.outputs.findIndex(
        (out) => out.script.length > 0 && out.script[0] === bitcoin.opcodes.OP_RETURN
      );
      if (dataVout < 0) {
        throw new Error("lock transaction has no nulldata output");
      }
      const carriedBytes = nulldataPayload(lockParsed.outputs[dataVout].script);
      if (lockParsed.outputs[dataVout].value !== 0n) {
        throw new Error("nulldata output is not unspendable zero-value");
      }
      if (carried === "bytes") {
        if (!carriedBytes.equals(payload)) {
          throw new Error("nulldata output does not hold the 117-byte payload");
        }
      } else if (!carriedBytes.equals(payloadHash)) {
        throw new Error(
          "nulldata output does not hold the SHA-256 of the 117-byte payload"
        );
      }
      if (carried === "sha256" && carriedBytes.equals(payload)) {
        throw new Error("SHA-256 fallback unexpectedly stored the raw payload");
      }

      const principalUtxo = await rpc("gettxout", [lockTxid, principalVout]);
      if (!principalUtxo) {
        throw new Error("node does not have the principal output");
      }
      if (sats(principalUtxo.value) !== PRINCIPAL_SATS) {
        throw new Error(
          "node principal balance is " +
            principalUtxo.value +
            ", expected " +
            PRINCIPAL_SATS.toString() +
            " satoshis"
        );
      }
      const devUtxo = await rpc("gettxout", [lockTxid, devVout]);
      if (!devUtxo || sats(devUtxo.value) !== DEV_SATS) {
        throw new Error("node dev-fund balance is not exactly 5%");
      }

      const feeUtxos = await rpc("listunspent", [1, 9999999], "miner");
      const feeCoin = feeUtxos.find(
        (utxo) =>
          utxo.txid + ":" + utxo.vout !== lockTxid + ":" + principalVout &&
          sats(utxo.amount) > MINER_FEE_SATS
      );
      if (!feeCoin) {
        throw new Error("no confirmed coin left to pay the spend's miner fee");
      }
      const feeSats = sats(feeCoin.amount);
      const feeChange = feeSats - MINER_FEE_SATS;

      function spendTransaction(lockTime) {
        const tx = new bitcoin.Transaction();
        tx.version = 1;
        tx.locktime = lockTime >>> 0;
        tx.addInput(
          Buffer.from(lockTxid, "hex").reverse(),
          principalVout,
          0xfffffffe
        );
        tx.addInput(
          Buffer.from(feeCoin.txid, "hex").reverse(),
          feeCoin.vout,
          0xffffffff
        );
        tx.addOutput(boundScript, Number(PRINCIPAL_SATS));
        tx.addOutput(changeScript, Number(feeChange));
        return tx;
      }

      async function signSpend(lockTime) {
        const unsigned = spendTransaction(lockTime);
        const walletSigned = await rpc(
          "signrawtransactionwithwallet",
          [
            unsigned.toHex(),
            [
              {
                txid: lockTxid,
                vout: principalVout,
                scriptPubKey: principalScript.toString("hex"),
                redeemScript: redeem.toString("hex"),
                amount: Number(PRINCIPAL_SATS) / 1e8,
              },
            ],
          ],
          "miner"
        );
        const tx = bitcoin.Transaction.fromHex(walletSigned.hex);
        const sighash = tx.hashForSignature(
          0,
          redeem,
          bitcoin.Transaction.SIGHASH_ALL
        );
        const sig = bitcoin.script.signature.encode(
          Buffer.from(RELEASE_KEY.sign(sighash)),
          bitcoin.Transaction.SIGHASH_ALL
        );
        tx.setInputScript(0, bitcoin.script.compile([sig, redeem]));
        if (tx.ins[0].sequence !== 0xfffffffe) {
          throw new Error("principal input sequence disables the maturity check");
        }
        return tx.toHex();
      }

      const before = await rpc("getblockchaininfo");
      if (before.mediantime >= maturity) {
        throw new Error("chain median time is already at maturity; the early spend is not early");
      }
      // nLockTime must be strictly below the next block's median time or the
      // node rejects the transaction as non-final before it runs the script.
      // A time still below the CLTV maturity makes the script itself fail.
      const earlyLockTime = before.mediantime - 1;
      if (earlyLockTime >= maturity || earlyLockTime < 500000000) {
        throw new Error(
          "cannot build a final spend that is still before maturity (mtp " +
            before.mediantime +
            ", maturity " +
            maturity +
            ")"
        );
      }
      const earlyHex = await signSpend(earlyLockTime);
      let earlyRejected = false;
      let earlyError = "";
      try {
        const earlyId = await rpc("sendrawtransaction", [earlyHex]);
        throw new Error(
          "node accepted a spend before maturity: " + earlyId
        );
      } catch (err) {
        if (err && /accepted a spend before maturity/.test(err.message) && !err.rpcMessage) {
          throw err;
        }
        earlyRejected = true;
        earlyError = err && (err.rpcMessage || err.message) ? err.rpcMessage || err.message : String(err);
      }
      if (!earlyRejected) {
        throw new Error("node did not reject the spend before maturity");
      }
      if (!/locktime/i.test(earlyError)) {
        throw new Error(
          "spend before maturity was rejected for the wrong reason: " + earlyError
        );
      }
      const stillThere = await rpc("gettxout", [lockTxid, principalVout]);
      if (!stillThere || sats(stillThere.value) !== PRINCIPAL_SATS) {
        throw new Error(
          "principal balance did not stay after the rejected early spend: " +
            JSON.stringify(stillThere)
        );
      }

      let advanced = 0;
      while (true) {
        const info = await rpc("getblockchaininfo");
        // Finality is strict: nLockTime must be less than the median time.
        if (info.mediantime > maturity) break;
        await mineOne(maturity + 1);
        advanced += 1;
        if (advanced > 1000) {
          throw new Error(
            "median time did not reach maturity (mtp " +
              info.mediantime +
              ", maturity " +
              maturity +
              ")"
          );
        }
      }

      const matureHex = await signSpend(maturity);
      const spendTxid = await rpc("sendrawtransaction", [matureHex]);
      await mineOne(maturity);
      const spendVerbose = await rpc("getrawtransaction", [spendTxid, true]);
      if (!spendVerbose.blockhash) {
        throw new Error("Litecoin miner did not include the mature spend " + spendTxid);
      }
      const spendParsed = parseTxChecked(
        await rpc("getrawtransaction", [spendTxid, false])
      );
      const paid = spendParsed.outputs.filter(
        (out) => out.script.equals(boundScript) && out.value === PRINCIPAL_SATS
      );
      if (paid.length !== 1) {
        throw new Error(
          "bound key did not receive exactly " +
            PRINCIPAL_SATS +
            " satoshis; outputs " +
            spendParsed.outputs
              .map((out) => out.value.toString() + ":" + out.script.toString("hex"))
              .join(",")
        );
      }
      const boundVout = spendParsed.outputs.findIndex((out) =>
        out.script.equals(boundScript)
      );
      const received = await rpc("gettxout", [spendTxid, boundVout]);
      if (!received || sats(received.value) !== PRINCIPAL_SATS) {
        throw new Error(
          "node balance of the bound key is not exactly the 95%: " +
            JSON.stringify(received)
        );
      }
      if (await rpc("gettxout", [lockTxid, principalVout])) {
        throw new Error("principal output is still spendable after the mature spend");
      }

      let secondRejected = false;
      let secondError = "";
      try {
        const secondId = await rpc("sendrawtransaction", [matureHex]);
        throw new Error("node accepted a second spend: " + secondId);
      } catch (err) {
        if (err && /accepted a second spend/.test(err.message) && !err.rpcMessage) {
          throw err;
        }
        secondRejected = true;
        secondError = err && (err.rpcMessage || err.message) ? err.rpcMessage || err.message : String(err);
      }
      if (!secondRejected) {
        throw new Error("node did not reject the second spend");
      }
      const afterSecond = await rpc("gettxout", [spendTxid, boundVout]);
      if (!afterSecond || sats(afterSecond.value) !== PRINCIPAL_SATS) {
        throw new Error(
          "bound key balance changed after the rejected second spend: " +
            JSON.stringify(afterSecond) +
            " (" +
            secondError +
            ")"
        );
      }

      console.log(
        "\n    Litecoin Core paid the bound key " +
          PRINCIPAL_SATS.toString() +
          " satoshis (95% of " +
          GROSS.toString() +
          "). Dev fund " +
          DEV_SATS.toString() +
          " satoshis. Nulldata holds " +
          (carried === "bytes" ? "the 117-byte payload" : "the SHA-256 of the 117-byte payload") +
          ".\n"
      );
    } finally {
      await stopNode();
      fs.rmSync(datadir, { recursive: true, force: true });
    }
  });
});
