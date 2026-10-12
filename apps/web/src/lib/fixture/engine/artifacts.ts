/** FIXTURE (P02 preview only): artifact versioning rules mirrored from the API contract. */
import type { ArtifactContent, ArtifactDetail, ArtifactShare, SourceRef } from "@atlas/contracts";
import { iso, newId, type ArtifactRecord, type Db } from "../db";

export function createArtifact(
  db: Db,
  opts: { projectId: string; title: string; content: ArtifactContent; sources: SourceRef[]; authorId: string; runId: string | null; changeNote?: string; idempotencyKey?: string },
): ArtifactRecord {
  if (opts.idempotencyKey) {
    const existing = db.artifacts.find((a) => a.versions[0]?.changeNote.includes(`[idem:${opts.idempotencyKey}]`));
    if (existing) return existing;
  }
  const author = db.users.find((u) => u.id === opts.authorId);
  const id = newId("art");
  const now = iso(Date.now());
  const rec: ArtifactRecord = {
    summary: {
      id,
      projectId: opts.projectId,
      type: opts.content.type,
      title: opts.title,
      currentVersion: 1,
      reviewState: "draft",
      ownerId: opts.authorId,
      ownerName: author?.displayName ?? "Unknown",
      sourceCount: opts.sources.length,
      label: "DEMO",
      updatedAt: now,
    },
    versions: [
      {
        id: newId("arv"),
        artifactId: id,
        version: 1,
        content: opts.content,
        sources: opts.sources,
        authorId: opts.authorId,
        authorName: author?.displayName ?? "Unknown",
        createdByRunId: opts.runId,
        reviewState: "draft",
        approvedBy: null,
        approvedAt: null,
        changeNote: `${opts.changeNote ?? "Created"}${opts.idempotencyKey ? ` [idem:${opts.idempotencyKey}]` : ""}`,
        createdAt: now,
      },
    ],
    shares: [],
  };
  db.artifacts.unshift(rec);
  return rec;
}

/** Saving always creates a new version; approval stays bound to the old one. */
export function saveVersion(db: Db, rec: ArtifactRecord, opts: { content: ArtifactContent; sources: SourceRef[]; authorId: string; changeNote: string }) {
  const author = db.users.find((u) => u.id === opts.authorId);
  const version = rec.summary.currentVersion + 1;
  const now = iso(Date.now());
  rec.versions.push({
    id: newId("arv"),
    artifactId: rec.summary.id,
    version,
    content: opts.content,
    sources: opts.sources,
    authorId: opts.authorId,
    authorName: author?.displayName ?? "Unknown",
    createdByRunId: null,
    reviewState: "draft",
    approvedBy: null,
    approvedAt: null,
    changeNote: opts.changeNote || "Edited",
    createdAt: now,
  });
  rec.summary.currentVersion = version;
  rec.summary.reviewState = "draft";
  rec.summary.title = opts.content.title;
  rec.summary.sourceCount = opts.sources.length;
  rec.summary.updatedAt = now;
  // Open review requests on older versions are superseded.
  for (const r of db.reviews) if (r.artifactId === rec.summary.id && r.status === "open") r.status = "superseded";
}

export function myRoleOn(rec: ArtifactRecord, userId: string, workspaceRole: string): ArtifactDetail["myRole"] {
  if (rec.summary.ownerId === userId) return "owner";
  const share = rec.shares.find((s: ArtifactShare) => s.userId === userId);
  if (share) return share.role;
  if (workspaceRole === "admin") return "owner";
  if (workspaceRole === "editor") return "editor";
  if (workspaceRole === "reviewer") return "reviewer";
  return "viewer";
}

export function toDetail(rec: ArtifactRecord, userId: string, workspaceRole: string): ArtifactDetail {
  const current = rec.versions.find((v) => v.version === rec.summary.currentVersion)!;
  return {
    ...rec.summary,
    myRole: myRoleOn(rec, userId, workspaceRole),
    versions: rec.versions.map(({ content: _c, sources: _s, ...v }) => v),
    current,
    shares: rec.shares,
  };
}
