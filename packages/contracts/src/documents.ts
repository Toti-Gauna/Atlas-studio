import { z } from "zod";
import { DataLabel, Id, IsoDateTime } from "./common";

export const DocumentKind = z.enum(["pdf", "text", "markdown", "csv", "image"]);
export type DocumentKind = z.infer<typeof DocumentKind>;

export const Classification = z.enum(["public", "internal", "confidential", "restricted"]);
export type Classification = z.infer<typeof Classification>;

export const IngestionStatus = z.enum(["queued", "parsing", "indexing", "ready", "failed"]);
export type IngestionStatus = z.infer<typeof IngestionStatus>;

export const DocumentVersion = z.object({
  id: Id,
  documentId: Id,
  version: z.number().int().positive(),
  status: IngestionStatus,
  sha256: z.string(),
  byteSize: z.number().int().nonnegative(),
  pageCount: z.number().int().nonnegative().nullable(),
  chunkCount: z.number().int().nonnegative(),
  /** Only a version whose indexing succeeded can be published. */
  published: z.boolean(),
  failureReason: z.string().nullable(),
  createdAt: IsoDateTime,
});
export type DocumentVersion = z.infer<typeof DocumentVersion>;

export const DocumentSummary = z.object({
  id: Id,
  title: z.string(),
  kind: DocumentKind,
  mimeType: z.string(),
  projectIds: z.array(Id),
  classification: Classification,
  sensitiveFindingCount: z.number().int().nonnegative(),
  publishedVersion: z.number().int().positive().nullable(),
  latestStatus: IngestionStatus,
  tags: z.array(z.string()),
  label: DataLabel,
  updatedAt: IsoDateTime,
});
export type DocumentSummary = z.infer<typeof DocumentSummary>;

export const Chunk = z.object({
  id: Id,
  documentId: Id,
  versionId: Id,
  ordinal: z.number().int().nonnegative(),
  page: z.number().int().positive().nullable(),
  text: z.string(),
  charStart: z.number().int().nonnegative(),
  charEnd: z.number().int().nonnegative(),
});
export type Chunk = z.infer<typeof Chunk>;

export const DocumentPage = z.object({ page: z.number().int().positive(), text: z.string() });

export const DocumentDetail = DocumentSummary.extend({
  versions: z.array(DocumentVersion),
  pages: z.array(DocumentPage),
  /** For CSV documents, the deterministic profile computed at ingestion. */
  csvProfileAvailable: z.boolean(),
  /** For images: whether any connected model with vision can read it. */
  visionStatus: z.enum(["not_applicable", "pending_provider", "available"]),
});
export type DocumentDetail = z.infer<typeof DocumentDetail>;

export const IngestionJob = z.object({
  id: Id,
  documentId: Id,
  versionId: Id,
  status: IngestionStatus,
  attempt: z.number().int().positive(),
  maxAttempts: z.number().int().positive(),
  error: z.string().nullable(),
  startedAt: IsoDateTime.nullable(),
  finishedAt: IsoDateTime.nullable(),
});
export type IngestionJob = z.infer<typeof IngestionJob>;

export const UploadLimits = z.object({
  maxBytes: z.number().int().positive(),
  allowedMimeTypes: z.array(z.string()),
  maxCsvRows: z.number().int().positive(),
  maxCsvColumns: z.number().int().positive(),
});

export const SearchHit = z.object({
  chunkId: Id,
  documentId: Id,
  versionId: Id,
  documentTitle: z.string(),
  version: z.number().int().positive(),
  page: z.number().int().positive().nullable(),
  snippet: z.string(),
  score: z.number(),
});
export type SearchHit = z.infer<typeof SearchHit>;
