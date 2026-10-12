/** FIXTURE (P02 preview only): builds the in-memory DEMO workspace from @atlas/demo-seed. */
import type { Chunk, DocumentVersion, Project, Workspace } from "@atlas/contracts";
import { CSV_DOCUMENT, IMAGE_DOCUMENT, SEED_DOCUMENTS, SEED_MEMORY, SEED_PEOPLE, SEED_PROJECTS, shipmentsCsv } from "@atlas/demo-seed";
import { AGENT_PROFILES, DEFAULT_ROUTING_POLICY, DETECTOR_CATALOG, chunkPages, scanText, suggestClassification } from "@atlas/domain";
import { iso, type DocRecord, type Db } from "./db";
import { seedActivity } from "./build-activity";
import { seedUsage } from "./build-usage";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function sha(text: string): string {
  let h1 = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h1 = Math.imul(h1 ^ text.charCodeAt(i), 16777619);
  return `sha256:demo-${(h1 >>> 0).toString(16).padStart(8, "0")}`;
}

function buildDocuments(now: number, projectIds: Record<string, string>): DocRecord[] {
  const docs: DocRecord[] = [];
  SEED_DOCUMENTS.forEach((d, di) => {
    const id = `doc_${d.key}`;
    const versions: DocumentVersion[] = [];
    const pages: DocRecord["pages"] = {};
    const chunks: DocRecord["chunks"] = {};
    d.versions.forEach((v, vi) => {
      const vid = `dv_${d.key}_${v.version}`;
      const text = v.pages.map((p) => p.text).join("\n\n");
      const failed = v.status === "failed";
      const pieces = failed ? [] : chunkPages(v.pages);
      chunks[vid] = pieces.map<Chunk>((c, i) => ({ id: `chk_${d.key}_${v.version}_${i}`, documentId: id, versionId: vid, ordinal: i, page: c.page, text: c.text, charStart: c.start, charEnd: c.end }));
      pages[vid] = v.pages;
      versions.push({
        id: vid,
        documentId: id,
        version: v.version,
        status: failed ? "failed" : "ready",
        sha256: sha(text || d.title),
        byteSize: Math.max(2048, text.length * 3),
        pageCount: failed ? null : v.pages.length,
        chunkCount: pieces.length,
        published: !failed && vi === d.versions.length - 1,
        failureReason: v.failureReason ?? null,
        createdAt: iso(now - (40 - di * 3 - vi * 6) * DAY),
      });
    });
    const latest = versions[versions.length - 1]!;
    const publishedText = (pages[versions.find((v) => v.published)?.id ?? ""] ?? []).map((p) => p.text).join("\n\n");
    const findings = scanText(publishedText);
    docs.push({
      summary: {
        id,
        title: d.title,
        kind: d.kind,
        mimeType: d.mimeType,
        projectIds: d.projects.map((p) => projectIds[p]!),
        classification: findings.length ? suggestClassification(findings, d.classification) : d.classification,
        sensitiveFindingCount: findings.length,
        publishedVersion: versions.find((v) => v.published)?.version ?? null,
        latestStatus: latest.status,
        tags: d.tags,
        label: "DEMO",
        updatedAt: latest.createdAt,
      },
      versions,
      pages,
      chunks,
      csvText: null,
      imagePath: null,
      deleted: false,
    });
  });
  const csv = shipmentsCsv();
  docs.push({
    summary: {
      id: "doc_shipments",
      title: CSV_DOCUMENT.title,
      kind: "csv",
      mimeType: CSV_DOCUMENT.mimeType,
      projectIds: CSV_DOCUMENT.projects.map((p) => projectIds[p]!),
      classification: "internal",
      sensitiveFindingCount: 0,
      publishedVersion: 1,
      latestStatus: "ready",
      tags: CSV_DOCUMENT.tags,
      label: "DEMO",
      updatedAt: iso(now - 9 * DAY),
    },
    versions: [{ id: "dv_shipments_1", documentId: "doc_shipments", version: 1, status: "ready", sha256: sha(csv), byteSize: csv.length, pageCount: null, chunkCount: 0, published: true, failureReason: null, createdAt: iso(now - 9 * DAY) }],
    pages: { dv_shipments_1: [{ page: 1, text: csv.split("\n").slice(0, 16).join("\n") }] },
    chunks: { dv_shipments_1: [] },
    csvText: csv,
    imagePath: null,
    deleted: false,
  });
  docs.push({
    summary: {
      id: "doc_dock_photo",
      title: IMAGE_DOCUMENT.title,
      kind: "image",
      mimeType: IMAGE_DOCUMENT.mimeType,
      projectIds: IMAGE_DOCUMENT.projects.map((p) => projectIds[p]!),
      classification: "internal",
      sensitiveFindingCount: 0,
      publishedVersion: 1,
      latestStatus: "ready",
      tags: IMAGE_DOCUMENT.tags,
      label: "DEMO",
      updatedAt: iso(now - 8 * DAY),
    },
    versions: [{ id: "dv_dock_photo_1", documentId: "doc_dock_photo", version: 1, status: "ready", sha256: "sha256:demo-image", byteSize: 18_432, pageCount: null, chunkCount: 0, published: true, failureReason: null, createdAt: iso(now - 8 * DAY) }],
    pages: { dv_dock_photo_1: [] },
    chunks: { dv_dock_photo_1: [] },
    csvText: null,
    imagePath: IMAGE_DOCUMENT.publicPath,
    deleted: false,
  });
  return docs;
}

export function buildDb(): Db {
  const now = Date.now();
  const workspace: Workspace = {
    id: "wsp_demo_visitor",
    name: "Corvid Freight · Demo",
    kind: "demo_visitor",
    timeZone: "America/Argentina/Buenos_Aires",
    currency: "USD",
    brandName: "Atlas Studio",
    expiresAt: iso(now + 24 * HOUR),
    label: "DEMO",
  };
  const users = SEED_PEOPLE.map((p) => ({ id: `usr_${p.key}`, displayName: p.name, email: p.email, label: "DEMO" as const }));
  const roles = Object.fromEntries(SEED_PEOPLE.map((p) => [`usr_${p.key}`, p.role]));
  const projectIds = Object.fromEntries(SEED_PROJECTS.map((p) => [p.key, `prj_${p.key}`])) as Record<string, string>;
  const agentIds = Object.fromEntries(AGENT_PROFILES.map((a) => [a.slug, `agt_${a.slug.replace(/-/g, "_")}`])) as Record<string, string>;

  const projects: Project[] = SEED_PROJECTS.map((p, i) => ({
    id: projectIds[p.key]!,
    name: p.name,
    objective: p.objective,
    defaultAgentId: agentIds[p.agent] ?? null,
    color: p.color,
    documentCount: 0,
    conversationCount: 0,
    artifactCount: 0,
    memoryEnabled: true,
    label: "DEMO",
    createdAt: iso(now - (30 - i) * DAY),
    updatedAt: iso(now - i * 5 * HOUR),
  }));

  const db: Db = {
    workspace,
    users,
    roles,
    session: null,
    projects,
    memories: SEED_MEMORY.map((m, i) => ({
      id: `mem_${i + 1}`,
      scope: m.scope,
      projectId: m.project ? projectIds[m.project]! : null,
      ownerUserId: "usr_visitor",
      content: m.content,
      status: m.status,
      source: m.source,
      sourceRunId: null,
      createdAt: iso(now - (12 - i) * DAY),
      updatedAt: iso(now - (12 - i) * DAY),
    })),
    documents: buildDocuments(now, projectIds),
    conversations: [],
    agents: AGENT_PROFILES.map((a, i) => ({
      summary: {
        id: agentIds[a.slug]!,
        slug: a.slug,
        name: a.name,
        profile: a.profile,
        builtIn: true,
        description: a.config.description,
        currentVersion: 1,
        style: a.config.style,
        modelKey: a.config.modelKey,
        allowedTools: a.config.allowedTools,
        label: "DEMO",
        updatedAt: iso(now - (20 - i) * DAY),
      },
      versions: [{ id: `agv_${a.slug}_1`, agentId: agentIds[a.slug]!, version: 1, config: a.config, changeNote: "Built-in profile", createdBy: "usr_maya", createdAt: iso(now - (20 - i) * DAY) }],
      guardrails: a.guardrails,
      deleted: false,
    })),
    runs: [],
    ledger: [],
    budgets: [],
    artifacts: [],
    comments: [],
    reviews: [],
    workflows: [],
    workflowRuns: [],
    privacyPolicy: {
      id: "pol_privacy",
      version: 2,
      reviewRequiredFor: ["confidential", "restricted"],
      blockExternalFor: ["restricted"],
      externalTransferRequiresConsent: true,
      retentionDays: { conversations: 365, runTraces: 180, originalsAfterRedaction: 30 },
      enabledDetectors: DETECTOR_CATALOG.map((d) => d.id),
      updatedAt: iso(now - 6 * DAY),
    },
    redactionReviews: [],
    consents: [],
    tickets: [],
    toolProposals: [],
    serviceRequests: [],
    evalSuite: { id: "evs_core", name: "Help desk core behaviors", cases: [] },
    evalRuns: [],
    showcase: [],
    routingPolicy: structuredClone(DEFAULT_ROUTING_POLICY),
    dismissedSuggestions: [],
    audit: [],
    counters: { ticket: 1040, serviceRequest: 310 },
    now,
  };

  seedActivity(db, { projectIds, agentIds });
  seedUsage(db, { projectIds, agentIds });
  return db;
}
