/*
 * The one interface every app screen reads and writes through. It mirrors the contract (PRD section 4) and is
 * implemented by the live client (client/live.ts). Sample data exists only in /demo (lib/demo.ts).
 */

export type Address = `0x${string}`;
export type Hex = `0x${string}`;

/** Amounts are tUSD8 base units (6 decimals). Times are Unix seconds. */
export type Units = bigint;
export type Seconds = number;

/** A name is verified only when it matches the hash the circle admin attested. */
export type AttestedName = { status: "verified"; value: string } | { status: "unverified" };

export type Member = { address: Address; name: AttestedName; active: boolean; nameUpdatedAt: Seconds };
export type Circle = { id: bigint; name: AttestedName; admin: Address; members: Member[] };

export type Invoice = {
  id: bigint;
  circleId: bigint;
  debtor: Address;
  creditor: Address;
  amount: Units;
  cleared: Units;
  dueDate: Seconds;
  registeredAt: Seconds;
  docHash: Hex;
  voided: boolean;
  /** Set when one side has signed to void it and the other has not yet. */
  voidSignedBy: Address | null;
};

export type InvoiceDraft = Pick<Invoice, "circleId" | "debtor" | "creditor" | "amount" | "dueDate" | "docHash">;

/** Signed by one side and waiting for the other. */
export type PendingInvoice = InvoiceDraft & { key: string; signedBy: Address; deadline: Seconds };

/** What a member is willing to spend in the next round. A planning input, never a binding limit. */
export type CashLimit = { member: Address; amount: Units };

export type Position = { member: Address; out: Units; in: Units };

export type RoundPlan = {
  circleId: bigint;
  lines: { invoiceId: bigint; clear: Units }[];
  positions: Position[];
  gross: Units;
  cash: Units;
  deadline: Seconds;
  /** False when the solver stopped early. The plan is still valid, but may not be the best. */
  provenOptimal: boolean;
};

export type SubmissionState = "waiting-for-signatures" | "submitting" | "pending" | "confirmed" | "failed";

export type Round = {
  key: string;
  plan: RoundPlan;
  state: SubmissionState;
  proposedAt: Seconds;
  settledAt?: Seconds;
  approvedBy: Address[];
  /** The members in approvedBy whose mandate agreed for them. */
  viaMandate: Address[];
  /** Only a live client sets this. */
  txHash?: Hex;
  failure?: string;
};

export type MandateTerms = {
  circleId: bigint;
  member: Address;
  agent: Address;
  agentId: bigint;
  maxNetDebitPerRound: Units;
  totalCap: Units;
  maxDueDays: number;
  /** 30_000 means at least 3.0 cleared for every 1 paid. 0 turns the rule off. */
  minClearRatioBps: number;
  minCooldown: Seconds;
  expiry: Seconds;
};

export type Mandate = MandateTerms & { hash: Hex; spent: Units; state: "active" | "revoked" | "expired" };

/** One tool call the AI agent made, as shown to members: what it asked for and what came back. */
export type AgentStep = { tool: string; input: string; output: string };

export type AgentEvent = {
  key: string;
  at: Seconds;
  circleId: bigint;
  kind: "proposed" | "settled" | "rejected";
  summary: string;
  /** The language model that planned it, when the AI agent ran. Absent for the rules-based agent. */
  model?: string;
  steps?: AgentStep[];
};

export type SaldaErrorCode =
  | "not-found"
  | "not-a-member"
  | "invalid-amount"
  | "already-voided"
  | "already-signed"
  | "nothing-to-clear"
  | "mandate-already-active"
  | "not-ready"
  /** A wallet, network or contract refusal. The message says what happened and what to do. */
  | "refused";

export class SaldaError extends Error {
  readonly code: SaldaErrorCode;

  constructor(code: SaldaErrorCode, message: string) {
    super(message);
    this.name = "SaldaError";
    this.code = code;
  }
}

/** Everything the app reads and writes, backed by SaldaClearing on Aevum (client/live.ts). */
export interface SaldaClient {
  listCircles(): Promise<Circle[]>;
  getCircle(id: bigint): Promise<Circle>;
  createCircle(name: string, admin: Address, adminName: string): Promise<Circle>;
  setMember(circleId: bigint, member: Address, active: boolean, name: string): Promise<Circle>;

  listInvoices(circleId: bigint): Promise<Invoice[]>;
  listPendingInvoices(circleId: bigint): Promise<PendingInvoice[]>;
  proposeInvoice(draft: InvoiceDraft, signer: Address): Promise<PendingInvoice>;
  cosignInvoice(key: string, signer: Address): Promise<Invoice>;
  /** The first signature asks; the other side’s signature voids. */
  signVoid(id: bigint, signer: Address): Promise<Invoice>;
  payInvoice(id: bigint, amount: Units): Promise<Invoice>;

  listCashLimits(circleId: bigint): Promise<CashLimit[]>;
  setCashLimit(circleId: bigint, member: Address, amount: Units): Promise<CashLimit>;
  planRound(circleId: bigint, cash: ReadonlyMap<Address, Units>): Promise<RoundPlan>;
  getRound(key: string): Promise<Round>;
  openRound(plan: RoundPlan): Promise<Round>;
  approveRound(key: string, member: Address): Promise<Round>;
  settleRound(key: string): Promise<Round>;
  listRounds(circleId: bigint): Promise<Round[]>;

  getMandate(member: Address): Promise<Mandate | null>;
  activateMandate(terms: MandateTerms): Promise<Mandate>;
  revokeMandate(member: Address): Promise<Mandate>;

  listAgentEvents(circleId: bigint): Promise<AgentEvent[]>;
  runAgent(circleId: bigint): Promise<AgentEvent>;
}
