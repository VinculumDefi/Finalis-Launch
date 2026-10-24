// SPDX-License-Identifier: PROTOCOL-RESTRICTED
pragma solidity 0.8.19;

import "../interfaces/IChainVerifier.sol";
import "../checkers/BaseBeaconRootAnchor.sol";
import "../checkers/EvmStorageProof.sol";

/// @title EthereumStorageLockReader
/// @notice Ethereum reader with an on-chain settled-history anchor
/// (VF-XCH-006, VF-XCH-008, VF-XCH-010, VF-XCH-011).
///
/// Finality: BaseBeaconRootAnchor proves an Ethereum mainnet execution block
/// that is the finalized checkpoint block of a beacon state anchored in
/// Base's EIP-4788 contract. The relayer chooses nothing that matters: every
/// value is a hash link to that root.
///
/// Lock: the CommitmentVaultLock keeps each LockRecord in storage forever
/// (release only sets a flag), so the record is proven by eth_getProof
/// account and storage proofs against the finalized execution state root.
/// A record present in finalized state was created at or before the latest
/// finalized block (Architecture C.1: lock_block <= latest finalized block).
/// No receipt or ancestry proof is needed.
///
/// The lock is pinned by address AND by exact runtime code hash. The code
/// must match a reviewed build (keccak with the devFund immutables zeroed),
/// and the devFund is read from that code, never from a caller.
/// sourceFinalityProof must be empty: the anchor travels in lockEventProof
/// so extractFacts, extractAssetId and lockDevFund re-verify it themselves.
contract EthereumStorageLockReader is IChainVerifier {
    string public constant ENVIRONMENT_ID = "Ethereum";
    /// Solidity short-string storage word for environmentId = "Ethereum".
    bytes32 public constant ENVIRONMENT_WORD = 0x457468657265756d000000000000000000000000000000000000000000000010;
    bytes32 public constant NATIVE_ASSET_ID = keccak256(abi.encodePacked("Ethereum", "native-ETH"));
    /// CommitmentVaultLock storage: slot 0 environmentId, slot 1 _locks.
    uint256 internal constant LOCKS_SLOT = 1;
    /// bytes bindingPayload of 117 bytes is stored long-form: length*2+1.
    uint256 internal constant BINDING_LENGTH_WORD = 117 * 2 + 1;

    address public immutable lock;
    bytes32 public immutable lockCodeHash;
    bytes32 public immutable lockBuildHash;
    address public immutable devFund;

    /// Record words proven, as offsets from the record base slot.
    /// 0 exists|released|creator, 2 asset, 3 baseRecipient|outputToken,
    /// 4 gross, 5 fee, 6 principal, 7 duration, 9 createdAt, 10 maturity,
    /// 13 bindingPayload length.
    struct LockProof {
        bytes32 lockId;
        bytes[] accountProof;
        bytes[] environmentSlotProof;
        bytes[][10] recordWordProofs;
        bytes[] bindingFirstWordProof;
    }

    struct Record {
        bytes32 lockId;
        address asset;
        address baseRecipient;
        uint8 outputToken;
        uint256 gross;
        uint256 fee;
        uint256 principal;
        uint256 duration;
        uint256 createdAt;
        uint256 maturity;
        bytes32 executionBlockHash;
        uint256 executionBlockNumber;
    }

    /// @param lock_ Ethereum address of the CommitmentVaultLock.
    /// @param runtimeCode Its exact deployed runtime code.
    /// @param devFundOffsets Byte offsets of the 32-byte devFund immutable.
    /// @param expectedBuildHash keccak256 of runtimeCode with those words zeroed.
    constructor(address lock_, bytes memory runtimeCode, uint256[] memory devFundOffsets, bytes32 expectedBuildHash) {
        require(lock_ != address(0), "reader: lock");
        require(devFundOffsets.length > 0, "reader: offsets");
        lockCodeHash = keccak256(runtimeCode);
        bytes32 fundWord;
        for (uint256 i = 0; i < devFundOffsets.length; i++) {
            uint256 o = devFundOffsets[i];
            require(o + 32 <= runtimeCode.length, "reader: offset");
            bytes32 w;
            assembly {
                w := mload(add(add(runtimeCode, 32), o))
                mstore(add(add(runtimeCode, 32), o), 0)
            }
            if (i == 0) fundWord = w;
            require(w == fundWord, "reader: devFund immutables differ");
        }
        require(uint256(fundWord) >> 160 == 0 && fundWord != bytes32(0), "reader: devFund word");
        require(keccak256(runtimeCode) == expectedBuildHash, "reader: lock build not reviewed");
        lock = lock_;
        lockBuildHash = expectedBuildHash;
        devFund = address(uint160(uint256(fundWord)));
    }

    function verifyFinality(bytes calldata lockEventProof, bytes calldata sourceFinalityProof)
        external
        view
        override
        returns (bool, bytes32, uint256)
    {
        require(sourceFinalityProof.length == 0, "VF-XCH-006: anchor is carried in lockEventProof");
        Record memory r = _prove(lockEventProof);
        return (true, r.executionBlockHash, r.executionBlockNumber);
    }

    function extractFacts(bytes calldata lockEventProof)
        external
        view
        override
        returns (bytes32, uint256, uint256, uint256, uint256, uint256, uint256, address, uint8)
    {
        Record memory r = _prove(lockEventProof);
        return (r.lockId, r.gross, r.fee, r.principal, r.duration, r.createdAt, r.maturity, r.baseRecipient, r.outputToken);
    }

    function extractAssetId(bytes calldata lockEventProof) external view override returns (bytes32) {
        Record memory r = _prove(lockEventProof);
        if (r.asset == address(0)) return NATIVE_ASSET_ID;
        return keccak256(abi.encode(ENVIRONMENT_ID, r.asset));
    }

    /// @notice VF-FEE-009: the Dev Fund of the proven lock (its immutable,
    /// fixed by the pinned code hash). Reverts unless the lock is proven.
    function lockDevFund(string calldata environmentId, bytes calldata lockEventProof) external view returns (address) {
        require(keccak256(bytes(environmentId)) == keccak256(bytes(ENVIRONMENT_ID)), "VF-FEE-009: environment");
        _prove(lockEventProof);
        return devFund;
    }

    /// @notice Only the anchor: the finalized Ethereum execution block.
    function finalizedExecution(bytes calldata anchorProof)
        external
        view
        returns (BaseBeaconRootAnchor.Finalized memory)
    {
        return BaseBeaconRootAnchor.verify(abi.decode(anchorProof, (BaseBeaconRootAnchor.Proof)));
    }

    function _prove(bytes calldata lockEventProof) internal view returns (Record memory r) {
        (BaseBeaconRootAnchor.Proof memory a, LockProof memory p) =
            abi.decode(lockEventProof, (BaseBeaconRootAnchor.Proof, LockProof));
        BaseBeaconRootAnchor.Finalized memory fin = BaseBeaconRootAnchor.verify(a);

        EvmStorageProof.Account memory acct = EvmStorageProof.account(fin.stateRoot, lock, p.accountProof);
        require(acct.codeHash == lockCodeHash, "VF-XCH-011: account is not the pinned lock code");
        bytes32 sr = acct.storageRoot;
        require(
            bytes32(EvmStorageProof.word(sr, bytes32(0), p.environmentSlotProof)) == ENVIRONMENT_WORD,
            "VF-XCH-011: lock environment is not Ethereum"
        );

        uint256 base = uint256(keccak256(abi.encode(p.lockId, LOCKS_SLOT)));
        uint256 w0 = _w(sr, base, 0, p.recordWordProofs[0]);
        require(w0 & 0xff == 1, "VF-XCH-011: Ethereum lock record absent");
        r.lockId = p.lockId;
        r.asset = address(uint160(_w(sr, base, 2, p.recordWordProofs[1])));
        uint256 w3 = _w(sr, base, 3, p.recordWordProofs[2]);
        r.baseRecipient = address(uint160(w3));
        r.outputToken = uint8(w3 >> 160);
        r.gross = _w(sr, base, 4, p.recordWordProofs[3]);
        r.fee = _w(sr, base, 5, p.recordWordProofs[4]);
        r.principal = _w(sr, base, 6, p.recordWordProofs[5]);
        r.duration = _w(sr, base, 7, p.recordWordProofs[6]);
        r.createdAt = _w(sr, base, 9, p.recordWordProofs[7]);
        r.maturity = _w(sr, base, 10, p.recordWordProofs[8]);
        // Binding payload: 117 bytes whose first word is this lock id (as the Base reader).
        require(_w(sr, base, 13, p.recordWordProofs[9]) == BINDING_LENGTH_WORD, "VF-XCH-011: binding payload length");
        bytes32 dataSlot = keccak256(abi.encode(base + 13));
        require(
            bytes32(EvmStorageProof.word(sr, dataSlot, p.bindingFirstWordProof)) == p.lockId,
            "VF-XCH-011: binding payload lock id"
        );
        r.executionBlockHash = fin.blockHash;
        r.executionBlockNumber = fin.blockNumber;
    }

    function _w(bytes32 sr, uint256 base, uint256 off, bytes[] memory proof) private pure returns (uint256) {
        return EvmStorageProof.word(sr, bytes32(base + off), proof);
    }
}
