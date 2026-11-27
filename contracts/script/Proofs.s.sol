// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {SaldaClearing} from "../src/SaldaClearing.sol";

interface ITUSD8 {
    function DOMAIN_SEPARATOR() external view returns (bytes32);
    function balanceOf(address) external view returns (uint256);
    function transfer(address, uint256) external returns (bool);
    function transferWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;
}

/// @notice The explorer proofs from PRD 7.3, reproducible.
///
///   Proof 1, the full-scale round (15.00 cleared with 2.00), broadcast:
///     forge script script/Proofs.s.sol --sig "full()" --rpc-url aevum --legacy --broadcast
///   Three fresh accounts derived from the relayer key play Ada, Ben and Chidi. The relayer lends Ada 2.00, and
///   afterwards Ben and Chidi return their 1.00 each with a gasless transfer, so only gas is spent.
///
///   Proofs 2 and 3, rejected rounds: the relayer never sends a failing round, so this builds them, checks by
///   simulation that the contract refuses each with the expected error, and prints the calldata to send once with
///   `cast send --gas-limit`, giving each refusal an explorer link:
///     forge script script/Proofs.s.sol --sig "rejected()" --rpc-url aevum
///   2: the agent approves a round where Ben's mandate pays 0.02 to clear 0.03 (1.5x, limit 3.0x): ClearRatioTooLow.
///   3: the agent approves a round using Chidi's mandate, revoked by DemoSetup.s.sol: MandateRevoked.
///
/// Needs SALDA_ADDRESS, RELAYER_PRIVATE_KEY; for rejected() also AGENT_PRIVATE_KEY, DEMO_BEN_KEY, DEMO_CHIDI_KEY
/// and optionally DEMO_ATTACK_CIRCLE (default 1).
contract Proofs is Script {
    ITUSD8 internal constant TOKEN = ITUSD8(0x456569838f1d43009A91ebA4263147Afd7233483);
    uint256 internal constant ONE = 1e6;
    uint256 internal constant CENT = 1e4;
    uint256 internal constant SECP256K1_N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141;
    bytes32 internal constant RECEIVE_TYPEHASH = keccak256(
        "ReceiveWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)"
    );
    bytes32 internal constant TRANSFER_TYPEHASH = keccak256(
        "TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)"
    );

    SaldaClearing internal salda;

    // ============================================================== proof 1

    function full() external {
        require(block.chainid == 44005, "run with --rpc-url aevum");
        salda = SaldaClearing(vm.envAddress("SALDA_ADDRESS"));
        uint256 relayerKey = vm.envUint("RELAYER_PRIVATE_KEY");
        address relayer = vm.addr(relayerKey);
        require(TOKEN.balanceOf(relayer) >= 2 * ONE, "relayer needs 2 tUSD8");

        uint256[3] memory keys;
        address[] memory shops = new address[](3);
        for (uint256 i; i < 3; ++i) {
            keys[i] = uint256(keccak256(abi.encode(relayerKey, "salda full-scale proof", block.timestamp, i))) % SECP256K1_N;
            shops[i] = vm.addr(keys[i]);
        }
        (address ada, address ben, address chidi) = (shops[0], shops[1], shops[2]);

        vm.startBroadcast(relayerKey);
        bytes32[] memory names = new bytes32[](3);
        for (uint256 i; i < 3; ++i) {
            names[i] = keccak256(abi.encode(shops[i], "Proof shop", bytes32(block.timestamp + i)));
        }
        uint256 circleId = salda.createCircle(keccak256(abi.encode("Salda full-scale proof", block.timestamp)), shops, names);

        uint256 first = _register(circleId, keys, ada, ben, chidi);
        require(TOKEN.transfer(ada, 2 * ONE), "lend failed");

        SaldaClearing.RoundInput memory round = _round(circleId, first, 3, [6 * ONE, 5 * ONE, 4 * ONE]);
        bytes32 roundHash = salda.hashRound(round);
        SaldaClearing.ConsentInput[] memory consents = new SaldaClearing.ConsentInput[](3);
        consents[0] = _payConsent(keys[0], ada, 2 * ONE, roundHash, round.deadline); // Ada: out 6, in 4
        consents[1] = _approveConsent(keys[1], ben, roundHash, 5 * ONE, 6 * ONE); // Ben: out 5, in 6
        consents[2] = _approveConsent(keys[2], chidi, roundHash, 4 * ONE, 5 * ONE); // Chidi: out 4, in 5
        salda.settle(round, consents, new SaldaClearing.AgentApproval[](0));

        // Ben and Chidi each received 1.00. They return it without gas, so the proof costs only fees.
        _returnFunds(keys[1], ben, relayer, ONE);
        _returnFunds(keys[2], chidi, relayer, ONE);
        vm.stopBroadcast();

        console2.log("Circle", circleId);
        console2.log("Invoices", first, "to", first + 2);
        console2.logBytes32(roundHash);
    }

    function _register(uint256 circleId, uint256[3] memory keys, address ada, address ben, address chidi)
        internal
        returns (uint256)
    {
        SaldaClearing.InvoiceInput[] memory invs = new SaldaClearing.InvoiceInput[](3);
        invs[0] = _invoice(circleId, ada, ben, 6 * ONE, 0);
        invs[1] = _invoice(circleId, ben, chidi, 5 * ONE, 1);
        invs[2] = _invoice(circleId, chidi, ada, 4 * ONE, 2);
        uint256 deadline = block.timestamp + 1 hours;
        bytes32[] memory hashes = new bytes32[](3);
        for (uint256 i; i < 3; ++i) {
            hashes[i] = keccak256(
                abi.encode(
                    salda.REGISTER_INVOICE_TYPEHASH(),
                    invs[i].circleId,
                    invs[i].debtor,
                    invs[i].creditor,
                    invs[i].amount,
                    invs[i].dueDate,
                    invs[i].docHash,
                    invs[i].salt,
                    invs[i].deadline
                )
            );
        }
        bytes32 digest = _digest(
            salda.DOMAIN_SEPARATOR(),
            keccak256(abi.encode(salda.REGISTER_INVOICE_BATCH_TYPEHASH(), keccak256(abi.encodePacked(hashes)), deadline))
        );
        SaldaClearing.SignerSig[] memory sigs = new SaldaClearing.SignerSig[](3);
        sigs[0] = SaldaClearing.SignerSig({signer: ada, signature: _sign(keys[0], digest)});
        sigs[1] = SaldaClearing.SignerSig({signer: ben, signature: _sign(keys[1], digest)});
        sigs[2] = SaldaClearing.SignerSig({signer: chidi, signature: _sign(keys[2], digest)});
        return salda.registerInvoices(invs, deadline, sigs);
    }

    function _invoice(uint256 circleId, address debtor, address creditor, uint256 amount, uint256 n)
        internal
        view
        returns (SaldaClearing.InvoiceInput memory)
    {
        return SaldaClearing.InvoiceInput({
            circleId: circleId,
            debtor: debtor,
            creditor: creditor,
            amount: amount,
            dueDate: block.timestamp + 14 days,
            docHash: keccak256(abi.encode("full-scale proof invoice", n, block.timestamp)),
            salt: keccak256(abi.encode(circleId, n, block.timestamp)),
            deadline: block.timestamp + 1 hours
        });
    }

    function _returnFunds(uint256 key, address from, address to, uint256 value) internal {
        uint256 validBefore = block.timestamp + 1 hours;
        bytes32 nonce = keccak256(abi.encode("salda proof refund", from, block.timestamp));
        bytes32 digest = _digest(
            TOKEN.DOMAIN_SEPARATOR(),
            keccak256(abi.encode(TRANSFER_TYPEHASH, from, to, value, uint256(0), validBefore, nonce))
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        TOKEN.transferWithAuthorization(from, to, value, 0, validBefore, nonce, v, r, s);
    }

    // ========================================================= proofs 2 and 3

    function rejected() external {
        require(block.chainid == 44005, "run with --rpc-url aevum");
        salda = SaldaClearing(vm.envAddress("SALDA_ADDRESS"));
        (uint256[] memory ids,) = salda.getCircleInvoiceIds(vm.envOr("DEMO_ATTACK_CIRCLE", uint256(1)), 0, 3);
        require(ids.length == 3, "run DemoSetup.s.sol first");
        // DemoSetup: ids[0] Ben owes Chidi 0.06, ids[1] Chidi owes Ben 0.04, ids[2] Ben owes Chidi 0.03 (90 days).

        bytes memory proof2 = _ratioProof(ids[0], ids[1]);
        _expectRefusal(proof2, SaldaClearing.ClearRatioTooLow.selector, "proof 2");
        bytes memory proof3 = _revokedProof(ids[1]);
        _expectRefusal(proof3, SaldaClearing.MandateRevoked.selector, "proof 3");

        console2.log("PROOF2_CALLDATA");
        console2.logBytes(proof2);
        console2.log("PROOF3_CALLDATA");
        console2.logBytes(proof3);
    }

    /// @dev Ben's live mandate pays 0.02 to clear 0.03 (1.5x, below its 3.0x minimum). Chidi signs for himself.
    function _ratioProof(uint256 benOwes, uint256 chidiOwes) internal view returns (bytes memory) {
        SaldaClearing.RoundInput memory round = _round(vm.envOr("DEMO_ATTACK_CIRCLE", uint256(1)), benOwes, 2, [3 * CENT, CENT, 0]);
        round.invoiceIds[1] = chidiOwes;
        bytes32 roundHash = salda.hashRound(round);
        uint256 chidiKey = vm.envUint("DEMO_CHIDI_KEY");
        SaldaClearing.ConsentInput[] memory consents = new SaldaClearing.ConsentInput[](2);
        consents[0] = _mandateConsent(vm.addr(vm.envUint("DEMO_BEN_KEY")));
        consents[1] = _approveConsent(chidiKey, vm.addr(chidiKey), roundHash, CENT, 3 * CENT);
        return abi.encodeCall(SaldaClearing.settle, (round, consents, _approval(roundHash)));
    }

    /// @dev A round that relies on Chidi's mandate, which DemoSetup revoked.
    function _revokedProof(uint256 chidiOwes) internal view returns (bytes memory) {
        SaldaClearing.RoundInput memory round = _round(vm.envOr("DEMO_ATTACK_CIRCLE", uint256(1)), chidiOwes, 1, [CENT, 0, 0]);
        bytes32 roundHash = salda.hashRound(round);
        SaldaClearing.ConsentInput[] memory consents = new SaldaClearing.ConsentInput[](2);
        consents[0] = _mandateConsent(vm.addr(vm.envUint("DEMO_CHIDI_KEY")));
        consents[1] = _mandateConsent(vm.addr(vm.envUint("DEMO_BEN_KEY")));
        return abi.encodeCall(SaldaClearing.settle, (round, consents, _approval(roundHash)));
    }

    /// @dev Stops unless the contract refuses `data` with exactly `selector`.
    function _expectRefusal(bytes memory data, bytes4 selector, string memory label) internal {
        vm.prank(vm.addr(vm.envUint("RELAYER_PRIVATE_KEY")));
        (bool ok, bytes memory reason) = address(salda).call(data);
        require(!ok, string.concat(label, ": the contract accepted it"));
        require(reason.length >= 4 && bytes4(reason) == selector, string.concat(label, ": refused for another reason"));
        console2.log(string.concat(label, ": refused as expected"));
    }

    // ============================================================== helpers

    /// @dev A round over `count` invoices starting at `firstId`, with the given amounts.
    function _round(uint256 circleId, uint256 firstId, uint256 count, uint256[3] memory amounts)
        internal
        view
        returns (SaldaClearing.RoundInput memory round)
    {
        round.circleId = circleId;
        round.roundNonce = uint256(keccak256(abi.encode(block.timestamp, firstId, count, amounts)));
        round.deadline = block.timestamp + 1 hours;
        round.invoiceIds = new uint256[](count);
        round.clearAmounts = new uint256[](count);
        for (uint256 i; i < count; ++i) {
            round.invoiceIds[i] = firstId + i;
            round.clearAmounts[i] = amounts[i];
        }
    }

    function _payConsent(uint256 key, address member, uint256 value, bytes32 roundHash, uint256 validBefore)
        internal
        view
        returns (SaldaClearing.ConsentInput memory)
    {
        bytes32 digest = _digest(TOKEN.DOMAIN_SEPARATOR(), _receiveHash(member, value, validBefore, roundHash));
        return SaldaClearing.ConsentInput({
            member: member, kind: 0, validAfter: 0, validBefore: validBefore, signature: _sign(key, digest)
        });
    }

    function _receiveHash(address member, uint256 value, uint256 validBefore, bytes32 roundHash)
        internal
        view
        returns (bytes32)
    {
        bytes32 nonce = keccak256(abi.encode(address(salda), roundHash, member));
        return keccak256(abi.encode(RECEIVE_TYPEHASH, member, address(salda), value, uint256(0), validBefore, nonce));
    }

    function _approveConsent(uint256 key, address member, bytes32 roundHash, uint256 outTotal, uint256 inTotal)
        internal
        view
        returns (SaldaClearing.ConsentInput memory)
    {
        bytes32 digest = _digest(
            salda.DOMAIN_SEPARATOR(),
            keccak256(abi.encode(salda.APPROVE_ROUND_TYPEHASH(), roundHash, member, outTotal, inTotal))
        );
        return SaldaClearing.ConsentInput({member: member, kind: 0, validAfter: 0, validBefore: 0, signature: _sign(key, digest)});
    }

    function _mandateConsent(address member) internal view returns (SaldaClearing.ConsentInput memory) {
        return SaldaClearing.ConsentInput({
            member: member, kind: salda.CONSENT_MANDATE(), validAfter: 0, validBefore: 0, signature: ""
        });
    }

    function _approval(bytes32 roundHash) internal view returns (SaldaClearing.AgentApproval[] memory approvals) {
        uint256 agentKey = vm.envUint("AGENT_PRIVATE_KEY");
        address agent = vm.addr(agentKey);
        bytes32 digest =
            _digest(salda.DOMAIN_SEPARATOR(), keccak256(abi.encode(salda.AGENT_APPROVAL_TYPEHASH(), roundHash, agent)));
        approvals = new SaldaClearing.AgentApproval[](1);
        approvals[0] = SaldaClearing.AgentApproval({agent: agent, signature: _sign(agentKey, digest)});
    }

    function _digest(bytes32 domainSeparator, bytes32 structHash) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
    }

    function _sign(uint256 key, bytes32 digest) internal pure returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        return abi.encodePacked(r, s, v);
    }
}
