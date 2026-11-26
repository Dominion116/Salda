// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {IUSD8, SaldaClearing} from "../src/SaldaClearing.sol";
import {MockUSD8} from "../src/mocks/MockUSD8.sol";

/// @dev A minimal ERC-1271 smart wallet that accepts its owner's signature.
contract SmartWallet {
    address public immutable owner;

    constructor(address owner_) {
        owner = owner_;
    }

    function isValidSignature(bytes32 hash, bytes memory signature) external view returns (bytes4) {
        return ECDSA.recover(hash, signature) == owner ? bytes4(0x1626ba7e) : bytes4(0xffffffff);
    }
}

/// @dev Shared setup and signing helpers. Signatures are built the way a wallet builds them.
abstract contract SaldaBase is Test {
    bytes32 internal constant RECEIVE_TYPEHASH = keccak256(
        "ReceiveWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)"
    );

    MockUSD8 internal usd;
    SaldaClearing internal salda;
    address internal relayer = makeAddr("relayer");
    address internal admin;

    mapping(address account => uint256 key) internal keyOf;
    uint256 private _saltCounter;

    function setUp() public virtual {
        usd = new MockUSD8();
        salda = new SaldaClearing(IUSD8(address(usd)));
        admin = _person("admin");
    }

    // ------------------------------------------------------------- accounts

    function _person(string memory name) internal returns (address who) {
        uint256 key;
        (who, key) = makeAddrAndKey(name);
        keyOf[who] = key;
    }

    function _people(uint256 count) internal returns (address[] memory list) {
        list = new address[](count);
        for (uint256 i; i < count; ++i) {
            list[i] = _person(string.concat("member", vm.toString(i)));
        }
    }

    function _sign(address signer, bytes32 digest) internal view returns (bytes memory) {
        uint256 key = keyOf[signer];
        require(key != 0, "no key for signer");
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        return abi.encodePacked(r, s, v);
    }

    function _saldaDigest(bytes32 structHash) internal view returns (bytes32) {
        return keccak256(abi.encodePacked("\x19\x01", salda.DOMAIN_SEPARATOR(), structHash));
    }

    // -------------------------------------------------------------- circles

    function _names(address[] memory members) internal pure returns (bytes32[] memory names) {
        names = new bytes32[](members.length);
        for (uint256 i; i < members.length; ++i) {
            names[i] = keccak256(abi.encode(members[i], "Business name", bytes32(i + 1)));
        }
    }

    function _circle(address[] memory members) internal returns (uint256 id) {
        bytes32[] memory names = _names(members);
        vm.prank(admin);
        id = salda.createCircle(keccak256("Market Street"), members, names);
    }

    function _three() internal returns (address ada, address ben, address chidi, uint256 circleId) {
        ada = _person("ada");
        ben = _person("ben");
        chidi = _person("chidi");
        address[] memory members = new address[](3);
        (members[0], members[1], members[2]) = (ada, ben, chidi);
        circleId = _circle(members);
    }

    // ------------------------------------------------------------- invoices

    function _inv(uint256 circleId, address debtor, address creditor, uint256 amount)
        internal
        returns (SaldaClearing.InvoiceInput memory)
    {
        return SaldaClearing.InvoiceInput({
            circleId: circleId,
            debtor: debtor,
            creditor: creditor,
            amount: amount,
            dueDate: block.timestamp + 30 days,
            docHash: keccak256(abi.encode(keccak256("invoice.pdf"), bytes32(_saltCounter))),
            salt: bytes32(++_saltCounter),
            deadline: block.timestamp + 1 hours
        });
    }

    function _invHash(SaldaClearing.InvoiceInput memory inv) internal view returns (bytes32) {
        return keccak256(
            abi.encode(
                salda.REGISTER_INVOICE_TYPEHASH(),
                inv.circleId,
                inv.debtor,
                inv.creditor,
                inv.amount,
                inv.dueDate,
                inv.docHash,
                inv.salt,
                inv.deadline
            )
        );
    }

    function _register(SaldaClearing.InvoiceInput memory inv) internal returns (uint256) {
        bytes32 digest = _saldaDigest(_invHash(inv));
        vm.prank(relayer);
        return salda.registerInvoice(inv, _sign(inv.debtor, digest), _sign(inv.creditor, digest));
    }

    function _batchDigest(SaldaClearing.InvoiceInput[] memory invs, uint256 deadline) internal view returns (bytes32) {
        bytes32[] memory hashes = new bytes32[](invs.length);
        for (uint256 i; i < invs.length; ++i) {
            hashes[i] = _invHash(invs[i]);
        }
        return _saldaDigest(
            keccak256(abi.encode(salda.REGISTER_INVOICE_BATCH_TYPEHASH(), keccak256(abi.encodePacked(hashes)), deadline))
        );
    }

    function _batchSigs(bytes32 digest, address[] memory signers)
        internal
        view
        returns (SaldaClearing.SignerSig[] memory sigs)
    {
        sigs = new SaldaClearing.SignerSig[](signers.length);
        for (uint256 j; j < signers.length; ++j) {
            sigs[j] = SaldaClearing.SignerSig({signer: signers[j], signature: _sign(signers[j], digest)});
        }
    }

    // --------------------------------------------------------------- rounds

    function _round(uint256 circleId, uint256[] memory ids, uint256[] memory amounts)
        internal
        view
        returns (SaldaClearing.RoundInput memory)
    {
        return SaldaClearing.RoundInput({
            circleId: circleId, roundNonce: 1, deadline: block.timestamp + 1 hours, invoiceIds: ids, clearAmounts: amounts
        });
    }

    /// @dev Each touched member's totals, in the order the contract first meets them.
    function _totals(SaldaClearing.RoundInput memory round)
        internal
        view
        returns (address[] memory members, uint256[] memory outs, uint256[] memory ins)
    {
        uint256 n = round.invoiceIds.length;
        members = new address[](2 * n);
        outs = new uint256[](2 * n);
        ins = new uint256[](2 * n);
        uint256 count;
        for (uint256 i; i < n; ++i) {
            SaldaClearing.Invoice memory inv = salda.getInvoice(round.invoiceIds[i]);
            uint256 d = _find(members, count, inv.debtor);
            if (d == count) members[count++] = inv.debtor;
            outs[d] += round.clearAmounts[i];
            uint256 c = _find(members, count, inv.creditor);
            if (c == count) members[count++] = inv.creditor;
            ins[c] += round.clearAmounts[i];
        }
        assembly {
            mstore(members, count)
            mstore(outs, count)
            mstore(ins, count)
        }
    }

    function _find(address[] memory list, uint256 count, address who) private pure returns (uint256) {
        for (uint256 k; k < count; ++k) {
            if (list[k] == who) return k;
        }
        return count;
    }

    /// @dev Every consent the round needs, signed correctly.
    function _consents(SaldaClearing.RoundInput memory round)
        internal
        view
        returns (SaldaClearing.ConsentInput[] memory consents)
    {
        bytes32 roundHash = salda.hashRound(round);
        (address[] memory members, uint256[] memory outs, uint256[] memory ins) = _totals(round);
        consents = new SaldaClearing.ConsentInput[](members.length);
        for (uint256 k; k < members.length; ++k) {
            consents[k] = outs[k] > ins[k]
                ? _debitConsent(members[k], outs[k] - ins[k], roundHash, round.deadline)
                : _approveConsent(members[k], roundHash, outs[k], ins[k]);
        }
    }

    function _debitConsent(address member, uint256 value, bytes32 roundHash, uint256 validBefore)
        internal
        view
        returns (SaldaClearing.ConsentInput memory)
    {
        bytes32 nonce = keccak256(abi.encode(address(salda), roundHash, member));
        bytes32 structHash =
            keccak256(abi.encode(RECEIVE_TYPEHASH, member, address(salda), value, 0, validBefore, nonce));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", usd.DOMAIN_SEPARATOR(), structHash));
        return SaldaClearing.ConsentInput({
            member: member, validAfter: 0, validBefore: validBefore, signature: _sign(member, digest)
        });
    }

    function _approveConsent(address member, bytes32 roundHash, uint256 outTotal, uint256 inTotal)
        internal
        view
        returns (SaldaClearing.ConsentInput memory)
    {
        bytes32 digest = _saldaDigest(
            keccak256(abi.encode(salda.APPROVE_ROUND_TYPEHASH(), roundHash, member, outTotal, inTotal))
        );
        return SaldaClearing.ConsentInput({member: member, validAfter: 0, validBefore: 0, signature: _sign(member, digest)});
    }

    function _settle(SaldaClearing.RoundInput memory round) internal returns (bytes32) {
        SaldaClearing.ConsentInput[] memory consents = _consents(round);
        vm.prank(relayer);
        return salda.settle(round, consents);
    }

    function _ids(uint256 a, uint256 b, uint256 c) internal pure returns (uint256[] memory list) {
        list = new uint256[](3);
        (list[0], list[1], list[2]) = (a, b, c);
    }
}
