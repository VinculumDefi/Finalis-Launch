// SPDX-License-Identifier: PROTOCOL-RESTRICTED
pragma solidity 0.8.19;

import "../interfaces/IChainVerifier.sol";
import "../CommitmentDurations.sol";
import "../checkers/Sha512.sol";

/// @title XrplLockReader
/// @notice VF-XCH-011 for the XRP Ledger. Proves a Commitment Vault lock from
/// XRP Ledger data only:
///   1. Ledger header (118 bytes, binary form). Ledger hash =
///      SHA-512Half("LWR\0" || header). verifyFinality checks the package's
///      claim (ledgerHash, ledgerIndex) against it.
///   2. The lock is two transactions in that ledger, from the same account:
///      a Payment of the fee to the Dev Fund (fixed at construction) and an
///      EscrowCreate of the principal. Each is proven through the ledger's
///      transaction tree: txid = SHA-512Half("TXN\0" || tx); leaf =
///      SHA-512Half("SND\0" || VL(tx) || VL(meta) || txid); inner node =
///      SHA-512Half("MIN\0" || 16 child hashes); the root must equal the
///      header's transaction_hash. The child slot at each level is the txid
///      nibble, so a leaf cannot be moved.
///   3. Both metadata blobs must carry TransactionResult = tesSUCCESS (0).
///   4. Both transactions carry one memo "vf-lock-sha256" whose data is
///      SHA-256 of the 117-byte payload (lock id 32, Base recipient 20,
///      output token 1, asset identity 32, valuation 32); the Payment's
///      InvoiceID is the same hash. Lock id, recipient and output token come
///      from that payload.
///   5. Amounts are native XRP drops. fee = Payment amount, principal =
///      EscrowCreate amount, gross = fee + principal, fee == floor(gross * 5%).
///      No partial payment, SendMax, DeliverMin or paths. The EscrowCreate has
///      FinishAfter, no CancelAfter and no Condition.
///   6. createdAt = ledger close time, maturity = FinishAfter (both Unix).
///      The package's duration must be permitted and match maturity - createdAt
///      within TOLERANCE_SECS (FinishAfter is set from the previous close).
/// SCOPE: proves the lock is in the ledger whose hash the package names.
contract XrplLockReader is IChainVerifier {
    string public constant ENVIRONMENT_ID = "XRP Ledger";
    uint256 public constant FEE_BPS = 500;
    uint256 public constant BPS = 10000;
    uint256 public constant RIPPLE_EPOCH = 946684800;
    uint256 public constant TOLERANCE_SECS = 1 hours;
    uint256 public constant HEADER_LEN = 118;
    bytes32 public constant MEMO_TYPE = keccak256("vf-lock-sha256");
    bytes32 public immutable nativeAssetId = keccak256(abi.encodePacked("XRP Ledger", "native-XRP"));

    /// Dev Fund AccountID (20 bytes, the decoded r-address).
    bytes20 public immutable devFundAccount;

    struct LockProof {
        bytes header;
        bytes paymentTx;
        bytes paymentMeta;
        bytes[] paymentInner; // leaf side first, 512 bytes each
        bytes escrowTx;
        bytes escrowMeta;
        bytes[] escrowInner;
        bytes payload; // 117 bytes
        uint256 durationSecs;
    }

    struct Tx {
        uint256 txType;
        bytes20 account;
        bytes20 destination;
        uint256 amount;
        bool amountNative;
        bytes32 invoiceId;
        uint256 finishAfter;
        uint256 flags;
        bool hasFinishAfter;
        bool forbidden; // CancelAfter, Condition, SendMax, DeliverMin, Paths
        uint256 memoCount;
        bytes32 memoTypeHash;
        bytes memoData;
    }

    constructor(bytes20 devFundAccount_) {
        require(devFundAccount_ != bytes20(0), "VF-XCH-011: dev fund");
        devFundAccount = devFundAccount_;
    }

    // ------------------------------------------------------------ IChainVerifier

    /// @notice Fail closed (fix 2026-10-23, AG-03). This reader proves a lock
    /// is in the ledger the package names, but nothing on-chain anchors that
    /// ledger to the chain's settled history: the ledger header is checked only against its own hash. No UNL validator signature is verified. Until an authoritative
    /// anchor exists, finality is refused and the environment stays disabled.
    /// headerClaimMatches keeps the ledger binding check available.
    function verifyFinality(bytes calldata, bytes calldata)
        external
        view
        returns (bool, bytes32, uint256)
    {
        revert(string.concat("VF-XCH-006: ", ENVIRONMENT_ID, " settled-history anchor not enforced on-chain; environment disabled"));
    }

    function headerClaimMatches(bytes calldata lockEventProof, bytes calldata sourceFinalityProof)
        external
        pure
        returns (bytes32, uint256)
    {
        LockProof memory p = abi.decode(lockEventProof, (LockProof));
        (bytes32 hash, uint256 index, , ) = _header(p.header);
        (bytes32 claimedHash, uint256 claimedIndex) = abi.decode(sourceFinalityProof, (bytes32, uint256));
        require(claimedHash == hash, "VF-XCH-006: ledger hash mismatch");
        require(claimedIndex == index, "VF-XCH-006: ledger index mismatch");
        return (hash, index);
    }

    function extractFacts(bytes calldata lockEventProof)
        external
        view
        returns (bytes32, uint256, uint256, uint256, uint256, uint256, uint256, address, uint8)
    {
        LockProof memory p = abi.decode(lockEventProof, (LockProof));
        (, , bytes32 txRoot, uint256 closeTime) = _header(p.header);
        _proveInTree(p.paymentTx, p.paymentMeta, p.paymentInner, txRoot);
        _proveInTree(p.escrowTx, p.escrowMeta, p.escrowInner, txRoot);

        Tx memory pay = _parseTx(p.paymentTx);
        Tx memory esc = _parseTx(p.escrowTx);
        require(pay.txType == 0, "VF-XCH-011: first transaction is not a Payment");
        require(esc.txType == 1, "VF-XCH-011: second transaction is not an EscrowCreate");
        require(pay.account == esc.account, "VF-XCH-011: lock transactions from different accounts");
        require(pay.destination == devFundAccount, "VF-XCH-011: fee not paid to the Dev Fund");
        require(pay.amountNative && esc.amountNative, "VF-XCH-011: not native XRP");
        require(!pay.forbidden && !esc.forbidden, "VF-XCH-011: forbidden field");
        require(pay.flags & 0x00020000 == 0, "VF-XCH-011: partial payment");
        require(esc.hasFinishAfter, "VF-XCH-011: no FinishAfter");

        require(p.payload.length == 117, "VF-XCH-011: payload length");
        bytes32 binding = sha256(p.payload);
        require(pay.invoiceId == binding, "VF-XCH-011: InvoiceID binding");
        _requireMemo(pay, binding);
        _requireMemo(esc, binding);

        uint256 fee = pay.amount;
        uint256 principal = esc.amount;
        uint256 gross = fee + principal;
        require(fee != 0 && principal != 0 && fee == (gross * FEE_BPS) / BPS, "VF-XCH-011: fee is not 5%");

        uint256 createdAt = closeTime + RIPPLE_EPOCH;
        uint256 maturity = esc.finishAfter + RIPPLE_EPOCH;
        uint256 d = p.durationSecs;
        require(CommitmentDurations.multiplierBps(d) != 0, "VF-XCH-011: duration not permitted");
        require(maturity > createdAt, "VF-XCH-011: maturity not after lock ledger");
        uint256 remaining = maturity - createdAt;
        require(remaining <= d && d - remaining <= TOLERANCE_SECS, "VF-XCH-011: maturity does not match duration");

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
        return (lockId, gross, fee, principal, d, createdAt, maturity, recipient, outputToken);
    }

    /// @notice An XRP Ledger escrow lock holds native XRP. The full extractFacts
    /// proof must hold first.
    function extractAssetId(bytes calldata lockEventProof) external view returns (bytes32) {
        this.extractFacts(lockEventProof);
        return nativeAssetId;
    }

    /// @notice Helper for tests and tooling: SHA-512Half of `data`.
    function sha512Half(bytes calldata data) external pure returns (bytes32) {
        return Sha512.sha512half(data);
    }

    // ------------------------------------------------------------ internals

    function _header(bytes memory hdr) internal pure returns (bytes32 hash, uint256 index, bytes32 txRoot, uint256 closeTime) {
        require(hdr.length == HEADER_LEN, "VF-XCH-006: header length");
        hash = Sha512.sha512half(abi.encodePacked(bytes4(0x4C575200), hdr));
        uint256 w0;
        assembly {
            w0 := mload(add(hdr, 32))
            txRoot := mload(add(hdr, 76)) // offset 44
        }
        index = w0 >> 224;
        closeTime = uint256(uint32(bytes4(_slice4(hdr, 112))));
    }

    function _slice4(bytes memory b, uint256 off) private pure returns (bytes4 r) {
        assembly { r := mload(add(add(b, 32), off)) }
    }

    function _proveInTree(bytes memory txb, bytes memory meta, bytes[] memory inner, bytes32 root) internal pure {
        require(_result(meta) == 0, "VF-XCH-011: transaction did not succeed");
        bytes32 txid = Sha512.sha512half(abi.encodePacked(bytes4(0x54584E00), txb));
        bytes32 h = Sha512.sha512half(abi.encodePacked(bytes4(0x534E4400), _vl(txb.length), txb, _vl(meta.length), meta, txid));
        uint256 depth = inner.length;
        require(depth != 0 && depth <= 64, "VF-XCH-011: tree depth");
        for (uint256 i = 0; i < depth; i++) {
            bytes memory node = inner[i];
            require(node.length == 512, "VF-XCH-011: inner node");
            uint256 level = depth - 1 - i;
            uint256 nib = (uint256(txid) >> (252 - 4 * level)) & 15;
            bytes32 slot;
            assembly { slot := mload(add(add(node, 32), mul(nib, 32))) }
            require(slot == h, "VF-XCH-011: not in transaction tree");
            h = Sha512.sha512half(abi.encodePacked(bytes4(0x4D494E00), node));
        }
        require(h == root, "VF-XCH-011: transaction tree root");
    }

    function _vl(uint256 n) private pure returns (bytes memory) {
        if (n <= 192) return abi.encodePacked(uint8(n));
        if (n <= 12480) {
            uint256 m = n - 193;
            return abi.encodePacked(uint8(193 + (m >> 8)), uint8(m & 0xff));
        }
        require(n <= 918744, "VF-XCH-011: blob too long");
        uint256 m2 = n - 12481;
        return abi.encodePacked(uint8(241 + (m2 >> 16)), uint8((m2 >> 8) & 0xff), uint8(m2 & 0xff));
    }

    function _requireMemo(Tx memory t, bytes32 binding) private pure {
        require(t.memoCount == 1, "VF-XCH-011: memo count");
        require(t.memoTypeHash == MEMO_TYPE, "VF-XCH-011: memo type");
        require(t.memoData.length == 32 && bytes32(t.memoData) == binding, "VF-XCH-011: memo binding");
    }

    // --- XRPL binary codec (subset). Field header: type and field codes.

    function _fieldHeader(bytes memory b, uint256 i) private pure returns (uint256 typ, uint256 fld, uint256 j) {
        require(i < b.length, "VF-XCH-011: truncated");
        uint256 x = uint8(b[i]);
        typ = x >> 4;
        fld = x & 15;
        j = i + 1;
        if (typ == 0) { typ = uint8(b[j]); j++; }
        if (fld == 0) { fld = uint8(b[j]); j++; }
    }

    function _readVl(bytes memory b, uint256 i) private pure returns (uint256 len, uint256 j) {
        uint256 b1 = uint8(b[i]);
        if (b1 <= 192) return (b1, i + 1);
        if (b1 <= 240) return (193 + ((b1 - 193) << 8) + uint8(b[i + 1]), i + 2);
        require(b1 <= 254, "VF-XCH-011: bad length");
        return (12481 + ((b1 - 241) << 16) + (uint256(uint8(b[i + 1])) << 8) + uint8(b[i + 2]), i + 3);
    }

    /// Returns the index just past the value of a field of type `typ` at `i`.
    function _skip(bytes memory b, uint256 typ, uint256 i) private pure returns (uint256) {
        if (typ == 16) return i + 1; // UInt8
        if (typ == 1) return i + 2; // UInt16
        if (typ == 2) return i + 4; // UInt32
        if (typ == 3) return i + 8; // UInt64
        if (typ == 4) return i + 16; // Hash128
        if (typ == 17) return i + 20; // Hash160
        if (typ == 5) return i + 32; // Hash256
        if (typ == 6) return i + ((uint8(b[i]) & 0x80) == 0 ? 8 : 48); // Amount
        if (typ == 7 || typ == 8 || typ == 19) { // Blob, AccountID, Vector256
            (uint256 len, uint256 j) = _readVl(b, i);
            return j + len;
        }
        if (typ == 14 || typ == 15) { // STObject / STArray: until end marker
            uint256 endMarker = typ == 14 ? 0xE1 : 0xF1;
            while (true) {
                require(i < b.length, "VF-XCH-011: truncated object");
                if (uint8(b[i]) == endMarker) return i + 1;
                (uint256 t2, , uint256 j2) = _fieldHeader(b, i);
                i = _skip(b, t2, j2);
            }
        }
        revert("VF-XCH-011: unsupported field type");
    }

    function _result(bytes memory meta) private pure returns (uint256) {
        uint256 i = 0;
        while (i < meta.length) {
            (uint256 typ, uint256 fld, uint256 j) = _fieldHeader(meta, i);
            if (typ == 16 && fld == 3) return uint8(meta[j]);
            i = _skip(meta, typ, j);
        }
        revert("VF-XCH-011: no TransactionResult");
    }

    function _parseTx(bytes memory b) private pure returns (Tx memory t) {
        t.txType = type(uint256).max;
        uint256 i = 0;
        while (i < b.length) {
            (uint256 typ, uint256 fld, uint256 j) = _fieldHeader(b, i);
            if (typ == 1 && fld == 2) {
                t.txType = (uint256(uint8(b[j])) << 8) | uint8(b[j + 1]);
            } else if (typ == 2 && fld == 2) {
                t.flags = uint256(uint32(bytes4(_slice4(b, j))));
            } else if (typ == 2 && fld == 37) {
                t.finishAfter = uint256(uint32(bytes4(_slice4(b, j))));
                t.hasFinishAfter = true;
            } else if ((typ == 2 && fld == 36) || (typ == 7 && fld == 17) || (typ == 6 && (fld == 9 || fld == 10)) || typ == 18) {
                t.forbidden = true; // CancelAfter, Condition, SendMax, DeliverMin, Paths
                if (typ == 18) return t;
            } else if (typ == 6 && fld == 1) {
                uint256 v;
                assembly { v := shr(192, mload(add(add(b, 32), j))) }
                t.amountNative = (v >> 63) == 0 && ((v >> 62) & 1) == 1;
                t.amount = v & 0x3FFFFFFFFFFFFFFF;
            } else if (typ == 8 && (fld == 1 || fld == 3)) {
                (uint256 len, uint256 k) = _readVl(b, j);
                require(len == 20, "VF-XCH-011: account length");
                bytes20 a;
                assembly { a := mload(add(add(b, 32), k)) }
                if (fld == 1) t.account = a; else t.destination = a;
            } else if (typ == 5 && fld == 17) {
                bytes32 inv;
                assembly { inv := mload(add(add(b, 32), j)) }
                t.invoiceId = inv;
            } else if (typ == 15 && fld == 9) {
                i = _memos(b, j, t);
                continue;
            }
            i = _skip(b, typ, j);
        }
        require(i == b.length, "VF-XCH-011: trailing bytes");
    }

    function _memos(bytes memory b, uint256 i, Tx memory t) private pure returns (uint256) {
        while (true) {
            require(i < b.length, "VF-XCH-011: truncated memos");
            if (uint8(b[i]) == 0xF1) return i + 1;
            (uint256 typ, uint256 fld, uint256 j) = _fieldHeader(b, i);
            require(typ == 14 && fld == 10, "VF-XCH-011: memo shape");
            t.memoCount++;
            i = j;
            while (uint8(b[i]) != 0xE1) {
                (uint256 t2, uint256 f2, uint256 j2) = _fieldHeader(b, i);
                require(t2 == 7, "VF-XCH-011: memo field");
                (uint256 len, uint256 k) = _readVl(b, j2);
                bytes memory v = new bytes(len);
                for (uint256 x = 0; x < len; x++) v[x] = b[k + x];
                if (f2 == 12) t.memoTypeHash = keccak256(v);
                else if (f2 == 13) t.memoData = v;
                i = k + len;
            }
            i++;
        }
        return i;
    }
}
