// SPDX-License-Identifier: PROTOCOL-RESTRICTED
pragma solidity 0.8.19;

import "../interfaces/IChainVerifier.sol";
import "../CommitmentDurations.sol";

/// @title StellarLockReader
/// @notice VF-XCH-011 for Stellar. Proves a Commitment Vault lock from Stellar
/// ledger data only (XDR, SHA-256 precompile):
///   1. LedgerHeader XDR. Ledger hash = SHA-256(header XDR). verifyFinality
///      checks the package's claim (ledgerHash, ledgerSeq) against it.
///   2. The FULL TransactionResultSet XDR of that ledger is supplied; its
///      SHA-256 must equal the header's txSetResultHash. It is parsed
///      structurally (every result skipped by its XDR type, no byte search),
///      and must contain the pair (lock tx hash, txSUCCESS), directly or as
///      the inner pair of a fee-bump. This proves the transaction was applied
///      in that ledger and succeeded. The transaction set itself is not needed:
///      the result set is keyed by the transaction hash.
///   3. The lock Transaction XDR is supplied. Its hash is
///      SHA-256(networkId || ENVELOPE_TYPE_TX || tx XDR) (networkId fixed at
///      construction). It must be exactly: source account, no or time-bound
///      preconditions, memo HASH = SHA-256(117-byte payload), two operations
///      without op source: (a) native Payment to the Dev Fund (fixed at
///      construction), (b) native CreateClaimableBalance with one claimant and
///      predicate NOT(BEFORE_ABSOLUTE_TIME(maturity)); ext v0.
///   4. fee = Payment amount, principal = claimable balance amount (stroops),
///      gross = fee + principal, fee == floor(gross * 5%). Lock id, Base
///      recipient and output token come from the payload. createdAt = ledger
///      close time; the package duration must be permitted and match
///      maturity - createdAt within TOLERANCE_SECS.
/// SCOPE: proves the lock is in the ledger whose hash the package names.
/// Preconditions V2 and Soroban (ext v1) transactions are refused (fail closed).
contract StellarLockReader is IChainVerifier {
    string public constant ENVIRONMENT_ID = "Stellar";
    uint256 public constant FEE_BPS = 500;
    uint256 public constant BPS = 10000;
    uint256 public constant TOLERANCE_SECS = 1 hours;
    bytes32 public immutable nativeAssetId = keccak256(abi.encodePacked("Stellar", "native-XLM"));

    bytes32 public immutable networkId;
    bytes32 public immutable devFundKey; // ed25519 public key of the Dev Fund (G... decoded)

    struct LockProof {
        bytes header;
        bytes resultSet;
        bytes txXdr;
        bytes payload; // 117 bytes
        uint256 durationSecs;
    }

    struct Lock {
        uint256 fee;
        uint256 principal;
        uint256 maturity;
        bytes32 memo;
    }

    constructor(bytes32 networkId_, bytes32 devFundKey_) {
        require(networkId_ != bytes32(0) && devFundKey_ != bytes32(0), "VF-XCH-011: config");
        networkId = networkId_;
        devFundKey = devFundKey_;
    }

    // ------------------------------------------------------------ IChainVerifier

    /// @notice Fail closed (fix 2026-10-23, AG-03). This reader proves a lock
    /// is in the ledger the package names, but nothing on-chain anchors that
    /// ledger to the chain's settled history: the ledger header is checked only against its own hash. No SCP quorum signature is verified. Until an authoritative
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
        (bytes32 hash, uint256 seq, , ) = _header(p.header);
        (bytes32 claimedHash, uint256 claimedSeq) = abi.decode(sourceFinalityProof, (bytes32, uint256));
        require(claimedHash == hash, "VF-XCH-006: ledger hash mismatch");
        require(claimedSeq == seq, "VF-XCH-006: ledger sequence mismatch");
        return (hash, seq);
    }

    function extractFacts(bytes calldata lockEventProof)
        external
        view
        returns (bytes32, uint256, uint256, uint256, uint256, uint256, uint256, address, uint8)
    {
        LockProof memory p = abi.decode(lockEventProof, (LockProof));
        (, , bytes32 resultHash, uint256 closeTime) = _header(p.header);
        require(sha256(p.resultSet) == resultHash, "VF-XCH-011: result set hash");
        bytes32 txHash = sha256(abi.encodePacked(networkId, uint32(2), p.txXdr));
        require(_succeeded(p.resultSet, txHash), "VF-XCH-011: transaction not applied successfully in this ledger");

        Lock memory l = _parseTx(p.txXdr);
        require(p.payload.length == 117, "VF-XCH-011: payload length");
        require(l.memo == sha256(p.payload), "VF-XCH-011: memo binding");
        uint256 gross = l.fee + l.principal;
        require(l.fee != 0 && l.principal != 0 && l.fee == (gross * FEE_BPS) / BPS, "VF-XCH-011: fee is not 5%");

        uint256 d = p.durationSecs;
        require(CommitmentDurations.multiplierBps(d) != 0, "VF-XCH-011: duration not permitted");
        require(l.maturity > closeTime, "VF-XCH-011: maturity not after lock ledger");
        uint256 remaining = l.maturity - closeTime;
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
        return (lockId, gross, l.fee, l.principal, d, closeTime, l.maturity, recipient, outputToken);
    }

    /// @notice A Stellar claimable-balance lock read here holds native XLM.
    function extractAssetId(bytes calldata lockEventProof) external view returns (bytes32) {
        this.extractFacts(lockEventProof);
        return nativeAssetId;
    }

    // ------------------------------------------------------------ XDR helpers

    function _u32(bytes memory b, uint256 i) private pure returns (uint256 v) {
        require(i + 4 <= b.length, "VF-XCH-011: truncated XDR");
        assembly { v := shr(224, mload(add(add(b, 32), i))) }
    }

    function _u64(bytes memory b, uint256 i) private pure returns (uint256 v) {
        require(i + 8 <= b.length, "VF-XCH-011: truncated XDR");
        assembly { v := shr(192, mload(add(add(b, 32), i))) }
    }

    function _b32(bytes memory b, uint256 i) private pure returns (bytes32 v) {
        require(i + 32 <= b.length, "VF-XCH-011: truncated XDR");
        assembly { v := mload(add(add(b, 32), i)) }
    }

    function _i32(bytes memory b, uint256 i) private pure returns (int256) {
        return int256(int32(uint32(_u32(b, i))));
    }

    /// variable opaque / string: 4-byte length + data padded to 4.
    function _skipOpaque(bytes memory b, uint256 i) private pure returns (uint256) {
        uint256 n = _u32(b, i);
        return i + 4 + ((n + 3) & ~uint256(3));
    }

    // ------------------------------------------------------------ header

    function _header(bytes memory h) internal pure returns (bytes32 hash, uint256 seq, bytes32 resultHash, uint256 closeTime) {
        hash = sha256(h);
        uint256 i = 4 + 32 + 32; // ledgerVersion, previousLedgerHash, scpValue.txSetHash
        closeTime = _u64(h, i);
        i += 8;
        uint256 nUp = _u32(h, i);
        require(nUp <= 6, "VF-XCH-006: upgrades");
        i += 4;
        for (uint256 k = 0; k < nUp; k++) i = _skipOpaque(h, i);
        uint256 extType = _u32(h, i);
        i += 4;
        if (extType == 1) {
            require(_u32(h, i) == 0, "VF-XCH-006: node id type");
            i = _skipOpaque(h, i + 36); // nodeID, then signature
        } else {
            require(extType == 0, "VF-XCH-006: scp value ext");
        }
        resultHash = _b32(h, i);
        i += 32 + 32; // txSetResultHash, bucketListHash
        seq = _u32(h, i);
    }

    // ------------------------------------------------------------ results

    function _succeeded(bytes memory r, bytes32 txHash) internal pure returns (bool found) {
        uint256 n = _u32(r, 0);
        uint256 i = 4;
        for (uint256 k = 0; k < n; k++) {
            bytes32 h = _b32(r, i);
            i += 32;
            i += 8; // feeCharged
            int256 code = _i32(r, i);
            i += 4;
            if (code == 1 || code == -13) {
                // fee bump: InnerTransactionResultPair
                bytes32 innerHash = _b32(r, i);
                i += 32 + 8;
                int256 innerCode = _i32(r, i);
                i += 4;
                if (innerCode == 0 || innerCode == -1) i = _opResults(r, i);
                require(_u32(r, i) == 0, "VF-XCH-011: inner ext");
                i += 4;
                if (innerHash == txHash && innerCode == 0 && code == 1) found = true;
            } else if (code == 0 || code == -1) {
                i = _opResults(r, i);
                if (h == txHash && code == 0) found = true;
            }
            require(_u32(r, i) == 0, "VF-XCH-011: result ext");
            i += 4;
        }
        require(i == r.length, "VF-XCH-011: result set length");
    }

    function _opResults(bytes memory r, uint256 i) private pure returns (uint256) {
        uint256 n = _u32(r, i);
        require(n <= 100, "VF-XCH-011: op results");
        i += 4;
        for (uint256 k = 0; k < n; k++) {
            int256 code = _i32(r, i);
            i += 4;
            if (code != 0) continue; // opBAD_AUTH etc.: void
            uint256 opType = _u32(r, i);
            i += 4;
            int256 c = _i32(r, i);
            i += 4;
            if (opType == 2 || opType == 13) {
                // path payments: SUCCESS -> ClaimAtom offers<> + SimplePaymentResult; NO_ISSUER(-9) -> Asset
                if (c == 0) {
                    uint256 m = _u32(r, i);
                    i += 4;
                    for (uint256 x = 0; x < m; x++) i = _claimAtom(r, i);
                    i = _asset(r, i + 36) + 8; // destination, asset, amount
                } else if (c == -9) {
                    i = _asset(r, i);
                }
            } else if (opType == 3 || opType == 4 || opType == 12) {
                if (c == 0) {
                    uint256 m = _u32(r, i);
                    i += 4;
                    for (uint256 x = 0; x < m; x++) i = _claimAtom(r, i);
                    uint256 effect = _u32(r, i);
                    i += 4;
                    if (effect == 0 || effect == 1) {
                        // OfferEntry: sellerID, offerID, selling, buying, amount, price, flags, ext
                        i = _asset(r, i + 36 + 8);
                        i = _asset(r, i);
                        i += 8 + 8 + 4;
                        require(_u32(r, i) == 0, "VF-XCH-011: offer ext");
                        i += 4;
                    } else {
                        require(effect == 2, "VF-XCH-011: offer effect");
                    }
                }
            } else if (opType == 8) {
                if (c == 0) i += 8;
            } else if (opType == 9) {
                if (c == 0) {
                    uint256 m = _u32(r, i);
                    require(m <= 1000, "VF-XCH-011: payouts");
                    i += 4 + m * 44;
                }
            } else if (opType == 14) {
                if (c == 0) {
                    require(_u32(r, i) == 0, "VF-XCH-011: balance id type");
                    i += 36;
                }
            } else if (opType == 24) {
                if (c == 0) i += 32;
            } else {
                require(opType <= 26, "VF-XCH-011: unknown operation result");
            }
        }
        return i;
    }

    function _asset(bytes memory r, uint256 i) private pure returns (uint256) {
        uint256 t = _u32(r, i);
        if (t == 0) return i + 4;
        if (t == 1) return i + 4 + 4 + 36;
        require(t == 2, "VF-XCH-011: asset type");
        return i + 4 + 12 + 36;
    }

    function _claimAtom(bytes memory r, uint256 i) private pure returns (uint256) {
        uint256 t = _u32(r, i);
        i += 4;
        if (t == 0) i += 32 + 8; // sellerEd25519, offerID
        else if (t == 1) i += 36 + 8; // sellerID, offerID
        else { require(t == 2, "VF-XCH-011: claim atom"); i += 32; } // liquidityPoolID
        i = _asset(r, i) + 8;
        return _asset(r, i) + 8;
    }

    // ------------------------------------------------------------ transaction

    function _muxedEd25519(bytes memory b, uint256 i) private pure returns (bytes32 key, uint256 j) {
        uint256 t = _u32(b, i);
        if (t == 0) return (_b32(b, i + 4), i + 36);
        require(t == 0x100, "VF-XCH-011: account type");
        return (_b32(b, i + 12), i + 44);
    }

    function _parseTx(bytes memory b) internal view returns (Lock memory l) {
        (, uint256 i) = _muxedEd25519(b, 0);
        i += 4 + 8; // fee, seqNum
        uint256 cond = _u32(b, i);
        i += 4;
        if (cond == 1) i += 16;
        else require(cond == 0, "VF-XCH-011: preconditions");
        require(_u32(b, i) == 3, "VF-XCH-011: memo is not a hash");
        l.memo = _b32(b, i + 4);
        i += 36;
        require(_u32(b, i) == 2, "VF-XCH-011: operation count");
        i += 4;

        // (a) Payment of native XLM to the Dev Fund
        require(_u32(b, i) == 0, "VF-XCH-011: operation source");
        require(_u32(b, i + 4) == 1, "VF-XCH-011: first operation is not a Payment");
        bytes32 dest;
        (dest, i) = _muxedEd25519(b, i + 8);
        require(dest == devFundKey, "VF-XCH-011: fee not paid to the Dev Fund");
        require(_u32(b, i) == 0, "VF-XCH-011: fee asset is not native");
        l.fee = _u64(b, i + 4);
        i += 12;

        // (b) CreateClaimableBalance of native XLM, one claimant, NOT(BEFORE_ABSOLUTE_TIME(maturity))
        require(_u32(b, i) == 0, "VF-XCH-011: operation source");
        require(_u32(b, i + 4) == 14, "VF-XCH-011: second operation is not CreateClaimableBalance");
        require(_u32(b, i + 8) == 0, "VF-XCH-011: principal asset is not native");
        l.principal = _u64(b, i + 12);
        i += 20;
        require(_u32(b, i) == 1, "VF-XCH-011: claimant count");
        require(_u32(b, i + 4) == 0 && _u32(b, i + 8) == 0, "VF-XCH-011: claimant type");
        i += 12 + 32; // claimant v0, account id type, key
        require(_u32(b, i) == 3 && _u32(b, i + 4) == 1 && _u32(b, i + 8) == 4, "VF-XCH-011: claim predicate");
        l.maturity = _u64(b, i + 12);
        i += 20;
        require(_u32(b, i) == 0, "VF-XCH-011: transaction ext");
        require(i + 4 == b.length, "VF-XCH-011: trailing bytes");
    }
}
