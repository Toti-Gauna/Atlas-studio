import type { Suggestion } from "@atlas/contracts";

/**
 * Deterministic recommendation rules. Each suggestion records why it exists
 * and which data it used. No context → no suggestion (never invented).
 * Accepting a suggestion only prepares the composer/plan; it runs nothing.
 */
export interface SuggestionContext {
  project: { id: string; name: string; objective: string } | null;
  agent: { id: string; name: string; profile: string } | null;
  documents: Array<{ id: string; title: string; kind: string; sensitiveFindingCount: number }>;
  lastUserMessage: { conversationId: string; text: string } | null;
  lastAnswerAbstained: boolean;
  hasArtifacts: boolean;
}

let seq = 0;
const sid = (k: string) => `sug_${k}_${(++seq).toString(36)}`;

export function buildSuggestions(ctx: SuggestionContext): Suggestion[] {
  const out: Suggestion[] = [];
  const agentRef = ctx.agent ? [{ type: "agent" as const, id: ctx.agent.id, label: ctx.agent.name }] : [];
  const objectiveRef = ctx.project?.objective ? [{ type: "objective" as const, id: ctx.project.id, label: ctx.project.objective }] : [];
  const csv = ctx.documents.find((d) => d.kind === "csv");
  const policies = ctx.documents.filter((d) => /policy|checklist/i.test(d.title));
  const sensitive = ctx.documents.filter((d) => d.sensitiveFindingCount > 0);

  if (ctx.lastAnswerAbstained && ctx.lastUserMessage) {
    out.push({
      id: sid("handoff"),
      kind: "next_step",
      title: "Ask a person to answer this",
      prompt: `Hand off: ${ctx.lastUserMessage.text}`,
      reason: "The last answer abstained because no authorized document supported it.",
      basedOn: [{ type: "conversation", id: ctx.lastUserMessage.conversationId, label: "Last question (abstained)" }],
      agentId: ctx.agent?.id ?? null,
      workMode: "answer",
      generatedBy: "rules",
      dismissed: false,
    });
  }
  if (ctx.agent?.profile === "compliance" && policies.length) {
    const checklist = policies.find((p) => /checklist/i.test(p.title));
    const policy = policies.find((p) => !/checklist/i.test(p.title));
    if (checklist && policy) {
      out.push({
        id: sid("gap"),
        kind: "deliverable",
        title: `Gap report: ${policy.title}`,
        prompt: `Review "${policy.title}" against "${checklist.title}". Scope: all teams. Jurisdiction: as stated in the policy. Produce a gap report with cited evidence.`,
        reason: "A policy and a checklist are both in this project and the Compliance Advisor is selected.",
        basedOn: [...agentRef, { type: "document", id: policy.id, label: policy.title }, { type: "document", id: checklist.id, label: checklist.title }],
        agentId: ctx.agent.id,
        workMode: "draft_artifact",
        generatedBy: "rules",
        dismissed: false,
      });
    }
  }
  if (csv) {
    out.push({
      id: sid("csv"),
      kind: ctx.agent?.profile === "data" ? "deliverable" : "next_step",
      title: `Profile ${csv.title}`,
      prompt: `Validate ${csv.title}, compute descriptive statistics and summarize the largest groups.`,
      reason: "A CSV is attached to this project; statistics are computed by deterministic tools.",
      basedOn: [{ type: "document", id: csv.id, label: csv.title }, ...agentRef],
      agentId: ctx.agent?.profile === "data" ? ctx.agent.id : null,
      workMode: "plan_then_run",
      generatedBy: "rules",
      dismissed: false,
    });
  }
  if (ctx.agent?.profile === "presentation" && ctx.project) {
    out.push({
      id: sid("deck"),
      kind: "deliverable",
      title: "Draft a 6-slide update",
      prompt: `Audience: leadership. Goal: ${ctx.project.objective || "summarize progress"}. Slides: 6. Use project sources.`,
      reason: "Presentation Creator is selected and the project has an objective to build the brief from.",
      basedOn: [...objectiveRef, ...agentRef],
      agentId: ctx.agent.id,
      workMode: "draft_artifact",
      generatedBy: "rules",
      dismissed: false,
    });
  }
  if (sensitive.length) {
    out.push({
      id: sid("privacy"),
      kind: "next_step",
      title: `Review ${sensitive.length} document${sensitive.length > 1 ? "s" : ""} with sensitive patterns`,
      prompt: "Open the Privacy Center review queue.",
      reason: "Rule-based detection flagged patterns that need review before any external provider call.",
      basedOn: sensitive.map((d) => ({ type: "document" as const, id: d.id, label: d.title })),
      agentId: null,
      workMode: "answer",
      generatedBy: "rules",
      dismissed: false,
    });
  }
  if (ctx.lastUserMessage && !ctx.lastAnswerAbstained && !ctx.hasArtifacts) {
    out.push({
      id: sid("artifact"),
      kind: "deliverable",
      title: "Turn this answer into a report",
      prompt: `Create a short report from the cited answer to: ${ctx.lastUserMessage.text}`,
      reason: "The last answer had citations and this project has no artifact yet.",
      basedOn: [{ type: "conversation", id: ctx.lastUserMessage.conversationId, label: "Last cited answer" }],
      agentId: ctx.agent?.id ?? null,
      workMode: "draft_artifact",
      generatedBy: "rules",
      dismissed: false,
    });
  }
  if (ctx.project && ctx.documents.length && !ctx.lastUserMessage) {
    const doc = ctx.documents.find((d) => d.kind !== "csv" && d.kind !== "image");
    if (doc) {
      out.push({
        id: sid("ask"),
        kind: "question",
        title: `What does ${doc.title} require?`,
        prompt: `Summarize the main requirements in ${doc.title} with citations.`,
        reason: "Project has documents but no conversation yet.",
        basedOn: [{ type: "document", id: doc.id, label: doc.title }, ...objectiveRef],
        agentId: ctx.agent?.id ?? null,
        workMode: "answer",
        generatedBy: "rules",
        dismissed: false,
      });
    }
  }
  return out.slice(0, 4);
}

/** Rough token estimate for display only — labeled as an estimate in the UI. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
