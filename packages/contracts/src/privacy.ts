import { z } from "zod";
import { Id, IsoDateTime } from "./common";
import { Classification } from "./documents";

export const DetectorId = z.enum([
  "email",
  "phone",
  "payment_card",
  "iban",
  "us_ssn",
  "ar_cuit",
  "api_secret",
  "ipv4",
]);
export type DetectorId = z.infer<typeof DetectorId>;

export const Finding = z.object({
  detector: DetectorId,
  label: z.string(),
  /** Why the rule matched (pattern + validation) — explainable, not a black box. */
  explanation: z.string(),
  start: z.number().int().nonnegative(),
  end: z.number().int().nonnegative(),
  /** Masked preview; the raw match is never logged. */
  preview: z.string(),
  severity: z.enum(["low", "medium", "high"]),
});
export type Finding = z.infer<typeof Finding>;

export const RedactionReview = z.object({
  id: Id,
  documentId: Id.nullable(),
  documentTitle: z.string().nullable(),
  versionId: Id.nullable(),
  source: z.enum(["document", "composer_text"]),
  status: z.enum(["pending_review", "redacted", "approved_original", "rejected"]),
  findings: z.array(Finding),
  suggestedClassification: Classification,
  reviewerId: Id.nullable(),
  decidedAt: IsoDateTime.nullable(),
  createdAt: IsoDateTime,
});
export type RedactionReview = z.infer<typeof RedactionReview>;

export const PrivacyPolicy = z.object({
  id: Id,
  version: z.number().int().positive(),
  /** Classifications that require redaction review before any external provider call. */
  reviewRequiredFor: z.array(Classification),
  /** Classifications that can never leave Atlas (local mode only). */
  blockExternalFor: z.array(Classification),
  externalTransferRequiresConsent: z.boolean(),
  retentionDays: z.object({
    conversations: z.number().int().min(1).max(3650),
    runTraces: z.number().int().min(1).max(3650),
    originalsAfterRedaction: z.number().int().min(0).max(3650),
  }),
  enabledDetectors: z.array(DetectorId),
  updatedAt: IsoDateTime,
});
export type PrivacyPolicy = z.infer<typeof PrivacyPolicy>;

export const ExternalTransferConsent = z.object({
  id: Id,
  provider: z.string(),
  documentIds: z.array(Id),
  grantedBy: Id,
  grantedByName: z.string(),
  scope: z.enum(["single_run", "project_30d"]),
  createdAt: IsoDateTime,
  expiresAt: IsoDateTime,
  revokedAt: IsoDateTime.nullable(),
});
export type ExternalTransferConsent = z.infer<typeof ExternalTransferConsent>;

export const ScanTextRequest = z.object({ text: z.string().max(50_000) });
export const ScanTextResponse = z.object({
  findings: z.array(Finding),
  redactedText: z.string(),
  suggestedClassification: Classification,
  limitations: z.array(z.string()),
});
export type ScanTextResponse = z.infer<typeof ScanTextResponse>;

export const RedactionDecisionRequest = z.object({
  decision: z.enum(["redact", "approve_original", "reject"]),
  note: z.string().max(500).optional(),
});
