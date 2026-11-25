import assert from "node:assert/strict";
import test from "node:test";
import { clearExample, MAX_CASH } from "../src/lib/clearing-example.ts";
import { formatAmount, ONE, parseAmount } from "../src/lib/money.ts";

const tenth = ONE / 10n;

test("matches the best possible clearing at every tenth of cash", () => {
  for (let cash = 0; cash <= 20; cash += 1) {
    let best = 0;
    for (let ab = 0; ab <= 60; ab += 1)
      for (let bc = 0; bc <= 50; bc += 1)
        for (let ca = 0; ca <= 40; ca += 1)
          if (ab - ca <= cash && bc - ab <= 0 && ca - bc <= 0) best = Math.max(best, ab + bc + ca);
    assert.equal(clearExample(BigInt(cash) * tenth).totalCleared, BigInt(best) * tenth, `cash ${cash / 10}`);
  }
});

test("shows 15, 14 and 12 for cash of 2, 1 and 0", () => {
  assert.equal(clearExample(2n * ONE).totalCleared, 15n * ONE);
  assert.equal(clearExample(ONE).totalCleared, 14n * ONE);
  assert.equal(clearExample(0n).totalCleared, 12n * ONE);
});

test("every unit of cash paid is a unit received, and nothing clears past what is owed", () => {
  for (let cash = 0n; cash <= MAX_CASH; cash += 12_345n) {
    const result = clearExample(cash);
    assert.equal(result.cashToBen + result.cashToChidi, cash);
    assert.ok(result.cashToBen >= 0n && result.cashToChidi >= 0n);
    for (const debt of result.debts) assert.ok(debt.cleared <= debt.owed);
  }
});

test("cash outside the range is limited to it", () => {
  assert.equal(clearExample(-1n).cashUsed, 0n);
  assert.equal(clearExample(9n * ONE).cashUsed, MAX_CASH);
});

test("amounts format and parse exactly", () => {
  assert.equal(formatAmount(15n * ONE), "15.00");
  assert.equal(formatAmount(15_000n), "0.015");
  assert.equal(formatAmount(1_234_567n * ONE), "1,234,567.00");
  assert.equal(formatAmount(-ONE), "−1.00");
  assert.equal(parseAmount("1.5"), 1_500_000n);
  assert.equal(parseAmount(" 0.000001 "), 1n);
  for (const bad of ["", "-1", "1.0000001", "1e3", "abc", "."]) assert.equal(parseAmount(bad), null, bad);
});
