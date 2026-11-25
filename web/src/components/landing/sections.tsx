import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { container } from "@/components/layout/site";
import { buttonClass } from "@/components/ui/button-class";
import { Amount, Badge } from "@/components/ui/data";
import { AlertIcon, ArrowDownIcon, CheckIcon, ExternalIcon, PlusIcon } from "@/components/ui/icons";
import { cx } from "@/lib/cx";
import { ClearingGraph } from "./clearing-graph";

/** Section titles have two tones: the claim, then the rest of the sentence. */
function Title({ id, first, rest, center }: { id: string; first: string; rest: string; center?: boolean }) {
  return (
    <h2
      id={id}
      className={cx("text-headline text-ink-strong lg:text-display-md", center ? "mx-auto max-w-[22ch] text-center" : "max-w-[20ch]")}
    >
      {first} <span className="text-ink-subtle">{rest}</span>
    </h2>
  );
}

function Section({
  id,
  first,
  rest,
  lede,
  children,
}: {
  id: string;
  first: string;
  rest: string;
  lede: string;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="border-t border-hairline">
      <div className={cx(container, "py-16 lg:py-32")}>
        <div className="grid gap-4 pb-12 lg:grid-cols-12 lg:gap-6 lg:pb-16">
          <div className="lg:col-span-7">
            <Title id={`${id}-title`} first={first} rest={rest} />
          </div>
          <p className="max-w-[44ch] text-body-lg text-pretty text-ink lg:col-span-4 lg:col-start-9 lg:pt-2">{lede}</p>
        </div>
        {children}
      </div>
    </section>
  );
}

function ClearingLink() {
  return (
    <a href="#clearing" className={buttonClass({ variant: "primary", size: "xl" })}>
      See debt clear
      <span aria-hidden="true" className="-me-2 inline-flex size-7 items-center justify-center rounded-full bg-on-primary text-primary">
        <ArrowDownIcon />
      </span>
    </a>
  );
}

const builtOn = ["tUSD8", "QDay Aevum", "EIP-712", "EIP-3009", "Solidity"] as const;

const openInvoices = [
  { from: "Ada’s Bakery", to: "Ben’s Farm", amount: "6.00" },
  { from: "Ben’s Farm", to: "Chidi Transport", amount: "5.00" },
  { from: "Chidi Transport", to: "Ada’s Bakery", amount: "4.00" },
] as const;

const outcome = [
  { who: "Ada’s Bakery", what: "pays", amount: "2.00" },
  { who: "Ben’s Farm", what: "receives", amount: "1.00" },
  { who: "Chidi Transport", what: "receives", amount: "1.00" },
] as const;

export function Hero() {
  return (
    <div className={container}>
      <div className="flex flex-col items-center gap-6 pt-16 pb-12 text-center lg:pt-24">
        <p className="rounded-full border border-hairline bg-canvas px-4 py-1.5 text-label text-ink">
          In development on Aevum testnet
        </p>
        <h1 className="display-fluid max-w-[22ch] text-ink-strong">Settle what you owe each other with less cash</h1>
        <p className="max-w-[52ch] text-body-lg text-pretty text-ink">
          Salda looks at every debt in a group of businesses, cancels what it can, and moves only the difference.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <ClearingLink />
          <Link href="/app" className={buttonClass({ size: "xl" })}>
            Open the app
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 py-8 text-body-sm text-ink-subtle">
        <span>Built on</span>
        <ul className="contents">
          {builtOn.map((name) => (
            <li key={name} className="text-title-sm text-ink-subtle">
              {name}
            </li>
          ))}
        </ul>
      </div>

      <div className="grid gap-4 pb-16 lg:grid-cols-8 lg:gap-6 lg:pb-24">
        <div className="flex flex-col gap-6 rounded-2xl bg-surface-2 p-4 sm:p-6 lg:col-span-5">
          <div className="flex items-center justify-between gap-4">
            <p className="text-title text-ink-strong">Three open invoices</p>
            <Badge tone="info">Sample data</Badge>
          </div>
          <div className="rounded-lg bg-canvas">
            <ul>
              {openInvoices.map((invoice) => (
                <li key={invoice.from} className="flex min-h-14 items-center justify-between gap-4 border-b border-hairline px-4 text-body-sm">
                  <span>
                    <span className="text-ink-strong">{invoice.from}</span>{" "}
                    <span className="text-ink-subtle">owes {invoice.to}</span>
                  </span>
                  <Amount value={invoice.amount} />
                </li>
              ))}
            </ul>
            <p className="flex min-h-14 items-center justify-between gap-4 px-4 text-title-sm text-ink-strong">
              Total debt
              <Amount value="15.00" />
            </p>
          </div>
        </div>

        <div className="flex flex-col justify-between gap-6 rounded-2xl bg-inverse p-4 text-on-inverse sm:p-6 lg:col-span-3">
          <p className="text-title">After one settlement</p>
          <ul>
            {outcome.map((line) => (
              <li key={line.who} className="flex min-h-11 items-center justify-between gap-4 border-b border-on-inverse/15 text-body-sm last:border-b-0">
                <span className="text-on-inverse/75">
                  {line.who} {line.what}
                </span>
                <span className="tabular-nums">{line.amount}</span>
              </li>
            ))}
          </ul>
          <p className="flex items-center gap-2 text-body-sm">
            <CheckIcon className="shrink-0" />
            All 15.00 cleared with 2.00
          </p>
        </div>
      </div>
    </div>
  );
}

const exampleAvatars = [
  { name: "Ada", src: "/avatars/ada.jpg" },
  { name: "Ben", src: "/avatars/ben.jpg" },
  { name: "Chidi", src: "/avatars/chidi.jpg" },
] as const;

export function Problem() {
  return (
    <section aria-labelledby="problem-title" className="border-t border-hairline">
      <div className={cx(container, "flex flex-col gap-10 py-16 lg:py-32")}>
        <h2 id="problem-title" className="max-w-[26ch] text-headline text-ink-strong lg:indent-16 lg:text-display-lg">
          Small businesses wait on each other to pay.{" "}
          <span className="text-ink-subtle">
            Ada can’t pay Ben until Chidi pays. Chidi can’t pay until Ben does. And Ben is waiting on Ada.
          </span>
        </h2>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
          <p className="flex items-center gap-4 rounded-xl bg-surface-2 p-3 pe-5 text-body-sm text-ink">
            <span aria-hidden="true" className="flex">
              {exampleAvatars.map((avatar, index) => (
                <Image
                  key={avatar.name}
                  src={avatar.src}
                  alt=""
                  width={40}
                  height={40}
                  unoptimized
                  className={cx(
                    "size-10 rounded-full bg-canvas object-cover ring-2 ring-surface-2",
                    index > 0 && "-ms-2",
                  )}
                />
              ))}
            </span>
            Ada, Ben and Chidi
          </p>
          <p className="max-w-[40ch] text-body-sm text-ink">Three example businesses, used throughout this page.</p>
        </div>
      </div>
    </section>
  );
}

export function Clearing() {
  return (
    <Section
      id="clearing"
      first="Three shops owe 15.00."
      rest="2.00 settles it."
      lede="Change how much cash Ada has and see what clears. Even with none, 12.00 cancels out. No wallet needed."
    >
      <ClearingGraph />
    </Section>
  );
}

const audiences = [
  ["Cooperatives", "Members who buy from and sell to each other all season."],
  ["Market associations", "Traders who settle up with their neighbors every week."],
  ["Wholesaler networks", "Suppliers and shops with invoices running both ways."],
  ["Company subsidiaries", "Branches that bill each other and move cash in circles."],
] as const;

export function Who() {
  return (
    <section id="who" aria-labelledby="who-title" className="border-t border-hairline">
      <div className={cx(container, "flex flex-col gap-12 py-16 lg:gap-16 lg:py-32")}>
        <Title id="who-title" first="Made for groups" rest="that already trade with each other." center />
        <dl className="grid gap-x-6 sm:grid-cols-2 lg:grid-cols-4">
          {audiences.map(([name, body]) => (
            <div key={name} className="flex flex-col gap-2 border-t border-hairline bg-canvas py-6">
              <dt className="text-title-sm text-ink-strong">{name}</dt>
              <dd className="max-w-[36ch] text-body-sm text-pretty text-ink">{body}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

export function Safety() {
  return (
    <Section
      id="safety"
      first="Nobody can move your money,"
      rest="including us."
      lede="Both businesses sign every invoice. The contract rechecks each round before anything moves."
    >
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
        <div className="flex min-h-90 flex-col justify-between gap-8 rounded-2xl bg-surface-2 p-6 lg:p-8">
          <div className="flex flex-col gap-2">
            <h3 className="text-title-lg text-ink-strong">Salda never holds your money</h3>
            <p className="text-body text-pretty text-ink">Payments pass straight to the businesses owed, in one step.</p>
          </div>
          <div>
            <p className="text-display-lg text-ink-strong tabular-nums">0.00</p>
            <p className="text-body-sm text-ink">Left in the contract after every round</p>
          </div>
        </div>

        <div className="flex min-h-90 flex-col justify-between gap-8 rounded-2xl bg-inverse p-6 text-on-inverse lg:p-8">
          <div className="flex flex-col gap-2">
            <h3 className="text-title-lg">Bad rounds are refused</h3>
            <p className="text-body text-pretty text-on-inverse/75">
              Set your own limits once. A proposal that breaks one is rejected, even if the agent is compromised.
            </p>
          </div>
          <div className="rounded-lg bg-inverse-hover p-4 text-body-sm">
            <p className="flex items-center justify-between gap-4 pb-3">
              <span className="flex items-center gap-2">
                <AlertIcon className="shrink-0" />
                Proposed by agent
              </span>
              <Badge tone="danger">Rejected</Badge>
            </p>
            <dl>
              {[
                ["Pays to clear 6.00", "5.00"],
                ["Cleared per 1.00 paid", "1.2×"],
                ["Your minimum", "3.0×"],
                ["Cash moved", "0.00"],
              ].map(([label, value]) => (
                <div key={label} className="flex min-h-8 items-center justify-between gap-4 border-t border-on-inverse/15">
                  <dt className="text-on-inverse/75">{label}</dt>
                  <dd className="tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="pt-3 text-caption text-on-inverse/75">Sample data</p>
          </div>
        </div>

        <div className="grid gap-4 md:col-span-2 md:grid-cols-2 lg:col-span-1 lg:grid-cols-1 lg:gap-6">
          <div className="flex flex-col justify-between gap-6 rounded-2xl border border-hairline bg-canvas p-6 lg:p-8">
            <h3 className="text-title-lg text-ink-strong">All or nothing</h3>
            <p className="text-body text-pretty text-ink">One missing signature stops the whole round. No one is left half paid.</p>
          </div>
          <div className="flex flex-col justify-between gap-6 rounded-2xl border border-hairline bg-canvas p-6 lg:p-8">
            <h3 className="text-title-lg text-ink-strong">Cancel any time</h3>
            <p className="text-body text-pretty text-ink">Revoke your standing limits with one signature, with no network fee to pay.</p>
          </div>
        </div>
      </div>
    </Section>
  );
}

const steps: { title: string; body: string; detail: ReactNode }[] = [
  {
    title: "Add the invoices you share",
    body: "Send a link to the other business. The invoice counts only when both of you have signed it.",
    detail: (
      <ul className="text-body-sm">
        <li className="flex min-h-11 items-center justify-between gap-4 border-b border-hairline">
          Ada’s Bakery <Badge tone="success">Signed</Badge>
        </li>
        <li className="flex min-h-11 items-center justify-between gap-4">
          Ben’s Farm <Badge tone="warning">Waiting to sign</Badge>
        </li>
      </ul>
    ),
  },
  {
    title: "Say how much cash you can spend",
    body: "Salda finds the plan that clears the most debt without asking anyone for more than they offered.",
    detail: (
      <dl className="text-body-sm">
        <div className="flex min-h-11 items-center justify-between gap-4 border-b border-hairline">
          <dt>Cash you can spend</dt>
          <dd><Amount value="2.00" /></dd>
        </div>
        <div className="flex min-h-11 items-center justify-between gap-4">
          <dt>Your debt that clears</dt>
          <dd><Amount value="6.00" /></dd>
        </div>
      </dl>
    ),
  },
  {
    title: "Review, sign and settle",
    body: "You see exactly what you pay and what clears before you sign. Then it all settles at once, with a receipt.",
    detail: (
      <dl className="text-body-sm">
        <div className="flex min-h-11 items-center justify-between gap-4 border-b border-hairline">
          <dt>Debt cleared for the group</dt>
          <dd><Amount value="15.00" /></dd>
        </div>
        <div className="flex min-h-11 items-center justify-between gap-4">
          <dt>Cash used</dt>
          <dd><Amount value="2.00" /></dd>
        </div>
      </dl>
    ),
  },
];

export function Steps() {
  return (
    <section id="steps" aria-labelledby="steps-title" className="border-t border-hairline">
      <div className={cx(container, "grid gap-12 py-16 lg:grid-cols-12 lg:gap-6 lg:py-32")}>
        <div className="lg:col-span-4">
          <Title id="steps-title" first="Three steps" rest="from invoice to settled." />
        </div>
        <ol className="border-t border-hairline bg-canvas lg:col-span-8">
          {steps.map((step, index) => (
            <li key={step.title} className="border-b border-hairline">
              <details name="steps" open={index === 0} className="group">
                <summary className="flex min-h-14 cursor-pointer list-none items-center gap-4 py-4 text-title-sm text-ink-strong -outline-offset-2 [&::-webkit-details-marker]:hidden">
                  <span className="font-mono text-mono text-ink-subtle tabular-nums">{index + 1}</span>
                  <span className="flex-1">{step.title}</span>
                  <PlusIcon className="shrink-0 group-open:rotate-45 motion-safe:transition-[rotate] motion-safe:duration-200 motion-safe:ease-out" />
                </summary>
                <div className="grid gap-6 pb-6 sm:grid-cols-2 sm:ps-8">
                  <p className="max-w-[44ch] text-body text-pretty text-ink">{step.body}</p>
                  <div className="rounded-lg bg-surface-2 px-4 py-2">
                    {step.detail}
                    <p className="py-2 text-caption text-ink-subtle">Sample data</p>
                  </div>
                </div>
              </details>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function Limits() {
  const limits: [string, ReactNode][] = [
    ["It’s still being built", "Salda runs on a test network with tUSD8, a test token. It is not real money, and the contract has not been audited."],
    ["Amounts are public", "Wallet addresses, who owes whom and amounts are visible onchain. Business names and documents are kept as hashes only."],
    ["Debts need to loop", "If your group’s debts don’t form a circle, there is little to cancel and you will need more cash."],
    ["Names depend on your circle", "The person who runs your circle confirms each business’s name. Check you trust them."],
    ["Others came first", (
      <>
        Clearing debt in circles is centuries old. Salda builds on published work, including{" "}
        <a href="https://arxiv.org/abs/2507.22309" rel="noopener" className="inline-flex items-center gap-1 text-link underline underline-offset-4 hover:text-primary-hover">
          the Cycles Protocol paper
          <ExternalIcon className="shrink-0" />
        </a>
        .
      </>
    )],
  ];

  return (
    <section id="limits" aria-labelledby="limits-title" className="border-t border-hairline">
      <div className={cx(container, "grid gap-12 py-16 lg:grid-cols-12 lg:gap-6 lg:py-32")}>
        <div className="lg:col-span-4">
          <Title id="limits-title" first="Know this" rest="before you rely on it." />
        </div>
        <dl className="border-t border-hairline bg-canvas lg:col-span-8">
          {limits.map(([name, body]) => (
            <div key={name} className="grid gap-2 border-b border-hairline py-6 sm:grid-cols-3 sm:gap-6">
              <dt className="text-title-sm text-ink-strong">{name}</dt>
              <dd className="max-w-[56ch] text-body text-pretty text-ink sm:col-span-2">{body}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

export function Closing() {
  return (
    <section aria-labelledby="closing-title" className="border-t border-hairline">
      <div className={cx(container, "flex flex-col items-start gap-8 py-16 lg:flex-row lg:items-center lg:justify-between lg:py-32")}>
        <Title id="closing-title" first="Start with three shops" rest="and see what two dollars can settle." />
        <ClearingLink />
      </div>
    </section>
  );
}
