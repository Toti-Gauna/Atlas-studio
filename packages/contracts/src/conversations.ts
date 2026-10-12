import { z } from "zod";
import { DataLabel, Id, IsoDateTime, NanoUsd } from "./common";
import { RunStatus } from "./runs";

export const Citation = z.object({
  id: Id,
  documentId: Id,
  versionId: Id,
  version: z.number().int().positive(),
  documentTitle: z.string(),
  chunkId: Id,
  page: z.number().int().positive().nullable(),
  quote: z.string(),
  /** Character offsets of the quote within the chunk text for highlighting. */
  quoteStart: z.number().int().nonnegative(),
  quoteEnd: z.number().int().nonnegative(),
  score: z.number(),
});
export type Citation = z.infer<typeof Citation>;

export const RetrievalTrace = z.object({
  query: z.string(),
  candidates: z.number().int().nonnegative(),
  threshold: z.number(),
  topScore: z.number().nullable(),
  decision: z.enum(["answered", "abstained"]),
  filteredBy: z.array(z.string()),
});
export type RetrievalTrace = z.infer<typeof RetrievalTrace>;

export const MessageRole = z.enum(["user", "assistant", "operator", "system_notice"]);

export const Message = z.object({
  id: Id,
  conversationId: Id,
  branchId: Id,
  parentMessageId: Id.nullable(),
  role: MessageRole,
  content: z.string(),
  status: z.enum(["complete", "streaming", "cancelled", "failed"]),
  runId: Id.nullable(),
  agentId: Id.nullable(),
  modelKey: z.string().nullable(),
  mode: z.enum(["local", "connected"]).nullable(),
  citations: z.array(Citation),
  retrieval: RetrievalTrace.nullable(),
  abstained: z.boolean(),
  artifactIds: z.array(Id),
  toolProposalId: Id.nullable(),
  createdAt: IsoDateTime,
});
export type Message = z.infer<typeof Message>;

export const Branch = z.object({
  id: Id,
  conversationId: Id,
  parentBranchId: Id.nullable(),
  /** Message at which this branch diverges; null for the root branch. */
  forkedFromMessageId: Id.nullable(),
  reason: z.enum(["root", "edit", "regenerate"]),
  agentId: Id,
  agentVersion: z.number().int().positive(),
  modelKey: z.string(),
  label: z.string(),
  createdAt: IsoDateTime,
});
export type Branch = z.infer<typeof Branch>;

export const ConversationSummary = z.object({
  id: Id,
  projectId: Id,
  title: z.string(),
  agentId: Id,
  lastMessagePreview: z.string(),
  messageCount: z.number().int().nonnegative(),
  branchCount: z.number().int().positive(),
  hasOpenTicket: z.boolean(),
  label: DataLabel,
  updatedAt: IsoDateTime,
});
export type ConversationSummary = z.infer<typeof ConversationSummary>;

export const ConversationDetail = ConversationSummary.extend({
  activeBranchId: Id,
  branches: z.array(Branch),
  messages: z.array(Message),
});
export type ConversationDetail = z.infer<typeof ConversationDetail>;

export const WorkMode = z.enum(["answer", "plan_then_run", "draft_artifact"]);
export type WorkMode = z.infer<typeof WorkMode>;

export const SendMessageRequest = z.object({
  content: z.string().min(1).max(8000),
  branchId: Id,
  agentId: Id,
  /** User-pinned model; the server never swaps it silently. */
  pinnedModelKey: z.string().nullable(),
  workMode: WorkMode,
  attachmentDocumentIds: z.array(Id).max(10),
  /** Idempotency key: reconnect/retry with the same key never duplicates the message. */
  clientMessageId: z.string().min(8).max(64),
  /** Present when the user approved a pending fallback or consent for this send. */
  approvals: z
    .object({
      fallbackModelKey: z.string().optional(),
      externalTransferConsentId: Id.optional(),
    })
    .optional(),
});
export type SendMessageRequest = z.infer<typeof SendMessageRequest>;

export const CreateBranchRequest = z.object({
  fromMessageId: Id,
  reason: z.enum(["edit", "regenerate"]),
  editedContent: z.string().min(1).max(8000).optional(),
  agentId: Id.optional(),
  pinnedModelKey: z.string().nullable().optional(),
});

export const ComparisonRun = z.object({
  runId: Id,
  modelKey: z.string(),
  status: RunStatus,
  answer: z.string().nullable(),
  citations: z.array(Citation),
  latencyMs: z.number().int().nonnegative().nullable(),
  inputTokens: z.number().int().nonnegative().nullable(),
  outputTokens: z.number().int().nonnegative().nullable(),
  costStatus: z.enum(["no_provider_charge", "calculated", "unknown"]),
  costNanoUsd: NanoUsd.nullable(),
  error: z.string().nullable(),
});
export type ComparisonRun = z.infer<typeof ComparisonRun>;

export const Comparison = z.object({
  id: Id,
  conversationId: Id,
  prompt: z.string(),
  left: ComparisonRun,
  right: ComparisonRun,
  /** Always null: Atlas does not declare a winner without a rubric-based evaluation. */
  winner: z.null(),
  createdAt: IsoDateTime,
});
export type Comparison = z.infer<typeof Comparison>;

export const CreateComparisonRequest = z.object({
  conversationId: Id,
  prompt: z.string().min(1).max(8000),
  modelKeys: z.tuple([z.string(), z.string()]),
  agentId: Id,
});

export const Suggestion = z.object({
  id: Id,
  kind: z.enum(["question", "next_step", "deliverable"]),
  title: z.string(),
  prompt: z.string(),
  /** Why it is suggested and which data was used. Empty context yields no suggestion. */
  reason: z.string(),
  basedOn: z.array(z.object({ type: z.enum(["objective", "agent", "document", "conversation", "workflow"]), id: z.string(), label: z.string() })),
  agentId: Id.nullable(),
  workMode: WorkMode,
  /** Suggestions are generated by deterministic rules unless explicitly requested from a model. */
  generatedBy: z.enum(["rules", "model"]),
  dismissed: z.boolean(),
});
export type Suggestion = z.infer<typeof Suggestion>;
