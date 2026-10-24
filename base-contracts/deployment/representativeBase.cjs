/**
 * Representative deployment of the sixteen source environments.
 * Destinations only. This module does not broadcast and does not deploy.
 *
 * Cosmos Hub is not a row. Native ATOM is not a row.
 *
 * Handshake (Revision 12, the same on every environment): 1 hour, $0.01 to
 * $0.02, 5% fee, no allowance limit. No row carries an allowance or a
 * per-identity counting flag.
 */

const EVM_DEV_FUND = "0xFD21BF773A193CDcb9F793100CB13a8baAdc3e9a";

// Revision 12 Handshake rule. allowanceLimit null means any number of
// Handshakes per identity.
const HANDSHAKE_RULE = Object.freeze({
  durationSeconds: 3600,
  usdMin: "0.01",
  usdMax: "0.02",
  feeBps: 500,
  allowanceLimit: null,
  authority: "Revision 12",
});

// The lock mechanism that already exists for each environment.
const MECHANISMS = [
  {
    environment: "Base",
    lock: "CommitmentVaultLock",
    devFund: EVM_DEV_FUND,
  },
  {
    environment: "Ethereum",
    lock: "CommitmentVaultLock",
    devFund: EVM_DEV_FUND,
  },
  {
    environment: "Polygon",
    lock: "CommitmentVaultLock",
    devFund: EVM_DEV_FUND,
  },
  {
    environment: "Optimism",
    lock: "CommitmentVaultLock",
    devFund: EVM_DEV_FUND,
  },
  {
    environment: "Arbitrum",
    lock: "CommitmentVaultLock",
    devFund: EVM_DEV_FUND,
  },
  {
    environment: "BNB Smart Chain",
    lock: "CommitmentVaultLock",
    devFund: EVM_DEV_FUND,
  },
  {
    environment: "Avalanche",
    lock: "CommitmentVaultLock",
    devFund: EVM_DEV_FUND,
  },
  {
    environment: "Bitcoin",
    lock: "utxo-locks CLTV P2SH",
    devFund: "bc1qgf9h8m2fxeu66z9pq7dxgczuz5c4y52pek9jcu",
  },
  {
    environment: "Bitcoin Cash",
    lock: "utxo-locks CLTV P2SH",
    devFund: "qr4ywpp0q393ur0wpng6rwdlz9n6mp90hgp9d6tx84",
  },
  {
    environment: "Litecoin",
    lock: "utxo-locks CLTV P2SH",
    devFund: "ltc1qrjukwktjcyq84zseq7mkwgg7vd2atkv6gnyagh",
  },
  {
    environment: "Dogecoin",
    lock: "utxo-locks CLTV P2SH",
    devFund: "D8LkDKudBwvFs9Jwg6Hq2RSb63Z7uwkk9h",
  },
  {
    environment: "DigiByte",
    lock: "utxo-locks CLTV P2SH",
    devFund: "dgb1q6wznekwjk5fgtcyqgpj54hsh4g9qg92ccgnm3l",
  },
  {
    environment: "Zcash",
    lock: "utxo-locks CLTV P2SH",
    devFund: "t1SgXBjwm5UShkP2FasQmWfR4DmH1XQVy7H",
  },
  {
    environment: "Solana",
    lock: "vf-solana-vault program",
    devFund: "Dserz9cjpCDQH9HRsfjU7b7EJxCGoULLNBEQ3PiFgCdi",
  },
  {
    environment: "Stellar",
    lock: "claimable balance predicate",
    devFund: "GAN5TFL7YMDL6Z7WEDVRTDFTERFA5YASYJYXOTLEVOAKUMRIMZZMAZDL",
  },
  {
    environment: "XRP Ledger",
    lock: "EscrowCreate FinishAfter",
    devFund: "raNwavDEycJ8XtAN71eezNMM6fQbMh1rJt",
  },
];

const rows = MECHANISMS.map((row) => ({
  environment: row.environment,
  lock: row.lock,
  devFund: row.devFund,
}));

module.exports = {
  EVM_DEV_FUND,
  HANDSHAKE_RULE,
  rows,
};
