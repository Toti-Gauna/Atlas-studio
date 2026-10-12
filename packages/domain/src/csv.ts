/**
 * Deterministic CSV parsing, validation and descriptive statistics.
 * Every number shown by the Data Analyst comes from these functions — never
 * from a model.
 */

export interface CsvLimits {
  maxRows: number;
  maxColumns: number;
  maxCellLength: number;
}

export const DEFAULT_CSV_LIMITS: CsvLimits = { maxRows: 50_000, maxColumns: 60, maxCellLength: 2_000 };

export type ColumnKind = "integer" | "number" | "date" | "boolean" | "text" | "empty";

export interface CsvIssue {
  severity: "error" | "warning";
  code: "EMPTY_FILE" | "DUPLICATE_HEADER" | "EMPTY_HEADER" | "RAGGED_ROW" | "TOO_MANY_ROWS" | "TOO_MANY_COLUMNS" | "CELL_TOO_LONG" | "UNTERMINATED_QUOTE" | "MIXED_TYPES" | "FORMULA_PREFIX";
  message: string;
  row: number | null;
  column: string | null;
}

export interface ParsedCsv {
  delimiter: string;
  headers: string[];
  rows: string[][];
  issues: CsvIssue[];
}

function detectDelimiter(sample: string): string {
  const firstLine = sample.split(/\r?\n/, 1)[0] ?? "";
  const candidates = [",", ";", "\t", "|"];
  let best = ",";
  let bestCount = -1;
  for (const c of candidates) {
    const count = firstLine.split(c).length - 1;
    if (count > bestCount) {
      best = c;
      bestCount = count;
    }
  }
  return best;
}

/** RFC 4180-style parser with quoted fields and escaped quotes. */
export function parseCsv(text: string, limits: CsvLimits = DEFAULT_CSV_LIMITS): ParsedCsv {
  const issues: CsvIssue[] = [];
  const src = text.replace(/^\uFEFF/, "");
  if (src.trim().length === 0) {
    return { delimiter: ",", headers: [], rows: [], issues: [{ severity: "error", code: "EMPTY_FILE", message: "The file is empty.", row: null, column: null }] };
  }
  const delimiter = detectDelimiter(src);
  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
      continue;
    }
    if (ch === '"' && field.length === 0) inQuotes = true;
    else if (ch === delimiter) {
      record.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      record.push(field);
      records.push(record);
      record = [];
      field = "";
    } else field += ch;
  }
  if (inQuotes) issues.push({ severity: "error", code: "UNTERMINATED_QUOTE", message: "A quoted field is not closed.", row: records.length + 1, column: null });
  if (field.length > 0 || record.length > 0) {
    record.push(field);
    records.push(record);
  }
  const nonEmpty = records.filter((r) => !(r.length === 1 && r[0]!.trim() === ""));
  const headers = (nonEmpty[0] ?? []).map((h) => h.trim());
  const rows = nonEmpty.slice(1);

  const seen = new Set<string>();
  headers.forEach((h, idx) => {
    if (!h) issues.push({ severity: "error", code: "EMPTY_HEADER", message: `Column ${idx + 1} has no header.`, row: 1, column: null });
    else if (seen.has(h.toLowerCase())) issues.push({ severity: "error", code: "DUPLICATE_HEADER", message: `Header "${h}" is duplicated.`, row: 1, column: h });
    seen.add(h.toLowerCase());
  });
  if (headers.length > limits.maxColumns) issues.push({ severity: "error", code: "TOO_MANY_COLUMNS", message: `More than ${limits.maxColumns} columns.`, row: 1, column: null });
  if (rows.length > limits.maxRows) issues.push({ severity: "error", code: "TOO_MANY_ROWS", message: `More than ${limits.maxRows} data rows.`, row: null, column: null });
  rows.forEach((r, idx) => {
    if (r.length !== headers.length) {
      issues.push({ severity: "error", code: "RAGGED_ROW", message: `Row ${idx + 2} has ${r.length} fields; expected ${headers.length}.`, row: idx + 2, column: null });
    }
    r.forEach((cell, c) => {
      if (cell.length > limits.maxCellLength) issues.push({ severity: "warning", code: "CELL_TOO_LONG", message: `Cell exceeds ${limits.maxCellLength} characters.`, row: idx + 2, column: headers[c] ?? null });
      if (/^[=+\-@]/.test(cell) && Number.isNaN(Number(cell))) {
        issues.push({ severity: "warning", code: "FORMULA_PREFIX", message: "Cell starts with a spreadsheet formula prefix; it is treated as text and escaped on export.", row: idx + 2, column: headers[c] ?? null });
      }
    });
  });
  return { delimiter, headers, rows, issues };
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;
const isMissing = (v: string) => v.trim() === "" || /^(na|n\/a|null|none|-)$/i.test(v.trim());
const asNumber = (v: string): number | null => {
  const t = v.trim().replace(/,(?=\d{3}\b)/g, "");
  if (!/^-?\d+(\.\d+)?([eE][-+]?\d+)?$/.test(t)) return null;
  const x = Number(t);
  return Number.isFinite(x) ? x : null;
};

export function inferKind(values: string[]): { kind: ColumnKind; mixed: boolean } {
  const present = values.filter((v) => !isMissing(v));
  if (present.length === 0) return { kind: "empty", mixed: false };
  const nums = present.map(asNumber);
  const numericCount = nums.filter((x) => x !== null).length;
  if (numericCount === present.length) {
    return { kind: nums.every((x) => Number.isInteger(x)) ? "integer" : "number", mixed: false };
  }
  if (present.every((v) => ISO_DATE.test(v.trim()) && !Number.isNaN(Date.parse(v.trim())))) return { kind: "date", mixed: false };
  if (present.every((v) => /^(true|false|yes|no)$/i.test(v.trim()))) return { kind: "boolean", mixed: false };
  return { kind: "text", mixed: numericCount > 0 && numericCount / present.length >= 0.5 };
}

export interface NumericStats {
  count: number;
  sum: number;
  mean: number;
  median: number;
  min: number;
  max: number;
  p25: number;
  p75: number;
  stddev: number | null;
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 1) return sorted[0]!;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (pos - lo);
}

export function numericStats(values: number[]): NumericStats | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((a, b) => a + b, 0);
  const mean = sum / values.length;
  const variance = values.length > 1 ? values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (values.length - 1) : null;
  return {
    count: values.length,
    sum,
    mean,
    median: quantile(sorted, 0.5),
    min: sorted[0]!,
    max: sorted[sorted.length - 1]!,
    p25: quantile(sorted, 0.25),
    p75: quantile(sorted, 0.75),
    stddev: variance === null ? null : Math.sqrt(variance),
  };
}

export interface ColumnProfile {
  name: string;
  kind: ColumnKind;
  missing: number;
  distinct: number;
  numeric: NumericStats | null;
  topValues: Array<{ value: string; count: number }>;
  dateRange: { min: string; max: string } | null;
}

export interface CsvProfile {
  rowCount: number;
  columnCount: number;
  delimiter: string;
  valid: boolean;
  issues: CsvIssue[];
  columns: ColumnProfile[];
  method: string;
}

export function profileCsv(text: string, limits: CsvLimits = DEFAULT_CSV_LIMITS): CsvProfile {
  const parsed = parseCsv(text, limits);
  const issues = [...parsed.issues];
  const columns: ColumnProfile[] = parsed.headers.map((name, c) => {
    const values = parsed.rows.map((r) => r[c] ?? "");
    const { kind, mixed } = inferKind(values);
    if (mixed) issues.push({ severity: "warning", code: "MIXED_TYPES", message: `Column "${name}" mixes numbers and text; treated as text.`, row: null, column: name });
    const present = values.filter((v) => !isMissing(v));
    const counts = new Map<string, number>();
    for (const v of present) counts.set(v.trim(), (counts.get(v.trim()) ?? 0) + 1);
    const topValues = [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 5)
      .map(([value, count]) => ({ value, count }));
    const numeric = kind === "integer" || kind === "number" ? numericStats(present.map((v) => asNumber(v)!)) : null;
    let dateRange: ColumnProfile["dateRange"] = null;
    if (kind === "date") {
      const sorted = present.map((v) => v.trim()).sort();
      dateRange = { min: sorted[0]!, max: sorted[sorted.length - 1]! };
    }
    return { name, kind, missing: values.length - present.length, distinct: counts.size, numeric, topValues: kind === "text" || kind === "boolean" ? topValues : [], dateRange };
  });
  return {
    rowCount: parsed.rows.length,
    columnCount: parsed.headers.length,
    delimiter: parsed.delimiter,
    valid: !issues.some((i) => i.severity === "error"),
    issues,
    columns,
    method: "Deterministic parser (RFC 4180 subset); sample standard deviation (n−1); linear-interpolated quantiles.",
  };
}

export type AggregateOp = "sum" | "mean" | "count" | "min" | "max";

/** Bounded group-by aggregation — the only "query" tool the Data Analyst has. */
export function aggregate(text: string, groupBy: string, measure: string | null, op: AggregateOp): Array<{ group: string; value: number; rows: number }> {
  const parsed = parseCsv(text);
  const g = parsed.headers.indexOf(groupBy);
  if (g < 0) throw new Error(`unknown column: ${groupBy}`);
  const m = measure === null ? -1 : parsed.headers.indexOf(measure);
  if (measure !== null && m < 0) throw new Error(`unknown column: ${measure}`);
  const buckets = new Map<string, number[]>();
  for (const r of parsed.rows) {
    const key = (r[g] ?? "").trim() || "(missing)";
    const list = buckets.get(key) ?? [];
    if (m >= 0) {
      const v = asNumber(r[m] ?? "");
      if (v !== null) list.push(v);
    } else list.push(1);
    buckets.set(key, list);
  }
  return [...buckets.entries()]
    .map(([group, vals]) => {
      const stats = numericStats(vals);
      const value = op === "count" ? vals.length : !stats ? 0 : op === "sum" ? stats.sum : op === "mean" ? stats.mean : op === "min" ? stats.min : stats.max;
      return { group, value, rows: vals.length };
    })
    .sort((a, b) => b.value - a.value || a.group.localeCompare(b.group));
}

/** Escape cells for CSV export, neutralizing spreadsheet formula injection. */
export function toCsv(headers: string[], rows: Array<Array<string | number | null>>): string {
  const esc = (v: string | number | null) => {
    if (v === null) return "";
    let s = String(v);
    if (typeof v === "string" && /^[=+\-@\t\r]/.test(s) && Number.isNaN(Number(s))) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\r\n") + "\r\n";
}
