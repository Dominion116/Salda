import { defineChain, encodeAbiParameters, isAddress, keccak256, parseAbiParameters, type Address, type Hex } from "viem";

/*
 * Everything the browser and the server must agree on with SaldaClearing: the chain, the addresses, the
 * EIP-712 types each signature uses, and the hashes the contract recomputes. Any change here must match
 * contracts/src/SaldaClearing.sol exactly, or signatures stop verifying.
 */

export const EXPLORER = "https://explorer-test.qday.info";
export const TUSD8: Address = "0x456569838f1d43009A91ebA4263147Afd7233483";

export const aevum = defineChain({
  id: 44005,
  name: "QDay Aevum Testnet",
  nativeCurrency: { name: "tQDAY", symbol: "tQDAY", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc-test.qday.info"] } },
  blockExplorers: { default: { name: "Aevum explorer", url: EXPLORER } },
  contracts: { multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" } },
  testnet: true,
});

const configured = process.env.NEXT_PUBLIC_SALDA_ADDRESS?.trim();
/** The deployed SaldaClearing, or undefined while the app runs on sample data only. */
export const SALDA: Address | undefined = configured && isAddress(configured) ? configured : undefined;

export const txUrl = (hash: Hex) => `${EXPLORER}/tx/${hash}`;
export const addressUrl = (address: Address) => `${EXPLORER}/address/${address}`;

// ------------------------------------------------------------------ inputs

export type InvoiceInput = {
  circleId: bigint;
  debtor: Address;
  creditor: Address;
  amount: bigint;
  dueDate: bigint;
  docHash: Hex;
  salt: Hex;
  deadline: bigint;
};

export type RoundInput = {
  circleId: bigint;
  roundNonce: bigint;
  deadline: bigint;
  invoiceIds: bigint[];
  clearAmounts: bigint[];
};

export const CONSENT_SIGNED = 0;
export const CONSENT_MANDATE = 1;

export type ConsentInput = {
  member: Address;
  kind: number;
  validAfter: bigint;
  validBefore: bigint;
  signature: Hex;
};

export type StandingMandate = {
  circleId: bigint;
  member: Address;
  agent: Address;
  agentId: bigint;
  maxNetDebitPerRound: bigint;
  totalCap: bigint;
  maxDueDays: number;
  minClearRatioBps: number;
  minCooldown: number;
  expiry: bigint;
  mandateNonce: bigint;
};

// ---------------------------------------------------------- EIP-712 domains

export const saldaDomain = (verifyingContract: Address) =>
  ({ name: "SaldaClearing", version: "1", chainId: aevum.id, verifyingContract }) as const;

export const tusd8Domain = { name: "tUSD8", version: "2", chainId: aevum.id, verifyingContract: TUSD8 } as const;

// ------------------------------------------------------------ EIP-712 types

const registerInvoice = [
  { name: "circleId", type: "uint256" },
  { name: "debtor", type: "address" },
  { name: "creditor", type: "address" },
  { name: "amount", type: "uint256" },
  { name: "dueDate", type: "uint256" },
  { name: "docHash", type: "bytes32" },
  { name: "salt", type: "bytes32" },
  { name: "deadline", type: "uint256" },
] as const;

/** Every Salda signature type, as wallets display them. */
export const saldaTypes = {
  RegisterInvoice: { RegisterInvoice: registerInvoice },
  RegisterInvoiceBatch: {
    RegisterInvoiceBatch: [
      { name: "invoices", type: "RegisterInvoice[]" },
      { name: "deadline", type: "uint256" },
    ],
    RegisterInvoice: registerInvoice,
  },
  CreateCircle: {
    CreateCircle: [
      { name: "circleNameHash", type: "bytes32" },
      { name: "members", type: "address[]" },
      { name: "nameHashes", type: "bytes32[]" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
  },
  SetCircleMember: {
    SetCircleMember: [
      { name: "circleId", type: "uint256" },
      { name: "member", type: "address" },
      { name: "active", type: "bool" },
      { name: "nameHash", type: "bytes32" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
  },
  VoidInvoice: {
    VoidInvoice: [
      { name: "invoiceId", type: "uint256" },
      { name: "remainingAmount", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
  },
  ApproveRound: {
    ApproveRound: [
      { name: "roundHash", type: "bytes32" },
      { name: "member", type: "address" },
      { name: "outTotal", type: "uint256" },
      { name: "inTotal", type: "uint256" },
    ],
  },
  StandingMandate: {
    StandingMandate: [
      { name: "circleId", type: "uint256" },
      { name: "member", type: "address" },
      { name: "agent", type: "address" },
      { name: "agentId", type: "uint256" },
      { name: "maxNetDebitPerRound", type: "uint256" },
      { name: "totalCap", type: "uint256" },
      { name: "maxDueDays", type: "uint32" },
      { name: "minClearRatioBps", type: "uint32" },
      { name: "minCooldown", type: "uint32" },
      { name: "expiry", type: "uint64" },
      { name: "mandateNonce", type: "uint64" },
    ],
  },
  AgentApproval: {
    AgentApproval: [
      { name: "roundHash", type: "bytes32" },
      { name: "agent", type: "address" },
    ],
  },
  RevokeMandate: {
    RevokeMandate: [
      { name: "mandateHash", type: "bytes32" },
      { name: "deadline", type: "uint256" },
    ],
  },
  BumpMandateEpoch: {
    BumpMandateEpoch: [
      { name: "member", type: "address" },
      { name: "epoch", type: "uint64" },
      { name: "deadline", type: "uint256" },
    ],
  },
} as const;

/** tUSD8's own signature types (EIP-3009 and EIP-2612), in the tUSD8 domain. */
export const tusd8Types = {
  ReceiveWithAuthorization: {
    ReceiveWithAuthorization: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "validAfter", type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "nonce", type: "bytes32" },
    ],
  },
  Permit: {
    Permit: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
  },
} as const;

// ------------------------------------------------------------------ hashes

/** The same hash `SaldaClearing.hashRound` computes. Every consent in a round refers to it. */
export function hashRound(salda: Address, round: RoundInput): Hex {
  return keccak256(
    encodeAbiParameters(parseAbiParameters("address, uint256, uint256, uint256, uint256, uint256[], uint256[]"), [
      salda,
      BigInt(aevum.id),
      round.circleId,
      round.roundNonce,
      round.deadline,
      round.invoiceIds,
      round.clearAmounts,
    ]),
  );
}

/** The EIP-3009 nonce a net debtor signs for a round. */
export const settleNonce = (salda: Address, roundHash: Hex, member: Address): Hex =>
  keccak256(encodeAbiParameters(parseAbiParameters("address, bytes32, address"), [salda, roundHash, member]));

/** The EIP-3009 nonce for paying one invoice directly. */
export const directNonce = (salda: Address, invoiceId: bigint, amount: bigint, nonce: bigint): Hex =>
  keccak256(
    encodeAbiParameters(parseAbiParameters("address, string, uint256, uint256, uint256"), [
      salda,
      "DIRECT",
      invoiceId,
      amount,
      nonce,
    ]),
  );

/** A business name as it goes onchain: salted, so it cannot be guessed. */
export const nameHash = (member: Address, name: string, salt: Hex): Hex =>
  keccak256(encodeAbiParameters(parseAbiParameters("address, string, bytes32"), [member, name, salt]));

/** A circle name has no member, so the zero address stands in. */
export const circleNameHash = (name: string, salt: Hex): Hex =>
  nameHash("0x0000000000000000000000000000000000000000", name, salt);

/** An invoice document's hash, salted so a short or predictable invoice cannot be guessed from it. */
export const docHashOf = (documentHash: Hex, docSalt: Hex): Hex =>
  keccak256(encodeAbiParameters(parseAbiParameters("bytes32, bytes32"), [documentHash, docSalt]));

/** Same as `SaldaClearing.hashMandate`: the EIP-712 struct hash, which is the mandate's id. */
export function hashMandate(m: StandingMandate): Hex {
  return keccak256(
    encodeAbiParameters(
      parseAbiParameters(
        "bytes32, uint256, address, address, uint256, uint256, uint256, uint32, uint32, uint32, uint64, uint64",
      ),
      [
        keccak256(
          new TextEncoder().encode(
            "StandingMandate(uint256 circleId,address member,address agent,uint256 agentId,uint256 maxNetDebitPerRound,uint256 totalCap,uint32 maxDueDays,uint32 minClearRatioBps,uint32 minCooldown,uint64 expiry,uint64 mandateNonce)",
          ),
        ),
        m.circleId,
        m.member,
        m.agent,
        m.agentId,
        m.maxNetDebitPerRound,
        m.totalCap,
        m.maxDueDays,
        m.minClearRatioBps,
        m.minCooldown,
        m.expiry,
        m.mandateNonce,
      ],
    ),
  );
}

/** Each member's totals in a round, in the order the contract first meets them. */
export function roundTotals(
  round: Pick<RoundInput, "invoiceIds" | "clearAmounts">,
  partiesOf: (invoiceId: bigint) => { debtor: Address; creditor: Address },
): { member: Address; out: bigint; in: bigint }[] {
  const totals: { member: Address; out: bigint; in: bigint }[] = [];
  const slot = (member: Address) => {
    const lower = member.toLowerCase();
    let found = totals.find((item) => item.member.toLowerCase() === lower);
    if (!found) {
      found = { member, out: 0n, in: 0n };
      totals.push(found);
    }
    return found;
  };
  round.invoiceIds.forEach((id, index) => {
    const amount = round.clearAmounts[index] ?? 0n;
    const { debtor, creditor } = partiesOf(id);
    slot(debtor).out += amount;
    slot(creditor).in += amount;
  });
  return totals;
}

/** A fresh random 32-byte value, for salts and round nonces. */
export function randomHex32(): Hex {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return `0x${[...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}
