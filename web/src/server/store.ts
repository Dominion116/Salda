/*
 * The shared store (PRD 5.4): Upstash Redis over its REST API, so it works from serverless functions with no
 * extra package. Without UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN it falls back to this process's
 * memory, which is fine for `next dev` and loses everything on restart.
 *
 * The store is untrusted: every signature is checked before saving, and the contract checks everything again.
 * Losing it loses only unsubmitted items, never money. Never log names or salts read from it.
 */

type Value = string | number;

const url = process.env.UPSTASH_REDIS_REST_URL?.trim().replace(/\/+$/, "");
const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
export const sharedStore = Boolean(url && token);

async function redis<T>(...command: Value[]): Promise<T> {
  const response = await fetch(url!, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(command.map(String)),
    cache: "no-store",
  });
  const body = (await response.json()) as { result?: T; error?: string };
  if (!response.ok || body.error) throw new Error(`Store error: ${body.error ?? response.status}`);
  return body.result as T;
}

// ------------------------------------------------- in-memory fallback

type Entry = { value: string | Map<string, string>; expires: number };
const memory = new Map<string, Entry>();

function live(key: string): Entry | undefined {
  const entry = memory.get(key);
  if (entry && entry.expires && entry.expires <= Date.now()) {
    memory.delete(key);
    return undefined;
  }
  return entry;
}

function hashOf(key: string): Map<string, string> {
  const entry = live(key);
  if (entry && entry.value instanceof Map) return entry.value;
  const created = { value: new Map<string, string>(), expires: 0 };
  memory.set(key, created);
  return created.value;
}

// --------------------------------------------------------------- API

export async function getText(key: string): Promise<string | null> {
  if (sharedStore) return redis<string | null>("GET", key);
  const entry = live(key);
  return typeof entry?.value === "string" ? entry.value : null;
}

export async function setText(key: string, value: string, ttlSeconds?: number): Promise<void> {
  if (sharedStore) {
    await (ttlSeconds ? redis("SET", key, value, "EX", Math.max(1, Math.ceil(ttlSeconds))) : redis("SET", key, value));
    return;
  }
  memory.set(key, { value, expires: ttlSeconds ? Date.now() + ttlSeconds * 1000 : 0 });
}

export async function remove(key: string): Promise<void> {
  if (sharedStore) await redis("DEL", key);
  else memory.delete(key);
}

/** One field of a hash. */
export async function hashSet(key: string, field: string, value: string, ttlSeconds?: number): Promise<void> {
  if (sharedStore) {
    await redis("HSET", key, field, value);
    if (ttlSeconds) await redis("EXPIRE", key, Math.max(1, Math.ceil(ttlSeconds)));
    return;
  }
  hashOf(key).set(field, value);
  const entry = memory.get(key);
  if (entry && ttlSeconds) entry.expires = Date.now() + ttlSeconds * 1000;
}

export async function hashGet(key: string, field: string): Promise<string | null> {
  if (sharedStore) return redis<string | null>("HGET", key, field);
  return hashOf(key).get(field) ?? null;
}

export async function hashAll(key: string): Promise<Map<string, string>> {
  if (sharedStore) {
    const flat = (await redis<string[] | null>("HGETALL", key)) ?? [];
    const result = new Map<string, string>();
    for (let i = 0; i + 1 < flat.length; i += 2) result.set(flat[i]!, flat[i + 1]!);
    return result;
  }
  return new Map(hashOf(key));
}

export async function hashDelete(key: string, field: string): Promise<void> {
  if (sharedStore) await redis("HDEL", key, field);
  else hashOf(key).delete(field);
}

/** Adds one to a counter that resets after `windowSeconds`, and returns the new count. */
export async function bump(key: string, windowSeconds: number): Promise<number> {
  if (sharedStore) {
    const count = await redis<number>("INCR", key);
    if (count === 1) await redis("EXPIRE", key, windowSeconds);
    return count;
  }
  const entry = live(key);
  const count = (typeof entry?.value === "string" ? Number(entry.value) : 0) + 1;
  memory.set(key, { value: String(count), expires: entry?.expires || Date.now() + windowSeconds * 1000 });
  return count;
}

/** Takes a lock for `ttlSeconds`. False if someone else holds it. */
export async function lock(key: string, ttlSeconds: number): Promise<boolean> {
  if (sharedStore) return (await redis<string | null>("SET", key, "1", "NX", "EX", ttlSeconds)) === "OK";
  if (live(key)) return false;
  memory.set(key, { value: "1", expires: Date.now() + ttlSeconds * 1000 });
  return true;
}

export const unlock = remove;
