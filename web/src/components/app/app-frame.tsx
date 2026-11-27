"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { SaldaProvider, useCircle, useInvoices, usePendingInvoices, useRounds, useSalda } from "@/client/provider";
import { ConnectGate } from "@/components/app/connect-gate";
import { NoCircle } from "@/components/app/no-circle";
import { AppShell } from "@/components/layout/app-shell";
import { container, pageY } from "@/components/layout/container";
import { SkipLink } from "@/components/layout/skip-link";
import { cx } from "@/lib/cx";
import { WalletProviders } from "@/wallet/providers";
import { NetworkBanner, WalletButton } from "@/wallet/wallet-button";

/** The app: live data only. Until a wallet is connected on Aevum, it shows the connect screen instead. */
export function AppFrame({ children }: { children: ReactNode }) {
  return (
    <WalletProviders>
      <SaldaProvider gate={(reason) => <ConnectGate reason={reason} />}>
        <SkipLink />
        <Frame>{children}</Frame>
      </SaldaProvider>
    </WalletProviders>
  );
}

/** What is waiting for this business, shown as counts in the sidebar and as a list on Home. */
export function useNeeds() {
  const { me } = useSalda();
  const { data: invoices = [] } = useInvoices();
  const { data: pending = [] } = usePendingInvoices();
  const { data: rounds = [] } = useRounds();
  const is = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

  return {
    toCosign: pending.filter((item) => !is(item.signedBy, me) && (is(item.debtor, me) || is(item.creditor, me))),
    toVoid: invoices.filter(
      (item) =>
        !item.voided && item.voidSignedBy !== null && !is(item.voidSignedBy, me) && (is(item.debtor, me) || is(item.creditor, me)),
    ),
    toSign: rounds.filter(
      (round) =>
        round.state === "waiting-for-signatures" &&
        !round.approvedBy.some((member) => is(member, me)) &&
        round.plan.positions.some((position) => is(position.member, me)),
    ),
    toSettle: rounds.filter(
      (round) =>
        round.state === "waiting-for-signatures" &&
        round.plan.positions.every((position) => round.approvedBy.some((member) => is(member, position.member))),
    ),
  };
}

function Frame({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { circleId } = useSalda();
  const { data: circle } = useCircle();
  const needs = useNeeds();
  // Not in a circle yet: only Circle (to create one) and Settings make sense; everything else explains that.
  const needsCircle = circleId === 0n && !path.startsWith("/app/circle") && !path.startsWith("/app/settings");

  const item = (href: string, label: string, count?: number) => ({
    href,
    label,
    count,
    current: href === "/app" ? path === href : path.startsWith(href),
  });

  return (
    <AppShell
      fill
      title={
        circle
          ? circle.name.status === "verified"
            ? circle.name.value
            : "Unverified name"
          : circleId === 0n
            ? "No circle yet"
            : "Loading…"
      }
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
      actions={<WalletButton />}
    >
      <main id="main" tabIndex={-1} className={cx(container, pageY)}>
        {needsCircle ? <NoCircle /> : children}
      </main>
    </AppShell>
  );
}
