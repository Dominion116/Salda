import type { Address, Hex, PublicClient } from "viem";
import { saldaAbi } from "./abi";
import type { StandingMandate } from "./salda";

/*
 * Reads of SaldaClearing's current state, shared by the browser and the server. Lists come from the contract's
 * paginated getters, never from scanning logs (eth_getLogs is capped at 1,000 blocks on Aevum).
 */

const PAGE = 100n;

export type ChainMember = { address: Address; active: boolean; nameHash: Hex; nameUpdatedAt: number };
export type ChainCircle = { id: bigint; admin: Address; nameHash: Hex; members: ChainMember[] };
export type ChainInvoice = {
  id: bigint;
  circleId: bigint;
  debtor: Address;
  creditor: Address;
  amount: bigint;
  cleared: bigint;
  dueDate: number;
  registeredAt: number;
  docHash: Hex;
  voided: boolean;
};
export type ChainMandate = StandingMandate & {
  hash: Hex;
  spent: bigint;
  lastUsedAt: number;
  revoked: boolean;
  live: boolean;
};

const ZERO_HASH = `0x${"0".repeat(64)}` as Hex;
const ZERO_ADDRESS = `0x${"0".repeat(40)}` as Address;

export async function readCircle(client: PublicClient, salda: Address, circleId: bigint): Promise<ChainCircle | null> {
  const circle = await client.readContract({ address: salda, abi: saldaAbi, functionName: "getCircle", args: [circleId] });
  if (circle.admin === ZERO_ADDRESS) return null;
  const members: ChainMember[] = [];
  for (let offset = 0n; ; offset += PAGE) {
    const [addresses, info, total] = await client.readContract({
      address: salda,
      abi: saldaAbi,
      functionName: "getCircleMembers",
      args: [circleId, offset, PAGE],
    });
    addresses.forEach((address, i) => {
      const member = info[i]!;
      members.push({ address, active: member.active, nameHash: member.nameHash, nameUpdatedAt: Number(member.nameUpdatedAt) });
    });
    if (offset + PAGE >= total) break;
  }
  return { id: circleId, admin: circle.admin, nameHash: circle.nameHash, members };
}

export async function readInvoices(client: PublicClient, salda: Address, circleId: bigint): Promise<ChainInvoice[]> {
  const ids: bigint[] = [];
  for (let offset = 0n; ; offset += PAGE) {
    const [page, total] = await client.readContract({
      address: salda,
      abi: saldaAbi,
      functionName: "getCircleInvoiceIds",
      args: [circleId, offset, PAGE],
    });
    ids.push(...page);
    if (offset + PAGE >= total) break;
  }
  const invoices: ChainInvoice[] = [];
  for (let start = 0; start < ids.length; start += Number(PAGE)) {
    const slice = ids.slice(start, start + Number(PAGE));
    const rows = await client.readContract({ address: salda, abi: saldaAbi, functionName: "getInvoices", args: [slice] });
    rows.forEach((row, i) =>
      invoices.push({
        id: slice[i]!,
        circleId: row.circleId,
        debtor: row.debtor,
        creditor: row.creditor,
        amount: row.amount,
        cleared: row.cleared,
        dueDate: Number(row.dueDate),
        registeredAt: Number(row.registeredAt),
        docHash: row.docHash,
        voided: row.voided,
      }),
    );
  }
  return invoices;
}

/** Circles the member belongs to. Fine while there are a few hundred circles; reads them in one multicall. */
export async function circlesOf(client: PublicClient, salda: Address, member: Address): Promise<bigint[]> {
  const count = await client.readContract({ address: salda, abi: saldaAbi, functionName: "circleCount" });
  const ids = Array.from({ length: Number(count) }, (_, i) => BigInt(i + 1));
  if (ids.length === 0) return [];
  const results = await client.multicall({
    contracts: ids.map((id) => ({ address: salda, abi: saldaAbi, functionName: "getMember", args: [id, member] }) as const),
    allowFailure: false,
  });
  return ids.filter((_, i) => results[i]!.listed);
}

export async function readMandate(client: PublicClient, salda: Address, member: Address): Promise<ChainMandate | null> {
  const hash = await client.readContract({ address: salda, abi: saldaAbi, functionName: "activeMandateOf", args: [member] });
  if (hash === ZERO_HASH) return null;
  return readMandateByHash(client, salda, hash);
}

export async function readMandateByHash(client: PublicClient, salda: Address, hash: Hex): Promise<ChainMandate | null> {
  const [m, state] = await client.readContract({ address: salda, abi: saldaAbi, functionName: "getMandate", args: [hash] });
  if (m.member === ZERO_ADDRESS) return null;
  const [isLive, active] = await Promise.all([
    client.readContract({ address: salda, abi: saldaAbi, functionName: "hasLiveMandate", args: [m.member] }),
    client.readContract({ address: salda, abi: saldaAbi, functionName: "activeMandateOf", args: [m.member] }),
  ]);
  return {
    circleId: m.circleId,
    member: m.member,
    agent: m.agent,
    agentId: m.agentId,
    maxNetDebitPerRound: m.maxNetDebitPerRound,
    totalCap: m.totalCap,
    maxDueDays: m.maxDueDays,
    minClearRatioBps: m.minClearRatioBps,
    minCooldown: m.minCooldown,
    expiry: m.expiry,
    mandateNonce: m.mandateNonce,
    hash,
    spent: state.spent,
    lastUsedAt: Number(state.lastUsedAt),
    revoked: state.revoked,
    live: isLive && active === hash,
  };
}
