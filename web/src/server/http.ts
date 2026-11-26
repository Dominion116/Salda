import { isAddress, isHex, type Address, type Hex } from "viem";
import { fromWire, toWire } from "@/lib/wire";
import { UserFacingError } from "./chain";
import { bump } from "./store";

/** A JSON answer in the app's wire format (bigints tagged). */
export function reply(body: unknown, status = 200): Response {
  return new Response(toWire(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
}

export const refuse = (error: string, status = 400) => reply({ error }, status);

/**
 * Runs a route handler. User-facing errors become their message; anything else becomes a generic sentence,
 * so internal details (and any name or salt in a payload) never reach a log line or the visitor.
 */
export async function handle(run: () => Promise<Response>): Promise<Response> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof UserFacingError) return refuse(error.message, error.status);
    console.error("[api]", error instanceof Error ? error.name : "error", error instanceof Error ? error.message.slice(0, 200) : "");
    return refuse("Something did not finish on the server. Try again.", 500);
  }
}

export async function body<T>(request: Request): Promise<T> {
  try {
    return fromWire<T>(await request.text());
  } catch {
    throw new UserFacingError("The request could not be read.");
  }
}

/**
 * The caller's IP. Clients can write any X-Forwarded-For they like, so on Vercel set
 * TRUSTED_IP_HEADER=x-vercel-forwarded-for. Otherwise the last X-Forwarded-For entry is used.
 */
export function clientIp(request: Request): string {
  const trusted = process.env.TRUSTED_IP_HEADER?.trim().toLowerCase();
  if (trusted) return request.headers.get(trusted)?.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() || request.headers.get("x-real-ip") || "unknown";
}

/** Shared rate limit (PRD 5.1): at most `max` requests per `windowSeconds` for this bucket. */
export async function limit(bucket: string, max: number, windowSeconds = 60): Promise<void> {
  if ((await bump(`limit:${bucket}`, windowSeconds)) > max) {
    throw new UserFacingError("Too many requests. Wait a minute, then try again.", 429);
  }
}

// --------------------------------------------------------- validation

export function address(value: unknown, what = "address"): Address {
  if (typeof value !== "string" || !isAddress(value)) throw new UserFacingError(`The ${what} is not a valid address.`);
  return value;
}

export function hex(value: unknown, what = "value", bytes?: number): Hex {
  if (typeof value !== "string" || !isHex(value) || (bytes !== undefined && value.length !== 2 + bytes * 2)) {
    throw new UserFacingError(`The ${what} is not valid.`);
  }
  return value;
}

export function units(value: unknown, what = "amount"): bigint {
  if (typeof value !== "bigint" || value < 0n || value >= 2n ** 256n) throw new UserFacingError(`The ${what} is not valid.`);
  return value;
}

export function text(value: unknown, what: string, max = 120): string {
  if (typeof value !== "string" || value.trim() === "" || value.length > max) {
    throw new UserFacingError(`Enter a ${what} of 1 to ${max} characters.`);
  }
  return value.trim();
}

export const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
export const nowSeconds = () => BigInt(Math.floor(Date.now() / 1000));
