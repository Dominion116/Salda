"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useAccount } from "wagmi";
import type { Address } from "@/client/types";
import { DebtGraph } from "@/components/app/debt-graph";
import { KeyValues } from "@/components/app/parts";
import { SaldaLogo } from "@/components/brand";
import { container, pageY } from "@/components/layout/container";
import { SkipLink } from "@/components/layout/skip-link";
import { Button } from "@/components/ui/button";
import { buttonClass } from "@/components/ui/button-class";
import { Amount, Badge, Panel } from "@/components/ui/data";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { AlertIcon, CheckIcon, ExternalIcon, PlayIcon, SignIcon, SpinnerIcon } from "@/components/ui/icons";
import { ChoiceGroup, Radio } from "@/components/ui/selection";
import { Slider } from "@/components/ui/slider";
import { cx } from "@/lib/cx";
import { attacks, checkAttack, DEMO_MAX_CASH, demoBen, demoChidi, demoInvoices, demoMandate, demoPlan, demoRound } from "@/lib/demo";
import { formatRatio } from "@/lib/format";
import { formatAmount, ONE, parseAmount } from "@/lib/money";
import { aevum } from "@/wallet/config";
import { WalletProviders } from "@/wallet/providers";
import { NetworkBanner, WalletButton } from "@/wallet/wallet-button";
import { txUrl } from "@/chain/salda";
import { useLiveDemo, type AttackResult, type LiveDemo } from "./live-demo";

/*
 * The judge demo (PRD 5.2), on sample data until Phase 8. Every "signature" here stands in for
 * the wallet prompt a live demo shows, and says so. Nothing is signed or sent.
 */

const STAGES = [
  { key: "connect", label: "Connect" },
  { key: "start", label: "Start" },
  { key: "cash", label: "Choose cash" },
  { key: "settle", label: "Sign and settle" },
  { key: "receipt", label: "Receipt" },
  { key: "safety", label: "Safety checks" },
] as const;
type Stage = (typeof STAGES)[number]["key"];

const SAMPLE_YOU = `0x${"a".repeat(40)}` as Address;
const MILLI = ONE / 1000n;

export function DemoScreen() {
  return (
    <WalletProviders>
      <SkipLink />
      <Demo />
    </WalletProviders>
  );
}

function Demo() {
  const { address, isConnected, chainId } = useAccount();
  const [stage, setStage] = useState<Stage>("connect");
  const [reached, setReached] = useState(0);
  const [mode, setMode] = useState<"wallet" | "sample">("sample");
  const [at] = useState(() => Math.floor(Date.now() / 1000));
  const [cash, setCash] = useState(DEMO_MAX_CASH);
  const heading = useRef<HTMLHeadingElement>(null);
  const shown = useRef<Stage>("connect");
  const liveDemo = useLiveDemo();
  // The live demo runs only with a wallet on Aevum and a server set up for it. Otherwise: sample data.
  const live = mode === "wallet" && liveDemo.ready ? liveDemo : undefined;

  const you = mode === "wallet" && address ? (address as Address) : SAMPLE_YOU;
  const nameOf = (member: Address) => (member === you ? "Ada (you)" : member === demoBen ? "Ben" : member === demoChidi ? "Chidi" : "Unknown");

  const go = (next: Stage) => {
    setStage(next);
    setReached((current) => Math.max(current, STAGES.findIndex((item) => item.key === next)));
  };
  const restart = () => {
    setStage("connect");
    setReached(0);
    setCash(DEMO_MAX_CASH);
    liveDemo.reset();
  };

  // Moves focus to the new step’s heading, so keyboard and screen reader users follow along.
  useEffect(() => {
    if (shown.current === stage) return;
    shown.current = stage;
    heading.current?.focus();
  }, [stage]);

  const index = STAGES.findIndex((item) => item.key === stage);
  const current = STAGES[index] ?? STAGES[0];
  const onAevum = isConnected && chainId === aevum.id;

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-(--z-sticky) border-b border-hairline bg-canvas">
        <div className={cx(container, "flex min-h-14 flex-wrap items-center gap-3 py-2")}>
          <Link href="/" className="hit-44 flex items-center">
            <SaldaLogo priority />
          </Link>
          <Badge tone="info">Sample data</Badge>
          <div className="ms-auto flex items-center gap-3">
            <Link href="/app" className={buttonClass({ variant: "ghost" })}>
              Open the app
            </Link>
            <WalletButton />
          </div>
        </div>
      </header>
      <NetworkBanner />

      <main id="main" tabIndex={-1} className={cx(container, pageY, "grid gap-8 lg:grid-cols-12 lg:gap-6")}>
        <div className="lg:col-span-3">
          <p className="text-label text-ink-subtle">
            Step {index + 1} of {STAGES.length}
          </p>
          <div aria-hidden="true" className="mt-2 h-1 overflow-hidden rounded-full bg-surface-2 lg:hidden">
            <div
              className="h-full origin-left rounded-full bg-ink-strong motion-safe:transition-[scale] motion-safe:duration-300 motion-safe:ease-out"
              style={{ scale: `${(index + 1) / STAGES.length} 1` }}
            />
          </div>
          <nav aria-label="Demo steps" className="hidden pt-4 lg:block">
            <ol className="flex flex-col gap-1">
              {STAGES.map((item, position) => {
                const open = position <= reached;
                const here = item.key === stage;
                return (
                  <li key={item.key}>
                    <button
                      type="button"
                      disabled={!open}
                      aria-current={here ? "step" : undefined}
                      onClick={() => go(item.key)}
                      className={cx(
                        "flex min-h-9 w-full items-center gap-3 rounded-md px-2 text-start text-body-sm -outline-offset-2",
                        here ? "bg-surface-2 text-ink-strong" : open ? "text-ink hover:bg-surface-2" : "cursor-default text-ink-subtle",
                      )}
                    >
                      <span
                        className={cx(
                          "inline-flex size-5 shrink-0 items-center justify-center rounded-full text-label-sm tabular-nums",
                          position < reached || (position === reached && !here) ? "bg-ink-strong text-on-inverse" : "border border-control-border",
                        )}
                      >
                        {position < reached ? <CheckIcon width={12} height={12} /> : position + 1}
                      </span>
                      {item.label}
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>
        </div>

        <section aria-labelledby="stage-title" className="min-w-0 lg:col-span-9">
          <h1 id="stage-title" ref={heading} tabIndex={-1} className="pb-2 text-headline text-ink-strong outline-none">
            {titles[current.key]}
          </h1>

          {stage === "connect" ? (
            <ConnectStage
              connected={isConnected}
              onAevum={onAevum}
              address={address}
              onWallet={() => {
                setMode("wallet");
                go("start");
              }}
              onSample={() => {
                setMode("sample");
                go("start");
              }}
            />
          ) : null}
          {stage === "start" ? <StartStage you={you} nameOf={nameOf} live={live} onDone={() => go("cash")} /> : null}
          {stage === "cash" ? (
            <CashStage you={you} at={at} cash={cash} setCash={setCash} nameOf={nameOf} onNext={() => go("settle")} />
          ) : null}
          {stage === "settle" ? (
            <SettleStage you={you} at={at} cash={cash} nameOf={nameOf} live={live} onDone={() => go("receipt")} />
          ) : null}
          {stage === "receipt" ? (
            <ReceiptStage cash={cash} live={live} onSafety={() => go("safety")} onRestart={restart} />
          ) : null}
          {stage === "safety" ? (
            <SafetyStage
              you={you}
              at={at}
              live={mode === "wallet" && liveDemo.attacksReady ? liveDemo : undefined}
              onRestart={restart}
            />
          ) : null}
        </section>
      </main>
    </div>
  );
}

const titles: Record<Stage, string> = {
  connect: "Settle real debt in about a minute",
  start: "Start the demo",
  cash: "Choose how much cash Ada spends",
  settle: "Sign and settle",
  receipt: "Settled",
  safety: "Try to break it",
};

function Lede({ children }: { children: ReactNode }) {
  return <p className="max-w-measure pb-8 text-body-lg text-pretty text-ink">{children}</p>;
}

/** Before a real wallet prompt in the live demo. */
function LiveSignNote() {
  return (
    <p className="flex items-start gap-2 rounded-lg bg-info-fill p-3 text-body-sm text-on-info">
      <AlertIcon className="mt-0.5 shrink-0" />
      Your wallet will ask you to sign. Check that the details there match these.
    </p>
  );
}

function LiveError({ live }: { live?: LiveDemo }) {
  if (!live?.error) return null;
  return (
    <p role="alert" className="flex items-start gap-2 text-body-sm text-on-danger">
      <AlertIcon className="mt-0.5 shrink-0" />
      {live.error}
    </p>
  );
}

function TxLinks({ links }: { links: [string, `0x${string}` | undefined][] }) {
  const shown = links.filter((link): link is [string, `0x${string}`] => Boolean(link[1]));
  if (shown.length === 0) return null;
  return (
    <ul className="flex flex-col gap-2">
      {shown.map(([label, hash]) => (
        <li key={hash}>
          <a
            href={txUrl(hash)}
            target="_blank"
            rel="noopener"
            className="inline-flex min-h-6 items-center gap-1 text-body-sm text-link underline underline-offset-4 hover:text-primary-hover"
          >
            {label}
            <span className="sr-only"> (opens in a new tab)</span>
            <ExternalIcon className="shrink-0" />
          </a>
        </li>
      ))}
    </ul>
  );
}

/** Stands in for the wallet prompt a live demo shows. */
function SampleSignNote() {
  return (
    <p className="flex items-start gap-2 rounded-lg bg-info-fill p-3 text-body-sm text-on-info">
      <AlertIcon className="mt-0.5 shrink-0" />
      Sample data: this stands in for your wallet’s signature prompt. Nothing is signed or sent.
    </p>
  );
}

function ConnectStage({
  connected,
  onAevum,
  address,
  onWallet,
  onSample,
}: {
  connected: boolean;
  onAevum: boolean;
  address: string | undefined;
  onWallet: () => void;
  onSample: () => void;
}) {
  return (
    <>
      <Lede>
        You play Ada’s Bakery. Ben’s Farm and Chidi Transport are demo counterparties run by Salda. Three shops owe each other 0.15
        tUSD8, and you will settle all of it with 0.02. You pay no network fee.
      </Lede>
      <div className="grid gap-4 md:grid-cols-2">
        <Panel heading="h2" title="With your wallet" description="Two signatures in total. Salda pays every network fee.">
          <div className="flex flex-col items-start gap-4">
            {!connected ? (
              <WalletButton primary />
            ) : onAevum ? (
              <>
                <p className="flex items-center gap-2 text-body-sm text-ink">
                  <CheckIcon className="shrink-0" />
                  Connected on {aevum.name}
                  <span className="sr-only">as {address}</span>
                </p>
                <Button variant="primary" size="lg" onClick={onWallet}>
                  Continue with this wallet
                </Button>
              </>
            ) : (
              <p className="text-body-sm text-ink">Switch your wallet to {aevum.name} to continue. Use the button at the top of the page.</p>
            )}
            <a
              href="https://ethereum.org/en/wallets/find-wallet/"
              rel="noopener"
              className="inline-flex items-center gap-1 text-body-sm text-link underline underline-offset-4 hover:text-primary-hover"
            >
              How to get a wallet
              <ExternalIcon className="shrink-0" />
            </a>
          </div>
        </Panel>
        <Panel heading="h2" title="Without a wallet" description="Walk through every step with sample data. Nothing touches the network.">
          <Button size="lg" onClick={onSample}>
            Continue with sample data
          </Button>
        </Panel>
      </div>
    </>
  );
}

/** Runs a list of steps one after another, like a live submission would report them. */
function useSequence(steps: number, gapMs: number) {
  const [done, setDone] = useState(-1);
  const [started, setStarted] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach((timer) => window.clearTimeout(timer)), []);

  const run = () => {
    if (started) return;
    setStarted(true);
    for (let step = 0; step < steps; step += 1) {
      timers.current.push(window.setTimeout(() => setDone(step), gapMs * (step + 1)));
    }
  };
  return { done, run, started };
}

function Progress({ steps, done, running }: { steps: readonly string[]; done: number; running: boolean }) {
  const active = steps[done + 1];
  return (
    <div className="flex flex-col gap-3">
      <ol className="rounded-lg border border-hairline">
        {steps.map((step, position) => {
          const finished = position <= done;
          const working = running && position === done + 1;
          return (
            <li
              key={step}
              className={cx(
                "flex min-h-11 items-center gap-3 border-t border-hairline px-3 py-2 text-body-sm first:border-t-0",
                finished ? "text-ink-strong" : working ? "text-ink" : "text-ink-subtle",
              )}
            >
              <span aria-hidden="true" className="inline-flex size-5 shrink-0 items-center justify-center">
                {finished ? <CheckIcon /> : working ? <SpinnerIcon /> : <span className="size-1.5 rounded-full bg-control-border" />}
              </span>
              {step}
            </li>
          );
        })}
      </ol>
      <p role="status" className="sr-only">
        {done >= steps.length - 1 ? "All steps finished." : running && active ? `${active}…` : ""}
      </p>
    </div>
  );
}

function StartStage({
  you,
  nameOf,
  live,
  onDone,
}: {
  you: Address;
  nameOf: (member: Address) => string;
  live?: LiveDemo;
  onDone: () => void;
}) {
  const steps = ["Circle created for the three shops", "Three invoices registered and signed by all three", "0.02 tUSD8 sent to your wallet"] as const;
  const sample = useSequence(steps.length, 800);
  const [running, setRunning] = useState(false);
  const sequence = live ? { done: live.startDone, started: running || live.startDone >= 0 } : sample;
  const finished = sequence.done >= steps.length - 1;
  const invoices = demoInvoices(you, 0);

  return (
    <>
      <Lede>One signature co-signs the three invoices and proves this wallet is yours. Salda then sets everything up.</Lede>
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel heading="h2" title="The three invoices">
          <KeyValues
            rows={invoices.map((invoice) => [
              `${nameOf(invoice.debtor)} owes ${nameOf(invoice.creditor)}`,
              <Amount key={`${invoice.id}`} value={formatAmount(invoice.amount)} />,
            ])}
          />
        </Panel>
        <Panel heading="h2" title="Setup">
          <div className="flex flex-col items-start gap-4">
            <Progress steps={steps} done={sequence.done} running={sequence.started && !finished && !live?.error} />
            <LiveError live={live} />
            {live && finished && !live.seeded ? (
              <p className="text-body-sm text-ink">
                Today’s limit for free test tokens was reached, so none were sent. You can still settle with 0.00 cash.
              </p>
            ) : null}
            {live ? (
              <TxLinks
                links={[
                  ["Circle created", live.txs.create],
                  ["Invoices registered", live.txs.register],
                  ["0.02 tUSD8 sent", live.txs.seed],
                ]}
              />
            ) : null}
            {finished ? (
              <Button variant="primary" size="lg" onClick={onDone}>
                Choose your cash
              </Button>
            ) : (
              <ConfirmDialog
                trigger={sequence.started ? "Setting up…" : "Start live demo"}
                triggerVariant="primary"
                triggerSize="lg"
                title="Sign to start the demo"
                description="Your wallet asks you to sign one message. It co-signs the invoices you are part of."
                confirm="Sign"
                onConfirm={async () => {
                  if (!live) return sample.run();
                  setRunning(true);
                  await live.start();
                  setRunning(false);
                }}
              >
                {live ? <LiveSignNote /> : <SampleSignNote />}
                <KeyValues
                  rows={[
                    ["Message", "Register 3 invoices"],
                    ["You owe Ben", <Amount key="owe" value="0.06" />],
                    ["Chidi owes you", <Amount key="owed" value="0.04" />],
                    ["Network", aevum.name],
                    ["Network fee", "Paid by Salda"],
                  ]}
                />
              </ConfirmDialog>
            )}
          </div>
        </Panel>
      </div>
    </>
  );
}

function CashStage({
  you,
  at,
  cash,
  setCash,
  nameOf,
  onNext,
}: {
  you: Address;
  at: number;
  cash: bigint;
  setCash: (cash: bigint) => void;
  nameOf: (member: Address) => string;
  onNext: () => void;
}) {
  const labelId = useId();
  const [typed, setTyped] = useState(formatAmount(cash));
  const round = demoRound(cash);
  const plan = demoPlan(you, cash, at);
  const parsed = parseAmount(typed);
  const error = parsed === null || parsed > DEMO_MAX_CASH ? "Enter an amount from 0 to 0.02." : undefined;

  return (
    <>
      <Lede>
        Move the slider and watch what clears. With no cash at all, 0.12 still cancels out. With 0.02, all 0.15 clears.
      </Lede>
      <div className="grid gap-6 xl:grid-cols-12">
        <div className="min-w-0 xl:col-span-7">
          <Panel heading="h2" title="What this leaves" description="Dark is debt left. Under each name is what they pay or receive.">
            <DebtGraph plan={plan} invoices={demoInvoices(you, at)} nameOf={nameOf} />
          </Panel>
        </div>
        <div className="flex flex-col gap-6 xl:col-span-5">
          <Panel heading="h2" title="Ada’s cash">
            <div className="flex flex-col gap-4">
              <span id={labelId} className="sr-only">
                Ada’s cash
              </span>
              <Slider
                min={0}
                max={Number(DEMO_MAX_CASH / MILLI)}
                step={1}
                value={Number(cash / MILLI)}
                labelledBy={labelId}
                valueText={`${formatAmount(cash)} tUSD8, clears ${formatAmount(round.totalCleared)} of ${formatAmount(round.totalOwed)}`}
                onValueChange={(thousandths) => {
                  const next = BigInt(thousandths) * MILLI;
                  setCash(next);
                  setTyped(formatAmount(next));
                }}
              />
              <Field
                label="Or type an amount"
                inputMode="decimal"
                autoComplete="off"
                numeric
                suffix="tUSD8"
                value={typed}
                error={error}
                help="From 0 to 0.02"
                onChange={(event) => {
                  const text = event.currentTarget.value;
                  setTyped(text);
                  const next = parseAmount(text);
                  if (next !== null && next <= DEMO_MAX_CASH) setCash(next);
                }}
              />
            </div>
          </Panel>
          <Panel heading="h2" title="This round">
            <div className="flex flex-col items-start gap-4">
              <div className="w-full">
                <KeyValues
                  rows={[
                    ["Debt cleared", <Amount key="gross" value={`${formatAmount(round.totalCleared)} of ${formatAmount(round.totalOwed)}`} />],
                    ["You pay", <Amount key="pay" value={formatAmount(round.cashUsed)} />],
                    ["Ben receives", <Amount key="ben" value={formatAmount(round.cashToBen)} />],
                    ["Chidi receives", <Amount key="chidi" value={formatAmount(round.cashToChidi)} />],
                  ]}
                />
              </div>
              <Button variant="primary" size="lg" icon={<SignIcon />} onClick={onNext} disabled={Boolean(error)}>
                Review and sign
              </Button>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}

function SettleStage({
  you,
  at,
  cash,
  nameOf,
  live,
  onDone,
}: {
  you: Address;
  at: number;
  cash: bigint;
  nameOf: (member: Address) => string;
  live?: LiveDemo;
  onDone: () => void;
}) {
  const round = demoRound(cash);
  const plan = demoPlan(you, cash, at);
  const mine = plan.positions.find((position) => position.member === you);
  const steps = ["You signed", "Ben and Chidi signed (demo counterparties)", `Submitting to ${aevum.name}`, "Settled"] as const;
  const sample = useSequence(steps.length, 900);
  const [running, setRunning] = useState(false);
  const sequence = live ? { done: live.settleDone, started: running || live.settleDone >= 0 } : sample;
  // Once a live round is sent, its receipt can show even while it is still confirming.
  const finished = sequence.done >= steps.length - 1 || (live !== undefined && live.settleDone >= 2);

  return (
    <>
      <Lede>
        Your signature authorizes exactly {formatAmount(round.cashUsed)} tUSD8, for this round only. Nothing moves unless all three
        shops sign.
      </Lede>
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel heading="h2" title="What you agree to">
          <KeyValues
            rows={[
              ["You pay", <Amount key="pay" value={formatAmount(round.cashUsed)} />],
              ["Your debt cleared", <Amount key="out" value={formatAmount(mine?.out ?? 0n)} />],
              ["Owed to you, cleared", <Amount key="in" value={formatAmount(mine?.in ?? 0n)} />],
              ["Debt cleared for all three", <Amount key="gross" value={formatAmount(round.totalCleared)} />],
              ["Network fee", "Paid by Salda"],
            ]}
          />
        </Panel>
        <Panel heading="h2" title="Settlement">
          <div className="flex flex-col items-start gap-4">
            <Progress steps={steps} done={sequence.done} running={sequence.started && !finished && !live?.error} />
            <LiveError live={live} />
            {finished ? (
              <Button variant="primary" size="lg" onClick={onDone}>
                View receipt
              </Button>
            ) : (
              <ConfirmDialog
                trigger={sequence.started ? "Settling…" : "Sign and settle"}
                triggerVariant="primary"
                triggerSize="lg"
                title={round.cashUsed > 0n ? `Pay ${formatAmount(round.cashUsed)} tUSD8?` : "Approve this round?"}
                description={`Clears ${formatAmount(round.totalCleared)} of debt between ${nameOf(you)}, Ben and Chidi.`}
                confirm={round.cashUsed > 0n ? `Sign and pay ${formatAmount(round.cashUsed)} tUSD8` : "Sign approval"}
                onConfirm={async () => {
                  if (!live) return sample.run();
                  setRunning(true);
                  await live.settle(cash);
                  setRunning(false);
                }}
              >
                {live ? <LiveSignNote /> : <SampleSignNote />}
                <KeyValues
                  rows={[
                    ["Authorizes", round.cashUsed > 0n ? `${formatAmount(round.cashUsed)} tUSD8, this round only` : "No payment"],
                    ["Paid to", "The shops you owe, in one step"],
                    ["Valid for", "1 hour"],
                  ]}
                />
              </ConfirmDialog>
            )}
          </div>
        </Panel>
      </div>
    </>
  );
}

function ReceiptStage({
  cash,
  live,
  onSafety,
  onRestart,
}: {
  cash: bigint;
  live?: LiveDemo;
  onSafety: () => void;
  onRestart: () => void;
}) {
  const round = demoRound(cash);
  const ratio = round.cashUsed === 0n ? "No cash used" : `${(Number(round.totalCleared) / Number(round.cashUsed)).toFixed(1)}×`;

  return (
    <>
      <Lede>All three shops’ invoices were cleared together, in one step. Here is what happened.</Lede>
      <div className="flex flex-col gap-6">
        <dl className="grid gap-px overflow-hidden rounded-lg border border-hairline bg-hairline sm:grid-cols-3">
          {[
            ["Debt cleared", formatAmount(round.totalCleared)],
            ["Cash used", formatAmount(round.cashUsed)],
            ["Cleared per 1.00 of cash", ratio],
          ].map(([label, value]) => (
            <div key={label} className="flex flex-col gap-1 bg-canvas p-4 sm:p-5">
              <dt className="text-label text-ink-subtle">{label}</dt>
              <dd className="text-numeric text-ink-strong tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        <Panel heading="h2" title="Each shop">
          <KeyValues
            rows={[
              ["Ada (you) paid", <Amount key="ada" value={formatAmount(round.cashUsed)} />],
              ["Ben received", <Amount key="ben" value={formatAmount(round.cashToBen)} />],
              ["Chidi received", <Amount key="chidi" value={formatAmount(round.cashToChidi)} />],
              ["Debt left between them", <Amount key="left" value={formatAmount(round.totalOwed - round.totalCleared)} />],
            ]}
          />
        </Panel>
        {live ? (
          <div className="flex flex-col gap-2">
            {live.settled?.state === "pending" ? (
              <p role="status" className="text-body-sm text-ink">
                Sent, and still confirming. The link below works once it does.
              </p>
            ) : null}
            <TxLinks links={[["View the settlement on the Aevum explorer", live.txs.settle]]} />
          </div>
        ) : (
          <p className="text-body-sm text-ink-subtle">
            Sample data: there is no transaction to view. With a live wallet, this links to the {aevum.name} explorer.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" size="lg" onClick={onSafety}>
            Try the safety checks
          </Button>
          <Button size="lg" icon={<PlayIcon />} onClick={onRestart}>
            Start again
          </Button>
        </div>
      </div>
    </>
  );
}

function SafetyStage({ you, at, live, onRestart }: { you: Address; at: number; live?: LiveDemo; onRestart: () => void }) {
  const [revoked, setRevoked] = useState(false);
  const [choice, setChoice] = useState(attacks[1]?.key ?? "ratio");
  const [phase, setPhase] = useState<"idle" | "checking" | "done">("idle");
  const [liveResult, setLiveResult] = useState<AttackResult | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const mandate = demoMandate(you, at, revoked);
  const attack = attacks.find((item) => item.key === choice) ?? attacks[0];
  // Live: the agent signs the bad round and it is simulated against the deployed contract. Nothing is sent.
  const result = live
    ? liveResult?.refused
      ? { reason: liveResult.message, revert: liveResult.revert ?? "Reverted" }
      : null
    : attack
      ? checkAttack(attack, you, at, revoked)
      : null;

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const check = async () => {
    window.clearTimeout(timer.current);
    setPhase("checking");
    if (live && attack) {
      const answer = await live.attack(attack.key, revoked);
      setLiveResult(answer);
      setPhase(answer ? "done" : "idle");
      return;
    }
    timer.current = window.setTimeout(() => setPhase("done"), 900);
  };

  return (
    <>
      <Lede>
        Your mandate lets an agent agree to rounds for you, inside your limits. Below, a simulated compromised agent tries to break
        them. Each proposal goes through the same checks the contract makes.
      </Lede>
      <div className="grid gap-6 xl:grid-cols-12">
        <div className="flex flex-col gap-6 xl:col-span-5">
          <Panel heading="h2" title="Your mandate" action={revoked ? <Badge tone="danger">Revoked</Badge> : <Badge tone="success">Active</Badge>}>
            <div className="flex flex-col items-start gap-4">
              <div className="w-full">
                <KeyValues
                  rows={[
                    ["Most you pay in one round", <Amount key="round" value={formatAmount(mandate.maxNetDebitPerRound)} />],
                    ["Most you pay in total", <Amount key="total" value={formatAmount(mandate.totalCap)} />],
                    ["Least cleared for every 1.00 you pay", formatRatio(mandate.minClearRatioBps)],
                    ["Clears invoices due within", `${mandate.maxDueDays} days`],
                  ]}
                />
              </div>
              {revoked ? (
                <Button
                  onClick={() => {
                    setRevoked(false);
                    setPhase("idle");
                  }}
                >
                  Turn the mandate back on
                </Button>
              ) : (
                <ConfirmDialog
                  trigger="Revoke mandate"
                  triggerVariant="danger"
                  title="Revoke your mandate?"
                  description="The agent can no longer agree to any round for you. It takes effect at once, with no network fee."
                  confirm="Sign and revoke mandate"
                  confirmVariant="danger"
                  onConfirm={() => {
                    setRevoked(true);
                    setPhase("idle");
                  }}
                >
                  <SampleSignNote />
                </ConfirmDialog>
              )}
            </div>
          </Panel>
        </div>

        <div className="flex flex-col gap-6 xl:col-span-7">
          <Panel heading="h2" title="Simulated compromised agent" description="Pick what the agent tries, then send it to the contract.">
            <div className="flex flex-col items-start gap-4">
              <ChoiceGroup legend="The agent proposes">
                {attacks.map((item) => (
                  <Radio
                    key={item.key}
                    name="attack"
                    label={item.label}
                    description={item.claim}
                    checked={choice === item.key}
                    onChange={() => {
                      setChoice(item.key);
                      setPhase("idle");
                    }}
                  />
                ))}
              </ChoiceGroup>
              <Button variant="primary" size="lg" icon={<PlayIcon />} loading={phase === "checking"} onClick={() => void check()}>
                Send to the contract
              </Button>
            </div>
          </Panel>

          <LiveError live={live} />
          <div role="status">
            {phase === "checking" ? (
              <p className="flex items-center gap-2 text-body-sm text-ink">
                <SpinnerIcon className="shrink-0" />
                The contract is checking the round against your mandate…
              </p>
            ) : null}
            {phase === "done" && attack ? (
              result ? (
                <div className="flex flex-col gap-3 rounded-lg bg-danger-fill p-4 text-on-danger">
                  <p className="flex flex-wrap items-center gap-2 text-title-sm">
                    <AlertIcon className="shrink-0" />
                    Refused. 0.00 tUSD8 moved.
                  </p>
                  <p className="text-body-sm">{result.reason}</p>
                  <p className="text-body-sm">
                    Contract error <code className="rounded-xs bg-canvas px-1 font-mono text-mono">{result.revert}</code>
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2 rounded-lg bg-success-fill p-4 text-on-success">
                  <p className="flex items-center gap-2 text-title-sm">
                    <CheckIcon className="shrink-0" />
                    Allowed. It is inside every limit you set.
                  </p>
                  <p className="text-body-sm">{attack.claim}</p>
                </div>
              )
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="lg" icon={<PlayIcon />} onClick={onRestart}>
              Start again
            </Button>
            <Link href="/app" className={buttonClass({ variant: "ghost", size: "lg" })}>
              Open the app
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
