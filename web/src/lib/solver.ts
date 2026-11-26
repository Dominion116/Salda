/*
 * The clearing solver (PRD 4.2.1). Pure TypeScript with BigInt amounts, shared by the browser and the server.
 *
 * Problem: choose x_e for each open invoice e = (u -> v) to
 *   maximise  sum x_e   subject to  0 <= x_e <= remaining_e,  out(v) - in(v) <= cash_v  for every member v.
 *
 * Reduction to min-cost circulation: one cash hub H. Each invoice is an arc u -> v (capacity = remaining,
 * cost -1000 per unit). Each member gets H -> v (capacity = cash, cost +1) and v -> H (unbounded, cost 0).
 * Cancelling negative cycles until none remain clears the most debt, then moves the least cash among plans
 * that clear the same amount. Capacities are integers, so the answer is exact in 6-decimal units.
 */

const INVOICE_COST = -1000;
const CASH_COST = 1;
const DEFAULT_MAX_ITERATIONS = 5_000;

export type SolverInvoice = { id: bigint; debtor: string; creditor: string; remaining: bigint };

export type SolverResult = {
  /** Amount cleared from each invoice, in input order. */
  clears: bigint[];
  /** Net position per member (lowercase address). Positive `out - in` is what they pay. */
  positions: Map<string, { out: bigint; in: bigint }>;
  gross: bigint;
  cash: bigint;
  /** False when the iteration guard stopped the solver. The plan is still feasible. */
  provenOptimal: boolean;
};

type Arc = { to: number; cap: bigint; cost: number; rev: number; invoice: number };

/** Clears as much debt as the cash limits allow. Members missing from `cash` can spend nothing. */
export function solve(
  invoices: readonly SolverInvoice[],
  cash: ReadonlyMap<string, bigint>,
  { maxIterations = DEFAULT_MAX_ITERATIONS }: { maxIterations?: number } = {},
): SolverResult {
  const index = new Map<string, number>();
  const node = (address: string) => {
    const key = address.toLowerCase();
    let found = index.get(key);
    if (found === undefined) {
      found = index.size;
      index.set(key, found);
    }
    return found;
  };
  for (const invoice of invoices) {
    node(invoice.debtor);
    node(invoice.creditor);
  }
  const members = index.size;
  const hub = members;
  const graph: Arc[][] = Array.from({ length: members + 1 }, () => []);
  const addArc = (from: number, to: number, cap: bigint, cost: number, invoice = -1) => {
    graph[from]!.push({ to, cap, cost, rev: graph[to]!.length, invoice });
    graph[to]!.push({ to: from, cap: 0n, cost: -cost, rev: graph[from]!.length - 1, invoice: -1 });
  };

  let unbounded = 1n;
  invoices.forEach((invoice, i) => {
    const remaining = invoice.remaining > 0n ? invoice.remaining : 0n;
    unbounded += remaining;
    if (remaining > 0n && node(invoice.debtor) !== node(invoice.creditor)) {
      addArc(node(invoice.debtor), node(invoice.creditor), remaining, INVOICE_COST, i);
    }
  });
  for (const [address, key] of index) {
    const limit = cash.get(address) ?? 0n;
    if (limit > 0n) addArc(hub, key, limit, CASH_COST);
    addArc(key, hub, unbounded, 0);
  }

  let iterations = 0;
  let provenOptimal = true;
  for (;;) {
    const cycle = negativeCycle(graph);
    if (!cycle) break;
    if (++iterations > maxIterations) {
      provenOptimal = false;
      break;
    }
    const push = cycle.reduce((least, [from, arc]) => {
      const cap = graph[from]![arc]!.cap;
      return least === -1n || cap < least ? cap : least;
    }, -1n);
    if (push <= 0n) break;
    for (const [from, arcIndex] of cycle) {
      const arc = graph[from]![arcIndex]!;
      arc.cap -= push;
      graph[arc.to]![arc.rev]!.cap += push;
    }
  }

  const clears = invoices.map(() => 0n);
  for (let from = 0; from < members; from++) {
    for (const arc of graph[from]!) {
      if (arc.invoice >= 0) {
        // What was pushed through an invoice arc sits on its reverse arc.
        clears[arc.invoice] = graph[arc.to]![arc.rev]!.cap;
      }
    }
  }
  return summarise(invoices, clears, provenOptimal);
}

/** Totals for a set of clears, the same way the contract computes them. */
export function summarise(invoices: readonly SolverInvoice[], clears: readonly bigint[], provenOptimal = true): SolverResult {
  const positions = new Map<string, { out: bigint; in: bigint }>();
  const at = (address: string) => {
    const key = address.toLowerCase();
    let found = positions.get(key);
    if (!found) {
      found = { out: 0n, in: 0n };
      positions.set(key, found);
    }
    return found;
  };
  let gross = 0n;
  invoices.forEach((invoice, i) => {
    const amount = clears[i] ?? 0n;
    if (amount === 0n) return;
    at(invoice.debtor).out += amount;
    at(invoice.creditor).in += amount;
    gross += amount;
  });
  let cash = 0n;
  for (const position of positions.values()) if (position.out > position.in) cash += position.out - position.in;
  return { clears: [...clears], positions, gross, cash, provenOptimal };
}

/**
 * Finds a cycle of negative total cost in the residual graph (Bellman-Ford from a virtual source joined to
 * every node). Returns its arcs as [fromNode, arcIndex] pairs, or null when none exists.
 */
function negativeCycle(graph: Arc[][]): [number, number][] | null {
  const size = graph.length;
  const dist = new Array<number>(size).fill(0);
  const predNode = new Array<number>(size).fill(-1);
  const predArc = new Array<number>(size).fill(-1);
  let last = -1;
  for (let round = 0; round < size; round++) {
    last = -1;
    for (let from = 0; from < size; from++) {
      const arcs = graph[from]!;
      for (let a = 0; a < arcs.length; a++) {
        const arc = arcs[a]!;
        if (arc.cap > 0n && dist[from]! + arc.cost < dist[arc.to]!) {
          dist[arc.to] = dist[from]! + arc.cost;
          predNode[arc.to] = from;
          predArc[arc.to] = a;
          last = arc.to;
        }
      }
    }
    if (last === -1) return null;
  }
  // A relaxation in the last round means a negative cycle. Step back far enough to stand on it.
  let onCycle = last;
  for (let i = 0; i < size; i++) onCycle = predNode[onCycle]!;
  const cycle: [number, number][] = [];
  let current = onCycle;
  do {
    const from = predNode[current]!;
    cycle.push([from, predArc[current]!]);
    current = from;
  } while (current !== onCycle && cycle.length <= size);
  return cycle.reverse();
}

// ----------------------------------------------------------- mandate layer

export type MandateLimits = {
  /** Per-round cap. */
  roundCap: bigint;
  /** What is left of the total cap. */
  remaining: bigint;
  /** 30_000 means at least 3.0 cleared for every 1 paid. 0 turns the rule off. */
  minClearRatioBps: number;
};

const ratioHolds = (position: { out: bigint; in: bigint }, bps: number) => {
  if (bps === 0 || position.out <= position.in) return true;
  return position.out * 10_000n >= (position.out - position.in) * BigInt(bps);
};

/**
 * Solves with standing-mandate limits (PRD 4.2.1, limit-tightening method). Caps each mandated member's cash
 * at the mandate's limits, then lowers the cash of any member whose clear ratio fails, by binary search, and
 * re-solves. Members still failing get no cash, which makes the ratio rule moot. Always feasible; a heuristic,
 * not a proof of optimality, and the contract checks every ratio regardless.
 */
export function solveWithMandates(
  invoices: readonly SolverInvoice[],
  cash: ReadonlyMap<string, bigint>,
  mandates: ReadonlyMap<string, MandateLimits>,
  options: { maxIterations?: number } = {},
): SolverResult {
  const limits = new Map<string, bigint>();
  for (const [member, amount] of cash) limits.set(member.toLowerCase(), amount);
  for (const [member, mandate] of mandates) {
    const key = member.toLowerCase();
    let limit = limits.get(key) ?? 0n;
    if (mandate.roundCap < limit) limit = mandate.roundCap;
    if (mandate.remaining < limit) limit = mandate.remaining;
    limits.set(key, limit > 0n ? limit : 0n);
  }

  const failing = (result: SolverResult) =>
    [...mandates].filter(([member, mandate]) => {
      const position = result.positions.get(member.toLowerCase());
      return position !== undefined && !ratioHolds(position, mandate.minClearRatioBps);
    });

  let result = solve(invoices, limits, options);
  let provenOptimal = result.provenOptimal;
  for (let pass = 0; pass < Math.max(mandates.size, 1); pass++) {
    const bad = failing(result);
    if (bad.length === 0) return { ...result, provenOptimal };
    provenOptimal = false; // tightening is a heuristic
    for (const [member, mandate] of bad) {
      const key = member.toLowerCase();
      // The largest cash limit, from 0 up to the current one, at which this member's ratio holds.
      let low = 0n;
      let high = limits.get(key) ?? 0n;
      while (low < high) {
        const middle = (low + high + 1n) / 2n;
        const probe = new Map(limits).set(key, middle);
        const position = solve(invoices, probe, options).positions.get(key);
        if (!position || ratioHolds(position, mandate.minClearRatioBps)) low = middle;
        else high = middle - 1n;
      }
      limits.set(key, low);
    }
    result = solve(invoices, limits, options);
    provenOptimal = provenOptimal && result.provenOptimal;
  }

  // Fallback: no cash for anyone still failing, until nobody fails.
  for (let guard = 0; guard <= mandates.size; guard++) {
    const bad = failing(result);
    if (bad.length === 0) break;
    for (const [member] of bad) limits.set(member.toLowerCase(), 0n);
    result = solve(invoices, limits, options);
  }
  return { ...result, provenOptimal: false };
}
