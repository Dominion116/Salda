/** tUSD8 has 6 decimals. Amounts are bigint base units everywhere; format only for display. */
export const ONE = 1_000_000n;
const DECIMALS = 6;

/** At least 2 decimals, and more only when the amount needs them: 2.00, 0.015. */
export function formatAmount(units: bigint): string {
  const negative = units < 0n;
  const value = negative ? -units : units;
  const whole = (value / ONE).toString().replace(/\B(?=(\d{3})+$)/g, ",");
  const fraction = (value % ONE).toString().padStart(DECIMALS, "0").replace(/0+$/, "").padEnd(2, "0");
  return `${negative ? "−" : ""}${whole}.${fraction}`;
}

/** Reads a typed amount. Returns null for anything that is not a plain, non-negative amount. */
export function parseAmount(text: string): bigint | null {
  const match = /^(\d{1,12})(?:\.(\d{0,6}))?$/.exec(text.trim());
  if (!match) return null;
  return BigInt(match[1] ?? "0") * ONE + BigInt((match[2] ?? "").padEnd(DECIMALS, "0"));
}
