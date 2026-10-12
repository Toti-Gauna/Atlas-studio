import type { WorkspaceRole } from "./identity";

/**
 * Formal route catalogue shared by the web client, the API server and docs.
 * Every route is scoped to the session workspace; the server derives the
 * workspace and role from the session and checks ownership on every query.
 */
export type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export interface RouteSpec {
  id: string;
  method: HttpMethod;
  path: string;
  summary: string;
  /** null = public (health, demo start, login). */
  roles: readonly WorkspaceRole[] | null;
  /** Mutations require the CSRF header and are idempotent where noted. */
  idempotent?: boolean;
  requirement: string;
}

const ALL: readonly WorkspaceRole[] = ["admin", "editor", "reviewer", "operator", "viewer", "customer"];
const STAFF: readonly WorkspaceRole[] = ["admin", "editor", "reviewer", "operator", "viewer"];
const WRITERS: readonly WorkspaceRole[] = ["admin", "editor"];
const SUPPORT: readonly WorkspaceRole[] = ["admin", "operator"];

export const routes = [
  // Platform
  { id: "health", method: "GET", path: "/health", summary: "Liveness + DB + provider modes", roles: null, requirement: "core" },
  { id: "auth.login", method: "POST", path: "/auth/login", summary: "Owner/staff login (password hashed server-side)", roles: null, requirement: "core" },
  { id: "auth.logout", method: "POST", path: "/auth/logout", summary: "Invalidate session", roles: ALL, requirement: "core" },
  { id: "auth.session", method: "GET", path: "/auth/session", summary: "Current session, role and workspace", roles: ALL, requirement: "core" },
  { id: "demo.start", method: "POST", path: "/demo/sessions", summary: "Create isolated visitor workspace with synthetic seed + TTL", roles: null, requirement: "core" },
  { id: "demo.switchRole", method: "POST", path: "/demo/sessions/role", summary: "Server-issued role switch inside own demo workspace", roles: ALL, requirement: "core" },
  { id: "demo.reset", method: "POST", path: "/demo/reset", summary: "Reset own demo workspace (idempotent)", roles: ALL, idempotent: true, requirement: "core" },
  { id: "demo.scenarios", method: "GET", path: "/demo/scenarios", summary: "Showcase scenarios with live status", roles: STAFF, requirement: "R14" },
  { id: "members.list", method: "GET", path: "/members", summary: "Workspace members", roles: STAFF, requirement: "R12" },
  { id: "audit.list", method: "GET", path: "/audit", summary: "Audit events (no sensitive payloads)", roles: ["admin"], requirement: "core" },

  // Projects & memory (R04)
  { id: "projects.list", method: "GET", path: "/projects", summary: "Projects visible to actor", roles: STAFF, requirement: "R04" },
  { id: "projects.create", method: "POST", path: "/projects", summary: "Create project", roles: WRITERS, requirement: "R04" },
  { id: "projects.get", method: "GET", path: "/projects/:id", summary: "Project detail", roles: STAFF, requirement: "R04" },
  { id: "projects.update", method: "PATCH", path: "/projects/:id", summary: "Update objective/default agent/memory toggle", roles: WRITERS, requirement: "R04" },
  { id: "memories.list", method: "GET", path: "/memories", summary: "Memory items (?projectId= | ?scope=user_preference)", roles: STAFF, requirement: "R04" },
  { id: "memories.create", method: "POST", path: "/memories", summary: "Add memory (opt-in, visible)", roles: WRITERS, requirement: "R04" },
  { id: "memories.update", method: "PATCH", path: "/memories/:id", summary: "Edit, approve or disable", roles: WRITERS, requirement: "R04" },
  { id: "memories.delete", method: "DELETE", path: "/memories/:id", summary: "Delete; excluded from all new runs", roles: WRITERS, requirement: "R04" },

  // Documents & retrieval (core + R06 + R10)
  { id: "documents.list", method: "GET", path: "/documents", summary: "Documents (?projectId=)", roles: STAFF, requirement: "core" },
  { id: "documents.upload", method: "POST", path: "/documents", summary: "Upload PDF/text/CSV/image with limits; queues ingestion", roles: ["admin", "editor"], requirement: "core" },
  { id: "documents.get", method: "GET", path: "/documents/:id", summary: "Detail with versions and pages", roles: STAFF, requirement: "core" },
  { id: "documents.status", method: "GET", path: "/documents/:id/status", summary: "Ingestion status", roles: STAFF, requirement: "core" },
  { id: "documents.reindex", method: "POST", path: "/documents/:id/reindex", summary: "Re-run ingestion as new version", roles: ["admin"], requirement: "core" },
  { id: "documents.delete", method: "DELETE", path: "/documents/:id", summary: "Delete; invalidates index and memory refs", roles: ["admin"], requirement: "core" },
  { id: "documents.csvProfile", method: "GET", path: "/documents/:id/csv-profile", summary: "Deterministic CSV validation + stats", roles: STAFF, requirement: "R06" },
  { id: "search.documents", method: "GET", path: "/search/documents", summary: "Authorized full-text search (?q=)", roles: STAFF, requirement: "core" },

  // Conversations, branches, comparisons, recommendations (core + R02 + R05)
  { id: "conversations.list", method: "GET", path: "/conversations", summary: "History (?projectId=)", roles: ALL, requirement: "core" },
  { id: "conversations.create", method: "POST", path: "/conversations", summary: "New conversation in project", roles: ALL, requirement: "core" },
  { id: "conversations.get", method: "GET", path: "/conversations/:id", summary: "Messages for branch (?branchId=)", roles: ALL, requirement: "core" },
  { id: "conversations.send", method: "POST", path: "/conversations/:id/messages", summary: "Send message → run (SSE stream); idempotent by clientMessageId", roles: ALL, idempotent: true, requirement: "core" },
  { id: "runs.cancel", method: "POST", path: "/runs/:id/cancel", summary: "Cancel run; consumption already incurred stays recorded", roles: ALL, idempotent: true, requirement: "core" },
  { id: "conversations.handoff", method: "POST", path: "/conversations/:id/handoff", summary: "Create ticket once (idempotent)", roles: ALL, idempotent: true, requirement: "core" },
  { id: "branches.create", method: "POST", path: "/branches", summary: "Edit/regenerate as branch preserving history", roles: ALL, requirement: "R05" },
  { id: "comparisons.create", method: "POST", path: "/comparisons", summary: "Two independent runs, both reserved", roles: WRITERS, requirement: "R05" },
  { id: "recommendations.list", method: "GET", path: "/recommendations", summary: "Contextual suggestions with reasons (?projectId=&conversationId=&agentId=)", roles: STAFF, requirement: "R02" },
  { id: "recommendations.dismiss", method: "POST", path: "/recommendations/:id/dismiss", summary: "Dismiss suggestion", roles: STAFF, requirement: "R02" },
  { id: "toolProposals.create", method: "POST", path: "/conversations/:id/tool-proposals", summary: "Propose service request (no effect)", roles: ALL, requirement: "core" },
  { id: "toolProposals.confirm", method: "POST", path: "/tool-proposals/:id/confirm", summary: "One-shot confirmation; expires", roles: ALL, idempotent: true, requirement: "core" },
  { id: "serviceRequests.list", method: "GET", path: "/service-requests", summary: "Created service requests", roles: ALL, requirement: "core" },

  // Agents, models, routing (R08 + R13)
  { id: "agents.list", method: "GET", path: "/agents", summary: "Agent gallery", roles: STAFF, requirement: "R08" },
  { id: "agents.create", method: "POST", path: "/agents", summary: "Create custom agent", roles: WRITERS, requirement: "R08" },
  { id: "agents.get", method: "GET", path: "/agents/:id", summary: "Agent with versions", roles: STAFF, requirement: "R08" },
  { id: "agents.update", method: "PUT", path: "/agents/:id", summary: "New version (optimistic concurrency)", roles: WRITERS, requirement: "R08" },
  { id: "agents.delete", method: "DELETE", path: "/agents/:id", summary: "Delete custom agent (history keeps snapshots)", roles: WRITERS, requirement: "R08" },
  { id: "agents.versions", method: "GET", path: "/agents/:id/versions", summary: "Version history", roles: STAFF, requirement: "R08" },
  { id: "agents.plan", method: "POST", path: "/agents/:id/plan", summary: "Plan preview + estimate (no model call)", roles: STAFF, requirement: "R08" },
  { id: "tools.list", method: "GET", path: "/tools", summary: "Fixed tool allowlist", roles: STAFF, requirement: "R08" },
  { id: "models.list", method: "GET", path: "/models", summary: "Versioned registry with availability", roles: STAFF, requirement: "R13" },
  { id: "providers.status", method: "GET", path: "/providers", summary: "Provider modes (no secrets)", roles: STAFF, requirement: "R13" },
  { id: "routing.get", method: "GET", path: "/routing-policy", summary: "Routing policy", roles: STAFF, requirement: "R13" },
  { id: "routing.update", method: "PUT", path: "/routing-policy", summary: "New policy version", roles: ["admin"], requirement: "R13" },

  // Runs & traceability (R11)
  { id: "runs.list", method: "GET", path: "/runs", summary: "Runs (?projectId=&agentId=)", roles: STAFF, requirement: "R11" },
  { id: "runs.get", method: "GET", path: "/runs/:id", summary: "Snapshot, steps, attempts (no private reasoning)", roles: STAFF, requirement: "R11" },

  // Artifacts & reviews (R03 + R12)
  { id: "artifacts.list", method: "GET", path: "/artifacts", summary: "Artifacts (?projectId=)", roles: STAFF, requirement: "R03" },
  { id: "artifacts.create", method: "POST", path: "/artifacts", summary: "Create artifact v1", roles: WRITERS, requirement: "R03" },
  { id: "artifacts.get", method: "GET", path: "/artifacts/:id", summary: "Artifact with current version", roles: STAFF, requirement: "R03" },
  { id: "artifacts.version", method: "GET", path: "/artifacts/:id/versions/:version", summary: "Specific version", roles: STAFF, requirement: "R03" },
  { id: "artifacts.save", method: "POST", path: "/artifacts/:id/versions", summary: "Save edit as new version (invalidates approval)", roles: ["admin", "editor"], requirement: "R03" },
  { id: "artifacts.export", method: "GET", path: "/artifacts/:id/versions/:version/export", summary: "Server-rendered md/csv/json/pdf/pptx (?format=)", roles: STAFF, requirement: "R03" },
  { id: "artifactShares.list", method: "GET", path: "/artifact-shares", summary: "Shares (?artifactId=)", roles: STAFF, requirement: "R12" },
  { id: "artifactShares.create", method: "POST", path: "/artifact-shares", summary: "Share within workspace (no public links)", roles: WRITERS, requirement: "R12" },
  { id: "artifactShares.delete", method: "DELETE", path: "/artifact-shares/:id", summary: "Revoke share", roles: WRITERS, requirement: "R12" },
  { id: "reviews.list", method: "GET", path: "/reviews", summary: "Review requests (?mine=1)", roles: STAFF, requirement: "R12" },
  { id: "reviews.request", method: "POST", path: "/reviews", summary: "Request review of a version", roles: WRITERS, requirement: "R12" },
  { id: "reviews.decide", method: "POST", path: "/reviews/:id/decision", summary: "Approve/request changes for exact version", roles: ["admin", "reviewer"], requirement: "R12" },
  { id: "reviews.comments", method: "GET", path: "/artifacts/:id/comments", summary: "Comments by version", roles: STAFF, requirement: "R12" },
  { id: "reviews.comment", method: "POST", path: "/artifacts/:id/comments", summary: "Comment", roles: ["admin", "editor", "reviewer"], requirement: "R12" },

  // Workflows (R07)
  { id: "workflows.list", method: "GET", path: "/workflows", summary: "Recipe library", roles: STAFF, requirement: "R07" },
  { id: "workflows.get", method: "GET", path: "/workflows/:id", summary: "Workflow with versions", roles: STAFF, requirement: "R07" },
  { id: "workflows.update", method: "PUT", path: "/workflows/:id", summary: "Edit steps → new version", roles: WRITERS, requirement: "R07" },
  { id: "workflows.preview", method: "POST", path: "/workflows/:id/preview", summary: "Plan preview, no model calls", roles: STAFF, requirement: "R07" },
  { id: "workflows.run", method: "POST", path: "/workflows/:id/runs", summary: "Start run (idempotency key)", roles: WRITERS, idempotent: true, requirement: "R07" },
  { id: "workflowRuns.get", method: "GET", path: "/workflow-runs/:id", summary: "Run state with checkpoints", roles: STAFF, requirement: "R07" },
  { id: "workflowRuns.pause", method: "POST", path: "/workflow-runs/:id/pause", summary: "Stop after current step", roles: WRITERS, requirement: "R07" },
  { id: "workflowRuns.resume", method: "POST", path: "/workflow-runs/:id/resume", summary: "Resume from checkpoint without duplicating effects", roles: WRITERS, idempotent: true, requirement: "R07" },
  { id: "workflowRuns.confirm", method: "POST", path: "/workflow-runs/:id/confirm", summary: "Confirm step that requires it", roles: WRITERS, idempotent: true, requirement: "R07" },

  // FinOps (R09)
  { id: "usage.report", method: "GET", path: "/usage", summary: "Usage by group, 7/30 days, filters", roles: ["admin", "editor", "reviewer"], requirement: "R09" },
  { id: "usage.ledger", method: "GET", path: "/usage/ledger", summary: "Ledger entries by run/attempt", roles: ["admin", "editor", "reviewer"], requirement: "R09" },
  { id: "usage.export", method: "GET", path: "/usage/export.csv", summary: "CSV export (formula-injection safe)", roles: ["admin"], requirement: "R09" },
  { id: "budgets.list", method: "GET", path: "/budgets", summary: "Budgets with spent/reserved/unknown", roles: STAFF, requirement: "R09" },
  { id: "budgets.upsert", method: "PUT", path: "/budgets/:id", summary: "Create/update budget", roles: ["admin"], requirement: "R09" },

  // Privacy (R10)
  { id: "privacy.policy", method: "GET", path: "/privacy/policy", summary: "Policy", roles: STAFF, requirement: "R10" },
  { id: "privacy.updatePolicy", method: "PUT", path: "/privacy/policy", summary: "New policy version", roles: ["admin"], requirement: "R10" },
  { id: "privacy.scan", method: "POST", path: "/privacy/scan", summary: "Explainable detection preview", roles: STAFF, requirement: "R10" },
  { id: "privacy.reviews", method: "GET", path: "/privacy/reviews", summary: "Redaction reviews", roles: STAFF, requirement: "R10" },
  { id: "privacy.decide", method: "POST", path: "/privacy/reviews/:id/decision", summary: "Redact / approve original / reject", roles: ["admin"], requirement: "R10" },
  { id: "privacy.consents", method: "GET", path: "/privacy/consents", summary: "External transfer consents", roles: STAFF, requirement: "R10" },
  { id: "privacy.grantConsent", method: "POST", path: "/privacy/consents", summary: "Grant consent (authorized role)", roles: ["admin"], requirement: "R10" },
  { id: "privacy.revokeConsent", method: "DELETE", path: "/privacy/consents/:id", summary: "Revoke consent", roles: ["admin"], requirement: "R10" },

  // Support desk core
  { id: "tickets.list", method: "GET", path: "/tickets", summary: "Inbox (operators) / own tickets (customers)", roles: ALL, requirement: "core" },
  { id: "tickets.get", method: "GET", path: "/tickets/:id", summary: "Ticket with replies", roles: ALL, requirement: "core" },
  { id: "tickets.reply", method: "POST", path: "/tickets/:id/replies", summary: "Reply", roles: ALL, requirement: "core" },
  { id: "tickets.status", method: "PATCH", path: "/tickets/:id/status", summary: "Change status", roles: SUPPORT, requirement: "core" },
  { id: "tickets.assign", method: "PATCH", path: "/tickets/:id/assignment", summary: "Assign operator", roles: SUPPORT, requirement: "core" },
  { id: "evaluations.suites", method: "GET", path: "/evaluations/suites", summary: "Suites with cases and runs", roles: ["admin", "editor", "reviewer"], requirement: "core" },
  { id: "evaluations.run", method: "POST", path: "/evaluations/runs", summary: "Run suite against corpus/config version", roles: ["admin"], requirement: "core" },
  { id: "evaluations.results", method: "GET", path: "/evaluations/runs/:id/results", summary: "Case results", roles: ["admin", "editor", "reviewer"], requirement: "core" },
] as const satisfies readonly RouteSpec[];

export type RouteId = (typeof routes)[number]["id"];
