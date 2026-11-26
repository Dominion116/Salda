import {
  BaseError,
  createPublicClient,
  createWalletClient,
  erc20Abi,
  http,
  isHex,
  type Address,
  type Hex,
  type TransactionReceipt,
} from "viem";
import { nonceManager, privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { saldaAbi } from "@/chain/abi";
import { aevum, SALDA, TUSD8 } from "@/chain/salda";
import { explain } from "@/lib/explain";
import { bump } from "./store";

/*
 * Server-side chain access. Keys come only from server environment variables (no NEXT_PUBLIC_ prefix), so
 * they never reach the browser. Use fresh TEST-ONLY wallets for all of them.
 *   RELAYER_PRIVATE_KEY  pays gas for every relayed call, and is the demo treasury (holds tUSD8 for seeds)
 *   AGENT_PRIVATE_KEY    the clearing agent's approval key; it holds no funds and needs no gas
 *   DEMO_BEN_KEY, DEMO_CHIDI_KEY  the two server-held demo counterparties
 */

export const publicClient = createPublicClient({ chain: aevum, transport: http(undefined, { retryCount: 3 }) });

const accounts = new Map<string, PrivateKeyAccount | null>();
function accountFrom(name: string, withNonces = false): PrivateKeyAccount | undefined {
  if (!accounts.has(name)) {
    const raw = process.env[name]?.trim();
    const key = (raw?.startsWith("0x") ? raw : `0x${raw ?? ""}`) as Hex;
    accounts.set(
      name,
      raw && isHex(key) && key.length === 66 ? privateKeyToAccount(key, withNonces ? { nonceManager } : undefined) : null,
    );
  }
  return accounts.get(name) ?? undefined;
}

export const relayerAccount = () => accountFrom("RELAYER_PRIVATE_KEY", true);
export const agentAccount = () => accountFrom("AGENT_PRIVATE_KEY");
export const demoBenAccount = () => accountFrom("DEMO_BEN_KEY");
export const demoChidiAccount = () => accountFrom("DEMO_CHIDI_KEY");

/** The deployed contract, or a plain error when the app is not set up for live data. */
export function salda(): Address {
  if (!SALDA) throw new UserFacingError("Salda is not deployed for this app yet.", 503);
  return SALDA;
}

export class UserFacingError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "UserFacingError";
    this.status = status;
  }
}

/** The only SaldaClearing functions the relayer will send (PRD 5.1). Never arbitrary calldata. */
export const RELAYED = [
  "settle",
  "registerInvoice",
  "registerInvoices",
  "voidInvoice",
  "payDirectWithAuthorization",
  "createCircleWithSig",
  "setCircleMemberWithSig",
  "activateMandate",
  "revokeMandateWithSig",
  "bumpMandateEpochWithSig",
] as const;
export type RelayedFunction = (typeof RELAYED)[number];

const DAILY_TX_LIMIT = Number(process.env.RELAYER_DAILY_TX_LIMIT ?? 500);

/**
 * Simulates, then sends one allowlisted SaldaClearing call from the relayer as a legacy transaction.
 * A call that would revert costs nothing and comes back as a plain-language error.
 */
export async function submit(functionName: RelayedFunction, args: readonly unknown[]): Promise<Hex> {
  if (!RELAYED.includes(functionName)) throw new UserFacingError("That action cannot be relayed.");
  const account = relayerAccount();
  if (!account) throw new UserFacingError("The relayer is not set up. Try again later.", 503);
  const today = new Date().toISOString().slice(0, 10);
  if ((await bump(`relay:sent:${today}`, 86_400)) > DAILY_TX_LIMIT) {
    throw new UserFacingError("The relayer reached its daily limit. Try again tomorrow.", 503);
  }

  const call = { account, address: salda(), abi: saldaAbi, functionName, args } as never;
  try {
    await publicClient.simulateContract(call);
    const wallet = createWalletClient({ account, chain: aevum, transport: http() });
    return await wallet.writeContract({ ...(call as object), type: "legacy" } as never);
  } catch (error) {
    if (error instanceof BaseError && /insufficient funds/i.test(error.message)) {
      console.error("[relay] relayer is out of gas", account.address);
      throw new UserFacingError("The relayer is out of gas. A member with tQDAY can submit this instead.", 503);
    }
    throw new UserFacingError(explain(error));
  }
}

/** Sends tUSD8 from the relayer (the demo treasury). Used only for demo seeds. */
export async function sendTusd8(to: Address, amount: bigint): Promise<Hex> {
  const account = relayerAccount();
  if (!account) throw new UserFacingError("The demo treasury is not set up.", 503);
  const wallet = createWalletClient({ account, chain: aevum, transport: http() });
  return wallet.writeContract({
    address: TUSD8,
    abi: erc20Abi,
    functionName: "transfer",
    args: [to, amount],
    type: "legacy",
  });
}

/**
 * Waits for a receipt, but treats a slow one as "still confirming", never as a failure (PRD 5.5).
 * Returns undefined when it is still pending after `timeoutMs`.
 */
export async function receiptOf(hash: Hex, timeoutMs = 20_000): Promise<TransactionReceipt | undefined> {
  try {
    return await publicClient.waitForTransactionReceipt({ hash, timeout: timeoutMs, pollingInterval: 1_000 });
  } catch (error) {
    if (error instanceof BaseError && /timed out|could not be found/i.test(error.message)) return undefined;
    throw error;
  }
}
