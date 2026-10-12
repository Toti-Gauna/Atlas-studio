import { formatUsd } from "@atlas/domain";

/** Display helpers. Storage stays UTC + nano-USD; conversion happens only here. */
let tz = "UTC";
export const setDisplayTimeZone = (zone: string) => {
  tz = zone;
};
export const displayTimeZone = () => tz;

export function formatDateTime(isoString: string, opts: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" }): string {
  return new Intl.DateTimeFormat("en-US", { ...opts, timeZone: tz }).format(new Date(isoString));
}

export function formatDate(isoString: string): string {
  return formatDateTime(isoString, { dateStyle: "medium" });
}

export function relativeTime(isoString: string, now = Date.now()): string {
  const diff = (Date.parse(isoString) - now) / 1000;
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(Math.round(diff), "second");
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), "day");
  return formatDate(isoString);
}

export function money(nano: string | bigint | null | undefined): string {
  if (nano === null || nano === undefined) return "Unknown";
  return formatUsd(nano);
}

export const tokens = (n: number | null | undefined) => (n === null || n === undefined ? "—" : n.toLocaleString("en-US"));

export const ms = (n: number | null | undefined) => (n === null || n === undefined ? "—" : n >= 1000 ? `${(n / 1000).toFixed(1)} s` : `${n} ms`);

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export const modelName = (key: string) => {
  const map: Record<string, string> = {
    "local:atlas-extractive-v1": "Atlas Local",
    "anthropic:claude-opus-5-5": "Claude Opus 5.5",
    "anthropic:claude-sonnet-5-5": "Claude Sonnet 5.5",
    "anthropic:claude-haiku-5-5": "Claude Haiku 5.5",
    "anthropic:claude-fable-5-1": "Claude Fable 5.1",
  };
  return map[key] ?? key.split(":")[1] ?? key;
};
