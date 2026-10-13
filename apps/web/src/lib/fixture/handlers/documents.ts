/** FIXTURE (P02 preview only): documents, search, CSV profile and Privacy Center. */
import type { Chunk, DocumentDetail, DocumentKind, ExternalTransferConsent, PrivacyPolicy } from "@atlas/contracts";
import { DETECTION_LIMITATIONS, bm25Search, chunkPages, profileCsv, redact, scanText, suggestClassification } from "@atlas/domain";
import { iso, newId, type DocRecord } from "../db";
import { body, FixtureError, notFound, on, requireAction, type Ctx } from "../router";
import { authorizedChunks } from "../scope";

export const UPLOAD_LIMITS = {
  maxBytes: 5 * 1024 * 1024,
  allowedMimeTypes: ["application/pdf", "text/plain", "text/markdown", "text/csv", "image/png", "image/jpeg", "image/webp"],
  maxCsvRows: 50_000,
  maxCsvColumns: 60,
};

const getDoc = (ctx: Ctx, id: string): DocRecord => ctx.db.documents.find((d) => d.summary.id === id && !d.deleted) ?? notFound("Document");

function detail(d: DocRecord): DocumentDetail {
  const published = d.versions.find((v) => v.published) ?? d.versions[d.versions.length - 1]!;
  return {
    ...d.summary,
    versions: d.versions,
    pages: d.pages[published.id] ?? [],
    csvProfileAvailable: Boolean(d.csvText),
    visionStatus: d.summary.kind === "image" ? "pending_provider" : "not_applicable",
  };
}

on("GET", "/documents", (ctx) => {
  requireAction(ctx, "document.read");
  const pid = ctx.query.projectId;
  return ctx.db.documents.filter((d) => !d.deleted && (!pid || d.summary.projectIds.includes(pid))).map((d) => d.summary);
});
on("GET", "/documents/:id", (ctx) => {
  requireAction(ctx, "document.read");
  const d = getDoc(ctx, ctx.params.id!);
  const versionId = ctx.query.versionId;
  const base = detail(d);
  return versionId && d.pages[versionId] ? { ...base, pages: d.pages[versionId] } : base;
});
on("GET", "/documents/:id/status", (ctx) => {
  const d = getDoc(ctx, ctx.params.id!);
  return { status: d.summary.latestStatus, versions: d.versions };
});
on("GET", "/documents/:id/csv-profile", (ctx) => {
  requireAction(ctx, "document.read");
  const d = getDoc(ctx, ctx.params.id!);
  if (!d.csvText) throw new FixtureError("UNSUPPORTED_MEDIA_TYPE", "This document is not a CSV.");
  return profileCsv(d.csvText);
});

/** Upload: validates type/size/structure; PDFs and images are stored but not text-extracted in the preview. */
on("POST", "/documents", (ctx) => {
  requireAction(ctx, "document.upload");
  const b = body<{ title: string; mimeType: string; projectId: string; text: string | null; byteSize: number }>(ctx);
  if (!UPLOAD_LIMITS.allowedMimeTypes.includes(b.mimeType)) throw new FixtureError("UNSUPPORTED_MEDIA_TYPE", `${b.mimeType || "This file type"} is not accepted. Allowed: PDF, TXT, MD, CSV, PNG, JPEG, WebP.`);
  if (b.byteSize > UPLOAD_LIMITS.maxBytes) throw new FixtureError("PAYLOAD_TOO_LARGE", "Files are limited to 5 MB in the demo workspace.");
  if (!ctx.db.projects.some((p) => p.id === b.projectId)) notFound("Project");
  const kind: DocumentKind = b.mimeType === "text/csv" ? "csv" : b.mimeType === "application/pdf" ? "pdf" : b.mimeType.startsWith("image/") ? "image" : b.mimeType === "text/markdown" ? "markdown" : "text";
  const id = newId("doc");
  const vid = newId("dv");
  let status: "ready" | "failed" = "ready";
  let failureReason: string | null = null;
  let chunks: Chunk[] = [];
  let pages: Array<{ page: number; text: string }> = [];
  if (kind === "csv") {
    const p = profileCsv(b.text ?? "", { maxRows: UPLOAD_LIMITS.maxCsvRows, maxColumns: UPLOAD_LIMITS.maxCsvColumns, maxCellLength: 2000 });
    if (!p.valid) {
      status = "failed";
      failureReason = `CSV validation failed: ${p.issues.filter((i) => i.severity === "error").map((i) => i.message).slice(0, 3).join(" ")}`;
    }
    pages = [{ page: 1, text: (b.text ?? "").split("\n").slice(0, 16).join("\n") }];
  } else if (kind === "pdf") {
    status = "failed";
    failureReason = "PDFs are stored but can’t be cited yet in this demo.";
  } else if (kind === "image") {
    status = "ready";
  } else {
    pages = [{ page: 1, text: b.text ?? "" }];
    chunks = chunkPages(pages).map((c, i) => ({ id: `${vid}_c${i}`, documentId: id, versionId: vid, ordinal: i, page: c.page, text: c.text, charStart: c.start, charEnd: c.end }));
  }
  const findings = scanText(pages.map((p) => p.text).join("\n"));
  const now = iso(Date.now());
  const rec: DocRecord = {
    summary: { id, title: b.title.slice(0, 120), kind, mimeType: b.mimeType, projectIds: [b.projectId], classification: suggestClassification(findings), sensitiveFindingCount: findings.length, publishedVersion: status === "ready" ? 1 : null, latestStatus: status, tags: ["uploaded"], label: "DEMO", updatedAt: now },
    versions: [{ id: vid, documentId: id, version: 1, status, sha256: `sha256:preview-${b.byteSize}`, byteSize: b.byteSize, pageCount: pages.length || null, chunkCount: chunks.length, published: status === "ready", failureReason, createdAt: now }],
    pages: { [vid]: pages },
    chunks: { [vid]: chunks },
    csvText: kind === "csv" && status === "ready" ? (b.text ?? "") : null,
    imagePath: null,
    deleted: false,
  };
  ctx.db.documents.unshift(rec);
  if (findings.length) {
    ctx.db.redactionReviews.unshift({ id: newId("rdr"), documentId: id, documentTitle: rec.summary.title, versionId: vid, source: "document", status: "pending_review", findings, suggestedClassification: rec.summary.classification, reviewerId: null, decidedAt: null, createdAt: now });
  }
  return rec.summary;
});
on("POST", "/documents/:id/reindex", (ctx) => {
  requireAction(ctx, "document.admin");
  const d = getDoc(ctx, ctx.params.id!);
  const last = d.versions[d.versions.length - 1]!;
  if (last.status === "failed" && !d.pages[last.id]?.length) throw new FixtureError("CAPABILITY_UNSUPPORTED", last.failureReason ?? "Nothing to index.");
  const vid = newId("dv");
  const pages = d.pages[last.id] ?? [];
  d.pages[vid] = pages;
  d.chunks[vid] = (d.chunks[last.id] ?? []).map((c, i) => ({ ...c, id: `${vid}_c${i}`, versionId: vid }));
  d.versions.forEach((v) => (v.published = false));
  d.versions.push({ ...last, id: vid, version: last.version + 1, status: "ready", published: true, createdAt: iso(Date.now()) });
  d.summary.publishedVersion = last.version + 1;
  d.summary.updatedAt = iso(Date.now());
  return d.summary;
});
on("DELETE", "/documents/:id", (ctx) => {
  requireAction(ctx, "document.admin");
  const d = getDoc(ctx, ctx.params.id!);
  d.deleted = true; // removed from index, search, citations and future runs
  return undefined;
});

on("GET", "/search/documents", (ctx) => {
  requireAction(ctx, "document.read");
  const q = (ctx.query.q ?? "").trim();
  if (!q) return [];
  const chunks = ctx.query.projectId ? authorizedChunks(ctx.db, ctx.query.projectId) : ctx.db.projects.flatMap((p) => authorizedChunks(ctx.db, p.id)).filter((c, i, a) => a.findIndex((x) => x.id === c.id) === i);
  return bm25Search(q, chunks)
    .slice(0, 12)
    .map((h) => ({ chunkId: h.chunk.id, documentId: h.chunk.documentId, versionId: h.chunk.versionId, documentTitle: h.chunk.documentTitle, version: h.chunk.version, page: h.chunk.page, snippet: h.chunk.text.slice(0, 260), score: Math.round(h.coverage * 100) / 100 }));
});

// Privacy Center (R10)
on("GET", "/privacy/policy", (ctx) => {
  requireAction(ctx, "privacy.read");
  return ctx.db.privacyPolicy;
});
on("PUT", "/privacy/policy", (ctx) => {
  requireAction(ctx, "privacy.admin");
  const p = body<PrivacyPolicy>(ctx);
  ctx.db.privacyPolicy = { ...p, id: ctx.db.privacyPolicy.id, version: ctx.db.privacyPolicy.version + 1, updatedAt: iso(Date.now()) };
  return ctx.db.privacyPolicy;
});
on("POST", "/privacy/scan", (ctx) => {
  requireAction(ctx, "privacy.read");
  const { text } = body<{ text: string }>(ctx);
  if ((text ?? "").length > 50_000) throw new FixtureError("PAYLOAD_TOO_LARGE", "Scan text is limited to 50,000 characters.");
  const findings = scanText(text ?? "", ctx.db.privacyPolicy.enabledDetectors);
  return { findings, redactedText: redact(text ?? "", findings), suggestedClassification: suggestClassification(findings), limitations: DETECTION_LIMITATIONS };
});
on("GET", "/privacy/reviews", (ctx) => {
  requireAction(ctx, "privacy.read");
  return ctx.db.redactionReviews;
});
on("POST", "/privacy/reviews/:id/decision", (ctx) => {
  requireAction(ctx, "privacy.admin");
  const r = ctx.db.redactionReviews.find((x) => x.id === ctx.params.id) ?? notFound("Review");
  if (r.status !== "pending_review") throw new FixtureError("CONFLICT", "This review was already decided.");
  const { decision } = body<{ decision: "redact" | "approve_original" | "reject" }>(ctx);
  r.status = decision === "redact" ? "redacted" : decision === "approve_original" ? "approved_original" : "rejected";
  r.reviewerId = ctx.userId;
  r.decidedAt = iso(Date.now());
  const doc = r.documentId ? ctx.db.documents.find((d) => d.summary.id === r.documentId) : undefined;
  if (doc && decision === "redact" && r.versionId) {
    const pages = (doc.pages[r.versionId] ?? []).map((p) => ({ page: p.page, text: redact(p.text, scanText(p.text)) }));
    const vid = newId("dv");
    const last = doc.versions[doc.versions.length - 1]!;
    doc.pages[vid] = pages;
    doc.chunks[vid] = chunkPages(pages).map((c, i) => ({ id: `${vid}_c${i}`, documentId: doc.summary.id, versionId: vid, ordinal: i, page: c.page, text: c.text, charStart: c.start, charEnd: c.end }));
    doc.versions.forEach((v) => (v.published = false));
    doc.versions.push({ ...last, id: vid, version: last.version + 1, status: "ready", published: true, chunkCount: doc.chunks[vid]!.length, createdAt: iso(Date.now()) });
    doc.summary.publishedVersion = last.version + 1;
    doc.summary.sensitiveFindingCount = 0;
  }
  return r;
});
on("GET", "/privacy/consents", (ctx) => {
  requireAction(ctx, "privacy.read");
  return ctx.db.consents;
});
on("POST", "/privacy/consents", (ctx) => {
  requireAction(ctx, "privacy.admin");
  const b = body<{ provider: string; documentIds: string[]; scope: ExternalTransferConsent["scope"] }>(ctx);
  const c: ExternalTransferConsent = { id: newId("cns"), provider: b.provider, documentIds: b.documentIds, grantedBy: ctx.userId, grantedByName: "Demo Visitor", scope: b.scope, createdAt: iso(Date.now()), expiresAt: iso(Date.now() + (b.scope === "single_run" ? 3_600_000 : 30 * 86_400_000)), revokedAt: null };
  ctx.db.consents.unshift(c);
  return c;
});
on("DELETE", "/privacy/consents/:id", (ctx) => {
  requireAction(ctx, "privacy.admin");
  const c = ctx.db.consents.find((x) => x.id === ctx.params.id) ?? notFound("Consent");
  c.revokedAt = iso(Date.now());
  return undefined;
});
