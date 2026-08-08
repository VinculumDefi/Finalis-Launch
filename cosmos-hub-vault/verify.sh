#!/usr/bin/env bash
# =============================================================================
# vf-cosmos-hub-vault — Portable Final-Verification Script (Linux / macOS)
# =============================================================================
# Runs on any Docker-capable Linux, macOS, or Windows-WSL machine.
#
# What it does (and ONLY does — it never deploys, uploads, instantiates,
# or spends funds):
#   1. Confirms Docker is available and prints its version.
#   2. Runs the complete clean Rust test suite in a pinned container.
#   3. Builds the canonical optimized CosmWasm artifact via a pinned
#      cosmwasm/optimizer image (NOT 0.17+, which requires CosmWasm 3.0).
#   4. Runs cosmwasm-check on the optimized artifact.
#   5. Runs structural validation (wasm-tools if present, else wasm-opt).
#   6. Records imports, exports, artifact path, byte size, and SHA-256.
#   7. Fails immediately on any required-step failure.
#   8. Saves timestamped logs to verification-results/<stamp>/.
#
# Prerequisites: Docker (Engine or Desktop) running. No host Rust required.
# =============================================================================
set -euo pipefail

# --- configuration -----------------------------------------------------------
OPTIMIZER_IMAGE="cosmwasm/optimizer:0.16.1"   # cosmwasm 2.1.x era; Rust 1.81
TEST_IMAGE="rust:slim-bookworm"               # honors rust-toolchain.toml pin (1.97.1)
TARGET_VOLUME_TEST="vfcosmoshubvault_test_target"
TARGET_VOLUME_OPT="vfcosmoshubvault_opt_target"
REGISTRY_VOLUME="vfcosmoshubvault_registry"
RUSTUP_VOLUME="vfcosmoshubvault_rustup"
ARTIFACT_REL="artifacts/vf_cosmos_hub_vault.wasm"
CHECKSUMS_REL="artifacts/checksums.txt"

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
RESULTS="verification-results/${STAMP}"
LOG="${RESULTS}/verify.log"
SUMMARY="${RESULTS}/SUMMARY.md"
mkdir -p "$RESULTS"
: > "$LOG"

# --- helpers -----------------------------------------------------------------
say()  { printf '\n>>> %s\n' "$*" | tee -a "$LOG"; }
fail() { printf '\nFATAL: %s\n' "$*" | tee -a "$LOG" >&2; exit 1; }
step() { say "$*"; }

log()  { printf '%s\n' "$*" | tee -a "$LOG"; }

sha256_of() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  else
    shasum -a 256 "$1" | awk '{print $1}'
  fi
}
file_size() {
  # portable byte size (Linux stat -c%s ; macOS/BSD stat -f%z)
  stat -c%s "$1" 2>/dev/null || stat -f%z "$1" 2>/dev/null
}

# --- step 0: docker prerequisite ---------------------------------------------
step "Step 0: confirm Docker is available"
command -v docker >/dev/null 2>&1 || fail "docker not found on PATH. Install Docker Engine or Docker Desktop."
docker version | tee -a "$LOG"
docker info >/dev/null 2>&1 || fail "Docker daemon not reachable. Start Docker Desktop or dockerd."
log "Docker OK."

# --- step 1: clean test suite (pinned toolchain via rust-toolchain.toml) -----
step "Step 1: complete clean Rust test suite (cargo test --workspace --release)"
docker run --rm \
  -v "$PROJECT_ROOT":/code -w /code \
  -v "${RUSTUP_VOLUME}":/usr/local/rustup \
  -v "${REGISTRY_VOLUME}":/usr/local/cargo/registry \
  -v "${TARGET_VOLUME_TEST}":/target \
  -e CARGO_TARGET_DIR=/target \
  "$TEST_IMAGE" sh -c 'cargo --version && rustc --version && cargo test --workspace --release' 2>&1 | tee -a "$LOG"
log "Test suite completed."

# --- step 2: canonical optimized build (pinned cosmwasm/optimizer:0.16.1) ---
step "Step 2: optimized CosmWasm artifact via ${OPTIMIZER_IMAGE}"
rm -rf artifacts
docker run --rm \
  -v "$PROJECT_ROOT":/code \
  -v "${TARGET_VOLUME_OPT}":/target \
  -v "${REGISTRY_VOLUME}":/usr/local/cargo/registry \
  "$OPTIMIZER_IMAGE" 2>&1 | tee -a "$LOG"
test -f "$ARTIFACT_REL"  || fail "optimizer did not produce ${ARTIFACT_REL}"
test -f "$CHECKSUMS_REL" || fail "optimizer did not produce ${CHECKSUMS_REL}"
log "Optimized artifact present: ${ARTIFACT_REL}"

# --- step 3: cosmwasm-check ---------------------------------------------------
step "Step 3: cosmwasm-check on optimized artifact"
set +e
docker run --rm --entrypoint cosmwasm-check \
  -v "$PROJECT_ROOT":/code \
  "$OPTIMIZER_IMAGE" "/code/${ARTIFACT_REL}" 2>&1 | tee -a "$LOG"
rc=$?
set -e
if [ "$rc" -eq 127 ]; then
  log "cosmwasm-check not bundled in optimizer image; using pinned install fallback."
  docker run --rm \
    -v "$PROJECT_ROOT":/code -w /code \
    -v "${REGISTRY_VOLUME}":/usr/local/cargo/registry \
    -v "${RUSTUP_VOLUME}":/usr/local/rustup \
    "$TEST_IMAGE" sh -c \
      'cargo install cosmwasm-check --version 2.1.3 --locked --root /usr/local && cosmwasm-check /code/artifacts/vf_cosmos_hub_vault.wasm' \
    2>&1 | tee -a "$LOG"
elif [ "$rc" -ne 0 ]; then
  fail "cosmwasm-check reported errors (exit ${rc})."
fi
log "cosmwasm-check completed."

# --- step 4: structural validation -------------------------------------------
step "Step 4: structural validation (wasm-tools if available, else wasm-opt --validate)"
set +e
docker run --rm --entrypoint wasm-tools \
  -v "$PROJECT_ROOT":/code \
  "$OPTIMIZER_IMAGE" validate "/code/${ARTIFACT_REL}" 2>&1 | tee -a "$LOG"
rc=$?
set -e
if [ "$rc" -eq 127 ]; then
  log "wasm-tools not found in image; falling back to wasm-opt --validate."
  docker run --rm --entrypoint wasm-opt \
    -v "$PROJECT_ROOT":/code \
    "$OPTIMIZER_IMAGE" --validate "/code/${ARTIFACT_REL}" 2>&1 | tee -a "$LOG"
  [ "$?" -eq 0 ] || fail "wasm-opt --validate failed."
elif [ "$rc" -ne 0 ]; then
  fail "wasm-tools validate failed (exit ${rc})."
fi
log "Structural validation passed."

# --- step 5: imports & exports inspection ------------------------------------
step "Step 5: record imports and exports"
docker run --rm --entrypoint wasm-opt \
  -v "$PROJECT_ROOT":/code \
  "$OPTIMIZER_IMAGE" --print "/code/${ARTIFACT_REL}" > "${RESULTS}/wasm_sexpr.txt" 2>> "$LOG"
grep -Eo '\(export "[^"]+"' "${RESULTS}/wasm_sexpr.txt" | sort -u > "${RESULTS}/exports.txt" || true
grep -Eo '\(import "[^"]+" "[^"]+"' "${RESULTS}/wasm_sexpr.txt" | sort -u > "${RESULTS}/imports.txt" || true
log "--- EXPORTS ---"; cat "${RESULTS}/exports.txt" | tee -a "$LOG"
log "--- IMPORTS ---"; cat "${RESULTS}/imports.txt" | tee -a "$LOG"

# --- step 6: artifact record (path / size / sha-256 + cross-check) -----------
step "Step 6: artifact record (path, size, SHA-256)"
SIZE="$(file_size "$ARTIFACT_REL")"
SHA="$(sha256_of "$ARTIFACT_REL")"
OPT_SHA="$(awk 'NR==1{print $1}' "$CHECKSUMS_REL")"
log "Artifact path : ${PROJECT_ROOT}/${ARTIFACT_REL}"
log "Byte size     : ${SIZE}"
log "SHA-256 (host): ${SHA}"
log "SHA-256 (opt) : ${OPT_SHA}"
[ "$SHA" = "$OPT_SHA" ] || fail "SHA-256 mismatch: host vs optimizer checksums.txt."

# --- summary -----------------------------------------------------------------
{
  echo "# Final Verification Summary — ${STAMP}"
  echo
  echo "- Project: vf-cosmos-hub-vault"
  echo "- Optimizer image: ${OPTIMIZER_IMAGE}"
  echo "- Test image: ${TEST_IMAGE}"
  echo
  echo "## Optimized artifact"
  echo "- Path: \`artifacts/vf_cosmos_hub_vault.wasm\`"
  echo "- Byte size: ${SIZE}"
  echo "- SHA-256: \`${SHA}\`"
  echo "- Optimizer checksums.txt: \`${OPT_SHA}\`"
  echo "- Host vs optimizer SHA-256 match: YES"
  echo
  echo "## Entry points (exports)"
  sed 's/^/  /' "${RESULTS}/exports.txt"
  echo
  echo "## Imports (module/name)"
  sed 's/^/  /' "${RESULTS}/imports.txt"
  echo
  echo "## Steps completed"
  echo "- [x] Docker available"
  echo "- [x] Clean Rust test suite (cargo test --workspace --release)"
  echo "- [x] Optimized build (cosmwasm/optimizer:0.16.1)"
  echo "- [x] cosmwasm-check"
  echo "- [x] Structural validation"
  echo "- [x] Imports/exports recorded"
  echo "- [x] SHA-256 cross-checked against optimizer checksums.txt"
  echo
  echo "## Files to return for review"
  echo "- \`artifacts/vf_cosmos_hub_vault.wasm\`"
  echo "- \`artifacts/checksums.txt\`"
  echo "- \`verification-results/${STAMP}/\` (this directory)"
} > "$SUMMARY"

log "-----------------------------------------------------------------"
log "VERIFICATION COMPLETE. Results: ${RESULTS}"
log "  Artifact : ${PROJECT_ROOT}/${ARTIFACT_REL}"
log "  Size    : ${SIZE} bytes"
log "  SHA-256 : ${SHA}"
log "  Summary : ${SUMMARY}"
log "No deployment, upload, instantiation, or fund transfer was performed."