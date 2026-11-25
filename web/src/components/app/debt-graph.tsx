"use client";

import type { CSSProperties } from "react";
import type { Address, Invoice, RoundPlan } from "@/client/types";
import { arrow, type Point } from "@/lib/arrow";
import { formatAmount, ONE } from "@/lib/money";

const SIZE = { width: 640, height: 480 };
const CENTER = { x: 320, y: 250 };
const RADIUS = { x: 220, y: 180 };
const GAP = 76;
const WIDEST = 44;

/**
 * Who owes whom, and what this plan leaves. Decorative: the same numbers are always listed in
 * text beside it.
 */
export function DebtGraph({
  plan,
  invoices,
  nameOf,
}: {
  plan: RoundPlan;
  invoices: readonly Invoice[];
  nameOf: (address: Address) => string;
}) {
  const members = plan.positions.map((position) => position.member);
  const points = new Map<Address, Point>(
    members.map((member, index) => {
      const angle = (index / members.length) * 2 * Math.PI - Math.PI / 2;
      return [member, { x: CENTER.x + RADIUS.x * Math.cos(angle), y: CENTER.y + RADIUS.y * Math.sin(angle) }];
    }),
  );

  // Several invoices between the same two businesses are drawn as one arrow.
  const debts = new Map<string, { from: Address; to: Address; owed: bigint; left: bigint }>();
  for (const line of plan.lines) {
    const invoice = invoices.find((candidate) => candidate.id === line.invoiceId);
    if (!invoice) continue;
    const key = `${invoice.debtor}>${invoice.creditor}`;
    const debt = debts.get(key) ?? { from: invoice.debtor, to: invoice.creditor, owed: 0n, left: 0n };
    const owed = invoice.amount - invoice.cleared;
    debt.owed += owed;
    debt.left += owed > line.clear ? owed - line.clear : 0n;
    debts.set(key, debt);
  }
  const all = [...debts.values()];
  const most = all.reduce((max, debt) => (debt.owed > max ? debt.owed : max), ONE);
  const width = (units: bigint) => (Number(units) / Number(most)) * WIDEST;
  const place = (point: Point): CSSProperties => ({
    left: `${(point.x / SIZE.width) * 100}%`,
    top: `${(point.y / SIZE.height) * 100}%`,
  });

  return (
    <div aria-hidden="true" className="relative mx-auto w-full max-w-[640px]">
      <svg viewBox={`0 0 ${SIZE.width} ${SIZE.height}`} className="block h-auto w-full" focusable="false">
        {all.map((debt) => {
          const from = points.get(debt.from);
          const to = points.get(debt.to);
          if (!from || !to) return null;
          // Debts that run both ways sit side by side.
          const shift = debts.has(`${debt.to}>${debt.from}`) ? 26 : 0;
          return (
            <g key={`${debt.from}>${debt.to}`}>
              <path d={arrow(from, to, Math.max(width(debt.owed), 2), GAP, shift)} className="fill-surface-2" />
              {debt.left > 0n ? (
                <path d={arrow(from, to, Math.max(width(debt.left), 2), GAP, shift)} className="fill-ink-strong" />
              ) : null}
            </g>
          );
        })}
      </svg>
      {all.map((debt) => {
        const from = points.get(debt.from);
        const to = points.get(debt.to);
        if (!from || !to) return null;
        const shift = debts.has(`${debt.to}>${debt.from}`) ? 26 : 0;
        const length = Math.hypot(to.x - from.x, to.y - from.y);
        const middle = {
          x: (from.x + to.x) / 2 - ((to.y - from.y) / length) * shift,
          y: (from.y + to.y) / 2 + ((to.x - from.x) / length) * shift,
        };
        return (
          <span
            key={`${debt.from}>${debt.to}`}
            style={place(middle)}
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-canvas px-2 py-0.5 text-label text-ink-strong tabular-nums shadow-ring"
          >
            {formatAmount(debt.left)}
          </span>
        );
      })}
      {plan.positions.map((position) => {
        const point = points.get(position.member);
        const net = position.in - position.out;
        return point ? (
          <span
            key={position.member}
            style={place(point)}
            className="absolute flex max-w-32 -translate-x-1/2 -translate-y-1/2 flex-col items-center rounded-xl bg-canvas px-3 py-1.5 text-center text-label text-ink-strong shadow-sm"
          >
            <span className="w-full truncate">{nameOf(position.member)}</span>
            <span className={net < 0n ? "text-link tabular-nums" : "text-ink-subtle tabular-nums"}>
              {net === 0n ? "0.00" : `${net > 0n ? "+" : ""}${formatAmount(net)}`}
            </span>
          </span>
        ) : null;
      })}
    </div>
  );
}
