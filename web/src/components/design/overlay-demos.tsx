"use client";

import { Button } from "@/components/ui/button";
import { Amount } from "@/components/ui/data";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";

export function OverlayDemos() {
  const show = useToast();

  return (
    <div className="flex flex-wrap gap-2">
      <ConfirmDialog
        trigger="Open the consent dialog"
        title="Sign this round?"
        description="Sample data. You pay Ben’s Farm and Chidi Transport through one settlement. Nothing moves unless everyone signs."
        confirm="Sign and pay 2.00 tUSD8"
        onConfirm={() => show({ tone: "success", message: "Consent signed. Sample data, nothing was sent." })}
      >
        <dl className="rounded-lg border border-hairline">
          <div className="flex min-h-10 items-center justify-between gap-4 border-b border-hairline px-3 text-body-sm">
            <dt className="text-ink-subtle">You pay</dt>
            <dd>
              <Amount value="2.00" />
            </dd>
          </div>
          <div className="flex min-h-10 items-center justify-between gap-4 px-3 text-body-sm">
            <dt className="text-ink-subtle">Your debt cleared</dt>
            <dd>
              <Amount value="6.00" />
            </dd>
          </div>
        </dl>
      </ConfirmDialog>
      <Button onClick={() => show({ tone: "success", message: "Invoice added to Market Street circle" })}>
        Show a success toast
      </Button>
      <Button
        onClick={() =>
          show({ tone: "error", message: "Unable to settle. Chidi Transport has not signed yet. Send a reminder." })
        }
      >
        Show an error toast
      </Button>
    </div>
  );
}
