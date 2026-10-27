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
// Operator decision t367u (2026-10-24): the ceremony source was registry
// Revision C (deployment/assetRegistry.revC.json). Revision C is a full copy
// of Revision B with one change, row 454 USDC_BASE custodyClass 3 -> 1 (S1,
// 1.5x; Master Specification Revision 18, Section 6.1). Revision B is not the
// ceremony source; it stays unchanged and the manifest still pins its hash.
// Operator t430u (2026-10-26): the ceremony source is registry Revision D
// (deployment/assetRegistry.revD.json), Revision C with its Base rows replaced
// by the expanded Base registry (scripts/buildRevisionD.cjs). Revision C stays
// pinned and unchanged in the manifest as the prior ceremony source.
// Operator t431u (2026-10-26): LionOG and FrogOG are removed from Revision D
// (TigerOG stays by founder override); Revision D was rebuilt and re-pinned.
// Operator order t448u (2026-10-26), PROPOSED: the ceremony source is registry
// Revision E (deployment/assetRegistry.revE.json), Revision D with its Base
// subset extended to every technically compatible Base token
// (scripts/buildRevisionE.cjs). Revision D stays pinned and unchanged.
const EXPECTED_REGISTRY_SHA256 = "af8a4fc62af5be7baf50e2fe164e23202de8e03f1f92103d27b490dcfb56e2e6";
const EXPECTED_REGISTRY_FILENAME = "assetRegistry.revE.json";
const EXPECTED_REGISTRY_ROWS = 3353;
// Pinned row counts of every registry file the manifest lists.
const PINNED_REGISTRY_ROWS = { "assetRegistry.revB.json": 487, "assetRegistry.revC.json": 487, "assetRegistry.revD.json": 590, "assetRegistry.revE.json": 3353 };
const EXPECTED_MANIFEST_SHA256 = "dd2a500b29e2a0b915354b2476e923217d2c771fbf53c82304b0507b40710d10";
// Base-only launch: the ceremony registers only the Base rows of Revision E.
// Revision E itself is not changed (3353 rows, pinned above); the Base subset
// is derived here at build time and must have exactly these counts.
const BASE_ONLY_RULE = "Revision E entries with environmentId === \"Base\" (row 2 Base ETH included); token addresses with environmentId === \"Base\"; no aliases";
const EXPECTED_BASE_ROWS = 2893;
const EXPECTED_BASE_TOKEN_ADDRESSES = 2892;
const EXPECTED_BASE_ALIASES = 0;

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
 * Hash a registry file and refuse unless it matches the hardcoded Revision E
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

  if (manifest.revision !== "Revision E" || manifest.revisionLabel !== "registry-revE-2026-10-26") {
    failures.push({
      field: "manifest.revisionLabel",
      expected: "Revision E / registry-revE-2026-10-26",
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
      expected: "resolveCeremonyRegistry() -> " + EXPECTED_REGISTRY_FILENAME,
      actual: e && e.message ? e.message : String(e),
    });
    throw refused(failures);
  }

  if (resolved.sha256 !== EXPECTED_REGISTRY_SHA256 || resolved.sha256 !== (manifest.artifacts.find((a) => a.filename === EXPECTED_REGISTRY_FILENAME) || {}).sha256) {
    failures.push({
      field: "registry.sha256",
      expected: EXPECTED_REGISTRY_SHA256,
      actual: resolved.sha256 + " (source=" + resolved.filename + ")",
    });
  }
  if (resolved.rowCount !== EXPECTED_REGISTRY_ROWS || resolved.rowCount !== manifest.expectedRegistryRows) {
    failures.push({
      field: "registry.rowCount",
      expected: String(EXPECTED_REGISTRY_ROWS) + " (Revision E rows; the Base subset includes Base ETH as row 2)",
      actual: String(resolved.rowCount) + " (source=" + resolved.filename + ")",
    });
  }
  if (resolved.filename !== EXPECTED_REGISTRY_FILENAME) {
    failures.push({
      field: "registry.filename",
      expected: EXPECTED_REGISTRY_FILENAME,
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
    if (/^assetRegistry\.rev[BCDE]\.json$/.test(a.filename) && a.rowCount !== PINNED_REGISTRY_ROWS[a.filename]) {
      failures.push({
        field: "artifact." + a.filename + ".rowCount",
        expected: String(PINNED_REGISTRY_ROWS[a.filename]),
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

  // Base-only: the manifest must not describe any non-Base lock.
  if (manifest.nonBaseLock !== undefined) {
    failures.push({ field: "nonBaseLock", expected: "absent (Base-only launch)", actual: "present" });
  }
  if (manifest.baseOnly !== true || manifest.expectedBaseRows !== EXPECTED_BASE_ROWS
      || manifest.expectedBaseTokenAddresses !== EXPECTED_BASE_TOKEN_ADDRESSES || manifest.expectedBaseAliases !== EXPECTED_BASE_ALIASES) {
    failures.push({
      field: "manifest.baseOnly",
      expected: "baseOnly true, " + EXPECTED_BASE_ROWS + " rows, " + EXPECTED_BASE_TOKEN_ADDRESSES + " token addresses, " + EXPECTED_BASE_ALIASES + " aliases",
      actual: String(manifest.baseOnly) + ", " + manifest.expectedBaseRows + ", " + manifest.expectedBaseTokenAddresses + ", " + manifest.expectedBaseAliases,
    });
  }
  const baseRows = resolved.entries.filter((e) => e.environmentId === "Base");
  if (baseRows.length !== EXPECTED_BASE_ROWS) {
    failures.push({ field: "registry.baseRows", expected: String(EXPECTED_BASE_ROWS), actual: String(baseRows.length) });
  }

  // Fee language on generated / maintained pages (and base.html).
  const feePhrases = manifest.feePhrasesRequiredOnPages || [];
  const pageFiles = fs.readdirSync(pages).filter((f) => f.endsWith(".html"));
  for (const phrase of feePhrases) {
    // base.html (the only page) must carry every fee phrase.
    const baseHtml = fs.readFileSync(path.join(pages, "base.html"), "utf8");
    if (!baseHtml.includes(phrase)) {
      failures.push({
        field: "feeLanguage.base.html",
        expected: "contains " + JSON.stringify(phrase),
        actual: "missing in base.html",
      });
    }
  }
  if (!fs.readFileSync(path.join(pages, "base.html"), "utf8").includes(manifest.feeLanguage)) {
    failures.push({
      field: "feeLanguage",
      expected: manifest.feeLanguage,
      actual: "missing from base.html",
    });
  }
  // Base-only: no non-Base deploy page may remain in the package.
  const strayPages = pageFiles.filter((f) => f !== "base.html");
  if (strayPages.length) {
    failures.push({ field: "pages", expected: "base.html only", actual: strayPages.join(", ") });
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
  // Base-only package: the six Base contracts plus the Base reader. TokenVCLM
  // and TokenCHONX share one contract, so 7 entries over 6 distinct contracts.
  const targets = {
    VinculumFinalisVerifier: "VinculumFinalisVerifier.sol/VinculumFinalisVerifier.json",
    TokenVCLM: "VinculumFinalisToken.sol/VinculumFinalisToken.json",
    TokenCHONX: "VinculumFinalisToken.sol/VinculumFinalisToken.json",
    BaseCommitmentVaultLock: "BaseCommitmentVaultLock.sol/BaseCommitmentVaultLock.json",
    BaseLockRecordVerifier: "chain-verifiers/BaseLockRecordVerifier.sol/BaseLockRecordVerifier.json",
    VinculumFinalisSynth: "VinculumFinalisSynth.sol/VinculumFinalisSynth.json",
    VinculumFinalisStake: "VinculumFinalisStake.sol/VinculumFinalisStake.json",
  };
  const out = {};
  for (const [name, rel] of Object.entries(targets)) {
    const p = path.join(art, rel);
    if (!fs.existsSync(p)) { console.error("MISSING", p); process.exit(1); }
    const j = JSON.parse(fs.readFileSync(p, "utf8"));
    out[name] = { abi: j.abi, bytecode: j.bytecode };
  }
  return { out };
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

async function buildCeremonyArtifacts(opts = {}) {
  // Verify first. Write nothing on failure (no ceremony-data.json, no HTML).
  const { manifest, resolved } = verifyCeremonyManifest();
  // Base subset of Revision E, derived here. Revision E itself is not changed.
  const entries = resolved.entries.filter((e) => e.environmentId === "Base");
  const row2 = resolved.baseEth;

  const { out } = loadBytecodeTargets();
  const rep = require(path.join(root, "deployment", "representativeBase.cjs"));
  const base = rep.rows.find((r) => r.environment === "Base");
  if (!base || !base.devFund) { console.error("Base Dev Fund missing"); process.exit(1); }

  // VF-ORC-016: the ceremony's Base ETH price is USD per whole ETH with 30 decimals.
  let priceUsd30 = null;
  let priceSource = null;
  if (opts.keepPrice) {
    // Operator rule t364u: the ETH price snapshot in the committed build is
    // kept as-is. Reuse priceUsd30 and priceSource from the committed
    // ceremony-data.json byte for byte; no network call. Refuse if absent.
    const prev = JSON.parse(fs.readFileSync(path.join(pages, "ceremony-data.json"), "utf8"));
    if (typeof prev.priceUsd30 !== "string" || !/^[0-9]+$/.test(prev.priceUsd30) || typeof prev.priceSource !== "string") {
      throw refused([{ field: "keepPrice", expected: "committed ceremony-data.json with priceUsd30 and priceSource", actual: String(prev.priceUsd30) + " / " + String(prev.priceSource) }]);
    }
    priceUsd30 = prev.priceUsd30;
    priceSource = prev.priceSource;
  } else try {
    const resp = await get("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd");
    if (resp.status === 200) {
      const usd = JSON.parse(resp.body).ethereum && JSON.parse(resp.body).ethereum.usd;
      if (typeof usd === "number" && usd >= 0.95) {
        priceUsd30 = BigInt(Math.round(usd * 1e8)) * 10n ** 22n + "";
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
    readers: { base: { env: "Base", contract: "BaseLockRecordVerifier" } },
    // Token address index of the ceremony registry (Revision E), Base only.
    tokenAddresses: require("./buildTokenAddressIndex.cjs").buildTokenAddressIndex(resolved.written).entries
      .filter((t) => t.environmentId === "Base")
      .map((t) => ({ environmentId: t.environmentId, token: t.token, canonicalAssetId: t.canonicalAssetId })),
    assetRowAliases: [],
    evmDevFunds: { Base: base.devFund },
    row2: { canonicalAssetId: row2.canonicalAssetId, symbol: row2.symbol, decimals: row2.decimals, custodyClass: row2.custodyClass, custodyPath: row2.custodyPath },
    entries: entries.map((e) => ({ environmentId: e.environmentId, canonicalAssetId: e.canonicalAssetId, symbol: e.symbol, decimals: e.decimals, custodyClass: e.custodyClass, custodyPath: e.custodyPath, row: e.row })),
    registrySource: resolved.filename,
    registryPath: resolved.name,
    registryRows: resolved.rowCount,
    registrySha256: resolved.sha256,
    baseOnly: true,
    baseSubsetRule: BASE_ONLY_RULE,
    baseRows: entries.length,
    baseTokenAddresses: null,
    baseAliases: 0,
    registryRevisionLabel: manifest.revisionLabel,
    deployOrderKeys: manifest.deployOrderKeys,
    feeLanguage: manifest.feeLanguageDetail,
    priceUsd30,
    priceSource
  };

  data.baseTokenAddresses = data.tokenAddresses.length;
  if (data.registryRows !== EXPECTED_REGISTRY_ROWS) {
    throw refused([{
      field: "ceremony-data.registryRows",
      expected: String(EXPECTED_REGISTRY_ROWS) + " (Revision E source)",
      actual: "registryRows=" + data.registryRows + " source=" + resolved.filename,
    }]);
  }
  if (data.entries.length !== EXPECTED_BASE_ROWS || data.tokenAddresses.length !== EXPECTED_BASE_TOKEN_ADDRESSES || data.assetRowAliases.length !== EXPECTED_BASE_ALIASES
      || data.entries.some((e) => e.environmentId !== "Base") || data.tokenAddresses.some((t) => t.environmentId !== "Base")) {
    throw refused([{
      field: "ceremony-data.baseSubset",
      expected: EXPECTED_BASE_ROWS + " Base rows, " + EXPECTED_BASE_TOKEN_ADDRESSES + " Base token addresses, " + EXPECTED_BASE_ALIASES + " aliases",
      actual: data.entries.length + " rows, " + data.tokenAddresses.length + " token addresses, " + data.assetRowAliases.length + " aliases",
    }]);
  }
  if (!data.entries.some((e) => e.row === 2 && e.canonicalAssetId === row2.canonicalAssetId)) {
    throw refused([{ field: "ceremony-data.row2", expected: "Base ETH (row 2) in the Base subset", actual: "missing" }]);
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

  // Base-only: base.html is the only page (maintained by hand). Re-check.
  verifyCeremonyManifest();

  if (!priceUsd30) {
    console.error("REFUSAL: scheduled ETH price miss. ceremony-data.json written with no price. The page will not send.");
    process.exit(0);
  }
  console.log("wrote ceremony data (Base only)", data.entries.length, "Base rows of", data.registryRows, "Revision E rows,",
    data.tokenAddresses.length, "token addresses,", data.assetRowAliases.length, "aliases, price source", priceSource + (opts.keepPrice ? " (kept from the committed build)" : ""),
    "registry", resolved.filename, "sha256", resolved.sha256, "manifest", EXPECTED_MANIFEST_SHA256.slice(0, 12) + "...");
}

module.exports = {
  EXPECTED_REGISTRY_SHA256,
  EXPECTED_REGISTRY_FILENAME,
  EXPECTED_REGISTRY_ROWS,
  PINNED_REGISTRY_ROWS,
  EXPECTED_MANIFEST_SHA256,
  EXPECTED_BASE_ROWS,
  EXPECTED_BASE_TOKEN_ADDRESSES,
  EXPECTED_BASE_ALIASES,
  BASE_ONLY_RULE,
  MANIFEST_PATH,
  assertRegistryGuard,
  assertCanonicalRegistry,
  verifyCeremonyManifest,
  buildCeremonyArtifacts,
  refused,
};

if (require.main === module) {
  // --keep-price (or CEREMONY_KEEP_PRICE=1): keep the committed ETH price snapshot (t364u).
  const keepPrice = process.argv.includes("--keep-price") || process.env.CEREMONY_KEEP_PRICE === "1";
  buildCeremonyArtifacts({ keepPrice }).catch((err) => {
    console.error(err && err.refusedMessage ? err.refusedMessage : (err && err.message ? err.message : err));
    process.exit(1);
  });
}
