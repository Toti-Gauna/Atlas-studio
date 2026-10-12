/**
 * FIXTURE (P02 preview only). In-memory stand-in for the API database so every
 * screen can be exercised before the Express/PostgreSQL backend exists.
 * Everything here is labeled DEMO and resets on page reload.
 */
import type {
  AgentSummary,
  AgentVersion,
  ArtifactShare,
  ArtifactSummary,
  ArtifactVersion,
  AuditEvent,
  Branch,
  Budget,
  Chunk,
  ConversationSummary,
  DocumentSummary,
  DocumentVersion,
  EvaluationCase,
  EvaluationRun,
  ExternalTransferConsent,
  LedgerEntry,
  MemoryItem,
  Message,
  PrivacyPolicy,
  Project,
  RedactionReview,
  ReviewComment,
  ReviewRequest,
  RoutingPolicy,
  RunDetail,
  ServiceRequest,
  ShowcaseScenario,
  Ticket,
  ToolProposal,
  User,
  WorkflowRun,
  WorkflowSummary,
  WorkflowVersion,
  Workspace,
  WorkspaceRole,
} from "@atlas/contracts";

export interface DocRecord {
  summary: DocumentSummary;
  versions: DocumentVersion[];
  pages: Record<string, Array<{ page: number; text: string }>>;
  chunks: Record<string, Chunk[]>;
  csvText: string | null;
  imagePath: string | null;
  deleted: boolean;
}

export interface ConvRecord {
  summary: ConversationSummary;
  branches: Branch[];
  messages: Message[];
  activeBranchId: string;
  customerId: string | null;
  /** clientMessageId → assistant message id (idempotent sends). */
  sent: Record<string, string>;
}

export interface AgentRecord {
  summary: AgentSummary;
  versions: AgentVersion[];
  guardrails: string[];
  deleted: boolean;
}

export interface ArtifactRecord {
  summary: Omit<ArtifactSummary, "myRole">;
  versions: ArtifactVersion[];
  shares: ArtifactShare[];
}

export interface WorkflowRecord {
  summary: WorkflowSummary;
  versions: WorkflowVersion[];
}

export interface Db {
  workspace: Workspace;
  users: User[];
  roles: Record<string, WorkspaceRole>;
  session: { userId: string; role: WorkspaceRole; csrf: string } | null;
  projects: Project[];
  memories: MemoryItem[];
  documents: DocRecord[];
  conversations: ConvRecord[];
  agents: AgentRecord[];
  runs: RunDetail[];
  ledger: LedgerEntry[];
  budgets: Budget[];
  artifacts: ArtifactRecord[];
  comments: ReviewComment[];
  reviews: ReviewRequest[];
  workflows: WorkflowRecord[];
  workflowRuns: WorkflowRun[];
  privacyPolicy: PrivacyPolicy;
  redactionReviews: RedactionReview[];
  consents: ExternalTransferConsent[];
  tickets: Ticket[];
  toolProposals: ToolProposal[];
  serviceRequests: ServiceRequest[];
  evalSuite: { id: string; name: string; cases: EvaluationCase[] };
  evalRuns: EvaluationRun[];
  showcase: ShowcaseScenario[];
  routingPolicy: RoutingPolicy;
  dismissedSuggestions: string[];
  audit: AuditEvent[];
  counters: Record<string, number>;
  /** Simulated "now" anchor so relative dates in seed data stay stable. */
  now: number;
}

let counter = 0;
export function newId(prefix: string): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}`;
}

export const iso = (ms: number) => new Date(ms).toISOString();
