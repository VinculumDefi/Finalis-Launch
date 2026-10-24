// Mock event builders for the Base verifier test harness.
// Each builds a simulated finalized source event for a different environment family.

import { findAssetPrecision } from './vfBaseRegistry.js';
import { OUTPUT_TOKEN } from './vfProofNormalizer.js';
// Rev 12: every duration, the 1-hour Handshake included, uses 500 bps (5%).
// feeBpsForDuration comes from vfLiveRules.js, which matches the contracts.
import { feeBpsForDuration } from './vfLiveRules.js';

function now() { return Math.floor(Date.now() / 1000); }

export function buildSolanaMockEvent(duration, outputToken) {
  const gross = 1000000000n; // 1 SOL (9 dec)
  const bps = feeBpsForDuration(duration);
  const fee = (gross * bps) / 10000n;
  return {
    lock_id: `vf-sol-${Date.now()}`,
    fee_tx_signature: `mock-sol-fee-sig-${Date.now()}`,
    lock_type: 'Native',
    canonical_asset: 'SOL',
    gross_amount: gross.toString(),
    fee_amount: fee.toString(),
    principal_amount: (gross - fee).toString(),
    dev_fund_destination: '7xKXtg2CW87d97TXJSDpbD5jBkheTqAAdANpSUQk3',
    creation_time_secs: now(),
    maturity_time_secs: now() + Number(duration),
    duration_secs: Number(duration),
    output_token: outputToken,
    base_recipient: '0x' + '1'.repeat(40),
    release_destination: '7xKXtg2CW87d97TXJSDpbD5jBkheTqAAdANpSUQk3',
    chonx_activation_receipt: outputToken === 'CHONX' ? 'base-activation-block-42' : null,
  };
}

export function buildXrplMockEvent(duration, outputToken) {
  const gross = 50000000n; // 50 XRP
  const bps = feeBpsForDuration(duration);
  const fee = (gross * bps) / 10000n;
  const principal = gross - fee;
  const memoObj = {
    lock_id: `vf-xrpl-${Date.now()}`,
    output_token: outputToken,
    base_recipient: '0x' + '2'.repeat(40),
    release_destination: 'rDsbeomae4FXwgQTJp9Rs64Qg9vDiTCdBv',
    chonx_activation_receipt: outputToken === 'CHONX' ? 'base-act-42' : null,
  };
  const memoJson = JSON.stringify(memoObj);
  const memoHex = Array.from(memoJson).map((c) => c.charCodeAt(0).toString(16).padStart(2, '0')).join('').toUpperCase();
  return {
    escrow: {
      Account: 'rDsbeomae4FXwgQTJp9Rs64Qg9vDiTCdBv',
      Sequence: 3492199,
      Amount: principal.toString(),
      FinishAfter: now() + Number(duration),
      date: now(),
      Memos: [{ Memo: { MemoData: memoHex } }],
    },
    payment: {
      Destination: 'rHnBBVfjrtwqMLwCTEzJhB3LznhQDas5M4',
      hash: 'MOCKXRPLFEE' + Date.now(),
      Amount: fee.toString(),
    },
  };
}

export const UTXO_PRACTICE_GROSS = {
  Bitcoin: 100000n,       // 0.001 BTC
  BitcoinCash: 1800000n,  // 0.018 BCH
  Litecoin: 8400000n,     // 0.084 LTC
};

// Practice Handshake gross (t239u): mid-band of the Handshake unit band
// (vfUtxoMinimumLock.js UTXO_HANDSHAKE_UNIT_BAND, same as the verifier and lock.py).
// No price is involved: the Handshake is a set coin amount on these three chains.
export const UTXO_PRACTICE_HANDSHAKE_GROSS = {
  Bitcoin: 16500n,       // band 11,000 to 22,000 sats
  BitcoinCash: 16500n,   // band 11,000 to 22,000 sats
  Litecoin: 165000n,     // band 110,000 to 220,000 litoshis
};

export function buildUtxoMockEvent(env, duration, outputToken) {
  const sym = env === 'Bitcoin' ? 'BTC' : env === 'Litecoin' ? 'LTC' : env === 'Dogecoin' ? 'DOGE' : env === 'DigiByte' ? 'DGB' : env === 'Zcash' ? 'ZEC' : 'BCH';
  // Practice gross, 8 decimals. Bitcoin Cash and Litecoin are sized to clear the $1
  // minimum lock (t230u) with room for price drops: about $5 at the 2026-10-20 12:30 PM ET
  // CoinGecko prices (BCH $276.69, LTC $59.70). Bitcoin stays 0.001 BTC (about $82 at
  // $82,405), over its $20 minimum. Other UTXO chains keep 100,000 units.
  const handshakeGross = Number(duration) === 3600 ? UTXO_PRACTICE_HANDSHAKE_GROSS[env] : undefined;
  const gross = handshakeGross ?? UTXO_PRACTICE_GROSS[env] ?? 100000n;
  const bps = feeBpsForDuration(duration);
  const fee = (gross * bps) / 10000n;
  return {
    lock_id: `vf-${env.toLowerCase()}-${Date.now()}`,
    canonical_release_public_key: '02a1b2c3d4e5f6' + '0'.repeat(27),
    asset_symbol: sym,
    gross_satoshis: gross.toString(),
    fee_satoshis: fee.toString(),
    principal_satoshis: (gross - fee).toString(),
    dev_fund_address: 'bc1q' + 'x'.repeat(34),
    fee_output_txid: 'a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890',
    lock_block_timestamp: now(),
    maturity_timestamp: now() + Number(duration),
    duration_secs: Number(duration),
    output_token: outputToken,
    base_recipient: '0x' + '3'.repeat(40),
    chonx_activation_receipt: outputToken === 'CHONX' ? 'base-act-42' : null,
  };
}

export function buildStellarMockEvent(duration, outputToken) {
  const gross = 200000000n; // 20 XLM (7 dec)
  const bps = feeBpsForDuration(duration);
  const fee = (gross * bps) / 10000n;
  return {
    lock_id: `vf-stellar-${Date.now()}`,
    source_account: 'GA6HGQ5B3V3UJW3F' + 'X'.repeat(40),
    gross_stroops: gross.toString(),
    fee_stroops: fee.toString(),
    principal_stroops: (gross - fee).toString(),
    dev_fund_account: 'GA6HGQ5B3V3UJW3F' + 'Y'.repeat(40),
    fee_payment_txid: 'stellar-tx-' + Date.now(),
    lock_ledger_timestamp: now(),
    maturity_timestamp: now() + Number(duration),
    duration_secs: Number(duration),
    output_token: outputToken,
    base_recipient: '0x' + '4'.repeat(40),
    release_destination: 'GA6HGQ5B3V3UJW3F' + 'X'.repeat(40),
    chonx_activation_receipt: outputToken === 'CHONX' ? 'base-act-42' : null,
  };
}

export function buildEvmMockEvent(env, duration, outputToken) {
  const gross = 1000000000000000000n; // 1 ETH (18 dec)
  const bps = feeBpsForDuration(duration);
  const fee = (gross * bps) / 10000n;
  const nativeId = {
    Ethereum: 'native-ETH',
    Base: 'native-ETH',
    Optimism: 'native-ETH',
    Arbitrum: 'native-ETH',
    BNB: 'native-BNB',
    Avalanche: 'native-AVAX',
    Polygon: 'native-POL',
  }[env] || 'native-ETH';
  const listed = findAssetPrecision(env, nativeId);
  const sym = listed ? listed.symbol : 'ETH';
  return {
    lockId: `vf-${env.toLowerCase()}-${Date.now()}`,
    sourceAccount: '0x' + 'a'.repeat(40),
    isNative: true,
    assetSymbol: sym,
    assetDecimals: listed ? listed.decimals : 18,
    custodyClass: listed ? listed.custodyClass : 'S3',
    grossAmount: gross.toString(),
    feeAmount: fee.toString(),
    principalAmount: (gross - fee).toString(),
    devFundDestination: '0x' + 'd'.repeat(40),
    feeTransferTxHash: '0x' + 'e'.repeat(64),
    blockTimestamp: now(),
    maturityTimestamp: now() + Number(duration),
    durationSecs: Number(duration),
    outputToken: outputToken === 'VCLM' ? 0 : 1,
    baseRecipient: '0x' + '6'.repeat(40),
    chonxActivationReceipt: outputToken === 'CHONX' ? 'base-act-42' : null,
  };
}

// Shared finality proof builder — each format matches what the corresponding
// IChainVerifier expects (not the old generic { validated: true } format).
const _FP = { FINALIZED: 1, ACCEPTED: 2, CHECKPOINT_VERIFIED: 3, L1_FINALIZED: 4, CHALLENGE_PERIOD_PASSED: 5 };
const _PROOFS = {
  Ethereum:  { finalityStatus: _FP.FINALIZED, blockHash: '0xeth_block', blockNumber: 19000000 },
  BNB:       { confirmations: 2, blockHash: '0xbnb_block', blockNumber: 35000000 },
  Avalanche: { finalityStatus: _FP.ACCEPTED, blockHash: '0xavax_block', blockNumber: 40000000 },
  Polygon:   { finalityStatus: _FP.CHECKPOINT_VERIFIED, blockHash: '0xpoly_block', blockNumber: 55000000 },
  Arbitrum:  { finalityStatus: _FP.L1_FINALIZED, blockHash: '0xarb_block', blockNumber: 180000000 },
  Base:      { blockHash: '0xbase_block', blockNumber: 12000000 },
  Optimism:  { finalityStatus: _FP.L1_FINALIZED, blockHash: '0xop_block', blockNumber: 110000000 },
  Solana:    { commitment: 'finalized', slot: 250000000, blockhash: '0xsol_slot' },
  Bitcoin:     { confirmations: 6, blockHash: '0xbtc_block', blockHeight: 800000 },
  Litecoin:    { confirmations: 6, blockHash: '0xltc_block', blockHeight: 2500000 },
  Dogecoin:    { confirmations: 6, blockHash: '0xdoge_block', blockHeight: 4500000 },
  DigiByte:    { confirmations: 6, blockHash: '0xdgb_block', blockHeight: 15000000 },
  Zcash:       { confirmations: 10, blockHash: '0xzec_block', blockHeight: 2200000 },
  BitcoinCash: { confirmations: 6, blockHash: '0xbch_block', blockHeight: 800000 },
  XRPL:      { validated: true, ledgerIndex: 85000000, ledgerHash: '0xxrp_ledger' },
  Stellar:   { closed: true, ledgerSequence: 50000000, ledgerHash: '0xxlm_ledger' },
};

export function buildFinalityProof(envId) {
  return _PROOFS[envId] || { validated: true, height: 1000, hash: '0xabc' };
}

export function buildMockEvent(env, duration, outputToken) {
  if (env === 'Solana') return { type: 'solana', event: buildSolanaMockEvent(duration, outputToken) };
  if (env === 'XRPL') return { type: 'xrpl', event: buildXrplMockEvent(duration, outputToken) };
  if (env === 'Stellar') return { type: 'stellar', event: buildStellarMockEvent(duration, outputToken) };
  if (['Bitcoin', 'Litecoin', 'Dogecoin', 'DigiByte', 'Zcash', 'BitcoinCash'].includes(env))
    return { type: 'utxo', event: buildUtxoMockEvent(env, duration, outputToken) };
  return { type: 'evm', event: buildEvmMockEvent(env, duration, outputToken) };
}