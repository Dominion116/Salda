import type { Invoice, MandateTerms, Position, RoundPlan, Seconds, Units } from "./types.ts";

const DAY = 86_400;

/**
 * Why a mandate would refuse a round, or null if it allows it. The contract makes the same
 * checks; this copy lets the app explain the answer before anything is submitted.
 */
export function mandateProblem(
  mandate: MandateTerms & { spent: Units; state: string },
  position: Position,
  plan: RoundPlan,
  invoices: readonly Invoice[],
  at: Seconds,
): string | null {
  if (mandate.state !== "active") return "The mandate was revoked.";
  if (mandate.expiry <= at) return "The mandate has expired.";
  if (mandate.circleId !== plan.circleId) return "The mandate is for another circle.";

  for (const line of plan.lines) {
    const invoice = invoices.find((candidate) => candidate.id === line.invoiceId);
    if (invoice?.debtor === mandate.member && invoice.dueDate > at + mandate.maxDueDays * DAY) {
      return `An invoice is due more than ${mandate.maxDueDays} days away.`;
    }
  }

  const pays = position.out - position.in;
  if (pays <= 0n) return null;
  if (pays > mandate.maxNetDebitPerRound) return "It would pay more than the limit for one round.";
  if (mandate.spent + pays > mandate.totalCap) return "It would pay more than the total limit.";
  if (position.out * 10_000n < pays * BigInt(mandate.minClearRatioBps)) {
    return "It would clear too little debt for the cash paid.";
  }
  return null;
}
