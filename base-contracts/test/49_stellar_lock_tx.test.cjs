// =============================================================================
// Stellar lock transaction — C.11 operation shape
//
// One transaction, built with the official Stellar SDK and parsed back from
// its XDR. This does not submit the transaction, does not mint, and does not
// treat any ledger as closed. StellarChainVerifier remains fail-closed.
//
// The memo hash is SHA-256 of the existing C.8 Bitcoin nulldata payload
// (test/lib/c8NulldataPayload.cjs). Amounts are the same 5%/95% split as that
// C.8 lock (50_000 / 950_000 of 1_000_000), denominated in stroops.
// =============================================================================

const { expect } = require("chai");
const { ethers } = require("ethers");
const crypto = require("crypto");
const {
  Account,
  Asset,
  Claimant,
  Keypair,
  Memo,
  Networks,
  Operation,
  TransactionBuilder,
} = require("@stellar/stellar-sdk");

const {
  buildNulldataPayload,
  PAYLOAD_LOCK_ID,
  PAYLOAD_RECIPIENT,
  PAYLOAD_ASSET,
  PAYLOAD_VALUATION,
  PAYLOAD_OUTPUT_TOKEN,
} = require("./lib/c8NulldataPayload.cjs");

// Same integers as 15_utxo_verifier.test.cjs (fee 50_000, principal 950_000,
// maturity 1700086400). 50_000 / 1_000_000 is exactly 5%.
const GROSS_STROOPS = 1_000_000n;
const MATURITY = 1700086400;
const FEE_BPS = 500n; // 5.00%
const STROOPS_PER_UNIT = 10_000_000n;

function keypairFromLabel(label) {
  const seed = crypto.createHash("sha256").update(label).digest();
  return Keypair.fromRawEd25519Seed(seed);
}

const SOURCE = keypairFromLabel("vf-stellar-test-source");
const DEV_FUND = keypairFromLabel("vf-stellar-test-dev-fund");
const RELEASE = keypairFromLabel("vf-stellar-test-release");
const OTHER = keypairFromLabel("vf-stellar-test-other-claimant");

function stroopsToAmount(stroops) {
  if (stroops < 0n) throw new Error("negative stroops");
  const whole = stroops / STROOPS_PER_UNIT;
  const frac = (stroops % STROOPS_PER_UNIT).toString().padStart(7, "0");
  return `${whole.toString()}.${frac}`;
}

function amountToStroops(amount) {
  const m = /^(\d+)(?:\.(\d{1,7}))?$/.exec(amount);
  if (!m) throw new Error(`unexpected Stellar amount ${amount}`);
  const frac = (m[2] || "").padEnd(7, "0");
  return BigInt(m[1]) * STROOPS_PER_UNIT + BigInt(frac);
}

function c8PayloadBytes() {
  const hex = buildNulldataPayload();
  const payload = Buffer.from(hex, "hex");
  if (payload.length !== 117) {
    throw new Error(`C.8 payload is ${payload.length} bytes, expected 117`);
  }
  return payload;
}

function assertC8PayloadFacts(payload) {
  expect(payload.length).to.equal(117);
  expect(ethers.hexlify(payload.subarray(0, 32))).to.equal(PAYLOAD_LOCK_ID);
  expect(ethers.getAddress(ethers.hexlify(payload.subarray(32, 52)))).to.equal(
    ethers.getAddress(PAYLOAD_RECIPIENT)
  );
  expect(payload[52]).to.equal(PAYLOAD_OUTPUT_TOKEN);
  expect(ethers.hexlify(payload.subarray(53, 85))).to.equal(PAYLOAD_ASSET);
  expect(ethers.hexlify(payload.subarray(85, 117))).to.equal(PAYLOAD_VALUATION);
}

// memoHash: undefined → SHA-256 of the C.8 payload; null → omit memo.
function buildStellarLockTransaction({
  grossStroops = GROSS_STROOPS,
  maturity = MATURITY,
  feeBps = FEE_BPS,
  release = RELEASE,
  devFund = DEV_FUND,
  extraClaimant = null,
  memoHash = undefined,
  payload = c8PayloadBytes(),
} = {}) {
  const feeStroops = grossStroops * feeBps / 10000n;
  const principalStroops = grossStroops - feeStroops;

  const claimants = [
    new Claimant(
      release.publicKey(),
      Claimant.predicateNot(
        Claimant.predicateBeforeAbsoluteTime(String(maturity))
      )
    ),
  ];
  if (extraClaimant) {
    claimants.push(new Claimant(
      extraClaimant.publicKey(),
      Claimant.predicateNot(
        Claimant.predicateBeforeAbsoluteTime(String(maturity))
      )
    ));
  }

  const account = new Account(SOURCE.publicKey(), "1");
  let builder = new TransactionBuilder(account, {
    fee: "100", // Stellar network fee, not the Dev Fund payment
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(Operation.payment({
      destination: devFund.publicKey(),
      asset: Asset.native(),
      amount: stroopsToAmount(feeStroops),
    }))
    .addOperation(Operation.createClaimableBalance({
      asset: Asset.native(),
      amount: stroopsToAmount(principalStroops),
      claimants,
    }));

  if (memoHash !== null) {
    const hash = memoHash === undefined
      ? crypto.createHash("sha256").update(payload).digest()
      : memoHash;
    builder = builder.addMemo(Memo.hash(hash));
  }

  return builder.setTimeout(0).build();
}

function parseStellarLockTransaction(tx) {
  return TransactionBuilder.fromXDR(tx.toXDR(), Networks.TESTNET);
}

function assertParsedStellarLock(parsed, {
  devFund = DEV_FUND.publicKey(),
  release = RELEASE.publicKey(),
  grossStroops = GROSS_STROOPS,
  maturity = MATURITY,
  payload = c8PayloadBytes(),
} = {}) {
  expect(parsed.operations).to.have.length(2);

  const payment = parsed.operations[0];
  expect(payment.type).to.equal("payment");
  expect(payment.destination).to.equal(devFund);
  expect(payment.asset.isNative()).to.equal(true);
  const feeStroops = amountToStroops(payment.amount);
  expect(feeStroops * 100n).to.equal(grossStroops * 5n);

  const claim = parsed.operations[1];
  expect(claim.type).to.equal("createClaimableBalance");
  expect(claim.asset.isNative()).to.equal(true);
  const principalStroops = amountToStroops(claim.amount);
  expect(principalStroops * 100n).to.equal(grossStroops * 95n);
  expect(feeStroops + principalStroops).to.equal(grossStroops);

  expect(claim.claimants).to.have.length(1);
  const claimant = claim.claimants[0];
  expect(claimant.destination).to.equal(release);
  expect(claimant.predicate.type).to.equal("claimPredicateNot");
  expect(claimant.predicate.notPredicate.type).to.equal(
    "claimPredicateBeforeAbsoluteTime"
  );
  expect(claimant.predicate.notPredicate.absBefore).to.equal(BigInt(maturity));

  const expectedClaimant = new Claimant(
    release,
    Claimant.predicateNot(
      Claimant.predicateBeforeAbsoluteTime(String(maturity))
    )
  );
  expect(claimant.toXdrObject().toXDR("hex")).to.equal(
    expectedClaimant.toXdrObject().toXDR("hex")
  );

  expect(parsed.memo.type).to.equal("hash");
  const expectedHash = crypto.createHash("sha256").update(payload).digest();
  expect(expectedHash.length).to.equal(32);
  expect(Buffer.from(parsed.memo.value).equals(expectedHash)).to.equal(true);
}

describe("Stellar lock transaction — payment, claimable balance, memo hash", function () {
  const payload = c8PayloadBytes();

  it("parses the built transaction and checks the 5% payment, 95% sole claimant, and memo hash", function () {
    assertC8PayloadFacts(payload);

    const tx = buildStellarLockTransaction({ payload });
    const parsed = parseStellarLockTransaction(tx);
    assertParsedStellarLock(parsed, { payload });
  });

  it("fails the assertion on a wrong memo hash", function () {
    const tx = buildStellarLockTransaction({
      payload,
      memoHash: Buffer.alloc(32, 0xab),
    });
    const parsed = parseStellarLockTransaction(tx);
    expect(() => assertParsedStellarLock(parsed, { payload })).to.throw();
  });

  it("fails the assertion when a second claimant is present", function () {
    const tx = buildStellarLockTransaction({ payload, extraClaimant: OTHER });
    const parsed = parseStellarLockTransaction(tx);
    expect(() => assertParsedStellarLock(parsed, { payload })).to.throw();
  });

  it("fails the assertion when the dev-fund payment is not 5%", function () {
    const tx = buildStellarLockTransaction({ payload, feeBps: 250n });
    const parsed = parseStellarLockTransaction(tx);
    expect(() => assertParsedStellarLock(parsed, { payload })).to.throw();
  });

  it("fails the assertion when the memo is missing", function () {
    const tx = buildStellarLockTransaction({ payload, memoHash: null });
    const parsed = parseStellarLockTransaction(tx);
    expect(() => assertParsedStellarLock(parsed, { payload })).to.throw();
  });
});
