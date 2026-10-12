/** Exact USD ⇄ nano-USD string conversion for form fields (no floating point). */
const USD_RE = /^\d+(\.\d{1,9})?$/;

export function usdToNano(value: string): string | null {
  const v = value.trim().replace(/^\$/, "").replace(/,/g, "");
  if (!USD_RE.test(v)) return null;
  const [whole = "0", frac = ""] = v.split(".");
  const nano = BigInt(whole) * 1_000_000_000n + BigInt(frac.padEnd(9, "0"));
  return nano > 0n ? nano.toString() : null;
}

export function nanoToUsdInput(nano: string): string {
  const n = BigInt(nano);
  const whole = n / 1_000_000_000n;
  const frac = (n % 1_000_000_000n).toString().padStart(9, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole.toString();
}

/** Nano-USD → USD as a number, only for chart geometry (never for displayed amounts). */
export const nanoToUsdNumber = (nano: string) => Number(BigInt(nano)) / 1e9;

/** Nano-USD → milli-USD integer for Meter proportions. */
export const nanoToMilli = (nano: string) => Number(BigInt(nano) / 1_000_000n);
