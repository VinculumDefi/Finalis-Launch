// t284u / t285u: ceremony registry SHA-256 guard, manifest checks, Connect gate.
// t357u (Base-only launch): the ceremony data carries only the Base subset of
// the source (27 rows, 26 token addresses, 0 aliases), and base.html is the
// only page, so its own Connect gate is tested here.
// t367u: the ceremony source is registry Revision C (487 rows). Revision C
// differs from Revision B only in row 454 USDC_BASE (S3 -> S1); Revision B
// stays unchanged and pinned.
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
const { HISTORICAL_FILE, loadRegistry, REGISTRY_FILE: REVB_FILE } = require("../scripts/registryFile.cjs");
const REVB_SHA256 = "1bdcb8346ab95abe5225adcffb9c5c3c7bb40c6cd5f1a851d3ed05bb2d77e2a9";
const sha256File = (f) => crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");

const PAGES = path.join(__dirname, "..", "scripts", "deploy-pages");
const CEREMONY_DATA = path.join(PAGES, "ceremony-data.json");

describe("ceremony registry guard (t284u / t285u)", function () {
  it("resolved registry has 487 rows and row 2 is Base native ETH", function () {
    const r = resolveCeremonyRegistry();
    expect(r.path).to.equal(REGISTRY_FILE);
    expect(r.filename).to.equal("assetRegistry.revC.json");
    expect(r.sha256).to.equal("5c3311eb4f7b59c34e7ccc8a6bd9e817b4f0bb02bdeff65c5cfed98f79cca581");
    expect(r.rowCount).to.equal(487);
    expect(r.sha256).to.equal(EXPECTED_REGISTRY_SHA256);
    expect(r.baseEth.environmentId).to.equal("Base");
    expect(r.baseEth.symbol).to.equal("ETH");
    expect(r.baseEth.assetId).to.equal("native-ETH");
    expect(r.baseEth.row).to.equal(2);
  });

  it("ceremony artifact: source 487 rows, Base subset 27/26/0, source equals resolver, hash equals constant", function () {
    const resolved = assertCanonicalRegistry();
    expect(fs.existsSync(CEREMONY_DATA)).to.equal(true);
    const data = JSON.parse(fs.readFileSync(CEREMONY_DATA, "utf8"));
    expect(data.registryRows).to.equal(EXPECTED_REGISTRY_ROWS);
    expect(data.entries.length).to.equal(27);
    expect(data.entries.every((e) => e.environmentId === "Base")).to.equal(true);
    const key = (e) => e.row + ":" + e.canonicalAssetId;
    expect(data.entries.map(key)).to.deep.equal(resolved.entries.filter((e) => e.environmentId === "Base").map(key));
    expect(data.tokenAddresses.length).to.equal(26);
    expect(data.tokenAddresses.every((t) => t.environmentId === "Base")).to.equal(true);
    expect(data.assetRowAliases.length).to.equal(0);
    expect(data.registrySha256).to.equal(EXPECTED_REGISTRY_SHA256);
    expect(data.registrySha256).to.equal(resolved.sha256);
    expect(data.registrySource).to.equal(resolved.filename);
    expect(path.resolve(path.join(__dirname, "..", data.registryPath || "deployment/assetRegistry.revC.json"))).to.equal(resolved.path);
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

  it("build guard refuses a one-byte-modified copy of Revision C in a temp dir", function () {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "revc-mut-"));
    const copy = path.join(tmp, "assetRegistry.revC.json");
    const raw = fs.readFileSync(REGISTRY_FILE, "utf8");
    // Flip one character inside a stable string field; keep valid JSON and 487 rows.
    const mutated = raw.replace('"revision": "C"', '"revision": "X"');
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

  it("build guard refuses Revision B as the ceremony source (t367u)", function () {
    expect(() => assertRegistryGuard(REVB_FILE)).to.throw(/REFUSED/);
    try { assertRegistryGuard(REVB_FILE); } catch (e) {
      expect(e.refusedMessage).to.match(/registry\.sha256/);
      expect(e.refusedMessage).to.include(REVB_SHA256);
    }
  });

  it("Revision B is unchanged and still pinned; Revision C differs only in row 454 USDC_BASE (S3 -> S1)", function () {
    expect(sha256File(REVB_FILE)).to.equal(REVB_SHA256);
    const man = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "deployment", "ceremony-manifest.json"), "utf8"));
    expect(man.artifacts.find((a) => a.filename === "assetRegistry.revB.json").sha256).to.equal(REVB_SHA256);
    expect(man.artifacts.find((a) => a.filename === "assetRegistry.revC.json").sha256).to.equal(EXPECTED_REGISTRY_SHA256);
    const B = JSON.parse(fs.readFileSync(REVB_FILE, "utf8"));
    const C = JSON.parse(fs.readFileSync(REGISTRY_FILE, "utf8"));
    expect(C.entries.length).to.equal(B.entries.length);
    const diffs = [];
    B.entries.forEach((b, i) => {
      for (const k of new Set([...Object.keys(b), ...Object.keys(C.entries[i])])) {
        if (JSON.stringify(b[k]) !== JSON.stringify(C.entries[i][k])) diffs.push(`${b.row}:${b.environmentId}:${b.symbol}:${k}:${b[k]}->${C.entries[i][k]}`);
      }
    });
    expect(diffs).to.deep.equal(["454:Base:USDC_BASE:custodyClass:3->1"]);
    expect(JSON.stringify(C.counts)).to.equal(JSON.stringify(B.counts));
  });

  it("ceremony data registers Base USDC (row 454) as S1", function () {
    const data = JSON.parse(fs.readFileSync(CEREMONY_DATA, "utf8"));
    const usdc = data.entries.find((e) => e.row === 454);
    expect(usdc.environmentId).to.equal("Base");
    expect(usdc.decimals).to.equal(6);
    expect(usdc.custodyClass).to.equal(1);
    expect(data.registryRevisionLabel).to.equal("registry-revC-2026-10-24");
  });

  it("loadRegistry refuses the historical file as ceremony source (no silent fallback)", function () {
    expect(() => loadRegistry(HISTORICAL_FILE)).to.throw(/REGISTRY GUARD REFUSAL/);
    expect(() => loadRegistry(HISTORICAL_FILE)).to.throw(/assetRegistry\.resolved\.json/);
  });

  it("manifest verification passes on the committed Revision C package", function () {
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

  it("manifest check refuses missing fee language on base.html", function () {
    // Exercise the refused() helper shape for the fee check via a temp edit.
    const ethPage = path.join(PAGES, "base.html");
    const original = fs.readFileSync(ethPage, "utf8");
    fs.writeFileSync(ethPage, original.replace(/5\.00% of gross/g, "2.50% of gross"));
    try {
      expect(() => verifyCeremonyManifest()).to.throw(/REFUSED/);
      try {
        verifyCeremonyManifest();
      } catch (e) {
        // base.html is a packaged artifact; digest mismatch or fee language is refused.
        expect(e.refusedMessage).to.match(/feeLanguage|artifact\.base\.html\.sha256/);
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

  // base.html's own Connect gate (registryProblem), run outside the browser.
  function baseGate() {
    const html = fs.readFileSync(path.join(PAGES, "base.html"), "utf8");
    const src = html.match(/const EXPECTED_REGISTRY_ROWS = [\s\S]*?\nfunction registryProblem\(d\) \{[\s\S]*?\n\}/);
    expect(src, "registryProblem in base.html").to.not.equal(null);
    const body = src[0].replace(/^const (logEl|sealEl|connectBtn) = .*$/gm, "").replace(/^let signer, data;$/m, "");
    return new Function("document", body + "\nreturn registryProblem;")({ getElementById: () => ({}) });
  }

  it("page gate: base.html refuses a wrong source count, a wrong Base count or a non-Base row", function () {
    const gate = baseGate();
    const data = JSON.parse(fs.readFileSync(CEREMONY_DATA, "utf8"));
    expect(gate({ ...data, registryRows: 962 })).to.equal("expected 487 source rows, found 962");
    expect(gate({ ...data, entries: data.entries.slice(1) })).to.equal("expected 27 Base rows, found 26");
    const bad = data.entries.map((e, i) => (i === 3 ? { ...e, environmentId: "Ethereum" } : e));
    expect(gate({ ...data, entries: bad })).to.match(/non-Base row/);
    const html = fs.readFileSync(path.join(PAGES, "base.html"), "utf8");
    expect(html).to.include('id="registry-wrong" style="display:none"');
    expect(html).to.include("connectBtn.disabled = true");
  });

  it("page gate: base.html refuses ceremony data built from Revision B (t367u)", function () {
    const data = JSON.parse(fs.readFileSync(CEREMONY_DATA, "utf8"));
    expect(baseGate()({ ...data, registrySha256: REVB_SHA256 })).to.match(/expected registry Revision C/);
  });

  it("page gate: base.html passes the committed ceremony-data.json", function () {
    expect(baseGate()(JSON.parse(fs.readFileSync(CEREMONY_DATA, "utf8")))).to.equal(null);
  });
});
