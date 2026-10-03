const { ethers } = require("ethers");
const { rlpBytes, rlpList, rlpUint } = require("./receiptTrie.cjs");

// keccak256(rlp([])) and keccak256(rlp("")).
const EMPTY_UNCLES = "0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347";
const EMPTY_TRIE = "0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421";

function encodeHeader(fields) {
  const coinbase = fields.coinbase || ethers.Wallet.createRandom().address;
  const items = [
    rlpBytes(fields.parentHash),
    rlpBytes(fields.uncleHash || EMPTY_UNCLES),
    rlpBytes(coinbase),
    rlpBytes(fields.stateRoot),
    rlpBytes(fields.txRoot || EMPTY_TRIE),
    rlpBytes(fields.receiptsRoot || EMPTY_TRIE),
    rlpBytes(fields.bloom || new Uint8Array(256)),
    rlpUint(fields.difficulty ?? 0),
    rlpUint(fields.number),
    rlpUint(fields.gasLimit ?? 30_000_000),
    rlpUint(fields.gasUsed ?? 21_000),
    rlpUint(fields.timestamp),
    rlpBytes(fields.extra || new Uint8Array(0)),
    rlpBytes(fields.mixHash || ethers.hexlify(ethers.randomBytes(32))),
    rlpBytes(fields.nonce || new Uint8Array(8)),
    rlpUint(fields.baseFee ?? 1),
    rlpBytes(fields.withdrawalsRoot || EMPTY_TRIE),
    rlpUint(fields.blobGasUsed ?? 0),
    rlpUint(fields.excessBlobGas ?? 0),
    rlpBytes(fields.parentBeaconRoot || ethers.hexlify(ethers.randomBytes(32))),
    rlpBytes(fields.requestsHash || EMPTY_TRIE),
  ];
  return rlpList(items);
}

function headerHash(rlp) {
  return ethers.keccak256(rlp);
}

// First byte of the parent-hash payload (after the 0xa0 string prefix).
function parentHashPayloadIndex(rlp) {
  const b = ethers.getBytes(rlp);
  for (let i = 0; i < b.length; i++) {
    if (b[i] === 0xa0) return i + 1;
  }
  throw new Error("parent hash tag missing");
}

function flipAt(rlp, index, mask) {
  const c = Uint8Array.from(ethers.getBytes(rlp));
  c[index] ^= mask;
  return c;
}

function uint64Chunk(x) {
  const b = new Uint8Array(32);
  let v = BigInt(x);
  for (let i = 0; i < 8; i++) {
    b[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return ethers.hexlify(b);
}

function shaPair(a, b) {
  return ethers.sha256(ethers.concat([a, b]));
}

// SSZ hash_tree_root of BeaconBlockHeader.
function beaconRoot(h) {
  const h01 = shaPair(uint64Chunk(h.slot), uint64Chunk(h.proposerIndex));
  const h23 = shaPair(h.parentRoot, h.stateRoot);
  const h45 = shaPair(h.bodyRoot, ethers.ZeroHash);
  const h67 = shaPair(ethers.ZeroHash, ethers.ZeroHash);
  return shaPair(shaPair(h01, h23), shaPair(h45, h67));
}

module.exports = {
  EMPTY_TRIE,
  encodeHeader,
  headerHash,
  parentHashPayloadIndex,
  flipAt,
  beaconRoot,
};
