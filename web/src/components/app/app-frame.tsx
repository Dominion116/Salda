"use client";

import "@rainbow-me/rainbowkit/styles.css";

import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { nameIn, SaldaProvider, useCircle, useInvoices, usePendingInvoices, useRounds, useSalda } from "@/client/provider";
import type { Address } from "@/client/types";
import { AppShell } from "@/components/layout/app-shell";
import { SkipLink } from "@/components/layout/skip-link";
import { Select } from "@/components/ui/select";
import { ToastProvider } from "@/components/ui/toast";
import { aevum, wagmiConfig, walletTheme } from "@/wallet/config";
import { NetworkBanner, WalletButton } from "@/wallet/wallet-button";

export function AppFrame({ children }: { children: ReactNode }) {
  const [queries] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } }),
  );

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queries}>
        <RainbowKitProvider theme={walletTheme} initialChain={aevum} modalSize="compact">
          <ToastProvider>
            <SaldaProvider>
              <SkipLink />
              <Frame>{children}</Frame>
            </SaldaProvider>
          </ToastProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

/** What is waiting for this business, shown as counts in the sidebar and as a list on Home. */
export function useNeeds() {
  const { me } = useSalda();
  const { data: invoices = [] } = useInvoices();
  const { data: pending = [] } = usePendingInvoices();
  const { data: rounds = [] } = useRounds();

  return {
    toCosign: pending.filter((item) => item.signedBy !== me && (item.debtor === me || item.creditor === me)),
    toVoid: invoices.filter(
      (item) => !item.voided && item.voidSignedBy !== null && item.voidSignedBy !== me && (item.debtor === me || item.creditor === me),
    ),
    toSign: rounds.filter(
      (round) =>
        round.state === "waiting-for-signatures" &&
        !round.approvedBy.includes(me) &&
        round.plan.positions.some((position) => position.member === me),
    ),
    toSettle: rounds.filter(
      (round) =>
        round.state === "waiting-for-signatures" &&
        round.plan.positions.every((position) => round.approvedBy.includes(position.member)),
    ),
  };
}

function Frame({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { client, me, setMe } = useSalda();
  const { data: circle } = useCircle();
  const needs = useNeeds();
  const nameOf = nameIn(circle);

  const item = (href: string, label: string, count?: number) => ({
    href,
    label,
    count,
    current: href === "/app" ? path === href : path.startsWith(href),
  });

  return (
    <AppShell
      fill
      mode={client.mode}
      title={circle ? (circle.name.status === "verified" ? circle.name.value : "Unverified name") : "Loading…"}
      nav={[
        item("/app", "Home"),
        item("/app/invoices", "Invoices", needs.toCosign.length + needs.toVoid.length),
        item("/app/rounds", "Rounds", needs.toSign.length + needs.toSettle.length),
        item("/app/receipts", "Receipts"),
        item("/app/mandate", "Mandate"),
        item("/app/agent", "Agent"),
        item("/app/circle", "Circle"),
      ]}
      secondary={[item("/app/settings", "Settings")]}
      banner={<NetworkBanner />}
      actions={
        <>
          {client.mode === "sample" && circle ? (
            <Select
              compact
              label="Viewing as"
              value={me}
              onChange={(event) => setMe(event.currentTarget.value as Address)}
              options={circle.members.map((member) => ({ value: member.address, label: nameOf(member.address) }))}
            />
          ) : null}
          <WalletButton />
        </>
      }
    >
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-page p-4 sm:p-6">
        {children}
      </main>
    </AppShell>
  );
}
