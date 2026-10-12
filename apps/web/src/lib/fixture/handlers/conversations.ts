/** FIXTURE (P02 preview only): conversations, branches, comparisons, handoff, tool approval and runs. */
import type { Branch, Comparison, ComparisonRun, ConversationDetail, SendMessageRequest, Ticket, ToolProposal } from "@atlas/contracts";
import { iso, newId, type ConvRecord, type Db } from "../db";
import { body, FixtureError, notFound, on, requireAction, type Ctx } from "../router";
import { newConversation } from "../build-activity";
import { executeChat } from "../engine/chat";
import { summarize } from "../engine/runs";

function visible(ctx: Ctx, c: ConvRecord): boolean {
  if (ctx.role === "customer") return c.customerId === ctx.userId;
  return true;
}

const getConv = (ctx: Ctx, id: string): ConvRecord => {
  const c = ctx.db.conversations.find((x) => x.summary.id === id);
  if (!c || !visible(ctx, c)) notFound("Conversation");
  return c;
};

export function convDetail(db: Db, c: ConvRecord, branchId?: string): ConversationDetail {
  const active = branchId && c.branches.some((b) => b.id === branchId) ? branchId : c.activeBranchId;
  return { ...c.summary, activeBranchId: active, branches: c.branches, messages: c.messages.filter((m) => m.branchId === active) };
}

on("GET", "/conversations", (ctx) => {
  requireAction(ctx, "conversation.use");
  const pid = ctx.query.projectId;
  return ctx.db.conversations.filter((c) => visible(ctx, c) && (!pid || c.summary.projectId === pid)).map((c) => c.summary).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
});
on("GET", "/conversations/:id", (ctx) => convDetail(ctx.db, getConv(ctx, ctx.params.id!), ctx.query.branchId));
on("POST", "/conversations", (ctx) => {
  requireAction(ctx, "conversation.use");
  const b = body<{ projectId: string; agentId: string; title?: string }>(ctx);
  if (!ctx.db.projects.some((p) => p.id === b.projectId)) notFound("Project");
  if (!ctx.db.agents.some((a) => a.summary.id === b.agentId && !a.deleted)) notFound("Agent");
  const c = newConversation(ctx.db, b.projectId, b.agentId, b.title?.trim() || "New conversation", ctx.role === "customer" ? ctx.userId : null);
  return convDetail(ctx.db, c);
});

on("POST", "/conversations/:id/messages", (ctx) => {
  requireAction(ctx, "conversation.use");
  const c = getConv(ctx, ctx.params.id!);
  const b = body<SendMessageRequest>(ctx);
  if (!b.content?.trim()) throw new FixtureError("VALIDATION", "Message is empty.", { field: "content" });
  if (b.content.length > 8000) throw new FixtureError("VALIDATION", "Message exceeds 8,000 characters.", { field: "content" });
  if (!c.branches.some((br) => br.id === b.branchId)) notFound("Branch");
  // Idempotency: a retried/reconnected send returns the original result without a second run.
  const prior = c.sent[b.clientMessageId];
  if (prior) {
    const assistant = c.messages.find((m) => m.id === prior) ?? null;
    const user = assistant ? c.messages.find((m) => m.id === assistant.parentMessageId)! : null;
    return { conversation: convDetail(ctx.db, c, b.branchId), userMessage: user, assistantMessage: assistant, run: assistant?.runId ? summarize(ctx.db.runs.find((r) => r.id === assistant.runId)!) : null, blocked: null };
  }
  if (c.summary.title === "New conversation") c.summary.title = b.content.trim().slice(0, 60);
  const result = executeChat(ctx.db, {
    conv: c,
    branchId: b.branchId,
    content: b.content.trim(),
    agentId: b.agentId,
    pinnedModelKey: b.pinnedModelKey,
    workMode: b.workMode,
    attachmentDocumentIds: b.attachmentDocumentIds ?? [],
    userId: ctx.userId,
    approvedFallbackKey: b.approvals?.fallbackModelKey ?? null,
  });
  if (result.assistantMessage) c.sent[b.clientMessageId] = result.assistantMessage.id;
  c.activeBranchId = b.branchId;
  const project = ctx.db.projects.find((p) => p.id === c.summary.projectId);
  if (project) project.updatedAt = iso(Date.now());
  return { ...result, conversation: convDetail(ctx.db, c, b.branchId) };
});

on("POST", "/conversations/:id/handoff", (ctx) => {
  requireAction(ctx, "conversation.use");
  const c = getConv(ctx, ctx.params.id!);
  const existing = ctx.db.tickets.find((t) => t.conversationId === c.summary.id && (t.status === "open" || t.status === "pending_customer"));
  if (existing) return existing; // idempotent: one open ticket per conversation
  const msgs = c.messages.filter((m) => m.branchId === c.activeBranchId);
  const lastUser = [...msgs].reverse().find((m) => m.role === "user");
  const abst = [...msgs].reverse().find((m) => m.abstained);
  const t: Ticket = {
    id: newId("tkt"),
    number: ++ctx.db.counters.ticket!,
    conversationId: c.summary.id,
    subject: c.summary.title,
    status: "open",
    priority: "normal",
    assigneeId: null,
    assigneeName: null,
    requesterName: ctx.db.users.find((u) => u.id === ctx.userId)?.displayName ?? "Visitor",
    handoffContext: { lastQuestion: lastUser?.content ?? "", abstentionReason: abst ? "No authorized document supported an answer." : null, citedDocuments: [...new Set(msgs.flatMap((m) => m.citations.map((x) => x.documentTitle)))] },
    replies: [],
    label: "DEMO",
    createdAt: iso(Date.now()),
    updatedAt: iso(Date.now()),
  };
  ctx.db.tickets.unshift(t);
  c.summary.hasOpenTicket = true;
  c.messages.push({ id: newId("msg"), conversationId: c.summary.id, branchId: c.activeBranchId, parentMessageId: msgs[msgs.length - 1]?.id ?? null, role: "system_notice", content: `Handed off to a person · ticket #${t.number}. Context preserved.`, status: "complete", runId: null, agentId: null, modelKey: null, mode: null, citations: [], retrieval: null, abstained: false, artifactIds: [], toolProposalId: null, createdAt: iso(Date.now()) });
  return t;
});

// Tool approval (núcleo): proposal → explicit confirmation → one service request.
on("POST", "/conversations/:id/tool-proposals", (ctx) => {
  requireAction(ctx, "conversation.use");
  const c = getConv(ctx, ctx.params.id!);
  const b = body<{ title: string; details: string; category: ToolProposal["payload"]["category"] }>(ctx);
  if (!b.title?.trim()) throw new FixtureError("VALIDATION", "Title is required.", { field: "title" });
  const p: ToolProposal = {
    id: newId("tpr"),
    conversationId: c.summary.id,
    tool: "propose_service_request",
    status: "pending",
    effectSummary: `Creates one ${b.category} service request “${b.title.trim().slice(0, 120)}”. Nothing is sent to anyone; you can cancel before confirming.`,
    payload: { category: b.category, title: b.title.trim().slice(0, 120), details: (b.details ?? "").slice(0, 2000) },
    proposedByRunId: null,
    expiresAt: iso(Date.now() + 10 * 60_000),
    confirmedBy: null,
    executionId: null,
    createdAt: iso(Date.now()),
  };
  ctx.db.toolProposals.unshift(p);
  return p;
});
on("POST", "/tool-proposals/:id/confirm", (ctx) => {
  requireAction(ctx, "conversation.use");
  const p = ctx.db.toolProposals.find((x) => x.id === ctx.params.id) ?? notFound("Proposal");
  getConv(ctx, p.conversationId);
  if (p.status === "executed") return { proposal: p, serviceRequest: ctx.db.serviceRequests.find((s) => s.id === p.executionId)! }; // one-shot
  if (p.status !== "pending") throw new FixtureError("CONFLICT", `Proposal is ${p.status}.`);
  if (Date.parse(p.expiresAt) < Date.now()) {
    p.status = "expired";
    throw new FixtureError("CONFIRMATION_EXPIRED", "This proposal expired. Create a new one to continue.");
  }
  const sr = { id: newId("srq"), number: ++ctx.db.counters.serviceRequest!, proposalId: p.id, category: p.payload.category, title: p.payload.title, details: p.payload.details, status: "received" as const, createdBy: ctx.userId, createdByName: ctx.db.users.find((u) => u.id === ctx.userId)?.displayName ?? "Visitor", label: "DEMO" as const, createdAt: iso(Date.now()) };
  ctx.db.serviceRequests.unshift(sr);
  p.status = "executed";
  p.confirmedBy = ctx.userId;
  p.executionId = sr.id;
  ctx.db.audit.unshift({ id: newId("aud"), actorId: ctx.userId, actorName: sr.createdByName, action: "tool.confirm", target: `Service request #${sr.number}`, requestId: newId("req"), createdAt: iso(Date.now()) });
  return { proposal: p, serviceRequest: sr };
});
on("GET", "/service-requests", (ctx) => (ctx.role === "customer" ? ctx.db.serviceRequests.filter((s) => s.createdBy === ctx.userId) : ctx.db.serviceRequests));

// Branches (R05)
on("POST", "/branches", (ctx) => {
  requireAction(ctx, "conversation.use");
  const b = body<{ fromMessageId: string; reason: "edit" | "regenerate"; editedContent?: string; agentId?: string; pinnedModelKey?: string | null }>(ctx);
  const c = ctx.db.conversations.find((x) => x.messages.some((m) => m.id === b.fromMessageId));
  if (!c || !visible(ctx, c)) notFound("Message");
  const from = c.messages.find((m) => m.id === b.fromMessageId)!;
  const userMsg = from.role === "user" ? from : c.messages.find((m) => m.id === from.parentMessageId)!;
  const parentBranch = c.branches.find((x) => x.id === userMsg.branchId)!;
  const content = b.reason === "edit" ? (b.editedContent ?? "").trim() : userMsg.content;
  if (!content) throw new FixtureError("VALIDATION", "Edited message is empty.");
  const agentId = b.agentId ?? userMsg.agentId ?? parentBranch.agentId;
  const agent = ctx.db.agents.find((a) => a.summary.id === agentId)!;
  const branch: Branch = {
    id: newId("brn"),
    conversationId: c.summary.id,
    parentBranchId: parentBranch.id,
    forkedFromMessageId: userMsg.id,
    reason: b.reason,
    agentId,
    agentVersion: agent.summary.currentVersion,
    modelKey: b.pinnedModelKey ?? agent.summary.modelKey,
    label: `${b.reason === "edit" ? "Edit" : "Regenerate"} ${c.branches.filter((x) => x.reason === b.reason).length + 1}`,
    createdAt: iso(Date.now()),
  };
  // Copy history before the fork point; the original branch stays untouched.
  const history = c.messages.filter((m) => m.branchId === parentBranch.id);
  const cut = history.findIndex((m) => m.id === userMsg.id);
  for (const m of history.slice(0, cut)) c.messages.push({ ...m, id: newId("msg"), branchId: branch.id });
  c.branches.push(branch);
  c.summary.branchCount = c.branches.length;
  const lastCopied = c.messages.filter((m) => m.branchId === branch.id).at(-1);
  const result = executeChat(ctx.db, { conv: c, branchId: branch.id, content, agentId, pinnedModelKey: b.pinnedModelKey ?? null, workMode: "answer", attachmentDocumentIds: [], userId: ctx.userId, parentMessageId: lastCopied?.id ?? null });
  if (result.blocked) {
    c.branches.pop();
    c.messages = c.messages.filter((m) => m.branchId !== branch.id);
    c.summary.branchCount = c.branches.length;
    throw new FixtureError("PROVIDER_DISCONNECTED", result.blocked.message, { pendingFallback: result.blocked.pendingFallback });
  }
  c.activeBranchId = branch.id;
  return convDetail(ctx.db, c, branch.id);
});

// Comparisons (R05): two independent runs, both reserved; no winner.
on("POST", "/comparisons", (ctx) => {
  requireAction(ctx, "artifact.write");
  const b = body<{ conversationId: string; prompt: string; modelKeys: [string, string]; agentId: string }>(ctx);
  const c = getConv(ctx, b.conversationId);
  if (b.modelKeys[0] === b.modelKeys[1]) throw new FixtureError("VALIDATION", "Choose two different models.");
  const runOne = (modelKey: string): ComparisonRun => {
    // Each side runs in a scratch branch so the conversation history is not altered.
    const scratch: ConvRecord = { ...c, summary: { ...c.summary }, messages: [], branches: [{ ...c.branches[0]!, id: newId("brn") }], sent: {} };
    const r = executeChat(ctx.db, { conv: scratch, branchId: scratch.branches[0]!.id, content: b.prompt, agentId: b.agentId, pinnedModelKey: modelKey, workMode: "answer", attachmentDocumentIds: [], userId: ctx.userId });
    const ledger = r.run ? ctx.db.ledger.find((e) => e.runId === r.run!.id) : undefined;
    if (ledger) ledger.requestType = "comparison";
    return {
      runId: r.run?.id ?? newId("run"),
      modelKey,
      status: r.run?.status ?? "blocked",
      answer: r.assistantMessage?.content ?? null,
      citations: r.assistantMessage?.citations ?? [],
      latencyMs: r.run?.latencyMs ?? null,
      inputTokens: null,
      outputTokens: null,
      costStatus: r.blocked ? "unknown" : "no_provider_charge",
      costNanoUsd: r.blocked ? null : "0",
      error: r.blocked?.message ?? null,
    };
  };
  const cmp: Comparison = { id: newId("cmp"), conversationId: c.summary.id, prompt: b.prompt, left: runOne(b.modelKeys[0]), right: runOne(b.modelKeys[1]), winner: null, createdAt: iso(Date.now()) };
  return cmp;
});

on("GET", "/runs", (ctx) => {
  requireAction(ctx, "project.read");
  const { projectId, agentId } = ctx.query;
  return ctx.db.runs.filter((r) => (!projectId || r.projectId === projectId) && (!agentId || r.agentId === agentId)).map(summarize);
});
on("GET", "/runs/:id", (ctx) => {
  requireAction(ctx, "project.read");
  return ctx.db.runs.find((r) => r.id === ctx.params.id) ?? notFound("Run");
});
on("POST", "/runs/:id/cancel", (ctx) => {
  const r = ctx.db.runs.find((x) => x.id === ctx.params.id) ?? notFound("Run");
  if (r.status === "running" || r.status === "planned") {
    r.status = "cancelled";
    r.finishedAt = iso(Date.now());
  }
  return summarize(r);
});
