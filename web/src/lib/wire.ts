/*
 * JSON for the app's own API. Every amount is a bigint, which JSON cannot hold, so bigints travel as
 * {"$bigint":"123"}. A tagged object, not a suffixed string, so no user text (a business name) is ever
 * mistaken for a number.
 */

const TAG = "$bigint";

export function toWire(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) => (typeof item === "bigint" ? { [TAG]: item.toString() } : item));
}

export function fromWire<T>(text: string): T {
  return JSON.parse(text, (_key, item: unknown) => {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      const tagged = (item as Record<string, unknown>)[TAG];
      if (typeof tagged === "string" && /^-?\d{1,78}$/.test(tagged) && Object.keys(item).length === 1) {
        return BigInt(tagged);
      }
    }
    return item;
  }) as T;
}

/** POSTs to the app's own API and returns the decoded answer, or throws its plain-language error. */
export async function callApi<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : toWire(body),
  });
  const text = await response.text();
  let decoded: unknown;
  try {
    decoded = fromWire(text);
  } catch {
    throw new ApiError(response.status, "The server sent an answer the app could not read. Try again.");
  }
  if (!response.ok) {
    const message = (decoded as { error?: unknown } | null)?.error;
    throw new ApiError(response.status, typeof message === "string" ? message : "The server could not do that. Try again.");
  }
  return decoded as T;
}

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}
