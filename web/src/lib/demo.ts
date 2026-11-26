import { mandateProblem } from "../client/mandate.ts";
import type { Address, Invoice, Mandate, Position, RoundPlan } from "../client/types.ts";
import { clearExample, MAX_CASH } from "./clearing-example.ts";
import { ONE } from "./money.ts";

/*
 * The judge demo runs the landing page example at 1/100 scale (PRD 5.2), so each session costs
 * at most 0.02 tUSD8. The safety attacks run through the same mandate check as the app.
 */

export const DEMO_SCALE = 100n;
export const DEMO_MAX_CASH = MAX_CASH / DEMO_SCALE;
const CENT = ONE / 100n;
const DAY = 86_400;

/** Placeholder addresses for the two demo counterparties, which the server holds. */
export const demoBen = `0x${"b".repeat(40)}` as Address;
export const demoChidi = `0x${"c".repeat(40)}` as Address;
export const demoAgent = `0x${"d".repeat(40)}` as Address;
const DEMO_CIRCLE = 1n;

export function demoRound(cash: bigint) {
  const result = clearExample(cash * DEMO_SCALE);
  const down = (units: bigint) => units / DEMO_SCALE;
  return {
    debts: result.debts.map((debt) => ({ ...debt, owed: down(debt.owed), cleared: down(debt.cleared) })),
    cashToBen: down(result.cashToBen),
    cashToChidi: down(result.cashToChidi),
    totalOwed: down(result.totalOwed),
    totalCleared: down(result.totalCleared),
    cashUsed: down(result.cashUsed),
  };
}

export function demoInvoices(you: Address, at: number): Invoice[] {
  const invoice = (id: bigint, debtor: Address, creditor: Address, cents: bigint): Invoice => ({
    id,
    circleId: DEMO_CIRCLE,
    debtor,
    creditor,
    amount: cents * CENT,
    cleared: 0n,
    dueDate: at + 14 * DAY,
    registeredAt: at,
    docHash: `0x${"0".repeat(64)}`,
    voided: false,
    voidSignedBy: null,
  });
  return [invoice(1n, you, demoBen, 6n), invoice(2n, demoBen, demoChidi, 5n), invoice(3n, demoChidi, you, 4n)];
}

/** A plan in the same shape the app uses, so the app’s graph can draw it. */
export function demoPlan(you: Address, cash: bigint, at: number): RoundPlan {
  const round = demoRound(cash);
  const invoices = demoInvoices(you, at);
  const lines = invoices.map((invoice, index) => ({ invoiceId: invoice.id, clear: round.debts[index]?.cleared ?? 0n }));
  const positions: Position[] = [you, demoBen, demoChidi].map((member) => ({ member, out: 0n, in: 0n }));
  lines.forEach((line, index) => {
    const invoice = invoices[index];
    for (const position of positions) {
      if (position.member === invoice?.debtor) position.out += line.clear;
      if (position.member === invoice?.creditor) position.in += line.clear;
    }
  });
  return {
    circleId: DEMO_CIRCLE,
    lines,
    positions,
    gross: round.totalCleared,
    cash: round.cashUsed,
    deadline: at + 3600,
    provenOptimal: true,
  };
}

export function demoMandate(you: Address, at: number, revoked: boolean): Mandate {
  return {
    circleId: DEMO_CIRCLE,
    member: you,
    agent: demoAgent,
    agentId: 0n,
    maxNetDebitPerRound: 2n * CENT,
    totalCap: 10n * CENT,
    maxDueDays: 30,
    minClearRatioBps: 30_000,
    minCooldown: 0,
    expiry: at + 90 * DAY,
    hash: `0x${"e".repeat(64)}`,
    spent: 0n,
    state: revoked ? "revoked" : "active",
  };
}

export type Attack = {
  key: string;
  label: string;
  /** What the compromised agent claims, in plain words. */
  claim: string;
  /** The contract error a real round would revert with. */
  revert: string;
  /** What you would pay, and how much of your debt would clear. */
  pays: bigint;
  clears: bigint;
  dueInDays: number;
};

export const attacks: Attack[] = [
  {
    key: "fair",
    label: "A fair round",
    claim: "Pay 0.02 to clear 0.06 of your debt.",
    revert: "",
    pays: 2n * CENT,
    clears: 6n * CENT,
    dueInDays: 14,
  },
  {
    key: "ratio",
    label: "Pay too much for too little",
    claim: "Pay 0.02 to clear only 0.03 of your debt.",
    revert: "ClearRatioTooLow",
    pays: 2n * CENT,
    clears: 3n * CENT,
    dueInDays: 14,
  },
  {
    key: "cap",
    label: "Spend past your round limit",
    claim: "Pay 0.03 to clear 0.09 of your debt.",
    revert: "ExceedsRoundCap",
    pays: 3n * CENT,
    clears: 9n * CENT,
    dueInDays: 14,
  },
  {
    key: "due",
    label: "Pay an invoice due in 90 days",
    claim: "Pay 0.02 to clear 0.06, including an invoice due in 90 days.",
    revert: "InvoiceDueTooFar",
    pays: 2n * CENT,
    clears: 6n * CENT,
    dueInDays: 90,
  },
];

/** Runs an attack through the real mandate check. Null means the round is allowed. */
export function checkAttack(attack: Attack, you: Address, at: number, revoked: boolean): { reason: string; revert: string } | null {
  const mandate = demoMandate(you, at, revoked);
  const invoices = demoInvoices(you, at).map((invoice) =>
    invoice.debtor === you ? { ...invoice, dueDate: at + attack.dueInDays * DAY } : invoice,
  );
  const position: Position = { member: you, out: attack.clears, in: attack.clears - attack.pays };
  const plan = demoPlan(you, DEMO_MAX_CASH, at);
  const problem = mandateProblem(mandate, position, plan, invoices, at);
  if (!problem) return null;
  return { reason: problem, revert: revertFor(problem) };
}

/** The contract error that matches each refusal from mandateProblem. */
function revertFor(problem: string): string {
  if (/revoked/.test(problem)) return "MandateRevoked";
  if (/expired/.test(problem)) return "MandateExpired";
  if (/days away/.test(problem)) return "InvoiceDueTooFar";
  if (/one round/.test(problem)) return "ExceedsRoundCap";
  if (/total/.test(problem)) return "ExceedsTotalCap";
  if (/too little/.test(problem)) return "ClearRatioTooLow";
  return "MandateRefused";
}
