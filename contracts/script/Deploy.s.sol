// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {IAgentRegistry, IUSD8, SaldaClearing} from "../src/SaldaClearing.sol";

/// @notice Deploys SaldaClearing on Aevum testnet against the real tUSD8.
///
///         forge script script/Deploy.s.sol --rpc-url aevum --legacy --broadcast
///
///         Needs PRIVATE_KEY. AGENT_REGISTRY is optional: leave it unset (agent identity checks off) until QDay
///         confirms which ERC-8004 registry to use. Publish the printed address, block and this commit's SHA.
contract Deploy is Script {
    address internal constant TUSD8 = 0x456569838f1d43009A91ebA4263147Afd7233483;

    function run() external returns (SaldaClearing salda) {
        require(block.chainid == 44005, "run with --rpc-url aevum");
        address registry = vm.envOr("AGENT_REGISTRY", address(0));
        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));
        salda = new SaldaClearing(IUSD8(TUSD8), IAgentRegistry(registry));
        vm.stopBroadcast();
        console2.log("NEXT_PUBLIC_SALDA_ADDRESS=", address(salda));
        console2.log("Deployed at block", block.number);
        console2.log("Agent registry (0 = off):", registry);
    }
}
