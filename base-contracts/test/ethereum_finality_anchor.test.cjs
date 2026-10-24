// Ethereum finality anchor (EthereumStorageLockReader, BaseBeaconRootAnchor,
// EvmStorageProof). Local Hardhat chain only: nothing is deployed, signed or
// broadcast to any public network.
//
// Data used:
// - REAL: test/fixtures/ethereum_finality_anchor_mainnet.json, captured
//   read-only from public endpoints by tools/proof-builder/eth_anchor.mjs:
//   a Base mainnet EIP-4788 entry, the Ethereum beacon headers and SSZ
//   branches under it, and eth_getProof for the live Ethereum lock at the
//   finalized block. The live lock holds no record yet (no LockCreated log
//   on Ethereum), so real data proves the anchor, the account, the code pin
//   and the environment slot, and that an absent record is refused.
// - SYNTHETIC (labelled in each test): a lock created on the local Hardhat
//   chain, proven with Hardhat's eth_getProof, under a locally built SSZ
//   tree (BeaconBlockBody and BeaconState branches) that uses the mainnet
//   genesis validators root and the Fulu fork version. The local 4788
//   contract is the real runtime code from Base with a locally written entry.
const { expect } = require("chai");
const { ethers, network } = require("hardhat");
const { sparseTree } = require("./lib/beaconLc.cjs");
const { beaconRoot } = require("./lib/execHeader.cjs");
const F = require("./fixtures/ethereum_finality_anchor_mainnet.json");

const coder = ethers.AbiCoder.defaultAbiCoder();
// SSZ uint64 leaf: little-endian, right-padded to 32 bytes.
function uintLE(v, bytes = 8) {
  let n = BigInt(v);
  const out = new Uint8Array(32);
  for (let i = 0; i < bytes; i++) { out[i] = Number(n & 0xffn); n >>= 8n; }
  return ethers.hexlify(out);
}
const BEACON_ROOTS = "0x000F3df6D732807Ef1319fB7B8bB8522d0Beac02";
const MAINNET_GVR = "0x4b363db94e286120d76eb905340fdd4e54bfe9f06bf33ff6cf5ad27f511bfe95";
const SEPOLIA_GVR = "0xd8ea171f3c94aea21ebc42a1ed61052acf3f9209c00e4efbaaddac09ed9b8078";
const FULU = "0x0600000000000000000000000000000000000000000000000000000000000000";
const DENEB = "0x0400000000000000000000000000000000000000000000000000000000000000";
const ELECTRA_FIRST_SLOT = 11649024n;
const LIVE_LOCK_BUILD_HASH = "0x07b599f652faf1dc71881209566f73e8fff4762486e6dbe9ff95060fe49c8594";
const LIVE_LOCK_DEVFUND_OFFSETS = [2483, 4258, 5105];
const MANIFEST_NON_BASE_LOCK_HASH = "0x96b653727a7a2d279c91ea8647a5104aeee1844590b4f72b258eb193f5eec6b0";
const ETH_ID = "0xde7085290190e1f2f7f2f83d26fa72e411f9d765ddd608a77e8a7c388113943b";
const SCALE = 10n ** 18n, DAY7 = 604800n;
const RECORD_WORDS = [0, 2, 3, 4, 5, 6, 7, 9, 10, 13];

const HEADER = "tuple(uint64 slot,uint64 proposerIndex,bytes32 parentRoot,bytes32 stateRoot,bytes32 bodyRoot)";
const ANCHOR = `tuple(uint256 baseTimestamp,${HEADER} attested,bytes32[] gvrBranch,bytes32 forkVersion,` +
  `bytes32[] forkVersionBranch,bytes32 finalizedRoot,bytes32[] finalizedRootBranch,${HEADER} finalized,` +
  `bytes32 executionStateRoot,bytes32[] executionStateRootBranch,uint64 executionBlockNumber,` +
  `bytes32[] executionBlockNumberBranch,bytes32 executionBlockHash,bytes32[] executionBlockHashBranch)`;
const LOCKP = "tuple(bytes32 lockId,bytes[] accountProof,bytes[] environmentSlotProof,bytes[][10] recordWordProofs," +
  "bytes[] bindingFirstWordProof)";

const clone = (x) => JSON.parse(JSON.stringify(x, (k, v) => (typeof v === "bigint" ? v.toString() : v)));
const hdr = (h) => ({ slot: BigInt(h.slot), proposerIndex: BigInt(h.proposerIndex), parentRoot: h.parentRoot, stateRoot: h.stateRoot, bodyRoot: h.bodyRoot });
const flip = (hex) => { const b = ethers.getBytes(hex); b[b.length - 1] ^= 1; return ethers.hexlify(b); };
const flipNode = (hex, at) => { const b = ethers.getBytes(hex); b[at] ^= 1; return ethers.hexlify(b); };
const encAnchor = (a) => coder.encode([ANCHOR], [a]);
const encPkg = (a, l) => coder.encode([ANCHOR, LOCKP], [a, l]);

// ---- REAL data (fixture) ----
function realAnchor(payloadOf = F.finalized.payload, finHeader = F.finalized.header) {
  const s = F.attested.state;
  return {
    baseTimestamp: BigInt(F.base.timestamp),
    attested: hdr(F.attested.header),
    gvrBranch: s.gvr.branch, forkVersion: s.forkVersion.leaf, forkVersionBranch: s.forkVersion.branch,
    finalizedRoot: s.finalizedRoot.leaf, finalizedRootBranch: s.finalizedRoot.branch,
    finalized: hdr(finHeader),
    executionStateRoot: payloadOf.stateRoot.leaf, executionStateRootBranch: payloadOf.stateRoot.branch,
    executionBlockNumber: BigInt(payloadOf.number), executionBlockNumberBranch: payloadOf.blockNumber.branch,
    executionBlockHash: payloadOf.blockHash.leaf, executionBlockHashBranch: payloadOf.blockHash.branch,
  };
}
function realLockProof(proof = F.lock.proof, lockId = F.lock.lockId) {
  const sp = proof.storageProof;
  const word = (i) => (sp[1 + i] || sp[1] || sp[0]).proof;
  return {
    lockId, accountProof: proof.accountProof, environmentSlotProof: sp[0].proof,
    recordWordProofs: RECORD_WORDS.map((w) => word(w)), bindingFirstWordProof: (sp[1] || sp[0]).proof,
  };
}

async function install4788(ts, root) {
  await network.provider.send("hardhat_setCode", [BEACON_ROOTS, F.base.beaconRoots.code]);
  const i = BigInt(ts) % 8191n;
  await network.provider.send("hardhat_setStorageAt", [BEACON_ROOTS, ethers.toBeHex(i), ethers.toBeHex(BigInt(ts), 32)]);
  await network.provider.send("hardhat_setStorageAt", [BEACON_ROOTS, ethers.toBeHex(i + 8191n), root]);
}

async function deployLiveReader(lockAddr = F.lock.address, code = F.lock.code, hash = LIVE_LOCK_BUILD_HASH) {
  return (await ethers.getContractFactory("EthereumStorageLockReader")).deploy(lockAddr, code, LIVE_LOCK_DEVFUND_OFFSETS, hash);
}

// ---- SYNTHETIC beacon tree around a local execution block ----
function syntheticAnchor(exec, ts, opt = {}) {
  const body = sparseTree({ 802: exec.stateRoot, 806: uintLE(exec.number), 812: exec.hash }, "SYNTHETIC body");
  const finalized = {
    slot: opt.finalizedSlot ?? ELECTRA_FIRST_SLOT + 4000000n, proposerIndex: 7n,
    parentRoot: ethers.id("SYNTHETIC parent"), stateRoot: ethers.id("SYNTHETIC finalized state"), bodyRoot: body.root,
  };
  const F_ = beaconRoot(finalized);
  const gvr = opt.gvr ?? MAINNET_GVR, fork = opt.fork ?? FULU;
  const state = sparseTree({ 65: gvr, 269: fork, 169: F_ }, "SYNTHETIC state");
  const attested = {
    slot: finalized.slot + 70n, proposerIndex: 9n, parentRoot: ethers.id("SYNTHETIC attested parent"),
    stateRoot: state.root, bodyRoot: ethers.id("SYNTHETIC attested body"),
  };
  return {
    root: beaconRoot(attested),
    anchor: {
      baseTimestamp: BigInt(ts), attested,
      gvrBranch: state.branch(65), forkVersion: fork, forkVersionBranch: state.branch(269),
      finalizedRoot: F_, finalizedRootBranch: state.branch(169), finalized,
      executionStateRoot: exec.stateRoot, executionStateRootBranch: body.branch(802),
      executionBlockNumber: BigInt(exec.number), executionBlockNumberBranch: body.branch(806),
      executionBlockHash: exec.hash, executionBlockHashBranch: body.branch(812),
    },
  };
}

function devFundOffsets(code, addr) {
  const h = code.slice(2).toLowerCase(), w = ethers.zeroPadValue(addr, 32).slice(2).toLowerCase();
  const out = []; let i = -1;
  while ((i = h.indexOf(w, i + 1)) >= 0) if (i % 2 === 0) out.push(i / 2);
  return out;
}
function maskedHash(code, offs) {
  const b = ethers.getBytes(code).slice();
  for (const o of offs) b.fill(0, o, o + 32);
  return ethers.keccak256(b);
}

async function localLockProof(lockAddr, lockId, blockTag) {
  const base = BigInt(ethers.keccak256(coder.encode(["bytes32", "uint256"], [lockId, 1])));
  const dataSlot = ethers.keccak256(coder.encode(["uint256"], [base + 13n]));
  const slots = [ethers.toBeHex(0, 32), ...RECORD_WORDS.map((w) => ethers.toBeHex(base + BigInt(w), 32)), dataSlot];
  const p = await network.provider.send("eth_getProof", [lockAddr, slots, blockTag]);
  return {
    lockId, accountProof: p.accountProof, environmentSlotProof: p.storageProof[0].proof,
    recordWordProofs: RECORD_WORDS.map((_, i) => p.storageProof[1 + i].proof),
    bindingFirstWordProof: p.storageProof[11].proof,
  };
}

// A local lock plus a reader pinned to it. SYNTHETIC: local Hardhat chain.
async function deployLocalLock(envId = "Ethereum") {
  const [, recipient, other, dest, devFund] = await ethers.getSigners();
  const lock = await (await ethers.getContractFactory("CommitmentVaultLock")).deploy(envId, devFund.address);
  const code = await ethers.provider.getCode(await lock.getAddress());
  const offs = devFundOffsets(code, devFund.address);
  const reader = await (await ethers.getContractFactory("EthereumStorageLockReader")).deploy(
    await lock.getAddress(), code, offs, maskedHash(code, offs)
  );
  return { lock, reader, devFund, recipient, dest, other, code, offs };
}

// Creates one native record, proves it at its block, and anchors that block
// under a local SSZ tree with a local 4788 entry. An empty block is mined
// first, because hardhat_setStorageAt rewrites the latest block's state in
// place and the record block's state root must stay as proven.
async function createLocalRecord(s, create) {
  const lockId = ethers.hexlify(ethers.randomBytes(32));
  const tx = create ? await create(s, lockId) : await s.lock.connect(s.other).createNativeLock(
    lockId, s.recipient.address, 0, ETH_ID, ethers.ZeroHash, s.dest.address, DAY7, 2392n * SCALE / 100n,
    { value: SCALE / 100n }
  );
  const rc = await tx.wait();
  const block = await network.provider.send("eth_getBlockByNumber", [ethers.toQuantity(rc.blockNumber), false]);
  const lockProof = await localLockProof(await s.lock.getAddress(), lockId, block.number);
  await network.provider.send("evm_mine", []);
  const ts = (await ethers.provider.getBlock("latest")).timestamp - 30;
  const syn = syntheticAnchor({ stateRoot: block.stateRoot, number: BigInt(block.number), hash: block.hash }, ts);
  await install4788(ts, syn.root);
  return Object.assign(s, { lockId, block, lockProof, syn });
}

async function localSetup(envId = "Ethereum") {
  return createLocalRecord(await deployLocalLock(envId));
}

// ---- A local Base Verifier around the Ethereum reader (SYNTHETIC local chain) ----
const { buildTokenAddressIndex } = require("../scripts/buildTokenAddressIndex.cjs");
const { loadRegistry } = require("../scripts/registryFile.cjs");
const REG = loadRegistry().written;
const TOKEN_INDEX = buildTokenAddressIndex();
const tokenIdx = (env, sym) => TOKEN_INDEX.entries.find((e) => e.environmentId === env && e.symbol === sym);
const regRow = (n) => { const e = REG.find((x) => x.row === n); return [e.environmentId, e.canonicalAssetId, e.symbol, e.decimals, e.custodyClass, e.custodyPath]; };
const ETH_USDC = tokenIdx("Ethereum", "USDC"); // Revision B row, Ethereum token
const BASE_AERO = tokenIdx("Base", "AERO");    // Revision B row, Base token
const ETH_PRICE = 2392n * SCALE, ETH_PRICE_LATER = 2500n * SCALE;
const BTC_SCRIPT = "0x76a914" + "11".repeat(20) + "88ac"; // SYNTHETIC P2PKH Dev Fund script

// Deploys VCLM, CHONX, Stake, a Base lock and reader, the Verifier with the
// Ethereum reader under "Ethereum", the same reader misregistered under
// "Optimism" (a wrong-network registration), and the Bitcoin reader under
// "Bitcoin" (a non-EVM environment). Prices are posted and the Verifier is
// finalized BEFORE any lock is created, so a price is in effect at creation.
async function verifierFor(s) {
  const [deployer] = await ethers.getSigners();
  const T = await ethers.getContractFactory("VinculumFinalisToken");
  const vclm = await T.deploy("Vinculum", "VCLM", 10_000_000_000n * SCALE);
  const chonx = await T.deploy("Chonx", "CHONX", 100_000_000_000n * SCALE);
  const verifier = await (await ethers.getContractFactory("VinculumFinalisVerifier")).deploy(await vclm.getAddress(), await chonx.getAddress());
  const stake = await (await ethers.getContractFactory("VinculumFinalisStake")).deploy(
    await vclm.getAddress(), await chonx.getAddress(), await vclm.getAddress(), await verifier.getAddress()
  );
  await vclm.initialize(await verifier.getAddress(), await stake.getAddress());
  await chonx.initialize(await verifier.getAddress(), ethers.ZeroAddress);
  const baseLock = await (await ethers.getContractFactory("BaseCommitmentVaultLock")).deploy(
    "Base", s.devFund.address, await vclm.getAddress(), await chonx.getAddress(), await vclm.getAddress()
  );
  const baseReader = await (await ethers.getContractFactory("BaseLockRecordVerifier")).deploy(await baseLock.getAddress());
  const btcReader = await (await ethers.getContractFactory("BitcoinLockReader")).deploy(BTC_SCRIPT);
  await verifier.registerChainVerifier("Base", await baseReader.getAddress());
  await verifier.registerChainVerifier("Ethereum", await s.reader.getAddress());
  await verifier.registerChainVerifier("Optimism", await s.reader.getAddress());
  await verifier.registerChainVerifier("Bitcoin", await btcReader.getAddress());
  await verifier.registerAssetPrecisionBatch([
    ["Base", ETH_ID, "ETH", 18, 2, 0], ["Ethereum", ETH_ID, "ETH", 18, 2, 0], ["Optimism", ETH_ID, "ETH", 18, 2, 0],
    regRow(ETH_USDC.row), regRow(BASE_AERO.row),
  ]);
  await verifier.registerTokenAddressBatch([ETH_USDC, BASE_AERO].map((t) => ({ environmentId: t.environmentId, token: t.token, canonicalAssetId: t.canonicalAssetId })));
  for (const env of ["Base", "Ethereum", "Optimism"]) await verifier.configureDevFund(env, s.devFund.address);
  await verifier.setScheduledPricePoster(deployer.address);
  await verifier.applyScheduledPriceRun(1n, [
    { environmentId: "Base", canonicalAssetId: ETH_ID, priceUsd18: ETH_PRICE, success: true },
    { environmentId: "Ethereum", canonicalAssetId: ETH_ID, priceUsd18: ETH_PRICE, success: true },
    { environmentId: "Optimism", canonicalAssetId: ETH_ID, priceUsd18: ETH_PRICE, success: true },
    { environmentId: "Ethereum", canonicalAssetId: ETH_USDC.canonicalAssetId, priceUsd18: SCALE, success: true },
    { environmentId: "Base", canonicalAssetId: BASE_AERO.canonicalAssetId, priceUsd18: SCALE, success: true },
  ]);
  await verifier.finalize();
  return Object.assign(s, { verifier, vclm, deployer });
}

// The package a relayer would submit for record `rec` of lock s.
function pkgFor(s, rec, over = {}) {
  const lockEventProof = "lockEventProof" in over ? over.lockEventProof : encPkg(s.syn.anchor, s.lockProof);
  return Object.assign({
    sourceEnvironmentId: "Ethereum", commitmentVaultLockId: s.lockId, handshakeAllowanceCount: 3,
    canonicalAssetId: ETH_ID, assetPrecision: 18, assetCustodyClass: 2,
    grossAmountSmallestUnits: rec.gross, actualFeeAmountSmallestUnits: rec.fee,
    principalAmountSmallestUnits: rec.principal, feeAssetId: ETH_ID, devFundDestination: "dev",
    feeTransferEvidence: ethers.id("fee"), valuationTimestamp: rec.createdAt, maturityTimestamp: rec.maturity,
    durationSecs: rec.duration, selectedOutputToken: 0, baseRecipient: s.recipient.address,
    releaseDestination: "release", chonxActivationReceipt: "0x",
    racIdentity: ethers.hexlify(ethers.randomBytes(32)), priceRecord: "0x",
    sourceFinalityProof: "0x", lockEventProof,
  }, over);
}
const reanchor = (s, syn = s.syn) => install4788(syn.anchor.baseTimestamp, syn.root);

// A local lock record plus a local Verifier, ready to submit. SYNTHETIC.
async function verifiedSetup(create) {
  const s = await verifierFor(await deployLocalLock());
  await createLocalRecord(s, create);
  s.rec = await s.lock.lockRecord(s.lockId);
  return s;
}

// An ERC20 lock on the local Ethereum lock for a token whose runtime is
// placed at `tokenAddr` (SYNTHETIC: the fixture ERC20 code at that address).
async function tokenLockAt(tokenAddr, amount) {
  return async (s, lockId) => {
    const tmpl = await (await ethers.getContractFactory("ProtocolCopyFixtureERC20")).deploy("Fixture", "FIX");
    await network.provider.send("hardhat_setCode", [tokenAddr, await ethers.provider.getCode(await tmpl.getAddress())]);
    const tok = await ethers.getContractAt("ProtocolCopyFixtureERC20", tokenAddr);
    await tok.mint(s.other.address, amount);
    await tok.connect(s.other).approve(await s.lock.getAddress(), amount);
    return s.lock.connect(s.other).createErc20Lock(
      lockId, s.recipient.address, 0, ethers.ZeroHash, ethers.ZeroHash, s.dest.address, DAY7, tokenAddr, amount, 50n * SCALE
    );
  };
}

describe("Ethereum finality anchor: EthereumStorageLockReader (local chain only)", function () {
  describe("REAL mainnet data: Base EIP-4788 anchor to the Ethereum finalized checkpoint", function () {
    let reader;
    beforeEach(async () => {
      await install4788(F.base.timestamp, F.base.parentBeaconBlockRoot);
      reader = await deployLiveReader();
    });

    it("fixture self-check: Base parentBeaconBlockRoot equals the 4788 entry and the attested root", async () => {
      expect(F.base.parentBeaconBlockRoot).to.equal(F.attested.root);
      expect(F.base.beaconRoots.slots[ethers.toQuantity(BigInt(F.base.timestamp) % 8191n + 8191n)]).to.equal(F.attested.root);
      expect(beaconRoot(hdr(F.attested.header))).to.equal(F.attested.root);
      expect(beaconRoot(hdr(F.finalized.header))).to.equal(F.finalized.root);
    });

    it("accepts the real anchor and returns the real finalized execution block", async () => {
      const f = await reader.finalizedExecution(encAnchor(realAnchor()));
      expect(f.blockNumber).to.equal(BigInt(F.finalized.rpcCrossCheck.number));
      expect(f.blockHash).to.equal(F.finalized.rpcCrossCheck.hash);
      expect(f.stateRoot).to.equal(F.finalized.rpcCrossCheck.stateRoot);
      expect(f.beaconSlot).to.equal(BigInt(F.finalized.header.slot));
    });

    it("pins the live lock build: reviewed build hash and Dev Fund read from its code", async () => {
      expect(await reader.lockCodeHash()).to.equal(F.lock.proof.codeHash);
      expect(await reader.devFund()).to.equal(ethers.getAddress(F.lock.devFund));
      await expect(deployLiveReader(F.lock.address, F.lock.code, MANIFEST_NON_BASE_LOCK_HASH))
        .to.be.revertedWith("reader: lock build not reviewed");
    });

    it("proves the live lock account, code and Ethereum environment slot, then refuses: no record exists", async () => {
      const pkg = encPkg(realAnchor(), realLockProof());
      await expect(reader.extractFacts(pkg)).to.be.revertedWith("VF-XCH-011: Ethereum lock record absent");
      await expect(reader.verifyFinality(pkg, "0x")).to.be.revertedWith("VF-XCH-011: Ethereum lock record absent");
      await expect(reader.lockDevFund("Ethereum", pkg)).to.be.revertedWith("VF-XCH-011: Ethereum lock record absent");
    });
  });

  describe("forged-header test set (VF-XCH-006, VF-XCH-008, VF-XCH-010): every one must be refused", function () {
    let reader;
    beforeEach(async () => {
      await install4788(F.base.timestamp, F.base.parentBeaconBlockRoot);
      reader = await deployLiveReader();
    });
    const refuse = async (a, msg) => expect(reader.finalizedExecution(encAnchor(a))).to.be.revertedWith(msg);

    it("FH-01 forged attested header (well-formed, never existed: proposer changed) [REAL base]", async () => {
      const a = realAnchor(); a.attested.proposerIndex += 1n;
      await refuse(a, "VF-XCH-006: attested header not anchored on Base");
    });
    it("FH-02 forged attested header with a self-consistent forged state tree [SYNTHETIC tree, REAL 4788 entry]", async () => {
      // A full fake beacon state that claims mainnet, Fulu and a finalized root:
      // it hashes perfectly, but it is not the root Base recorded.
      const syn = syntheticAnchor({ stateRoot: F.finalized.payload.stateRoot.leaf, number: 26264666n, hash: F.finalized.payload.blockHash.leaf }, F.base.timestamp);
      await refuse(syn.anchor, "VF-XCH-006: attested header not anchored on Base");
    });
    it("FH-03 forged finalized header (well-formed, never existed: state root changed) [REAL]", async () => {
      const a = realAnchor(); a.finalized.stateRoot = ethers.id("forged");
      await refuse(a, "VF-XCH-006: header is not the finalized checkpoint");
    });
    it("FH-04 non-finalized head block offered as finalized (the attested head itself) [REAL]", async () => {
      const a = realAnchor(F.attested.payload, F.attested.header);
      await refuse(a, "VF-XCH-006: header is not the finalized checkpoint");
    });
    it("FH-05 real finalized header with the head block's execution payload [REAL]", async () => {
      const a = realAnchor(F.attested.payload, F.finalized.header);
      await refuse(a, "VF-XCH-006: execution state root proof");
    });
    it("FH-06 lock proof taken at the head block against the finalized anchor [REAL]", async () => {
      const pkg = encPkg(realAnchor(), realLockProof(F.lock.proofAtHead));
      await expect(reader.extractFacts(pkg)).to.be.revertedWith("mpt root");
    });
    it("FH-07 Base timestamp with no 4788 entry [REAL]", async () => {
      const a = realAnchor(); a.baseTimestamp += 1n;
      await refuse(a, "VF-XCH-006: no Base EIP-4788 beacon root for timestamp");
    });
    it("FH-08 tampered SSZ branches, one sibling at a time [REAL]", async () => {
      const cases = [
        ["gvrBranch", "VF-XCH-006: not Ethereum mainnet (genesis validators root)"],
        ["forkVersionBranch", "VF-XCH-006: fork version proof"],
        ["finalizedRootBranch", "VF-XCH-006: finalized checkpoint proof"],
        ["executionStateRootBranch", "VF-XCH-006: execution state root proof"],
        ["executionBlockNumberBranch", "VF-XCH-006: execution block number proof"],
        ["executionBlockHashBranch", "VF-XCH-006: execution block hash proof"],
      ];
      for (const [k, msg] of cases) {
        for (const i of [0, 3]) {
          const a = realAnchor(); a[k] = [...a[k]]; a[k][i] = flip(a[k][i]);
          await refuse(a, msg);
        }
        const a = realAnchor(); a[k] = a[k].slice(0, -1);
        await expect(reader.finalizedExecution(encAnchor(a))).to.be.reverted;
      }
    });
    it("FH-09 tampered execution fields (state root, number, hash) [REAL]", async () => {
      let a = realAnchor(); a.executionStateRoot = flip(a.executionStateRoot);
      await refuse(a, "VF-XCH-006: execution state root proof");
      a = realAnchor(); a.executionBlockNumber += 1n;
      await refuse(a, "VF-XCH-006: execution block number proof");
      a = realAnchor(); a.executionBlockHash = flip(a.executionBlockHash);
      await refuse(a, "VF-XCH-006: execution block hash proof");
    });
    it("FH-10 tampered account and storage MPT nodes [REAL]", async () => {
      const lp = realLockProof();
      for (const i of [0, 3, lp.accountProof.length - 1]) {
        const t = clone(lp); t.accountProof[i] = flipNode(t.accountProof[i], 40);
        await expect(reader.extractFacts(encPkg(realAnchor(), t))).to.be.reverted;
      }
      const t = clone(lp); t.environmentSlotProof[0] = flipNode(t.environmentSlotProof[0], 10);
      await expect(reader.extractFacts(encPkg(realAnchor(), t))).to.be.revertedWith("mpt root");
      const u = clone(lp); u.accountProof = u.accountProof.slice(0, -1);
      await expect(reader.extractFacts(encPkg(realAnchor(), u))).to.be.reverted;
    });
    it("FH-11 genuine finalized header, account that is not the lock (WETH) [REAL]", async () => {
      const lp = realLockProof(); lp.accountProof = F.nonLock.proof.accountProof;
      await expect(reader.extractFacts(encPkg(realAnchor(), lp))).to.be.reverted;
      // A reader pinned to WETH's address still refuses: WETH is not the reviewed lock code.
      const r2 = await deployLiveReader(F.nonLock.address);
      const lp2 = realLockProof(F.nonLock.proof);
      await expect(r2.extractFacts(encPkg(realAnchor(), lp2))).to.be.revertedWith("VF-XCH-011: account is not the pinned lock code");
    });
    it("FH-12 genuine finalized header, retired Ethereum lock instead of the pinned lock [REAL]", async () => {
      for (const old of F.retiredLocks) {
        const lp = realLockProof(old.proof);
        await expect(reader.extractFacts(encPkg(realAnchor(), lp))).to.be.reverted;
        const r2 = await deployLiveReader(old.address);
        await expect(r2.extractFacts(encPkg(realAnchor(), lp))).to.be.revertedWith("VF-XCH-011: account is not the pinned lock code");
      }
    });
    it("FH-13 wrong beacon network: Sepolia genesis validators root [SYNTHETIC tree]", async () => {
      const ts = BigInt(F.base.timestamp) + 100n;
      const syn = syntheticAnchor({ stateRoot: ethers.id("s"), number: 5n, hash: ethers.id("h") }, ts, { gvr: SEPOLIA_GVR });
      await install4788(ts, syn.root);
      await refuse(syn.anchor, "VF-XCH-006: not Ethereum mainnet (genesis validators root)");
    });
    it("FH-14 unsupported fork version (Deneb layout) and pre-Electra finalized block [SYNTHETIC tree]", async () => {
      const ts = BigInt(F.base.timestamp) + 200n;
      let syn = syntheticAnchor({ stateRoot: ethers.id("s"), number: 5n, hash: ethers.id("h") }, ts, { fork: DENEB });
      await install4788(ts, syn.root);
      await refuse(syn.anchor, "VF-XCH-006: unsupported beacon fork");
      syn = syntheticAnchor({ stateRoot: ethers.id("s"), number: 5n, hash: ethers.id("h") }, ts, { finalizedSlot: ELECTRA_FIRST_SLOT - 1n });
      await install4788(ts, syn.root);
      await refuse(syn.anchor, "VF-XCH-006: finalized block before Electra");
    });
    it("FH-15 a separate finality proof is refused: the anchor must travel in lockEventProof [REAL]", async () => {
      const pkg = encPkg(realAnchor(), realLockProof());
      await expect(reader.verifyFinality(pkg, "0x01")).to.be.revertedWith("VF-XCH-006: anchor is carried in lockEventProof");
    });
  });

  describe("SYNTHETIC full lock: a record created on the local chain under a local SSZ tree", function () {
    it("accepts the anchored lock and returns the proven facts, asset and Dev Fund", async () => {
      const s = await localSetup();
      const pkg = encPkg(s.syn.anchor, s.lockProof);
      const [ok, h, n] = await s.reader.verifyFinality(pkg, "0x");
      expect(ok).to.equal(true);
      expect(h).to.equal(s.block.hash);
      expect(n).to.equal(BigInt(s.block.number));
      const rec = await s.lock.lockRecord(s.lockId);
      const f = await s.reader.extractFacts(pkg);
      expect(f[0]).to.equal(s.lockId);
      expect([f[1], f[2], f[3], f[4], f[5], f[6]]).to.deep.equal([rec.gross, rec.fee, rec.principal, rec.duration, rec.createdAt, rec.maturity]);
      expect(f[7]).to.equal(s.recipient.address);
      expect(f[8]).to.equal(0n);
      expect(await s.reader.extractAssetId(pkg)).to.equal(ETH_ID);
      expect(await s.reader.lockDevFund("Ethereum", pkg)).to.equal(s.devFund.address);
      await expect(s.reader.lockDevFund("Base", pkg)).to.be.revertedWith("VF-FEE-009: environment");
      const gas = await s.reader.verifyFinality.estimateGas(pkg, "0x");
      console.log(`      verifyFinality gas (synthetic full lock): ${gas}`);
    });

    it("refuses a real record under the head block when the anchor's finalized block is older", async () => {
      // SYNTHETIC: the anchor's finalized block is the block BEFORE the lock was created.
      const s = await localSetup();
      const prev = await network.provider.send("eth_getBlockByNumber", [ethers.toQuantity(BigInt(s.block.number) - 1n), false]);
      const ts = BigInt(s.syn.anchor.baseTimestamp) - 5n;
      const syn = syntheticAnchor({ stateRoot: prev.stateRoot, number: BigInt(prev.number), hash: prev.hash }, ts);
      await install4788(ts, syn.root);
      await expect(s.reader.extractFacts(encPkg(syn.anchor, s.lockProof))).to.be.revertedWith("mpt root");
      // And a proof taken at the finalized block shows the record did not exist yet.
      const atFinal = await localLockProof(await s.lock.getAddress(), s.lockId, prev.number);
      await expect(s.reader.extractFacts(encPkg(syn.anchor, atFinal))).to.be.revertedWith("VF-XCH-011: Ethereum lock record absent");
    });

    it("refuses a real record tied to another lock contract with the same code", async () => {
      // SYNTHETIC: two locks with identical code and Dev Fund; the reader is pinned to A.
      const a = await localSetup();
      const CVL = await ethers.getContractFactory("CommitmentVaultLock");
      const b = await CVL.deploy("Ethereum", a.devFund.address);
      const id = ethers.hexlify(ethers.randomBytes(32));
      const rc = await (await b.connect(a.other).createNativeLock(
        id, a.recipient.address, 0, ETH_ID, ethers.ZeroHash, a.dest.address, DAY7, 2392n * SCALE / 100n, { value: SCALE / 100n }
      )).wait();
      const blk = await network.provider.send("eth_getBlockByNumber", [ethers.toQuantity(rc.blockNumber), false]);
      expect(await ethers.provider.getCode(await b.getAddress())).to.equal(a.code);
      const proofB = await localLockProof(await b.getAddress(), id, blk.number);
      const proofAforB = await localLockProof(await a.lock.getAddress(), id, blk.number);
      await network.provider.send("evm_mine", []);
      const ts = BigInt(a.syn.anchor.baseTimestamp) + 7n;
      const syn = syntheticAnchor({ stateRoot: blk.stateRoot, number: BigInt(blk.number), hash: blk.hash }, ts);
      await install4788(ts, syn.root);
      // B's genuine record, proven against B's account, is not the pinned lock A.
      await expect(a.reader.extractFacts(encPkg(syn.anchor, proofB))).to.be.reverted;
      await expect(a.reader.extractFacts(encPkg(syn.anchor, proofAforB))).to.be.revertedWith("VF-XCH-011: Ethereum lock record absent");
    });

    it("refuses a lock record from the wrong network (lock environment Optimism)", async () => {
      // SYNTHETIC: same code and Dev Fund, environmentId "Optimism".
      const s = await localSetup("Optimism");
      await expect(s.reader.extractFacts(encPkg(s.syn.anchor, s.lockProof))).to.be.revertedWith("VF-XCH-011: lock environment is not Ethereum");
    });

    it("refuses a lock id that has no record, and a record proof with a swapped word", async () => {
      const s = await localSetup();
      const other = await localLockProof(await s.lock.getAddress(), ethers.id("no such lock"), s.block.number);
      await expect(s.reader.extractFacts(encPkg(s.syn.anchor, other))).to.be.revertedWith("VF-XCH-011: Ethereum lock record absent");
      const t = clone(s.lockProof); [t.recordWordProofs[3], t.recordWordProofs[4]] = [t.recordWordProofs[4], t.recordWordProofs[3]];
      await expect(s.reader.extractFacts(encPkg(s.syn.anchor, t))).to.be.reverted;
      const u = clone(s.lockProof); u.lockId = ethers.id("other id");
      await expect(s.reader.extractFacts(encPkg(s.syn.anchor, u))).to.be.reverted;
    });

    it("end to end on a local Verifier: records the fee and RAC and mints once", async () => {
      // SYNTHETIC local chain: local token, Verifier and Stake; nothing leaves Hardhat.
      const s = await deployLocalLock();
      const [deployer] = await ethers.getSigners();
      const T = await ethers.getContractFactory("VinculumFinalisToken");
      const vclm = await T.deploy("Vinculum", "VCLM", 10_000_000_000n * SCALE);
      const chonx = await T.deploy("Chonx", "CHONX", 100_000_000_000n * SCALE);
      const verifier = await (await ethers.getContractFactory("VinculumFinalisVerifier")).deploy(await vclm.getAddress(), await chonx.getAddress());
      const stake = await (await ethers.getContractFactory("VinculumFinalisStake")).deploy(
        await vclm.getAddress(), await chonx.getAddress(), await vclm.getAddress(), await verifier.getAddress()
      );
      await vclm.initialize(await verifier.getAddress(), await stake.getAddress());
      await chonx.initialize(await verifier.getAddress(), ethers.ZeroAddress);
      const baseLock = await (await ethers.getContractFactory("BaseCommitmentVaultLock")).deploy(
        "Base", s.devFund.address, await vclm.getAddress(), await chonx.getAddress(), await vclm.getAddress()
      );
      const baseReader = await (await ethers.getContractFactory("BaseLockRecordVerifier")).deploy(await baseLock.getAddress());
      await verifier.registerChainVerifier("Base", await baseReader.getAddress());
      await verifier.registerAssetPrecision("Base", ETH_ID, "ETH", 18, 2, 0);
      await verifier.configureDevFund("Base", s.devFund.address);
      await verifier.registerChainVerifier("Ethereum", await s.reader.getAddress());
      await verifier.registerAssetPrecision("Ethereum", ETH_ID, "ETH", 18, 2, 0);
      await verifier.configureDevFund("Ethereum", s.devFund.address);
      await verifier.setScheduledPricePoster(deployer.address);
      await verifier.applyScheduledPriceRun(1n, [
        { environmentId: "Base", canonicalAssetId: ETH_ID, priceUsd18: 2392n * SCALE, success: true },
        { environmentId: "Ethereum", canonicalAssetId: ETH_ID, priceUsd18: 2392n * SCALE, success: true },
      ]);
      await verifier.finalize();
      await createLocalRecord(s);
      const rec = await s.lock.lockRecord(s.lockId);
      const p = {
        sourceEnvironmentId: "Ethereum", commitmentVaultLockId: s.lockId, handshakeAllowanceCount: 3,
        canonicalAssetId: ETH_ID, assetPrecision: 18, assetCustodyClass: 2,
        grossAmountSmallestUnits: rec.gross, actualFeeAmountSmallestUnits: rec.fee,
        principalAmountSmallestUnits: rec.principal, feeAssetId: ETH_ID, devFundDestination: "dev",
        feeTransferEvidence: ethers.id("fee"), valuationTimestamp: rec.createdAt, maturityTimestamp: rec.maturity,
        durationSecs: rec.duration, selectedOutputToken: 0, baseRecipient: s.recipient.address,
        releaseDestination: "release", chonxActivationReceipt: "0x",
        racIdentity: ethers.hexlify(ethers.randomBytes(32)), priceRecord: "0x",
        sourceFinalityProof: "0x", lockEventProof: encPkg(s.syn.anchor, s.lockProof),
      };
      const g = await verifier.recordFeeAndRac.estimateGas(p);
      console.log(`      recordFeeAndRac gas (synthetic full lock): ${g}`);
      await verifier.recordFeeAndRac(p);
      await install4788(s.syn.anchor.baseTimestamp, s.syn.root);
      await verifier.verifyAndMint(p, 0);
      expect(await vclm.balanceOf(s.recipient.address)).to.be.gt(0n);
      expect(await verifier.isLockRacRecorded("Ethereum", s.lockId)).to.equal(true);
      await install4788(s.syn.anchor.baseTimestamp, s.syn.root);
      await expect(verifier.verifyAndMint(p, 0)).to.be.reverted;
    });
  });

  // Revision 15 Section 3 (operator text t349u). Each test runs through a
  // local Base Verifier (recordFeeAndRac / verifyAndMint), not the reader
  // alone. SYNTHETIC unless marked REAL: no Vinculum lock record exists on
  // Ethereum mainnet, so the accepted lock is a local record under a local
  // SSZ tree with the real Base EIP-4788 runtime code.
  describe("Rev 15 Section 3 mandatory test set (through a local Base Verifier)", function () {
    it("accept a real anchored lock and produce a mint on Base [SYNTHETIC lock and beacon tree; no real Ethereum lock exists]", async () => {
      const s = await verifiedSetup();
      const p = pkgFor(s, s.rec);
      await reanchor(s); await s.verifier.recordFeeAndRac(p);
      await reanchor(s); await s.verifier.verifyAndMint(p, 0);
      expect(await s.vclm.balanceOf(s.recipient.address)).to.be.gt(0n);
      expect(await s.verifier.isLockRacRecorded("Ethereum", s.lockId)).to.equal(true);
    });
    it("supporting REAL data for the accept test: the real mainnet anchor passes the Verifier up to the record, then is refused as record absent (no Ethereum lock exists yet)", async () => {
      // REAL: the Base 4788 entry, beacon headers and the live lock's proofs.
      // The Verifier calls the live-pinned reader; the anchor, the account,
      // the code pin and the environment all pass; the record is absent.
      const s = await deployLocalLock();
      s.reader = await deployLiveReader();
      await verifierFor(s);
      await install4788(F.base.timestamp, F.base.parentBeaconBlockRoot);
      const z = { gross: 1n, fee: 0n, principal: 1n, createdAt: 1n, maturity: 1n, duration: DAY7 };
      const p = pkgFor(s, z, { commitmentVaultLockId: F.lock.lockId, lockEventProof: encPkg(realAnchor(), realLockProof()) });
      await expect(s.verifier.recordFeeAndRac(p)).to.be.revertedWith("VF-XCH-011: Ethereum lock record absent");
    });
    it("reject correctly formatted header not in settled history", async () => {
      const s = await verifiedSetup();
      const ok = s.syn.anchor;
      // (a) forged attested header: well-formed, Base never recorded it.
      const a = clone(ok); a.attested.proposerIndex = BigInt(a.attested.proposerIndex) + 1n;
      await reanchor(s);
      await expect(s.verifier.recordFeeAndRac(pkgFor(s, s.rec, { lockEventProof: encPkg(a, s.lockProof) })))
        .to.be.revertedWith("VF-XCH-006: attested header not anchored on Base");
      // (b) forged finalized header: well-formed, not the finalized checkpoint.
      const b = clone(ok); b.finalized.stateRoot = ethers.id("forged");
      await expect(s.verifier.recordFeeAndRac(pkgFor(s, s.rec, { lockEventProof: encPkg(b, s.lockProof) })))
        .to.be.revertedWith("VF-XCH-006: header is not the finalized checkpoint");
      // (c) a fully self-consistent forged beacon tree (claims mainnet, Fulu,
      // a finalized root) whose root Base never recorded.
      const forged = syntheticAnchor({ stateRoot: s.block.stateRoot, number: BigInt(s.block.number), hash: s.block.hash }, s.syn.anchor.baseTimestamp, { finalizedSlot: ELECTRA_FIRST_SLOT + 4000001n });
      await expect(s.verifier.recordFeeAndRac(pkgFor(s, s.rec, { lockEventProof: encPkg(forged.anchor, s.lockProof) })))
        .to.be.revertedWith("VF-XCH-006: attested header not anchored on Base");
      // (d) the record is real but newer than the anchor's finalized block.
      const prev = await network.provider.send("eth_getBlockByNumber", [ethers.toQuantity(BigInt(s.block.number) - 1n), false]);
      const ts = BigInt(ok.baseTimestamp) - 5n;
      const older = syntheticAnchor({ stateRoot: prev.stateRoot, number: BigInt(prev.number), hash: prev.hash }, ts);
      await install4788(ts, older.root);
      await expect(s.verifier.recordFeeAndRac(pkgFor(s, s.rec, { lockEventProof: encPkg(older.anchor, s.lockProof) })))
        .to.be.revertedWith("mpt root");
      // (e) REAL: the forged-header test set FH-01 to FH-15 covers real headers at the reader.
    });
    it("reject header containing a tx that never created a Vinculum lock", async () => {
      const s = await verifiedSetup();
      await reanchor(s);
      // A lock id with no record, proven against the genuine anchored block.
      const none = await localLockProof(await s.lock.getAddress(), ethers.id("never created"), s.block.number);
      await expect(s.verifier.recordFeeAndRac(pkgFor(s, s.rec, { commitmentVaultLockId: ethers.id("never created"), lockEventProof: encPkg(s.syn.anchor, none) })))
        .to.be.revertedWith("VF-XCH-011: Ethereum lock record absent");
      // The anchored block's other activity: an account that is not a lock.
      const notLock = await localLockProof(s.other.address, s.lockId, s.block.number);
      await expect(s.verifier.recordFeeAndRac(pkgFor(s, s.rec, { lockEventProof: encPkg(s.syn.anchor, notLock) }))).to.be.reverted;
      expect(await s.verifier.isLockRacRecorded("Ethereum", s.lockId)).to.equal(false);
    });
    it("reject wrong lock contract or wrong asset (wrong lock contract)", async () => {
      // A second lock with identical code and Dev Fund; the reader is pinned to A.
      const s = await verifierFor(await deployLocalLock());
      const b = await (await ethers.getContractFactory("CommitmentVaultLock")).deploy("Ethereum", s.devFund.address);
      const lockB = s.lock; s.lock = b;
      await createLocalRecord(s);
      s.rec = await b.lockRecord(s.lockId); s.lock = lockB;
      expect(await ethers.provider.getCode(await b.getAddress())).to.equal(s.code);
      await reanchor(s);
      await expect(s.verifier.recordFeeAndRac(pkgFor(s, s.rec))).to.be.reverted;
      const aForB = await localLockProof(await s.lock.getAddress(), s.lockId, s.block.number);
      await expect(s.verifier.recordFeeAndRac(pkgFor(s, s.rec, { lockEventProof: encPkg(s.syn.anchor, aForB) })))
        .to.be.revertedWith("VF-XCH-011: Ethereum lock record absent");
    });
    it("reject wrong lock contract or wrong asset (wrong asset)", async () => {
      // Native ETH lock claimed as Ethereum USDC.
      const s = await verifiedSetup();
      await reanchor(s);
      await expect(s.verifier.recordFeeAndRac(pkgFor(s, s.rec, { canonicalAssetId: ETH_USDC.canonicalAssetId, assetPrecision: 6, assetCustodyClass: 1, feeAssetId: ETH_USDC.canonicalAssetId })))
        .to.be.revertedWith("VF-XCH-011: asset mismatch");
      // Ethereum USDC token lock claimed as native ETH.
      const t = await verifiedSetup(await tokenLockAt(ETH_USDC.token, 50n * 10n ** 6n));
      await reanchor(t);
      expect(await t.reader.extractAssetId(encPkg(t.syn.anchor, t.lockProof))).to.equal(ethers.keccak256(coder.encode(["string", "address"], ["Ethereum", ETH_USDC.token])));
      await expect(t.verifier.recordFeeAndRac(pkgFor(t, t.rec))).to.be.revertedWith("VF-XCH-011: asset mismatch");
      // Control: the same token lock under its own registry row is accepted.
      await t.verifier.recordFeeAndRac(pkgFor(t, t.rec, { canonicalAssetId: ETH_USDC.canonicalAssetId, assetPrecision: 6, assetCustodyClass: 1, feeAssetId: ETH_USDC.canonicalAssetId }));
    });
    it("reject replay of a previously used proof", async () => {
      const s = await verifiedSetup();
      const p = pkgFor(s, s.rec);
      await reanchor(s); await s.verifier.recordFeeAndRac(p);
      await reanchor(s); await s.verifier.verifyAndMint(p, 0);
      const minted = await s.vclm.balanceOf(s.recipient.address);
      await reanchor(s);
      await expect(s.verifier.verifyAndMint(p, 0)).to.be.revertedWith("VF-XCH-013: replay");
      await expect(s.verifier.recordFeeAndRac(p)).to.be.revertedWith("VF-RAC-001: RAC already recorded");
      expect(await s.vclm.balanceOf(s.recipient.address)).to.equal(minted);
    });
    it("reject proof confusing an address or identity across chains (both directions)", async () => {
      const s = await verifiedSetup();
      await reanchor(s);
      // EVM to non-EVM: the Ethereum package submitted as a Bitcoin lock.
      await expect(s.verifier.recordFeeAndRac(pkgFor(s, s.rec, { sourceEnvironmentId: "Bitcoin" }))).to.be.reverted;
      // Non-EVM to EVM: a Bitcoin-shaped proof (raw transaction bytes) under Ethereum.
      const rawTx = "0x02000000" + "01" + "ab".repeat(36) + "00" + "ffffffff" + "01" + "00".repeat(8) + "19" + BTC_SCRIPT.slice(2) + "00000000";
      await expect(s.verifier.recordFeeAndRac(pkgFor(s, s.rec, { lockEventProof: rawTx }))).to.be.reverted;
      // Non-EVM identity read as an EVM recipient: a 32-byte ed25519 key
      // (Solana or Stellar style) truncated to 20 bytes is not the recipient.
      const key32 = ethers.hexlify(ethers.randomBytes(32));
      await expect(s.verifier.recordFeeAndRac(pkgFor(s, s.rec, { baseRecipient: ethers.getAddress("0x" + key32.slice(26)) })))
        .to.be.revertedWith("VF-XCH-011: recipient mismatch");
      expect(() => coder.encode(["address"], [key32])).to.throw();
      // An Ethereum token address presented as the same address on Base (AERO's Base address).
      const t = await verifiedSetup(await tokenLockAt(BASE_AERO.token, 50n * SCALE));
      await reanchor(t);
      await expect(t.verifier.recordFeeAndRac(pkgFor(t, t.rec, { canonicalAssetId: BASE_AERO.canonicalAssetId, feeAssetId: BASE_AERO.canonicalAssetId })))
        .to.be.revertedWith("VF-XCH-011: asset mismatch");
      expect(await s.verifier.isLockRacRecorded("Ethereum", s.lockId)).to.equal(false);
    });
  });

  // Additional coverage from operator text t348u (kept per t349u). Section 4
  // Verifier-side lock-record checks and the extra named cases.
  describe("Additional coverage: t348u cases and the Verifier's own lock-record checks", function () {
    it("valid lock record from the wrong network", async () => {
      // A lock built for Optimism, read by a reader pinned to it.
      const o = await verifierFor(await deployLocalLock("Optimism"));
      await createLocalRecord(o); o.rec = await o.lock.lockRecord(o.lockId);
      await reanchor(o);
      await expect(o.verifier.recordFeeAndRac(pkgFor(o, o.rec))).to.be.revertedWith("VF-XCH-011: lock environment is not Ethereum");
      await expect(o.verifier.recordFeeAndRac(pkgFor(o, o.rec, { sourceEnvironmentId: "Optimism" }))).to.be.revertedWith("VF-XCH-011: lock environment is not Ethereum");
      // A genuine Ethereum record submitted under Optimism, where the same
      // reader was (mis)registered: refused by the Dev Fund environment check.
      const s = await verifiedSetup();
      await reanchor(s);
      await expect(s.verifier.recordFeeAndRac(pkgFor(s, s.rec, { sourceEnvironmentId: "Optimism" }))).to.be.revertedWith("VF-FEE-009: reader cannot prove the lock Dev Fund");
    });
    it("valid token address belonging to a different network", async () => {
      // A token at AERO's Base address, locked on Ethereum: the index holds
      // (Base, address), not (Ethereum, address).
      const t = await verifiedSetup(await tokenLockAt(BASE_AERO.token, 50n * SCALE));
      await reanchor(t);
      for (const id of [BASE_AERO.canonicalAssetId, ETH_USDC.canonicalAssetId, ETH_ID]) {
        await expect(t.verifier.recordFeeAndRac(pkgFor(t, t.rec, { canonicalAssetId: id, feeAssetId: id }))).to.be.revertedWith("VF-XCH-011: asset mismatch");
      }
    });
    it("correctly formatted price from an unauthorized source", async () => {
      const s = await verifiedSetup();
      await expect(s.verifier.connect(s.other).applyScheduledPriceRun(2n, [
        { environmentId: "Ethereum", canonicalAssetId: ETH_ID, priceUsd18: ETH_PRICE_LATER, success: true },
      ])).to.be.revertedWith("VF-ORC-007: not price poster");
      await reanchor(s);
      await expect(s.verifier.recordFeeAndRac(pkgFor(s, s.rec, { priceRecord: coder.encode(["uint256"], [ETH_PRICE_LATER]) })))
        .to.be.revertedWith("VF-ORC-007: price record mismatch");
    });
    it("legitimate receipt altered to name a different recipient", async () => {
      // The source evidence is a storage proof of the lock record (see MASTER_FINDINGS).
      const s = await verifiedSetup();
      await reanchor(s);
      await expect(s.verifier.recordFeeAndRac(pkgFor(s, s.rec, { baseRecipient: s.other.address }))).to.be.revertedWith("VF-XCH-011: recipient mismatch");
      const t = clone(s.lockProof); const w = t.recordWordProofs[2];
      t.recordWordProofs[2] = [...w.slice(0, -1), flipNode(w[w.length - 1], w[w.length - 1].length / 2 - 3)];
      await expect(s.verifier.recordFeeAndRac(pkgFor(s, s.rec, { baseRecipient: s.other.address, lockEventProof: encPkg(s.syn.anchor, t) }))).to.be.reverted;
    });
    it("genuine lock resubmitted with a different identity or proof package", async () => {
      const s = await verifiedSetup();
      const p = pkgFor(s, s.rec);
      await reanchor(s); await s.verifier.recordFeeAndRac(p);
      await reanchor(s);
      await expect(s.verifier.recordFeeAndRac(pkgFor(s, s.rec))).to.be.revertedWith("VF-RAC-001: RAC already recorded");
      await expect(s.verifier.recordFeeAndRac(pkgFor(s, s.rec, { commitmentVaultLockId: ethers.id("relabelled") }))).to.be.revertedWith("VF-XCH-011: lockId mismatch");
      await s.verifier.verifyAndMint(p, 0);
      // The same record re-proven at a later block under a new anchor.
      await network.provider.send("evm_mine", []);
      const blk = await network.provider.send("eth_getBlockByNumber", ["latest", false]);
      const proof2 = await localLockProof(await s.lock.getAddress(), s.lockId, blk.number);
      await network.provider.send("evm_mine", []);
      const ts = BigInt(s.syn.anchor.baseTimestamp) + 11n;
      const syn2 = syntheticAnchor({ stateRoot: blk.stateRoot, number: BigInt(blk.number), hash: blk.hash }, ts);
      await install4788(ts, syn2.root);
      const p2 = pkgFor(s, s.rec, { lockEventProof: encPkg(syn2.anchor, proof2) });
      await expect(s.verifier.verifyAndMint(p2, 0)).to.be.revertedWith("VF-XCH-013: replay");
      await expect(s.verifier.recordFeeAndRac(p2)).to.be.revertedWith("VF-RAC-001: RAC already recorded");
    });
    it("Section 4: amounts, recipient, output token and valuation timestamp are checked against the proven record", async () => {
      const s = await verifiedSetup();
      await reanchor(s);
      const r = s.rec;
      const cases = [
        [{ grossAmountSmallestUnits: r.gross + 1n }, "VF-XCH-011: gross mismatch"],
        [{ actualFeeAmountSmallestUnits: r.fee + 1n }, "VF-XCH-011: fee mismatch"],
        [{ principalAmountSmallestUnits: r.principal - 1n }, "VF-XCH-011: principal mismatch"],
        [{ durationSecs: r.duration * 2n }, "VF-XCH-011: duration mismatch"],
        [{ baseRecipient: s.dest.address }, "VF-XCH-011: recipient mismatch"],
        [{ selectedOutputToken: 1 }, "VF-XCH-011: output token mismatch"],
        [{ valuationTimestamp: r.createdAt - 1n }, "VF-ORC-011: valuation timestamp != proven lock creation time"],
      ];
      for (const [over, msg] of cases) await expect(s.verifier.recordFeeAndRac(pkgFor(s, r, over))).to.be.revertedWith(msg);
    });
    it("Section 4: the price used is the one in effect before lock creation, not a later run", async () => {
      const s = await verifiedSetup();
      await s.verifier.applyScheduledPriceRun(2n, [
        { environmentId: "Ethereum", canonicalAssetId: ETH_ID, priceUsd18: ETH_PRICE_LATER, success: true },
      ]);
      await reanchor(s);
      await expect(s.verifier.recordFeeAndRac(pkgFor(s, s.rec, { priceRecord: coder.encode(["uint256"], [ETH_PRICE_LATER]) })))
        .to.be.revertedWith("VF-ORC-007: price record mismatch");
      await s.verifier.recordFeeAndRac(pkgFor(s, s.rec, { priceRecord: coder.encode(["uint256"], [ETH_PRICE]) }));
    });
    it("Section 4: the lock address is pinned by the reader, not checked by the Verifier itself (documented gap)", async () => {
      // The Verifier has no per-environment lock address; it relies on the
      // registered reader's immutable pin. This test records that fact.
      const s = await verifiedSetup();
      expect(await s.reader.lock()).to.equal(await s.lock.getAddress());
      expect(s.verifier.interface.fragments.some((f) => f.type === "function" && /lockaddress/i.test(f.name))).to.equal(false);
    });
  });
});
