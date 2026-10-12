import type { Classification, DetectorId, Finding } from "@atlas/contracts";

/**
 * Explainable, rule-based detection of a limited set of sensitive patterns.
 * This is NOT a complete DLP system: it misses names, addresses, free-form
 * health data, images, scanned text and anything outside these rules.
 */
export const DETECTION_LIMITATIONS = [
  "Rule-based: only the listed patterns are detected; names, postal addresses and free-text personal data are not.",
  "No OCR: text inside images or scanned PDFs is not inspected.",
  "Validators (Luhn, IBAN mod-97, CUIT check digit) reduce false positives but cannot prove that data is real.",
  "Detection is a review aid, not a legal or compliance guarantee.",
];

interface Detector {
  id: DetectorId;
  label: string;
  severity: Finding["severity"];
  pattern: RegExp;
  explanation: string;
  validate?: (match: string) => boolean;
}

const digits = (s: string) => s.replace(/\D/g, "");

export function luhnValid(value: string): boolean {
  const d = digits(value);
  if (d.length < 13 || d.length > 19) return false;
  let sum = 0;
  let double = false;
  for (let i = d.length - 1; i >= 0; i--) {
    let x = Number(d[i]);
    if (double) {
      x *= 2;
      if (x > 9) x -= 9;
    }
    sum += x;
    double = !double;
  }
  return sum % 10 === 0;
}

export function ibanValid(value: string): boolean {
  const s = value.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(s)) return false;
  const rearranged = s.slice(4) + s.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const code = /[A-Z]/.test(ch) ? String(ch.charCodeAt(0) - 55) : ch;
    for (const c of code) remainder = (remainder * 10 + Number(c)) % 97;
  }
  return remainder === 1;
}

export function cuitValid(value: string): boolean {
  const d = digits(value);
  if (d.length !== 11) return false;
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const sum = weights.reduce((acc, w, i) => acc + w * Number(d[i]), 0);
  const mod = 11 - (sum % 11);
  const check = mod === 11 ? 0 : mod === 10 ? 9 : mod;
  return check === Number(d[10]);
}

const DETECTORS: Detector[] = [
  {
    id: "email",
    label: "Email address",
    severity: "medium",
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    explanation: "Matches local-part@domain.tld.",
  },
  {
    id: "payment_card",
    label: "Payment card number",
    severity: "high",
    pattern: /\b(?:\d[ -]?){13,19}\b/g,
    explanation: "13–19 digit sequence that passes the Luhn checksum.",
    validate: luhnValid,
  },
  {
    id: "iban",
    label: "IBAN",
    severity: "high",
    pattern: /\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){2,7}(?:\s?[A-Z0-9]{1,3})?\b/g,
    explanation: "Country code + check digits that pass the ISO 13616 mod-97 check.",
    validate: ibanValid,
  },
  {
    id: "us_ssn",
    label: "US Social Security number",
    severity: "high",
    pattern: /\b(?!000|666|9\d\d)\d{3}-(?!00)\d{2}-(?!0000)\d{4}\b/g,
    explanation: "NNN-NN-NNNN excluding invalid area/group/serial ranges.",
  },
  {
    id: "ar_cuit",
    label: "Argentine CUIT/CUIL",
    severity: "medium",
    pattern: /\b(?:20|23|24|27|30|33|34)-?\d{8}-?\d\b/g,
    explanation: "Valid prefix and modulo-11 check digit.",
    validate: cuitValid,
  },
  {
    id: "api_secret",
    label: "API key or secret",
    severity: "high",
    pattern: /\b(?:sk-[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{30,}|xox[baprs]-[A-Za-z0-9-]{10,})\b/g,
    explanation: "Known credential prefixes (sk-, AKIA, ghp_, xox*-).",
  },
  {
    id: "phone",
    label: "Phone number",
    severity: "low",
    pattern: /(?<![\w-])\+?\d{1,3}[ .-]?\(?\d{2,4}\)?[ .-]?\d{3,4}[ .-]?\d{3,4}(?![\w-])/g,
    explanation: "International or national phone format with 9–15 digits.",
    validate: (m) => {
      const len = digits(m).length;
      return len >= 9 && len <= 15 && !luhnValid(m);
    },
  },
  {
    id: "ipv4",
    label: "IPv4 address",
    severity: "low",
    pattern: /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g,
    explanation: "Four dot-separated octets in range 0–255.",
  },
];

export const DETECTOR_CATALOG = DETECTORS.map(({ id, label, severity, explanation }) => ({ id, label, severity, explanation }));

function mask(value: string): string {
  if (value.length <= 4) return "•".repeat(value.length);
  return `${value.slice(0, 2)}${"•".repeat(Math.max(3, value.length - 4))}${value.slice(-2)}`;
}

export function scanText(text: string, enabled: readonly DetectorId[] = DETECTORS.map((d) => d.id)): Finding[] {
  const findings: Finding[] = [];
  const taken: Array<[number, number]> = [];
  const overlaps = (s: number, e: number) => taken.some(([a, b]) => s < b && e > a);
  for (const det of DETECTORS) {
    if (!enabled.includes(det.id)) continue;
    for (const m of text.matchAll(det.pattern)) {
      const raw = m[0].trim();
      const start = (m.index ?? 0) + m[0].indexOf(raw);
      const end = start + raw.length;
      if (overlaps(start, end)) continue;
      if (det.validate && !det.validate(raw)) continue;
      taken.push([start, end]);
      findings.push({ detector: det.id, label: det.label, explanation: det.explanation, start, end, preview: mask(raw), severity: det.severity });
    }
  }
  return findings.sort((a, b) => a.start - b.start);
}

export function redact(text: string, findings: Finding[]): string {
  const counters = new Map<string, number>();
  let out = "";
  let cursor = 0;
  for (const f of [...findings].sort((a, b) => a.start - b.start)) {
    const k = (counters.get(f.detector) ?? 0) + 1;
    counters.set(f.detector, k);
    out += text.slice(cursor, f.start) + `[REDACTED:${f.detector.toUpperCase()}#${k}]`;
    cursor = f.end;
  }
  return out + text.slice(cursor);
}

export function suggestClassification(findings: Finding[], base: Classification = "internal"): Classification {
  if (findings.some((f) => f.detector === "api_secret")) return "restricted";
  if (findings.some((f) => f.severity === "high")) return "confidential";
  if (findings.some((f) => f.severity === "medium")) return base === "public" ? "internal" : base === "internal" ? "confidential" : base;
  return base;
}
