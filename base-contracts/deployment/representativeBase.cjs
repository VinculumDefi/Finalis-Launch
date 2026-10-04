/**
 * Representative deployment of the sixteen source environments.
 * Destinations only. This module does not broadcast and does not deploy.
 *
 * Cosmos Hub is not a row. Native ATOM is not a row.
 *
 * Handshake allowance is derived from countsPerIdentity:
 *   a mechanism that can keep a per-identity count -> 3
 *   a mechanism that cannot -> 1
 * The number is not stored on the row.
 */

const EVM_DEV_FUND = "0xFD21BF773A193CDcb9F793100CB13a8baAdc3e9a";

function handshakeAllowance(countsPerIdentity) {
  return countsPerIdentity ? 3 : 1;
}

// countsPerIdentity is the capability of the lock mechanism that already
// exists for that environment, not a chosen number.
const MECHANISMS = [
  {
    environment: "Base",
    lock: "CommitmentVaultLock",
    countsPerIdentity: true,
    reason: "EVM account storage keeps handshakeUses per source account",
    devFund: EVM_DEV_FUND,
  },
  {
    environment: "Ethereum",
    lock: "CommitmentVaultLock",
    countsPerIdentity: true,
    reason: "EVM account storage keeps handshakeUses per source account",
    devFund: EVM_DEV_FUND,
  },
  {
    environment: "Polygon",
    lock: "CommitmentVaultLock",
    countsPerIdentity: true,
    reason: "EVM account storage keeps handshakeUses per source account",
    devFund: EVM_DEV_FUND,
  },
  {
    environment: "Optimism",
    lock: "CommitmentVaultLock",
    countsPerIdentity: true,
    reason: "EVM account storage keeps handshakeUses per source account",
    devFund: EVM_DEV_FUND,
  },
  {
    environment: "Arbitrum",
    lock: "CommitmentVaultLock",
    countsPerIdentity: true,
    reason: "EVM account storage keeps handshakeUses per source account",
    devFund: EVM_DEV_FUND,
  },
  {
    environment: "BNB Smart Chain",
    lock: "CommitmentVaultLock",
    countsPerIdentity: true,
    reason: "EVM account storage keeps handshakeUses per source account",
    devFund: EVM_DEV_FUND,
  },
  {
    environment: "Avalanche",
    lock: "CommitmentVaultLock",
    countsPerIdentity: true,
    reason: "EVM account storage keeps handshakeUses per source account",
    devFund: EVM_DEV_FUND,
  },
  {
    environment: "Bitcoin",
    lock: "utxo-locks CLTV P2SH",
    countsPerIdentity: false,
    reason: "CLTV script cannot keep a per-identity count",
    devFund: "bc1qgf9h8m2fxeu66z9pq7dxgczuz5c4y52pek9jcu",
  },
  {
    environment: "Bitcoin Cash",
    lock: "utxo-locks CLTV P2SH",
    countsPerIdentity: false,
    reason: "CLTV script cannot keep a per-identity count",
    devFund: "qr4ywpp0q393ur0wpng6rwdlz9n6mp90hgp9d6tx84",
  },
  {
    environment: "Litecoin",
    lock: "utxo-locks CLTV P2SH",
    countsPerIdentity: false,
    reason: "CLTV script cannot keep a per-identity count",
    devFund: "ltc1qrjukwktjcyq84zseq7mkwgg7vd2atkv6gnyagh",
  },
  {
    environment: "Dogecoin",
    lock: "utxo-locks CLTV P2SH",
    countsPerIdentity: false,
    reason: "CLTV script cannot keep a per-identity count",
    devFund: "D8LkDKudBwvFs9Jwg6Hq2RSb63Z7uwkk9h",
  },
  {
    environment: "DigiByte",
    lock: "utxo-locks CLTV P2SH",
    countsPerIdentity: false,
    reason: "CLTV script cannot keep a per-identity count",
    devFund: "dgb1q6wznekwjk5fgtcyqgpj54hsh4g9qg92ccgnm3l",
  },
  {
    environment: "Zcash",
    lock: "utxo-locks CLTV P2SH",
    countsPerIdentity: false,
    reason: "CLTV script cannot keep a per-identity count",
    devFund: "t1SgXBjwm5UShkP2FasQmWfR4DmH1XQVy7H",
  },
  {
    environment: "Solana",
    lock: "vf-solana-vault HandshakeAllowance PDA",
    countsPerIdentity: true,
    reason: "PDA keeps a per-identity handshake count",
    devFund: "Dserz9cjpCDQH9HRsfjU7b7EJxCGoULLNBEQ3PiFgCdi",
  },
  {
    environment: "Stellar",
    lock: "claimable balance predicate",
    countsPerIdentity: false,
    reason: "claimable-balance predicate cannot keep a per-identity count",
    devFund: "GAN5TFL7YMDL6Z7WEDVRTDFTERFA5YASYJYXOTLEVOAKUMRIMZZMAZDL",
  },
  {
    environment: "XRP Ledger",
    lock: "EscrowCreate FinishAfter",
    countsPerIdentity: false,
    reason: "escrow finish cannot keep a per-identity count",
    devFund: "raNwavDEycJ8XtAN71eezNMM6fQbMh1rJt",
  },
];

const rows = MECHANISMS.map((row) => ({
  environment: row.environment,
  lock: row.lock,
  countsPerIdentity: row.countsPerIdentity,
  reason: row.reason,
  devFund: row.devFund,
  handshakeAllowance: handshakeAllowance(row.countsPerIdentity),
}));

module.exports = {
  EVM_DEV_FUND,
  handshakeAllowance,
  rows,
};
