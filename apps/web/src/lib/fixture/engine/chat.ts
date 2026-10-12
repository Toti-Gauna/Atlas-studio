/** FIXTURE (P02 preview only): local chat orchestration mirroring the planned API run pipeline. */
import type { Citation, Message, SourceRef, WorkMode } from "@atlas/contracts";
import { CHECKLIST_ITEMS } from "@atlas/demo-seed";
import {
  aggregate,
  assertToolAllowed,
  compareChecklist,
  dataReport,
  extractiveAnswer,
  findModel,
  gapReport,
  presentationFromBrief,
  profileCsv,
  type ExtractiveAnswer,
} from "@atlas/domain";
import { iso, newId, type ConvRecord, type Db } from "../db";
import { authorizedChunks, currentAgentVersion, routeFor, taskForProfile } from "../scope";
import { createArtifact } from "./artifacts";
import { startRun, summarize } from "./runs";
import type { SendMessageResult } from "../../api/client";

export interface ChatInput {
  conv: ConvRecord;
  branchId: string;
  content: string;
  agentId: string;
  pinnedModelKey: string | null;
  workMode: WorkMode;
  attachmentDocumentIds: string[];
  userId: string;
  approvedFallbackKey?: string | null;
  parentMessageId?: string | null;
}

function citationsFrom(answer: ExtractiveAnswer): Citation[] {
  return answer.citations.map((c) => ({
    id: newId("cit"),
    documentId: c.chunk.documentId,
    versionId: c.chunk.versionId,
    version: c.chunk.version,
    documentTitle: c.chunk.documentTitle,
    chunkId: c.chunk.id,
    page: c.chunk.page,
    quote: c.quote,
    quoteStart: c.quoteStart,
    quoteEnd: c.quoteEnd,
    score: Math.round(c.score * 100) / 100,
  }));
}

const sourceRefsFrom = (cits: Citation[]): SourceRef[] =>
  cits.map((c, i) => ({ ref: `S${i + 1}`, documentId: c.documentId, versionId: c.versionId, version: c.version, documentTitle: c.documentTitle, page: c.page, quote: c.quote.slice(0, 600) }));

export function executeChat(db: Db, input: ChatInput): SendMessageResult {
  const { conv } = input;
  const agent = db.agents.find((a) => a.summary.id === input.agentId && !a.deleted);
  const version = currentAgentVersion(db, input.agentId);
  if (!agent || !version) throw Object.assign(new Error("Agent not found"), { code: "NOT_FOUND" });
  const cfg = version.config;
  const projectId = conv.summary.projectId;
  const routing = routeFor(db, taskForProfile(agent.summary.profile), input.pinnedModelKey, cfg.modelKey, ["text"], input.approvedFallbackKey);

  const branchMessages = conv.messages.filter((m) => m.branchId === input.branchId);
  const parentId = input.parentMessageId !== undefined ? input.parentMessageId : (branchMessages[branchMessages.length - 1]?.id ?? null);

  if (routing.blocked) {
    // Nothing is persisted: the draft stays in the composer until the user approves or changes model.
    const builder = startRun(db, { projectId, conversationId: conv.summary.id, agentName: agent.summary.name, agentVersion: version, routing, objective: input.content, userId: input.userId });
    builder.step("plan", "Route request", "failed", routing.blocked.message);
    builder.finish("blocked");
    return {
      conversation: null as never,
      userMessage: null as never,
      assistantMessage: null,
      run: summarize(builder.run),
      blocked: { code: routing.blocked.code, message: routing.blocked.message, pendingFallback: routing.pendingFallback ?? undefined },
    };
  }

  const now = iso(Date.now());
  const userMessage: Message = {
    id: newId("msg"),
    conversationId: conv.summary.id,
    branchId: input.branchId,
    parentMessageId: parentId,
    role: "user",
    content: input.content,
    status: "complete",
    runId: null,
    agentId: input.agentId,
    modelKey: null,
    mode: null,
    citations: [],
    retrieval: null,
    abstained: false,
    artifactIds: [],
    toolProposalId: null,
    createdAt: now,
  };
  conv.messages.push(userMessage);

  const builder = startRun(db, { projectId, conversationId: conv.summary.id, agentName: agent.summary.name, agentVersion: version, routing, objective: input.content, userId: input.userId });
  const run = builder.run;
  const model = findModel(routing.modelKey);
  builder.step("plan", "Plan", "succeeded", `${agent.summary.name} v${version.version} · ${input.workMode.replace(/_/g, " ")} · ${cfg.allowedTools.length} allowed tools`);
  builder.step("privacy_check", "Privacy check", "succeeded", model?.provider === "local" ? "Local mode: data stays inside Atlas; no external transfer." : "Classification allows external transfer.");
  builder.step("budget_reservation", "Budget reservation", "succeeded", model?.provider === "local" ? "Local adapter: no provider charge; reservation of $0 recorded." : "Reserved worst-case cost before the call.");

  const chunks = authorizedChunks(db, projectId, cfg);
  let content = "";
  let citations: Citation[] = [];
  let abstained = false;
  let retrieval: Message["retrieval"] = null;
  const artifactIds: string[] = [];
  const profile = agent.summary.profile;
  const csvDoc = db.documents.find((d) => !d.deleted && d.csvText && d.summary.projectIds.includes(projectId) && (input.attachmentDocumentIds.length === 0 || input.attachmentDocumentIds.includes(d.summary.id)));

  if (profile === "data" && csvDoc?.csvText) {
    const gate = assertToolAllowed(cfg.allowedTools, "csv_profile");
    if (!gate.ok) {
      builder.step("tool_call", "csv_profile", "denied", gate.reason, null);
    } else {
      const prof = profileCsv(csvDoc.csvText);
      builder.step("tool_call", "Profile CSV", "succeeded", `${prof.rowCount} rows × ${prof.columnCount} columns · ${prof.issues.length} issue(s) · valid: ${prof.valid}`, "csv_profile");
      const groupMatch = /\bby\s+([a-z_]+)/i.exec(input.content);
      const groupCol = groupMatch && prof.columns.some((c) => c.name === groupMatch[1]) ? groupMatch[1]! : "region";
      const measure = prof.columns.find((c) => input.content.toLowerCase().includes(c.name) && (c.kind === "integer" || c.kind === "number"))?.name ?? "shipments";
      const agg = aggregate(csvDoc.csvText, groupCol, measure, "sum");
      builder.step("tool_call", "Group & aggregate", "succeeded", `sum(${measure}) by ${groupCol}: ${agg.length} groups`, "csv_aggregate");
      const numeric = prof.columns.filter((c) => c.numeric);
      content =
        `Computed from ${csvDoc.summary.title} with deterministic tools (local mode):\n\n` +
        numeric.slice(0, 4).map((c) => `• ${c.name}: mean ${c.numeric!.mean.toFixed(2)}, median ${c.numeric!.median.toFixed(2)}, min ${c.numeric!.min}, max ${c.numeric!.max}${c.missing ? ` (${c.missing} missing)` : ""}`).join("\n") +
        `\n\nTop ${groupCol} by ${measure}: ` + agg.slice(0, 3).map((a) => `${a.group} ${Math.round(a.value).toLocaleString("en-US")}`).join(" · ") +
        (prof.issues.length ? `\n\nValidation: ${prof.issues.map((i) => i.message).slice(0, 2).join(" ")}` : "");
      if (input.workMode === "draft_artifact") {
        const allowed = assertToolAllowed(cfg.allowedTools, "draft_artifact");
        if (allowed.ok) {
          const rep = dataReport(csvDoc.summary.title, csvDoc.csvText, groupCol, measure);
          const art = createArtifact(db, { projectId, title: rep.content.title, content: rep.content, sources: [], authorId: input.userId, runId: run.id });
          artifactIds.push(art.summary.id);
          builder.step("artifact_write", "Draft data report", "succeeded", `Created “${art.summary.title}” v1`, "draft_artifact");
        }
      }
    }
  } else if (profile === "compliance" && (input.workMode === "draft_artifact" || /checklist|gap/i.test(input.content))) {
    const policyChunks = chunks.filter((c) => !/checklist/i.test(c.documentTitle));
    builder.step("retrieval", "Retrieve policy passages", "succeeded", `${policyChunks.length} authorized passages from ${new Set(policyChunks.map((c) => c.documentId)).size} documents`, "retrieve_sources");
    const findings = compareChecklist(CHECKLIST_ITEMS, policyChunks);
    const covered = findings.filter((f) => f.status === "covered").length;
    const gaps = findings.filter((f) => f.status === "gap");
    builder.step("tool_call", "Compare with checklist", "succeeded", `${covered} covered · ${findings.length - covered - gaps.length} partial · ${gaps.length} gaps`, "checklist_compare");
    const report = gapReport("Vendor checklist gap report", "All production systems", "As stated in the project memory", findings);
    content =
      `Checklist comparison (local mode, lexical matching): ${covered} of ${findings.length} items covered, ${gaps.length} gaps.\n\nGaps without supporting evidence:\n` +
      gaps.map((g) => `• ${g.item}`).join("\n") +
      "\n\nThis is a checklist comparison, not a legal opinion or certification.";
    citations = report.sources.slice(0, 4).map((s) => ({
      id: newId("cit"),
      documentId: s.documentId,
      versionId: s.versionId,
      version: s.version,
      documentTitle: s.documentTitle,
      chunkId: policyChunks.find((c) => c.versionId === s.versionId && c.text.includes(s.quote))?.id ?? "chk_unknown",
      page: s.page,
      quote: s.quote,
      quoteStart: Math.max(0, policyChunks.find((c) => c.text.includes(s.quote))?.text.indexOf(s.quote) ?? 0),
      quoteEnd: Math.max(0, (policyChunks.find((c) => c.text.includes(s.quote))?.text.indexOf(s.quote) ?? 0) + s.quote.length),
      score: 1,
    }));
    const allowed = assertToolAllowed(cfg.allowedTools, "draft_artifact");
    if (input.workMode === "draft_artifact" && allowed.ok) {
      const art = createArtifact(db, { projectId, title: "Vendor checklist gap report", content: report.content, sources: report.sources, authorId: input.userId, runId: run.id });
      artifactIds.push(art.summary.id);
      builder.step("artifact_write", "Draft gap report", "succeeded", `Created “${art.summary.title}” v1 with ${report.sources.length} sources`, "draft_artifact");
    }
  } else {
    const answer = extractiveAnswer(input.content, chunks);
    retrieval = {
      query: input.content,
      candidates: answer.candidates,
      threshold: answer.threshold,
      topScore: answer.topScore === null ? null : Math.round(answer.topScore * 100) / 100,
      decision: answer.decision,
      filteredBy: ["workspace", `project:${projectId}`, "published versions", cfg.sourceScope.mode === "selected_documents" ? "agent source scope" : "project documents"],
    };
    builder.step(
      "retrieval",
      "Retrieve sources",
      "succeeded",
      `${chunks.length} authorized passages searched · coverage ${retrieval.topScore ?? 0} vs threshold ${answer.threshold}${answer.excludedInjections ? ` · ${answer.excludedInjections} instruction-like sentence(s) ignored` : ""}`,
      "retrieve_sources",
    );
    if (answer.decision === "abstained") {
      abstained = true;
      content = `I can't answer this from the authorized documents. ${answer.abstentionReason ?? ""} You can hand this question to a person — the conversation context is kept.`;
    } else {
      citations = citationsFrom(answer);
      content = answer.answer;
      if (input.workMode === "draft_artifact") {
        const allowed = assertToolAllowed(cfg.allowedTools, "draft_artifact");
        if (!allowed.ok) {
          builder.step("tool_call", "draft_artifact", "denied", allowed.reason);
        } else if (profile === "presentation") {
          const facts = answer.citations.map((c, i) => ({ text: c.quote, ref: `S${i + 1}` }));
          const more = chunks.slice(0, 6).map((c, i) => ({ text: c.text.split(/(?<=\.)\s/)[0] ?? c.text, ref: `S${facts.length + i + 1}` }));
          const deck = presentationFromBrief({ audience: "Leadership team", goal: input.content, slideCount: 6 }, [...facts, ...more]);
          const sources = [...sourceRefsFrom(citations), ...chunks.slice(0, 6).map((c, i) => ({ ref: `S${facts.length + i + 1}`, documentId: c.documentId, versionId: c.versionId, version: c.version, documentTitle: c.documentTitle, page: c.page, quote: (c.text.split(/(?<=\.)\s/)[0] ?? c.text).slice(0, 600) }))];
          const art = createArtifact(db, { projectId, title: deck.title, content: deck, sources, authorId: input.userId, runId: run.id });
          artifactIds.push(art.summary.id);
          builder.step("artifact_write", "Create presentation", "succeeded", `Created “${art.summary.title}” with ${deck.type === "presentation" ? deck.slides.length : 0} slides`, "draft_artifact");
        } else {
          const art = createArtifact(db, {
            projectId,
            title: `Notes: ${input.content.slice(0, 60)}`,
            content: { type: "report", title: `Notes: ${input.content.slice(0, 80)}`, blocks: [{ type: "heading", level: 1, text: input.content.slice(0, 180) }, ...citations.map((c, i) => ({ type: "paragraph" as const, text: `“${c.quote}”`, sourceRefs: [`S${i + 1}`] }))] },
            sources: sourceRefsFrom(citations),
            authorId: input.userId,
            runId: run.id,
          });
          artifactIds.push(art.summary.id);
          builder.step("artifact_write", "Draft report", "succeeded", `Created “${art.summary.title}” v1`, "draft_artifact");
        }
      }
    }
  }

  builder.step("review", "Result", "succeeded", abstained ? "Abstained: no supporting evidence. Handoff available." : `${citations.length} citation(s)${artifactIds.length ? ` · ${artifactIds.length} artifact(s)` : ""}`);
  builder.finish(abstained ? "abstained" : "succeeded");

  const assistant: Message = {
    id: newId("msg"),
    conversationId: conv.summary.id,
    branchId: input.branchId,
    parentMessageId: userMessage.id,
    role: "assistant",
    content,
    status: "complete",
    runId: run.id,
    agentId: input.agentId,
    modelKey: routing.modelKey,
    mode: model?.provider === "local" ? "local" : "connected",
    citations,
    retrieval,
    abstained,
    artifactIds,
    toolProposalId: null,
    createdAt: iso(Date.now()),
  };
  conv.messages.push(assistant);
  conv.summary.lastMessagePreview = content.slice(0, 140);
  conv.summary.messageCount = conv.messages.length;
  conv.summary.updatedAt = assistant.createdAt;
  return { conversation: null as never, userMessage, assistantMessage: assistant, run: summarize(run), blocked: null };
}
