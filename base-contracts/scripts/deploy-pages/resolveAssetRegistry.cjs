/**
 * Resolves the full Approved Asset Registry into the exact arguments of
 * VinculumFinalisVerifier.registerAssetPrecision(environmentId,
 * canonicalAssetId, symbol, decimals, custodyClass, custodyPath).
 *
 * Read-only. Sends no transaction, signs nothing, reads no key.
 *
 * Inputs (nothing typed by hand):
 *   - Registry JSON at REGISTRY_URL from src/lib/vfRegistryVerification.js
 *     (1,001 records). Cosmos is dropped: Cosmos Hub is not a deployment row.
 *   - Native decimals: the native-* rows of ASSET_PRECISION_TABLE in
 *     src/lib/vfBaseRegistry.js.
 *   - Token decimals: decimals() read on the token's own network (EVM) or the
 *     mint account (Solana) at a recorded block / slot.
 *   - Asset id convention: src/lib/vfProofNormalizer.js
 *       native            -> "native-<symbol>"
 *       EVM token         -> "<symbol>"           (normalizeEvmEvidence)
 *       Solana SPL token  -> "<mint>"             (normalizeSolanaEvidence)
 *     canonicalAssetId = keccak256(abi.encodePacked(environmentId, assetId))
 *     (AssetPrecisionEntry comment in VinculumFinalisVerifier.sol).
 *
 * A record whose decimals cannot be read is written with decimals=null and a
 * reason. It is never given a guessed value.
 *
 * Usage: node scripts/deploy-pages/resolveAssetRegistry.cjs
 * Output: deployment/assetRegistry.resolved.json
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { ethers } = require("ethers");

const ROOT = path.resolve(__dirname, "../../..");
const OUT = path.resolve(__dirname, "../../deployment/assetRegistry.resolved.json");

const verificationSrc = fs.readFileSync(path.join(ROOT, "src/lib/vfRegistryVerification.js"), "utf8");
const REGISTRY_URL = /REGISTRY_URL\s*=\s*'([^']+)'/.exec(verificationSrc)[1];
const REGISTRY_TOTAL = Number(/REGISTRY_TOTAL\s*=\s*(\d+)/.exec(verificationSrc)[1]);

// Code ids in vfBaseRegistry.js -> registry / verifier environment names.
const CODE_TO_ENV = { BNB: "BNB Smart Chain", XRPL: "XRP Ledger", BitcoinCash: "Bitcoin Cash", CosmosHub: "Cosmos" };
const baseRegistrySrc = fs.readFileSync(path.join(ROOT, "src/lib/vfBaseRegistry.js"), "utf8");
const NATIVE_DECIMALS = {};
for (const m of baseRegistrySrc.matchAll(/'([A-Za-z]+)\/native-[A-Za-z]+'\s*:\s*\{\s*symbol:\s*'([A-Z]+)',\s*decimals:\s*(\d+)/g)) {
  NATIVE_DECIMALS[CODE_TO_ENV[m[1]] || m[1]] = { symbol: m[2], decimals: Number(m[3]) };
}

const EVM_RPC = {
  Ethereum: { url: "https://ethereum-rpc.publicnode.com", chainId: 1 },
  "BNB Smart Chain": { url: "https://bsc-rpc.publicnode.com", chainId: 56 },
  Avalanche: { url: "https://avalanche-c-chain-rpc.publicnode.com", chainId: 43114 },
  Polygon: { url: "https://polygon-bor-rpc.publicnode.com", chainId: 137 },
  Arbitrum: { url: "https://arbitrum-one-rpc.publicnode.com", chainId: 42161 },
  Base: { url: "https://base-rpc.publicnode.com", chainId: 8453 },
  Optimism: { url: "https://optimism-rpc.publicnode.com", chainId: 10 },
};
const SOLANA_RPC = "https://api.mainnet-beta.solana.com";
const CLASS = { S1: 1, S2: 2, S3: 3 };
const DECIMALS_SELECTOR = "0x313ce567";

async function rpc(url, body) {
  for (let attempt = 1; attempt <= 8; attempt++) {
    try {
      const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      if (res.status === 429) { await new Promise((r) => setTimeout(r, 2000 * attempt)); continue; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (Array.isArray(body) && (!Array.isArray(json) || json.length !== body.length)) throw new Error("batch answer incomplete");
      return json;
    } catch (err) {
      if (attempt === 8) throw err;
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
}

function isNativeIdentifier(env, ident) {
  return /^NATIVE/i.test(ident) || /^0x0{40}$/i.test(ident);
}

async function resolveEvm(env, rows) {
  const { url, chainId } = EVM_RPC[env];
  const cid = (await rpc(url, { jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] })).result;
  if (Number(cid) !== chainId) throw new Error(`${env} RPC answered chain id ${cid}, expected ${chainId}`);
  const blockHex = (await rpc(url, { jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] })).result;
  const out = new Map();
  const valid = rows.filter((r) => /^0x[0-9a-fA-F]{40}$/.test(r.contract_or_native_identifier));
  for (const r of rows) if (!valid.includes(r)) out.set(r.registry_row, { decimals: null, reason: "identifier is not a 20-byte EVM address" });
  for (let i = 0; i < valid.length; i += 40) {
    const chunk = valid.slice(i, i + 40);
    const batch = [];
    chunk.forEach((r, j) => {
      batch.push({ jsonrpc: "2.0", id: 2 * j, method: "eth_getCode", params: [r.contract_or_native_identifier, blockHex] });
      batch.push({ jsonrpc: "2.0", id: 2 * j + 1, method: "eth_call", params: [{ to: r.contract_or_native_identifier, data: DECIMALS_SELECTOR }, blockHex] });
    });
    const res = await rpc(url, batch);
    const byId = new Map(res.map((x) => [x.id, x]));
    chunk.forEach((r, j) => {
      const code = byId.get(2 * j);
      const call = byId.get(2 * j + 1);
      if (!code || code.error || !code.result || code.result === "0x") {
        out.set(r.registry_row, { decimals: null, reason: `no contract code at ${r.contract_or_native_identifier} on ${env}` });
      } else if (!call || call.error || !call.result || call.result.length < 66) {
        out.set(r.registry_row, { decimals: null, reason: `decimals() did not return on ${env}` + (call && call.error ? `: ${call.error.message}` : "") });
      } else {
        const v = BigInt(call.result.slice(0, 66));
        if (v > 255n) out.set(r.registry_row, { decimals: null, reason: `decimals() returned ${v}, not a uint8` });
        else out.set(r.registry_row, { decimals: Number(v) });
      }
    });
  }
  return { out, source: { rpc: url, chainId, block: Number(blockHex) } };
}

async function resolveSolana(rows) {
  const out = new Map();
  const isMint = (s) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s);
  const valid = rows.filter((r) => isMint(r.contract_or_native_identifier));
  for (const r of rows) if (!valid.includes(r)) out.set(r.registry_row, { decimals: null, reason: "identifier is not a Solana mint address" });
  let slot = null;
  for (let i = 0; i < valid.length; i += 50) {
    const chunk = valid.slice(i, i + 50);
    const res = await rpc(SOLANA_RPC, { jsonrpc: "2.0", id: 1, method: "getMultipleAccounts", params: [chunk.map((r) => r.contract_or_native_identifier), { encoding: "jsonParsed", commitment: "finalized" }] });
    if (res.error) throw new Error("Solana getMultipleAccounts: " + res.error.message);
    slot = res.result.context.slot;
    res.result.value.forEach((acct, j) => {
      const r = chunk[j];
      const info = acct && acct.data && acct.data.parsed && acct.data.parsed.info;
      if (!acct) out.set(r.registry_row, { decimals: null, reason: "mint account not found on Solana mainnet" });
      else if (!info || typeof info.decimals !== "number" || acct.data.parsed.type !== "mint") out.set(r.registry_row, { decimals: null, reason: "account is not an SPL mint" });
      else out.set(r.registry_row, { decimals: info.decimals });
    });
    await new Promise((r) => setTimeout(r, 400));
  }
  return { out, source: { rpc: SOLANA_RPC, cluster: "mainnet-beta", slot } };
}

async function main() {
  const res = await fetch(REGISTRY_URL);
  if (!res.ok) throw new Error(`registry HTTP ${res.status}`);
  const raw = await res.text();
  const sha256 = crypto.createHash("sha256").update(raw).digest("hex");
  const registry = JSON.parse(raw);
  if (registry.records.length !== REGISTRY_TOTAL) throw new Error(`registry has ${registry.records.length} records, expected ${REGISTRY_TOTAL}`);

  const records = registry.records.filter((r) => r.environment !== "Cosmos");
  const dropped = registry.records.filter((r) => r.environment === "Cosmos").map((r) => r.registry_row);

  const sources = {};
  const decimals = new Map();
  const tokenRows = {};
  for (const r of records) {
    if (isNativeIdentifier(r.environment, r.contract_or_native_identifier)) {
      const n = NATIVE_DECIMALS[r.environment];
      decimals.set(r.registry_row, n ? { decimals: n.decimals, from: "src/lib/vfBaseRegistry.js native row" } : { decimals: null, reason: "no native row in vfBaseRegistry.js" });
    } else {
      (tokenRows[r.environment] = tokenRows[r.environment] || []).push(r);
    }
  }
  for (const [env, rows] of Object.entries(tokenRows)) {
    let result;
    if (env === "Solana") result = await resolveSolana(rows);
    else if (EVM_RPC[env]) result = await resolveEvm(env, rows);
    else throw new Error(`token rows on ${env} with no reader`);
    sources[env] = result.source;
    for (const [row, v] of result.out) decimals.set(row, { ...v, from: v.decimals == null ? undefined : (env === "Solana" ? "SPL mint account" : "decimals() eth_call") });
    console.log(`${env}: ${rows.length} token rows read`);
  }

  const entries = records.map((r) => {
    const env = r.environment;
    const native = isNativeIdentifier(env, r.contract_or_native_identifier);
    const assetId = native ? `native-${r.symbol}` : env === "Solana" ? r.contract_or_native_identifier : r.symbol;
    const d = decimals.get(r.registry_row);
    return {
      row: r.registry_row,
      environmentId: env,
      assetId,
      canonicalAssetId: ethers.solidityPackedKeccak256(["string", "string"], [env, assetId]),
      symbol: r.symbol,
      decimals: d.decimals,
      decimalsFrom: d.from || null,
      unresolvedReason: d.decimals == null ? d.reason : null,
      custodyClass: CLASS[r.class],
      custodyPath: native ? 0 : 1,
      identifier: r.contract_or_native_identifier,
      pricingIdentifier: r.pricing_identifier,
    };
  });
  // Two registry rows can name the same on-chain key (the same Solana mint).
  // The Verifier stores one entry per key, so the later row is kept in the
  // file, marked sameKeyAsRow, and is not sent as a second write.
  const firstByKey = new Map();
  for (const e of entries) {
    const k = e.environmentId + "\u0000" + e.canonicalAssetId;
    if (firstByKey.has(k)) e.sameKeyAsRow = firstByKey.get(k);
    else { firstByKey.set(k, e.row); e.sameKeyAsRow = null; }
  }
  const unresolved = entries.filter((e) => e.decimals == null);
  const collapsed = entries.filter((e) => e.sameKeyAsRow != null);
  const doc = {
    note: "Generated by scripts/deploy-pages/resolveAssetRegistry.cjs. Read-only. No price is stored here.",
    registry: { url: REGISTRY_URL, sha256, count: registry.records.length, source: registry.source, droppedCosmosRows: dropped },
    resolvedAt: new Date().toISOString(),
    sources,
    counts: {
      entries: entries.length,
      resolved: entries.length - unresolved.length,
      unresolved: unresolved.length,
      sameKeyRows: collapsed.length,
      writes: entries.filter((e) => e.decimals != null && e.sameKeyAsRow == null).length,
    },
    entries,
  };
  fs.writeFileSync(OUT, JSON.stringify(doc, null, 1) + "\n");
  console.log(`wrote ${OUT}: ${entries.length} entries, ${unresolved.length} unresolved`);
  for (const e of collapsed) console.log(`  row ${e.row} ${e.environmentId} ${e.symbol}: same on-chain key as row ${e.sameKeyAsRow}`);
  for (const e of unresolved) console.log(`  unresolved row ${e.row} ${e.environmentId} ${e.symbol}: ${e.unresolvedReason}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
