import type { WorkflowStepDef } from "@atlas/contracts";

export const SEED_WORKFLOWS: Array<{
  key: string;
  name: string;
  recipe: "policy_review" | "csv_analysis" | "presentation_prep";
  description: string;
  agent: string;
  project: "compliance" | "analysis" | "deck";
  inputs: Record<string, string>;
  steps: WorkflowStepDef[];
}> = [
  {
    key: "policy_review",
    name: "Review a policy against a checklist",
    recipe: "policy_review",
    description: "Compare a policy with a supplied checklist, produce a cited gap report and request review.",
    agent: "compliance-advisor",
    project: "compliance",
    inputs: { scope: "All production systems", jurisdiction: "EU (GDPR context)" },
    steps: [
      { key: "confirm_brief", title: "Confirm scope and jurisdiction", tool: null, invokesModel: false, requiresConfirmation: true, effect: "none", inputHint: "Scope and jurisdiction supplied by the user." },
      { key: "retrieve", title: "Retrieve policy passages", tool: "retrieve_sources", invokesModel: false, requiresConfirmation: false, effect: "none", inputHint: "Data Retention Policy (published version)." },
      { key: "compare", title: "Compare with checklist", tool: "checklist_compare", invokesModel: false, requiresConfirmation: false, effect: "none", inputHint: "Vendor Security Checklist items." },
      { key: "draft", title: "Draft gap report", tool: "draft_artifact", invokesModel: true, requiresConfirmation: false, effect: "creates_artifact", inputHint: "Report artifact with evidence table." },
      { key: "export", title: "Export PDF", tool: "render_export", invokesModel: false, requiresConfirmation: false, effect: "none", inputHint: "PDF of the current version." },
    ],
  },
  {
    key: "csv_analysis",
    name: "Analyze a CSV",
    recipe: "csv_analysis",
    description: "Validate a CSV, compute deterministic statistics and aggregations, and write a data report.",
    agent: "data-analyst",
    project: "analysis",
    inputs: { file: "shipments_q3.csv", groupBy: "region", measure: "shipments" },
    steps: [
      { key: "profile", title: "Validate and profile CSV", tool: "csv_profile", invokesModel: false, requiresConfirmation: false, effect: "none", inputHint: "Schema, types and issues." },
      { key: "stats", title: "Compute statistics", tool: "csv_stats", invokesModel: false, requiresConfirmation: false, effect: "none", inputHint: "Descriptive statistics per numeric column." },
      { key: "aggregate", title: "Aggregate by group", tool: "csv_aggregate", invokesModel: false, requiresConfirmation: false, effect: "none", inputHint: "Sum of measure by group column." },
      { key: "chart", title: "Build chart", tool: "chart_spec", invokesModel: false, requiresConfirmation: false, effect: "none", inputHint: "Bar chart of the aggregation." },
      { key: "report", title: "Write data report", tool: "draft_artifact", invokesModel: true, requiresConfirmation: false, effect: "creates_artifact", inputHint: "Report artifact with computed tables." },
    ],
  },
  {
    key: "presentation_prep",
    name: "Prepare a presentation",
    recipe: "presentation_prep",
    description: "Brief → outline → slides → preview → export PPTX, keeping sources on each slide.",
    agent: "presentation-creator",
    project: "deck",
    inputs: { audience: "Leadership team", goal: "Q3 service levels, refunds and pricing update", slides: "6" },
    steps: [
      { key: "brief", title: "Confirm brief", tool: null, invokesModel: false, requiresConfirmation: true, effect: "none", inputHint: "Audience, goal, slide count." },
      { key: "facts", title: "Retrieve supporting facts", tool: "retrieve_sources", invokesModel: false, requiresConfirmation: false, effect: "none", inputHint: "Project documents." },
      { key: "outline", title: "Outline slides", tool: "outline_presentation", invokesModel: true, requiresConfirmation: false, effect: "none", inputHint: "One idea per slide." },
      { key: "slides", title: "Create presentation artifact", tool: "draft_artifact", invokesModel: true, requiresConfirmation: false, effect: "creates_artifact", inputHint: "Structured slides with notes." },
      { key: "export", title: "Export PPTX", tool: "render_export", invokesModel: false, requiresConfirmation: false, effect: "none", inputHint: "PPTX of the current version." },
    ],
  },
];

export const SEED_SHOWCASE = [
  {
    slug: "compliance" as const,
    title: "Policy vs. checklist",
    summary: "Run the Compliance Advisor over a policy and a customer checklist, get a cited gap report and send it for review.",
    workflow: "policy_review",
    project: "compliance" as const,
    agent: "compliance-advisor",
  },
  {
    slug: "csv_analysis" as const,
    title: "CSV to report",
    summary: "Validate shipments_q3.csv, compute statistics with deterministic tools and produce a data report.",
    workflow: "csv_analysis",
    project: "analysis" as const,
    agent: "data-analyst",
  },
  {
    slug: "presentation" as const,
    title: "Brief to deck",
    summary: "Turn a brief into an editable six-slide deck with sources, then export a real PPTX.",
    workflow: "presentation_prep",
    project: "deck" as const,
    agent: "presentation-creator",
  },
];
