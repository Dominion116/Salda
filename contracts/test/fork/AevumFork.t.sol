// SPDX-License-Identifier: MIT
// Adapted from qday-io/aevum-starter-kit (MIT, PQA Labs).
pragma solidity 0.8.24;

import {console2} from "forge-std/console2.sol";
import {IAgentRegistry, IUSD8, SaldaClearing} from "../../src/SaldaClearing.sol";
import {MockUSD8} from "../../src/mocks/MockUSD8.sol";
import {SaldaBase} from "../SaldaBase.sol";

interface IFiatToken {
    function DOMAIN_SEPARATOR() external view returns (bytes32);
    function paused() external view returns (bool);
    function isBlacklisted(address) external view returns (bool);
    function balanceOf(address) external view returns (uint256);
}

/// @notice Runs SaldaClearing against the REAL tUSD8 on a local fork of Aevum testnet. No funds needed: `deal`
///         writes balances into the fork only. Skipped unless run on a fork:
///         forge test --match-path 'test/fork/*' --fork-url aevum
contract AevumForkTest is SaldaBase {
    address internal constant TUSD8 = 0x456569838f1d43009A91ebA4263147Afd7233483;
    uint256 internal constant CENT = 1e4; // 0.01 tUSD8

    function setUp() public override {
        if (block.chainid != 44005) vm.skip(true);
        usd = MockUSD8(TUSD8); // only DOMAIN_SEPARATOR and balanceOf are called on it here
        salda = new SaldaClearing(IUSD8(TUSD8), IAgentRegistry(address(0)));
        admin = _person("admin");
    }

    function test_fork_tusd8DomainMatches() public view {
        bytes32 expected = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("tUSD8"),
                keccak256("2"),
                uint256(44005),
                TUSD8
            )
        );
        assertEq(IFiatToken(TUSD8).DOMAIN_SEPARATOR(), expected);
        assertFalse(IFiatToken(TUSD8).paused());
    }

    /// The judge sandbox at 1/100 scale: 0.15 cleared with 0.02, using real tUSD8 EIP-3009.
    function test_fork_sandboxRound_realTusd8() public {
        (address ada, address ben, address chidi, uint256 circleId) = _three();
        uint256 a = _register(_inv(circleId, ada, ben, 6 * CENT));
        uint256 b = _register(_inv(circleId, ben, chidi, 5 * CENT));
        uint256 c = _register(_inv(circleId, chidi, ada, 4 * CENT));
        deal(TUSD8, ada, 2 * CENT);

        _settle(_round(circleId, _ids(a, b, c), _ids(6 * CENT, 5 * CENT, 4 * CENT)));

        assertEq(IFiatToken(TUSD8).balanceOf(ada), 0);
        assertEq(IFiatToken(TUSD8).balanceOf(ben), 1 * CENT);
        assertEq(IFiatToken(TUSD8).balanceOf(chidi), 1 * CENT);
        assertEq(IFiatToken(TUSD8).balanceOf(address(salda)), 0);
    }

    /// 10 members and 30 invoices against real tUSD8, the same shape as the live check.
    function test_fork_maximumSizeRound_realTusd8() public {
        address[] memory members = _people(10);
        uint256 circleId = _circle(members);
        SaldaClearing.InvoiceInput[] memory invs = new SaldaClearing.InvoiceInput[](30);
        uint256[] memory ids = new uint256[](30);
        uint256[] memory amounts = new uint256[](30);
        for (uint256 i; i < 30; ++i) {
            invs[i] = _inv(circleId, members[i % 10], members[(3 * i + 1) % 10], CENT + i * 1000);
            amounts[i] = invs[i].amount;
        }
        uint256 deadline = block.timestamp + 1 hours;
        SaldaClearing.SignerSig[] memory sigs = _batchSigs(_batchDigest(invs, deadline), members);
        uint256 first = salda.registerInvoices(invs, deadline, sigs);
        for (uint256 i; i < 30; ++i) {
            ids[i] = first + i;
        }

        SaldaClearing.RoundInput memory round = _round(circleId, ids, amounts);
        (address[] memory touched, uint256[] memory outs, uint256[] memory ins) = _totals(round);
        for (uint256 k; k < touched.length; ++k) {
            if (outs[k] > ins[k]) deal(TUSD8, touched[k], outs[k] - ins[k]);
        }
        SaldaClearing.ConsentInput[] memory consents = _consents(round);
        uint256 before = gasleft();
        salda.settle(round, consents, noApprovals);
        console2.log("fork settle gas, 10 members / 30 invoices, real tUSD8:", before - gasleft());

        assertEq(IFiatToken(TUSD8).balanceOf(address(salda)), 0);
        for (uint256 k; k < touched.length; ++k) {
            assertEq(IFiatToken(TUSD8).balanceOf(touched[k]), ins[k] > outs[k] ? ins[k] - outs[k] : 0);
        }
    }
}
