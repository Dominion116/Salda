// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IAgentRegistry, IUSD8, SaldaClearing} from "../src/SaldaClearing.sol";
import {MockUSD8} from "../src/mocks/MockUSD8.sol";
import {SaldaBase} from "./SaldaBase.sol";

/// @dev A registry whose owners the test sets, and which can be switched to fail.
contract FakeRegistry is IAgentRegistry {
    mapping(uint256 agentId => address) public owners;
    bool public broken;

    function set(uint256 agentId, address owner) external {
        owners[agentId] = owner;
    }

    function breakIt() external {
        broken = true;
    }

    function ownerOf(uint256 agentId) external view returns (address) {
        require(!broken && owners[agentId] != address(0), "registry unavailable");
        return owners[agentId];
    }
}

/// @notice The mandate invariants from PRD 7.1.
contract MandatesTest is SaldaBase {
    uint256 internal constant ONE = 1e6;
    address internal agent;
    address internal ada;
    address internal ben;
    address internal chidi;
    uint256 internal circleId;
    uint256[] internal ids; // Ada -> Ben 6, Ben -> Chidi 5, Chidi -> Ada 4

    function setUp() public override {
        super.setUp();
        agent = _person("agent");
        (ada, ben, chidi, circleId) = _three();
        ids.push(_register(_inv(circleId, ada, ben, 6 * ONE)));
        ids.push(_register(_inv(circleId, ben, chidi, 5 * ONE)));
        ids.push(_register(_inv(circleId, chidi, ada, 4 * ONE)));
        usd.mint(ada, 10 * ONE);
    }

    // ============================================================ helpers

    function _terms(address member) internal view returns (SaldaClearing.StandingMandate memory) {
        return SaldaClearing.StandingMandate({
            circleId: circleId,
            member: member,
            agent: agent,
            agentId: 0,
            maxNetDebitPerRound: 2 * ONE,
            totalCap: 5 * ONE,
            maxDueDays: 30,
            minClearRatioBps: 30_000,
            minCooldown: 0,
            expiry: uint64(block.timestamp + 90 days),
            mandateNonce: salda.memberMandateEpoch(member)
        });
    }

    function _permit(address owner, uint256 value) internal view returns (SaldaClearing.PermitInput memory p) {
        p.deadline = block.timestamp + 1 hours;
        bytes32 structHash = keccak256(
            abi.encode(usd.PERMIT_TYPEHASH(), owner, address(salda), value, usd.nonces(owner), p.deadline)
        );
        (p.v, p.r, p.s) =
            vm.sign(keyOf[owner], keccak256(abi.encodePacked("\x19\x01", usd.DOMAIN_SEPARATOR(), structHash)));
    }

    function _mandateSig(SaldaClearing.StandingMandate memory m) internal view returns (bytes memory) {
        return _sign(m.member, _saldaDigest(salda.hashMandate(m)));
    }

    function _activate(SaldaClearing.StandingMandate memory m) internal returns (bytes32) {
        bytes memory sig = _mandateSig(m);
        SaldaClearing.PermitInput memory p = _permit(m.member, m.totalCap);
        vm.prank(relayer);
        return salda.activateMandate(m, sig, p);
    }

    function _approvals(bytes32 roundHash, address signer) internal view returns (SaldaClearing.AgentApproval[] memory a) {
        a = new SaldaClearing.AgentApproval[](1);
        bytes32 digest = _saldaDigest(keccak256(abi.encode(salda.AGENT_APPROVAL_TYPEHASH(), roundHash, agent)));
        a[0] = SaldaClearing.AgentApproval({agent: agent, signature: _sign(signer, digest)});
    }

    /// @dev Every consent signed, except `viaMandate`, whose mandate agrees for them.
    function _consentsWithMandate(SaldaClearing.RoundInput memory round, address viaMandate)
        internal
        view
        returns (SaldaClearing.ConsentInput[] memory consents)
    {
        consents = _consents(round);
        for (uint256 k; k < consents.length; ++k) {
            if (consents[k].member == viaMandate) {
                consents[k] = SaldaClearing.ConsentInput({
                    member: viaMandate, kind: salda.CONSENT_MANDATE(), validAfter: 0, validBefore: 0, signature: ""
                });
            }
        }
    }

    function _headlineRound(uint256 nonce) internal view returns (SaldaClearing.RoundInput memory round) {
        round = _round(circleId, ids, _ids(6 * ONE, 5 * ONE, 4 * ONE));
        round.roundNonce = nonce;
    }

    /// @dev Settles `round` with Ada's mandate and the agent's approval, submitted by a stranger.
    function _settleByMandate(SaldaClearing.RoundInput memory round) internal returns (bytes32) {
        SaldaClearing.ConsentInput[] memory consents = _consentsWithMandate(round, ada);
        SaldaClearing.AgentApproval[] memory approvals = _approvals(salda.hashRound(round), agent);
        vm.prank(makeAddr("anyone"));
        return salda.settle(round, consents, approvals);
    }

    function _expectSettleRevert(SaldaClearing.RoundInput memory round, bytes memory reason) internal {
        SaldaClearing.ConsentInput[] memory consents = _consentsWithMandate(round, ada);
        SaldaClearing.AgentApproval[] memory approvals = _approvals(salda.hashRound(round), agent);
        vm.expectRevert(reason);
        salda.settle(round, consents, approvals);
    }

    // ========================================================== using one

    function test_mandate_settlesTheHeadlineRoundForAda() public {
        bytes32 mandateHash = _activate(_terms(ada));
        assertEq(usd.allowance(ada, address(salda)), 5 * ONE);

        _settleByMandate(_headlineRound(1));

        assertEq(usd.balanceOf(ada), 8 * ONE);
        assertEq(usd.balanceOf(ben), 1 * ONE);
        assertEq(usd.balanceOf(chidi), 1 * ONE);
        assertEq(usd.balanceOf(address(salda)), 0);
        (, SaldaClearing.MandateState memory state) = salda.getMandate(mandateHash);
        assertEq(state.spent, 2 * ONE);
        assertEq(usd.allowance(ada, address(salda)), 3 * ONE);
    }

    function test_mandate_netZeroMemberNeedsNoPermit() public {
        SaldaClearing.StandingMandate memory m = _terms(ben);
        m.maxNetDebitPerRound = 0;
        m.totalCap = 0;
        bytes memory sig = _mandateSig(m);
        SaldaClearing.PermitInput memory none;
        salda.activateMandate(m, sig, none);

        SaldaClearing.RoundInput memory round = _round(circleId, ids, _ids(4 * ONE, 4 * ONE, 4 * ONE));
        SaldaClearing.ConsentInput[] memory consents = _consentsWithMandate(round, ben);
        SaldaClearing.AgentApproval[] memory approvals = _approvals(salda.hashRound(round), agent);
        salda.settle(round, consents, approvals);
        assertEq(salda.getInvoice(ids[1]).cleared, 4 * ONE);
    }

    // ================================================= one live mandate only

    function test_activate_secondMandateRevertsUntilRevoked() public {
        bytes32 first = _activate(_terms(ada));

        // A second mandate, even for another circle, while the first is live.
        address[] memory members = new address[](2);
        (members[0], members[1]) = (ada, ben);
        uint256 otherCircle = _circle(members);
        SaldaClearing.StandingMandate memory other = _terms(ada);
        other.circleId = otherCircle;
        bytes memory sig = _mandateSig(other);
        SaldaClearing.PermitInput memory p = _permit(ada, other.totalCap);
        vm.expectRevert(SaldaClearing.MandateAlreadyActive.selector);
        salda.activateMandate(other, sig, p);

        vm.prank(ada);
        salda.revokeMandate(first);
        // The revoke advanced the epoch, so the old signature is stale. A fresh one works.
        other.mandateNonce = salda.memberMandateEpoch(ada);
        _activate(other);
        assertTrue(salda.hasLiveMandate(ada));
    }

    function test_revoke_staleAndRevokedMandatesCannotBeActivated() public {
        SaldaClearing.StandingMandate memory used = _terms(ada);
        SaldaClearing.StandingMandate memory spare = _terms(ada);
        spare.totalCap = 4 * ONE; // signed at the same epoch, never activated
        bytes memory spareSig = _mandateSig(spare);
        bytes32 usedHash = _activate(used);

        vm.prank(ada);
        salda.revokeMandate(usedHash);

        SaldaClearing.PermitInput memory p = _permit(ada, spare.totalCap);
        vm.expectRevert(SaldaClearing.StaleMandate.selector);
        salda.activateMandate(spare, spareSig, p);

        // The revoked mandate itself cannot come back either: its nonce is from the old epoch.
        bytes memory usedSig = _mandateSig(used);
        p = _permit(ada, used.totalCap);
        vm.expectRevert(SaldaClearing.StaleMandate.selector);
        salda.activateMandate(used, usedSig, p);
    }

    function test_activate_rejectsWrongSignerExpiryAndNonMembers() public {
        SaldaClearing.StandingMandate memory m = _terms(ada);
        SaldaClearing.PermitInput memory p = _permit(ada, m.totalCap);
        bytes memory wrong = _sign(ben, _saldaDigest(salda.hashMandate(m)));
        vm.expectRevert(abi.encodeWithSelector(SaldaClearing.InvalidSignature.selector, ada));
        salda.activateMandate(m, wrong, p);

        SaldaClearing.StandingMandate memory stranger = _terms(_person("stranger"));
        bytes memory strangerSig = _mandateSig(stranger);
        vm.expectRevert(abi.encodeWithSelector(SaldaClearing.NotActiveMember.selector, stranger.member));
        salda.activateMandate(stranger, strangerSig, p);

        m.expiry = uint64(block.timestamp);
        bytes memory expiredSig = _mandateSig(m);
        vm.expectRevert(abi.encodeWithSelector(SaldaClearing.MandateExpired.selector, ada));
        salda.activateMandate(m, expiredSig, p);
    }

    /// Someone copies the permit from the mempool and submits it first. Activation must still succeed.
    function test_activate_survivesAFrontRunPermit() public {
        SaldaClearing.StandingMandate memory m = _terms(ada);
        bytes memory sig = _mandateSig(m);
        SaldaClearing.PermitInput memory p = _permit(ada, m.totalCap);
        usd.permit(ada, address(salda), m.totalCap, p.deadline, p.v, p.r, p.s);

        salda.activateMandate(m, sig, p);
        assertTrue(salda.hasLiveMandate(ada));
    }

    function test_activate_needsTheAllowance() public {
        SaldaClearing.StandingMandate memory m = _terms(ada);
        bytes memory sig = _mandateSig(m);
        SaldaClearing.PermitInput memory tooSmall = _permit(ada, m.totalCap - 1);
        vm.expectRevert(SaldaClearing.InsufficientAllowance.selector);
        salda.activateMandate(m, sig, tooSmall);
    }

    // ===================================================== agent approval

    function test_agentApproval_missingInvalidOrForAnotherRoundReverts() public {
        _activate(_terms(ada));
        SaldaClearing.RoundInput memory round = _headlineRound(1);
        SaldaClearing.ConsentInput[] memory consents = _consentsWithMandate(round, ada);
        bytes32 roundHash = salda.hashRound(round);

        vm.expectRevert(abi.encodeWithSelector(SaldaClearing.MissingAgentApproval.selector, agent));
        salda.settle(round, consents, noApprovals);

        SaldaClearing.AgentApproval[] memory forged = _approvals(roundHash, ben);
        vm.expectRevert(abi.encodeWithSelector(SaldaClearing.InvalidSignature.selector, agent));
        salda.settle(round, consents, forged);

        SaldaClearing.AgentApproval[] memory otherRound = _approvals(salda.hashRound(_headlineRound(2)), agent);
        vm.expectRevert(abi.encodeWithSelector(SaldaClearing.InvalidSignature.selector, agent));
        salda.settle(round, consents, otherRound);

        _settleByMandate(round); // valid, and submitted by an unrelated address
    }

    // ====================================================== the limits

    function test_limits_perRoundCapBoundary() public {
        SaldaClearing.StandingMandate memory m = _terms(ada);
        m.maxNetDebitPerRound = 2 * ONE - 1;
        _activate(m);
        _expectSettleRevert(_headlineRound(1), abi.encodeWithSelector(SaldaClearing.ExceedsRoundCap.selector, ada));
    }

    function test_limits_perRoundCapExactlyPasses() public {
        _activate(_terms(ada)); // cap 2.00, the round needs exactly 2.00
        _settleByMandate(_headlineRound(1));
    }

    function test_limits_totalCapAcrossRounds() public {
        SaldaClearing.StandingMandate memory m = _terms(ada);
        m.totalCap = 3 * ONE;
        m.minClearRatioBps = 0;
        _activate(m);
        _settleByMandate(_headlineRound(1)); // spends 2.00 of 3.00

        // Ada owes Ben 1.00 + 1 unit more: one unit past the total cap.
        uint256 extra = _register(_inv(circleId, ada, ben, ONE + 1));
        uint256[] memory one = new uint256[](1);
        uint256[] memory amount = new uint256[](1);
        (one[0], amount[0]) = (extra, ONE + 1);
        _expectSettleRevert(_round(circleId, one, amount), abi.encodeWithSelector(SaldaClearing.ExceedsTotalCap.selector, ada));

        amount[0] = ONE; // exactly the 1.00 left
        _settleByMandate(_round(circleId, one, amount));
    }

    function test_limits_dueDateBoundary() public {
        SaldaClearing.StandingMandate memory m = _terms(ada);
        m.minClearRatioBps = 0;
        _activate(m);

        SaldaClearing.InvoiceInput memory onTheDay = _inv(circleId, ada, ben, ONE);
        onTheDay.dueDate = block.timestamp + 30 days;
        SaldaClearing.InvoiceInput memory dayAfter = _inv(circleId, ada, ben, ONE);
        dayAfter.dueDate = block.timestamp + 30 days + 1;
        uint256 okId = _register(onTheDay);
        uint256 lateId = _register(dayAfter);

        uint256[] memory one = new uint256[](1);
        uint256[] memory amount = new uint256[](1);
        (one[0], amount[0]) = (lateId, ONE);
        _expectSettleRevert(_round(circleId, one, amount), abi.encodeWithSelector(SaldaClearing.InvoiceDueTooFar.selector, lateId));

        one[0] = okId;
        _settleByMandate(_round(circleId, one, amount));
    }

    function test_limits_ratioBoundary() public {
        SaldaClearing.StandingMandate memory m = _terms(ada); // at least 3.0x
        m.maxNetDebitPerRound = 3 * ONE; // room in the cap, so only the ratio can refuse
        _activate(m);

        // Ada clears 6.00 and is paid 4.00 less one unit: she pays 2.000001, a 2.9999985x ratio.
        SaldaClearing.RoundInput memory below = _round(circleId, ids, _ids(6 * ONE, 5 * ONE, 4 * ONE - 1));
        _expectSettleRevert(below, abi.encodeWithSelector(SaldaClearing.ClearRatioTooLow.selector, ada));

        _settleByMandate(_headlineRound(2)); // exactly 3.0x passes
    }

    function test_limits_cooldown() public {
        SaldaClearing.StandingMandate memory m = _terms(ada);
        m.minCooldown = 1 hours;
        m.minClearRatioBps = 0;
        _activate(m);
        _settleByMandate(_round(circleId, ids, _ids(ONE, ONE, ONE)));

        SaldaClearing.RoundInput memory soon = _round(circleId, ids, _ids(ONE, ONE, ONE));
        soon.roundNonce = 2;
        _expectSettleRevert(soon, abi.encodeWithSelector(SaldaClearing.CooldownActive.selector, ada));

        vm.warp(block.timestamp + 1 hours);
        soon.deadline = block.timestamp + 1 hours;
        _settleByMandate(soon);
    }

    // =================================================== ending a mandate

    function test_end_expiryWrongCircleRevokeAndBump() public {
        bytes32 mandateHash = _activate(_terms(ada));

        vm.warp(block.timestamp + 91 days);
        SaldaClearing.RoundInput memory round = _headlineRound(1);
        _expectSettleRevert(round, abi.encodeWithSelector(SaldaClearing.MandateExpired.selector, ada));
        vm.warp(block.timestamp - 91 days);

        address[] memory members = new address[](2);
        (members[0], members[1]) = (ada, ben);
        uint256 otherCircle = _circle(members);
        uint256 otherInvoice = _register(_inv(otherCircle, ben, ada, ONE));
        uint256[] memory one = new uint256[](1);
        uint256[] memory amount = new uint256[](1);
        (one[0], amount[0]) = (otherInvoice, ONE);
        _expectSettleRevert(_round(otherCircle, one, amount), abi.encodeWithSelector(SaldaClearing.MandateWrongCircle.selector, ada));

        vm.prank(ada);
        salda.revokeMandate(mandateHash);
        _expectSettleRevert(round, abi.encodeWithSelector(SaldaClearing.MandateRevoked.selector, ada));
    }

    function test_end_bumpEpochEndsTheActiveMandate() public {
        _activate(_terms(ada));
        vm.prank(ada);
        salda.bumpMandateEpoch();
        assertFalse(salda.hasLiveMandate(ada));
        _expectSettleRevert(_headlineRound(1), abi.encodeWithSelector(SaldaClearing.MandateRevoked.selector, ada));
    }

    /// A member with no gas revokes through the relayer, and the next round using the mandate reverts.
    function test_end_gaslessRevokeThroughTheRelayer() public {
        bytes32 mandateHash = _activate(_terms(ada));
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig =
            _sign(ada, _saldaDigest(keccak256(abi.encode(salda.REVOKE_MANDATE_TYPEHASH(), mandateHash, deadline))));

        vm.expectRevert(abi.encodeWithSelector(SaldaClearing.InvalidSignature.selector, ada));
        salda.revokeMandateWithSig(mandateHash, deadline, _sign(ben, keccak256("wrong")));

        vm.prank(relayer);
        salda.revokeMandateWithSig(mandateHash, deadline, sig);
        _expectSettleRevert(_headlineRound(1), abi.encodeWithSelector(SaldaClearing.MandateRevoked.selector, ada));

        vm.expectRevert(abi.encodeWithSelector(SaldaClearing.MandateRevoked.selector, ada));
        salda.revokeMandateWithSig(mandateHash, deadline, sig);
    }

    function test_end_gaslessEpochBump_cannotBeReplayed() public {
        _activate(_terms(ada));
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _sign(
            ada, _saldaDigest(keccak256(abi.encode(salda.BUMP_MANDATE_EPOCH_TYPEHASH(), ada, uint64(0), deadline)))
        );
        salda.bumpMandateEpochWithSig(ada, deadline, sig);
        assertEq(salda.memberMandateEpoch(ada), 1);
        vm.expectRevert(abi.encodeWithSelector(SaldaClearing.InvalidSignature.selector, ada));
        salda.bumpMandateEpochWithSig(ada, deadline, sig);
    }

    function test_revoke_onlyTheMember() public {
        bytes32 mandateHash = _activate(_terms(ada));
        vm.prank(ben);
        vm.expectRevert(SaldaClearing.NotMandateOwner.selector);
        salda.revokeMandate(mandateHash);
    }

    // =================================================== direct payment

    function test_payDirect_leavesTheMandateAllowanceAlone() public {
        _activate(_terms(ada));
        uint256 validBefore = block.timestamp + 1 hours;
        bytes32 nonce = keccak256(abi.encode(address(salda), "DIRECT", ids[0], ONE, uint256(1)));
        bytes32 structHash = keccak256(abi.encode(RECEIVE_TYPEHASH, ada, address(salda), ONE, 0, validBefore, nonce));
        bytes memory sig = _sign(ada, keccak256(abi.encodePacked("\x19\x01", usd.DOMAIN_SEPARATOR(), structHash)));

        salda.payDirectWithAuthorization(ids[0], ONE, 1, 0, validBefore, sig);
        assertEq(usd.allowance(ada, address(salda)), 5 * ONE);
        assertEq(usd.balanceOf(ben), ONE);
    }

    // ===================================================== agent identity

    function test_identity_registryChecksActivationButNeverSettlement() public {
        FakeRegistry registry = new FakeRegistry();
        salda = new SaldaClearing(IUSD8(address(usd)), registry);
        (ada, ben, chidi, circleId) = _three();
        delete ids;
        ids.push(_register(_inv(circleId, ada, ben, 6 * ONE)));
        ids.push(_register(_inv(circleId, ben, chidi, 5 * ONE)));
        ids.push(_register(_inv(circleId, chidi, ada, 4 * ONE)));

        SaldaClearing.StandingMandate memory m = _terms(ada);
        m.agentId = 7;
        registry.set(7, ben); // ID 7 belongs to someone else
        bytes memory sig = _mandateSig(m);
        SaldaClearing.PermitInput memory p = _permit(ada, m.totalCap);
        vm.expectRevert(SaldaClearing.AgentNotRegistered.selector);
        salda.activateMandate(m, sig, p);

        registry.set(7, agent);
        salda.activateMandate(m, sig, p);

        registry.breakIt(); // a registry outage must not block settlement
        _settleByMandate(_headlineRound(1));
        assertEq(usd.balanceOf(ben), 1 * ONE);
    }
}
