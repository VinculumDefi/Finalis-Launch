# =============================================================================
# vf-cosmos-hub-vault - Portable Final-Verification Script (Windows PowerShell)
# =============================================================================
# Runs on Windows with Docker Desktop. Uses ONLY native PowerShell commands
# (no GNU utilities assumed). Never deploys, uploads, instantiates, or spends.
#
# Steps:
#   0. Confirm Docker is available and print its version.
#   1. Run the complete clean Rust test suite in a pinned container.
#   2. Build the canonical optimized CosmWasm artifact (cosmwasm/optimizer:0.16.1).
#   3. Run cosmwasm-check on the optimized artifact.
#   4. Structural validation (wasm-tools if present, else wasm-opt --validate).
#   5. Record imports, exports, artifact path, byte size, and SHA-256.
#   6. Fail immediately on any required-step failure.
#   7. Save timestamped logs to verification-results\<stamp>\.
#
# Usage:  pwsh -File .\verify.ps1     (or: powershell -File .\verify.ps1)
# =============================================================================
$ErrorActionPreference = 'Stop'

# --- configuration -----------------------------------------------------------
$OptImage       = 'cosmwasm/optimizer:0.16.1'   # cosmwasm 2.1.x era; Rust 1.81 (NOT 0.17+)
$TestImage      = 'rust:slim-bookworm'           # honors rust-toolchain.toml pin (1.97.1)
$TargetVolTest  = 'vfcosmoshubvault_test_target'
$TargetVolOpt   = 'vfcosmoshubvault_opt_target'
$RegistryVol    = 'vfcosmoshubvault_registry'
$RustupVol      = 'vfcosmoshubvault_rustup'
$ArtifactRel    = 'artifacts/vf_cosmos_hub_vault.wasm'
$ChecksumsRel   = 'artifacts/checksums.txt'

$ProjectRoot    = (Get-Location).Path
if (Test-Path 'verify.sh' -PathType Leaf) {
    $ProjectRoot = (Split-Path -Parent (Resolve-Path 'verify.sh'))
}
Set-Location $ProjectRoot

$Stamp   = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
$Results = "verification-results\$Stamp"
New-Item -ItemType Directory -Force -Path $Results | Out-Null
$Log     = Join-Path $Results 'verify.log'
$Summary = Join-Path $Results 'SUMMARY.md'
'' | Out-File -FilePath $Log -Encoding utf8

# --- helpers ----------------------------------------------------------------
function Log-Line([string]$msg) {
    Add-Content -Path $Log -Value $msg
    Write-Host $msg
}
function Step([string]$msg) {
    Log-Line ''
    Log-Line ">>> $msg"
}
function Fail([string]$msg) {
    Log-Line "FATAL: $msg"
    throw $msg
}

# --- step 0: docker prerequisite ---------------------------------------------
Step 'Step 0: confirm Docker is available'
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Fail 'docker not found on PATH. Install Docker Desktop.'
}
docker version 2>&1 | Tee-Object -FilePath $Log -Append | Out-Host
if ($LASTEXITCODE -ne 0) { Fail 'docker version failed.' }
docker info | Out-Null
if ($LASTEXITCODE -ne 0) { Fail 'Docker daemon not reachable. Start Docker Desktop.' }
Log-Line 'Docker OK.'

# --- step 1: clean test suite ------------------------------------------------
Step 'Step 1: complete clean Rust test suite (cargo test --workspace --release)'
docker run --rm `
  -v "${ProjectRoot}:/code" -w /code `
  -v "${RustupVol}:/usr/local/rustup" `
  -v "${RegistryVol}:/usr/local/cargo/registry" `
  -v "${TargetVolTest}:/target" `
  -e CARGO_TARGET_DIR=/target `
  $TestImage sh -c 'cargo --version && rustc --version && cargo test --workspace --release' 2>&1 |
    Tee-Object -FilePath $Log -Append | Out-Host
if ($LASTEXITCODE -ne 0) { Fail 'Rust test suite failed.' }
Log-Line 'Test suite completed.'

# --- step 2: canonical optimized build --------------------------------------
Step "Step 2: optimized CosmWasm artifact via $OptImage"
if (Test-Path artifacts) { Remove-Item -Recurse -Force artifacts }
docker run --rm `
  -v "${ProjectRoot}:/code" `
  -v "${TargetVolOpt}:/target" `
  -v "${RegistryVol}:/usr/local/cargo/registry" `
  $OptImage 2>&1 | Tee-Object -FilePath $Log -Append | Out-Host
if ($LASTEXITCODE -ne 0) { Fail 'optimizer build failed.' }
if (-not (Test-Path $ArtifactRel))  { Fail "optimizer did not produce $ArtifactRel" }
if (-not (Test-Path $ChecksumsRel)) { Fail "optimizer did not produce $ChecksumsRel" }
Log-Line "Optimized artifact present: $ArtifactRel"

# --- step 3: cosmwasm-check --------------------------------------------------
Step 'Step 3: cosmwasm-check on optimized artifact'
docker run --rm --entrypoint cosmwasm-check `
  -v "${ProjectRoot}:/code" `
  $OptImage "/code/$ArtifactRel" 2>&1 | Tee-Object -FilePath $Log -Append | Out-Host
$rc = $LASTEXITCODE
if ($rc -eq 127) {
    Log-Line 'cosmwasm-check not bundled in optimizer image; using pinned install fallback.'
    docker run --rm `
      -v "${ProjectRoot}:/code" -w /code `
      -v "${RegistryVol}:/usr/local/cargo/registry" `
      -v "${RustupVol}:/usr/local/rustup" `
      $TestImage sh -c 'cargo install cosmwasm-check --version 2.1.3 --locked --root /usr/local && cosmwasm-check /code/artifacts/vf_cosmos_hub_vault.wasm' 2>&1 |
        Tee-Object -FilePath $Log -Append | Out-Host
    if ($LASTEXITCODE -ne 0) { Fail 'cosmwasm-check (fallback) reported errors.' }
} elseif ($rc -ne 0) {
    Fail "cosmwasm-check reported errors (exit $rc)."
}
Log-Line 'cosmwasm-check completed.'

# --- step 4: structural validation -----------------------------------------
Step 'Step 4: structural validation (wasm-tools if available, else wasm-opt --validate)'
docker run --rm --entrypoint wasm-tools `
  -v "${ProjectRoot}:/code" `
  $OptImage validate "/code/$ArtifactRel" 2>&1 | Tee-Object -FilePath $Log -Append | Out-Host
$rc = $LASTEXITCODE
if ($rc -eq 127) {
    Log-Line 'wasm-tools not found in image; falling back to wasm-opt --validate.'
    docker run --rm --entrypoint wasm-opt `
      -v "${ProjectRoot}:/code" `
      $OptImage --validate "/code/$ArtifactRel" 2>&1 | Tee-Object -FilePath $Log -Append | Out-Host
    if ($LASTEXITCODE -ne 0) { Fail 'wasm-opt --validate failed.' }
} elseif ($rc -ne 0) {
    Fail "wasm-tools validate failed (exit $rc)."
}
Log-Line 'Structural validation passed.'

# --- step 5: imports & exports inspection ----------------------------------
Step 'Step 5: record imports and exports'
$sexpr = Join-Path $Results 'wasm_sexpr.txt'
docker run --rm --entrypoint wasm-opt `
  -v "${ProjectRoot}:/code" `
  $OptImage --print "/code/$ArtifactRel" > $sexpr 2>> $Log
if ($LASTEXITCODE -ne 0) { Fail 'wasm-opt --print failed.' }

$exports = Select-String -Path $sexpr -Pattern '\(export "[^"]+"' |
    ForEach-Object { ($_.Line.Trim() -split '\s+')[0..1] -join ' ' } |
    Sort-Object -Unique
$imports = Select-String -Path $sexpr -Pattern '\(import "[^"]+" "[^"]+"' |
    ForEach-Object { $_.Line.Trim() } |
    Sort-Object -Unique
$exports | Out-File (Join-Path $Results 'exports.txt') -Encoding utf8
$imports | Out-File (Join-Path $Results 'imports.txt') -Encoding utf8
Log-Line '--- EXPORTS ---'; $exports | ForEach-Object { Log-Line $_ }
Log-Line '--- IMPORTS ---'; $imports | ForEach-Object { Log-Line $_ }

# --- step 6: artifact record (path / size / sha-256 + cross-check) ----------
Step 'Step 6: artifact record (path, size, SHA-256)'
$artifactPath = (Resolve-Path $ArtifactRel).Path
$size = (Get-Item $artifactPath).Length
$hash = (Get-FileHash -Path $artifactPath -Algorithm SHA256).Hash.ToLower()
$optHash = ((Get-Content $ChecksumsRel)[0] -split '\s+')[0].ToLower()
Log-Line "Artifact path : $artifactPath"
Log-Line "Byte size     : $size"
Log-Line "SHA-256 (host): $hash"
Log-Line "SHA-256 (opt) : $optHash"
if ($hash -ne $optHash) { Fail 'SHA-256 mismatch: host vs optimizer checksums.txt.' }

# --- summary -----------------------------------------------------------------
$exportLines = ($exports | ForEach-Object { "  $_" }) -join "`n"
$importLines = ($imports | ForEach-Object { "  $_" }) -join "`n"
$summaryText = @"
# Final Verification Summary - $Stamp

- Project: vf-cosmos-hub-vault
- Optimizer image: $OptImage
- Test image: $TestImage

## Optimized artifact
- Path: ``artifacts/vf_cosmos_hub_vault.wasm``
- Byte size: $size
- SHA-256: ``$hash``
- Optimizer checksums.txt: ``$optHash``
- Host vs optimizer SHA-256 match: YES

## Entry points (exports)
$exportLines

## Imports (module/name)
$importLines

## Steps completed
- [x] Docker available
- [x] Clean Rust test suite (cargo test --workspace --release)
- [x] Optimized build (cosmwasm/optimizer:0.16.1)
- [x] cosmwasm-check
- [x] Structural validation
- [x] Imports/exports recorded
- [x] SHA-256 cross-checked against optimizer checksums.txt

## Files to return for review
- ``artifacts/vf_cosmos_hub_vault.wasm``
- ``artifacts/checksums.txt``
- ``verification-results/$Stamp/`` (this directory)
"@
$summaryText | Out-File -FilePath $Summary -Encoding utf8

Log-Line '-----------------------------------------------------------------'
Log-Line "VERIFICATION COMPLETE. Results: $Results"
Log-Line "  Artifact : $artifactPath"
Log-Line "  Size    : $size bytes"
Log-Line "  SHA-256 : $hash"
Log-Line "  Summary : $Summary"
Log-Line 'No deployment, upload, instantiation, or fund transfer was performed.'