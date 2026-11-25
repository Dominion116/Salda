"use client";

import { connectorsForWallets, lightTheme, type Theme } from "@rainbow-me/rainbowkit";
import { injectedWallet, metaMaskWallet, rabbyWallet, walletConnectWallet } from "@rainbow-me/rainbowkit/wallets";
import { defineChain } from "viem";
import { createConfig, http } from "wagmi";

export const EXPLORER = "https://explorer-test.qday.info";
export const TUSD8 = "0x456569838f1d43009A91ebA4263147Afd7233483";

export const aevum = defineChain({
  id: 44005,
  name: "QDay Aevum Testnet",
  nativeCurrency: { name: "tQDAY", symbol: "tQDAY", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc-test.qday.info"] } },
  blockExplorers: { default: { name: "Aevum explorer", url: EXPLORER } },
  contracts: { multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" } },
  testnet: true,
});

// Mobile wallets connect through WalletConnect, which needs a free project ID.
// Without one, only wallets installed in the browser are offered.
const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID ?? "";
export const hasMobileWallets = projectId !== "";

const connectors = connectorsForWallets(
  [
    {
      groupName: "Wallets",
      wallets: hasMobileWallets
        ? [metaMaskWallet, rabbyWallet, walletConnectWallet, injectedWallet]
        : [injectedWallet, rabbyWallet],
    },
  ],
  { appName: "Salda", projectId: projectId || "not-set" },
);

export const wagmiConfig = createConfig({
  chains: [aevum],
  connectors,
  transports: { [aevum.id]: http() },
  ssr: true,
});

const base = lightTheme({
  accentColor: "var(--color-primary)",
  accentColorForeground: "var(--color-on-primary)",
  overlayBlur: "small",
});

/** RainbowKit drawn with Salda’s tokens. */
export const walletTheme: Theme = {
  ...base,
  fonts: { body: "var(--font-inter), ui-sans-serif, system-ui, sans-serif" },
  radii: {
    actionButton: "var(--radius-control)",
    connectButton: "var(--radius-control)",
    menuButton: "var(--radius-md)",
    modal: "var(--radius-xl)",
    modalMobile: "var(--radius-2xl)",
  },
  shadows: { ...base.shadows, dialog: "var(--shadow-lg)", profileDetailsAction: "none", selectedOption: "none", selectedWallet: "none" },
  colors: {
    ...base.colors,
    modalBackground: "var(--color-canvas)",
    modalBackdrop: "var(--scrim)",
    modalBorder: "var(--color-hairline)",
    modalText: "var(--color-ink-strong)",
    modalTextDim: "var(--color-ink-subtle)",
    modalTextSecondary: "var(--color-ink-subtle)",
    generalBorder: "var(--color-hairline)",
    generalBorderDim: "var(--color-hairline)",
    menuItemBackground: "var(--color-surface-2)",
    profileForeground: "var(--color-canvas)",
    profileAction: "var(--color-surface-2)",
    profileActionHover: "var(--color-hairline)",
    closeButton: "var(--color-ink)",
    closeButtonBackground: "var(--color-surface-2)",
    actionButtonBorder: "var(--color-hairline)",
    actionButtonSecondaryBackground: "var(--color-surface-2)",
    downloadBottomCardBackground: "var(--color-surface)",
    downloadTopCardBackground: "var(--color-surface)",
    selectedOptionBorder: "var(--color-hairline)",
    error: "var(--color-danger)",
    standby: "var(--color-ink-subtle)",
    connectionIndicator: "var(--color-success)",
  },
};
