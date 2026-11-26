// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {IUSD8, SaldaClearing} from "../src/SaldaClearing.sol";

interface IFiatToken {
    function DOMAIN_SEPARATOR() external view returns (bytes32);
    function paused() external view returns (bool);
    function isBlacklisted(address) external view returns (bool);
    function balanceOf(address) external view returns (uint256);
    function transfer(address, uint256) external returns (bool);
}

/// @notice The Phase 6 riskiest check: a maximum-size round (10 members, 30 invoices) on Aevum testnet with real
///         tUSD8. Deploys SaldaClearing (or reuses SALDA_ADDRESS), creates a circle of 10 test members derived from
///         the funder's key, registers 30 invoices in one batch, funds each net debtor, and settles everything.
///
///         forge script script/MaxRound.s.sol --rpc-url aevum --legacy --broadcast
///
///         Needs PRIVATE_KEY (a test-only wallet) holding about 0.05 tQDAY and 0.5 tUSD8.
contract MaxRound is Script {
    address internal constant TUSD8 = 0x456569838f1d43009A91ebA4263147Afd7233483;
    uint256 internal constant SECP256K1_N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141;
    uint256 internal constant MEMBERS = 10;
    uint256 internal constant INVOICES = 30;
    uint256 internal constant CENT = 1e4; // 0.01 tUSD8
    bytes32 internal constant RECEIVE_TYPEHASH = keccak256(
        "ReceiveWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)"
    );

    uint256[] internal keys;
    address[] internal members;

    function run() external {
        require(block.chainid == 44005, "run with --rpc-url aevum");
        uint256 funderKey = vm.envUint("PRIVATE_KEY");
        address funder = vm.addr(funderKey);
        IFiatToken token = IFiatToken(TUSD8);
        require(!token.paused(), "tUSD8 is paused");

        // Ten test members, derived from the funder key so a rerun reuses them and their balances can be swept.
        for (uint256 i; i < MEMBERS; ++i) {
            uint256 key = uint256(keccak256(abi.encode(funderKey, "salda max round member", i))) % SECP256K1_N;
            keys.push(key == 0 ? 1 : key);
            members.push(vm.addr(keys[i]));
            require(!token.isBlacklisted(members[i]), "member blacklisted");
        }

        vm.startBroadcast(funderKey);
        address existing = vm.envOr("SALDA_ADDRESS", address(0));
        SaldaClearing salda = existing == address(0) ? new SaldaClearing(IUSD8(TUSD8)) : SaldaClearing(existing);
        uint256 circleId = salda.createCircle(keccak256("Salda max-size check"), members, _nameHashes());

        (uint256[] memory ids, uint256[] memory amounts) = _registerInvoices(salda, circleId);
        SaldaClearing.RoundInput memory round = SaldaClearing.RoundInput({
            circleId: circleId,
            roundNonce: uint256(keccak256(abi.encode(block.timestamp, funder))),
            deadline: block.timestamp + 2 hours,
            invoiceIds: ids,
            clearAmounts: amounts
        });

        (uint256[] memory outs, uint256[] memory ins) = _totals(ids, amounts);
        uint256 totalDebit = _fundDebtors(token, funder, outs, ins);
        SaldaClearing.ConsentInput[] memory consents = _consents(salda, token, round, outs, ins);
        bytes32 roundHash = salda.settle(round, consents);
        vm.stopBroadcast();

        uint256 gross;
        for (uint256 i; i < INVOICES; ++i) {
            gross += amounts[i];
        }
        console2.log("SaldaClearing:", address(salda));
        console2.log("Circle:", circleId);
        console2.log("Invoices:", ids[0], "to", ids[INVOICES - 1]);
        console2.log("Debt cleared (tUSD8 base units):", gross);
        console2.log("Cash moved (tUSD8 base units):", totalDebit);
        console2.logBytes32(roundHash);
    }

    function _nameHashes() internal view returns (bytes32[] memory names) {
        names = new bytes32[](MEMBERS);
        for (uint256 i; i < MEMBERS; ++i) {
            names[i] = keccak256(abi.encode(members[i], string.concat("Test shop ", vm.toString(i)), bytes32(i + 1)));
        }
    }

    /// @dev 30 invoices: member i % 10 owes member (3i + 1) % 10, from 0.010 to 0.039 tUSD8.
    function _registerInvoices(SaldaClearing salda, uint256 circleId)
        internal
        returns (uint256[] memory ids, uint256[] memory amounts)
    {
        SaldaClearing.InvoiceInput[] memory invs = new SaldaClearing.InvoiceInput[](INVOICES);
        bytes32[] memory hashes = new bytes32[](INVOICES);
        uint256 deadline = block.timestamp + 2 hours;
        amounts = new uint256[](INVOICES);
        for (uint256 i; i < INVOICES; ++i) {
            invs[i] = SaldaClearing.InvoiceInput({
                circleId: circleId,
                debtor: members[i % MEMBERS],
                creditor: members[(3 * i + 1) % MEMBERS],
                amount: CENT + i * 1000,
                dueDate: block.timestamp + 30 days,
                docHash: keccak256(abi.encode(keccak256(abi.encode("invoice", i)), keccak256(abi.encode(block.timestamp, i)))),
                salt: keccak256(abi.encode(block.timestamp, circleId, i)),
                deadline: deadline
            });
            amounts[i] = invs[i].amount;
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
        SaldaClearing.SignerSig[] memory sigs = new SaldaClearing.SignerSig[](MEMBERS);
        for (uint256 j; j < MEMBERS; ++j) {
            sigs[j] = SaldaClearing.SignerSig({signer: members[j], signature: _sign(keys[j], digest)});
        }
        uint256 first = salda.registerInvoices(invs, deadline, sigs);
        ids = new uint256[](INVOICES);
        for (uint256 i; i < INVOICES; ++i) {
            ids[i] = first + i;
        }
    }

    /// @dev Totals per member index, the same as the contract computes them.
    function _totals(uint256[] memory, uint256[] memory amounts)
        internal
        pure
        returns (uint256[] memory outs, uint256[] memory ins)
    {
        outs = new uint256[](MEMBERS);
        ins = new uint256[](MEMBERS);
        for (uint256 i; i < INVOICES; ++i) {
            outs[i % MEMBERS] += amounts[i];
            ins[(3 * i + 1) % MEMBERS] += amounts[i];
        }
    }

    function _fundDebtors(IFiatToken token, address funder, uint256[] memory outs, uint256[] memory ins)
        internal
        returns (uint256 total)
    {
        for (uint256 k; k < MEMBERS; ++k) {
            if (outs[k] > ins[k]) total += outs[k] - ins[k];
        }
        require(token.balanceOf(funder) >= total, "funder needs more tUSD8");
        for (uint256 k; k < MEMBERS; ++k) {
            if (outs[k] <= ins[k]) continue;
            uint256 need = outs[k] - ins[k];
            uint256 has = token.balanceOf(members[k]);
            if (has < need) require(token.transfer(members[k], need - has), "transfer failed");
        }
    }

    function _consents(
        SaldaClearing salda,
        IFiatToken token,
        SaldaClearing.RoundInput memory round,
        uint256[] memory outs,
        uint256[] memory ins
    ) internal view returns (SaldaClearing.ConsentInput[] memory consents) {
        bytes32 roundHash = salda.hashRound(round);
        consents = new SaldaClearing.ConsentInput[](MEMBERS);
        for (uint256 k; k < MEMBERS; ++k) {
            address m = members[k];
            if (outs[k] > ins[k]) {
                bytes32 nonce = keccak256(abi.encode(address(salda), roundHash, m));
                bytes32 structHash = keccak256(
                    abi.encode(RECEIVE_TYPEHASH, m, address(salda), outs[k] - ins[k], 0, round.deadline, nonce)
                );
                consents[k] = SaldaClearing.ConsentInput({
                    member: m,
                    validAfter: 0,
                    validBefore: round.deadline,
                    signature: _sign(keys[k], _digest(token.DOMAIN_SEPARATOR(), structHash))
                });
            } else {
                bytes32 structHash =
                    keccak256(abi.encode(salda.APPROVE_ROUND_TYPEHASH(), roundHash, m, outs[k], ins[k]));
                consents[k] = SaldaClearing.ConsentInput({
                    member: m,
                    validAfter: 0,
                    validBefore: 0,
                    signature: _sign(keys[k], _digest(salda.DOMAIN_SEPARATOR(), structHash))
                });
            }
        }
    }

    function _digest(bytes32 domainSeparator, bytes32 structHash) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
    }

    function _sign(uint256 key, bytes32 digest) internal pure returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        return abi.encodePacked(r, s, v);
    }
}
