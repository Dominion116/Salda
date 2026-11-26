// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {console2} from "forge-std/console2.sol";
import {IAgentRegistry, SaldaClearing} from "../src/SaldaClearing.sol";
import {MockUSD8} from "../src/mocks/MockUSD8.sol";
import {SaldaBase, SmartWallet} from "./SaldaBase.sol";

contract SaldaClearingTest is SaldaBase {
    uint256 internal constant ONE = 1e6; // 1 tUSD8

    // =============================================================== rounds

    /// The headline case: three shops owe each other 15.00 and 2.00 settles all of it.
    function test_settle_headline_15ClearedWith2() public {
        (address ada, address ben, address chidi, uint256 circleId) = _three();
        uint256 a = _register(_inv(circleId, ada, ben, 6 * ONE));
        uint256 b = _register(_inv(circleId, ben, chidi, 5 * ONE));
        uint256 c = _register(_inv(circleId, chidi, ada, 4 * ONE));
        usd.mint(ada, 2 * ONE);

        SaldaClearing.RoundInput memory round = _round(circleId, _ids(a, b, c), _ids(6 * ONE, 5 * ONE, 4 * ONE));
        SaldaClearing.ConsentInput[] memory consents = _consents(round);
        bytes32 roundHash = salda.hashRound(round);
        vm.expectEmit(true, true, false, true, address(salda));
        emit SaldaClearing.RoundSettled(roundHash, circleId, relayer, 15 * ONE, 2 * ONE);
        vm.prank(relayer);
        salda.settle(round, consents, noApprovals);

        assertEq(usd.balanceOf(ada), 0);
        assertEq(usd.balanceOf(ben), 1 * ONE);
        assertEq(usd.balanceOf(chidi), 1 * ONE);
        assertEq(usd.balanceOf(address(salda)), 0);
        assertEq(salda.getInvoice(a).cleared, 6 * ONE);
        assertEq(salda.getInvoice(b).cleared, 5 * ONE);
        assertEq(salda.getInvoice(c).cleared, 4 * ONE);
    }

    /// With no cash at all, 12.00 still cancels out, and every net-zero member must still consent.
    function test_settle_pureCycle_movesNoCash() public {
        (address ada, address ben, address chidi, uint256 circleId) = _three();
        uint256 a = _register(_inv(circleId, ada, ben, 6 * ONE));
        uint256 b = _register(_inv(circleId, ben, chidi, 5 * ONE));
        uint256 c = _register(_inv(circleId, chidi, ada, 4 * ONE));

        _settle(_round(circleId, _ids(a, b, c), _ids(4 * ONE, 4 * ONE, 4 * ONE)));

        assertEq(salda.getInvoice(a).cleared, 4 * ONE);
        assertEq(usd.balanceOf(ada) + usd.balanceOf(ben) + usd.balanceOf(chidi), 0);
    }

    function test_settle_partialClearings_areAccumulated() public {
        (address ada, address ben, address chidi, uint256 circleId) = _three();
        uint256 a = _register(_inv(circleId, ada, ben, 6 * ONE));
        uint256 b = _register(_inv(circleId, ben, chidi, 5 * ONE));
        uint256 c = _register(_inv(circleId, chidi, ada, 4 * ONE));

        _settle(_round(circleId, _ids(a, b, c), _ids(4 * ONE, 4 * ONE, 4 * ONE)));
        usd.mint(ada, 2 * ONE);
        // What is left: Ada owes Ben 2.00 and Ben owes Chidi 1.00. Chidi's invoice is fully cleared.
        uint256[] memory ids = new uint256[](2);
        uint256[] memory amounts = new uint256[](2);
        (ids[0], ids[1], amounts[0], amounts[1]) = (a, b, 2 * ONE, 1 * ONE);
        SaldaClearing.RoundInput memory second = _round(circleId, ids, amounts);
        second.roundNonce = 2;
        _settle(second);

        assertEq(salda.getInvoice(a).cleared, 6 * ONE);
        assertEq(salda.getInvoice(b).cleared, 5 * ONE);
        assertEq(usd.balanceOf(ada), 0); // paid 2 to Ben
        assertEq(usd.balanceOf(ben), 1 * ONE); // got 2, passed 1 on to Chidi
        assertEq(usd.balanceOf(chidi), 1 * ONE);
    }

    function test_settle_revertsOnReplay() public {
        (, SaldaClearing.RoundInput memory round) = _cycleRound();
        SaldaClearing.ConsentInput[] memory consents = _consents(round);
        salda.settle(round, consents, noApprovals);
        vm.expectRevert(SaldaClearing.RoundAlreadySettled.selector);
        salda.settle(round, consents, noApprovals);
    }

    function test_settle_consentsDoNotCarryToAnotherRound() public {
        (, SaldaClearing.RoundInput memory round) = _cycleRound();
        SaldaClearing.ConsentInput[] memory consents = _consents(round);
        round.roundNonce = 99;
        vm.expectRevert(abi.encodeWithSelector(SaldaClearing.InvalidSignature.selector, consents[0].member));
        salda.settle(round, consents, noApprovals);
    }

    function test_settle_revertsWhenExpired() public {
        (, SaldaClearing.RoundInput memory round) = _cycleRound();
        SaldaClearing.ConsentInput[] memory consents = _consents(round);
        vm.warp(round.deadline + 1);
        vm.expectRevert(SaldaClearing.Expired.selector);
        salda.settle(round, consents, noApprovals);
    }

    function test_settle_revertsWhenAnyConsentIsMissing() public {
        (, SaldaClearing.RoundInput memory round) = _cycleRound();
        SaldaClearing.ConsentInput[] memory consents = _consents(round);

        // One fewer consent than touched members.
        SaldaClearing.ConsentInput[] memory short = new SaldaClearing.ConsentInput[](2);
        (short[0], short[1]) = (consents[0], consents[1]);
        vm.expectRevert(SaldaClearing.ConsentCountMismatch.selector);
        salda.settle(round, short, noApprovals);

        // The right count, but one net-zero member's consent is replaced by a duplicate of another's.
        SaldaClearing.ConsentInput[] memory dup = new SaldaClearing.ConsentInput[](3);
        (dup[0], dup[1], dup[2]) = (consents[0], consents[1], consents[1]);
        vm.expectRevert(abi.encodeWithSelector(SaldaClearing.MissingConsent.selector, consents[2].member));
        salda.settle(round, dup, noApprovals);
    }

    function test_settle_revertsOnWrongSigner() public {
        (, SaldaClearing.RoundInput memory round) = _cycleRound();
        SaldaClearing.ConsentInput[] memory consents = _consents(round);
        consents[1].signature = consents[2].signature; // Ben's slot, Chidi's signature
        vm.expectRevert(abi.encodeWithSelector(SaldaClearing.InvalidSignature.selector, consents[1].member));
        salda.settle(round, consents, noApprovals);
    }

    function test_settle_debtorAuthorizationMustMatchTheNetDebit() public {
        (address ada, address ben, address chidi, uint256 circleId) = _three();
        uint256 a = _register(_inv(circleId, ada, ben, 6 * ONE));
        uint256 b = _register(_inv(circleId, ben, chidi, 5 * ONE));
        uint256 c = _register(_inv(circleId, chidi, ada, 4 * ONE));
        usd.mint(ada, 2 * ONE);
        SaldaClearing.RoundInput memory round = _round(circleId, _ids(a, b, c), _ids(6 * ONE, 5 * ONE, 4 * ONE));
        SaldaClearing.ConsentInput[] memory consents = _consents(round);
        // Ada signed for 1.00, but the plan needs 2.00 from her.
        consents[0] = _debitConsent(ada, 1 * ONE, salda.hashRound(round), round.deadline);
        vm.expectRevert(MockUSD8.InvalidSignature.selector);
        salda.settle(round, consents, noApprovals);
    }

    function test_settle_rejectsBadLines() public {
        (address ada, address ben, address chidi, uint256 circleId) = _three();
        uint256 a = _register(_inv(circleId, ada, ben, 6 * ONE));
        uint256 b = _register(_inv(circleId, ben, chidi, 5 * ONE));
        uint256 c = _register(_inv(circleId, chidi, ada, 4 * ONE));
        SaldaClearing.ConsentInput[] memory none = new SaldaClearing.ConsentInput[](0);

        vm.expectRevert(SaldaClearing.InvoiceIdsNotAscending.selector);
        salda.settle(_round(circleId, _ids(a, a, c), _ids(1, 1, 1)), none, noApprovals);

        vm.expectRevert(SaldaClearing.InvoiceIdsNotAscending.selector);
        salda.settle(_round(circleId, _ids(b, a, c), _ids(1, 1, 1)), none, noApprovals);

        vm.expectRevert(SaldaClearing.ZeroClearAmount.selector);
        salda.settle(_round(circleId, _ids(a, b, c), _ids(1, 0, 1)), none, noApprovals);

        vm.expectRevert(abi.encodeWithSelector(SaldaClearing.OverClear.selector, c));
        salda.settle(_round(circleId, _ids(a, b, c), _ids(1, 1, 4 * ONE + 1)), none, noApprovals);

        vm.expectRevert(abi.encodeWithSelector(SaldaClearing.InvoiceNotFound.selector, c + 1));
        salda.settle(_round(circleId, _ids(a, b, c + 1), _ids(1, 1, 1)), none, noApprovals);

        vm.expectRevert(abi.encodeWithSelector(SaldaClearing.WrongCircle.selector, a));
        salda.settle(_round(circleId + 1, _ids(a, b, c), _ids(1, 1, 1)), none, noApprovals);

        vm.expectRevert(SaldaClearing.LengthMismatch.selector);
        salda.settle(_round(circleId, _ids(a, b, c), new uint256[](2)), none, noApprovals);

        vm.expectRevert(SaldaClearing.BadRoundSize.selector);
        salda.settle(_round(circleId, new uint256[](0), new uint256[](0)), none, noApprovals);
    }

    function test_settle_blacklistedMemberStopsTheWholeRound() public {
        (address ada, address ben, address chidi, uint256 circleId) = _three();
        uint256 a = _register(_inv(circleId, ada, ben, 6 * ONE));
        uint256 b = _register(_inv(circleId, ben, chidi, 5 * ONE));
        uint256 c = _register(_inv(circleId, chidi, ada, 4 * ONE));
        usd.mint(ada, 2 * ONE);
        SaldaClearing.RoundInput memory round = _round(circleId, _ids(a, b, c), _ids(6 * ONE, 5 * ONE, 4 * ONE));
        SaldaClearing.ConsentInput[] memory consents = _consents(round);
        usd.setBlacklisted(chidi, true);

        vm.expectRevert(abi.encodeWithSelector(MockUSD8.Blacklisted.selector, chidi));
        salda.settle(round, consents, noApprovals);
        assertEq(salda.getInvoice(a).cleared, 0, "nothing clears");
        assertEq(usd.balanceOf(ada), 2 * ONE, "nothing moves");
    }

    function test_settle_smartWalletMembersCanConsent() public {
        (address ada, address ben,, uint256 circleId) = _three();
        address owner = _person("wallet owner");
        SmartWallet wallet = new SmartWallet(owner);
        keyOf[address(wallet)] = keyOf[owner];
        vm.prank(admin);
        salda.setCircleMember(circleId, address(wallet), true, keccak256("wallet"));

        uint256 a = _register(_inv(circleId, address(wallet), ada, 3 * ONE));
        uint256 b = _register(_inv(circleId, ada, ben, 2 * ONE));
        usd.mint(address(wallet), 1 * ONE);
        uint256[] memory ids = new uint256[](2);
        uint256[] memory amounts = new uint256[](2);
        (ids[0], ids[1], amounts[0], amounts[1]) = (a, b, 1 * ONE, 1 * ONE);
        _settle(_round(circleId, ids, amounts));

        assertEq(usd.balanceOf(ben), 1 * ONE);
        assertEq(usd.balanceOf(address(wallet)), 0);
    }

    /// The riskiest check, locally: 10 members and 30 invoices in one round.
    function test_settle_maximumSizeRound() public {
        (uint256 circleId, uint256[] memory ids, uint256[] memory amounts) = _maxCircle();
        SaldaClearing.RoundInput memory round = _round(circleId, ids, amounts);
        (address[] memory touched, uint256[] memory outs, uint256[] memory ins) = _totals(round);
        assertEq(touched.length, 10);
        for (uint256 k; k < touched.length; ++k) {
            if (outs[k] > ins[k]) usd.mint(touched[k], outs[k] - ins[k]);
        }
        SaldaClearing.ConsentInput[] memory consents = _consents(round);

        vm.prank(relayer);
        uint256 before = gasleft();
        salda.settle(round, consents, noApprovals);
        console2.log("settle gas, 10 members / 30 invoices:", before - gasleft());

        assertEq(usd.balanceOf(address(salda)), 0);
        for (uint256 k; k < touched.length; ++k) {
            assertEq(usd.balanceOf(touched[k]), ins[k] > outs[k] ? ins[k] - outs[k] : 0);
        }
    }

    function test_settle_revertsOverTenMembers() public {
        address[] memory members = _people(11);
        uint256 circleId = _circle(members);
        uint256[] memory ids = new uint256[](6);
        uint256[] memory amounts = new uint256[](6);
        for (uint256 i; i < 6; ++i) {
            ids[i] = _register(_inv(circleId, members[2 * i % 11], members[(2 * i + 1) % 11], ONE));
            amounts[i] = ONE;
        }
        vm.expectRevert(SaldaClearing.TooManyMembers.selector);
        salda.settle(_round(circleId, ids, amounts), new SaldaClearing.ConsentInput[](0), noApprovals);
    }

    function test_settle_revertsOverThirtyInvoices() public {
        vm.expectRevert(SaldaClearing.BadRoundSize.selector);
        salda.settle(_round(1, new uint256[](31), new uint256[](31)), new SaldaClearing.ConsentInput[](0), noApprovals);
    }

    /// Any plan on a small circle: cash is conserved, nobody's balance moves by more than their net position,
    /// and the contract ends with nothing.
    function testFuzz_settle_conservesCash(uint64[6] memory owed, uint64[6] memory clear) public {
        address[] memory members = _people(4);
        uint256 circleId = _circle(members);
        // Six invoices covering every pair of the four members, alternating direction.
        uint256[6] memory from = [uint256(0), 1, 2, 3, 0, 1];
        uint256[6] memory to = [uint256(1), 2, 3, 0, 2, 3];
        uint256[] memory ids = new uint256[](6);
        uint256[] memory amounts = new uint256[](6);
        for (uint256 i; i < 6; ++i) {
            uint256 amount = bound(owed[i], 1, 1_000_000 * ONE);
            ids[i] = _register(_inv(circleId, members[from[i]], members[to[i]], amount));
            amounts[i] = bound(clear[i], 1, amount);
        }
        SaldaClearing.RoundInput memory round = _round(circleId, ids, amounts);
        (address[] memory touched, uint256[] memory outs, uint256[] memory ins) = _totals(round);
        for (uint256 k; k < touched.length; ++k) {
            if (outs[k] > ins[k]) usd.mint(touched[k], outs[k] - ins[k]);
        }
        _settle(round);

        assertEq(usd.balanceOf(address(salda)), 0);
        for (uint256 k; k < touched.length; ++k) {
            assertEq(usd.balanceOf(touched[k]), ins[k] > outs[k] ? ins[k] - outs[k] : 0);
        }
        for (uint256 i; i < 6; ++i) {
            SaldaClearing.Invoice memory inv = salda.getInvoice(ids[i]);
            assertLe(inv.cleared, inv.amount);
            assertEq(inv.cleared, amounts[i]);
        }
    }

    // ============================================================ invoices

    function test_registerInvoice_storesIt() public {
        (address ada, address ben,, uint256 circleId) = _three();
        SaldaClearing.InvoiceInput memory inv = _inv(circleId, ada, ben, 6 * ONE);
        uint256 id = _register(inv);
        SaldaClearing.Invoice memory stored = salda.getInvoice(id);
        assertEq(stored.debtor, ada);
        assertEq(stored.creditor, ben);
        assertEq(stored.amount, 6 * ONE);
        assertEq(stored.cleared, 0);
        assertEq(stored.docHash, inv.docHash);
        assertFalse(stored.voided);
        (uint256[] memory page, uint256 total) = salda.getCircleInvoiceIds(circleId, 0, 10);
        assertEq(total, 1);
        assertEq(page[0], id);
    }

    function test_registerInvoice_rejectsWrongSignerExpiryAndReplay() public {
        (address ada, address ben, address chidi, uint256 circleId) = _three();
        SaldaClearing.InvoiceInput memory inv = _inv(circleId, ada, ben, 6 * ONE);
        bytes32 digest = _saldaDigest(_invHash(inv));

        vm.expectRevert(abi.encodeWithSelector(SaldaClearing.InvalidSignature.selector, ben));
        salda.registerInvoice(inv, _sign(ada, digest), _sign(chidi, digest));

        salda.registerInvoice(inv, _sign(ada, digest), _sign(ben, digest));
        vm.expectRevert(SaldaClearing.InvoiceAlreadyRegistered.selector);
        salda.registerInvoice(inv, _sign(ada, digest), _sign(ben, digest));

        SaldaClearing.InvoiceInput memory late = _inv(circleId, ada, ben, 6 * ONE);
        bytes32 lateDigest = _saldaDigest(_invHash(late));
        vm.warp(late.deadline + 1);
        vm.expectRevert(SaldaClearing.Expired.selector);
        salda.registerInvoice(late, _sign(ada, lateDigest), _sign(ben, lateDigest));
    }

    function test_registerInvoice_rejectsNonMembersAndBadValues() public {
        (address ada, address ben,, uint256 circleId) = _three();
        address stranger = _person("stranger");

        _expectRegisterRevert(
            _inv(circleId, ada, stranger, ONE),
            abi.encodeWithSelector(SaldaClearing.NotActiveMember.selector, stranger)
        );
        _expectRegisterRevert(_inv(circleId, ada, ben, 0), abi.encodeWithSelector(SaldaClearing.InvalidInvoice.selector));
        _expectRegisterRevert(_inv(circleId, ada, ada, ONE), abi.encodeWithSelector(SaldaClearing.InvalidInvoice.selector));

        _deactivate(circleId, ben);
        _expectRegisterRevert(
            _inv(circleId, ada, ben, ONE), abi.encodeWithSelector(SaldaClearing.NotActiveMember.selector, ben)
        );
    }

    function _expectRegisterRevert(SaldaClearing.InvoiceInput memory inv, bytes memory reason) private {
        bytes32 digest = _saldaDigest(_invHash(inv));
        bytes memory debtorSig = _sign(inv.debtor, digest);
        bytes memory creditorSig = _sign(inv.creditor, digest);
        vm.expectRevert(reason);
        salda.registerInvoice(inv, debtorSig, creditorSig);
    }

    function _deactivate(uint256 circleId, address member) private {
        bytes32 nameHash = salda.getMember(circleId, member).nameHash;
        vm.prank(admin);
        salda.setCircleMember(circleId, member, false, nameHash);
    }

    function test_deactivatedMember_canStillSettleExistingDebt() public {
        (address ada, address ben, address chidi, uint256 circleId) = _three();
        uint256 a = _register(_inv(circleId, ada, ben, 6 * ONE));
        uint256 b = _register(_inv(circleId, ben, chidi, 5 * ONE));
        uint256 c = _register(_inv(circleId, chidi, ada, 4 * ONE));
        _deactivate(circleId, ben);
        assertFalse(salda.getMember(circleId, ben).active);

        _settle(_round(circleId, _ids(a, b, c), _ids(4 * ONE, 4 * ONE, 4 * ONE)));
        assertEq(salda.getInvoice(b).cleared, 4 * ONE);
    }

    function test_registerInvoices_batchWithOneSignatureEach() public {
        (address ada, address ben, address chidi, uint256 circleId) = _three();
        SaldaClearing.InvoiceInput[] memory invs = new SaldaClearing.InvoiceInput[](3);
        invs[0] = _inv(circleId, ada, ben, 6 * ONE);
        invs[1] = _inv(circleId, ben, chidi, 5 * ONE);
        invs[2] = _inv(circleId, chidi, ada, 4 * ONE);
        uint256 deadline = block.timestamp + 1 hours;
        bytes32 digest = _batchDigest(invs, deadline);
        address[] memory signers = new address[](3);
        (signers[0], signers[1], signers[2]) = (ada, ben, chidi);

        vm.prank(relayer);
        uint256 first = salda.registerInvoices(invs, deadline, _batchSigs(digest, signers));
        assertEq(first, 1);
        assertEq(salda.invoiceCount(), 3);
        assertEq(salda.getInvoice(3).creditor, ada);
    }

    function test_registerInvoices_needsEveryParty() public {
        (address ada, address ben, address chidi, uint256 circleId) = _three();
        SaldaClearing.InvoiceInput[] memory invs = new SaldaClearing.InvoiceInput[](2);
        invs[0] = _inv(circleId, ada, ben, 6 * ONE);
        invs[1] = _inv(circleId, ben, chidi, 5 * ONE);
        uint256 deadline = block.timestamp + 1 hours;
        address[] memory signers = new address[](2);
        (signers[0], signers[1]) = (ada, ben);
        SaldaClearing.SignerSig[] memory sigs = _batchSigs(_batchDigest(invs, deadline), signers);

        vm.expectRevert(abi.encodeWithSelector(SaldaClearing.MissingSignature.selector, chidi));
        salda.registerInvoices(invs, deadline, sigs);
    }

    // ======================================================== void and pay

    function test_voidInvoice_needsBothParties_thenBlocksClearing() public {
        (address ada, address ben, address chidi, uint256 circleId) = _three();
        uint256 a = _register(_inv(circleId, ada, ben, 6 * ONE));
        uint256 deadline = block.timestamp + 1 hours;
        bytes32 digest =
            _saldaDigest(keccak256(abi.encode(salda.VOID_INVOICE_TYPEHASH(), a, 6 * ONE, deadline)));

        vm.expectRevert(abi.encodeWithSelector(SaldaClearing.InvalidSignature.selector, ben));
        salda.voidInvoice(a, deadline, _sign(ada, digest), _sign(chidi, digest));

        // The debtor submits directly, so only the creditor's signature is needed.
        vm.prank(ada);
        salda.voidInvoice(a, deadline, "", _sign(ben, digest));
        assertTrue(salda.getInvoice(a).voided);

        vm.expectRevert(abi.encodeWithSelector(SaldaClearing.InvoiceVoidedAlready.selector, a));
        salda.voidInvoice(a, deadline, _sign(ada, digest), _sign(ben, digest));

        uint256[] memory ids = new uint256[](1);
        uint256[] memory amounts = new uint256[](1);
        (ids[0], amounts[0]) = (a, ONE);
        vm.expectRevert(abi.encodeWithSelector(SaldaClearing.InvoiceVoidedAlready.selector, a));
        salda.settle(_round(circleId, ids, amounts), new SaldaClearing.ConsentInput[](0), noApprovals);
    }

    function test_payDirect_paysTheCreditor_andCannotOverpay() public {
        (address ada, address ben,, uint256 circleId) = _three();
        uint256 a = _register(_inv(circleId, ada, ben, 6 * ONE));
        usd.mint(ada, 10 * ONE);

        (uint256 before, bytes memory sig) = _directAuth(ada, a, 4 * ONE, 1);
        vm.prank(relayer);
        salda.payDirectWithAuthorization(a, 4 * ONE, 1, 0, before, sig);
        assertEq(usd.balanceOf(ben), 4 * ONE);
        assertEq(salda.getInvoice(a).cleared, 4 * ONE);
        assertEq(usd.balanceOf(address(salda)), 0);

        (before, sig) = _directAuth(ada, a, 3 * ONE, 2);
        vm.expectRevert(abi.encodeWithSelector(SaldaClearing.OverClear.selector, a));
        salda.payDirectWithAuthorization(a, 3 * ONE, 2, 0, before, sig);

        // An authorization is bound to its invoice and amount.
        (before, sig) = _directAuth(ada, a, 2 * ONE, 3);
        vm.expectRevert(MockUSD8.InvalidSignature.selector);
        salda.payDirectWithAuthorization(a, 1 * ONE, 3, 0, before, sig);
    }

    function _directAuth(address debtor, uint256 invoiceId, uint256 amount, uint256 directNonce)
        private
        view
        returns (uint256 validBefore, bytes memory sig)
    {
        validBefore = block.timestamp + 1 hours;
        bytes32 nonce = keccak256(abi.encode(address(salda), "DIRECT", invoiceId, amount, directNonce));
        bytes32 structHash =
            keccak256(abi.encode(RECEIVE_TYPEHASH, debtor, address(salda), amount, 0, validBefore, nonce));
        sig = _sign(debtor, keccak256(abi.encodePacked("\x19\x01", usd.DOMAIN_SEPARATOR(), structHash)));
    }

    // ============================================================= circles

    function test_createCircle_listsMembersByPage() public {
        address[] memory members = _people(5);
        uint256 circleId = _circle(members);
        assertEq(salda.getCircle(circleId).admin, admin);
        assertEq(salda.getCircle(circleId).memberCount, 5);

        (address[] memory page, SaldaClearing.Member[] memory info, uint256 total) =
            salda.getCircleMembers(circleId, 3, 10);
        assertEq(total, 5);
        assertEq(page.length, 2);
        assertEq(page[0], members[3]);
        assertTrue(info[1].active);

        (page,, total) = salda.getCircleMembers(circleId, 9, type(uint256).max);
        assertEq(page.length, 0);
    }

    function test_createCircleWithSig_rejectsWrongSignerAndReplay() public {
        address[] memory members = _people(3);
        SaldaClearing.NewCircle memory circle =
            SaldaClearing.NewCircle({nameHash: keccak256("Market"), members: members, memberNameHashes: _names(members)});
        uint256 deadline = block.timestamp + 1 hours;
        bytes32 digest = _createCircleDigest(circle, 0, deadline);

        vm.expectRevert(abi.encodeWithSelector(SaldaClearing.InvalidSignature.selector, admin));
        salda.createCircleWithSig(admin, circle, deadline, _sign(members[0], digest));

        vm.prank(relayer);
        uint256 circleId = salda.createCircleWithSig(admin, circle, deadline, _sign(admin, digest));
        assertEq(salda.getCircle(circleId).admin, admin);
        assertEq(salda.nonces(admin), 1);

        vm.expectRevert(abi.encodeWithSelector(SaldaClearing.InvalidSignature.selector, admin));
        salda.createCircleWithSig(admin, circle, deadline, _sign(admin, digest));
    }

    function test_setCircleMemberWithSig_onlyAdmin_andRenameIsRecorded() public {
        (, address ben,, uint256 circleId) = _three();
        uint256 deadline = block.timestamp + 1 hours;
        bytes32 newName = keccak256("Ben's Farm Ltd");
        bytes32 digest = _saldaDigest(
            keccak256(abi.encode(salda.SET_CIRCLE_MEMBER_TYPEHASH(), circleId, ben, true, newName, 0, deadline))
        );

        vm.expectRevert(abi.encodeWithSelector(SaldaClearing.InvalidSignature.selector, admin));
        salda.setCircleMemberWithSig(circleId, ben, true, newName, deadline, _sign(ben, digest));

        vm.warp(block.timestamp + 10);
        vm.expectEmit(true, true, false, true, address(salda));
        emit SaldaClearing.MemberNameChanged(circleId, ben, newName);
        salda.setCircleMemberWithSig(circleId, ben, true, newName, deadline, _sign(admin, digest));
        assertEq(salda.getMember(circleId, ben).nameHash, newName);
        assertEq(salda.getMember(circleId, ben).nameUpdatedAt, block.timestamp);

        vm.expectRevert(SaldaClearing.NotCircleAdmin.selector);
        vm.prank(ben);
        salda.setCircleMember(circleId, ben, false, newName);
    }

    // ================================================== chain and contract

    function test_signaturesDoNotCarryToAnotherChainOrDeployment() public {
        (, SaldaClearing.RoundInput memory round) = _cycleRound();
        SaldaClearing.ConsentInput[] memory consents = _consents(round);

        SaldaClearing other = new SaldaClearing(salda.token(), IAgentRegistry(address(0)));
        vm.expectRevert(abi.encodeWithSelector(SaldaClearing.InvoiceNotFound.selector, round.invoiceIds[0]));
        other.settle(round, consents, noApprovals);

        vm.chainId(1);
        vm.expectRevert(abi.encodeWithSelector(SaldaClearing.InvalidSignature.selector, consents[0].member));
        salda.settle(round, consents, noApprovals);
    }

    function test_invoiceSignatureDoesNotCarryToAnotherDeployment() public {
        (address ada, address ben,, uint256 circleId) = _three();
        SaldaClearing.InvoiceInput memory inv = _inv(circleId, ada, ben, ONE);
        bytes32 digest = _saldaDigest(_invHash(inv));
        SaldaClearing other = new SaldaClearing(salda.token(), IAgentRegistry(address(0)));
        vm.expectRevert(abi.encodeWithSelector(SaldaClearing.InvalidSignature.selector, ada));
        other.registerInvoice(inv, _sign(ada, digest), _sign(ben, digest));
    }

    // ============================================================== helpers

    function _cycleRound() private returns (uint256 circleId, SaldaClearing.RoundInput memory round) {
        address ada;
        address ben;
        address chidi;
        (ada, ben, chidi, circleId) = _three();
        uint256 a = _register(_inv(circleId, ada, ben, 6 * ONE));
        uint256 b = _register(_inv(circleId, ben, chidi, 5 * ONE));
        uint256 c = _register(_inv(circleId, chidi, ada, 4 * ONE));
        round = _round(circleId, _ids(a, b, c), _ids(4 * ONE, 4 * ONE, 4 * ONE));
    }

    /// @dev 10 members and 30 invoices, registered in one batch signed by all ten.
    function _maxCircle() private returns (uint256 circleId, uint256[] memory ids, uint256[] memory amounts) {
        address[] memory members = _people(10);
        circleId = _circle(members);
        SaldaClearing.InvoiceInput[] memory invs = new SaldaClearing.InvoiceInput[](30);
        ids = new uint256[](30);
        amounts = new uint256[](30);
        for (uint256 i; i < 30; ++i) {
            invs[i] = _inv(circleId, members[i % 10], members[(3 * i + 1) % 10], ONE / 100 + i * 1000);
            amounts[i] = invs[i].amount;
        }
        uint256 deadline = block.timestamp + 1 hours;
        SaldaClearing.SignerSig[] memory sigs = _batchSigs(_batchDigest(invs, deadline), members);
        vm.prank(relayer);
        uint256 before = gasleft();
        uint256 first = salda.registerInvoices(invs, deadline, sigs);
        console2.log("registerInvoices gas, 30 invoices / 10 signers:", before - gasleft());
        for (uint256 i; i < 30; ++i) {
            ids[i] = first + i;
        }
    }

    function _createCircleDigest(SaldaClearing.NewCircle memory circle, uint256 nonce, uint256 deadline)
        private
        view
        returns (bytes32)
    {
        return _saldaDigest(
            keccak256(
                abi.encode(
                    salda.CREATE_CIRCLE_TYPEHASH(),
                    circle.nameHash,
                    keccak256(abi.encodePacked(circle.members)),
                    keccak256(abi.encodePacked(circle.memberNameHashes)),
                    nonce,
                    deadline
                )
            )
        );
    }
}
