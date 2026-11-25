"use client";

import Link from "next/link";
import { useMemo } from "react";
import { messageOf, nameIn, useCashLimits, useCircle, useInvoices, usePlan, useSalda } from "@/client/provider";
import type { Invoice } from "@/client/types";
import { useNeeds } from "@/components/app/app-frame";
import { isOpen, leftOf, Loaded, PageHeader } from "@/components/app/parts";
import { InvoiceRow } from "@/components/app/screens/invoices";
import { buttonClass } from "@/components/ui/button-class";
import { Amount, EmptyState, Panel } from "@/components/ui/data";
import { formatAmount } from "@/lib/money";

const sum = (invoices: readonly Invoice[]) => invoices.reduce((total, invoice) => total + leftOf(invoice), 0n);

export function HomeScreen() {
  const { me } = useSalda();
  const circle = useCircle();
  const invoices = useInvoices();
  const nameOf = nameIn(circle.data);

  return (
    <>
      <PageHeader
        title={circle.data ? nameOf(me) : "Home"}
        description="What you owe, what you are owed, and what can clear now."
        action={
          <Link href="/app/rounds/new" className={buttonClass({ variant: "primary" })}>
            Plan a round
          </Link>
        }
      />
      <Loaded query={invoices} what="your invoices">
        {(all) => {
          const open = all.filter(isOpen);
          const owe = open.filter((invoice) => invoice.debtor === me);
          const owed = open.filter((invoice) => invoice.creditor === me);
          const mine = [...owe, ...owed];
          return (
            <div className="flex flex-col gap-6">
              <dl className="grid gap-px overflow-hidden rounded-lg border border-hairline bg-hairline sm:grid-cols-2 xl:grid-cols-4">
                <Stat label="You owe" value={sum(owe)} note={count(owe.length, "open invoice")} />
                <Stat label="Owed to you" value={sum(owed)} note={count(owed.length, "open invoice")} />
                <Clearable />
                <NextRound />
              </dl>
              <NeedsYou />
              <Panel
                heading="h2"
                title="Your open invoices"
                action={
                  <Link href="/app/invoices" className={buttonClass({ variant: "link" })}>
                    View all invoices
                  </Link>
                }
              >
                {mine.length === 0 ? (
                  <EmptyState
                    title="You have no open invoices"
                    action={
                      <Link href="/app/invoices/new" className={buttonClass()}>
                        Add an invoice
                      </Link>
                    }
                  >
                    Add one you owe or are owed, then ask the other business to sign it.
                  </EmptyState>
                ) : (
                  <ul className="rounded-lg border border-hairline">
                    {mine.slice(0, 5).map((invoice) => (
                      <InvoiceRow key={`${invoice.id}`} invoice={invoice} nameOf={nameOf} />
                    ))}
                  </ul>
                )}
              </Panel>
            </div>
          );
        }}
      </Loaded>
    </>
  );
}

const count = (amount: number, noun: string) => `${amount} ${noun}${amount === 1 ? "" : "s"}`;

function Stat({ label, value, note }: { label: string; value: bigint; note: string }) {
  return (
    <div className="flex flex-col gap-1 bg-canvas p-4 sm:p-5">
      <dt className="text-label text-ink-subtle">{label}</dt>
      <dd className="text-numeric text-ink-strong tabular-nums">{formatAmount(value)}</dd>
      <dd className="text-caption text-ink-subtle">{note} · tUSD8</dd>
    </div>
  );
}

/** Uses the cash each member has offered so far. */
function Clearable() {
  const limits = useCashLimits();
  const cash = useMemo(() => new Map((limits.data ?? []).map((limit) => [limit.member, limit.amount])), [limits.data]);
  const plan = usePlan(cash);

  if (plan.data && !plan.isError) {
    return (
      <Stat
        label="Can clear now, for the group"
        value={plan.data.gross}
        note={plan.data.cash === 0n ? "With no cash" : `With ${formatAmount(plan.data.cash)} cash`}
      />
    );
  }
  return (
    <div className="flex flex-col gap-1 bg-canvas p-4 sm:p-5">
      <dt className="text-label text-ink-subtle">Can clear now, for the group</dt>
      <dd className="text-body-sm text-ink">{plan.isError ? messageOf(plan.error) : "Working it out…"}</dd>
    </div>
  );
}

function NextRound() {
  const { toSign, toSettle } = useNeeds();
  const next = toSettle[0] ?? toSign[0];
  return (
    <div className="flex flex-col gap-1 bg-canvas p-4 sm:p-5">
      <dt className="text-label text-ink-subtle">Next round</dt>
      {next ? (
        <>
          <dd className="text-numeric text-ink-strong tabular-nums">{formatAmount(next.plan.gross)}</dd>
          <dd className="text-caption text-ink-subtle">
            {toSettle[0] ? "Everyone has signed" : "Waiting for your signature"} · tUSD8
          </dd>
        </>
      ) : (
        <dd className="text-body-sm text-ink">No round is waiting for you.</dd>
      )}
    </div>
  );
}

function NeedsYou() {
  const { data: circle } = useCircle();
  const { me } = useSalda();
  const { toCosign, toVoid, toSign, toSettle } = useNeeds();
  const nameOf = nameIn(circle);

  const items = [
    ...toSettle.map((round) => ({ key: `settle-${round.key}`, href: `/app/rounds/${round.key}`, text: "A round is fully signed and ready to settle", amount: round.plan.gross })),
    ...toSign.map((round) => ({ key: `sign-${round.key}`, href: `/app/rounds/${round.key}`, text: "A clearing round needs your signature", amount: round.plan.gross })),
    ...toCosign.map((item) => ({ key: item.key, href: `/app/invoices/sign/${item.key}`, text: `${nameOf(item.signedBy)} sent you an invoice to sign`, amount: item.amount })),
    ...toVoid.map((invoice) => ({ key: `void-${invoice.id}`, href: `/app/invoices/${invoice.id}`, text: `${nameOf(invoice.debtor === me ? invoice.creditor : invoice.debtor)} asked to void an invoice`, amount: leftOf(invoice) })),
  ];
  if (items.length === 0) return null;

  return (
    <Panel heading="h2" title="Needs you">
      <ul className="rounded-lg border border-hairline">
        {items.map((item) => (
          <li key={item.key} className="border-t border-hairline first:border-t-0">
            <Link
              href={item.href}
              className="flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2 text-body-sm text-ink-strong -outline-offset-2 hover:bg-surface"
            >
              {item.text}
              <Amount value={formatAmount(item.amount)} />
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
