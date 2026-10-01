// =============================================================================
// deployFive L2/Base vaults — live-token Hardhat-fork e2e for Approved Asset
// Registry rows already registered by deployFive (custody class 3 / S3):
//
//   Polygon  row 40  USDC_POL  0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174  6
//   Arbitrum row 11  USDC_ARB  0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8  6
//   Optimism row 26  OP        0x4200000000000000000000000000000000000042 18
//   Base     row 25  CBETH     0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22 18
//
// Mirrors 42 (Ethereum USDC mainnet-fork): forks each chain locally, does NOT
// call hardhat_setCode / hardhat_setStorageAt on the asset, does NOT invent a
// balance. Funds the locker by impersonating an existing holder on the fork.
// finalize() only on that local fork. Does NOT broadcast.
//
// Asserts: decimals() from live contract; Dev Fund fee / principal as below;
// mint exactly 1150n*10n**18n; early release reverts; bound destination (not
// locker) gets principal. Custody class 3.
//
// Proofs: Poly/Arb/OP mirror 41/36. Base reads vault (BaseSameChainVerifier) —
// no Ethereum receipt trie.
// =============================================================================

const { expect } = require("chai");
const { ethers, network } = require("hardhat");
const { spawn } = require("child_process");
const {
  deployFive,
  ADDRESS_KEYS,
  BYTES32_KEYS,
  ASSET_SYMBOL,
} = require("../scripts/deploy-five.cjs");

/** Optional local anvil used as a fork cache so Hardhat does not hang on public L2 RPCs. */
let _anvilProc = null;
function stopAnvil() {
  if (_anvilProc && !_anvilProc.killed) {
    try { _anvilProc.kill("SIGTERM"); } catch (_) {}
  }
  _anvilProc = null;
}
process.on("exit", stopAnvil);
process.on("SIGINT", () => { stopAnvil(); process.exit(130); });
process.on("SIGTERM", () => { stopAnvil(); process.exit(143); });

const NONZERO_ADDRESS = "0x1111111111111111111111111111111111111111";
const NONZERO_BYTES32 =
  "0x2222222222222222222222222222222222222222222222222222222222222222";
const ZERO = "0x0000000000000000000000000000000000000000";
const DAY = 86400n;
const PRICE_MICRO_USD = 1_000_000n;
const DURATION = 30n * DAY;
const CUSTODY_CLASS = 3;
const EXPECTED_MINT = 1150n * 10n ** 18n;

const POLY_CHECKPOINT = "0x5555555555555555555555555555555555555555";
const POLY_HEADER_TOPIC = ethers.keccak256(
  ethers.toUtf8Bytes("NewHeaderBlock(address,uint256,uint256,uint256,uint256,bytes32)")
);
const POLY_L1_BLOCK = 7000;
const POLY_BOR_BLOCK = 1000;

const ARB_ROLLUP = "0xaaaa000000000000000000000000000000000001";
const ARB_CONFIRM_TOPIC = ethers.keccak256(
  ethers.toUtf8Bytes("AssertionConfirmed(bytes32,bytes32,bytes32)")
);
const ARB_SEND_ROOT = ethers.keccak256(ethers.toUtf8Bytes("send-root"));
const ARB_L1_BLOCK = 6000;

const OP_FACTORY = "0x5555555555555555555555555555555555555555";
const OP_GAME_PROXY = "0x6666666666666666666666666666666666666666";
const OP_CREATED_TOPIC = ethers.keccak256(
  ethers.toUtf8Bytes("DisputeGameCreated(address,uint32,bytes32)")
);
const OP_RESOLVED_TOPIC = ethers.keccak256(ethers.toUtf8Bytes("Resolved(uint8)"));
const OP_RESPECTED_GAME_TYPE = 0;
const OP_AIRGAP = 302400;
const OP_DEFENDER_WINS = 2;
const OP_CREATED_BLOCK = 8000;
const OP_RESOLVED_BLOCK = 8100;
const OP_LATEST_BLOCK = 9000;
const OP_VERSION = ethers.ZeroHash;
const OP_L2_STATE = ethers.keccak256(ethers.toUtf8Bytes("l2-state"));
const OP_MSG_PASSER = ethers.keccak256(ethers.toUtf8Bytes("msg-passer"));

/** Registry rows already registered by deployFive (S3 / custody class 3). */
const CASES = {
  polygon: {
    envId: "polygon",
    vaultKey: "polygon",
    cvKey: "polygon",
    cvName: "PolygonChainVerifier",
    row: 40,
    symbol: "USDC_POL",
    address: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
    decimals: 6,
    gross: 100n * 10n ** 6n,
    fund: 1000n * 10n ** 6n,
    expectedFee: 5_000_000n,
    expectedPrincipal: 95_000_000n,
    lockTag: "deploy-five-poly-usdc-row40-fork",
    label: "Polygon USDC_POL row40 fork",
    envRpcKeys: ["POLYGON_RPC_URL", "POLYGON_MAINNET_RPC_URL"],
    publicRpcs: [
      "https://gateway.tenderly.co/public/polygon",
      "https://polygon.drpc.org",
      "https://polygon-bor-rpc.publicnode.com",
      "https://polygon-bor.publicnode.com",
      "https://1rpc.io/matic",
    ],
    holderCandidates: [
      "0xBA12222222228d8Ba445958a75a0704d566BF2C8", // Balancer vault
      "0x625E7708f30cA75bfd92586e17077590C60eb4cD", // Aave aUSDC
      "0x6e7a5FAFcec6BB1e78bAE2A1F0B612012BF14827",
      "0x55CAaBB0d2b704FD0eF8192A7E35D8837e678207",
      "0xF977814e90dA44bFA03b6295A0616a897441aceC",
    ],
  },
  arbitrum: {
    envId: "arbitrum",
    vaultKey: "arbitrum",
    cvKey: "arbitrum",
    cvName: "ArbitrumChainVerifier",
    row: 11,
    symbol: "USDC_ARB",
    address: "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8",
    decimals: 6,
    gross: 100n * 10n ** 6n,
    fund: 1000n * 10n ** 6n,
    expectedFee: 5_000_000n,
    expectedPrincipal: 95_000_000n,
    lockTag: "deploy-five-arb-usdc-row11-fork",
    label: "Arbitrum USDC_ARB row11 fork",
    envRpcKeys: ["ARBITRUM_RPC_URL", "ARBITRUM_ONE_RPC_URL", "ARB_RPC_URL"],
    publicRpcs: [
      "https://arb1.arbitrum.io/rpc",
      "https://arbitrum.drpc.org",
      "https://gateway.tenderly.co/public/arbitrum",
      "https://arbitrum-one.publicnode.com",
      "https://1rpc.io/arb",
    ],
    holderCandidates: [
      "0x489ee077994B6658eAfA855C308275EAd8097C4A", // GMX
      "0xBA12222222228d8Ba445958a75a0704d566BF2C8",
      "0x625E7708f30cA75bfd92586e17077590C60eb4cD",
      "0x7F5c764cBc14f9669B88837ca1490cCa17c31607",
      "0x2Df1c51E09aECF9cacB7bc98cB1742757f163dF7",
      "0xF977814e90dA44bFA03b6295A0616a897441aceC",
    ],
  },
  optimism: {
    envId: "optimism",
    vaultKey: "optimism",
    cvKey: "optimism",
    cvName: "OpStackFaultProofVerifier",
    row: 26,
    symbol: "OP",
    address: "0x4200000000000000000000000000000000000042",
    decimals: 18,
    gross: 100n * 10n ** 18n,
    fund: 1000n * 10n ** 18n,
    expectedFee: 5n * 10n ** 18n,
    expectedPrincipal: 95n * 10n ** 18n,
    lockTag: "deploy-five-op-op-row26-fork",
    label: "Optimism OP row26 fork",
    envRpcKeys: ["OPTIMISM_RPC_URL", "OP_RPC_URL"],
    publicRpcs: [
      "https://gateway.tenderly.co/public/optimism",
      "https://mainnet.optimism.io",
      "https://optimism.publicnode.com",
      "https://optimism.drpc.org",
      "https://1rpc.io/op",
    ],
    holderCandidates: [
      "0xF977814e90dA44bFA03b6295A0616a897441aceC", // Binance 8
      "0xBA12222222228d8Ba445958a75a0704d566BF2C8",
      "0x8700dAec35aF8Ff88c16BdF0418774CB3D7599B4",
    ],
  },
  base: {
    envId: "base",
    vaultKey: "base",
    cvKey: "base",
    cvName: "BaseSameChainVerifier",
    row: 25,
    symbol: "CBETH",
    address: "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22",
    decimals: 18,
    gross: 100n * 10n ** 18n,
    fund: 1000n * 10n ** 18n,
    expectedFee: 5n * 10n ** 18n,
    expectedPrincipal: 95n * 10n ** 18n,
    lockTag: "deploy-five-base-cbeth-row25-fork",
    label: "Base CBETH row25 fork",
    envRpcKeys: ["BASE_RPC_URL", "BASE_MAINNET_RPC_URL"],
    publicRpcs: [
      "https://gateway.tenderly.co/public/base",
      "https://mainnet.base.org",
      "https://base.publicnode.com",
      "https://base.drpc.org",
      "https://1rpc.io/base",
    ],
    holderCandidates: [
      "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb", // Morpho Blue
      "0x498581fF718922c3f8e6A244956aF099B2652b2b",
      "0x9bb646bf0f4da44bfaf3d899e774de065731edfe",
      "0xBA12222222228d8Ba445958a75a0704d566BF2C8",
    ],
  },
};

function validEnv() {
  const env = {
    LAUNCH_TIMESTAMP: "1700000000",
    OPTIMISM_RESPECTED_GAME_TYPE: "0",
    OPTIMISM_GAME_FINALITY_DELAY_SECONDS: String(OP_AIRGAP),
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

// ---- RLP helpers (shared shape with 41/36) ---------------------------------

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
const word = (v) => ethers.zeroPadValue(ethers.toBeHex(BigInt(v)), 32).slice(2);
const topic32 = (v) => ethers.zeroPadValue(ethers.toBeHex(BigInt(v)), 32);

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

function buildHeader(receiptsRoot, salt) {
  const f = (b) => "a0" + b.slice(2);
  const body =
    f(ethers.keccak256(ethers.toUtf8Bytes("parent" + salt))) +
    f(ethers.keccak256(ethers.toUtf8Bytes("ommers"))) +
    "94" + "11".repeat(20) +
    f(ethers.keccak256(ethers.toUtf8Bytes("state"))) +
    f(ethers.keccak256(ethers.toUtf8Bytes("txs"))) +
    f(receiptsRoot);
  const len = body.length / 2;
  return "0x" + "f9" + len.toString(16).padStart(4, "0") + body;
}

function buildTrie(receiptHex) {
  const path = Uint8Array.from([0x20, 0x80]);
  const leaf = rlpList([rlpBytes(path), rlpBytes(receiptHex)]);
  return { root: ethers.keccak256(leaf), key: "0x80", proof: [hex(leaf)] };
}

function receiptFromHardhat(txReceipt) {
  const logs = txReceipt.logs.map((l) =>
    buildLog(l.address, [...l.topics], l.data)
  );
  return hex(buildReceipt({ status: 1, logs }));
}

function checkpointLeaf(blockNumber, blockTime, txRoot, receiptRoot) {
  return ethers.solidityPackedKeccak256(
    ["uint256", "uint256", "bytes32", "bytes32"],
    [blockNumber, blockTime, txRoot, receiptRoot]
  );
}

function buildCheckpointTree(leaf, sibling) {
  const root = ethers.solidityPackedKeccak256(["bytes32", "bytes32"], [leaf, sibling]);
  return { root, proof: [sibling] };
}

function encodePolygonProof(p) {
  return ethers.AbiCoder.defaultAbiCoder().encode(
    ["uint256", "bytes", "bytes", "bytes[]", "bytes",
     "uint256[2]", "bytes32[2]", "bytes32[]", "bytes", "bytes[]", "bytes"],
    [p.l1BlockNumber, p.l1Header, p.l1Key, p.l1Proof, p.l1Receipt,
     [p.borBlockNumber, p.borTime], [p.borTxRoot, p.borReceiptRoot],
     p.checkpointProof, p.borKey, p.borProof, p.borReceipt]
  );
}

function encodeArbitrumProof(p) {
  return ethers.AbiCoder.defaultAbiCoder().encode(
    ["uint256", "bytes", "bytes", "bytes[]", "bytes",
     "bytes", "bytes", "bytes[]", "bytes"],
    [p.l1BlockNumber, p.l1Header, p.l1Key, p.l1Proof, p.l1Receipt,
     p.l2Header, p.l2Key, p.l2Proof, p.l2Receipt]
  );
}

function outputRoot(version, stateRoot, msgPasser, blockHash) {
  return ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["bytes32", "bytes32", "bytes32", "bytes32"],
      [version, stateRoot, msgPasser, blockHash]
    )
  );
}

function encodeOpStackProof(p) {
  return ethers.AbiCoder.defaultAbiCoder().encode(
    ["uint256[2]", "bytes[3]", "bytes[3]", "bytes[][3]", "bytes[3]", "bytes32[4]"],
    [
      [p.createdBlockNumber, p.resolvedBlockNumber],
      [p.createdHeader, p.resolvedHeader, p.l2Header],
      [p.createdKey, p.resolvedKey, p.l2Key],
      [p.createdProof, p.resolvedProof, p.l2Proof],
      [p.createdReceipt, p.resolvedReceipt, p.l2Receipt],
      [p.version, p.stateRoot, p.msgPasser, p.l2BlockHash],
    ]
  );
}

/** BaseSameChainVerifier — vault-read proof (mirrors 13/41). No receipt trie. */
function encodeBaseVaultProof(record) {
  return ethers.AbiCoder.defaultAbiCoder().encode(
    ["bytes32", "uint256", "uint256", "uint256", "uint256", "uint256", "uint256"],
    [record.lockId, record.grossAmount, record.feeAmount, record.principalAmount,
     record.durationSecs, record.creationTime, record.maturityTime]
  );
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
 * Start a Hardhat fork of `asset`'s chain. Tries env RPC then public endpoints.
 * Throws with the last error if none can start the fork (caller must STOP).
 */
async function startChainFork(asset) {
  const candidates = [];
  for (const k of asset.envRpcKeys) {
    const envUrl = (process.env[k] || "").trim();
    if (envUrl && !candidates.includes(envUrl)) candidates.push(envUrl);
  }
  for (const u of asset.publicRpcs) {
    if (!candidates.includes(u)) candidates.push(u);
  }

  const errors = [];
  const anvilBin =
    (process.env.ANVIL_PATH || "").trim() ||
    require("path").join(require("os").homedir(), ".foundry", "bin", "anvil");
  const fs = require("fs");
  const hasAnvil = fs.existsSync(anvilBin);

  for (const url of candidates) {
    try {
      // Resolve a recent tip block first so public (non-archive) RPCs can
      // serve eth_getCode / eth_getStorageAt at a concrete blockNumber.
      let tip = null;
      try {
        const probe = new ethers.JsonRpcProvider(url, undefined, {
          staticNetwork: true,
        });
        tip = await Promise.race([
          probe.getBlockNumber(),
          new Promise((_, rej) =>
            setTimeout(() => rej(new Error("tip-timeout")), 10000)
          ),
        ]);
      } catch (probeErr) {
        tip = null;
      }

      const forkBlock =
        typeof tip === "number" && tip > 200 ? tip - 100 : undefined;

      // Prefer local anvil as the Hardhat fork upstream: anvil caches L2 state
      // so deployFive's many txs do not hang on rate-limited public RPCs.
      let hardhatForkUrl = url;
      if (hasAnvil && forkBlock !== undefined) {
        stopAnvil();
        const port = 8545 + (asset.row % 50);
        const args = [
          "--fork-url", url,
          "--fork-block-number", String(forkBlock),
          "--port", String(port),
          "--host", "127.0.0.1",
          "--accounts", "20",
          "--silent",
        ];
        _anvilProc = spawn(anvilBin, args, { stdio: "ignore" });
        // Wait until anvil serves eth_blockNumber.
        let ready = false;
        for (let i = 0; i < 60; i++) {
          await new Promise((r) => setTimeout(r, 500));
          try {
            const local = new ethers.JsonRpcProvider(
              `http://127.0.0.1:${port}`,
              undefined,
              { staticNetwork: true }
            );
            const bn = await Promise.race([
              local.getBlockNumber(),
              new Promise((_, rej) =>
                setTimeout(() => rej(new Error("anvil-wait")), 1000)
              ),
            ]);
            if (typeof bn === "number") {
              ready = true;
              break;
            }
          } catch (_) {}
        }
        if (!ready) {
          stopAnvil();
          throw new Error(`anvil failed to start for ${url} at block ${forkBlock}`);
        }
        hardhatForkUrl = `http://127.0.0.1:${port}`;
      }

      const forkParams = { jsonRpcUrl: hardhatForkUrl };
      if (forkBlock !== undefined && hardhatForkUrl === url) {
        // Pin when Hardhat talks to the public RPC directly.
        forkParams.blockNumber = forkBlock;
      }

      await network.provider.request({
        method: "hardhat_reset",
        params: [{ forking: forkParams }],
      });
      const block = await ethers.provider.getBlock("latest");
      const code = await ethers.provider.getCode(asset.address);
      if (!code || code === "0x") {
        throw new Error(
          `${asset.symbol} has no code at ${asset.address} after fork of ${url}`
        );
      }
      // Bump the Hardhat deployer nonce so CREATE addresses do not collide
      // with contracts already live on the forked L2 (those collisions force
      // remote eth_getStorageAt and can hang public RPCs mid-deployFive).
      const [deployer] = await ethers.getSigners();
      const nonce = await ethers.provider.getTransactionCount(deployer.address);
      const targetNonce = nonce + 1024;
      await network.provider.send("hardhat_setNonce", [
        deployer.address,
        "0x" + targetNonce.toString(16),
      ]);
      return {
        rpcUrl: url,
        forkBlockNumber: block.number,
        viaAnvil: hardhatForkUrl !== url,
      };
    } catch (e) {
      stopAnvil();
      errors.push(`${url}: ${e && e.message ? e.message : String(e)}`);
    }
  }
  const msg =
    `FATAL: could not start ${asset.label} Hardhat fork.\n` +
    errors.map((e) => `  - ${e}`).join("\n");
  throw new Error(msg);
}

/**
 * Impersonate an existing on-chain holder on the fork and transfer `amount`
 * to `user`. Never uses hardhat_setCode / hardhat_setStorageAt on the asset.
 */
async function fundUserFromHolder(token, user, amount, holderCandidates) {
  let holder = null;
  for (const raw of holderCandidates) {
    const addr = ethers.getAddress(raw.toLowerCase());
    const bal = await token.balanceOf(addr);
    if (bal >= amount) {
      holder = addr;
      break;
    }
  }
  if (!holder) {
    throw new Error(
      `No known holder on fork has >= ${amount} raw units among candidates`
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
  await token.connect(whale).transfer(user.address, amount);
  await network.provider.request({
    method: "hardhat_stopImpersonatingAccount",
    params: [holder],
  });
  return holder;
}

/**
 * Deploy tokens + MockL1/registry, then deployFive with chain-specific env
 * overrides. Protocol finalize is the test's responsibility.
 */
async function deployFiveStack(configureEnv) {
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
  env.ETHEREUM_LOCK_EVENT_TOPIC = TOPIC;
  env.POLYGON_LOCK_EVENT_TOPIC = TOPIC;
  env.ARBITRUM_LOCK_EVENT_TOPIC = TOPIC;
  env.OPTIMISM_LOCK_EVENT_TOPIC = TOPIC;

  configureEnv(env, {
    registry: await registry.getAddress(),
    topic: TOPIC,
  });

  const out = await deployFive(ethers, env);

  const verifier = await ethers.getContractAt(
    "VinculumFinalisVerifier",
    out.verifier
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

  // Protocol finalize ONLY on this local fork — never on live chain.
  await verifier.finalize();

  return {
    publisher, user, relayer, boundDestination,
    ethDevFund, polyDevFund, arbDevFund, opDevFund, baseDevFund,
    vclm, mockL1, registry, TOPIC,
    verifier, out, env,
  };
}

async function submitPrice(s, aid) {
  const ts = (await ethers.provider.getBlock("latest")).timestamp;
  const sig = await signBatch(
    s.verifier, s.publisher, 1n, [aid], [PRICE_MICRO_USD], ts
  );
  await s.verifier.submitPriceBatch(1n, [aid], [PRICE_MICRO_USD], ts, sig);
}

async function assertMintEarlyRevertAndRelease(s, {
  envId, chainVerifier, aid, asset, token, record, lockEventProof,
  commitmentVaultLockId, tag,
}) {
  expect(record.principalAmount).to.equal(asset.expectedPrincipal);
  expect(record.feeAmount).to.equal(asset.expectedFee);
  expect(await token.balanceOf(record.lockContract)).to.equal(asset.expectedPrincipal);

  const [finalized] = await chainVerifier.verifyFinality(lockEventProof, "0x");
  expect(finalized).to.equal(true);

  const pkg = {
    sourceEnvironmentId: envId,
    commitmentVaultLockId,
    handshakeIdentity: `${envId}:${s.user.address.toLowerCase()}`,
    handshakeAllowanceCount: record.handshakeAllowanceCount,
    canonicalAssetId: aid,
    assetPrecision: asset.decimals,
    assetCustodyClass: CUSTODY_CLASS,
    grossAmountSmallestUnits: record.grossAmount,
    actualFeeAmountSmallestUnits: record.feeAmount,
    principalAmountSmallestUnits: record.principalAmount,
    feeAssetId: aid,
    devFundDestination: (
      envId === "polygon" ? s.polyDevFund :
      envId === "arbitrum" ? s.arbDevFund :
      envId === "optimism" ? s.opDevFund :
      s.baseDevFund
    ).address.toLowerCase(),
    feeTransferEvidence: ethers.keccak256(ethers.toUtf8Bytes(`fee-${tag}`)),
    valuationTimestamp: Number(record.creationTime),
    maturityTimestamp: Number(record.maturityTime),
    durationSecs: record.durationSecs,
    selectedOutputToken: 0,
    baseRecipient: record.baseRecipient,
    releaseDestination: s.boundDestination.address.toLowerCase(),
    chonxActivationReceipt: "0x",
    racIdentity: ethers.keccak256(ethers.toUtf8Bytes(`rac-${tag}`)),
    sourceFinalityProof: "0x",
    lockEventProof,
  };

  const before = await s.vclm.balanceOf(s.user.address);
  await s.verifier.connect(s.relayer).recordFeeAndRac(pkg);
  await s.verifier.connect(s.relayer).verifyAndMint(pkg);
  const minted = await s.vclm.balanceOf(s.user.address) - before;
  console.log(
    `\n    deployFive ${asset.label}: minted ${ethers.formatUnits(minted, 18)} VCLM\n`
  );
  expect(minted).to.equal(EXPECTED_MINT);

  const lock = await ethers.getContractAt("CommitmentLock", record.lockContract);
  await expect(lock.release()).to.be.revertedWithCustomError(lock, "NotMature");

  await ethers.provider.send("evm_increaseTime", [Number(DURATION)]);
  await ethers.provider.send("evm_mine", []);

  const destBefore = await token.balanceOf(s.boundDestination.address);
  await lock.connect(s.relayer).release();
  expect(await token.balanceOf(record.lockContract)).to.equal(0n);
  expect(await token.balanceOf(s.boundDestination.address) - destBefore)
    .to.equal(asset.expectedPrincipal);
}

async function prepareLiveToken(asset, user) {
  // Real live token on the fork — do NOT hardhat_setCode / setStorageAt.
  const token = await ethers.getContractAt("MockERC20", asset.address);
  const liveDecimals = await token.decimals();
  expect(liveDecimals).to.equal(asset.decimals);
  expect(Number(liveDecimals)).to.equal(asset.decimals);

  const whale = await fundUserFromHolder(
    token, user, asset.fund, asset.holderCandidates
  );
  console.log(
    `    funded user from holder ${whale} (impersonation on fork)\n`
  );
  expect(await token.balanceOf(user.address)).to.equal(asset.fund);
  return token;
}

// =============================================================================
// Polygon row 40 — USDC_POL live fork
// =============================================================================

describe("43_deploy_five — Polygon USDC_POL mainnet-fork (real USDC, no setCode)", function () {
  it("locks 100 real USDC_POL on fork, mints 1150 VCLM, Dev Fund 5_000_000, releases 95_000_000", async function () {
    this.timeout(900000);
    const asset = CASES.polygon;

    let forkMeta;
    try {
      forkMeta = await startChainFork(asset);
    } catch (e) {
      console.error("\n" + (e && e.message ? e.message : String(e)) + "\n");
      throw e;
    }
    console.log(
      `\n    fork RPC: ${forkMeta.rpcUrl}\n` +
      `    fork block: ${forkMeta.forkBlockNumber}\n`
    );

    const s = await deployFiveStack((env, { registry }) => {
      env.POLYGON_REGISTRY = registry;
      env.POLYGON_CHECKPOINT_CONTRACT = POLY_CHECKPOINT;
      env.POLYGON_HEADER_BLOCK_TOPIC = POLY_HEADER_TOPIC;
    });

    const vaultAddr = s.out.vaults.polygon;
    const vault = await ethers.getContractAt("VinculumFinalisEvmVault", vaultAddr);
    const polyVerifier = await ethers.getContractAt(
      "PolygonChainVerifier",
      s.out.chainVerifiers.polygon
    );

    const AID = ethers.keccak256(
      ethers.toUtf8Bytes(`${asset.envId}:${asset.symbol}`)
    );
    expect(await vault.approvedAsset(asset.address)).to.equal(AID);
    const precKey = ethers.solidityPackedKeccak256(
      ["string", "bytes32"],
      [asset.envId, AID]
    );
    const prec = await s.verifier.assetPrecisionTable(precKey);
    expect(prec.decimals).to.equal(asset.decimals);
    expect(prec.custodyClass).to.equal(CUSTODY_CLASS);

    const token = await prepareLiveToken(asset, s.user);
    await submitPrice(s, AID);
    await token.connect(s.user).approve(vaultAddr, asset.fund);

    const vaultLockId = ethers.keccak256(ethers.toUtf8Bytes(asset.lockTag));
    const devBefore = await token.balanceOf(s.polyDevFund.address);
    const tx = await vault.connect(s.user).createLock({
      lockId: vaultLockId,
      asset: asset.address,
      grossAmount: asset.gross,
      durationSecs: DURATION,
      baseRecipient: s.user.address,
      releaseDestination: s.boundDestination.address,
      outputToken: 0,
      chonxActivationReceipt: ethers.ZeroHash,
    });
    const txReceipt = await tx.wait();
    const record = await vault.getLock(vaultLockId);
    expect(await token.balanceOf(s.polyDevFund.address) - devBefore)
      .to.equal(asset.expectedFee);

    const borReceipt = receiptFromHardhat(txReceipt);
    const borTrie = buildTrie(borReceipt);
    const borTime = Number(record.creationTime);
    const borTxRoot = ethers.keccak256(ethers.toUtf8Bytes("bor-tx-root"));

    const leaf = checkpointLeaf(POLY_BOR_BLOCK, borTime, borTxRoot, borTrie.root);
    const sibling = ethers.keccak256(ethers.toUtf8Bytes("sibling-leaf"));
    const tree = buildCheckpointTree(leaf, sibling);

    const start = POLY_BOR_BLOCK;
    const end = POLY_BOR_BLOCK + 10;
    const ckLog = buildLog(
      POLY_CHECKPOINT,
      [POLY_HEADER_TOPIC,
       ethers.zeroPadValue("0x01", 32),
       ethers.zeroPadValue("0x02", 32),
       ethers.zeroPadValue("0x03", 32)],
      "0x" + word(start) + word(end) + tree.root.slice(2)
    );
    const l1Receipt = hex(buildReceipt({ status: 1, logs: [ckLog] }));
    const l1Trie = buildTrie(l1Receipt);
    const l1Header = buildHeader(l1Trie.root, "l1");

    await s.mockL1.set(POLY_L1_BLOCK, ethers.keccak256(l1Header), borTime);
    await s.registry.record();

    const lockEventProof = encodePolygonProof({
      l1BlockNumber: POLY_L1_BLOCK,
      l1Header,
      l1Key: l1Trie.key,
      l1Proof: l1Trie.proof,
      l1Receipt,
      borBlockNumber: POLY_BOR_BLOCK,
      borTime,
      borTxRoot,
      borReceiptRoot: borTrie.root,
      checkpointProof: tree.proof,
      borKey: borTrie.key,
      borProof: borTrie.proof,
      borReceipt,
    });

    const commitmentVaultLockId = ethers.solidityPackedKeccak256(
      ["string", "address", "bytes32"],
      [asset.envId, vaultAddr, vaultLockId]
    );

    await assertMintEarlyRevertAndRelease(s, {
      envId: asset.envId,
      chainVerifier: polyVerifier,
      aid: AID,
      asset,
      token,
      record,
      lockEventProof,
      commitmentVaultLockId,
      tag: asset.lockTag,
    });

    console.log(`FORK_BLOCK_NUMBER_POLYGON=${forkMeta.forkBlockNumber}`);
  });
});

// =============================================================================
// Arbitrum row 11 — USDC_ARB live fork
// =============================================================================

describe("43_deploy_five — Arbitrum USDC_ARB mainnet-fork (real USDC, no setCode)", function () {
  it("locks 100 real USDC_ARB on fork, mints 1150 VCLM, Dev Fund 5_000_000, releases 95_000_000", async function () {
    this.timeout(900000);
    const asset = CASES.arbitrum;

    let forkMeta;
    try {
      forkMeta = await startChainFork(asset);
    } catch (e) {
      console.error("\n" + (e && e.message ? e.message : String(e)) + "\n");
      throw e;
    }
    console.log(
      `\n    fork RPC: ${forkMeta.rpcUrl}\n` +
      `    fork block: ${forkMeta.forkBlockNumber}\n`
    );

    const s = await deployFiveStack((env, { registry }) => {
      env.ARBITRUM_REGISTRY = registry;
      env.ARBITRUM_ROLLUP_CONTRACT = ARB_ROLLUP;
      env.ARBITRUM_ASSERTION_CONFIRMED_TOPIC = ARB_CONFIRM_TOPIC;
    });

    const vaultAddr = s.out.vaults.arbitrum;
    const vault = await ethers.getContractAt("VinculumFinalisEvmVault", vaultAddr);
    const arbVerifier = await ethers.getContractAt(
      "ArbitrumChainVerifier",
      s.out.chainVerifiers.arbitrum
    );

    const AID = ethers.keccak256(
      ethers.toUtf8Bytes(`${asset.envId}:${asset.symbol}`)
    );
    expect(await vault.approvedAsset(asset.address)).to.equal(AID);
    const precKey = ethers.solidityPackedKeccak256(
      ["string", "bytes32"],
      [asset.envId, AID]
    );
    const prec = await s.verifier.assetPrecisionTable(precKey);
    expect(prec.decimals).to.equal(asset.decimals);
    expect(prec.custodyClass).to.equal(CUSTODY_CLASS);

    const token = await prepareLiveToken(asset, s.user);
    await submitPrice(s, AID);
    await token.connect(s.user).approve(vaultAddr, asset.fund);

    const vaultLockId = ethers.keccak256(ethers.toUtf8Bytes(asset.lockTag));
    const devBefore = await token.balanceOf(s.arbDevFund.address);
    const tx = await vault.connect(s.user).createLock({
      lockId: vaultLockId,
      asset: asset.address,
      grossAmount: asset.gross,
      durationSecs: DURATION,
      baseRecipient: s.user.address,
      releaseDestination: s.boundDestination.address,
      outputToken: 0,
      chonxActivationReceipt: ethers.ZeroHash,
    });
    const txReceipt = await tx.wait();
    const record = await vault.getLock(vaultLockId);
    expect(await token.balanceOf(s.arbDevFund.address) - devBefore)
      .to.equal(asset.expectedFee);

    const l2Receipt = receiptFromHardhat(txReceipt);
    const l2Trie = buildTrie(l2Receipt);
    const l2Header = buildHeader(l2Trie.root, "arb-l2");
    const l2BlockHash = ethers.keccak256(l2Header);

    const confirmLog = buildLog(
      ARB_ROLLUP,
      [ARB_CONFIRM_TOPIC, ethers.keccak256(ethers.toUtf8Bytes("assertion"))],
      l2BlockHash + ARB_SEND_ROOT.slice(2)
    );
    const l1Receipt = hex(buildReceipt({ status: 1, logs: [confirmLog] }));
    const l1Trie = buildTrie(l1Receipt);
    const l1Header = buildHeader(l1Trie.root, "arb-l1");

    await s.mockL1.set(ARB_L1_BLOCK, ethers.keccak256(l1Header), Number(record.creationTime));
    await s.registry.record();

    const lockEventProof = encodeArbitrumProof({
      l1BlockNumber: ARB_L1_BLOCK,
      l1Header,
      l1Key: l1Trie.key,
      l1Proof: l1Trie.proof,
      l1Receipt,
      l2Header,
      l2Key: l2Trie.key,
      l2Proof: l2Trie.proof,
      l2Receipt,
    });

    const commitmentVaultLockId = ethers.solidityPackedKeccak256(
      ["string", "address", "bytes32"],
      [asset.envId, vaultAddr, vaultLockId]
    );

    await assertMintEarlyRevertAndRelease(s, {
      envId: asset.envId,
      chainVerifier: arbVerifier,
      aid: AID,
      asset,
      token,
      record,
      lockEventProof,
      commitmentVaultLockId,
      tag: asset.lockTag,
    });

    console.log(`FORK_BLOCK_NUMBER_ARBITRUM=${forkMeta.forkBlockNumber}`);
  });
});

// =============================================================================
// Optimism row 26 — OP live fork
// =============================================================================

describe("43_deploy_five — Optimism OP mainnet-fork (real OP, no setCode)", function () {
  it("locks 100 real OP on fork, mints 1150 VCLM, Dev Fund 5e18, releases 95e18", async function () {
    this.timeout(900000);
    const asset = CASES.optimism;

    let forkMeta;
    try {
      forkMeta = await startChainFork(asset);
    } catch (e) {
      console.error("\n" + (e && e.message ? e.message : String(e)) + "\n");
      throw e;
    }
    console.log(
      `\n    fork RPC: ${forkMeta.rpcUrl}\n` +
      `    fork block: ${forkMeta.forkBlockNumber}\n`
    );

    const s = await deployFiveStack((env, { registry }) => {
      env.OPTIMISM_REGISTRY = registry;
      env.OPTIMISM_DISPUTE_GAME_FACTORY = OP_FACTORY;
      env.OPTIMISM_GAME_CREATED_TOPIC = OP_CREATED_TOPIC;
      env.OPTIMISM_GAME_RESOLVED_TOPIC = OP_RESOLVED_TOPIC;
      env.OPTIMISM_RESPECTED_GAME_TYPE = String(OP_RESPECTED_GAME_TYPE);
      env.OPTIMISM_GAME_FINALITY_DELAY_SECONDS = String(OP_AIRGAP);
    });

    const vaultAddr = s.out.vaults.optimism;
    const vault = await ethers.getContractAt("VinculumFinalisEvmVault", vaultAddr);
    const opVerifier = await ethers.getContractAt(
      "OpStackFaultProofVerifier",
      s.out.chainVerifiers.optimism
    );

    const AID = ethers.keccak256(
      ethers.toUtf8Bytes(`${asset.envId}:${asset.symbol}`)
    );
    expect(await vault.approvedAsset(asset.address)).to.equal(AID);
    const precKey = ethers.solidityPackedKeccak256(
      ["string", "bytes32"],
      [asset.envId, AID]
    );
    const prec = await s.verifier.assetPrecisionTable(precKey);
    expect(prec.decimals).to.equal(asset.decimals);
    expect(prec.custodyClass).to.equal(CUSTODY_CLASS);

    const token = await prepareLiveToken(asset, s.user);
    await submitPrice(s, AID);
    await token.connect(s.user).approve(vaultAddr, asset.fund);

    const vaultLockId = ethers.keccak256(ethers.toUtf8Bytes(asset.lockTag));
    const devBefore = await token.balanceOf(s.opDevFund.address);
    const tx = await vault.connect(s.user).createLock({
      lockId: vaultLockId,
      asset: asset.address,
      grossAmount: asset.gross,
      durationSecs: DURATION,
      baseRecipient: s.user.address,
      releaseDestination: s.boundDestination.address,
      outputToken: 0,
      chonxActivationReceipt: ethers.ZeroHash,
    });
    const txReceipt = await tx.wait();
    const record = await vault.getLock(vaultLockId);
    expect(await token.balanceOf(s.opDevFund.address) - devBefore)
      .to.equal(asset.expectedFee);

    const createdTs = Number(record.creationTime);
    const resolvedTs = createdTs + 3600;

    const l2Receipt = receiptFromHardhat(txReceipt);
    const l2Trie = buildTrie(l2Receipt);
    const l2Header = buildHeader(l2Trie.root, "fp-l2");
    const l2BlockHash = ethers.keccak256(l2Header);
    const claim = outputRoot(OP_VERSION, OP_L2_STATE, OP_MSG_PASSER, l2BlockHash);

    const createdLog = buildLog(
      OP_FACTORY,
      [
        OP_CREATED_TOPIC,
        ethers.zeroPadValue(OP_GAME_PROXY, 32),
        topic32(OP_RESPECTED_GAME_TYPE),
        claim,
      ],
      "0x"
    );
    const createdReceipt = hex(buildReceipt({ status: 1, logs: [createdLog] }));
    const createdTrie = buildTrie(createdReceipt);
    const createdHeader = buildHeader(createdTrie.root, "fp-created");

    const resolvedLog = buildLog(
      OP_GAME_PROXY,
      [OP_RESOLVED_TOPIC, topic32(OP_DEFENDER_WINS)],
      "0x"
    );
    const resolvedReceipt = hex(buildReceipt({ status: 1, logs: [resolvedLog] }));
    const resolvedTrie = buildTrie(resolvedReceipt);
    const resolvedHeader = buildHeader(resolvedTrie.root, "fp-resolved");

    await s.mockL1.set(OP_CREATED_BLOCK, ethers.keccak256(createdHeader), createdTs);
    await s.registry.record();
    await s.mockL1.set(OP_RESOLVED_BLOCK, ethers.keccak256(resolvedHeader), resolvedTs);
    await s.registry.record();
    await s.mockL1.set(
      OP_LATEST_BLOCK,
      ethers.keccak256(ethers.toUtf8Bytes("later")),
      resolvedTs + OP_AIRGAP
    );
    await s.registry.record();

    const lockEventProof = encodeOpStackProof({
      createdBlockNumber: OP_CREATED_BLOCK,
      createdHeader,
      createdKey: createdTrie.key,
      createdProof: createdTrie.proof,
      createdReceipt,
      resolvedBlockNumber: OP_RESOLVED_BLOCK,
      resolvedHeader,
      resolvedKey: resolvedTrie.key,
      resolvedProof: resolvedTrie.proof,
      resolvedReceipt,
      version: OP_VERSION,
      stateRoot: OP_L2_STATE,
      msgPasser: OP_MSG_PASSER,
      l2BlockHash,
      l2Header,
      l2Key: l2Trie.key,
      l2Proof: l2Trie.proof,
      l2Receipt,
    });

    const commitmentVaultLockId = ethers.solidityPackedKeccak256(
      ["string", "address", "bytes32"],
      [asset.envId, vaultAddr, vaultLockId]
    );

    await assertMintEarlyRevertAndRelease(s, {
      envId: asset.envId,
      chainVerifier: opVerifier,
      aid: AID,
      asset,
      token,
      record,
      lockEventProof,
      commitmentVaultLockId,
      tag: asset.lockTag,
    });

    console.log(`FORK_BLOCK_NUMBER_OPTIMISM=${forkMeta.forkBlockNumber}`);
  });
});

// =============================================================================
// Base row 25 — CBETH live fork (BaseSameChainVerifier reads vault)
// =============================================================================

describe("43_deploy_five — Base CBETH mainnet-fork (real cbETH, no setCode)", function () {
  it("locks 100 real cbETH on fork, BaseSameChainVerifier reads vault, mints 1150 VCLM, releases 95e18", async function () {
    this.timeout(900000);
    const asset = CASES.base;

    let forkMeta;
    try {
      forkMeta = await startChainFork(asset);
    } catch (e) {
      console.error("\n" + (e && e.message ? e.message : String(e)) + "\n");
      throw e;
    }
    console.log(
      `\n    fork RPC: ${forkMeta.rpcUrl}\n` +
      `    fork block: ${forkMeta.forkBlockNumber}\n`
    );

    // Base needs no L1 registry override — BaseSameChainVerifier reads the vault.
    const s = await deployFiveStack(() => {});

    const vaultAddr = s.out.vaults.base;
    const vault = await ethers.getContractAt("VinculumFinalisBaseVault", vaultAddr);
    const baseVerifier = await ethers.getContractAt(
      "BaseSameChainVerifier",
      s.out.chainVerifiers.base
    );
    expect(await baseVerifier.vault()).to.equal(vaultAddr);

    const AID = ethers.keccak256(
      ethers.toUtf8Bytes(`${asset.envId}:${asset.symbol}`)
    );
    expect(await vault.approvedAsset(asset.address)).to.equal(AID);
    const precKey = ethers.solidityPackedKeccak256(
      ["string", "bytes32"],
      [asset.envId, AID]
    );
    const prec = await s.verifier.assetPrecisionTable(precKey);
    expect(prec.decimals).to.equal(asset.decimals);
    expect(prec.custodyClass).to.equal(CUSTODY_CLASS);

    const token = await prepareLiveToken(asset, s.user);
    await submitPrice(s, AID);
    await token.connect(s.user).approve(vaultAddr, asset.fund);

    const vaultLockId = ethers.keccak256(ethers.toUtf8Bytes(asset.lockTag));
    const devBefore = await token.balanceOf(s.baseDevFund.address);
    // Base vault uses commitVaultLock (not createLock).
    await vault.connect(s.user).commitVaultLock({
      lockId: vaultLockId,
      asset: asset.address,
      grossAmount: asset.gross,
      durationSecs: DURATION,
      baseRecipient: s.user.address,
      releaseDestination: s.boundDestination.address,
      outputToken: 0,
      chonxActivationReceipt: ethers.ZeroHash,
    });
    const record = await vault.getLock(vaultLockId);
    expect(await token.balanceOf(s.baseDevFund.address) - devBefore)
      .to.equal(asset.expectedFee);

    // Base reads the vault — do NOT build Ethereum receipt trie.
    const lockEventProof = encodeBaseVaultProof(record);
    // Same-chain commitment id is the raw lock id (mirrors 13).
    const commitmentVaultLockId = record.lockId;

    await assertMintEarlyRevertAndRelease(s, {
      envId: asset.envId,
      chainVerifier: baseVerifier,
      aid: AID,
      asset,
      token,
      record,
      lockEventProof,
      commitmentVaultLockId,
      tag: asset.lockTag,
    });

    console.log(`FORK_BLOCK_NUMBER_BASE=${forkMeta.forkBlockNumber}`);
  });
});
