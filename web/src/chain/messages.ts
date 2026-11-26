import { keccak256, toHex, type Address, type Hex } from "viem";

/*
 * Plain-text messages members sign (personal_sign) for things that never go onchain: cash limits, and reading
 * or saving business names. Each carries a time, and the server accepts it only for a few minutes.
 */

export const MESSAGE_WINDOW_SECONDS = 600;

export const cashLimitMessage = (circleId: bigint, member: Address, amount: bigint, at: number) =>
  `Salda: set my cash limit\nCircle: ${circleId}\nMember: ${member}\nAmount (tUSD8 units): ${amount}\nTime: ${at}`;

export const readNamesMessage = (circleId: bigint, at: number) =>
  `Salda: show the business names in my circle\nCircle: ${circleId}\nTime: ${at}`;

export type NameEntry = { member: Address; name: string; salt: Hex };

/** The zero address stands for the circle's own name. */
export const saveNamesMessage = (circleId: bigint, entries: readonly NameEntry[], at: number) =>
  `Salda: save business names\nCircle: ${circleId}\nNames: ${namesDigest(entries)}\nTime: ${at}`;

export const namesDigest = (entries: readonly NameEntry[]): Hex =>
  keccak256(toHex(JSON.stringify(entries.map((entry) => [entry.member.toLowerCase(), entry.name, entry.salt]))));
