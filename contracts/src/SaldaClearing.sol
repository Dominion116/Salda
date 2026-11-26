// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice The parts of tUSD8 (a FiatToken v2.2 proxy) that Salda uses. `receiveWithAuthorization` is the
///         EIP-3009 variant that takes a packed signature, so smart contract wallets (ERC-1271) work too.
interface IUSD8 is IERC20 {
    function receiveWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        bytes memory signature
    ) external;

    function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s)
        external;
}

/// @notice The one call Salda makes to an ERC-8004 identity registry: who owns an agent ID.
interface IAgentRegistry {
    function ownerOf(uint256 agentId) external view returns (address);
}

/// @title SaldaClearing
/// @notice Multilateral clearing for a circle of businesses. Members co-sign invoices; a round cancels
///         what they owe each other and moves only each member's net difference in tUSD8, all or nothing.
/// @dev Nobody is trusted: every round is rechecked here, authority comes only from signatures, and the contract
///      never holds tUSD8 after a call. Business names exist only as salted hashes. Members consent to a round
///      either by signing it (Tier 1) or through a standing mandate that an agent uses within fixed limits (Tier 2).
contract SaldaClearing is EIP712, ReentrancyGuard {
    using SafeERC20 for IUSD8;

    // ---------------------------------------------------------------- limits

    uint256 public constant MAX_MEMBERS_PER_ROUND = 10;
    uint256 public constant MAX_INVOICES_PER_ROUND = 30;
    uint256 public constant MAX_INVOICES_PER_BATCH = 30;

    // ------------------------------------------------------------ EIP-712 types

    bytes32 public constant CREATE_CIRCLE_TYPEHASH = keccak256(
        "CreateCircle(bytes32 circleNameHash,address[] members,bytes32[] nameHashes,uint256 nonce,uint256 deadline)"
    );
    bytes32 public constant SET_CIRCLE_MEMBER_TYPEHASH = keccak256(
        "SetCircleMember(uint256 circleId,address member,bool active,bytes32 nameHash,uint256 nonce,uint256 deadline)"
    );
    bytes32 public constant REGISTER_INVOICE_TYPEHASH = keccak256(
        "RegisterInvoice(uint256 circleId,address debtor,address creditor,uint256 amount,uint256 dueDate,bytes32 docHash,bytes32 salt,uint256 deadline)"
    );
    bytes32 public constant REGISTER_INVOICE_BATCH_TYPEHASH = keccak256(
        "RegisterInvoiceBatch(RegisterInvoice[] invoices,uint256 deadline)RegisterInvoice(uint256 circleId,address debtor,address creditor,uint256 amount,uint256 dueDate,bytes32 docHash,bytes32 salt,uint256 deadline)"
    );
    bytes32 public constant VOID_INVOICE_TYPEHASH =
        keccak256("VoidInvoice(uint256 invoiceId,uint256 remainingAmount,uint256 deadline)");
    bytes32 public constant APPROVE_ROUND_TYPEHASH =
        keccak256("ApproveRound(bytes32 roundHash,address member,uint256 outTotal,uint256 inTotal)");
    bytes32 public constant STANDING_MANDATE_TYPEHASH = keccak256(
        "StandingMandate(uint256 circleId,address member,address agent,uint256 agentId,uint256 maxNetDebitPerRound,uint256 totalCap,uint32 maxDueDays,uint32 minClearRatioBps,uint32 minCooldown,uint64 expiry,uint64 mandateNonce)"
    );
    bytes32 public constant AGENT_APPROVAL_TYPEHASH = keccak256("AgentApproval(bytes32 roundHash,address agent)");
    bytes32 public constant REVOKE_MANDATE_TYPEHASH = keccak256("RevokeMandate(bytes32 mandateHash,uint256 deadline)");
    bytes32 public constant BUMP_MANDATE_EPOCH_TYPEHASH =
        keccak256("BumpMandateEpoch(address member,uint64 epoch,uint256 deadline)");

    /// @notice `ConsentInput.kind`: the member signed this round themselves.
    uint8 public constant CONSENT_SIGNED = 0;
    /// @notice `ConsentInput.kind`: the member's active standing mandate agrees for them.
    uint8 public constant CONSENT_MANDATE = 1;

    // ------------------------------------------------------------------- types

    /// @dev Input to `createCircleWithSig`. Signed as `CreateCircle` with `members` and `nameHashes`.
    struct NewCircle {
        bytes32 nameHash;
        address[] members;
        bytes32[] memberNameHashes;
    }

    struct Circle {
        address admin;
        uint64 createdAt;
        uint32 memberCount;
        bytes32 nameHash;
    }

    struct Member {
        bool active;
        bool listed;
        uint64 nameUpdatedAt;
        bytes32 nameHash;
    }

    struct Invoice {
        uint256 circleId;
        address debtor;
        uint64 dueDate;
        address creditor;
        uint64 registeredAt;
        bool voided;
        uint256 amount;
        uint256 cleared;
        bytes32 docHash;
    }

    /// @dev `docHash = keccak256(abi.encode(documentHash, docSalt))`; `salt` makes each signed invoice unique.
    struct InvoiceInput {
        uint256 circleId;
        address debtor;
        address creditor;
        uint256 amount;
        uint256 dueDate;
        bytes32 docHash;
        bytes32 salt;
        uint256 deadline;
    }

    struct SignerSig {
        address signer;
        bytes signature;
    }

    /// @dev `invoiceIds` strictly ascending; `clearAmounts[i]` is cleared from `invoiceIds[i]`.
    struct RoundInput {
        uint256 circleId;
        uint256 roundNonce;
        uint256 deadline;
        uint256[] invoiceIds;
        uint256[] clearAmounts;
    }

    /// @dev With `kind == CONSENT_SIGNED`, net debtors sign an EIP-3009 `ReceiveWithAuthorization` for their net
    ///      debit, with `nonce = keccak256(abi.encode(address(this), roundHash, member))`, and everyone else signs
    ///      `ApproveRound` (`validAfter` / `validBefore` are then ignored). With `kind == CONSENT_MANDATE`, the
    ///      member's active mandate is used and the other fields are ignored.
    struct ConsentInput {
        address member;
        uint8 kind;
        uint256 validAfter;
        uint256 validBefore;
        bytes signature;
    }

    /// @dev What a member lets an agent do for them, signed once as EIP-712 `StandingMandate`.
    struct StandingMandate {
        uint256 circleId;
        address member;
        /// The key whose `AgentApproval` every round using this mandate needs. Not necessarily the sender.
        address agent;
        /// ERC-8004 agent ID, or 0.
        uint256 agentId;
        uint256 maxNetDebitPerRound;
        uint256 totalCap;
        /// Invoices this member owes in a round must fall due within this many days.
        uint32 maxDueDays;
        /// 30_000 means at least 3.0 cleared for every 1 paid. 0 turns the rule off.
        uint32 minClearRatioBps;
        /// Seconds that must pass between two uses.
        uint32 minCooldown;
        uint64 expiry;
        /// Must equal `memberMandateEpoch[member]` when activated.
        uint64 mandateNonce;
    }

    struct MandateState {
        bool activated;
        bool revoked;
        uint64 lastUsedAt;
        uint256 spent;
    }

    /// @dev EIP-2612 `permit` for `totalCap`, applied on activation. Unused when `maxNetDebitPerRound == 0`.
    struct PermitInput {
        uint256 deadline;
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    /// @dev The agent's EIP-712 `AgentApproval(roundHash, agent)`. One approval covers every mandate naming it.
    struct AgentApproval {
        address agent;
        bytes signature;
    }

    /// @dev Net positions of the members a round touches, built in memory while it is checked.
    struct Ledger {
        address[MAX_MEMBERS_PER_ROUND] members;
        uint256[MAX_MEMBERS_PER_ROUND] outTotal;
        uint256[MAX_MEMBERS_PER_ROUND] inTotal;
        uint256 count;
        uint256 gross;
    }

    // ------------------------------------------------------------------- state

    IUSD8 public immutable token;
    /// @notice ERC-8004 identity registry, or zero when agent identity checks are off.
    IAgentRegistry public immutable agentRegistry;

    uint256 public circleCount;
    uint256 public invoiceCount;

    mapping(uint256 circleId => Circle) private _circles;
    mapping(uint256 circleId => mapping(address member => Member)) private _members;
    mapping(uint256 circleId => address[]) private _memberList;
    mapping(uint256 circleId => uint256[]) private _invoiceList;
    mapping(uint256 invoiceId => Invoice) private _invoices;

    /// @notice Next nonce for an admin's signed circle actions.
    mapping(address signer => uint256) public nonces;
    /// @notice Signed invoices already registered (by EIP-712 struct hash).
    mapping(bytes32 structHash => bool) public usedInvoiceHashes;
    /// @notice Rounds already settled.
    mapping(bytes32 roundHash => bool) public usedRoundHashes;

    /// @notice A mandate can be activated only while its `mandateNonce` equals this. Every revoke advances it.
    mapping(address member => uint64) public memberMandateEpoch;
    /// @notice The member's most recently activated mandate, across all circles, or zero. It stays set after a
    ///         revoke, so a round that tries to use it fails with `MandateRevoked`; `hasLiveMandate` says if it is usable.
    mapping(address member => bytes32 mandateHash) public activeMandateOf;
    mapping(bytes32 mandateHash => StandingMandate) private _mandates;
    mapping(bytes32 mandateHash => MandateState) private _mandateState;

    // ------------------------------------------------------------------ events

    event CircleCreated(uint256 indexed circleId, address indexed admin, bytes32 nameHash);
    event MemberSet(uint256 indexed circleId, address indexed member, bool active, bytes32 nameHash);
    event MemberNameChanged(uint256 indexed circleId, address indexed member, bytes32 nameHash);
    event InvoiceRegistered(
        uint256 indexed invoiceId,
        uint256 indexed circleId,
        address indexed debtor,
        address creditor,
        uint256 amount,
        uint64 dueDate,
        bytes32 docHash
    );
    event InvoiceVoided(uint256 indexed invoiceId, uint256 remainingAmount);
    event InvoicePaidDirect(uint256 indexed invoiceId, uint256 amount, uint256 cleared);
    event MemberSettled(bytes32 indexed roundHash, address indexed member, uint256 outTotal, uint256 inTotal);
    event RoundSettled(
        bytes32 indexed roundHash, uint256 indexed circleId, address submitter, uint256 grossCleared, uint256 cashMoved
    );
    event MandateActivated(
        bytes32 indexed mandateHash, address indexed member, uint256 indexed circleId, address agent, uint256 agentId
    );
    event MandateUsed(bytes32 indexed mandateHash, bytes32 indexed roundHash, uint256 netDebit);
    event MandateCancelled(bytes32 indexed mandateHash, address indexed member);
    event MandateEpochBumped(address indexed member, uint64 epoch);

    // ------------------------------------------------------------------ errors

    error Expired();
    error InvalidSignature(address signer);
    error MissingSignature(address party);
    error LengthMismatch();
    error ZeroAddress();
    error CircleNotFound();
    error NotCircleAdmin();
    error NotActiveMember(address member);
    error InvalidInvoice();
    error InvoiceAlreadyRegistered();
    error InvoiceNotFound(uint256 invoiceId);
    error InvoiceVoidedAlready(uint256 invoiceId);
    error NothingLeftToClear(uint256 invoiceId);
    error BadBatchSize();
    error BadRoundSize();
    error InvoiceIdsNotAscending();
    error ZeroClearAmount();
    error WrongCircle(uint256 invoiceId);
    error OverClear(uint256 invoiceId);
    error TooManyMembers();
    error RoundAlreadySettled();
    error ConsentCountMismatch();
    error MissingConsent(address member);
    error CashNotConserved();
    error UnknownConsentKind();
    error StaleMandate();
    error MandateAlreadyUsed();
    error MandateAlreadyActive();
    error MandateNotFound();
    error NotMandateOwner();
    error AgentNotRegistered();
    error InsufficientAllowance();
    error NoActiveMandate(address member);
    error MandateRevoked(address member);
    error MandateExpired(address member);
    error MandateWrongCircle(address member);
    error MissingAgentApproval(address agent);
    error CooldownActive(address member);
    error InvoiceDueTooFar(uint256 invoiceId);
    error ExceedsRoundCap(address member);
    error ExceedsTotalCap(address member);
    error ClearRatioTooLow(address member);

    /// @param agentRegistry_ ERC-8004 identity registry, or zero to turn agent identity checks off.
    constructor(IUSD8 token_, IAgentRegistry agentRegistry_) EIP712("SaldaClearing", "1") {
        if (address(token_) == address(0)) revert ZeroAddress();
        token = token_;
        agentRegistry = agentRegistry_;
    }

    // ================================================================ circles

    /// @notice Creates a circle with the caller as admin and adds the first members.
    function createCircle(bytes32 circleNameHash, address[] calldata members, bytes32[] calldata nameHashes)
        external
        returns (uint256 circleId)
    {
        return _createCircle(msg.sender, circleNameHash, members, nameHashes);
    }

    /// @notice Gasless `createCircle`: `admin` signs `CreateCircle`, anyone submits.
    function createCircleWithSig(address admin, NewCircle calldata circle, uint256 deadline, bytes calldata signature)
        external
        returns (uint256 circleId)
    {
        _checkDeadline(deadline);
        _requireSig(admin, _createCircleDigest(circle, nonces[admin]++, deadline), signature);
        return _createCircle(admin, circle.nameHash, circle.members, circle.memberNameHashes);
    }

    /// @notice Adds, renames, deactivates or reactivates a member. Admin only.
    /// @dev Deactivating blocks new invoices only. Existing debts can still be settled with consent.
    function setCircleMember(uint256 circleId, address member, bool active, bytes32 nameHash) external {
        if (_circleAdmin(circleId) != msg.sender) revert NotCircleAdmin();
        _setMember(circleId, member, active, nameHash);
    }

    /// @notice Gasless `setCircleMember`: the circle admin signs, anyone submits.
    function setCircleMemberWithSig(
        uint256 circleId,
        address member,
        bool active,
        bytes32 nameHash,
        uint256 deadline,
        bytes calldata signature
    ) external {
        _checkDeadline(deadline);
        address admin = _circleAdmin(circleId);
        bytes32 digest = _hashTypedDataV4(
            keccak256(
                abi.encode(SET_CIRCLE_MEMBER_TYPEHASH, circleId, member, active, nameHash, nonces[admin]++, deadline)
            )
        );
        _requireSig(admin, digest, signature);
        _setMember(circleId, member, active, nameHash);
    }

    // =============================================================== invoices

    /// @notice Registers one invoice signed by both its debtor and creditor. Anyone may submit.
    function registerInvoice(InvoiceInput calldata inv, bytes calldata debtorSig, bytes calldata creditorSig)
        external
        returns (uint256 invoiceId)
    {
        _checkDeadline(inv.deadline);
        bytes32 structHash = _invoiceStructHash(inv);
        bytes32 digest = _hashTypedDataV4(structHash);
        _requireSig(inv.debtor, digest, debtorSig);
        _requireSig(inv.creditor, digest, creditorSig);
        return _register(inv, structHash);
    }

    /// @notice Registers up to 30 invoices. Every signer signs the same `RegisterInvoiceBatch`, and each
    ///         invoice's debtor and creditor must be among them, so one wallet prompt co-signs several invoices.
    /// @return firstId The id of the first invoice; the rest follow in order.
    function registerInvoices(InvoiceInput[] calldata invs, uint256 deadline, SignerSig[] calldata sigs)
        external
        returns (uint256 firstId)
    {
        _checkDeadline(deadline);
        uint256 n = invs.length;
        if (n == 0 || n > MAX_INVOICES_PER_BATCH) revert BadBatchSize();

        bytes32[] memory hashes = new bytes32[](n);
        for (uint256 i; i < n; ++i) {
            hashes[i] = _invoiceStructHash(invs[i]);
        }
        bytes32 digest = _hashTypedDataV4(
            keccak256(abi.encode(REGISTER_INVOICE_BATCH_TYPEHASH, keccak256(abi.encodePacked(hashes)), deadline))
        );
        for (uint256 j; j < sigs.length; ++j) {
            _requireSig(sigs[j].signer, digest, sigs[j].signature);
        }

        for (uint256 i; i < n; ++i) {
            InvoiceInput calldata inv = invs[i];
            _checkDeadline(inv.deadline);
            if (!_signedBy(sigs, inv.debtor)) revert MissingSignature(inv.debtor);
            if (!_signedBy(sigs, inv.creditor)) revert MissingSignature(inv.creditor);
            uint256 id = _register(inv, hashes[i]);
            if (i == 0) firstId = id;
        }
    }

    /// @notice Voids what is left of an invoice so it can never be cleared or paid. Needs both parties: each
    ///         either signs `VoidInvoice` or is the caller.
    function voidInvoice(uint256 invoiceId, uint256 deadline, bytes calldata debtorSig, bytes calldata creditorSig)
        external
    {
        _checkDeadline(deadline);
        Invoice storage inv = _openInvoice(invoiceId);
        uint256 remaining = inv.amount - inv.cleared;
        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(VOID_INVOICE_TYPEHASH, invoiceId, remaining, deadline)));
        _requireSigOrCaller(inv.debtor, digest, debtorSig);
        _requireSigOrCaller(inv.creditor, digest, creditorSig);
        inv.voided = true;
        emit InvoiceVoided(invoiceId, remaining);
    }

    /// @notice Pays part or all of one invoice straight to the creditor, with the debtor's EIP-3009
    ///         `ReceiveWithAuthorization`. There is deliberately no allowance-based variant.
    /// @dev The authorization nonce must be
    ///      `keccak256(abi.encode(address(this), "DIRECT", invoiceId, payAmount, directNonce))`.
    function payDirectWithAuthorization(
        uint256 invoiceId,
        uint256 payAmount,
        uint256 directNonce,
        uint256 validAfter,
        uint256 validBefore,
        bytes calldata signature
    ) external nonReentrant {
        Invoice storage inv = _openInvoice(invoiceId);
        if (payAmount == 0) revert ZeroClearAmount();
        if (inv.cleared + payAmount > inv.amount) revert OverClear(invoiceId);
        inv.cleared += payAmount;

        bytes32 nonce = keccak256(abi.encode(address(this), "DIRECT", invoiceId, payAmount, directNonce));
        token.receiveWithAuthorization(inv.debtor, address(this), payAmount, validAfter, validBefore, nonce, signature);
        token.safeTransfer(inv.creditor, payAmount);
        emit InvoicePaidDirect(invoiceId, payAmount, inv.cleared);
    }

    // ================================================================= rounds

    /// @notice Settles a clearing round, all or nothing. Anyone may submit; every touched member must consent,
    ///         by signature or through their standing mandate. `approvals` is empty when no mandate is used.
    /// @dev Pulls every net debit first, then pays every net credit, and requires the two totals to match, so the
    ///      contract's tUSD8 balance never changes.
    function settle(
        RoundInput calldata round,
        ConsentInput[] calldata consents,
        AgentApproval[] calldata approvals
    ) external nonReentrant returns (bytes32 roundHash) {
        if (block.timestamp > round.deadline) revert Expired();
        uint256 n = round.invoiceIds.length;
        if (n == 0 || n > MAX_INVOICES_PER_ROUND) revert BadRoundSize();
        if (round.clearAmounts.length != n) revert LengthMismatch();

        roundHash = hashRound(round);
        if (usedRoundHashes[roundHash]) revert RoundAlreadySettled();
        usedRoundHashes[roundHash] = true;

        Ledger memory ledger = _applyRound(round);
        if (consents.length != ledger.count) revert ConsentCountMismatch();

        uint256 pulled;
        for (uint256 k; k < ledger.count; ++k) {
            pulled += _consent(roundHash, round, ledger, k, consents, approvals);
        }
        uint256 paid = _payOut(ledger);
        if (pulled != paid) revert CashNotConserved();

        emit RoundSettled(roundHash, round.circleId, msg.sender, ledger.gross, paid);
    }

    /// @notice The hash every consent in a round refers to. Binds this contract, this chain and the exact plan.
    function hashRound(RoundInput calldata round) public view returns (bytes32) {
        return keccak256(
            abi.encode(
                address(this),
                block.chainid,
                round.circleId,
                round.roundNonce,
                round.deadline,
                round.invoiceIds,
                round.clearAmounts
            )
        );
    }

    // =============================================================== mandates

    /// @notice Stores a member's signed standing mandate and applies their `permit`. Anyone may submit.
    /// @dev One live mandate per member across all circles, because tUSD8 keeps a single allowance per spender.
    ///      The permit runs in try/catch, so someone submitting it first from the mempool cannot block activation.
    function activateMandate(StandingMandate calldata m, bytes calldata memberSig, PermitInput calldata permit)
        external
        returns (bytes32 mandateHash)
    {
        if (m.member == address(0) || m.agent == address(0)) revert ZeroAddress();
        if (m.mandateNonce != memberMandateEpoch[m.member]) revert StaleMandate();
        if (block.timestamp >= m.expiry) revert MandateExpired(m.member);
        if (!_members[m.circleId][m.member].active) revert NotActiveMember(m.member);

        mandateHash = hashMandate(m);
        MandateState storage s = _mandateState[mandateHash];
        if (s.activated) revert MandateAlreadyUsed();
        if (hasLiveMandate(m.member)) revert MandateAlreadyActive();
        _requireSig(m.member, _hashTypedDataV4(mandateHash), memberSig);
        _checkAgentIdentity(m.agent, m.agentId);

        if (m.maxNetDebitPerRound > 0) {
            try token.permit(m.member, address(this), m.totalCap, permit.deadline, permit.v, permit.r, permit.s) {}
                catch {}
            if (token.allowance(m.member, address(this)) < m.totalCap) revert InsufficientAllowance();
        }

        s.activated = true;
        _mandates[mandateHash] = m;
        activeMandateOf[m.member] = mandateHash;
        emit MandateActivated(mandateHash, m.member, m.circleId, m.agent, m.agentId);
    }

    /// @notice Revokes one of the caller's mandates. Also invalidates every signed mandate not yet activated.
    function revokeMandate(bytes32 mandateHash) external {
        address member = _mandates[mandateHash].member;
        if (member == address(0)) revert MandateNotFound();
        if (member != msg.sender) revert NotMandateOwner();
        _revokeMandate(mandateHash, member);
    }

    /// @notice Gasless `revokeMandate`: the member signs `RevokeMandate`, anyone submits.
    function revokeMandateWithSig(bytes32 mandateHash, uint256 deadline, bytes calldata signature) external {
        _checkDeadline(deadline);
        address member = _mandates[mandateHash].member;
        if (member == address(0)) revert MandateNotFound();
        _requireSig(
            member,
            _hashTypedDataV4(keccak256(abi.encode(REVOKE_MANDATE_TYPEHASH, mandateHash, deadline))),
            signature
        );
        _revokeMandate(mandateHash, member);
    }

    /// @notice Invalidates the caller's active mandate and every mandate they signed but never activated.
    function bumpMandateEpoch() external {
        _bumpEpoch(msg.sender);
    }

    /// @notice Gasless `bumpMandateEpoch`: the member signs `BumpMandateEpoch` for their current epoch.
    function bumpMandateEpochWithSig(address member, uint256 deadline, bytes calldata signature) external {
        _checkDeadline(deadline);
        _requireSig(
            member,
            _hashTypedDataV4(
                keccak256(abi.encode(BUMP_MANDATE_EPOCH_TYPEHASH, member, memberMandateEpoch[member], deadline))
            ),
            signature
        );
        _bumpEpoch(member);
    }

    /// @notice True while the member's active mandate can still be used.
    function hasLiveMandate(address member) public view returns (bool) {
        bytes32 mandateHash = activeMandateOf[member];
        if (mandateHash == bytes32(0)) return false;
        StandingMandate storage m = _mandates[mandateHash];
        return !_mandateState[mandateHash].revoked && m.mandateNonce == memberMandateEpoch[member]
            && block.timestamp < m.expiry;
    }

    /// @notice The EIP-712 struct hash of a mandate, which is also its id.
    function hashMandate(StandingMandate calldata m) public pure returns (bytes32) {
        return keccak256(
            abi.encode(
                STANDING_MANDATE_TYPEHASH,
                m.circleId,
                m.member,
                m.agent,
                m.agentId,
                m.maxNetDebitPerRound,
                m.totalCap,
                m.maxDueDays,
                m.minClearRatioBps,
                m.minCooldown,
                m.expiry,
                m.mandateNonce
            )
        );
    }

    function getMandate(bytes32 mandateHash) external view returns (StandingMandate memory, MandateState memory) {
        return (_mandates[mandateHash], _mandateState[mandateHash]);
    }

    // ================================================================== reads

    // solhint-disable-next-line func-name-mixedcase
    function DOMAIN_SEPARATOR() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    function getCircle(uint256 circleId) external view returns (Circle memory) {
        return _circles[circleId];
    }

    function getMember(uint256 circleId, address member) external view returns (Member memory) {
        return _members[circleId][member];
    }

    function getInvoice(uint256 invoiceId) external view returns (Invoice memory) {
        return _invoices[invoiceId];
    }

    function getInvoices(uint256[] calldata invoiceIds) external view returns (Invoice[] memory out) {
        out = new Invoice[](invoiceIds.length);
        for (uint256 i; i < invoiceIds.length; ++i) {
            out[i] = _invoices[invoiceIds[i]];
        }
    }

    /// @notice A page of a circle's members, in the order they were first added.
    function getCircleMembers(uint256 circleId, uint256 offset, uint256 limit)
        external
        view
        returns (address[] memory addrs, Member[] memory info, uint256 total)
    {
        address[] storage list = _memberList[circleId];
        total = list.length;
        uint256 end = _pageEnd(total, offset, limit);
        uint256 size = end > offset ? end - offset : 0;
        addrs = new address[](size);
        info = new Member[](size);
        for (uint256 i; i < size; ++i) {
            addrs[i] = list[offset + i];
            info[i] = _members[circleId][addrs[i]];
        }
    }

    /// @notice A page of a circle's invoice ids, oldest first.
    function getCircleInvoiceIds(uint256 circleId, uint256 offset, uint256 limit)
        external
        view
        returns (uint256[] memory ids, uint256 total)
    {
        uint256[] storage list = _invoiceList[circleId];
        total = list.length;
        uint256 end = _pageEnd(total, offset, limit);
        uint256 size = end > offset ? end - offset : 0;
        ids = new uint256[](size);
        for (uint256 i; i < size; ++i) {
            ids[i] = list[offset + i];
        }
    }

    // =============================================================== internal

    function _createCircle(
        address admin,
        bytes32 circleNameHash,
        address[] calldata members,
        bytes32[] calldata nameHashes
    ) private returns (uint256 circleId) {
        if (admin == address(0)) revert ZeroAddress();
        if (members.length != nameHashes.length) revert LengthMismatch();
        circleId = ++circleCount;
        _circles[circleId] = Circle({
            admin: admin, createdAt: uint64(block.timestamp), memberCount: 0, nameHash: circleNameHash
        });
        emit CircleCreated(circleId, admin, circleNameHash);
        for (uint256 i; i < members.length; ++i) {
            _setMember(circleId, members[i], true, nameHashes[i]);
        }
    }

    function _createCircleDigest(NewCircle calldata circle, uint256 nonce, uint256 deadline)
        private
        view
        returns (bytes32)
    {
        return _hashTypedDataV4(
            keccak256(
                abi.encode(
                    CREATE_CIRCLE_TYPEHASH,
                    circle.nameHash,
                    keccak256(abi.encodePacked(circle.members)),
                    keccak256(abi.encodePacked(circle.memberNameHashes)),
                    nonce,
                    deadline
                )
            )
        );
    }

    function _setMember(uint256 circleId, address member, bool active, bytes32 nameHash) private {
        if (member == address(0)) revert ZeroAddress();
        Member storage m = _members[circleId][member];
        if (!m.listed) {
            m.listed = true;
            _memberList[circleId].push(member);
            _circles[circleId].memberCount += 1;
        }
        if (m.nameHash != nameHash) {
            m.nameHash = nameHash;
            m.nameUpdatedAt = uint64(block.timestamp);
            emit MemberNameChanged(circleId, member, nameHash);
        }
        m.active = active;
        emit MemberSet(circleId, member, active, nameHash);
    }

    function _circleAdmin(uint256 circleId) private view returns (address admin) {
        admin = _circles[circleId].admin;
        if (admin == address(0)) revert CircleNotFound();
    }

    function _invoiceStructHash(InvoiceInput calldata inv) private pure returns (bytes32) {
        return keccak256(
            abi.encode(
                REGISTER_INVOICE_TYPEHASH,
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

    function _register(InvoiceInput calldata inv, bytes32 structHash) private returns (uint256 invoiceId) {
        if (usedInvoiceHashes[structHash]) revert InvoiceAlreadyRegistered();
        usedInvoiceHashes[structHash] = true;

        if (
            inv.amount == 0 || inv.debtor == address(0) || inv.creditor == address(0) || inv.debtor == inv.creditor
                || inv.dueDate == 0 || inv.dueDate > type(uint64).max
        ) revert InvalidInvoice();
        if (!_members[inv.circleId][inv.debtor].active) revert NotActiveMember(inv.debtor);
        if (!_members[inv.circleId][inv.creditor].active) revert NotActiveMember(inv.creditor);

        invoiceId = ++invoiceCount;
        _invoices[invoiceId] = Invoice({
            circleId: inv.circleId,
            debtor: inv.debtor,
            dueDate: uint64(inv.dueDate),
            creditor: inv.creditor,
            registeredAt: uint64(block.timestamp),
            voided: false,
            amount: inv.amount,
            cleared: 0,
            docHash: inv.docHash
        });
        _invoiceList[inv.circleId].push(invoiceId);
        emit InvoiceRegistered(
            invoiceId, inv.circleId, inv.debtor, inv.creditor, inv.amount, uint64(inv.dueDate), inv.docHash
        );
    }

    function _openInvoice(uint256 invoiceId) private view returns (Invoice storage inv) {
        inv = _invoices[invoiceId];
        if (inv.debtor == address(0)) revert InvoiceNotFound(invoiceId);
        if (inv.voided) revert InvoiceVoidedAlready(invoiceId);
        if (inv.cleared == inv.amount) revert NothingLeftToClear(invoiceId);
    }

    /// @dev Checks every invoice line, records what it clears, and builds each member's totals.
    function _applyRound(RoundInput calldata round) private returns (Ledger memory ledger) {
        uint256 previous = 0; // invoice ids start at 1
        for (uint256 i; i < round.invoiceIds.length; ++i) {
            uint256 id = round.invoiceIds[i];
            if (id <= previous) revert InvoiceIdsNotAscending();
            previous = id;

            uint256 amount = round.clearAmounts[i];
            if (amount == 0) revert ZeroClearAmount();
            Invoice storage inv = _invoices[id];
            if (inv.debtor == address(0)) revert InvoiceNotFound(id);
            if (inv.circleId != round.circleId) revert WrongCircle(id);
            if (inv.voided) revert InvoiceVoidedAlready(id);
            if (inv.cleared + amount > inv.amount) revert OverClear(id);
            inv.cleared += amount;

            ledger.outTotal[_slot(ledger, inv.debtor)] += amount;
            ledger.inTotal[_slot(ledger, inv.creditor)] += amount;
            ledger.gross += amount;
        }
    }

    function _slot(Ledger memory ledger, address member) private pure returns (uint256) {
        for (uint256 k; k < ledger.count; ++k) {
            if (ledger.members[k] == member) return k;
        }
        if (ledger.count == MAX_MEMBERS_PER_ROUND) revert TooManyMembers();
        ledger.members[ledger.count] = member;
        return ledger.count++;
    }

    /// @dev Verifies the consent of the k-th touched member and pulls their net debit into this contract.
    function _consent(
        bytes32 roundHash,
        RoundInput calldata round,
        Ledger memory ledger,
        uint256 k,
        ConsentInput[] calldata consents,
        AgentApproval[] calldata approvals
    ) private returns (uint256 pulled) {
        address member = ledger.members[k];
        ConsentInput calldata consent = _consentOf(consents, member);
        uint256 outTotal = ledger.outTotal[k];
        uint256 inTotal = ledger.inTotal[k];

        if (consent.kind == CONSENT_MANDATE) {
            pulled = _useMandate(roundHash, round, member, outTotal, inTotal, approvals);
        } else if (consent.kind != CONSENT_SIGNED) {
            revert UnknownConsentKind();
        } else if (outTotal > inTotal) {
            pulled = _pull(roundHash, consent, outTotal - inTotal);
        } else {
            // Net creditors and net-zero members must agree too: a pure cycle moves no cash at all.
            _requireSig(member, _approveRoundDigest(roundHash, member, outTotal, inTotal), consent.signature);
        }
        emit MemberSettled(roundHash, member, outTotal, inTotal);
    }

    /// @dev Applies every mandate rule, then pulls the net debit with the allowance the mandate's permit set.
    function _useMandate(
        bytes32 roundHash,
        RoundInput calldata round,
        address member,
        uint256 outTotal,
        uint256 inTotal,
        AgentApproval[] calldata approvals
    ) private returns (uint256 netDebit) {
        bytes32 mandateHash = activeMandateOf[member];
        if (mandateHash == bytes32(0)) revert NoActiveMandate(member);
        StandingMandate storage m = _mandates[mandateHash];
        MandateState storage s = _mandateState[mandateHash];

        _checkMandateLive(m, s, round.circleId);
        _requireAgentApproval(roundHash, m.agent, approvals);
        if (s.lastUsedAt != 0 && block.timestamp < uint256(s.lastUsedAt) + m.minCooldown) {
            revert CooldownActive(member);
        }
        s.lastUsedAt = uint64(block.timestamp);
        _checkDueDates(round, member, m.maxDueDays);

        if (outTotal > inTotal) {
            netDebit = outTotal - inTotal;
            if (netDebit > m.maxNetDebitPerRound) revert ExceedsRoundCap(member);
            if (s.spent + netDebit > m.totalCap) revert ExceedsTotalCap(member);
            if (m.minClearRatioBps != 0 && outTotal * 10_000 < netDebit * m.minClearRatioBps) {
                revert ClearRatioTooLow(member);
            }
            s.spent += netDebit;
            token.safeTransferFrom(member, address(this), netDebit);
        }
        emit MandateUsed(mandateHash, roundHash, netDebit);
    }

    function _checkMandateLive(StandingMandate storage m, MandateState storage s, uint256 circleId) private view {
        if (s.revoked || m.mandateNonce != memberMandateEpoch[m.member]) revert MandateRevoked(m.member);
        if (block.timestamp >= m.expiry) revert MandateExpired(m.member);
        if (m.circleId != circleId) revert MandateWrongCircle(m.member);
    }

    function _checkDueDates(RoundInput calldata round, address member, uint32 maxDueDays) private view {
        uint256 latest = block.timestamp + uint256(maxDueDays) * 1 days;
        for (uint256 i; i < round.invoiceIds.length; ++i) {
            Invoice storage inv = _invoices[round.invoiceIds[i]];
            if (inv.debtor == member && inv.dueDate > latest) revert InvoiceDueTooFar(round.invoiceIds[i]);
        }
    }

    function _requireAgentApproval(bytes32 roundHash, address agent, AgentApproval[] calldata approvals)
        private
        view
    {
        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(AGENT_APPROVAL_TYPEHASH, roundHash, agent)));
        for (uint256 i; i < approvals.length; ++i) {
            if (approvals[i].agent == agent) {
                _requireSig(agent, digest, approvals[i].signature);
                return;
            }
        }
        revert MissingAgentApproval(agent);
    }

    /// @dev Pulls a net debtor's debit with their EIP-3009 authorization, bound to this round.
    function _pull(bytes32 roundHash, ConsentInput calldata consent, uint256 netDebit) private returns (uint256) {
        bytes32 nonce = keccak256(abi.encode(address(this), roundHash, consent.member));
        token.receiveWithAuthorization(
            consent.member, address(this), netDebit, consent.validAfter, consent.validBefore, nonce, consent.signature
        );
        return netDebit;
    }

    function _approveRoundDigest(bytes32 roundHash, address member, uint256 outTotal, uint256 inTotal)
        private
        view
        returns (bytes32)
    {
        return _hashTypedDataV4(keccak256(abi.encode(APPROVE_ROUND_TYPEHASH, roundHash, member, outTotal, inTotal)));
    }

    function _payOut(Ledger memory ledger) private returns (uint256 paid) {
        for (uint256 k; k < ledger.count; ++k) {
            if (ledger.inTotal[k] > ledger.outTotal[k]) {
                uint256 netCredit = ledger.inTotal[k] - ledger.outTotal[k];
                token.safeTransfer(ledger.members[k], netCredit);
                paid += netCredit;
            }
        }
    }

    function _revokeMandate(bytes32 mandateHash, address member) private {
        MandateState storage s = _mandateState[mandateHash];
        if (s.revoked) revert MandateRevoked(member);
        s.revoked = true;
        emit MandateCancelled(mandateHash, member);
        _bumpEpoch(member);
    }

    /// @dev The active mandate's nonce no longer matches, so it stops working at once.
    function _bumpEpoch(address member) private {
        uint64 epoch = ++memberMandateEpoch[member];
        emit MandateEpochBumped(member, epoch);
    }

    /// @dev With a registry configured and a nonzero `agentId`, the agent key must own that ID. `settle()` never
    ///      calls the registry, so a registry outage cannot block or change settlement.
    function _checkAgentIdentity(address agent, uint256 agentId) private view {
        if (agentId == 0 || address(agentRegistry) == address(0)) return;
        try agentRegistry.ownerOf(agentId) returns (address owner) {
            if (owner != agent) revert AgentNotRegistered();
        } catch {
            revert AgentNotRegistered();
        }
    }

    function _consentOf(ConsentInput[] calldata consents, address member)
        private
        pure
        returns (ConsentInput calldata)
    {
        for (uint256 i; i < consents.length; ++i) {
            if (consents[i].member == member) return consents[i];
        }
        revert MissingConsent(member);
    }

    function _signedBy(SignerSig[] calldata sigs, address party) private pure returns (bool) {
        for (uint256 j; j < sigs.length; ++j) {
            if (sigs[j].signer == party) return true;
        }
        return false;
    }

    function _requireSig(address signer, bytes32 digest, bytes calldata signature) private view {
        if (signer == address(0) || !SignatureChecker.isValidSignatureNow(signer, digest, signature)) {
            revert InvalidSignature(signer);
        }
    }

    function _requireSigOrCaller(address party, bytes32 digest, bytes calldata signature) private view {
        if (msg.sender != party) _requireSig(party, digest, signature);
    }

    function _checkDeadline(uint256 deadline) private view {
        if (block.timestamp > deadline) revert Expired();
    }

    function _pageEnd(uint256 total, uint256 offset, uint256 limit) private pure returns (uint256) {
        if (offset >= total) return offset;
        return limit > total - offset ? total : offset + limit;
    }
}
