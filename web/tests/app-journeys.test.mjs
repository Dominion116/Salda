import assert from "node:assert/strict";
import test from "node:test";
import { mandateProblem } from "../src/client/mandate.ts";
import { createMockClient, SAMPLE_CIRCLE, sampleMembers } from "../src/client/mock.ts";
import { ONE } from "../src/lib/money.ts";

const { ada, ben, chidi, agent } = sampleMembers;
const members = [ada, ben, chidi];
const code = (expected) => (error) => error.code === expected;
const terms = (member, extra = {}) => ({
  circleId: SAMPLE_CIRCLE, member, agent, agentId: 0n, maxNetDebitPerRound: 2n * ONE, totalCap: 10n * ONE,
  maxDueDays: 30, minClearRatioBps: 30_000, minCooldown: 0, expiry: Math.floor(Date.now() / 1000) + 10_000, ...extra,
});

test("an admin can create a circle, add a member and rename them", async () => {
  const client = createMockClient();
  const circle = await client.createCircle("Harbor Co-op", ada, "Ada’s Bakery");
  assert.equal(circle.admin, ada);
  await client.setMember(circle.id, ben, true, "Ben’s Farm");
  const updated = await client.setMember(circle.id, ben, true, "Ben’s Farm Ltd");
  assert.deepEqual(updated.members.map((m) => m.name.value), ["Ada’s Bakery", "Ben’s Farm Ltd"]);
  await assert.rejects(client.planRound(circle.id, new Map()), code("not-supported-in-sample"));
});

test("voiding needs both businesses, in two separate signatures", async () => {
  const client = createMockClient();
  await assert.rejects(client.signVoid(1n, chidi), code("not-a-member"));
  assert.equal((await client.signVoid(1n, ada)).voidSignedBy, ada);
  await assert.rejects(client.signVoid(1n, ada), code("already-signed"));
  assert.equal((await client.signVoid(1n, ben)).voided, true);
  await assert.rejects(client.payInvoice(1n, ONE), code("already-voided"));
});

test("a direct payment cancels a half-signed void", async () => {
  const client = createMockClient();
  await client.signVoid(1n, ben);
  assert.equal((await client.payInvoice(1n, ONE)).voidSignedBy, null);
});

test("new invoices do not stop the sample round from planning", async () => {
  const client = createMockClient();
  const item = await client.proposeInvoice(
    { circleId: SAMPLE_CIRCLE, debtor: ben, creditor: ada, amount: ONE, dueDate: 1, docHash: "0x00" }, ben);
  await client.cosignInvoice(item.key, ada);
  assert.equal((await client.planRound(SAMPLE_CIRCLE, new Map())).gross, 12n * ONE);
});

test("the agent only proposes when someone has no mandate", async () => {
  const client = createMockClient();
  await client.setCashLimit(SAMPLE_CIRCLE, ada, 2n * ONE);
  await client.activateMandate(terms(ada));
  const event = await client.runAgent(SAMPLE_CIRCLE);
  assert.equal(event.kind, "proposed");
  const [round] = await client.listRounds(SAMPLE_CIRCLE);
  assert.deepEqual(round.approvedBy, [ada]);
  await assert.rejects(client.settleRound(round.key), code("not-ready"));
});

test("the agent settles when every mandate allows it, and counts what was spent", async () => {
  const client = createMockClient();
  await client.setCashLimit(SAMPLE_CIRCLE, ada, 2n * ONE);
  for (const member of members) await client.activateMandate(terms(member));
  assert.equal((await client.runAgent(SAMPLE_CIRCLE)).kind, "settled");
  assert.equal((await client.getMandate(ada)).spent, 2n * ONE);
  assert.equal((await client.getMandate(ben)).spent, 0n);
});

test("the agent spends less to respect a clear ratio", async () => {
  const client = createMockClient();
  await client.setCashLimit(SAMPLE_CIRCLE, ada, 2n * ONE);
  await client.activateMandate(terms(ada, { minClearRatioBps: 50_000 }));
  await client.runAgent(SAMPLE_CIRCLE);
  const [round] = await client.listRounds(SAMPLE_CIRCLE);
  assert.equal(round.plan.cash, ONE);
});

test("revoking after the agent signs makes the round fail whole", async () => {
  const client = createMockClient();
  await client.setCashLimit(SAMPLE_CIRCLE, ada, 2n * ONE);
  await client.activateMandate(terms(ada));
  await client.runAgent(SAMPLE_CIRCLE);
  const [round] = await client.listRounds(SAMPLE_CIRCLE);
  await client.approveRound(round.key, ben);
  await client.approveRound(round.key, chidi);
  await client.revokeMandate(ada);
  const settled = await client.settleRound(round.key);
  assert.equal(settled.state, "failed");
  for (const invoice of await client.listInvoices(SAMPLE_CIRCLE)) assert.equal(invoice.cleared, 0n);
});

test("each mandate limit refuses just past its edge", async () => {
  const client = createMockClient();
  const plan = await client.planRound(SAMPLE_CIRCLE, new Map([[ada, 2n * ONE]]));
  const invoices = await client.listInvoices(SAMPLE_CIRCLE);
  const position = plan.positions.find((p) => p.member === ada);
  const at = Math.floor(Date.now() / 1000);
  const check = (extra) => mandateProblem({ ...terms(ada), spent: 0n, state: "active", ...extra }, position, plan, invoices, at);
  assert.equal(check({}), null);
  assert.match(check({ maxNetDebitPerRound: 2n * ONE - 1n }), /one round/);
  assert.match(check({ totalCap: 2n * ONE - 1n }), /total/);
  assert.match(check({ minClearRatioBps: 30_001 }), /too little/);
  assert.match(check({ maxDueDays: 13 }), /13 days/);
  assert.match(check({ expiry: at }), /expired/);
  assert.match(check({ state: "revoked" }), /revoked/);
  assert.match(check({ circleId: 9n }), /another circle/);
});
