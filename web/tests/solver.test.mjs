import assert from "node:assert/strict";
import test from "node:test";
import { solve, solveWithMandates, summarise } from "../src/lib/solver.ts";

/* PRD 7.2: the solver checks. */

const ONE = 1_000_000n;
const [A, B, C] = ["0xa", "0xb", "0xc"];
const triangle = [
  { id: 1n, debtor: A, creditor: B, remaining: 6n * ONE },
  { id: 2n, debtor: B, creditor: C, remaining: 5n * ONE },
  { id: 3n, debtor: C, creditor: A, remaining: 4n * ONE },
];

test("clears 15, 14 and 12 for A's cash of 2, 1 and 0, with exact net transfers", () => {
  const cases = [
    [2n, [6n, 5n, 4n], { [A]: -2n, [B]: 1n, [C]: 1n }],
    [1n, [5n, 5n, 4n], { [A]: -1n, [B]: 0n, [C]: 1n }],
    [0n, [4n, 4n, 4n], { [A]: 0n, [B]: 0n, [C]: 0n }],
  ];
  for (const [cash, clears, net] of cases) {
    const result = solve(triangle, new Map([[A, cash * ONE]]));
    assert.deepEqual(result.clears, clears.map((units) => units * ONE), `cash ${cash}`);
    assert.equal(result.cash, cash * ONE);
    for (const [member, expected] of Object.entries(net)) {
      const position = result.positions.get(member) ?? { out: 0n, in: 0n };
      assert.equal(position.in - position.out, expected * ONE, `${member} at cash ${cash}`);
    }
    assert.equal(result.provenOptimal, true);
  }
});

test("a ratio mandate gives [3, 2] instead of [10, 2]", () => {
  const invoices = [
    { id: 1n, debtor: A, creditor: B, remaining: 10n },
    { id: 2n, debtor: B, creditor: A, remaining: 2n },
  ];
  const plain = solve(invoices, new Map([[A, 100n]]));
  assert.deepEqual(plain.clears, [10n, 2n]);
  const result = solveWithMandates(invoices, new Map([[A, 100n]]), new Map([[A, { roundCap: 100n, remaining: 100n, minClearRatioBps: 30_000 }]]));
  assert.deepEqual(result.clears, [3n, 2n]);
  assert.equal(result.gross, 5n);
  assert.equal(result.cash, 1n);
});

// ------------------------------------------------- random small graphs

function random(seed) {
  let state = seed >>> 0;
  return (max) => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state % max;
  };
}

/** Every plan, by trying every amount on every invoice. Fine for tiny graphs. */
function bruteForce(invoices, cash, mandates = new Map()) {
  let best = null;
  const clears = invoices.map(() => 0n);
  const visit = (i) => {
    if (i === invoices.length) {
      const result = summarise(invoices, clears);
      if (!feasible(result, cash, mandates)) return;
      if (!best || result.gross > best.gross || (result.gross === best.gross && result.cash < best.cash)) best = result;
      return;
    }
    for (let x = 0n; x <= invoices[i].remaining; x += 1n) {
      clears[i] = x;
      visit(i + 1);
    }
    clears[i] = 0n;
  };
  visit(0);
  return best;
}

function feasible(result, cash, mandates) {
  for (const [member, position] of result.positions) {
    const pays = position.out > position.in ? position.out - position.in : 0n;
    if (pays > (cash.get(member) ?? 0n)) return false;
    const mandate = mandates.get(member);
    if (mandate && pays > 0n) {
      if (pays > mandate.roundCap || pays > mandate.remaining) return false;
      if (position.out * 10_000n < pays * BigInt(mandate.minClearRatioBps)) return false;
    }
  }
  return true;
}

function graph(next) {
  const members = ["0x1", "0x2", "0x3", "0x4", "0x5"].slice(0, 2 + next(4));
  const count = 1 + next(6);
  const invoices = [];
  for (let i = 0; i < count; i++) {
    const debtor = members[next(members.length)];
    let creditor = members[next(members.length)];
    if (creditor === debtor) creditor = members[(members.indexOf(debtor) + 1) % members.length];
    invoices.push({ id: BigInt(i + 1), debtor, creditor, remaining: BigInt(1 + next(3)) });
  }
  const cash = new Map(members.map((member) => [member, BigInt(next(3))]));
  return { members, invoices, cash };
}

test("without ratios, matches the brute-force optimum on 300 small random graphs", () => {
  const next = random(7);
  for (let run = 0; run < 300; run++) {
    const { invoices, cash } = graph(next);
    const result = solve(invoices, cash);
    const best = bruteForce(invoices, cash);
    assert.ok(feasible(result, cash, new Map()), `run ${run} is feasible`);
    result.clears.forEach((x, i) => assert.ok(x >= 0n && x <= invoices[i].remaining, `run ${run} line ${i}`));
    assert.equal(result.gross, best.gross, `run ${run}: most debt cleared`);
    assert.equal(result.cash, best.cash, `run ${run}: least cash among the best`);
  }
});

test("with ratios, is always feasible, and reports how often it matches the optimum", () => {
  const next = random(11);
  let matched = 0;
  let worstGap = 0n;
  const runs = 200;
  for (let run = 0; run < runs; run++) {
    const { members, invoices, cash } = graph(next);
    const mandates = new Map(
      members
        .filter(() => next(2) === 0)
        .map((member) => [member, { roundCap: BigInt(next(3)), remaining: BigInt(next(4)), minClearRatioBps: [0, 15_000, 30_000][next(3)] }]),
    );
    const result = solveWithMandates(invoices, cash, mandates);
    assert.ok(feasible(result, cash, mandates), `run ${run} is feasible`);
    const best = bruteForce(invoices, cash, mandates);
    if (result.gross === best.gross) matched++;
    else if (best.gross - result.gross > worstGap) worstGap = best.gross - result.gross;
  }
  console.log(`ratio layer matched the optimum in ${matched} of ${runs} graphs; worst gap ${worstGap} units`);
});

test("with the iteration cap forced low, the plan is still feasible and marked not proven optimal", () => {
  const result = solve(triangle, new Map([[A, 2n * ONE]]), { maxIterations: 1 });
  assert.equal(result.provenOptimal, false);
  assert.ok(feasible(result, new Map([[A, 2n * ONE]]), new Map()));
});

test("benchmark: 10 members and 30 invoices", () => {
  const next = random(3);
  const members = Array.from({ length: 10 }, (_, i) => `0x${(i + 1).toString(16)}`);
  const invoices = Array.from({ length: 30 }, (_, i) => {
    const debtor = members[next(10)];
    let creditor = members[next(10)];
    if (creditor === debtor) creditor = members[(members.indexOf(debtor) + 1) % 10];
    return { id: BigInt(i + 1), debtor, creditor, remaining: BigInt(1 + next(5_000)) * 10_000n };
  });
  const cash = new Map(members.map((member) => [member, BigInt(next(200)) * 10_000n]));
  const started = performance.now();
  const result = solve(invoices, cash);
  const ms = performance.now() - started;
  assert.ok(feasible(result, cash, new Map()));
  console.log(`N=10, E=30: ${ms.toFixed(1)} ms, ${result.provenOptimal ? "proven optimal" : "not proven optimal"}`);
});
