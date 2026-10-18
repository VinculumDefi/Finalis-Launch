// SPDX-License-Identifier: PROTOCOL-RESTRICTED
pragma solidity 0.8.19;

import "../interfaces/IChainVerifier.sol";
import "../CommitmentDurations.sol";
import "../checkers/Blake2b.sol";

/// @title UtxoLockReader
/// @notice Simple-bar reader for the utxo-locks CLTV P2SH lock
/// (utxo-locks/lock.py) on Bitcoin, Bitcoin Cash, Litecoin, Dogecoin,
/// DigiByte and Zcash (transparent). Facts come only from proven chain data:
///   1. The block header is given in full; the block hash is SHA-256d of it
///      (raw digest order). verifyFinality requires it to equal the package's
///      claimed hash, and the block height to equal the claimed height.
///   2. The block height is proven from the coinbase transaction (BIP 34
///      height push), which must be leaf 0 of the header's merkle tree.
///   3. The lock transaction is proven into the same merkle root. Its txid is
///      SHA-256d of its non-witness serialization, or the ZIP 244 txid for a
///      Zcash v5 transparent transaction.
///   4. Its outputs must contain exactly one Dev Fund output (scriptPubKey
///      fixed at construction), exactly one P2SH output whose redeem script
///      is <height> OP_CHECKLOCKTIMEVERIFY OP_DROP <33-byte key> OP_CHECKSIG,
///      and exactly one OP_RETURN carrying the 117-byte binding payload (or
///      its SHA-256 on chains whose relay policy is 83 bytes).
///   5. lockId, Base recipient and output token come from the payload.
///      gross = Dev Fund output + principal; the fee must equal
///      floor(gross * 500 / 10000) (5% on every duration).
/// Duration: the lock's CLTV maturity is a block height. The package names a
/// permitted duration D; the reader requires D/blockSpacing blocks to be
/// within one day of blocks of (maturityHeight - lockHeight), never fewer
/// blocks remaining than zero and never more than D/blockSpacing. The
/// permitted durations are at least six days apart, so at most one D fits.
/// createdAt is the lock block's header time; maturity = createdAt + D (the
/// on-chain release itself is by height).
/// SCOPE: this reader proves the lock is in the block whose hash the package
/// names. Whether that block is in the chain's settled history is the claim
/// the package makes; this contract does not decide it.
contract UtxoLockReader is IChainVerifier {
    uint256 public constant FEE_BPS = 500;
    uint256 public constant BPS = 10000;
    uint256 public constant TOLERANCE_SECS = 1 days;
    uint256 public constant PAYLOAD_LEN = 117;
    uint32 private constant ZEC_V5_HEADER = 0x80000005;
    uint32 private constant ZEC_V5_GROUP = 0x26A7270A;

    string public environmentId;
    bytes public devFundScript;
    uint256 public immutable blockSpacing;
    bool public immutable rawBinding; // true: OP_RETURN carries the 117 bytes; false: their SHA-256
    bool public immutable zcash;

    struct LockProof {
        bytes header;
        bytes coinbaseTx;
        bytes32[] coinbaseBranch;
        bytes lockTx;
        bytes32[] lockBranch;
        uint256 lockIndex;
        bytes redeemScript;
        bytes payload;
        uint256 durationSecs;
    }

    struct Out {
        uint256 value;
        uint256 scriptStart;
        uint256 scriptLen;
    }

    struct ParsedTx {
        bytes32 txid;
        bytes32 firstPrevTxid;
        uint32 firstPrevVout;
        uint256 firstScriptStart;
        uint256 firstScriptLen;
        Out[] outs;
    }

    /// Canonical id of this chain's native coin, the only asset a UTXO lock holds.
    bytes32 public immutable nativeAssetId;

    constructor(string memory env_, bytes memory devFundScript_, uint256 blockSpacing_, bool rawBinding_, bool zcash_, string memory nativeAsset_) {
        nativeAssetId = keccak256(abi.encodePacked(env_, nativeAsset_));
        require(bytes(env_).length != 0, "VF-XCH-011: environment");
        require(devFundScript_.length != 0, "VF-XCH-011: dev fund script");
        require(blockSpacing_ != 0 && 3600 % blockSpacing_ == 0, "VF-XCH-011: block spacing");
        environmentId = env_;
        devFundScript = devFundScript_;
        blockSpacing = blockSpacing_;
        rawBinding = rawBinding_;
        zcash = zcash_;
    }

    // ---------------------------------------------------------------- IChainVerifier

    function verifyFinality(bytes calldata lockEventProof, bytes calldata sourceFinalityProof)
        external
        view
        returns (bool, bytes32, uint256)
    {
        LockProof memory p = abi.decode(lockEventProof, (LockProof));
        (bytes32 hash, uint256 height,) = _openBlock(p);
        (bytes32 claimedHash, uint256 claimedHeight) = abi.decode(sourceFinalityProof, (bytes32, uint256));
        require(claimedHash == hash, "VF-XCH-006: block hash mismatch");
        require(claimedHeight == height, "VF-XCH-006: block height mismatch");
        return (true, hash, height);
    }

    /// @notice A UTXO lock holds the chain's native coin. The full extractFacts
    /// proof must hold first; then the asset is that native coin.
    function extractAssetId(bytes calldata lockEventProof) external view returns (bytes32) {
        this.extractFacts(lockEventProof);
        return nativeAssetId;
    }

    function extractFacts(bytes calldata lockEventProof)
        external
        view
        returns (bytes32, uint256, uint256, uint256, uint256, uint256, uint256, address, uint8)
    {
        LockProof memory p = abi.decode(lockEventProof, (LockProof));
        (, uint256 height, uint256 time) = _openBlock(p);
        ParsedTx memory t = _parse(p.lockTx);
        require(p.lockTx.length != 64, "VF-XCH-011: 64-byte transaction");
        require(p.lockBranch.length == p.coinbaseBranch.length && p.lockIndex != 0, "VF-XCH-011: lock branch");
        require(_merkle(t.txid, p.lockBranch, p.lockIndex) == _merkleRoot(p.header), "VF-XCH-011: lock not in block");

        (uint256 fee, uint256 principal, uint256 maturityHeight) = _outputs(p.lockTx, t.outs, p.redeemScript, p.payload);
        uint256 gross = fee + principal;
        require(fee != 0 && principal != 0 && fee == (gross * FEE_BPS) / BPS, "VF-XCH-011: fee is not 5%");

        uint256 d = p.durationSecs;
        require(CommitmentDurations.multiplierBps(d) != 0, "VF-XCH-011: duration not permitted");
        uint256 blocks = d / blockSpacing;
        require(maturityHeight > height, "VF-XCH-011: maturity not after lock block");
        uint256 remaining = maturityHeight - height;
        require(remaining <= blocks && blocks - remaining <= TOLERANCE_SECS / blockSpacing, "VF-XCH-011: maturity does not match duration");

        bytes memory pl = p.payload;
        bytes32 lockId;
        uint256 w;
        assembly {
            lockId := mload(add(pl, 32))
            w := mload(add(pl, 64))
        }
        address recipient = address(uint160(w >> 96));
        uint8 outputToken = uint8(pl[52]);
        require(lockId != bytes32(0), "VF-XCH-011: lock id");
        require(recipient != address(0), "VF-XCH-011: recipient missing");
        require(outputToken <= 1, "VF-XCH-011: output token");
        return (lockId, gross, fee, principal, d, time, time + d, recipient, outputToken);
    }

    // ---------------------------------------------------------------- block

    function _openBlock(LockProof memory p) internal view returns (bytes32 hash, uint256 height, uint256 time) {
        bytes memory h = p.header;
        if (zcash) {
            // version, prev, merkle, finalSaplingRoot, time, bits, nonce(32), compactSize 1344, solution
            require(h.length == 1487 && uint8(h[140]) == 0xfd && uint8(h[141]) == 0x40 && uint8(h[142]) == 0x05, "VF-XCH-011: Zcash header");
            time = _u32le(h, 100);
        } else {
            require(h.length == 80, "VF-XCH-011: header length");
            time = _u32le(h, 68);
        }
        hash = sha256(abi.encodePacked(sha256(h)));
        ParsedTx memory cb = _parse(p.coinbaseTx);
        require(cb.firstPrevTxid == bytes32(0) && cb.firstPrevVout == 0xffffffff, "VF-XCH-011: coinbase");
        require(p.coinbaseTx.length != 64, "VF-XCH-011: 64-byte transaction");
        require(_merkle(cb.txid, p.coinbaseBranch, 0) == _merkleRoot(h), "VF-XCH-011: coinbase not in block");
        height = _bip34Height(p.coinbaseTx, cb.firstScriptStart, cb.firstScriptLen);
    }

    function _merkleRoot(bytes memory h) private pure returns (bytes32 r) {
        assembly {
            r := mload(add(h, 68))
        }
    }

    function _merkle(bytes32 leaf, bytes32[] memory branch, uint256 index) private pure returns (bytes32 x) {
        x = leaf;
        for (uint256 i = 0; i < branch.length; i++) {
            x = (index & 1) == 0
                ? sha256(abi.encodePacked(sha256(abi.encodePacked(x, branch[i]))))
                : sha256(abi.encodePacked(sha256(abi.encodePacked(branch[i], x))));
            index >>= 1;
        }
        require(index == 0, "VF-XCH-011: merkle index");
    }

    function _bip34Height(bytes memory tx, uint256 s, uint256 n) private pure returns (uint256 height) {
        require(n > 0, "VF-XCH-011: coinbase height");
        uint8 op = uint8(tx[s]);
        if (op >= 0x51 && op <= 0x60) return op - 0x50;
        require(op >= 1 && op <= 8 && op < n, "VF-XCH-011: coinbase height");
        for (uint256 i = 0; i < op; i++) height |= uint256(uint8(tx[s + 1 + i])) << (8 * i);
        require(uint8(tx[s + op]) & 0x80 == 0, "VF-XCH-011: coinbase height sign");
    }

    // ---------------------------------------------------------------- lock outputs

    function _outputs(bytes memory tx, Out[] memory outs, bytes memory redeem, bytes memory payload)
        private
        view
        returns (uint256 fee, uint256 principal, uint256 maturityHeight)
    {
        require(payload.length == PAYLOAD_LEN, "VF-XCH-011: payload length");
        bytes memory carried = rawBinding ? payload : abi.encodePacked(sha256(payload));
        bytes20 redeemHash = ripemd160(abi.encodePacked(sha256(redeem)));
        bytes memory fund = devFundScript;
        uint256 nFee;
        uint256 nPrincipal;
        uint256 nBinding;
        for (uint256 i = 0; i < outs.length; i++) {
            Out memory o = outs[i];
            if (_eq(tx, o.scriptStart, o.scriptLen, fund)) {
                fee = o.value;
                nFee++;
            } else if (o.scriptLen == 23 && uint8(tx[o.scriptStart]) == 0xa9 && uint8(tx[o.scriptStart + 1]) == 0x14
                && uint8(tx[o.scriptStart + 22]) == 0x87) {
                if (_slice20(tx, o.scriptStart + 2) == redeemHash) {
                    principal = o.value;
                    nPrincipal++;
                }
            } else if (o.scriptLen > 0 && uint8(tx[o.scriptStart]) == 0x6a) {
                if (_isPushOf(tx, o.scriptStart + 1, o.scriptLen - 1, carried)) {
                    require(o.value == 0, "VF-XCH-011: binding value");
                    nBinding++;
                }
            }
        }
        require(nFee == 1, "VF-XCH-011: dev fund output");
        require(nPrincipal == 1, "VF-XCH-011: principal output");
        require(nBinding == 1, "VF-XCH-011: binding output");
        maturityHeight = _cltvHeight(redeem);
    }

    /// redeem = push(height) OP_CHECKLOCKTIMEVERIFY OP_DROP push33(key) OP_CHECKSIG
    function _cltvHeight(bytes memory r) private pure returns (uint256 h) {
        require(r.length > 0, "VF-XCH-011: redeem script");
        uint8 op = uint8(r[0]);
        uint256 i;
        if (op >= 0x51 && op <= 0x60) {
            h = op - 0x50;
            i = 1;
        } else {
            require(op >= 1 && op <= 5, "VF-XCH-011: redeem height");
            require(uint8(r[op]) & 0x80 == 0, "VF-XCH-011: redeem height sign");
            for (uint256 k = 0; k < op; k++) h |= uint256(uint8(r[1 + k])) << (8 * k);
            i = 1 + op;
        }
        require(h < 500000000, "VF-XCH-011: maturity must be a height");
        require(r.length == i + 2 + 1 + 33 + 1, "VF-XCH-011: redeem script shape");
        require(uint8(r[i]) == 0xb1 && uint8(r[i + 1]) == 0x75, "VF-XCH-011: redeem CLTV");
        require(uint8(r[i + 2]) == 0x21, "VF-XCH-011: redeem key");
        uint8 prefix = uint8(r[i + 3]);
        require(prefix == 0x02 || prefix == 0x03, "VF-XCH-011: redeem key form");
        require(uint8(r[i + 36]) == 0xac, "VF-XCH-011: redeem CHECKSIG");
    }

    function _isPushOf(bytes memory tx, uint256 s, uint256 n, bytes memory want) private pure returns (bool) {
        if (n == 0) return false;
        uint8 op = uint8(tx[s]);
        uint256 hdr;
        uint256 len;
        if (op >= 1 && op <= 0x4b) {
            hdr = 1;
            len = op;
        } else if (op == 0x4c && n >= 2) {
            hdr = 2;
            len = uint8(tx[s + 1]);
        } else {
            return false;
        }
        if (hdr + len != n || len != want.length) return false;
        return _eq(tx, s + hdr, len, want);
    }

    // ---------------------------------------------------------------- transaction parsing

    function _parse(bytes memory tx) internal view returns (ParsedTx memory t) {
        uint256 i;
        uint256 n;
        uint256 inStart;
        uint256 outStart;
        uint256 outEnd;
        if (zcash) {
            require(tx.length > 23 && _u32le(tx, 0) == ZEC_V5_HEADER && _u32le(tx, 4) == ZEC_V5_GROUP, "VF-XCH-011: Zcash v5 transaction");
            i = 20;
        } else {
            require(tx.length > 10, "VF-XCH-011: transaction");
            require(uint8(tx[4]) != 0x00, "VF-XCH-011: witness serialization");
            i = 4;
        }
        (n, i) = _compact(tx, i);
        require(n > 0, "VF-XCH-011: no inputs");
        inStart = i;
        bytes memory prevouts = new bytes(n * 36);
        bytes memory seqs = new bytes(n * 4);
        for (uint256 k = 0; k < n; k++) {
            require(i + 36 <= tx.length, "VF-XCH-011: input");
            for (uint256 j = 0; j < 36; j++) prevouts[k * 36 + j] = tx[i + j];
            if (k == 0) {
                bytes32 prev;
                assembly {
                    prev := mload(add(add(tx, 32), i))
                }
                t.firstPrevTxid = prev;
                t.firstPrevVout = _u32le(tx, i + 32);
            }
            i += 36;
            uint256 sl;
            (sl, i) = _compact(tx, i);
            if (k == 0) {
                t.firstScriptStart = i;
                t.firstScriptLen = sl;
            }
            require(i + sl + 4 <= tx.length, "VF-XCH-011: input script");
            i += sl;
            for (uint256 j = 0; j < 4; j++) seqs[k * 4 + j] = tx[i + j];
            i += 4;
        }
        (n, i) = _compact(tx, i);
        require(n > 0, "VF-XCH-011: no outputs");
        outStart = i;
        t.outs = new Out[](n);
        for (uint256 k = 0; k < n; k++) {
            require(i + 9 <= tx.length, "VF-XCH-011: output");
            uint256 v;
            for (uint256 j = 0; j < 8; j++) v |= uint256(uint8(tx[i + j])) << (8 * j);
            i += 8;
            uint256 sl;
            (sl, i) = _compact(tx, i);
            require(i + sl <= tx.length, "VF-XCH-011: output script");
            t.outs[k] = Out(v, i, sl);
            i += sl;
        }
        outEnd = i;
        if (zcash) {
            // ZIP 225 with empty Sapling and Orchard bundles: three zero counts.
            require(i + 3 == tx.length && tx[i] == 0 && tx[i + 1] == 0 && tx[i + 2] == 0, "VF-XCH-011: Zcash shielded data");
            t.txid = _zip244(tx, prevouts, seqs, outStart, outEnd);
        } else {
            require(i + 4 == tx.length, "VF-XCH-011: transaction length");
            t.txid = sha256(abi.encodePacked(sha256(tx)));
        }
        inStart;
    }

    function _zip244(bytes memory tx, bytes memory prevouts, bytes memory seqs, uint256 outStart, uint256 outEnd)
        private
        view
        returns (bytes32)
    {
        bytes memory head = new bytes(20);
        for (uint256 j = 0; j < 20; j++) head[j] = tx[j];
        bytes memory outsRaw = new bytes(outEnd - outStart);
        for (uint256 j = 0; j < outsRaw.length; j++) outsRaw[j] = tx[outStart + j];
        bytes32 transparent = Blake2b.personal256(
            "ZTxIdTranspaHash",
            abi.encodePacked(
                Blake2b.personal256("ZTxIdPrevoutHash", prevouts),
                Blake2b.personal256("ZTxIdSequencHash", seqs),
                Blake2b.personal256("ZTxIdOutputsHash", outsRaw)
            )
        );
        bytes16 person = bytes16(abi.encodePacked("ZcashTxHash_", tx[8], tx[9], tx[10], tx[11]));
        return Blake2b.personal256(
            person,
            abi.encodePacked(
                Blake2b.personal256("ZTxIdHeadersHash", head),
                transparent,
                Blake2b.personal256("ZTxIdSaplingHash", ""),
                Blake2b.personal256("ZTxIdOrchardHash", "")
            )
        );
    }

    // ---------------------------------------------------------------- bytes helpers

    function _compact(bytes memory d, uint256 i) private pure returns (uint256 n, uint256 next) {
        require(i < d.length, "VF-XCH-011: compact size");
        uint8 b = uint8(d[i]);
        if (b < 0xfd) return (b, i + 1);
        uint256 w = b == 0xfd ? 2 : (b == 0xfe ? 4 : 8);
        require(i + 1 + w <= d.length, "VF-XCH-011: compact size");
        for (uint256 k = 0; k < w; k++) n |= uint256(uint8(d[i + 1 + k])) << (8 * k);
        require(n >= (b == 0xfd ? 0xfd : (b == 0xfe ? 0x10000 : 0x100000000)), "VF-XCH-011: compact size form");
        next = i + 1 + w;
    }

    function _u32le(bytes memory d, uint256 i) private pure returns (uint32 v) {
        v = uint32(uint8(d[i])) | (uint32(uint8(d[i + 1])) << 8) | (uint32(uint8(d[i + 2])) << 16) | (uint32(uint8(d[i + 3])) << 24);
    }

    function _eq(bytes memory d, uint256 s, uint256 n, bytes memory want) private pure returns (bool) {
        if (n != want.length || s + n > d.length) return false;
        for (uint256 k = 0; k < n; k++) if (d[s + k] != want[k]) return false;
        return true;
    }

    function _slice20(bytes memory d, uint256 s) private pure returns (bytes20 r) {
        assembly {
            r := mload(add(add(d, 32), s))
        }
    }
}
