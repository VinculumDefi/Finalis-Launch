const { expect } = require("chai");
const { ethers } = require("hardhat");
const { buildLegacyReceipt, buildReceiptTrie, signDigest } = require("./lib/receiptTrie.cjs");
const {
  EMPTY_TRIE,
  encodeHeader,
  headerHash,
  parentHashPayloadIndex,
  flipAt,
  beaconRoot,
} = require("./lib/execHeader.cjs");

const coder = ethers.AbiCoder.defaultAbiCoder();

function wallets(n) {
  return Array.from({ length: n }, () => ethers.Wallet.createRandom());
}

async function deploy(name, args) {
  const F = await ethers.getContractFactory(name);
  const c = await F.deploy(...args);
  await c.waitForDeployment();
  return c;
}

describe("Ethereum finality", function () {
  const coinbase = ethers.Wallet.createRandom().address;

  async function fixture() {
    const emitter = ethers.Wallet.createRandom().address;
    const checker = await deploy("EthereumFinalityChecker", [emitter]);
    const topic = await checker.LOCK_TOPIC();
    const receipt = buildLegacyReceipt(emitter, topic, ethers.randomBytes(32));
    const trie = buildReceiptTrie(receipt);
    const headerRlp = encodeHeader({
      parentHash: ethers.hexlify(ethers.randomBytes(32)),
      stateRoot: ethers.hexlify(ethers.randomBytes(32)),
      receiptsRoot: trie.root,
      number: 100n,
      timestamp: 1_700_000_000n,
      coinbase,
    });
    const blockHash = headerHash(headerRlp);
    const b0 = {
      slot: 320n,
      proposerIndex: 1n,
      parentRoot: ethers.hexlify(ethers.randomBytes(32)),
      stateRoot: ethers.hexlify(ethers.randomBytes(32)),
      bodyRoot: ethers.hexlify(ethers.randomBytes(32)),
    };
    const b1 = {
      slot: 352n,
      proposerIndex: 2n,
      parentRoot: beaconRoot(b0),
      stateRoot: ethers.hexlify(ethers.randomBytes(32)),
      bodyRoot: ethers.hexlify(ethers.randomBytes(32)),
    };
    const b2 = {
      slot: 384n,
      proposerIndex: 3n,
      parentRoot: beaconRoot(b1),
      stateRoot: ethers.hexlify(ethers.randomBytes(32)),
      bodyRoot: ethers.hexlify(ethers.randomBytes(32)),
    };
    function encode(beacons, finalizedEpoch, attestedEpoch, rlp, claimed, receiptBytes) {
      return coder.encode(
        [
          "tuple(bytes headerRlp, bytes32 blockHash, uint64 slot, bytes receipt, uint256 receiptIndex, bytes[] mptNodes, tuple(uint64 slot, uint64 proposerIndex, bytes32 parentRoot, bytes32 stateRoot, bytes32 bodyRoot)[] beacons, uint64 finalizedEpoch, uint64 attestedEpoch)",
        ],
        [
          [
            rlp,
            claimed,
            320n,
            receiptBytes,
            trie.index,
            trie.proof,
            beacons.map((b) => [b.slot, b.proposerIndex, b.parentRoot, b.stateRoot, b.bodyRoot]),
            finalizedEpoch,
            attestedEpoch,
          ],
        ]
      );
    }
    return { checker, blockHash, headerRlp, encode, b0, b1, b2, receipt };
  }

  it("accepts a receipt proof inside a finalized checkpoint", async function () {
    const f = await fixture();
    const proof = f.encode([f.b0, f.b1, f.b2], 10n, 12n, f.headerRlp, f.blockHash, f.receipt);
    const [ok, hash, height] = await f.checker.verify(proof);
    expect(ok).to.equal(true);
    expect(hash).to.equal(ethers.keccak256(f.headerRlp));
    expect(height).to.equal(100n);
  });

  it("reverts when a receipt byte is flipped", async function () {
    const f = await fixture();
    const bad = Uint8Array.from(ethers.getBytes(f.receipt));
    bad[40] ^= 0xff;
    const proof = f.encode([f.b0, f.b1, f.b2], 10n, 12n, f.headerRlp, f.blockHash, bad);
    await expect(f.checker.verify(proof)).to.be.revertedWith("receipt");
  });

  it("reverts when an RLP header byte is flipped", async function () {
    const f = await fixture();
    const flipped = flipAt(f.headerRlp, parentHashPayloadIndex(f.headerRlp), 0xff);
    const proof = f.encode([f.b0, f.b1, f.b2], 10n, 12n, flipped, f.blockHash, f.receipt);
    await expect(f.checker.verify(proof)).to.be.revertedWith("header");
  });

  it("reverts when the checkpoint is only justified", async function () {
    const f = await fixture();
    const proof = f.encode([f.b0, f.b1], 10n, 11n, f.headerRlp, f.blockHash, f.receipt);
    await expect(f.checker.verify(proof)).to.be.revertedWith("not finalized");
  });

  it("reverts on an empty proof, a zero hash, and height 0", async function () {
    const f = await fixture();
    await expect(f.checker.verify("0x")).to.be.revertedWith("empty proof");
    await expect(f.checker.verify("0x1234")).to.be.reverted;
    const zeroHash = f.encode([f.b0, f.b1, f.b2], 10n, 12n, f.headerRlp, ethers.ZeroHash, f.receipt);
    await expect(f.checker.verify(zeroHash)).to.be.revertedWith("hash");
    const genesis = encodeHeader({
      parentHash: ethers.hexlify(ethers.randomBytes(32)),
      stateRoot: ethers.hexlify(ethers.randomBytes(32)),
      receiptsRoot: EMPTY_TRIE,
      number: 0n,
      timestamp: 1n,
      coinbase,
    });
    const height0 = f.encode([f.b0, f.b1, f.b2], 10n, 12n, genesis, headerHash(genesis), f.receipt);
    await expect(f.checker.verify(height0)).to.be.revertedWith("height");
  });
});

describe("Polygon finality", function () {
  const coinbase = ethers.Wallet.createRandom().address;

  async function fixture() {
    const keys = wallets(3);
    const checker = await deploy("PolygonFinalityChecker", [keys.map((k) => k.address), [1n, 1n, 1n]]);
    const headerRlp = encodeHeader({
      parentHash: ethers.hexlify(ethers.randomBytes(32)),
      stateRoot: ethers.hexlify(ethers.randomBytes(32)),
      receiptsRoot: EMPTY_TRIE,
      number: 11n,
      timestamp: 1_700_000_000n,
      coinbase,
    });
    const blockHash = headerHash(headerRlp);
    const blockHashes = [
      ethers.hexlify(ethers.randomBytes(32)),
      blockHash,
      ethers.hexlify(ethers.randomBytes(32)),
    ];
    const body = {
      headerRlp,
      blockHash,
      proposer: "heimdall-proposer",
      startBlock: 10n,
      endBlock: 12n,
      endHash: blockHashes[2],
      borChainId: "137",
      milestoneId: "m-1",
      milestoneTimestamp: 1_700_000_100n,
      blockHashes,
    };
    const digest = ethers.keccak256(
      coder.encode(
        ["string", "uint64", "uint64", "bytes32", "string", "string", "uint64", "bytes32[]"],
        [body.proposer, body.startBlock, body.endBlock, body.endHash, body.borChainId, body.milestoneId, body.milestoneTimestamp, body.blockHashes]
      )
    );
    const signers = [keys[0], keys[1]];
    const signatures = signers.map((k) => signDigest(k, digest));
    function encode(over) {
      const p = { ...body, signers: signers.map((k) => k.address), signatures, ...over };
      return coder.encode(
        [
          "tuple(bytes headerRlp, bytes32 blockHash, string proposer, uint64 startBlock, uint64 endBlock, bytes32 endHash, string borChainId, string milestoneId, uint64 milestoneTimestamp, bytes32[] blockHashes, address[] signers, bytes[] signatures)",
        ],
        [[
          p.headerRlp, p.blockHash, p.proposer, p.startBlock, p.endBlock, p.endHash,
          p.borChainId, p.milestoneId, p.milestoneTimestamp, p.blockHashes, p.signers, p.signatures,
        ]]
      );
    }
    return { checker, encode, body };
  }

  it("accepts a Bor header covered by a 2/3 milestone", async function () {
    const f = await fixture();
    const [ok, hash, height] = await f.checker.verify(f.encode());
    expect(ok).to.equal(true);
    expect(hash).to.equal(ethers.keccak256(f.body.headerRlp));
    expect(height).to.equal(11n);
  });

  it("reverts when the Bor header is outside the milestone", async function () {
    const f = await fixture();
    const headerRlp = encodeHeader({
      parentHash: ethers.hexlify(ethers.randomBytes(32)),
      stateRoot: ethers.hexlify(ethers.randomBytes(32)),
      receiptsRoot: EMPTY_TRIE,
      number: 13n,
      timestamp: 1_700_000_000n,
      coinbase,
    });
    await expect(f.checker.verify(f.encode({ headerRlp, blockHash: headerHash(headerRlp) }))).to.be.revertedWith("uncovered");
  });

  it("reverts when a header RLP byte is flipped", async function () {
    const f = await fixture();
    const headerRlp = flipAt(f.body.headerRlp, parentHashPayloadIndex(f.body.headerRlp), 0xff);
    await expect(f.checker.verify(f.encode({ headerRlp }))).to.be.revertedWith("header");
  });

  it("reverts on an empty or non-proof blob", async function () {
    const f = await fixture();
    await expect(f.checker.verify("0x")).to.be.revertedWith("empty proof");
    await expect(f.checker.verify("0xabcd")).to.be.reverted;
  });
});

describe("Optimism finality", function () {
  async function fixture(observedOffset) {
    const checker = await deploy("OptimismFinalityChecker", []);
    const delay = await checker.DISPUTE_GAME_FINALITY_DELAY_SECONDS();
    expect(delay).to.equal(302400n);
    const stateRoot = ethers.hexlify(ethers.randomBytes(32));
    const withdrawalStorageRoot = ethers.hexlify(ethers.randomBytes(32));
    const latestBlockHash = ethers.hexlify(ethers.randomBytes(32));
    const outputRoot = ethers.keccak256(
      ethers.concat([ethers.ZeroHash, stateRoot, withdrawalStorageRoot, latestBlockHash])
    );
    const resolvedAt = 1_700_000_000n;
    const observedAt = resolvedAt + delay + observedOffset;
    function encode(over) {
      const p = {
        stateRoot,
        withdrawalStorageRoot,
        latestBlockHash,
        l2BlockNumber: 50n,
        outputRoot,
        gameStatus: 2,
        resolvedAt,
        observedAt,
        ...over,
      };
      return coder.encode(
        [
          "tuple(bytes32 stateRoot, bytes32 withdrawalStorageRoot, bytes32 latestBlockHash, uint256 l2BlockNumber, bytes32 outputRoot, uint8 gameStatus, uint256 resolvedAt, uint256 observedAt)",
        ],
        [
          [
            p.stateRoot,
            p.withdrawalStorageRoot,
            p.latestBlockHash,
            p.l2BlockNumber,
            p.outputRoot,
            p.gameStatus,
            p.resolvedAt,
            p.observedAt,
          ],
        ]
      );
    }
    return { checker, encode, latestBlockHash };
  }

  it("accepts an output root after the dispute-game finality delay", async function () {
    const f = await fixture(0n);
    const [ok, hash, height] = await f.checker.verify(f.encode());
    expect(ok).to.equal(true);
    expect(hash).to.equal(f.latestBlockHash);
    expect(height).to.equal(50n);
  });

  it("reverts inside the dispute window", async function () {
    const f = await fixture(-1n);
    await expect(f.checker.verify(f.encode())).to.be.revertedWith("inside window");
  });

  it("reverts on a mismatched output root", async function () {
    const f = await fixture(0n);
    await expect(
      f.checker.verify(f.encode({ outputRoot: ethers.hexlify(ethers.randomBytes(32)) }))
    ).to.be.revertedWith("output root");
  });

  it("reverts on an empty proof or height 0", async function () {
    const f = await fixture(0n);
    await expect(f.checker.verify("0x")).to.be.revertedWith("empty proof");
    await expect(f.checker.verify("0xabcd")).to.be.reverted;
    await expect(f.checker.verify(f.encode({ l2BlockNumber: 0n }))).to.be.revertedWith("height");
  });
});

describe("Arbitrum finality", function () {
  async function fixture(extraBlocks) {
    const checker = await deploy("ArbitrumFinalityChecker", []);
    const window = await checker.CONFIRM_PERIOD_BLOCKS();
    expect(window).to.equal(45818n);
    const parentAssertionHash = ethers.hexlify(ethers.randomBytes(32));
    const blockHash = ethers.hexlify(ethers.randomBytes(32));
    const sendRoot = ethers.hexlify(ethers.randomBytes(32));
    const inboxPosition = 20n;
    const positionInMessage = 0n;
    const endHistoryRoot = ethers.hexlify(ethers.randomBytes(32));
    const inboxAcc = ethers.hexlify(ethers.randomBytes(32));
    const afterStateHash = ethers.keccak256(
      coder.encode(
        ["bytes32", "bytes32", "uint64", "uint64", "uint8", "bytes32"],
        [blockHash, sendRoot, inboxPosition, positionInMessage, 1, endHistoryRoot]
      )
    );
    const assertionHash = ethers.keccak256(
      ethers.concat([parentAssertionHash, afterStateHash, inboxAcc])
    );
    const createdAtBlock = 1_000_000n;
    const l1BlockNumber = createdAtBlock + window + extraBlocks;
    function encode(over) {
      const p = {
        parentAssertionHash,
        blockHash,
        sendRoot,
        inboxPosition,
        positionInMessage,
        endHistoryRoot,
        inboxAcc,
        assertionHash,
        createdAtBlock,
        l1BlockNumber,
        l2BlockHeight: 80n,
        ...over,
      };
      return coder.encode(
        [
          "tuple(bytes32 parentAssertionHash, bytes32 blockHash, bytes32 sendRoot, uint64 inboxPosition, uint64 positionInMessage, bytes32 endHistoryRoot, bytes32 inboxAcc, bytes32 assertionHash, uint64 createdAtBlock, uint64 l1BlockNumber, uint256 l2BlockHeight)",
        ],
        [
          [
            p.parentAssertionHash,
            p.blockHash,
            p.sendRoot,
            p.inboxPosition,
            p.positionInMessage,
            p.endHistoryRoot,
            p.inboxAcc,
            p.assertionHash,
            p.createdAtBlock,
            p.l1BlockNumber,
            p.l2BlockHeight,
          ],
        ]
      );
    }
    return { checker, encode, blockHash };
  }

  it("accepts an assertion after 45818 L1 blocks", async function () {
    const f = await fixture(0n);
    const [ok, hash, height] = await f.checker.verify(f.encode());
    expect(ok).to.equal(true);
    expect(hash).to.equal(f.blockHash);
    expect(height).to.equal(80n);
  });

  it("reverts inside the Arbitrum One challenge window", async function () {
    const f = await fixture(-1n);
    await expect(f.checker.verify(f.encode())).to.be.revertedWith("inside window");
  });

  it("reverts on a mismatched assertion hash", async function () {
    const f = await fixture(0n);
    await expect(
      f.checker.verify(f.encode({ assertionHash: ethers.hexlify(ethers.randomBytes(32)) }))
    ).to.be.revertedWith("assertion hash");
  });

  it("reverts on an empty proof or height 0", async function () {
    const f = await fixture(0n);
    await expect(f.checker.verify("0x")).to.be.revertedWith("empty proof");
    await expect(f.checker.verify("0xabcd")).to.be.reverted;
    await expect(f.checker.verify(f.encode({ l2BlockHeight: 0n }))).to.be.revertedWith("height");
  });
});

describe("BNB Smart Chain finality", function () {
  const coinbase = ethers.Wallet.createRandom().address;

  async function fixture() {
    const keys = wallets(3);
    const checker = await deploy("BnbFinalityChecker", [keys.map((k) => k.address)]);
    const parentHash = ethers.hexlify(ethers.randomBytes(32));
    const headerRlp = encodeHeader({
      parentHash,
      stateRoot: ethers.hexlify(ethers.randomBytes(32)),
      receiptsRoot: EMPTY_TRIE,
      number: 40n,
      timestamp: 1_700_000_000n,
      coinbase,
    });
    const headerHashValue = headerHash(headerRlp);
    function vote(key, targetHash) {
      const fields = [key.address, parentHash, targetHash, 39n, 40n];
      const digest = ethers.keccak256(
        coder.encode(["address", "bytes32", "bytes32", "uint64", "uint64"], fields)
      );
      return [...fields, signDigest(key, digest)];
    }
    function encode(votes, rlp, claimed) {
      return coder.encode(
        [
          "tuple(bytes headerRlp, bytes32 headerHash, tuple(address voteAddress, bytes32 sourceHash, bytes32 targetHash, uint64 sourceNumber, uint64 targetNumber, bytes signature)[] votes)",
        ],
        [[rlp, claimed, votes]]
      );
    }
    return { checker, keys, headerRlp, headerHashValue, vote, encode };
  }

  it("accepts a 2/3 vote on the RLP header hash", async function () {
    const f = await fixture();
    const votes = [f.vote(f.keys[0], f.headerHashValue), f.vote(f.keys[1], f.headerHashValue)];
    const [ok, hash, height] = await f.checker.verify(f.encode(votes, f.headerRlp, f.headerHashValue));
    expect(ok).to.equal(true);
    expect(hash).to.equal(ethers.keccak256(f.headerRlp));
    expect(height).to.equal(40n);
  });

  it("reverts on fewer than ceil(2/3 * n) votes", async function () {
    const f = await fixture();
    await expect(
      f.checker.verify(f.encode([f.vote(f.keys[0], f.headerHashValue)], f.headerRlp, f.headerHashValue))
    ).to.be.revertedWith("quorum");
  });

  it("reverts when a vote targets a different hash", async function () {
    const f = await fixture();
    const other = ethers.hexlify(ethers.randomBytes(32));
    const votes = [f.vote(f.keys[0], f.headerHashValue), f.vote(f.keys[1], other)];
    await expect(f.checker.verify(f.encode(votes, f.headerRlp, f.headerHashValue))).to.be.revertedWith("target");
  });

  it("reverts on a duplicate validator", async function () {
    const f = await fixture();
    const votes = [f.vote(f.keys[0], f.headerHashValue), f.vote(f.keys[0], f.headerHashValue)];
    await expect(f.checker.verify(f.encode(votes, f.headerRlp, f.headerHashValue))).to.be.revertedWith("duplicate");
  });

  it("reverts when a header RLP byte is flipped", async function () {
    const f = await fixture();
    const flipped = flipAt(f.headerRlp, parentHashPayloadIndex(f.headerRlp), 0xff);
    const votes = [f.vote(f.keys[0], f.headerHashValue), f.vote(f.keys[1], f.headerHashValue)];
    await expect(f.checker.verify(f.encode(votes, flipped, f.headerHashValue))).to.be.revertedWith("header");
  });

  it("reverts on an empty proof or height 0", async function () {
    const f = await fixture();
    await expect(f.checker.verify("0x")).to.be.revertedWith("empty proof");
    await expect(f.checker.verify("0xabcd")).to.be.reverted;
    const genesis = encodeHeader({
      parentHash: ethers.hexlify(ethers.randomBytes(32)),
      stateRoot: ethers.hexlify(ethers.randomBytes(32)),
      receiptsRoot: EMPTY_TRIE,
      number: 0n,
      timestamp: 1n,
      coinbase,
    });
    await expect(
      f.checker.verify(f.encode([], genesis, headerHash(genesis)))
    ).to.be.revertedWith("height");
  });
});

describe("Avalanche finality", function () {
  const coinbase = ethers.Wallet.createRandom().address;

  async function fixture() {
    const keys = wallets(3);
    const checker = await deploy("AvalancheFinalityChecker", [
      keys.map((k) => k.address),
      [10n, 10n, 4n],
    ]);
    const parentRlp = encodeHeader({
      parentHash: ethers.hexlify(ethers.randomBytes(32)),
      stateRoot: ethers.hexlify(ethers.randomBytes(32)),
      receiptsRoot: EMPTY_TRIE,
      number: 1n,
      timestamp: 1_700_000_000n,
      coinbase,
    });
    const parentId = headerHash(parentRlp);
    const blockRlp = encodeHeader({
      parentHash: parentId,
      stateRoot: ethers.hexlify(ethers.randomBytes(32)),
      receiptsRoot: EMPTY_TRIE,
      number: 2n,
      timestamp: 1_700_000_001n,
      coinbase,
    });
    const id = headerHash(blockRlp);
    const signers = [keys[0], keys[1]];
    const signatures = signers.map((k) => signDigest(k, id));
    function encode(parentBytes, blockBytes, parentStatus, blockStatus) {
      return coder.encode(
        ["tuple(bytes parentRlp, bytes blockRlp, uint8 parentStatus, uint8 blockStatus, address[] signers, bytes[] signatures)"],
        [[
          parentBytes,
          blockBytes,
          parentStatus,
          blockStatus,
          signers.map((k) => k.address),
          signatures,
        ]]
      );
    }
    return { checker, encode, parentRlp, blockRlp, id };
  }

  it("accepts a linked block the stake quorum marked accepted", async function () {
    const f = await fixture();
    const [ok, hash, height] = await f.checker.verify(f.encode(f.parentRlp, f.blockRlp, 3, 3));
    expect(ok).to.equal(true);
    expect(hash).to.equal(ethers.keccak256(f.blockRlp));
    expect(height).to.equal(2n);
  });

  it("reverts on a rejected block", async function () {
    const f = await fixture();
    await expect(f.checker.verify(f.encode(f.parentRlp, f.blockRlp, 3, 2))).to.be.revertedWith("not accepted");
  });

  it("reverts on an unaccepted block", async function () {
    const f = await fixture();
    await expect(f.checker.verify(f.encode(f.parentRlp, f.blockRlp, 3, 1))).to.be.revertedWith("not accepted");
  });

  it("reverts when one bit of the parent hash in the header RLP is flipped", async function () {
    const f = await fixture();
    const flipped = flipAt(f.blockRlp, parentHashPayloadIndex(f.blockRlp), 0x01);
    await expect(f.checker.verify(f.encode(f.parentRlp, flipped, 3, 3))).to.be.revertedWith("parent");
  });

  it("reverts on an empty proof or height 0", async function () {
    const f = await fixture();
    await expect(f.checker.verify("0x")).to.be.revertedWith("empty proof");
    await expect(f.checker.verify("0xabcd")).to.be.reverted;
    const genesis = encodeHeader({
      parentHash: ethers.hexlify(ethers.randomBytes(32)),
      stateRoot: ethers.hexlify(ethers.randomBytes(32)),
      receiptsRoot: EMPTY_TRIE,
      number: 0n,
      timestamp: 1n,
      coinbase,
    });
    await expect(f.checker.verify(f.encode(genesis, f.blockRlp, 3, 3))).to.be.revertedWith("height");
  });
});
