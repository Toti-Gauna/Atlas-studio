/** FIXTURE (P02 preview only): artifacts, versions, exports, shares, reviews and comments. */
import type { ArtifactContent, ExportFormat, ReviewRequest, ShareRole, SourceRef } from "@atlas/contracts";
import { canOnArtifact } from "@atlas/domain";
import { exportFilename, MIME, renderExport } from "@atlas/renderers";
import { iso, newId, type ArtifactRecord } from "../db";
import { body, FixtureError, notFound, on, requireAction, type Ctx } from "../router";
import { createArtifact, myRoleOn, saveVersion, toDetail } from "../engine/artifacts";

const getArt = (ctx: Ctx, id: string): ArtifactRecord => ctx.db.artifacts.find((a) => a.summary.id === id) ?? notFound("Artifact");
const roleOn = (ctx: Ctx, rec: ArtifactRecord) => myRoleOn(rec, ctx.userId, ctx.role);

on("GET", "/artifacts", (ctx) => {
  requireAction(ctx, "artifact.read");
  const pid = ctx.query.projectId;
  return ctx.db.artifacts.filter((a) => !pid || a.summary.projectId === pid).map((a) => ({ ...a.summary, myRole: roleOn(ctx, a) }));
});
on("GET", "/artifacts/:id", (ctx) => {
  requireAction(ctx, "artifact.read");
  return toDetail(getArt(ctx, ctx.params.id!), ctx.userId, ctx.role);
});
on("GET", "/artifacts/:id/versions/:version", (ctx) => {
  requireAction(ctx, "artifact.read");
  const rec = getArt(ctx, ctx.params.id!);
  return rec.versions.find((v) => v.version === Number(ctx.params.version)) ?? notFound("Version");
});
on("POST", "/artifacts", (ctx) => {
  requireAction(ctx, "artifact.write");
  const b = body<{ projectId: string; title: string; content: ArtifactContent; sources: SourceRef[] }>(ctx);
  const rec = createArtifact(ctx.db, { projectId: b.projectId, title: b.title, content: b.content, sources: b.sources, authorId: ctx.userId, runId: null });
  return toDetail(rec, ctx.userId, ctx.role);
});
on("POST", "/artifacts/:id/versions", (ctx) => {
  requireAction(ctx, "artifact.write");
  const rec = getArt(ctx, ctx.params.id!);
  if (!canOnArtifact(roleOn(ctx, rec), "edit")) throw new FixtureError("FORBIDDEN", "You can view this artifact but not edit it.");
  const b = body<{ baseVersion: number; content: ArtifactContent; sources: SourceRef[]; changeNote: string }>(ctx);
  if (b.baseVersion !== rec.summary.currentVersion) throw new FixtureError("CONFLICT", `A newer version (v${rec.summary.currentVersion}) exists. Reload before saving.`);
  if (b.content.type !== rec.summary.type) throw new FixtureError("VALIDATION", "Artifact type cannot change.");
  saveVersion(ctx.db, rec, { content: b.content, sources: b.sources, authorId: ctx.userId, changeNote: b.changeNote });
  return toDetail(rec, ctx.userId, ctx.role);
});

/** Export uses the same structured renderers as the API (no model code executed). */
export async function exportArtifact(ctx: Ctx, id: string, version: number, format: ExportFormat) {
  requireAction(ctx, "artifact.read");
  const rec = getArt(ctx, id);
  const v = rec.versions.find((x) => x.version === version) ?? notFound("Version");
  try {
    const out = await renderExport(format, v.content, v.sources, { artifactId: rec.summary.id, version, exportedAt: iso(Date.now()), workspaceName: ctx.db.workspace.name, label: "DEMO" });
    const blob = new Blob([typeof out === "string" ? out : new Uint8Array(out)], { type: MIME[format] });
    return { blob, filename: exportFilename(rec.summary.title, version, format) };
  } catch (e) {
    throw new FixtureError("CAPABILITY_UNSUPPORTED", (e as Error).message);
  }
}

on("GET", "/artifact-shares", (ctx) => getArt(ctx, ctx.query.artifactId ?? "").shares);
on("POST", "/artifact-shares", (ctx) => {
  requireAction(ctx, "artifact.share");
  const b = body<{ artifactId: string; userId: string; role: ShareRole }>(ctx);
  const rec = getArt(ctx, b.artifactId);
  if (!canOnArtifact(roleOn(ctx, rec), "share")) throw new FixtureError("FORBIDDEN", "Only the owner can share this artifact.");
  const user = ctx.db.users.find((u) => u.id === b.userId);
  if (!user) throw new FixtureError("FORBIDDEN", "You can only share with members of this workspace. Public links are not available.");
  const existing = rec.shares.find((s) => s.userId === b.userId);
  if (existing) {
    existing.role = b.role;
    return existing;
  }
  const s = { id: newId("shr"), artifactId: rec.summary.id, userId: user.id, userName: user.displayName, role: b.role, createdAt: iso(Date.now()) };
  rec.shares.push(s);
  return s;
});
on("DELETE", "/artifact-shares/:id", (ctx) => {
  requireAction(ctx, "artifact.share");
  for (const a of ctx.db.artifacts) {
    const i = a.shares.findIndex((s) => s.id === ctx.params.id);
    if (i >= 0) {
      if (!canOnArtifact(roleOn(ctx, a), "share")) throw new FixtureError("FORBIDDEN", "Only the owner can revoke access.");
      a.shares.splice(i, 1);
      return undefined;
    }
  }
  notFound("Share");
});

on("GET", "/reviews", (ctx) => {
  requireAction(ctx, "artifact.read");
  return ctx.query.mine ? ctx.db.reviews.filter((r) => r.reviewerId === ctx.userId || r.requestedBy === ctx.userId) : ctx.db.reviews;
});
on("POST", "/reviews", (ctx) => {
  requireAction(ctx, "artifact.write");
  const b = body<{ artifactId: string; version: number; reviewerId: string }>(ctx);
  const rec = getArt(ctx, b.artifactId);
  if (b.version !== rec.summary.currentVersion) throw new FixtureError("CONFLICT", "Request review of the current version.");
  const reviewer = ctx.db.users.find((u) => u.id === b.reviewerId) ?? notFound("Reviewer");
  const r: ReviewRequest = { id: newId("rvw"), artifactId: rec.summary.id, artifactTitle: rec.summary.title, version: b.version, requestedBy: ctx.userId, requestedByName: "Demo Visitor", reviewerId: reviewer.id, reviewerName: reviewer.displayName, status: "open", decisionNote: null, createdAt: iso(Date.now()), decidedAt: null };
  ctx.db.reviews.unshift(r);
  rec.versions.find((v) => v.version === b.version)!.reviewState = "in_review";
  rec.summary.reviewState = "in_review";
  if (!rec.shares.some((s) => s.userId === reviewer.id)) rec.shares.push({ id: newId("shr"), artifactId: rec.summary.id, userId: reviewer.id, userName: reviewer.displayName, role: "reviewer", createdAt: iso(Date.now()) });
  return r;
});
on("POST", "/reviews/:id/decision", (ctx) => {
  requireAction(ctx, "review.decide");
  const r = ctx.db.reviews.find((x) => x.id === ctx.params.id) ?? notFound("Review");
  const b = body<{ version: number; decision: "approve" | "request_changes"; note?: string }>(ctx);
  const rec = getArt(ctx, r.artifactId);
  if (r.status !== "open") throw new FixtureError("CONFLICT", `This review is ${r.status.replace("_", " ")}.`);
  if (b.version !== r.version || r.version !== rec.summary.currentVersion) throw new FixtureError("CONFLICT", "The artifact changed after review was requested. Approval applies to an exact version.");
  if (r.reviewerId !== ctx.userId && ctx.role !== "admin") throw new FixtureError("FORBIDDEN", "Only the assigned reviewer can decide.");
  const v = rec.versions.find((x) => x.version === r.version)!;
  r.status = b.decision === "approve" ? "approved" : "changes_requested";
  r.decisionNote = b.note ?? null;
  r.decidedAt = iso(Date.now());
  v.reviewState = b.decision === "approve" ? "approved" : "changes_requested";
  if (b.decision === "approve") {
    v.approvedBy = ctx.userId;
    v.approvedAt = r.decidedAt;
  }
  rec.summary.reviewState = v.reviewState;
  return r;
});
on("GET", "/artifacts/:id/comments", (ctx) => {
  requireAction(ctx, "artifact.read");
  return ctx.db.comments.filter((c) => c.artifactId === ctx.params.id);
});
on("POST", "/artifacts/:id/comments", (ctx) => {
  const rec = getArt(ctx, ctx.params.id!);
  if (!canOnArtifact(roleOn(ctx, rec), "comment") && roleOn(ctx, rec) !== "owner") throw new FixtureError("FORBIDDEN", "Viewers cannot comment.");
  const b = body<{ version: number; body: string; anchor?: string | null }>(ctx);
  if (!b.body?.trim()) throw new FixtureError("VALIDATION", "Comment is empty.");
  const c = { id: newId("cmt"), artifactId: rec.summary.id, version: b.version, authorId: ctx.userId, authorName: "Demo Visitor", body: b.body.trim().slice(0, 2000), anchor: b.anchor ?? null, resolved: false, createdAt: iso(Date.now()) };
  ctx.db.comments.push(c);
  return c;
});
