"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  nameIn,
  useChange,
  useCircle,
  useInvoices,
  usePendingInvoices,
  useSalda,
  type NameOf,
} from "@/client/provider";
import type { Address, Circle, Hex, Invoice } from "@/client/types";
import { AddressText, InvoiceBadge, isOpen, KeyValues, leftOf, Loaded, PageHeader } from "@/components/app/parts";
import { Button } from "@/components/ui/button";
import { buttonClass } from "@/components/ui/button-class";
import { Amount, Badge, EmptyState, Panel } from "@/components/ui/data";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { AlertIcon, SignIcon } from "@/components/ui/icons";
import { ChoiceGroup, Radio, Segmented } from "@/components/ui/selection";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { dateFieldValue, endOfDay, formatDate } from "@/lib/format";
import { formatAmount, parseAmount } from "@/lib/money";

export function InvoiceRow({ invoice, nameOf }: { invoice: Invoice; nameOf: NameOf }) {
  return (
    <li className="border-t border-hairline first:border-t-0">
      <Link
        href={`/app/invoices/${invoice.id}`}
        className="grid min-h-11 grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-3 py-2 text-body-sm -outline-offset-2 hover:bg-surface sm:grid-cols-[4rem_1fr_7rem_7rem_7rem]"
      >
        <span className="font-mono text-mono text-ink-subtle max-sm:hidden">#{`${invoice.id}`}</span>
        <span className="min-w-0 text-ink">
          <span className="text-ink-strong">{nameOf(invoice.debtor)}</span> owes {nameOf(invoice.creditor)}
        </span>
        <span className="text-end sm:order-last">
          <Amount value={formatAmount(invoice.voided ? invoice.amount : leftOf(invoice))} />
        </span>
        <span>
          <InvoiceBadge invoice={invoice} />
        </span>
        <span className="text-end text-caption text-ink-subtle sm:text-start">Due {formatDate(invoice.dueDate)}</span>
      </Link>
    </li>
  );
}

const FILTERS = ["All", "You owe", "Owed to you", "Closed"] as const;

export function InvoicesScreen() {
  const { me } = useSalda();
  const circle = useCircle();
  const invoices = useInvoices();
  const [filter, setFilter] = useState<string>(FILTERS[0]);
  const nameOf = nameIn(circle.data);

  const add = (
    <Link href="/app/invoices/new" className={buttonClass({ variant: "primary" })}>
      Add an invoice
    </Link>
  );

  return (
    <>
      <PageHeader title="Invoices" description="An invoice counts only when both businesses have signed it." action={add} />
      <div className="flex flex-col gap-6">
        <Waiting nameOf={nameOf} />
        <div className="max-w-full overflow-x-auto">
          <Segmented legend="Show" options={FILTERS} value={filter} onValueChange={setFilter} />
        </div>
        <Loaded query={invoices} what="invoices">
          {(all) => {
            const shown = all.filter((invoice) => {
              if (filter === "You owe") return isOpen(invoice) && invoice.debtor === me;
              if (filter === "Owed to you") return isOpen(invoice) && invoice.creditor === me;
              if (filter === "Closed") return !isOpen(invoice);
              return true;
            });
            return shown.length === 0 ? (
              <EmptyState
                title={all.length === 0 ? "You haven’t added an invoice yet" : `Nothing under “${filter}”`}
                action={
                  all.length === 0 ? add : <Button onClick={() => setFilter("All")}>Show all invoices</Button>
                }
              >
                {all.length === 0
                  ? "Add one you owe or are owed, then ask the other business to sign it."
                  : "Choose another filter to see the rest."}
              </EmptyState>
            ) : (
              <ul className="rounded-lg border border-hairline">
                {shown.map((invoice) => (
                  <InvoiceRow key={`${invoice.id}`} invoice={invoice} nameOf={nameOf} />
                ))}
              </ul>
            );
          }}
        </Loaded>
      </div>
    </>
  );
}

function Waiting({ nameOf }: { nameOf: NameOf }) {
  const { me } = useSalda();
  const { data: pending = [] } = usePendingInvoices();
  const mine = pending.filter((item) => item.debtor === me || item.creditor === me);
  if (mine.length === 0) return null;

  return (
    <Panel heading="h2" title="Waiting for a signature">
      <ul className="rounded-lg border border-hairline">
        {mine.map((item) => (
          <li key={item.key} className="border-t border-hairline first:border-t-0">
            <Link
              href={`/app/invoices/sign/${item.key}`}
              className="flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2 text-body-sm -outline-offset-2 hover:bg-surface"
            >
              <span>
                <span className="text-ink-strong">{nameOf(item.debtor)}</span> owes {nameOf(item.creditor)}
              </span>
              <span className="flex items-center gap-3">
                <Badge tone="warning">{item.signedBy === me ? "Waiting for them" : "Needs you"}</Badge>
                <Amount value={formatAmount(item.amount)} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

const toHex = (bytes: ArrayBuffer): Hex =>
  `0x${[...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;

/** Hashes on this device with a random salt. The file itself never leaves it. */
async function saltedHash(file: File | null): Promise<Hex> {
  const salt = crypto.getRandomValues(new Uint8Array(32));
  const content = file ? new Uint8Array(await file.arrayBuffer()) : new Uint8Array();
  const input = new Uint8Array(salt.length + content.length);
  input.set(salt);
  input.set(content, salt.length);
  return toHex(await crypto.subtle.digest("SHA-256", input));
}

export function NewInvoiceScreen() {
  const circle = useCircle();
  return (
    <>
      <PageHeader title="Add an invoice" description="You sign first. The other business then reviews and signs it." />
      <Loaded query={circle} what="your circle">
        {(data) => <NewInvoiceForm key={`${data.id}`} circle={data} />}
      </Loaded>
    </>
  );
}

function NewInvoiceForm({ circle }: { circle: Circle }) {
  const router = useRouter();
  const { me, circleId } = useSalda();
  const others = circle.members.filter((member) => member.active && member.address !== me);
  const nameOf = nameIn(circle);
  const [direction, setDirection] = useState<"owe" | "owed">("owe");
  const [other, setOther] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [due, setDue] = useState(() => dateFieldValue(14));
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<{ other?: string; amount?: string; due?: string }>({});
  const propose = useChange(
    (client, draft: Parameters<typeof client.proposeInvoice>[0]) => client.proposeInvoice(draft, me),
    "Invoice signed. Now the other business needs to sign it.",
  );

  // Switching "Viewing as" can make the chosen business yourself.
  const chosen = others.find((member) => member.address === other)?.address;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const units = parseAmount(amount);
    const dueDate = endOfDay(due);
    const found = {
      other: chosen ? undefined : "Choose a business.",
      amount: units && units > 0n ? undefined : "Enter an amount above 0, with up to 6 decimals.",
      due: dueDate === null ? "Enter a due date." : undefined,
    };
    setErrors(found);
    if (!chosen || !units || units <= 0n || dueDate === null) {
      requestAnimationFrame(() => form.querySelector<HTMLElement>("[aria-invalid=true]")?.focus());
      return;
    }
    const created = await propose.run({
      circleId,
      debtor: direction === "owe" ? me : chosen,
      creditor: direction === "owe" ? chosen : me,
      amount: units,
      dueDate,
      docHash: await saltedHash(file),
    });
    if (created) router.push(`/app/invoices/sign/${created.key}`);
  };

  if (others.length === 0) {
    return (
      <EmptyState
        title="You are the only active member"
        action={
          <Link href="/app/circle" className={buttonClass()}>
            Add a member
          </Link>
        }
      >
        Invoices are between two members of the same circle.
      </EmptyState>
    );
  }

  return (
    <form noValidate onSubmit={submit} className="flex max-w-modal flex-col gap-6">
      <ChoiceGroup legend="Which way does it run?">
        <Radio name="direction" label="I owe them" checked={direction === "owe"} onChange={() => setDirection("owe")} />
        <Radio name="direction" label="They owe me" checked={direction === "owed"} onChange={() => setDirection("owed")} />
      </ChoiceGroup>
      <Select
        label="Other business"
        value={chosen ?? ""}
        onChange={(event) => setOther(event.currentTarget.value)}
        error={errors.other}
        options={[
          { value: "", label: "Choose a business" },
          ...others.map((member) => ({ value: member.address, label: nameOf(member.address) })),
        ]}
      />
      <Field
        label="Amount"
        inputMode="decimal"
        autoComplete="off"
        numeric
        suffix="tUSD8"
        value={amount}
        error={errors.amount}
        onChange={(event) => setAmount(event.currentTarget.value)}
      />
      <Field label="Due date" type="date" autoComplete="off" value={due} error={errors.due} onChange={(event) => setDue(event.currentTarget.value)} />
      <Field
        label="Invoice document, optional"
        type="file"
        help="Hashed on your device. The file is never uploaded."
        onChange={(event) => setFile(event.currentTarget.files?.[0] ?? null)}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="primary" size="lg" icon={<SignIcon />} loading={propose.busy}>
          Sign invoice
        </Button>
        <Link href="/app/invoices" className={buttonClass({ variant: "ghost", size: "lg" })}>
          Cancel
        </Link>
      </div>
    </form>
  );
}

export function CosignScreen() {
  const { key } = useParams<{ key: string }>();
  const router = useRouter();
  const { me, client } = useSalda();
  const circle = useCircle();
  const pending = usePendingInvoices();
  const show = useToast();
  const nameOf = nameIn(circle.data);
  const sign = useChange((client) => client.cosignInvoice(key, me), "Invoice signed by both businesses");

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      show({ tone: "success", message: "Link copied" });
    } catch {
      show({ tone: "error", message: "Unable to copy. Copy the address from your browser instead." });
    }
  };

  return (
    <Loaded query={pending} what="this invoice">
      {(all) => {
        const item = all.find((candidate) => candidate.key === key);
        if (!item) {
          return (
            <EmptyState
              title="This invoice isn’t waiting for a signature"
              action={
                <Link href="/app/invoices" className={buttonClass()}>
                  View invoices
                </Link>
              }
            >
              It may already be signed, or its time ran out. Sample links work only in the tab that made them.
            </EmptyState>
          );
        }
        const other = item.signedBy === item.debtor ? item.creditor : item.debtor;
        const canSign = me === other;
        return (
          <>
            <PageHeader
              title={canSign ? "Review and sign this invoice" : "Waiting for a signature"}
              description={
                canSign
                  ? `${nameOf(item.signedBy)} has signed. It counts once you sign too.`
                  : me === item.signedBy
                    ? `Send this page’s link to ${nameOf(other)}.`
                    : "Only the two businesses on this invoice can sign it."
              }
            />
            <div className="flex max-w-measure flex-col gap-6">
              <KeyValues
                rows={[
                  ["Owes", <Party key="debtor" address={item.debtor} nameOf={nameOf} />],
                  ["Is owed", <Party key="creditor" address={item.creditor} nameOf={nameOf} />],
                  ["Amount", <Amount key="amount" value={formatAmount(item.amount)} />],
                  ["Due", formatDate(item.dueDate)],
                  ["Sign before", formatDate(item.deadline)],
                  ["Signed by", nameOf(item.signedBy)],
                  ["Still to sign", nameOf(other)],
                ]}
              />
              <p className="flex items-start gap-2 text-body-sm text-ink">
                <AlertIcon className="mt-0.5 shrink-0" />
                Names come from your circle’s admin. Check the address too.
              </p>
              <div className="flex flex-wrap gap-2">
                {canSign ? (
                  <Button
                    variant="primary"
                    size="lg"
                    icon={<SignIcon />}
                    loading={sign.busy}
                    onClick={async () => {
                      const created = await sign.run();
                      if (created) router.push(`/app/invoices/${created.id}`);
                    }}
                  >
                    Sign invoice for {formatAmount(item.amount)} tUSD8
                  </Button>
                ) : (
                  <Button size="lg" onClick={copyLink}>
                    Copy link
                  </Button>
                )}
              </div>
              {canSign ? null : (
                <p className="text-body-sm text-ink-subtle">
                  {client.mode === "sample"
                    ? `Sample data: choose ${nameOf(other)} under “Viewing as” to sign for them.`
                    : `Send this link to ${nameOf(other)}. They open it with their wallet to sign.`}
                </p>
              )}
            </div>
          </>
        );
      }}
    </Loaded>
  );
}

function Party({ address, nameOf }: { address: Address; nameOf: NameOf }) {
  return (
    <span className="flex flex-wrap items-center justify-end gap-x-2">
      {nameOf(address)}
      <AddressText address={address} />
    </span>
  );
}

export function InvoiceScreen() {
  const { id } = useParams<{ id: string }>();
  const circle = useCircle();
  const invoices = useInvoices();
  const nameOf = nameIn(circle.data);

  return (
    <Loaded query={invoices} what="this invoice">
      {(all) => {
        const invoice = all.find((candidate) => `${candidate.id}` === id);
        return invoice ? (
          <InvoiceDetail invoice={invoice} circle={circle.data} nameOf={nameOf} />
        ) : (
          <EmptyState
            title="That invoice was not found"
            action={
              <Link href="/app/invoices" className={buttonClass()}>
                View invoices
              </Link>
            }
          >
            It may belong to another circle.
          </EmptyState>
        );
      }}
    </Loaded>
  );
}

function InvoiceDetail({ invoice, circle, nameOf }: { invoice: Invoice; circle: Circle | undefined; nameOf: NameOf }) {
  const { me, client: current } = useSalda();
  const left = leftOf(invoice);
  const open = isOpen(invoice);
  const party = invoice.debtor === me || invoice.creditor === me;
  const other = invoice.debtor === me ? invoice.creditor : invoice.debtor;
  const [text, setText] = useState("");
  const [error, setError] = useState<string>();
  const pay = useChange(
    (client, amount: bigint) => client.payInvoice(invoice.id, amount),
    current.mode === "sample" ? "Payment recorded. Sample data, nothing was sent." : "Payment sent to the business you owe.",
  );
  const voiding = useChange(
    (client) => client.signVoid(invoice.id, me),
    (result) => (result.voided ? "Invoice voided" : `Void signed. Now ${nameOf(other)} needs to sign.`),
  );

  const renamed = [invoice.debtor, invoice.creditor].filter((address) => {
    const member = circle?.members.find((candidate) => candidate.address === address);
    return member && member.nameUpdatedAt > invoice.registeredAt;
  });

  return (
    <>
      <PageHeader
        title={`Invoice #${invoice.id}`}
        description={`${nameOf(invoice.debtor)} owes ${nameOf(invoice.creditor)}`}
        action={<InvoiceBadge invoice={invoice} />}
      />
      <div className="flex max-w-measure flex-col gap-6">
        {renamed.length > 0 ? (
          <p role="status" className="flex items-start gap-2 rounded-lg bg-warning-fill p-3 text-body-sm text-on-warning">
            <AlertIcon className="mt-0.5 shrink-0" />
            Name changed since this invoice was signed: {renamed.map(nameOf).join(" and ")}. Check the address before you sign anything.
          </p>
        ) : null}
        <KeyValues
          rows={[
            ["Owes", <Party key="debtor" address={invoice.debtor} nameOf={nameOf} />],
            ["Is owed", <Party key="creditor" address={invoice.creditor} nameOf={nameOf} />],
            ["Amount", <Amount key="amount" value={formatAmount(invoice.amount)} />],
            ["Cleared so far", <Amount key="cleared" value={formatAmount(invoice.cleared)} />],
            ["Left", <Amount key="left" value={formatAmount(invoice.voided ? 0n : left)} />],
            ["Due", formatDate(invoice.dueDate)],
            ["Signed by both", formatDate(invoice.registeredAt)],
            ["Document hash", <span key="hash" className="font-mono text-mono">{invoice.docHash.slice(0, 10)}…{invoice.docHash.slice(-6)}</span>],
          ]}
        />
        {open && party ? (
          <div className="flex flex-wrap gap-2">
            {invoice.debtor === me ? (
              <ConfirmDialog
                trigger="Pay directly"
                title="Pay this invoice directly?"
                description={`Pays ${nameOf(invoice.creditor)} now, outside any round. Up to ${formatAmount(left)} tUSD8.`}
                confirm="Sign and pay"
                onOpen={() => {
                  setText(formatAmount(left).replaceAll(",", ""));
                  setError(undefined);
                }}
                onConfirm={async () => {
                  const amount = parseAmount(text);
                  if (!amount || amount <= 0n || amount > left) {
                    setError(`Enter an amount above 0, up to ${formatAmount(left)}.`);
                    return false;
                  }
                  return (await pay.run(amount)) !== undefined;
                }}
              >
                <Field
                  label="Amount to pay"
                  inputMode="decimal"
                  autoComplete="off"
                  numeric
                  suffix="tUSD8"
                  value={text}
                  error={error}
                  onChange={(event) => setText(event.currentTarget.value)}
                />
              </ConfirmDialog>
            ) : null}
            {invoice.voidSignedBy === me ? (
              <p className="text-body-sm text-ink-subtle">You asked to void this. {nameOf(other)} has not signed yet.</p>
            ) : (
              <ConfirmDialog
                trigger={invoice.voidSignedBy ? "Review void request" : "Ask to void"}
                title={invoice.voidSignedBy ? "Void this invoice?" : "Ask to void this invoice?"}
                description={
                  invoice.voidSignedBy
                    ? `${nameOf(other)} has signed. The remaining ${formatAmount(left)} tUSD8 will never be cleared or paid.`
                    : `The remaining ${formatAmount(left)} tUSD8 will never be cleared or paid. ${nameOf(other)} must sign too.`
                }
                confirm={invoice.voidSignedBy ? "Sign and void invoice" : "Sign void request"}
                confirmVariant="danger"
                onConfirm={async () => (await voiding.run()) !== undefined}
              />
            )}
          </div>
        ) : null}
      </div>
    </>
  );
}
