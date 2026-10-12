export const landing = {
  noticeDetail: "Frontend preview with an in-browser fixture; backend integration pending",
  eyebrow: "Evidence-first AI workspace",
  title: "Answers you can trace. Deliverables you can ship.",
  lead: "Atlas Studio answers from your documents with page-level citations, abstains when evidence is missing, hands work to configurable agents and keeps every report, table and deck versioned, reviewable and cost-accounted.",
  howTitle: "From question to reviewed deliverable",
  pillars: [
    { title: "Cite or abstain", body: "Every answer quotes an authorized document version and page. Without evidence, Atlas says so and offers a person, with the conversation context preserved." },
    { title: "Agents with real boundaries", body: "Six profiles and your own agents change instructions, sources, tools and output format. Prompts and documents can never widen permissions." },
    { title: "Versioned deliverables", body: "Reports, tables and presentations are edited in a canvas, exported to Markdown, CSV, PDF and PPTX, and approved per exact version." },
  ],
  agentsTitle: "Six starting profiles, plus your own",
  agentsLead: "Each profile is a versioned configuration — not a mascot. Choosing one changes what the run is allowed to do.",
  controlTitle: "Control you can audit",
  control: [
    { title: "Cost per model, agent and project", body: "Usage ledger by run and attempt, budgets reserved before every call, cache and reasoning counted once. Unknown costs are shown as unknown — never zero." },
    { title: "Privacy before transfer", body: "Explainable detection of a limited set of sensitive patterns, redaction review and consent before any external provider call. A review aid, not a guarantee." },
    { title: "Traceable runs", body: "Each run freezes the agent version, model, prices and document versions it used, and shows operational steps — never private reasoning." },
  ],
  statusTitle: "What is real in this demo",
  status: [
    { item: "Retrieval, citations, abstention, handoff", mode: "local", note: "Deterministic local adapter; no generative model is claimed." },
    { item: "CSV statistics, gap reports, deck outlines", mode: "local", note: "Computed by bounded tools and templates." },
    { item: "PDF / PPTX / Markdown / CSV export", mode: "local", note: "Real files from structured renderers." },
    { item: "Claude models (Anthropic)", mode: "pending", note: "Adapter prepared; no credentials or authorized budget yet." },
    { item: "Gemini models", mode: "pending", note: "Model IDs and prices not asserted until verified." },
    { item: "Persistence (API + PostgreSQL)", mode: "pending", note: "This preview keeps data in your browser and resets on reload." },
  ] as Array<{ item: string; mode: "local" | "pending" | "connected"; note: string }>,
} as const;
