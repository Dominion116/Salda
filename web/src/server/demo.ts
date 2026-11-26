import { parseEventLogs, type Address, type Hex } from "viem";
import type { PrivateKeyAccount } from "viem/accounts";
import { saldaAbi } from "@/chain/abi";
import {
  CONSENT_MANDATE,
  CONSENT_SIGNED,
  hashRound,
  nameHash,
  randomHex32,
  roundTotals,
  saldaDomain,
  saldaTypes,
  settleNonce,
  tusd8Domain,
  tusd8Types,
  type ConsentInput,
  type InvoiceInput,
  type RoundInput,
} from "@/chain/salda";
import { revertName, explain } from "@/lib/explain";
import { fromWire, toWire } from "@/lib/wire";
import {
  demoBenAccount,
  demoChidiAccount,
  publicClient,
  receiptOf,
  relayerAccount,
  salda,
  sendTusd8,
  submit,
  UserFacingError,
} from "./chain";
import { nowSeconds, same } from "./http";
import { addConsent, agentApproval, openRound, settleRound, type RoundRecord } from "./rounds";
import { bump, getText, setText } from "./store";

/*
 * The live judge sandbox (PRD 5.2), at 1/100 scale. The judge plays Ada with their own wallet; Ben and Chidi are
 * server-held demo counterparties. Two wallet prompts in total: one batch signature that co-signs the three
 * invoices, and one round consent. The relayer pays every fee and seeds the judge 0.02 tUSD8 after a valid
 * signature, within per-wallet, per-IP and daily limits.
 */

const CENT = 10_000n; // 0.01 tUSD8
export const DEMO_SEED = 2n * CENT;
const DAY = 86_400;
const SESSION_SECONDS = DAY;
const DAILY_LIMIT = Number(process.env.DEMO_DAILY_LIMIT ?? 100);

type Session = { player: Address; circleId: bigint; invoices: InvoiceInput[]; deadline: bigint; invoiceIds: bigint[]; seeded: boolean };

const sessionKey = (circleId: bigint) => `demo:session:${circleId}`;

function counterparties(): { ben: PrivateKeyAccount; chidi: PrivateKeyAccount } {
  const ben = demoBenAccount();
  const chidi = demoChidiAccount();
  if (!ben || !chidi || !relayerAccount()) throw new UserFacingError("The live demo is not set up yet. Use sample data.", 503);
  return { ben, chidi };
}

async function loadSession(circleId: bigint): Promise<Session> {
  const text = await getText(sessionKey(circleId));
  if (!text) throw new UserFacingError("This demo session has ended. Start a new one.", 404);
  return fromWire<Session>(text);
}

const saveSession = (session: Session) => setText(sessionKey(session.circleId), toWire(session), SESSION_SECONDS);

/** Step 1: a fresh circle for this judge, and the three invoices for them to sign in one prompt. */
export async function startDemo(player: Address, ip: string) {
  const { ben, chidi } = counterparties();
  if ((await bump(`demo:start:${player.toLowerCase()}`, DAY)) > 5) throw new UserFacingError("This wallet has started 5 demos today. Try again tomorrow.", 429);
  if ((await bump(`demo:start:ip:${ip}`, DAY)) > 10) throw new UserFacingError("Too many demos from this network today. Try again tomorrow.", 429);

  const relayer = relayerAccount()!;
  const members = [player, ben.address, chidi.address];
  const nameHashes = [
    nameHash(player, "Ada (you)", randomHex32()),
    nameHash(ben.address, "Ben (demo)", randomHex32()),
    nameHash(chidi.address, "Chidi (demo)", randomHex32()),
  ];
  const circleNameHashValue = nameHash("0x0000000000000000000000000000000000000000", "Salda demo", randomHex32());
  const nonce = await publicClient.readContract({ address: salda(), abi: saldaAbi, functionName: "nonces", args: [relayer.address] });
  const deadline = nowSeconds() + 600n;
  const signature = await relayer.signTypedData({
    domain: saldaDomain(salda()),
    types: saldaTypes.CreateCircle,
    primaryType: "CreateCircle",
    message: { circleNameHash: circleNameHashValue, members, nameHashes, nonce, deadline },
  });
  const hash = await submit("createCircleWithSig", [
    relayer.address,
    { nameHash: circleNameHashValue, members, memberNameHashes: nameHashes },
    deadline,
    signature,
  ]);
  const receipt = await receiptOf(hash, 30_000);
  if (!receipt) throw new UserFacingError("The network is slow. Start the demo again in a moment.", 503);
  const [created] = parseEventLogs({ abi: saldaAbi, eventName: "CircleCreated", logs: receipt.logs });
  if (!created) throw new UserFacingError("The demo circle was not created. Try again.");
  const circleId = created.args.circleId;

  const now = nowSeconds();
  const invoice = (debtor: Address, creditor: Address, cents: bigint): InvoiceInput => ({
    circleId,
    debtor,
    creditor,
    amount: cents * CENT,
    dueDate: now + 14n * BigInt(DAY),
    docHash: randomHex32(),
    salt: randomHex32(),
    deadline: now + 1_800n,
  });
  const session: Session = {
    player,
    circleId,
    invoices: [invoice(player, ben.address, 6n), invoice(ben.address, chidi.address, 5n), invoice(chidi.address, player, 4n)],
    deadline: now + 1_800n,
    invoiceIds: [],
    seeded: false,
  };
  await saveSession(session);
  return { circleId, invoices: session.invoices, deadline: session.deadline, ben: ben.address, chidi: chidi.address, createTx: hash };
}

const batchMessage = (session: Session) => ({ invoices: session.invoices, deadline: session.deadline });

/** Step 2: the judge's batch signature co-signs all three invoices; Ben and Chidi sign here; the judge is seeded. */
export async function registerDemo(circleId: bigint, signature: Hex, ip: string) {
  const { ben, chidi } = counterparties();
  const session = await loadSession(circleId);
  if (session.invoiceIds.length > 0) return { invoiceIds: session.invoiceIds, seeded: session.seeded };

  const domain = saldaDomain(salda());
  const valid = await publicClient.verifyTypedData({
    address: session.player,
    domain,
    types: saldaTypes.RegisterInvoiceBatch,
    primaryType: "RegisterInvoiceBatch",
    message: batchMessage(session),
    signature,
  });
  if (!valid) throw new UserFacingError("That signature does not match the demo invoices. Sign again.");

  const sign = (account: PrivateKeyAccount) =>
    account.signTypedData({ domain, types: saldaTypes.RegisterInvoiceBatch, primaryType: "RegisterInvoiceBatch", message: batchMessage(session) });
  const sigs = [
    { signer: session.player, signature },
    { signer: ben.address, signature: await sign(ben) },
    { signer: chidi.address, signature: await sign(chidi) },
  ];
  const hash = await submit("registerInvoices", [session.invoices, session.deadline, sigs]);
  const receipt = await receiptOf(hash, 30_000);
  if (!receipt) throw new UserFacingError("The network is slow. Try again in a moment.", 503);
  const registered = parseEventLogs({ abi: saldaAbi, eventName: "InvoiceRegistered", logs: receipt.logs });
  session.invoiceIds = registered.map((log) => log.args.invoiceId).sort((a, b) => (a < b ? -1 : 1));

  // Seed only after a valid signature, within limits (PRD 5.2.6).
  let seedTx: Hex | undefined;
  const today = new Date().toISOString().slice(0, 10);
  const allowed =
    (await bump(`demo:seed:${session.player.toLowerCase()}`, DAY)) <= 2 &&
    (await bump(`demo:seed:ip:${ip}`, DAY)) <= 4 &&
    (await bump(`demo:seed:${today}`, DAY)) <= DAILY_LIMIT;
  if (allowed) {
    seedTx = await sendTusd8(session.player, DEMO_SEED);
    await receiptOf(seedTx, 30_000);
    session.seeded = true;
  }
  await saveSession(session);
  return { registerTx: hash, seedTx, invoiceIds: session.invoiceIds, seeded: session.seeded };
}

/**
 * Step 3: the judge's consent plus Ben's and Chidi's, then settle. The round is checked against the chain
 * and must use only this session's invoices.
 */
export async function settleDemo(circleId: bigint, round: RoundInput, consent: ConsentInput): Promise<RoundRecord> {
  const { ben, chidi } = counterparties();
  const session = await loadSession(circleId);
  if (round.circleId !== circleId || round.invoiceIds.some((id) => !session.invoiceIds.includes(id))) {
    throw new UserFacingError("That round is not this demo's. Start again.");
  }
  if (!same(consent.member, session.player)) throw new UserFacingError("Sign with the wallet that started the demo.");

  const record = await openRound(round, { provenOptimal: true, proposedBy: "member" });
  await addConsent(circleId, record.key, consent);
  for (const account of [ben, chidi]) {
    const position = record.positions.find((item) => same(item.member, account.address));
    if (!position) continue;
    await addConsent(circleId, record.key, await serverConsent(account, record.key, round.deadline, position));
  }
  return settleRound(circleId, record.key);
}

async function serverConsent(
  account: PrivateKeyAccount,
  roundHash: Hex,
  validBefore: bigint,
  position: { out: bigint; in: bigint },
): Promise<ConsentInput> {
  const contract = salda();
  const signature =
    position.out > position.in
      ? await account.signTypedData({
          domain: tusd8Domain,
          types: tusd8Types.ReceiveWithAuthorization,
          primaryType: "ReceiveWithAuthorization",
          message: {
            from: account.address,
            to: contract,
            value: position.out - position.in,
            validAfter: 0n,
            validBefore,
            nonce: settleNonce(contract, roundHash, account.address),
          },
        })
      : await account.signTypedData({
          domain: saldaDomain(contract),
          types: saldaTypes.ApproveRound,
          primaryType: "ApproveRound",
          message: { roundHash, member: account.address, outTotal: position.out, inTotal: position.in },
        });
  return { member: account.address, kind: CONSENT_SIGNED, validAfter: 0n, validBefore, signature };
}

// ------------------------------------------------- compromised agent

export type AttackKey = "fair" | "ratio" | "cap" | "due";

/**
 * "Simulated compromised agent" (PRD 4.2.3). The agent builds and approves a bad round for a demo shop with a
 * mandate, and the round is simulated against the live contract, which refuses it. Nothing is ever sent.
 * Uses the circle that contracts/script/DemoSetup.s.sol created: Ben has a live mandate, Chidi a revoked one.
 */
export async function simulateAttack(attack: AttackKey, revoked: boolean) {
  const { ben, chidi } = counterparties();
  const circleId = BigInt(process.env.DEMO_ATTACK_CIRCLE?.trim() || "0");
  const ids = (process.env.DEMO_ATTACK_INVOICES ?? "").split(",").map((item) => item.trim()).filter(Boolean).map(BigInt);
  if (circleId === 0n || ids.length !== 3) throw new UserFacingError("The compromised-agent demo is not set up yet.", 503);
  const [benOwes, chidiOwes, benOwesLater] = ids as [bigint, bigint, bigint];

  // Ben owes Chidi 0.06 and 0.03 (due in 90 days); Chidi owes Ben 0.04. Ben's mandate: 0.02 a round, at least 3.0x.
  const lines: [bigint, bigint][] = revoked
    ? [[chidiOwes, CENT]] // Chidi's mandate is revoked, so any round using it is refused
    : attack === "fair"
      ? [[benOwes, 6n * CENT], [chidiOwes, 4n * CENT]] // pays 0.02 to clear 0.06: 3.0x
      : attack === "ratio"
        ? [[benOwes, 3n * CENT], [chidiOwes, CENT]] // pays 0.02 to clear 0.03: 1.5x
        : attack === "cap"
          ? [[benOwes, 6n * CENT], [chidiOwes, 3n * CENT]] // pays 0.03, over the 0.02 round limit
          : [[chidiOwes, CENT], [benOwesLater, 3n * CENT]]; // includes the invoice due in 90 days
  lines.sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const round: RoundInput = {
    circleId,
    roundNonce: BigInt(randomHex32()),
    deadline: nowSeconds() + 600n,
    invoiceIds: lines.map(([id]) => id),
    clearAmounts: lines.map(([, amount]) => amount),
  };
  const roundHash = hashRound(salda(), round);
  const mandated = (member: Address): ConsentInput => ({ member, kind: CONSENT_MANDATE, validAfter: 0n, validBefore: 0n, signature: "0x" });
  // Ben always agrees through his mandate, which is what the agent is attacking. Chidi signs for himself,
  // except in the revoked case, where his revoked mandate is what gets refused.
  const parties = new Map<bigint, { debtor: Address; creditor: Address }>([
    [benOwes, { debtor: ben.address, creditor: chidi.address }],
    [chidiOwes, { debtor: chidi.address, creditor: ben.address }],
    [benOwesLater, { debtor: ben.address, creditor: chidi.address }],
  ]);
  const chidiPosition = roundTotals(round, (id) => parties.get(id)!).find((item) => same(item.member, chidi.address)) ?? { out: 0n, in: 0n };
  const consents = [
    mandated(ben.address),
    revoked ? mandated(chidi.address) : await serverConsent(chidi, roundHash, round.deadline, chidiPosition),
  ];
  const approval = await agentApproval(roundHash);

  try {
    await publicClient.simulateContract({
      account: relayerAccount()!.address,
      address: salda(),
      abi: saldaAbi,
      functionName: "settle",
      args: [round, consents, [approval]],
    });
    return { refused: false, revert: null, message: "The contract would accept this round. It stays inside every limit.", moved: "0.00" };
  } catch (error) {
    const name = revertName(error) ?? "Reverted";
    return { refused: true, revert: name, message: explain(error), moved: "0.00" };
  }
}
