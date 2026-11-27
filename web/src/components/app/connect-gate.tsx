"use client";

import Link from "next/link";
import type { GateReason } from "@/client/provider";
import { SaldaLogo } from "@/components/brand";
import { container } from "@/components/layout/container";
import { SkipLink } from "@/components/layout/skip-link";
import { buttonClass } from "@/components/ui/button-class";
import { SpinnerIcon } from "@/components/ui/icons";
import { cx } from "@/lib/cx";
import { aevum } from "@/wallet/config";
import { NetworkBanner, WalletButton } from "@/wallet/wallet-button";

const copy: Record<Exclude<GateReason, "loading">, { title: string; body: string }> = {
  connect: {
    title: "Connect your wallet",
    body: `Salda works with your own wallet on the ${aevum.name}. Your wallet signs for your business; Salda pays the network fees.`,
  },
  "wrong-network": {
    title: `Switch to the ${aevum.name}`,
    body: "Your wallet is on another network. Use the button above to switch, and your wallet adds the network if it needs to.",
  },
  "not-deployed": {
    title: "Salda isn’t connected here yet",
    body: "This copy of the app has no contract address set. You can still try everything in the demo.",
  },
};

/** What the app shows until it can show live data: no sample data here, it lives in /demo. */
export function ConnectGate({ reason }: { reason: GateReason }) {
  return (
    <div className="min-h-dvh bg-surface">
      <SkipLink />
      <header className="border-b border-hairline bg-canvas">
        <div className={cx(container, "flex min-h-14 items-center justify-between gap-3 py-2")}>
          <Link href="/" className="hit-44 flex items-center">
            <SaldaLogo priority />
          </Link>
          {reason === "not-deployed" ? null : <WalletButton />}
        </div>
      </header>
      <NetworkBanner />
      <main id="main" tabIndex={-1} className={cx(container, "flex justify-center py-16 lg:py-24")}>
        {reason === "loading" ? (
          <p role="status" className="flex items-center gap-2 text-body text-ink">
            <SpinnerIcon className="shrink-0" />
            Loading your circles…
          </p>
        ) : (
          <div className="flex w-full max-w-modal flex-col items-start gap-6 rounded-2xl bg-canvas p-6 shadow-ring sm:p-8">
            <div className="flex flex-col gap-2">
              <h1 className="text-headline text-balance text-ink-strong">{copy[reason].title}</h1>
              <p className="text-body text-pretty text-ink">{copy[reason].body}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {reason === "connect" ? <WalletButton primary /> : null}
              <Link href="/demo" className={buttonClass({ size: "lg", variant: reason === "connect" ? "ghost" : "primary" })}>
                Try the demo instead
              </Link>
            </div>
            <p className="text-caption text-ink-subtle">
              The demo shows every step with sample data and needs no wallet.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
