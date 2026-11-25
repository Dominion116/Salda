"use client";

import Link from "next/link";
import { nameIn, useAgentEvents, useChange, useCircle, useMandates, useSalda } from "@/client/provider";
import type { AgentEvent, Circle } from "@/client/types";
import { KeyValues, Loaded, PageHeader } from "@/components/app/parts";
import { Button } from "@/components/ui/button";
import { buttonClass } from "@/components/ui/button-class";
import { Badge, EmptyState, Panel, type BadgeTone } from "@/components/ui/data";
import { PlayIcon } from "@/components/ui/icons";
import { formatTime } from "@/lib/format";
import { formatAmount } from "@/lib/money";

const kinds: Record<AgentEvent["kind"], { label: string; tone: BadgeTone }> = {
  proposed: { label: "Proposed", tone: "info" },
  settled: { label: "Settled", tone: "success" },
  rejected: { label: "Refused", tone: "danger" },
};

export function AgentScreen() {
  const { circleId } = useSalda();
  const circle = useCircle();
  const events = useAgentEvents();
  const run = useChange(
    (client) => client.runAgent(circleId),
    (event) => event.summary,
  );

  const runButton = (
    <Button variant="primary" icon={<PlayIcon />} loading={run.busy} onClick={() => void run.run()}>
      Run clearing now
    </Button>
  );

  return (
    <>
      <PageHeader
        title="Agent"
        description="Plans rounds and agrees for members who set a mandate. It holds no money and can’t go past anyone’s limits."
        action={runButton}
      />
      <div className="grid gap-6 xl:grid-cols-12">
        <div className="min-w-0 xl:col-span-7">
          <Panel heading="h2" title="Activity">
            <Loaded query={events} what="agent activity">
              {(all) =>
                all.length === 0 ? (
                  <EmptyState
                    title="The agent hasn’t run yet"
                    action={
                      <Link href="/app/mandate" className={buttonClass()}>
                        Set your mandate
                      </Link>
                    }
                  >
                    Run it now to propose a round. It settles on its own only when every business has a mandate.
                  </EmptyState>
                ) : (
                  <ol className="rounded-lg border border-hairline">
                    {all.map((event) => (
                      <li key={event.key} className="flex flex-col gap-1 border-t border-hairline px-3 py-3 text-body-sm first:border-t-0">
                        <span className="flex flex-wrap items-center justify-between gap-2">
                          <Badge tone={kinds[event.kind].tone}>{kinds[event.kind].label}</Badge>
                          <span className="text-caption text-ink-subtle">{formatTime(event.at)}</span>
                        </span>
                        <span className="text-ink-strong">{event.summary}</span>
                      </li>
                    ))}
                  </ol>
                )
              }
            </Loaded>
          </Panel>
        </div>
        <div className="flex min-w-0 flex-col gap-6 xl:col-span-5">
          <Loaded query={circle} what="your circle">
            {(data) => <Mandates circle={data} />}
          </Loaded>
          <Panel heading="h2" title="What the agent can do">
            <KeyValues
              rows={[
                ["Plan a round", "Yes"],
                ["Agree for you, inside your mandate", "Yes"],
                ["Hold your money", "No"],
                ["Pay more than your limits", "No"],
                ["Agree after you revoke", "No"],
              ]}
            />
          </Panel>
        </div>
      </div>
    </>
  );
}

function Mandates({ circle }: { circle: Circle }) {
  const active = circle.members.filter((member) => member.active);
  const mandates = useMandates(active.map((member) => member.address));
  const nameOf = nameIn(circle);

  return (
    <Panel heading="h2" title="Mandates in this circle">
      <Loaded query={mandates} what="mandates">
        {(all) => (
          <KeyValues
            rows={active.map((member, index) => {
              const mandate = all[index];
              const usable = mandate?.state === "active" && mandate.circleId === circle.id;
              return [
                nameOf(member.address),
                usable ? (
                  <span key={member.address} className="inline-flex flex-wrap items-center justify-end gap-2">
                    <span className="text-caption text-ink-subtle">Up to {formatAmount(mandate.maxNetDebitPerRound)} a round</span>
                    <Badge tone="success">Active</Badge>
                  </span>
                ) : (
                  <Badge key={member.address}>None</Badge>
                ),
              ] as const;
            })}
          />
        )}
      </Loaded>
    </Panel>
  );
}
