// SPDX-License-Identifier: MIT
// Rig 3: reader fuzz. Random bytes, and random bytes packed inside each
// reader's own ABI proof struct (so abi.decode passes and the real parsers
// run), go into every reader entry point: verifyFinality, extractFacts and
// extractAssetId, plus the EVM parsing helpers proveReceipt, receiptLog and
// arbitrumHeaderExtras.
// Properties: no call succeeds on fuzzed input, and no call reverts with a
// Panic (selector 0x4e487b71: assert, overflow, divide by zero, out of
// bounds, memory). A plain revert with a reason is the expected outcome.
//
// LIMIT: this cannot find a valid-shaped-but-false input (a well-formed
// forged header, a self-made block). See test_SHAPE_* below and FZ-05: those
// belong to the adversarial / assumption-gap tier.
pragma solidity 0.8.19;

import {Test} from "forge-std/Test.sol";
import {BaseLockRecordVerifier} from "vf/chain-verifiers/BaseLockRecordVerifier.sol";
import {SimpleEthereumLockReader} from "vf/chain-verifiers/SimpleEthereumLockReader.sol";
import {EthereumLockReader} from "vf/chain-verifiers/EthereumLockReader.sol";
import {ArbitrumLockReader} from "vf/chain-verifiers/ArbitrumLockReader.sol";
import {OptimismLockReader} from "vf/chain-verifiers/OptimismLockReader.sol";
import {PolygonLockReader} from "vf/chain-verifiers/PolygonLockReader.sol";
import {BnbSmartChainLockReader} from "vf/chain-verifiers/BnbSmartChainLockReader.sol";
import {AvalancheLockReader} from "vf/chain-verifiers/AvalancheLockReader.sol";
import {BitcoinLockReader} from "vf/chain-verifiers/BitcoinLockReader.sol";
import {BitcoinCashLockReader} from "vf/chain-verifiers/BitcoinCashLockReader.sol";
import {LitecoinLockReader} from "vf/chain-verifiers/LitecoinLockReader.sol";
import {DogecoinLockReader} from "vf/chain-verifiers/DogecoinLockReader.sol";
import {DigiByteLockReader} from "vf/chain-verifiers/DigiByteLockReader.sol";
import {ZcashLockReader} from "vf/chain-verifiers/ZcashLockReader.sol";
import {XrplLockReader} from "vf/chain-verifiers/XrplLockReader.sol";
import {StellarLockReader} from "vf/chain-verifiers/StellarLockReader.sol";
import {SolanaLockReader} from "vf/chain-verifiers/SolanaLockReader.sol";

/// Stand-in lock contract: every lockRecord lookup reverts (no such lock).
contract NoLocks {}

contract FuzzReaders is Test {
    address[] internal readers;
    uint8[] internal kind; // 0 base, 1 evm, 2 avalanche, 3 utxo, 4 xrpl, 5 stellar, 6 solana, 7 eth light client
    string[] internal names;

    struct EvmProof {
        bytes headerRlp;
        bytes receipt;
        uint256 receiptIndex;
        bytes[] receiptNodes;
        uint256 logIndex;
        bytes[] accountNodes;
        bytes[] envSlotNodes;
        bytes[] recipientSlotNodes;
    }

    struct AvaxProof {
        EvmProof base;
        bytes[] createdAtSlotNodes;
    }

    struct UtxoProof {
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

    struct XrplProof {
        bytes header;
        bytes paymentTx;
        bytes paymentMeta;
        bytes[] paymentInner;
        bytes escrowTx;
        bytes escrowMeta;
        bytes[] escrowInner;
        bytes payload;
        uint256 durationSecs;
    }

    struct StellarProof {
        bytes header;
        bytes resultSet;
        bytes txXdr;
        bytes payload;
        uint256 durationSecs;
    }

    BitcoinLockReader internal btc;

    function _add(address r, uint8 k, string memory n) internal {
        readers.push(r);
        kind.push(k);
        names.push(n);
    }

    function setUp() public {
        address l = address(new NoLocks());
        bytes memory script = abi.encodePacked(hex"0014", bytes20(uint160(0xDF)));
        _add(address(new BaseLockRecordVerifier(l)), 0, "Base");
        _add(address(new SimpleEthereumLockReader(l)), 1, "Ethereum(simple)");
        _add(address(new EthereumLockReader(l, address(0xC1))), 7, "Ethereum(light client)");
        _add(address(new ArbitrumLockReader(l)), 1, "Arbitrum");
        _add(address(new OptimismLockReader(l)), 1, "Optimism");
        _add(address(new PolygonLockReader(l)), 1, "Polygon");
        _add(address(new BnbSmartChainLockReader(l)), 1, "BNB Smart Chain");
        _add(address(new AvalancheLockReader(l)), 2, "Avalanche");
        btc = new BitcoinLockReader(script);
        _add(address(btc), 3, "Bitcoin");
        _add(address(new BitcoinCashLockReader(script)), 3, "Bitcoin Cash");
        _add(address(new LitecoinLockReader(script)), 3, "Litecoin");
        _add(address(new DogecoinLockReader(script)), 3, "Dogecoin");
        _add(address(new DigiByteLockReader(script)), 3, "DigiByte");
        _add(address(new ZcashLockReader(script)), 3, "Zcash");
        _add(address(new XrplLockReader(bytes20(uint160(0xDF)))), 4, "XRP Ledger");
        _add(address(new StellarLockReader(keccak256("net"), keccak256("df"))), 5, "Stellar");
        _add(address(new SolanaLockReader()), 6, "Solana");
    }

    function _noPanic(uint256 i, bytes memory ret, string memory what) internal {
        if (ret.length >= 36 && bytes4(ret) == bytes4(0x4e487b71)) {
            uint256 code;
            assembly {
                code := mload(add(ret, 36))
            }
            emit log_named_string("PANIC", string.concat(names[i], " ", what));
            emit log_named_uint("panic code", code);
            fail();
        }
    }

    function _check(uint256 i, bytes memory data, string memory what) internal {
        (bool ok, bytes memory ret) = readers[i].call{gas: 30_000_000}(data);
        if (ok) {
            emit log_named_string("UNEXPECTED SUCCESS", string.concat(names[i], " ", what));
            fail();
        }
        _noPanic(i, ret, what);
    }

    function _all(uint256 i, bytes memory lep, bytes memory sfp) internal {
        _check(i, abi.encodeWithSignature("verifyFinality(bytes,bytes)", lep, sfp), "verifyFinality");
        _check(i, abi.encodeWithSignature("extractFacts(bytes)", lep), "extractFacts");
        _check(i, abi.encodeWithSignature("extractAssetId(bytes)", lep), "extractAssetId");
    }

    function _arr(bytes memory a, bytes memory b) internal pure returns (bytes[] memory r) {
        r = new bytes[](2);
        r[0] = a;
        r[1] = b;
    }

    /// Raw random bytes into all 17 readers x 3 entry points.
    function testFuzz_randomBytesAllReaders(bytes memory lep, bytes memory sfp) public {
        for (uint256 i = 0; i < readers.length; i++) _all(i, lep, sfp);
    }

    /// Random content inside each reader's own proof struct.
    function testFuzz_shapedStructAllReaders(bytes memory a, bytes memory b, bytes memory c, bytes32 h, uint256 n, uint256 m)
        public
    {
        for (uint256 i = 0; i < readers.length; i++) {
            uint8 k = kind[i];
            bytes memory lep;
            bytes memory sfp;
            if (k == 1 || k == 7) {
                lep = abi.encode(EvmProof(a, b, n % 64, _arr(c, a), m % 8, _arr(b, c), _arr(c, b), _arr(a, c)));
                sfp = abi.encode(uint256(n % 100_000), keccak256(a), m);
            } else if (k == 2) {
                EvmProof memory e = EvmProof(a, b, n % 64, _arr(c, a), m % 8, _arr(b, c), _arr(c, b), _arr(a, c));
                lep = abi.encode(AvaxProof(e, _arr(b, a)));
                sfp = abi.encode(uint256(43114), keccak256(a), m);
            } else if (k == 3) {
                bytes32[] memory br = new bytes32[](n % 4);
                for (uint256 j = 0; j < br.length; j++) br[j] = keccak256(abi.encode(h, j));
                lep = abi.encode(UtxoProof(a, b, br, c, br, m % 16, b, c, n));
                sfp = abi.encode(h, m);
            } else if (k == 4) {
                lep = abi.encode(XrplProof(a, b, c, _arr(a, b), c, a, _arr(b, c), b, n));
                sfp = abi.encode(h, m);
            } else if (k == 5) {
                lep = abi.encode(StellarProof(a, b, c, a, n));
                sfp = abi.encode(h, m);
            } else {
                lep = abi.encode(h, n, m, n, m, n, m);
                sfp = abi.encode(h);
            }
            _all(i, lep, sfp);
        }
    }

    /// 80-byte random header plus random transactions into the UTXO readers,
    /// with the claimed hash set to the header's own double SHA-256.
    function testFuzz_utxoHeaderSized(bytes32 a, bytes32 b, bytes16 c, bytes memory tx_, uint256 n) public {
        bytes memory hdr = abi.encodePacked(a, b, c);
        bytes32[] memory br = new bytes32[](1);
        br[0] = a;
        bytes memory lep = abi.encode(UtxoProof(hdr, tx_, br, tx_, br, 1 + (n % 8), tx_, tx_, 604800));
        for (uint256 i = 0; i < readers.length; i++) {
            if (kind[i] == 3) _all(i, lep, abi.encode(sha256(abi.encodePacked(sha256(hdr))), n));
        }
    }

    function testFuzz_evmParsingHelpers(bytes memory hdr, bytes memory receipt, uint256 idx, bytes memory node) public {
        for (uint256 i = 0; i < readers.length; i++) {
            if (kind[i] != 1 && kind[i] != 2) continue;
            _check(
                i,
                abi.encodeWithSignature("proveReceipt(bytes,bytes,uint256,bytes[])", hdr, receipt, idx % 256, _arr(node, hdr)),
                "proveReceipt"
            );
            _check(i, abi.encodeWithSignature("receiptLog(bytes,uint256)", receipt, idx % 16), "receiptLog");
        }
        _check(3, abi.encodeWithSignature("arbitrumHeaderExtras(bytes)", hdr), "arbitrumHeaderExtras");
    }

    /// SHAPE (not a fuzz finding, adversarial tier): a self-made Bitcoin
    /// "block" passes verifyFinality. The reader checks only header length,
    /// the coinbase Merkle path and the BIP34 height. It checks no proof of
    /// work and no trusted checkpoint, and the Verifier ignores the returned
    /// hash (it reads only the bool).
    function test_SHAPE_selfMadeBitcoinBlockPassesFinality() public {
        // coinbase: version 1, one input (null prevout), script = push3 height
        // + one pad byte (avoids the 64-byte rule), one zero-value output.
        bytes memory cb = abi.encodePacked(
            hex"01000000", hex"01", bytes32(0), hex"ffffffff", hex"05", hex"03a0bb0d", hex"00",
            hex"ffffffff", hex"01", hex"0000000000000000", hex"00", hex"00000000"
        );
        bytes32 txid = sha256(abi.encodePacked(sha256(cb)));
        bytes memory hdr = abi.encodePacked(hex"00000020", bytes32(0), txid, hex"00000000", hex"ffff7f20", hex"00000000");
        assertEq(hdr.length, 80);
        bytes32 hh = sha256(abi.encodePacked(sha256(hdr)));
        bytes memory lep = abi.encode(UtxoProof(hdr, cb, new bytes32[](0), cb, new bytes32[](0), 0, "", "", 0));
        (bool fin, bytes32 rh, uint256 height) = btc.verifyFinality(lep, abi.encode(hh, uint256(900_000)));
        assertTrue(fin);
        assertEq(rh, hh);
        assertEq(height, 900_000);
    }
}
