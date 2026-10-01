// =============================================================================
// deployFive Ethereum vault — mainnet-fork e2e for Approved Asset Registry
// row 1 (real USDC at 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48).
//
// Forks Ethereum mainnet (Hardhat). Does NOT call hardhat_setCode on USDC.
// Does NOT broadcast to mainnet. finalize() only on this local fork.
// Funds the locker by impersonating an existing USDC holder on the fork.
//
// Asserts: decimals() === 6; Dev Fund 5_000_000; principal 95_000_000;
// mint 1725n*10n**18n; early release reverts; bound destination gets principal.
// =============================================================================

const { expect } = require("chai");
const { ethers, network } = require("hardhat");
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

/** Approved Asset Registry row 1 — Ethereum USDC (mainnet). */
const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const USDC_DECIMALS = 6;
const USDC_SYMBOL = "USDC";

/** Known mainnet holders checked in order for >= fund amount (fork only). */
const USDC_HOLDER_CANDIDATES = [
  "0xA9D1e08C7793af67e9d92fe308d5697FB81d3E43", // Coinbase cold
  "0x28C6c06298d514Db089934071355E5743bf21d60", // Binance 14
  "0xF977814e90dA44bFA03b6295A0616a897441aceC", // Binance 8
];

const PUBLIC_RPCS = [
  "https://ethereum.publicnode.com",
  "https://ethereum-rpc.publicnode.com",
  "https://eth.drpc.org",
  "https://rpc.flashbots.net",
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
 * Start a Hardhat mainnet fork. Tries env RPC then public endpoints.
 * Throws with the last error if none can start the fork (caller must STOP).
 */
async function startMainnetFork() {
  const candidates = [];
  const envUrl =
    (process.env.ETHEREUM_RPC_URL || process.env.MAINNET_RPC_URL || "").trim();
  if (envUrl) candidates.push(envUrl);
  for (const u of PUBLIC_RPCS) {
    if (!candidates.includes(u)) candidates.push(u);
  }

  const errors = [];
  for (const url of candidates) {
    try {
      await network.provider.request({
        method: "hardhat_reset",
        params: [{ forking: { jsonRpcUrl: url } }],
      });
      const block = await ethers.provider.getBlock("latest");
      const code = await ethers.provider.getCode(USDC_ADDRESS);
      if (!code || code === "0x") {
        throw new Error(`USDC has no code at ${USDC_ADDRESS} after fork of ${url}`);
      }
      return { rpcUrl: url, forkBlockNumber: block.number };
    } catch (e) {
      errors.push(`${url}: ${e && e.message ? e.message : String(e)}`);
    }
  }
  const msg =
    "FATAL: could not start Ethereum mainnet Hardhat fork.\n" +
    errors.map((e) => `  - ${e}`).join("\n");
  throw new Error(msg);
}

/**
 * Impersonate an existing mainnet USDC holder on the fork and transfer
 * `amount` to `user`. Never uses hardhat_setCode on USDC.
 */
async function fundUserFromHolder(usdc, user, amount) {
  let holder = null;
  for (const raw of USDC_HOLDER_CANDIDATES) {
    const addr = ethers.getAddress(raw.toLowerCase());
    const bal = await usdc.balanceOf(addr);
    if (bal >= amount) {
      holder = addr;
      break;
    }
  }
  if (!holder) {
    throw new Error(
      `No known USDC holder on fork has >= ${amount} raw units among candidates`
    );
  }

  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [holder],
  });
  await network.provider.send("hardhat_setBalance", [
    holder,
    "0x56BC75E2D63100000", // 100 ETH for gas
  ]);
  const whale = await ethers.getSigner(holder);
  await usdc.connect(whale).transfer(user.address, amount);
  await network.provider.request({
    method: "hardhat_stopImpersonatingAccount",
    params: [holder],
  });
  return holder;
}

describe("42_deploy_five — Ethereum USDC mainnet-fork (real USDC, no setCode)", function () {
  it("locks 100 real USDC on fork, mints 1725 VCLM, Dev Fund 5_000_000, releases 95_000_000", async function () {
    this.timeout(900000);

    let forkMeta;
    try {
      forkMeta = await startMainnetFork();
    } catch (e) {
      console.error("\n" + (e && e.message ? e.message : String(e)) + "\n");
      throw e;
    }
    console.log(
      `\n    fork RPC: ${forkMeta.rpcUrl}\n` +
      `    fork block: ${forkMeta.forkBlockNumber}\n`
    );

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
      ethers.toUtf8Bytes(`${ENV_ETH}:${USDC_SYMBOL}`)
    );
    expect(await vault.approvedAsset(USDC_ADDRESS)).to.equal(AID);

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

    // Protocol finalize ONLY on this local fork — never on live mainnet.
    await verifier.finalize();

    // Real mainnet USDC on the fork — do NOT hardhat_setCode.
    const usdc = await ethers.getContractAt("MockERC20", USDC_ADDRESS);
    const liveDecimals = await usdc.decimals();
    expect(liveDecimals).to.equal(USDC_DECIMALS);
    expect(Number(liveDecimals)).to.equal(6);

    const gross = 100n * 10n**6n; // 100 USDC
    const fund = 1000n * 10n**6n;
    const whale = await fundUserFromHolder(usdc, user, fund);
    console.log(`    funded user from holder ${whale} (impersonation on fork)\n`);
    expect(await usdc.balanceOf(user.address)).to.equal(fund);

    const ts = (await ethers.provider.getBlock("latest")).timestamp;
    const price = 1_000_000n; // micro-USD per whole USDC
    const sig = await signBatch(verifier, publisher, 1n, [AID], [price], ts);
    await verifier.submitPriceBatch(1n, [AID], [price], ts, sig);

    await usdc.connect(user).approve(out.vaults.ethereum, fund);

    const expectedMint = 1725n * 10n**18n;
    const expectedPrincipal = 95_000_000n;
    const expectedFee = 5_000_000n;

    const vaultLockId = ethers.keccak256(
      ethers.toUtf8Bytes("deploy-five-eth-usdc-mainnet-fork")
    );
    const releaseDestination = boundDestination.address;
    const duration = 30n * DAY;

    const devBefore = await usdc.balanceOf(ethDevFund.address);
    const tx = await vault.connect(user).createLock({
      lockId: vaultLockId,
      asset: USDC_ADDRESS,
      grossAmount: gross,
      durationSecs: duration,
      baseRecipient: user.address,
      releaseDestination,
      outputToken: 0,
      chonxActivationReceipt: ethers.ZeroHash,
    });
    const txReceipt = await tx.wait();
    const record = await vault.getLock(vaultLockId);

    expect(record.principalAmount).to.equal(expectedPrincipal);
    expect(record.feeAmount).to.equal(expectedFee);
    expect(await usdc.balanceOf(record.lockContract)).to.equal(expectedPrincipal);
    expect(await usdc.balanceOf(ethDevFund.address) - devBefore).to.equal(expectedFee);

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
      assetPrecision: USDC_DECIMALS,
      assetCustodyClass: 1,
      grossAmountSmallestUnits: record.grossAmount,
      actualFeeAmountSmallestUnits: record.feeAmount,
      principalAmountSmallestUnits: record.principalAmount,
      feeAssetId: AID,
      devFundDestination: ethDevFund.address.toLowerCase(),
      feeTransferEvidence: ethers.keccak256(ethers.toUtf8Bytes("fee-deploy-five-eth-usdc-fork")),
      valuationTimestamp: Number(record.creationTime),
      maturityTimestamp: Number(record.maturityTime),
      durationSecs: record.durationSecs,
      selectedOutputToken: 0,
      baseRecipient: record.baseRecipient,
      releaseDestination: releaseDestination.toLowerCase(),
      chonxActivationReceipt: "0x",
      racIdentity: ethers.keccak256(ethers.toUtf8Bytes("rac-deploy-five-eth-usdc-fork")),
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
      `\n    deployFive Ethereum USDC mainnet-fork: minted ${ethers.formatUnits(minted, 18)} VCLM` +
      `\n    fork block number: ${forkMeta.forkBlockNumber}\n`
    );
    expect(minted).to.equal(expectedMint);

    const lock = await ethers.getContractAt("CommitmentLock", record.lockContract);
    await expect(lock.release()).to.be.revertedWithCustomError(lock, "NotMature");

    await ethers.provider.send("evm_increaseTime", [Number(30n * DAY)]);
    await ethers.provider.send("evm_mine", []);

    const destBefore = await usdc.balanceOf(boundDestination.address);
    await lock.connect(relayer).release();
    expect(await usdc.balanceOf(record.lockContract)).to.equal(0n);
    expect(await usdc.balanceOf(boundDestination.address) - destBefore)
      .to.equal(expectedPrincipal);

    // Surface fork block for the operator report.
    console.log(`FORK_BLOCK_NUMBER=${forkMeta.forkBlockNumber}`);
  });
});
