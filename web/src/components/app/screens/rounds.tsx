"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useId, useMemo, useState } from "react";
import {
  messageOf,
  nameIn,
  useCashLimits,
  useChange,
  useCircle,
  useInvoices,
  usePlan,
  useRound,
  useRounds,
  useSalda,
  type NameOf,
} from "@/client/provider";
import type { Address, CashLimit, Invoice, Round, RoundPlan } from "@/client/types";
import { DebtGraph } from "@/components/app/debt-graph";
import { isOpen, KeyValues, leftOf, Loaded, PageHeader, RoundBadge } from "@/components/app/parts";
import { Button } from "@/components/ui/button";
import { buttonClass } from "@/components/ui/button-class";
import { Amount, Badge, EmptyState, ErrorState, LoadingRows, Panel } from "@/components/ui/data";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { CheckIcon, ExternalIcon, PlayIcon } from "@/components/ui/icons";
import { txUrl } from "@/chain/salda";
import { Slider } from "@/components/ui/slider";
import { formatTime } from "@/lib/format";
import { formatAmount, ONE, parseAmount } from "@/lib/money";

const planLink = (
  <Link href="/app/rounds/new" className={buttonClass({ variant: "primary" })}>
    Plan a round
  </Link>
);

export function RoundsScreen() {
  const rounds = useRounds();
  return (
    <>
      <PageHeader
        title="Rounds"
        description="Each round clears as much debt as it can. It settles fully, or not at all."
        action={planLink}
      />
      <Loaded query={rounds} what="rounds">
        {(all) =>
          all.length === 0 ? (
            <EmptyState title="No rounds yet" action={planLink}>
              Plan one to see how much of your group’s debt can clear.
            </EmptyState>
          ) : (
            <ul className="rounded-lg border border-hairline">
              {all.map((round) => (
                <li key={round.key} className="border-t border-hairline first:border-t-0">
                  <Link
                    href={`/app/rounds/${round.key}`}
                    className="flex min-h-11 flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 text-body-sm -outline-offset-2 hover:bg-surface"
                  >
                    <span className="flex-1 text-ink-strong">Proposed {formatTime(round.proposedAt)}</span>
                    <RoundBadge round={round} />
                    <span className="whitespace-nowrap">
                      <Amount value={formatAmount(round.plan.gross)} /> <span className="text-ink-subtle">to clear</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )
        }
      </Loaded>
    </>
  );
}

export function NewRoundScreen() {
  const { me } = useSalda();
  const circle = useCircle();
  const invoices = useInvoices();
  const limits = useCashLimits();

  return (
    <>
      <PageHeader title="Plan a round" description="Choose how much cash you can spend, and see what clears before anyone signs." />
      <Loaded query={circle} what="your circle">
        {(data) => (
          <Loaded query={invoices} what="invoices">
            {(all) => (
              <Loaded query={limits} what="cash limits">
                {(saved) => <Builder key={`${data.id}-${me}`} invoices={all} limits={saved} nameOf={nameIn(data)} />}
              </Loaded>
            )}
          </Loaded>
        )}
      </Loaded>
    </>
  );
}

function Builder({ invoices, limits, nameOf }: { invoices: Invoice[]; limits: CashLimit[]; nameOf: NameOf }) {
  const router = useRouter();
  const { circleId, me } = useSalda();
  const labelId = useId();
  const open = invoices.filter(isOpen);
  const owe = open.filter((item) => item.debtor === me).reduce((total, item) => total + leftOf(item), 0n);
  const owed = open.filter((item) => item.creditor === me).reduce((total, item) => total + leftOf(item), 0n);
  // Past this, more cash could not clear any more of what you owe.
  const max = owe > owed ? owe - owed : 0n;

  const saved = limits.find((limit) => limit.member === me)?.amount ?? 0n;
  const [cash, setCash] = useState(saved < max ? saved : max);
  const [typed, setTyped] = useState(formatAmount(saved < max ? saved : max));
  const parsed = parseAmount(typed);
  const error = parsed === null || parsed > max ? `Enter an amount from 0 to ${formatAmount(max)}.` : undefined;

  const all = useMemo(
    () => new Map<Address, bigint>(limits.map((limit) => [limit.member, limit.member === me ? cash : limit.amount])),
    [limits, me, cash],
  );
  const plan = usePlan(all);

  const propose = useChange(async (api, agreed: RoundPlan) => {
    await api.setCashLimit(circleId, me, cash);
    return api.openRound(agreed);
  }, "Round proposed. Everyone in it can now sign.");

  return (
    <div className="grid gap-6 xl:grid-cols-12">
      <div className="flex min-w-0 flex-col gap-6 xl:col-span-7">
        <Panel heading="h2" title="What this plan leaves" description="Dark is debt left. Under each name is what they receive or pay.">
          {plan.isError ? (
            <PlanError error={plan.error} />
          ) : plan.data ? (
            <DebtGraph plan={plan.data} invoices={invoices} nameOf={nameOf} />
          ) : (
            <LoadingRows label="Planning a round…" rows={4} />
          )}
        </Panel>
        {plan.data && !plan.isError ? <Lines plan={plan.data} invoices={invoices} nameOf={nameOf} /> : null}
      </div>

      <div className="flex min-w-0 flex-col gap-6 xl:col-span-5">
        <Panel heading="h2" title="Cash you can spend">
          {max === 0n ? (
            <p className="text-body-sm text-ink">You are owed at least as much as you owe, so you need no cash.</p>
          ) : (
            <div className="flex flex-col gap-4">
              <span id={labelId} className="sr-only">
                Cash you can spend
              </span>
              <Slider
                min={0}
                max={Number((max * 100n) / ONE)}
                step={1}
                value={Number((cash * 100n) / ONE)}
                labelledBy={labelId}
                valueText={`${formatAmount(cash)} tUSD8${plan.data ? `, clears ${formatAmount(plan.data.gross)}` : ""}`}
                onValueChange={(hundredths) => {
                  const next = (BigInt(hundredths) * ONE) / 100n;
                  setCash(next);
                  setTyped(formatAmount(next).replaceAll(",", ""));
                }}
              />
              <Field
                label="Or type an amount"
                inputMode="decimal"
                autoComplete="off"
                suffix="tUSD8"
                numeric
                value={typed}
                error={error}
                help={`Up to ${formatAmount(max)} helps this round`}
                onChange={(event) => {
                  const text = event.currentTarget.value;
                  setTyped(text);
                  const next = parseAmount(text);
                  if (next !== null && next <= max) setCash(next);
                }}
              />
            </div>
          )}
        </Panel>

        {plan.data && !plan.isError ? (
          <Panel heading="h2" title="This plan">
            <div className="flex flex-col gap-4">
              <Summary plan={plan.data} nameOf={nameOf} />
              {plan.data.provenOptimal ? null : (
                <p className="text-body-sm text-ink">This plan is valid, but there may be a better one.</p>
              )}
              <Button
                variant="primary"
                size="lg"
                icon={<CheckIcon />}
                loading={propose.busy}
                onClick={async () => {
                  if (!plan.data || plan.isPlaceholderData) return;
                  const round = await propose.run(plan.data);
                  if (round) router.push(`/app/rounds/${round.key}`);
                }}
              >
                Propose this round
              </Button>
              <p className="text-caption text-ink-subtle">Proposing moves nothing. Every business in it signs first.</p>
            </div>
          </Panel>
        ) : null}
      </div>
    </div>
  );
}

function PlanError({ error }: { error: unknown }) {
  return (
    <ErrorState
      title="Unable to plan a round"
      action={
        <Link href="/app/settings" className={buttonClass()}>
          Open settings
        </Link>
      }
    >
      {messageOf(error)}
    </ErrorState>
  );
}

function Lines({ plan, invoices, nameOf }: { plan: RoundPlan; invoices: readonly Invoice[]; nameOf: NameOf }) {
  return (
    <Panel heading="h2" title="Invoices in this plan">
      <ul className="rounded-lg border border-hairline">
        {plan.lines.map((line) => {
          const invoice = invoices.find((candidate) => candidate.id === line.invoiceId);
          if (!invoice) return null;
          return (
            <li
              key={`${line.invoiceId}`}
              className="flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-hairline px-3 py-2 text-body-sm first:border-t-0"
            >
              <span>
                <span className="text-ink-strong">{nameOf(invoice.debtor)}</span> owes {nameOf(invoice.creditor)}
              </span>
              <span className="text-ink-subtle">
                <Amount value={formatAmount(line.clear)} /> of {formatAmount(invoice.amount)}
              </span>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

function Summary({ plan, nameOf }: { plan: RoundPlan; nameOf: NameOf }) {
  return (
    <KeyValues
      rows={[
        ["Debt cleared", <Amount key="gross" value={formatAmount(plan.gross)} />],
        ["Cash used", <Amount key="cash" value={formatAmount(plan.cash)} />],
        ...plan.positions.map((position) => {
          const net = position.in - position.out;
          const verb = net < 0n ? "pays" : net > 0n ? "receives" : "moves no cash";
          return [
            `${nameOf(position.member)} ${verb}`,
            <Amount key={position.member} value={formatAmount(net < 0n ? -net : net)} />,
          ] as const;
        }),
      ]}
    />
  );
}

export function RoundScreen() {
  const { key } = useParams<{ key: string }>();
  const round = useRound(key);
  const circle = useCircle();
  const invoices = useInvoices();

  return (
    <Loaded query={round} what="this round">
      {(data) => (
        <Loaded query={circle} what="your circle">
          {(found) => (
            <Loaded query={invoices} what="invoices">
              {(all) => <RoundDetail round={data} invoices={all} nameOf={nameIn(found)} />}
            </Loaded>
          )}
        </Loaded>
      )}
    </Loaded>
  );
}

function RoundDetail({ round, invoices, nameOf }: { round: Round; invoices: Invoice[]; nameOf: NameOf }) {
  const { me } = useSalda();
  const position = round.plan.positions.find((candidate) => candidate.member === me);
  const signed = round.approvedBy.includes(me);
  const ready = round.plan.positions.every((candidate) => round.approvedBy.includes(candidate.member));
  const waiting = round.state === "waiting-for-signatures";
  const pays = position && position.out > position.in ? position.out - position.in : 0n;
  const receives = position && position.in > position.out ? position.in - position.out : 0n;

  const approve = useChange(
    (client) => client.approveRound(round.key, me),
    "Consent signed. Nothing moves until everyone signs.",
  );
  const settle = useChange(
    (client) => client.settleRound(round.key),
    (result) =>
      result.state === "confirmed"
        ? "Round settled. The receipt is ready."
        : result.state === "pending"
          ? "Round sent. It is still confirming."
          : undefined,
  );

  return (
    <>
      <PageHeader
        title={waiting ? "Review this round" : round.state === "confirmed" ? "Round settled" : "Round"}
        description={`Proposed ${formatTime(round.proposedAt)}`}
        action={<RoundBadge round={round} />}
      />
      <div className="grid gap-6 xl:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-6 xl:col-span-7">
          {position ? (
            <Panel heading="h2" title="What this means for you" description={explain(pays, receives, position.out)}>
              <div className="flex flex-col gap-4">
                <KeyValues
                  rows={[
                    ["Your debt cleared", <Amount key="out" value={formatAmount(position.out)} />],
                    ["Owed to you, cleared", <Amount key="in" value={formatAmount(position.in)} />],
                    [pays > 0n ? "You pay" : receives > 0n ? "You receive" : "Cash you move", <Amount key="net" value={formatAmount(pays > 0n ? pays : receives)} />],
                  ]}
                />
                {waiting && !signed ? (
                  <div>
                    <ConfirmDialog
                      trigger="Review and sign"
                      triggerVariant="primary"
                      triggerSize="lg"
                      title="Sign this round?"
                      description={
                        pays > 0n
                          ? `One signature authorizes exactly ${formatAmount(pays)} tUSD8, for this round only. Nothing moves unless everyone signs.`
                          : "Your signature agrees to clear these invoices. No money leaves your wallet."
                      }
                      confirm={pays > 0n ? `Sign and pay ${formatAmount(pays)} tUSD8` : "Sign approval"}
                      onConfirm={async () => (await approve.run()) !== undefined}
                    >
                      <KeyValues
                        rows={[
                          ["You pay", <Amount key="pay" value={formatAmount(pays)} />],
                          ["Your debt cleared", <Amount key="clear" value={formatAmount(position.out)} />],
                          ["Settle before", formatTime(round.plan.deadline)],
                        ]}
                      />
                    </ConfirmDialog>
                  </div>
                ) : null}
                {waiting && signed ? (
                  <p className="flex items-center gap-2 text-body-sm text-ink">
                    <CheckIcon className="shrink-0" />
                    {round.viaMandate.includes(me) ? "Your mandate agreed for you." : "You have signed."}
                  </p>
                ) : null}
              </div>
            </Panel>
          ) : null}

          {round.state === "pending" || round.state === "submitting" ? (
            <Panel heading="h2" title="Still confirming">
              <div role="status" className="flex flex-col items-start gap-3 text-body-sm text-ink">
                <p>The round was sent and is waiting for the network. This page updates when it confirms.</p>
                {round.txHash ? <TxLink hash={round.txHash} /> : null}
              </div>
            </Panel>
          ) : null}
          {round.state === "failed" ? (
            <Panel heading="h2" title="This round did not settle">
              <div className="flex flex-col items-start gap-4">
                <p className="text-body-sm text-ink">{round.failure} Nothing moved.</p>
                {planLink}
              </div>
            </Panel>
          ) : null}
          <Lines plan={round.plan} invoices={invoices} nameOf={nameOf} />
        </div>

        <div className="flex min-w-0 flex-col gap-6 xl:col-span-5">
          <Panel heading="h2" title="Signatures">
            <ul className="rounded-lg border border-hairline">
              {round.plan.positions.map(({ member }) => (
                <li
                  key={member}
                  className="flex min-h-11 items-center justify-between gap-4 border-t border-hairline px-3 py-2 text-body-sm first:border-t-0"
                >
                  <span className="text-ink-strong">{nameOf(member)}</span>
                  {round.approvedBy.includes(member) ? (
                    <Badge tone="success">{round.viaMandate.includes(member) ? "By mandate" : "Signed"}</Badge>
                  ) : (
                    <Badge tone="warning">Not signed</Badge>
                  )}
                </li>
              ))}
            </ul>
            {waiting && !ready ? (
              <p className="pt-3 text-caption text-ink-subtle">
                Send this page’s link to each business that hasn’t signed. They open it with their wallet to sign.
              </p>
            ) : null}
          </Panel>
          <Panel heading="h2" title="The whole round">
            <div className="flex flex-col gap-4">
              <Summary plan={round.plan} nameOf={nameOf} />
              {waiting && ready ? (
                <Button variant="primary" size="lg" icon={<PlayIcon />} loading={settle.busy} onClick={() => void settle.run()}>
                  Settle round
                </Button>
              ) : null}
              {round.state === "confirmed" ? (
                <Link href={`/app/receipts/${round.key}`} className={buttonClass({ variant: "primary", size: "lg" })}>
                  View receipt
                </Link>
              ) : null}
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}

function explain(pays: bigint, receives: bigint, cleared: bigint): string {
  if (pays > 0n) return `You pay ${formatAmount(pays)} and ${formatAmount(cleared)} of what you owe clears.`;
  if (receives > 0n) return `You receive ${formatAmount(receives)} and ${formatAmount(cleared)} of what you owe clears.`;
  return `You move no cash and ${formatAmount(cleared)} of what you owe clears.`;
}

export function ReceiptsScreen() {
  const rounds = useRounds();
  return (
    <>
      <PageHeader title="Receipts" description="Every settled round, and what it cleared." />
      <Loaded query={rounds} what="receipts">
        {(all) => {
          const settled = all.filter((round) => round.state === "confirmed");
          return settled.length === 0 ? (
            <EmptyState
              title="No receipts yet"
              action={
                <Link href="/app/rounds" className={buttonClass()}>
                  View rounds
                </Link>
              }
            >
              A receipt appears here when a round settles.
            </EmptyState>
          ) : (
            <ul className="rounded-lg border border-hairline">
              {settled.map((round) => (
                <li key={round.key} className="border-t border-hairline first:border-t-0">
                  <Link
                    href={`/app/receipts/${round.key}`}
                    className="flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2 text-body-sm -outline-offset-2 hover:bg-surface"
                  >
                    <span className="text-ink-strong">{formatTime(round.settledAt ?? round.proposedAt)}</span>
                    <span className="text-ink-subtle">
                      <Amount value={formatAmount(round.plan.gross)} /> cleared with {formatAmount(round.plan.cash)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          );
        }}
      </Loaded>
    </>
  );
}

export function ReceiptScreen() {
  const { key } = useParams<{ key: string }>();
  const round = useRound(key);
  const circle = useCircle();
  const invoices = useInvoices();
  const nameOf = nameIn(circle.data);

  return (
    <Loaded query={round} what="this receipt">
      {(data) =>
        data.state !== "confirmed" ? (
          <EmptyState
            title="This round has not settled"
            action={
              <Link href={`/app/rounds/${data.key}`} className={buttonClass()}>
                View the round
              </Link>
            }
          >
            A receipt appears when it does.
          </EmptyState>
        ) : (
          <>
            <PageHeader
              title="Receipt"
              description={`Settled ${formatTime(data.settledAt ?? data.proposedAt)}`}
              action={<RoundBadge round={data} />}
            />
            <div className="flex max-w-measure flex-col gap-6">
              <dl className="grid gap-px overflow-hidden rounded-lg border border-hairline bg-hairline sm:grid-cols-3">
                {[
                  ["Debt cleared", formatAmount(data.plan.gross)],
                  ["Cash used", formatAmount(data.plan.cash)],
                  ["Cleared per 1.00 of cash", data.plan.cash === 0n ? "No cash used" : `${(Number(data.plan.gross) / Number(data.plan.cash)).toFixed(2)}×`],
                ].map(([label, value]) => (
                  <div key={label} className="flex flex-col gap-1 bg-canvas p-4">
                    <dt className="text-label text-ink-subtle">{label}</dt>
                    <dd className="text-title-lg text-ink-strong tabular-nums">{value}</dd>
                  </div>
                ))}
              </dl>
              <Panel heading="h2" title="Each business">
                <Summary plan={data.plan} nameOf={nameOf} />
              </Panel>
              {invoices.data ? <Lines plan={data.plan} invoices={invoices.data} nameOf={nameOf} /> : null}
              {data.txHash ? <TxLink hash={data.txHash} /> : null}
            </div>
          </>
        )
      }
    </Loaded>
  );
}

function TxLink({ hash }: { hash: `0x${string}` }) {
  return (
    <a
      href={txUrl(hash)}
      target="_blank"
      rel="noopener"
      className="inline-flex min-h-6 items-center gap-1 text-body-sm text-link underline underline-offset-4 hover:text-primary-hover"
    >
      View the transaction on the Aevum explorer
      <span className="sr-only"> (opens in a new tab)</span>
      <ExternalIcon className="shrink-0" />
    </a>
  );
}
