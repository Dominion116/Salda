import { hashTypedData, isHex, zeroAddress, type Address, type Hex } from "viem";
import { saldaAbi } from "@/chain/abi";
import {
  cashLimitMessage,
  MESSAGE_WINDOW_SECONDS,
  readNamesMessage,
  saveNamesMessage,
  type NameEntry,
} from "@/chain/messages";
import { readCircle } from "@/chain/reads";
import { circleNameHash, nameHash, saldaDomain, saldaTypes, type ConsentInput, type InvoiceInput, type RoundInput } from "@/chain/salda";
import { publicClient, salda, submit, UserFacingError } from "@/server/chain";
import { address, body, clientIp, handle, hex, limit, nowSeconds, refuse, reply, same, text, units } from "@/server/http";
import { addConsent, getRound, listRounds, openRound, settleRound } from "@/server/rounds";
import { hashAll, hashDelete, hashGet, hashSet } from "@/server/store";
import { fromWire, toWire } from "@/lib/wire";

/*
 * The pending-item store (PRD 5.4): items waiting for another person. The store is untrusted: every signature
 * is checked here before saving, and the contract checks everything again. Names and salts are served only to
 * active members who sign a fresh request, and never logged.
 */
export const runtime = "nodejs";

export type PendingRecord = { key: Hex; invoice: InvoiceInput; signedBy: Address; signature: Hex };
export type VoidRecord = { invoiceId: bigint; remaining: bigint; deadline: bigint; signedBy: Address; signature: Hex };

const pendingKey = (circleId: bigint) => `pending:${circleId}`;
const voidKey = (circleId: bigint) => `voids:${circleId}`;
const cashKey = (circleId: bigint) => `cash:${circleId}`;
const namesKey = (circleId: bigint) => `names:${circleId}`;

const circleIdOf = (value: unknown) => units(value, "circle");

export async function GET(request: Request) {
  return handle(async () => {
    await limit(`store:read:${clientIp(request)}`, 120);
    const params = new URL(request.url).searchParams;
    const kind = params.get("kind");
    const circleId = BigInt(params.get("circleId") ?? "0");
    if (circleId <= 0n) return refuse("Choose a circle.");

    if (kind === "pending") return reply(await values<PendingRecord>(pendingKey(circleId)));
    if (kind === "voids") return reply(await values<VoidRecord>(voidKey(circleId)));
    if (kind === "rounds") return reply(await listRounds(circleId));
    if (kind === "round") return reply(await getRound(circleId, hex(params.get("key"), "round", 32)));
    if (kind === "cash") {
      const all = await hashAll(cashKey(circleId));
      return reply([...all].map(([member, amount]) => ({ member: member as Address, amount: BigInt(amount) })));
    }
    return refuse("Unknown request.");
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    await limit(`store:write:${clientIp(request)}`, 30);
    const input = await body<Record<string, unknown>>(request);
    switch (input.action) {
      case "invoice.propose":
        return reply(await proposeInvoice(input));
      case "invoice.cosign":
        return reply(await cosignInvoice(input));
      case "void.sign":
        return reply(await signVoid(input));
      case "round.open": {
        const round = input.round as RoundInput;
        return reply(await openRound(round, { provenOptimal: input.provenOptimal === true, proposedBy: "member" }));
      }
      case "round.consent":
        return reply(await addConsent(circleIdOf(input.circleId), hex(input.key, "round", 32), input.consent as ConsentInput));
      case "round.settle":
        return reply(await settleRound(circleIdOf(input.circleId), hex(input.key, "round", 32)));
      case "cash.set":
        return reply(await setCash(input));
      case "names.set":
        return reply(await saveNames(input));
      case "names.get":
        return reply(await readNames(input));
      default:
        return refuse("Unknown request.");
    }
  });
}

// --------------------------------------------------------------- invoices

function invoiceDigest(invoice: InvoiceInput): Hex {
  return hashTypedData({
    domain: saldaDomain(salda()),
    types: saldaTypes.RegisterInvoice,
    primaryType: "RegisterInvoice",
    message: invoice,
  });
}

async function verifyInvoiceSignature(invoice: InvoiceInput, signer: Address, signature: Hex) {
  const valid = await publicClient.verifyTypedData({
    address: signer,
    domain: saldaDomain(salda()),
    types: saldaTypes.RegisterInvoice,
    primaryType: "RegisterInvoice",
    message: invoice,
    signature,
  });
  if (!valid) throw new UserFacingError("That signature does not match this invoice. Sign again.");
}

async function proposeInvoice(input: Record<string, unknown>): Promise<PendingRecord> {
  const invoice = input.invoice as InvoiceInput;
  const signer = address(input.signer, "signer");
  const signature = hex(input.signature, "signature");
  address(invoice?.debtor, "debtor");
  address(invoice?.creditor, "creditor");
  if (!same(signer, invoice.debtor) && !same(signer, invoice.creditor)) {
    throw new UserFacingError("Only the two businesses on an invoice can sign it.");
  }
  if (units(invoice.amount) === 0n || same(invoice.debtor, invoice.creditor)) {
    throw new UserFacingError("Enter an amount above 0, between two different businesses.");
  }
  if (units(invoice.deadline, "deadline") <= nowSeconds()) throw new UserFacingError("The time to sign has passed.");
  const circle = await readCircle(publicClient, salda(), circleIdOf(invoice.circleId));
  const active = (who: Address) => circle?.members.some((member) => same(member.address, who) && member.active);
  if (!active(invoice.debtor) || !active(invoice.creditor)) {
    throw new UserFacingError("Both businesses must be active members of this circle.");
  }
  await verifyInvoiceSignature(invoice, signer, signature);

  const record: PendingRecord = { key: invoiceDigest(invoice), invoice, signedBy: signer, signature };
  await hashSet(pendingKey(invoice.circleId), record.key, toWire(record), Number(invoice.deadline - nowSeconds()));
  return record;
}

async function cosignInvoice(input: Record<string, unknown>) {
  const circleId = circleIdOf(input.circleId);
  const key = hex(input.key, "invoice", 32);
  const signer = address(input.signer, "signer");
  const signature = hex(input.signature, "signature");
  const stored = await hashGet(pendingKey(circleId), key);
  if (!stored) throw new UserFacingError("That unsigned invoice was not found, or its time to sign ran out.", 404);
  const record = fromWire<PendingRecord>(stored);
  const other = same(record.signedBy, record.invoice.debtor) ? record.invoice.creditor : record.invoice.debtor;
  if (!same(signer, other)) throw new UserFacingError("The other business on this invoice must sign it.");
  await verifyInvoiceSignature(record.invoice, signer, signature);

  const debtorSig = same(record.signedBy, record.invoice.debtor) ? record.signature : signature;
  const creditorSig = same(record.signedBy, record.invoice.debtor) ? signature : record.signature;
  const hash = await submit("registerInvoice", [record.invoice, debtorSig, creditorSig]);
  await hashDelete(pendingKey(circleId), key);
  return { hash };
}

// ------------------------------------------------------------------ voids

async function signVoid(input: Record<string, unknown>) {
  const invoiceId = units(input.invoiceId, "invoice");
  const deadline = units(input.deadline, "deadline");
  const signer = address(input.signer, "signer");
  const signature = hex(input.signature, "signature");
  if (deadline <= nowSeconds()) throw new UserFacingError("The time to sign has passed.");

  const invoice = await publicClient.readContract({ address: salda(), abi: saldaAbi, functionName: "getInvoice", args: [invoiceId] });
  if (invoice.debtor === zeroAddress) throw new UserFacingError("That invoice was not found.", 404);
  if (!same(signer, invoice.debtor) && !same(signer, invoice.creditor)) {
    throw new UserFacingError("Only the two businesses on an invoice can void it.");
  }
  const remaining = invoice.amount - invoice.cleared;
  const valid = await publicClient.verifyTypedData({
    address: signer,
    domain: saldaDomain(salda()),
    types: saldaTypes.VoidInvoice,
    primaryType: "VoidInvoice",
    message: { invoiceId, remainingAmount: remaining, deadline },
    signature,
  });
  if (!valid) throw new UserFacingError("That signature does not match this invoice. Sign again.");

  const field = invoiceId.toString();
  const earlier = await hashGet(voidKey(invoice.circleId), field);
  const first = earlier ? fromWire<VoidRecord>(earlier) : null;
  if (first && !same(first.signedBy, signer) && first.deadline === deadline && first.remaining === remaining) {
    const debtorSig = same(first.signedBy, invoice.debtor) ? first.signature : signature;
    const creditorSig = same(first.signedBy, invoice.debtor) ? signature : first.signature;
    const hash = await submit("voidInvoice", [invoiceId, deadline, debtorSig, creditorSig]);
    await hashDelete(voidKey(invoice.circleId), field);
    return { hash, voided: true };
  }
  const record: VoidRecord = { invoiceId, remaining, deadline, signedBy: signer, signature };
  await hashSet(voidKey(invoice.circleId), field, toWire(record), Number(deadline - nowSeconds()));
  return { voided: false, record };
}

// --------------------------------------------------------- cash and names

function checkTime(at: unknown): number {
  const time = typeof at === "number" ? at : NaN;
  if (!Number.isInteger(time) || Math.abs(Number(nowSeconds()) - time) > MESSAGE_WINDOW_SECONDS) {
    throw new UserFacingError("That request is out of date. Try again.");
  }
  return time;
}

async function setCash(input: Record<string, unknown>) {
  const circleId = circleIdOf(input.circleId);
  const member = address(input.member, "member");
  const amount = units(input.amount);
  const at = checkTime(input.at);
  const valid = await publicClient.verifyMessage({
    address: member,
    message: cashLimitMessage(circleId, member, amount, at),
    signature: hex(input.signature, "signature"),
  });
  if (!valid) throw new UserFacingError("That signature does not match. Sign again.");
  await hashSet(cashKey(circleId), member.toLowerCase(), amount.toString());
  return { member, amount };
}

async function saveNames(input: Record<string, unknown>) {
  const circleId = circleIdOf(input.circleId);
  const signer = address(input.signer, "signer");
  const at = checkTime(input.at);
  const raw = Array.isArray(input.entries) ? input.entries : [];
  if (raw.length === 0 || raw.length > 50) throw new UserFacingError("Send 1 to 50 names.");
  const entries: NameEntry[] = raw.map((entry: Record<string, unknown>) => ({
    member: address(entry.member, "member"),
    name: text(entry.name, "business name"),
    salt: hex(entry.salt, "salt", 32),
  }));

  const circle = await readCircle(publicClient, salda(), circleId);
  if (!circle) throw new UserFacingError("That circle was not found. If you just created it, wait a few seconds.", 404);
  if (!same(circle.admin, signer)) throw new UserFacingError("Only the person who runs this circle can save names.", 403);
  const valid = await publicClient.verifyMessage({
    address: signer,
    message: saveNamesMessage(circleId, entries, at),
    signature: hex(input.signature, "signature"),
  });
  if (!valid) throw new UserFacingError("That signature does not match. Sign again.");

  // A name is saved only if it matches the hash the admin attested onchain.
  for (const entry of entries) {
    const onchain =
      entry.member === zeroAddress
        ? circle.nameHash
        : circle.members.find((member) => same(member.address, entry.member))?.nameHash;
    const expected = entry.member === zeroAddress ? circleNameHash(entry.name, entry.salt) : nameHash(entry.member, entry.name, entry.salt);
    if (!onchain || onchain !== expected) {
      throw new UserFacingError("A name does not match what the circle recorded onchain. Wait for it to confirm, then try again.");
    }
  }
  for (const entry of entries) {
    await hashSet(namesKey(circleId), entry.member.toLowerCase(), JSON.stringify({ name: entry.name, salt: entry.salt }));
  }
  return { saved: entries.length };
}

async function readNames(input: Record<string, unknown>) {
  const circleId = circleIdOf(input.circleId);
  const member = address(input.member, "member");
  const at = checkTime(input.at);
  const valid = await publicClient.verifyMessage({
    address: member,
    message: readNamesMessage(circleId, at),
    signature: hex(input.signature, "signature"),
  });
  if (!valid) throw new UserFacingError("That signature does not match. Sign again.");
  const circle = await readCircle(publicClient, salda(), circleId);
  const allowed = circle && (same(circle.admin, member) || circle.members.some((item) => same(item.address, member) && item.active));
  if (!allowed) throw new UserFacingError("Only active members of this circle can see its business names.", 403);

  const all = await hashAll(namesKey(circleId));
  const entries: NameEntry[] = [];
  for (const [who, value] of all) {
    const parsed = JSON.parse(value) as { name?: unknown; salt?: unknown };
    if (typeof parsed.name === "string" && typeof parsed.salt === "string" && isHex(parsed.salt)) {
      entries.push({ member: who as Address, name: parsed.name, salt: parsed.salt });
    }
  }
  return entries;
}

// ---------------------------------------------------------------- helpers

async function values<T>(key: string): Promise<T[]> {
  return [...(await hashAll(key)).values()].map((value) => fromWire<T>(value));
}
