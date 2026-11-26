import {
  createPublicClient,
  erc20Abi,
  http,
  parseEventLogs,
  parseSignature,
  zeroAddress,
  type Hex,
  type TransactionReceipt,
  type WalletClient,
} from "viem";
import { saldaAbi } from "@/chain/abi";
import { cashLimitMessage, readNamesMessage, saveNamesMessage, type NameEntry } from "@/chain/messages";
import { circlesOf, readCircle, readInvoices, readMandate, readMandateByHash, type ChainCircle, type ChainMandate } from "@/chain/reads";
import {
  aevum,
  circleNameHash,
  CONSENT_SIGNED,
  directNonce,
  hashMandate,
  nameHash,
  randomHex32,
  saldaDomain,
  saldaTypes,
  settleNonce,
  TUSD8,
  tusd8Domain,
  tusd8Types,
  type InvoiceInput,
  type RoundInput,
  type StandingMandate,
} from "@/chain/salda";
import { explain } from "@/lib/explain";
import { solveWithMandates, type MandateLimits, type SolverInvoice } from "@/lib/solver";
import { callApi } from "@/lib/wire";
import type { PendingRecord, VoidRecord } from "@/app/api/store/route";
import type { RoundRecord } from "@/server/rounds";
import {
  SaldaError,
  type Address,
  type AgentEvent,
  type AttestedName,
  type CashLimit,
  type Circle,
  type Invoice,
  type Mandate,
  type PendingInvoice,
  type Round,
  type RoundPlan,
  type SaldaClient,
} from "./types";

/*
 * The live client: the same interface as the sample client, backed by SaldaClearing on Aevum. Members sign in
 * their own wallet; the relayer submits and pays the gas; the store holds what waits for another person.
 * Round keys are "circleId:roundHash" so a round can be found from its key alone.
 */

const HOUR = 3_600;
const DAY = 86_400;
const now = () => Math.floor(Date.now() / 1000);
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

export function createLiveClient({
  contract,
  wallet,
  me,
}: {
  contract: Address;
  wallet: WalletClient;
  me: Address;
}): SaldaClient {
  const chain = createPublicClient({ chain: aevum, transport: http(undefined, { retryCount: 3 }) });
  const account = me;
  const domain = saldaDomain(contract);
  const names = new Map<string, Map<string, { name: string; salt: Hex }>>();

  /** Runs a step and turns any wallet, network or contract error into one plain sentence. */
  const step = async <T>(run: () => Promise<T>): Promise<T> => {
    try {
      return await run();
    } catch (error) {
      if (error instanceof SaldaError) throw error;
      throw new SaldaError("refused", explain(error));
    }
  };

  const signTyped = (args: Record<string, unknown>) =>
    wallet.signTypedData({ account, ...(args as object) } as Parameters<WalletClient["signTypedData"]>[0]);

  const relay = (functionName: string, args: unknown[]) => callApi<{ hash: Hex }>("/api/relay", { functionName, args });

  async function confirmed(hash: Hex): Promise<TransactionReceipt> {
    try {
      const receipt = await chain.waitForTransactionReceipt({ hash, timeout: 90_000, pollingInterval: 1_000 });
      if (receipt.status !== "success") throw new SaldaError("refused", "The network refused this. Nothing moved.");
      return receipt;
    } catch (error) {
      if (error instanceof SaldaError) throw error;
      throw new SaldaError("not-ready", "Sent, and still confirming. Check again in a minute.");
    }
  }

  // ------------------------------------------------------------- names

  async function namesOf(circleId: bigint) {
    const cached = names.get(`${circleId}`);
    if (cached) return cached;
    const at = now();
    const signature = await wallet.signMessage({ account, message: readNamesMessage(circleId, at) });
    const entries = await callApi<NameEntry[]>("/api/store", { action: "names.get", circleId, member: me, at, signature });
    const map = new Map(entries.map((entry) => [entry.member.toLowerCase(), { name: entry.name, salt: entry.salt }]));
    names.set(`${circleId}`, map);
    return map;
  }

  async function saveNames(circleId: bigint, entries: NameEntry[]) {
    const at = now();
    const signature = await wallet.signMessage({ account, message: saveNamesMessage(circleId, entries, at) });
    await callApi("/api/store", { action: "names.set", circleId, signer: me, at, entries, signature });
    const map = names.get(`${circleId}`) ?? new Map();
    for (const entry of entries) map.set(entry.member.toLowerCase(), { name: entry.name, salt: entry.salt });
    names.set(`${circleId}`, map);
  }

  /** A name counts as verified only when it matches the hash the admin attested onchain. */
  function attested(map: Map<string, { name: string; salt: Hex }>, member: Address, onchain: Hex): AttestedName {
    const entry = map.get(member.toLowerCase());
    if (!entry) return { status: "unverified" };
    const expected = member === zeroAddress ? circleNameHash(entry.name, entry.salt) : nameHash(member, entry.name, entry.salt);
    return expected === onchain ? { status: "verified", value: entry.name } : { status: "unverified" };
  }

  async function toCircle(found: ChainCircle): Promise<Circle> {
    let map = new Map<string, { name: string; salt: Hex }>();
    try {
      map = await namesOf(found.id);
    } catch {
      // Without the names, every member reads as unverified. Nothing else depends on them.
    }
    return {
      id: found.id,
      name: attested(map, zeroAddress, found.nameHash),
      admin: found.admin,
      members: found.members.map((member) => ({
        address: member.address,
        name: attested(map, member.address, member.nameHash),
        active: member.active,
        nameUpdatedAt: member.nameUpdatedAt,
      })),
    };
  }

  async function circle(id: bigint): Promise<Circle> {
    if (id === 0n) {
      throw new SaldaError(
        "not-found",
        "You are not in a circle yet. Create one on the Circle page, or ask a circle admin to add your wallet.",
      );
    }
    const found = await readCircle(chain, contract, id);
    if (!found) throw new SaldaError("not-found", "That circle was not found.");
    return toCircle(found);
  }

  // ---------------------------------------------------------- invoices

  async function invoices(circleId: bigint): Promise<Invoice[]> {
    const [rows, voids] = await Promise.all([
      readInvoices(chain, contract, circleId),
      callApi<VoidRecord[]>(`/api/store?kind=voids&circleId=${circleId}`),
    ]);
    return rows.map((row) => ({
      ...row,
      voidSignedBy: voids.find((item) => item.invoiceId === row.id)?.signedBy ?? null,
    }));
  }

  async function invoice(id: bigint): Promise<Invoice> {
    const row = await chain.readContract({ address: contract, abi: saldaAbi, functionName: "getInvoice", args: [id] });
    if (row.debtor === zeroAddress) throw new SaldaError("not-found", "That invoice was not found.");
    const all = await invoices(row.circleId);
    const found = all.find((item) => item.id === id);
    if (!found) throw new SaldaError("not-found", "That invoice was not found.");
    return found;
  }

  const pendingOf = (record: PendingRecord): PendingInvoice => ({
    key: record.key,
    circleId: record.invoice.circleId,
    debtor: record.invoice.debtor,
    creditor: record.invoice.creditor,
    amount: record.invoice.amount,
    dueDate: Number(record.invoice.dueDate),
    docHash: record.invoice.docHash,
    signedBy: record.signedBy,
    deadline: Number(record.invoice.deadline),
  });

  // ------------------------------------------------------------ rounds

  const roundKey = (circleId: bigint, hash: Hex) => `${circleId}:${hash}`;
  const parseKey = (key: string): [bigint, Hex] => {
    const [circleId, hash] = key.split(":");
    if (!circleId || !hash) throw new SaldaError("not-found", "That round was not found.");
    return [BigInt(circleId), hash as Hex];
  };

  const roundOf = (record: RoundRecord): Round => ({
    key: roundKey(record.round.circleId, record.key),
    plan: {
      circleId: record.round.circleId,
      lines: record.round.invoiceIds.map((invoiceId, i) => ({ invoiceId, clear: record.round.clearAmounts[i] ?? 0n })),
      positions: record.positions,
      gross: record.gross,
      cash: record.cash,
      deadline: Number(record.round.deadline),
      provenOptimal: record.provenOptimal,
    },
    state: record.state,
    proposedAt: record.proposedAt,
    settledAt: record.settledAt,
    approvedBy: [
      ...record.positions.map((item) => item.member).filter((member) => record.consents[member.toLowerCase()]),
      ...record.viaMandate,
    ],
    viaMandate: record.viaMandate,
    txHash: record.txHash,
    failure: record.failure,
  });

  async function liveMandates(members: readonly Address[], circleId: bigint) {
    const found = await Promise.all(members.map((member) => readMandate(chain, contract, member)));
    return found.filter((item): item is ChainMandate => Boolean(item?.live && item.circleId === circleId));
  }

  // ---------------------------------------------------------- mandates

  const toMandate = (found: ChainMandate): Mandate => ({
    circleId: found.circleId,
    member: found.member,
    agent: found.agent,
    agentId: found.agentId,
    maxNetDebitPerRound: found.maxNetDebitPerRound,
    totalCap: found.totalCap,
    maxDueDays: found.maxDueDays,
    minClearRatioBps: found.minClearRatioBps,
    minCooldown: found.minCooldown,
    expiry: Number(found.expiry),
    hash: found.hash,
    spent: found.spent,
    state: found.revoked || !found.live ? (Number(found.expiry) <= now() ? "expired" : "revoked") : "active",
  });

  const client: SaldaClient = {
    mode: "live",

    listCircles: () =>
      step(async () => {
        const ids = await circlesOf(chain, contract, me);
        return Promise.all(ids.map((id) => circle(id)));
      }),
    getCircle: (id) => step(() => circle(id)),

    createCircle: (name, admin, adminName) =>
      step(async () => {
        const circleSalt = randomHex32();
        const adminSalt = randomHex32();
        const nameHashValue = circleNameHash(name, circleSalt);
        const members = [admin];
        const memberNameHashes = [nameHash(admin, adminName, adminSalt)];
        const nonce = await chain.readContract({ address: contract, abi: saldaAbi, functionName: "nonces", args: [admin] });
        const deadline = BigInt(now() + HOUR);
        const signature = await signTyped({
          domain,
          types: saldaTypes.CreateCircle,
          primaryType: "CreateCircle",
          message: { circleNameHash: nameHashValue, members, nameHashes: memberNameHashes, nonce, deadline },
        });
        const { hash } = await relay("createCircleWithSig", [
          admin,
          { nameHash: nameHashValue, members, memberNameHashes },
          deadline,
          signature,
        ]);
        const receipt = await confirmed(hash);
        const [created] = parseEventLogs({ abi: saldaAbi, eventName: "CircleCreated", logs: receipt.logs });
        if (!created) throw new SaldaError("refused", "The circle was not created. Try again.");
        await saveNames(created.args.circleId, [
          { member: zeroAddress, name, salt: circleSalt },
          { member: admin, name: adminName, salt: adminSalt },
        ]);
        return circle(created.args.circleId);
      }),

    setMember: (circleId, member, active, name) =>
      step(async () => {
        const salt = randomHex32();
        const memberHash = nameHash(member, name, salt);
        const nonce = await chain.readContract({ address: contract, abi: saldaAbi, functionName: "nonces", args: [me] });
        const deadline = BigInt(now() + HOUR);
        const signature = await signTyped({
          domain,
          types: saldaTypes.SetCircleMember,
          primaryType: "SetCircleMember",
          message: { circleId, member, active, nameHash: memberHash, nonce, deadline },
        });
        const { hash } = await relay("setCircleMemberWithSig", [circleId, member, active, memberHash, deadline, signature]);
        await confirmed(hash);
        await saveNames(circleId, [{ member, name, salt }]);
        return circle(circleId);
      }),

    listInvoices: (circleId) => step(() => invoices(circleId)),
    listPendingInvoices: (circleId) =>
      step(async () => (await callApi<PendingRecord[]>(`/api/store?kind=pending&circleId=${circleId}`)).map(pendingOf)),

    proposeInvoice: (draft, signer) =>
      step(async () => {
        if (!same(signer, me)) throw new SaldaError("not-a-member", "Sign with the wallet you are connected with.");
        const input: InvoiceInput = {
          circleId: draft.circleId,
          debtor: draft.debtor,
          creditor: draft.creditor,
          amount: draft.amount,
          dueDate: BigInt(draft.dueDate),
          docHash: draft.docHash,
          salt: randomHex32(),
          deadline: BigInt(now() + 2 * DAY),
        };
        const signature = await signTyped({ domain, types: saldaTypes.RegisterInvoice, primaryType: "RegisterInvoice", message: input });
        const record = await callApi<PendingRecord>("/api/store", { action: "invoice.propose", invoice: input, signer, signature });
        return pendingOf(record);
      }),

    cosignInvoice: (key, signer) =>
      step(async () => {
        if (!same(signer, me)) throw new SaldaError("not-a-member", "Sign with the wallet you are connected with.");
        const circleIds = await circlesOf(chain, contract, me);
        for (const circleId of circleIds) {
          const pending = await callApi<PendingRecord[]>(`/api/store?kind=pending&circleId=${circleId}`);
          const record = pending.find((item) => item.key === key);
          if (!record) continue;
          const signature = await signTyped({
            domain,
            types: saldaTypes.RegisterInvoice,
            primaryType: "RegisterInvoice",
            message: record.invoice,
          });
          const { hash } = await callApi<{ hash: Hex }>("/api/store", { action: "invoice.cosign", circleId, key, signer, signature });
          const receipt = await confirmed(hash);
          const [registered] = parseEventLogs({ abi: saldaAbi, eventName: "InvoiceRegistered", logs: receipt.logs });
          if (!registered) throw new SaldaError("refused", "The invoice was not recorded. Try again.");
          return invoice(registered.args.invoiceId);
        }
        throw new SaldaError("not-found", "That unsigned invoice was not found, or its time to sign ran out.");
      }),

    signVoid: (id, signer) =>
      step(async () => {
        const current = await invoice(id);
        if (current.voided || current.cleared === current.amount) {
          throw new SaldaError("already-voided", "This invoice is already closed.");
        }
        if (current.voidSignedBy && same(current.voidSignedBy, signer)) {
          throw new SaldaError("already-signed", "You have already signed. The other business must sign too.");
        }
        const voids = await callApi<VoidRecord[]>(`/api/store?kind=voids&circleId=${current.circleId}`);
        const earlier = voids.find((item) => item.invoiceId === id);
        const remaining = current.amount - current.cleared;
        const deadline = earlier && earlier.remaining === remaining ? earlier.deadline : BigInt(now() + 2 * DAY);
        const signature = await signTyped({
          domain,
          types: saldaTypes.VoidInvoice,
          primaryType: "VoidInvoice",
          message: { invoiceId: id, remainingAmount: remaining, deadline },
        });
        const result = await callApi<{ hash?: Hex; voided: boolean }>("/api/store", {
          action: "void.sign",
          invoiceId: id,
          deadline,
          signer,
          signature,
        });
        if (result.hash) await confirmed(result.hash);
        return invoice(id);
      }),

    payInvoice: (id, amount) =>
      step(async () => {
        const current = await invoice(id);
        if (!same(current.debtor, me)) throw new SaldaError("not-a-member", "Only the business that owes this invoice can pay it.");
        const nonce = BigInt(randomHex32());
        const validBefore = BigInt(now() + HOUR);
        const signature = await signTyped({
          domain: tusd8Domain,
          types: tusd8Types.ReceiveWithAuthorization,
          primaryType: "ReceiveWithAuthorization",
          message: {
            from: me,
            to: contract,
            value: amount,
            validAfter: 0n,
            validBefore,
            nonce: directNonce(contract, id, amount, nonce),
          },
        });
        const { hash } = await relay("payDirectWithAuthorization", [id, amount, nonce, 0n, validBefore, signature]);
        await confirmed(hash);
        return invoice(id);
      }),

    listCashLimits: (circleId) =>
      step(async () => {
        const [found, limits] = await Promise.all([
          readCircle(chain, contract, circleId),
          callApi<CashLimit[]>(`/api/store?kind=cash&circleId=${circleId}`),
        ]);
        return (found?.members ?? []).map((member) => ({
          member: member.address,
          amount: limits.find((item) => same(item.member, member.address))?.amount ?? 0n,
        }));
      }),

    setCashLimit: (circleId, member, amount) =>
      step(async () => {
        if (amount < 0n) throw new SaldaError("invalid-amount", "Enter an amount of 0 or more.");
        const at = now();
        const signature = await wallet.signMessage({ account, message: cashLimitMessage(circleId, member, amount, at) });
        return callApi<CashLimit>("/api/store", { action: "cash.set", circleId, member, amount, at, signature });
      }),

    planRound: (circleId, cash) =>
      step(async () => {
        const all = await readInvoices(chain, contract, circleId);
        const members = [...new Set(all.flatMap((item) => [item.debtor, item.creditor]))];
        const mandates = await liveMandates(members, circleId);
        const at = now();
        // Invoices a mandated debtor's window does not allow are left out, so the contract will accept the plan.
        const open = all.filter((item) => {
          if (item.voided || item.cleared >= item.amount) return false;
          const mandate = mandates.find((found) => same(found.member, item.debtor));
          return !mandate || item.dueDate <= at + mandate.maxDueDays * DAY;
        });
        const limits = new Map<string, MandateLimits>(
          mandates.map((found) => [
            found.member.toLowerCase(),
            {
              roundCap: found.maxNetDebitPerRound,
              remaining: found.totalCap - found.spent,
              minClearRatioBps: found.minClearRatioBps,
            },
          ]),
        );
        const solverInput: SolverInvoice[] = open.map((item) => ({
          id: item.id,
          debtor: item.debtor,
          creditor: item.creditor,
          remaining: item.amount - item.cleared,
        }));
        const result = solveWithMandates(solverInput, new Map([...cash].map(([member, amount]) => [member.toLowerCase(), amount])), limits);
        const lines = open
          .map((item, i) => ({ invoiceId: item.id, clear: result.clears[i] ?? 0n }))
          .filter((line) => line.clear > 0n)
          .sort((a, b) => (a.invoiceId < b.invoiceId ? -1 : 1));
        const positions = members
          .map((member) => {
            const position = result.positions.get(member.toLowerCase());
            return { member, out: position?.out ?? 0n, in: position?.in ?? 0n };
          })
          .filter((position) => position.out > 0n || position.in > 0n);
        const plan: RoundPlan = {
          circleId,
          lines,
          positions,
          gross: result.gross,
          cash: result.cash,
          deadline: at + HOUR,
          provenOptimal: result.provenOptimal,
        };
        return plan;
      }),

    getRound: (key) =>
      step(async () => {
        const [circleId, hash] = parseKey(key);
        return roundOf(await callApi<RoundRecord>(`/api/store?kind=round&circleId=${circleId}&key=${hash}`));
      }),

    openRound: (plan) =>
      step(async () => {
        if (plan.lines.length === 0) throw new SaldaError("nothing-to-clear", "This plan clears nothing. Change the cash, then try again.");
        const round: RoundInput = {
          circleId: plan.circleId,
          roundNonce: BigInt(randomHex32()),
          deadline: BigInt(plan.deadline),
          invoiceIds: plan.lines.map((line) => line.invoiceId),
          clearAmounts: plan.lines.map((line) => line.clear),
        };
        return roundOf(await callApi<RoundRecord>("/api/store", { action: "round.open", round, provenOptimal: plan.provenOptimal }));
      }),

    approveRound: (key, member) =>
      step(async () => {
        if (!same(member, me)) throw new SaldaError("not-a-member", "Sign with the wallet you are connected with.");
        const [circleId, hash] = parseKey(key);
        const record = await callApi<RoundRecord>(`/api/store?kind=round&circleId=${circleId}&key=${hash}`);
        const position = record.positions.find((item) => same(item.member, member));
        if (!position) throw new SaldaError("not-a-member", "This business is not part of the round.");
        let signature: Hex;
        if (position.out > position.in) {
          signature = await signTyped({
            domain: tusd8Domain,
            types: tusd8Types.ReceiveWithAuthorization,
            primaryType: "ReceiveWithAuthorization",
            message: {
              from: member,
              to: contract,
              value: position.out - position.in,
              validAfter: 0n,
              validBefore: record.round.deadline,
              nonce: settleNonce(contract, hash, member),
            },
          });
        } else {
          signature = await signTyped({
            domain,
            types: saldaTypes.ApproveRound,
            primaryType: "ApproveRound",
            message: { roundHash: hash, member, outTotal: position.out, inTotal: position.in },
          });
        }
        const consent = { member, kind: CONSENT_SIGNED, validAfter: 0n, validBefore: record.round.deadline, signature };
        return roundOf(await callApi<RoundRecord>("/api/store", { action: "round.consent", circleId, key: hash, consent }));
      }),

    settleRound: (key) =>
      step(async () => {
        const [circleId, hash] = parseKey(key);
        return roundOf(await callApi<RoundRecord>("/api/store", { action: "round.settle", circleId, key: hash }));
      }),

    listRounds: (circleId) =>
      step(async () => (await callApi<RoundRecord[]>(`/api/store?kind=rounds&circleId=${circleId}`)).map(roundOf)),

    getMandate: (member) =>
      step(async () => {
        const found = await readMandate(chain, contract, member);
        return found ? toMandate(found) : null;
      }),

    activateMandate: (terms) =>
      step(async () => {
        if (!same(terms.member, me)) throw new SaldaError("not-a-member", "Sign with the wallet you are connected with.");
        const { agent, agentId } = await callApi<{ agent: Address | null; agentId: bigint }>("/api/agent?info=1");
        if (!agent) throw new SaldaError("not-ready", "The clearing agent is not set up yet.");
        const mandate: StandingMandate = {
          circleId: terms.circleId,
          member: terms.member,
          agent,
          agentId,
          maxNetDebitPerRound: terms.maxNetDebitPerRound,
          totalCap: terms.totalCap,
          maxDueDays: terms.maxDueDays,
          minClearRatioBps: terms.minClearRatioBps,
          minCooldown: terms.minCooldown,
          expiry: BigInt(terms.expiry),
          mandateNonce: await chain.readContract({
            address: contract,
            abi: saldaAbi,
            functionName: "memberMandateEpoch",
            args: [terms.member],
          }),
        };
        const memberSig = await signTyped({
          domain,
          types: saldaTypes.StandingMandate,
          primaryType: "StandingMandate",
          message: mandate,
        });
        let permit = { deadline: 0n, v: 0, r: `0x${"0".repeat(64)}` as Hex, s: `0x${"0".repeat(64)}` as Hex };
        if (mandate.maxNetDebitPerRound > 0n) {
          const nonce = await chain.readContract({
            address: TUSD8,
            abi: [{ type: "function", name: "nonces", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] }] as const,
            functionName: "nonces",
            args: [terms.member],
          });
          const permitSig = await signTyped({
            domain: tusd8Domain,
            types: tusd8Types.Permit,
            primaryType: "Permit",
            message: { owner: terms.member, spender: contract, value: mandate.totalCap, nonce, deadline: mandate.expiry },
          });
          const parsed = parseSignature(permitSig);
          permit = { deadline: mandate.expiry, v: Number(parsed.v ?? BigInt(27 + (parsed.yParity ?? 0))), r: parsed.r, s: parsed.s };
        }
        const { hash } = await relay("activateMandate", [mandate, memberSig, permit]);
        await confirmed(hash);
        const stored = await readMandateByHash(chain, contract, hashMandate(mandate));
        if (!stored) throw new SaldaError("refused", "The mandate was not stored. Try again.");
        return toMandate(stored);
      }),

    revokeMandate: (member) =>
      step(async () => {
        const found = await readMandate(chain, contract, member);
        if (!found) throw new SaldaError("not-found", "There is no active mandate to revoke.");
        const deadline = BigInt(now() + HOUR);
        const signature = await signTyped({
          domain,
          types: saldaTypes.RevokeMandate,
          primaryType: "RevokeMandate",
          message: { mandateHash: found.hash, deadline },
        });
        const { hash } = await relay("revokeMandateWithSig", [found.hash, deadline, signature]);
        await confirmed(hash);
        const after = await readMandateByHash(chain, contract, found.hash);
        return toMandate(after ?? { ...found, revoked: true, live: false });
      }),

    listAgentEvents: (circleId) => step(() => callApi<AgentEvent[]>(`/api/agent?circleId=${circleId}`)),
    runAgent: (circleId) => step(() => callApi<AgentEvent>("/api/agent", { circleId })),
  };

  return client;
}

/** tUSD8 balance, for the screens that show what a member can spend. */
export async function tusd8Balance(member: Address): Promise<bigint> {
  const chain = createPublicClient({ chain: aevum, transport: http() });
  return chain.readContract({ address: TUSD8, abi: erc20Abi, functionName: "balanceOf", args: [member] });
}
