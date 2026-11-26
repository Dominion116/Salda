import assert from "node:assert/strict";
import test from "node:test";
import { attacks, checkAttack, DEMO_MAX_CASH, demoPlan, demoRound } from "../src/lib/demo.ts";
import { ONE } from "../src/lib/money.ts";

const cent = ONE / 100n;
const you = `0x${"a".repeat(40)}`;
const at = 1_800_000_000;

test("the demo is the landing example at 1/100 scale", () => {
  assert.equal(DEMO_MAX_CASH, 2n * cent);
  assert.equal(demoRound(2n * cent).totalCleared, 15n * cent);
  assert.equal(demoRound(cent).totalCleared, 14n * cent);
  assert.equal(demoRound(0n).totalCleared, 12n * cent);
});

test("the demo plan pays out exactly what it takes in", () => {
  const plan = demoPlan(you, 2n * cent, at);
  const paid = plan.positions.reduce((sum, p) => sum + (p.out > p.in ? p.out - p.in : 0n), 0n);
  const received = plan.positions.reduce((sum, p) => sum + (p.in > p.out ? p.in - p.out : 0n), 0n);
  assert.equal(paid, 2n * cent);
  assert.equal(received, paid);
});

test("only the fair round passes the mandate", () => {
  for (const attack of attacks) {
    const result = checkAttack(attack, you, at, false);
    if (attack.key === "fair") assert.equal(result, null);
    else assert.equal(result?.revert, attack.revert, attack.key);
  }
});

test("after a revoke, every round is refused", () => {
  for (const attack of attacks) assert.equal(checkAttack(attack, you, at, true)?.revert, "MandateRevoked", attack.key);
});
