// t284u / t285u: ceremony registry SHA-256 guard, manifest checks, Connect gate.
const { expect } = require("chai");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

const {
  EXPECTED_REGISTRY_SHA256,
  EXPECTED_REGISTRY_ROWS,
  EXPECTED_MANIFEST_SHA256,
  assertRegistryGuard,
  assertCanonicalRegistry,
  verifyCeremonyManifest,
} = require("../scripts/build_ceremony_artifacts.cjs");
const { resolveCeremonyRegistry, REGISTRY_FILE } = require("../scripts/deploy-pages/resolveAssetRegistry.cjs");
const { HISTORICAL_FILE, loadRegistry } = require("../scripts/registryFile.cjs");
const { renderConnectGatePage } = require("../scripts/deploy-pages/registryGate.cjs");

const PAGES = path.join(__dirname, "..", "scripts", "deploy-pages");
const CEREMONY_DATA = path.join(PAGES, "ceremony-data.json");

describe("ceremony registry guard (t284u / t285u)", function () {
  it("resolved registry has 487 rows and row 2 is Base native ETH", function () {
    const r = resolveCeremonyRegistry();
    expect(r.path).to.equal(REGISTRY_FILE);
    expect(r.filename).to.equal("assetRegistry.revB.json");
    expect(r.rowCount).to.equal(487);
    expect(r.sha256).to.equal(EXPECTED_REGISTRY_SHA256);
    expect(r.baseEth.environmentId).to.equal("Base");
    expect(r.baseEth.symbol).to.equal("ETH");
    expect(r.baseEth.assetId).to.equal("native-ETH");
    expect(r.baseEth.row).to.equal(2);
  });

  it("ceremony artifact row count is 487, source equals resolver, hash equals constant", function () {
    const resolved = assertCanonicalRegistry();
    expect(fs.existsSync(CEREMONY_DATA)).to.equal(true);
    const data = JSON.parse(fs.readFileSync(CEREMONY_DATA, "utf8"));
    expect(data.registryRows).to.equal(EXPECTED_REGISTRY_ROWS);
    expect(data.entries.length).to.equal(EXPECTED_REGISTRY_ROWS);
    expect(data.registrySha256).to.equal(EXPECTED_REGISTRY_SHA256);
    expect(data.registrySha256).to.equal(resolved.sha256);
    expect(data.registrySource).to.equal(resolved.filename);
    expect(path.resolve(path.join(__dirname, "..", data.registryPath || "deployment/assetRegistry.revB.json"))).to.equal(resolved.path);
    const row2 = data.entries.find((e) => e.row === 2 && e.environmentId === "Base");
    expect(row2, "Base row 2 in ceremony-data").to.not.equal(undefined);
    expect(row2.symbol).to.equal("ETH");
  });

  it("build guard refuses the historical 962-row (resolved) file", function () {
    expect(() => assertRegistryGuard(HISTORICAL_FILE)).to.throw(/REFUSED/);
    try {
      assertRegistryGuard(HISTORICAL_FILE);
    } catch (e) {
      expect(e.refusedMessage).to.match(/registry\.sha256/);
      expect(e.refusedMessage).to.match(/registry\.rowCount/);
      expect(e.refusedMessage).to.include(EXPECTED_REGISTRY_SHA256);
      expect(e.refusedMessage).to.include("assetRegistry.resolved.json");
    }
  });

  it("build guard refuses a one-byte-modified copy of Revision B in a temp dir", function () {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "revb-mut-"));
    const copy = path.join(tmp, "assetRegistry.revB.json");
    const raw = fs.readFileSync(REGISTRY_FILE, "utf8");
    // Flip one character inside a stable string field; keep valid JSON and 487 rows.
    const mutated = raw.replace('"revision": "B"', '"revision": "X"');
    expect(mutated).to.not.equal(raw);
    fs.writeFileSync(copy, mutated);
    const mutJson = JSON.parse(mutated);
    expect(mutJson.entries.length).to.equal(487);
    expect(() => assertRegistryGuard(copy)).to.throw(/REFUSED/);
    try {
      assertRegistryGuard(copy);
    } catch (e) {
      expect(e.refusedMessage).to.match(/registry\.sha256/);
      expect(e.refusedMessage).to.include(EXPECTED_REGISTRY_SHA256);
      const actual = crypto.createHash("sha256").update(mutated).digest("hex");
      expect(e.refusedMessage).to.include(actual);
    }
  });

  it("loadRegistry refuses the historical file as ceremony source (no silent fallback)", function () {
    expect(() => loadRegistry(HISTORICAL_FILE)).to.throw(/REGISTRY GUARD REFUSAL/);
    expect(() => loadRegistry(HISTORICAL_FILE)).to.throw(/assetRegistry\.resolved\.json/);
  });

  it("manifest verification passes on the committed Revision B package", function () {
    const { manifest, resolved } = verifyCeremonyManifest();
    expect(manifest.expectedRegistryRows).to.equal(487);
    expect(resolved.sha256).to.equal(EXPECTED_REGISTRY_SHA256);
    expect(EXPECTED_MANIFEST_SHA256).to.match(/^[0-9a-f]{64}$/);
  });

  it("manifest check refuses a tampered manifest digest (constant mismatch)", function () {
    const manPath = path.join(__dirname, "..", "deployment", "ceremony-manifest.json");
    const original = fs.readFileSync(manPath);
    const tmp = JSON.parse(original.toString("utf8"));
    tmp.revisionLabel = "TAMPERED";
    fs.writeFileSync(manPath, JSON.stringify(tmp, null, 2) + "\n");
    try {
      expect(() => verifyCeremonyManifest()).to.throw(/REFUSED/);
      try {
        verifyCeremonyManifest();
      } catch (e) {
        expect(e.refusedMessage).to.match(/manifest\.sha256/);
        expect(e.refusedMessage).to.include(EXPECTED_MANIFEST_SHA256);
      }
    } finally {
      fs.writeFileSync(manPath, original);
    }
  });

  it("manifest check refuses missing fee language on an EVM lock page", function () {
    // Exercise the refused() helper shape for deployOrder / fee via a temp page.
    const ethPage = path.join(PAGES, "ethereum.html");
    const original = fs.readFileSync(ethPage, "utf8");
    fs.writeFileSync(ethPage, original.replace(/5\.00% of gross/g, "2.50% of gross"));
    try {
      expect(() => verifyCeremonyManifest()).to.throw(/REFUSED/);
      try {
        verifyCeremonyManifest();
      } catch (e) {
        expect(e.refusedMessage).to.match(/feeLanguage/);
      }
    } finally {
      fs.writeFileSync(ethPage, original);
    }
  });


  it("manifest check refuses deployOrder that differs from baseCeremonyFlow.js", function () {
    const manPath = path.join(__dirname, "..", "deployment", "ceremony-manifest.json");
    const original = fs.readFileSync(manPath);
    const tmp = JSON.parse(original.toString("utf8"));
    // Swap Stake and Base lock so the constant SHA fails first — that is the
    // intended refuse path when the manifest is edited to "match".
    tmp.deployOrderKeys = [
      "TokenVCLM", "TokenCHONX", "VinculumFinalisVerifier",
      "VinculumFinalisSynth", "BaseCommitmentVaultLock", "VinculumFinalisStake",
    ];
    fs.writeFileSync(manPath, JSON.stringify(tmp, null, 2) + "\n");
    try {
      expect(() => verifyCeremonyManifest()).to.throw(/REFUSED/);
      try { verifyCeremonyManifest(); } catch (e) {
        expect(e.refusedMessage).to.match(/manifest\.sha256/);
      }
    } finally {
      fs.writeFileSync(manPath, original);
    }
  });

  it("manifest check refuses wrong price-poster handoff when liveConfig is swapped", function () {
    const livePath = path.join(__dirname, "..", "deployment", "liveConfig.json");
    const original = fs.readFileSync(livePath);
    const tmp = JSON.parse(original.toString("utf8"));
    tmp.scheduledPricePoster = "0x0000000000000000000000000000000000000001";
    fs.writeFileSync(livePath, JSON.stringify(tmp, null, 2) + "\n");
    try {
      expect(() => verifyCeremonyManifest()).to.throw(/REFUSED/);
      try { verifyCeremonyManifest(); } catch (e) {
        // liveConfig.json is a packaged artifact; digest mismatch is refused first.
        expect(e.refusedMessage).to.match(/artifact\.liveConfig\.json\.sha256|pricePosterHandoff/);
      }
    } finally {
      fs.writeFileSync(livePath, original);
    }
  });

  it("manifest check refuses wrong Dev Fund from representativeBase", function () {
    const repPath = path.join(__dirname, "..", "deployment", "representativeBase.cjs");
    const original = fs.readFileSync(repPath, "utf8");
    // Flip one hex digit in the Base Dev Fund constant used by the rows.
    const mutated = original.replace(
      "0xFD21BF773A193CDcb9F793100CB13a8baAdc3e9a",
      "0xFD21BF773A193CDcb9F793100CB13a8baAdc3e9b"
    );
    expect(mutated).to.not.equal(original);
    fs.writeFileSync(repPath, mutated);
    try {
      // Clear require cache so the mutated file is loaded.
      delete require.cache[require.resolve(repPath)];
      expect(() => verifyCeremonyManifest()).to.throw(/REFUSED/);
      try { verifyCeremonyManifest(); } catch (e) {
        // representativeBase.cjs is a packaged artifact; digest mismatch is refused first.
        expect(e.refusedMessage).to.match(/artifact\.representativeBase\.cjs\.sha256|devFund/);
      }
    } finally {
      fs.writeFileSync(repPath, original);
      delete require.cache[require.resolve(repPath)];
    }
  });

  it("page gate: N != 487 disables Connect and shows WRONG REGISTRY", function () {
    const html = renderConnectGatePage({
      filename: "assetRegistry.resolved.json",
      rowCount: 962,
      sha256: "00".repeat(32),
      buttonId: "connect",
      buttonLabel: "Connect wallet",
    });
    expect(html).to.include("WRONG REGISTRY: expected 487 rows, found 962");
    expect(html).to.include('id="connect"');
    expect(html).to.include("window.__REGISTRY_ROW_COUNT = 962");
    expect(html).to.include("btn.disabled = true");
    expect(html).to.match(/style="color:red;display:block"/);
  });

  it("page gate: N === 487 leaves the warning hidden", function () {
    const html = renderConnectGatePage({
      filename: "assetRegistry.revB.json",
      rowCount: 487,
      sha256: EXPECTED_REGISTRY_SHA256,
    });
    expect(html).to.include("WRONG REGISTRY: expected 487 rows, found 487");
    expect(html).to.include('display:none');
    expect(html).to.include("window.__REGISTRY_ROW_COUNT = 487");
  });
});
