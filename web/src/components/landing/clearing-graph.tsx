"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { Amount } from "@/components/ui/data";
import { Field } from "@/components/ui/field";
import { Segmented } from "@/components/ui/selection";
import { Slider } from "@/components/ui/slider";
import { arrow, type Point } from "@/lib/arrow";
import { clearExample, MAX_CASH, shops, type Shop } from "@/lib/clearing-example";
import { formatAmount, ONE, parseAmount } from "@/lib/money";

const VIEWS = ["Before", "After"] as const;
const MORPH_MS = 400;

/* Geometry, in a 640 by 520 drawing. */
const SIZE = { width: 640, height: 520 };
const UNITS_PER_TOKEN = 9; // a debt of 6.00 is drawn 54 wide
const NODE_GAP = 72; // space kept clear around each shop's label
const nodes: Record<Shop, Point> = {
  ada: { x: 320, y: 64 },
  ben: { x: 540, y: 448 },
  chidi: { x: 100, y: 448 },
};

const place = (point: Point): CSSProperties => ({
  left: `${(point.x / SIZE.width) * 100}%`,
  top: `${(point.y / SIZE.height) * 100}%`,
});

/** Where each debt's amount sits: inside the triangle, clear of the widest arrow. */
const debtLabels: Point[] = [
  { x: 392, y: 330 },
  { x: 320, y: 390 },
  { x: 248, y: 330 },
];

const toNumber = (units: bigint) => Number(units) / Number(ONE);

export function ClearingGraph() {
  const [view, setView] = useState<string>(VIEWS[0]);
  const [cash, setCash] = useState(0n);
  const [typed, setTyped] = useState("0.00");
  const progress = useMorph(view === "After" ? 1 : 0);
  const labelId = useId();

  const result = clearExample(cash);
  const after = view === "After";
  const cleared = after ? result.totalCleared : 0n;
  const used = after ? result.cashUsed : 0n;
  const parsed = parseAmount(typed);
  const typedError = parsed === null || parsed > MAX_CASH ? "Enter an amount from 0 to 2." : undefined;

  const choose = (next: bigint) => {
    setCash(next);
    setView("After");
  };

  const cashFlows = [
    { to: "ben" as const, amount: result.cashToBen, shift: -38, label: { x: 516, y: 220 } },
    { to: "chidi" as const, amount: result.cashToChidi, shift: 38, label: { x: 124, y: 220 } },
  ];

  const people: { shop: Shop; text: string; amount: bigint }[] = [
    { shop: "ada", text: "pays", amount: result.cashUsed },
    { shop: "ben", text: "receives", amount: result.cashToBen },
    { shop: "chidi", text: "receives", amount: result.cashToChidi },
  ];

  return (
    <div>
      <div className="grid gap-8 lg:grid-cols-12 lg:gap-6">
        <div className="lg:col-span-7">
          <div aria-hidden="true" className="relative mx-auto w-full max-w-[720px]">
            <svg viewBox={`0 0 ${SIZE.width} ${SIZE.height}`} className="block h-auto w-full" focusable="false">
              {result.debts.map((debt) => {
                const left = toNumber(debt.owed) - toNumber(debt.cleared) * progress;
                const from = nodes[debt.from];
                const to = nodes[debt.to];
                return (
                  <g key={debt.from}>
                    <path d={arrow(from, to, 1, NODE_GAP)} className="fill-hairline-strong" />
                    {left > 0.004 ? (
                      <path d={arrow(from, to, Math.max(left * UNITS_PER_TOKEN, 2), NODE_GAP)} className="fill-ink-strong" />
                    ) : null}
                  </g>
                );
              })}
              {cashFlows.map((flow) => {
                const width = toNumber(flow.amount) * progress * UNITS_PER_TOKEN;
                return width > 0.04 ? (
                  <path
                    key={flow.to}
                    d={arrow(nodes.ada, nodes[flow.to], Math.max(width, 3), NODE_GAP, flow.shift)}
                    className="fill-primary"
                  />
                ) : null;
              })}
            </svg>

            {(Object.keys(nodes) as Shop[]).map((shop) => (
              <span
                key={shop}
                style={place(nodes[shop])}
                className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-canvas px-3 py-1.5 text-title-sm text-ink-strong shadow-sm sm:px-4 sm:py-2"
              >
                {shops[shop].short}
              </span>
            ))}
            {result.debts.map((debt, index) => {
              const left = after ? debt.owed - debt.cleared : debt.owed;
              const point = debtLabels[index];
              return point ? (
                <span
                  key={debt.from}
                  style={place(point)}
                  className="absolute -translate-x-1/2 -translate-y-1/2 text-title-sm text-ink-strong tabular-nums sm:text-title-lg"
                >
                  {left === 0n ? <span className="text-ink-subtle">0.00</span> : formatAmount(left)}
                </span>
              ) : null;
            })}
            {after
              ? cashFlows.map((flow) =>
                  flow.amount > 0n ? (
                    <span
                      key={flow.to}
                      style={place(flow.label)}
                      className="absolute -translate-x-1/2 -translate-y-1/2 text-title-sm text-link tabular-nums sm:text-title"
                    >
                      {formatAmount(flow.amount)}
                    </span>
                  ) : null,
                )
              : null}
          </div>
          <ul aria-hidden="true" className="flex flex-wrap justify-center gap-x-6 gap-y-2 pt-4 text-body-sm text-ink-subtle">
            <li className="flex items-center gap-2">
              <span className="h-2 w-6 rounded-full bg-ink-strong" />
              Debt left
            </li>
            <li className="flex items-center gap-2">
              <span className="h-2 w-6 rounded-full bg-primary" />
              Cash that moves
            </li>
          </ul>
        </div>

        <div className="flex flex-col gap-6 lg:col-span-4 lg:col-start-9 lg:justify-center">
          <Segmented legend="Show" options={VIEWS} value={view} onValueChange={setView} />
          <div className="flex flex-col gap-2">
            <p id={labelId} className="text-label text-ink-strong">
              Ada’s cash
            </p>
            <Slider
              min={0}
              max={200}
              step={5}
              value={Number((cash * 100n) / ONE)}
              labelledBy={labelId}
              valueText={`${formatAmount(cash)} tUSD8, clears ${formatAmount(result.totalCleared)} of ${formatAmount(result.totalOwed)}`}
              onValueChange={(hundredths) => {
                const next = (BigInt(hundredths) * ONE) / 100n;
                choose(next);
                setTyped(formatAmount(next));
              }}
            />
            <div className="flex justify-between text-caption text-ink-subtle tabular-nums" aria-hidden="true">
              <span>0</span>
              <span>1</span>
              <span>2</span>
            </div>
          </div>
          <Field
            label="Or type an amount"
            inputMode="decimal"
            autoComplete="off"
            suffix="tUSD8"
            numeric
            value={typed}
            error={typedError}
            help="From 0 to 2"
            onChange={(event) => {
              const text = event.currentTarget.value;
              setTyped(text);
              const next = parseAmount(text);
              if (next !== null && next <= MAX_CASH) choose(next);
            }}
          />
        </div>
      </div>

      <dl className="mt-12 grid border-y border-hairline bg-canvas sm:grid-cols-3 sm:divide-x sm:divide-hairline max-sm:divide-y max-sm:divide-hairline">
        {[
          { label: "Debt cleared", value: cleared, of: result.totalOwed },
          { label: "Cash used", value: used },
          { label: "Debt left", value: result.totalOwed - cleared },
        ].map((stat) => (
          <div key={stat.label} className="flex flex-col gap-1 px-4 py-6 lg:px-6 lg:py-8">
            <dt className="text-body-sm text-ink-subtle">{stat.label}</dt>
            <dd className="text-numeric text-ink-strong tabular-nums lg:text-display-md">
              {formatAmount(stat.value)}
              {stat.of === undefined ? null : (
                <span className="text-body text-ink-subtle">{" "}of {formatAmount(stat.of)}</span>
              )}
            </dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-8 pt-8 lg:grid-cols-12 lg:gap-6">
        <div className="overflow-x-auto lg:col-span-7" tabIndex={0} role="region" aria-label="The same numbers as a table">
          <table className="w-full min-w-[480px] bg-canvas text-body-sm">
            <caption className="pb-3 text-start text-label text-ink-strong">
              The same numbers as a table, in tUSD8
            </caption>
            <thead>
              <tr className="border-y border-hairline text-label text-ink-subtle">
                <th scope="col" className="h-10 pe-3 text-start font-medium">Debt</th>
                <th scope="col" className="h-10 px-3 text-end font-medium">Owed</th>
                <th scope="col" className="h-10 px-3 text-end font-medium">Cleared</th>
                <th scope="col" className="h-10 ps-3 text-end font-medium">Left</th>
              </tr>
            </thead>
            <tbody>
              {result.debts.map((debt) => {
                const gone = after ? debt.cleared : 0n;
                return (
                  <tr key={debt.from} className="border-b border-hairline tabular-nums">
                    <th scope="row" className="h-10 pe-3 text-start font-normal whitespace-nowrap">
                      {shops[debt.from].short} owes {shops[debt.to].short}
                    </th>
                    <td className="h-10 px-3 text-end">{formatAmount(debt.owed)}</td>
                    <td className="h-10 px-3 text-end">{formatAmount(gone)}</td>
                    <td className="h-10 ps-3 text-end text-ink-strong">{formatAmount(debt.owed - gone)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <dl className="bg-canvas text-body-sm lg:col-span-4 lg:col-start-9">
          <div className="pb-3 text-label text-ink-strong">Who moves cash</div>
          {people.map((person) => (
            <div key={person.shop} className="flex min-h-10 items-center justify-between gap-4 border-t border-hairline">
              <dt>
                {shops[person.shop].short} {person.text}
              </dt>
              <dd>
                <Amount value={formatAmount(after ? person.amount : 0n)} />
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

/** Follows `target` over 400ms, from wherever it is now. Jumps when motion is reduced. */
function useMorph(target: number): number {
  const [value, setValue] = useState(target);
  const current = useRef(target);

  useEffect(() => {
    const from = current.current;
    if (from === target) return;
    const instant = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const started = performance.now();
    let frame = 0;
    const step = (time: number) => {
      const t = instant ? 1 : Math.min(Math.max((time - started) / MORPH_MS, 0), 1);
      const eased = 1 - (1 - t) ** 4;
      current.current = t === 1 ? target : from + (target - from) * eased;
      setValue(current.current);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target]);

  return value;
}
