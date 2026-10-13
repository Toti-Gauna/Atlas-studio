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
/** "Data Retention Policy" → "the Data Retention Policy"; file names and titles that already start with an article stay as they are. */
export function withArticle(title: string): string {
  if (/^(the|a|an|our|your)\s/i.test(title) || /\.[a-z0-9]{2,5}$/i.test(title)) return title;
  return `the ${title}`;
}

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
      reason: "Your documents didn’t support an answer to the last question, so a colleague can pick it up.",
      basedOn: [{ type: "conversation", id: ctx.lastUserMessage.conversationId, label: "your last question" }],
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
        reason: "This project has both a policy and a checklist, so you can see where they don’t match.",
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
      title: `Summarize ${csv.title}`,
      prompt: `Validate ${csv.title}, compute descriptive statistics and summarize the largest groups.`,
      reason: "This project has a spreadsheet: totals and averages are calculated exactly from the file.",
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
      reason: "The project objective is enough to outline an update for leadership.",
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
      title: `Review ${sensitive.length} document${sensitive.length > 1 ? "s" : ""} with sensitive data`,
      prompt: "Open the Privacy Center review queue.",
      reason: "Some documents may contain personal or payment details. Decide what to hide before they’re sent to an outside AI model.",
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
      reason: "Your last answer is backed by sources and this project has no deliverable yet.",
      basedOn: [{ type: "conversation", id: ctx.lastUserMessage.conversationId, label: "your last answer" }],
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
        title: `What does ${withArticle(doc.title)} require?`,
        prompt: `Summarize the main requirements in ${doc.title} with citations.`,
        reason: "A good first question: this project has documents but no conversations yet.",
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
