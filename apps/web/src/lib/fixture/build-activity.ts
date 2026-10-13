/** FIXTURE (P02 preview only): seeds conversations, tickets, artifacts, workflows, privacy and evals. */
import type { Branch, Ticket, WorkflowCheckpoint } from "@atlas/contracts";
import { CHECKLIST_ITEMS, SEED_CONVERSATIONS, SEED_EVAL_CASES, SEED_SHOWCASE, SEED_WORKFLOWS } from "@atlas/demo-seed";
import { aggregate, compareChecklist, dataReport, gapReport, presentationFromBrief, redact, scanText, suggestClassification } from "@atlas/domain";
import { iso, newId, type ConvRecord, type Db } from "./db";
import { authorizedChunks } from "./scope";
import { executeChat } from "./engine/chat";
import { createArtifact, saveVersion } from "./engine/artifacts";
import { runEvaluation } from "./engine/evaluation";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export function newConversation(db: Db, projectId: string, agentId: string, title: string, customerId: string | null): ConvRecord {
  const id = newId("cnv");
  const agent = db.agents.find((a) => a.summary.id === agentId)!;
  const branch: Branch = { id: newId("brn"), conversationId: id, parentBranchId: null, forkedFromMessageId: null, reason: "root", agentId, agentVersion: agent.summary.currentVersion, modelKey: agent.summary.modelKey, label: "Main", createdAt: iso(Date.now()) };
  const rec: ConvRecord = {
    summary: { id, projectId, title, agentId, lastMessagePreview: "", messageCount: 0, branchCount: 1, hasOpenTicket: false, label: "DEMO", updatedAt: iso(Date.now()) },
    branches: [branch],
    messages: [],
    activeBranchId: branch.id,
    customerId,
    sent: {},
  };
  db.conversations.unshift(rec);
  return rec;
}

function backdate(conv: ConvRecord, db: Db, hoursAgo: number) {
  const t = Date.now() - hoursAgo * HOUR;
  conv.summary.updatedAt = iso(t);
  conv.branches.forEach((b) => (b.createdAt = iso(t - 60_000)));
  conv.messages.forEach((m, i) => (m.createdAt = iso(t - (conv.messages.length - i) * 45_000)));
  for (const r of db.runs.filter((x) => x.conversationId === conv.summary.id)) {
    r.startedAt = iso(t - 40_000);
    r.finishedAt = iso(t - 39_000);
    for (const l of db.ledger.filter((e) => e.runId === r.id)) l.occurredAt = r.finishedAt;
  }
}

export function seedActivity(db: Db, ids: { projectIds: Record<string, string>; agentIds: Record<string, string> }) {
  const { projectIds, agentIds } = ids;
  const defaultAgent = (pid: string) => db.projects.find((p) => p.id === pid)!.defaultAgentId!;

  // Conversations (answers computed by the local engine, not hard-coded).
  const abstainedCustomer: ConvRecord[] = [];
  SEED_CONVERSATIONS.forEach((c, i) => {
    const pid = projectIds[c.project]!;
    const agentId = c.project === "support" ? agentIds["research-editor"]! : defaultAgent(pid);
    const conv = newConversation(db, pid, agentId, c.title, c.customer ? "usr_dana" : null);
    for (const q of c.questions) {
      executeChat(db, { conv, branchId: conv.activeBranchId, content: q, agentId, pinnedModelKey: null, workMode: "answer", attachmentDocumentIds: [], userId: c.customer ? "usr_dana" : "usr_visitor" });
    }
    if (c.customer && conv.messages.some((m) => m.abstained)) abstainedCustomer.push(conv);
    backdate(conv, db, 6 + i * 9);
  });

  // A regenerate branch on the refund conversation (R05).
  const refundConv = db.conversations.find((c) => c.summary.title === "Refund timing")!;
  const firstUser = refundConv.messages.find((m) => m.role === "user")!;
  const regen: Branch = {
    id: newId("brn"),
    conversationId: refundConv.summary.id,
    parentBranchId: refundConv.activeBranchId,
    forkedFromMessageId: firstUser.id,
    reason: "edit",
    agentId: agentIds["research-editor"]!,
    agentVersion: 1,
    modelKey: "local:atlas-extractive-v1",
    label: "Edit 1",
    createdAt: iso(Date.now() - 5 * HOUR),
  };
  refundConv.branches.push(regen);
  executeChat(db, { conv: refundConv, branchId: regen.id, content: "How long do approved refunds take and what must the request include?", agentId: regen.agentId, pinnedModelKey: null, workMode: "answer", attachmentDocumentIds: [], userId: "usr_dana", parentMessageId: null });
  refundConv.summary.branchCount = refundConv.branches.length;

  // Tickets: abstentions handed off + escalations (5 total).
  const ticketFrom = (conv: ConvRecord, status: Ticket["status"], priority: Ticket["priority"], assignee: string | null, replies: Array<[string, "operator" | "customer", string]>, hoursAgo: number) => {
    const last = [...conv.messages].reverse().find((m) => m.role === "user");
    const abst = conv.messages.find((m) => m.abstained);
    const t: Ticket = {
      id: newId("tkt"),
      number: ++db.counters.ticket!,
      conversationId: conv.summary.id,
      subject: conv.summary.title,
      status,
      priority,
      assigneeId: assignee,
      assigneeName: assignee ? (db.users.find((u) => u.id === assignee)?.displayName ?? null) : null,
      requesterName: "Dana Whitfield",
      handoffContext: { lastQuestion: last?.content ?? "", abstentionReason: abst ? "No authorized document supported an answer." : null, citedDocuments: [...new Set(conv.messages.flatMap((m) => m.citations.map((c) => c.documentTitle)))] },
      replies: replies.map(([who, role, body], i) => ({ id: newId("rpl"), ticketId: "", authorId: who, authorName: db.users.find((u) => u.id === who)?.displayName ?? who, authorRole: role, body, createdAt: iso(Date.now() - (hoursAgo - i) * HOUR) })),
      label: "DEMO",
      createdAt: iso(Date.now() - hoursAgo * HOUR),
      updatedAt: iso(Date.now() - (hoursAgo - replies.length) * HOUR),
    };
    t.replies.forEach((r) => (r.ticketId = t.id));
    db.tickets.push(t);
    conv.summary.hasOpenTicket = status === "open" || status === "pending_customer";
  };
  const [carbon, jewelry] = abstainedCustomer.filter((c) => /Carbon|jewelry/i.test(c.summary.title));
  if (carbon) ticketFrom(carbon, "open", "normal", null, [], 20);
  if (jewelry) ticketFrom(jewelry, "pending_customer", "high", "usr_tomas", [["usr_tomas", "operator", "Jewelry is not covered by standard liability. I can quote declared-value coverage — what is the item's value?"]], 30);
  const lost = db.conversations.find((c) => c.summary.title === "Lost parcel claim")!;
  ticketFrom(lost, "resolved", "high", "usr_tomas", [["usr_dana", "customer", "My parcel CF-88213 never arrived."], ["usr_tomas", "operator", "I opened a loss claim for you. Credits will appear on your next invoice."]], 70);
  ticketFrom(refundConv, "closed", "low", "usr_tomas", [["usr_tomas", "operator", "Your refund was issued on Monday and should arrive within 14 days."]], 110);
  const pet = db.conversations.find((c) => c.summary.title === "Pet transport")!;
  ticketFrom(pet, "open", "normal", "usr_tomas", [["usr_dana", "customer", "Is there any partner service for pets?"]], 9);

  // Confirmed tool action (núcleo): one executed service request on the lost parcel conversation.
  const proposalId = newId("tpr");
  const srId = newId("srq");
  db.toolProposals.push({
    id: proposalId,
    conversationId: lost.summary.id,
    tool: "propose_service_request",
    status: "executed",
    effectSummary: "Creates one shipping service request “Trace parcel CF-88213” for Dana Whitfield. No message is sent to anyone.",
    payload: { category: "shipping", title: "Trace parcel CF-88213", details: "Parcel not delivered; customer reports no scan since pickup." },
    proposedByRunId: null,
    expiresAt: iso(Date.now() - 60 * HOUR),
    confirmedBy: "usr_dana",
    executionId: srId,
    createdAt: iso(Date.now() - 71 * HOUR),
  });
  db.serviceRequests.push({ id: srId, number: ++db.counters.serviceRequest!, proposalId, category: "shipping", title: "Trace parcel CF-88213", details: "Parcel not delivered; customer reports no scan since pickup.", status: "in_progress", createdBy: "usr_dana", createdByName: "Dana Whitfield", label: "DEMO", createdAt: iso(Date.now() - 70 * HOUR) });

  // Artifacts (R03/R12).
  const compliancePid = projectIds.compliance!;
  const policyChunks = authorizedChunks(db, compliancePid).filter((c) => c.documentTitle === "Data Retention Policy");
  const findings = compareChecklist(CHECKLIST_ITEMS, policyChunks);
  const gap = gapReport("Vendor checklist gap report", "All production systems", "EU (GDPR context)", findings);
  const gapArt = createArtifact(db, { projectId: compliancePid, title: "Vendor checklist gap report", content: gap.content, sources: gap.sources, authorId: "usr_leo", runId: null, changeNote: "Generated by workflow" });
  gapArt.versions[0]!.reviewState = "approved";
  gapArt.versions[0]!.approvedBy = "usr_priya";
  gapArt.versions[0]!.approvedAt = iso(Date.now() - 50 * HOUR);
  const edited = structuredClone(gap.content);
  if (edited.type === "report") edited.blocks.push({ type: "paragraph", text: "Owner follow-up: confirm penetration test cadence with the Security Lead before sending.", sourceRefs: [] });
  saveVersion(db, gapArt, { content: edited, sources: gap.sources, authorId: "usr_leo", changeNote: "Added owner follow-up" });
  gapArt.versions[1]!.reviewState = "in_review";
  gapArt.summary.reviewState = "in_review";
  gapArt.shares.push({ id: newId("shr"), artifactId: gapArt.summary.id, userId: "usr_priya", userName: "Priya Natarajan", role: "reviewer", createdAt: iso(Date.now() - 52 * HOUR) });
  gapArt.shares.push({ id: newId("shr"), artifactId: gapArt.summary.id, userId: "usr_jun", userName: "Jun Park", role: "viewer", createdAt: iso(Date.now() - 52 * HOUR) });
  db.reviews.push(
    { id: newId("rvw"), artifactId: gapArt.summary.id, artifactTitle: gapArt.summary.title, version: 1, requestedBy: "usr_leo", requestedByName: "Leo Brandt", reviewerId: "usr_priya", reviewerName: "Priya Natarajan", status: "approved", decisionNote: "Evidence quotes match the policy.", createdAt: iso(Date.now() - 54 * HOUR), decidedAt: iso(Date.now() - 50 * HOUR) },
    { id: newId("rvw"), artifactId: gapArt.summary.id, artifactTitle: gapArt.summary.title, version: 2, requestedBy: "usr_leo", requestedByName: "Leo Brandt", reviewerId: "usr_visitor", reviewerName: "Demo Visitor", status: "open", decisionNote: null, createdAt: iso(Date.now() - 3 * HOUR), decidedAt: null },
  );
  db.comments.push(
    { id: newId("cmt"), artifactId: gapArt.summary.id, version: 1, authorId: "usr_priya", authorName: "Priya Natarajan", body: "Item 10 (subprocessors) — do we have a separate register we can attach?", anchor: "Subprocessors are listed and reviewed annually", resolved: false, createdAt: iso(Date.now() - 51 * HOUR) },
    { id: newId("cmt"), artifactId: gapArt.summary.id, version: 2, authorId: "usr_leo", authorName: "Leo Brandt", body: "Added the follow-up note; please re-review v2.", anchor: null, resolved: false, createdAt: iso(Date.now() - 3 * HOUR) },
  );

  const analysisPid = projectIds.analysis!;
  const csvDoc = db.documents.find((d) => d.csvText)!;
  const rep = dataReport(csvDoc.summary.title, csvDoc.csvText!, "region", "shipments");
  createArtifact(db, { projectId: analysisPid, title: rep.content.title, content: rep.content, sources: [], authorId: "usr_leo", runId: null, changeNote: "Generated by workflow" });
  const onTime = aggregate(csvDoc.csvText!, "region", "on_time_pct", "mean");
  createArtifact(db, {
    projectId: analysisPid,
    title: "Mean on-time % by region (Q3)",
    content: {
      type: "table",
      title: "Mean on-time % by region (Q3)",
      columns: [{ key: "region", label: "Region", kind: "text" }, { key: "mean", label: "Mean on-time %", kind: "number" }, { key: "rows", label: "Rows", kind: "number" }],
      rows: onTime.map((r) => ({ region: r.group, mean: Math.round(r.value * 10) / 10, rows: r.rows })),
      note: "Computed with csv_aggregate (mean). One missing value excluded.",
    },
    sources: [],
    authorId: "usr_visitor",
    runId: null,
  });

  const deckPid = projectIds.deck!;
  const deckChunks = authorizedChunks(db, deckPid);
  const facts = ["Q3 on-time delivery target", "Approved refunds are issued", "Growth costs 199 USD", "Sales may not offer discounts above 15 percent"].map((q, i) => {
    const c = deckChunks.find((x) => x.text.toLowerCase().includes(q.toLowerCase().split(" ").slice(0, 3).join(" ")));
    const sentence = c?.text.split(/(?<=\.)\s+/).find((s) => s.toLowerCase().includes(q.toLowerCase().split(" ")[1]!)) ?? c?.text ?? q;
    return { text: sentence, ref: `S${i + 1}`, chunk: c };
  });
  const deck = presentationFromBrief({ audience: "Leadership team", goal: "Q3 service levels, refunds and pricing update", slideCount: 6 }, facts);
  const deckArt = createArtifact(db, {
    projectId: deckPid,
    title: deck.title,
    content: deck,
    sources: facts.filter((f) => f.chunk).map((f) => ({ ref: f.ref, documentId: f.chunk!.documentId, versionId: f.chunk!.versionId, version: f.chunk!.version, documentTitle: f.chunk!.documentTitle, page: f.chunk!.page, quote: f.text.slice(0, 600) })),
    authorId: "usr_visitor",
    runId: null,
  });
  deckArt.shares.push({ id: newId("shr"), artifactId: deckArt.summary.id, userId: "usr_jun", userName: "Jun Park", role: "viewer", createdAt: iso(Date.now() - 20 * HOUR) });
  db.artifacts.forEach((a, i) => (a.summary.updatedAt = iso(Date.now() - (2 + i * 7) * HOUR)));

  // Workflows (R07) with versions and runs at different checkpoints.
  for (const w of SEED_WORKFLOWS) {
    const id = `wfl_${w.key}`;
    const agentId = agentIds[w.agent]!;
    const v1 = { id: `wfv_${w.key}_1`, workflowId: id, version: 1, agentId, steps: w.steps.filter((s) => s.key !== "export"), changeNote: "Initial recipe", createdAt: iso(Date.now() - 18 * DAY) };
    const v2 = { id: `wfv_${w.key}_2`, workflowId: id, version: 2, agentId, steps: w.steps, changeNote: "Added export step", createdAt: iso(Date.now() - 6 * DAY) };
    const versions = w.steps.some((s) => s.key === "export") ? [v1, v2] : [{ ...v1, steps: w.steps }];
    db.workflows.push({
      summary: { id, name: w.name, recipe: w.recipe, description: w.description, currentVersion: versions.length, agentId, stepCount: w.steps.length, lastRunStatus: null, label: "DEMO", updatedAt: versions[versions.length - 1]!.createdAt },
      versions,
    });
  }
  const cp = (key: string, status: WorkflowCheckpoint["status"], summary: string | null, artifactId: string | null = null): WorkflowCheckpoint => ({
    stepKey: key,
    status,
    attempt: status === "pending" ? 0 : 1,
    idempotencyKey: `seed:${key}`,
    outputSummary: summary,
    artifactId,
    runId: null,
    finishedAt: status === "succeeded" ? iso(Date.now() - 49 * HOUR) : null,
  });
  db.workflowRuns.push({
    id: "wfr_seed_policy",
    workflowId: "wfl_policy_review",
    workflowVersion: 2,
    projectId: compliancePid,
    status: "succeeded",
    currentStepKey: null,
    checkpoints: [
      cp("confirm_brief", "succeeded", "Scope: all production systems · Jurisdiction: EU (GDPR context)"),
      cp("retrieve", "succeeded", `${policyChunks.length} passages from Data Retention Policy v3`),
      cp("compare", "succeeded", `${findings.filter((f) => f.status === "covered").length} covered · ${findings.filter((f) => f.status === "gap").length} gaps`),
      cp("draft", "succeeded", "Created “Vendor checklist gap report” v1", gapArt.summary.id),
      cp("export", "succeeded", "PDF rendered for v1"),
    ],
    inputs: { scope: "All production systems", jurisdiction: "EU (GDPR context)" },
    costNanoUsd: "0",
    costStatus: "no_provider_charge",
    startedAt: iso(Date.now() - 50 * HOUR),
    updatedAt: iso(Date.now() - 49 * HOUR),
    startedByName: "Maya Okafor",
    pausedByName: null,
    pausedAt: null,
  });
  db.workflowRuns.push({
    id: "wfr_seed_csv",
    workflowId: "wfl_csv_analysis",
    workflowVersion: 1,
    projectId: analysisPid,
    status: "paused",
    currentStepKey: "aggregate",
    checkpoints: [
      cp("profile", "succeeded", "120 rows × 9 columns · 1 missing value"),
      cp("stats", "succeeded", "Statistics for 6 numeric columns"),
      cp("aggregate", "pending", null),
      cp("chart", "pending", null),
      cp("report", "pending", null),
    ],
    inputs: { file: "shipments_q3.csv", groupBy: "region", measure: "shipments" },
    costNanoUsd: "0",
    costStatus: "no_provider_charge",
    startedAt: iso(Date.now() - 26 * HOUR),
    updatedAt: iso(Date.now() - 25 * HOUR),
    startedByName: "Leo Brandt",
    pausedByName: "Leo Brandt",
    pausedAt: iso(Date.now() - 25 * HOUR),
  });
  db.workflows.find((w) => w.summary.id === "wfl_policy_review")!.summary.lastRunStatus = "succeeded";
  db.workflows.find((w) => w.summary.id === "wfl_csv_analysis")!.summary.lastRunStatus = "paused";

  // Privacy (R10): reviews for documents with findings.
  for (const d of db.documents.filter((x) => x.summary.sensitiveFindingCount > 0)) {
    const v = d.versions.find((x) => x.published)!;
    const text = (d.pages[v.id] ?? []).map((p) => p.text).join("\n\n");
    const f = scanText(text);
    db.redactionReviews.push({ id: newId("rdr"), documentId: d.summary.id, documentTitle: d.summary.title, versionId: v.id, source: "document", status: "pending_review", findings: f, suggestedClassification: suggestClassification(f, d.summary.classification), reviewerId: null, decidedAt: null, createdAt: iso(Date.now() - 30 * HOUR) });
    void redact;
  }
  db.consents.push({ id: newId("cns"), provider: "anthropic", documentIds: ["doc_pricing"], grantedBy: "usr_maya", grantedByName: "Maya Okafor", scope: "single_run", createdAt: iso(Date.now() - 8 * DAY), expiresAt: iso(Date.now() - 7 * DAY), revokedAt: null });

  // Evaluation suite + one completed run computed now.
  db.evalSuite.cases = SEED_EVAL_CASES.map((c, i) => ({ id: `evc_${i + 1}`, suiteId: db.evalSuite.id, question: c.question, expectation: c.expectation, expectedDocumentTitle: c.document, expectedPhrase: c.phrase }));
  const evalRun = runEvaluation(db);
  evalRun.createdAt = iso(Date.now() - 22 * HOUR);

  // Showcase (R14).
  db.showcase = SEED_SHOWCASE.map((s) => ({
    id: `shc_${s.slug}`,
    slug: s.slug,
    title: s.title,
    summary: s.summary,
    projectId: projectIds[s.project]!,
    agentId: agentIds[s.agent]!,
    workflowId: `wfl_${s.workflow}`,
    steps: [],
    integration: { mode: "local", note: "Runs on the local adapter: retrieval, templates and deterministic tools. External models are pending credentials." },
    lastRun: null,
  }));

  db.audit.push(
    { id: newId("aud"), actorId: "usr_maya", actorName: "Maya Okafor", action: "privacy.policy.update", target: "Privacy policy v2", requestId: "req_demo_1", createdAt: iso(Date.now() - 6 * DAY) },
    { id: newId("aud"), actorId: "usr_priya", actorName: "Priya Natarajan", action: "review.approve", target: "Vendor checklist gap report v1", requestId: "req_demo_2", createdAt: iso(Date.now() - 50 * HOUR) },
    { id: newId("aud"), actorId: "usr_dana", actorName: "Dana Whitfield", action: "tool.confirm", target: "Service request #311", requestId: "req_demo_3", createdAt: iso(Date.now() - 70 * HOUR) },
  );
}
