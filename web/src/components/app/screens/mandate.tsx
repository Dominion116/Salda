"use client";

import { useState, type FormEvent } from "react";
import { useChange, useMandate, useSalda } from "@/client/provider";
import type { Mandate, MandateTerms } from "@/client/types";
import { AddressText, KeyValues, Loaded, PageHeader } from "@/components/app/parts";
import { Button } from "@/components/ui/button";
import { Amount, Badge, Panel } from "@/components/ui/data";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { SignIcon } from "@/components/ui/icons";
import { dateFieldValue, endOfDay, formatDate, formatRatio } from "@/lib/format";
import { formatAmount, parseAmount } from "@/lib/money";

export function MandateScreen() {
  const { me } = useSalda();
  const mandate = useMandate(me);

  return (
    <>
      <PageHeader
        title="Mandate"
        description="Set your limits once, and the agent can agree to rounds for you inside them. You can revoke it any time."
      />
      <Loaded query={mandate} what="your mandate">
        {(data) =>
          data?.state === "active" ? (
            <ActiveMandate mandate={data} />
          ) : (
            <div className="flex flex-col gap-6">
              {data ? (
                <p role="status" className="text-body-sm text-ink">
                  Your last mandate was {data.state === "revoked" ? "revoked" : "valid until it expired"}. Set new limits to start another.
                </p>
              ) : null}
              <MandateForm key={me} />
            </div>
          )
        }
      </Loaded>
    </>
  );
}

function Terms({ terms, spent }: { terms: MandateTerms; spent?: bigint }) {
  return (
    <KeyValues
      rows={[
        ["Most you pay in one round", <Amount key="round" value={formatAmount(terms.maxNetDebitPerRound)} />],
        ["Most you pay in total", <Amount key="total" value={formatAmount(terms.totalCap)} />],
        ...(spent === undefined ? [] : [["Paid so far", <Amount key="spent" value={formatAmount(spent)} />] as const]),
        ["Clears invoices due within", `${terms.maxDueDays} days`],
        [
          "Least cleared for every 1.00 you pay",
          terms.minClearRatioBps === 0 ? "No minimum" : `${formatAmount(BigInt(terms.minClearRatioBps) * 100n)} (${formatRatio(terms.minClearRatioBps)})`,
        ],
        ["Wait between rounds", terms.minCooldown === 0 ? "None" : `${terms.minCooldown / 3600} hours`],
        ["Ends", formatDate(terms.expiry)],
        ["Agent", <AddressText key="agent" address={terms.agent} />],
      ]}
    />
  );
}

function ActiveMandate({ mandate }: { mandate: Mandate }) {
  const { me } = useSalda();
  const revoke = useChange((client) => client.revokeMandate(me), "Mandate revoked");
  const share = mandate.totalCap === 0n ? 0 : Number((mandate.spent * 100n) / mandate.totalCap);

  return (
    <div className="flex max-w-measure flex-col gap-6">
      <Panel heading="h2" title="Your mandate" action={<Badge tone="success">Active</Badge>}>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <p className="text-body-sm text-ink">
              {formatAmount(mandate.spent)} of {formatAmount(mandate.totalCap)} tUSD8 used
            </p>
            <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full origin-left rounded-full bg-primary" style={{ transform: `scaleX(${share / 100})` }} />
            </div>
          </div>
          <Terms terms={mandate} spent={mandate.spent} />
        </div>
      </Panel>
      <Panel
        heading="h2"
        title="Revoke"
        description="Takes effect at once and costs no network fee. Any mandate you signed but never used is cancelled too."
      >
        <ConfirmDialog
          trigger="Revoke mandate"
          triggerVariant="danger"
          title="Revoke your mandate?"
          description="The agent can no longer agree to rounds for you. Rounds it already agreed to will fail if they have not settled."
          confirm="Sign and revoke mandate"
          confirmVariant="danger"
          onConfirm={async () => (await revoke.run()) !== undefined}
        />
      </Panel>
    </div>
  );
}

type Errors = Partial<Record<"round" | "total" | "days" | "ratio" | "hours" | "ends", string>>;

function MandateForm() {
  const { me, circleId } = useSalda();
  const [round, setRound] = useState("2.00");
  const [total, setTotal] = useState("10.00");
  const [days, setDays] = useState("30");
  const [ratio, setRatio] = useState("3");
  const [hours, setHours] = useState("0");
  const [ends, setEnds] = useState(() => dateFieldValue(90));
  const [errors, setErrors] = useState<Errors>({});
  const [review, setReview] = useState<MandateTerms | null>(null);
  const activate = useChange(
    (client, terms: MandateTerms) => client.activateMandate(terms),
    "Mandate active. You can revoke it at any time.",
  );

  const read = (form: HTMLFormElement) => {
    const roundUnits = parseAmount(round);
    const totalUnits = parseAmount(total);
    const dayCount = /^\d{1,3}$/.test(days) ? Number(days) : null;
    const ratioValue = /^\d{1,3}(\.\d{1,2})?$/.test(ratio) ? Math.round(Number(ratio) * 10_000) : null;
    const hourCount = /^\d{1,3}$/.test(hours) ? Number(hours) : null;
    const expiry = endOfDay(ends);
    const found: Errors = {
      round: roundUnits === null ? "Enter an amount of 0 or more." : undefined,
      total:
        totalUnits === null
          ? "Enter an amount of 0 or more."
          : roundUnits !== null && totalUnits < roundUnits
            ? "Enter at least the limit for one round."
            : undefined,
      days: dayCount === null || dayCount < 1 ? "Enter 1 to 999 days." : undefined,
      ratio: ratioValue === null ? "Enter a number such as 3, or 0 for no minimum." : undefined,
      hours: hourCount === null ? "Enter 0 to 999 hours." : undefined,
      ends: expiry === null || expiry <= Date.now() / 1000 ? "Enter a date from today on." : undefined,
    };
    setErrors(found);
    if (
      roundUnits === null ||
      totalUnits === null ||
      dayCount === null ||
      ratioValue === null ||
      hourCount === null ||
      expiry === null ||
      Object.values(found).some(Boolean)
    ) {
      requestAnimationFrame(() => form.querySelector<HTMLElement>("[aria-invalid=true]")?.focus());
      return;
    }
    setReview({
      circleId,
      member: me,
      // The live client signs the mandate for this server's agent key, read from /api/agent.
      agent: "0x0000000000000000000000000000000000000000",
      agentId: 0n,
      maxNetDebitPerRound: roundUnits,
      totalCap: totalUnits,
      maxDueDays: dayCount,
      minClearRatioBps: ratioValue,
      minCooldown: hourCount * 3600,
      expiry,
    });
  };

  if (review) {
    return (
      <div className="flex max-w-measure flex-col gap-6">
        <Panel
          heading="h2"
          title="Review your limits"
          description="Every round the agent agrees to is checked against these. A round that breaks one is refused whole."
        >
          <Terms terms={review} />
        </Panel>
        <p className="text-body-sm text-ink-subtle">
          {review.maxNetDebitPerRound > 0n
            ? "You will sign twice: once for these limits, and once to let Salda pull up to the total limit of tUSD8."
            : "You will sign once. No tUSD8 can be pulled, because the limit for one round is 0."}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="primary"
            size="lg"
            icon={<SignIcon />}
            loading={activate.busy}
            onClick={() => void activate.run(review)}
          >
            Sign and activate mandate
          </Button>
          <Button variant="ghost" size="lg" onClick={() => setReview(null)}>
            Change limits
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      noValidate
      className="flex max-w-measure flex-col gap-6"
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        read(event.currentTarget);
      }}
    >
      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="Most you pay in one round" inputMode="decimal" autoComplete="off" numeric suffix="tUSD8" help="0 means the agent can never spend your cash." value={round} error={errors.round} onChange={(event) => setRound(event.currentTarget.value)} />
        <Field label="Most you pay in total" inputMode="decimal" autoComplete="off" numeric suffix="tUSD8" help="Across every round, until it ends." value={total} error={errors.total} onChange={(event) => setTotal(event.currentTarget.value)} />
        <Field label="Least cleared for every 1.00 you pay" inputMode="decimal" autoComplete="off" numeric suffix="×" help="3 means at least 3.00 of your debt clears." value={ratio} error={errors.ratio} onChange={(event) => setRatio(event.currentTarget.value)} />
        <Field label="Clear invoices due within" inputMode="numeric" autoComplete="off" numeric suffix="days" help="Later invoices are left alone." value={days} error={errors.days} onChange={(event) => setDays(event.currentTarget.value)} />
        <Field label="Wait between rounds" inputMode="numeric" autoComplete="off" numeric suffix="hours" help="0 for no wait." value={hours} error={errors.hours} onChange={(event) => setHours(event.currentTarget.value)} />
        <Field label="Ends" type="date" autoComplete="off" value={ends} error={errors.ends} onChange={(event) => setEnds(event.currentTarget.value)} />
      </div>
      <div>
        <Button type="submit" variant="primary" size="lg">
          Review limits
        </Button>
      </div>
    </form>
  );
}
