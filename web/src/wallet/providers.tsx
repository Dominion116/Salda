"use client";

import "@rainbow-me/rainbowkit/styles.css";

import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { ToastProvider } from "@/components/ui/toast";
import { aevum, wagmiConfig, walletTheme } from "./config";

/** Wallet connection, data fetching and toasts, shared by /app and /demo. */
export function WalletProviders({ children }: { children: ReactNode }) {
  const [queries] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } }),
  );

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queries}>
        <RainbowKitProvider theme={walletTheme} initialChain={aevum} modalSize="compact">
          <ToastProvider>{children}</ToastProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
