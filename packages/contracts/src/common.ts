import { z } from "zod";

/** Opaque string identifiers. Prefixes make logs and URLs self-describing (e.g. `prj_`, `doc_`). */
export const Id = z.string().min(3).max(64).regex(/^[a-z]{2,5}_[A-Za-z0-9_-]+$/, "invalid id");
export type Id = z.infer<typeof Id>;

/** ISO-8601 instant in UTC. Display converts to the workspace IANA time zone. */
export const IsoDateTime = z.string().datetime({ offset: true });
export type IsoDateTime = z.infer<typeof IsoDateTime>;

/** IANA time zone, e.g. `America/Argentina/Buenos_Aires`. */
export const TimeZone = z.string().min(1).max(64);

/**
 * Money is stored in nano-USD (1e-9 USD) as a decimal integer string so that
 * sub-cent per-token prices stay exact. Aggregation happens on integers; rounding
 * only at display time.
 */
export const NanoUsd = z.string().regex(/^-?\d+$/, "nano-USD integer string");
export type NanoUsd = z.infer<typeof NanoUsd>;

export const Currency = z.enum(["USD"]);

/** How an external capability is wired in the current environment. */
export const IntegrationMode = z.enum(["local", "connected", "pending"]);
export type IntegrationMode = z.infer<typeof IntegrationMode>;

/** Seeded/fixture records are DEMO and never mixed with real telemetry. */
export const DataLabel = z.enum(["DEMO", "LIVE"]);
export type DataLabel = z.infer<typeof DataLabel>;

export const ErrorCode = z.enum([
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "VALIDATION",
  "CONFLICT",
  "BUDGET_EXCEEDED",
  "QUOTA_RESERVATION_FAILED",
  "PROVIDER_DISCONNECTED",
  "CAPABILITY_UNSUPPORTED",
  "CONSENT_REQUIRED",
  "REDACTION_REVIEW_REQUIRED",
  "TOOL_NOT_ALLOWED",
  "CONFIRMATION_EXPIRED",
  "RATE_LIMITED",
  "PAYLOAD_TOO_LARGE",
  "UNSUPPORTED_MEDIA_TYPE",
  "CANCELLED",
  "TIMEOUT",
  "INTERNAL",
]);
export type ErrorCode = z.infer<typeof ErrorCode>;

export const ApiErrorBody = z.object({
  error: z.object({
    code: ErrorCode,
    message: z.string(),
    requestId: z.string().optional(),
    details: z.record(z.string(), z.unknown()).optional(),
  }),
});
export type ApiErrorBody = z.infer<typeof ApiErrorBody>;

export const PageQuery = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const pageOf = <T extends z.ZodTypeAny>(item: T) =>
  z.object({ items: z.array(item), nextCursor: z.string().nullable() });

export type Page<T> = { items: T[]; nextCursor: string | null };

export const AuditFields = {
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
};
