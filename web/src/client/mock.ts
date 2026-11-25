import { clearExample, MAX_CASH } from "../lib/clearing-example.ts";
import { formatAmount, ONE } from "../lib/money.ts";
import { mandateProblem } from "./mandate.ts";
import {
  SaldaError,
  type Address,
  type AgentEvent,
  type Circle,
  type Invoice,
  type Mandate,
  type PendingInvoice,
  type Position,
  type Round,
  type RoundPlan,
  type SaldaClient,
  type Units,
} from "./types.ts";

/*
 * Sample data only. Nothing here signs, sends or touches a network, and it never returns a
 * transaction hash. Addresses and hashes are placeholders, not real accounts.
 */

const address = (digit: string) => `0x${digit.repeat(40)}` as Address;
const hash = (digit: string) => `0x${digit.repeat(64)}` as const;

export const sampleMembers = { ada: address("a"), ben: address("b"), chidi: address("c"), agent: address("d") };
export const SAMPLE_CIRCLE = 1n;

const now = () => Math.floor(Date.now() / 1000);
const DAY = 86_400;
const HOUR = 3_600;
const CENT = ONE / 100n;

/** `latencyMs` makes loading states visible in the app. Tests leave it at 0. */
export function createMockClient({ latencyMs = 0 }: { latencyMs?: number } = {}): SaldaClient {
  const start = now();
  const { ada, ben, chidi } = sampleMembers;

  const circles: Circle[] = [
    {
      id: SAMPLE_CIRCLE,
      name: { status: "verified", value: "Market Street" },
      admin: ada,
      members: [
        { address: ada, name: { status: "verified", value: "Ada’s Bakery" }, active: true, nameUpdatedAt: start - 30 * DAY },
        { address: ben, name: { status: "verified", value: "Ben’s Farm" }, active: true, nameUpdatedAt: start - 30 * DAY },
        { address: chidi, name: { status: "verified", value: "Chidi Transport" }, active: true, nameUpdatedAt: start - 30 * DAY },
      ],
    },
  ];

  const invoice = (id: bigint, debtor: Address, creditor: Address, amount: Units, digit: string): Invoice => ({
    id,
    circleId: SAMPLE_CIRCLE,
    debtor,
    creditor,
    amount,
    cleared: 0n,
    dueDate: start + 14 * DAY,
    registeredAt: start - 3 * DAY,
    docHash: hash(digit),
    voided: false,
    voidSignedBy: null,
  });

  const starting = [
    invoice(1n, ada, ben, 6n * ONE, "1"),
    invoice(2n, ben, chidi, 5n * ONE, "2"),
    invoice(3n, chidi, ada, 4n * ONE, "3"),
  ];
  const invoices: Invoice[] = [...starting];
  const pending: PendingInvoice[] = [];
  const rounds: Round[] = [];
  const cash = new Map<string, Units>();
  const mandates = new Map<Address, Mandate>();
  const events: AgentEvent[] = [];
  let counter = 0;
  const key = (prefix: string) => `${prefix}-${++counter}`;

  const copy = <T>(value: T): T => structuredClone(value);
  const need = <T>(value: T | undefined, what: string): T => {
    if (value === undefined) throw new SaldaError("not-found", `${what} was not found.`);
    return value;
  };
  const circleOf = (id: bigint) => need(circles.find((circle) => circle.id === id), "That circle");
  const invoiceOf = (id: bigint) => need(invoices.find((candidate) => candidate.id === id), "That invoice");
  const roundOf = (id: string) => need(rounds.find((round) => round.key === id), "That round");
  const cashKey = (circleId: bigint, member: Address) => `${circleId}:${member}`;
  const requireActive = (circleId: bigint, member: Address) => {
    if (!circleOf(circleId).members.some((candidate) => candidate.address === member && candidate.active)) {
      throw new SaldaError("not-a-member", "Both businesses must be active members of this circle.");
    }
  };
  const log = (circleId: bigint, kind: AgentEvent["kind"], summary: string) => {
    const event: AgentEvent = { key: key("event"), at: now(), circleId, kind, summary };
    events.unshift(event);
    return event;
  };

  const plan = (circleId: bigint, limits: ReadonlyMap<Address, Units>): RoundPlan => {
    circleOf(circleId);
    const untouched = starting.every((item) => item.cleared === 0n && !item.voided);
    const onlyAda = [...limits].every(([member, amount]) => member === ada || amount === 0n);
    if (circleId !== SAMPLE_CIRCLE || !untouched || !onlyAda) {
      throw new SaldaError(
        "not-supported-in-sample",
        "Sample data can plan one round over the three starting invoices. Reset it in Settings to plan another.",
      );
    }
    const result = clearExample(limits.get(ada) ?? 0n);
    const lines = result.debts.map((debt, index) => ({ invoiceId: BigInt(index + 1), clear: debt.cleared }));
    const positions: Position[] = [ada, ben, chidi].map((member) => ({ member, out: 0n, in: 0n }));
    for (const line of lines) {
      const item = invoiceOf(line.invoiceId);
      for (const position of positions) {
        if (position.member === item.debtor) position.out += line.clear;
        if (position.member === item.creditor) position.in += line.clear;
      }
    }
    return {
      circleId,
      lines,
      positions,
      gross: result.totalCleared,
      cash: result.cashUsed,
      deadline: now() + HOUR,
      provenOptimal: true,
    };
  };

  const open = (agreed: RoundPlan): Round => {
    const round: Round = {
      key: key("round"),
      plan: copy(agreed),
      state: "waiting-for-signatures",
      proposedAt: now(),
      approvedBy: [],
      viaMandate: [],
    };
    rounds.unshift(round);
    return round;
  };

  const settle = (round: Round) => {
    if (round.state === "confirmed" || round.state === "failed") return;
    if (round.plan.positions.some((position) => !round.approvedBy.includes(position.member))) {
      throw new SaldaError("not-ready", "Every business in the round must sign first.");
    }
    const refuse = (reason: string) => {
      round.state = "failed";
      round.failure = reason;
    };
    if (round.plan.deadline <= now()) return refuse("The time to settle this round ran out. Plan a new round.");
    // Check every line and mandate before changing any, so a round settles fully or not at all.
    for (const line of round.plan.lines) {
      const item = invoiceOf(line.invoiceId);
      if (item.voided || item.cleared + line.clear > item.amount) {
        return refuse("An invoice changed after this round was planned. Plan a new round.");
      }
    }
    for (const member of round.viaMandate) {
      const mandate = mandates.get(member);
      const position = round.plan.positions.find((candidate) => candidate.member === member);
      const problem =
        mandate && position ? mandateProblem(mandate, position, round.plan, invoices, now()) : "The mandate was not found.";
      if (problem) return refuse(`A mandate refused this round. ${problem}`);
    }
    for (const line of round.plan.lines) invoiceOf(line.invoiceId).cleared += line.clear;
    for (const member of round.viaMandate) {
      const mandate = mandates.get(member);
      const position = round.plan.positions.find((candidate) => candidate.member === member);
      if (mandate && position && position.out > position.in) mandate.spent += position.out - position.in;
    }
    round.state = "confirmed";
    round.settledAt = now();
  };

  const client: SaldaClient = {
    mode: "sample",

    async listCircles() {
      return copy(circles);
    },
    async getCircle(id) {
      return copy(circleOf(id));
    },
    async createCircle(name, admin, adminName) {
      const circle: Circle = {
        id: BigInt(circles.length + 1),
        name: { status: "verified", value: name },
        admin,
        members: [{ address: admin, name: { status: "verified", value: adminName }, active: true, nameUpdatedAt: now() }],
      };
      circles.push(circle);
      return copy(circle);
    },
    async setMember(circleId, member, active, name) {
      const circle = circleOf(circleId);
      const found = circle.members.find((candidate) => candidate.address === member);
      if (found) {
        if (found.name.status !== "verified" || found.name.value !== name) found.nameUpdatedAt = now();
        found.active = active;
        found.name = { status: "verified", value: name };
      } else {
        circle.members.push({ address: member, active, name: { status: "verified", value: name }, nameUpdatedAt: now() });
      }
      return copy(circle);
    },

    async listInvoices(circleId) {
      circleOf(circleId);
      return copy(invoices.filter((candidate) => candidate.circleId === circleId));
    },
    async listPendingInvoices(circleId) {
      circleOf(circleId);
      return copy(pending.filter((candidate) => candidate.circleId === circleId));
    },
    async proposeInvoice(draft, signer) {
      if (draft.amount <= 0n) throw new SaldaError("invalid-amount", "Enter an amount above 0.");
      if (draft.debtor === draft.creditor) throw new SaldaError("not-a-member", "Choose two different businesses.");
      if (signer !== draft.debtor && signer !== draft.creditor) {
        throw new SaldaError("not-a-member", "Only the two businesses on an invoice can sign it.");
      }
      requireActive(draft.circleId, draft.debtor);
      requireActive(draft.circleId, draft.creditor);
      const item = { ...draft, key: key("pending"), signedBy: signer, deadline: now() + 2 * DAY };
      pending.push(item);
      return copy(item);
    },
    async cosignInvoice(id, signer) {
      const index = pending.findIndex((candidate) => candidate.key === id);
      const item = need(pending[index], "That unsigned invoice");
      const other = item.signedBy === item.debtor ? item.creditor : item.debtor;
      if (signer !== other) throw new SaldaError("not-a-member", "The other business on this invoice must sign it.");
      requireActive(item.circleId, item.debtor);
      requireActive(item.circleId, item.creditor);
      pending.splice(index, 1);
      const created: Invoice = {
        id: BigInt(invoices.length + 1),
        circleId: item.circleId,
        debtor: item.debtor,
        creditor: item.creditor,
        amount: item.amount,
        cleared: 0n,
        dueDate: item.dueDate,
        registeredAt: now(),
        docHash: item.docHash,
        voided: false,
        voidSignedBy: null,
      };
      invoices.push(created);
      return copy(created);
    },
    async signVoid(id, signer) {
      const found = invoiceOf(id);
      if (found.voided || found.cleared === found.amount) {
        throw new SaldaError("already-voided", "This invoice is already closed.");
      }
      if (signer !== found.debtor && signer !== found.creditor) {
        throw new SaldaError("not-a-member", "Only the two businesses on an invoice can void it.");
      }
      if (found.voidSignedBy === signer) {
        throw new SaldaError("already-signed", "You have already signed. The other business must sign too.");
      }
      if (found.voidSignedBy) {
        found.voided = true;
        found.voidSignedBy = null;
      } else {
        found.voidSignedBy = signer;
      }
      return copy(found);
    },
    async payInvoice(id, amount) {
      const found = invoiceOf(id);
      if (found.voided) throw new SaldaError("already-voided", "This invoice is already closed.");
      if (amount <= 0n || found.cleared + amount > found.amount) {
        throw new SaldaError("invalid-amount", "Enter an amount above 0, up to what is still owed.");
      }
      found.cleared += amount;
      found.voidSignedBy = null;
      return copy(found);
    },

    async listCashLimits(circleId) {
      return circleOf(circleId).members.map((member) => ({
        member: member.address,
        amount: cash.get(cashKey(circleId, member.address)) ?? 0n,
      }));
    },
    async setCashLimit(circleId, member, amount) {
      circleOf(circleId);
      if (amount < 0n) throw new SaldaError("invalid-amount", "Enter an amount of 0 or more.");
      cash.set(cashKey(circleId, member), amount);
      return { member, amount };
    },
    async planRound(circleId, limits) {
      return plan(circleId, limits);
    },
    async getRound(id) {
      return copy(roundOf(id));
    },
    async openRound(agreed) {
      return copy(open(agreed));
    },
    async approveRound(id, member) {
      const round = roundOf(id);
      if (!round.plan.positions.some((position) => position.member === member)) {
        throw new SaldaError("not-a-member", "This business is not part of the round.");
      }
      if (round.state !== "waiting-for-signatures") {
        throw new SaldaError("not-ready", "This round is closed.");
      }
      if (!round.approvedBy.includes(member)) round.approvedBy.push(member);
      return copy(round);
    },
    async settleRound(id) {
      const round = roundOf(id);
      settle(round);
      return copy(round);
    },
    async listRounds(circleId) {
      return copy(rounds.filter((round) => round.plan.circleId === circleId));
    },

    async getMandate(member) {
      const found = mandates.get(member);
      if (found?.state === "active" && found.expiry <= now()) found.state = "expired";
      return found ? copy(found) : null;
    },
    async activateMandate(terms) {
      requireActive(terms.circleId, terms.member);
      const current = mandates.get(terms.member);
      if (current?.state === "active" && current.expiry > now()) {
        throw new SaldaError("mandate-already-active", "Revoke your current mandate before you start a new one.");
      }
      const mandate: Mandate = { ...terms, hash: hash("e"), spent: 0n, state: "active" };
      mandates.set(terms.member, mandate);
      return copy(mandate);
    },
    async revokeMandate(member) {
      const found = need(mandates.get(member), "That mandate");
      found.state = "revoked";
      return copy(found);
    },

    async listAgentEvents(circleId) {
      return copy(events.filter((event) => event.circleId === circleId));
    },
    /** Proposes the most it can inside every active mandate. Settles only if all members have one. */
    async runAgent(circleId) {
      const held = (member: Address) => {
        const mandate = mandates.get(member);
        return mandate?.state === "active" && mandate.circleId === circleId ? mandate : undefined;
      };
      const adaMandate = held(ada);
      let spend = cash.get(cashKey(circleId, ada)) ?? 0n;
      if (adaMandate) {
        const left = adaMandate.totalCap - adaMandate.spent;
        for (const limit of [adaMandate.maxNetDebitPerRound, left, MAX_CASH]) if (limit < spend) spend = limit;
      }
      if (spend > MAX_CASH) spend = MAX_CASH;

      let agreed = plan(circleId, new Map([[ada, spend]]));
      const position = (member: Address) => agreed.positions.find((candidate) => candidate.member === member);
      const problemFor = (member: Address) => {
        const mandate = held(member);
        const found = position(member);
        return mandate && found ? mandateProblem(mandate, found, agreed, invoices, now()) : null;
      };
      // Lower the cash until Ada’s clear ratio holds.
      while (adaMandate && spend > 0n && problemFor(ada)) {
        spend = spend > CENT ? spend - CENT : 0n;
        agreed = plan(circleId, new Map([[ada, spend]]));
      }

      for (const { member } of agreed.positions) {
        const problem = problemFor(member);
        if (problem) return copy(log(circleId, "rejected", `No round proposed. ${problem}`));
      }

      const round = open(agreed);
      for (const { member } of agreed.positions) {
        if (held(member)) {
          round.approvedBy.push(member);
          round.viaMandate.push(member);
        }
      }
      const totals = `${formatAmount(agreed.gross)} cleared with ${formatAmount(agreed.cash)} tUSD8`;
      const waiting = agreed.positions.length - round.approvedBy.length;
      if (waiting > 0) {
        const who = waiting === 1 ? "1 business still needs" : `${waiting} businesses still need`;
        return copy(log(circleId, "proposed", `Round proposed: ${totals}. ${who} to sign.`));
      }
      settle(round);
      return copy(
        round.state === "confirmed"
          ? log(circleId, "settled", `Sample round settled: ${totals}. Nothing was sent.`)
          : log(circleId, "rejected", round.failure ?? "The round was refused."),
      );
    },
  };

  if (latencyMs === 0) return client;
  return new Proxy(client, {
    get(target, name, receiver) {
      const value: unknown = Reflect.get(target, name, receiver);
      // Planning answers at once, so the slider feels direct.
      if (typeof value !== "function" || name === "planRound") return value;
      return async (...args: unknown[]) => {
        await new Promise((resolve) => setTimeout(resolve, latencyMs));
        return Reflect.apply(value, target, args) as unknown;
      };
    },
  });
}
