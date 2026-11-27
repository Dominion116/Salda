"use client";

import Link from "next/link";
import { useSalda } from "@/client/provider";
import { AddressText, PageHeader } from "@/components/app/parts";
import { buttonClass } from "@/components/ui/button-class";
import { EmptyState, Panel } from "@/components/ui/data";

/** Shown on every app screen except Circle and Settings while this business is not in any circle yet. */
export function NoCircle() {
  const { me } = useSalda();
  return (
    <>
      <PageHeader
        title="Welcome to Salda"
        description="Everything in Salda happens inside a circle: a private group of businesses whose debts clear together."
      />
      <Panel>
        <EmptyState
          title="You’re not in a circle yet"
          action={
            <div className="flex flex-col items-center gap-3">
              <Link href="/app/circle" className={buttonClass({ variant: "primary", size: "lg" })}>
                Create a circle
              </Link>
              <AddressText address={me} />
            </div>
          }
        >
          Create one and add the businesses you trade with. Or send a circle admin your wallet address, below, so they can
          add you.
        </EmptyState>
      </Panel>
    </>
  );
}
