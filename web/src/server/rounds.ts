import type { Address, Hex } from "viem";
import { saldaAbi } from "@/chain/abi";
import { readInvoices, readMandate, type ChainInvoice } from "@/chain/reads";
import {
  CONSENT_MANDATE,
  CONSENT_SIGNED,
  hashRound,
  roundTotals,
  saldaDomain,
  saldaTypes,
  settleNonce,
  tusd8Domain,
  tusd8Types,
  type ConsentInput,
  type RoundInput,
} from "@/chain/salda";
import { agentAccount, publicClient, receiptOf, salda, submit, UserFacingError } from "./chain";
import { fromWire, toWire } from "@/lib/wire";
import { nowSeconds, same } from "./http";
import { hashAll, hashGet, hashSet, lock, unlock } from "./store";

/*
 * Rounds waiting for consent (PRD 5.4, 5.5). A round is keyed by its roundHash. Its state survives a refresh or
 * a closed tab, and the chain is always checked before anything is sent again.
 */

export type RoundState = "waiting-for-signatures" | "submitting" | "pending" | "confirmed" | "failed";

export type RoundRecord = {
  key: Hex;
  round: RoundInput;
  positions: { member: Address; out: bigint; in: bigint }[];
  gross: bigint;
  cash: bigint;
  provenOptimal: boolean;
  proposedAt: number;
  proposedBy: "member" | "agent";
  /** Signed consents, by lowercase member address. */
  consents: Record<string, ConsentInput>;
  /** Members whose standing mandate agrees for them. */
  viaMandate: Address[];
  state: RoundState;
  txHash?: Hex;
  settledAt?: number;
  failure?: string;
};

const KEEP_SECONDS = 30 * 86_400;
const listKey = (circleId: bigint) => `rounds:${circleId}`;

async function save(record: RoundRecord): Promise<RoundRecord> {
  await hashSet(listKey(record.round.circleId), record.key, toWire(record), KEEP_SECONDS);
  return record;
}

function decode(text: string | null): RoundRecord | null {
  return text ? fromWire<RoundRecord>(text) : null;
}

export async function getRound(circleId: bigint, key: Hex): Promise<RoundRecord> {
  const record = decode(await hashGet(listKey(circleId), key));
  if (!record) throw new UserFacingError("That round was not found.", 404);
  return refresh(record);
}

export async function listRounds(circleId: bigint): Promise<RoundRecord[]> {
  const all = await hashAll(listKey(circleId));
  const records = [...all.values()].map(decode).filter((item): item is RoundRecord => item !== null);
  return records.sort((a, b) => b.proposedAt - a.proposedAt);
}

/**
 * Checks a proposed round against the chain and stores it. Positions are recomputed here from on-chain
 * invoices, so a client cannot misstate what anyone pays. Members whose live mandate names this server's agent
 * are marked to consent through it.
 */
export async function openRound(
  round: RoundInput,
  options: { provenOptimal: boolean; proposedBy: "member" | "agent" },
): Promise<RoundRecord> {
  const invoices = await readInvoices(publicClient, salda(), round.circleId);
  checkLines(round, invoices);
  const byId = new Map(invoices.map((invoice) => [invoice.id, invoice]));
  const positions = roundTotals(round, (id) => byId.get(id)!);
  if (positions.length > 10) throw new UserFacingError("A round can include at most 10 businesses.");

  const agent = agentAccount()?.address;
  const viaMandate: Address[] = [];
  if (agent) {
    for (const { member } of positions) {
      const mandate = await readMandate(publicClient, salda(), member);
      if (mandate?.live && mandate.circleId === round.circleId && same(mandate.agent, agent)) viaMandate.push(member);
    }
  }

  let gross = 0n;
  let cash = 0n;
  for (const position of positions) {
    gross += position.out;
    if (position.out > position.in) cash += position.out - position.in;
  }
  const record: RoundRecord = {
    key: hashRound(salda(), round),
    round,
    positions,
    gross,
    cash,
    provenOptimal: options.provenOptimal,
    proposedAt: Number(nowSeconds()),
    proposedBy: options.proposedBy,
    consents: {},
    viaMandate,
    state: "waiting-for-signatures",
  };
  return save(record);
}

function checkLines(round: RoundInput, invoices: readonly ChainInvoice[]) {
  if (round.invoiceIds.length === 0 || round.invoiceIds.length > 30) throw new UserFacingError("A round can include 1 to 30 invoices.");
  if (round.invoiceIds.length !== round.clearAmounts.length) throw new UserFacingError("The round is malformed.");
  if (round.deadline <= nowSeconds()) throw new UserFacingError("The round's time to settle has already passed.");
  let previous = 0n;
  round.invoiceIds.forEach((id, i) => {
    const invoice = invoices.find((candidate) => candidate.id === id);
    const amount = round.clearAmounts[i] ?? 0n;
    if (id <= previous) throw new UserFacingError("This round lists an invoice twice. Plan a new round.");
    previous = id;
    if (!invoice) throw new UserFacingError("An invoice in this round is not in this circle.");
    if (invoice.voided || amount <= 0n || invoice.cleared + amount > invoice.amount) {
      throw new UserFacingError("An invoice changed after this round was planned. Plan a new round.");
    }
  });
}

/** Verifies one member's signed consent exactly as the contract will, then stores it. */
export async function addConsent(circleId: bigint, key: Hex, consent: ConsentInput): Promise<RoundRecord> {
  const record = await getRound(circleId, key);
  if (record.state !== "waiting-for-signatures") throw new UserFacingError("This round is no longer waiting for signatures.");
  const position = record.positions.find((item) => same(item.member, consent.member));
  if (!position) throw new UserFacingError("This business is not part of the round.");
  if (consent.kind !== CONSENT_SIGNED) throw new UserFacingError("Sign the round to agree to it.");

  const contract = salda();
  let valid: boolean;
  if (position.out > position.in) {
    if (consent.validBefore <= nowSeconds()) throw new UserFacingError("That signature has already expired. Sign again.");
    valid = await publicClient.verifyTypedData({
      address: position.member,
      domain: tusd8Domain,
      types: tusd8Types.ReceiveWithAuthorization,
      primaryType: "ReceiveWithAuthorization",
      message: {
        from: position.member,
        to: contract,
        value: position.out - position.in,
        validAfter: consent.validAfter,
        validBefore: consent.validBefore,
        nonce: settleNonce(contract, key, position.member),
      },
      signature: consent.signature,
    });
  } else {
    valid = await publicClient.verifyTypedData({
      address: position.member,
      domain: saldaDomain(contract),
      types: saldaTypes.ApproveRound,
      primaryType: "ApproveRound",
      message: { roundHash: key, member: position.member, outTotal: position.out, inTotal: position.in },
      signature: consent.signature,
    });
  }
  if (!valid) throw new UserFacingError("That signature does not match this round. Sign again.");

  record.consents[position.member.toLowerCase()] = { ...consent, member: position.member };
  return save(record);
}

export function waitingFor(record: RoundRecord): Address[] {
  return record.positions
    .map((item) => item.member)
    .filter(
      (member) =>
        !record.consents[member.toLowerCase()] && !record.viaMandate.some((candidate) => same(candidate, member)),
    );
}

/**
 * Submits a round once every member has agreed. Safe to call again: it checks the chain first, holds a lock so
 * two server instances never send it together, and treats a slow receipt as "still confirming".
 */
export async function settleRound(circleId: bigint, key: Hex): Promise<RoundRecord> {
  const record = await getRound(circleId, key);
  if (record.state === "confirmed" || record.state === "pending") return record;
  const missing = waitingFor(record);
  if (missing.length > 0) throw new UserFacingError("Every business in the round must agree first.");
  if (!(await lock(`lock:round:${key}`, 120))) throw new UserFacingError("This round is already being submitted.", 409);

  try {
    const contract = salda();
    if (await publicClient.readContract({ address: contract, abi: saldaAbi, functionName: "usedRoundHashes", args: [key] })) {
      record.state = "confirmed";
      record.settledAt = record.settledAt ?? Number(nowSeconds());
      return save(record);
    }

    const consents: ConsentInput[] = record.positions.map(({ member }) => {
      if (record.viaMandate.some((candidate) => same(candidate, member))) {
        return { member, kind: CONSENT_MANDATE, validAfter: 0n, validBefore: 0n, signature: "0x" };
      }
      return record.consents[member.toLowerCase()]!;
    });
    const approvals = record.viaMandate.length > 0 ? [await agentApproval(key)] : [];

    record.state = "submitting";
    await save(record);
    try {
      record.txHash = await submit("settle", [record.round, consents, approvals]);
      record.state = "pending";
    } catch (error) {
      record.state = "failed";
      record.failure = error instanceof Error ? error.message : "The round could not be submitted.";
      await save(record);
      throw error;
    }
    await save(record);
    return refresh(record, 15_000);
  } finally {
    await unlock(`lock:round:${key}`);
  }
}

/** The server agent's EIP-712 approval of a round. It holds no funds; it can only approve within mandates. */
export async function agentApproval(roundHash: Hex): Promise<{ agent: Address; signature: Hex }> {
  const agent = agentAccount();
  if (!agent) throw new UserFacingError("The clearing agent is not set up.", 503);
  const signature = await agent.signTypedData({
    domain: saldaDomain(salda()),
    types: saldaTypes.AgentApproval,
    primaryType: "AgentApproval",
    message: { roundHash, agent: agent.address },
  });
  return { agent: agent.address, signature };
}

/** Updates a pending round from its receipt. A slow receipt leaves it pending ("still confirming"). */
async function refresh(record: RoundRecord, timeoutMs = 2_000): Promise<RoundRecord> {
  if (record.state !== "pending" || !record.txHash) return record;
  const receipt = await receiptOf(record.txHash, timeoutMs);
  if (!receipt) return record;
  if (receipt.status === "success") {
    record.state = "confirmed";
    record.settledAt = Number(nowSeconds());
  } else {
    record.state = "failed";
    record.failure = "The round was refused onchain. Nothing moved. Plan a new round.";
  }
  return save(record);
}

