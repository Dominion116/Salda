// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {SaldaClearing} from "../src/SaldaClearing.sol";

interface ITUSD8 {
    function DOMAIN_SEPARATOR() external view returns (bytes32);
    function nonces(address) external view returns (uint256);
    function balanceOf(address) external view returns (uint256);
    function transfer(address, uint256) external returns (bool);
}

/// @notice One-time setup for the /demo "Simulated compromised agent". Creates a circle of the two server-held
///         demo shops (Ben and Chidi) with three invoices, gives Ben a live mandate and Chidi a revoked one. The
///         demo then builds bad rounds against these and simulates them, so nothing is ever spent.
///
///         forge script script/DemoSetup.s.sol --rpc-url aevum --legacy --broadcast
///
///         Needs SALDA_ADDRESS, RELAYER_PRIVATE_KEY (pays gas, holds ~0.05 tUSD8), DEMO_BEN_KEY, DEMO_CHIDI_KEY and
///         AGENT_ADDRESS. Prints DEMO_ATTACK_CIRCLE and DEMO_ATTACK_INVOICES for web/.env.local and Vercel.
contract DemoSetup is Script {
    address internal constant TUSD8 = 0x456569838f1d43009A91ebA4263147Afd7233483;
    uint256 internal constant CENT = 1e4; // 0.01 tUSD8

    SaldaClearing internal salda;
    ITUSD8 internal token = ITUSD8(TUSD8);
    uint256 internal relayerKey;
    uint256 internal benKey;
    uint256 internal chidiKey;
    address internal ben;
    address internal chidi;
    address internal agent;

    function run() external {
        require(block.chainid == 44005, "run with --rpc-url aevum");
        salda = SaldaClearing(vm.envAddress("SALDA_ADDRESS"));
        relayerKey = vm.envUint("RELAYER_PRIVATE_KEY");
        benKey = vm.envUint("DEMO_BEN_KEY");
        chidiKey = vm.envUint("DEMO_CHIDI_KEY");
        agent = vm.envAddress("AGENT_ADDRESS");
        ben = vm.addr(benKey);
        chidi = vm.addr(chidiKey);
        require(!salda.hasLiveMandate(ben), "Ben already has a live mandate: setup has run before");

        vm.startBroadcast(relayerKey);
        address[] memory members = new address[](2);
        (members[0], members[1]) = (ben, chidi);
        bytes32[] memory names = new bytes32[](2);
        names[0] = keccak256(abi.encode(ben, "Demo shop B", bytes32(uint256(1))));
        names[1] = keccak256(abi.encode(chidi, "Demo shop C", bytes32(uint256(2))));
        uint256 circleId = salda.createCircle(keccak256("Salda demo: compromised agent"), members, names);

        uint256 first = _registerInvoices(circleId);

        // Ben pays in the fair round, so the simulation of it succeeds. Chidi never pays.
        if (token.balanceOf(ben) < 2 * CENT) require(token.transfer(ben, 2 * CENT - token.balanceOf(ben)), "seed failed");

        _activate(circleId, benKey, ben);
        bytes32 chidiMandate = _activate(circleId, chidiKey, chidi);
        uint256 deadline = block.timestamp + 1 hours;
        bytes32 revokeDigest = _digest(
            salda.DOMAIN_SEPARATOR(), keccak256(abi.encode(salda.REVOKE_MANDATE_TYPEHASH(), chidiMandate, deadline))
        );
        salda.revokeMandateWithSig(chidiMandate, deadline, _sign(chidiKey, revokeDigest));
        vm.stopBroadcast();

        console2.log("DEMO_ATTACK_CIRCLE=", circleId);
        console2.log(
            string.concat(
                "DEMO_ATTACK_INVOICES=", vm.toString(first), ",", vm.toString(first + 1), ",", vm.toString(first + 2)
            )
        );
    }

    /// @dev Ben owes Chidi 0.06 (due in 14 days), Chidi owes Ben 0.04 (14 days), Ben owes Chidi 0.03 (90 days).
    function _registerInvoices(uint256 circleId) internal returns (uint256 first) {
        SaldaClearing.InvoiceInput[] memory invs = new SaldaClearing.InvoiceInput[](3);
        invs[0] = _invoice(circleId, ben, chidi, 6 * CENT, 14 days, 1);
        invs[1] = _invoice(circleId, chidi, ben, 4 * CENT, 14 days, 2);
        invs[2] = _invoice(circleId, ben, chidi, 3 * CENT, 90 days, 3);
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
        SaldaClearing.SignerSig[] memory sigs = new SaldaClearing.SignerSig[](2);
        sigs[0] = SaldaClearing.SignerSig({signer: ben, signature: _sign(benKey, digest)});
        sigs[1] = SaldaClearing.SignerSig({signer: chidi, signature: _sign(chidiKey, digest)});
        first = salda.registerInvoices(invs, deadline, sigs);
    }

    function _invoice(uint256 circleId, address debtor, address creditor, uint256 amount, uint256 dueIn, uint256 n)
        internal
        view
        returns (SaldaClearing.InvoiceInput memory)
    {
        return SaldaClearing.InvoiceInput({
            circleId: circleId,
            debtor: debtor,
            creditor: creditor,
            amount: amount,
            dueDate: block.timestamp + dueIn,
            docHash: keccak256(abi.encode("demo invoice", n, block.timestamp)),
            salt: keccak256(abi.encode(circleId, n, block.timestamp)),
            deadline: block.timestamp + 1 hours
        });
    }

    /// @dev The same limits the demo shows: 0.02 per round, 0.10 in total, 30 days, at least 3.0x.
    function _activate(uint256 circleId, uint256 key, address member) internal returns (bytes32) {
        SaldaClearing.StandingMandate memory m = SaldaClearing.StandingMandate({
            circleId: circleId,
            member: member,
            agent: agent,
            agentId: 0,
            maxNetDebitPerRound: 2 * CENT,
            totalCap: 10 * CENT,
            maxDueDays: 30,
            minClearRatioBps: 30_000,
            minCooldown: 0,
            expiry: uint64(block.timestamp + 365 days),
            mandateNonce: salda.memberMandateEpoch(member)
        });
        bytes memory memberSig = _sign(key, _digest(salda.DOMAIN_SEPARATOR(), salda.hashMandate(m)));
        SaldaClearing.PermitInput memory permit;
        permit.deadline = m.expiry;
        bytes32 permitHash = keccak256(
            abi.encode(
                keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"),
                member,
                address(salda),
                m.totalCap,
                token.nonces(member),
                permit.deadline
            )
        );
        (permit.v, permit.r, permit.s) = vm.sign(key, _digest(token.DOMAIN_SEPARATOR(), permitHash));
        return salda.activateMandate(m, memberSig, permit);
    }

    function _digest(bytes32 domainSeparator, bytes32 structHash) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
    }

    function _sign(uint256 key, bytes32 digest) internal pure returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        return abi.encodePacked(r, s, v);
    }
}
