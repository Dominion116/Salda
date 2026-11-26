import type { Address } from "viem";
import { readInvoices, readMandate, type ChainMandate } from "@/chain/reads";
import { randomHex32, type RoundInput } from "@/chain/salda";
import { formatAmount } from "@/lib/money";
import { shortAddress } from "@/lib/format";
import { solveWithMandates, type MandateLimits } from "@/lib/solver";
import { fromWire, toWire } from "@/lib/wire";
import { agentAccount, publicClient, salda, UserFacingError } from "./chain";
import { nowSeconds, same } from "./http";
import { openRound, settleRound, type RoundRecord } from "./rounds";
import { hashAll, hashSet, lock, unlock } from "./store";

/*
 * The clearing agent (PRD 4.2.3). It reads the circle, solves within every mandate's limits, and either settles
 * (when every member in the round has a mandate naming it) or proposes the round for the others to sign.
 * It holds no tUSD8 and can call nothing but `settle` through the relayer; the contract rechecks every limit.
 * Explanations come from templates and exact solver numbers. No language model is involved.
 */

export type AgentEvent = { key: string; at: number; circleId: bigint; kind: "proposed" | "settled" | "rejected"; summary: string };

const DAY = 86_400;
const eventsKey = (circleId: bigint) => `events:${circleId}`;

export const agentInfo = () => ({
  agent: agentAccount()?.address ?? null,
  agentId: BigInt(process.env.AGENT_ID?.trim() || "0"),
});

export async function listEvents(circleId: bigint): Promise<AgentEvent[]> {
  const all = await hashAll(eventsKey(circleId));
  return [...all.values()].map((value) => fromWire<AgentEvent>(value)).sort((a, b) => b.at - a.at).slice(0, 50);
}

async function log(circleId: bigint, kind: AgentEvent["kind"], summary: string): Promise<AgentEvent> {
  const event: AgentEvent = { key: randomHex32().slice(0, 18), at: Number(nowSeconds()), circleId, kind, summary };
  await hashSet(eventsKey(circleId), event.key, toWire(event), 30 * DAY);
  return event;
}

/** One plain sentence per member, from exact numbers: what clears, what is collected, what moves. */
export function explainPosition(member: Address, out: bigint, inflow: bigint): string {
  const who = shortAddress(member);
  if (out > inflow) {
    const pays = out - inflow;
    const ratio = Number((out * 100n) / pays) / 100;
    return `${who} clears ${formatAmount(out)} tUSD8 it owes and collects ${formatAmount(inflow)}, paying ${formatAmount(pays)} net (${ratio.toFixed(1)}× cleared per 1.00 paid).`;
  }
  if (inflow > out) {
    return `${who} clears ${formatAmount(out)} tUSD8 it owes and collects ${formatAmount(inflow)}, receiving ${formatAmount(inflow - out)} net.`;
  }
  return `${who} clears ${formatAmount(out)} tUSD8 each way and moves no cash.`;
}

export async function runAgent(circleId: bigint): Promise<AgentEvent> {
  const agent = agentAccount();
  if (!agent) throw new UserFacingError("The clearing agent is not set up.", 503);
  if (!(await lock(`lock:agent:${circleId}`, 120))) throw new UserFacingError("The agent is already running for this circle.", 409);
  try {
    const contract = salda();
    const invoices = await readInvoices(publicClient, contract, circleId);
    const members = [...new Set(invoices.flatMap((item) => [item.debtor, item.creditor]))];
    const mandates = (await Promise.all(members.map((member) => readMandate(publicClient, contract, member)))).filter(
      (found): found is ChainMandate => Boolean(found?.live && found.circleId === circleId && same(found.agent, agent.address)),
    );
    const cashLimits = await hashAll(`cash:${circleId}`);
    const at = Number(nowSeconds());

    // Leave out invoices a mandated debtor's due-date window does not allow.
    const open = invoices.filter((item) => {
      if (item.voided || item.cleared >= item.amount) return false;
      const mandate = mandates.find((found) => same(found.member, item.debtor));
      return !mandate || item.dueDate <= at + mandate.maxDueDays * DAY;
    });
    const limits = new Map<string, MandateLimits>(
      mandates.map((found) => [
        found.member.toLowerCase(),
        { roundCap: found.maxNetDebitPerRound, remaining: found.totalCap - found.spent, minClearRatioBps: found.minClearRatioBps },
      ]),
    );
    // A mandated member's cash is bounded by the mandate; a member's own cash limit can lower it further.
    const cash = new Map<string, bigint>();
    for (const member of members) {
      const key = member.toLowerCase();
      const own = cashLimits.get(key);
      const mandate = limits.get(key);
      cash.set(key, own !== undefined ? BigInt(own) : mandate ? mandate.roundCap : 0n);
    }

    const result = solveWithMandates(
      open.map((item) => ({ id: item.id, debtor: item.debtor, creditor: item.creditor, remaining: item.amount - item.cleared })),
      cash,
      limits,
    );
    const lines = open
      .map((item, i) => ({ id: item.id, clear: result.clears[i] ?? 0n }))
      .filter((line) => line.clear > 0n)
      .sort((a, b) => (a.id < b.id ? -1 : 1))
      .slice(0, 30);
    if (lines.length === 0 || result.gross === 0n) {
      return log(circleId, "rejected", "No round proposed. Nothing can clear with the current invoices, cash limits and mandates.");
    }

    const round: RoundInput = {
      circleId,
      roundNonce: BigInt(randomHex32()),
      deadline: nowSeconds() + 3_600n,
      invoiceIds: lines.map((line) => line.id),
      clearAmounts: lines.map((line) => line.clear),
    };
    let record: RoundRecord;
    try {
      record = await openRound(round, { provenOptimal: result.provenOptimal, proposedBy: "agent" });
    } catch (error) {
      return log(circleId, "rejected", `No round proposed. ${error instanceof Error ? error.message : ""}`.trim());
    }
    const totals = `${formatAmount(record.gross)} cleared with ${formatAmount(record.cash)} tUSD8`;
    const details = record.positions.map((position) => explainPosition(position.member, position.out, position.in)).join(" ");
    const waiting = record.positions.length - record.viaMandate.length;
    if (waiting > 0) {
      const who = waiting === 1 ? "1 business still needs" : `${waiting} businesses still need`;
      return log(circleId, "proposed", `Round proposed: ${totals}. ${who} to sign. ${details}`);
    }

    try {
      const settled = await settleRound(circleId, record.key);
      return settled.state === "failed"
        ? log(circleId, "rejected", settled.failure ?? "The contract refused the round. Nothing moved.")
        : log(circleId, "settled", `Round ${settled.state === "confirmed" ? "settled" : "sent"}: ${totals}. ${details}`);
    } catch (error) {
      return log(circleId, "rejected", error instanceof Error ? error.message : "The contract refused the round. Nothing moved.");
    }
  } finally {
    await unlock(`lock:agent:${circleId}`);
  }
}
