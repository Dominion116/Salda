"use client";

import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { messageOf } from "@/client/provider";
import type { Address, Invoice, Round } from "@/client/types";
import { Button, IconButton } from "@/components/ui/button";
import { Badge, ErrorState, LoadingRows } from "@/components/ui/data";
import { CopyIcon, InvoiceIcon } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";
import { shortAddress } from "@/lib/format";

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 pb-6">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-title wrap-anywhere text-ink-strong">{title}</h1>
        {description ? <p className="max-w-[64ch] text-body-sm text-pretty text-ink-subtle">{description}</p> : null}
      </div>
      {action ? <div className="flex flex-wrap gap-2">{action}</div> : null}
    </div>
  );
}

/** Shows loading or the error with a retry, and the content only once its data is here. */
export function Loaded<T>({
  query,
  what,
  children,
}: {
  query: UseQueryResult<T>;
  /** Fills "Loading …" and "Unable to load …". */
  what: string;
  children: (data: T) => ReactNode;
}) {
  if (query.data !== undefined) return children(query.data);
  if (query.isError) {
    return (
      <ErrorState
        title={`Unable to load ${what}`}
        action={
          <Button icon={<InvoiceIcon />} loading={query.isFetching} onClick={() => void query.refetch()}>
            Try again
          </Button>
        }
      >
        {messageOf(query.error)}
      </ErrorState>
    );
  }
  return <LoadingRows label={`Loading ${what}…`} />;
}

export function KeyValues({ rows }: { rows: readonly (readonly [string, ReactNode])[] }) {
  return (
    <dl className="rounded-lg border border-hairline bg-canvas">
      {rows.map(([label, value]) => (
        <div
          key={label}
          className="flex min-h-10 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-hairline px-3 py-2 text-body-sm first:border-t-0"
        >
          <dt className="text-ink-subtle">{label}</dt>
          <dd className="min-w-0 text-end wrap-anywhere text-ink-strong tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function AddressText({ address }: { address: Address }) {
  const show = useToast();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      show({ tone: "success", message: "Address copied" });
    } catch {
      show({ tone: "error", message: "Unable to copy the address. Select it and copy it instead." });
    }
  };
  return (
    <span className="inline-flex items-center gap-1">
      <span className="font-mono text-mono text-ink-subtle" title={address}>
        {shortAddress(address)}
      </span>
      <IconButton label={`Copy address ${address}`} onClick={copy}>
        <CopyIcon />
      </IconButton>
    </span>
  );
}

export const leftOf = (invoice: Invoice) => invoice.amount - invoice.cleared;
export const isOpen = (invoice: Invoice) => !invoice.voided && leftOf(invoice) > 0n;

export function InvoiceBadge({ invoice }: { invoice: Invoice }) {
  if (invoice.voided) return <Badge>Voided</Badge>;
  if (leftOf(invoice) === 0n) return <Badge tone="success">Cleared</Badge>;
  if (invoice.voidSignedBy) return <Badge tone="warning">Void requested</Badge>;
  if (invoice.dueDate < Date.now() / 1000) return <Badge tone="danger">Overdue</Badge>;
  if (invoice.cleared > 0n) return <Badge tone="info">Partly cleared</Badge>;
  return <Badge>Open</Badge>;
}

export function RoundBadge({ round }: { round: Round }) {
  switch (round.state) {
    case "waiting-for-signatures":
      return (
        <Badge tone="warning">
          {round.approvedBy.length} of {round.plan.positions.length} signed
        </Badge>
      );
    case "submitting":
      return <Badge tone="info">Submitting</Badge>;
    case "pending":
      return <Badge tone="info">Still confirming</Badge>;
    case "confirmed":
      return <Badge tone="success">Settled</Badge>;
    case "failed":
      return <Badge tone="danger">Failed</Badge>;
  }
}
