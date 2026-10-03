const { ethers } = require("ethers");

function toBytes(x) {
  if (x instanceof Uint8Array) return x;
  return ethers.getBytes(x);
}

function concatBytes(parts) {
  return ethers.getBytes(ethers.concat(parts.map((p) => toBytes(p))));
}

function lenPrefix(offset, len) {
  if (len < 56) return Uint8Array.of(offset + len);
  let hex = len.toString(16);
  if (hex.length % 2) hex = "0" + hex;
  const lb = ethers.getBytes("0x" + hex);
  return concatBytes([Uint8Array.of(offset + 55 + lb.length), lb]);
}

function rlpBytes(buf) {
  const b = toBytes(buf);
  if (b.length === 1 && b[0] < 0x80) return b;
  return concatBytes([lenPrefix(0x80, b.length), b]);
}

function rlpList(items) {
  const payload = concatBytes(items);
  return concatBytes([lenPrefix(0xc0, payload.length), payload]);
}

function rlpUint(n) {
  const v = BigInt(n);
  if (v === 0n) return Uint8Array.of(0x80);
  let hex = v.toString(16);
  if (hex.length % 2) hex = "0" + hex;
  return rlpBytes(ethers.getBytes("0x" + hex));
}

function hexPrefix(nibbles, isLeaf) {
  const odd = nibbles.length % 2 === 1;
  const flags = (isLeaf ? 2 : 0) | (odd ? 1 : 0);
  const out = [];
  let i = 0;
  if (odd) {
    out.push((flags << 4) | nibbles[0]);
    i = 1;
  } else {
    out.push(flags << 4);
  }
  for (; i < nibbles.length; i += 2) {
    out.push((nibbles[i] << 4) | nibbles[i + 1]);
  }
  return Uint8Array.from(out);
}

function nibblesOf(bytes) {
  const b = toBytes(bytes);
  const out = [];
  for (const x of b) out.push(x >> 4, x & 0x0f);
  return out;
}

function encodeNode(node) {
  if (node.type === "leaf") {
    return rlpList([rlpBytes(hexPrefix(node.nibbles, true)), rlpBytes(node.value)]);
  }
  if (node.type === "extension") {
    return rlpList([rlpBytes(hexPrefix(node.nibbles, false)), nodeRef(node.child)]);
  }
  if (node.type === "branch") {
    const items = [];
    for (let i = 0; i < 16; i++) {
      items.push(node.children[i] ? nodeRef(node.children[i]) : Uint8Array.of(0x80));
    }
    items.push(node.value ? rlpBytes(node.value) : Uint8Array.of(0x80));
    return rlpList(items);
  }
  throw new Error("encodeNode");
}

function nodeRef(node) {
  const encoded = encodeNode(node);
  if (encoded.length < 32) return encoded;
  return rlpBytes(ethers.getBytes(ethers.keccak256(encoded)));
}

function rootHash(node) {
  return ethers.keccak256(encodeNode(node));
}

function commonLen(a, b) {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i++;
  return i;
}

function makeLeaf(nibbles, value) {
  return { type: "leaf", nibbles: nibbles.slice(), value: toBytes(value) };
}

function insert(node, nibbles, value) {
  value = toBytes(value);
  if (node === null) return makeLeaf(nibbles, value);
  if (node.type === "leaf") {
    const common = commonLen(node.nibbles, nibbles);
    if (common === node.nibbles.length && common === nibbles.length) return makeLeaf(nibbles, value);
    const branch = { type: "branch", children: Array(16).fill(null), value: null };
    if (common === node.nibbles.length) branch.value = node.value;
    else branch.children[node.nibbles[common]] = makeLeaf(node.nibbles.slice(common + 1), node.value);
    if (common === nibbles.length) branch.value = value;
    else branch.children[nibbles[common]] = makeLeaf(nibbles.slice(common + 1), value);
    if (common === 0) return branch;
    return { type: "extension", nibbles: nibbles.slice(0, common), child: branch };
  }
  if (node.type === "extension") {
    const common = commonLen(node.nibbles, nibbles);
    if (common === node.nibbles.length) {
      node.child = insert(node.child, nibbles.slice(common), value);
      return node;
    }
    const branch = { type: "branch", children: Array(16).fill(null), value: null };
    if (common + 1 === node.nibbles.length) branch.children[node.nibbles[common]] = node.child;
    else {
      branch.children[node.nibbles[common]] = {
        type: "extension",
        nibbles: node.nibbles.slice(common + 1),
        child: node.child,
      };
    }
    if (common === nibbles.length) branch.value = value;
    else branch.children[nibbles[common]] = makeLeaf(nibbles.slice(common + 1), value);
    if (common === 0) return branch;
    return { type: "extension", nibbles: node.nibbles.slice(0, common), child: branch };
  }
  if (node.type === "branch") {
    if (nibbles.length === 0) {
      node.value = value;
      return node;
    }
    node.children[nibbles[0]] = insert(node.children[nibbles[0]], nibbles.slice(1), value);
    return node;
  }
  throw new Error("insert");
}

function prove(rootNode, nibbles) {
  const proof = [];
  function rec(node, pos, force) {
    const encoded = encodeNode(node);
    if (force || encoded.length >= 32) proof.push(ethers.hexlify(encoded));
    if (node.type === "leaf") return;
    if (node.type === "extension") {
      rec(node.child, pos + node.nibbles.length, false);
      return;
    }
    if (pos === nibbles.length) return;
    const child = node.children[nibbles[pos]];
    if (!child) throw new Error("missing child");
    rec(child, pos + 1, false);
  }
  rec(rootNode, 0, true);
  return proof;
}

function buildLegacyReceipt(emitter, topic, data) {
  const log = rlpList([
    rlpBytes(ethers.getBytes(emitter)),
    rlpList([rlpBytes(ethers.getBytes(topic))]),
    rlpBytes(ethers.getBytes(data)),
  ]);
  return rlpList([
    rlpBytes(Uint8Array.of(0x01)),
    rlpBytes(ethers.getBytes("0x5208")),
    rlpBytes(new Uint8Array(256)),
    rlpList([log]),
  ]);
}

function buildReceiptTrie(lockReceipt) {
  const other = ethers.getBytes("0x" + "11".repeat(40));
  let root = null;
  root = insert(root, nibblesOf(rlpUint(0)), other);
  root = insert(root, nibblesOf(rlpUint(1)), lockReceipt);
  const proof = prove(root, nibblesOf(rlpUint(1)));
  return { root: rootHash(root), proof, index: 1 };
}

function signDigest(wallet, digest) {
  const sig = wallet.signingKey.sign(digest);
  return ethers.concat([sig.r, sig.s, ethers.toBeHex(sig.v, 1)]);
}

module.exports = {
  rlpBytes,
  rlpList,
  rlpUint,
  nibblesOf,
  buildLegacyReceipt,
  buildReceiptTrie,
  signDigest,
};
