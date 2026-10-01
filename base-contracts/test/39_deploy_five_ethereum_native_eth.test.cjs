// =============================================================================
// deployFive Ethereum vault — Approved Asset Registry row 2 (native ETH)
//
// Locks 100 ETH at address(0) as registered by deployFive from
// ASSET_PRECISION_TABLE Ethereum/native-ETH (decimals 18, custody class 2,
// custody path native). Does not register any new asset. Does not read WETH
// from the row-2 identifier.
//
// Asserts: mint 1495 VCLM, fee 5 ETH to Dev Fund, release 95 ETH to bound
// destination; early release reverts.
// =============================================================================

const { expect } = require("chai");
const { ethers } = require("hardhat");
const {
  deployFive,
  ADDRESS_KEYS,
  BYTES32_KEYS,
  ASSET_SYMBOL,
} = require("../scripts/deploy-five.cjs");

const NONZERO_ADDRESS = "0x1111111111111111111111111111111111111111";
const NONZERO_BYTES32 =
  "0x2222222222222222222222222222222222222222222222222222222222222222";
const ZERO = "0x0000000000000000000000000000000000000000";
const DAY = 86400n;
const BLOCK_NUMBER = 9000;
const ENV_ETH = "ethereum";

/** Registry row 2 — native ETH as address(0); ASSET_PRECISION_TABLE decimals 18 / S2. */
const ETH_ADDRESS = ZERO;
const ETH_DECIMALS = 18;
const ETH_SYMBOL = "ETH";
const ETH_CUSTODY_CLASS = 2;

function validEnv() {
  const env = {
    LAUNCH_TIMESTAMP: "1700000000",
    OPTIMISM_RESPECTED_GAME_TYPE: "0",
    OPTIMISM_GAME_FINALITY_DELAY_SECONDS: "302400",
  };
  for (const k of ADDRESS_KEYS) env[k] = NONZERO_ADDRESS;
  for (const k of BYTES32_KEYS) env[k] = NONZERO_BYTES32;
  env.ETHEREUM_ENVIRONMENT_ID = "ethereum";
  env.POLYGON_ENVIRONMENT_ID = "polygon";
  env.ARBITRUM_ENVIRONMENT_ID = "arbitrum";
  env.OPTIMISM_ENVIRONMENT_ID = "optimism";
  env.BASE_ENVIRONMENT_ID = "base";
  return env;
}

function rlpLen(len, offset) {
  if (len < 56) return Uint8Array.from([len + offset]);
  let h = len.toString(16);
  if (h.length % 2) h = "0" + h;
  const b = ethers.getBytes("0x" + h);
  return Uint8Array.from([b.length + offset + 55, ...b]);
}

function rlpBytes(input) {
  const b = typeof input === "string" ? ethers.getBytes(input) : input;
  if (b.length === 1 && b[0] < 0x80) return b;
  return Uint8Array.from([...rlpLen(b.length, 0x80), ...b]);
}

function rlpList(items) {
  const body = items.reduce((a, x) => Uint8Array.from([...a, ...x]), new Uint8Array());
  return Uint8Array.from([...rlpLen(body.length, 0xc0), ...body]);
}

const hex = (u8) => ethers.hexlify(u8);

function buildLog(emitter, topics, data) {
  return rlpList([
    rlpBytes(emitter),
    rlpList(topics.map((t) => rlpBytes(t))),
    rlpBytes(data),
  ]);
}

function buildReceipt({ status = 1, logs = [] }) {
  return rlpList([
    rlpBytes(status === 1 ? "0x01" : "0x"),
    rlpBytes("0x5208"),
    rlpBytes("0x" + "00".repeat(256)),
    rlpList(logs),
  ]);
}

function buildHeader(receiptsRoot) {
  const f32 = (b) => "a0" + b.slice(2);
  const body =
    f32(ethers.keccak256(ethers.toUtf8Bytes("parent"))) +
    f32(ethers.keccak256(ethers.toUtf8Bytes("ommers"))) +
    "94" + "11".repeat(20) +
    f32(ethers.keccak256(ethers.toUtf8Bytes("state"))) +
    f32(ethers.keccak256(ethers.toUtf8Bytes("txs"))) +
    f32(receiptsRoot);

  const len = body.length / 2;
  return "0x" + "f9" + len.toString(16).padStart(4, "0") + body;
}

function buildTrie(receiptHex) {
  const key = "0x80";
  const nibbles = [8, 0];
  const path = Uint8Array.from([0x20, (nibbles[0] << 4) | nibbles[1]]);
  const leaf = rlpList([rlpBytes(path), rlpBytes(receiptHex)]);
  return { root: ethers.keccak256(leaf), key, proof: [hex(leaf)] };
}

function encodeProof(blockNumber, header, key, proof, receiptHex) {
  return ethers.AbiCoder.defaultAbiCoder().encode(
    ["uint256", "bytes", "bytes", "bytes[]", "bytes"],
    [blockNumber, header, key, proof, receiptHex]
  );
}

function receiptFromHardhat(txReceipt) {
  const logs = txReceipt.logs.map((l) =>
    buildLog(l.address, [...l.topics], l.data)
  );
  return hex(buildReceipt({ status: 1, logs }));
}

async function signBatch(verifier, signer, runId, ids, prices, fetchTs) {
  const net = await ethers.provider.getNetwork();
  const digest = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint256", "address", "uint64", "bytes32", "bytes32", "uint64"],
      [net.chainId, await verifier.getAddress(), runId,
       ethers.solidityPackedKeccak256(["bytes32[]"], [ids]),
       ethers.solidityPackedKeccak256(["uint256[]"], [prices]), fetchTs]
    )
  );
  return await signer.signMessage(ethers.getBytes(digest));
}

describe("39_deploy_five — Ethereum native ETH (registry row 2) via deployFive", function () {
  it("locks 100 ETH, mints 1495 VCLM, fee 5 ETH, releases 95 ETH; early release reverts", async function () {
    this.timeout(600000);

    const signers = await ethers.getSigners();
    const publisher = signers[9];
    const user = signers[3];
    const relayer = signers[5];
    const ethDevFund = signers[8];
    const polyDevFund = signers[7];
    const arbDevFund = signers[6];
    const opDevFund = signers[2];
    const baseDevFund = signers[1];
    const boundDestination = signers[4];

    const Token = await ethers.getContractFactory("VinculumFinalisToken");
    const vclm  = await Token.deploy("Vinculum", "VCLM", 10_000_000_000n * 10n**18n);
    const chonx = await Token.deploy("Chonx", "CHONX", 100_000_000_000n * 10n**18n);
    const synth = await Token.deploy("Synth", "SYNTH", 10_000_000n * 10n**18n);

    const launchTs = (await ethers.provider.getBlock("latest")).timestamp;
    const __cap = await (await ethers.getContractFactory("VinculumFinalisCap"))
      .deploy(10_000_000_000n * 10n ** 18n, 100_000_000_000n * 10n ** 18n);

    const Mock = await ethers.getContractFactory("MockERC20");
    const musd = await Mock.deploy("MockUSD", ASSET_SYMBOL, 18, 10n**30n);

    const M = await ethers.getContractFactory("MockL1Block");
    const mockL1 = await M.deploy();
    const R = await ethers.getContractFactory("L1BlockRegistry");
    const registry = await R.deploy(await mockL1.getAddress());

    const EvmVault = await ethers.getContractFactory("VinculumFinalisEvmVault");
    const TOPIC = EvmVault.interface.getEvent("CommitVaultLock").topicHash;

    const env = validEnv();
    env.VCLM_TOKEN = await vclm.getAddress();
    env.CHONX_TOKEN = await chonx.getAddress();
    env.PRICE_PUBLISHER = publisher.address;
    env.LAUNCH_TIMESTAMP = String(launchTs);
    env.CAP = await __cap.getAddress();
    env.ASSET_TOKEN = await musd.getAddress();
    env.ETHEREUM_DEV_FUND = ethDevFund.address;
    env.POLYGON_DEV_FUND = polyDevFund.address;
    env.ARBITRUM_DEV_FUND = arbDevFund.address;
    env.OPTIMISM_DEV_FUND = opDevFund.address;
    env.BASE_DEV_FUND = baseDevFund.address;
    env.ETHEREUM_REGISTRY = await registry.getAddress();
    env.ETHEREUM_LOCK_EVENT_TOPIC = TOPIC;

    const out = await deployFive(ethers, env);

    const verifier = await ethers.getContractAt(
      "VinculumFinalisVerifier",
      out.verifier
    );
    const vault = await ethers.getContractAt(
      "VinculumFinalisEvmVault",
      out.vaults.ethereum
    );
    const ethVerifier = await ethers.getContractAt(
      "EthereumChainVerifier",
      out.chainVerifiers.ethereum
    );

    const AID = ethers.keccak256(
      ethers.toUtf8Bytes(`${ENV_ETH}:${ETH_SYMBOL}`)
    );
    expect(await vault.approvedAsset(ETH_ADDRESS)).to.equal(AID);
    const precKey = ethers.solidityPackedKeccak256(
      ["string", "bytes32"],
      [ENV_ETH, AID]
    );
    const prec = await verifier.assetPrecisionTable(precKey);
    expect(prec.decimals).to.equal(ETH_DECIMALS);
    expect(prec.custodyClass).to.equal(ETH_CUSTODY_CLASS);
    expect(prec.custodyPath).to.equal(0);

    const Stake = await ethers.getContractFactory("VinculumFinalisStake");
    const stake = await Stake.deploy(
      await vclm.getAddress(), await chonx.getAddress(),
      await synth.getAddress(), out.verifier, launchTs,
      await __cap.getAddress()
    );
    await __cap.initialize(out.verifier, await stake.getAddress());
    await vclm.initialize(out.verifier, await stake.getAddress());
    await chonx.initialize(out.verifier, ZERO);
    await synth.initialize(out.verifier, ZERO);

    await verifier.finalize();

    const gross = 100n * 10n**18n; // 100 ETH
    const expectedMint = 1495n * 10n**18n;
    const expectedPrincipal = 95n * 10n**18n;
    const expectedFee = 5n * 10n**18n;

    const ts = (await ethers.provider.getBlock("latest")).timestamp;
    const price = 1_000_000n; // micro-USD per whole ETH (test price → $100 notional)
    const sig = await signBatch(verifier, publisher, 1n, [AID], [price], ts);
    await verifier.submitPriceBatch(1n, [AID], [price], ts, sig);

    const vaultLockId = ethers.keccak256(
      ethers.toUtf8Bytes("deploy-five-eth-native-eth-row2")
    );
    const releaseDestination = boundDestination.address;
    const duration = 30n * DAY;

    const devBefore = await ethers.provider.getBalance(ethDevFund.address);
    const tx = await vault.connect(user).createLock({
      lockId: vaultLockId,
      asset: ETH_ADDRESS,
      grossAmount: gross,
      durationSecs: duration,
      baseRecipient: user.address,
      releaseDestination,
      outputToken: 0,
      chonxActivationReceipt: ethers.ZeroHash,
    }, { value: gross });
    const txReceipt = await tx.wait();
    const record = await vault.getLock(vaultLockId);

    expect(record.principalAmount).to.equal(expectedPrincipal);
    expect(record.feeAmount).to.equal(expectedFee);
    expect(await ethers.provider.getBalance(record.lockContract))
      .to.equal(expectedPrincipal);
    expect(await ethers.provider.getBalance(ethDevFund.address) - devBefore)
      .to.equal(expectedFee);

    const receiptHex = receiptFromHardhat(txReceipt);
    const trie = buildTrie(receiptHex);
    const header = buildHeader(trie.root);

    await mockL1.set(BLOCK_NUMBER, ethers.keccak256(header), Number(record.creationTime));
    await registry.record();

    const lockEventProof = encodeProof(
      BLOCK_NUMBER, header, trie.key, trie.proof, receiptHex
    );

    const commitmentVaultLockId = ethers.solidityPackedKeccak256(
      ["string", "address", "bytes32"],
      [ENV_ETH, out.vaults.ethereum, vaultLockId]
    );

    const pkg = {
      sourceEnvironmentId: ENV_ETH,
      commitmentVaultLockId,
      handshakeIdentity: `${ENV_ETH}:${user.address.toLowerCase()}`,
      handshakeAllowanceCount: record.handshakeAllowanceCount,
      canonicalAssetId: AID,
      assetPrecision: ETH_DECIMALS,
      assetCustodyClass: ETH_CUSTODY_CLASS,
      grossAmountSmallestUnits: record.grossAmount,
      actualFeeAmountSmallestUnits: record.feeAmount,
      principalAmountSmallestUnits: record.principalAmount,
      feeAssetId: AID,
      devFundDestination: ethDevFund.address.toLowerCase(),
      feeTransferEvidence: ethers.keccak256(ethers.toUtf8Bytes("fee-deploy-five-eth-native")),
      valuationTimestamp: Number(record.creationTime),
      maturityTimestamp: Number(record.maturityTime),
      durationSecs: record.durationSecs,
      selectedOutputToken: 0,
      baseRecipient: record.baseRecipient,
      releaseDestination: releaseDestination.toLowerCase(),
      chonxActivationReceipt: "0x",
      racIdentity: ethers.keccak256(ethers.toUtf8Bytes("rac-deploy-five-eth-native")),
      sourceFinalityProof: "0x",
      lockEventProof,
    };

    const [finalized] = await ethVerifier.verifyFinality(lockEventProof, "0x");
    expect(finalized).to.equal(true);

    const before = await vclm.balanceOf(user.address);
    await verifier.connect(relayer).recordFeeAndRac(pkg);
    await verifier.connect(relayer).verifyAndMint(pkg);
    const minted = await vclm.balanceOf(user.address) - before;
    console.log(
      `\n    deployFive Ethereum native ETH row2: minted ${ethers.formatUnits(minted, 18)} VCLM\n`
    );
    expect(minted).to.equal(expectedMint);

    const lock = await ethers.getContractAt("CommitmentLock", record.lockContract);
    await expect(lock.release()).to.be.revertedWithCustomError(lock, "NotMature");

    await ethers.provider.send("evm_increaseTime", [Number(30n * DAY)]);
    await ethers.provider.send("evm_mine", []);

    const destBefore = await ethers.provider.getBalance(boundDestination.address);
    await lock.connect(relayer).release();
    expect(await ethers.provider.getBalance(record.lockContract)).to.equal(0n);
    expect(await ethers.provider.getBalance(boundDestination.address) - destBefore)
      .to.equal(expectedPrincipal);
  });
});
