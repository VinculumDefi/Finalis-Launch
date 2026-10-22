const fs = require("fs");
const path = require("path");
const https = require("https");
const crypto = require("crypto");
const root = path.join(__dirname, "..");
const art = path.join(root, "artifacts", "contracts");
const pages = path.join(root, "scripts", "deploy-pages");
const MANIFEST_PATH = path.join(root, "deployment", "ceremony-manifest.json");

// Hardcoded digests. Editing the manifest or registry to "match" is refused
// unless these constants are changed in this file (reviewed commit).
const EXPECTED_REGISTRY_SHA256 = "1bdcb8346ab95abe5225adcffb9c5c3c7bb40c6cd5f1a851d3ed05bb2d77e2a9";
const EXPECTED_REGISTRY_ROWS = 487;
const EXPECTED_MANIFEST_SHA256 = "302123d113b144d372ec56200bb3ab97520d712f45e6ed2d7febd0d06e6ab98c";

const { resolveCeremonyRegistry } = require("./deploy-pages/resolveAssetRegistry.cjs");

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function sha256Buffer(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

/**
 * Loud refusal. Lists every failing field as expected vs actual. Writes nothing.
 */
function refused(failures) {
  const lines = [
    "========================================",
    "REFUSED: ceremony build / manifest check",
    "========================================",
  ];
  for (const f of failures) {
    lines.push("FAIL " + f.field);
    lines.push("  expected: " + f.expected);
    lines.push("  actual:   " + f.actual);
  }
  lines.push("========================================");
  lines.push("No ceremony-data.json and no HTML were written.");
  const msg = lines.join("\n");
  const err = new Error(msg);
  err.failures = failures;
  err.refusedMessage = msg;
  return err;
}

/**
 * Hash a registry file and refuse unless it matches the hardcoded Revision B
 * constants. Used by the suite against the historical file and mutated copies.
 * Does not call loadRegistry (historical basename is blocked there).
 */
function assertRegistryGuard(filePath) {
  if (!fs.existsSync(filePath)) {
    throw refused([{
      field: "registry.file",
      expected: "existing file sha=" + EXPECTED_REGISTRY_SHA256 + " rows=" + EXPECTED_REGISTRY_ROWS,
      actual: "missing " + path.basename(filePath),
    }]);
  }
  const raw = fs.readFileSync(filePath);
  const actualSha = sha256Buffer(raw);
  let rowCount = null;
  try {
    const j = JSON.parse(raw.toString("utf8"));
    rowCount = Array.isArray(j.entries) ? j.entries.length : null;
  } catch (e) {
    rowCount = null;
  }
  const failures = [];
  if (actualSha !== EXPECTED_REGISTRY_SHA256) {
    failures.push({
      field: "registry.sha256",
      expected: EXPECTED_REGISTRY_SHA256,
      actual: actualSha + " (source=" + path.basename(filePath) + ")",
    });
  }
  if (rowCount !== EXPECTED_REGISTRY_ROWS) {
    failures.push({
      field: "registry.rowCount",
      expected: String(EXPECTED_REGISTRY_ROWS),
      actual: String(rowCount == null ? "(unreadable)" : rowCount) + " (source=" + path.basename(filePath) + ")",
    });
  }
  if (failures.length) throw refused(failures);
  return { actualSha, rowCount, filename: path.basename(filePath), path: filePath };
}

function loadManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    throw refused([{
      field: "manifest.file",
      expected: "deployment/ceremony-manifest.json sha=" + EXPECTED_MANIFEST_SHA256,
      actual: "missing",
    }]);
  }
  const raw = fs.readFileSync(MANIFEST_PATH);
  const actualSha = sha256Buffer(raw);
  if (actualSha !== EXPECTED_MANIFEST_SHA256) {
    throw refused([{
      field: "manifest.sha256",
      expected: EXPECTED_MANIFEST_SHA256,
      actual: actualSha + " (editing the manifest to match a wrong registry is refused)",
    }]);
  }
  const manifest = JSON.parse(raw.toString("utf8"));
  return { manifest, actualSha };
}

/**
 * Compare every machine-facing manifest field to resolved files and page text.
 * Returns { manifest, resolved } or throws refused(failures).
 */
function verifyCeremonyManifest(opts = {}) {
  const failures = [];
  const { manifest } = loadManifest();

  if (manifest.revision !== "Revision B" || manifest.revisionLabel !== "registry-revB-2026-10-20") {
    failures.push({
      field: "manifest.revisionLabel",
      expected: "Revision B / registry-revB-2026-10-20",
      actual: String(manifest.revision) + " / " + String(manifest.revisionLabel),
    });
  }
  if (manifest.expectedRegistryRows !== EXPECTED_REGISTRY_ROWS) {
    failures.push({
      field: "manifest.expectedRegistryRows",
      expected: String(EXPECTED_REGISTRY_ROWS),
      actual: String(manifest.expectedRegistryRows),
    });
  }

  let resolved;
  try {
    resolved = resolveCeremonyRegistry();
  } catch (e) {
    failures.push({
      field: "registry.resolve",
      expected: "resolveCeremonyRegistry() -> assetRegistry.revB.json",
      actual: e && e.message ? e.message : String(e),
    });
    throw refused(failures);
  }

  if (resolved.sha256 !== EXPECTED_REGISTRY_SHA256 || resolved.sha256 !== manifest.artifacts.find((a) => a.filename === "assetRegistry.revB.json").sha256) {
    failures.push({
      field: "registry.sha256",
      expected: EXPECTED_REGISTRY_SHA256,
      actual: resolved.sha256 + " (source=" + resolved.filename + ")",
    });
  }
  if (resolved.rowCount !== EXPECTED_REGISTRY_ROWS || resolved.rowCount !== manifest.expectedRegistryRows) {
    failures.push({
      field: "registry.rowCount",
      expected: String(EXPECTED_REGISTRY_ROWS) + " (486 Revision B rows plus Base ETH as row 2)",
      actual: String(resolved.rowCount) + " (source=" + resolved.filename + ")",
    });
  }
  if (resolved.filename !== "assetRegistry.revB.json") {
    failures.push({
      field: "registry.filename",
      expected: "assetRegistry.revB.json",
      actual: resolved.filename,
    });
  }
  const baseEth = resolved.baseEth;
  if (!baseEth || baseEth.row !== manifest.registryBaseEthRow || baseEth.environmentId !== manifest.registryBaseEthEnvironment
      || baseEth.symbol !== manifest.registryBaseEthSymbol || baseEth.assetId !== manifest.registryBaseEthAssetId) {
    failures.push({
      field: "registry.baseEth",
      expected: "row " + manifest.registryBaseEthRow + " " + manifest.registryBaseEthEnvironment + " "
        + manifest.registryBaseEthSymbol + " " + manifest.registryBaseEthAssetId,
      actual: baseEth
        ? ("row " + baseEth.row + " " + baseEth.environmentId + " " + baseEth.symbol + " " + baseEth.assetId)
        : "(missing)",
    });
  }
  if (resolved.written.length !== manifest.registryWrittenRows) {
    failures.push({
      field: "registry.writtenRows",
      expected: String(manifest.registryWrittenRows),
      actual: String(resolved.written.length),
    });
  }

  // Artifact digests listed in the manifest (computed from resolved files).
  for (const a of manifest.artifacts) {
    const abs = path.join(root, a.path);
    if (!fs.existsSync(abs)) {
      failures.push({ field: "artifact." + a.filename, expected: "sha256=" + a.sha256, actual: "missing " + a.path });
      continue;
    }
    const actual = sha256File(abs);
    if (actual !== a.sha256) {
      failures.push({
        field: "artifact." + a.filename + ".sha256",
        expected: a.sha256,
        actual: actual,
      });
    }
    if (a.revisionLabel == null || String(a.revisionLabel).length === 0) {
      failures.push({
        field: "artifact." + a.filename + ".revisionLabel",
        expected: "non-empty label",
        actual: String(a.revisionLabel),
      });
    }
    if (a.filename === "assetRegistry.revB.json" && a.rowCount !== EXPECTED_REGISTRY_ROWS) {
      failures.push({
        field: "artifact.assetRegistry.revB.json.rowCount",
        expected: String(EXPECTED_REGISTRY_ROWS),
        actual: String(a.rowCount),
      });
    }
  }

  // Deploy order: must match baseCeremonyFlow.js on main (do not silently reorder).
  const flowPath = path.join(pages, "baseCeremonyFlow.js");
  const flowSrc = fs.readFileSync(flowPath, "utf8");
  const expectedKeys = manifest.deployOrderKeys;
  // Extract dep("Name" calls in order from runBaseCeremony.
  const depNames = [...flowSrc.matchAll(/await dep\(\s*"([^"]+)"/g)].map((m) => m[1]);
  const six = depNames.slice(0, 6);
  if (JSON.stringify(six) !== JSON.stringify(expectedKeys)) {
    failures.push({
      field: "deployOrder",
      expected: expectedKeys.join(" -> "),
      actual: six.join(" -> ") + " (from baseCeremonyFlow.js; report the difference, do not silently change the manifest)",
    });
  }

  // Dev Fund and price-poster handoff.
  const rep = require(path.join(root, "deployment", "representativeBase.cjs"));
  const base = rep.rows.find((r) => r.environment === "Base");
  const live = require(path.join(root, "deployment", "liveConfig.json"));
  const actualDev = base && base.devFund;
  if (!actualDev || actualDev.toLowerCase() !== manifest.devFund.toLowerCase()) {
    failures.push({
      field: "devFund",
      expected: manifest.devFund,
      actual: String(actualDev),
    });
  }
  if (!live.scheduledPricePoster || live.scheduledPricePoster.toLowerCase() !== manifest.pricePosterHandoff.toLowerCase()) {
    failures.push({
      field: "pricePosterHandoff",
      expected: manifest.pricePosterHandoff,
      actual: String(live.scheduledPricePoster),
    });
  }

  // Non-Base lock artifact: main CommitmentVaultLock masked runtime hash, 5%, no HANDSHAKE_FEE_BPS.
  const nbl = manifest.nonBaseLock;
  if (!nbl) {
    failures.push({ field: "nonBaseLock", expected: "object with expectedRuntimeHash / feeBps / environments", actual: "missing" });
  } else {
    const flowHashMatch = flowSrc.match(/const CVL_RUNTIME_HASH = "(0x[0-9a-fA-F]{64})"/);
    const flowHash = flowHashMatch ? flowHashMatch[1].toLowerCase() : "";
    if (!nbl.expectedRuntimeHash || nbl.expectedRuntimeHash.toLowerCase() !== flowHash) {
      failures.push({
        field: "nonBaseLock.expectedRuntimeHash",
        expected: flowHash || "(CVL_RUNTIME_HASH in baseCeremonyFlow.js)",
        actual: String(nbl.expectedRuntimeHash),
      });
    }
    if (nbl.feeBps !== 500) {
      failures.push({ field: "nonBaseLock.feeBps", expected: "500", actual: String(nbl.feeBps) });
    }
    if (nbl.noHandshakeFeeBpsSelector !== true) {
      failures.push({ field: "nonBaseLock.noHandshakeFeeBpsSelector", expected: "true", actual: String(nbl.noHandshakeFeeBpsSelector) });
    }
    if (!nbl.devFund || nbl.devFund.toLowerCase() !== manifest.devFund.toLowerCase()) {
      failures.push({ field: "nonBaseLock.devFund", expected: manifest.devFund, actual: String(nbl && nbl.devFund) });
    }
    const envs = ["Ethereum", "Arbitrum", "Optimism", "Polygon", "BNB Smart Chain", "Avalanche"];
    if (JSON.stringify(nbl.environments) !== JSON.stringify(envs)) {
      failures.push({ field: "nonBaseLock.environments", expected: envs.join(", "), actual: JSON.stringify(nbl.environments) });
    }
  }

  // Fee language on generated / maintained pages (and base.html).
  const feePhrases = manifest.feePhrasesRequiredOnPages || [];
  const pageFiles = fs.readdirSync(pages).filter((f) => f.endsWith(".html"));
  for (const phrase of feePhrases) {
    // base.html must carry the fee language; chain pages that mention fees must too.
    const baseHtml = fs.readFileSync(path.join(pages, "base.html"), "utf8");
    // Handshake floors appear on EVM lock pages; base.html has 5.00% of gross.
    if (phrase === "5.00% of gross" || phrase === "Handshake") {
      if (!baseHtml.includes(phrase) && !baseHtml.includes("5.00% of gross")) {
        failures.push({
          field: "feeLanguage.base.html",
          expected: "contains " + JSON.stringify(phrase),
          actual: "missing in base.html",
        });
      }
    }
  }
  if (!fs.readFileSync(path.join(pages, "base.html"), "utf8").includes(manifest.feeLanguage)) {
    failures.push({
      field: "feeLanguage",
      expected: manifest.feeLanguage,
      actual: "missing from base.html",
    });
  }
  // EVM lock pages (when present) must include Handshake floor phrases.
  for (const f of ["ethereum.html", "polygon.html", "optimism.html", "arbitrum.html", "bnb-smart-chain.html", "avalanche.html"]) {
    const p = path.join(pages, f);
    if (!fs.existsSync(p)) continue;
    const html = fs.readFileSync(p, "utf8");
    for (const phrase of feePhrases) {
      if (!html.includes(phrase)) {
        failures.push({
          field: "feeLanguage." + f,
          expected: "contains " + JSON.stringify(phrase),
          actual: "missing",
        });
      }
    }
  }

  if (opts.extraFailures && opts.extraFailures.length) failures.push(...opts.extraFailures);
  if (failures.length) throw refused(failures);
  return { manifest, resolved, pageFiles };
}

function assertCanonicalRegistry() {
  const { resolved } = verifyCeremonyManifest();
  assertRegistryGuard(resolved.path);
  return resolved;
}

function loadBytecodeTargets() {
  const targets = {
    VinculumFinalisVerifier: "VinculumFinalisVerifier.sol/VinculumFinalisVerifier.json",
    TokenVCLM: "VinculumFinalisToken.sol/VinculumFinalisToken.json",
    TokenCHONX: "VinculumFinalisToken.sol/VinculumFinalisToken.json",
    CommitmentVaultLock: "CommitmentVaultLock.sol/CommitmentVaultLock.json",
    BaseCommitmentVaultLock: "BaseCommitmentVaultLock.sol/BaseCommitmentVaultLock.json",
    BaseLockRecordVerifier: "chain-verifiers/BaseLockRecordVerifier.sol/BaseLockRecordVerifier.json",
    VinculumFinalisSynth: "VinculumFinalisSynth.sol/VinculumFinalisSynth.json",
    VinculumFinalisStake: "VinculumFinalisStake.sol/VinculumFinalisStake.json",
  };
  const { ASSET_ROW_ALIASES, READY_EVM, READY_UTXO, devFundScript, stellarKey, xrplAccount, STELLAR_PUBLIC_NETWORK } = require("./testChainCeremony.cjs");
  for (const [, name] of [...READY_EVM, ...READY_UTXO]) targets[name] = "chain-verifiers/" + name + ".sol/" + name + ".json";
  targets.StellarLockReader = "chain-verifiers/StellarLockReader.sol/StellarLockReader.json";
  targets.XrplLockReader = "chain-verifiers/XrplLockReader.sol/XrplLockReader.json";
  const out = {};
  for (const [name, rel] of Object.entries(targets)) {
    const p = path.join(art, rel);
    if (!fs.existsSync(p)) { console.error("MISSING", p); process.exit(1); }
    const j = JSON.parse(fs.readFileSync(p, "utf8"));
    out[name] = { abi: j.abi, bytecode: j.bytecode };
  }
  return { out, ASSET_ROW_ALIASES, READY_EVM, READY_UTXO, devFundScript, stellarKey, xrplAccount, STELLAR_PUBLIC_NETWORK };
}

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "user-agent": "vinculum-price-fetcher", accept: "application/json" } }, (res) => {
      let body = "";
      res.on("data", (c) => body += c);
      res.on("end", () => resolve({ status: res.statusCode, body }));
    }).on("error", reject);
  });
}

function writeAtomic(dest, contents) {
  const tmp = dest + ".tmp." + process.pid;
  fs.writeFileSync(tmp, contents);
  fs.renameSync(tmp, dest);
}

async function buildCeremonyArtifacts() {
  // Verify first. Write nothing on failure (no ceremony-data.json, no HTML).
  const { manifest, resolved } = verifyCeremonyManifest();
  const entries = resolved.entries;
  const row2 = resolved.baseEth;

  const { out, ASSET_ROW_ALIASES, READY_EVM, READY_UTXO, devFundScript, stellarKey, xrplAccount, STELLAR_PUBLIC_NETWORK } = loadBytecodeTargets();
  const rep = require(path.join(root, "deployment", "representativeBase.cjs"));
  const base = rep.rows.find((r) => r.environment === "Base");
  if (!base || !base.devFund) { console.error("Base Dev Fund missing"); process.exit(1); }

  let priceUsd18 = null;
  let priceSource = null;
  try {
    const resp = await get("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd");
    if (resp.status === 200) {
      const usd = JSON.parse(resp.body).ethereum && JSON.parse(resp.body).ethereum.usd;
      if (typeof usd === "number" && usd >= 0.95) {
        priceUsd18 = BigInt(Math.round(usd * 1e8)) * 10n ** 10n + "";
        priceSource = "cascade-tier-1";
      }
    }
  } catch (e) {
    priceSource = "miss";
  }

  const data = {
    devFund: base.devFund,
    scheduledPricePoster: require("../deployment/liveConfig.json").scheduledPricePoster,
    oldLocks: [
      "0x968BFD5b580144b4398C10BB1E61bD8A6B1aC946",
      "0x4eDE54E1cb6E337923F8D63Fa0799AE778263b1a",
      "0x5AB40cdD51036EA88889c26E182b2936Ddf76a8A",
    ],
    nonBaseLock: {
      contract: "CommitmentVaultLock",
      expectedRuntimeHash: "0x07b599f652faf1dc71881209566f73e8fff4762486e6dbe9ff95060fe49c8594",
      immutableRanges: [[2483, 32], [4258, 32], [5105, 32]],
      feeBps: 500,
      feeLanguage: "5.00% of gross on every duration",
      noHandshakeFeeBpsSelector: true,
      handshakeFeeBpsSelector: "0xee8a0fb0",
      environments: ["Ethereum", "Arbitrum", "Optimism", "Polygon", "BNB Smart Chain", "Avalanche"],
    },
    readers: {
      evm: READY_EVM.map(([env, contract]) => ({ env, contract })),
      utxo: READY_UTXO.map(([env, contract]) => ({ env, contract, devFundScript: "0x" + devFundScript(env, rep.rows.find((r) => r.environment === env).devFund).toString("hex") })),
      stellar: { env: "Stellar", contract: "StellarLockReader", networkPassphrase: STELLAR_PUBLIC_NETWORK,
        networkId: "0x" + crypto.createHash("sha256").update(STELLAR_PUBLIC_NETWORK).digest("hex"),
        devFundKey: stellarKey(rep.rows.find((r) => r.environment === "Stellar").devFund) },
      xrpl: { env: "XRP Ledger", contract: "XrplLockReader", devFundAccount: xrplAccount(rep.rows.find((r) => r.environment === "XRP Ledger").devFund) },
    },
    tokenAddresses: require("./buildTokenAddressIndex.cjs").buildTokenAddressIndex().entries
      .map((t) => ({ environmentId: t.environmentId, token: t.token, canonicalAssetId: t.canonicalAssetId })),
    assetRowAliases: ASSET_ROW_ALIASES,
    evmDevFunds: Object.fromEntries(rep.rows.filter((r) => /^0x[0-9a-fA-F]{40}$/.test(r.devFund)).map((r) => [r.environment, r.devFund])),
    row2: { canonicalAssetId: row2.canonicalAssetId, symbol: row2.symbol, decimals: row2.decimals, custodyClass: row2.custodyClass, custodyPath: row2.custodyPath },
    entries: entries.map((e) => ({ environmentId: e.environmentId, canonicalAssetId: e.canonicalAssetId, symbol: e.symbol, decimals: e.decimals, custodyClass: e.custodyClass, custodyPath: e.custodyPath, row: e.row })),
    registrySource: resolved.filename,
    registryPath: resolved.name,
    registryRows: resolved.rowCount,
    registrySha256: resolved.sha256,
    registryRevisionLabel: manifest.revisionLabel,
    deployOrderKeys: manifest.deployOrderKeys,
    feeLanguage: manifest.feeLanguageDetail,
    priceUsd18,
    priceSource
  };

  if (data.registryRows !== EXPECTED_REGISTRY_ROWS || data.entries.length !== EXPECTED_REGISTRY_ROWS) {
    throw refused([{
      field: "ceremony-data.entries.length",
      expected: String(EXPECTED_REGISTRY_ROWS),
      actual: "registryRows=" + data.registryRows + " entries=" + data.entries.length + " source=" + resolved.filename,
    }]);
  }
  if (data.devFund.toLowerCase() !== manifest.devFund.toLowerCase()) {
    throw refused([{ field: "ceremony-data.devFund", expected: manifest.devFund, actual: data.devFund }]);
  }
  if (data.scheduledPricePoster.toLowerCase() !== manifest.pricePosterHandoff.toLowerCase()) {
    throw refused([{ field: "ceremony-data.scheduledPricePoster", expected: manifest.pricePosterHandoff, actual: data.scheduledPricePoster }]);
  }

  // Atomic writes only after every check passed.
  writeAtomic(path.join(pages, "ceremony.json"), JSON.stringify(out));
  writeAtomic(path.join(pages, "ceremony-data.json"), JSON.stringify(data));

  // Deploy pages: only after ceremony-data passed every check. Generator also
  // refuses when the registry hash or row count mismatches.
  const { buildAllPages } = require("./deploy-pages/buildDeployPages.cjs");
  buildAllPages();
  // Re-check fee language on the pages just written (base.html is kept as-is).
  verifyCeremonyManifest();

  if (!priceUsd18) {
    console.error("REFUSAL: scheduled ETH price miss. ceremony-data.json written with no price. The page will not send.");
    process.exit(0);
  }
  console.log("wrote ceremony data", data.entries.length, "entries, price source", priceSource,
    "registry", resolved.filename, "sha256", resolved.sha256, "manifest", EXPECTED_MANIFEST_SHA256.slice(0, 12) + "...");
}

module.exports = {
  EXPECTED_REGISTRY_SHA256,
  EXPECTED_REGISTRY_ROWS,
  EXPECTED_MANIFEST_SHA256,
  MANIFEST_PATH,
  assertRegistryGuard,
  assertCanonicalRegistry,
  verifyCeremonyManifest,
  buildCeremonyArtifacts,
  refused,
};

if (require.main === module) {
  buildCeremonyArtifacts().catch((err) => {
    console.error(err && err.refusedMessage ? err.refusedMessage : (err && err.message ? err.message : err));
    process.exit(1);
  });
}
