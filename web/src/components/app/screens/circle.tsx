"use client";

import { useState } from "react";
import { nameIn, useChange, useCircle, useCircles, useSalda } from "@/client/provider";
import type { Address, Circle, Member } from "@/client/types";
import { AddressText, Loaded, PageHeader } from "@/components/app/parts";
import { Badge, EmptyState, Panel } from "@/components/ui/data";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { formatDate } from "@/lib/format";

const isAddress = (text: string): text is Address => /^0x[0-9a-fA-F]{40}$/.test(text);

export function CircleScreen() {
  const { circleId, me } = useSalda();
  const circle = useCircle();
  return (
    <>
      <PageHeader
        title="Circle"
        description="A private group whose debts can clear together. Its admin confirms each business’s name."
        action={<CreateCircle />}
      />
      <div className="flex flex-col gap-6">
        {circleId === 0n ? (
          <Panel>
            <EmptyState title="You’re not in a circle yet" action={<AddressText address={me} />}>
              Create one with “Create a circle” above and add the businesses you trade with. Or send a circle admin your
              wallet address, below, so they can add you.
            </EmptyState>
          </Panel>
        ) : (
          <>
            <CircleSwitcher />
            <Loaded query={circle} what="your circle">
              {(data) => <Members circle={data} />}
            </Loaded>
          </>
        )}
      </div>
    </>
  );
}

function CircleSwitcher() {
  const { data: circles = [] } = useCircles();
  const { circleId, setCircleId } = useSalda();
  if (circles.length < 2) return null;

  return (
    <div className="max-w-modal">
      <Select
        label="Circle"
        value={`${circleId}`}
        onChange={(event) => {
          const next = circles.find((circle) => `${circle.id}` === event.currentTarget.value);
          if (!next) return;
          setCircleId(next.id);
        }}
        options={circles.map((circle) => ({
          value: `${circle.id}`,
          label: circle.name.status === "verified" ? circle.name.value : "Unverified name",
        }))}
      />
    </div>
  );
}

function CreateCircle() {
  const { me, setCircleId } = useSalda();
  const { data: current } = useCircle();
  const [name, setName] = useState("");
  const [business, setBusiness] = useState("");
  const [error, setError] = useState<string>();
  const [businessError, setBusinessError] = useState<string>();
  const create = useChange(
    (client, circleName: string, businessName: string) => client.createCircle(circleName, me, businessName),
    "Circle created. Add its members next.",
  );

  return (
    <ConfirmDialog
      trigger="Create a circle"
      title="Create a circle"
      description="You become its admin. Only people you add can trade invoices in it."
      confirm="Sign and create circle"
      onOpen={() => {
        setName("");
        const known = nameIn(current)(me);
        setBusiness(known === "Unverified name" ? "" : known);
        setError(undefined);
        setBusinessError(undefined);
      }}
      onConfirm={async () => {
        const trimmed = name.trim();
        const businessName = business.trim();
        setError(trimmed ? undefined : "Enter a name for the circle.");
        setBusinessError(businessName ? undefined : "Enter your business name.");
        if (!trimmed || !businessName) return false;
        const circle = await create.run(trimmed, businessName);
        if (!circle) return false;
        setCircleId(circle.id);
      }}
    >
      <Field
        label="Circle name"
        autoComplete="off"
        maxLength={60}
        value={name}
        error={error}
        help="Only its hash is public."
        onChange={(event) => setName(event.currentTarget.value)}
      />
      <Field
        label="Your business name"
        autoComplete="organization"
        maxLength={60}
        value={business}
        error={businessError}
        help="Other members see it. Only its hash is public."
        onChange={(event) => setBusiness(event.currentTarget.value)}
      />
    </ConfirmDialog>
  );
}

function Members({ circle }: { circle: Circle }) {
  const { me } = useSalda();
  const admin = circle.admin === me;
  const nameOf = nameIn(circle);

  return (
    <Panel
      heading="h2"
      title="Members"
      description={
        admin
          ? "You confirm these names. Members rely on them, so check each business first."
          : `Names are confirmed by the admin, ${nameOf(circle.admin)}. Trust them only as far as you trust the admin.`
      }
      action={admin ? <AddMember circle={circle} /> : undefined}
    >
      <ul className="rounded-lg border border-hairline">
        {circle.members.map((member) => (
          <li
            key={member.address}
            className="flex min-h-11 flex-wrap items-center gap-x-4 gap-y-2 border-t border-hairline px-3 py-2 text-body-sm first:border-t-0"
          >
            <span className="flex min-w-40 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-ink-strong">{nameOf(member.address)}</span>
              {member.address === circle.admin ? <Badge>Admin</Badge> : null}
              {member.active ? null : <Badge tone="warning">Inactive</Badge>}
            </span>
            <AddressText address={member.address} />
            <span className="text-caption text-ink-subtle">Name confirmed {formatDate(member.nameUpdatedAt)}</span>
            {admin ? (
              <span className="flex gap-2">
                <Rename circle={circle} member={member} />
                {member.address === circle.admin ? null : <ToggleMember circle={circle} member={member} />}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function AddMember({ circle }: { circle: Circle }) {
  const [address, setAddress] = useState("");
  const [name, setName] = useState("");
  const [errors, setErrors] = useState<{ address?: string; name?: string }>({});
  const save = useChange(
    (client, member: Address, label: string) => client.setMember(circle.id, member, true, label),
    "Member added",
  );

  return (
    <ConfirmDialog
      trigger="Add a member"
      title="Add a member"
      description="Confirm the business’s name and wallet address with them directly first."
      confirm="Sign and add member"
      onOpen={() => {
        setAddress("");
        setName("");
        setErrors({});
      }}
      onConfirm={async () => {
        const member = address.trim();
        const label = name.trim();
        const taken = circle.members.some((found) => found.address.toLowerCase() === member.toLowerCase());
        setErrors({
          name: label ? undefined : "Enter the business’s name.",
          address: !isAddress(member)
            ? "Enter a wallet address: 0x and 40 characters."
            : taken
              ? "This address is already a member."
              : undefined,
        });
        if (!label || !isAddress(member) || taken) return false;
        return (await save.run(member, label)) !== undefined;
      }}
    >
      <Field label="Business name" autoComplete="off" maxLength={60} value={name} error={errors.name} help="Only its hash is public." onChange={(event) => setName(event.currentTarget.value)} />
      <Field label="Wallet address" autoComplete="off" spellCheck={false} placeholder="0x…" value={address} error={errors.address} onChange={(event) => setAddress(event.currentTarget.value)} />
    </ConfirmDialog>
  );
}

function Rename({ circle, member }: { circle: Circle; member: Member }) {
  const current = nameIn(circle)(member.address);
  const [name, setName] = useState("");
  const [error, setError] = useState<string>();
  const save = useChange(
    (client, label: string) => client.setMember(circle.id, member.address, member.active, label),
    "Name changed",
  );

  return (
    <ConfirmDialog
      trigger="Rename"
      triggerSize="sm"
      title={`Rename ${current}`}
      description="Members see a warning on invoices signed under the old name."
      confirm="Sign and change name"
      onOpen={() => {
        setName(current);
        setError(undefined);
      }}
      onConfirm={async () => {
        const label = name.trim();
        if (!label) {
          setError("Enter the business’s name.");
          return false;
        }
        return (await save.run(label)) !== undefined;
      }}
    >
      <Field label="Business name" autoComplete="off" maxLength={60} value={name} error={error} onChange={(event) => setName(event.currentTarget.value)} />
    </ConfirmDialog>
  );
}

function ToggleMember({ circle, member }: { circle: Circle; member: Member }) {
  const name = nameIn(circle)(member.address);
  const save = useChange(
    (client) => client.setMember(circle.id, member.address, !member.active, name),
    member.active ? "Member deactivated" : "Member activated",
  );

  return (
    <ConfirmDialog
      trigger={member.active ? "Deactivate" : "Activate"}
      triggerSize="sm"
      title={member.active ? `Deactivate ${name}?` : `Activate ${name}?`}
      description={
        member.active
          ? "They can’t add new invoices. Debts that already exist can still settle with their signature."
          : "They can add invoices in this circle again."
      }
      confirm={member.active ? "Sign and deactivate member" : "Sign and activate member"}
      confirmVariant={member.active ? "danger" : "primary"}
      onConfirm={async () => (await save.run()) !== undefined}
    />
  );
}
