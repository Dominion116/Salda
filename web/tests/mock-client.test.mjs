import assert from "node:assert/strict";
import test from "node:test";
import { createMockClient, SAMPLE_CIRCLE, sampleMembers } from "../src/client/mock.ts";
import { ONE } from "../src/lib/money.ts";

const { ada, ben, chidi, agent } = sampleMembers;
const members = [ada, ben, chidi];
const code = (expected) => (error) => error.code === expected;

test("a full round clears 15 with 2, and never invents a transaction", async () => {
  const client = createMockClient();
  assert.equal(client.mode, "sample");
  const plan = await client.planRound(SAMPLE_CIRCLE, new Map([[ada, 2n * ONE]]));
  assert.equal(plan.gross, 15n * ONE);
  const paid = plan.positions.reduce((sum, p) => sum + (p.out > p.in ? p.out - p.in : 0n), 0n);
  const received = plan.positions.reduce((sum, p) => sum + (p.in > p.out ? p.in - p.out : 0n), 0n);
  assert.equal(paid, 2n * ONE);
  assert.equal(paid, received);

  const round = await client.openRound(plan);
  await assert.rejects(client.settleRound(round.key), code("not-ready"));
  for (const member of members) await client.approveRound(round.key, member);
  const settled = await client.settleRound(round.key);
  assert.equal(settled.state, "confirmed");
  assert.equal(settled.txHash, undefined);
  for (const invoice of await client.listInvoices(SAMPLE_CIRCLE)) assert.equal(invoice.cleared, invoice.amount);

  // Settling again changes nothing.
  await client.settleRound(round.key);
  for (const invoice of await client.listInvoices(SAMPLE_CIRCLE)) assert.equal(invoice.cleared, invoice.amount);
});

test("a round fails whole when an invoice changed after planning", async () => {
  const client = createMockClient();
  const round = await client.openRound(await client.planRound(SAMPLE_CIRCLE, new Map([[ada, 2n * ONE]])));
  for (const member of members) await client.approveRound(round.key, member);
  await client.payInvoice(3n, ONE);
  assert.equal((await client.settleRound(round.key)).state, "failed");
  const [first] = await client.listInvoices(SAMPLE_CIRCLE);
  assert.equal(first.cleared, 0n);
});

test("an invoice needs both active businesses to sign", async () => {
  const client = createMockClient();
  const draft = { circleId: SAMPLE_CIRCLE, debtor: ada, creditor: chidi, amount: ONE, dueDate: 1, docHash: "0x00" };
  await assert.rejects(client.proposeInvoice({ ...draft, amount: 0n }, ada), code("invalid-amount"));
  await assert.rejects(client.proposeInvoice(draft, ben), code("not-a-member"));
  const item = await client.proposeInvoice(draft, ada);
  await assert.rejects(client.cosignInvoice(item.key, ada), code("not-a-member"));
  assert.equal((await client.cosignInvoice(item.key, chidi)).amount, ONE);
  await client.setMember(SAMPLE_CIRCLE, ben, false, "Ben’s Farm");
  await assert.rejects(client.proposeInvoice({ ...draft, creditor: ben }, ada), code("not-a-member"));
});

test("a member has one active mandate at a time", async () => {
  const client = createMockClient();
  const terms = {
    circleId: SAMPLE_CIRCLE, member: ada, agent, agentId: 0n, maxNetDebitPerRound: 2n * ONE, totalCap: 10n * ONE,
    maxDueDays: 30, minClearRatioBps: 30_000, minCooldown: 0, expiry: Math.floor(Date.now() / 1000) + 1_000,
  };
  await client.activateMandate(terms);
  await assert.rejects(client.activateMandate(terms), code("mandate-already-active"));
  assert.equal((await client.revokeMandate(ada)).state, "revoked");
  assert.equal((await client.activateMandate(terms)).state, "active");
});

test("results are copies, so a screen cannot change stored data", async () => {
  const client = createMockClient();
  const [invoice] = await client.listInvoices(SAMPLE_CIRCLE);
  invoice.amount = 0n;
  assert.equal((await client.listInvoices(SAMPLE_CIRCLE))[0].amount, 6n * ONE);
});
