# Third-party notices

Salda builds on the open-source projects below. Their code keeps its own license.

## Adapted code

| Source | License | What Salda adapted |
|---|---|---|
| [qday-io/aevum-starter-kit](https://github.com/qday-io/aevum-starter-kit) (PQA Labs) | MIT | `contracts/foundry.toml`, `contracts/src/mocks/MockUSD8.sol`, `contracts/test/fork/AevumFork.t.sol`, `tools/check-shanghai.mjs`, and the relayer rails and error wording in `web/src/server/chain.ts` and `web/src/lib/explain.ts`. Adapted files say so in their header. |

## Solidity libraries (`contracts/lib`, git submodules)

| Project | Version | License |
|---|---|---|
| [forge-std](https://github.com/foundry-rs/forge-std) | v1.17.0 | MIT or Apache-2.0 |
| [OpenZeppelin Contracts](https://github.com/OpenZeppelin/openzeppelin-contracts) | v5.1.0 | MIT |

## JavaScript packages (direct dependencies of `web/`)

| Package | Version | License |
|---|---|---|
| next | 16.2.6 | MIT |
| react, react-dom | 19.2.5 | MIT |
| @rainbow-me/rainbowkit | 2.2.11 | MIT |
| wagmi | 2.19.5 | MIT |
| viem | 2.57.16 | MIT |
| @tanstack/react-query | 5.106.0 | MIT |
| tailwindcss, @tailwindcss/postcss | 4.2.2 | MIT |
| typescript | 5.9.3 | Apache-2.0 |

Their own dependencies carry their own licenses. Run `npx license-checker --summary` in `web/` to list them.

## Research

Clearing debt in cycles builds on published work, including the Cycles Protocol paper (Informal Systems, arXiv:2507.22309).
