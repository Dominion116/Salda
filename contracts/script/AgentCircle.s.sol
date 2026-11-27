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

/// @notice Sets up a circle where every business has a standing mandate naming the clearing agent, so the agent
///         can settle a round with nobody present. Three fresh accounts, derived from the relayer key, owe each
///         other 0.06, 0.05 and 0.04 (the three-shop case at 1/100 scale); Ada gets the 0.02 she will pay.
///         Then press "Run clearing now", or POST /api/agent {"circleId": …}, and the agent settles it.
///
///         forge script script/AgentCircle.s.sol --rpc-url aevum --legacy --broadcast
///
///         Needs SALDA_ADDRESS, RELAYER_PRIVATE_KEY (pays gas and the 0.02) and AGENT_ADDRESS.
contract AgentCircle is Script {
    ITUSD8 internal constant TOKEN = ITUSD8(0x456569838f1d43009A91ebA4263147Afd7233483);
    uint256 internal constant CENT = 1e4; // 0.01 tUSD8
    uint256 internal constant SECP256K1_N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141;

    SaldaClearing internal salda;
    uint256[3] internal keys;
    address[] internal shops;

    function run() external {
        require(block.chainid == 44005, "run with --rpc-url aevum");
        salda = SaldaClearing(vm.envAddress("SALDA_ADDRESS"));
        uint256 relayerKey = vm.envUint("RELAYER_PRIVATE_KEY");
        address agent = vm.envAddress("AGENT_ADDRESS");
        for (uint256 i; i < 3; ++i) {
            keys[i] = uint256(keccak256(abi.encode(relayerKey, "salda agent circle", block.timestamp, i))) % SECP256K1_N;
            shops.push(vm.addr(keys[i]));
        }

        vm.startBroadcast(relayerKey);
        bytes32[] memory names = new bytes32[](3);
        for (uint256 i; i < 3; ++i) {
            names[i] = keccak256(abi.encode(shops[i], "Agent test shop", bytes32(block.timestamp + i)));
        }
        uint256 circleId = salda.createCircle(keccak256(abi.encode("Salda agent circle", block.timestamp)), shops, names);
        uint256 first = _register(circleId);
        for (uint256 i; i < 3; ++i) {
            _activate(circleId, i, agent);
        }
        require(TOKEN.transfer(shops[0], 2 * CENT), "funding failed");
        vm.stopBroadcast();

        console2.log("AGENT_TEST_CIRCLE=", circleId);
        console2.log("Invoices", first, "to", first + 2);
    }

    /// @dev Ada owes Ben 0.06, Ben owes Chidi 0.05, Chidi owes Ada 0.04, each due in 14 days.
    function _register(uint256 circleId) internal returns (uint256) {
        SaldaClearing.InvoiceInput[] memory invs = new SaldaClearing.InvoiceInput[](3);
        uint256[3] memory amounts = [6 * CENT, 5 * CENT, 4 * CENT];
        bytes32[] memory hashes = new bytes32[](3);
        uint256 deadline = block.timestamp + 1 hours;
        for (uint256 i; i < 3; ++i) {
            invs[i] = SaldaClearing.InvoiceInput({
                circleId: circleId,
                debtor: shops[i],
                creditor: shops[(i + 1) % 3],
                amount: amounts[i],
                dueDate: block.timestamp + 14 days,
                docHash: keccak256(abi.encode("agent circle invoice", i, block.timestamp)),
                salt: keccak256(abi.encode(circleId, i, block.timestamp)),
                deadline: deadline
            });
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
        for (uint256 i; i < 3; ++i) {
            sigs[i] = SaldaClearing.SignerSig({signer: shops[i], signature: _sign(keys[i], digest)});
        }
        return salda.registerInvoices(invs, deadline, sigs);
    }

    /// @dev The same limits the demo shows: 0.02 per round, 0.10 in total, invoices due within 30 days, 3.0x.
    function _activate(uint256 circleId, uint256 i, address agent) internal {
        SaldaClearing.StandingMandate memory m = SaldaClearing.StandingMandate({
            circleId: circleId,
            member: shops[i],
            agent: agent,
            agentId: 0,
            maxNetDebitPerRound: 2 * CENT,
            totalCap: 10 * CENT,
            maxDueDays: 30,
            minClearRatioBps: 30_000,
            minCooldown: 0,
            expiry: uint64(block.timestamp + 30 days),
            mandateNonce: salda.memberMandateEpoch(shops[i])
        });
        bytes memory memberSig = _sign(keys[i], _digest(salda.DOMAIN_SEPARATOR(), salda.hashMandate(m)));
        SaldaClearing.PermitInput memory permit;
        permit.deadline = m.expiry;
        bytes32 permitHash = keccak256(
            abi.encode(
                keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"),
                shops[i],
                address(salda),
                m.totalCap,
                TOKEN.nonces(shops[i]),
                permit.deadline
            )
        );
        (permit.v, permit.r, permit.s) = vm.sign(keys[i], _digest(TOKEN.DOMAIN_SEPARATOR(), permitHash));
        salda.activateMandate(m, memberSig, permit);
    }

    function _digest(bytes32 domainSeparator, bytes32 structHash) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
    }

    function _sign(uint256 key, bytes32 digest) internal pure returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        return abi.encodePacked(r, s, v);
    }
}
