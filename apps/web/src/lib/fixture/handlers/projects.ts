/** FIXTURE (P02 preview only): projects, memory and recommendations. */
import type { MemoryItem, Project } from "@atlas/contracts";
import { buildSuggestions } from "@atlas/domain";
import { iso, newId, type Db } from "../db";
import { body, FixtureError, notFound, on, requireAction, type Ctx } from "../router";

export function withCounts(db: Db, p: Project): Project {
  return {
    ...p,
    documentCount: db.documents.filter((d) => !d.deleted && d.summary.projectIds.includes(p.id)).length,
    conversationCount: db.conversations.filter((c) => c.summary.projectId === p.id).length,
    artifactCount: db.artifacts.filter((a) => a.summary.projectId === p.id).length,
  };
}

const getProject = (ctx: Ctx, id: string) => ctx.db.projects.find((p) => p.id === id) ?? notFound("Project");

on("GET", "/projects", (ctx) => {
  requireAction(ctx, "project.read");
  return ctx.db.projects.map((p) => withCounts(ctx.db, p)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
});
on("GET", "/projects/:id", (ctx) => {
  requireAction(ctx, "project.read");
  return withCounts(ctx.db, getProject(ctx, ctx.params.id!));
});
on("POST", "/projects", (ctx) => {
  requireAction(ctx, "project.write");
  const b = body<{ name: string; objective: string; defaultAgentId: string | null }>(ctx);
  if (!b.name?.trim()) throw new FixtureError("VALIDATION", "Project name is required.", { field: "name" });
  const now = iso(Date.now());
  const p: Project = { id: newId("prj"), name: b.name.trim().slice(0, 80), objective: (b.objective ?? "").slice(0, 400), defaultAgentId: b.defaultAgentId, color: "teal", documentCount: 0, conversationCount: 0, artifactCount: 0, memoryEnabled: false, label: "DEMO", createdAt: now, updatedAt: now };
  ctx.db.projects.unshift(p);
  return p;
});
on("PATCH", "/projects/:id", (ctx) => {
  requireAction(ctx, "project.write");
  const p = getProject(ctx, ctx.params.id!);
  Object.assign(p, body<Partial<Project>>(ctx), { id: p.id, updatedAt: iso(Date.now()) });
  return withCounts(ctx.db, p);
});

/** Memory is scoped: project items only for that project; user preferences only for their owner. */
on("GET", "/memories", (ctx) => {
  requireAction(ctx, "project.read");
  const { projectId, scope } = ctx.query;
  return ctx.db.memories.filter((m) => (scope === "user_preference" ? m.scope === "user_preference" && m.ownerUserId === ctx.userId : m.scope === "project_context" && m.projectId === projectId));
});
on("POST", "/memories", (ctx) => {
  requireAction(ctx, "memory.write");
  const b = body<{ scope: MemoryItem["scope"]; projectId: string | null; content: string }>(ctx);
  if (!b.content?.trim()) throw new FixtureError("VALIDATION", "Memory text is required.", { field: "content" });
  if (b.scope === "project_context") getProject(ctx, b.projectId ?? "");
  const now = iso(Date.now());
  const m: MemoryItem = { id: newId("mem"), scope: b.scope, projectId: b.scope === "project_context" ? b.projectId : null, ownerUserId: ctx.userId, content: b.content.trim().slice(0, 500), status: "approved", source: "user_entered", sourceRunId: null, createdAt: now, updatedAt: now };
  ctx.db.memories.unshift(m);
  return m;
});
on("PATCH", "/memories/:id", (ctx) => {
  requireAction(ctx, "memory.write");
  const m = ctx.db.memories.find((x) => x.id === ctx.params.id) ?? notFound("Memory item");
  if (m.scope === "user_preference" && m.ownerUserId !== ctx.userId) throw new FixtureError("FORBIDDEN", "Only the owner can change a personal preference.");
  const b = body<{ content?: string; status?: "approved" | "disabled" }>(ctx);
  if (b.content !== undefined) m.content = b.content.trim().slice(0, 500);
  if (b.status) m.status = b.status;
  m.updatedAt = iso(Date.now());
  return m;
});
on("DELETE", "/memories/:id", (ctx) => {
  requireAction(ctx, "memory.write");
  const i = ctx.db.memories.findIndex((x) => x.id === ctx.params.id);
  if (i < 0) notFound("Memory item");
  ctx.db.memories.splice(i, 1);
  return undefined;
});

on("GET", "/recommendations", (ctx) => {
  requireAction(ctx, "project.read");
  const { projectId, conversationId, agentId } = ctx.query;
  const project = projectId ? ctx.db.projects.find((p) => p.id === projectId) ?? null : null;
  const agentRec = ctx.db.agents.find((a) => a.summary.id === (agentId || project?.defaultAgentId) && !a.deleted);
  const conv = conversationId ? ctx.db.conversations.find((c) => c.summary.id === conversationId) : undefined;
  const msgs = conv?.messages.filter((m) => m.branchId === conv.activeBranchId) ?? [];
  const lastUser = [...msgs].reverse().find((m) => m.role === "user");
  const lastAssistant = [...msgs].reverse().find((m) => m.role === "assistant");
  const docs = project ? ctx.db.documents.filter((d) => !d.deleted && d.summary.projectIds.includes(project.id)) : [];
  const suggestions = buildSuggestions({
    project: project ? { id: project.id, name: project.name, objective: project.objective } : null,
    agent: agentRec ? { id: agentRec.summary.id, name: agentRec.summary.name, profile: agentRec.summary.profile } : null,
    documents: docs.map((d) => ({ id: d.summary.id, title: d.summary.title, kind: d.summary.kind, sensitiveFindingCount: d.summary.sensitiveFindingCount })),
    lastUserMessage: lastUser && conv ? { conversationId: conv.summary.id, text: lastUser.content } : null,
    lastAnswerAbstained: Boolean(lastAssistant?.abstained),
    hasArtifacts: project ? ctx.db.artifacts.some((a) => a.summary.projectId === project.id) : false,
  });
  // Stable ids per context so dismissals persist for the session.
  return suggestions
    .map((s) => ({ ...s, id: `sug_${s.kind}_${s.title.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 40)}_${projectId ?? "home"}` }))
    .filter((s) => !ctx.db.dismissedSuggestions.includes(s.id));
});
on("POST", "/recommendations/:id/dismiss", (ctx) => {
  ctx.db.dismissedSuggestions.push(ctx.params.id!);
  return undefined;
});
