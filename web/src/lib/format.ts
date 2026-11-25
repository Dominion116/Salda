/** 0x71C7…976F */
export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

const dateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });
const timeFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export const formatDate = (seconds: number) => dateFormat.format(seconds * 1000);
export const formatTime = (seconds: number) => timeFormat.format(seconds * 1000);

/** A date field value (2026-11-30) as the last second of that day, in the viewer’s time zone. */
export function endOfDay(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(year, month - 1, day, 23, 59, 59);
  if (date.getMonth() !== month - 1) return null;
  return Math.floor(date.getTime() / 1000);
}

/** Days from now as a date field value. */
export function dateFieldValue(daysFromNow: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  const two = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`;
}

/** A ratio in basis points as a multiple: 30_000 is 3.0×. */
export const formatRatio = (bps: number) => `${(bps / 10_000).toFixed(bps % 1000 === 0 ? 1 : 2)}×`;
