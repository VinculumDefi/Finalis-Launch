// =============================================================================
// deployFive Ethereum vault — Approved Asset Registry rows already registered
// by deployFive from ASSET_PRECISION_TABLE (USDT, LINK, UNI, AAVE).
//
// Does not register any new asset. Locks at the registry address+decimals.
// If Hardhat has no code at that address, places MockERC20 runtime code there
// via hardhat_setCode (address unchanged). No left-pad. No decimals sidecar.
//
// Per asset: early release reverts; bound destination (not locker) gets principal.
// =============================================================================

const { expect } = require("chai");
const { ethers } = require("hardhat");
const {
  setCode,
  setStorageAt,
  takeSnapshot,
} = require("@nomicfoundation/hardhat-network-helpers");
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
const ENV_ETH = "ethereum";
const PRICE_MICRO_USD = 1_000_000n;
const DURATION = 30n * DAY;

/**
 * Four registry rows from ASSET_PRECISION_TABLE (addresses as in the table;
 * EIP-55 checksum via getAddress — same as deployFive registration).
 * Do not left-pad; do not register anything deployFive does not already register.
 */
const ASSETS = [
  {
    symbol: "USDT",
    // ASSET_PRECISION_TABLE Ethereum/USDT
    address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    decimals: 6,
    custodyClass: 1,
    name: "Tether USD",
    gross: 100n * 10n ** 6n,
    fund: 1000n * 10n ** 6n,
    expectedFee: 5_000_000n,
    expectedPrincipal: 95_000_000n,
    expectedMint: 1725n * 10n ** 18n,
    lockTag: "deploy-five-eth-usdt",
  },
  {
    symbol: "LINK",
    // ASSET_PRECISION_TABLE Ethereum/LINK
    address: "0x514910771af9ca656af840dff83e8264ecf986ca",
    decimals: 18,
    custodyClass: 2,
    name: "Chainlink",
    gross: 100n * 10n ** 18n,
    fund: 1000n * 10n ** 18n,
    expectedFee: 5n * 10n ** 18n,
    expectedPrincipal: 95n * 10n ** 18n,
    expectedMint: 1495n * 10n ** 18n,
    lockTag: "deploy-five-eth-link",
  },
  {
    symbol: "UNI",
    // ASSET_PRECISION_TABLE Ethereum/UNI
    address: "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984",
    decimals: 18,
    custodyClass: 2,
    name: "Uniswap",
    gross: 100n * 10n ** 18n,
    fund: 1000n * 10n ** 18n,
    expectedFee: 5n * 10n ** 18n,
    expectedPrincipal: 95n * 10n ** 18n,
    expectedMint: 1495n * 10n ** 18n,
    lockTag: "deploy-five-eth-uni",
  },
  {
    symbol: "AAVE",
    // ASSET_PRECISION_TABLE Ethereum/AAVE
    address: "0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9",
    decimals: 18,
    custodyClass: 2,
    name: "Aave",
    gross: 100n * 10n ** 18n,
    fund: 1000n * 10n ** 18n,
    expectedFee: 5n * 10n ** 18n,
    expectedPrincipal: 95n * 10n ** 18n,
    expectedMint: 1495n * 10n ** 18n,
    lockTag: "deploy-five-eth-aave",
  },
];

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

// ---- RLP helpers (mirrors 37_deploy_five_ethereum_usdc) --------------------

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

/**
 * Ensure MockERC20 runtime code exists at the registry asset address.
 * Does not change the address. Funds `user` via storage (balanceOf slot).
 * MockERC20 layout: decimals @ 2, balanceOf mapping @ 5.
 */
async function ensureAssetCodeAndFund(asset, user, amount) {
  const tokenAddr = ethers.getAddress(asset.address);
  const existing = await ethers.provider.getCode(tokenAddr);
  const Mock = await ethers.getContractFactory("MockERC20");
  const seed = await Mock.deploy(asset.name, asset.symbol, asset.decimals, amount);
  await seed.waitForDeployment();

  if (existing === "0x") {
    const code = await ethers.provider.getCode(await seed.getAddress());
    await setCode(tokenAddr, code);
  }

  await setStorageAt(tokenAddr, 2, ethers.toBeHex(asset.decimals, 32));
  const balSlot = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "uint256"],
      [user.address, 5]
    )
  );
  await setStorageAt(tokenAddr, balSlot, ethers.toBeHex(amount, 32));

  return await ethers.getContractAt("MockERC20", tokenAddr);
}

describe("38_deploy_five — Ethereum USDT/LINK/UNI/AAVE via deployFive", function () {
  this.timeout(600000);

  let publisher, user, relayer, ethDevFund, boundDestination;
  let vclm, chonx, synth, __cap, musd, mockL1, registry;
  let out, verifier, vault, ethVerifier;
  let priceRunId = 1n;
  let proofBlockNumber = 9000;
  let snapshot;

  before(async function () {
    const signers = await ethers.getSigners();
    publisher = signers[9];
    user = signers[3];
    relayer = signers[5];
    ethDevFund = signers[8];
    const polyDevFund = signers[7];
    const arbDevFund = signers[6];
    const opDevFund = signers[2];
    const baseDevFund = signers[1];
    boundDestination = signers[4];

    const Token = await ethers.getContractFactory("VinculumFinalisToken");
    vclm  = await Token.deploy("Vinculum", "VCLM", 10_000_000_000n * 10n**18n);
    chonx = await Token.deploy("Chonx", "CHONX", 100_000_000_000n * 10n**18n);
    synth = await Token.deploy("Synth", "SYNTH", 10_000_000n * 10n**18n);

    const launchTs = (await ethers.provider.getBlock("latest")).timestamp;
    __cap = await (await ethers.getContractFactory("VinculumFinalisCap"))
      .deploy(10_000_000_000n * 10n ** 18n, 100_000_000_000n * 10n ** 18n);

    // Fixture ASSET_TOKEN for deployFive (MUSD); registry assets are registered
    // separately by deployFive from ASSET_PRECISION_TABLE — do not register here.
    const Mock = await ethers.getContractFactory("MockERC20");
    musd = await Mock.deploy("MockUSD", ASSET_SYMBOL, 18, 10n**30n);

    const M = await ethers.getContractFactory("MockL1Block");
    mockL1 = await M.deploy();
    const R = await ethers.getContractFactory("L1BlockRegistry");
    registry = await R.deploy(await mockL1.getAddress());

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

    out = await deployFive(ethers, env);

    verifier = await ethers.getContractAt(
      "VinculumFinalisVerifier",
      out.verifier
    );
    vault = await ethers.getContractAt(
      "VinculumFinalisEvmVault",
      out.vaults.ethereum
    );
    ethVerifier = await ethers.getContractAt(
      "EthereumChainVerifier",
      out.chainVerifiers.ethereum
    );

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

    // Protocol finalize is the test's responsibility — deployFive does not call it.
    await verifier.finalize();

    // Isolate each asset at launch time so emission decay from one release
    // warp does not change mint amounts for the remaining assets.
    snapshot = await takeSnapshot();
  });

  beforeEach(async function () {
    await snapshot.restore();
    priceRunId = 1n;
    proofBlockNumber = 9000;
  });

  for (const asset of ASSETS) {
    it(
      `locks 100 ${asset.symbol}, mints expected VCLM, Dev Fund fee, releases principal`,
      async function () {
        const tokenAddr = ethers.getAddress(asset.address);
        const AID = ethers.keccak256(
          ethers.toUtf8Bytes(`${ENV_ETH}:${asset.symbol}`)
        );
        expect(await vault.approvedAsset(tokenAddr)).to.equal(AID);

        const token = await ensureAssetCodeAndFund(asset, user, asset.fund);
        expect(await token.decimals()).to.equal(asset.decimals);
        expect(await token.balanceOf(user.address)).to.equal(asset.fund);

        const ts = (await ethers.provider.getBlock("latest")).timestamp;
        const runId = priceRunId;
        priceRunId += 1n;
        const sig = await signBatch(
          verifier, publisher, runId, [AID], [PRICE_MICRO_USD], ts
        );
        await verifier.submitPriceBatch(
          runId, [AID], [PRICE_MICRO_USD], ts, sig
        );

        await token.connect(user).approve(out.vaults.ethereum, asset.fund);

        const vaultLockId = ethers.keccak256(
          ethers.toUtf8Bytes(asset.lockTag)
        );
        const releaseDestination = boundDestination.address;

        const devBefore = await token.balanceOf(ethDevFund.address);
        const tx = await vault.connect(user).createLock({
          lockId: vaultLockId,
          asset: tokenAddr,
          grossAmount: asset.gross,
          durationSecs: DURATION,
          baseRecipient: user.address,
          releaseDestination,
          outputToken: 0,
          chonxActivationReceipt: ethers.ZeroHash,
        });
        const txReceipt = await tx.wait();
        const record = await vault.getLock(vaultLockId);

        expect(record.principalAmount).to.equal(asset.expectedPrincipal);
        expect(record.feeAmount).to.equal(asset.expectedFee);
        expect(await token.balanceOf(record.lockContract))
          .to.equal(asset.expectedPrincipal);
        expect(await token.balanceOf(ethDevFund.address) - devBefore)
          .to.equal(asset.expectedFee);

        const receiptHex = receiptFromHardhat(txReceipt);
        const trie = buildTrie(receiptHex);
        const header = buildHeader(trie.root);

        const blockNumber = proofBlockNumber;
        proofBlockNumber += 1;

        await mockL1.set(
          blockNumber,
          ethers.keccak256(header),
          Number(record.creationTime)
        );
        await registry.record();

        const lockEventProof = encodeProof(
          blockNumber, header, trie.key, trie.proof, receiptHex
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
          assetPrecision: asset.decimals,
          assetCustodyClass: asset.custodyClass,
          grossAmountSmallestUnits: record.grossAmount,
          actualFeeAmountSmallestUnits: record.feeAmount,
          principalAmountSmallestUnits: record.principalAmount,
          feeAssetId: AID,
          devFundDestination: ethDevFund.address.toLowerCase(),
          feeTransferEvidence: ethers.keccak256(
            ethers.toUtf8Bytes(`fee-${asset.lockTag}`)
          ),
          valuationTimestamp: Number(record.creationTime),
          maturityTimestamp: Number(record.maturityTime),
          durationSecs: record.durationSecs,
          selectedOutputToken: 0,
          baseRecipient: record.baseRecipient,
          releaseDestination: releaseDestination.toLowerCase(),
          chonxActivationReceipt: "0x",
          racIdentity: ethers.keccak256(
            ethers.toUtf8Bytes(`rac-${asset.lockTag}`)
          ),
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
          `\n    deployFive Ethereum ${asset.symbol}: minted ${ethers.formatUnits(minted, 18)} VCLM\n`
        );
        expect(minted).to.equal(asset.expectedMint);

        const lock = await ethers.getContractAt(
          "CommitmentLock",
          record.lockContract
        );
        await expect(lock.release()).to.be.revertedWithCustomError(
          lock,
          "NotMature"
        );

        await ethers.provider.send("evm_increaseTime", [Number(DURATION)]);
        await ethers.provider.send("evm_mine", []);

        const destBefore = await token.balanceOf(boundDestination.address);
        const lockerBefore = await token.balanceOf(user.address);
        await lock.connect(relayer).release();
        expect(await token.balanceOf(record.lockContract)).to.equal(0n);
        expect(await token.balanceOf(boundDestination.address) - destBefore)
          .to.equal(asset.expectedPrincipal);
        // Bound destination (not locker) receives principal.
        expect(await token.balanceOf(user.address)).to.equal(lockerBefore);
      }
    );
  }
});
