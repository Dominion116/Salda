import { RELAYED, relayerAccount, submit, type RelayedFunction } from "@/server/chain";
import { body, clientIp, handle, limit, refuse, reply } from "@/server/http";
import { SALDA } from "@/chain/salda";

/*
 * The gasless relayer (PRD 5.1). Members sign; this route submits and pays the gas. Rails:
 *  1. Only SaldaClearing, and only the allowlisted functions in RELAYED. Never arbitrary targets or calldata.
 *  2. Simulated first, so a bad or expired signature costs nothing.
 *  3. Rate limits per IP, and a daily cap, kept in the shared store.
 * Authority comes from the signatures inside the call, never from who asked the relayer to send it.
 */
export const runtime = "nodejs";

export async function GET() {
  const account = relayerAccount();
  return reply({ enabled: Boolean(account && SALDA), relayer: account?.address ?? null, contract: SALDA ?? null });
}

export async function POST(request: Request) {
  return handle(async () => {
    await limit(`relay:ip:${clientIp(request)}`, 10);
    const { functionName, args } = await body<{ functionName?: unknown; args?: unknown }>(request);
    if (typeof functionName !== "string" || !RELAYED.includes(functionName as RelayedFunction)) {
      return refuse("That action cannot be relayed.");
    }
    if (!Array.isArray(args)) return refuse("The request could not be read.");
    const hash = await submit(functionName as RelayedFunction, args);
    return reply({ hash });
  });
}
