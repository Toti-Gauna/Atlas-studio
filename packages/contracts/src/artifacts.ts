import { z } from "zod";
import { DataLabel, Id, IsoDateTime } from "./common";

export const ArtifactType = z.enum(["report", "table", "presentation"]);
export type ArtifactType = z.infer<typeof ArtifactType>;

/** Source references survive edits and exports. */
export const SourceRef = z.object({
  ref: z.string().regex(/^S\d{1,3}$/),
  documentId: Id,
  versionId: Id,
  version: z.number().int().positive(),
  documentTitle: z.string(),
  page: z.number().int().positive().nullable(),
  quote: z.string().max(600),
});
export type SourceRef = z.infer<typeof SourceRef>;

/** Structured blocks only — previews never execute HTML/JS. */
export const ReportBlock = z.discriminatedUnion("type", [
  z.object({ type: z.literal("heading"), level: z.union([z.literal(1), z.literal(2), z.literal(3)]), text: z.string().max(200) }),
  z.object({ type: z.literal("paragraph"), text: z.string().max(6000), sourceRefs: z.array(z.string()) }),
  z.object({ type: z.literal("bullets"), items: z.array(z.string().max(600)).max(40), sourceRefs: z.array(z.string()) }),
  z.object({ type: z.literal("callout"), tone: z.enum(["info", "warning", "gap"]), text: z.string().max(1200) }),
  z.object({ type: z.literal("table_ref"), caption: z.string().max(200), columns: z.array(z.string()).max(12), rows: z.array(z.array(z.string().max(300))).max(200) }),
  z.object({ type: z.literal("code"), language: z.string().max(20), text: z.string().max(12000) }),
]);
export type ReportBlock = z.infer<typeof ReportBlock>;

export const ReportContent = z.object({
  type: z.literal("report"),
  title: z.string().max(200),
  blocks: z.array(ReportBlock).max(200),
});

export const TableColumn = z.object({ key: z.string(), label: z.string(), kind: z.enum(["text", "number", "date"]) });
export const TableContent = z.object({
  type: z.literal("table"),
  title: z.string().max(200),
  columns: z.array(TableColumn).min(1).max(30),
  rows: z.array(z.record(z.string(), z.union([z.string(), z.number(), z.null()]))).max(5000),
  note: z.string().max(600).nullable(),
});

export const Slide = z.object({
  id: z.string(),
  layout: z.enum(["title", "bullets", "two_column", "metric", "closing"]),
  title: z.string().max(120),
  subtitle: z.string().max(200).nullable(),
  bullets: z.array(z.string().max(220)).max(8),
  right: z.array(z.string().max(220)).max(8),
  metric: z.object({ value: z.string().max(24), label: z.string().max(80) }).nullable(),
  notes: z.string().max(1200),
  sourceRefs: z.array(z.string()),
});
export type Slide = z.infer<typeof Slide>;

export const PresentationContent = z.object({
  type: z.literal("presentation"),
  title: z.string().max(200),
  audience: z.string().max(200),
  theme: z.enum(["atlas_light", "atlas_ink"]),
  slides: z.array(Slide).min(1).max(40),
});

export const ArtifactContent = z.discriminatedUnion("type", [ReportContent, TableContent, PresentationContent]);
export type ArtifactContent = z.infer<typeof ArtifactContent>;

export const ReviewState = z.enum(["draft", "in_review", "approved", "changes_requested"]);
export type ReviewState = z.infer<typeof ReviewState>;

export const ArtifactVersion = z.object({
  id: Id,
  artifactId: Id,
  version: z.number().int().positive(),
  content: ArtifactContent,
  sources: z.array(SourceRef),
  authorId: Id,
  authorName: z.string(),
  createdByRunId: Id.nullable(),
  reviewState: ReviewState,
  /** Approval is bound to exactly this version; editing creates a new version without approval. */
  approvedBy: Id.nullable(),
  approvedAt: IsoDateTime.nullable(),
  changeNote: z.string().max(200),
  createdAt: IsoDateTime,
});
export type ArtifactVersion = z.infer<typeof ArtifactVersion>;

export const ShareRole = z.enum(["viewer", "editor", "reviewer"]);
export type ShareRole = z.infer<typeof ShareRole>;

export const ArtifactShare = z.object({
  id: Id,
  artifactId: Id,
  userId: Id,
  userName: z.string(),
  role: ShareRole,
  createdAt: IsoDateTime,
});
export type ArtifactShare = z.infer<typeof ArtifactShare>;

export const ArtifactSummary = z.object({
  id: Id,
  projectId: Id,
  type: ArtifactType,
  title: z.string(),
  currentVersion: z.number().int().positive(),
  reviewState: ReviewState,
  ownerId: Id,
  ownerName: z.string(),
  myRole: z.enum(["owner", "editor", "reviewer", "viewer"]),
  sourceCount: z.number().int().nonnegative(),
  label: DataLabel,
  updatedAt: IsoDateTime,
});
export type ArtifactSummary = z.infer<typeof ArtifactSummary>;

export const ArtifactDetail = ArtifactSummary.extend({
  versions: z.array(ArtifactVersion.omit({ content: true, sources: true })),
  current: ArtifactVersion,
  shares: z.array(ArtifactShare),
});
export type ArtifactDetail = z.infer<typeof ArtifactDetail>;

export const SaveArtifactVersionRequest = z.object({
  baseVersion: z.number().int().positive(),
  content: ArtifactContent,
  sources: z.array(SourceRef),
  changeNote: z.string().max(200),
});

export const ExportFormat = z.enum(["md", "csv", "json", "pdf", "pptx"]);
export type ExportFormat = z.infer<typeof ExportFormat>;

export const ReviewComment = z.object({
  id: Id,
  artifactId: Id,
  version: z.number().int().positive(),
  authorId: Id,
  authorName: z.string(),
  body: z.string().min(1).max(2000),
  anchor: z.string().nullable(),
  resolved: z.boolean(),
  createdAt: IsoDateTime,
});
export type ReviewComment = z.infer<typeof ReviewComment>;

export const ReviewRequest = z.object({
  id: Id,
  artifactId: Id,
  artifactTitle: z.string(),
  version: z.number().int().positive(),
  requestedBy: Id,
  requestedByName: z.string(),
  reviewerId: Id,
  reviewerName: z.string(),
  status: z.enum(["open", "approved", "changes_requested", "superseded"]),
  decisionNote: z.string().nullable(),
  createdAt: IsoDateTime,
  decidedAt: IsoDateTime.nullable(),
});
export type ReviewRequest = z.infer<typeof ReviewRequest>;

export const ReviewDecisionRequest = z.object({
  /** Must equal the version under review; a stale version is rejected with CONFLICT. */
  version: z.number().int().positive(),
  decision: z.enum(["approve", "request_changes"]),
  note: z.string().max(1000).optional(),
});
