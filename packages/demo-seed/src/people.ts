import type { WorkspaceRole } from "@atlas/contracts";

/** Fictional collaborators inside each visitor's demo workspace. */
export const SEED_PEOPLE: Array<{ key: string; name: string; email: string; role: WorkspaceRole }> = [
  { key: "visitor", name: "Demo Visitor", email: "visitor@demo.atlas.example", role: "admin" },
  { key: "maya", name: "Maya Okafor", email: "maya@corvid-freight.example", role: "admin" },
  { key: "leo", name: "Leo Brandt", email: "leo@corvid-freight.example", role: "editor" },
  { key: "priya", name: "Priya Natarajan", email: "priya@corvid-freight.example", role: "reviewer" },
  { key: "tomas", name: "Tomás Ibarra", email: "tomas@corvid-freight.example", role: "operator" },
  { key: "jun", name: "Jun Park", email: "jun@corvid-freight.example", role: "viewer" },
  { key: "dana", name: "Dana Whitfield", email: "dana@customer.example", role: "customer" },
];

export const SEED_PROJECTS = [
  {
    key: "compliance",
    name: "Vendor security review",
    objective: "Answer a customer's vendor security checklist with cited evidence from our policies.",
    agent: "compliance-advisor",
    color: "teal" as const,
  },
  {
    key: "analysis",
    name: "Q3 shipping performance",
    objective: "Explain on-time performance and claims by region and service level for Q3.",
    agent: "data-analyst",
    color: "violet" as const,
  },
  {
    key: "deck",
    name: "Leadership update deck",
    objective: "Prepare a six-slide leadership update on service levels, refunds and pricing.",
    agent: "presentation-creator",
    color: "amber" as const,
  },
  {
    key: "support",
    name: "Help desk",
    objective: "Answer customer questions from published policies and hand off when evidence is missing.",
    agent: "research-editor",
    color: "slate" as const,
  },
];

export const SEED_MEMORY = [
  { project: "compliance", scope: "project_context" as const, content: "The customer's procurement team requires evidence quotes, not summaries.", status: "approved" as const, source: "user_entered" as const },
  { project: "compliance", scope: "project_context" as const, content: "Jurisdiction for this review: EU customers (GDPR context).", status: "approved" as const, source: "user_entered" as const },
  { project: "analysis", scope: "project_context" as const, content: "Report on-time percentage with one decimal place.", status: "approved" as const, source: "user_entered" as const },
  { project: "analysis", scope: "project_context" as const, content: "Central region had a carrier change in week 6.", status: "proposed" as const, source: "proposed_by_agent" as const },
  { project: null, scope: "user_preference" as const, content: "Prefer concise answers with bullet points.", status: "approved" as const, source: "user_entered" as const },
];
