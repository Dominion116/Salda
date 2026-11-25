import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Button, IconButton } from "@/components/ui/button";
import { Amount, Badge, EmptyState, ErrorState, Kbd, LoadingRows, Panel } from "@/components/ui/data";
import { Field } from "@/components/ui/field";
import { CopyIcon, DownloadIcon, InvoiceIcon, PlusIcon, SearchIcon, SignIcon } from "@/components/ui/icons";
import { Checkbox, ChoiceGroup, Radio, Segmented, Switch } from "@/components/ui/selection";
import { OverlayDemos } from "./overlay-demos";

function Group({ title, children, note }: { title: string; note: string; children: ReactNode }) {
  return (
    <div className="grid gap-6 border-t border-hairline py-12 lg:grid-cols-12">
      <div className="flex flex-col gap-2 lg:col-span-4">
        <h3 className="text-title text-ink-strong">{title}</h3>
        <p className="max-w-[44ch] text-body-sm text-pretty text-ink-subtle">{note}</p>
      </div>
      <div className="min-w-0 lg:col-span-8">{children}</div>
    </div>
  );
}

function Specimen({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2">
      {children}
      <span className="text-caption text-ink-subtle">{caption}</span>
    </div>
  );
}

const invoices = [
  { id: "INV-104", from: "Ada’s Bakery", to: "Ben’s Farm", amount: "6.00", tone: "success", status: "Cleared" },
  { id: "INV-105", from: "Ben’s Farm", to: "Chidi Transport", amount: "5.00", tone: "warning", status: "Pending" },
  { id: "INV-106", from: "Chidi Transport", to: "Ada’s Bakery", amount: "4.00", tone: "neutral", status: "Draft" },
] as const;

const members = [
  { name: "Ada’s Bakery", address: "0x71C7…976F", count: "2 open invoices" },
  { name: "Ben’s Farm", address: "0x3A9d…04b1", count: "2 open invoices" },
  { name: "Chidi Transport", address: "0xE81f…c52A", count: "2 open invoices" },
] as const;

export function Gallery() {
  return (
    <div>
      <Group title="Button sizes" note="Five sizes of the primary button. A real screen shows only one filled button at a time.">
        <div className="flex flex-wrap items-end gap-6">
          <Specimen caption="xs, 24px, table actions">
            <Button variant="primary" size="xs">Sign consent</Button>
          </Specimen>
          <Specimen caption="sm, 28px, toolbars">
            <Button variant="primary" size="sm">Sign consent</Button>
          </Specimen>
          <Specimen caption="md, 32px, app default">
            <Button variant="primary">Sign consent</Button>
          </Specimen>
          <Specimen caption="lg, 40px, forms">
            <Button variant="primary" size="lg">Sign consent</Button>
          </Specimen>
          <Specimen caption="xl, 48px, landing page">
            <Button variant="primary" size="xl">Try the live demo</Button>
          </Specimen>
        </div>
      </Group>

      <Group title="Button variants" note="Labels start with a verb and name the result. A disabled button always says why beside it.">
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary">Settle round</Button>
            <Button icon={<DownloadIcon />}>Download statement</Button>
            <Button variant="ghost">Cancel</Button>
            <Button variant="inverse">Create circle</Button>
            <Button variant="danger">Revoke mandate</Button>
            <Button variant="link">View on explorer</Button>
            <IconButton label="Copy address"><CopyIcon /></IconButton>
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <Specimen caption="Connect a wallet to sign.">
              <Button variant="primary" icon={<SignIcon />} disabled>Sign consent</Button>
            </Specimen>
            <Specimen caption="Loading: the spinner replaces the icon.">
              <Button variant="primary" icon={<SignIcon />} loading>Settling round…</Button>
            </Specimen>
          </div>
        </div>
      </Group>

      <Group title="Inputs" note="40px fields with 16px text on phones. The label sits above, with help or an error below.">
        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Business name" name="business" autoComplete="organization" placeholder="Ada’s Bakery" help="Shown to members of your circle only." />
          <Field label="Cash you can spend" name="cash" inputMode="decimal" autoComplete="off" defaultValue="2.00" suffix="tUSD8" numeric help="Balance 5.00 tUSD8" />
          <Field label="Invoice amount" name="amount" inputMode="decimal" autoComplete="off" defaultValue="0" suffix="tUSD8" numeric error="Enter an amount above 0." />
          <Field label="Find a member" name="member" type="search" autoComplete="off" placeholder="Name or address" prefix={<SearchIcon />} suffix={<span className="flex gap-1"><Kbd>Ctrl</Kbd><Kbd>K</Kbd></span>} />
        </div>
      </Group>

      <Group title="Selection" note="16px boxes with a visible border. The whole row can be clicked, and grows to 44px on touch.">
        <div className="grid gap-8 sm:grid-cols-2">
          <ChoiceGroup legend="Notifications">
            <Checkbox label="Email me when a round needs my signature" defaultChecked />
            <Checkbox label="Send a weekly statement" />
            <Checkbox label="Include voided invoices" disabled description="No voided invoices yet." />
          </ChoiceGroup>
          <ChoiceGroup legend="Clearing schedule">
            <Radio name="schedule" label="Every day" />
            <Radio name="schedule" label="Every week" defaultChecked />
            <Radio name="schedule" label="Only when I start a round" />
          </ChoiceGroup>
          <div>
            <Switch label="Approve rounds automatically" description="Only inside the limits in your mandate." defaultChecked />
            <Switch label="Remind members who have not signed" />
          </div>
          <Segmented legend="History range" options={["Day", "Week", "Month"]} defaultValue="Week" />
        </div>
      </Group>

      <Group title="Badges" note="20px tall with a tinted fill. The word carries the status, and color only supports it.">
        <div className="flex flex-wrap gap-2">
          <Badge tone="success" dot>Cleared</Badge>
          <Badge tone="warning">Pending</Badge>
          <Badge tone="danger">Failed</Badge>
          <Badge tone="info">Sample data</Badge>
          <Badge>Draft</Badge>
        </div>
      </Group>

      <Group title="Rows and tables" note="40px data rows and 44px list rows. Numbers are tabular and right-aligned.">
        <div className="flex flex-col gap-8">
          <div className="overflow-x-auto rounded-lg border border-hairline" tabIndex={0} role="region" aria-label="Sample invoices">
            <table className="w-full min-w-[560px] text-body-sm">
              <thead>
                <tr className="text-label text-ink-subtle">
                  <th scope="col" className="h-10 px-3 text-start font-medium">Invoice</th>
                  <th scope="col" className="h-10 px-3 text-start font-medium">From</th>
                  <th scope="col" className="h-10 px-3 text-start font-medium">To</th>
                  <th scope="col" className="h-10 px-3 text-start font-medium">Status</th>
                  <th scope="col" className="h-10 px-3 text-end font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="border-t border-hairline hover:bg-surface">
                    <td className="h-10 px-3 font-mono text-mono whitespace-nowrap">{invoice.id}</td>
                    <td className="h-10 px-3 whitespace-nowrap">{invoice.from}</td>
                    <td className="h-10 px-3 whitespace-nowrap">{invoice.to}</td>
                    <td className="h-10 px-3"><Badge tone={invoice.tone}>{invoice.status}</Badge></td>
                    <td className="h-10 px-3 text-end"><Amount value={invoice.amount} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="rounded-lg border border-hairline">
            {members.map((member) => (
              <li key={member.name} className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 border-t border-hairline px-3 py-2 text-body-sm first:border-t-0">
                <span className="text-ink-strong">{member.name}</span>
                <span className="font-mono text-mono text-ink-subtle">{member.address}</span>
                <span className="ms-auto text-ink-subtle tabular-nums">{member.count}</span>
              </li>
            ))}
          </ul>
        </div>
      </Group>

      <Group title="Dialog and toast" note="Dialogs repeat what will happen. Success toasts close after 5 seconds, and errors stay until dismissed.">
        <OverlayDemos />
      </Group>

      <Group title="App layout" note="A 240px sidebar beside the content. In a narrow frame the sidebar becomes a row of links.">
        <div className="overflow-hidden rounded-xl shadow-ring">
          <AppShell
            mode="sample"
            title="Invoices"
            nav={[
              { href: "#components", label: "Home" },
              { href: "#components", label: "Invoices", count: 3, current: true },
              { href: "#components", label: "Rounds", count: 1 },
              { href: "#components", label: "Mandates" },
            ]}
          >
            <div className="p-4">
              <LoadingRows label="Loading invoices…" />
            </div>
          </AppShell>
        </div>
      </Group>

      <Group title="Loading, empty and error" note="Every data view has all three. Each one says what is happening and what to do next.">
        <div className="grid gap-4 xl:grid-cols-3">
          <Panel title="Loading">
            <LoadingRows label="Loading invoices…" />
          </Panel>
          <Panel title="Empty">
            <EmptyState title="You haven’t added an invoice yet" action={<Button icon={<PlusIcon />}>Add an invoice</Button>}>
              Add one you owe or are owed, then ask the other business to sign it.
            </EmptyState>
          </Panel>
          <Panel title="Error">
            <ErrorState title="Unable to load invoices" action={<Button icon={<InvoiceIcon />}>Load invoices again</Button>}>
              Aevum did not respond. Check your connection, then try again.
            </ErrorState>
          </Panel>
        </div>
      </Group>
    </div>
  );
}
