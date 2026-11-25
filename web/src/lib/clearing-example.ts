import { ONE } from "./money.ts";

/*
 * The fixed three-shop example from PRD section 9.3. Only Ada has cash.
 * This closed formula serves the landing page and sample data; the real solver replaces it
 * everywhere else. tests/clearing-example.test.mjs checks it against brute force.
 */

export type Shop = "ada" | "ben" | "chidi";
export type ExampleDebt = { from: Shop; to: Shop; owed: bigint; cleared: bigint };

export const shops: Record<Shop, { short: string; name: string }> = {
  ada: { short: "Ada", name: "Ada’s Bakery" },
  ben: { short: "Ben", name: "Ben’s Farm" },
  chidi: { short: "Chidi", name: "Chidi Transport" },
};

export const MAX_CASH = 2n * ONE;

export type ExampleResult = {
  debts: [ExampleDebt, ExampleDebt, ExampleDebt];
  /** What Ada’s cash becomes. Payments go through one settlement, straight to the shops owed. */
  cashToBen: bigint;
  cashToChidi: bigint;
  totalOwed: bigint;
  totalCleared: bigint;
  cashUsed: bigint;
};

export function clearExample(cash: bigint): ExampleResult {
  const c = cash < 0n ? 0n : cash > MAX_CASH ? MAX_CASH : cash;
  const base = 4n * ONE;
  const adaToBen = base + c;
  const benToChidi = c <= ONE ? base + c : 5n * ONE;
  const chidiToAda = base;

  return {
    debts: [
      { from: "ada", to: "ben", owed: 6n * ONE, cleared: adaToBen },
      { from: "ben", to: "chidi", owed: 5n * ONE, cleared: benToChidi },
      { from: "chidi", to: "ada", owed: 4n * ONE, cleared: chidiToAda },
    ],
    cashToBen: adaToBen - benToChidi,
    cashToChidi: benToChidi - chidiToAda,
    totalOwed: 15n * ONE,
    totalCleared: adaToBen + benToChidi + chidiToAda,
    cashUsed: c,
  };
}
