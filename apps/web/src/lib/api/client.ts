import type {
  AgentDetail,
  AgentSummary,
  ArtifactContent,
  ArtifactDetail,
  ArtifactShare,
  ArtifactSummary,
  ArtifactVersion,
  AuditEvent,
  Budget,
  Comparison,
  ConversationDetail,
  ConversationSummary,
  DocumentDetail,
  DocumentSummary,
  EvaluationRun,
  EvaluationSuite,
  ExportFormat,
  ExternalTransferConsent,
  LedgerEntry,
  Member,
  MemoryItem,
  Message,
  ModelRegistryEntry,
  Page,
  PlanPreview,
  PrivacyPolicy,
  Project,
  ProviderStatus,
  RedactionReview,
  ReviewComment,
  ReviewRequest,
  RoutingPolicy,
  RunDetail,
  RunSummary,
  ScanTextResponse,
  SearchHit,
  SendMessageRequest,
  ServiceRequest,
  Session,
  ShareRole,
  ShowcaseScenario,
  SourceRef,
  Suggestion,
  Ticket,
  ToolDescriptor,
  ToolProposal,
  UsageQuery,
  UsageReport,
  WorkflowDetail,
  WorkflowRun,
  WorkflowStepDef,
  WorkflowSummary,
  WorkspaceRole,
  AgentConfig,
} from "@atlas/contracts";
import type { CsvProfile } from "@atlas/domain";
import { getTransport } from "./select";

const t = () => getTransport();

export interface SendMessageResult {
  conversation: ConversationDetail;
  userMessage: Message;
  assistantMessage: Message | null;
  run: RunSummary | null;
  /** Present when the run could not start (budget, routing approval, consent). */
  blocked: { code: string; message: string; pendingFallback?: { modelKey: string; reason: string; changesProvider: boolean; changesPrice: boolean } } | null;
}

export interface UploadRequest {
  title: string;
  mimeType: string;
  projectId: string;
  /** Text content for text/markdown/csv; PDFs and images send base64 in the HTTP API. */
  text: string | null;
  byteSize: number;
}

export const api = {
  health: () => t().request<{ status: "ok"; mode: string; providers: ProviderStatus[] }>("GET", "/health"),

  auth: {
    session: () => t().request<Session>("GET", "/auth/session"),
    login: (email: string, password: string) => t().request<Session>("POST", "/auth/login", { body: { email, password } }),
    logout: () => t().request<void>("POST", "/auth/logout"),
  },
  demo: {
    start: (role?: WorkspaceRole) => t().request<Session>("POST", "/demo/sessions", { body: { role } }),
    switchRole: (role: WorkspaceRole) => t().request<Session>("POST", "/demo/sessions/role", { body: { role } }),
    reset: () => t().request<Session>("POST", "/demo/reset"),
    scenarios: () => t().request<ShowcaseScenario[]>("GET", "/demo/scenarios"),
  },
  members: () => t().request<Member[]>("GET", "/members"),
  audit: () => t().request<AuditEvent[]>("GET", "/audit"),

  projects: {
    list: () => t().request<Project[]>("GET", "/projects"),
    get: (id: string) => t().request<Project>("GET", `/projects/${id}`),
    create: (body: { name: string; objective: string; defaultAgentId: string | null }) => t().request<Project>("POST", "/projects", { body }),
    update: (id: string, body: Partial<Pick<Project, "name" | "objective" | "defaultAgentId" | "memoryEnabled">>) => t().request<Project>("PATCH", `/projects/${id}`, { body }),
  },
  memories: {
    list: (q: { projectId?: string; scope?: "user_preference" }) => t().request<MemoryItem[]>("GET", "/memories", { query: q }),
    create: (body: { scope: MemoryItem["scope"]; projectId: string | null; content: string }) => t().request<MemoryItem>("POST", "/memories", { body }),
    update: (id: string, body: { content?: string; status?: "approved" | "disabled" }) => t().request<MemoryItem>("PATCH", `/memories/${id}`, { body }),
    remove: (id: string) => t().request<void>("DELETE", `/memories/${id}`),
  },

  documents: {
    list: (projectId?: string) => t().request<DocumentSummary[]>("GET", "/documents", { query: { projectId } }),
    get: (id: string) => t().request<DocumentDetail>("GET", `/documents/${id}`),
    upload: (body: UploadRequest) => t().request<DocumentSummary>("POST", "/documents", { body }),
    reindex: (id: string) => t().request<DocumentSummary>("POST", `/documents/${id}/reindex`),
    remove: (id: string) => t().request<void>("DELETE", `/documents/${id}`),
    csvProfile: (id: string) => t().request<CsvProfile>("GET", `/documents/${id}/csv-profile`),
    search: (q: string, projectId?: string) => t().request<SearchHit[]>("GET", "/search/documents", { query: { q, projectId } }),
  },

  conversations: {
    list: (projectId?: string) => t().request<ConversationSummary[]>("GET", "/conversations", { query: { projectId } }),
    get: (id: string, branchId?: string) => t().request<ConversationDetail>("GET", `/conversations/${id}`, { query: { branchId } }),
    create: (body: { projectId: string; agentId: string; title?: string }) => t().request<ConversationDetail>("POST", "/conversations", { body }),
    send: (id: string, body: SendMessageRequest, signal?: AbortSignal) => t().request<SendMessageResult>("POST", `/conversations/${id}/messages`, { body, signal }),
    handoff: (id: string) => t().request<Ticket>("POST", `/conversations/${id}/handoff`),
    proposeTool: (id: string, body: { title: string; details: string; category: ToolProposal["payload"]["category"] }) =>
      t().request<ToolProposal>("POST", `/conversations/${id}/tool-proposals`, { body }),
  },
  toolProposals: {
    confirm: (id: string) => t().request<{ proposal: ToolProposal; serviceRequest: ServiceRequest }>("POST", `/tool-proposals/${id}/confirm`),
  },
  serviceRequests: () => t().request<ServiceRequest[]>("GET", "/service-requests"),
  branches: {
    create: (body: { fromMessageId: string; reason: "edit" | "regenerate"; editedContent?: string; agentId?: string; pinnedModelKey?: string | null }) =>
      t().request<ConversationDetail>("POST", "/branches", { body }),
  },
  comparisons: {
    create: (body: { conversationId: string; prompt: string; modelKeys: [string, string]; agentId: string }) => t().request<Comparison>("POST", "/comparisons", { body }),
  },
  runs: {
    list: (q: { projectId?: string; agentId?: string } = {}) => t().request<RunSummary[]>("GET", "/runs", { query: q }),
    get: (id: string) => t().request<RunDetail>("GET", `/runs/${id}`),
    cancel: (id: string) => t().request<RunSummary>("POST", `/runs/${id}/cancel`),
  },
  recommendations: {
    list: (q: { projectId?: string; conversationId?: string; agentId?: string }) => t().request<Suggestion[]>("GET", "/recommendations", { query: q }),
    dismiss: (id: string) => t().request<void>("POST", `/recommendations/${id}/dismiss`),
  },

  agents: {
    list: () => t().request<AgentSummary[]>("GET", "/agents"),
    get: (id: string) => t().request<AgentDetail>("GET", `/agents/${id}`),
    create: (body: { name: string; config: AgentConfig }) => t().request<AgentDetail>("POST", "/agents", { body }),
    update: (id: string, body: { baseVersion: number; name?: string; config: AgentConfig; changeNote: string }) => t().request<AgentDetail>("PUT", `/agents/${id}`, { body }),
    remove: (id: string) => t().request<void>("DELETE", `/agents/${id}`),
    plan: (id: string, body: { objective: string; projectId: string; pinnedModelKey: string | null }) => t().request<PlanPreview>("POST", `/agents/${id}/plan`, { body }),
  },
  tools: () => t().request<ToolDescriptor[]>("GET", "/tools"),
  models: () => t().request<ModelRegistryEntry[]>("GET", "/models"),
  providers: () => t().request<ProviderStatus[]>("GET", "/providers"),
  routing: {
    get: () => t().request<RoutingPolicy>("GET", "/routing-policy"),
    update: (body: RoutingPolicy) => t().request<RoutingPolicy>("PUT", "/routing-policy", { body }),
  },

  artifacts: {
    list: (projectId?: string) => t().request<ArtifactSummary[]>("GET", "/artifacts", { query: { projectId } }),
    get: (id: string) => t().request<ArtifactDetail>("GET", `/artifacts/${id}`),
    version: (id: string, version: number) => t().request<ArtifactVersion>("GET", `/artifacts/${id}/versions/${version}`),
    create: (body: { projectId: string; title: string; content: ArtifactContent; sources: SourceRef[] }) => t().request<ArtifactDetail>("POST", "/artifacts", { body }),
    save: (id: string, body: { baseVersion: number; content: ArtifactContent; sources: SourceRef[]; changeNote: string }) =>
      t().request<ArtifactDetail>("POST", `/artifacts/${id}/versions`, { body }),
    export: (id: string, version: number, format: ExportFormat) => t().download(`/artifacts/${id}/versions/${version}/export`, { query: { format } }),
    comments: (id: string) => t().request<ReviewComment[]>("GET", `/artifacts/${id}/comments`),
    comment: (id: string, body: { version: number; body: string; anchor?: string | null }) => t().request<ReviewComment>("POST", `/artifacts/${id}/comments`, { body }),
  },
  shares: {
    list: (artifactId: string) => t().request<ArtifactShare[]>("GET", "/artifact-shares", { query: { artifactId } }),
    create: (body: { artifactId: string; userId: string; role: ShareRole }) => t().request<ArtifactShare>("POST", "/artifact-shares", { body }),
    remove: (id: string) => t().request<void>("DELETE", `/artifact-shares/${id}`),
  },
  reviews: {
    list: (mine?: boolean) => t().request<ReviewRequest[]>("GET", "/reviews", { query: { mine: mine ? 1 : undefined } }),
    request: (body: { artifactId: string; version: number; reviewerId: string }) => t().request<ReviewRequest>("POST", "/reviews", { body }),
    decide: (id: string, body: { version: number; decision: "approve" | "request_changes"; note?: string }) => t().request<ReviewRequest>("POST", `/reviews/${id}/decision`, { body }),
  },

  workflows: {
    list: () => t().request<WorkflowSummary[]>("GET", "/workflows"),
    get: (id: string) => t().request<WorkflowDetail>("GET", `/workflows/${id}`),
    update: (id: string, body: { baseVersion: number; steps: WorkflowStepDef[]; changeNote: string }) => t().request<WorkflowDetail>("PUT", `/workflows/${id}`, { body }),
    preview: (id: string, body: { projectId: string; inputs: Record<string, string> }) => t().request<PlanPreview>("POST", `/workflows/${id}/preview`, { body }),
    run: (id: string, body: { projectId: string; version: number; inputs: Record<string, string>; idempotencyKey: string }) => t().request<WorkflowRun>("POST", `/workflows/${id}/runs`, { body }),
    runs: (id: string) => t().request<WorkflowRun[]>("GET", `/workflows/${id}/runs`),
  },
  workflowRuns: {
    get: (id: string) => t().request<WorkflowRun>("GET", `/workflow-runs/${id}`),
    pause: (id: string) => t().request<WorkflowRun>("POST", `/workflow-runs/${id}/pause`),
    resume: (id: string) => t().request<WorkflowRun>("POST", `/workflow-runs/${id}/resume`),
    confirm: (id: string) => t().request<WorkflowRun>("POST", `/workflow-runs/${id}/confirm`),
  },

  usage: {
    report: (q: UsageQuery) => t().request<UsageReport>("GET", "/usage", { query: q as Record<string, string> }),
    ledger: (q: { range: "7d" | "30d"; runId?: string; modelKey?: string }) => t().request<Page<LedgerEntry>>("GET", "/usage/ledger", { query: q }),
    exportCsv: (q: { range: "7d" | "30d" }) => t().download("/usage/export.csv", { query: q }),
  },
  budgets: {
    list: () => t().request<Budget[]>("GET", "/budgets"),
    upsert: (id: string, body: Pick<Budget, "limitNanoUsd" | "alertThresholdPct" | "hardStop">) => t().request<Budget>("PUT", `/budgets/${id}`, { body }),
  },

  privacy: {
    policy: () => t().request<PrivacyPolicy>("GET", "/privacy/policy"),
    updatePolicy: (body: PrivacyPolicy) => t().request<PrivacyPolicy>("PUT", "/privacy/policy", { body }),
    scan: (text: string) => t().request<ScanTextResponse>("POST", "/privacy/scan", { body: { text } }),
    reviews: () => t().request<RedactionReview[]>("GET", "/privacy/reviews"),
    decide: (id: string, body: { decision: "redact" | "approve_original" | "reject"; note?: string }) => t().request<RedactionReview>("POST", `/privacy/reviews/${id}/decision`, { body }),
    consents: () => t().request<ExternalTransferConsent[]>("GET", "/privacy/consents"),
    grantConsent: (body: { provider: string; documentIds: string[]; scope: ExternalTransferConsent["scope"] }) => t().request<ExternalTransferConsent>("POST", "/privacy/consents", { body }),
    revokeConsent: (id: string) => t().request<void>("DELETE", `/privacy/consents/${id}`),
  },

  tickets: {
    list: () => t().request<Ticket[]>("GET", "/tickets"),
    get: (id: string) => t().request<Ticket>("GET", `/tickets/${id}`),
    reply: (id: string, body: string) => t().request<Ticket>("POST", `/tickets/${id}/replies`, { body: { body } }),
    status: (id: string, status: Ticket["status"]) => t().request<Ticket>("PATCH", `/tickets/${id}/status`, { body: { status } }),
    assign: (id: string, assigneeId: string | null) => t().request<Ticket>("PATCH", `/tickets/${id}/assignment`, { body: { assigneeId } }),
  },
  evaluations: {
    suites: () => t().request<EvaluationSuite[]>("GET", "/evaluations/suites"),
    run: (suiteId: string) => t().request<EvaluationRun>("POST", "/evaluations/runs", { body: { suiteId } }),
    results: (runId: string) => t().request<EvaluationRun>("GET", `/evaluations/runs/${runId}/results`),
  },
};

export type Api = typeof api;
