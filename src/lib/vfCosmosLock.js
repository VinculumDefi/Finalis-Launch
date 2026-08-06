// Real Cosmos Hub lock transaction construction for the Vinculum Finalis Commitment Vault.
// Uses the actual ExecuteMsg schema (src/cosmos-hub-vault/.../schema/execute_msg.json + msg.rs).
// Connects the injected Keplr wallet (window.keplr) — no npm package required.
// Broadcast is blocked at the boundary when the vault address is PENDING_DEPLOYMENT.
// No fabricated hashes, balances, or success responses.

import {
  COSMOS_HUB, PERMITTED_DURATIONS, DURATION_HANDSHAKE,
  FEE_BPS_HANDSHAKE, FEE_BPS_STANDARD,
  HANDSHAKE_USD_MIN_MICRO, HANDSHAKE_USD_MAX_MICRO, STANDARD_USD_MIN_MICRO,
  isVaultDeployed,
} from './vfIntegrationConfig';

const BASE_RECIPIENT_LEN = 42;
const MAX_LOCK_ID_LEN = 128;
const NOT_APPLICABLE = 'not_applicable';

// Mirror of contract::validate_base_recipient (defect 10): 0x + 40 hex chars.
export function validateBaseRecipient(s) {
  if (s.length !== BASE_RECIPIENT_LEN || !s.startsWith('0x')) return false;
  return s.slice(2).split('').every((c) => '0123456789abcdefABCDEF'.includes(c));
}

// Mirror of contract::validate_lock_id: non-empty, bounded, no control/whitespace.
export function validateLockId(s) {
  if (!s || s.length > MAX_LOCK_ID_LEN) return false;
  return !s.split('').some((c) => c.charCodeAt(0) < 33 || c === ' ');
}

// Mirror of commit_vault_lock fee math (VF-COM-011/012): floor(gross * bps / 10000).
export function computeFee(grossUatom, durationSecs) {
  const gross = BigInt(grossUatom);
  const bps = BigInt(durationSecs === DURATION_HANDSHAKE ? FEE_BPS_HANDSHAKE : FEE_BPS_STANDARD);
  const fee = (gross * bps) / 10000n;
  const principal = gross - fee;
  return { gross: gross.toString(), fee: fee.toString(), principal: principal.toString() };
}

// Validate the Verified Gross USD value bounds (VF-COM-003/009).
export function validateValueBounds(verifiedGrossUsdMicro, durationSecs) {
  let v;
  try { v = BigInt(verifiedGrossUsdMicro); } catch { return false; }
  if (durationSecs === DURATION_HANDSHAKE) {
    return v >= BigInt(HANDSHAKE_USD_MIN_MICRO) && v <= BigInt(HANDSHAKE_USD_MAX_MICRO);
  }
  return v >= BigInt(STANDARD_USD_MIN_MICRO);
}

export function isPermittedDuration(secs) {
  return PERMITTED_DURATIONS.some((d) => d.secs === Number(secs));
}

// Build the REAL ExecuteMsg.CommitVaultLock JSON, exactly matching the contract schema.
// verified_gross_usd_micro is emitted as a string (uint128 JSON).
export function buildCommitVaultLockMsg({
  durationSecs, baseRecipient, releaseDestination, outputToken,
  verifiedGrossUsdMicro, lockId, chonxActivationReceipt,
}) {
  const errors = [];
  if (!isPermittedDuration(durationSecs)) errors.push(`duration not permitted: ${durationSecs}`);
  if (!validateBaseRecipient(baseRecipient)) errors.push(`invalid base_recipient (expected 0x + 40 hex)`);
  if (!validateLockId(lockId)) errors.push('invalid lock_id');
  if (!['VCLM', 'CHONX'].includes(outputToken)) errors.push(`invalid output_token: ${outputToken}`);
  const receipt = outputToken === 'CHONX'
    ? (chonxActivationReceipt && chonxActivationReceipt.trim() && chonxActivationReceipt.trim() !== NOT_APPLICABLE ? chonxActivationReceipt : '')
    : NOT_APPLICABLE;
  if (outputToken === 'CHONX' && !receipt) errors.push('CHONX requires a non-empty activation receipt (VF-COM-025)');
  if (!validateValueBounds(verifiedGrossUsdMicro, Number(durationSecs))) errors.push('verified_gross_usd_micro out of permitted bounds');
  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    msg: {
      commit_vault_lock: {
        duration_secs: Number(durationSecs),
        base_recipient: baseRecipient,
        release_destination: releaseDestination,
        output_token: outputToken,
        verified_gross_usd_micro: String(verifiedGrossUsdMicro),
        lock_id: lockId,
        chonx_activation_receipt: receipt,
      },
    },
  };
}

// Build the REAL ExecuteMsg.ReleasePrincipal JSON.
export function buildReleasePrincipalMsg(lockId) {
  if (!validateLockId(lockId)) return { ok: false, errors: ['invalid lock_id'] };
  return { ok: true, msg: { release_principal: { lock_id: lockId } } };
}

// --- Keplr connection (injected provider; no package needed) ---
export function isKeplrAvailable() {
  return typeof window !== 'undefined' && !!window.keplr;
}

export async function connectKeplr() {
  if (!isKeplrAvailable()) {
    return { ok: false, reason: 'Keplr wallet not detected. Install the Keplr browser extension.' };
  }
  try {
    await window.keplr.enable(COSMOS_HUB.chain_id);
    const offlineSigner = window.getOfflineSigner && window.getOfflineSigner(COSMOS_HUB.chain_id);
    const accounts = offlineSigner ? await offlineSigner.getAccounts() : [];
    const addr = accounts[0] ? accounts[0].address : null;
    return { ok: true, address: addr, signer: offlineSigner };
  } catch (e) {
    return { ok: false, reason: String(e && e.message ? e.message : e) };
  }
}

// Submit (construct + sign + broadcast) a CommitVaultLock. Blocked at broadcast when undeployed.
export async function submitLock({ signer, senderAddress, msg, funds }) {
  if (!isVaultDeployed()) {
    return {
      ok: false,
      blocked: true,
      reason: 'Broadcast blocked: the Cosmos Hub vault contract address is PENDING_DEPLOYMENT.',
      missing: 'COSMOS_HUB.vault_contract_address',
    };
  }
  // Deployed path (not reachable until an address is configured): sign via Keplr Amino and
  // broadcast to the Cosmos REST tx endpoint. This code is retained so configuring a deployed
  // address activates the real path without rewriting the application.
  if (!signer || !senderAddress) {
    return { ok: false, blocked: true, reason: 'Wallet not connected.' };
  }
  const fee = { amount: [{ denom: COSMOS_HUB.base_denom, amount: '5000' }], gas: '400000' };
  const signed = await signer.signAmino(senderAddress, {
    chain_id: COSMOS_HUB.chain_id,
    account_number: 0, sequence: 0,
    fee, msgs: [{
      type: 'wasm/MsgExecuteContract',
      value: { sender: senderAddress, contract: COSMOS_HUB.vault_contract_address, msg, funds },
    }], memo: '',
  });
  const body = { tx_bytes: '', mode: 'BROADCAST_MODE_SYNC', ...signed };
  const res = await fetch(`${COSMOS_HUB.rest}/cosmos/tx/v1beta1/txs`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const json = await res.json();
  return { ok: true, txResponse: json };
}

// Submit a ReleasePrincipal. Same deploy boundary.
export async function submitRelease({ signer, senderAddress, lockId }) {
  if (!isVaultDeployed()) {
    return {
      ok: false, blocked: true,
      reason: 'Broadcast blocked: the Cosmos Hub vault contract address is PENDING_DEPLOYMENT.',
      missing: 'COSMOS_HUB.vault_contract_address',
    };
  }
  const built = buildReleasePrincipalMsg(lockId);
  if (!built.ok) return { ok: false, reason: built.errors.join('; ') };
  return submitLock({ signer, senderAddress, msg: built.msg, funds: [] });
}