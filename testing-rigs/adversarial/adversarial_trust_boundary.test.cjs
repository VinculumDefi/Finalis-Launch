// RIG 9 — Adversarial input and trust-boundary testing.
// Discovery only. Does not fix contracts. Local Hardhat only.
// Default: PASS cases run; FINDING cases are skipped (branch stays green).
// Run findings: cd base-contracts && ADVERSARIAL=1 npx hardhat test \
//   ../testing-rigs/adversarial/adversarial_trust_boundary.test.cjs
// Cite: Rev 6 traceability, Rev 12 Handshake, Rev 13 ITS timing; AG-01..AG-20.
const path = require("path");
const crypto = require("crypto");
const { createRequire } = require("module");
const BC = path.resolve(__dirname, "../../base-contracts");
const req = createRequire(path.join(BC, "package.json"));
const { expect } = req("chai");
const { ethers, network } = req("hardhat");
const { ethLockEvidence, encodeEvidence, encodeBlockHeader, encodeReceipt } = req(path.join(BC, "test/lib/ethProof.cjs"));
const { insert, prove, rootHash, nibblesOf, rlpUint, rlpBytes, rlpList } = req(path.join(BC, "test/lib/receiptTrie.cjs"));
const UTXO = req(path.join(BC, "test/fixtures/utxo_local_locks.json"));
const XLM = req(path.join(BC, "test/fixtures/stellar_local_locks.json"));
const XRP = req(path.join(BC, "test/fixtures/xrpl_local_locks.json"));

const run = process.env.ADVERSARIAL ? it : it.skip;
const pass = it;
const SCALE = 10n ** 18n;
const DAY = 86400n, DAY7 = 7n * DAY;
const ETH_ID = ethers.solidityPackedKeccak256(["string", "string"], ["Ethereum", "native-ETH"]);
const AVAX_ID = ethers.solidityPackedKeccak256(["string", "string"], ["Avalanche", "native-AVAX"]);
const BNB_ID = ethers.solidityPackedKeccak256(["string", "string"], ["BNB Smart Chain", "native-BNB"]);
const POL_ID = ethers.solidityPackedKeccak256(["string", "string"], ["Ethereum", "POL"]);
const BTC_ID = ethers.solidityPackedKeccak256(["string", "string"], ["Bitcoin", "native-BTC"]);
const BCH_ID = ethers.solidityPackedKeccak256(["string", "string"], ["Bitcoin Cash", "native-BCH"]);
const LTC_ID = ethers.solidityPackedKeccak256(["string", "string"], ["Litecoin", "native-LTC"]);
const DOGE_ID = ethers.solidityPackedKeccak256(["string", "string"], ["Dogecoin", "native-DOGE"]);
const DGB_ID = ethers.solidityPackedKeccak256(["string", "string"], ["DigiByte", "native-DGB"]);
const ZEC_ID = ethers.solidityPackedKeccak256(["string", "string"], ["Zcash", "native-ZEC"]);
const XLM_ID = ethers.solidityPackedKeccak256(["string", "string"], ["Stellar", "native-XLM"]);
const XRP_ID = ethers.solidityPackedKeccak256(["string", "string"], ["XRP Ledger", "native-XRP"]);
const coder = ethers.AbiCoder.defaultAbiCoder();
const PRICE = 2392n * SCALE;
const EMPTY_UNCLE = ethers.keccak256("0xc0");
const LOCK_CREATED_TOPIC = ethers.id("LockCreated(bytes32,address,address,address,uint256,uint256,uint256,uint256)");
const EVIDENCE_TYPE =
  "tuple(bytes headerRlp, bytes receipt, uint256 receiptIndex, bytes[] receiptNodes, uint256 logIndex, bytes[] accountNodes, bytes[] envSlotNodes, bytes[] recipientSlotNodes)";
const AVA_EVIDENCE_TYPE =
  "tuple(" + EVIDENCE_TYPE + ", bytes[] createdAtSlotNodes)";
const UTXO_PROOF =
  "tuple(bytes header, bytes coinbaseTx, bytes32[] coinbaseBranch, bytes lockTx, bytes32[] lockBranch, uint256 lockIndex, bytes redeemScript, bytes payload, uint256 durationSecs)";
const XLM_PROOF = "tuple(bytes header, bytes resultSet, bytes txXdr, bytes payload, uint256 durationSecs)";
const XRP_PROOF =
  "tuple(bytes header, bytes paymentTx, bytes paymentMeta, bytes[] paymentInner, bytes escrowTx, bytes escrowMeta, bytes[] escrowInner, bytes payload, uint256 durationSecs)";

function q(v) {
  const n = BigInt(v);
  return n === 0n ? "0x" : ethers.toBeHex(n);
}

function envWord(name) {
  const n = Buffer.byteLength(name);
  return ethers.hexlify(ethers.concat([
    ethers.toUtf8Bytes(name),
    new Uint8Array(32 - n - 1),
    Uint8Array.of(n * 2),
  ]));
}

function slotKey(slot) {
  return ethers.keccak256(ethers.zeroPadValue(ethers.toBeHex(slot), 32));
}

function lockBase(lockId) {
  return BigInt(ethers.keccak256(coder.encode(["bytes32", "uint256"], [lockId, 1])));
}

function encodeStorageValue(v) {
  return ethers.hexlify(rlpUint(v));
}

function storageProof(entries) {
  let root = null;
  for (const [slot, value] of entries) {
    root = insert(root, nibblesOf(ethers.getBytes(slotKey(slot))), ethers.getBytes(encodeStorageValue(value)));
  }
  const proofs = {};
  for (const [slot] of entries) {
    proofs[slot.toString()] = prove(root, nibblesOf(ethers.getBytes(slotKey(slot)))).map((n) => ethers.hexlify(n));
  }
  return { storageRoot: rootHash(root), proofs };
}

function accountLeaf(storageRootHex) {
  // [nonce=1, balance=0, storageRoot, codeHash=nonzero]
  return rlpList([
    rlpUint(1n),
    rlpUint(0n),
    rlpBytes(ethers.getBytes(storageRootHex)),
    rlpBytes(ethers.getBytes(ethers.id("code"))),
  ]);
}

function accountProof(lockAddr, storageRootHex) {
  const key = ethers.keccak256(lockAddr);
  const leaf = accountLeaf(storageRootHex);
  let root = insert(null, nibblesOf(ethers.getBytes(key)), leaf);
  const nodes = prove(root, nibblesOf(ethers.getBytes(key))).map((n) => ethers.hexlify(n));
  return { stateRoot: rootHash(root), accountNodes: nodes };
}

function buildLockReceipt(lockAddr, lockId, recipient, asset, gross, fee, principal, maturity) {
  const data = coder.encode(
    ["address", "uint256", "uint256", "uint256", "uint256"],
    [asset, gross, fee, principal, maturity]
  );
  // topics: signature, lockId, creator, releaseDestination (reader requires 4)
  const topics = [LOCK_CREATED_TOPIC, lockId, ethers.zeroPadValue(recipient, 32), ethers.zeroPadValue(recipient, 32)];
  const body = ethers.encodeRlp([
    q(1),
    q(21000),
    ethers.zeroPadValue("0x", 256),
    [[lockAddr, topics, data]],
  ]);
  return ethers.concat(["0x02", body]); // EIP-1559 type receipt
}

function buildHeader({ stateRoot, receiptsRoot, number, timestamp, shape }) {
  const parent = ethers.hexlify(ethers.randomBytes(32));
  const txRoot = ethers.hexlify(ethers.randomBytes(32));
  const bloom = ethers.zeroPadValue("0x", 256);
  const mix = ethers.hexlify(ethers.randomBytes(32));
  const nonce = "0x0000000000000000";
  const coinbase = ethers.hexlify(ethers.randomBytes(20));
  let difficulty = 0n;
  let extra = "0x";
  let fields;
  if (shape === "ethereum" || shape === "optimism") {
    difficulty = 0n;
    extra = "0x";
    fields = [
      parent, EMPTY_UNCLE, coinbase, stateRoot, txRoot, receiptsRoot, bloom,
      q(difficulty), q(number), q(30_000_000), q(21_000), q(timestamp), extra, mix, nonce,
      q(7), ethers.hexlify(ethers.randomBytes(32)), q(0), q(0), ethers.hexlify(ethers.randomBytes(32)),
    ];
  } else if (shape === "arbitrum") {
    difficulty = 1n;
    extra = ethers.hexlify(ethers.randomBytes(32)); // sendRoot
    fields = [
      parent, EMPTY_UNCLE, coinbase, stateRoot, txRoot, receiptsRoot, bloom,
      q(difficulty), q(number), q(30_000_000), q(21_000), q(timestamp), extra, mix, nonce, q(7),
    ];
  } else if (shape === "bnb" || shape === "polygon") {
    difficulty = shape === "bnb" ? 1n : 1n;
    extra = ethers.hexlify(ethers.randomBytes(97));
    fields = [
      parent, EMPTY_UNCLE, coinbase, stateRoot, txRoot, receiptsRoot, bloom,
      q(difficulty), q(number), q(30_000_000), q(21_000), q(timestamp), extra, mix, nonce,
      q(7), ethers.hexlify(ethers.randomBytes(32)), q(0), q(0), ethers.hexlify(ethers.randomBytes(32)),
    ];
  } else if (shape === "avalanche") {
    difficulty = 1n;
    extra = "0x";
    const extDataHash = ethers.hexlify(ethers.randomBytes(32));
    fields = [
      parent, EMPTY_UNCLE, coinbase, stateRoot, txRoot, receiptsRoot, bloom,
      q(difficulty), q(number), q(30_000_000), q(21_000), q(timestamp), extra, mix, nonce, extDataHash,
    ];
  } else {
    throw new Error("unknown shape " + shape);
  }
  return ethers.encodeRlp(fields);
}

function fabricateEvmEvidence({
  lockAddr, envName, shape, lockId, recipient, gross, fee, principal, duration,
  createdAt, outputToken = 0, asset = ethers.ZeroAddress, createdAtSlot = false,
}) {
  const maturity = createdAt + duration;
  const receipt = buildLockReceipt(lockAddr, lockId, recipient, asset, gross, fee, principal, maturity);
  let rRoot = insert(null, nibblesOf(rlpUint(0)), ethers.getBytes(receipt));
  const receiptsRoot = rootHash(rRoot);
  const receiptNodes = prove(rRoot, nibblesOf(rlpUint(0))).map((n) => ethers.hexlify(n));

  const base = lockBase(lockId);
  const recipientWord = BigInt(recipient) | (BigInt(outputToken) << 160n);
  const entries = [
    [0n, BigInt(envWord(envName))],
    [base + 3n, recipientWord],
  ];
  if (createdAtSlot) entries.push([base + 9n, BigInt(createdAt)]);
  const { storageRoot, proofs } = storageProof(entries);
  const { stateRoot, accountNodes } = accountProof(lockAddr, storageRoot);

  const headerRlp = buildHeader({
    stateRoot, receiptsRoot, number: 12_345_678n, timestamp: createdAt, shape,
  });
  const blockHash = ethers.keccak256(headerRlp);
  const baseEv = {
    headerRlp,
    receipt,
    receiptIndex: 0,
    receiptNodes,
    logIndex: 0,
    accountNodes,
    envSlotNodes: proofs["0"],
    recipientSlotNodes: proofs[(base + 3n).toString()],
  };
  if (createdAtSlot) {
    return {
      evidence: coder.encode([AVA_EVIDENCE_TYPE], [[
        [
          baseEv.headerRlp, baseEv.receipt, baseEv.receiptIndex, baseEv.receiptNodes,
          baseEv.logIndex, baseEv.accountNodes, baseEv.envSlotNodes, baseEv.recipientSlotNodes,
        ],
        proofs[(base + 9n).toString()],
      ]]),
      blockHash,
      number: 12_345_678n,
      createdAt,
      maturity,
    };
  }
  return {
    evidence: coder.encode([EVIDENCE_TYPE], [[
      baseEv.headerRlp, baseEv.receipt, baseEv.receiptIndex, baseEv.receiptNodes,
      baseEv.logIndex, baseEv.accountNodes, baseEv.envSlotNodes, baseEv.recipientSlotNodes,
    ]]),
    blockHash,
    number: 12_345_678n,
    createdAt,
    maturity,
  };
}

async function deploySystem(opts = {}) {
  const [deployer, recipient, other, dest, devFund, stranger, poster] = await ethers.getSigners();
  const T = await ethers.getContractFactory("VinculumFinalisToken");
  const vclm = await T.deploy("Vinculum", "VCLM", 10_000_000_000n * SCALE);
  const chonx = await T.deploy("Chonx", "CHONX", 100_000_000_000n * SCALE);
  const verifier = await (await ethers.getContractFactory("VinculumFinalisVerifier")).deploy(
    await vclm.getAddress(), await chonx.getAddress());
  const stake = await (await ethers.getContractFactory("VinculumFinalisStake")).deploy(
    await vclm.getAddress(), await chonx.getAddress(), await vclm.getAddress(), await verifier.getAddress());
  await vclm.initialize(await verifier.getAddress(), await stake.getAddress());
  await chonx.initialize(await verifier.getAddress(), ethers.ZeroAddress);

  const baseLock = await (await ethers.getContractFactory("BaseCommitmentVaultLock")).deploy(
    "Base", devFund.address, await vclm.getAddress(), await chonx.getAddress(), await vclm.getAddress());
  const baseReader = await (await ethers.getContractFactory("BaseLockRecordVerifier")).deploy(await baseLock.getAddress());
  await verifier.registerChainVerifier("Base", await baseReader.getAddress());
  await verifier.registerAssetPrecision("Base", ETH_ID, "ETH", 18, 2, 0);
  await verifier.configureDevFund("Base", devFund.address);

  const ethLock = await (await ethers.getContractFactory("CommitmentVaultLock")).deploy("Ethereum", devFund.address);
  const ethReader = await (await ethers.getContractFactory("SimpleEthereumLockReader")).deploy(await ethLock.getAddress());
  await verifier.registerChainVerifier("Ethereum", await ethReader.getAddress());
  await verifier.registerAssetPrecision("Ethereum", ETH_ID, "ETH", 18, 2, 0);
  await verifier.configureDevFund("Ethereum", devFund.address);

  // Optional extra EVM readers (each with its own lock contract address).
  const extra = {};
  const readerSpecs = opts.readers || [];
  for (const spec of readerSpecs) {
    const lock = await (await ethers.getContractFactory("CommitmentVaultLock")).deploy(spec.env, devFund.address);
    const reader = await (await ethers.getContractFactory(spec.contract)).deploy(await lock.getAddress());
    await verifier.registerChainVerifier(spec.env, await reader.getAddress());
    if (spec.aliasTo) {
      // Alias to an existing row (e.g. Arbitrum ETH -> Ethereum ETH). Do not also register a local row.
      await verifier.registerAssetRowAlias(spec.env, spec.assetId, spec.aliasTo);
    } else {
      await verifier.registerAssetPrecision(spec.env, spec.assetId, spec.symbol, spec.decimals, 2, 0);
    }
    await verifier.configureDevFund(spec.env, devFund.address);
    extra[spec.env] = { lock, reader, assetId: spec.assetId, chainId: spec.chainId, shape: spec.shape };
  }

  // Optional UTXO / Stellar / XRPL readers.
  const utxo = {};
  for (const name of opts.utxo || []) {
    const S = UTXO.chains[name].standard;
    const contract = {
      Bitcoin: "BitcoinLockReader",
      "Bitcoin Cash": "BitcoinCashLockReader",
      Litecoin: "LitecoinLockReader",
      Dogecoin: "DogecoinLockReader",
      DigiByte: "DigiByteLockReader",
      Zcash: "ZcashLockReader",
    }[name];
    const assetId = { Bitcoin: BTC_ID, "Bitcoin Cash": BCH_ID, Litecoin: LTC_ID, Dogecoin: DOGE_ID, DigiByte: DGB_ID, Zcash: ZEC_ID }[name];
    const reader = await (await ethers.getContractFactory(contract)).deploy(S.devFundScript);
    await verifier.registerChainVerifier(name, await reader.getAddress());
    await verifier.registerAssetPrecision(name, assetId, name.slice(0, 4).toUpperCase(), 8, 1, 0);
    await verifier.configureDevFund(name, devFund.address);
    utxo[name] = { reader, assetId, fixture: S };
  }
  if (opts.stellar) {
    const reader = await (await ethers.getContractFactory("StellarLockReader")).deploy(XLM.networkId, XLM.devFund);
    await verifier.registerChainVerifier("Stellar", await reader.getAddress());
    await verifier.registerAssetPrecision("Stellar", XLM_ID, "XLM", 7, 1, 0);
    await verifier.configureDevFund("Stellar", devFund.address);
    extra.Stellar = { reader, assetId: XLM_ID };
  }
  if (opts.xrpl) {
    const reader = await (await ethers.getContractFactory("XrplLockReader")).deploy(XRP.devFundAccountId);
    await verifier.registerChainVerifier("XRP Ledger", await reader.getAddress());
    await verifier.registerAssetPrecision("XRP Ledger", XRP_ID, "XRP", 6, 1, 0);
    await verifier.configureDevFund("XRP Ledger", devFund.address);
    extra["XRP Ledger"] = { reader, assetId: XRP_ID };
  }

  await verifier.setScheduledPricePoster(poster.address);
  const priceUpdates = [
    { environmentId: "Base", canonicalAssetId: ETH_ID, priceUsd18: PRICE, success: true },
    { environmentId: "Ethereum", canonicalAssetId: ETH_ID, priceUsd18: PRICE, success: true },
  ];
  for (const spec of readerSpecs) {
    if (!spec.aliasTo) {
      priceUpdates.push({ environmentId: spec.env, canonicalAssetId: spec.assetId, priceUsd18: PRICE, success: true });
    }
  }
  for (const name of Object.keys(utxo)) {
    priceUpdates.push({ environmentId: name, canonicalAssetId: utxo[name].assetId, priceUsd18: PRICE, success: true });
  }
  if (opts.stellar) priceUpdates.push({ environmentId: "Stellar", canonicalAssetId: XLM_ID, priceUsd18: PRICE, success: true });
  if (opts.xrpl) priceUpdates.push({ environmentId: "XRP Ledger", canonicalAssetId: XRP_ID, priceUsd18: PRICE, success: true });
  await verifier.connect(poster).applyScheduledPriceRun(1n, priceUpdates);
  await verifier.finalize();
  return {
    deployer, recipient, other, dest, devFund, stranger, poster,
    vclm, chonx, verifier, stake, baseLock, ethLock, ethReader, extra, utxo,
  };
}

async function baseLockPkg(c, { valueWei = SCALE / 100n, duration = DAY7, recipient } = {}) {
  const lockId = ethers.hexlify(ethers.randomBytes(32));
  const r = recipient || c.recipient.address;
  await c.baseLock.connect(c.other).createNativeLock(
    lockId, r, 0, ETH_ID, ethers.ZeroHash, c.dest.address, duration,
    (valueWei * PRICE) / SCALE, { value: valueWei });
  const rec = await c.baseLock.lockRecord(lockId);
  return {
    sourceEnvironmentId: "Base", commitmentVaultLockId: lockId, handshakeAllowanceCount: 3,
    canonicalAssetId: ETH_ID, assetPrecision: 18, assetCustodyClass: 2,
    grossAmountSmallestUnits: rec.gross, actualFeeAmountSmallestUnits: rec.fee,
    principalAmountSmallestUnits: rec.principal, feeAssetId: ETH_ID, devFundDestination: "dev",
    feeTransferEvidence: ethers.id("fee"), valuationTimestamp: rec.createdAt, maturityTimestamp: rec.maturity,
    durationSecs: rec.duration, selectedOutputToken: 0, baseRecipient: r,
    releaseDestination: "release", chonxActivationReceipt: "0x",
    racIdentity: ethers.hexlify(ethers.randomBytes(32)), priceRecord: "0x",
    sourceFinalityProof: "0x",
    lockEventProof: coder.encode(["bytes32", "uint256", "uint256", "uint256", "uint256", "uint256", "uint256"],
      [lockId, rec.gross, rec.fee, rec.principal, rec.duration, rec.createdAt, rec.maturity]),
  };
}

function forgedPkg(env, chainId, lockId, recipient, amounts, evidence, assetId, allowance = 3) {
  return {
    sourceEnvironmentId: env, commitmentVaultLockId: lockId, handshakeAllowanceCount: allowance,
    canonicalAssetId: assetId, assetPrecision: 18, assetCustodyClass: 2,
    grossAmountSmallestUnits: amounts.gross, actualFeeAmountSmallestUnits: amounts.fee,
    principalAmountSmallestUnits: amounts.principal, feeAssetId: assetId, devFundDestination: "dev",
    feeTransferEvidence: ethers.id("fee"), valuationTimestamp: amounts.createdAt, maturityTimestamp: amounts.maturity,
    durationSecs: amounts.duration, selectedOutputToken: 0, baseRecipient: recipient,
    releaseDestination: "release", chonxActivationReceipt: "0x",
    racIdentity: ethers.hexlify(ethers.randomBytes(32)), priceRecord: "0x",
    sourceFinalityProof: coder.encode(["uint256", "bytes32", "uint256"], [chainId, evidence.blockHash, evidence.number]),
    lockEventProof: evidence.evidence,
  };
}

function rlpReplace(rlpHex, index, valueHex) {
  const items = ethers.decodeRlp(rlpHex);
  items[index] = valueHex;
  return ethers.encodeRlp(items);
}

function dsha(hex) {
  return crypto.createHash("sha256").update(crypto.createHash("sha256").update(Buffer.from(hex.slice(2), "hex")).digest()).digest();
}

describe("RIG 9 adversarial trust-boundary (FINDING cases need ADVERSARIAL=1)", function () {
  this.timeout(600000);

  // ---------- PASS: Base path rejects fabricated / mismatched inputs ----------

  pass("PASS ADV-P01: Base rejects a lockId that was never created (no unauthorized mint)", async () => {
    const c = await deploySystem();
    const fakeId = ethers.hexlify(ethers.randomBytes(32));
    const p = {
      sourceEnvironmentId: "Base", commitmentVaultLockId: fakeId, handshakeAllowanceCount: 3,
      canonicalAssetId: ETH_ID, assetPrecision: 18, assetCustodyClass: 2,
      grossAmountSmallestUnits: SCALE / 100n, actualFeeAmountSmallestUnits: SCALE / 2000n,
      principalAmountSmallestUnits: (SCALE / 100n) - (SCALE / 2000n), feeAssetId: ETH_ID, devFundDestination: "dev",
      feeTransferEvidence: ethers.id("fee"), valuationTimestamp: (await ethers.provider.getBlock("latest")).timestamp,
      maturityTimestamp: 0, durationSecs: DAY7, selectedOutputToken: 0, baseRecipient: c.recipient.address,
      releaseDestination: "release", chonxActivationReceipt: "0x",
      racIdentity: ethers.hexlify(ethers.randomBytes(32)), priceRecord: "0x",
      sourceFinalityProof: "0x",
      lockEventProof: coder.encode(["bytes32", "uint256", "uint256", "uint256", "uint256", "uint256", "uint256"],
        [fakeId, SCALE / 100n, SCALE / 2000n, (SCALE / 100n) - (SCALE / 2000n), DAY7, 0, 0]),
    };
    await expect(c.verifier.recordFeeAndRac(p)).to.be.reverted;
    expect(await c.vclm.balanceOf(c.recipient.address)).to.equal(0n);
  });

  pass("PASS ADV-P02: Base rejects package recipient that does not match the lock record (VF-XCH-011)", async () => {
    const c = await deploySystem();
    const p = await baseLockPkg(c);
    const bad = { ...p, baseRecipient: c.stranger.address };
    await expect(c.verifier.recordFeeAndRac(bad)).to.be.revertedWith("VF-XCH-011: recipient mismatch");
  });

  pass("PASS ADV-P03: Base rejects wrong lockId in proof vs package (VF-XCH-011)", async () => {
    const c = await deploySystem();
    const p = await baseLockPkg(c);
    const otherId = ethers.hexlify(ethers.randomBytes(32));
    const bad = {
      ...p,
      commitmentVaultLockId: otherId,
      lockEventProof: coder.encode(["bytes32", "uint256", "uint256", "uint256", "uint256", "uint256", "uint256"],
        [otherId, p.grossAmountSmallestUnits, p.actualFeeAmountSmallestUnits, p.principalAmountSmallestUnits,
          p.durationSecs, p.valuationTimestamp, p.maturityTimestamp]),
    };
    await expect(c.verifier.recordFeeAndRac(bad)).to.be.reverted;
  });

  pass("PASS ADV-P04: ticker 'USDC' cannot substitute for a registered Base token address", async () => {
    const c = await deploySystem();
    const p = await baseLockPkg(c);
    // Symbol-only package: claim canonicalAssetId derived from the string "USDC" alone.
    const fake = ethers.id("USDC");
    const bad = { ...p, canonicalAssetId: fake };
    await expect(c.verifier.recordFeeAndRac(bad)).to.be.reverted; // registry or asset mismatch
  });

  pass("PASS ADV-P05: Base mint replay of the same lockId is refused (VF-XCH-013)", async () => {
    const c = await deploySystem();
    const p = await baseLockPkg(c);
    await c.verifier.recordFeeAndRac(p);
    await c.verifier.verifyAndMint(p, 0);
    await expect(c.verifier.verifyAndMint(p, 0)).to.be.revertedWith("VF-XCH-013: replay");
  });

  pass("PASS ADV-P06: real Arbitrum-shaped env string cannot use Ethereum reader (env slot check)", async () => {
    // Deploy Ethereum + Arbitrum. Create a real lock on the Arbitrum lock contract
    // (local hardhat). Submit it as sourceEnvironmentId Ethereum with Ethereum
    // reader evidence shape. Env slot on the Arbitrum lock says "Arbitrum", so
    // the Ethereum reader must reject.
    const c = await deploySystem({
      readers: [{ env: "Arbitrum", contract: "ArbitrumLockReader", assetId: ETH_ID, symbol: "ETH", decimals: 18, chainId: 42161, shape: "arbitrum", aliasTo: "Ethereum" }],
    });
    const lockId = ethers.hexlify(ethers.randomBytes(32));
    const arb = c.extra.Arbitrum;
    const rc = await (await arb.lock.connect(c.other).createNativeLock(
      lockId, c.recipient.address, 0, ETH_ID, ethers.ZeroHash, c.dest.address, DAY7, PRICE / 100n,
      { value: SCALE / 100n })).wait();
    // Build REAL hardhat evidence against the Arbitrum lock address, then feed
    // it to the Ethereum reader via sourceEnvironmentId "Ethereum".
    const ev = await ethLockEvidence(await arb.lock.getAddress(), rc.hash, lockId);
    // Ethereum header shape needs difficulty 0 and >=20 fields; hardhat may
    // already produce that. The env slot on arb.lock is "Arbitrum", so the
    // Ethereum reader (expects "Ethereum") must fail on VF-XCH-011: environment.
    const rec = await arb.lock.lockRecord(lockId);
    const p = {
      sourceEnvironmentId: "Ethereum", commitmentVaultLockId: lockId, handshakeAllowanceCount: 3,
      canonicalAssetId: ETH_ID, assetPrecision: 18, assetCustodyClass: 2,
      grossAmountSmallestUnits: rec.gross, actualFeeAmountSmallestUnits: rec.fee,
      principalAmountSmallestUnits: rec.principal, feeAssetId: ETH_ID, devFundDestination: "dev",
      feeTransferEvidence: ethers.id("fee"), valuationTimestamp: rec.createdAt, maturityTimestamp: rec.maturity,
      durationSecs: rec.duration, selectedOutputToken: 0, baseRecipient: c.recipient.address,
      releaseDestination: "release", chonxActivationReceipt: "0x",
      racIdentity: ethers.hexlify(ethers.randomBytes(32)), priceRecord: "0x",
      sourceFinalityProof: coder.encode(["uint256", "bytes32", "uint256"], [1, ev.block.hash, ev.block.number]),
      lockEventProof: encodeEvidence(ev),
    };
    await expect(c.verifier.recordFeeAndRac(p)).to.be.reverted; // env or header shape or lock address
  });

  pass("PASS ADV-P07: same address bytes on Base vs a non-indexed token cannot mint as ETH", async () => {
    const c = await deploySystem();
    // Deploy a fixture ERC20 and try to lock it on Base without indexing the address.
    const token = await (await ethers.getContractFactory("TestFixtureERC20")).deploy(0);
    await token.mint(c.other.address, SCALE);
    await token.connect(c.other).approve(await c.baseLock.getAddress(), SCALE);
    const lockId = ethers.hexlify(ethers.randomBytes(32));
    // createErc20Lock will succeed on the lock; Verifier must refuse because
    // extractAssetId returns keccak("Base", token) which is not indexed and
    // is not ETH_ID.
    await c.baseLock.connect(c.other).createErc20Lock(
      lockId, c.recipient.address, 0, ethers.ZeroHash, ethers.ZeroHash, c.dest.address,
      DAY7, await token.getAddress(), SCALE / 100n, PRICE / 100n);
    const rec = await c.baseLock.lockRecord(lockId);
    const p = {
      sourceEnvironmentId: "Base", commitmentVaultLockId: lockId, handshakeAllowanceCount: 3,
      canonicalAssetId: ETH_ID, assetPrecision: 18, assetCustodyClass: 2,
      grossAmountSmallestUnits: rec.gross, actualFeeAmountSmallestUnits: rec.fee,
      principalAmountSmallestUnits: rec.principal, feeAssetId: ETH_ID, devFundDestination: "dev",
      feeTransferEvidence: ethers.id("fee"), valuationTimestamp: rec.createdAt, maturityTimestamp: rec.maturity,
      durationSecs: rec.duration, selectedOutputToken: 0, baseRecipient: c.recipient.address,
      releaseDestination: "release", chonxActivationReceipt: "0x",
      racIdentity: ethers.hexlify(ethers.randomBytes(32)), priceRecord: "0x",
      sourceFinalityProof: "0x",
      lockEventProof: coder.encode(["bytes32", "uint256", "uint256", "uint256", "uint256", "uint256", "uint256"],
        [lockId, rec.gross, rec.fee, rec.principal, rec.duration, rec.createdAt, rec.maturity]),
    };
    await expect(c.verifier.recordFeeAndRac(p)).to.be.revertedWith("VF-XCH-011: asset mismatch");
  });

  // ---------- FINDING: fabricated EVM headers / MPT state (AG-01 class) ----------

  async function mintFromFabricatedEvm(spec) {
    const c = await deploySystem({
      readers: [spec],
    });
    const lockAddr = await c.extra[spec.env].lock.getAddress();
    const lockId = ethers.hexlify(ethers.randomBytes(32));
    const gross = SCALE / 100n; // 0.01 native
    const fee = (gross * 500n) / 10000n;
    const principal = gross - fee;
    const createdAt = BigInt((await ethers.provider.getBlock("latest")).timestamp);
    const ev = fabricateEvmEvidence({
      lockAddr, envName: spec.env, shape: spec.shape, lockId,
      recipient: c.recipient.address, gross, fee, principal, duration: DAY7,
      createdAt, outputToken: 0, createdAtSlot: spec.shape === "avalanche",
    });
    // Confirm the forged block hash is not on this chain.
    const onChain = await ethers.provider.send("eth_getBlockByHash", [ev.blockHash, false]);
    expect(onChain).to.equal(null);
    const p = forgedPkg(spec.env, spec.chainId, lockId, c.recipient.address, {
      gross, fee, principal, duration: DAY7, createdAt, maturity: createdAt + DAY7,
    }, ev, spec.assetId, 3);
    await c.verifier.recordFeeAndRac(p);
    await c.verifier.verifyAndMint(p, 0);
    const minted = await c.vclm.balanceOf(c.recipient.address);
    expect(minted).to.be.gt(0n);
    return { minted, blockHash: ev.blockHash, env: spec.env };
  }

  run("FINDING ADV-01: Ethereum fabricated MPT unauthorized mint (no chain anchor) [AG-01, VF-XCH-006]", async () => {
    const c = await deploySystem();
    const lockAddr = await c.ethLock.getAddress();
    const lockId = ethers.hexlify(ethers.randomBytes(32));
    const gross = SCALE / 100n;
    const fee = (gross * 500n) / 10000n;
    const principal = gross - fee;
    const createdAt = BigInt((await ethers.provider.getBlock("latest")).timestamp);
    const ev = fabricateEvmEvidence({
      lockAddr, envName: "Ethereum", shape: "ethereum", lockId,
      recipient: c.recipient.address, gross, fee, principal, duration: DAY7, createdAt,
    });
    expect(await ethers.provider.send("eth_getBlockByHash", [ev.blockHash, false])).to.equal(null);
    const p = forgedPkg("Ethereum", 1, lockId, c.recipient.address, {
      gross, fee, principal, duration: DAY7, createdAt, maturity: createdAt + DAY7,
    }, ev, ETH_ID);
    await c.verifier.recordFeeAndRac(p);
    await c.verifier.verifyAndMint(p, 0);
    const minted = await c.vclm.balanceOf(c.recipient.address);
    expect(minted).to.be.gt(0n);
    console.log(`      ADV-01 Ethereum fabricated trie minted ${ethers.formatEther(minted)} VCLM`);
  });

  run("FINDING ADV-02: Arbitrum reader mints from fabricated trie [AG-01, cross-chain]", async () => {
    const r = await mintFromFabricatedEvm({
      env: "Arbitrum", contract: "ArbitrumLockReader", assetId: ETH_ID, symbol: "ETH",
      decimals: 18, chainId: 42161, shape: "arbitrum", aliasTo: "Ethereum",
    });
    console.log(`      ADV-02 ${r.env} minted ${ethers.formatEther(r.minted)} VCLM`);
  });

  run("FINDING ADV-03: Optimism reader mints from fabricated trie [AG-01]", async () => {
    const r = await mintFromFabricatedEvm({
      env: "Optimism", contract: "OptimismLockReader", assetId: ETH_ID, symbol: "ETH",
      decimals: 18, chainId: 10, shape: "optimism", aliasTo: "Ethereum",
    });
    console.log(`      ADV-03 ${r.env} minted ${ethers.formatEther(r.minted)} VCLM`);
  });

  run("FINDING ADV-04: Polygon reader mints from fabricated trie [AG-01]", async () => {
    const r = await mintFromFabricatedEvm({
      env: "Polygon", contract: "PolygonLockReader", assetId: POL_ID, symbol: "POL",
      decimals: 18, chainId: 137, shape: "polygon",
    });
    console.log(`      ADV-04 ${r.env} minted ${ethers.formatEther(r.minted)} VCLM`);
  });

  run("FINDING ADV-05: BNB Smart Chain reader mints from fabricated trie [AG-01]", async () => {
    const r = await mintFromFabricatedEvm({
      env: "BNB Smart Chain", contract: "BnbSmartChainLockReader", assetId: BNB_ID, symbol: "BNB",
      decimals: 18, chainId: 56, shape: "bnb",
    });
    console.log(`      ADV-05 ${r.env} minted ${ethers.formatEther(r.minted)} VCLM`);
  });

  run("FINDING ADV-06: Avalanche reader mints from fabricated trie (incl. createdAt slot) [AG-01]", async () => {
    const r = await mintFromFabricatedEvm({
      env: "Avalanche", contract: "AvalancheLockReader", assetId: AVAX_ID, symbol: "AVAX",
      decimals: 18, chainId: 43114, shape: "avalanche",
    });
    console.log(`      ADV-06 ${r.env} minted ${ethers.formatEther(r.minted)} VCLM`);
  });

  // ---------- FINDING: UTXO / Stellar / XRPL forged headers (AG-02/03) ----------

  run("FINDING ADV-07: Bitcoin reader accepts header with no PoW and records unauthorized RAC [AG-02]", async () => {
    const c = await deploySystem({ utxo: ["Bitcoin"] });
    const S = c.utxo.Bitcoin.fixture;
    const b = Buffer.from(S.header.slice(2), "hex");
    crypto.randomBytes(32).copy(b, 4);
    b.writeUInt32LE(0x1d00ffff, 72);
    b.writeUInt32LE(0x12345678, 76);
    const forged = "0x" + b.toString("hex");
    const digest = dsha(forged);
    const be = "0x" + digest.toString("hex");
    const le = "0x" + Buffer.from(digest).reverse().toString("hex");
    const forgedHash = (le.toLowerCase() === S.blockHash.toLowerCase() ||
      be.toLowerCase() === S.blockHash.toLowerCase())
      ? (await (async () => { throw new Error("forged hash collided with real"); })())
      : (() => {
          const origBe = "0x" + dsha(S.header).toString("hex");
          const origLe = "0x" + Buffer.from(dsha(S.header)).reverse().toString("hex");
          const useLe = origLe.toLowerCase() === S.blockHash.toLowerCase();
          return useLe ? le : be;
        })();
    const proof = coder.encode([UTXO_PROOF], [[
      forged, S.coinbaseTx, S.coinbaseBranch, S.lockTx, S.lockBranch, S.lockIndex,
      S.redeemScript, S.payload, S.durationSecs,
    ]]);
    const [ok] = await c.utxo.Bitcoin.reader.verifyFinality(
      proof, coder.encode(["bytes32", "uint256"], [forgedHash, S.height]));
    expect(ok).to.equal(true);
    // RAC path: fixture outputToken=1 (CHONX). recordFeeAndRac still runs.
    // Use recipient from payload.
    const recipient = S.baseRecipient;
    const p = {
      sourceEnvironmentId: "Bitcoin", commitmentVaultLockId: S.lockId, handshakeAllowanceCount: 1,
      canonicalAssetId: BTC_ID, assetPrecision: 8, assetCustodyClass: 1,
      grossAmountSmallestUnits: BigInt(S.fee + S.principal),
      actualFeeAmountSmallestUnits: BigInt(S.fee),
      principalAmountSmallestUnits: BigInt(S.principal),
      feeAssetId: BTC_ID, devFundDestination: "dev",
      feeTransferEvidence: ethers.id("fee"), valuationTimestamp: BigInt(S.time),
      maturityTimestamp: BigInt(S.time) + BigInt(S.durationSecs),
      durationSecs: BigInt(S.durationSecs), selectedOutputToken: S.outputToken,
      baseRecipient: recipient, releaseDestination: "release", chonxActivationReceipt: "0x",
      racIdentity: ethers.hexlify(ethers.randomBytes(32)), priceRecord: "0x",
      sourceFinalityProof: coder.encode(["bytes32", "uint256"], [forgedHash, S.height]),
      lockEventProof: proof,
    };
    await c.verifier.recordFeeAndRac(p);
    expect(await c.verifier.recordedRacs(p.racIdentity)).to.equal(true);
    console.log(`      ADV-07 Bitcoin forged header accepted; unauthorized RAC recorded for lock ${S.lockId.slice(0, 10)}...`);
  });

  run("FINDING ADV-08: Stellar reader accepts ledger with arbitrary previous hash; unauthorized RAC [AG-03]", async () => {
    const c = await deploySystem({ stellar: true });
    const L = XLM.week;
    const b = Buffer.from(L.header.slice(2), "hex");
    crypto.randomBytes(32).copy(b, 4);
    const forged = "0x" + b.toString("hex");
    const forgedHash = "0x" + crypto.createHash("sha256").update(b).digest("hex");
    const proof = coder.encode([XLM_PROOF], [{
      header: forged, resultSet: L.resultSet, txXdr: L.tx, payload: L.payload, durationSecs: L.durationSecs,
    }]);
    const [ok] = await c.extra.Stellar.reader.verifyFinality(
      proof, coder.encode(["bytes32", "uint256"], [forgedHash, L.ledgerSeq]));
    expect(ok).to.equal(true);
    // payload: lockId 32 | recipient 20 | outputToken 1 | ...
    const pl = Buffer.from(L.payload.slice(2), "hex");
    const lockId = "0x" + pl.subarray(0, 32).toString("hex");
    const recipient = ethers.getAddress("0x" + pl.subarray(32, 52).toString("hex"));
    const outputToken = pl[52];
    const p = {
      sourceEnvironmentId: "Stellar", commitmentVaultLockId: lockId, handshakeAllowanceCount: 1,
      canonicalAssetId: XLM_ID, assetPrecision: 7, assetCustodyClass: 1,
      grossAmountSmallestUnits: BigInt(L.gross), actualFeeAmountSmallestUnits: BigInt(L.fee),
      principalAmountSmallestUnits: BigInt(L.principal), feeAssetId: XLM_ID, devFundDestination: "dev",
      feeTransferEvidence: ethers.id("fee"), valuationTimestamp: BigInt(L.closeTime),
      maturityTimestamp: BigInt(L.maturity), durationSecs: BigInt(L.durationSecs),
      selectedOutputToken: outputToken, baseRecipient: recipient,
      releaseDestination: "release", chonxActivationReceipt: "0x",
      racIdentity: ethers.hexlify(ethers.randomBytes(32)), priceRecord: "0x",
      sourceFinalityProof: coder.encode(["bytes32", "uint256"], [forgedHash, L.ledgerSeq]),
      lockEventProof: proof,
    };
    await c.verifier.recordFeeAndRac(p);
    expect(await c.verifier.recordedRacs(p.racIdentity)).to.equal(true);
    console.log(`      ADV-08 Stellar forged ledger accepted; unauthorized RAC recorded`);
  });

  run("FINDING ADV-09: XRPL reader accepts ledger with arbitrary parent; unauthorized RAC [AG-03]", async () => {
    const c = await deploySystem({ xrpl: true });
    const L = XRP.week;
    const b = Buffer.from(L.header.slice(2), "hex");
    crypto.randomBytes(32).copy(b, 12);
    const forged = "0x" + b.toString("hex");
    const forgedHash = "0x" + crypto.createHash("sha512")
      .update(Buffer.concat([Buffer.from("4c575200", "hex"), b])).digest().subarray(0, 32).toString("hex");
    const proof = coder.encode([XRP_PROOF], [{
      header: forged, paymentTx: L.payment.tx, paymentMeta: L.payment.meta, paymentInner: L.payment.inner,
      escrowTx: L.escrow.tx, escrowMeta: L.escrow.meta, escrowInner: L.escrow.inner,
      payload: L.payload, durationSecs: L.durationSecs,
    }]);
    const [ok] = await c.extra["XRP Ledger"].reader.verifyFinality(
      proof, coder.encode(["bytes32", "uint256"], [forgedHash, L.ledgerIndex]));
    expect(ok).to.equal(true);
    const pl = Buffer.from(L.payload.slice(2), "hex");
    const lockId = "0x" + pl.subarray(0, 32).toString("hex");
    const recipient = ethers.getAddress("0x" + pl.subarray(32, 52).toString("hex"));
    const outputToken = pl[52];
    const p = {
      sourceEnvironmentId: "XRP Ledger", commitmentVaultLockId: lockId, handshakeAllowanceCount: 1,
      canonicalAssetId: XRP_ID, assetPrecision: 6, assetCustodyClass: 1,
      grossAmountSmallestUnits: BigInt(L.gross), actualFeeAmountSmallestUnits: BigInt(L.fee),
      principalAmountSmallestUnits: BigInt(L.principal), feeAssetId: XRP_ID, devFundDestination: "dev",
      feeTransferEvidence: ethers.id("fee"), valuationTimestamp: BigInt(L.closeTime),
      maturityTimestamp: BigInt(L.finishAfter), durationSecs: BigInt(L.durationSecs),
      selectedOutputToken: outputToken, baseRecipient: recipient,
      releaseDestination: "release", chonxActivationReceipt: "0x",
      racIdentity: ethers.hexlify(ethers.randomBytes(32)), priceRecord: "0x",
      sourceFinalityProof: coder.encode(["bytes32", "uint256"], [forgedHash, L.ledgerIndex]),
      lockEventProof: proof,
    };
    await c.verifier.recordFeeAndRac(p);
    expect(await c.verifier.recordedRacs(p.racIdentity)).to.equal(true);
    console.log(`      ADV-09 XRPL forged ledger accepted; unauthorized RAC recorded`);
  });

  // ---------- FINDING: genuine header / wrong lock, wrong contract, resubmit ----------

  run("FINDING ADV-10: AG-01 style header mixHash forge on a real Hardhat Ethereum lock still mints [AG-01]", async () => {
    const c = await deploySystem();
    const lockId = ethers.hexlify(ethers.randomBytes(32));
    const rc = await (await c.ethLock.connect(c.other).createNativeLock(
      lockId, c.recipient.address, 0, ETH_ID, ethers.ZeroHash, c.dest.address, DAY7, PRICE / 100n,
      { value: SCALE / 100n })).wait();
    const ev = await ethLockEvidence(await c.ethLock.getAddress(), rc.hash, lockId);
    let forged = rlpReplace(ev.headerRlp, 13, ethers.hexlify(ethers.randomBytes(32)));
    forged = rlpReplace(forged, 0, ethers.hexlify(ethers.randomBytes(32)));
    const forgedHash = ethers.keccak256(forged);
    expect(await ethers.provider.send("eth_getBlockByHash", [forgedHash, false])).to.equal(null);
    const rec = await c.ethLock.lockRecord(lockId);
    const p = {
      sourceEnvironmentId: "Ethereum", commitmentVaultLockId: lockId, handshakeAllowanceCount: 3,
      canonicalAssetId: ETH_ID, assetPrecision: 18, assetCustodyClass: 2,
      grossAmountSmallestUnits: rec.gross, actualFeeAmountSmallestUnits: rec.fee,
      principalAmountSmallestUnits: rec.principal, feeAssetId: ETH_ID, devFundDestination: "dev",
      feeTransferEvidence: ethers.id("fee"), valuationTimestamp: rec.createdAt, maturityTimestamp: rec.maturity,
      durationSecs: rec.duration, selectedOutputToken: 0, baseRecipient: c.recipient.address,
      releaseDestination: "release", chonxActivationReceipt: "0x",
      racIdentity: ethers.hexlify(ethers.randomBytes(32)), priceRecord: "0x",
      sourceFinalityProof: coder.encode(["uint256", "bytes32", "uint256"], [1, forgedHash, ev.block.number]),
      lockEventProof: encodeEvidence({ ...ev, headerRlp: forged }),
    };
    await c.verifier.recordFeeAndRac(p);
    await c.verifier.verifyAndMint(p, 0);
    expect(await c.vclm.balanceOf(c.recipient.address)).to.be.gt(0n);
  });

  pass("PASS ADV-P08: lookalike LockCreated from a CVL clone at another address is rejected by Ethereum reader", async () => {
    const c = await deploySystem();
    const clone = await (await ethers.getContractFactory("CommitmentVaultLock")).deploy("Ethereum", c.devFund.address);
    const lockId = ethers.hexlify(ethers.randomBytes(32));
    const rc = await (await clone.connect(c.other).createNativeLock(
      lockId, c.recipient.address, 0, ETH_ID, ethers.ZeroHash, c.dest.address, DAY7, PRICE / 100n,
      { value: SCALE / 100n })).wait();
    const ev = await ethLockEvidence(await clone.getAddress(), rc.hash, lockId);
    const rec = await clone.lockRecord(lockId);
    const p = {
      sourceEnvironmentId: "Ethereum", commitmentVaultLockId: lockId, handshakeAllowanceCount: 3,
      canonicalAssetId: ETH_ID, assetPrecision: 18, assetCustodyClass: 2,
      grossAmountSmallestUnits: rec.gross, actualFeeAmountSmallestUnits: rec.fee,
      principalAmountSmallestUnits: rec.principal, feeAssetId: ETH_ID, devFundDestination: "dev",
      feeTransferEvidence: ethers.id("fee"), valuationTimestamp: rec.createdAt, maturityTimestamp: rec.maturity,
      durationSecs: rec.duration, selectedOutputToken: 0, baseRecipient: c.recipient.address,
      releaseDestination: "release", chonxActivationReceipt: "0x",
      racIdentity: ethers.hexlify(ethers.randomBytes(32)), priceRecord: "0x",
      sourceFinalityProof: coder.encode(["uint256", "bytes32", "uint256"], [1, ev.block.hash, ev.block.number]),
      lockEventProof: encodeEvidence(ev),
    };
    // Log emitter is the clone, not the registered ethLock → VF-XCH-011: log emitter
    await expect(c.verifier.recordFeeAndRac(p)).to.be.reverted;
  });

  pass("PASS ADV-P09: receipt with altered recipient word fails storage proof (VF-XCH-011)", async () => {
    const c = await deploySystem();
    const lockId = ethers.hexlify(ethers.randomBytes(32));
    const rc = await (await c.ethLock.connect(c.other).createNativeLock(
      lockId, c.recipient.address, 0, ETH_ID, ethers.ZeroHash, c.dest.address, DAY7, PRICE / 100n,
      { value: SCALE / 100n })).wait();
    const ev = await ethLockEvidence(await c.ethLock.getAddress(), rc.hash, lockId);
    const rec = await c.ethLock.lockRecord(lockId);
    // Claim a different recipient in the package; reader extracts the real one from storage.
    const p = {
      sourceEnvironmentId: "Ethereum", commitmentVaultLockId: lockId, handshakeAllowanceCount: 3,
      canonicalAssetId: ETH_ID, assetPrecision: 18, assetCustodyClass: 2,
      grossAmountSmallestUnits: rec.gross, actualFeeAmountSmallestUnits: rec.fee,
      principalAmountSmallestUnits: rec.principal, feeAssetId: ETH_ID, devFundDestination: "dev",
      feeTransferEvidence: ethers.id("fee"), valuationTimestamp: rec.createdAt, maturityTimestamp: rec.maturity,
      durationSecs: rec.duration, selectedOutputToken: 0, baseRecipient: c.stranger.address,
      releaseDestination: "release", chonxActivationReceipt: "0x",
      racIdentity: ethers.hexlify(ethers.randomBytes(32)), priceRecord: "0x",
      sourceFinalityProof: coder.encode(["uint256", "bytes32", "uint256"], [1, ev.block.hash, ev.block.number]),
      lockEventProof: encodeEvidence(ev),
    };
    await expect(c.verifier.recordFeeAndRac(p)).to.be.revertedWith("VF-XCH-011: recipient mismatch");
  });

  // ---------- FINDING: double RAC / unbound racIdentity / price / valuation (AG-04..07) ----------

  run("FINDING ADV-11: same Base lock records many RAC credits via caller-chosen racIdentity [AG-04, VF-RAC-001]", async () => {
    const c = await deploySystem();
    const p = await baseLockPkg(c);
    await c.verifier.recordFeeAndRac(p);
    await c.verifier.verifyAndMint(p, 0);
    const epoch = await c.verifier.currentEpoch();
    const one = await c.verifier.epochRewardBasis(epoch);
    const K = 10n;
    for (let i = 1n; i < K; i++) {
      await c.verifier.connect(c.stranger).recordFeeAndRac({ ...p, racIdentity: ethers.hexlify(ethers.randomBytes(32)) });
    }
    const after = await c.verifier.epochRewardBasis(epoch);
    expect(after).to.equal(one * K);
    console.log(`      ADV-11 epochRewardBasis x${K}: ${one} -> ${after}`);
  });

  run("FINDING ADV-12: caller valuationTimestamp=0 keeps day-0 emission after long delay [AG-05]", async () => {
    const c = await deploySystem();
    await network.provider.send("evm_increaseTime", [Number(400n * DAY)]);
    await network.provider.send("evm_mine", []);
    await c.verifier.connect(c.poster).applyScheduledPriceRun(2n, [
      { environmentId: "Base", canonicalAssetId: ETH_ID, priceUsd18: PRICE, success: true },
    ]);
    const honest = await baseLockPkg(c);
    const cheat = await baseLockPkg(c);
    await c.verifier.recordFeeAndRac(honest);
    await c.verifier.verifyAndMint(honest, 0);
    const a = await c.vclm.balanceOf(c.recipient.address);
    await c.verifier.recordFeeAndRac(cheat);
    await c.verifier.verifyAndMint({ ...cheat, valuationTimestamp: 0 }, 0);
    const b = (await c.vclm.balanceOf(c.recipient.address)) - a;
    expect(b).to.be.gt(a);
    console.log(`      ADV-12 honest ${ethers.formatEther(a)} vs valuationTimestamp=0 ${ethers.formatEther(b)} VCLM`);
  });

  run("FINDING ADV-13: price bound at first submission, not lock creation; later run reprices [AG-06]", async () => {
    const c = await deploySystem();
    const p = await baseLockPkg(c);
    await c.verifier.connect(c.poster).applyScheduledPriceRun(2n, [
      { environmentId: "Base", canonicalAssetId: ETH_ID, priceUsd18: PRICE * 10n, success: true },
    ]);
    await c.verifier.recordFeeAndRac(p);
    await c.verifier.verifyAndMint(p, 0);
    const got = await c.vclm.balanceOf(c.recipient.address);
    const c2 = await deploySystem();
    const p2 = await baseLockPkg(c2);
    await c2.verifier.recordFeeAndRac(p2);
    await c2.verifier.verifyAndMint(p2, 0);
    const fair = await c2.vclm.balanceOf(c2.recipient.address);
    expect(got).to.equal(fair * 10n);
    console.log(`      ADV-13 fair ${ethers.formatEther(fair)} vs later-run ${ethers.formatEther(got)} VCLM`);
  });

  run("FINDING ADV-14: price poster sets unbounded price and freezes runs with max runId [AG-07]", async () => {
    const c = await deploySystem();
    await c.verifier.connect(c.poster).applyScheduledPriceRun(2n ** 64n - 1n, [
      { environmentId: "Base", canonicalAssetId: ETH_ID, priceUsd18: PRICE * 1000n, success: true },
    ]);
    await expect(c.verifier.connect(c.poster).applyScheduledPriceRun(2n ** 64n - 1n, []))
      .to.be.revertedWith("VF-ORC-001: run id must advance");
    const p = await baseLockPkg(c, { valueWei: SCALE / 1000n });
    await c.verifier.recordFeeAndRac(p);
    await c.verifier.verifyAndMint(p, 0);
    const minted = await c.vclm.balanceOf(c.recipient.address);
    expect(minted).to.be.gt(0n);
    console.log(`      ADV-14 0.001 ETH at 1000x price minted ${ethers.formatEther(minted)} VCLM; runs frozen`);
  });

});

describe("RIG 9 adversarial controls that always run", function () {
  this.timeout(300000);
  it("PASS ADV-P10: non-poster cannot applyScheduledPriceRun", async () => {
    const c = await deploySystem();
    await expect(c.verifier.connect(c.stranger).applyScheduledPriceRun(2n, [
      { environmentId: "Base", canonicalAssetId: ETH_ID, priceUsd18: PRICE * 100n, success: true },
    ])).to.be.revertedWith("VF-ORC-007: not price poster");
  });

  it("PASS ADV-P11: out-of-order / non-advancing runId is refused", async () => {
    const c = await deploySystem();
    await expect(c.verifier.connect(c.poster).applyScheduledPriceRun(1n, [
      { environmentId: "Base", canonicalAssetId: ETH_ID, priceUsd18: PRICE, success: true },
    ])).to.be.revertedWith("VF-ORC-001: run id must advance");
  });

  it("PASS ADV-P12: Base lock resubmitted with different proof encoding still only mints once", async () => {
    const c = await deploySystem();
    const p = await baseLockPkg(c);
    await c.verifier.recordFeeAndRac(p);
    await c.verifier.verifyAndMint(p, 0);
    // Alternate encoding: same lockId, different trailing uints in lockEventProof.
    // Base reader only uses lockId; mint must still hit replay.
    const alt = {
      ...p,
      lockEventProof: coder.encode(["bytes32", "uint256", "uint256", "uint256", "uint256", "uint256", "uint256"],
        [p.commitmentVaultLockId, 0, 0, 0, 0, 0, 0]),
      racIdentity: ethers.hexlify(ethers.randomBytes(32)),
    };
    await c.verifier.recordFeeAndRac(alt); // RAC still free (AG-04) — but mint:
    await expect(c.verifier.verifyAndMint(alt, 0)).to.be.revertedWith("VF-XCH-013: replay");
  });
});
