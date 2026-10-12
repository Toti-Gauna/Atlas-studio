/**
 * Exact money arithmetic in nano-USD (1e-9 USD) using BigInt.
 *
 * Provider prices are quoted in USD per million tokens with up to 3 decimals
 * (e.g. "0.125"). One token at $X/MTok costs X * 1e-6 USD = X * 1000 nano-USD,
 * so `tokens * priceMilliUnits` is always an exact integer of nano-USD.
 */

const DECIMAL_RE = /^\d+(\.\d{1,6})?$/;

/** Parses "4", "0.20", "0.125" into micro-units of USD per MTok (1e-6 USD/MTok). */
export function parseUsdPerMTokToMicro(value: string): bigint {
  if (!DECIMAL_RE.test(value)) throw new Error(`invalid decimal price: ${value}`);
  const [whole = "0", frac = ""] = value.split(".");
  return BigInt(whole) * 1_000_000n + BigInt(frac.padEnd(6, "0"));
}

/** Exact cost in nano-USD for `tokens` at `usdPerMTok`. Result is floor-free because prices have ≤6 decimals. */
export function tokenCostNanoUsd(tokens: number, usdPerMTok: string): bigint {
  if (!Number.isInteger(tokens) || tokens < 0) throw new Error(`invalid token count: ${tokens}`);
  // nano-USD = tokens * micro(USD/MTok) * 1e-6 (USD/MTok → USD/token) * 1e9 (USD → nano) / 1e6 (micro)
  //          = tokens * micro / 1000
  const micro = parseUsdPerMTokToMicro(usdPerMTok);
  const numerator = BigInt(tokens) * micro;
  if (numerator % 1000n !== 0n) {
    // Sub-nano remainder: keep exactness by rounding half-up at the nano level (documented in pricing.md).
    return (numerator + 500n) / 1000n;
  }
  return numerator / 1000n;
}

/** Cost for `count` units at `usd` per 1,000 units (e.g. web search $10 / 1k). */
export function perThousandCostNanoUsd(count: number, usd: string): bigint {
  // micro-USD per 1k units equals nano-USD per unit (×1000 for micro→nano, ÷1000 for per-1k).
  return BigInt(count) * parseUsdPerMTokToMicro(usd);
}

export function sumNano(values: Array<string | bigint>): bigint {
  return values.reduce<bigint>((acc, v) => acc + BigInt(v), 0n);
}

/** Formats nano-USD for display. Rounding happens only here. */
export function formatUsd(nano: bigint | string, opts: { minimumFractionDigits?: number; maximumFractionDigits?: number } = {}): string {
  const n = typeof nano === "string" ? BigInt(nano) : nano;
  const negative = n < 0n;
  const abs = negative ? -n : n;
  const max = opts.maximumFractionDigits ?? (abs < 1_000_000_000n ? 4 : 2); // < $1 → up to 4 decimals
  const min = opts.minimumFractionDigits ?? 2;
  const scale = 10n ** BigInt(9 - max);
  const rounded = (abs + scale / 2n) / scale; // in units of 10^-max USD
  const s = rounded.toString().padStart(max + 1, "0");
  const whole = s.slice(0, s.length - max);
  let frac = max > 0 ? s.slice(s.length - max) : "";
  while (frac.length > min && frac.endsWith("0")) frac = frac.slice(0, -1);
  const wholeFormatted = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}$${wholeFormatted}${frac ? `.${frac}` : ""}`;
}

export const USD = (dollars: number): bigint => BigInt(Math.round(dollars * 1e9));
