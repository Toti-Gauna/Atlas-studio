import { z } from "zod";
import { DataLabel, Id, IsoDateTime } from "./common";

export const TicketStatus = z.enum(["open", "pending_customer", "resolved", "closed"]);
export type TicketStatus = z.infer<typeof TicketStatus>;

export const TicketReply = z.object({
  id: Id,
  ticketId: Id,
  authorId: Id,
  authorName: z.string(),
  authorRole: z.enum(["operator", "customer", "system"]),
  body: z.string().min(1).max(4000),
  createdAt: IsoDateTime,
});
export type TicketReply = z.infer<typeof TicketReply>;

export const Ticket = z.object({
  id: Id,
  number: z.number().int().positive(),
  conversationId: Id,
  subject: z.string(),
  status: TicketStatus,
  priority: z.enum(["low", "normal", "high"]),
  assigneeId: Id.nullable(),
  assigneeName: z.string().nullable(),
  requesterName: z.string(),
  /** Preserved context from the conversation at handoff time. */
  handoffContext: z.object({
    lastQuestion: z.string(),
    abstentionReason: z.string().nullable(),
    citedDocuments: z.array(z.string()),
  }),
  replies: z.array(TicketReply),
  label: DataLabel,
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});
export type Ticket = z.infer<typeof Ticket>;

export const ToolProposalStatus = z.enum(["pending", "confirmed", "executed", "failed", "cancelled", "expired"]);

export const ToolProposal = z.object({
  id: Id,
  conversationId: Id,
  tool: z.literal("propose_service_request"),
  status: ToolProposalStatus,
  /** Visible summary of the effect, shown in the confirmation modal. */
  effectSummary: z.string(),
  payload: z.object({
    category: z.enum(["billing", "shipping", "account", "other"]),
    title: z.string().max(120),
    details: z.string().max(2000),
  }),
  proposedByRunId: Id.nullable(),
  expiresAt: IsoDateTime,
  confirmedBy: Id.nullable(),
  executionId: Id.nullable(),
  createdAt: IsoDateTime,
});
export type ToolProposal = z.infer<typeof ToolProposal>;

export const ServiceRequest = z.object({
  id: Id,
  number: z.number().int().positive(),
  proposalId: Id,
  category: z.string(),
  title: z.string(),
  details: z.string(),
  status: z.enum(["received", "in_progress", "done"]),
  createdBy: Id,
  createdByName: z.string(),
  label: DataLabel,
  createdAt: IsoDateTime,
});
export type ServiceRequest = z.infer<typeof ServiceRequest>;

export const EvaluationCase = z.object({
  id: Id,
  suiteId: Id,
  question: z.string(),
  expectation: z.enum(["answer_with_citation", "abstain", "resist_injection", "isolation"]),
  expectedDocumentTitle: z.string().nullable(),
  expectedPhrase: z.string().nullable(),
});
export type EvaluationCase = z.infer<typeof EvaluationCase>;

export const CaseResult = z.object({
  caseId: Id,
  passed: z.boolean(),
  observed: z.enum(["answered", "abstained", "refused_injection", "blocked"]),
  citedDocumentTitle: z.string().nullable(),
  detail: z.string(),
});
export type CaseResult = z.infer<typeof CaseResult>;

export const EvaluationRun = z.object({
  id: Id,
  suiteId: Id,
  corpusVersionHash: z.string(),
  configHash: z.string(),
  modelKey: z.string(),
  status: z.enum(["running", "completed", "failed"]),
  passed: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  results: z.array(CaseResult),
  /** Local evaluation checks citation/abstention/isolation behavior, not semantic accuracy. */
  scopeNote: z.string(),
  createdAt: IsoDateTime,
});
export type EvaluationRun = z.infer<typeof EvaluationRun>;

export const EvaluationSuite = z.object({
  id: Id,
  name: z.string(),
  cases: z.array(EvaluationCase),
  runs: z.array(EvaluationRun.omit({ results: true })),
  label: DataLabel,
});
export type EvaluationSuite = z.infer<typeof EvaluationSuite>;

export const ShowcaseScenario = z.object({
  id: Id,
  slug: z.enum(["compliance", "csv_analysis", "presentation"]),
  title: z.string(),
  summary: z.string(),
  projectId: Id,
  agentId: Id,
  workflowId: Id,
  steps: z.array(z.object({ key: z.string(), title: z.string(), description: z.string(), route: z.string() })),
  integration: z.object({ mode: z.enum(["local", "connected", "pending"]), note: z.string() }),
  lastRun: z
    .object({ workflowRunId: Id, status: z.string(), artifactIds: z.array(Id), finishedAt: IsoDateTime.nullable() })
    .nullable(),
});
export type ShowcaseScenario = z.infer<typeof ShowcaseScenario>;

export const AuditEvent = z.object({
  id: Id,
  actorId: Id,
  actorName: z.string(),
  action: z.string(),
  target: z.string(),
  requestId: z.string(),
  createdAt: IsoDateTime,
});
export type AuditEvent = z.infer<typeof AuditEvent>;
