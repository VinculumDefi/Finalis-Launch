// SPDX-License-Identifier: PROTOCOL-RESTRICTED
// =============================================================================
// SolanaAttestedLockReader. TEST ONLY. Not registered, not deployed.
//
// Solana cannot be proven trustlessly on Base (docs/SOLANA_READER_FINDINGS_
// 2026-10-19.md). This reader therefore does NOT claim on-chain finality. It
// accepts a lock only when k of n configured attesters have signed one digest
// binding: Base chain id, this contract, the Solana genesis hash (cluster),
// the vault program id, the transaction signature, slot, blockhash, block
// time and every LockCreated field. Each attester is expected to run the
// off-chain checker (testing-rigs/solana-reader/checker.cjs), which asks
// Solana RPC nodes for the transaction and block at commitment "finalized".
//
// Enforced on-chain here: attester set and threshold, distinct signers,
// signature binding to chain id, contract, cluster and program, the 5% fee,
// principal = gross - fee, the 16 permitted durations, maturity = block time
// + duration, lock id = sha256(lock id string), nonzero recipient, output
// token 0 or 1, and native SOL vs SPL asset id.
// Enforced off-chain only (trusted): that the transaction exists, succeeded
// and is finalized on the named cluster, that its ed25519 signatures verify,
// that the event came from the vault program, and that the slot, blockhash
// and fields are what the chain holds. A lying RPC used by k attesters, or k
// compromised attester keys, can mint against a lock that does not exist.
// =============================================================================
pragma solidity 0.8.19;

import "../interfaces/IChainVerifier.sol";

contract SolanaAttestedLockReader is IChainVerifier {
    struct SolanaLock {
        bytes txSignature;        // 64 bytes, first transaction signature
        uint64 slot;
        bytes32 blockhash;        // base58-decoded
        uint64 blockTime;
        string lockIdString;
        bytes32 depositor;        // source account public key
        bytes32 assetMint;        // zero for native SOL, else the SPL mint public key
        uint256 grossAmount;
        uint256 feeAmount;
        uint256 principalAmount;
        uint256 durationSecs;
        uint256 maturityTimestamp;
        address baseRecipient;
        bytes32 releaseDestination;
        uint8 outputToken;
        uint256 verifiedGrossUsd18;
    }

    bytes32 public constant ATTEST_TYPEHASH = keccak256("VinculumSolanaLockAttestation(uint256 baseChainId,address reader,bytes32 genesisHash,bytes32 programId,bytes32 lockHash)");
    string public constant ENVIRONMENT = "Solana";
    uint256 public constant STANDARD_FEE_BPS = 500;
    uint256 private constant SECP256K1_HALF_N = 0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0;

    bytes32 public immutable genesisHash;
    bytes32 public immutable programId;
    uint256 public immutable threshold;
    mapping(address => bool) public isAttester;
    uint256 public attesterCount;

    constructor(bytes32 _genesisHash, bytes32 _programId, address[] memory _attesters, uint256 _threshold) {
        require(_genesisHash != bytes32(0) && _programId != bytes32(0), "SAR: zero id");
        require(_threshold > 0 && _threshold <= _attesters.length, "SAR: threshold");
        for (uint256 i = 0; i < _attesters.length; i++) {
            require(_attesters[i] != address(0) && !isAttester[_attesters[i]], "SAR: attester");
            isAttester[_attesters[i]] = true;
        }
        attesterCount = _attesters.length;
        genesisHash = _genesisHash;
        programId = _programId;
        threshold = _threshold;
    }

    function attestationDigest(bytes calldata lockEventProof) public view returns (bytes32) {
        bytes32 inner = keccak256(abi.encode(ATTEST_TYPEHASH, block.chainid, address(this), genesisHash, programId, keccak256(lockEventProof)));
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", inner));
    }

    function _permitted(uint256 d) internal pure returns (bool) {
        return d == 3600 || d == 604800 || d == 2592000 || d == 5184000 || d == 7776000 || d == 15552000
            || d == 31536000 || d == 63072000 || d == 94608000 || d == 126144000 || d == 157680000
            || d == 189216000 || d == 220752000 || d == 252288000 || d == 283824000 || d == 315360000;
    }

    function _decode(bytes calldata lockEventProof) internal pure returns (SolanaLock memory l) {
        l = abi.decode(lockEventProof, (SolanaLock));
        require(l.txSignature.length == 64, "SAR: signature length");
        require(bytes(l.lockIdString).length > 0, "SAR: lock id");
        require(l.baseRecipient != address(0), "SAR: recipient");
        require(l.outputToken <= 1, "SAR: output token");
        require(l.grossAmount > 0, "SAR: gross");
        require(l.feeAmount == (l.grossAmount * STANDARD_FEE_BPS) / 10000, "SAR: fee");
        require(l.feeAmount > 0 && l.principalAmount == l.grossAmount - l.feeAmount, "SAR: principal");
        require(_permitted(l.durationSecs), "SAR: duration");
        require(l.maturityTimestamp == uint256(l.blockTime) + l.durationSecs, "SAR: maturity");
    }

    function _recover(bytes32 digest, bytes memory sig) internal pure returns (address) {
        require(sig.length == 65, "SAR: sig length");
        bytes32 r; bytes32 s; uint8 v;
        assembly { r := mload(add(sig, 32)) s := mload(add(sig, 64)) v := byte(0, mload(add(sig, 96))) }
        require(uint256(s) <= SECP256K1_HALF_N && (v == 27 || v == 28), "SAR: sig form");
        address a = ecrecover(digest, v, r, s);
        require(a != address(0), "SAR: sig");
        return a;
    }

    function verifyFinality(bytes calldata lockEventProof, bytes calldata sourceFinalityProof)
        external view override returns (bool finalized, bytes32 sourceBlockHash, uint256 sourceBlockHeight)
    {
        SolanaLock memory l = _decode(lockEventProof);
        bytes[] memory sigs = abi.decode(sourceFinalityProof, (bytes[]));
        bytes32 digest = attestationDigest(lockEventProof);
        address last = address(0);
        uint256 good = 0;
        for (uint256 i = 0; i < sigs.length; i++) {
            address a = _recover(digest, sigs[i]);
            require(a > last, "SAR: signers not strictly ascending");
            last = a;
            require(isAttester[a], "SAR: not an attester");
            good++;
        }
        require(good >= threshold, "SAR: below threshold");
        return (true, l.blockhash, l.slot);
    }

    function extractFacts(bytes calldata lockEventProof) external pure override returns (
        bytes32 lockId, uint256 grossAmount, uint256 feeAmount, uint256 principalAmount, uint256 durationSecs,
        uint256 creationTimestamp, uint256 maturityTimestamp, address baseRecipient, uint8 outputToken
    ) {
        SolanaLock memory l = _decode(lockEventProof);
        return (sha256(bytes(l.lockIdString)), l.grossAmount, l.feeAmount, l.principalAmount, l.durationSecs,
            uint256(l.blockTime), l.maturityTimestamp, l.baseRecipient, l.outputToken);
    }

    // Native SOL: the registry form keccak256(abi.encodePacked(env, "native-SOL")).
    // SPL: keccak256(abi.encode(env, mint)) with a 32-byte mint. LATENT CONFLICT:
    // the Verifier's token index is keyed by a 20-byte EVM address, so an SPL
    // row could not be resolved through it without a new index form.
    function extractAssetId(bytes calldata lockEventProof) external pure override returns (bytes32) {
        SolanaLock memory l = _decode(lockEventProof);
        if (l.assetMint == bytes32(0)) return keccak256(abi.encodePacked(ENVIRONMENT, "native-SOL"));
        return keccak256(abi.encode(ENVIRONMENT, l.assetMint));
    }
}
